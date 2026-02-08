/**
 * AI Router - Connects Gemini LLM to GodotBridge
 * 
 * REFACTORED: This is now a slim orchestrator (~350 lines vs ~1490)
 * Logic extracted to:
 *   - bridges/godotBridge.ts - TCP connection
 *   - handlers/spritemancerHandler.ts - SpriteMancer commands
 *   - handlers/agenticToolHandler.ts - Agentic tools
 *   - callbacks/agenticCallbackFactory.ts - Unified callbacks
 *   - tools/toolRegistry.ts - Tool routing
 */

import "dotenv/config";
import * as http from "http";
import { WebSocketServer, WebSocket } from "ws";

// Core modules - Using v2 with native function calling (not legacy prompt-based)
import { GeminiLLMv2 as GeminiLLM } from "./llm/geminiLLMv2.js";
import { SpriteMancerClient } from "./spritemancerClient.js";
import { AgenticRouter } from "./agentic/index.js";

// Extracted modules
import { GodotBridge } from "./bridges/godotBridge.js";
import { SpriteMancerHandler } from "./handlers/spritemancerHandler.js";
import { AgenticToolHandler } from "./handlers/agenticToolHandler.js";
import { createAgenticCallbacks } from "./callbacks/agenticCallbackFactory.js";
import { getToolCategory, isFileModifyingTool } from "./tools/toolRegistry.js";

// Load config from environment
const GODOT_HOST = process.env.GODOT_BRIDGE_HOST || "localhost";
const GODOT_PORT = parseInt(process.env.GODOT_BRIDGE_PORT || "9876");
const HTTP_PORT = parseInt(process.env.AI_ROUTER_PORT || "9877");
const WS_PORT = parseInt(process.env.AI_ROUTER_WS_PORT || "9878");
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
// VPS proxy for demo/submission (handles API key server-side)
const GEMINI_PROXY_URL = process.env.GEMINI_PROXY_URL || "https://gemini.zerograft.online";

class AIRouter {
    private llm: GeminiLLM;
    private bridge: GodotBridge;
    private spritemancerClient: SpriteMancerClient;
    private spritemancerHandler: SpriteMancerHandler;
    private agenticToolHandler: AgenticToolHandler;

    private wsServer: WebSocketServer | null = null;
    private wsSessions: Map<WebSocket, AgenticRouter> = new Map();
    private pendingApprovals: Map<string, boolean> = new Map();
    private pendingAnswers: Map<string, string> = new Map();

    // Agentic mode state
    private agenticMode: boolean = false;
    private agenticRouter: AgenticRouter | null = null;

    constructor(apiKey: string, modelName: string) {
        this.bridge = new GodotBridge();

        // Create LLM with context provider that reads actual editor state
        this.llm = new GeminiLLM({ apiKey, modelName, baseUrl: GEMINI_PROXY_URL }, () => ({
            cwd: "res://",
            hasSpriteMancer: true,
            selectedNodes: this.bridge.selectedNodes.map(n => n.name),
            currentScene: this.bridge.currentScene.path || undefined,
            currentScript: this.bridge.currentScript.path || undefined,
            isGameRunning: false
        }));

        this.spritemancerClient = new SpriteMancerClient();

        // Initialize handlers with dependencies
        this.spritemancerHandler = new SpriteMancerHandler({
            client: this.spritemancerClient,
            getProjectPath: () => this.bridge.projectPath,
            isProjectPathDetected: () => this.bridge.projectPathDetected,
            sendToGodot: (m, p) => this.bridge.send(m, p)
        });

        this.agenticToolHandler = new AgenticToolHandler({
            sendToGodot: (m, p) => this.bridge.send(m, p),
            spritemancer: this.spritemancerClient
        });
    }

    // Helper to create LLM with current context provider
    private createLLMWithContext(modelName: string): GeminiLLM {
        return new GeminiLLM({ apiKey: process.env.GEMINI_API_KEY!, modelName, baseUrl: GEMINI_PROXY_URL }, () => ({
            cwd: "res://",
            hasSpriteMancer: true,
            selectedNodes: this.bridge.selectedNodes.map(n => n.name),
            currentScene: this.bridge.currentScene.path || undefined,
            currentScript: this.bridge.currentScript.path || undefined,
            isGameRunning: false
        }));
    }

