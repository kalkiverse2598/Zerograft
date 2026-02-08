/**
 * Multi-Agent System
 * 
 * Entry point for the multi-agent game studio architecture.
 * Initializes all components and provides a unified interface.
 */

import { randomUUID } from 'crypto';
import {
    AgentTask,
    AgentResult,
    TaskPlan,
    ProjectState,
    AgentInfo
} from './multiAgentTypes.js';
import { StateManager } from './stateManager.js';
import { LockManager } from './lockManager.js';
import { SessionsManager } from './sessionsManager.js';
import { TaskPlanner } from './taskPlanner.js';
import {
    BaseAgent,
    AgentCallbacks,
    Orchestrator,
    ArchitectureAgent,
    CharacterAgent,
    LevelAgent,
    QAAgent
} from './agents/index.js';
import { ToolResult } from './types.js';

/**
 * Configuration for the multi-agent system
 */
export interface MultiAgentConfig {
    /** Enable multi-agent mode (false = single agent mode) */
    enabled: boolean;

    /** Maximum parallel agents */
    maxParallelAgents: number;

    /** Enable checkpointing */
    enableCheckpoints: boolean;

    /** Checkpoint retention count */
    maxCheckpoints: number;

    /** Lock timeout in milliseconds */
    lockTimeoutMs: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: MultiAgentConfig = {
    enabled: true,
    maxParallelAgents: 4,
    enableCheckpoints: true,
    maxCheckpoints: 50,
    lockTimeoutMs: 5 * 60 * 1000 // 5 minutes
};

/**
 * Callbacks required by the multi-agent system
 */
export interface MultiAgentCallbacks {
    /** Execute a tool by name */
    executeTool: (name: string, params: Record<string, unknown>) => Promise<ToolResult>;

    /** Send a prompt to the LLM */
    sendToLLM: (context: string, imageData?: string[]) => Promise<string>;

    /** Report progress to the UI */
    onProgress?: (message: string) => void;

    /** Request user approval */
    requestApproval?: (operation: string, details: string) => Promise<boolean>;

    /** Send agent status update to UI (for Agents tab) */
    onAgentStatus?: (name: string, role: string, state: string, progress: number) => void;

    /** Notify UI that multi-agent mode is enabled/disabled */
    onMultiAgentEnabled?: (enabled: boolean) => void;

    /** Notify UI when plan is created (for Tasks tab) */
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
 * MultiAgentSystem is the main entry point for the multi-agent architecture
 */
export class MultiAgentSystem {
    private config: MultiAgentConfig;
    private callbacks: MultiAgentCallbacks;

    // Core components
    private stateManager: StateManager;
    private lockManager: LockManager;
    private sessionsManager: SessionsManager;
    private taskPlanner: TaskPlanner;

    // Agents
    private orchestrator: Orchestrator;
    private agents: Map<string, BaseAgent> = new Map();

    // Status
    private initialized: boolean = false;

    constructor(callbacks: MultiAgentCallbacks, config: Partial<MultiAgentConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.callbacks = callbacks;

        // Initialize core components
        this.stateManager = new StateManager();
        this.lockManager = new LockManager(this.stateManager);
        this.sessionsManager = new SessionsManager();
        this.taskPlanner = new TaskPlanner();

        // Create agent callbacks
        const agentCallbacks = this.createAgentCallbacks();

        // Initialize orchestrator
        this.orchestrator = new Orchestrator(
            agentCallbacks,
            this.stateManager,
            this.lockManager,
            this.sessionsManager
        );

        // Initialize specialized agents
        this.initializeAgents(agentCallbacks);

        this.initialized = true;
        console.log('[MultiAgentSystem] Initialized with', this.agents.size, 'agents');
    }

    // ============================================================================
    // Initialization
    // ============================================================================

    private createAgentCallbacks(): AgentCallbacks {
        return {
            executeTool: this.callbacks.executeTool,
            sendToLLM: this.callbacks.sendToLLM,
            onProgress: this.callbacks.onProgress,
            requestApproval: this.callbacks.requestApproval,
            getSessionsManager: () => this.sessionsManager,
            onAgentStatus: this.callbacks.onAgentStatus,
            onPlanCreated: this.callbacks.onPlanCreated
        };
    }

    private initializeAgents(callbacks: AgentCallbacks): void {
        // Architecture Agent
        const architectureAgent = new ArchitectureAgent(callbacks, this.lockManager);
        this.agents.set('architecture', architectureAgent);
        this.orchestrator.registerAgent(architectureAgent);

        // Character Agent
        const characterAgent = new CharacterAgent(callbacks);
        this.agents.set('character', characterAgent);
        this.orchestrator.registerAgent(characterAgent);

        // Level Agent
        const levelAgent = new LevelAgent(callbacks);
        this.agents.set('level', levelAgent);
        this.orchestrator.registerAgent(levelAgent);

        // QA Agent
        const qaAgent = new QAAgent(callbacks);
        this.agents.set('qa', qaAgent);
        this.orchestrator.registerAgent(qaAgent);
    }

