"use client";

import { useState, useEffect, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MaskDrawer } from "@/components/MaskDrawer";
import type { GenerationMode } from "@/lib/types";

interface RepairPageProps {
    params: Promise<{ id: string }>;
}

export default function RepairPage({ params }: RepairPageProps) {
    const { id } = use(params);
    const searchParams = useSearchParams();
    const modeFromUrl = (searchParams.get("mode") as GenerationMode) || "single";

    // Dual mode state - auto-detect from project data
    const [generationMode, setGenerationMode] = useState<GenerationMode>(modeFromUrl);
    const [activeCharacter, setActiveCharacter] = useState<"instigator" | "responder">("instigator");

    // Instigator frames
    const [frames, setFrames] = useState<string[]>([]);
    // Responder frames (for dual mode)
    const [responderFrames, setResponderFrames] = useState<string[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [selectedFrame, setSelectedFrame] = useState<number | null>(null);
    const [repairInstruction, setRepairInstruction] = useState("");
    const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
    const [isRepairing, setIsRepairing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Get current frames based on active character
    const currentFrames = activeCharacter === "responder" && responderFrames.length > 0 
        ? responderFrames 
        : frames;

    // Fetch frames from API - auto-detect dual mode from project data
    useEffect(() => {
        const fetchFrames = async () => {
            try {
                const api = (await import("@/lib/api")).api;
                const data = await api.getFrames(id);
                setFrames(data.frame_urls || []);

                // Always try to fetch dual status to auto-detect dual mode
                try {
                    const dualStatus = await api.getDualPipelineStatus(id);
                    
                    // Auto-detect dual mode if responder data exists
                    if (dualStatus.is_dual || dualStatus.has_responder_frames || dualStatus.responder_frame_urls?.length) {
                        setGenerationMode("dual");
                    }
                    
                    if (dualStatus.responder_frame_urls) {
                        setResponderFrames(dualStatus.responder_frame_urls);
                    }
                } catch (err) {
                    console.log("No responder frames found");
                }
            } catch (err) {
                console.log("No frames found yet");
            } finally {
                setIsLoading(false);
            }
        };
        fetchFrames();
    }, [id]);

    // Reset mask when frame changes
    useEffect(() => {
        setMaskDataUrl(null);
    }, [selectedFrame]);

    const handleMaskComplete = (dataUrl: string) => {
        // Extract base64 data from data URL
        const base64Data = dataUrl.split(",")[1];
        setMaskDataUrl(base64Data);
    };

    const handleRepair = async () => {
        if (selectedFrame === null || !repairInstruction.trim()) return;

        setIsRepairing(true);
        setError(null);
        setSuccess(null);

        try {
            const api = (await import("@/lib/api")).api;
            const result = await api.repairFrame(
                id,
                selectedFrame,
                repairInstruction,
                maskDataUrl || undefined, // Pass mask if available
                activeCharacter // Pass which character is being repaired
            );

            // Update the correct frame array based on active character
            if (activeCharacter === "responder") {
                setResponderFrames((prev) => {
                    const updated = [...prev];
                    updated[selectedFrame] = result.new_url;
                    return updated;
                });
            } else {
                setFrames((prev) => {
                    const updated = [...prev];
                    updated[selectedFrame] = result.new_url;
                    return updated;
                });
            }

            const charLabel = activeCharacter === "responder" ? "Responder" : "Instigator";
            setSuccess(`${charLabel} Frame ${selectedFrame + 1} repaired successfully!`);
            setRepairInstruction("");
            setMaskDataUrl(null);
        } catch (err) {
            console.error("Repair failed:", err);
            setError(err instanceof Error ? err.message : "Repair failed");
        } finally {
            setIsRepairing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (frames.length === 0) {
        return (
            <div className="min-h-screen bg-zinc-950">
                <header className="border-b border-zinc-800">
                    <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
                        <Link href={`/projects/${id}`} className="text-zinc-400 hover:text-zinc-300">
                            ← Back
                        </Link>
                        <h1 className="text-xl font-semibold">🔧 Repair</h1>
                    </div>
                </header>
                <main className="max-w-7xl mx-auto px-6 py-12">
                    <Card className="max-w-lg mx-auto">
                        <CardContent className="pt-6 text-center">
                            <div className="text-6xl mb-4">🔧</div>
                            <h2 className="text-xl font-semibold mb-2">No Frames to Repair</h2>
                            <p className="text-zinc-400 mb-6">
                                Generate sprites first, then come back to fix any issues.
                            </p>
                            <Link href={`/projects/${id}/storyboard`}>
                                <Button>Go to Storyboard →</Button>
                            </Link>
                        </CardContent>
                    </Card>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950">
            <header className="border-b border-zinc-800">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={`/projects/${id}/preview${generationMode === "dual" ? "?mode=dual" : ""}`} className="text-zinc-400 hover:text-zinc-300">
                            ← Back to Preview
                        </Link>
                        <h1 className="text-xl font-semibold">🔧 Repair</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-12">
                {error && (
                    <div className="mb-6 p-4 bg-red-600/20 border border-red-600/50 rounded-lg text-red-300">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="mb-6 p-4 bg-green-600/20 border border-green-600/50 rounded-lg text-green-300">
                        {success}
                    </div>
                )}

                {/* Dual Mode Character Selector */}
                {generationMode === "dual" && responderFrames.length > 0 && (
                    <div className="mb-6 flex gap-2">
                        <Button
                            variant={activeCharacter === "instigator" ? "primary" : "secondary"}
                            onClick={() => { setActiveCharacter("instigator"); setSelectedFrame(null); }}
                            className="flex-1"
                        >
                            ⚔️ Instigator ({frames.length} frames)
                        </Button>
                        <Button
                            variant={activeCharacter === "responder" ? "primary" : "secondary"}
                            onClick={() => { setActiveCharacter("responder"); setSelectedFrame(null); }}
                            className="flex-1"
                        >
                            🛡️ Responder ({responderFrames.length} frames)
                        </Button>
                    </div>
                )}

                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Frame Selection */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Select Frame to Repair</CardTitle>
                            <CardDescription>
                                {generationMode === "dual" 
                                    ? `Click a ${activeCharacter} frame that needs fixing`
                                    : "Click a frame that needs fixing"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-4 gap-3">
                                {currentFrames.map((url, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setSelectedFrame(index)}
                                        className={`aspect-square bg-zinc-900 rounded-lg border overflow-hidden transition-all ${selectedFrame === index
                                            ? "border-violet-500 ring-2 ring-violet-500/50"
                                            : "border-zinc-700 hover:border-zinc-600"
                                            }`}
                                    >
                                        <img
                                            src={url}
                                            alt={`Frame ${index + 1}`}
                                            className="w-full h-full object-contain"
                                            style={{ imageRendering: "pixelated" }}
                                        />
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Repair Panel */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Repair Instructions</CardTitle>
                            <CardDescription>
                                {selectedFrame !== null
                                    ? `Repairing Frame ${selectedFrame + 1}`
                                    : "Select a frame to repair"}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {selectedFrame !== null ? (
                                <div className="space-y-6">
                                    {/* Mask Drawing Area */}
                                    <div>
                                        <label className="text-sm text-zinc-400 block mb-2">
                                            Step 1: Paint the area to fix (optional)
                                        </label>
                                        <MaskDrawer
                                            imageUrl={currentFrames[selectedFrame]}
                                            onMaskComplete={handleMaskComplete}
                                        />
                                        {maskDataUrl && (
                                            <p className="text-xs text-green-400 mt-2">
                                                ✓ Mask applied - only painted area will be repaired
                                            </p>
                                        )}
                                    </div>

                                    {/* Instruction Input */}
                                    <div>
                                        <label className="text-sm text-zinc-400 block mb-2">
                                            Step 2: Describe what to fix
                                        </label>
                                        <textarea
                                            value={repairInstruction}
                                            onChange={(e) => setRepairInstruction(e.target.value)}
                                            placeholder="e.g., Fix the sword angle, remove the artifact, correct the arm position..."
                                            className="w-full px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500 min-h-[80px] resize-none"
                                        />
                                    </div>

                                    {/* Repair Button */}
                                    <Button
                                        onClick={handleRepair}
                                        isLoading={isRepairing}
                                        disabled={!repairInstruction.trim()}
                                        className="w-full"
                                    >
                                        {isRepairing ? "Repairing..." : `🔧 Repair ${maskDataUrl ? "Masked Area" : "Full Frame"}`}
                                    </Button>

                                    {!maskDataUrl && (
                                        <p className="text-xs text-yellow-500">
                                            ⚠️ No mask drawn - the entire frame will be regenerated.
                                            For best results, paint over just the area that needs fixing.
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-zinc-500">
                                    <div className="text-4xl mb-4">👈</div>
                                    <p>Select a frame from the left to start repairing</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
