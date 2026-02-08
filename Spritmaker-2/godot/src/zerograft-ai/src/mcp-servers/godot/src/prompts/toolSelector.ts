/**
 * Tool Selector - Dynamic Tool Category Selection
 * 
 * Analyzes user requests to determine which tool categories are needed,
 * reducing token usage by only including relevant tools.
 * 
 * Based on industry best practices:
 * - OpenAI recommends ≤20 tools per request
 * - Two-step selection for large tool sets
 * - Semantic filtering by request type
 */

/**
 * Tool categories for filtering
 */
export enum ToolCategory {
    /** Read-only inspection tools: get_*, list_* */
    INSPECTION = "inspection",

    /** Scene/node creation and modification: create_*, add_*, set_* */
    CREATION = "creation",

    /** SpriteMancer AI sprite generation tools */
    SPRITEMANCER = "spritemancer",

    /** Game execution: run_game, stop_game, save_scene */
    EXECUTION = "execution",

    /** Agentic loop control: ask_followup, attempt_completion (always included) */
    AGENTIC = "agentic",

    /** All tools - no filtering (for complex/unknown requests) */
    ALL = "all"
}

/**
 * Tools in each category
 */
const CATEGORY_TOOLS: Record<ToolCategory, readonly string[]> = {
    [ToolCategory.INSPECTION]: [
        // Scene inspection
        "get_scene_tree", "get_node_info", "list_scenes", "get_sprite_dimensions",
        // Script inspection
        "read_script", "get_errors", "search_in_scripts",
        // File inspection
        "list_files", "read_file",
        // Property/setting inspection
        "get_property", "get_project_setting", "list_input_actions",
        // Resource inspection
        "list_signals", "list_groups", "load_resource",
        // Selection inspection
        "get_selected_nodes", "get_selected_text", "get_selected_files",
        // Help
        "get_godot_help"
    ],

    [ToolCategory.CREATION]: [
        // Scene creation/modification
        "create_scene", "open_scene", "save_scene",
        "add_node", "remove_node", "rename_node", "duplicate_node", "move_node",
        "scene_instantiate", "set_collision_shape",
        // TileMap tools
        "map_set_cells_batch", "map_clear_layer", "map_fill_rect",
        // Script creation/modification
        "create_script", "edit_script", "attach_script",
        // Property/setting modification
        "set_property", "set_project_setting",
        // Input action modification
        "add_input_action", "remove_input_action",
        // Resource creation
        "create_resource", "create_folder", "delete_file",
        // Signal/group modification
        "connect_signal", "add_to_group", "remove_from_group",
        // Audio
        "set_audio_stream", "play_audio",
        // Asset management
        "assets_scan", "assets_update_file", "assets_reimport",
        // Utility
        "undo_last_action",
        // Player setup compound
        "setup_player_with_sprites"
    ],

    [ToolCategory.SPRITEMANCER]: [
        // All spritemancer_* tools are automatically included via prefix check
    ],

    [ToolCategory.EXECUTION]: [
        "run_game", "stop_game", "save_scene"
    ],

    [ToolCategory.AGENTIC]: [
        "ask_followup_question", "attempt_completion",
        "start_plan", "update_plan", "set_task_plan",
        "request_user_feedback"
    ],

    [ToolCategory.ALL]: []  // Special: means include all tools
};

/**
 * Build a Set of tools for faster lookup
 */
const TOOL_TO_CATEGORY: Map<string, ToolCategory> = new Map();

// Initialize tool-to-category mapping
for (const [category, tools] of Object.entries(CATEGORY_TOOLS) as [ToolCategory, readonly string[]][]) {
    for (const tool of tools) {
        TOOL_TO_CATEGORY.set(tool, category);
    }
}

/**
 * Get the category for a tool name
 */
