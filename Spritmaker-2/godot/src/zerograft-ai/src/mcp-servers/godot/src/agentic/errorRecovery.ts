/**
 * Error Recovery - Error classification and retry strategies
 * 
 * Provides smart error recovery for the agentic loop.
 */

import {
    ErrorCode,
    ToolResult,
    ToolCall,
    ErrorLog,
    createErrorResult
} from './types.js';

// ============================================
// Error Classification
// ============================================

export interface ErrorClassification {
    code: ErrorCode;
    category: 'validation' | 'tool' | 'context' | 'godot' | 'timeout' | 'user';
    retryable: boolean;
    maxRetries: number;
    suggestedAction: string;
}

/**
 * Classify an error to determine recovery strategy
 */
export function classifyError(result: ToolResult, toolName: string): ErrorClassification {
    switch (result.code) {
        case ErrorCode.VALIDATION_ERROR:
            return {
                code: result.code,
                category: 'validation',
                retryable: true,
                maxRetries: 2,
                suggestedAction: 'Fix parameter values and retry'
            };

        case ErrorCode.TOOL_FAILURE:
            return {
                code: result.code,
                category: 'tool',
                retryable: true,
                maxRetries: 2,
                suggestedAction: 'Modify approach and retry'
            };

        case ErrorCode.MISSING_CONTEXT:
            return {
                code: result.code,
                category: 'context',
                retryable: true,
                maxRetries: 1,
                suggestedAction: 'Gather more context with read operations'
            };

        case ErrorCode.GODOT_ERROR:
            return {
                code: result.code,
                category: 'godot',
                retryable: isRetryableGodotError(result.message),
                maxRetries: 1,
                suggestedAction: 'Check Godot state and fix script/scene issues'
            };

        case ErrorCode.TIMEOUT:
            return {
                code: result.code,
                category: 'timeout',
                retryable: true,
                maxRetries: 1,
                suggestedAction: 'Retry with simpler operation or increase timeout'
            };

        case ErrorCode.CANCELLED:
            return {
                code: result.code,
                category: 'user',
                retryable: false,
                maxRetries: 0,
                suggestedAction: 'User cancelled - stop this tool'
            };

        default:
            return {
                code: result.code,
                category: 'tool',
                retryable: true,
                maxRetries: 1,
                suggestedAction: 'Unknown error - try alternative approach'
            };
    }
}

/**
 * Check if a Godot error is potentially retryable
 */
function isRetryableGodotError(message: string): boolean {
    const msg = message.toLowerCase();

    // Script syntax errors - not retryable without fix
    if (msg.includes('syntax error') || msg.includes('parse error')) {
        return false;
    }

    // File not found - may be retryable after creation
    if (msg.includes('not found') || msg.includes('does not exist')) {
        return true;
    }

    // Resource busy - retryable
    if (msg.includes('busy') || msg.includes('locked')) {
        return true;
    }

    // Default: assume retryable
    return true;
}

// ============================================
// Error Recovery Strategies
// ============================================

export interface RecoveryPlan {
    shouldRetry: boolean;
    modifiedParams?: Record<string, unknown>;
    prependTools?: ToolCall[];  // Tools to run before retry
    userMessage?: string;       // Message to show user
}

/**
 * Generate a recovery plan for a failed tool
 */
export function generateRecoveryPlan(
    toolCall: ToolCall,
    result: ToolResult,
    attemptCount: number,
    classification: ErrorClassification
): RecoveryPlan {
    // DEFENSIVE: Validate toolCall before processing
    if (!toolCall || typeof toolCall.name !== 'string') {
        console.warn('[ErrorRecovery] Invalid toolCall passed to generateRecoveryPlan');
        return { shouldRetry: false, userMessage: 'Invalid tool call' };
    }

    // Check if we've exceeded max retries
    if (attemptCount >= classification.maxRetries) {
        return {
            shouldRetry: false,
            userMessage: `Failed after ${attemptCount} attempts: ${result.message}`
        };
    }

    // Generate recovery based on error category
    switch (classification.category) {
        case 'validation':
            return recoverFromValidation(toolCall, result);

        case 'context':
            return recoverFromMissingContext(toolCall, result);

        case 'godot':
            return recoverFromGodotError(toolCall, result);

        case 'timeout':
            return recoverFromTimeout(toolCall);

        case 'tool':
            return {
                shouldRetry: true,
                userMessage: undefined
            };

        default:
            return { shouldRetry: false };
    }
}

