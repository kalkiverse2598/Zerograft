/**
 * Agentic Router - Wraps AIRouter with TaskExecutor for full agentic loop
 * 
 * This integrates the agentic engine with the existing AIRouter,
 * enabling multi-step autonomous task execution.
 * 
 * Supports two modes:
 * - Single Agent: Original TaskExecutor loop
 * - Multi-Agent: Specialized agents coordinated by Orchestrator
 */

import {
    TaskExecutor,
    TaskCallbacks,
    LLMResponse
} from './taskExecutor.js';

import {
    TaskState,
    ToolCall,
    AskFollowupParams,
    AttemptCompletionParams,
    isFileModifyingTool,
    ToolResult,
    createSuccessResult,
    createErrorResult,
    ErrorCode
} from './types.js';

import {
    MultiAgentSystem,
    MultiAgentConfig,
    MultiAgentCallbacks
} from './multiAgentSystem.js';

export interface AgenticRouterCallbacks {
    /** Execute tool via Godot bridge */
    executeTool: (name: string, params: Record<string, unknown>) => Promise<unknown>;

    /** Send to LLM with streaming */
    sendToLLMWithStream: (
        systemPrompt: string,
        context: string,
        onThinking?: (text: string) => void,
        onText?: (text: string) => void,
        imageData?: string[]
    ) => Promise<LLMResponse>;

    /** Get system prompt */
    getSystemPrompt: () => string;

    /** UI: Show progress */
    onProgress: (message: string) => void;

    /** UI: Show approval dialog */
    onApprovalRequest: (tool: ToolCall) => Promise<boolean>;

    /** UI: Show question */
    onQuestion: (params: AskFollowupParams) => Promise<string | null>;

    /** UI: State change */
    onStateChange: (state: TaskState) => void;

    /** UI: Completion */
    onComplete: (result: AttemptCompletionParams) => void;

    /** UI: Error */
    onError: (error: string) => void;

    /** UI: Thinking text */
    onThinking?: (text: string) => void;

    /** UI: Response text */
    onText?: (text: string) => void;

    /** UI: File changed notification (for Files Changed panel) */
    onFileChange?: (toolName: string, success: boolean, path?: string) => void;

    /** UI: Diff preview for file modifications */
    onDiff?: (toolName: string, filePath: string, before: string, after: string) => void;

    /** UI: Agent status update (for Agents tab) */
    onAgentStatus?: (name: string, role: string, state: string, progress: number) => void;

    /** UI: Multi-agent mode enabled/disabled */
    onMultiAgentEnabled?: (enabled: boolean) => void;

    /** UI: Plan created (for Tasks tab) */
    onPlanCreated?: (plan: {
        id: string;
        tasks: Array<{
            id: string;
            type: string;
            description: string;
            assignedAgent: string;
            status?: string;
        }>;
    }) => void;
}

export class AgenticRouter {
    private executor: TaskExecutor;
    private callbacks: AgenticRouterCallbacks;
    private multiAgentSystem: MultiAgentSystem | null = null;
    private multiAgentEnabled: boolean = false;
    private instanceId: number = Math.floor(Math.random() * 10000);

    // Track last multi-agent request for retry continuity
    private lastMultiAgentRequest: string | null = null;
    private lastMultiAgentError: string | null = null;

