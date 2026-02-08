"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Loader2, Download, Plus, Palette } from "lucide-react";
import { api } from "@/lib/api";

interface ParticleLibraryProps {
    /** Colors from DNA for palette matching */
    dnaPalette?: string[];
    /** Callback when a particle is generated */
    onParticleGenerated?: (imageBase64: string, frameCount: number, size: number) => void;
}

// Particle type icons/emojis
const PARTICLE_ICONS: Record<string, string> = {
    dust: "💨",
    blood: "🩸",
    spark: "⚡",
    magic: "✨",
    smoke: "🌫️",
    fire: "🔥",
    water: "💧",
    leaf: "🍃",
};

const SIZE_OPTIONS = [16, 32, 64];
const FRAME_COUNT_OPTIONS = [2, 4, 6, 8];

export function ParticleLibrary({ dnaPalette, onParticleGenerated }: ParticleLibraryProps) {
    const [particleTypes, setParticleTypes] = useState<string[]>([]);
    const [descriptions, setDescriptions] = useState<Record<string, string>>({});
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [selectedSize, setSelectedSize] = useState(32);
    const [frameCount, setFrameCount] = useState(4);
    const [useDnaPalette, setUseDnaPalette] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedParticle, setGeneratedParticle] = useState<{
        imageBase64: string;
        width: number;
        height: number;
        frameCount: number;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Fetch available particle types on mount
    useEffect(() => {
        const fetchTypes = async () => {
            setIsLoading(true);
            try {
                const result = await api.getParticleTypes();
                setParticleTypes(result.types);
                setDescriptions(result.descriptions);
                if (result.types.length > 0) {
                    setSelectedType(result.types[0]);
                }
            } catch (err) {
                console.error("Failed to fetch particle types:", err);
                // Fallback types if API fails
                setParticleTypes(["dust", "blood", "spark", "magic", "smoke", "fire"]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTypes();
    }, []);

    const handleGenerate = async () => {
        if (!selectedType) return;

        setIsGenerating(true);
        setError(null);

        try {
            const result = await api.generateParticles(selectedType, {
                palette: useDnaPalette && dnaPalette?.length ? dnaPalette : undefined,
                size: selectedSize,
                frameCount,
            });

            setGeneratedParticle({
                imageBase64: result.image_base64,
                width: result.width,
                height: result.height,
                frameCount: result.frame_count,
            });

            onParticleGenerated?.(result.image_base64, result.frame_count, selectedSize);
        } catch (err) {
            console.error("Failed to generate particle:", err);
            setError(err instanceof Error ? err.message : "Failed to generate particle");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!generatedParticle) return;

        const link = document.createElement("a");
        link.href = `data:image/png;base64,${generatedParticle.imageBase64}`;
        link.download = `particle_${selectedType}_${selectedSize}px.png`;
        link.click();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Particle Type Grid */}
            <div>
                <label className="text-xs font-medium text-zinc-400 mb-2 block">Effect Type</label>
                <div className="grid grid-cols-4 gap-2">
                    {particleTypes.map((type) => (
                        <button
                            key={type}
                            onClick={() => setSelectedType(type)}
                            className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${selectedType === type
                                    ? "border-violet-500 bg-violet-500/20 text-white"
                                    : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-500"
                                }`}
                            title={descriptions[type] || type}
                        >
                            <span className="text-xl">{PARTICLE_ICONS[type] || "✨"}</span>
                            <span className="text-xs capitalize">{type}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Size Selector */}
            <div>
                <label className="text-xs font-medium text-zinc-400 mb-2 block">Size</label>
                <div className="flex gap-2">
                    {SIZE_OPTIONS.map((size) => (
                        <button
                            key={size}
                            onClick={() => setSelectedSize(size)}
                            className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${selectedSize === size
                                    ? "border-violet-500 bg-violet-500/20 text-white"
                                    : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-500"
                                }`}
                        >
                            {size}px
                        </button>
                    ))}
                </div>
            </div>

            {/* Frame Count */}
            <div>
                <label className="text-xs font-medium text-zinc-400 mb-2 block">Animation Frames</label>
                <div className="flex gap-2">
                    {FRAME_COUNT_OPTIONS.map((count) => (
                        <button
                            key={count}
                            onClick={() => setFrameCount(count)}
                            className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${frameCount === count
                                    ? "border-violet-500 bg-violet-500/20 text-white"
                                    : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-500"
                                }`}
                        >
                            {count}
                        </button>
                    ))}
                </div>
            </div>

            {/* DNA Palette Toggle */}
            {dnaPalette && dnaPalette.length > 0 && (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4 text-zinc-400" />
                        <span className="text-sm text-zinc-300">Use DNA Palette</span>
                    </div>
                    <button
                        onClick={() => setUseDnaPalette(!useDnaPalette)}
                        className={`w-12 h-6 rounded-full transition-colors ${useDnaPalette ? "bg-violet-500" : "bg-zinc-700"
                            }`}
                    >
                        <div
                            className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${useDnaPalette ? "translate-x-6" : "translate-x-0.5"
                                }`}
                        />
                    </button>
                </div>
            )}

            {/* DNA Palette Preview */}
            {useDnaPalette && dnaPalette && dnaPalette.length > 0 && (
                <div className="flex gap-1">
                    {dnaPalette.slice(0, 8).map((color, i) => (
                        <div
                            key={i}
                            className="w-6 h-6 rounded border border-zinc-600"
                            style={{ backgroundColor: color }}
                            title={color}
                        />
                    ))}
                </div>
            )}

            {/* Generate Button */}
            <button
                onClick={handleGenerate}
                disabled={!selectedType || isGenerating}
                className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${isGenerating
                        ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white"
                    }`}
            >
                {isGenerating ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Generating with AI...
                    </>
                ) : (
                    <>
                        <Sparkles className="w-5 h-5" />
                        Generate Particle
                    </>
                )}
            </button>

            {/* Error Message */}
            {error && (
                <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 text-sm">
                    {error}
                </div>
            )}

            {/* Generated Particle Preview */}
            {generatedParticle && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-zinc-300">Generated Particle</span>
                        <span className="text-xs text-zinc-500">
                            {generatedParticle.width}x{generatedParticle.height} • {generatedParticle.frameCount} frames
                        </span>
                    </div>

                    {/* Spritesheet Preview */}
                    <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-center border border-zinc-700">
                        <img
                            src={`data:image/png;base64,${generatedParticle.imageBase64}`}
                            alt="Generated particle"
                            className="max-w-full"
                            style={{ imageRendering: "pixelated" }}
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={handleDownload}
                            className="flex-1 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white flex items-center justify-center gap-2 text-sm"
                        >
                            <Download className="w-4 h-4" />
                            Download
                        </button>
                        <button
                            onClick={() => onParticleGenerated?.(
                                generatedParticle.imageBase64,
                                generatedParticle.frameCount,
                                selectedSize
                            )}
                            className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center gap-2 text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Add to Frame
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ParticleLibrary;
