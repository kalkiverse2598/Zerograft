"use client";

import { useState, useEffect, use, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PixelEditor } from "@/components/PixelEditor";
import { usePipelineWebSocket } from "@/hooks/usePipelineWebSocket";
import type { GenerationMode } from "@/lib/types";

interface PreviewPageProps {
    params: Promise<{ id: string }>;
}

interface Pivot {
    x: number;
    y: number;
}

export default function PreviewPage({ params }: PreviewPageProps) {
    const { id } = use(params);
    const searchParams = useSearchParams();
    const modeFromUrl = (searchParams.get("mode") as GenerationMode) || "single";

    // WebSocket connection for real-time stage updates and auto-navigation
    const { connect, isConnected, isComplete, frameUrls: wsFrameUrls, spritesheetUrl: wsSpritesheetUrl, animationType: wsAnimationType } = usePipelineWebSocket(id);

    // Connect to WebSocket on mount
    useEffect(() => {
        connect();
    }, [connect]);

    // Auto-refresh frames when pipeline completes via WebSocket
    useEffect(() => {
        if (isComplete && wsFrameUrls && wsFrameUrls.length > 0) {
            console.log(`✅ Pipeline complete! Auto-refreshing ${wsFrameUrls.length} frames for ${wsAnimationType || 'default'}...`);
            setFrames(wsFrameUrls);
            if (wsSpritesheetUrl) {
                setSpritesheetUrl(wsSpritesheetUrl);
            }
            setPivots(wsFrameUrls.map(() => ({ x: 0.5, y: 1.0 })));
            setIsLoading(false);

            // Update animation type selection if a new animation type was generated
            if (wsAnimationType) {
                setSelectedAnimationType(wsAnimationType);
                // Add to animation types list if not already present
                setAnimationTypes(prev => {
                    if (!prev.includes(wsAnimationType)) {
                        return [...prev, wsAnimationType];
                    }
                    return prev;
                });
            }
        }
    }, [isComplete, wsFrameUrls, wsSpritesheetUrl, wsAnimationType]);

    // Dual mode state
    const [generationMode, setGenerationMode] = useState<GenerationMode>(modeFromUrl);
    const [activeCharacter, setActiveCharacter] = useState<"instigator" | "responder">("instigator");

    // Instigator frames (main character)
    const [frames, setFrames] = useState<string[]>([]);
    const [spritesheetUrl, setSpritesheetUrl] = useState<string | null>(null);

    // Responder frames (for dual mode)
    const [responderFrames, setResponderFrames] = useState<string[]>([]);
    const [responderSpritesheetUrl, setResponderSpritesheetUrl] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [currentFrame, setCurrentFrame] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [fps, setFps] = useState(12);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Onion Skinning State
    const [onionEnabled, setOnionEnabled] = useState(false);
    const [onionOpacity, setOnionOpacity] = useState(30);
    const [onionFrames, setOnionFrames] = useState(1);

    // Inspection Mode State
    const [inspectionMode, setInspectionMode] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [showGrid, setShowGrid] = useState(false);

    // Pivot Override State
    const [pivots, setPivots] = useState<Pivot[]>([]);
    const [editingPivot, setEditingPivot] = useState(false);
    const [pivotChanged, setPivotChanged] = useState(false);
    const canvasRef = useRef<HTMLDivElement>(null);

    // Export Modal State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState<"png" | "webp" | "gif" | "json">("png");
    const [includeMetadata, setIncludeMetadata] = useState(true);
    const [exportType, setExportType] = useState<"spritesheet" | "frames">("spritesheet");
    const [exportTransparent, setExportTransparent] = useState(true);
    const [exportFps, setExportFps] = useState(12);
    const [isExporting, setIsExporting] = useState(false);
    const [isSavingPreview, setIsSavingPreview] = useState(false);

    // Pixel Editor State
    const [editingFrameIndex, setEditingFrameIndex] = useState<number | null>(null);

    // Reprocess Modal State
    const [showReprocessModal, setShowReprocessModal] = useState(false);
    const [reprocessRows, setReprocessRows] = useState(4);
    const [reprocessCols, setReprocessCols] = useState(4);
    const [reprocessFrameCount, setReprocessFrameCount] = useState(16);
    const [isReprocessing, setIsReprocessing] = useState(false);

    // Lighting Maps State (Stage 7b)
    const [lightingMode, setLightingMode] = useState(false);
    const [normalMapUrl, setNormalMapUrl] = useState<string | null>(null);
    const [specularMapUrl, setSpecularMapUrl] = useState<string | null>(null);
    const [isGeneratingLightingMaps, setIsGeneratingLightingMaps] = useState(false);

    // Animation Type Selector State (for projects with multiple animations)
    const [animationTypes, setAnimationTypes] = useState<string[]>([]);
    const [selectedAnimationType, setSelectedAnimationType] = useState<string>("idle");

    // Fetch frames from API - also auto-detect dual mode from project data
    useEffect(() => {
        const fetchFrames = async () => {
            try {
                const api = (await import("@/lib/api")).api;

                // First, try the animations endpoint to get available animation types
                let loadedFromAnimations = false;
                try {
                    const animList = await api.listAnimations(id);
                    if (animList.animations && animList.animations.length > 0) {
                        const types = animList.animations.map(a => a.type);
                        setAnimationTypes(types);
                        console.log(`✅ Found ${types.length} animation(s): ${types.join(', ')}`);

                        // Default to first available animation (often 'idle')
                        const defaultType = types.includes('idle') ? 'idle' : types[0];
                        setSelectedAnimationType(defaultType);

                        // Load frames for the default animation type
                        try {
                            const animData = await api.getAnimationFrames(id, defaultType);
                            if (animData.frame_urls && animData.frame_urls.length > 0) {
                                setFrames(animData.frame_urls);
                                setSpritesheetUrl(animData.spritesheet_url || null);
                                setPivots(animData.frame_urls.map(() => ({ x: 0.5, y: 1.0 })));
                                loadedFromAnimations = true;
                                console.log(`✅ Loaded ${animData.frame_urls.length} frames for ${defaultType}`);
                            }
                        } catch (err) {
                            console.log(`⚠️ Could not load frames for ${defaultType}:`, err);
                        }
                    }
                } catch (err) {
                    console.log("No animations found via API, trying legacy");
                }

                // Fallback: try legacy getFrames endpoint if no animation-specific data
                if (!loadedFromAnimations) {
                    const data = await api.getFrames(id);
                    setFrames(data.frame_urls || []);
                    setSpritesheetUrl(data.spritesheet_url);
                    if (data.frame_urls) {
                        setPivots(data.frame_urls.map(() => ({ x: 0.5, y: 1.0 })));
                    }
                }

                // Always try to fetch dual status to check for responder data
                try {
                    const dualStatus = await api.getDualPipelineStatus(id);
                    if (dualStatus.is_dual || dualStatus.has_responder_frames || dualStatus.responder_frame_urls?.length) {
                        setGenerationMode("dual");
                    }
                    if (dualStatus.responder_spritesheet_url) {
                        setResponderSpritesheetUrl(dualStatus.responder_spritesheet_url);
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


    // Get the active frames array for animation
    const activeFrames = activeCharacter === "responder" && responderFrames.length > 0
        ? responderFrames
        : frames;

    // Animation loop
    useEffect(() => {
        if (isPlaying && activeFrames.length > 0 && !inspectionMode) {
            intervalRef.current = setInterval(() => {
                setCurrentFrame((prev) => (prev + 1) % activeFrames.length);
            }, 1000 / fps);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isPlaying, fps, activeFrames.length, inspectionMode]);

    // Reset frame index when switching characters
    useEffect(() => {
        setCurrentFrame(0);
    }, [activeCharacter]);

    // Handle pivot click
    const handlePivotClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!editingPivot || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        const newPivots = [...pivots];
        newPivots[currentFrame] = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
        setPivots(newPivots);
        setPivotChanged(true);
    }, [editingPivot, currentFrame, pivots]);

    // Save pivots to API
    const handleSavePivots = async () => {
        try {
            const api = (await import("@/lib/api")).api;
            await api.updatePivots(id, pivots);
            setPivotChanged(false);
            alert("Pivots saved!");
        } catch (err) {
            console.error("Failed to save pivots:", err);
            alert("Failed to save pivots. Check console for details.");
        }
    };

    // Reset pivot to auto
    const handleResetPivot = () => {
        const newPivots = [...pivots];
        newPivots[currentFrame] = { x: 0.5, y: 1.0 }; // Default bottom-center
        setPivots(newPivots);
        setPivotChanged(true);
    };

    // Handle animation type change (switch between idle/walk/jump etc.)
    const handleAnimationTypeChange = useCallback(async (animationType: string) => {
        console.log(`🔄 Switching to animation: ${animationType}`);
        setSelectedAnimationType(animationType);
        setCurrentFrame(0);
        setIsPlaying(false);

        try {
            const api = (await import("@/lib/api")).api;
            console.log(`📡 Fetching frames for: ${animationType}...`);
            const animData = await api.getAnimationFrames(id, animationType);
            console.log(`📦 API Response:`, animData);

            if (animData.frame_urls && animData.frame_urls.length > 0) {
                console.log(`✅ Setting ${animData.frame_urls.length} frames for ${animationType}`);
                setFrames(animData.frame_urls);
                setSpritesheetUrl(animData.spritesheet_url || null);
                setPivots(animData.frame_urls.map(() => ({ x: 0.5, y: 1.0 })));
                setIsPlaying(true);
            } else {
                console.log(`⚠️ No frames found for ${animationType}`);
                setFrames([]);
                setSpritesheetUrl(null);
            }
        } catch (err) {
            console.error(`Failed to load ${animationType} animation:`, err);
        }
    }, [id]);

    // Save animation as preview GIF for project card
    const handleSavePreviewGif = async () => {
        setIsSavingPreview(true);
        try {
            const api = (await import("@/lib/api")).api;
            const result = await api.savePreviewGif(id, fps);
            alert("✅ Preview GIF saved! It will now appear on your project card.");
        } catch (err) {
            console.error("Failed to save preview GIF:", err);
            alert("Failed to save preview GIF. Check console for details.");
        } finally {
            setIsSavingPreview(false);
        }
    };

    // Trigger file download
    const triggerDownload = async (url: string, filename: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch {
            // Fallback: open in new tab if download fails
            window.open(url, "_blank");
        }
    };

    // Export handlers
    const handleExport = async () => {
        const api = (await import("@/lib/api")).api;
        setIsExporting(true);
        try {
            let downloadUrl: string | null = null;
            let filename = `sprite_${id.slice(0, 8)}`;

            if (exportType === "spritesheet") {
                const result = await api.exportSpritesheet(id, exportFormat, {
                    includeMetadata,
                    transparent: exportTransparent,
                });
                downloadUrl = result.download_url;
                filename = `spritesheet_${id.slice(0, 8)}.${exportFormat}`;
            } else {
                const result = await api.exportFrames(id, exportFormat, {
                    includeMetadata,
                    transparent: exportTransparent,
                    fps: exportFps,
                });
                downloadUrl = result.download_url;
                if (exportFormat === "gif") {
                    filename = `animation_${id.slice(0, 8)}.gif`;
                } else {
                    filename = `frames_${id.slice(0, 8)}.zip`;
                }
            }

            if (downloadUrl) {
                await triggerDownload(downloadUrl, filename);
            }
            setShowExportModal(false);
        } catch (err) {
            console.error("Export failed:", err);
            alert("Export failed. Check console for details.");
        } finally {
            setIsExporting(false);
        }
    };

    // Save edited frame from pixel editor
    const handleSaveEditedFrame = async (imageBlob: Blob) => {
        if (editingFrameIndex === null) return;

        try {
            const api = (await import("@/lib/api")).api;
            const result = await api.saveEditedFrame(id, editingFrameIndex, imageBlob, activeCharacter);

            // Update the correct character's frame URL in local state
            if (activeCharacter === "responder") {
                const newFrames = [...responderFrames];
                newFrames[editingFrameIndex] = result.new_url;
                setResponderFrames(newFrames);
            } else {
                const newFrames = [...frames];
                newFrames[editingFrameIndex] = result.new_url;
                setFrames(newFrames);
            }

            setEditingFrameIndex(null);
            console.log(`✅ ${activeCharacter} frame saved successfully`);
        } catch (err) {
            console.error("Failed to save edited frame:", err);
            alert("Failed to save frame. Check console for details.");
        }
    };

    // Handle reprocess spritesheet with manual grid
    const handleReprocess = async () => {
        setIsReprocessing(true);
        try {
            const api = (await import("@/lib/api")).api;
            console.log(`🔄 Reprocessing ${selectedAnimationType} animation for ${activeCharacter}...`);
            const result = await api.reprocessSpritesheet(
                id,
                reprocessRows,
                reprocessCols,
                reprocessFrameCount,
                activeCharacter,
                selectedAnimationType  // Pass the currently selected animation type
            );

            // Update frames in local state
            if (activeCharacter === "responder") {
                setResponderFrames(result.frame_urls);
            } else {
                setFrames(result.frame_urls);
            }

            // Reset current frame
            setCurrentFrame(0);
            setShowReprocessModal(false);
            console.log(`✅ Reprocessed ${result.frame_count} ${activeCharacter} frames for ${selectedAnimationType}`);
        } catch (err) {
            console.error("Reprocess failed:", err);
            alert("Reprocess failed. Check console for details.");
        } finally {
            setIsReprocessing(false);
        }
    };

    // Get ghost frames for onion skinning
    const getGhostFrames = () => {
        if (!onionEnabled || frames.length === 0) return [];
        const ghosts: { index: number; opacity: number; type: "prev" | "next" }[] = [];

        for (let i = 1; i <= onionFrames; i++) {
            // Previous frames (red tint)
            const prevIndex = (currentFrame - i + frames.length) % frames.length;
            if (prevIndex !== currentFrame) {
                ghosts.push({ index: prevIndex, opacity: onionOpacity / (i * 1.5), type: "prev" });
            }
            // Next frames (blue tint)
            const nextIndex = (currentFrame + i) % frames.length;
            if (nextIndex !== currentFrame) {
                ghosts.push({ index: nextIndex, opacity: onionOpacity / (i * 1.5), type: "next" });
            }
        }
        return ghosts;
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
                        <h1 className="text-xl font-semibold">🎬 Preview</h1>
                    </div>
                </header>
                <main className="max-w-7xl mx-auto px-6 py-12">
                    <Card className="max-w-lg mx-auto">
                        <CardContent className="pt-6 text-center">
                            <div className="text-6xl mb-4">🎬</div>
                            <h2 className="text-xl font-semibold mb-2">No Frames Generated Yet</h2>
                            <p className="text-zinc-400 mb-6">
                                Go to Storyboard to generate the animation frames.
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

    // Computed frames based on active character
    const displayFrames = activeCharacter === "responder" && responderFrames.length > 0
        ? responderFrames
        : frames;

    const currentPivot = pivots[currentFrame] || { x: 0.5, y: 1.0 };
    const ghostFrames = getGhostFrames();

    return (
        <div className="min-h-screen bg-zinc-950">
            <header className="border-b border-zinc-800">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={`/projects/${id}`} className="text-zinc-400 hover:text-zinc-300">
                            ← Back
                        </Link>
                        <h1 className="text-xl font-semibold">🎬 Preview</h1>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            variant={inspectionMode ? "primary" : "ghost"}
                            onClick={() => setInspectionMode(!inspectionMode)}
                        >
                            🔍 Inspect
                        </Button>
                        <Button
                            variant={lightingMode ? "primary" : "ghost"}
                            onClick={async () => {
                                if (!lightingMode && !normalMapUrl) {
                                    // Generate lighting maps first
                                    setIsGeneratingLightingMaps(true);
                                    try {
                                        const api = (await import("@/lib/api")).api;
                                        const result = await api.generateLightingMaps(id);
                                        setNormalMapUrl(result.normal_map_url);
                                        setSpecularMapUrl(result.specular_map_url);
                                        setLightingMode(true);
                                    } catch (err) {
                                        console.error("Failed to generate lighting maps:", err);
                                        alert("Failed to generate lighting maps. Check console.");
                                    } finally {
                                        setIsGeneratingLightingMaps(false);
                                    }
                                } else {
                                    setLightingMode(!lightingMode);
                                }
                            }}
                            isLoading={isGeneratingLightingMaps}
                        >
                            ⚡ 3D Lighting
                        </Button>
                        <Link href={`/projects/${id}/repair`}>
                            <Button variant="ghost">🔧 Repair</Button>
                        </Link>
                        <Button onClick={() => setShowExportModal(true)}>📥 Export</Button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-8">
                {/* Controls Bar */}
                <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 mb-6 flex flex-wrap gap-6">
                    {/* Onion Skinning */}
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={onionEnabled}
                                onChange={(e) => setOnionEnabled(e.target.checked)}
                                className="w-4 h-4 rounded accent-violet-500"
                            />
                            <span className="text-sm">🧅 Onion Skin</span>
                        </label>
                        {onionEnabled && (
                            <>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-zinc-500">Opacity:</span>
                                    <input
                                        type="range"
                                        min="10"
                                        max="60"
                                        value={onionOpacity}
                                        onChange={(e) => setOnionOpacity(Number(e.target.value))}
                                        className="w-20 h-1"
                                    />
                                    <span className="text-xs text-zinc-400">{onionOpacity}%</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-zinc-500">Frames:</span>
                                    <select
                                        value={onionFrames}
                                        onChange={(e) => setOnionFrames(Number(e.target.value))}
                                        className="bg-zinc-800 rounded px-2 py-1 text-sm"
                                    >
                                        <option value={1}>1</option>
                                        <option value={2}>2</option>
                                        <option value={3}>3</option>
                                    </select>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="w-px bg-zinc-700" />

                    {/* Pivot Override */}
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={editingPivot}
                                onChange={(e) => setEditingPivot(e.target.checked)}
                                className="w-4 h-4 rounded accent-violet-500"
                            />
                            <span className="text-sm">📍 Edit Pivot</span>
                        </label>
                        {editingPivot && (
                            <>
                                <Button size="sm" variant="ghost" onClick={handleResetPivot}>
                                    Reset
                                </Button>
                                {pivotChanged && (
                                    <Button size="sm" onClick={handleSavePivots}>
                                        Save Pivots
                                    </Button>
                                )}
                            </>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="w-px bg-zinc-700" />

                    {/* Animation Type Selector (shows when project has animations) */}
                    {animationTypes.length > 0 && (
                        <>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-zinc-400">Animations:</span>
                                <div className="flex items-center">
                                    {animationTypes.map((type, index) => (
                                        <div key={type} className="flex items-center">
                                            <button
                                                onClick={() => handleAnimationTypeChange(type)}
                                                className={`px-2 py-0.5 text-sm font-medium transition-colors ${selectedAnimationType === type
                                                    ? "text-violet-400"
                                                    : "text-zinc-500 hover:text-zinc-300"
                                                    }`}
                                            >
                                                {type.charAt(0).toUpperCase() + type.slice(1)}
                                            </button>
                                            {index < animationTypes.length - 1 && (
                                                <span className="text-zinc-600 mx-1">|</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="w-px bg-zinc-700" />
                        </>
                    )}

                    {/* Inspection Mode Controls */}
                    {inspectionMode && (
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-500">Zoom:</span>
                                <select
                                    value={zoom}
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="bg-zinc-800 rounded px-2 py-1 text-sm"
                                >
                                    <option value={1}>1×</option>
                                    <option value={2}>2×</option>
                                    <option value={4}>4×</option>
                                    <option value={8}>8×</option>
                                </select>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showGrid}
                                    onChange={(e) => setShowGrid(e.target.checked)}
                                    className="w-4 h-4 rounded accent-violet-500"
                                />
                                <span className="text-sm">🔲 Pixel Grid</span>
                            </label>
                        </div>
                    )}
                </div>

                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Dual Mode Character Selector */}
                    {generationMode === "dual" && responderFrames.length > 0 && (
                        <div className="lg:col-span-2 mb-4 flex gap-2">
                            <Button
                                variant={activeCharacter === "instigator" ? "primary" : "secondary"}
                                onClick={() => setActiveCharacter("instigator")}
                                className="flex-1"
                            >
                                ⚔️ Instigator ({frames.length} frames)
                            </Button>
                            <Button
                                variant={activeCharacter === "responder" ? "primary" : "secondary"}
                                onClick={() => setActiveCharacter("responder")}
                                className="flex-1"
                            >
                                🛡️ Responder ({responderFrames.length} frames)
                            </Button>
                        </div>
                    )}

                    {/* Animation Preview */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Animation Preview</CardTitle>
                            <CardDescription>
                                {generationMode === "dual" && activeCharacter === "responder"
                                    ? `Responder Frame ${currentFrame + 1} of ${responderFrames.length}`
                                    : `Frame ${currentFrame + 1} of ${frames.length}`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div
                                ref={canvasRef}
                                onClick={handlePivotClick}
                                className={`aspect-square bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-center mb-6 overflow-hidden relative ${editingPivot ? "cursor-crosshair" : ""}`}
                                style={{
                                    transform: inspectionMode ? `scale(${zoom})` : undefined,
                                    transformOrigin: "center",
                                }}
                            >
                                {/* Ghost Frames (Onion Skinning) */}
                                {ghostFrames.map((ghost) => (
                                    <img
                                        key={`ghost-${ghost.index}-${ghost.type}`}
                                        src={displayFrames[ghost.index]}
                                        alt={`Ghost ${ghost.index}`}
                                        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                                        style={{
                                            imageRendering: "pixelated",
                                            opacity: ghost.opacity / 100,
                                            filter: ghost.type === "prev" ? "hue-rotate(-40deg) saturate(0.5)" : "hue-rotate(40deg) saturate(0.5)",
                                        }}
                                    />
                                ))}

                                {/* Current Frame */}
                                {displayFrames[currentFrame] && (
                                    <img
                                        src={displayFrames[currentFrame]}
                                        alt={`Frame ${currentFrame + 1}`}
                                        className="max-w-full max-h-full object-contain relative z-10"
                                        style={{ imageRendering: "pixelated" }}
                                    />
                                )}

                                {/* Pivot Marker */}
                                {editingPivot && (
                                    <div
                                        className="absolute w-4 h-4 border-2 border-red-500 bg-red-500/30 rounded-full transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
                                        style={{
                                            left: `${currentPivot.x * 100}%`,
                                            top: `${currentPivot.y * 100}%`,
                                        }}
                                    >
                                        {/* Crosshair */}
                                        <div className="absolute w-8 h-px bg-red-500 left-1/2 top-1/2 -translate-x-1/2" />
                                        <div className="absolute h-8 w-px bg-red-500 left-1/2 top-1/2 -translate-y-1/2" />
                                    </div>
                                )}

                                {/* Pixel Grid Overlay */}
                                {showGrid && inspectionMode && zoom >= 4 && (
                                    <div
                                        className="absolute inset-0 pointer-events-none z-30"
                                        style={{
                                            backgroundImage: `
                                                linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
                                                linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
                                            `,
                                            backgroundSize: `${100 / 64}% ${100 / 64}%`,
                                        }}
                                    />
                                )}
                            </div>

                            {/* Controls */}
                            <div className="flex items-center justify-center gap-4">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setCurrentFrame((prev) => (prev - 1 + frames.length) % frames.length)}
                                >
                                    ◀
                                </Button>
                                <Button
                                    onClick={() => setIsPlaying(!isPlaying)}
                                    className="w-24"
                                    disabled={inspectionMode}
                                >
                                    {isPlaying && !inspectionMode ? "⏸ Pause" : "▶ Play"}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setCurrentFrame((prev) => (prev + 1) % frames.length)}
                                >
                                    ▶
                                </Button>
                            </div>

                            {/* FPS Slider */}
                            <div className="mt-6">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm text-zinc-400">
                                        Speed: {fps} FPS
                                    </label>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={handleSavePreviewGif}
                                        disabled={isSavingPreview || activeFrames.length === 0}
                                        className="text-xs"
                                    >
                                        {isSavingPreview ? "Saving..." : "💾 Set as Preview"}
                                    </Button>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="30"
                                    value={fps}
                                    onChange={(e) => setFps(Number(e.target.value))}
                                    className="w-full"
                                />
                            </div>

                            {/* Pivot Info */}
                            {editingPivot && (
                                <div className="mt-4 p-3 bg-zinc-800 rounded-lg text-sm">
                                    <p className="text-zinc-400">
                                        Pivot: ({(currentPivot.x * 100).toFixed(1)}%, {(currentPivot.y * 100).toFixed(1)}%)
                                    </p>
                                    <p className="text-zinc-500 text-xs mt-1">
                                        Click on the preview to set pivot position
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Frame Grid */}
                    <Card>
                        <CardHeader>
                            <CardTitle>All Frames</CardTitle>
                            <CardDescription>Click to preview, hover for edit option</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-4 gap-3">
                                {displayFrames.map((url, index) => (
                                    <div
                                        key={index}
                                        className={`group aspect-square bg-zinc-900 rounded-lg border overflow-hidden transition-all relative cursor-pointer ${currentFrame === index
                                            ? "border-violet-500 ring-2 ring-violet-500/50"
                                            : "border-zinc-700 hover:border-zinc-600"
                                            }`}
                                        onClick={() => {
                                            setCurrentFrame(index);
                                            setIsPlaying(false);
                                        }}
                                    >
                                        <img
                                            src={url}
                                            alt={`Frame ${index + 1}`}
                                            className="w-full h-full object-contain"
                                            style={{ imageRendering: "pixelated" }}
                                        />
                                        <span className="absolute bottom-1 right-1 text-xs bg-black/60 px-1 rounded">
                                            {index + 1}
                                        </span>
                                        {/* Edit button on hover */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingFrameIndex(index);
                                            }}
                                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-violet-600 hover:bg-violet-700 text-white text-xs px-2 py-1 rounded"
                                        >
                                            ✏️ Edit
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Spritesheet Preview */}
                {(() => {
                    const displaySpritesheetUrl = activeCharacter === "responder" && responderSpritesheetUrl
                        ? responderSpritesheetUrl
                        : spritesheetUrl;
                    return displaySpritesheetUrl && (
                        <Card className="mt-8">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>
                                    Spritesheet {activeCharacter === "responder" ? "(Responder)" : "(Instigator)"}
                                </CardTitle>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        // Set defaults based on current frame count
                                        const currentFrameCount = activeCharacter === "responder"
                                            ? responderFrames.length
                                            : frames.length;
                                        const gridDim = Math.ceil(Math.sqrt(currentFrameCount));
                                        setReprocessRows(gridDim);
                                        setReprocessCols(gridDim);
                                        setReprocessFrameCount(currentFrameCount || 16);
                                        setShowReprocessModal(true);
                                    }}
                                >
                                    🔄 Re-process
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 overflow-auto">
                                    <img
                                        src={displaySpritesheetUrl}
                                        alt={`${activeCharacter} Spritesheet`}
                                        className="max-w-full"
                                        style={{ imageRendering: "pixelated" }}
                                    />
                                </div>
                                <p className="text-xs text-zinc-500 mt-2">
                                    💡 If frames look wrong, click Re-process and specify the correct grid layout
                                </p>
                            </CardContent>
                        </Card>
                    );
                })()}

                {/* Lighting Maps Display */}
                {lightingMode && normalMapUrl && specularMapUrl && (
                    <Card className="mt-8 border-amber-500/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span>⚡ Lighting Maps</span>
                                <span className="text-xs font-normal text-amber-400 bg-amber-500/20 px-2 py-1 rounded">HD-2D Ready</span>
                            </CardTitle>
                            <CardDescription>
                                Use these in your game engine for dynamic lighting effects
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-6">
                                {/* Normal Map */}
                                <div>
                                    <h4 className="text-sm font-medium mb-2 text-violet-400">Normal Map</h4>
                                    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-3 overflow-auto">
                                        <img
                                            src={normalMapUrl}
                                            alt="Normal Map"
                                            className="max-w-full"
                                            style={{ imageRendering: "pixelated" }}
                                        />
                                    </div>
                                    <a
                                        href={normalMapUrl}
                                        download="normal_map.png"
                                        className="text-xs text-violet-400 hover:text-violet-300 mt-2 inline-block"
                                    >
                                        📥 Download Normal Map
                                    </a>
                                </div>
                                {/* Specular Map */}
                                <div>
                                    <h4 className="text-sm font-medium mb-2 text-amber-400">Specular Map</h4>
                                    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-3 overflow-auto">
                                        <img
                                            src={specularMapUrl}
                                            alt="Specular Map"
                                            className="max-w-full"
                                            style={{ imageRendering: "pixelated" }}
                                        />
                                    </div>
                                    <a
                                        href={specularMapUrl}
                                        download="specular_map.png"
                                        className="text-xs text-amber-400 hover:text-amber-300 mt-2 inline-block"
                                    >
                                        📥 Download Specular Map
                                    </a>
                                </div>
                            </div>
                            <p className="text-xs text-zinc-500 mt-4">
                                💡 Import these spritesheets into Unity/Godot/Unreal for HD-2D dynamic lighting
                            </p>
                        </CardContent>
                    </Card>
                )}
            </main>


            {/* Pixel Editor Modal */}
            {editingFrameIndex !== null && displayFrames[editingFrameIndex] && (
                <PixelEditor
                    imageUrl={displayFrames[editingFrameIndex]}
                    onSave={handleSaveEditedFrame}
                    onClose={() => setEditingFrameIndex(null)}
                />
            )}

            {/* Export Modal */}
            {showExportModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-zinc-900 rounded-2xl border border-zinc-700 p-6 w-full max-w-md">
                        <h2 className="text-xl font-semibold mb-6">📥 Export Options</h2>

                        {/* Export Type */}
                        <div className="mb-6">
                            <label className="text-sm text-zinc-400 block mb-2">Export Type</label>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setExportType("spritesheet")}
                                    className={`flex-1 py-3 rounded-lg border transition-all ${exportType === "spritesheet"
                                        ? "border-violet-500 bg-violet-500/20"
                                        : "border-zinc-700 hover:border-zinc-600"
                                        }`}
                                >
                                    🖼️ Spritesheet
                                </button>
                                <button
                                    onClick={() => setExportType("frames")}
                                    className={`flex-1 py-3 rounded-lg border transition-all ${exportType === "frames"
                                        ? "border-violet-500 bg-violet-500/20"
                                        : "border-zinc-700 hover:border-zinc-600"
                                        }`}
                                >
                                    {exportFormat === "gif" ? "🎬 Animated GIF" : "📁 Individual Frames"}
                                </button>
                            </div>
                            {exportType === "frames" && exportFormat === "gif" && (
                                <p className="text-xs text-violet-400 mt-2">
                                    ✨ Exports as animated GIF with all frames
                                </p>
                            )}
                        </div>

                        {/* Format */}
                        <div className="mb-6">
                            <label className="text-sm text-zinc-400 block mb-2">Format</label>
                            <div className="grid grid-cols-4 gap-2">
                                {(["png", "webp", "gif", "json"] as const).map((format) => (
                                    <button
                                        key={format}
                                        onClick={() => setExportFormat(format)}
                                        className={`py-2 rounded-lg border text-sm uppercase transition-all ${exportFormat === format
                                            ? "border-violet-500 bg-violet-500/20"
                                            : "border-zinc-700 hover:border-zinc-600"
                                            }`}
                                    >
                                        {format}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Background Option */}
                        <div className="mb-6">
                            <label className="text-sm text-zinc-400 block mb-2">Background</label>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setExportTransparent(true)}
                                    className={`flex-1 py-2 rounded-lg border text-sm transition-all flex items-center justify-center gap-2 ${exportTransparent
                                        ? "border-violet-500 bg-violet-500/20"
                                        : "border-zinc-700 hover:border-zinc-600"
                                        }`}
                                >
                                    <span className="w-4 h-4 rounded bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOCIgaGVpZ2h0PSI4IiB2aWV3Qm94PSIwIDAgOCA4IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiM5OTkiLz48cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjOTk5Ii8+PC9zdmc+')]" />
                                    Transparent
                                </button>
                                <button
                                    onClick={() => setExportTransparent(false)}
                                    className={`flex-1 py-2 rounded-lg border text-sm transition-all flex items-center justify-center gap-2 ${!exportTransparent
                                        ? "border-violet-500 bg-violet-500/20"
                                        : "border-zinc-700 hover:border-zinc-600"
                                        }`}
                                >
                                    <span className="w-4 h-4 rounded bg-white border border-zinc-600" />
                                    White
                                </button>
                            </div>
                        </div>

                        {/* GIF FPS (only show for animated GIF) */}
                        {exportFormat === "gif" && exportType === "frames" && (
                            <div className="mb-6">
                                <label className="text-sm text-zinc-400 block mb-2">
                                    Animation Speed: {exportFps} FPS
                                </label>
                                <input
                                    type="range"
                                    min="6"
                                    max="30"
                                    value={exportFps}
                                    onChange={(e) => setExportFps(parseInt(e.target.value))}
                                    className="w-full accent-violet-500"
                                />
                                <div className="flex justify-between text-xs text-zinc-500 mt-1">
                                    <span>Slow (6)</span>
                                    <span>Fast (30)</span>
                                </div>
                            </div>
                        )}

                        {/* Options */}
                        <div className="mb-6">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={includeMetadata}
                                    onChange={(e) => setIncludeMetadata(e.target.checked)}
                                    className="w-4 h-4 rounded accent-violet-500"
                                />
                                <span className="text-sm">Include metadata (pivots, timing)</span>
                            </label>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <Button
                                variant="ghost"
                                className="flex-1"
                                onClick={() => setShowExportModal(false)}
                                disabled={isExporting}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={handleExport}
                                disabled={isExporting}
                            >
                                {isExporting ? "Exporting..." : "Download"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reprocess Modal */}
            {showReprocessModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-zinc-900 rounded-2xl border border-zinc-700 p-6 w-full max-w-md">
                        <h2 className="text-xl font-semibold mb-2">🔄 Re-process Spritesheet</h2>
                        <p className="text-sm text-zinc-400 mb-6">
                            Specify the correct grid layout to extract frames properly.
                        </p>

                        {/* Grid Rows */}
                        <div className="mb-4">
                            <label className="text-sm text-zinc-400 block mb-2">Grid Rows</label>
                            <input
                                type="number"
                                min="1"
                                max="10"
                                value={reprocessRows}
                                onChange={(e) => setReprocessRows(Number(e.target.value))}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                            />
                        </div>

                        {/* Grid Columns */}
                        <div className="mb-4">
                            <label className="text-sm text-zinc-400 block mb-2">Grid Columns</label>
                            <input
                                type="number"
                                min="1"
                                max="10"
                                value={reprocessCols}
                                onChange={(e) => setReprocessCols(Number(e.target.value))}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                            />
                        </div>

                        {/* Frame Count */}
                        <div className="mb-6">
                            <label className="text-sm text-zinc-400 block mb-2">Total Frames to Extract</label>
                            <input
                                type="number"
                                min="1"
                                max={reprocessRows * reprocessCols}
                                value={reprocessFrameCount}
                                onChange={(e) => setReprocessFrameCount(Number(e.target.value))}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                            />
                            <p className="text-xs text-zinc-500 mt-1">
                                Max: {reprocessRows * reprocessCols} (grid size)
                            </p>
                        </div>

                        {/* Preview Info */}
                        <div className="bg-zinc-800 rounded-lg p-3 mb-6">
                            <p className="text-sm">
                                📐 Grid: <span className="text-violet-400 font-mono">{reprocessRows}×{reprocessCols}</span>
                            </p>
                            <p className="text-sm">
                                🎞️ Extracting: <span className="text-violet-400 font-mono">{reprocessFrameCount}</span> frames
                            </p>
                            <p className="text-sm">
                                👤 Character: <span className="text-violet-400 font-mono">{activeCharacter}</span>
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <Button
                                variant="ghost"
                                className="flex-1"
                                onClick={() => setShowReprocessModal(false)}
                                disabled={isReprocessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={handleReprocess}
                                disabled={isReprocessing}
                            >
                                {isReprocessing ? (
                                    <span className="flex items-center gap-2">
                                        <span className="animate-spin">⏳</span> Processing...
                                    </span>
                                ) : (
                                    "Re-process"
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
