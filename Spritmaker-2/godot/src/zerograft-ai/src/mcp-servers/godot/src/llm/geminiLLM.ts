/**
 * Gemini LLM Implementation
 * 
 * Implements the BaseLLM interface for Google's Gemini models.
 * Supports streaming, thinking/reasoning, and all Gemini 2.5+ features.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { BaseLLM, LLMConfig, LLMResponse, StreamCallbacks, registerLLMProvider } from "./baseLLM.js";
import { buildCompleteSystemPrompt } from "../prompts/index.js";

export class GeminiLLM extends BaseLLM {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor(config: LLMConfig) {
        super(config);
        this.genAI = new GoogleGenerativeAI(config.apiKey);
        this.model = this.genAI.getGenerativeModel({ model: this.modelName });
        console.log(`[GeminiLLM] Initialized with model: ${this.modelName}`);
    }

    protected getDefaultModel(): string {
        return "gemini-3-flash-preview";
    }

    getProviderName(): string {
        return "gemini";
    }

    supportsThinking(): boolean {
        // Gemini 2.5+ and 3.x models support thinking
        return this.modelName.includes("2.5") ||
            this.modelName.includes("gemini-3") ||
            this.modelName.includes("thinking");
    }

    async processCommand(userInput: string, context?: string): Promise<LLMResponse> {
        const prompt = context
            ? `Context: ${context}\n\nUser: ${userInput}`
            : `User: ${userInput}`;

        try {
            const systemPrompt = buildCompleteSystemPrompt();

            const chat = this.model.startChat({
                history: [
                    {
                        role: "user",
                        parts: [{ text: "You are an AI game development assistant. " + systemPrompt }],
                    },
                    {
                        role: "model",
                        parts: [{ text: '{"response": "I understand. I will ONLY respond with valid JSON containing response and commands fields. Ready to help with Godot game development.", "commands": []}' }],
                    },
                ],
            });

            const result = await chat.sendMessage(prompt);
            const responseText = result.response.text();

            return this.parseResponse(responseText);
        } catch (error) {
            console.error("[GeminiLLM] Error:", error);
            return {
                response: `Error: ${error instanceof Error ? error.message : String(error)}`,
                commands: [],
            };
        }
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

        try {
            // Configure model with thinking if supported
            let modelParams: any = { model: this.modelName };

            if (this.supportsThinking()) {
                const is25Model = this.modelName.includes("2.5");
                const is3Model = this.modelName.includes("gemini-3");

                if (is25Model || this.modelName.includes("thinking")) {
                    console.log(`[GeminiLLM] Enabling thinking mode (includeThoughts) for ${this.modelName}`);
                    modelParams.generationConfig = {
                        thinkingConfig: {
                            includeThoughts: true,
                            thinkingBudget: 4096
                        }
                    };
                } else if (is3Model) {
                    console.log(`[GeminiLLM] Enabling thinking mode (thinkingLevel) for ${this.modelName}`);
                    modelParams.generationConfig = {
                        thinkingConfig: {
                            thinkingLevel: "low",
                            includeThoughts: true
                        }
                    };
                }
            }

            const streamingModel = this.genAI.getGenerativeModel(modelParams);
            const systemPrompt = buildCompleteSystemPrompt();

            const chat = streamingModel.startChat({
                history: [
                    {
                        role: "user",
                        parts: [{ text: "You are an AI game development assistant. " + systemPrompt }],
                    },
                    {
                        role: "model",
                        parts: [{ text: '{"response": "I understand. I will ONLY respond with valid JSON containing response and commands fields. Ready to help with Godot game development.", "commands": []}' }],
                    },
                ],
            });

            // Build message parts - text and optionally images (array support)
            const messageParts: any[] = [{ text: prompt }];

            // Add images if provided (multimodal support for Gemini Vision)
            if (imageData && imageData.length > 0) {
                console.log(`[GeminiLLM] Adding ${imageData.length} image(s) to request`);
                for (const imgBase64 of imageData) {
                    messageParts.push({
                        inlineData: {
                            mimeType: "image/png",
                            data: imgBase64
                        }
                    });
                }
            }

            const result = await chat.sendMessageStream(messageParts);
            let fullText = "";

            for await (const chunk of result.stream) {
                // @ts-ignore
                const candidates = chunk.candidates || [];

                if (candidates.length > 0) {
                    // @ts-ignore
                    const parts = candidates[0].content?.parts || [];

                    for (const part of parts) {
                        // @ts-ignore - Check for thought field
                        if (part.thought === true) {
                            console.log(`[GeminiLLM] Thought: ${part.text?.substring(0, 100)}...`);
                            callbacks.onThinking?.(part.text || "");
                        }
                        // @ts-ignore
                        else if (part.thoughtSignature) {
                            console.log(`[GeminiLLM] thoughtSignature present`);
                        }
                        else if (part.text) {
                            fullText += part.text;
                            callbacks.onText?.(part.text);
                        }
                    }
                } else {
                    // Fallback for standard models
                    const chunkText = chunk.text();
                    fullText += chunkText;
                    callbacks.onText?.(chunkText);
                }
            }

            // Parse and return the final response
            console.log(`[GeminiLLM] Stream complete, fullText length: ${fullText.length}`);
            if (fullText.length === 0) {
                console.log(`[GeminiLLM] WARNING: No text received from model!`);
                // Provide a fallback response
                callbacks.onComplete?.({
                    response: "I apologize, but I didn't receive a proper response. Please try again.",
                    commands: []
                });
                return;
            }
            console.log(`[GeminiLLM] fullText preview: ${fullText.substring(0, 200)}...`);
            const response = this.parseResponse(fullText);
            callbacks.onComplete?.(response);

        } catch (error) {
            console.error(`[GeminiLLM] Stream error:`, error);
            callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
        }
    }
}

// Register Gemini as an LLM provider
registerLLMProvider("gemini", (config) => new GeminiLLM(config));