    // ============================================
    // Tool Execution - Unified Router
    // ============================================

    private async executeTool(name: string, params: Record<string, unknown>): Promise<unknown> {
        console.log(`[AIRouter] 🔧 Executing: ${name}`);

        const category = getToolCategory(name);
        let result: unknown;

        switch (category) {
            case "spritemancer":
                result = await this.spritemancerHandler.handle(name, params);
                break;

            case "agentic":
                result = await this.agenticToolHandler.handle(name, params);
                break;

            case "godot":
            default:
                result = await this.bridge.send(name, params);
                break;
        }

        // Wait for scene to load after scene-loading tools
        if ((name === "open_scene" || name === "create_scene") && (result as { success?: boolean })?.success !== false) {
            const expectedPath = params.path as string;
            console.log(`[AIRouter] ⏳ Waiting for scene load: ${expectedPath}`);
            const sceneLoaded = await this.bridge.waitForSceneChange(expectedPath);
            if (sceneLoaded) {
                console.log(`[AIRouter] ✅ Scene loaded: ${sceneLoaded.path}`);
                (result as Record<string, unknown>).scene_ready = true;
            } else {
                console.log(`[AIRouter] ⚠️ Scene load timeout, continuing anyway`);
            }
        }

        return result;
    }

    // ============================================
    // Agentic Mode
    // ============================================

    enableAgenticMode(): void {
        if (this.agenticRouter) return;

        console.log("[AIRouter] 🤖 Agentic mode ENABLED");
        this.agenticMode = true;

        const callbacks = createAgenticCallbacks({
            executeTool: (n, p) => this.executeTool(n, p),
            getLLM: () => this.llm,  // Changed to getter so model changes propagate
            getSystemPrompt: () => this.bridge.getContextString(),
            pendingApprovals: this.pendingApprovals,
            pendingAnswers: this.pendingAnswers
        });

        this.agenticRouter = new AgenticRouter(callbacks, { enabled: true });
    }

    disableAgenticMode(): void {
        console.log("[AIRouter] Agentic mode DISABLED");
        this.agenticMode = false;
        this.agenticRouter = null;
    }

    // ============================================
    // Connection
    // ============================================

    async connectToGodot(): Promise<void> {
        await this.bridge.connect({ host: GODOT_HOST, port: GODOT_PORT });
    }

    // ============================================
    // User Input Processing
    // ============================================

    async processUserInput(input: string): Promise<{ response: string; results: unknown[] }> {
        console.log(`[AIRouter] Processing: "${input}"`);

        // Get current scene context
        let context = this.bridge.getContextString();
        try {
            const sceneTree = await this.bridge.send("get_scene_tree", {});
            context += `Scene tree: ${JSON.stringify(sceneTree)}`;
        } catch {
            context += "No scene currently open";
        }

        // Get LLM response
        const llmResponse = await this.llm.processCommand(input, context);
        console.log(`[AIRouter] Commands: ${JSON.stringify(llmResponse.commands)}`);

        // Execute commands
        const results: unknown[] = [];
        for (const cmd of llmResponse.commands) {
            try {
                const result = await this.executeTool(cmd.method, cmd.params);
                results.push({
                    method: cmd.method,
                    success: true,
                    result,
                    isFileChange: isFileModifyingTool(cmd.method)
                });
            } catch (error) {
                results.push({
                    method: cmd.method,
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    isFileChange: isFileModifyingTool(cmd.method)
                });
            }
        }

        return { response: llmResponse.response, results };
    }

    // ============================================
    // HTTP Server
    // ============================================

