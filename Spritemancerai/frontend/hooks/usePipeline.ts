"use client";

import { useState, useEffect, useCallback } from "react";
import { wsClient } from "@/lib/websocket";
import type { WSMessage, PipelineStage } from "@/lib/types";

interface LastUpdate {
    type: string;
    timestamp: number;
}

interface UsePipelineResult {
    isConnected: boolean;
    currentStage: number;
    stages: PipelineStage[];
    status: "idle" | "running" | "completed" | "failed";
    spritesheetUrl: string | null;
    frameUrls: string[];
    error: string | null;
    lastUpdate: LastUpdate | null;  // NEW: trigger for refetch
    connect: (projectId: string) => void;
    disconnect: () => void;
    cancel: () => void;
}

export function usePipeline(): UsePipelineResult {
    const [isConnected, setIsConnected] = useState(false);
    const [currentStage, setCurrentStage] = useState(0);
    const [stages, setStages] = useState<PipelineStage[]>([]);
    const [status, setStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
    const [spritesheetUrl, setSpritesheetUrl] = useState<string | null>(null);
    const [frameUrls, setFrameUrls] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<LastUpdate | null>(null);  // NEW


    const handleMessage = useCallback((message: WSMessage) => {
        switch (message.type) {
            case "connected":
                setIsConnected(true);
                setStatus("idle");
                break;

            case "stage_start":
                setStatus("running");
                setCurrentStage(message.stage || 0);
                setStages((prev) => {
                    const updated = [...prev];
                    const idx = updated.findIndex((s) => s.stage_number === message.stage);
                    if (idx >= 0) {
                        updated[idx] = { ...updated[idx], status: "running" };
                    } else {
                        updated.push({
                            stage_number: message.stage || 0,
                            stage_name: message.stage_name || "",
                            status: "running",
                        });
                    }
                    return updated;
                });
                break;

            case "stage_complete":
                setStages((prev) => {
                    const updated = [...prev];
                    const idx = updated.findIndex((s) => s.stage_number === message.stage);
                    if (idx >= 0) {
                        updated[idx] = {
                            ...updated[idx],
                            status: "completed",
                            result: message.data,
                        };
                    }
                    return updated;
                });
                break;

            case "stage_error":
                setError(message.error || "Unknown error");
                setStages((prev) => {
                    const updated = [...prev];
                    const idx = updated.findIndex((s) => s.stage_number === message.stage);
                    if (idx >= 0) {
                        updated[idx] = {
                            ...updated[idx],
                            status: "failed",
                            error: message.error,
                        };
                    }
                    return updated;
                });
                break;

            case "pipeline_complete":
                setStatus("completed");
                setSpritesheetUrl(message.spritesheet_url || null);
                setFrameUrls(message.frames || []);
                break;

            case "dna_extracted":
                // DNA was extracted, trigger refresh
                console.log("[Pipeline] DNA extracted:", message.dna?.archetype);
                // Trigger a refetch of project data in consuming components
                setLastUpdate({ type: "dna", timestamp: Date.now() });
                break;

            case "project_updated":
                // Generic project update, trigger refresh
                console.log("[Pipeline] Project updated:", message.update_type);
                setLastUpdate({ type: message.update_type || "general", timestamp: Date.now() });
                break;

            case "cancelled":
                setStatus("idle");
                break;
        }
    }, []);

    const connect = useCallback((projectId: string) => {
        setStages([]);
        setCurrentStage(0);
        setError(null);
        setSpritesheetUrl(null);
        setFrameUrls([]);
        wsClient.connect(projectId);
    }, []);

    const disconnect = useCallback(() => {
        wsClient.disconnect();
        setIsConnected(false);
    }, []);

    const cancel = useCallback(() => {
        wsClient.cancel();
    }, []);

    useEffect(() => {
        const unsubscribe = wsClient.subscribe(handleMessage);
        return () => {
            unsubscribe();
            wsClient.disconnect();
        };
    }, [handleMessage]);

    return {
        isConnected,
        currentStage,
        stages,
        status,
        spritesheetUrl,
        frameUrls,
        error,
        lastUpdate,
        connect,
        disconnect,
        cancel,
    };
}
