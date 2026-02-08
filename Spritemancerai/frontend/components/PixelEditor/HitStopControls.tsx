"use client";

import React from "react";
import { HitStopConfig } from "@/lib/pixelEditor/useHitStopPreview";
import { Gamepad2, Play, Square, Zap, Move, Sparkles } from "lucide-react";

interface HitStopControlsProps {
    config: HitStopConfig;
    onConfigChange: (updates: Partial<HitStopConfig>) => void;
    impactFrameCount: number;
    isPreviewPlaying: boolean;
    onStartPreview: () => void;
    onStopPreview: () => void;
    onClearImpactFrames: () => void;
}

export function HitStopControls({
    config,
    onConfigChange,
    impactFrameCount,
    isPreviewPlaying,
    onStartPreview,
    onStopPreview,
    onClearImpactFrames,
}: HitStopControlsProps) {
    return (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Gamepad2 className="w-5 h-5 text-violet-400" />
                    <h3 className="font-semibold text-white">Game Feel Preview</h3>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(e) => onConfigChange({ enabled: e.target.checked })}
                        className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-violet-500 focus:ring-violet-500"
                    />
                    <span className="text-sm text-zinc-400">Enable</span>
                </label>
            </div>

            {/* Controls */}
            <div className={`space-y-4 ${!config.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                {/* Freeze Frames */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm text-zinc-300">
                            <Zap className="w-4 h-4" />
                            Freeze Frames
                        </label>
                        <span className="text-sm text-violet-400 font-mono">{config.freezeFrames}</span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="5"
                        value={config.freezeFrames}
                        onChange={(e) => onConfigChange({ freezeFrames: Number(e.target.value) })}
                        className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
                    />
                </div>

                {/* Shake Intensity */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm text-zinc-300">
                            <Move className="w-4 h-4" />
                            Shake Intensity
                        </label>
                        <span className="text-sm text-violet-400 font-mono">{config.shakeIntensity}px</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="4"
                        value={config.shakeIntensity}
                        onChange={(e) => onConfigChange({ shakeIntensity: Number(e.target.value) })}
                        className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
                    />
                </div>

                {/* Shake Duration */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-sm text-zinc-300">Shake Duration</label>
                        <span className="text-sm text-violet-400 font-mono">{config.shakeDuration} frames</span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="5"
                        value={config.shakeDuration}
                        onChange={(e) => onConfigChange({ shakeDuration: Number(e.target.value) })}
                        className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
                    />
                </div>

                {/* White Flash Toggle */}
                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                        <Sparkles className="w-4 h-4" />
                        White Flash
                    </label>
                    <input
                        type="checkbox"
                        checked={config.whiteFlash}
                        onChange={(e) => onConfigChange({ whiteFlash: e.target.checked })}
                        className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-violet-500 focus:ring-violet-500"
                    />
                </div>

                {/* Flash Intensity (if enabled) */}
                {config.whiteFlash && (
                    <div className="space-y-2 pl-6">
                        <div className="flex items-center justify-between">
                            <label className="text-sm text-zinc-400">Flash Intensity</label>
                            <span className="text-sm text-violet-400 font-mono">{Math.round(config.flashIntensity * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.1"
                            value={config.flashIntensity}
                            onChange={(e) => onConfigChange({ flashIntensity: Number(e.target.value) })}
                            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
                        />
                    </div>
                )}
            </div>

            {/* Impact Frames Info */}
            <div className="mt-4 pt-4 border-t border-zinc-800">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">
                        Impact Frames: <span className="text-white font-medium">{impactFrameCount}</span>
                    </span>
                    {impactFrameCount > 0 && (
                        <button
                            onClick={onClearImpactFrames}
                            className="text-xs text-zinc-500 hover:text-zinc-300"
                        >
                            Clear All
                        </button>
                    )}
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                    Right-click frames in timeline to mark as impact
                </p>
            </div>

            {/* Preview Button */}
            <div className="mt-4">
                {isPreviewPlaying ? (
                    <button
                        onClick={onStopPreview}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors"
                    >
                        <Square className="w-4 h-4" />
                        Stop Preview
                    </button>
                ) : (
                    <button
                        onClick={onStartPreview}
                        disabled={!config.enabled || impactFrameCount === 0}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors"
                    >
                        <Play className="w-4 h-4" />
                        Preview with Effects
                    </button>
                )}
            </div>
        </div>
    );
}

export default HitStopControls;