function recoverFromValidation(toolCall: ToolCall, result: ToolResult): RecoveryPlan {
    const msg = result.message.toLowerCase();

    // Path issues - try to fix path format
    const params = toolCall.params || {};
    if (msg.includes('path') && typeof params.path === 'string' && !params.path.startsWith('res://')) {
        const path = params.path;
        return {
            shouldRetry: true,
            modifiedParams: {
                ...params,
                path: `res://${path}`
            }
        };
    }

    // Missing required param - can't auto-fix
    if (msg.includes('required')) {
        return {
            shouldRetry: false,
            userMessage: `Missing required parameter: ${result.message}`
        };
    }

    return { shouldRetry: true };
}

function recoverFromMissingContext(toolCall: ToolCall, result: ToolResult): RecoveryPlan {
    const msg = result.message.toLowerCase();

    // Node not found - prepend with scene tree check
    if (msg.includes('node') && msg.includes('not found')) {
        return {
            shouldRetry: true,
            prependTools: [{
                id: `recovery_${Date.now()}`,
                name: 'get_scene_tree',
                params: {},
                timestamp: Date.now()
            }]
        };
    }

    // Scene not open - prepend with open scene
    if (msg.includes('scene') && (msg.includes('not open') || msg.includes('no scene'))) {
        const scenePath = extractPathFromMessage(result.message);
        if (scenePath) {
            return {
                shouldRetry: true,
                prependTools: [{
                    id: `recovery_${Date.now()}`,
                    name: 'open_scene',
                    params: { path: scenePath },
                    timestamp: Date.now()
                }]
            };
        }
    }

    return { shouldRetry: true };
}

function recoverFromGodotError(toolCall: ToolCall, result: ToolResult): RecoveryPlan {
    const msg = result.message.toLowerCase();

    // Script error - need to fix script
    if (msg.includes('script') && (msg.includes('error') || msg.includes('invalid'))) {
        return {
            shouldRetry: false,
            userMessage: `Script error: ${result.message}. Please fix the script syntax.`
        };
    }

    return { shouldRetry: true };
}

function recoverFromTimeout(toolCall: ToolCall): RecoveryPlan {
    // For SpriteMancer tools, suggest longer wait
    if (toolCall.name.startsWith('spritemancer_')) {
        return {
            shouldRetry: true,
            userMessage: 'SpriteMancer generation is taking longer than expected. Retrying...'
        };
    }

    return { shouldRetry: true };
}

/**
 * Extract a file path from an error message
 */
function extractPathFromMessage(message: string): string | null {
    // Look for res:// paths
    const resMatch = message.match(/res:\/\/[^\s"']+/);
    if (resMatch) {
        return resMatch[0];
    }

    // Look for .tscn, .gd, .tres files
    const fileMatch = message.match(/[\w\/]+\.(tscn|gd|tres)/i);
    if (fileMatch) {
        return `res://${fileMatch[0]}`;
    }

    return null;
}

// ============================================
// Error Logging
// ============================================

export class ErrorLogger {
    private logs: ErrorLog[] = [];
    private maxLogs: number = 100;

    log(toolCall: ToolCall, result: ToolResult, attempt: number): ErrorLog {
        // DEFENSIVE: Handle undefined toolCall
        const entry: ErrorLog = {
            tool: toolCall?.name || 'unknown',
            params: toolCall?.params || {},
            errorCode: result.code,
            errorMessage: result.message,
            attempt,
            timestamp: Date.now()
        };

        this.logs.push(entry);

        // Trim old logs
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        return entry;
    }

    getRecent(count: number = 10): ErrorLog[] {
        return this.logs.slice(-count);
    }

    getByTool(toolName: string): ErrorLog[] {
        return this.logs.filter(e => e.tool === toolName);
    }

    getFailureRate(toolName: string): number {
        const toolLogs = this.getByTool(toolName);
        if (toolLogs.length === 0) return 0;
        return toolLogs.length; // All logged are failures
    }

    clear(): void {
        this.logs = [];
    }

    toJSON(): string {
        return JSON.stringify(this.logs, null, 2);
    }
}
