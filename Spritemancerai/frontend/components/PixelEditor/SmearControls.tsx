"use client";

import React from "react";
import { SmearConfig } from "@/lib/pixelEditor/useSmearEffect";
import { Blend, Gauge, Waypoints, Layers, Loader2, Wand2 } from "lucide-react";

interface SmearControlsProps {
    config: SmearConfig;
    onConfigChange: (updates: Partial<SmearConfig>) => void;
    onApply?: () => void;
    isApplying?: boolean;
    frameCount?: number;
}

export function SmearControls({
    config,
    onConfigChange,
    onApply,
    isApplying = false,
    frameCount = 0
}: SmearControlsProps) {
    return (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Blend className="w-5 h-5 text-cyan-400" />
                    <h3 className="font-semibold text-white">Motion Blur / Smear</h3>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(e) => onConfigChange({ enabled: e.target.checked })}
                        className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span className="text-sm text-zinc-400">Enable</span>
                </label>
            </div>

            {/* Description */}
            <p className="text-xs text-zinc-500 mb-4">
                Adds motion blur trails between animation frames for fast-moving objects.
            </p>

            {/* Controls */}
            <div className={`space-y-4 ${!config.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                {/* Precision */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm text-zinc-300">
                            <Gauge className="w-4 h-4" />
                            Precision
                        </label>
                        <span className="text-sm text-cyan-400 font-mono">{config.precision}</span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="10"
                        value={config.precision}
                        onChange={(e) => onConfigChange({ precision: Number(e.target.value) })}
                        className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <p className="text-xs text-zinc-600">Higher = smoother trails (slower)</p>
                </div>

                {/* Trail Length */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm text-zinc-300">
                            <Waypoints className="w-4 h-4" />
                            Trail Length
                        </label>
                        <span className="text-sm text-cyan-400 font-mono">{config.trailLength}</span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="5"
                        value={config.trailLength}
                        onChange={(e) => onConfigChange({ trailLength: Number(e.target.value) })}
                        className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <p className="text-xs text-zinc-600">How long the trail persists</p>
                </div>

                {/* Opacity */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-sm text-zinc-300">
                            <Layers className="w-4 h-4" />
                            Trail Opacity
                        </label>
                        <span className="text-sm text-cyan-400 font-mono">{Math.round(config.opacity * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.1"
                        value={config.opacity}
                        onChange={(e) => onConfigChange({ opacity: Number(e.target.value) })}
                        className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                </div>

                {/* Blend Mode */}
                <div className="flex items-center justify-between">
                    <label className="text-sm text-zinc-300">Blend Mode</label>
                    <select
                        value={config.blendMode}
                        onChange={(e) => onConfigChange({ blendMode: e.target.value as 'normal' | 'additive' })}
                        className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 focus:outline-none focus:border-cyan-500"
                    >
                        <option value="normal">Normal</option>
                        <option value="additive">Additive (Glow)</option>
                    </select>
                </div>
            </div>

            {/* Apply Button */}
            {onApply && (
                <div className="mt-4 pt-4 border-t border-zinc-700">
                    <button
                        onClick={onApply}
                        disabled={!config.enabled || isApplying || frameCount < 2}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors"
                    >
                        {isApplying ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Applying...
                            </>
                        ) : (
                            <>
                                <Wand2 className="w-4 h-4" />
                                Apply to Animation
                            </>
                        )}
                    </button>
                    <p className="text-xs text-zinc-600 mt-2 text-center">
                        {frameCount < 2
                            ? "Need at least 2 frames to apply smear"
                            : `Applies motion blur to ${frameCount} frames`
                        }
                    </p>
                </div>
            )}
        </div>
    );
}

export default SmearControls;

