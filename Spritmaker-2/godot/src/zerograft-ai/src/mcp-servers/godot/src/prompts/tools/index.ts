/**
 * Godot AI Tools Index
 * 
 * Central export for all tool specifications.
 * Registers all tools with the GodotToolSet registry.
 */

import { GodotToolSpec, ModelFamily, GodotPromptContext } from "../types.js";
import { GodotToolSet } from "../registry/GodotToolSet.js";
import { GeminiFunctionDeclaration } from "../spec.js";

// Import all tool categories
import { sceneTools } from "./scene/index.js";
import { scriptTools } from "./script/index.js";
import { spritemancerTools } from "./spritemancer/index.js";
import { agenticTools } from "./agentic/index.js";
import { inputTools } from "./input/index.js";
import { fileTools } from "./files/index.js";
import { resourceTools } from "./resources/index.js";

/**
 * All tool specifications combined
 */
export const ALL_GODOT_TOOLS: GodotToolSpec[] = [
    ...sceneTools,
    ...scriptTools,
    ...spritemancerTools,
    ...agenticTools,
    ...inputTools,
    ...fileTools,
    ...resourceTools
];

/**
 * Initialize the tool registry with all tools
 */
export function initializeToolRegistry(): void {
    GodotToolSet.clear();
    GodotToolSet.registerAll(ALL_GODOT_TOOLS);
}

/**
 * Get all enabled tools for a model family and context
 */
export function getEnabledTools(
    family: ModelFamily,
    context: GodotPromptContext
): GodotToolSpec[] {
    return GodotToolSet.getEnabledTools(family, context);
}

/**
 * Get Gemini function declarations for a context
 */
export function getGeminiTools(
    family: ModelFamily,
    context: GodotPromptContext
): GeminiFunctionDeclaration[] {
    return GodotToolSet.getGeminiTools(family, context);
}

/**
 * Get tool count
 */
export function getToolCount(): number {
    return ALL_GODOT_TOOLS.length;
}

// Re-export tool categories for direct access if needed
export { sceneTools } from "./scene/index.js";
export { scriptTools } from "./script/index.js";
export { spritemancerTools } from "./spritemancer/index.js";
export { agenticTools } from "./agentic/index.js";
export { inputTools } from "./input/index.js";
export { fileTools } from "./files/index.js";
export { resourceTools } from "./resources/index.js";
