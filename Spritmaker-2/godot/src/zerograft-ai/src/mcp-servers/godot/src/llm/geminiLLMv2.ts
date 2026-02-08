/**
 * Gemini LLM Implementation (v2 - Native Function Calling)
 * 
 * Updated implementation using Gemini's native tools parameter
 * for function calling instead of embedding tool definitions in prompt.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { BaseLLM, LLMConfig, LLMResponse, StreamCallbacks, registerLLMProvider } from "./baseLLM.js";
import { buildDetailedSystemPrompt } from "../prompts/slimSystemPrompt.js";
import { initializeToolRegistry, getGeminiTools } from "../prompts/tools/index.js";
import { ModelFamily, GodotPromptContext } from "../prompts/types.js";
import { analyzeRequestForCategoriesSync } from "../prompts/toolSelector.js";

// Initialize tool registry on module load
initializeToolRegistry();

/**
 * Default context for when no provider is given
 */
function getDefaultContext(): GodotPromptContext {
    return {
        cwd: "res://",
        hasSpriteMancer: true,
        selectedNodes: [],
        currentScene: undefined,
        currentScript: undefined,
        isGameRunning: false
    };
}

/**
 * Context provider function type - returns current Godot editor state
 */
export type ContextProvider = () => GodotPromptContext;

export class GeminiLLMv2 extends BaseLLM {
    private genAI: GoogleGenerativeAI;
    private contextProvider: ContextProvider;
    private baseUrl?: string;  // Optional proxy URL

    constructor(config: LLMConfig, contextProvider?: ContextProvider) {
        super(config);
        this.genAI = new GoogleGenerativeAI(config.apiKey);
        this.baseUrl = config.baseUrl;  // Store for use in getGenerativeModel
        this.contextProvider = contextProvider || getDefaultContext;
        const proxyInfo = config.baseUrl ? ` via proxy ${config.baseUrl}` : '';
        console.log(`[GeminiLLMv2] Initialized with model: ${this.modelName}${proxyInfo} (native function calling)`);
    }

    protected getDefaultModel(): string {
        return "gemini-3-flash-preview";
    }

    getProviderName(): string {
        return "gemini";
    }

    supportsThinking(): boolean {
        return this.modelName.includes("2.5") ||
            this.modelName.includes("gemini-3") ||
            this.modelName.includes("thinking");
    }

    /**
     * Get Gemini model configured with native function calling
     */
    private getConfiguredModel(context: GodotPromptContext) {
        const functionDeclarations = getGeminiTools(ModelFamily.GENERIC, context);
        console.log(`[GeminiLLMv2] Registered ${functionDeclarations.length} tools for function calling`);

        let modelParams: any = {
            model: this.modelName,
            systemInstruction: buildDetailedSystemPrompt(),
            tools: [{
                functionDeclarations: functionDeclarations
            }]
        };

        // Add thinking config if supported
        if (this.supportsThinking()) {
            const is25Model = this.modelName.includes("2.5");
            const is3Model = this.modelName.includes("gemini-3");

            if (is25Model || this.modelName.includes("thinking")) {
                modelParams.generationConfig = {
                    thinkingConfig: {
                        includeThoughts: true,
                        thinkingBudget: 4096
                    }
                };
            } else if (is3Model) {
                modelParams.generationConfig = {
                    thinkingConfig: {
                        thinkingLevel: "low",
                        includeThoughts: true
                    }
                };
            }
        }

        // Pass baseUrl via RequestOptions for proxy support
        const requestOptions = this.baseUrl ? { baseUrl: this.baseUrl } : undefined;
        return this.genAI.getGenerativeModel(modelParams, requestOptions);
    }

