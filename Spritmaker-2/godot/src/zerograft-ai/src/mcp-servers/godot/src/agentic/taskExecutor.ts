/**
 * Task Executor - Agentic loop that runs until completion or failure
 * 
 * Implements the recursive agentic loop:
 * 1. Send context to LLM
 * 2. Parse tool calls from response
 * 3. Execute tools via ToolQueue
 * 4. Append results to context
 * 5. Check for completion/followup
 * 6. Loop until done
 */

import {
    TaskState,
    TaskContext,
    TaskArtifacts,
    ToolCall,
    ToolResult,
    ErrorCode,
    ErrorLog,
    SafetySettings,
    DEFAULT_SAFETY_SETTINGS,
    AskFollowupParams,
    AttemptCompletionParams,
    createSuccessResult,
    createErrorResult,
    isGatedTool,
    isShowDiffTool
} from './types.js';
import { ToolQueue } from './toolQueue.js';

// ============================================
// Callbacks for external integrations
// ============================================

export interface TaskCallbacks {
    /** Execute a tool via bridge */
    executeTool: (name: string, params: Record<string, unknown>) => Promise<unknown>;

    /** Send message to LLM and get response with tool calls */
    sendToLLM: (context: string, imageData?: string[]) => Promise<LLMResponse>;

    /** Show approval dialog for gated tools */
    requestApproval: (tool: ToolCall) => Promise<boolean>;

    /** Show diff preview for edit tools */
    showDiff: (tool: ToolCall, before: string, after: string) => Promise<void>;

    /** Show followup question to user */
    askUser: (params: AskFollowupParams) => Promise<string | null>;

    /** Stream progress updates */
    onProgress: (message: string, percent?: number) => void;

    /** Called when state changes */
    onStateChange: (state: TaskState) => void;

    /** Called when task completes */
    onComplete: (result: AttemptCompletionParams) => void;

    /** Called on error */
    onError: (error: string) => void;

    /** Get current context token count */
    getTokenCount: (context: string) => number;

    /** Summarize context when too long */
    summarizeContext: (context: string) => Promise<string>;

    /** Emit agent status for UI (optional) */
    onAgentStatus?: (name: string, role: string, state: string, progress: number) => void;
}

export interface LLMResponse {
    text: string;
    toolCalls: ToolCall[];
    thinking?: string;
}

// ============================================
// Phase 0: Tool Precondition Definitions
// ============================================

/** Tools that require an open scene to work */
const TOOLS_REQUIRING_SCENE = new Set([
    'add_node',
    'remove_node',
    'rename_node',
    'duplicate_node',
    'move_node',
    'reparent_node',
    'get_node_info',
    'copy_node',
    'save_scene',
    'get_scene_tree',
    'get_property',
    'set_property',
    'scene_pack',
    'set_owner_recursive',
    'set_collision_shape',
    'attach_script',
    'connect_signal',
    'list_signals',
    'add_to_group',
    'remove_from_group',
    'list_groups',
]);

/** Error patterns and their recovery strategies */
interface RecoveryStrategy {
    pattern: RegExp;
    errorType: string;
    recoveryHint: string;
    autoRecoverable: boolean;
    recoveryAction?: string;  // Tool to invoke for auto-recovery
    recoveryParams?: Record<string, unknown>;
}

const ERROR_RECOVERY_STRATEGIES: RecoveryStrategy[] = [
    {
        pattern: /no scene (currently )?open|No scene open/i,
        errorType: 'NO_SCENE_OPEN',
        recoveryHint: 'No scene is currently open. Use open_scene to open an existing scene or create_scene to create a new one.',
        autoRecoverable: false,
    },
    {
        pattern: /node not found|Node not found/i,
        errorType: 'NODE_NOT_FOUND',
        recoveryHint: 'The specified node path does not exist. Use get_scene_tree to see the current scene structure.',
        autoRecoverable: false,
    },
    {
        pattern: /script error|parse error|syntax error/i,
        errorType: 'SCRIPT_ERROR',
        recoveryHint: 'There is a script error. Use get_errors to see detailed error messages, then edit_script to fix the issue.',
        autoRecoverable: false,
    },
    {
        pattern: /resource not found|Failed to load/i,
        errorType: 'RESOURCE_NOT_FOUND',
        recoveryHint: 'The specified resource file does not exist. Use list_files to see available files or create the resource first.',
        autoRecoverable: false,
    },
    {
        pattern: /invalid node type|Invalid node type/i,
        errorType: 'INVALID_NODE_TYPE',
        recoveryHint: 'The specified node type is not valid. Common types: Node2D, CharacterBody2D, Sprite2D, AnimatedSprite2D, Camera2D, CollisionShape2D.',
        autoRecoverable: false,
    },
    {
        pattern: /property.*not found|unknown property/i,
        errorType: 'PROPERTY_NOT_FOUND',
        recoveryHint: 'The specified property does not exist on this node. Use get_node_info to see available properties.',
        autoRecoverable: false,
    },
];

// ============================================
// Task Executor
// ============================================

export class TaskExecutor {
    private context: TaskContext;
    private toolQueue: ToolQueue;
    private settings: SafetySettings;
    private callbacks: TaskCallbacks;
    private conversationHistory: string[] = [];
    private planState: {
        stepCount: number;
        currentStepIndex: number;
        stepDescriptions: string[];
        stepStatuses: ('pending' | 'in_progress' | 'completed')[];
    } | null = null;
    private recentToolPatterns: string[] = [];  // Track tool call sequences for loop detection
    private loopWarningInjected: boolean = false;
    private pendingImageData?: string[];  // Image data for the current message (array, used once)
    private lastSceneState: { hasOpenScene: boolean; scenePath?: string } | null = null;  // Cached scene state

