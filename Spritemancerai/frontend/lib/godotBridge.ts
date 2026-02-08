/**
 * GodotBridge - TypeScript utility for communicating with the Godot engine
 * when the SpriteMancer pixel editor is embedded inside Godot via gdCEF.
 * 
 * Usage:
 *   import { godotBridge } from '@/lib/godotBridge';
 *   
 *   if (godotBridge.isAvailable()) {
 *     godotBridge.saveSprite(canvas, 'my_sprite.png');
 *   }
 */

declare global {
    interface Window {
        godot?: {
            js_save_sprite: (base64Data: string, filename: string) => boolean;
            js_export_spritesheet: (jsonData: string) => boolean;
            js_notify_ready: () => void;
            js_request_refresh: () => void;
            // IPC for sending events to Godot Agent
            send?: (eventName: string, data: string) => void;
        };
        GodotBridge?: {
            saveSprite: (base64Data: string, filename: string) => boolean;
            exportSpritesheet: (data: object) => boolean;
            notifyReady: () => void;
            refreshFilesystem: () => void;
            isAvailable: () => boolean;
        };
        onGodotBridgeReady?: () => void;
    }
}

// Agent command interface for commands from Godot
export interface AgentCommand {
    action: string;
    projectId?: string;
    animation?: string;
    view?: string;
}

export interface SpritesheetExportData {
    filename: string;
    imageData: string;
    frameCount: number;
    frameWidth: number;
    frameHeight: number;
    columns: number;
    rows: number;
    animations?: {
        name: string;
        frames: number[];
        loop: boolean;
        fps: number;
    }[];
}

class GodotBridgeClient {
    private readyCallbacks: (() => void)[] = [];
    private _isInGodot: boolean = false;

    constructor() {
        // Check if we're running inside Godot on load
        if (typeof window !== 'undefined') {
            this._isInGodot = this.checkGodotEnvironment();

            // Set up callback for when bridge is ready
            window.onGodotBridgeReady = () => {
                console.log('[GodotBridge] Bridge ready callback triggered');
                this._isInGodot = true;
                this.readyCallbacks.forEach(cb => cb());
                this.readyCallbacks = [];
            };
        }
    }

    /**
     * Check if we're running inside Godot's embedded browser
     */
    private checkGodotEnvironment(): boolean {
        if (typeof window === 'undefined') return false;

        // Check for Godot's injected objects
        return !!(window.godot || window.GodotBridge);
    }

    /**
     * Returns true if the Godot bridge is available (running inside Godot)
     */
    isAvailable(): boolean {
        if (typeof window === 'undefined') return false;

        // Use GodotBridge if available (injected by GDScript)
        if (window.GodotBridge?.isAvailable) {
            return window.GodotBridge.isAvailable();
        }

        // Fallback to checking window.godot
        return !!window.godot;
    }

    /**
     * Returns true if we're running inside Godot's embedded browser
     */
    isInGodot(): boolean {
        return this._isInGodot || this.isAvailable();
    }

    /**
     * Register a callback to be called when the bridge becomes ready
     */
    onReady(callback: () => void): void {
        if (this.isAvailable()) {
            callback();
        } else {
            this.readyCallbacks.push(callback);
        }
    }

    /**
     * Save a canvas as a PNG to Godot's res://sprites/ folder
     */
    saveCanvasAsSprite(canvas: HTMLCanvasElement, filename: string): boolean {
        if (!this.isAvailable()) {
            console.warn('[GodotBridge] Not available - cannot save sprite');
            return false;
        }

        try {
            // Get canvas data as base64 PNG
            const base64Data = canvas.toDataURL('image/png');

            // Use GodotBridge if available
            if (window.GodotBridge?.saveSprite) {
                return window.GodotBridge.saveSprite(base64Data, filename);
            }

            // Fallback to direct godot call
            if (window.godot?.js_save_sprite) {
                return window.godot.js_save_sprite(base64Data, filename);
            }

            return false;
        } catch (error) {
            console.error('[GodotBridge] Error saving sprite:', error);
            return false;
        }
    }

    /**
     * Save image data (base64) to Godot's res://sprites/ folder
     */
    saveSprite(base64Data: string, filename: string): boolean {
        if (!this.isAvailable()) {
            console.warn('[GodotBridge] Not available - cannot save sprite');
            return false;
        }

        try {
            // Use GodotBridge if available
            if (window.GodotBridge?.saveSprite) {
                return window.GodotBridge.saveSprite(base64Data, filename);
            }

            // Fallback to direct godot call
            if (window.godot?.js_save_sprite) {
                return window.godot.js_save_sprite(base64Data, filename);
            }

            return false;
        } catch (error) {
            console.error('[GodotBridge] Error saving sprite:', error);
            return false;
        }
    }

