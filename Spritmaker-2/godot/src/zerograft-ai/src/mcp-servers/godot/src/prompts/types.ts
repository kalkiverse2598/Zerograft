/**
 * Type Definitions for Godot AI Prompt System
 * 
 * Based on Cline's architecture pattern with Godot-specific context.
 */

/**
 * Model family enum for tool variants
 */
export enum ModelFamily {
    GENERIC = "generic",
    GEMINI_3 = "gemini-3"
}

/**
 * Runtime context passed to tools and prompts
 * This captures the current state of the Godot editor
 */
export interface GodotPromptContext {
    /** Current Godot project path (res://) */
    cwd: string;

    /** Currently open scene path */
    currentScene?: string;

    /** Whether SpriteMancer backend is available */
    hasSpriteMancer: boolean;

    /** Currently selected nodes in editor */
    selectedNodes?: string[];

    /** Current script open in editor */
    currentScript?: string;

    /** Whether game is currently running */
    isGameRunning?: boolean;

    /** 
     * Tool categories enabled for this request (dynamic tool filtering)
     * If undefined or empty, all tools are included.
     * Import ToolCategory from './toolSelector.js'
     */
    enabledToolCategories?: string[];  // ToolCategory enum values as strings

    /** 
     * Original user request (for fallback detection and logging)
     */
    userRequest?: string;
}

/**
 * Tool specification following Cline's pattern
 */
export interface GodotToolSpec {
    /** Unique tool identifier */
    id: string;

    /** Model family this spec is for */
    variant: ModelFamily;

    /** Tool name (used in function calling) */
    name: string;

    /** Brief description of what the tool does */
    description: string;

    /** Tool parameters */
    parameters: GodotToolParam[];

    /** 
     * Conditional tool - only include if function returns true
     * Use this to hide tools based on runtime context
     */
    contextRequirements?: (ctx: GodotPromptContext) => boolean;

    /** When to use this tool (for prompt guidance) */
    whenToUse?: string;

    /** When NOT to use this tool (for prompt guidance) */
    whenNotToUse?: string;
}

/**
 * Tool parameter specification
 */
export interface GodotToolParam {
    /** Parameter name */
    name: string;

    /** Whether this parameter is required */
    required: boolean;

    /** Parameter type for schema generation */
    type: "string" | "boolean" | "number" | "array" | "object";

    /** Description shown in schema */
    description: string;

    /** 
     * Conditional param - only include if function returns true
     * Use this to hide params based on runtime context
     */
    contextRequirements?: (ctx: GodotPromptContext) => boolean;

    /** Default value if not provided */
    default?: unknown;

    /** For array types: item schema (required by Gemini API) */
    items?: { type: string };

    /** For object types: property schemas */
    properties?: Record<string, unknown>;
}

/**
 * Type guard for ModelFamily
 */
export function isValidModelFamily(family: string): family is ModelFamily {
    return Object.values(ModelFamily).includes(family as ModelFamily);
}