    constructor(callbacks: TaskCallbacks, settings?: Partial<SafetySettings>) {
        this.callbacks = callbacks;
        this.settings = { ...DEFAULT_SAFETY_SETTINGS, ...settings };

        this.context = this.createEmptyContext();

        // Create tool queue with executor
        this.toolQueue = new ToolQueue(
            async (call: ToolCall, signal: AbortSignal) => this.executeToolWithHooks(call, signal),
            settings
        );
    }

    /**
     * Get the specialized agent responsible for a tool
     */
    private getAgentForTool(toolName: string): { name: string; role: string } | null {
        // SpriteMancer tools -> Character Agent
        if (toolName.startsWith('spritemancer_')) {
            return { name: 'Character Agent', role: 'SpriteMancer integration' };
        }
        // Tileset/Tilemap tools -> Level Agent
        if (toolName.includes('tileset') || toolName.includes('tilemap')) {
            return { name: 'Level Agent', role: 'Tileset design' };
        }
        // Scene structure tools -> Architecture Agent
        if (['create_scene', 'add_node', 'attach_script', 'set_property'].includes(toolName)) {
            return { name: 'Architecture Agent', role: 'Scene structure' };
        }
        // Error/validation tools -> QA Agent
        if (['get_errors', 'get_runtime_errors', 'run_project'].includes(toolName)) {
            return { name: 'QA Agent', role: 'Verification' };
        }
        return null;
    }

    /**
     * Emit agent status if callback is available
     */
    private emitAgentStatus(name: string, role: string, state: string, progress: number): void {
        console.log(`[TaskExecutor] Agent: ${name} (${role}) - ${state} ${Math.round(progress * 100)}%`);
        if (this.callbacks.onAgentStatus) {
            this.callbacks.onAgentStatus(name, role, state, progress);
        }
    }

    /**
     * Start a new task with user input
     * @param userMessage The user's message
     * @param resetHistory If true, clear conversation history (default: false for session continuity)
     * @param imageData Optional base64-encoded image data (PNG format)
     */
    async startTask(userMessage: string, resetHistory: boolean = false, imageData?: string[]): Promise<void> {
        // ALWAYS reset the tool queue to clear any cancelled state from previous tasks
        this.toolQueue.reset();

        // Reset rate-limit backoff for new task
        this.rateLimitBackoff = 0;

        // Store image data for first LLM call (used once then cleared)
        this.pendingImageData = imageData;

        // Only reset context/history if explicitly requested (new session)
        if (resetHistory) {
            this.context = this.createEmptyContext();
            this.conversationHistory = [];
            this.planState = null;
            this.recentToolPatterns = [];
            this.loopWarningInjected = false;
            this.lastSceneState = null;
        } else {
            // Keep conversation history, but reset per-prompt counters
            // toolCallCount is per-prompt, not per-session
            this.context.toolCallCount = 0;
            this.context.noToolResponseCount = 0;
            this.context.artifacts = { createdFiles: [], modifiedFiles: [], nodesAdded: [], commandsRun: [] };
            this.context.errors = [];
            // Reset loop detection for new prompt
            this.recentToolPatterns = [];
            this.loopWarningInjected = false;
        }

        // Phase 2: Gather project context and relevant recipes at task start
        this.callbacks.onProgress("Analyzing project state...");
        const projectContext = await this.gatherProjectContext(userMessage);
        const recipeContext = await this.getRelevantRecipeContext(userMessage);

        // Inject context into conversation history if available
        if (projectContext || recipeContext) {
            const contextParts = ['=== TASK START CONTEXT ==='];
            if (projectContext) {
                contextParts.push(projectContext);
            }
            if (recipeContext) {
                contextParts.push(recipeContext);
            }
            contextParts.push('=== END CONTEXT ===');
            this.conversationHistory.push(contextParts.join('\n'));
        }

        // Add user message to history
        this.conversationHistory.push(`User: ${userMessage}`);
        if (imageData && imageData.length > 0) {
            this.conversationHistory.push(`[User attached ${imageData.length} image(s) for analysis]`);
        }

        // Transition to running
        this.setState(TaskState.RUNNING);

        // Start the agentic loop
        await this.runLoop();
    }

    /**
     * Continue an existing conversation (alias for startTask with resetHistory=false)
     */
    async continueTask(userMessage: string): Promise<void> {
        await this.startTask(userMessage, false);
    }

    /**
     * Start a completely fresh task (new session)
     */
    async startFreshTask(userMessage: string): Promise<void> {
        await this.startTask(userMessage, true);
    }

    /**
     * Resume task after user responds to followup question
     */
    async resumeWithAnswer(answer: string, contextKey: string): Promise<void> {
        if (this.context.state !== TaskState.WAITING_USER) {
            throw new Error("Cannot resume - not waiting for user");
        }

        // Store answer
        this.context.userAnswers[contextKey] = answer;

        // Add to history
        this.conversationHistory.push(`User (answer to ${contextKey}): ${answer}`);

        // Resume loop
        this.setState(TaskState.RUNNING);
        await this.runLoop();
    }

    /**
     * Cancel the current task
     */
    cancel(): void {
        this.toolQueue.cancel();
        this.setState(TaskState.FAILED);
    }

    /**
     * Get current task context
     */
    getContext(): TaskContext {
        return { ...this.context };
    }

    // ============================================
    // Private: Main Loop
    // ============================================

    private rateLimitBackoff: number = 0;  // Escalating backoff for consecutive rate limits
    private static readonly LOOP_THROTTLE_MS = 800;  // Min delay between loop iterations
    private static readonly RATE_LIMIT_BASE_MS = 3000;  // Base backoff on 429
    private static readonly RATE_LIMIT_MAX_CONSECUTIVE = 5;  // Max consecutive 429s before giving up

