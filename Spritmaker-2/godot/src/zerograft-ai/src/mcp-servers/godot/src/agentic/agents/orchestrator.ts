/**
 * Orchestrator Agent
 * 
 * Central coordinator using LangGraph-style FSM.
 * Routes tasks to specialized agents, monitors progress, and integrates results.
 */

import { randomUUID } from 'crypto';
import { BaseAgent, AgentCallbacks } from './baseAgent.js';
import {
    AgentConfig,
    AgentTask,
    AgentResult,
    TaskPlan,
    ProjectState,
    AgentInfo,
    SessionMessage,
    AGENT_TOOL_ASSIGNMENTS
} from '../multiAgentTypes.js';
import { StateManager } from '../stateManager.js';
import { LockManager } from '../lockManager.js';
import { SessionsManager } from '../sessionsManager.js';
import { TaskPlanner } from '../taskPlanner.js';

/**
 * Orchestrator states (LangGraph-style FSM)
 */
export type OrchestratorState =
    | 'idle'
    | 'analyzing'
    | 'planning'
    | 'delegating'
    | 'monitoring'
    | 'integrating'
    | 'verifying'
    | 'responding'  // New: handling conversational queries
    | 'complete'
    | 'error';

/**
 * Orchestrator configuration
 */
const ORCHESTRATOR_CONFIG: AgentConfig = {
    id: 'orchestrator',
    name: 'Orchestrator',
    role: 'Central Coordinator & Project Manager',
    goal: 'Coordinate specialized agents to complete user requests efficiently and safely',
    backstory: `You are the central coordinator of a multi-agent game development studio. 
Your job is to understand user requests, break them into tasks, assign them to the right 
specialized agents (Architecture, Character, Level, QA), monitor their progress, and 
integrate their results into a cohesive output.`,
    exclusiveTools: AGENT_TOOL_ASSIGNMENTS.orchestrator as unknown as string[],
    sharedTools: [],
    workspace: 'res://',
    maxTokens: 8000,
    maxIterations: 50
};

/**
 * Orchestrator Agent - Central coordinator for the multi-agent system
 */
export class Orchestrator extends BaseAgent {
    private fsm: OrchestratorState = 'idle';
    private stateManager: StateManager;
    private lockManager: LockManager;
    private sessionsManager: SessionsManager;
    private taskPlanner: TaskPlanner;
    private agentPool: Map<string, BaseAgent> = new Map();
    private completedTasks: Set<string> = new Set();

    constructor(
        callbacks: AgentCallbacks,
        stateManager: StateManager,
        lockManager: LockManager,
        sessionsManager: SessionsManager
    ) {
        super(ORCHESTRATOR_CONFIG, callbacks);
        this.stateManager = stateManager;
        this.lockManager = lockManager;
        this.sessionsManager = sessionsManager;
        this.taskPlanner = new TaskPlanner();

        // Register orchestrator with sessions manager
        this.sessionsManager.registerAgent({
            id: this.config.id,
            name: this.config.name,
            role: this.config.role,
            status: 'idle',
            currentTask: null,
            tokensUsed: 0
        });

        // Listen for messages from agents
        this.sessionsManager.onMessage(this.config.id, this.handleAgentMessage.bind(this));
    }

    // ============================================================================
    // Agent Pool Management
    // ============================================================================

    /**
     * Register an agent with the orchestrator
     */
    registerAgent(agent: BaseAgent): void {
        const config = agent.getConfig();
        this.agentPool.set(config.id, agent);

        this.sessionsManager.registerAgent({
            id: config.id,
            name: config.name,
            role: config.role,
            status: 'idle',
            currentTask: null,
            tokensUsed: 0
        });

        console.log(`[Orchestrator] Registered agent: ${config.name}`);
    }

    /**
     * Get all registered agents
     */
    getAgents(): Map<string, BaseAgent> {
        return new Map(this.agentPool);
    }

    // ============================================================================
    // FSM State Management
    // ============================================================================

