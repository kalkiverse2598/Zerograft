/**
 * Godot Bridge - TCP connection and event handling for Godot editor
 * Extracted from aiRouter.ts for modularity
 */

import * as net from "net";

export interface GodotBridgeConfig {
    host: string;
    port: number;
}

export interface SceneContext {
    path: string;
    root_name: string;
    root_type: string;
}

export interface NodeInfo {
    name: string;
    type: string;
    path: string;
}

export interface ScriptContext {
    path: string;
    language: string;
}

/** Methods that involve filesystem I/O and may need extra time */
const SLOW_METHODS = new Set([
    'create_scene', 'save_scene', 'open_scene',
    'create_script', 'edit_script',
    'create_tileset_from_image',
    'scene_pack', 'scene_instantiate',
    'import_resource'
]);

const DEFAULT_BRIDGE_TIMEOUT_MS = 30_000;  // 30s for normal commands
const SLOW_BRIDGE_TIMEOUT_MS = 60_000;     // 60s for filesystem-heavy commands

export class GodotBridge {
    private socket: net.Socket | null = null;
    private pendingRequests: Map<string, (result: unknown) => void> = new Map();
    private requestId = 0;

    // Scene change awaiter for async scene loading
    private sceneChangeResolver: ((scene: SceneContext) => void) | null = null;

    // Auto-reconnection state
    private config: GodotBridgeConfig | null = null;
    private reconnectInterval: NodeJS.Timeout | null = null;
    private autoReconnect: boolean = true;

    // Editor context state
    public currentScene: SceneContext = { path: "", root_name: "", root_type: "" };
    public selectedNodes: NodeInfo[] = [];
    public currentScript: ScriptContext = { path: "", language: "" };
    public projectPath: string = "";
    public projectPathDetected: boolean = false;

    /**
     * Connect to Godot TCP bridge (with auto-reconnection)
     */
    async connect(config: GodotBridgeConfig): Promise<void> {
        this.config = config;
        await this.attemptConnect();
    }

    /**
     * Attempt a single connection
     */
    private async attemptConnect(): Promise<void> {
        if (!this.config) return;

        await new Promise<void>((resolve, reject) => {
            this.socket = new net.Socket();

            this.socket.on("connect", () => {
                console.log("[GodotBridge] ✅ Connected to Godot");
                this.stopReconnectTimer();
                resolve();
            });

            this.socket.on("data", (data) => {
                try {
                    const response = JSON.parse(data.toString());

                    // Handle events from GodotBridge
                    if (response.type === "event") {
                        this.handleEvent(response.event, response.data);
                        return;
                    }

                    // Handle responses
                    if (response.id && this.pendingRequests.has(response.id)) {
                        const callback = this.pendingRequests.get(response.id)!;
                        this.pendingRequests.delete(response.id);
                        callback(response.result);
                    }
                } catch {
                    // Ignore parse errors
                }
            });

            this.socket.on("error", (err) => {
                console.error("[GodotBridge] Connection error:", err.message);
                reject(err);
            });

            this.socket.on("close", () => {
                console.log("[GodotBridge] Connection closed");
                this.socket = null;
                this.startReconnectTimer();
            });

            this.socket.connect(this.config!.port, this.config!.host);
        });

        // Auto-fetch project path from Godot after connecting
        await this.fetchProjectPath();
    }

    /**
     * Start auto-reconnection timer
     */
    private startReconnectTimer(): void {
        if (!this.autoReconnect || this.reconnectInterval) return;

        console.log("[GodotBridge] 🔄 Will retry connection every 5 seconds...");
        this.reconnectInterval = setInterval(async () => {
            console.log("[GodotBridge] 🔄 Attempting to reconnect to Godot...");
            try {
                await this.attemptConnect();
            } catch {
                // Silently continue retrying
            }
        }, 5000);
    }