    private async runLoop(): Promise<void> {
        while (this.context.state === TaskState.RUNNING) {
            // Check limits
            if (this.context.toolCallCount >= this.settings.maxToolCallsPerTask) {
                this.callbacks.onError(`Max tool calls reached (${this.settings.maxToolCallsPerTask})`);
                this.setState(TaskState.FAILED);
                return;
            }

            // Throttle: always wait a minimum between loop iterations to prevent API spam
            await new Promise(r => setTimeout(r, TaskExecutor.LOOP_THROTTLE_MS));

            // If we're in a rate-limit backoff state, wait longer
            if (this.rateLimitBackoff > 0) {
                const backoffMs = TaskExecutor.RATE_LIMIT_BASE_MS * Math.pow(2, this.rateLimitBackoff - 1);
                console.warn(`[TaskExecutor] ⏳ Rate-limit backoff: waiting ${backoffMs / 1000}s before next LLM call...`);
                this.callbacks.onProgress(`Rate limited - waiting ${Math.round(backoffMs / 1000)}s before retry...`);
                await new Promise(r => setTimeout(r, backoffMs));
            }

            // Check context size and summarize if needed
            await this.checkAndSummarizeContext();

            // Build context string
            const contextString = this.buildContextString();

            // Send to LLM
            this.callbacks.onProgress("Thinking...");
            let response: LLMResponse;

            try {
                // Pass image data on first LLM call only (then clear it)
                response = await this.callbacks.sendToLLM(contextString, this.pendingImageData);
                this.pendingImageData = undefined;  // Clear after first use
                // Success - reset rate limit backoff
                this.rateLimitBackoff = 0;
            } catch (error) {
                const errorStr = String(error).toLowerCase();
                const isRateLimit = errorStr.includes('429') || errorStr.includes('too many requests') || errorStr.includes('rate limit');

                if (isRateLimit) {
                    this.rateLimitBackoff++;
                    if (this.rateLimitBackoff >= TaskExecutor.RATE_LIMIT_MAX_CONSECUTIVE) {
                        this.callbacks.onError(`Rate limit exceeded after ${this.rateLimitBackoff} consecutive failures. Please wait a minute and try again.`);
                        this.setState(TaskState.FAILED);
                        return;
                    }
                    console.warn(`[TaskExecutor] 🔄 Rate limit hit (429), escalating backoff to level ${this.rateLimitBackoff}`);
                    // Don't fail - let the loop retry with backoff
                    this.conversationHistory.push(`System: Rate limit (429) encountered. Backing off before retry.`);
                    continue;
                }

                this.callbacks.onError(`LLM error: ${error}`);
                this.setState(TaskState.FAILED);
                return;
            }

            // Add assistant response to history
            if (response.text) {
                this.conversationHistory.push(`Assistant: ${response.text}`);
            }

            // DEFENSIVE: Filter out any undefined or malformed tool calls
            const validToolCalls = (response.toolCalls || []).filter(t => {
                if (!t || typeof t.name !== 'string' || !t.name.trim()) {
                    console.warn('[TaskExecutor] Filtered out invalid tool call:', t ? JSON.stringify(t).substring(0, 100) : 'undefined');
                    return false;
                }
                return true;
            });

            // Check for tool calls
            console.log(`[TaskExecutor] LLM returned ${validToolCalls.length} tool calls`);
            if (validToolCalls.length === 0) {
                console.log(`[TaskExecutor] No tools in response, handling no-tools case`);
                await this.handleNoToolsResponse();
                continue;
            }

            // Reset no-tool counter
            this.context.noToolResponseCount = 0;

            // LOOP DETECTION: Track tool call patterns
            const currentPattern = validToolCalls.map(t => t.name).join(',');
            this.recentToolPatterns.push(currentPattern);
            if (this.recentToolPatterns.length > 5) {
                this.recentToolPatterns.shift();  // Keep last 5 patterns
            }

            // Check for repeating patterns (same sequence 3+ times)
            const loopDetected = this.detectLoop();
            if (loopDetected && !this.loopWarningInjected) {
                console.log('[TaskExecutor] ⚠️ LOOP DETECTED! Injecting warning to LLM');
                this.conversationHistory.push(
                    `⚠️ SYSTEM WARNING: LOOP DETECTED!\n` +
                    `You have called the same tool sequence 3+ times: [${currentPattern}]\n` +
                    `The previous attempts did NOT fix the issue. STOP and try a DIFFERENT approach:\n` +
                    `1. Use attempt_completion to report current status\n` +
                    `2. Or ask_followup_question to get user guidance\n` +
                    `3. Or try completely different tools\n` +
                    `DO NOT repeat the same tool calls again!`
                );
                this.loopWarningInjected = true;
            }

            // Process tool calls
            console.log(`[TaskExecutor] Processing ${validToolCalls.length} tool(s):`, validToolCalls.map(t => t.name).join(', '));
            let failedInBatch = false;  // Track if any tool in this batch failed

            for (const toolCall of validToolCalls) {
                console.log(`[TaskExecutor] 🔧 Executing: ${toolCall.name}`, (JSON.stringify(toolCall.params || {}) || '{}').substring(0, 100));

                // Check for special tools
                if (toolCall.name === "attempt_completion") {
                    await this.handleCompletion(toolCall);
                    return;
                }


                if (toolCall.name === "ask_followup_question") {
                    // CRITICAL: Skip follow-up questions if a prior tool in this batch failed!
                    // This prevents asking "does this look good?" when generation failed
                    if (failedInBatch) {
                        console.log(`[TaskExecutor] ⚠️ Skipping ask_followup_question because a prior tool failed`);
                        this.conversationHistory.push(
                            `Tool (ask_followup_question): SKIPPED - A prior tool failed. Do NOT ask for feedback when operations have failed. Fix the issue first.`
                        );
                        continue;
                    }
                    await this.handleFollowup(toolCall);
                    return;  // Loop will resume when user answers
                }

                // Execute regular tool

                // Emit specialized agent status based on tool type
                const agent = this.getAgentForTool(toolCall.name);
                if (agent) {
                    this.emitAgentStatus(agent.name, agent.role, 'working', 0.5);
                }

                const result = await this.toolQueue.enqueue(toolCall);
                this.context.toolCallCount++;
                console.log(`[TaskExecutor] ✅ Result: success=${result.success}, hasData=${result.data !== undefined}, msg=${result.message?.substring(0, 50)}`);

                // Emit agent status completion
                if (agent) {
                    this.emitAgentStatus(agent.name, agent.role, result.success ? 'complete' : 'error', 1.0);
                }

                // Add result to history - INCLUDE THE ACTUAL DATA so agent can see it
                let resultSummary = `Tool (${toolCall.name}): ${result.success ? 'Success' : 'Failed'}`;
                if (result.data !== undefined) {
                    // Truncate large data to prevent context explosion
                    const dataStr = typeof result.data === 'string'
                        ? result.data
                        : JSON.stringify(result.data, null, 2);
                    const maxLen = 2000;
                    const truncated = dataStr.length > maxLen
                        ? dataStr.substring(0, maxLen) + '... [truncated]'
                        : dataStr;
                    resultSummary += `\nResult:\n${truncated}`;
                } else if (result.message && result.message !== 'Success') {
                    resultSummary += ` - ${result.message}`;
                }
                this.conversationHistory.push(resultSummary);

                // Track artifacts
                this.trackArtifacts(toolCall, result);

                if ((toolCall.name === "start_plan" || toolCall.name === "set_task_plan") && result.success) {
                    const steps = Array.isArray(toolCall.params.steps)
                        ? toolCall.params.steps
                        : [];
                    const stepStrings = steps.map((s: unknown) =>
                        typeof s === 'string' ? s : (s as { description?: string }).description || 'Step'
                    );
                    this.planState = {
                        stepCount: steps.length,
                        currentStepIndex: 0,
                        stepDescriptions: stepStrings,
                        stepStatuses: steps.map(() => 'pending' as const)
                    };
                    // Mark first step as in_progress
                    if (this.planState.stepStatuses.length > 0) {
                        this.planState.stepStatuses[0] = 'in_progress';
                    }
                } else if (result.success) {
                    await this.updatePlanAfterTool(toolCall, result);
                }

                // Handle errors
                if (!result.success) {
                    failedInBatch = true;  // Mark that something failed in this batch
                    this.logError(toolCall, result);

                    if (!result.recoverable) {
                        this.callbacks.onError(`Unrecoverable error in ${toolCall.name}: ${result.message}`);
                        this.setState(TaskState.FAILED);
                        return;
                    }
                }
            }
        }
    }

