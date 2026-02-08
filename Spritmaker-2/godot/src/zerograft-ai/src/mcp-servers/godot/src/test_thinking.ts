
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

async function testThinking() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No API Key found");
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // verification: using the thinking model name
    /*
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-thinking-exp-1219" });

    console.log("Starting chat with gemini-2.0-flash-thinking-exp-1219...");
    
    const chat = model.startChat();
    const result = await chat.sendMessageStream("Explain how A* pathfinding works. Show your thinking process.");

    console.log("\n--- Stream Start ---\n");

    for await (const chunk of result.stream) {
        // Log the raw chunk structure to see where "thoughts" are hidden
        console.log("Chunk raw:", JSON.stringify(chunk, null, 2));
        console.log("Chunk text:", chunk.text());
        console.log("------------------------------------------------");
    }

    console.log("\n--- Stream End ---\n");
    */

    // List models
    console.log("Listing available models...");
    // Note: listModels is not directly on GoogleGenerativeAI instance in the node SDK usually, 
    // but let's try to infer or use the correct API to list models.
    // Actually the node SDK doesn't have a simple listModels helper on the main class easily accessible without headers.
    // Let's just try the standard 'gemini-2.0-flash-thinking-exp' without the date suffix

    const modelName = "gemini-2.5-flash";
    console.log(`Trying model: ${modelName}`);

    // Enable thinking if possible
    const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
            // @ts-ignore
            thinkingConfig: {
                include_thoughts: true,
                thinking_budget: 1024
            }
        }
    });

    try {
        console.log("Asking: 'Explain A* pathfinding. Think step by step.'");
        const result = await model.generateContentStream("Explain A* pathfinding. Think step by step.");

        let fullText = "";
        for await (const chunk of result.stream) {
            console.log("\n--- Chunk ---");
            // @ts-ignore
            const candidates = chunk.candidates || [];
            if (candidates.length > 0) {
                // @ts-ignore
                const parts = candidates[0].content?.parts || [];
                for (const part of parts) {
                    // @ts-ignore
                    if (part.thought) {
                        console.log("THOUGHT:", part.text);
                    } else if (part.text) {
                        console.log("TEXT:", part.text);
                        fullText += part.text;
                    }
                }
            } else {
                console.log("Text:", chunk.text());
                fullText += chunk.text();
            }
        }
        console.log("\n\nFull Text:", fullText);
        console.log("Success!");
    } catch (e) {
        console.error("Error:", (e as Error).message);
    }
}

testThinking().catch(console.error);
