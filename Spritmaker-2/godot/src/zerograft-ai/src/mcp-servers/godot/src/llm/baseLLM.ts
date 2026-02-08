/**
 * Base LLM Interface
 * 
 * Abstract class that defines the contract for all LLM implementations.
 * Extend this class to add support for different LLM providers.
 */

import { jsonrepair } from 'jsonrepair';

export interface GodotCommand {
    method: string;
    params: Record<string, unknown>;
    explanation?: string;
}

export interface LLMResponse {
    commands: GodotCommand[];
    response: string;
}

export interface StreamCallbacks {
    onThinking?: (text: string) => void;
    onText?: (text: string) => void;
    onComplete?: (response: LLMResponse) => void;
    onError?: (error: Error) => void;
}

export interface LLMConfig {
    apiKey: string;
    modelName?: string;
    baseUrl?: string;  // Optional: Use Gemini proxy URL instead of direct API
}

/**
 * Abstract base class for LLM implementations
 */
export abstract class BaseLLM {
    protected config: LLMConfig;
    protected modelName: string;

    constructor(config: LLMConfig) {
        this.config = config;
        this.modelName = config.modelName || this.getDefaultModel();
    }

    /**
     * Get the default model name for this LLM provider
     */
    protected abstract getDefaultModel(): string;

    /**
     * Get the provider name (e.g., "gemini", "claude", "openai")
     */
    abstract getProviderName(): string;

    /**
     * Process a command synchronously
     */
    abstract processCommand(userInput: string, context?: string): Promise<LLMResponse>;

    /**
     * Process a command with streaming support
     * @param userInput - The user's input text
     * @param callbacks - Streaming callbacks for progress and completion
     * @param context - Optional context string
     * @param imageData - Optional array of base64-encoded image data (PNG format)
     */
    abstract processCommandStream(
        userInput: string,
        callbacks: StreamCallbacks,
        context?: string,
        imageData?: string[]
    ): Promise<void>;

    /**
     * Check if the model supports thinking/reasoning
     */
    supportsThinking(): boolean {
        return false;
    }

    /**
     * Get the current model name
     */
    getModelName(): string {
        return this.modelName;
    }

    /**
     * Parse JSON response from LLM output
     * Uses jsonrepair as fallback for malformed JSON
     */
    protected parseResponse(responseText: string): LLMResponse {
        // Extract JSON from response (may be wrapped in markdown)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            let jsonText = jsonMatch[0];

            // Try standard JSON.parse first
            try {
                const parsed = JSON.parse(jsonText);
                return {
                    response: parsed.response || "Done!",
                    commands: parsed.commands || [],
                };
            } catch (firstError) {
                // JSON.parse failed - try jsonrepair
                console.log("[BaseLLM] JSON.parse failed, attempting repair...");
                try {
                    const repairedJson = jsonrepair(jsonText);
                    const parsed = JSON.parse(repairedJson);
                    console.log("[BaseLLM] ✅ JSON repair successful!");
                    return {
                        response: parsed.response || "Done!",
                        commands: parsed.commands || [],
                    };
                } catch (repairError) {
                    console.error("[BaseLLM] ❌ JSON repair also failed:", repairError);
                }
            }
        }

        // Fallback: return response as-is with no commands
        return {
            response: responseText,
            commands: [],
        };
    }
}

/**
 * Factory function type for creating LLM instances
 */
export type LLMFactory = (config: LLMConfig) => BaseLLM;

/**
 * Registry of available LLM providers
 */
const llmRegistry: Map<string, LLMFactory> = new Map();

/**
 * Register an LLM provider
 */
export function registerLLMProvider(name: string, factory: LLMFactory): void {
    llmRegistry.set(name.toLowerCase(), factory);
}

/**
 * Create an LLM instance by provider name
 */
export function createLLM(provider: string, config: LLMConfig): BaseLLM {
    const factory = llmRegistry.get(provider.toLowerCase());
    if (!factory) {
        throw new Error(`Unknown LLM provider: ${provider}. Available: ${Array.from(llmRegistry.keys()).join(', ')}`);
    }
    return factory(config);
}

/**
 * Get list of available LLM providers
 */
export function getAvailableProviders(): string[] {
    return Array.from(llmRegistry.keys());
}
