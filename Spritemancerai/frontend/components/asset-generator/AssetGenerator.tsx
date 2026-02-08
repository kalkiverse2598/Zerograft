"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Sparkles, Flame, Droplet, Coins, Loader2 } from "lucide-react";

// Types
type AssetType = "character" | "effect" | "tile" | "ui";
type GenerationMode = "prompt" | "preset";

interface Presets {
    effects: string[];
    tiles: string[];
    ui_elements: string[];
    character_styles: string[];
}

interface GenerationResult {
    asset_type: string;
    spritesheet_base64?: string;
    reference_image_base64?: string;
    local_path: string;
    status: string;
    dna?: Record<string, unknown>;
    preset_used?: string;
    project_id?: string;
    spritesheet_url?: string;
    frame_urls?: string[];
}

// Asset type configuration
const ASSET_TYPES = [
    { id: "character" as const, label: "Character", icon: Sparkles, color: "violet" },
    { id: "effect" as const, label: "VFX Effect", icon: Flame, color: "orange" },
    { id: "tile" as const, label: "Tile", icon: Droplet, color: "cyan" },
    { id: "ui" as const, label: "UI Element", icon: Coins, color: "yellow" },
];

const SIZE_OPTIONS = ["16x16", "32x32", "64x64", "128x128"];
const FRAME_OPTIONS = [4, 6, 8, 12];

// Default presets (fetched from API on mount)
const DEFAULT_PRESETS: Presets = {
    effects: ["fire_explosion", "sword_slash", "magic_burst", "hit_spark", "healing_aura"],
    tiles: ["water_calm", "lava_bubble", "torch_flame", "grass_wind", "crystal_glow"],
    ui_elements: ["gold_coin", "red_gem", "heart_pulse", "star_twinkle", "key_shine"],
    character_styles: ["8bit_retro", "16bit_snes", "modern_pixel", "hd_pixel"],
};