    /**
     * Stop auto-reconnection timer
     */
    private stopReconnectTimer(): void {
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }
    }

    /**
     * Disable auto-reconnection
     */
    disableAutoReconnect(): void {
        this.autoReconnect = false;
        this.stopReconnectTimer();
    }

    /**
     * Fetch project path from Godot
     */
    private async fetchProjectPath(): Promise<void> {
        try {
            console.log(`[GodotBridge] Fetching project path...`);
            const result = await this.send("get_project_path", {}) as { success?: boolean; path?: string };

            if (result.success && result.path) {
                this.projectPath = result.path;
                this.projectPathDetected = true;
                console.log(`[GodotBridge] 📂 Project path: ${this.projectPath}`);
            } else {
                console.error(`[GodotBridge] ❌ Could not detect project path`);
            }
        } catch (e) {
            console.error(`[GodotBridge] ❌ Failed to get project path: ${e}`);
        }
    }

    /**
     * Send command to Godot and wait for response
     */
    async send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
        if (!this.socket) {
            throw new Error("Not connected to Godot");
        }

        const id = `bridge_${++this.requestId}`;
        const message = JSON.stringify({ id, type: "request", method, params });
        const timeoutMs = SLOW_METHODS.has(method) ? SLOW_BRIDGE_TIMEOUT_MS : DEFAULT_BRIDGE_TIMEOUT_MS;

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, resolve);
            this.socket!.write(message);

            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error(`Timeout: ${method} (after ${timeoutMs / 1000}s)`));
                }
            }, timeoutMs);
        });
    }

    /**
     * Handle events from GodotBridge
     */
    private handleEvent(event: string, data: unknown): void {
        console.log(`[GodotBridge] Event: ${event}`, JSON.stringify(data).substring(0, 200));

        if (event === "selection_changed") {
            const eventData = data as { nodes: NodeInfo[]; count: number };
            this.selectedNodes = eventData.nodes || [];
            console.log(`[GodotBridge] Selection: ${this.selectedNodes.length} nodes`);
        } else if (event === "scene_changed") {
            this.currentScene = data as SceneContext;
            console.log(`[GodotBridge] Scene: ${this.currentScene.path}`);
            // Resolve any pending scene change wait
            if (this.sceneChangeResolver) {
                this.sceneChangeResolver(this.currentScene);
                this.sceneChangeResolver = null;
            }
        } else if (event === "script_opened") {
            this.currentScript = data as ScriptContext;
            console.log(`[GodotBridge] Script: ${this.currentScript.path}`);
        }
    }

    /**
     * Get current context string for LLM
     */
    getContextString(): string {
        let context = "";

        if (this.currentScene.path) {
            context += `Current scene: ${this.currentScene.root_name} (${this.currentScene.root_type}) at ${this.currentScene.path}\n`;
        }

        if (this.selectedNodes.length > 0) {
            const selected = this.selectedNodes.map(n => `${n.name}:${n.type}`).join(", ");
            context += `Selected nodes: ${selected}\n`;
        }

        if (this.currentScript.path) {
            context += `Open script: ${this.currentScript.path}\n`;
        }

        return context;
    }

    /**
     * Wait for scene to change (with timeout)
     * Used to ensure scene is fully loaded after open_scene/create_scene
     */
    async waitForSceneChange(expectedPath?: string, timeoutMs = 3000): Promise<SceneContext | null> {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.sceneChangeResolver = null;
                resolve(null);
            }, timeoutMs);

            this.sceneChangeResolver = (scene) => {
                clearTimeout(timeout);
                // Match if no expected path, or path matches (full or ending)
                if (!expectedPath || scene.path === expectedPath || scene.path.endsWith(expectedPath.replace('res://', ''))) {
                    resolve(scene);
                } else {
                    resolve(null);
                }
            };
        });
    }

    /**
     * Check if connected to Godot
     */
    isConnected(): boolean {
        return this.socket !== null;
    }
}
