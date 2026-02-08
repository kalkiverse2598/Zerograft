"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useParams } from "next/navigation";

interface PipelineProgress {
    stage: number;
    stageName: string;
    percent: number;
    status: "idle" | "running" | "complete" | "error";
}

const STAGE_NAMES = [
    "Upload Reference",
    "DNA Extraction",
    "Action Validation",
    "Script Generation",
    "Biomechanics",
    "Image Generation",
    "Frame Extraction",
    "Post-processing"
];

export default function ProjectPage() {
    const params = useParams();
    const id = params.id as string;

    const [progress, setProgress] = useState<PipelineProgress>({
        stage: 0,
        stageName: "Idle",
        percent: 0,
        status: "idle"
    });
    const [wsConnected, setWsConnected] = useState(false);

    useEffect(() => {
        if (!id) return;

        // Connect to WebSocket for real-time progress updates
        const wsUrl = `ws://localhost:8000/ws/${id}`;
        let ws: WebSocket | null = null;
        let reconnectTimer: NodeJS.Timeout | null = null;

        const connect = () => {
            try {
                ws = new WebSocket(wsUrl);

                ws.onopen = () => {
                    console.log(`[Pipeline WS] Connected to ${id}`);
                    setWsConnected(true);
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        console.log("[Pipeline WS] Message:", data);

                        switch (data.type) {
                            case "connected":
                                console.log("[Pipeline WS] Ready for updates");
                                break;
                            case "stage_start":
                                setProgress({
                                    stage: data.stage,
                                    stageName: data.stage_name || STAGE_NAMES[data.stage - 1] || `Stage ${data.stage}`,
                                    percent: 0,
                                    status: "running"
                                });
                                // Auto-navigate to the appropriate stage page
                                const STAGE_PAGE_MAP: Record<number, string> = {
                                    1: 'dna-lab',
                                    3: 'director-booth',
                                    5: 'storyboard',
                                    6: 'preview',
                                    7: 'preview'
                                };
                                const pagePath = STAGE_PAGE_MAP[data.stage];
                                if (pagePath) {
                                    const targetUrl = `/projects/${id}/${pagePath}`;
                                    // Only navigate if we're not already on this page
                                    if (!window.location.pathname.endsWith(pagePath)) {
                                        console.log(`[Pipeline WS] Navigating to ${targetUrl}`);
                                        window.location.href = targetUrl;
                                    }
                                }
                                break;
                            case "stage_progress":
                                setProgress(prev => ({
                                    ...prev,
                                    percent: data.data?.percent || prev.percent,
                                    stageName: data.stage_name || prev.stageName
                                }));
                                break;
                            case "stage_complete":
                                setProgress(prev => ({
                                    ...prev,
                                    percent: 100,
                                    status: "running"
                                }));
                                break;
                            case "stage_error":
                                setProgress(prev => ({
                                    ...prev,
                                    status: "error"
                                }));
                                break;
                            case "pipeline_complete":
                                setProgress({
                                    stage: 8,
                                    stageName: "Complete",
                                    percent: 100,
                                    status: "complete"
                                });
                                break;
                        }
                    } catch (e) {
                        console.error("[Pipeline WS] Parse error:", e);
                    }
                };

                ws.onclose = () => {
                    console.log("[Pipeline WS] Disconnected, reconnecting in 3s...");
                    setWsConnected(false);
                    reconnectTimer = setTimeout(connect, 3000);
                };

                ws.onerror = (err) => {
                    console.error("[Pipeline WS] Error:", err);
                };
            } catch (e) {
                console.error("[Pipeline WS] Connection error:", e);
                reconnectTimer = setTimeout(connect, 3000);
            }
        };

        connect();

        return () => {
            if (ws) ws.close();
            if (reconnectTimer) clearTimeout(reconnectTimer);
        };
    }, [id]);

    const stages = [
        { name: "DNA Lab", href: `/projects/${id}/dna-lab`, icon: "🧬", desc: "Extract & edit character DNA" },
        { name: "Director Booth", href: `/projects/${id}/director-booth`, icon: "🎬", desc: "Define action & difficulty" },
        { name: "Storyboard", href: `/projects/${id}/storyboard`, icon: "📋", desc: "Review animation script" },
        { name: "Preview", href: `/projects/${id}/preview`, icon: "▶️", desc: "Play & export sprites" },
        { name: "Repair", href: `/projects/${id}/repair`, icon: "🔧", desc: "Fix individual frames" },
    ];

    return (
        <div className="min-h-screen bg-zinc-950">
            <header className="border-b border-zinc-800">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/projects" className="text-zinc-400 hover:text-zinc-300">
                            ← Back
                        </Link>
                        <h1 className="text-xl font-semibold">Project: {id?.substring(0, 8)}...</h1>
                        {wsConnected && (
                            <span className="text-xs text-green-500 flex items-center gap-1">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                Live
                            </span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <Button variant="secondary">Settings</Button>
                        <Button>Generate Sprite</Button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-12">
                {/* Pipeline Progress */}
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>Pipeline Progress</span>
                            {progress.status === "running" && (
                                <span className="text-sm font-normal text-violet-400 animate-pulse">
                                    Processing...
                                </span>
                            )}
                            {progress.status === "complete" && (
                                <span className="text-sm font-normal text-green-400">
                                    ✓ Complete
                                </span>
                            )}
                            {progress.status === "error" && (
                                <span className="text-sm font-normal text-red-400">
                                    ✗ Error
                                </span>
                            )}
                        </CardTitle>
                        <CardDescription>
                            {progress.status === "idle"
                                ? "Waiting for pipeline to start..."
                                : `${progress.stageName} ${progress.percent > 0 ? `(${progress.percent}%)` : ""}`
                            }
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            {STAGE_NAMES.map((_, index) => (
                                <div key={index} className="flex-1">
                                    <div
                                        className={`h-2 rounded-full transition-colors duration-300 ${index + 1 < progress.stage
                                            ? "bg-violet-600"
                                            : index + 1 === progress.stage
                                                ? progress.status === "error"
                                                    ? "bg-red-500"
                                                    : "bg-violet-500 animate-pulse"
                                                : "bg-zinc-700"
                                            }`}
                                    />
                                </div>
                            ))}
                        </div>
                        <p className="text-sm text-zinc-400 mt-3">
                            Stage {Math.max(progress.stage, 1)} of 8: {progress.stageName}
                        </p>
                    </CardContent>
                </Card>

                {/* Stage Navigation */}
                <h2 className="text-xl font-semibold mb-6">Workflow Stages</h2>
                <div className="grid md:grid-cols-5 gap-4">
                    {stages.map((stage) => (
                        <Link key={stage.name} href={stage.href}>
                            <Card className="hover:border-violet-600/50 transition-colors cursor-pointer h-full text-center">
                                <CardContent className="pt-6">
                                    <div className="text-4xl mb-3">{stage.icon}</div>
                                    <h3 className="font-semibold text-zinc-100 mb-1">{stage.name}</h3>
                                    <p className="text-xs text-zinc-500">{stage.desc}</p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            </main>
        </div>
    );
}