export function getToolCategoryForTool(toolName: string): ToolCategory {
    // SpriteMancer tools are identified by prefix
    if (toolName.startsWith("spritemancer_")) {
        return ToolCategory.SPRITEMANCER;
    }

    // Look up in mapping
    const category = TOOL_TO_CATEGORY.get(toolName);
    if (category) {
        return category;
    }

    // Fallback: infer from name patterns
    if (toolName.startsWith("get_") || toolName.startsWith("list_") || toolName.startsWith("read_")) {
        return ToolCategory.INSPECTION;
    }
    if (toolName.startsWith("create_") || toolName.startsWith("add_") || toolName.startsWith("set_")) {
        return ToolCategory.CREATION;
    }

    // Unknown tools default to CREATION (to be safe)
    return ToolCategory.CREATION;
}

/**
 * Check if tool is in any of the enabled categories
 * Accepts string[] for compatibility with GodotPromptContext
 */
export function isToolInCategories(toolName: string, categories: string[]): boolean {
    // ALL means no filtering
    if (categories.includes(ToolCategory.ALL)) {
        return true;
    }

    const toolCategory = getToolCategoryForTool(toolName);
    return categories.includes(toolCategory);
}

/**
 * Import dynamic recipe checks
 */
let isGameCreationRequest: (request: string) => boolean;

// Lazy load to avoid circular dependency
async function loadRecipeChecks() {
    if (!isGameCreationRequest) {
        const recipes = await import('./recipes/index.js');
        isGameCreationRequest = recipes.isGameCreationRequest;
    }
}

/**
 * Check if request has multiple actions (complex request)
 */
function hasMultipleActions(request: string): boolean {
    const lower = request.toLowerCase();

    // Check for compound requests with "and", "then", etc.
    if (/\band\b.*\b(then|also|after)\b|\bthen\b.*\band\b/.test(lower)) {
        return true;
    }

    // Count action verbs
    const actionVerbs = [
        'create', 'make', 'build', 'add', 'remove', 'delete',
        'set', 'change', 'modify', 'update', 'fix',
        'run', 'play', 'test', 'save', 'open',
        'generate', 'design', 'setup'
    ];

    let verbCount = 0;
    for (const verb of actionVerbs) {
        if (new RegExp(`\\b${verb}\\b`, 'i').test(request)) {
            verbCount++;
        }
    }

    return verbCount >= 3;
}

/**
 * Analyze a user request and determine which tool categories are needed.
 * Returns an array of ToolCategory values.
 * 
 * ALWAYS includes AGENTIC tools.
 * Returns [ALL] for complex or game creation requests.
 */
export async function analyzeRequestForCategories(request: string): Promise<ToolCategory[]> {
    const lower = request.toLowerCase();

    // Always include AGENTIC
    const categories = new Set<ToolCategory>([ToolCategory.AGENTIC]);

    // Load recipe checks if needed
    await loadRecipeChecks();

    // Game creation → ALL (no filtering, too complex)
    if (isGameCreationRequest && isGameCreationRequest(request)) {
        console.log('[ToolSelector] Game creation request detected → ALL tools');
        return [ToolCategory.ALL];
    }

    // Complex multi-action requests → ALL
    if (hasMultipleActions(request)) {
        console.log('[ToolSelector] Complex multi-action request → ALL tools');
        return [ToolCategory.ALL];
    }

    // Inspection queries (read-only)
    if (/\b(show|list|get|what|current|state|how|which|where|tell me)\b/.test(lower)) {
        categories.add(ToolCategory.INSPECTION);
    }

    // Creation/modification requests
    if (/\b(create|add|make|build|set|change|modify|update|fix|remove|delete|attach|connect)\b/.test(lower)) {
        categories.add(ToolCategory.CREATION);
        categories.add(ToolCategory.INSPECTION); // Creation often needs inspection
    }

    // Sprite/character/animation requests
    if (/\b(sprite|character|animation|spritemancer|generate|pixel|art|design)\b/.test(lower)) {
        categories.add(ToolCategory.SPRITEMANCER);
        categories.add(ToolCategory.INSPECTION);
    }

    // Execution requests
    if (/\b(run|play|test|stop|save|execute|start|launch)\b/.test(lower)) {
        categories.add(ToolCategory.EXECUTION);
    }

    // Tilemap requests
    if (/\b(tile|tilemap|tileset|map|level)\b/.test(lower)) {
        categories.add(ToolCategory.CREATION);
        categories.add(ToolCategory.INSPECTION);
    }

    // Script requests
    if (/\b(script|code|function|method|gdscript)\b/.test(lower)) {
        categories.add(ToolCategory.CREATION);
        categories.add(ToolCategory.INSPECTION);
    }

    // If only AGENTIC matched (unknown request type) → default to INSPECTION + CREATION
    if (categories.size === 1) {
        console.log('[ToolSelector] Unknown request type → defaulting to INSPECTION + CREATION');
        categories.add(ToolCategory.INSPECTION);
        categories.add(ToolCategory.CREATION);
    }

    const result = Array.from(categories);
    console.log(`[ToolSelector] Request analysis: "${request.substring(0, 50)}..." → ${result.join(', ')}`);
    return result;
}