    constructor(callbacks: AgenticRouterCallbacks, multiAgentConfig?: Partial<MultiAgentConfig>) {
        this.callbacks = callbacks;

        const taskCallbacks: TaskCallbacks = {
            executeTool: async (name: string, params: Record<string, unknown>) => {
                const pathParam = typeof params.path === 'string' ? params.path : undefined;
                const contentParam = typeof params.content === 'string' ? params.content : '';
                const shouldCaptureScriptDiff = name === 'edit_script' && !!callbacks.onDiff && !!pathParam;
                let beforeContent = '';

                if (shouldCaptureScriptDiff && pathParam) {
                    try {
                        const beforeResult = await callbacks.executeTool('read_script', { path: pathParam }) as {
                            success?: boolean;
                            content?: string;
                        };
                        if (beforeResult?.success !== false && typeof beforeResult?.content === 'string') {
                            beforeContent = beforeResult.content;
                        }
                    } catch {
                        // Best-effort diff capture; don't block tool execution.
                    }
                }

                const result = await callbacks.executeTool(name, params);
                const resultObj = result as {
                    success?: boolean;
                    path?: string;
                    saved_to_godot?: string;
                };

                // Notify UI about file changes
                if (isFileModifyingTool(name) && callbacks.onFileChange) {
                    const path = resultObj?.path || resultObj?.saved_to_godot || pathParam;
                    callbacks.onFileChange(name, resultObj?.success !== false, path);
                }

                if (shouldCaptureScriptDiff && callbacks.onDiff && pathParam && resultObj?.success !== false) {
                    callbacks.onDiff(name, pathParam, beforeContent, contentParam);
                }

                return result;
            },

            sendToLLM: async (context: string, imageData?: string[]) => {
                const systemPrompt = callbacks.getSystemPrompt();
                return callbacks.sendToLLMWithStream(
                    systemPrompt,
                    context,
                    callbacks.onThinking,
                    callbacks.onText,
                    imageData
                );
            },

            requestApproval: callbacks.onApprovalRequest,

            showDiff: async (tool, before, after) => {
                // Send diff to UI if callback available
                const toolName = tool?.name || 'unknown';
                if (callbacks.onDiff) {
                    const path = (tool?.params as { path?: string })?.path || "unknown";
                    callbacks.onDiff(toolName, path, before, after);
                }
                console.log(`[Diff] ${toolName}: ${before.length} -> ${after.length} chars`);
            },

            askUser: callbacks.onQuestion,

            onProgress: callbacks.onProgress,

            onStateChange: callbacks.onStateChange,

            onComplete: callbacks.onComplete,

            onError: callbacks.onError,

            getTokenCount: (context: string) => {
                // Rough estimate: ~4 chars per token
                return Math.ceil(context.length / 4);
            },

            summarizeContext: async (context: string) => {
                // Use LLM to summarize
                const response = await callbacks.sendToLLMWithStream(
                    "You are a helpful assistant. Summarize the following conversation history concisely, keeping important details about what was done and what needs to be done.",
                    context
                );
                return response.text;
            },

            // Wire agent status to UI callback
            onAgentStatus: callbacks.onAgentStatus
        };

        this.executor = new TaskExecutor(taskCallbacks);

        // Initialize multi-agent system if enabled
        if (multiAgentConfig?.enabled) {
            this.initMultiAgentSystem(multiAgentConfig);
            this.multiAgentEnabled = true;  // Enable multi-agent mode
            console.log(`[AgenticRouter#${this.instanceId}] Constructor: enabled=${this.multiAgentEnabled}, system=${!!this.multiAgentSystem}`);
        }
    }

    /**
     * Initialize the multi-agent system
     */
    private initMultiAgentSystem(config?: Partial<MultiAgentConfig>): void {
        const multiAgentCallbacks: MultiAgentCallbacks = {
            executeTool: async (name: string, params: Record<string, unknown>): Promise<ToolResult> => {
                try {
                    const pathParam = typeof params.path === 'string' ? params.path : undefined;
                    const contentParam = typeof params.content === 'string' ? params.content : '';
                    const shouldCaptureScriptDiff = name === 'edit_script' && !!this.callbacks.onDiff && !!pathParam;
                    let beforeContent = '';

                    if (shouldCaptureScriptDiff && pathParam) {
                        try {
                            const beforeResult = await this.callbacks.executeTool('read_script', { path: pathParam }) as {
                                success?: boolean;
                                content?: string;
                            };
                            if (beforeResult?.success !== false && typeof beforeResult?.content === 'string') {
                                beforeContent = beforeResult.content;
                            }
                        } catch {
                            // Best-effort diff capture; don't block tool execution.
                        }
                    }

                    const result = await this.callbacks.executeTool(name, params);
                    const resultObj = result as {
                        success?: boolean;
                        path?: string;
                        saved_to_godot?: string;
                        message?: string;
                        error?: string;
                    };

                    // Notify UI about file changes
                    if (isFileModifyingTool(name) && this.callbacks.onFileChange) {
                        const path = resultObj?.path || resultObj?.saved_to_godot || pathParam;
                        this.callbacks.onFileChange(name, resultObj?.success !== false, path);
                    }

                    if (shouldCaptureScriptDiff && this.callbacks.onDiff && pathParam && resultObj?.success !== false) {
                        this.callbacks.onDiff(name, pathParam, beforeContent, contentParam);
                    }

                    // Convert to ToolResult format
                    if (resultObj?.success === false) {
                        return createErrorResult(
                            ErrorCode.TOOL_FAILURE,
                            resultObj.error || resultObj.message || `${name} failed`,
                            true
                        );
                    }
                    return createSuccessResult(result, `${name} completed`);
                } catch (error) {
                    return createErrorResult(
                        ErrorCode.TOOL_FAILURE,
                        error instanceof Error ? error.message : String(error),
                        true
                    );
                }
            },

            sendToLLM: async (context: string, imageData?: string[]): Promise<string> => {
                const systemPrompt = this.callbacks.getSystemPrompt();
                const response = await this.callbacks.sendToLLMWithStream(
                    systemPrompt,
                    context,
                    this.callbacks.onThinking,
                    this.callbacks.onText,
                    imageData
                );
                return response.text;
            },

            onProgress: this.callbacks.onProgress,

            requestApproval: async (operation: string, details: string): Promise<boolean> => {
                // Use the existing approval mechanism
                const toolCall: ToolCall = {
                    id: 'multi-agent-approval',
                    name: operation,
                    params: { details },
                    timestamp: Date.now()
                };
                return this.callbacks.onApprovalRequest(toolCall);
            },

            // Wire up agent status to UI
            onAgentStatus: this.callbacks.onAgentStatus,
            onMultiAgentEnabled: this.callbacks.onMultiAgentEnabled,
            onPlanCreated: this.callbacks.onPlanCreated
        };

        this.multiAgentSystem = new MultiAgentSystem(multiAgentCallbacks, config);
        this.multiAgentEnabled = true;
        console.log('[AgenticRouter] Multi-agent system initialized');
    }