    private transitionTo(newState: OrchestratorState): void {
        console.log(`[Orchestrator] State transition: ${this.fsm} -> ${newState}`);
        this.fsm = newState;
        this.updateStatus(newState === 'error' ? 'error' :
            newState === 'complete' ? 'complete' : 'executing');
    }

    getFSMState(): OrchestratorState {
        return this.fsm;
    }

    // ============================================================================
    // Main Execution Flow
    // ============================================================================

    /**
     * Execute a user request through the multi-agent system
     */
    async execute(task: AgentTask): Promise<AgentResult> {
        const startTime = Date.now();

        try {
            // 1. Analyze the request
            this.transitionTo('analyzing');
            this.callbacks.onProgress?.('Analyzing request...');

            const userRequest = task.input.userRequest as string;

            // Check if this is a question/conversation vs a task request
            if (this.isConversationalQuery(userRequest)) {
                return await this.handleQuestion(task, userRequest, startTime);
            }

            // 2. Create execution plan using LLM (falls back to keyword-based)
            this.transitionTo('planning');
            const projectState = this.stateManager.getState();
            const plan = await this.taskPlanner.createPlanWithLLM(
                userRequest,
                projectState,
                (prompt) => this.callbacks.sendToLLM(prompt)
            );

            // Create checkpoint before execution
            const checkpointId = this.stateManager.createCheckpoint(
                `Before: ${task.description}`,
                this.config.id
            );
            plan.checkpointId = checkpointId;

            this.stateManager.setCurrentPlan(plan);
            this.callbacks.onProgress?.(`Created plan with ${plan.tasks.length} tasks`);

            // Send plan to UI
            this.callbacks.onPlanCreated?.({
                id: plan.id,
                tasks: plan.tasks.map(t => ({
                    id: t.id,
                    type: t.type,
                    description: t.description,
                    assignedAgent: t.assignedAgent,
                    status: 'pending'
                }))
            });

            // Also initialize plan on Godot bridge so live status updates are reliable.
            await this.syncPlanToGodot(plan);

            // 3. Execute plan
            const result = await this.executePlan(plan);

            // 4. Verify results
            this.transitionTo('verifying');
            const verification = await this.verifyResult(task, result);

            if (!verification.verified) {
                console.warn('[Orchestrator] Verification failed:', verification.issues);
                // Could trigger retry or rollback here
            }

            this.transitionTo('complete');
            return result;

        } catch (error) {
            this.transitionTo('error');
            console.error('[Orchestrator] Execution failed:', error);

            return this.createFailureResult(task, {
                code: 'EXECUTION_FAILED',
                message: error instanceof Error ? error.message : 'Unknown error',
                recoverable: true
            }, Date.now() - startTime);
        }
    }

    /**
     * Check if a request is conversational (question) vs a task request
     */
    private isConversationalQuery(userRequest: string): boolean {
        const normalized = userRequest.toLowerCase().trim();

        // Action words that clearly indicate task requests (not questions)
        // Include common imperative verbs users say: "please fix", "do proper integration", "run the game", etc.
        const actionWords = [
            'create', 'make', 'add', 'generate', 'build', 'design', 'implement', 'setup', 'configure',
            'delete', 'remove', 'fix', 'do', 'integrate', 'integration', 'run', 'test', 'use',
            'move', 'place', 'put', 'attach', 'connect', 'set', 'update', 'change', 'modify',
            'play', 'start', 'stop', 'enable', 'disable', 'install', 'save', 'load', 'open',
            'close', 'rename', 'copy', 'paste', 'undo', 'redo', 'refactor', 'clean', 'organize',
            'reparent', 'restructure', 'rewrite', 'replace', 'swap'
        ];

        const hasActionWord = actionWords.some(word => {
            // Match whole word boundaries to avoid false positives (e.g. "do" in "document")
            const regex = new RegExp(`\\b${word}\\b`);
            return regex.test(normalized);
        });

        // If it has an action word, it's a task request — even if it also has question words
        // e.g. "please check and do proper integration" has "check" AND "do" → action wins
        if (hasActionWord) {
            return false;
        }

        // Info/status words that indicate the user wants information, not action
        const infoWords = ['status', 'current', 'progress', 'state', 'overview', 'summary', 'info', 'list', 'show', 'describe', 'report'];
        const hasInfoWord = infoWords.some(word => normalized.includes(word));

        if (hasInfoWord) {
            return true;
        }

        // Question indicators (only reached if NO action word was found)
        const isQuestion = normalized.includes('?');
        const questionPatterns = [
            'what', 'why', 'how', 'when', 'where', 'which', 'who',
            'have you', 'have u', 'did you', 'did u', 'do you', 'do u',
            'is it', 'are you', 'are there', 'can i', 'can u', 'can you',
            'should i', 'tell me', 'explain',
            'help me understand', 'what happened', 'whats wrong',
            'let me know', 'brief me'
        ];
        const hasQuestionPattern = questionPatterns.some(pattern => normalized.includes(pattern));

        return isQuestion || hasQuestionPattern;
    }