    async processCommand(userInput: string, context?: string): Promise<LLMResponse> {
        const prompt = context
            ? `Context: ${context}\n\nUser: ${userInput}`
            : `User: ${userInput}`;

        const MAX_RETRIES = 3;
        const BASE_DELAY_MS = 2000;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const godotContext = this.contextProvider();
                const model = this.getConfiguredModel(godotContext);

                const chat = model.startChat({
                    history: []
                });

                console.log(`[GeminiLLMv2] Sending request to ${this.modelName}${attempt > 0 ? ` (retry ${attempt}/${MAX_RETRIES})` : ''}...`);
                const result = await chat.sendMessage(prompt);
                const response = result.response;

                // Handle function calls from native response
                return this.parseNativeResponse(response);
            } catch (error) {
                if (this.isRateLimitError(error)) {
                    if (attempt < MAX_RETRIES) {
                        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt); // 2s, 4s, 8s
                        console.warn(`[GeminiLLMv2] 🔄 Rate limit hit (429) on processCommand, waiting ${delayMs / 1000}s before retry ${attempt + 1}/${MAX_RETRIES}...`);
                        await this.sleep(delayMs);
                        continue;
                    }
                    console.error(`[GeminiLLMv2] ❌ Rate limit: Max retries (${MAX_RETRIES}) exceeded on processCommand`);
                }