    // ============================================
    // Private: Loop Detection
    // ============================================

    private detectLoop(): boolean {
        // Need at least 3 patterns to detect a loop
        if (this.recentToolPatterns.length < 3) {
            return false;
        }

        // Check if last 3 patterns are identical
        const len = this.recentToolPatterns.length;
        const last = this.recentToolPatterns[len - 1];
        const secondLast = this.recentToolPatterns[len - 2];
        const thirdLast = this.recentToolPatterns[len - 3];

        return last === secondLast && secondLast === thirdLast;
    }

    // ============================================
    // Private: Context Management
    // ============================================

    private buildContextString(): string {
        const parts = [
            "=== Conversation History ===",
            ...this.conversationHistory,
            "",
            "=== Task Progress ===",
            `Tool calls: ${this.context.toolCallCount}/${this.settings.maxToolCallsPerTask}`,
            `Created files: ${this.context.artifacts.createdFiles.join(", ") || "none"}`,
            `Modified files: ${this.context.artifacts.modifiedFiles.join(", ") || "none"}`,
            `Nodes added: ${this.context.artifacts.nodesAdded.join(", ") || "none"}`,
            ""
        ];

        // Add stored answers
        if (Object.keys(this.context.userAnswers).length > 0) {
            parts.push("=== User Preferences ===");
            for (const [key, value] of Object.entries(this.context.userAnswers)) {
                parts.push(`${key}: ${value}`);
            }
            parts.push("");
        }

        // Phase 2: Add plan status if active
        if (this.planState && this.planState.stepCount > 0) {
            parts.push("=== PLAN STATUS ===");
            parts.push(`Current step: ${this.planState.currentStepIndex + 1} of ${this.planState.stepCount}`);
            parts.push(`Focus on completing step ${this.planState.currentStepIndex + 1} before moving to next step.`);
            parts.push("");
        }

        return parts.join("\n");
    }

    private async checkAndSummarizeContext(): Promise<void> {
        const contextString = this.buildContextString();
        const tokenCount = this.callbacks.getTokenCount(contextString);
        const maxTokens = 100000;  // Approximate model limit

        const threshold = (this.settings.contextThresholdPercent / 100) * maxTokens;

        if (tokenCount > threshold) {
            this.callbacks.onProgress("Summarizing context...");
            const summary = await this.callbacks.summarizeContext(contextString);

            // Replace history with summary
            this.conversationHistory = [
                "[Previous conversation summarized]",
                summary
            ];
        }
    }

    // ============================================
    // Phase 2: Auto-Context Enhancement
    // ============================================