/**
 * Synchronous version for contexts where async is not possible
 * Falls back to keyword matching only (no isGameCreationRequest check)
 */
export function analyzeRequestForCategoriesSync(request: string): ToolCategory[] {
    const lower = request.toLowerCase();

    // Always include AGENTIC
    const categories = new Set<ToolCategory>([ToolCategory.AGENTIC]);

    // Game creation patterns - must be actual game types, not components like "platform tile"
    // Only match when it's clearly about creating a whole game
    const gameTypeWords = 'game|platformer|shooter|rpg|puzzle|arcade|roguelike|endless runner';
    const gameCreationRegex = new RegExp(
        `\\b(${gameTypeWords})\\b(?!\\s*(tile|tiles|tileset)).*\\b(create|make|build)\\b|` +
        `\\b(create|make|build)\\b.*\\b(${gameTypeWords})\\b(?!\\s*(tile|tiles|tileset))`,
        'i'
    );
    if (gameCreationRegex.test(lower)) {
        return [ToolCategory.ALL];
    }

    // Complex multi-action requests → ALL
    if (hasMultipleActions(request)) {
        return [ToolCategory.ALL];
    }

    // Inspection queries
    if (/\b(show|list|get|what|current|state|how|which|where|tell me)\b/.test(lower)) {
        categories.add(ToolCategory.INSPECTION);
    }

    // Creation/modification requests
    if (/\b(create|add|make|build|set|change|modify|update|fix|remove|delete|attach|connect)\b/.test(lower)) {
        categories.add(ToolCategory.CREATION);
        categories.add(ToolCategory.INSPECTION);
    }

    // Sprite/character/animation/tile requests → SPRITEMANCER
    if (/\b(sprite|character|animation|spritemancer|generate|pixel|art|design|tile|tileset|tilemap|terrain)\b/.test(lower)) {
        categories.add(ToolCategory.SPRITEMANCER);
        categories.add(ToolCategory.INSPECTION);
    }

    // Execution requests
    if (/\b(run|play|test|stop|save|execute|start|launch)\b/.test(lower)) {
        categories.add(ToolCategory.EXECUTION);
    }

    // If only AGENTIC matched, default to INSPECTION + CREATION
    if (categories.size === 1) {
        categories.add(ToolCategory.INSPECTION);
        categories.add(ToolCategory.CREATION);
    }

    return Array.from(categories);
}

/**
 * Get the list of enabled tool names for a set of categories
 * (For debugging/logging purposes)
 */
export function getToolsForCategories(categories: ToolCategory[]): string[] {
    if (categories.includes(ToolCategory.ALL)) {
        return ['ALL_TOOLS'];
    }

    const tools = new Set<string>();
    for (const category of categories) {
        const categoryTools = CATEGORY_TOOLS[category];
        if (categoryTools) {
            for (const tool of categoryTools) {
                tools.add(tool);
            }
        }
    }

    return Array.from(tools);
}
