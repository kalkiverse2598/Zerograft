/**
 * Godot Tool Set Registry
 * 
 * Manages tool registration and retrieval following Cline's pattern.
 * Supports model-family variants with fallback logic.
 */

import { GodotToolSpec, GodotPromptContext, ModelFamily } from "../types.js";
import { toolSpecToGemini, GeminiFunctionDeclaration } from "../spec.js";
import { isToolInCategories } from "../toolSelector.js";

/**
 * Tool set registry - manages tools by model family
 */
export class GodotToolSet {
    /** Tools mapped by model family */
    private static variants: Map<ModelFamily, Map<string, GodotToolSpec>> = new Map();

    /**
     * Register a tool specification
     */
    static register(tool: GodotToolSpec): void {
        if (!this.variants.has(tool.variant)) {
            this.variants.set(tool.variant, new Map());
        }
        this.variants.get(tool.variant)!.set(tool.id, tool);
    }

    /**
     * Register multiple tools at once
     */
    static registerAll(tools: GodotToolSpec[]): void {
        for (const tool of tools) {
            this.register(tool);
        }
    }

    /**
     * Get all tools for a model family
     */
    static getTools(family: ModelFamily): GodotToolSpec[] {
        const tools = this.variants.get(family);
        if (tools) {
            return Array.from(tools.values());
        }
        // Fallback to GENERIC if family not found
        return this.variants.has(ModelFamily.GENERIC)
            ? Array.from(this.variants.get(ModelFamily.GENERIC)!.values())
            : [];
    }

    /**
     * Get a specific tool by name with fallback
     */
    static getToolByName(toolName: string, family: ModelFamily): GodotToolSpec | undefined {
        // Try exact family first
        const familyTools = this.variants.get(family);
        if (familyTools?.has(toolName)) {
            return familyTools.get(toolName);
        }

        // Fallback to GENERIC
        const genericTools = this.variants.get(ModelFamily.GENERIC);
        if (genericTools?.has(toolName)) {
            return genericTools.get(toolName);
        }

        // Search all variants as last resort
        for (const [, tools] of this.variants) {
            if (tools.has(toolName)) {
                return tools.get(toolName);
            }
        }

        return undefined;
    }

    /**
     * Get enabled tools filtered by context and category
     */
    static getEnabledTools(family: ModelFamily, context: GodotPromptContext): GodotToolSpec[] {
        const tools = this.getTools(family);

        // Check if category filtering is enabled
        const hasCategories = context.enabledToolCategories &&
            context.enabledToolCategories.length > 0 &&
            !context.enabledToolCategories.includes('all');

        return tools.filter(tool => {
            // Existing context requirements (SpriteMancer availability, etc.)
            if (tool.contextRequirements && !tool.contextRequirements(context)) {
                return false;
            }

            // Category-based filtering
            if (hasCategories && context.enabledToolCategories) {
                if (!isToolInCategories(tool.name, context.enabledToolCategories)) {
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Get native Gemini function declarations
     */
    static getGeminiTools(family: ModelFamily, context: GodotPromptContext): GeminiFunctionDeclaration[] {
        const tools = this.getEnabledTools(family, context);

        // Log tool count for debugging/monitoring
        const categories = context.enabledToolCategories?.join(',') || 'all';
        console.log(`[GodotToolSet] Enabled tools: ${tools.length} (categories: ${categories})`);

        return tools.map(tool => toolSpecToGemini(tool, context));
    }

    /**
     * Get count of registered tools
     */
    static getToolCount(family?: ModelFamily): number {
        if (family) {
            return this.variants.get(family)?.size || 0;
        }
        let count = 0;
        for (const [, tools] of this.variants) {
            count += tools.size;
        }
        return count;
    }

    /**
     * Get all registered model families
     */
    static getRegisteredFamilies(): ModelFamily[] {
        return Array.from(this.variants.keys());
    }

    /**
     * Clear all registered tools (useful for testing)
     */
    static clear(): void {
        this.variants.clear();
    }
}