    startHttpServer(): void {
        const server = http.createServer(async (req, res) => {
            // CORS headers
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type");

            if (req.method === "OPTIONS") {
                res.writeHead(200);
                res.end();
                return;
            }

            if (req.method === "POST" && req.url === "/chat") {
                let body = "";
                req.on("data", (chunk) => body += chunk.toString());

                req.on("end", async () => {
                    try {
                        const { message, model } = JSON.parse(body);

                        if (model && model !== GEMINI_MODEL) {
                            console.log(`[AIRouter] Using model: ${model}`);
                            this.llm = this.createLLMWithContext(model);
                        }

                        const result = await this.processUserInput(message);
                        res.writeHead(200, { "Content-Type": "application/json" });
                        res.end(JSON.stringify(result));
                    } catch (error) {
                        res.writeHead(500, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
                    }
                });
            } else if (req.method === "GET" && req.url === "/health") {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    status: "ok",
                    godot_connected: this.bridge.isConnected(),
                    model: GEMINI_MODEL,
                    agentic_mode: this.agenticMode
                }));
            } else {
                res.writeHead(404);
                res.end("Not found");
            }
        });

        server.listen(HTTP_PORT, () => {
            console.log(`[AIRouter] HTTP server: http://localhost:${HTTP_PORT}`);
        });
    }

    // ============================================
    // WebSocket Server
    // ============================================

    startWebSocketServer(): void {
        this.wsServer = new WebSocketServer({ port: WS_PORT });

        this.wsServer.on("connection", (ws: WebSocket) => {
            console.log("[AIRouter] WebSocket client connected");

            // Create session-specific AgenticRouter
            const sessionRouter = this.createSessionAgenticRouter(ws);
            this.wsSessions.set(ws, sessionRouter);

            ws.on("message", async (data: Buffer) => {
                try {
                    await this.handleWebSocketMessage(ws, data);
                } catch (error) {
                    ws.send(JSON.stringify({
                        type: "error",
                        message: error instanceof Error ? error.message : String(error)
                    }));
                }
            });

            ws.on("close", () => {
                console.log("[AIRouter] WebSocket client disconnected");
                this.wsSessions.delete(ws);
            });
        });

        console.log(`[AIRouter] WebSocket server: ws://localhost:${WS_PORT}`);
    }

    private async handleWebSocketMessage(ws: WebSocket, data: Buffer): Promise<void> {
        const parsed = JSON.parse(data.toString());
        const { message, model, type: msgType, answer, context_key } = parsed;

        // Update model if different
        if (model && model !== GEMINI_MODEL) {
            console.log(`[AIRouter] WS using model: ${model}`);
            this.llm = this.createLLMWithContext(model);
        }

        const router = this.wsSessions.get(ws);
        if (!router) {
            ws.send(JSON.stringify({ type: "error", message: "Session not found" }));
            return;
        }

        // Handle control messages
        switch (msgType) {
            case "toggle_agentic": {
                const enable = parsed.enable !== false;
                if (enable) this.enableAgenticMode();
                else this.disableAgenticMode();

                // Also enable/disable multi-agent mode
                if (this.agenticRouter) {
                    this.agenticRouter.setMultiAgentEnabled(enable);
                    console.log(`[AIRouter] Multi-agent mode: ${enable ? 'enabled' : 'disabled'}`);
                }

                ws.send(JSON.stringify({ type: "agentic_mode", enabled: this.agenticMode }));
                return;
            }

            case "new_session":
                console.log(`[AIRouter] Starting new session`);
                router.clearHistory();
                ws.send(JSON.stringify({ type: "session_cleared", success: true }));
                return;

            case "continue":
                if (answer && context_key) {
                    console.log(`[AIRouter] Resuming with answer for ${context_key}`);
                    await router.resumeWithAnswer(answer, context_key);
                }
                return;

            case "approval_response": {
                const { approved: approvedRaw, tool_id } = parsed;
                if (!tool_id || typeof tool_id !== "string") {
                    console.warn("[AIRouter] Ignoring approval_response with invalid tool_id", parsed);
                    return;
                }

                const approved =
                    approvedRaw === true ||
                    approvedRaw === "true" ||
                    approvedRaw === 1 ||
                    approvedRaw === "1";

                if (
                    approvedRaw !== true &&
                    approvedRaw !== false &&
                    approvedRaw !== "true" &&
                    approvedRaw !== "false" &&
                    approvedRaw !== 1 &&
                    approvedRaw !== 0 &&
                    approvedRaw !== "1" &&
                    approvedRaw !== "0"
                ) {
                    console.warn(`[AIRouter] Unexpected approval value for ${tool_id}:`, approvedRaw);
                }

                console.log(`[AIRouter] Approval for ${tool_id}: ${approved} (raw=${JSON.stringify(approvedRaw)})`);
                this.pendingApprovals.set(tool_id, approved);

                // Always acknowledge the approval to dismiss the UI dialog,
                // even if the task already moved on (late approval)
                ws.send(JSON.stringify({
                    type: "approval_acknowledged",
                    tool_id,
                    approved,
                    message: approved ? "Approved" : "Rejected"
                }));
                return;
            }

            case "answer_response": {
                const { question_id, answer: userAnswer } = parsed;
                console.log(`[AIRouter] Answer for ${question_id}: ${userAnswer}`);
                this.pendingAnswers.set(question_id, userAnswer);
                return;
            }

            case "cancel":
                console.log(`[AIRouter] ⏹️ Cancel requested`);
                router.cancel();
                ws.send(JSON.stringify({ type: "cancelled", message: "Task cancelled" }));
                return;
        }

        // Default: Start new task
        ws.send(JSON.stringify({ type: "thinking", time: 0 }));

        // Handle image_data - can be single string or array of strings (multi-image support)
        const rawImageData = parsed.image_data as string | string[] | undefined;
        let imageData: string[] | undefined;
        if (rawImageData) {
            imageData = Array.isArray(rawImageData) ? rawImageData : [rawImageData];
            console.log(`[AIRouter] Received ${imageData.length} image(s) (total ${imageData.reduce((a, b) => a + b.length, 0)} chars)`);
        }

        console.log(`[AIRouter] Starting task: "${message.substring(0, 50)}..."`);
        await router.startTask(message, imageData);
    }

    private createSessionAgenticRouter(ws: WebSocket): AgenticRouter {
        const callbacks = createAgenticCallbacks({
            executeTool: (n, p) => this.executeTool(n, p),
            getLLM: () => this.llm,  // Changed to getter so model changes propagate
            getSystemPrompt: () => this.bridge.getContextString(),
            pendingApprovals: this.pendingApprovals,
            pendingAnswers: this.pendingAnswers
        }, ws);

        return new AgenticRouter(callbacks, { enabled: true });
    }
}

