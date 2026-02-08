/**
 * Tool Registry - Central registry for tool routing
 * Eliminates hardcoded tool lists scattered across aiRouter.ts
 */

export type ToolCategory = "spritemancer" | "agentic" | "godot";

/**
 * Agentic tools - handled locally, not routed to Godot bridge
 */
export const AGENTIC_TOOLS = [
    "set_task_plan",
    "start_plan",
    "update_plan",
    "add_diff_entry",
    "capture_viewport",
    "see_viewport",
    "get_runtime_state",
    "request_user_feedback",
    "create_animated_sprite",
    "get_godot_help"
] as const;

export type AgenticToolName = typeof AGENTIC_TOOLS[number];

/**
 * Determine which handler should process a tool call
 */
export function getToolCategory(name: string): ToolCategory {
    if (name.startsWith("spritemancer_")) {
        return "spritemancer";
    }
    if (AGENTIC_TOOLS.includes(name as AgenticToolName)) {
        return "agentic";
    }
    return "godot";
}

/**
 * Check if a tool modifies files (for "Files Changed" display)
 */
export function isFileModifyingTool(name: string): boolean {
    const fileModifyingTools = [
        "create_file",
        "edit_file",
        "delete_file",
        "create_script",
        "edit_script",
        "save_scene",
        "create_scene",
        "create_resource",
        "spritemancer_download_sprites",
        "spritemancer_create_character"
    ];
    return fileModifyingTools.includes(name);
}
