"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface PipelineStage {
    stage: number;
    stage_name: string;
    status: "start" | "progress" | "complete" | "error";
    data?: Record<string, unknown>;
}

interface WebSocketMessage {
    type: string;
    project_id: string;
    stage?: number;
    stage_name?: string;
    data?: Record<string, unknown>;
    spritesheet_url?: string;
    frames?: string[];
    message?: string;
    animation_type?: string;
}

interface UsePipelineWebSocketResult {
    isConnected: boolean;
    currentStage: PipelineStage | null;
    stages: PipelineStage[];
    error: string | null;
    isComplete: boolean;
    spritesheetUrl: string | null;
    frameUrls: string[];
    animationType: string | null;
    connect: () => void;
    disconnect: () => void;
}

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export function usePipelineWebSocket(projectId: string): UsePipelineWebSocketResult {
    const [isConnected, setIsConnected] = useState(false);
    const [currentStage, setCurrentStage] = useState<PipelineStage | null>(null);
    const [stages, setStages] = useState<PipelineStage[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isComplete, setIsComplete] = useState(false);
    const [spritesheetUrl, setSpritesheetUrl] = useState<string | null>(null);
    const [frameUrls, setFrameUrls] = useState<string[]>([]);
    const [animationType, setAnimationType] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            return; // Already connected
        }

        const wsUrl = `${WS_BASE_URL}/ws/${projectId}`;
        console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("✅ WebSocket connected");
                setIsConnected(true);
                setError(null);
            };

            ws.onmessage = (event) => {
                try {
                    const message: WebSocketMessage = JSON.parse(event.data);
                    console.log("📨 WS Message:", message);

                    switch (message.type) {
                        case "connected":
                            // Initial connection confirmation
                            break;

                        case "stage_start":
                        case "stage_progress":
                        case "stage_complete":
                            const status = message.type.replace("stage_", "") as PipelineStage["status"];
                            const stage: PipelineStage = {
                                stage: message.stage || 0,
                                stage_name: message.stage_name || "Unknown",
                                status,
                                data: message.data,
                            };
                            setCurrentStage(stage);

                            // Auto-navigate to the appropriate stage page on stage_start
                            if (message.type === "stage_start") {
                                // Reset completion state for new pipeline run
                                setIsComplete(false);
                                setAnimationType(null);

                                const STAGE_PAGE_MAP: Record<number, string> = {
                                    1: 'dna-lab',
                                    3: 'director-booth',
                                    5: 'storyboard',
                                    6: 'preview',
                                    7: 'preview'
                                };
                                const pagePath = STAGE_PAGE_MAP[message.stage || 0];
                                if (pagePath && typeof window !== 'undefined') {
                                    const targetUrl = `/projects/${projectId}/${pagePath}`;
                                    // Only navigate if we're not already on this page
                                    if (!window.location.pathname.endsWith(pagePath)) {
                                        console.log(`🔄 Auto-navigating to ${targetUrl}`);
                                        window.location.href = targetUrl;
                                    }
                                }
                            }

                            if (status === "complete") {
                                setStages((prev) => {
                                    // Update or add the stage
                                    const existing = prev.findIndex((s) => s.stage === stage.stage);
                                    if (existing >= 0) {
                                        const updated = [...prev];
                                        updated[existing] = stage;
                                        return updated;
                                    }
                                    return [...prev, stage];
                                });
                            }
                            break;

                        case "stage_error":
                            setError(message.data?.message as string || "Pipeline error");
                            setCurrentStage({
                                stage: message.stage || 0,
                                stage_name: message.stage_name || "Error",
                                status: "error",
                                data: message.data,
                            });
                            break;

                        case "pipeline_complete":
                            setIsComplete(true);
                            setSpritesheetUrl(message.spritesheet_url || null);
                            setFrameUrls(message.frames || []);
                            setAnimationType(message.animation_type || null);
                            break;

                        case "cancelled":
                            setError("Pipeline cancelled");
                            break;
                    }
                } catch (e) {
                    console.error("Failed to parse WebSocket message:", e);
                }
            };

            ws.onerror = (event) => {
                console.error("❌ WebSocket error:", event);
                setError("WebSocket connection error");
            };

            ws.onclose = () => {
                console.log("🔌 WebSocket disconnected");
                setIsConnected(false);
            };
        } catch (e) {
            console.error("Failed to create WebSocket:", e);
            setError("Failed to connect to WebSocket");
        }
    }, [projectId]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setIsConnected(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    // Reset state when project changes
    useEffect(() => {
        setStages([]);
        setCurrentStage(null);
        setError(null);
        setIsComplete(false);
        setSpritesheetUrl(null);
        setFrameUrls([]);
        setAnimationType(null);
    }, [projectId]);

    return {
        isConnected,
        currentStage,
        stages,
        error,
        isComplete,
        spritesheetUrl,
        frameUrls,
        animationType,
        connect,
        disconnect,
    };
}