// ============================================
// Process-level crash guards
// ============================================
process.on('unhandledRejection', (reason) => {
    console.error('[AIRouter] ⚠️ Unhandled promise rejection (caught, not crashing):', reason);
});
process.on('uncaughtException', (error) => {
    console.error('[AIRouter] ⚠️ Uncaught exception (caught, not crashing):', error.message);
});

// ============================================
// Main Entry Point
// ============================================

async function main() {
    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        if (GEMINI_PROXY_URL && GEMINI_PROXY_URL.includes("zerograft.online")) {
            // VPS proxy handles API key - use placeholder
            apiKey = "proxy-managed";
            console.log("[AIRouter] Using VPS proxy - API key managed server-side");
        } else {
            console.error("Error: Set GEMINI_API_KEY environment variable");
            process.exit(1);
        }
    } else {
        console.log(`[AIRouter] Using own API key (direct Google API)`);
    }

    if (GEMINI_PROXY_URL) {
        console.log(`[AIRouter] Proxy: ${GEMINI_PROXY_URL}`);
    }
    console.log(`[AIRouter] Using model: ${GEMINI_MODEL}`);
    const router = new AIRouter(apiKey, GEMINI_MODEL);

    // Try to connect to Godot, but don't crash if unavailable
    try {
        await router.connectToGodot();
        console.log("[AIRouter] ✅ Connected to Godot");
    } catch {
        console.warn("[AIRouter] ⚠️ Godot not available - running in standalone mode");
        console.warn("[AIRouter] LLM API will work, but Godot commands won't execute");
    }

    router.enableAgenticMode();
    router.startHttpServer();
    router.startWebSocketServer();

    console.log("\n=== AI Router Ready ===");
    console.log(`HTTP: POST http://localhost:${HTTP_PORT}/chat`);
    console.log(`WebSocket: ws://localhost:${WS_PORT} (streaming)`);
}

main().catch(console.error);
