/**
 * Tool Spec Converters for Godot AI
 * 
 * Converts GodotToolSpec to native LLM function calling schemas.
 * Currently supports Gemini; structure allows adding OpenAI/Anthropic later.
 */

import type { GodotToolSpec, GodotPromptContext, GodotToolParam } from "./types.js";

/**
 * Gemini type mapping
 */
const GEMINI_TYPE_MAP: Record<string, string> = {
    string: "STRING",
    boolean: "BOOLEAN",
    number: "NUMBER",
    integer: "NUMBER",
    array: "ARRAY",
    object: "OBJECT"
};

/**
 * Gemini FunctionDeclaration type (simplified to avoid import issues)
 */
export interface GeminiFunctionDeclaration {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: Record<string, {
            type: string;
            description: string;
            items?: { type: string };  // Required for ARRAY types
        }>;
        required: string[];
    };
}

/**
 * Convert a GodotToolSpec to Gemini function declaration format
 * 
 * @param tool - The tool specification
 * @param context - Runtime context for filtering params
 * @returns Gemini-compatible function declaration
 */
export function toolSpecToGemini(
    tool: GodotToolSpec,
    context: GodotPromptContext
): GeminiFunctionDeclaration {
    // Filter params by context requirements
    const params = tool.parameters.filter(p =>
        !p.contextRequirements || p.contextRequirements(context)
    );

    // Build properties object
    const properties: Record<string, { type: string; description: string; items?: { type: string } }> = {};
    const required: string[] = [];

    for (const param of params) {
        const geminiType = GEMINI_TYPE_MAP[param.type] || "STRING";

        // Build property with items for array types
        const prop: { type: string; description: string; items?: { type: string } } = {
            type: geminiType,
            description: param.description
        };

        // For array types, add items property (required by Gemini API)
        if (geminiType === "ARRAY") {
            prop.items = param.items || { type: "STRING" };  // Default to STRING if not specified
        }

        properties[param.name] = prop;

        if (param.required) {
            required.push(param.name);
        }
    }

    return {
        name: tool.name,
        description: tool.description,
        parameters: {
            type: "OBJECT",
            properties,
            required
        }
    };
}

/**
 * Convert multiple tools to Gemini format
 */
export function toolsToGemini(
    tools: GodotToolSpec[],
    context: GodotPromptContext
): GeminiFunctionDeclaration[] {
    return tools
        .filter(tool => !tool.contextRequirements || tool.contextRequirements(context))
        .map(tool => toolSpecToGemini(tool, context));
}

/**
 * Get native converter for a provider
 * Currently only Gemini is supported
 */
export function getNativeConverter(providerId: string) {
    switch (providerId) {
        case "gemini":
        case "vertex":
            return toolSpecToGemini;
        // Future: Add OpenAI, Anthropic converters
        default:
            return toolSpecToGemini; // Default to Gemini
    }
}