    /**
     * Find and format relevant recipes for a user request
     * Injects workflow guidance into the LLM context
     */
    private async getRelevantRecipeContext(userRequest: string): Promise<string> {
        try {
            // Dynamic import to avoid circular dependencies
            const { findRecipes, isGameCreationRequest, isSmallTask } = await import('../prompts/recipes/index.js');

            // Phase 4: Check if this is a small task that doesn't need a plan
            const isSmall = isSmallTask(userRequest);
            const isCreatingGame = isGameCreationRequest(userRequest);

            // For small tasks, inject guidance to skip planning
            if (isSmall && !isCreatingGame) {
                console.log(`[TaskExecutor] Small task detected - will skip plan guidance`);
                return '\n=== TASK GUIDANCE ===\n⚡ This is a SMALL TASK. Execute directly without creating a plan.\nJust use the appropriate tool(s) and call attempt_completion when done.\n';
            }

            const recipes = findRecipes(userRequest);

            if (recipes.length > 0) {
                let context = '\n=== RELEVANT GUIDE ===\n';

                // Include the top recipe (most relevant) in full
                const topRecipe = recipes[0];

                // For game creation requests, note that this is the primary workflow
                if (isCreatingGame && topRecipe.name === 'simple_game_workflow') {
                    context += '⚠️ IMPORTANT: This is a game creation request. Follow the workflow below step-by-step!\n\n';
                    context += '🎯 FIRST STEP: You MUST call `start_plan` or `set_task_plan` to create a visible plan with the phases below.\n';
                    context += 'This is required so the user can track progress.\n\n';
                }

                context += `### ${topRecipe.name} ###\n`;
                context += topRecipe.content;

                // Mention other available recipes if relevant
                if (recipes.length > 1) {
                    const otherRecipes = recipes.slice(1, 3).map(r => r.name);
                    context += `\n\n📚 Other relevant guides available: ${otherRecipes.join(', ')}`;
                    context += `\n   Use get_godot_help(topic="[name]") to view them.`;
                }

                console.log(`[TaskExecutor] Injected recipe context: ${topRecipe.name} (${isCreatingGame ? 'game creation' : 'topic'})`);
                return context;
            }

            // No recipe found - check if it's a simple task anyway
            if (isSmall) {
                return '\n=== TASK GUIDANCE ===\n⚡ This is a SMALL TASK. Execute directly without creating a plan.\n';
            }
        } catch (error) {
            console.error('[TaskExecutor] Recipe lookup failed:', error);
        }
        return '';
    }

    /**
     * Gather current project state for context
     * Only uses read-only tools, safe to call at task start
     */
    private async gatherProjectContext(userMessage?: string): Promise<string> {
        const context: string[] = [];

        // Get current scene tree (also updates lastSceneState)
        try {
            const sceneTree = await this.callbacks.executeTool('get_scene_tree', { max_depth: 2 });
            const result = sceneTree as {
                success?: boolean;
                name?: string;
                type?: string;
                path?: string;
                children?: Array<{ name: string; type: string }>;
            };

            if (result?.success) {
                this.lastSceneState = { hasOpenScene: true, scenePath: result.path };
                context.push(`📂 Current Scene: ${result.name} (${result.type})`);

                // List first-level children
                if (result.children && result.children.length > 0) {
                    const childNames = result.children.map(c => `${c.name}:${c.type}`);
                    context.push(`   Children: ${childNames.join(', ')}`);
                }
            } else {
                this.lastSceneState = { hasOpenScene: false };
                context.push('📂 No scene currently open');
            }
        } catch {
            this.lastSceneState = { hasOpenScene: false };
            context.push('📂 No scene currently open');
        }

        // List existing scenes in project
        try {
            const scenesResult = await this.callbacks.executeTool('list_scenes', {});
            const scenes = scenesResult as { scenes?: string[] };

            if (scenes?.scenes && scenes.scenes.length > 0) {
                // Show up to 5 scenes
                const sceneList = scenes.scenes.slice(0, 5);
                context.push(`📁 Project scenes: ${sceneList.join(', ')}${scenes.scenes.length > 5 ? '...' : ''}`);
            } else {
                context.push('📁 No scenes in project yet');
            }
        } catch {
            // Silently skip if list_scenes fails
        }

        // Get main scene setting
        try {
            const mainSceneResult = await this.callbacks.executeTool('get_project_setting',
                { setting: 'application/run/main_scene' });
            const setting = mainSceneResult as { value?: string };

            if (setting?.value) {
                context.push(`🎮 Main scene: ${setting.value}`);
            } else {
                context.push('🎮 Main scene: Not set');
            }
        } catch {
            context.push('🎮 Main scene: Not set');
        }

        // Check SpriteMancer availability
        try {
            const smStatus = await this.callbacks.executeTool('spritemancer_status', {});
            const status = smStatus as { running?: boolean };
            context.push(`🎨 SpriteMancer: ${status?.running ? '✅ Available' : '❌ Not running'}`);
        } catch {
            context.push('🎨 SpriteMancer: ❌ Not running');
        }

        // Auto-gather errors if user mentions error/warning/issue keywords
        // This helps the agent see what actual warnings exist before trying to fix them
        const errorKeywords = /error|warning|issue|problem|fail|wrong|broken|missing|config|not work|debugger|runtime|console/i;
        if (errorKeywords.test(userMessage || '')) {
            // Get node configuration warnings
            try {
                const errorsResult = await this.callbacks.executeTool('get_errors', { explanation: 'Auto-check for errors based on user message' });
                const errors = errorsResult as { warnings?: Array<{ node_name?: string; message?: string }>; warning_count?: number; error_count?: number };

                if (errors?.warning_count && errors.warning_count > 0) {
                    context.push(`⚠️ Node Configuration Warnings: ${errors.warning_count}`);
                    // Show first 3 warnings with details
                    const warningsToShow = (errors.warnings || []).slice(0, 3);
                    for (const w of warningsToShow) {
                        context.push(`   - ${w.node_name}: ${w.message?.substring(0, 100)}`);
                    }
                    if ((errors.warnings?.length || 0) > 3) {
                        context.push(`   ... and ${(errors.warnings?.length || 0) - 3} more`);
                    }
                } else {
                    context.push('✅ No node configuration warnings detected');
                }
            } catch {
                // Silently skip if get_errors fails
            }

            // Also get runtime/debugger errors
            try {
                const runtimeResult = await this.callbacks.executeTool('get_runtime_errors', { explanation: 'Auto-check for runtime errors based on user message' });
                const runtime = runtimeResult as { errors?: Array<{ type?: string; message?: string; file?: string; line?: number }>; error_count?: number };

                if (runtime?.errors && runtime.errors.length > 0) {
                    context.push(`🔴 Runtime/Debugger Errors: ${runtime.errors.length}`);
                    // Show first 3 runtime errors with details
                    const errorsToShow = runtime.errors.slice(0, 3);
                    for (const e of errorsToShow) {
                        const location = e.file ? `${e.file}:${e.line}` : 'unknown';
                        context.push(`   - [${e.type || 'error'}] ${location}: ${e.message?.substring(0, 80)}`);
                    }
                    if (runtime.errors.length > 3) {
                        context.push(`   ... and ${runtime.errors.length - 3} more`);
                    }
                }
            } catch {
                // Silently skip if get_runtime_errors fails (might not be available)
            }
        }

        if (context.length > 0) {
            console.log(`[TaskExecutor] Project context gathered: ${context.length} items`);
            return '\n=== PROJECT STATE ===\n' + context.join('\n');
        }

        return '';
    }