                console.error("[GeminiLLMv2] Error:", error);
                return {
                    response: `Error: ${error instanceof Error ? error.message : String(error)}`,
                    commands: [],
                };
            }
        }

        // Should not reach here, but safety fallback
        return { response: 'Request failed after retries', commands: [] };
    }

    /**
     * Sleep utility for backoff delays
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Check if error is a rate limit (429) error
     */
    private isRateLimitError(error: unknown): boolean {
        const errorStr = String(error);
        return errorStr.includes('429') || errorStr.includes('Too Many Requests') || errorStr.includes('rate limit');
    }

    async processCommandStream(
        userInput: string,
        callbacks: StreamCallbacks,
        context?: string,
        imageData?: string[]
    ): Promise<void> {
        const prompt = context
            ? `Context: ${context}\n\nUser: ${userInput}`
            : `User: ${userInput}`;

        const MAX_RETRIES = 3;
        const BASE_DELAY_MS = 2000; // 2 seconds base delay

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const godotContext = this.contextProvider();

                // Dynamic tool filtering: analyze request to determine needed tool categories
                try {
                    godotContext.enabledToolCategories = analyzeRequestForCategoriesSync(userInput);
                    godotContext.userRequest = userInput;
                    console.log(`[GeminiLLMv2] Tool categories for request: ${godotContext.enabledToolCategories?.join(', ') || 'all'}`);
                } catch (e) {
                    // Fallback: use all tools if selection fails
                    console.warn('[GeminiLLMv2] Tool category analysis failed, using all tools:', e);
                }

                const model = this.getConfiguredModel(godotContext);

                const chat = model.startChat({
                    history: []
                });

                // Build message parts - support multiple images
                const messageParts: any[] = [{ text: prompt }];
                if (imageData && imageData.length > 0) {
                    console.log(`[GeminiLLMv2] Adding ${imageData.length} image(s) to request`);
                    for (const imgBase64 of imageData) {
                        messageParts.push({
                            inlineData: {
                                mimeType: "image/png",
                                data: imgBase64
                            }
                        });
                    }
                }

                console.log(`[GeminiLLMv2] Starting stream request to ${this.modelName}${attempt > 0 ? ` (retry ${attempt}/${MAX_RETRIES})` : ''}...`);
                const result = await chat.sendMessageStream(messageParts);
                console.log(`[GeminiLLMv2] Stream started, processing chunks...`);
                let fullText = "";
                const functionCalls: any[] = [];
                let chunkCount = 0;

                for await (const chunk of result.stream) {
                    chunkCount++;
                    console.log(`[GeminiLLMv2] Received chunk #${chunkCount}`);
                    // @ts-ignore
                    const candidates = chunk.candidates || [];

                    if (candidates.length > 0) {
                        // @ts-ignore
                        const parts = candidates[0].content?.parts || [];

                        for (const part of parts) {
                            // @ts-ignore - Thought content
                            if (part.thought === true) {
                                callbacks.onThinking?.(part.text || "");
                            }
                            // @ts-ignore - Function call
                            else if (part.functionCall) {
                                console.log(`[GeminiLLMv2] Function call: ${part.functionCall.name}`);
                                functionCalls.push(part.functionCall);
                            }
                            // Text content
                            else if (part.text) {
                                fullText += part.text;
                                callbacks.onText?.(part.text);
                            }
                        }
                    } else {
                        const chunkText = chunk.text();
                        fullText += chunkText;
                        callbacks.onText?.(chunkText);
                    }
                }

                // Convert to LLMResponse format
                const response = this.buildResponse(fullText, functionCalls);
                callbacks.onComplete?.(response);

                // SUCCESS - exit the retry loop
                return;

            } catch (error) {
                const errorObj = error instanceof Error ? error : new Error(String(error));

                // Check if this is a rate limit error
                if (this.isRateLimitError(error)) {
                    if (attempt < MAX_RETRIES) {
                        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt); // 2s, 4s, 8s
                        console.warn(`[GeminiLLMv2] 🔄 Rate limit hit (429), waiting ${delayMs / 1000}s before retry ${attempt + 1}/${MAX_RETRIES}...`);
                        callbacks.onText?.(`\n⏳ Rate limit reached, waiting ${delayMs / 1000}s before retry...\n`);
                        await this.sleep(delayMs);
                        continue; // Retry
                    }
                    // Max retries exceeded for rate limit
                    console.error(`[GeminiLLMv2] ❌ Rate limit: Max retries (${MAX_RETRIES}) exceeded`);
                    callbacks.onError?.(new Error(`Rate limit exceeded after ${MAX_RETRIES} retries. Please wait a minute and try again.`));
                    return; // Don't throw — onError already notified the caller
                }

                // Non-rate-limit errors: don't retry, fail immediately
                console.error(`[GeminiLLMv2] Stream error:`, error);
                callbacks.onError?.(errorObj);
                return; // Don't throw — onError already notified the caller
            }
        }
    }

    /**
     * Parse native Gemini response with function calls
     */
    private parseNativeResponse(response: any): LLMResponse {
    const parts = response.candidates?.[0]?.content?.parts || [];
    let textContent = "";
    const functionCalls: any[] = [];

    for (const part of parts) {
        if (part.text) {
            textContent += part.text;
        }
        if (part.functionCall) {
            functionCalls.push(part.functionCall);
        }
    }

    return this.buildResponse(textContent, functionCalls);
}

    /**
     * Build LLMResponse from text and function calls
     */
    private buildResponse(textContent: string, functionCalls: any[]): LLMResponse {
    // Filter out any function calls with undefined/invalid names
    const validCalls = functionCalls.filter(fc => {
        if (!fc || typeof fc.name !== 'string' || !fc.name.trim()) {
            const fcStr = fc ? JSON.stringify(fc) : 'undefined';
            console.warn('[GeminiLLMv2] Skipping invalid function call (no name):', fcStr.substring(0, 100));
            return false;
        }
        return true;
    });

    // Convert Gemini function calls to our command format
    const commands = validCalls.map(fc => ({
        method: fc.name,
        params: fc.args || {},
        explanation: `Native function call: ${fc.name}`
    }));

    // If we also have JSON text response, try to parse it
    if (textContent.trim()) {
        try {
            // Try to parse as our expected JSON format
            const parsed = this.parseResponse(textContent);
            if (parsed.commands.length > 0 || commands.length === 0) {
                // Use parsed commands if any, or if no native function calls
                return {
                    response: parsed.response || textContent,
                    commands: parsed.commands.length > 0 ? parsed.commands : commands
                };
            }
        } catch {
            // Fall through to use native function calls
        }
    }

    return {
        response: textContent || "Executing commands...",
        commands
    };
}
}

// Register as new provider (v2)
registerLLMProvider("gemini-v2", (config) => new GeminiLLMv2(config));