    /**
     * Handle conversational queries using LLM
     */
    private async handleQuestion(task: AgentTask, userRequest: string, startTime: number): Promise<AgentResult> {
        this.transitionTo('responding');
        this.callbacks.onProgress?.('Analyzing your question...');

        try {
            // Gather context information
            const projectState = this.stateManager.getState();
            const sceneTreeResult = await this.executeTool('get_scene_tree', {});
            const filesResult = await this.executeTool('list_files', { path: 'res://', recursive: true });

            // Get scene and asset info from state
            const scenesList = Array.from(projectState.scenes.keys()).join(', ') || 'None';
            const assetsList = Array.from(projectState.assets.keys()).join(', ') || 'None';

            // Build context for LLM
            const context = `
User Question: ${userRequest}

Current Project State:
- Open Scenes: ${scenesList}
- Assets: ${assetsList}
- Active Plan: ${projectState.currentPlan?.id || 'None'}

Scene Tree:
${JSON.stringify(sceneTreeResult.data, null, 2)}

Project Files:
${JSON.stringify(filesResult.data, null, 2)}

Please answer the user's question based on the project state and files above. Be helpful and specific.
`;

            // Use LLM to answer the question
            const response = await this.callbacks.sendToLLM?.(context);

            if (!response) {
                throw new Error('No LLM response received');
            }

            this.transitionTo('complete');

            return this.createSuccessResult(task, [], {
                type: 'conversational_response',
                response: response,
                question: userRequest
            }, Date.now() - startTime);

        } catch (error) {
            this.transitionTo('error');
            console.error('[Orchestrator] Question handling failed:', error);

            return this.createFailureResult(task, {
                code: 'QUESTION_HANDLING_FAILED',
                message: error instanceof Error ? error.message : 'Failed to answer question',
                recoverable: true
            }, Date.now() - startTime);
        }
    }