    /**
     * Export a spritesheet with animation data to Godot
     */
    exportSpritesheet(data: SpritesheetExportData): boolean {
        if (!this.isAvailable()) {
            console.warn('[GodotBridge] Not available - cannot export spritesheet');
            return false;
        }

        try {
            // Use GodotBridge if available
            if (window.GodotBridge?.exportSpritesheet) {
                return window.GodotBridge.exportSpritesheet(data);
            }

            // Fallback to direct godot call
            if (window.godot?.js_export_spritesheet) {
                return window.godot.js_export_spritesheet(JSON.stringify(data));
            }

            return false;
        } catch (error) {
            console.error('[GodotBridge] Error exporting spritesheet:', error);
            return false;
        }
    }

    /**
     * Request Godot to refresh its filesystem (after saving files)
     */
    refreshFilesystem(): void {
        if (!this.isAvailable()) return;

        try {
            if (window.GodotBridge?.refreshFilesystem) {
                window.GodotBridge.refreshFilesystem();
            } else if (window.godot?.js_request_refresh) {
                window.godot.js_request_refresh();
            }
        } catch (error) {
            console.error('[GodotBridge] Error refreshing filesystem:', error);
        }
    }

    /**
     * Notify Godot that the editor is ready
     */
    notifyReady(): void {
        if (!this.isAvailable()) return;

        try {
            if (window.GodotBridge?.notifyReady) {
                window.GodotBridge.notifyReady();
            } else if (window.godot?.js_notify_ready) {
                window.godot.js_notify_ready();
            }
        } catch (error) {
            console.error('[GodotBridge] Error notifying ready:', error);
        }
    }

    // ============ Agent IPC Methods ============

    /**
     * Send an event to the Godot Agent (for progress updates, errors, etc.)
     */
    sendToAgent(eventName: string, data: unknown): void {
        if (!this.isAvailable()) {
            console.log('[GodotBridge] Agent IPC not available (running outside Godot)');
            return;
        }

        try {
            if (window.godot?.send) {
                window.godot.send(eventName, JSON.stringify(data));
                console.log('[GodotBridge] Sent to agent:', eventName, data);
            }
        } catch (error) {
            console.error('[GodotBridge] Error sending to agent:', error);
        }
    }

    /**
     * Notify Godot Agent when animation generation is complete
     */
    notifyGenerationComplete(projectId: string, animation: string, success: boolean): void {
        this.sendToAgent('generation_complete', { projectId, animation, success });
    }

    /**
     * Notify Godot Agent when post-processing fails
     */
    notifyPostProcessFailed(projectId: string, animation: string, error: string): void {
        this.sendToAgent('postprocess_failed', { projectId, animation, error });
    }

    /**
     * Notify Godot Agent of progress updates
     */
    notifyProgress(projectId: string, step: string, percent: number): void {
        this.sendToAgent('progress', { projectId, step, percent });
    }

    /**
     * Initialize Agent command listener
     * Call this when your app initializes to handle commands from Godot
     */
    initAgentCommandListener(handlers: {
        onRetryPostProcess?: (projectId: string, animation: string) => void;
        onNavigate?: (view: string) => void;
        onLoadProject?: (projectId: string) => void;
    }): void {
        window.addEventListener('godot:command', ((event: CustomEvent<AgentCommand>) => {
            const { action, projectId, animation, view } = event.detail;
            console.log('[GodotBridge] Agent command:', action, event.detail);

            switch (action) {
                case 'retryPostProcess':
                    if (projectId && animation && handlers.onRetryPostProcess) {
                        handlers.onRetryPostProcess(projectId, animation);
                    }
                    break;
                case 'navigate':
                    if (view && handlers.onNavigate) {
                        handlers.onNavigate(view);
                    }
                    break;
                case 'loadProject':
                    if (projectId && handlers.onLoadProject) {
                        handlers.onLoadProject(projectId);
                    }
                    break;
                default:
                    console.warn('[GodotBridge] Unknown agent command:', action);
            }
        }) as EventListener);

        console.log('[GodotBridge] Agent command listener initialized');
    }
}

// Singleton instance
export const godotBridge = new GodotBridgeClient();

// Default export for convenience
export default godotBridge;
