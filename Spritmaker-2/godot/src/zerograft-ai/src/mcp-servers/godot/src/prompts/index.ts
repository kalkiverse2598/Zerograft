/**
 * Prompts Module - Barrel Export
 * 
 * Combines system prompt, tool definitions, and examples into a
 * complete, model-agnostic prompt for Godot AI assistants.
 */

// Legacy exports (still used by geminiLLM.ts)
export { IDENTITY, TOOL_CALLING_RULES, MAKING_CHANGES_GUIDELINES, DEBUGGING_GUIDELINES, RESPONSE_FORMAT, COMMON_PATTERNS, buildBaseSystemPrompt } from './systemPrompt.js';
export { TOOL_DEFINITIONS, getToolsPrompt, getToolCount, type ToolDefinition } from './toolDefinitions.js';
export { COMMAND_EXAMPLES, getExamplesPrompt, getExamplesForCommand, type CommandExample } from './examples.js';

// NEW: Cline-architecture exports (used by geminiLLMv2.ts)
export { ModelFamily, type GodotPromptContext, type GodotToolSpec, type GodotToolParam } from './types.js';
export { toolSpecToGemini, toolsToGemini, getNativeConverter, type GeminiFunctionDeclaration } from './spec.js';
export { buildSlimSystemPrompt, buildDetailedSystemPrompt, getPromptTokenEstimate } from './slimSystemPrompt.js';
export { GodotToolSet } from './registry/GodotToolSet.js';
export {
    ALL_GODOT_TOOLS,
    initializeToolRegistry,
    getEnabledTools,
    getGeminiTools,
    getToolCount as getNewToolCount
} from './tools/index.js';

// NEW: Game development recipes
export { RECIPES, findRecipes, getRecipe, getRecipeNames } from './recipes/index.js';

import { buildBaseSystemPrompt } from './systemPrompt.js';
import { getToolsPrompt } from './toolDefinitions.js';
import { getExamplesPrompt } from './examples.js';

/**
 * Builds the complete system prompt by combining all components
 * LEGACY: Used by original geminiLLM.ts
 * For new implementation, use buildSlimSystemPrompt() with native tools
 */
export function buildCompleteSystemPrompt(): string {
    return [
        buildBaseSystemPrompt(),
        getToolsPrompt(),
        getExamplesPrompt(),
        "\nAlways return valid JSON. If you can't help, return commands: []."
    ].join('\n');
}