    /**
     * Execute the task plan
     */
    private async executePlan(plan: TaskPlan): Promise<AgentResult> {
        const startTime = Date.now();
        this.completedTasks.clear();
        const artifacts: string[] = [];
        const stepIndexByTaskId = new Map<string, number>();
        for (let i = 0; i < plan.tasks.length; i++) {
            stepIndexByTaskId.set(plan.tasks[i].id, i);
        }

        console.log(`\n${'─'.repeat(60)}`);
        console.log(`[Orchestrator] 🚀 EXECUTING PLAN: ${plan.parallelGroups.length} groups`);
        console.log(`${'─'.repeat(60)}`);

        // Execute parallel groups in order
        let groupIndex = 0;
        for (const group of plan.parallelGroups) {
            groupIndex++;
            this.transitionTo('delegating');

            // Get tasks in this group
            const tasks = group.map(taskId =>
                plan.tasks.find(t => t.id === taskId)!
            ).filter(Boolean);

            console.log(`\n[Orchestrator] 📦 GROUP ${groupIndex}/${plan.parallelGroups.length}: ${tasks.length} task(s)`);
            for (const task of tasks) {
                console.log(`  → Delegating [${task.type}] to ${task.assignedAgent.toUpperCase()} Agent`);
            }

            this.callbacks.onProgress?.(`Executing parallel group: ${tasks.map(t => t.type).join(', ')}`);

            // Execute tasks in parallel
            this.transitionTo('monitoring');
            console.log(`[Orchestrator] ⏳ Waiting for agents to complete...`);

            const results = await this.executeParallelTasks(tasks, stepIndexByTaskId);

            // Check for failures and log results
            console.log(`[Orchestrator] 📊 Group ${groupIndex} Results:`);
            for (const result of results) {
                const task = tasks.find(t => t.id === result.taskId);
                const status = result.success ? '✅' : '❌';
                console.log(`  ${status} ${task?.assignedAgent}: ${result.success ? 'success' : 'FAILED'} (${result.executionTime}ms)`);

                if (!result.success) {
                    return result; // Return first failure
                }
                artifacts.push(...result.artifacts);
                this.completedTasks.add(result.taskId);
            }
        }

        // Integration phase
        this.transitionTo('integrating');
        this.callbacks.onProgress?.('Integrating results...');

        return {
            taskId: plan.id,
            agentId: this.config.id,
            success: true,
            artifacts,
            output: { completedTasks: Array.from(this.completedTasks) },
            tokensUsed: this.state.tokensUsed,
            executionTime: Date.now() - startTime
        };
    }

    /**
     * Execute tasks in parallel
     */
    private async executeParallelTasks(tasks: AgentTask[], stepIndexByTaskId: Map<string, number>): Promise<AgentResult[]> {
        const promises = tasks.map(async task => {
            const agent = this.agentPool.get(task.assignedAgent);
            const stepIndex = stepIndexByTaskId.get(task.id);

            if (!agent) {
                console.error(`[Orchestrator] No agent for task: ${task.assignedAgent}`);
                await this.updatePlanStep(stepIndex, 'failed', `No agent available for ${task.assignedAgent}`);
                return this.createFailureResult(task, {
                    code: 'NO_AGENT',
                    message: `No agent available for: ${task.assignedAgent}`,
                    recoverable: false
                }, 0);
            }

            const agentConfig = agent.getConfig();

            // Emit agent status: working
            this.callbacks.onAgentStatus?.(agentConfig.name, agentConfig.role, 'working', 0.5);
            console.log(`[Orchestrator] Agent ${agentConfig.name}: working`);
            await this.updatePlanStep(stepIndex, 'in_progress', `Assigned to ${agentConfig.name}`);

            // Send task to agent via sessions
            this.sessionsManager.sessionsSend(
                this.config.id,
                task.assignedAgent,
                JSON.stringify(task),
                'task_request'
            );

            // Update agent state
            this.sessionsManager.updateAgentInfo(task.assignedAgent, {
                status: 'executing',
                currentTask: task.description
            });

            // Execute task
            const result = await agent.execute(task);
            await this.updatePlanStep(
                stepIndex,
                result.success ? 'completed' : 'failed',
                result.success ? `Completed by ${agentConfig.name}` : (result.error?.message || `Failed in ${agentConfig.name}`)
            );

            // Emit agent status: complete or error
            const finalState = result.success ? 'complete' : 'error';
            this.callbacks.onAgentStatus?.(agentConfig.name, agentConfig.role, finalState, 1.0);
            console.log(`[Orchestrator] Agent ${agentConfig.name}: ${finalState}`);

            // Update agent state
            this.sessionsManager.updateAgentInfo(task.assignedAgent, {
                status: result.success ? 'idle' : 'error',
                currentTask: null,
                tokensUsed: result.tokensUsed
            });

            return result;
        });

        return Promise.all(promises);
    }