export function AssetGenerator() {
    // State
    const [assetType, setAssetType] = useState<AssetType>("character");
    const [mode, setMode] = useState<GenerationMode>("prompt");
    const [prompt, setPrompt] = useState("");
    const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
    const [selectedStyle, setSelectedStyle] = useState("modern_pixel");
    const [size, setSize] = useState("32x32");
    const [frameCount, setFrameCount] = useState(6);
    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState<GenerationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [presets] = useState<Presets>(DEFAULT_PRESETS);

    // Character animation specific
    const [actionType, setActionType] = useState("idle");
    const [difficultyTier, setDifficultyTier] = useState("LIGHT");
    const [generateFullAnimation, setGenerateFullAnimation] = useState(false);

    const ACTION_TYPES = ["idle", "walk", "run", "attack", "jump", "hit", "death"];
    const DIFFICULTY_TIERS = ["LIGHT", "HEAVY", "BOSS"];

    // Get presets for current asset type
    const getPresetsForType = useCallback(() => {
        switch (assetType) {
            case "effect": return presets.effects;
            case "tile": return presets.tiles;
            case "ui": return presets.ui_elements;
            case "character": return presets.character_styles;
            default: return [];
        }
    }, [assetType, presets]);

    // Generate asset
    const handleGenerate = async () => {
        setIsGenerating(true);
        setError(null);
        setResult(null);

        try {
            const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

            let endpoint: string;
            let body: Record<string, unknown>;

            if (assetType === "character") {
                // Check if generating full animation or just reference
                if (generateFullAnimation) {
                    endpoint = `${API_BASE}/api/ai/generate-character-animation`;
                    body = {
                        description: prompt,
                        action_type: actionType,
                        difficulty_tier: difficultyTier,
                        size,
                        style: selectedStyle,
                        perspective: "side",
                        remove_background: true,
                    };
                } else {
                    endpoint = `${API_BASE}/api/ai/generate-character`;
                    body = {
                        description: prompt,
                        size,
                        style: selectedStyle,
                        perspective: "side",
                    };
                }
            } else if (assetType === "effect") {
                endpoint = `${API_BASE}/api/ai/generate-effect`;
                body = mode === "preset" ? { preset: selectedPreset, frame_count: frameCount, size }
                    : { prompt, frame_count: frameCount, size };
            } else if (assetType === "tile") {
                endpoint = `${API_BASE}/api/ai/generate-tile`;
                body = mode === "preset" ? { preset: selectedPreset, frame_count: frameCount, size, seamless: true }
                    : { prompt, frame_count: frameCount, size, seamless: true };
            } else {
                endpoint = `${API_BASE}/api/ai/generate-ui`;
                body = mode === "preset" ? { preset: selectedPreset, frame_count: frameCount, size }
                    : { prompt, frame_count: frameCount, size };
            }

            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || "Generation failed");
            }

            const data = await response.json();
            setResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error occurred");
        } finally {
            setIsGenerating(false);
        }
    };

    // Get the image to display
    const getResultImage = () => {
        if (!result) return null;
        return result.spritesheet_base64 || result.reference_image_base64;
    };

    return (
        <div className="min-h-screen bg-zinc-950 p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold gradient-text">Universal Asset Generator</h1>
                    <p className="text-zinc-400 mt-2">Generate characters, effects, tiles, and UI elements with AI</p>
                </div>

                {/* Asset Type Selector */}
                <Card variant="glass" className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-lg">Asset Type</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-4 gap-3">
                            {ASSET_TYPES.map((type) => {
                                const Icon = type.icon;
                                const isSelected = assetType === type.id;
                                return (
                                    <button
                                        key={type.id}
                                        onClick={() => { setAssetType(type.id); setSelectedPreset(null); }}
                                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${isSelected
                                            ? "border-violet-500 bg-violet-500/10"
                                            : "border-zinc-700 hover:border-zinc-600 bg-zinc-800/50"
                                            }`}
                                    >
                                        <Icon className={`w-6 h-6 ${isSelected ? "text-violet-400" : "text-zinc-400"}`} />
                                        <span className={`text-sm font-medium ${isSelected ? "text-violet-300" : "text-zinc-300"}`}>
                                            {type.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Mode Toggle + Options */}
                <Card variant="glass" className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-lg">Generation Options</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Mode Toggle */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setMode("prompt")}
                                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${mode === "prompt"
                                    ? "bg-violet-600 text-white"
                                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                                    }`}
                            >
                                ✍️ Text Prompt
                            </button>
                            <button
                                onClick={() => setMode("preset")}
                                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${mode === "preset"
                                    ? "bg-violet-600 text-white"
                                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                                    }`}
                            >
                                🎨 Use Preset
                            </button>
                        </div>

                        {/* Prompt Input */}
                        {mode === "prompt" && (
                            <div>
                                <label className="block text-sm text-zinc-400 mb-2">
                                    Describe your {assetType}:
                                </label>
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder={
                                        assetType === "character" ? "A fire mage with flowing red robes and a glowing staff..." :
                                            assetType === "effect" ? "A magical ice explosion with blue and white crystals shattering..." :
                                                assetType === "tile" ? "Blue ocean water with gentle ripple animation..." :
                                                    "A golden coin spinning with sparkle effects..."
                                    }
                                    className="w-full h-24 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder:text-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                            </div>
                        )}

                        {/* Preset Selector */}
                        {mode === "preset" && (
                            <div>
                                <label className="block text-sm text-zinc-400 mb-2">
                                    Select {assetType === "character" ? "style" : "preset"}:
                                </label>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 hover:bg-zinc-700">
                                            <span>{assetType === "character" ? selectedStyle : (selectedPreset || "Select a preset...")}</span>
                                            <ChevronDown className="w-4 h-4" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-64 bg-zinc-900 border-zinc-700">
                                        <DropdownMenuLabel className="text-zinc-400">
                                            Available {assetType === "character" ? "Styles" : "Presets"}
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator className="bg-zinc-700" />
                                        {getPresetsForType().map((preset) => (
                                            <DropdownMenuItem
                                                key={preset}
                                                onClick={() => assetType === "character" ? setSelectedStyle(preset) : setSelectedPreset(preset)}
                                                className="text-zinc-100 focus:bg-violet-600/20 focus:text-violet-300 cursor-pointer"
                                            >
                                                {preset.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}

                        {/* Character Animation Options */}
                        {assetType === "character" && mode === "prompt" && (
                            <div className="space-y-4 pt-2 border-t border-zinc-700">
                                {/* Animation Toggle */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="text-sm font-medium text-zinc-200">Generate Full Animation</label>
                                        <p className="text-xs text-zinc-500">Create complete spritesheet with animation frames</p>
                                    </div>
                                    <button
                                        onClick={() => setGenerateFullAnimation(!generateFullAnimation)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${generateFullAnimation ? "bg-violet-600" : "bg-zinc-700"
                                            }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${generateFullAnimation ? "translate-x-6" : "translate-x-1"
                                                }`}
                                        />
                                    </button>
                                </div>

                                {/* Animation Settings (shown when toggle is ON) */}
                                {generateFullAnimation && (
                                    <div className="grid grid-cols-2 gap-4 p-3 bg-violet-950/30 rounded-lg border border-violet-800/50">
                                        {/* Action Type */}
                                        <div>
                                            <label className="block text-xs text-violet-300 mb-1">Action Type:</label>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button className="w-full flex items-center justify-between px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 hover:bg-zinc-700 text-sm">
                                                        <span>{actionType.charAt(0).toUpperCase() + actionType.slice(1)}</span>
                                                        <ChevronDown className="w-3 h-3" />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent className="bg-zinc-900 border-zinc-700">
                                                    {ACTION_TYPES.map((action) => (
                                                        <DropdownMenuItem
                                                            key={action}
                                                            onClick={() => setActionType(action)}
                                                            className="text-zinc-100 focus:bg-violet-600/20 cursor-pointer"
                                                        >
                                                            {action.charAt(0).toUpperCase() + action.slice(1)}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        {/* Difficulty */}
                                        <div>
                                            <label className="block text-xs text-violet-300 mb-1">Complexity:</label>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button className="w-full flex items-center justify-between px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 hover:bg-zinc-700 text-sm">
                                                        <span>{difficultyTier}</span>
                                                        <ChevronDown className="w-3 h-3" />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent className="bg-zinc-900 border-zinc-700">
                                                    {DIFFICULTY_TIERS.map((tier) => (
                                                        <DropdownMenuItem
                                                            key={tier}
                                                            onClick={() => setDifficultyTier(tier)}
                                                            className="text-zinc-100 focus:bg-violet-600/20 cursor-pointer"
                                                        >
                                                            {tier} ({tier === "LIGHT" ? "4-6 frames" : tier === "HEAVY" ? "8-12 frames" : "16+ frames"})
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Size and Frame Count */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-2">Size:</label>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="w-full flex items-center justify-between px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 hover:bg-zinc-700">
                                            <span>{size}</span>
                                            <ChevronDown className="w-4 h-4" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="bg-zinc-900 border-zinc-700">
                                        {SIZE_OPTIONS.map((s) => (
                                            <DropdownMenuItem
                                                key={s}
                                                onClick={() => setSize(s)}
                                                className="text-zinc-100 focus:bg-violet-600/20 cursor-pointer"
                                            >
                                                {s}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {assetType !== "character" && (
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-2">Frames:</label>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button className="w-full flex items-center justify-between px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 hover:bg-zinc-700">
                                                <span>{frameCount} frames</span>
                                                <ChevronDown className="w-4 h-4" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="bg-zinc-900 border-zinc-700">
                                            {FRAME_OPTIONS.map((f) => (
                                                <DropdownMenuItem
                                                    key={f}
                                                    onClick={() => setFrameCount(f)}
                                                    className="text-zinc-100 focus:bg-violet-600/20 cursor-pointer"
                                                >
                                                    {f} frames
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Generate Button */}
                <Button
                    size="lg"
                    onClick={handleGenerate}
                    disabled={isGenerating || (mode === "prompt" && !prompt.trim()) || (mode === "preset" && assetType !== "character" && !selectedPreset)}
                    className="w-full animate-pulse-glow"
                    isLoading={isGenerating}
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Generating...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-5 h-5 mr-2" />
                            Generate {ASSET_TYPES.find(t => t.id === assetType)?.label}
                        </>
                    )}
                </Button>

                {/* Error Display */}
                {error && (
                    <Card variant="glass" className="bg-red-950/30 border-red-800">
                        <CardContent className="py-4">
                            <p className="text-red-400">❌ {error}</p>
                        </CardContent>
                    </Card>
                )}

                {/* Result Preview */}
                {result && (
                    <Card variant="glass" className="bg-zinc-900/50 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                ✅ Generated Successfully
                                {result.preset_used && (
                                    <span className="text-xs bg-violet-600/30 text-violet-300 px-2 py-1 rounded">
                                        Preset: {result.preset_used}
                                    </span>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Image Preview */}
                            {getResultImage() && (
                                <div className="flex justify-center">
                                    <div className="relative bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                                        <img
                                            src={`data:image/png;base64,${getResultImage()}`}
                                            alt="Generated sprite"
                                            className="max-w-full h-auto rounded"
                                            style={{ imageRendering: "pixelated" }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* DNA Info */}
                            {result.dna && (
                                <div className="bg-zinc-800/50 rounded-lg p-4">
                                    <h4 className="text-sm font-medium text-zinc-300 mb-2">Extracted DNA:</h4>
                                    <pre className="text-xs text-zinc-400 overflow-x-auto">
                                        {JSON.stringify(result.dna, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {/* Download Button */}
                            {getResultImage() && (
                                <div className="flex gap-3">
                                    {result.project_id && (
                                        <Button
                                            variant="primary"
                                            className="flex-1"
                                            onClick={() => {
                                                window.location.href = `/projects/${result.project_id}/preview`;
                                            }}
                                        >
                                            🎬 Preview & Edit Frames
                                        </Button>
                                    )}
                                    <Button
                                        variant="secondary"
                                        onClick={() => {
                                            const link = document.createElement("a");
                                            link.href = `data:image/png;base64,${getResultImage()}`;
                                            link.download = `${assetType}_${Date.now()}.png`;
                                            link.click();
                                        }}
                                    >
                                        📥 Download
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