    // ============================================
    // Private: Tool Execution
    // ============================================

    private async executeToolWithHooks(call: ToolCall, signal: AbortSignal): Promise<ToolResult> {
        // Phase 0: Check tool preconditions FIRST
        const preconditionResult = await this.ensureToolPreconditions(call);
        if (!preconditionResult.success) {
            console.log(`[TaskExecutor] Precondition failed for ${call.name}: ${preconditionResult.message}`);
            return preconditionResult;
        }

        // Check if gated (requires approval)
        if (isGatedTool(call.name)) {
            this.callbacks.onProgress(`Requesting approval for ${call.name}...`);
            const approved = await this.callbacks.requestApproval(call);

            if (!approved) {
                return createErrorResult(
                    ErrorCode.CANCELLED,
                    `User denied ${call.name}`,
                    false
                );
            }
        }

        // Check if should show diff
        if (isShowDiffTool(call.name)) {
            // For edit_script, we'd show the diff here
            // This is a placeholder - actual implementation needs file content
        }

        // Execute via callback
        this.callbacks.onProgress(`Executing ${call.name}...`);

        try {
            const result = await this.callbacks.executeTool(call.name, call.params);

            // Normalize Godot response - check for success field
            if (result && typeof result === 'object') {
                const godotResult = result as { success?: boolean; error?: string; message?: string; hint?: string };
                if (godotResult.success === false) {
                    // Phase 0: Attempt structured error recovery
                    const errorMessage = godotResult.error || godotResult.message || `${call.name} failed`;
                    const recoveryResult = this.attemptRecovery(call, errorMessage);

                    return createErrorResult(
                        ErrorCode.GODOT_ERROR,
                        recoveryResult.enhancedMessage,
                        recoveryResult.recoverable
                    );
                }
            }

            return createSuccessResult(result, `${call.name} completed`);
        } catch (error) {
            // Phase 0: Attempt structured error recovery for exceptions
            const recoveryResult = this.attemptRecovery(call, String(error));
            return createErrorResult(
                ErrorCode.TOOL_FAILURE,
                recoveryResult.enhancedMessage,
                recoveryResult.recoverable
            );
        }
    }

    // ============================================
    // Phase 0: Precondition Checking & Error Recovery
    // ============================================

    /**
     * Check tool preconditions before execution
     * Returns success if preconditions met, error with guidance if not
     */
    private async ensureToolPreconditions(call: ToolCall): Promise<ToolResult> {
        // Check if tool requires an open scene
        if (TOOLS_REQUIRING_SCENE.has(call.name)) {
            // Retry up to 3 times with 300ms delays for async scene loading
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    const sceneResult = await this.callbacks.executeTool('get_scene_tree', { max_depth: 1 }) as {
                        success?: boolean;
                        name?: string;
                        path?: string;
                        error?: string;
                        hint?: string;
                    };

                    this.lastSceneState = {
                        hasOpenScene: sceneResult?.success === true,
                        scenePath: sceneResult?.path,
                    };
                    (this.lastSceneState as any).timestamp = Date.now();

                    // Scene is open - precondition met
                    if (this.lastSceneState.hasOpenScene) {
                        return createSuccessResult(null, 'Preconditions met');
                    }
                } catch (error) {
                    // Assume no scene open on error
                    this.lastSceneState = { hasOpenScene: false };
                    (this.lastSceneState as any).timestamp = Date.now();
                }

                // Wait before retry (except on last attempt)
                if (attempt < 2) {
                    await new Promise(r => setTimeout(r, 300));
                }
            }

