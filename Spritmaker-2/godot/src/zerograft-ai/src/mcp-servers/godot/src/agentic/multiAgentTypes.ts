/**
 * Multi-Agent System Types
 * 
 * Core type definitions for the multi-agent game studio architecture.
 * Combines patterns from CrewAI (roles), LangGraph (state), OpenClaw (A2A), 
 * and Claude SDK (verification).
 */

// ============================================================================
// Agent Configuration & State
// ============================================================================

/**
 * Configuration for a specialized agent (CrewAI-style)
 */
export interface AgentConfig {
    /** Unique identifier for the agent */
    id: string;

    /** Human-readable name */
    name: string;

    /** Role description (e.g., "Scene Expert", "Character Artist") */
    role: string;

    /** Agent's primary goal */
    goal: string;

    /** Backstory for prompt engineering (CO-STAR pattern) */
    backstory: string;

    /** Tools exclusively owned by this agent */
    exclusiveTools: readonly string[];

    /** Read-only shared tools available to this agent */
    sharedTools: readonly string[];

    /** Agent's workspace directory */
    workspace: string;

    /** Maximum tokens per request */
    maxTokens: number;

    /** Maximum iterations before force-stop */
    maxIterations: number;
}

/**
 * Runtime state of an agent
 */
export interface AgentState {
    /** Agent ID */
    agentId: string;

    /** Current status */
    status: AgentStatus;

    /** Current task being executed */
    currentTask: AgentTask | null;

    /** Total tokens used in this session */
    tokensUsed: number;

    /** Last activity timestamp */
    lastActivity: Date;

    /** Error information if status is 'error' */
    lastError?: AgentError;
}

export type AgentStatus =
    | 'idle'
    | 'analyzing'
    | 'executing'
    | 'waiting'
    | 'verifying'
    | 'error'
    | 'complete';

// ============================================================================
// Task Types
// ============================================================================

/**
 * A task assigned to an agent
 */
export interface AgentTask {
    /** Unique task ID */
    id: string;

    /** Task type for routing */
    type: AgentTaskType;

    /** Human-readable description */
    description: string;

    /** Agent assigned to this task */
    assignedAgent: string;

    /** IDs of tasks this depends on */
    dependencies: string[];

    /** Priority (1 = highest) */
    priority: number;

    /** Input data for the task */
    input: Record<string, unknown>;

    /** Optional deadline */
    deadline?: Date;

    /** Parent task ID if this is a subtask */
    parentTaskId?: string;
}

export type AgentTaskType =
    | 'create_scene'
    | 'create_script'
    | 'attach_script'
    | 'generate_character'
    | 'generate_tileset'
    | 'add_node'
    | 'integrate_asset'
    | 'validate_project'
    | 'custom';

/**
 * Result from agent task execution
 */
export interface AgentResult {
    /** Task ID this result is for */
    taskId: string;

    /** Agent that produced this result */
    agentId: string;

    /** Whether the task succeeded */
    success: boolean;

    /** Artifacts created (file paths) */
    artifacts: string[];

    /** Output data */
    output: Record<string, unknown>;

    /** Error if failed */
    error?: AgentError;

    /** Tokens used for this task */
    tokensUsed: number;

    /** Execution time in ms */
    executionTime: number;
}

export interface AgentError {
    code: string;
    message: string;
    recoverable: boolean;
    suggestedAction?: string;
}

// ============================================================================
// Task Plan Types
// ============================================================================

/**
 * A complete plan for executing a user request
 */
export interface TaskPlan {
    /** Unique plan ID */
    id: string;

    /** Original user request */
    userRequest: string;

    /** All tasks in the plan */
    tasks: AgentTask[];

    /** Task dependencies */
    dependencies: TaskDependency[];

    /** Groups of tasks that can run in parallel */
    parallelGroups: string[][];

    /** Current plan status */
    status: PlanStatus;

    /** Checkpoint ID for rollback */
    checkpointId?: string;
}

export interface TaskDependency {
    /** Task that depends on another */
    taskId: string;

    /** Task that must complete first */
    dependsOn: string;
}

export type PlanStatus =
    | 'created'
    | 'executing'
    | 'paused'
    | 'completed'
    | 'failed'
    | 'rolled_back';

// ============================================================================
// State Management (LangGraph-style)
// ============================================================================

/**
 * Project state managed by StateManager
 */
export interface ProjectState {
    /** State version for optimistic locking */
    version: number;

    /** Scene states by path */
    scenes: Map<string, SceneState>;

    /** Asset states by path */
    assets: Map<string, AssetState>;

    /** Active locks */
    locks: Map<string, LockInfo>;

    /** Agent states */
    agentStates: Map<string, AgentState>;

    /** Active task plan */
    currentPlan: TaskPlan | null;

