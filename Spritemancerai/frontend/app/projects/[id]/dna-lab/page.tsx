"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUpload } from "@/components/ui/file-upload";
import { usePipelineWebSocket } from "@/hooks/usePipelineWebSocket";
import type { CharacterDNA, GenerationMode } from "@/lib/types";

interface DNALabPageProps {
    params: Promise<{ id: string }>;
}

const WEAPON_MASS_OPTIONS = ["none", "light", "medium", "heavy", "oversized"];

export default function DNALabPage({ params }: DNALabPageProps) {
    const { id } = use(params);

    // WebSocket connection for real-time stage updates and auto-navigation
    const { connect, isConnected } = usePipelineWebSocket(id);

    // Connect to WebSocket on mount
    useEffect(() => {
        connect();
    }, [connect]);

    // Mode selection
    const [generationMode, setGenerationMode] = useState<GenerationMode>("single");

    // Instigator (main character)
    const [referenceImage, setReferenceImage] = useState<File | null>(null);
    const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
    const [dna, setDna] = useState<CharacterDNA | null>(null);
    const [editedDna, setEditedDna] = useState<CharacterDNA | null>(null);

    // Responder (second character for dual mode)
    const [responderImage, setResponderImage] = useState<File | null>(null);
    const [responderUrl, setResponderUrl] = useState<string | null>(null);
    const [isUploadingResponder, setIsUploadingResponder] = useState(false);
    const [responderDna, setResponderDna] = useState<CharacterDNA | null>(null);
    const [editedResponderDna, setEditedResponderDna] = useState<CharacterDNA | null>(null);

    const [isExtracting, setIsExtracting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // New item inputs
    const [newEquipment, setNewEquipment] = useState("");
    const [newFeature, setNewFeature] = useState("");
    const [newConstraint, setNewConstraint] = useState("");
    const [newColor, setNewColor] = useState("#6366f1");

    // Fetch existing DNA on mount
    useEffect(() => {
        const fetchProject = async () => {
            try {
                const api = (await import("@/lib/api")).api;
                const project = await api.getProject(id);
                if (project.character_dna) {
                    setDna(project.character_dna);
                    setEditedDna(project.character_dna);
                }
                if (project.reference_image_url) {
                    setReferenceUrl(project.reference_image_url);
                }
                // Check for responder image and DNA
                const projectData = project as { responder_reference_url?: string; responder_dna?: CharacterDNA };
                if (projectData.responder_reference_url) {
                    setResponderUrl(projectData.responder_reference_url);
                    setGenerationMode("dual");
                }
                if (projectData.responder_dna) {
                    setResponderDna(projectData.responder_dna);
                    setEditedResponderDna(projectData.responder_dna);
                }
            } catch (error) {
                console.error("Failed to fetch project:", error);
            }
        };
        fetchProject();
    }, [id]);

    // Godot File Drop Handler - receives files dropped from Godot's FileSystem panel
    useEffect(() => {
        // Define the handler for Godot file drops
        const handleGodotFileDrop = async (data: {
            filename: string;
            path: string;
            base64: string;
            mimeType: string;
        }) => {
            console.log("[DNA Lab] Received file from Godot:", data.filename);

            try {
                // Convert base64 to Blob then File
                const byteCharacters = atob(data.base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: data.mimeType || 'image/png' });
                const file = new File([blob], data.filename, { type: data.mimeType || 'image/png' });

                // Create preview URL
                const url = URL.createObjectURL(blob);

                // Determine if this is for instigator or responder
                if (!referenceUrl || generationMode === "single") {
                    // Set as main reference
                    setReferenceImage(file);
                    setReferenceUrl(url);
                    console.log("[DNA Lab] Set as main reference image");
                } else if (generationMode === "dual" && !responderUrl) {
                    // Set as responder
                    setResponderImage(file);
                    setResponderUrl(url);
                    console.log("[DNA Lab] Set as responder image");
                }
            } catch (error) {
                console.error("[DNA Lab] Failed to process Godot file drop:", error);
            }
        };

        // Register the global handler
        (window as unknown as { onGodotFileDrop: typeof handleGodotFileDrop }).onGodotFileDrop = handleGodotFileDrop;

        // Also register on GodotBridge if it exists
        if ((window as unknown as { GodotBridge?: { onFileDropped?: typeof handleGodotFileDrop } }).GodotBridge) {
            (window as unknown as { GodotBridge: { onFileDropped: typeof handleGodotFileDrop } }).GodotBridge.onFileDropped = handleGodotFileDrop;
        }

        console.log("[DNA Lab] Godot file drop handler registered");

        return () => {
            // Cleanup
            delete (window as unknown as { onGodotFileDrop?: typeof handleGodotFileDrop }).onGodotFileDrop;
        };
    }, [referenceUrl, responderUrl, generationMode]);

    const handleFileSelect = (file: File) => {
        setReferenceImage(file);
        // Create preview URL
        const url = URL.createObjectURL(file);
        setReferenceUrl(url);
    };

    const handleResponderFileSelect = (file: File) => {
        setResponderImage(file);
        // Create preview URL
        const url = URL.createObjectURL(file);
        setResponderUrl(url);
    };

    const handleExtractDNA = async () => {
        if (!referenceImage) return;

        setIsExtracting(true);
        try {
            const { default: api } = await import("@/lib/api");
            const result = await api.uploadReferenceImage(id, referenceImage);

            if (result.dna) {
                setDna(result.dna as CharacterDNA);
                setEditedDna(result.dna as CharacterDNA);
                if (result.url) {
                    setReferenceUrl(result.url);
                }
            }
        } catch (error) {
            console.error("Failed to extract DNA:", error);
            alert(`Failed to extract DNA: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setIsExtracting(false);
        }
    };

    const handleUploadResponder = async () => {
        if (!responderImage) return;

        setIsUploadingResponder(true);
        try {
            const { default: api } = await import("@/lib/api");
            const result = await api.uploadResponderImage(id, responderImage);
            if (result.url) {
                setResponderUrl(result.url);
            }
        } catch (error) {
            console.error("Failed to upload responder:", error);
            alert(`Failed to upload responder: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setIsUploadingResponder(false);
        }
    };

    // Dual mode: Extract DNA for both characters
    const handleExtractDualDNA = async () => {
        // Check if DNA already exists - avoid redundant extraction
        if (dna && responderDna) {
            console.log("DNA already exists for both characters, skipping extraction");
            return;
        }

        if (!referenceImage || !responderImage) return;

        setIsExtracting(true);
        try {
            const { default: api } = await import("@/lib/api");

            // Extract both DNAs in parallel
            const result = await api.extractDualDNA(id, referenceImage, responderImage);

            // Set instigator DNA
            if (result.instigator_dna) {
                setDna(result.instigator_dna);
                setEditedDna(result.instigator_dna);
            }

            // Set responder DNA
            if (result.responder_dna) {
                setResponderDna(result.responder_dna);
                setEditedResponderDna(result.responder_dna);
            }
        } catch (error) {
            console.error("Failed to extract dual DNA:", error);
            alert(`Failed to extract DNA: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setIsExtracting(false);
        }
    };

    const handleConfirmDNA = () => {
        const modeParam = generationMode === "dual" ? "?mode=dual" : "";
        window.location.href = `/projects/${id}/director-booth${modeParam}`;
    };

    // DNA Editing Handlers
    const updateField = <K extends keyof CharacterDNA>(field: K, value: CharacterDNA[K]) => {
        if (!editedDna) return;
        setEditedDna({ ...editedDna, [field]: value });
        setHasUnsavedChanges(true);
    };

    const addToArray = (field: "equipment" | "special_features" | "anatomical_constraints" | "dominant_colors", value: string) => {
        if (!editedDna || !value.trim()) return;
        const currentArray = editedDna[field] as string[];
        if (!currentArray.includes(value.trim())) {
            updateField(field, [...currentArray, value.trim()]);
        }
    };

    const removeFromArray = (field: "equipment" | "special_features" | "anatomical_constraints" | "dominant_colors", index: number) => {
        if (!editedDna) return;
        const currentArray = [...(editedDna[field] as string[])];
        currentArray.splice(index, 1);
        updateField(field, currentArray);
    };

    const handleSave = async () => {
        if (!editedDna) return;
        setIsSaving(true);
        try {
            const api = (await import("@/lib/api")).api;
            await api.editDNA(id, editedDna);
            setDna(editedDna);
            setHasUnsavedChanges(false);
            setEditMode(false);
        } catch (error) {
            console.error("Failed to save DNA:", error);
            alert("Failed to save DNA changes");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelEdit = () => {
        setEditedDna(dna);
        setHasUnsavedChanges(false);
        setEditMode(false);
    };

    const displayDna = editMode ? editedDna : dna;

    // Check if ready for next step
    const canProceed = dna && (generationMode === "single" || (generationMode === "dual" && responderDna));

    return (
        <div className="min-h-screen bg-zinc-950">
            <header className="border-b border-zinc-800">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={`/projects/${id}`} className="text-zinc-400 hover:text-zinc-300">
                            ← Back
                        </Link>
                        <h1 className="text-xl font-semibold">🧬 DNA Lab</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        {dna && !editMode && (
                            <>
                                <Button variant="ghost" onClick={() => setEditMode(true)}>
                                    ✏️ Edit DNA
                                </Button>
                                <Button onClick={handleConfirmDNA} disabled={!canProceed}>
                                    {generationMode === "dual" && !responderUrl
                                        ? "Upload Responder First"
                                        : "Confirm & Continue →"}
                                </Button>
                            </>
                        )}
                        {editMode && (
                            <>
                                <Button variant="ghost" onClick={handleCancelEdit}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSave} disabled={!hasUnsavedChanges || isSaving}>
                                    {isSaving ? "Saving..." : "💾 Save & Verify"}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-8">
                {/* Mode Selector */}
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>Generation Mode</CardTitle>
                        <CardDescription>Choose single character or dual-character relational animation</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setGenerationMode("single")}
                                className={`p-4 rounded-xl border text-left transition-all ${generationMode === "single"
                                    ? "border-violet-500 bg-violet-500/10"
                                    : "border-zinc-700 hover:border-zinc-600 bg-zinc-900"
                                    }`}
                            >
                                <div className="text-2xl mb-2">🧍</div>
                                <div className="font-semibold">Single Character</div>
                                <div className="text-xs text-zinc-400">One reference image needed</div>
                            </button>
                            <button
                                onClick={() => setGenerationMode("dual")}
                                className={`p-4 rounded-xl border text-left transition-all ${generationMode === "dual"
                                    ? "border-amber-500 bg-amber-500/10"
                                    : "border-zinc-700 hover:border-zinc-600 bg-zinc-900"
                                    }`}
                            >
                                <div className="text-2xl mb-2">⚔️</div>
                                <div className="font-semibold">Dual Combat</div>
                                <div className="text-xs text-zinc-400">Two reference images needed</div>
                            </button>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Upload Section */}
                    <div className="space-y-6">
                        {/* Instigator (Main Character) */}
                        <Card className={generationMode === "dual" ? "border-violet-500/50" : ""}>
                            <CardHeader>
                                <CardTitle>
                                    {generationMode === "dual" ? "⚔️ Instigator (Attacker)" : "Reference Image"}
                                </CardTitle>
                                <CardDescription>
                                    {generationMode === "dual"
                                        ? "The character initiating the attack"
                                        : "Upload your character reference for DNA extraction"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {referenceUrl ? (
                                    <div className="space-y-4">
                                        <div className="aspect-square bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden flex items-center justify-center">
                                            <img
                                                src={referenceUrl}
                                                alt="Reference"
                                                className="max-w-full max-h-full object-contain"
                                                style={{ imageRendering: "pixelated" }}
                                            />
                                        </div>
                                        {!dna && generationMode === "single" && (
                                            <Button
                                                onClick={handleExtractDNA}
                                                disabled={isExtracting || !referenceImage}
                                                className="w-full"
                                            >
                                                {isExtracting ? "Extracting DNA..." : "🧬 Extract Character DNA"}
                                            </Button>
                                        )}
                                        {dna && (
                                            <Button
                                                variant="ghost"
                                                onClick={() => {
                                                    setReferenceUrl(null);
                                                    setReferenceImage(null);
                                                }}
                                                className="w-full"
                                            >
                                                Upload Different Image
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <FileUpload
                                        onFileSelect={handleFileSelect}
                                        accept="image/png,image/jpeg,image/webp"
                                        maxSize={10}
                                    />
                                )}
                            </CardContent>
                        </Card>

                        {/* Responder (Second Character for Dual Mode) */}
                        {generationMode === "dual" && (
                            <Card className="border-amber-500/50">
                                <CardHeader>
                                    <CardTitle className="text-amber-400">🛡️ Responder (Defender)</CardTitle>
                                    <CardDescription>
                                        The character reacting to the attack
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {responderUrl ? (
                                        <div className="space-y-4">
                                            <div className="aspect-square bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden flex items-center justify-center">
                                                <img
                                                    src={responderUrl}
                                                    alt="Responder"
                                                    className="max-w-full max-h-full object-contain"
                                                    style={{ imageRendering: "pixelated" }}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-green-400">✓ Responder uploaded</span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setResponderUrl(null);
                                                        setResponderImage(null);
                                                    }}
                                                >
                                                    Change
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <FileUpload
                                                onFileSelect={handleResponderFileSelect}
                                                accept="image/png,image/jpeg,image/webp"
                                                maxSize={10}
                                            />
                                            {responderImage && (
                                                <Button
                                                    onClick={handleUploadResponder}
                                                    disabled={isUploadingResponder}
                                                    className="w-full"
                                                >
                                                    {isUploadingResponder ? "Uploading..." : "📤 Upload Responder"}
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Dual Mode: Extract Both DNAs Button */}
                        {generationMode === "dual" && referenceImage && responderImage && !dna && !responderDna && (
                            <Card className="border-gradient-to-r from-violet-500/50 to-amber-500/50 bg-gradient-to-r from-violet-500/5 to-amber-500/5">
                                <CardContent className="pt-6">
                                    <Button
                                        onClick={handleExtractDualDNA}
                                        disabled={isExtracting}
                                        className="w-full bg-gradient-to-r from-violet-600 to-amber-600 hover:from-violet-500 hover:to-amber-500"
                                        size="lg"
                                    >
                                        {isExtracting ? "Extracting DNA for both characters..." : "🧬 Extract DNA for Both Characters"}
                                    </Button>
                                    <p className="text-xs text-zinc-400 text-center mt-2">
                                        AI will analyze both characters and determine interaction constraints
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Extraction Progress */}
                        {isExtracting && (
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center gap-4">
                                        <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                                        <div>
                                            <p className="font-medium">
                                                {generationMode === "dual" ? "Analyzing both characters..." : "Analyzing character..."}
                                            </p>
                                            <p className="text-sm text-zinc-400">Using Gemini 3 Pro vision</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* DNA Display / Editor */}
                    <div className="space-y-6">
                        {displayDna ? (
                            <>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>
                                            {generationMode === "dual" ? "Instigator DNA" : "Character DNA"}
                                        </CardTitle>
                                        <CardDescription>
                                            {editMode ? "Edit traits - changes will be verified" : "Extracted traits from your reference"}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        {/* Archetype & Body */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm text-zinc-400 block mb-2">Archetype</label>
                                                {editMode ? (
                                                    <input
                                                        type="text"
                                                        value={editedDna?.archetype || ""}
                                                        onChange={(e) => updateField("archetype", e.target.value)}
                                                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                                    />
                                                ) : (
                                                    <p className="text-zinc-100 font-medium">{displayDna.archetype}</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="text-sm text-zinc-400 block mb-2">Body Type</label>
                                                {editMode ? (
                                                    <input
                                                        type="text"
                                                        value={editedDna?.body_type || ""}
                                                        onChange={(e) => updateField("body_type", e.target.value)}
                                                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                                    />
                                                ) : (
                                                    <p className="text-zinc-100 font-medium">{displayDna.body_type}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Weapon */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm text-zinc-400 block mb-2">Weapon</label>
                                                {editMode ? (
                                                    <input
                                                        type="text"
                                                        value={editedDna?.weapon_type || ""}
                                                        onChange={(e) => updateField("weapon_type", e.target.value)}
                                                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                                        placeholder="None"
                                                    />
                                                ) : (
                                                    <p className="text-zinc-100 font-medium">{displayDna.weapon_type || "None"}</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="text-sm text-zinc-400 block mb-2">Weapon Mass</label>
                                                {editMode ? (
                                                    <select
                                                        value={editedDna?.weapon_mass || "none"}
                                                        onChange={(e) => updateField("weapon_mass", e.target.value as CharacterDNA["weapon_mass"])}
                                                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                                    >
                                                        {WEAPON_MASS_OPTIONS.map((mass) => (
                                                            <option key={mass} value={mass}>
                                                                {mass.charAt(0).toUpperCase() + mass.slice(1)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <p className="text-zinc-100 font-medium capitalize">{displayDna.weapon_mass}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Colors */}
                                        <div>
                                            <label className="text-sm text-zinc-400 block mb-2">Dominant Colors</label>
                                            <div className="flex flex-wrap gap-2">
                                                {displayDna.dominant_colors.map((color, i) => (
                                                    <div
                                                        key={i}
                                                        className="relative group"
                                                    >
                                                        <div
                                                            className="w-10 h-10 rounded-lg border border-zinc-700 cursor-pointer"
                                                            style={{ backgroundColor: color }}
                                                            title={color}
                                                        />
                                                        {editMode && (
                                                            <button
                                                                onClick={() => removeFromArray("dominant_colors", i)}
                                                                className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 rounded-full text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                ✕
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                {editMode && (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="color"
                                                            value={newColor}
                                                            onChange={(e) => setNewColor(e.target.value)}
                                                            className="w-10 h-10 rounded-lg cursor-pointer bg-transparent"
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                addToArray("dominant_colors", newColor);
                                                            }}
                                                            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm hover:bg-zinc-700"
                                                        >
                                                            + Add
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Equipment */}
                                        <div>
                                            <label className="text-sm text-zinc-400 block mb-2">Equipment</label>
                                            <div className="flex flex-wrap gap-2">
                                                {displayDna.equipment.map((item, i) => (
                                                    <span
                                                        key={i}
                                                        className="px-3 py-1 bg-zinc-800 rounded-full text-sm flex items-center gap-2"
                                                    >
                                                        {item}
                                                        {editMode && (
                                                            <button
                                                                onClick={() => removeFromArray("equipment", i)}
                                                                className="text-red-400 hover:text-red-300"
                                                            >
                                                                ✕
                                                            </button>
                                                        )}
                                                    </span>
                                                ))}
                                                {editMode && (
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={newEquipment}
                                                            onChange={(e) => setNewEquipment(e.target.value)}
                                                            placeholder="Add equipment..."
                                                            className="px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-full text-sm w-32"
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") {
                                                                    addToArray("equipment", newEquipment);
                                                                    setNewEquipment("");
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Special Features */}
                                        <div>
                                            <label className="text-sm text-zinc-400 block mb-2">Special Features</label>
                                            <div className="flex flex-wrap gap-2">
                                                {displayDna.special_features.map((feature, i) => (
                                                    <span
                                                        key={i}
                                                        className="px-3 py-1 bg-violet-600/20 text-violet-300 rounded-full text-sm flex items-center gap-2"
                                                    >
                                                        {feature}
                                                        {editMode && (
                                                            <button
                                                                onClick={() => removeFromArray("special_features", i)}
                                                                className="text-red-400 hover:text-red-300"
                                                            >
                                                                ✕
                                                            </button>
                                                        )}
                                                    </span>
                                                ))}
                                                {editMode && (
                                                    <input
                                                        type="text"
                                                        value={newFeature}
                                                        onChange={(e) => setNewFeature(e.target.value)}
                                                        placeholder="Add feature..."
                                                        className="px-3 py-1 bg-violet-600/20 border border-violet-600/50 rounded-full text-sm w-32 text-violet-300 placeholder:text-violet-500"
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                addToArray("special_features", newFeature);
                                                                setNewFeature("");
                                                            }
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        {/* Constraints */}
                                        <div>
                                            <label className="text-sm text-zinc-400 block mb-2">Anatomical Constraints</label>
                                            <div className="flex flex-wrap gap-2">
                                                {displayDna.anatomical_constraints.map((constraint, i) => (
                                                    <span
                                                        key={i}
                                                        className="px-3 py-1 bg-yellow-600/20 text-yellow-300 rounded-full text-sm flex items-center gap-2"
                                                    >
                                                        {constraint}
                                                        {editMode && (
                                                            <button
                                                                onClick={() => removeFromArray("anatomical_constraints", i)}
                                                                className="text-red-400 hover:text-red-300"
                                                            >
                                                                ✕
                                                            </button>
                                                        )}
                                                    </span>
                                                ))}
                                                {editMode && (
                                                    <input
                                                        type="text"
                                                        value={newConstraint}
                                                        onChange={(e) => setNewConstraint(e.target.value)}
                                                        placeholder="Add constraint..."
                                                        className="px-3 py-1 bg-yellow-600/20 border border-yellow-600/50 rounded-full text-sm w-36 text-yellow-300 placeholder:text-yellow-500"
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                addToArray("anatomical_constraints", newConstraint);
                                                                setNewConstraint("");
                                                            }
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {editMode && (
                                    <Card className="border-dashed border-zinc-700">
                                        <CardContent className="pt-6">
                                            <p className="text-sm text-zinc-400">
                                                💡 <strong>Verification:</strong> When you save, your edits will be verified against the reference image to ensure consistency.
                                                The AI will flag any claims that don't match the visual evidence.
                                            </p>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Responder DNA Display (Dual Mode) */}
                                {generationMode === "dual" && responderDna && (
                                    <Card className="border-amber-500/50">
                                        <CardHeader>
                                            <CardTitle className="text-amber-400">🛡️ Responder DNA</CardTitle>
                                            <CardDescription>
                                                Extracted traits from the responder character
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {/* Archetype & Body */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-sm text-zinc-400 block mb-1">Archetype</label>
                                                    <p className="text-zinc-100 font-medium">{responderDna.archetype}</p>
                                                </div>
                                                <div>
                                                    <label className="text-sm text-zinc-400 block mb-1">Body Type</label>
                                                    <p className="text-zinc-100 font-medium">{responderDna.body_type}</p>
                                                </div>
                                            </div>

                                            {/* Weapon */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-sm text-zinc-400 block mb-1">Weapon</label>
                                                    <p className="text-zinc-100 font-medium">{responderDna.weapon_type || "None"}</p>
                                                </div>
                                                <div>
                                                    <label className="text-sm text-zinc-400 block mb-1">Weapon Mass</label>
                                                    <p className="text-zinc-100 font-medium capitalize">{responderDna.weapon_mass}</p>
                                                </div>
                                            </div>

                                            {/* Colors */}
                                            <div>
                                                <label className="text-sm text-zinc-400 block mb-2">Dominant Colors</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {responderDna.dominant_colors.map((color, i) => (
                                                        <div
                                                            key={i}
                                                            className="w-8 h-8 rounded-lg border border-zinc-700"
                                                            style={{ backgroundColor: color }}
                                                            title={color}
                                                        />
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Equipment */}
                                            {responderDna.equipment.length > 0 && (
                                                <div>
                                                    <label className="text-sm text-zinc-400 block mb-2">Equipment</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {responderDna.equipment.map((item, i) => (
                                                            <span key={i} className="px-3 py-1 bg-zinc-800 rounded-full text-sm">
                                                                {item}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Dual Mode Status */}
                                {generationMode === "dual" && (
                                    <Card className={dna && responderDna ? "border-green-500/50" : "border-amber-500/50"}>
                                        <CardContent className="pt-6">
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">{dna && responderDna ? "✅" : "⏳"}</span>
                                                <div>
                                                    <p className="font-medium">
                                                        {dna && responderDna
                                                            ? "Both DNAs Extracted - Ready!"
                                                            : !referenceImage || !responderImage
                                                                ? "Upload Both Images"
                                                                : "Extract DNA for Both Characters"}
                                                    </p>
                                                    <p className="text-sm text-zinc-400">
                                                        {dna && responderDna
                                                            ? "Proceed to Director Booth to select actions."
                                                            : "Both characters need DNA extraction before proceeding."}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                            </>
                        ) : (
                            <Card className="h-full flex items-center justify-center min-h-[400px]">
                                <CardContent className="text-center text-zinc-500">
                                    <div className="text-6xl mb-4">🧬</div>
                                    <p>Upload a reference image to extract Character DNA</p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </main>

            {/* Unsaved Changes Warning */}
            {hasUnsavedChanges && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-yellow-600/90 text-yellow-100 px-6 py-3 rounded-full shadow-lg flex items-center gap-3 z-50">
                    <span>⚠️ You have unsaved changes</span>
                    <Button size="sm" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save Now"}
                    </Button>
                </div>
            )}
        </div>
    );
}

