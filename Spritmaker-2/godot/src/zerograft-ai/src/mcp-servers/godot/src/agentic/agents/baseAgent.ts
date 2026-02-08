/**
 * Base Agent Class
 * 
 * Abstract base class for all specialized agents in the multi-agent system.
 * Combines CrewAI-style role design with OpenClaw's sessions pattern for A2A.
 */

import { randomUUID } from 'crypto';
import {
    AgentConfig,
    AgentState,
    AgentStatus,
    AgentTask,
    AgentResult,
    AgentError,
    AgentInfo,
    SessionMessage,
    SHARED_READ_ONLY_TOOLS
} from '../multiAgentTypes.js';
import { TaskExecutor } from '../taskExecutor.js';
import { ToolResult, ErrorCode, createErrorResult } from '../types.js';

/**
 * Callbacks for agent operations
 */
export interface AgentCallbacks {
    /** Execute a tool */
    executeTool: (name: string, params: Record<string, unknown>) => Promise<ToolResult>;

    /** Send message to LLM */
    sendToLLM: (context: string, imageData?: string[]) => Promise<string>;

    /** Report progress to UI */
    onProgress?: (message: string) => void;

    /** Request approval for gated operations */
    requestApproval?: (operation: string, details: string) => Promise<boolean>;

    /** Get sessions manager for A2A */
    getSessionsManager?: () => SessionsManagerInterface;

    /** Emit agent status to UI */
    onAgentStatus?: (name: string, role: string, state: string, progress: number) => void;

    /** Emit plan to UI when created */
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

/**
 * Interface for sessions manager (OpenClaw pattern)
 */
export interface SessionsManagerInterface {
    sessionsList(): AgentInfo[];
    sessionsHistory(agentId: string, limit: number): SessionMessage[];
    sessionsSend(from: string, to: string, content: string, type?: string): void;
}

/**
 * Abstract base class for all specialized agents
 */
export abstract class BaseAgent {
    protected config: AgentConfig;
    protected state: AgentState;
    protected callbacks: AgentCallbacks;

    constructor(config: AgentConfig, callbacks: AgentCallbacks) {
        this.config = config;
        this.callbacks = callbacks;
        this.state = this.createInitialState();
    }

    // ============================================================================
    // Abstract Methods - Must be implemented by specialized agents
    // ============================================================================

    /**
     * Execute a task assigned to this agent
     */
    abstract execute(task: AgentTask): Promise<AgentResult>;

    /**
     * Check if this agent can handle a given task
     */
    abstract canHandle(task: AgentTask): boolean;

    /**
     * Build the system prompt for this agent
     */
    abstract buildSystemPrompt(): string;

    // ============================================================================
    // State Management
    // ============================================================================

    protected createInitialState(): AgentState {
        return {
            agentId: this.config.id,
            status: 'idle',
            currentTask: null,
            tokensUsed: 0,
            lastActivity: new Date()
        };
    }

    getState(): Readonly<AgentState> {
        return { ...this.state };
    }

    getConfig(): Readonly<AgentConfig> {
        return { ...this.config };
    }

    protected updateStatus(status: AgentStatus): void {
        this.state.status = status;
        this.state.lastActivity = new Date();
    }

    protected setCurrentTask(task: AgentTask | null): void {
        this.state.currentTask = task;
        this.state.lastActivity = new Date();
    }

    protected addTokensUsed(tokens: number): void {
        this.state.tokensUsed += tokens;
    }

    protected setError(error: AgentError): void {
        this.state.status = 'error';
        this.state.lastError = error;
        this.state.lastActivity = new Date();
    }

    // ============================================================================
    // Tool Execution
    // ============================================================================

    /**
     * Check if this agent has access to a tool
     */
    hasToolAccess(toolName: string): boolean {
        return (
            this.config.exclusiveTools.includes(toolName) ||
            this.config.sharedTools.includes(toolName) ||
            SHARED_READ_ONLY_TOOLS.includes(toolName as any)
        );
    }

    /**
     * Get all tools available to this agent
     */
    getAvailableTools(): string[] {
        return [
            ...this.config.exclusiveTools,
            ...this.config.sharedTools,
            ...SHARED_READ_ONLY_TOOLS
        ];
    }

    /**
     * Execute a tool with access control
     */
    protected async executeTool(
        name: string,
        params: Record<string, unknown>
    ): Promise<ToolResult> {
        if (!this.hasToolAccess(name)) {
            return createErrorResult(
                ErrorCode.VALIDATION_ERROR,
                `Agent ${this.config.name} does not have access to tool: ${name}`,
                false
            );
        }

        this.callbacks.onProgress?.(`Executing tool: ${name}`);
        return this.callbacks.executeTool(name, params);
    }

    // ============================================================================
    // User Interaction
    // ============================================================================