    /**
     * Enable or disable multi-agent mode
     */
    setMultiAgentEnabled(enabled: boolean): void {
        if (enabled && !this.multiAgentSystem) {
            this.initMultiAgentSystem({ enabled: true });
        }
        this.multiAgentEnabled = enabled;
        if (this.multiAgentSystem) {
            this.multiAgentSystem.setEnabled(enabled);
        }
        console.log(`[AgenticRouter] Multi-agent mode: ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Check if multi-agent mode is enabled
     */
    isMultiAgentEnabled(): boolean {
        return this.multiAgentEnabled && this.multiAgentSystem !== null;
    }

    /**
     * Detect if a request should use multi-agent routing
     * Complex requests involving multiple domains benefit from multi-agent
     * Simple confirmations/responses go to single-agent executor
     */
    private shouldUseMultiAgent(userMessage: string): boolean {
        console.log(`[AgenticRouter#${this.instanceId}] shouldUseMultiAgent check: enabled=${this.multiAgentEnabled}, system=${!!this.multiAgentSystem}`);

        if (!this.multiAgentEnabled || !this.multiAgentSystem) {
            return false;
        }

        // Detect simple confirmation/response messages - these should use single-agent
        const normalizedMessage = userMessage.toLowerCase().trim();
        const simpleResponses = [
            'yes', 'no', 'okay', 'ok', 'sure', 'yep', 'nope', 'yeah', 'nah',
            'looks good', 'looks great', 'perfect', 'good', 'great', 'fine',
            'continue', 'proceed', 'go ahead', 'do it', 'approved', 'approve',
            'cancel', 'stop', 'abort', 'retry', 'try again'
        ];

        if (simpleResponses.some(response => normalizedMessage === response || normalizedMessage.startsWith(response + ' '))) {
            console.log('[AgenticRouter] Simple response detected, using single-agent executor');
            return false;
        }

        // Short messages (under 15 chars) without action words are likely confirmations
        if (normalizedMessage.length < 15 && !normalizedMessage.includes('create') && !normalizedMessage.includes('make') &&
            !normalizedMessage.includes('add') && !normalizedMessage.includes('generate') && !normalizedMessage.includes('build')) {
            console.log('[AgenticRouter] Short message without action words, using single-agent executor');
            return false;
        }

        // All other messages (including questions) go to multi-agent system
        // The Orchestrator will detect questions and handle them with LLM + context
        console.log('[AgenticRouter] Routing to MultiAgentSystem (Orchestrator will detect questions)');
        return true;
    }

    /**
     * Detect if a user message is a retry/continuation of a previous failed task
     */
    private isRetryMessage(message: string): boolean {
        const normalized = message.toLowerCase().trim();
        const retryPhrases = [
            'try again', 'retry', 'redo', 'do it again', 'repeat',
            'continue', 'proceed', 'go ahead', 'yes', 'ok', 'okay',
            'sure', 'yep', 'yeah', 'do it'
        ];
        return retryPhrases.some(phrase => normalized === phrase || normalized.startsWith(phrase + ' '));
    }

    /**
     * Start a new agentic task (continues conversation by default)
     * @param userMessage - The user's message
     * @param imageData - Optional base64-encoded image data (PNG format)
     */
    async startTask(userMessage: string, imageData?: string[]): Promise<void> {
        // Check if we should use multi-agent routing
        if (this.shouldUseMultiAgent(userMessage)) {
            await this.startMultiAgentTask(userMessage);
            return;
        }

        // RETRY FIX: If this is a retry message and we have a previous multi-agent
        // request that failed, re-route to multi-agent with the original request
        if (this.isRetryMessage(userMessage) && this.lastMultiAgentRequest && this.lastMultiAgentError) {
            console.log(`[AgenticRouter] Retry detected - re-running original request: "${this.lastMultiAgentRequest}"`);
            this.callbacks.onProgress(`Retrying: ${this.lastMultiAgentRequest}`);
            const originalRequest = this.lastMultiAgentRequest;
            // Clear the error so we don't loop on repeated failures
            this.lastMultiAgentError = null;
            await this.startMultiAgentTask(originalRequest);
            return;
        }

        // Emit agent status: Orchestrator starts working
        if (this.callbacks.onAgentStatus) {
            this.callbacks.onAgentStatus('Orchestrator', 'Plans and coordinates', 'working', 0.1);
        }

        try {
            // Fall back to single-agent executor
            await this.executor.startTask(userMessage, false, imageData);

            // Emit agent status: Orchestrator complete
            if (this.callbacks.onAgentStatus) {
                this.callbacks.onAgentStatus('Orchestrator', 'Plans and coordinates', 'complete', 1.0);
            }
        } catch (error) {
            // Emit agent status: Orchestrator error
            if (this.callbacks.onAgentStatus) {
                this.callbacks.onAgentStatus('Orchestrator', 'Plans and coordinates', 'error', 0);
            }
            throw error;
        }
    }

    /**
     * Start a task using the multi-agent system
     */
    private async startMultiAgentTask(userMessage: string): Promise<void> {
        if (!this.multiAgentSystem) {
            this.callbacks.onError('Multi-agent system not initialized');
            return;
        }

        // Store the request for retry continuity
        this.lastMultiAgentRequest = userMessage;
        this.lastMultiAgentError = null;

        this.callbacks.onProgress('Starting multi-agent task...');
        this.callbacks.onStateChange(TaskState.RUNNING);

        try {
            const result = await this.multiAgentSystem.processRequest(userMessage);

            if (result.success) {
                // Clear retry state on success
                this.lastMultiAgentRequest = null;
                this.lastMultiAgentError = null;

                // Check if this was a conversational response (question answered)
                const isConversationalResponse = result.output?.type === 'conversational_response';
                const resultMessage = isConversationalResponse
                    ? (result.output?.response as string || 'Question answered')
                    : 'Multi-agent task completed successfully';

                this.callbacks.onComplete({
                    result: resultMessage,
                    artifacts: {
                        createdFiles: result.artifacts,
                        modifiedFiles: [],
                        nodesAdded: [],
                        commandsRun: []
                    },
                    next_suggestions: isConversationalResponse
                        ? ['Ask another question', 'Create something new', 'Check project status']
                        : ['Test the created game', 'Add more animations', 'Create additional levels']
                });
            } else {
                const errorMsg = result.error?.message || 'Multi-agent task failed';
                this.lastMultiAgentError = errorMsg;
                this.callbacks.onError(errorMsg);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.lastMultiAgentError = errorMsg;
            this.callbacks.onError(errorMsg);
        } finally {
            this.callbacks.onStateChange(TaskState.COMPLETED);
        }
    }

    /**
     * Start a fresh task (clears conversation history)
     */
    async startFreshTask(userMessage: string): Promise<void> {
        this.lastMultiAgentRequest = null;
        this.lastMultiAgentError = null;
        await this.executor.startTask(userMessage, true);
    }

    /**
     * Resume after user answers a question
     */
    async resumeWithAnswer(answer: string, contextKey: string): Promise<void> {
        await this.executor.resumeWithAnswer(answer, contextKey);
    }

    /**
     * Cancel the current task
     */
    cancel(): void {
        this.executor.cancel();
    }

    /**
     * Get current state
     */
    getState(): TaskState {
        return this.executor.getContext().state;
    }

    /**
     * Clear conversation history (for new session button)
     */
    clearHistory(): void {
        this.lastMultiAgentRequest = null;
        this.lastMultiAgentError = null;
        this.executor.startTask("", true).catch(() => { });
        this.executor.cancel();
    }

    /**
     * Get the multi-agent system instance (for debugging/testing)
     */
    getMultiAgentSystem(): MultiAgentSystem | null {
        return this.multiAgentSystem;
    }

    /**
     * Shutdown multi-agent system
     */
    shutdown(): void {
        if (this.multiAgentSystem) {
            this.multiAgentSystem.shutdown();
            this.multiAgentSystem = null;
            this.multiAgentEnabled = false;
        }
    }
}
