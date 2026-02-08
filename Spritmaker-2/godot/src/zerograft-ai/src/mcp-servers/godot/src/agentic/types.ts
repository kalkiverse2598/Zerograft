/**
 * Agentic Engine - Types and Interfaces
 * 
 * Core type definitions for the agentic execution system.
 */

// ============================================
// Tool Result Schema
// ============================================

export enum ErrorCode {
    OK = "OK",
    VALIDATION_ERROR = "VALIDATION_ERROR",
    TOOL_FAILURE = "TOOL_FAILURE",
    MISSING_CONTEXT = "MISSING_CONTEXT",
    GODOT_ERROR = "GODOT_ERROR",
    TIMEOUT = "TIMEOUT",
    CANCELLED = "CANCELLED",
    PRECONDITION_FAILED = "PRECONDITION_FAILED"  // Phase 0: Tool preconditions not met
}

export interface ToolResult {
    success: boolean;
    code: ErrorCode;
    data?: unknown;
    message: string;
    recoverable: boolean;
    durationMs?: number;
}

// ============================================
// Task State Machine
// ============================================

export enum TaskState {
    IDLE = "idle",
    RUNNING = "running",
    WAITING_USER = "waiting_user",
    COMPLETED = "completed",
    FAILED = "failed"
}

// ============================================
// Tool Classification
// ============================================

/** Read-only tools that can be parallelized */
export const READ_ONLY_TOOLS: readonly string[] = [
    "list_files",
    "read_script",
    "get_scene_tree",
    "get_node_info",
    "get_errors",
    "get_runtime_errors",
    "clear_runtime_errors",
    "list_scenes",
    "list_signals",
    "list_groups",
    "list_input_actions",
    "get_selected_nodes",
    "get_selected_text",
    "get_selected_files",
    "get_property",
    "get_project_setting",
    "get_open_scenes",
    "load_resource",
    "spritemancer_status",
    "spritemancer_list_presets"
] as const;

/** Tools that require user approval before execution */
export const GATED_TOOLS: readonly string[] = [
    "delete_file",
    "remove_node",
    "assets_move_and_rename"
] as const;

/** Tools that show diff preview (non-blocking) */
export const SHOW_DIFF_TOOLS: readonly string[] = [
    "edit_script",
    "set_property"
] as const;

/** SpriteMancer tools with extended timeout (5 min) */
export const SPRITEMANCER_TOOLS: readonly string[] = [
    "spritemancer_create_character",
    "spritemancer_animate",
    "spritemancer_generate_asset",
    "spritemancer_import",
    "spritemancer_generate_parallax",
    "spritemancer_generate_effect",
    // Tileset generation tools
    "spritemancer_generate_terrain_tileset",
    "spritemancer_generate_platform_tiles",
    "spritemancer_generate_wall_tileset",
    "spritemancer_generate_decoration",
    "spritemancer_generate_transition_tiles",
    "spritemancer_generate_animated_tile",
    "spritemancer_list_tileset_presets",
    // Tileset export tools
    "spritemancer_export_tileset_resource",
    "spritemancer_generate_and_export_terrain",
    // Scene import tools
    "import_parallax_to_scene",
    "import_tileset_to_scene",
    "import_effect_to_scene"
] as const;

/** Tools that modify files (should appear in "Files Changed" section) */
export const FILE_MODIFYING_TOOLS: readonly string[] = [
    // Scene/Node operations
    "create_scene",
    "save_scene",
    "delete_file",
    "remove_node",
    "add_node",
    "duplicate_node",

    // Script operations
    "create_script",
    "edit_script",
    "save_script",

    // Asset operations
    "assets_move_and_rename",
    "assets_reimport",

    // Property changes that modify scene files
    "set_property",
    "set_project_setting",

    // SpriteMancer file generation
    "spritemancer_create_character",
    "spritemancer_generate_asset",
    "spritemancer_import",
    "spritemancer_generate_parallax",
    "spritemancer_generate_effect",
    // Tileset generation tools
    "spritemancer_generate_terrain_tileset",
    "spritemancer_generate_platform_tiles",
    "spritemancer_generate_wall_tileset",
    "spritemancer_generate_decoration",
    "spritemancer_generate_transition_tiles",
    "spritemancer_generate_animated_tile",
    // Tileset export tools
    "spritemancer_export_tileset_resource",
    "spritemancer_generate_and_export_terrain"
] as const;