    // ============================================================================
    // Main API
    // ============================================================================

    /**
     * Process a user request through the multi-agent system
     */
    async processRequest(userRequest: string): Promise<AgentResult> {
        if (!this.initialized) {
            throw new Error('MultiAgentSystem not initialized');
        }

        if (!this.config.enabled) {
            // Single agent mode - delegate to existing system
            throw new Error('Single agent mode - use existing AgenticRouter');
        }

        this.callbacks.onProgress?.('Multi-agent system processing request...');

        // Notify UI that multi-agent mode is active
        this.callbacks.onMultiAgentEnabled?.(true);

        // Send initial agent statuses
        this.emitAllAgentStatuses('idle');

        // Create a high-level task for the orchestrator
        const task: AgentTask = {
            id: randomUUID(),
            type: 'custom',
            description: userRequest,
            assignedAgent: 'orchestrator',
            dependencies: [],
            priority: 1,
            input: { userRequest }
        };

        // Update orchestrator status
        this.emitAgentStatus('Orchestrator', 'Coordinator', 'working', 0.1);

        try {
            // Let the orchestrator handle it
            const result = await this.orchestrator.execute(task);

            // Update final statuses
            if (result.success) {
                this.emitAllAgentStatuses('complete');
            } else {
                this.emitAgentStatus('Orchestrator', 'Coordinator', 'error', 0);
            }

            return result;
        } catch (error) {
            this.emitAgentStatus('Orchestrator', 'Coordinator', 'error', 0);
            throw error;
        }
    }

    /**
     * Emit status for a single agent
     */
    private emitAgentStatus(name: string, role: string, state: string, progress: number): void {
        this.callbacks.onAgentStatus?.(name, role, state, progress);
    }

    /**
     * Emit status for all agents
     */
    private emitAllAgentStatuses(state: string): void {
        const agents = this.getAllAgents();
        for (const agent of agents) {
            this.emitAgentStatus(agent.name, agent.role, state, 0);
        }
    }

    /**
     * Get a specific agent by ID
     */
    getAgent(agentId: string): BaseAgent | undefined {
        if (agentId === 'orchestrator') {
            return this.orchestrator;
        }
        return this.agents.get(agentId);
    }

    /**
     * Get all registered agents
     */
    getAllAgents(): AgentInfo[] {
        return this.sessionsManager.sessionsList();
    }

    /**
     * Get current project state
     */
    getProjectState(): Readonly<ProjectState> {
        return this.stateManager.getState();
    }

    /**
     * Get current task plan
     */
    getCurrentPlan(): TaskPlan | null {
        return this.stateManager.getCurrentPlan();
    }

    /**
     * Get orchestrator FSM state
     */
    getOrchestratorState(): string {
        return this.orchestrator.getFSMState();
    }

    // ============================================================================
    // Checkpointing
    // ============================================================================

    /**
     * Create a checkpoint
     */
    createCheckpoint(label: string): string {
        return this.stateManager.createCheckpoint(label, 'user');
    }

    /**
     * Rollback to a checkpoint
     */
    rollbackToCheckpoint(checkpointId: string): boolean {
        return this.stateManager.rollbackToCheckpoint(checkpointId);
    }

    /**
     * Get checkpoint history
     */
    getCheckpointHistory(limit: number = 10) {
        return this.stateManager.getStateHistory(limit);
    }

    // ============================================================================
    // Messaging (A2A)
    // ============================================================================

    /**
     * Send a message to an agent
     */
    sendMessage(toAgentId: string, content: string): void {
        this.sessionsManager.sessionsSend('user', toAgentId, content, 'task_request');
    }

    /**
     * Get message history for an agent
     */
    getMessageHistory(agentId: string, limit: number = 20) {
        return this.sessionsManager.sessionsHistory(agentId, limit);
    }

    // ============================================================================
    // Cleanup
    // ============================================================================

    /**
     * Shutdown the multi-agent system
     */
    shutdown(): void {
        this.lockManager.stopCleanupTask();
        this.sessionsManager.clearAgents();
        this.sessionsManager.clearMessages();
        this.initialized = false;
        console.log('[MultiAgentSystem] Shutdown complete');
    }

    // ============================================================================
    // Configuration
    // ============================================================================

    /**
     * Enable or disable multi-agent mode
     */
    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
    }

    /**
     * Check if multi-agent mode is enabled
     */
    isEnabled(): boolean {
        return this.config.enabled;
    }

    /**
     * Get current configuration
     */
    getConfig(): Readonly<MultiAgentConfig> {
        return { ...this.config };
    }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new multi-agent system instance
 */
export function createMultiAgentSystem(
    callbacks: MultiAgentCallbacks,
    config?: Partial<MultiAgentConfig>
): MultiAgentSystem {
    return new MultiAgentSystem(callbacks, config);
}
