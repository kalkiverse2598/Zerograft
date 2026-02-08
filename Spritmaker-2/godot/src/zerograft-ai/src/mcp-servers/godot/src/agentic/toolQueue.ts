/**
 * Tool Queue - Async execution queue with safety guards
 * 
 * Executes tools serially by default to prevent race conditions,
 * with support for parallel execution of read-only tools.
 */

import {
    ToolCall,
    QueuedToolCall,
    ToolResult,
    ErrorCode,
    isReadOnlyTool,
    getToolTimeout,
    createErrorResult,
    DEFAULT_SAFETY_SETTINGS,
    SafetySettings
} from './types.js';

export class ToolQueue {
    private queue: QueuedToolCall[] = [];
    private isProcessing: boolean = false;  // Re-entrancy guard
    private isCancelled: boolean = false;
    private currentExecution: { call: ToolCall; abortController: AbortController } | null = null;
    private settings: SafetySettings;

    constructor(
        private executor: (call: ToolCall, signal: AbortSignal) => Promise<ToolResult>,
        settings?: Partial<SafetySettings>
    ) {
        this.settings = { ...DEFAULT_SAFETY_SETTINGS, ...settings };
    }

    /**
     * Enqueue a tool for execution
     * @returns Promise that resolves with the tool result
     */
    async enqueue(call: ToolCall): Promise<ToolResult> {
        if (this.isCancelled) {
            return createErrorResult(ErrorCode.CANCELLED, "Queue cancelled");
        }

        return new Promise((resolve, reject) => {
            const queuedCall: QueuedToolCall = {
                call,
                resolve,
                reject,
                retryCount: 0
            };

            this.queue.push(queuedCall);
            this.processNext();
        });
    }

    /**
     * Batch enqueue multiple read-only tools for parallel execution
     */
    async enqueueBatch(calls: ToolCall[]): Promise<ToolResult[]> {
        // Filter to only read-only tools
        const readOnlyCalls = calls.filter(c => isReadOnlyTool(c.name));
        const otherCalls = calls.filter(c => !isReadOnlyTool(c.name));

        // Execute read-only in parallel
        const readOnlyResults = await Promise.all(
            readOnlyCalls.map(call => this.executeWithTimeout(call))
        );

        // Queue others for serial execution
        const otherResults = await Promise.all(
            otherCalls.map(call => this.enqueue(call))
        );

        // Merge results in original order
        const results: ToolResult[] = [];
        let roIndex = 0, otherIndex = 0;

        for (const call of calls) {
            if (isReadOnlyTool(call.name)) {
                results.push(readOnlyResults[roIndex++]);
            } else {
                results.push(otherResults[otherIndex++]);
            }
        }

        return results;
    }

    /**
     * Cancel all pending operations
     */
    cancel(): void {
        this.isCancelled = true;

        // Abort current execution
        if (this.currentExecution) {
            this.currentExecution.abortController.abort();
        }

        // Reject all pending
        while (this.queue.length > 0) {
            const queued = this.queue.shift()!;
            queued.resolve(createErrorResult(ErrorCode.CANCELLED, "Queue cancelled"));
        }
    }

    /**
     * Reset the queue for a new task
     */
    reset(): void {
        this.isCancelled = false;
        this.isProcessing = false;
        this.currentExecution = null;
        this.queue = [];
    }

    /**
     * Get queue status
     */
    getStatus(): { pending: number; isProcessing: boolean; isCancelled: boolean } {
        return {
            pending: this.queue.length,
            isProcessing: this.isProcessing,
            isCancelled: this.isCancelled
        };
    }

    /**
     * Process next item in queue (with re-entrancy guard)
     */
    private async processNext(): Promise<void> {
        // Re-entrancy guard: prevent double processing
        if (this.isProcessing) {
            return;
        }

        if (this.queue.length === 0 || this.isCancelled) {
            return;
        }

        this.isProcessing = true;

        try {
            while (this.queue.length > 0 && !this.isCancelled) {
                const queued = this.queue.shift()!;

                try {
                    const result = await this.executeWithTimeout(queued.call);
                    queued.resolve(result);
                } catch (error) {
                    // Handle retry
                    if (queued.retryCount < this.settings.maxRetriesPerTool) {
                        queued.retryCount++;
                        console.log(`[ToolQueue] Retrying ${queued.call.name} (attempt ${queued.retryCount + 1})`);
                        this.queue.unshift(queued);  // Re-add to front
                    } else {
                        queued.resolve(createErrorResult(
                            ErrorCode.TOOL_FAILURE,
                            `Failed after ${this.settings.maxRetriesPerTool} retries: ${error}`,
                            false
                        ));
                    }
                }
            }
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Execute a tool with timeout
     */
    private async executeWithTimeout(call: ToolCall): Promise<ToolResult> {
        const timeout = getToolTimeout(call.name, this.settings);
        const abortController = new AbortController();

        this.currentExecution = { call, abortController };

        const timeoutId = setTimeout(() => {
            abortController.abort();
        }, timeout);

        const startTime = Date.now();

        try {
            const result = await this.executor(call, abortController.signal);
            result.durationMs = Date.now() - startTime;
            return result;
        } catch (error) {
            if (abortController.signal.aborted) {
                return createErrorResult(
                    ErrorCode.TIMEOUT,
                    `Tool ${call.name} timed out after ${timeout}ms`
                );
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
            this.currentExecution = null;
        }
    }
}
