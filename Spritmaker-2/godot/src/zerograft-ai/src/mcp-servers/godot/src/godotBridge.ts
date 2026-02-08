/**
 * GodotBridge - TCP client for communicating with Godot's godot_bridge module
 * 
 * Uses raw TCP (net.Socket) since Godot's GodotBridge uses TCPServer, not WebSocket.
 */

import * as net from "net";

interface IPCMessage {
    id: string;
    type: "request" | "response" | "event";
    method?: string;
    params?: Record<string, unknown>;
    result?: unknown;
    error?: { code: number; message: string };
}

export class GodotBridge {
    private socket: net.Socket | null = null;
    private port: number = 9876;
    private host: string = "localhost";
    private pendingRequests: Map<string, { resolve: (value: unknown) => void; reject: (reason: Error) => void }> = new Map();
    private requestId: number = 0;
    private buffer: string = "";
    private connected: boolean = false;

    async connect(port: number = 9876, host: string = "localhost"): Promise<void> {
        this.port = port;
        this.host = host;

        return new Promise((resolve, reject) => {
            this.socket = new net.Socket();

            this.socket.on("connect", () => {
                console.error(`[GodotBridge] Connected to Godot on ${host}:${port}`);
                this.connected = true;
                resolve();
            });

            this.socket.on("error", (err) => {
                console.error(`[GodotBridge] Connection error:`, err.message);
                this.connected = false;
                reject(err);
            });

            this.socket.on("close", () => {
                console.error(`[GodotBridge] Connection closed`);
                this.connected = false;
            });

            this.socket.on("data", (data) => {
                this.buffer += data.toString();
                this.processBuffer();
            });

            this.socket.connect(port, host);
        });
    }

    private processBuffer() {
        // Try to parse JSON messages from buffer
        // Messages might be concatenated
        let startIdx = 0;
        for (let i = 0; i < this.buffer.length; i++) {
            if (this.buffer[i] === "\n" || this.buffer[i] === "}") {
                try {
                    const jsonStr = this.buffer.substring(startIdx, i + 1);
                    const msg = JSON.parse(jsonStr) as IPCMessage;
                    this.handleMessage(msg);
                    startIdx = i + 1;
                } catch {
                    // Not a complete JSON yet, continue
                }
            }
        }
        this.buffer = this.buffer.substring(startIdx);
    }

    private handleMessage(msg: IPCMessage) {
        console.error(`[GodotBridge] Received:`, JSON.stringify(msg));

        if (msg.type === "response" && msg.id && this.pendingRequests.has(msg.id)) {
            const { resolve, reject } = this.pendingRequests.get(msg.id)!;
            this.pendingRequests.delete(msg.id);

            if (msg.error) {
                reject(new Error(msg.error.message));
            } else {
                resolve(msg.result);
            }
        } else if (msg.type === "event") {
            // Handle events from Godot (scene changed, etc.)
            console.error(`[GodotBridge] Event: ${msg.method}`);
        }
    }

    isConnected(): boolean {
        return this.connected && this.socket !== null;
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
            this.connected = false;
        }
    }

    private async sendRequest(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
        if (!this.socket || !this.connected) {
            throw new Error("Not connected to Godot");
        }

        const id = `req_${++this.requestId}`;
        const message: IPCMessage = {
            id,
            type: "request",
            method,
            params,
        };

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });

            const jsonStr = JSON.stringify(message);
            this.socket!.write(jsonStr);
            console.error(`[GodotBridge] Sent: ${method}`);

            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error(`Request timed out: ${method}`));
                }
            }, 30000);
        });
    }

    // === Godot API Methods ===

    async getSceneTree(): Promise<unknown> {
        return this.sendRequest("get_scene_tree");
    }

    async createScene(path: string, rootType: string): Promise<unknown> {
        return this.sendRequest("create_scene", { path, root_type: rootType });
    }

    async addNode(parent: string, type: string, name: string): Promise<unknown> {
        return this.sendRequest("add_node", { parent, type, name });
    }

    async removeNode(path: string): Promise<unknown> {
        return this.sendRequest("remove_node", { path });
    }

    async createScript(path: string, content: string): Promise<unknown> {
        return this.sendRequest("create_script", { path, content });
    }

    async setProperty(node: string, property: string, value: unknown): Promise<unknown> {
        return this.sendRequest("set_property", { node, property, value });
    }

    async runGame(scene?: string): Promise<unknown> {
        return this.sendRequest("run_game", { scene });
    }

    async stopGame(): Promise<unknown> {
        return this.sendRequest("stop_game");
    }
}

// Simple test if run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule || process.argv[1]?.endsWith('godotBridge.ts')) {
    const bridge = new GodotBridge();
    console.log("Attempting to connect to Godot on localhost:9876...");
    bridge.connect(9876)
        .then(() => {
            console.log("Connected! Sending get_scene_tree...");
            return bridge.getSceneTree();
        })
        .then((result) => {
            console.log("Result:", result);
            bridge.disconnect();
        })
        .catch((err) => {
            console.error("Error:", err.message);
            process.exit(1);
        });
}
