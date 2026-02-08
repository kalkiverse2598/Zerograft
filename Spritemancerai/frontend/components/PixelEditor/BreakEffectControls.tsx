"use client";

import React from "react";
import { BreakConfig } from "@/lib/pixelEditor/useBreakEffect";
import { Grid3X3, ArrowDown, RotateCw, Zap, Timer, Loader2 } from "lucide-react";

interface BreakEffectControlsProps {
    config: BreakConfig;
    onConfigChange: (updates: Partial<BreakConfig>) => void;
    onGenerate: () => void;
    isGenerating: boolean;
    disabled?: boolean;
}

export function BreakEffectControls({
    config,
    onConfigChange,
    onGenerate,
    isGenerating,
    disabled = false,
}: BreakEffectControlsProps) {
    return (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <Grid3X3 className="w-5 h-5 text-orange-400" />
                <h3 className="font-semibold text-white">Break / Dissolve Effect</h3>
            </div>

            {/* Description */}
            <p className="text-xs text-zinc-500 mb-4">
                Slice sprite into pieces and animate them flying apart. Creates death/destruction animations.
            </p>

            {/* Controls */}
            <div className={`space-y-4 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
                {/* Grid Size */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm text-zinc-300">Grid X</label>
                            <span className="text-sm text-orange-400 font-mono">{config.gridX}</span>
                        </div>
                        <input
                            type="range"
                            min="2"
                            max="16"
                            value={config.gridX}
                            onChange={(e) => onConfigChange({ gridX: Number(e.target.value) })}
                            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm text-zinc-300">Grid Y</label>
                            <span className="text-sm text-orange-400 font-mono">{config.gridY}</span>
                        </div>
                        <input
                            type="range"
                            min="2"
                            max="16"
                            value={config.gridY}
                            onChange={(e) => onConfigChange({ gridY: Number(e.target.value) })}
                            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                        />
                    </div>
                </div>

                {/* Gravity */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm text-zinc-300">
                            <ArrowDown className="w-4 h-4" />
                            Gravity
                        </label>
                        <span className="text-sm text-orange-400 font-mono">{config.gravity}</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="10"
                        value={config.gravity}
                        onChange={(e) => onConfigChange({ gravity: Number(e.target.value) })}
                        className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                </div>

                {/* Velocity */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm text-zinc-300">
                            <Zap className="w-4 h-4" />
                            Explosion Force
                        </label>
                        <span className="text-sm text-orange-400 font-mono">{config.velocity}</span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="20"
                        value={config.velocity}
                        onChange={(e) => onConfigChange({ velocity: Number(e.target.value) })}
                        className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                </div>

                {/* Rotation Speed */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm text-zinc-300">
                            <RotateCw className="w-4 h-4" />
                            Spin Speed
                        </label>
                        <span className="text-sm text-orange-400 font-mono">{config.rotationSpeed}°</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="360"
                        step="10"
                        value={config.rotationSpeed}
                        onChange={(e) => onConfigChange({ rotationSpeed: Number(e.target.value) })}
                        className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                </div>

                {/* Duration */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm text-zinc-300">
                            <Timer className="w-4 h-4" />
                            Duration
                        </label>
                        <span className="text-sm text-orange-400 font-mono">{config.duration} frames</span>
                    </div>
                    <input
                        type="range"
                        min="5"
                        max="30"
                        value={config.duration}
                        onChange={(e) => onConfigChange({ duration: Number(e.target.value) })}
                        className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                </div>

                {/* Fade Out Toggle */}
                <div className="flex items-center justify-between">
                    <label className="text-sm text-zinc-300">Fade Out Pieces</label>
                    <input
                        type="checkbox"
                        checked={config.fadeOut}
                        onChange={(e) => onConfigChange({ fadeOut: e.target.checked })}
                        className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-orange-500 focus:ring-orange-500"
                    />
                </div>

                {/* Randomness */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-sm text-zinc-300">Randomness</label>
                        <span className="text-sm text-orange-400 font-mono">{Math.round(config.randomness * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={config.randomness}
                        onChange={(e) => onConfigChange({ randomness: Number(e.target.value) })}
                        className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                </div>
            </div>

            {/* Generate Button */}
            <div className="mt-4">
                <button
                    onClick={onGenerate}
                    disabled={isGenerating || disabled}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Generating...
                        </>
                    ) : (
                        <>
                            <Grid3X3 className="w-4 h-4" />
                            Generate Break Animation
                        </>
                    )}
                </button>
                <p className="text-xs text-zinc-600 mt-2 text-center">
                    Creates {config.duration} frames as new animation
                </p>
            </div>
        </div>
    );
}

export default BreakEffectControls;