    /** Checkpoint history */
    checkpoints: Checkpoint[];
}

export interface SceneState {
    path: string;
    exists: boolean;
    isOpen: boolean;
    lastModified: Date;
    nodeCount: number;
}

export interface AssetState {
    path: string;
    type: 'sprite' | 'tileset' | 'audio' | 'script' | 'other';
    exists: boolean;
    lastModified: Date;
    metadata: Record<string, unknown>;
}

/**
 * Checkpoint for rollback (LangGraph pattern)
 */
export interface Checkpoint {
    id: string;
    label: string;
    timestamp: Date;
    stateSnapshot: string; // JSON serialized state
    agentId?: string; // Agent that triggered checkpoint
}

// ============================================================================
// Lock Management
// ============================================================================

/**
 * Lock information for conflict resolution
 */
export interface LockInfo {
    /** Resource being locked (file path) */
    resourcePath: string;

    /** Agent holding the lock */
    agentId: string;

    /** Lock type */
    lockType: LockType;

    /** When lock was acquired */
    acquiredAt: Date;

    /** When lock expires */
    expiresAt: Date;

    /** Operation being performed */
    operation: string;
}

export type LockType = 'exclusive' | 'shared';

export interface ConflictInfo {
    resourcePath: string;
    conflictingAgentId: string;
    conflictType: 'write_write' | 'write_read';
    resolution: 'wait' | 'abort' | 'force';
}

// ============================================================================
// Agent Communication (OpenClaw A2A pattern)
// ============================================================================

/**
 * Message between agents
 */
export interface SessionMessage {
    /** Unique message ID */
    id: string;

    /** Sender agent ID */
    from: string;

    /** Recipient agent ID */
    to: string;

    /** Message content */
    content: string;

    /** Message type */
    type: MessageType;

    /** Timestamp */
    timestamp: Date;

    /** Message this replies to */
    replyTo?: string;

    /** Attached data */
    payload?: Record<string, unknown>;
}

export type MessageType =
    | 'task_request'
    | 'task_result'
    | 'status_update'
    | 'error_report'
    | 'handoff'
    | 'query'
    | 'response';

/**
 * Agent info for sessions_list
 */
export interface AgentInfo {
    id: string;
    name: string;
    role: string;
    status: AgentStatus;
    currentTask: string | null;
    tokensUsed: number;
}

// ============================================================================
// Tool Assignments
// ============================================================================

/**
 * Agent-to-tool assignments
 */
export const AGENT_TOOL_ASSIGNMENTS = {
    orchestrator: [
        // Orchestrator has meta-tools for coordination
        'sessions_list',
        'sessions_history',
        'sessions_send',
        'create_checkpoint',
        'rollback_checkpoint',
        // Plan sync + live task tracking in UI
        'set_task_plan',
        'update_plan'
    ],

    architecture: [
        // Scene management
        'create_scene',
        'open_scene',
        'save_scene',
        // Node manipulation
        'add_node',
        'remove_node',
        'set_property',
        'reparent_node',
        // Integration (for post-character/tileset setup)
        'connect_signal',
        'disconnect_signal',
        // Camera setup
        'get_scene_tree',
        'get_node_info'
    ],

    character: [
        // SpriteMancer tools
        'spritemancer_create_character',
        'spritemancer_generate_animations',
        'spritemancer_approve_animation',
        'create_animated_sprite',
        // Script tools for player controller
        'create_script',
        'attach_script',
        // Node tools for character setup
        'add_node',  // For CharacterBody2D, CollisionShape2D
        'set_property'  // For collision shape configuration
    ],

    level: [
        // SpriteMancer tileset tools (actual names)
        'spritemancer_generate_terrain_tileset',
        'spritemancer_generate_platform_tiles',
        'spritemancer_generate_wall_tileset',
        'spritemancer_export_tileset_resource',
        // TileMap and level setup
        'add_node',  // For TileMapLayer node
        'set_property',  // For tileset assignment
        // Script tools for level painter
        'create_script',
        'attach_script'
    ],

    qa: [
        'get_errors',
        'get_runtime_errors',
        'run_scene',
        'stop_scene',
        'get_scene_tree',
        'list_files'
    ]
} as const;

/**
 * Read-only tools shared by all agents
 */
export const SHARED_READ_ONLY_TOOLS = [
    'list_files',
    'read_script',
    'get_scene_tree',
    'get_node_info',
    'get_project_settings'
] as const;

// ============================================================================
// Agent Type Registry
// ============================================================================

export type AgentType = keyof typeof AGENT_TOOL_ASSIGNMENTS;

export const AGENT_TYPES: readonly AgentType[] = [
    'orchestrator',
    'architecture',
    'character',
    'level',
    'qa'
] as const;