    private async syncPlanToGodot(plan: TaskPlan): Promise<void> {
        try {
            const steps = plan.tasks.map((t) => ({
                name: t.type,
                type: t.type,
                agent: t.assignedAgent,
                description: t.description,
                status: 'pending'
            }));

            await this.executeTool('set_task_plan', {
                name: 'Execution Plan',
                steps
            });
        } catch (error) {
            this.callbacks.onProgress?.(`[Orchestrator] Plan sync warning: ${error}`);
        }
    }

    private async updatePlanStep(
        stepIndex: number | undefined,
        status: 'pending' | 'in_progress' | 'completed' | 'failed',
        explanation: string
    ): Promise<void> {
        if (stepIndex === undefined || stepIndex < 0) {
            return;
        }

        try {
            await this.executeTool('update_plan', {
                step_index: stepIndex,
                status,
                explanation
            });
        } catch (error) {
            this.callbacks.onProgress?.(`[Orchestrator] Step update warning: ${error}`);
        }
    }

    // ============================================================================
    // Message Handling (A2A)
    // ============================================================================

    private handleAgentMessage(message: SessionMessage): void {
        console.log(`[Orchestrator] Received message from ${message.from}: ${message.type}`);

        switch (message.type) {
            case 'error_report':
                this.handleAgentError(message.from, message.content, message.payload);
                break;
            case 'status_update':
                this.handleStatusUpdate(message.from, message.content, message.payload);
                break;
            case 'task_result':
                this.handleTaskResult(message.from, message.content, message.payload);
                break;
        }
    }

    private handleAgentError(
        agentId: string,
        error: string,
        context?: Record<string, unknown>
    ): void {
        console.error(`[Orchestrator] Agent ${agentId} error: ${error}`);

        // Could trigger recovery strategies here
        // - Retry the task
        // - Assign to different agent
        // - Rollback to checkpoint
    }

    private handleStatusUpdate(
        agentId: string,
        status: string,
        details?: Record<string, unknown>
    ): void {
        console.log(`[Orchestrator] Agent ${agentId} status: ${status}`);
        this.callbacks.onProgress?.(`${agentId}: ${status}`);
    }

    private handleTaskResult(
        agentId: string,
        result: string,
        details?: Record<string, unknown>
    ): void {
        console.log(`[Orchestrator] Agent ${agentId} completed task`);
    }

    // ============================================================================
    // BaseAgent Implementation
    // ============================================================================

    canHandle(task: AgentTask): boolean {
        // Orchestrator can handle any high-level request
        return task.type === 'custom' || task.assignedAgent === this.config.id;
    }

    buildSystemPrompt(): string {
        const basePrompt = this.buildBasePrompt();

        const orchestratorContext = `
## Registered Agents
${Array.from(this.agentPool.values()).map(a => {
            const config = a.getConfig();
            return `- **${config.name}** (${config.id}): ${config.role}`;
        }).join('\n')}

## Coordination Rules
1. Break down complex requests into specialized tasks
2. Assign tasks to appropriate agents based on their expertise
3. Monitor agent progress and handle failures
4. Integrate results and verify final output
5. Report progress to the user

## Current State
- FSM State: ${this.fsm}
- Active Tasks: ${this.completedTasks.size}
- Agents Available: ${this.agentPool.size}
`;

        return basePrompt + orchestratorContext;
    }

    // ============================================================================
    // Utility Methods
    // ============================================================================

    /**
     * Rollback to a checkpoint
     */
    async rollback(checkpointId?: string): Promise<boolean> {
        const plan = this.stateManager.getCurrentPlan();
        const targetCheckpoint = checkpointId || plan?.checkpointId;

        if (!targetCheckpoint) {
            console.error('[Orchestrator] No checkpoint to rollback to');
            return false;
        }

        return this.stateManager.rollbackToCheckpoint(targetCheckpoint);
    }

    /**
     * Get current plan status
     */
    getPlanStatus(): { plan: TaskPlan | null; completed: string[] } {
        return {
            plan: this.stateManager.getCurrentPlan(),
            completed: Array.from(this.completedTasks)
        };
    }
}