// ============================================
// Safety Settings
// ============================================

export interface SafetySettings {
    maxToolCallsPerTask: number;      // Default: 50
    maxRetriesPerTool: number;        // Default: 2
    noToolResponseLimit: number;      // Default: 3
    defaultTimeoutMs: number;         // Default: 30000 (30s)
    spritemancerTimeoutMs: number;    // Default: 300000 (5 min)
    contextThresholdPercent: number;  // Default: 80 (summarize at 80%)
    requireApprovalFor: string[];     // GATED_TOOLS
    showDiffFor: string[];            // SHOW_DIFF_TOOLS
}

export const DEFAULT_SAFETY_SETTINGS: SafetySettings = {
    maxToolCallsPerTask: 100,
    maxRetriesPerTool: 2,
    noToolResponseLimit: 3,
    defaultTimeoutMs: 30000,
    spritemancerTimeoutMs: 300000,
    contextThresholdPercent: 80,
    requireApprovalFor: [...GATED_TOOLS],
    showDiffFor: [...SHOW_DIFF_TOOLS]
};

// ============================================
// Tool Call Interfaces
// ============================================

export interface ToolCall {
    id: string;
    name: string;
    params: Record<string, unknown>;
    timestamp: number;
}

export interface QueuedToolCall {
    call: ToolCall;
    resolve: (result: ToolResult) => void;
    reject: (error: Error) => void;
    retryCount: number;
}

// ============================================
// Task Context
// ============================================

export interface TaskContext {
    taskId: string;
    state: TaskState;
    toolCallCount: number;
    noToolResponseCount: number;
    consecutiveMistakeCount: number;
    userAnswers: Record<string, string>;  // Q&A storage
    artifacts: TaskArtifacts;
    errors: ErrorLog[];
}

export interface TaskArtifacts {
    createdFiles: string[];
    modifiedFiles: string[];
    nodesAdded: string[];
    commandsRun: string[];
}

export interface ErrorLog {
    tool: string;
    params: Record<string, unknown>;
    errorCode: ErrorCode;
    errorMessage: string;
    attempt: number;
    timestamp: number;
}

// ============================================
// New Tool Schemas (snake_case to match LLM tool definitions)
// ============================================

export interface AskFollowupParams {
    question: string;
    choices?: string[];
    default?: string;
    timeout_seconds?: number;  // snake_case
    allow_skip?: boolean;      // snake_case
    context_key: string;       // snake_case
}

export interface AttemptCompletionParams {
    result: string;
    artifacts?: TaskArtifacts;
    warnings?: string[];
    next_suggestions?: string[];  // snake_case
    demo_command?: string;         // snake_case
}

// ============================================
// Helper Functions
// ============================================

export function isReadOnlyTool(toolName: string): boolean {
    return READ_ONLY_TOOLS.includes(toolName);
}

export function isGatedTool(toolName: string): boolean {
    return GATED_TOOLS.includes(toolName);
}

export function isShowDiffTool(toolName: string): boolean {
    return SHOW_DIFF_TOOLS.includes(toolName);
}

export function isSpriteMancerTool(toolName: string): boolean {
    return SPRITEMANCER_TOOLS.includes(toolName);
}

export function isFileModifyingTool(toolName: string): boolean {
    return FILE_MODIFYING_TOOLS.includes(toolName);
}

export function getToolTimeout(toolName: string, settings: SafetySettings): number {
    if (isSpriteMancerTool(toolName)) {
        return settings.spritemancerTimeoutMs;
    }
    return settings.defaultTimeoutMs;
}

export function createSuccessResult(data: unknown, message: string = "Success"): ToolResult {
    return {
        success: true,
        code: ErrorCode.OK,
        data,
        message,
        recoverable: true
    };
}

export function createErrorResult(
    code: ErrorCode,
    message: string,
    recoverable: boolean = true
): ToolResult {
    return {
        success: false,
        code,
        data: undefined,
        message,
        recoverable
    };
}