    /**
     * Request approval from user for a gated operation
     * Uses ask_followup_question tool to show approval popup in UI
     */
    protected async requestApproval(
        operation: string,
        details: string
    ): Promise<boolean> {
        // If callback is provided, use it
        if (this.callbacks.requestApproval) {
            return this.callbacks.requestApproval(operation, details);
        }

        // Otherwise, use ask_followup_question tool
        const result = await this.callbacks.executeTool('ask_followup_question', {
            question: details,
            context_key: operation,
            choices: ['Yes, looks good!', 'No, regenerate', 'Skip this step']
        });

        if (!result.success) {
            // If we can't ask, assume approved to avoid blocking
            this.callbacks.onProgress?.(`[${this.config.name}] Could not request approval, proceeding...`);
            return true;
        }

        // Parse the response
        const response = ((result.data as any)?.answer || '').toLowerCase();
        return response.includes('yes') || response.includes('good') || response.includes('approve');
    }

    // ============================================================================
    // Session Tools (OpenClaw A2A Pattern)
    // ============================================================================

    /**
     * List all active agents and their status
     */
    async sessionsList(): Promise<AgentInfo[]> {
        const manager = this.callbacks.getSessionsManager?.();
        if (!manager) {
            return [{
                id: this.config.id,
                name: this.config.name,
                role: this.config.role,
                status: this.state.status,
                currentTask: this.state.currentTask?.description ?? null,
                tokensUsed: this.state.tokensUsed
            }];
        }
        return manager.sessionsList();
    }

    /**
     * Get message history with another agent
     */
    async sessionsHistory(agentId: string, limit: number = 10): Promise<SessionMessage[]> {
        const manager = this.callbacks.getSessionsManager?.();
        if (!manager) {
            return [];
        }
        return manager.sessionsHistory(agentId, limit);
    }

    /**
     * Send a message to another agent
     */
    async sessionsSend(
        targetAgentId: string,
        content: string,
        type: string = 'task_request'
    ): Promise<void> {
        const manager = this.callbacks.getSessionsManager?.();
        if (!manager) {
            console.warn('Sessions manager not available for A2A communication');
            return;
        }
        manager.sessionsSend(this.config.id, targetAgentId, content, type);
    }

    // ============================================================================
    // Task Execution Helpers
    // ============================================================================

    /**
     * Create a successful result
     */
    protected createSuccessResult(
        task: AgentTask,
        artifacts: string[],
        output: Record<string, unknown>,
        executionTime: number
    ): AgentResult {
        return {
            taskId: task.id,
            agentId: this.config.id,
            success: true,
            artifacts,
            output,
            tokensUsed: 0, // Will be updated by executor
            executionTime
        };
    }

    /**
     * Create a failure result
     */
    protected createFailureResult(
        task: AgentTask,
        error: AgentError,
        executionTime: number
    ): AgentResult {
        return {
            taskId: task.id,
            agentId: this.config.id,
            success: false,
            artifacts: [],
            output: {},
            error,
            tokensUsed: 0,
            executionTime
        };
    }

    /**
     * Generate a unique ID for tasks/messages
     */
    protected generateId(): string {
        return randomUUID();
    }

    // ============================================================================
    // Verification (Claude SDK Pattern)
    // ============================================================================

    /**
     * Verify the result of a task (4-step loop: gather, act, verify, repeat)
     */
    protected async verifyResult(
        task: AgentTask,
        result: AgentResult
    ): Promise<{ verified: boolean; issues: string[] }> {
        const issues: string[] = [];

        // Check artifacts exist
        for (const artifact of result.artifacts) {
            const checkResult = await this.executeTool('list_files', { path: artifact });
            if (!checkResult.success) {
                issues.push(`Artifact not found: ${artifact}`);
            }
        }

        // Task-specific verification (override in specialized agents)
        const taskIssues = await this.verifyTaskSpecific(task, result);
        issues.push(...taskIssues);

        return {
            verified: issues.length === 0,
            issues
        };
    }

    /**
     * Override in specialized agents for task-specific verification
     */
    protected async verifyTaskSpecific(
        task: AgentTask,
        result: AgentResult
    ): Promise<string[]> {
        return [];
    }

    // ============================================================================
    // Prompt Building (CO-STAR Pattern)
    // ============================================================================

    /**
     * Build the base system prompt with CO-STAR structure
     */
    protected buildBasePrompt(): string {
        return `# ${this.config.name}

## Context
You are ${this.config.role} in a multi-agent game development studio.

## Objective
${this.config.goal}

## Style
You communicate clearly and technically. You focus on your area of expertise and collaborate with other agents when needed.

## Tone
Professional, helpful, and efficient.

## Audience
You are working with other AI agents and occasionally with human developers.

## Response Format
- Use structured tool calls for actions
- Report progress and results clearly
- Flag any issues or conflicts immediately

## Backstory
${this.config.backstory}

## Available Tools
${this.getAvailableTools().map(t => `- ${t}`).join('\n')}

## Workspace
Your workspace is: ${this.config.workspace}
`;
    }
}