            // All retries exhausted - scene not open
            if (!this.lastSceneState || !this.lastSceneState.hasOpenScene) {
                // Inject guidance into conversation history
                this.conversationHistory.push(
                    `⚠️ SYSTEM: Tool "${call.name}" requires an open scene, but no scene is currently open.\n` +
                    `To fix this:\n` +
                    `1. Use \`list_scenes\` to find existing .tscn files\n` +
                    `2. Use \`open_scene\` to open an existing scene, OR\n` +
                    `3. Use \`create_scene\` to create a new scene\n` +
                    `Then retry the original operation.`
                );

                return createErrorResult(
                    ErrorCode.PRECONDITION_FAILED,
                    `Tool "${call.name}" requires an open scene. No scene is currently open. ` +
                    `Use list_scenes to find scenes, then open_scene or create_scene.`,
                    true  // Recoverable - agent can open a scene
                );
            }
        }

        // All preconditions passed
        return createSuccessResult(null, 'Preconditions met');
    }

    /**
     * Attempt to recover from an error by providing structured guidance
     * Returns enhanced error message with recovery hints
     */
    private attemptRecovery(call: ToolCall, errorMessage: string): { enhancedMessage: string; recoverable: boolean } {
        // Find matching recovery strategy
        for (const strategy of ERROR_RECOVERY_STRATEGIES) {
            if (strategy.pattern.test(errorMessage)) {
                console.log(`[TaskExecutor] Matched error pattern: ${strategy.errorType}`);

                // Inject recovery hint into conversation history
                this.conversationHistory.push(
                    `⚠️ RECOVERY HINT (${strategy.errorType}): ${strategy.recoveryHint}`
                );

                // Invalidate cached scene state if it's a scene-related error
                if (strategy.errorType === 'NO_SCENE_OPEN') {
                    this.lastSceneState = { hasOpenScene: false };
                }

                return {
                    enhancedMessage: `${errorMessage}\n\n💡 RECOVERY: ${strategy.recoveryHint}`,
                    recoverable: true,  // Most errors are recoverable with the right approach
                };
            }
        }

        // No specific strategy found - return generic guidance
        return {
            enhancedMessage: `${errorMessage}\n\n💡 TIP: Use get_errors to check for additional error details.`,
            recoverable: true,
        };
    }

    // ============================================
    // Private: Special Handlers
    // ============================================

    private async handleNoToolsResponse(): Promise<void> {
        this.context.noToolResponseCount++;

        if (this.context.noToolResponseCount >= this.settings.noToolResponseLimit) {
            // Force completion or ask user
            this.conversationHistory.push(
                "System: You have not used any tools in your last 3 responses. " +
                "Please either use a tool to continue the task, " +
                "call attempt_completion if done, " +
                "or call ask_followup_question if you need clarification."
            );
        }
    }

    private async handleFollowup(toolCall: ToolCall): Promise<void> {
        const params = toolCall.params as unknown as AskFollowupParams;

        this.setState(TaskState.WAITING_USER);
        this.callbacks.onProgress(`Waiting for user input...`);

        // Ask user via callback
        const answer = await this.callbacks.askUser(params);

        if (answer === null) {
            // User skipped or timed out, use default
            if (params.default) {
                this.context.userAnswers[params.context_key] = params.default;
                this.conversationHistory.push(
                    `User (${params.context_key}): ${params.default} [default]`
                );
                this.setState(TaskState.RUNNING);
            } else if (params.allow_skip) {
                this.conversationHistory.push(
                    `User: Skipped question "${params.question}"`
                );
                this.setState(TaskState.RUNNING);
            } else {
                this.callbacks.onError("User did not answer required question");
                this.setState(TaskState.FAILED);
            }
        } else {
            this.context.userAnswers[params.context_key] = answer;
            this.conversationHistory.push(
                `User (${params.context_key}): ${answer}`
            );
            this.setState(TaskState.RUNNING);
        }

        if (this.context.state === TaskState.RUNNING) {
            await this.runLoop();
        }
    }

    private async handleCompletion(toolCall: ToolCall): Promise<void> {
        const params = toolCall.params as unknown as AttemptCompletionParams;

        // Merge tracked artifacts with provided ones
        const finalArtifacts: TaskArtifacts = {
            createdFiles: [
                ...this.context.artifacts.createdFiles,
                ...(params.artifacts?.createdFiles || [])
            ],
            modifiedFiles: [
                ...this.context.artifacts.modifiedFiles,
                ...(params.artifacts?.modifiedFiles || [])
            ],
            nodesAdded: [
                ...this.context.artifacts.nodesAdded,
                ...(params.artifacts?.nodesAdded || [])
            ],
            commandsRun: [
                ...this.context.artifacts.commandsRun,
                ...(params.artifacts?.commandsRun || [])
            ]
        };

        const completionResult: AttemptCompletionParams = {
            result: params.result,
            artifacts: finalArtifacts,
            warnings: params.warnings,
            next_suggestions: params.next_suggestions,
            demo_command: params.demo_command
        };

        this.setState(TaskState.COMPLETED);
        this.callbacks.onComplete(completionResult);
    }

    // ============================================
    // Private: Helpers
    // ============================================

    private setState(state: TaskState): void {
        this.context.state = state;
        this.callbacks.onStateChange(state);
    }

    /**
     * Verify if a tool execution aligns with the current step description
     * Returns a confidence score (0-1) for how well the tool matches the step
     */
    private verifyStepCompletion(toolCall: ToolCall, toolResult: ToolResult): { matches: boolean; confidence: number; reason: string } {
        if (!this.planState || this.planState.currentStepIndex >= this.planState.stepDescriptions.length) {
            return { matches: false, confidence: 0, reason: 'No active plan step' };
        }

        const stepDescription = this.planState.stepDescriptions[this.planState.currentStepIndex].toLowerCase();
        const toolName = toolCall.name.toLowerCase();
        const params = toolCall.params;

        // Tool-to-action keyword mapping
        const toolActionMap: Record<string, string[]> = {
            'create_scene': ['create scene', 'new scene', 'create a scene', 'make scene'],
            'open_scene': ['open scene', 'open the scene', 'load scene'],
            'save_scene': ['save scene', 'save the scene'],
            'add_node': ['add node', 'add a node', 'create node', 'insert node', 'add.*node'],
            'remove_node': ['remove node', 'delete node'],
            'set_property': ['set property', 'configure property', 'set.*property', 'change property', 'set.*to'],
            'create_script': ['create script', 'add script', 'new script', 'make script'],
            'attach_script': ['attach script', 'add script to', 'assign script'],
            'edit_script': ['edit script', 'modify script', 'update script'],
            'run_game': ['run game', 'play game', 'test game', 'start game', 'execute game'],
            'set_collision_shape': ['collision shape', 'set collision', 'add collision'],
            // SpriteMancer tools  
            'spritemancer_create_character': ['generate character', 'create character', 'character reference', 'character generation'],
            'spritemancer_generate_character': ['generate character', 'create character', 'character reference', 'character generation'],
            'spritemancer_generate_animations': ['generate animation', 'create animation', 'animation generation', 'add animation', 'idle animation', 'walk animation', 'run animation'],
            'spritemancer_approve_animation': ['approve animation', 'confirm animation', 'accept animation', 'save animation'],
            'spritemancer_status': ['check spritemancer', 'spritemancer status'],
            'setup_player_with_sprites': ['setup player', 'create player', 'player scene', 'player with sprites', 'build player'],
            'set_main_scene': ['main scene', 'set main', 'configure main scene'],
        };

        // Check if tool name has matching keywords in step description
        const actionKeywords = toolActionMap[toolCall.name] || [toolName.replace(/_/g, ' ')];
        let matchCount = 0;

        for (const keyword of actionKeywords) {
            const regex = new RegExp(keyword, 'i');
            if (regex.test(stepDescription)) {
                matchCount++;
            }
        }

        // Check for specific parameter matches (node names, paths, types, etc.)
        let paramMatches = 0;
        if (params) {
            for (const [key, value] of Object.entries(params)) {
                if (typeof value === 'string' && value.length > 2) {
                    // Check if the param value appears in step description
                    if (stepDescription.includes(value.toLowerCase())) {
                        paramMatches++;
                    }
                }
            }
        }

        // Calculate confidence based on matches
        const hasKeywordMatch = matchCount > 0;
        const hasParamMatch = paramMatches > 0;

        let confidence = 0;
        let reason = '';

        if (hasKeywordMatch && hasParamMatch) {
            confidence = 0.9;
            reason = `Tool '${toolCall.name}' matches step keywords and parameters`;
        } else if (hasKeywordMatch) {
            confidence = 0.7;
            reason = `Tool '${toolCall.name}' matches step action keywords`;
        } else if (hasParamMatch) {
            confidence = 0.5;
            reason = `Tool parameters appear in step description`;
        } else {
            // Check for generic action words that might apply
            const genericMatches = [
                { pattern: /create|generate|add|new|make/i, tools: ['create_scene', 'create_script', 'add_node', 'spritemancer_generate_character'] },
                { pattern: /configure|set|assign|attach/i, tools: ['set_property', 'attach_script', 'set_collision_shape', 'set_main_scene'] },
                { pattern: /run|test|play|execute/i, tools: ['run_game'] },
                { pattern: /save|store/i, tools: ['save_scene'] },
            ];

            for (const { pattern, tools } of genericMatches) {
                if (pattern.test(stepDescription) && tools.includes(toolCall.name)) {
                    confidence = 0.4;
                    reason = `Generic action match for '${toolCall.name}'`;
                    break;
                }
            }

            if (confidence === 0) {
                reason = `No clear match between '${toolCall.name}' and step description`;
            }
        }

        // Only auto-complete if tool succeeded AND confidence is reasonable
        const matches = toolResult.success && confidence >= 0.4;

        return { matches, confidence, reason };
    }

    private async updatePlanAfterTool(toolCall: ToolCall, toolResult?: ToolResult): Promise<void> {
        if (!this.planState) return;
        if (toolCall.name === "update_plan" || toolCall.name === "start_plan" || toolCall.name === "set_task_plan") return;
        if (this.planState.currentStepIndex >= this.planState.stepCount) return;

        // Verify step completion if we have a result
        if (toolResult) {
            const verification = this.verifyStepCompletion(toolCall, toolResult);
            console.log(`[TaskExecutor] Step verification: ${verification.reason} (confidence: ${verification.confidence.toFixed(2)})`);

            if (!verification.matches) {
                // Tool didn't match current step - don't auto-advance, but update status to in_progress
                if (this.planState.stepStatuses[this.planState.currentStepIndex] === 'pending') {
                    this.planState.stepStatuses[this.planState.currentStepIndex] = 'in_progress';
                }
                return; // Don't auto-complete this step
            }
        }

        try {
            // Mark current step as completed
            this.planState.stepStatuses[this.planState.currentStepIndex] = 'completed';

            await this.callbacks.executeTool("update_plan", {
                step_index: this.planState.currentStepIndex,
                status: "completed",
                explanation: `Auto-completed after ${toolCall.name}`
            });

            this.planState.currentStepIndex++;

            // Mark next step as in_progress
            if (this.planState.currentStepIndex < this.planState.stepStatuses.length) {
                this.planState.stepStatuses[this.planState.currentStepIndex] = 'in_progress';
                console.log(`[TaskExecutor] Advanced to step ${this.planState.currentStepIndex + 1}: ${this.planState.stepDescriptions[this.planState.currentStepIndex]}`);
            }
        } catch (error) {
            this.callbacks.onProgress(`Failed to update plan step: ${error}`);
        }
    }

    private createEmptyContext(): TaskContext {
        return {
            taskId: `task_${Date.now()}`,
            state: TaskState.IDLE,
            toolCallCount: 0,
            noToolResponseCount: 0,
            consecutiveMistakeCount: 0,
            userAnswers: {},
            artifacts: {
                createdFiles: [],
                modifiedFiles: [],
                nodesAdded: [],
                commandsRun: []
            },
            errors: []
        };
    }

    private trackArtifacts(toolCall: ToolCall, result: ToolResult): void {
        if (!result.success) return;

        const name = toolCall.name;
        const params = toolCall.params;

        // Track created files
        if (name === "create_script" || name === "create_scene") {
            const path = params.path as string;
            if (path && !this.context.artifacts.createdFiles.includes(path)) {
                this.context.artifacts.createdFiles.push(path);
            }
        }

        // Track modified files
        if (name === "edit_script") {
            const path = params.path as string;
            if (path && !this.context.artifacts.modifiedFiles.includes(path)) {
                this.context.artifacts.modifiedFiles.push(path);
            }
        }

        // Track added nodes
        if (name === "add_node") {
            const nodeName = params.name as string;
            if (nodeName && !this.context.artifacts.nodesAdded.includes(nodeName)) {
                this.context.artifacts.nodesAdded.push(nodeName);
            }
        }

        // Track commands
        if (name === "run_game") {
            this.context.artifacts.commandsRun.push("run_game");
        }
    }

    private logError(toolCall: ToolCall, result: ToolResult): void {
        const errorLog: ErrorLog = {
            tool: toolCall.name,
            params: toolCall.params,
            errorCode: result.code,
            errorMessage: result.message,
            attempt: this.context.errors.filter((e: ErrorLog) => e.tool === toolCall.name).length + 1,
            timestamp: Date.now()
        };

        this.context.errors.push(errorLog);
    }
}
