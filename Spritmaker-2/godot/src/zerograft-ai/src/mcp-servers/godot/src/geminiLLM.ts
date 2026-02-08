/**
 * Gemini LLM Client for Agentic Godot
 * 
 * DEPRECATED: This file is kept for backward compatibility.
 * New code should import from './llm/index.js' instead.
 * 
 * @deprecated Use './llm/geminiLLM.js' directly
 */

// Re-export everything from the new modular structure
export { GeminiLLM } from './llm/geminiLLM.js';
export {
    type GodotCommand,
    type LLMResponse,
    type StreamCallbacks,
    type LLMConfig,
    BaseLLM,
    createLLM,
    registerLLMProvider,
    getAvailableProviders
} from './llm/baseLLM.js';

// For backward compatibility - expose GeminiLLM as default-ish export
import { GeminiLLM } from './llm/geminiLLM.js';

/**
 * @deprecated Use `new GeminiLLM({ apiKey, modelName })` instead
 */
export function createGeminiLLM(apiKey: string, modelName?: string): GeminiLLM {
    return new GeminiLLM({ apiKey, modelName });
}
