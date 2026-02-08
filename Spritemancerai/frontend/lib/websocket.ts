/**
 * SpriteMancer AI - WebSocket Client
 * Real-time pipeline progress connection
 */

import type { WSMessage } from "./types";

type WSCallback = (message: WSMessage) => void;

class WebSocketClient {
    private ws: WebSocket | null = null;
    private projectId: string | null = null;
    private callbacks: Set<WSCallback> = new Set();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;

    private get wsUrl(): string {
        const baseUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
        return `${baseUrl}/ws/${this.projectId}`;
    }

    connect(projectId: string): void {
        if (this.ws?.readyState === WebSocket.OPEN && this.projectId === projectId) {
            return; // Already connected to same project
        }

        this.disconnect();
        this.projectId = projectId;
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
            console.log(`[WS] Connected to project ${projectId}`);
            this.reconnectAttempts = 0;
        };

        this.ws.onmessage = (event) => {
            try {
                const message: WSMessage = JSON.parse(event.data);
                this.callbacks.forEach((cb) => cb(message));
            } catch (error) {
                console.error("[WS] Failed to parse message:", error);
            }
        };

        this.ws.onclose = () => {
            console.log("[WS] Connection closed");
            this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
            console.error("[WS] Error:", error);
        };
    }

    disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.projectId = null;
        this.reconnectAttempts = 0;
    }

    private attemptReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts || !this.projectId) {
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

        setTimeout(() => {
            if (this.projectId) {
                this.connect(this.projectId);
            }
        }, delay);
    }

    subscribe(callback: WSCallback): () => void {
        this.callbacks.add(callback);
        return () => this.callbacks.delete(callback);
    }

    send(message: Record<string, unknown>): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn("[WS] Cannot send - connection not open");
        }
    }

    cancel(): void {
        this.send({ type: "cancel" });
    }

    get isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}

// Singleton instance
export const wsClient = new WebSocketClient();
export default wsClient;
