"use client";

import { useState, useEffect, use } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { usePipelineWebSocket } from "@/hooks/usePipelineWebSocket";
import type { AnimationFrame, AnimationScript, DifficultyTier, Perspective, GenerationMode } from "@/lib/types";

interface StoryboardPageProps {
    params: Promise<{ id: string }>;
}

const phaseColors: Record<string, string> = {
    Anticipation: "bg-yellow-600/20 text-yellow-300 border-yellow-600/50",
    Contact: "bg-red-600/20 text-red-300 border-red-600/50",
    Recovery: "bg-blue-600/20 text-blue-300 border-blue-600/50",
    Idle: "bg-zinc-600/20 text-zinc-300 border-zinc-600/50",
    "Follow-through": "bg-purple-600/20 text-purple-300 border-purple-600/50",
    Startup: "bg-green-600/20 text-green-300 border-green-600/50",
};

const PHASES = ["Anticipation", "Startup", "Contact", "Follow-through", "Recovery", "Idle"];

interface PipelineStage {
    stage: number;
    name: string;
    status: "pending" | "running" | "completed" | "error";
}

export default function StoryboardPage({ params }: StoryboardPageProps) {
    const { id } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();

    // Get action config from URL params (passed from Director Booth)
    const actionFromUrl = searchParams.get("action");
    const tierFromUrl = searchParams.get("tier") as DifficultyTier | null;
    const perspectiveFromUrl = searchParams.get("perspective") as Perspective | null;
    const modeFromUrl = (searchParams.get("mode") as GenerationMode) || "single";
    const responderActionFromUrl = searchParams.get("responder_action");

    // Dual mode state
    const [generationMode, setGenerationMode] = useState<GenerationMode>(modeFromUrl);
    const [activeScriptTab, setActiveScriptTab] = useState<"instigator" | "responder">("instigator");

    // Instigator script
    const [script, setScript] = useState<AnimationScript | null>(null);
    // Responder script (for dual mode)
    const [responderScript, setResponderScript] = useState<AnimationScript | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isGeneratingScript, setIsGeneratingScript] = useState(false);
    const [isGeneratingSprites, setIsGeneratingSprites] = useState(false);
    const [selectedFrame, setSelectedFrame] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<string>("");

    // Script Editing State
    const [isEditing, setIsEditing] = useState(false);
    const [editedFrames, setEditedFrames] = useState<AnimationFrame[]>([]);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Pipeline Progress State
    const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([
        { stage: 1, name: "DNA Extraction", status: "pending" },
        { stage: 3, name: "Frame Budget", status: "pending" },
        { stage: 4, name: "Intent Mirroring", status: "pending" },
        { stage: 5, name: "Biomech Scripting", status: "pending" },
    ]);
    const [spriteStages, setSpriteStages] = useState<PipelineStage[]>([
        { stage: 6, name: "Image Generation", status: "pending" },
        { stage: 7, name: "Post-Processing", status: "pending" },
    ]);
    const [currentStage, setCurrentStage] = useState<number | null>(null);


    // WebSocket for real-time pipeline updates
    const {
        isConnected: wsConnected,
        currentStage: wsCurrentStage,
        stages: wsStages,
        error: wsError,
        isComplete: wsComplete,
        connect: wsConnect,
        disconnect: wsDisconnect,
    } = usePipelineWebSocket(id);

    // Auto-connect WebSocket on mount to receive updates from external triggers (MCP agent)
    useEffect(() => {
        wsConnect();
        return () => wsDisconnect();
    }, [wsConnect, wsDisconnect]);

    // Sync WebSocket updates to local state
    useEffect(() => {
        if (wsCurrentStage) {
            setCurrentStage(wsCurrentStage.stage);
            const stageName = wsCurrentStage.stage_name;
            setProgress(`${stageName}...`);

            // Map WebSocket status to local status
            const statusMap: Record<string, PipelineStage["status"]> = {
                start: "running",
                progress: "running",
                complete: "completed",
                error: "error",
            };
            const localStatus = statusMap[wsCurrentStage.status] || "running";

            // Update appropriate stage array
            if (wsCurrentStage.stage <= 5) {
                setPipelineStages((prev) =>
                    prev.map((s) =>
                        s.stage === wsCurrentStage.stage ? { ...s, status: localStatus } : s
                    )
                );
            } else {
                setSpriteStages((prev) =>
                    prev.map((s) =>
                        s.stage === wsCurrentStage.stage ? { ...s, status: localStatus } : s
                    )
                );
            }
        }
    }, [wsCurrentStage]);

    // Handle WebSocket errors
    useEffect(() => {
        if (wsError) {
            setError(wsError);
        }
    }, [wsError]);

    // Auto-detect generation mode from project data (for when revising without URL params)
    useEffect(() => {
        const detectMode = async () => {
            if (modeFromUrl === "dual") return; // Already set from URL

            try {
                const api = (await import("@/lib/api")).api;
                const project = await api.getProject(id);
                const projectData = project as {
                    generation_mode?: GenerationMode;
                    responder_reference_url?: string;
                    responder_dna?: unknown;
                };
                if (projectData.generation_mode === "dual" || projectData.responder_reference_url || projectData.responder_dna) {
                    setGenerationMode("dual");
                }
            } catch (error) {
                console.error("Failed to detect project mode:", error);
            }
        };
        detectMode();
    }, [id, modeFromUrl]);

    // Try to fetch existing script on mount
    useEffect(() => {
        const fetchScript = async () => {
            try {
                const api = (await import("@/lib/api")).api;

                if (generationMode === "dual") {
                    // Dual mode - fetch both scripts from dual status endpoint
                    const status = await api.getDualPipelineStatus(id);
                    if (status.instigator_script) {
                        setScript(status.instigator_script);
                        setEditedFrames(status.instigator_script.frames || []);
                    }
                    if (status.responder_script) {
                        setResponderScript(status.responder_script);
                    }
                } else {
                    // Single mode - existing flow
                    const data = await api.getAnimationScript(id);
                    setScript(data);
                    setEditedFrames(data.frames || []);
                }
            } catch (err) {
                // Script not found - that's expected if not generated yet
                console.log("No script found yet - ready to generate");
            } finally {
                setIsLoading(false);
            }
        };
        fetchScript();
    }, [id, generationMode]);

    // Update pipeline stage status
    const updateStageStatus = (stage: number, status: PipelineStage["status"]) => {
        setPipelineStages(prev =>
            prev.map(s => s.stage === stage ? { ...s, status } : s)
        );
    };

    const updateSpriteStageStatus = (stage: number, status: PipelineStage["status"]) => {
        setSpriteStages(prev =>
            prev.map(s => s.stage === stage ? { ...s, status } : s)
        );
    };

    const handleGenerateScript = async () => {
        const action = actionFromUrl || "Idle";
        const tier = tierFromUrl || "LIGHT";
        const perspective = perspectiveFromUrl || "side";

        setIsGeneratingScript(true);
        setError(null);
        setProgress("Connecting...");

        // Reset stages
        setPipelineStages(prev => prev.map(s => ({ ...s, status: "pending" as const })));

        // Connect WebSocket for real-time updates
        wsConnect();

        try {
            const api = (await import("@/lib/api")).api;

            if (generationMode === "dual") {
                // Dual mode - generate scripts for both characters
                setProgress("Generating dual character scripts...");

                // First generate dual script (stages 1-4)
                const dualResult = await api.generateDualScript(id, action, tier, perspective);

                if (dualResult.status === "awaiting_responder_selection") {
                    // If we have responder action from URL, confirm it
                    if (responderActionFromUrl) {
                        setProgress("Confirming responder action...");
                        const confirmResult = await api.confirmResponderAction(id, responderActionFromUrl);

                        if (confirmResult.status === "scripts_ready") {
                            setScript(confirmResult.instigator_script);
                            setResponderScript(confirmResult.responder_script);
                            setEditedFrames(confirmResult.instigator_script.frames || []);
                            setProgress("");
                            setCurrentStage(null);
                        }
                    } else {
                        // No responder action - redirect back to director booth
                        setError("Responder action not selected. Please go back to Director Booth.");
                        setProgress("");
                    }
                }
            } else {
                // Single mode - existing flow
                setProgress("Generating animation script...");
                const result = await api.generateScript(id, action, tier, perspective);

                // WebSocket will update stage statuses in real-time
                // When complete, update script
                if (result.status === "script_ready") {
                    setScript(result.animation_script);
                    setEditedFrames(result.animation_script.frames || []);
                    setProgress("");
                    setCurrentStage(null);
                }
            }
        } catch (err) {
            console.error("Script generation failed:", err);
            setError(err instanceof Error ? err.message : "Script generation failed");
            setProgress("");
        } finally {
            setIsGeneratingScript(false);
            wsDisconnect();
        }
    };

    const handleGenerateSprites = async () => {
        const action = script?.action_type || actionFromUrl || "Idle";
        const tier = (script?.difficulty_tier || tierFromUrl || "LIGHT") as DifficultyTier;
        const perspective = perspectiveFromUrl || "side";

        setIsGeneratingSprites(true);
        setError(null);
        setProgress("Connecting...");

        // Reset sprite stages
        setSpriteStages(prev => prev.map(s => ({ ...s, status: "pending" as const })));

        // Connect WebSocket for real-time updates
        wsConnect();

        try {
            const api = (await import("@/lib/api")).api;
            setProgress("Generating sprites with AI...");

            if (generationMode === "dual") {
                // Dual mode - generate sprites for both characters
                setProgress("Generating dual character sprites...");
                const result = await api.generateDualSprites(id, action, tier, perspective);

                if (result.status === "completed") {
                    setProgress("Complete! Redirecting to preview...");
                    setCurrentStage(null);
                    await new Promise(r => setTimeout(r, 500));
                    router.push(`/projects/${id}/preview?mode=dual`);
                }
            } else {
                // Single mode - existing flow
                const result = await api.generateSprites(id, action, tier, perspective);

                // WebSocket updates stages in real-time
                if (result.status === "completed") {
                    setProgress("Complete! Redirecting to preview...");
                    setCurrentStage(null);
                    await new Promise(r => setTimeout(r, 500));
                    router.push(`/projects/${id}/preview`);
                }
            }
        } catch (err) {
            console.error("Sprite generation failed:", err);
            setError(err instanceof Error ? err.message : "Sprite generation failed");
            setProgress("");
        } finally {
            setIsGeneratingSprites(false);
            wsDisconnect();
        }
    };


    // Script Editing Handlers
    const handleFrameEdit = (index: number, field: keyof AnimationFrame, value: string) => {
        const newFrames = [...editedFrames];
        newFrames[index] = { ...newFrames[index], [field]: value };
        setEditedFrames(newFrames);
        setHasUnsavedChanges(true);
    };

    const handleMoveFrame = (index: number, direction: "up" | "down") => {
        const newIndex = direction === "up" ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= editedFrames.length) return;

        const newFrames = [...editedFrames];
        [newFrames[index], newFrames[newIndex]] = [newFrames[newIndex], newFrames[index]];
        // Update frame indices
        newFrames.forEach((f, i) => f.frame_index = i);
        setEditedFrames(newFrames);
        setSelectedFrame(newIndex);
        setHasUnsavedChanges(true);
    };

    const handleDeleteFrame = (index: number) => {
        if (editedFrames.length <= 2) {
            alert("Animation must have at least 2 frames");
            return;
        }
        const newFrames = editedFrames.filter((_, i) => i !== index);
        newFrames.forEach((f, i) => f.frame_index = i);
        setEditedFrames(newFrames);
        setSelectedFrame(null);
        setHasUnsavedChanges(true);
    };

    const handleSaveScript = async () => {
        try {
            const api = (await import("@/lib/api")).api;
            await api.updateScript(id, { frames: editedFrames });
            setScript(prev => prev ? { ...prev, frames: editedFrames } : null);
            setHasUnsavedChanges(false);
            setIsEditing(false);
        } catch (err) {
            console.error("Failed to save script:", err);
            alert("Failed to save script changes");
        }
    };

    const handleCancelEdit = () => {
        setEditedFrames(script?.frames || []);
        setHasUnsavedChanges(false);
        setIsEditing(false);
    };

    // Progress percentage for the progress bar
    const getProgressPercentage = () => {
        if (isGeneratingScript) {
            const completed = pipelineStages.filter(s => s.status === "completed").length;
            return (completed / pipelineStages.length) * 100;
        }
        if (isGeneratingSprites) {
            const completed = spriteStages.filter(s => s.status === "completed").length;
            return (completed / spriteStages.length) * 100;
        }
        return 0;
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    // If no script exists yet, show the generate script prompt
    if (!script) {
        return (
            <div className="min-h-screen bg-zinc-950">
                <header className="border-b border-zinc-800">
                    <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
                        <Link href={`/projects/${id}/director-booth`} className="text-zinc-400 hover:text-zinc-300">
                            ← Back
                        </Link>
                        <h1 className="text-xl font-semibold">📋 Storyboard</h1>
                    </div>
                </header>
                <main className="max-w-7xl mx-auto px-6 py-12">
                    <Card className="max-w-lg mx-auto">
                        <CardContent className="pt-6 text-center">
                            {error && (
                                <div className="mb-6 p-4 bg-red-600/20 border border-red-600/50 rounded-lg text-red-300 text-left">
                                    {error}
                                </div>
                            )}

                            <div className="text-6xl mb-4">📝</div>
                            <h2 className="text-xl font-semibold mb-2">
                                {actionFromUrl ? `Generate "${actionFromUrl}" Script` : "Ready to Generate Script"}
                            </h2>
                            <p className="text-zinc-400 mb-2">
                                {actionFromUrl
                                    ? `${tierFromUrl} tier, ${perspectiveFromUrl} view`
                                    : "Go to Director Booth to configure the animation first."
                                }
                            </p>
                            <p className="text-sm text-zinc-500 mb-4">
                                This will generate the frame-by-frame animation breakdown for your review.
                            </p>

                            {/* Pipeline Progress */}
                            {isGeneratingScript && (
                                <div className="my-6 space-y-4">
                                    <Progress value={getProgressPercentage()} className="h-2" />
                                    <div className="grid grid-cols-4 gap-2 text-xs">
                                        {pipelineStages.map((stage) => (
                                            <div
                                                key={stage.stage}
                                                className={`p-2 rounded-lg border transition-all ${stage.status === "completed"
                                                    ? "bg-green-600/20 border-green-600/50 text-green-300"
                                                    : stage.status === "running"
                                                        ? "bg-violet-600/20 border-violet-600/50 text-violet-300 animate-pulse"
                                                        : stage.status === "error"
                                                            ? "bg-red-600/20 border-red-600/50 text-red-300"
                                                            : "bg-zinc-800 border-zinc-700 text-zinc-500"
                                                    }`}
                                            >
                                                <div className="font-medium truncate">{stage.name}</div>
                                                <div className="text-[10px] opacity-70">
                                                    {stage.status === "completed" && "✓"}
                                                    {stage.status === "running" && "..."}
                                                    {stage.status === "error" && "✗"}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {progress && (
                                        <div className="text-sm text-violet-300 flex items-center justify-center gap-2">
                                            <div className="animate-spin w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full" />
                                            {progress}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="mt-6 space-y-3">
                                {actionFromUrl ? (
                                    <Button
                                        onClick={handleGenerateScript}
                                        disabled={isGeneratingScript}
                                        className="w-full"
                                        size="lg"
                                    >
                                        {isGeneratingScript ? "Generating Script..." : "📝 Generate Animation Script"}
                                    </Button>
                                ) : (
                                    <Link href={`/projects/${id}/director-booth`}>
                                        <Button className="w-full">Go to Director Booth →</Button>
                                    </Link>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </main>
            </div>
        );
    }

    // Script exists - show the animation breakdown with editing and "Generate Sprites" button
    const frames = isEditing ? editedFrames : script.frames;

    return (
        <div className="min-h-screen bg-zinc-950">
            <header className="border-b border-zinc-800">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={`/projects/${id}/director-booth`} className="text-zinc-400 hover:text-zinc-300">
                            ← Back
                        </Link>
                        <h1 className="text-xl font-semibold">📋 Animation Script</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-zinc-400">
                            {script.action_type} • {script.difficulty_tier} • {frames.length} frames
                        </span>
                        {!isEditing ? (
                            <Button variant="ghost" onClick={() => setIsEditing(true)}>
                                ✏️ Edit Script
                            </Button>
                        ) : (
                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={handleCancelEdit}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSaveScript} disabled={!hasUnsavedChanges}>
                                    💾 Save Changes
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {error && (
                    <div className="mb-6 p-4 bg-red-600/20 border border-red-600/50 rounded-lg text-red-300">
                        {error}
                    </div>
                )}

                {/* Progress UI for sprite generation */}
                {isGeneratingSprites && (
                    <div className="mb-6 p-4 bg-zinc-900 border border-zinc-700 rounded-xl">
                        <Progress value={getProgressPercentage()} className="h-2 mb-4" />
                        <div className="grid grid-cols-2 gap-4">
                            {spriteStages.map((stage) => (
                                <div
                                    key={stage.stage}
                                    className={`p-3 rounded-lg border transition-all ${stage.status === "completed"
                                        ? "bg-green-600/20 border-green-600/50 text-green-300"
                                        : stage.status === "running"
                                            ? "bg-violet-600/20 border-violet-600/50 text-violet-300 animate-pulse"
                                            : stage.status === "error"
                                                ? "bg-red-600/20 border-red-600/50 text-red-300"
                                                : "bg-zinc-800 border-zinc-700 text-zinc-500"
                                        }`}
                                >
                                    <div className="font-medium">{stage.name}</div>
                                    <div className="text-xs opacity-70 mt-1">
                                        {stage.status === "completed" && "✓ Complete"}
                                        {stage.status === "running" && "⏳ Processing..."}
                                        {stage.status === "error" && "✗ Failed"}
                                        {stage.status === "pending" && "Waiting..."}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {progress && (
                            <div className="mt-4 text-sm text-violet-300 flex items-center justify-center gap-2">
                                <div className="animate-spin w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full" />
                                {progress}
                            </div>
                        )}
                    </div>
                )}

                {/* Dual Mode Tab Selector */}
                {generationMode === "dual" && responderScript && (
                    <div className="mb-6 flex gap-2">
                        <Button
                            variant={activeScriptTab === "instigator" ? "primary" : "secondary"}
                            onClick={() => setActiveScriptTab("instigator")}
                            className="flex-1"
                        >
                            ⚔️ Instigator Script
                        </Button>
                        <Button
                            variant={activeScriptTab === "responder" ? "primary" : "secondary"}
                            onClick={() => setActiveScriptTab("responder")}
                            className="flex-1"
                        >
                            🛡️ Responder Script
                        </Button>
                    </div>
                )}

                {/* Physics Reasoning */}
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>Biomechanical Reasoning</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-zinc-300 leading-relaxed">
                            {activeScriptTab === "responder" && responderScript
                                ? responderScript.physics_reasoning
                                : script.physics_reasoning}
                        </p>
                    </CardContent>
                </Card>

                {/* Frame Timeline */}
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>Animation Frames ({frames.length})</CardTitle>
                        <CardDescription>
                            {isEditing
                                ? "Edit frame descriptions, reorder, or delete frames"
                                : "Review the frame breakdown before generating sprites"
                            }
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {/* Phase Legend */}
                        <div className="flex flex-wrap gap-2 mb-6 text-sm">
                            {Object.entries(phaseColors).map(([phase, classes]) => (
                                <span key={phase} className={`px-3 py-1 rounded-full border ${classes}`}>
                                    {phase}
                                </span>
                            ))}
                        </div>

                        {/* Timeline */}
                        <div className="flex gap-2 mb-8 overflow-x-auto pb-4">
                            {frames.map((frame, index) => (
                                <button
                                    key={index}
                                    onClick={() => setSelectedFrame(index)}
                                    className={`flex-shrink-0 w-24 p-3 rounded-xl border transition-all ${selectedFrame === index
                                        ? "border-violet-500 bg-violet-500/10 scale-105"
                                        : "border-zinc-700 hover:border-zinc-600 bg-zinc-900"
                                        }`}
                                >
                                    <div className="text-2xl font-bold text-center mb-2">
                                        {index + 1}
                                    </div>
                                    <div className={`text-xs px-2 py-0.5 rounded-full text-center ${phaseColors[frame.phase] || phaseColors.Idle}`}>
                                        {frame.phase}
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Frame Detail / Editor */}
                        {selectedFrame !== null && frames[selectedFrame] && (
                            <div className="p-6 bg-zinc-900 rounded-xl border border-zinc-800">
                                {isEditing ? (
                                    <div className="space-y-4">
                                        {/* Edit Controls */}
                                        <div className="flex justify-between items-center">
                                            <span className="text-lg font-semibold">Frame {selectedFrame + 1}</span>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleMoveFrame(selectedFrame, "up")}
                                                    disabled={selectedFrame === 0}
                                                >
                                                    ↑ Move Up
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleMoveFrame(selectedFrame, "down")}
                                                    disabled={selectedFrame === frames.length - 1}
                                                >
                                                    ↓ Move Down
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="danger"
                                                    onClick={() => handleDeleteFrame(selectedFrame)}
                                                >
                                                    🗑️ Delete
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Phase Selector */}
                                        <div>
                                            <label className="text-sm text-zinc-400 block mb-2">Phase</label>
                                            <select
                                                value={editedFrames[selectedFrame]?.phase || "Idle"}
                                                onChange={(e) => handleFrameEdit(selectedFrame, "phase", e.target.value)}
                                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white"
                                            >
                                                {PHASES.map((phase) => (
                                                    <option key={phase} value={phase}>{phase}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Pose Description */}
                                        <div>
                                            <label className="text-sm text-zinc-400 block mb-2">Pose Description</label>
                                            <textarea
                                                value={editedFrames[selectedFrame]?.pose_description || ""}
                                                onChange={(e) => handleFrameEdit(selectedFrame, "pose_description", e.target.value)}
                                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white min-h-[100px] resize-y"
                                                placeholder="Describe the character's pose..."
                                            />
                                        </div>

                                        {/* Visual Focus */}
                                        <div>
                                            <label className="text-sm text-zinc-400 block mb-2">Visual Focus</label>
                                            <textarea
                                                value={editedFrames[selectedFrame]?.visual_focus || ""}
                                                onChange={(e) => handleFrameEdit(selectedFrame, "visual_focus", e.target.value)}
                                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white min-h-[80px] resize-y"
                                                placeholder="What should draw the viewer's eye..."
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div>
                                            <h4 className="text-sm text-zinc-400 mb-2">Pose Description</h4>
                                            <p className="text-zinc-100">
                                                {frames[selectedFrame].pose_description}
                                            </p>
                                        </div>
                                        <div>
                                            <h4 className="text-sm text-zinc-400 mb-2">Visual Focus</h4>
                                            <p className="text-zinc-100">
                                                {frames[selectedFrame].visual_focus}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {selectedFrame === null && (
                            <div className="text-center py-8 text-zinc-500">
                                Click a frame above to view {isEditing ? "and edit " : ""}its details
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Generate Sprites Button */}
                {!isEditing && (
                    <Card className="bg-gradient-to-r from-violet-900/20 to-purple-900/20 border-violet-600/30">
                        <CardContent className="pt-6">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-semibold mb-1">Ready to Generate Sprites?</h3>
                                    <p className="text-sm text-zinc-400">
                                        Once you're happy with the animation script, generate the actual sprite images.
                                    </p>
                                </div>
                                <Button
                                    onClick={handleGenerateSprites}
                                    disabled={isGeneratingSprites}
                                    size="lg"
                                    className="whitespace-nowrap"
                                >
                                    {isGeneratingSprites ? "Generating..." : "🎨 Generate Sprites"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Unsaved Changes Warning */}
                {hasUnsavedChanges && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-yellow-600/90 text-yellow-100 px-6 py-3 rounded-full shadow-lg flex items-center gap-3">
                        <span>⚠️ You have unsaved changes</span>
                        <Button size="sm" onClick={handleSaveScript}>
                            Save Now
                        </Button>
                    </div>
                )}
            </main>
        </div>
    );
}
