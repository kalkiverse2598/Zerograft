"use client";

import React from "react";
import { FluidConfig, FluidType, EmitterShape, FLUID_PRESETS } from "@/lib/pixelEditor/useFluidParticles";
import { Flame, Wind, Sparkles, Wand2, Loader2, Droplets, Timer, ArrowDown, Gauge } from "lucide-react";

interface FluidEffectControlsProps {
    config: FluidConfig;
    onConfigChange: (updates: Partial<FluidConfig>) => void;
    onApplyPreset: (preset: FluidType) => void;
    onGenerate: () => void;
    isGenerating: boolean;
    disabled?: boolean;
}

const PRESET_INFO: Record<FluidType, { icon: React.ReactNode; label: string; color: string }> = {
    smoke: { icon: <Wind className="w-4 h-4" />, label: 'Smoke', color: 'text-gray-400' },
    fire: { icon: <Flame className="w-4 h-4" />, label: 'Fire', color: 'text-orange-400' },
    sparks: { icon: <Sparkles className="w-4 h-4" />, label: 'Sparks', color: 'text-yellow-400' },
    magic: { icon: <Wand2 className="w-4 h-4" />, label: 'Magic', color: 'text-purple-400' },
    custom: { icon: <Droplets className="w-4 h-4" />, label: 'Custom', color: 'text-cyan-400' },
};

export function FluidEffectControls({
    config,
    onConfigChange,
    onApplyPreset,
    onGenerate,
    isGenerating,
    disabled = false,
}: FluidEffectControlsProps) {
    const [duration, setDuration] = React.useState(30);

    return (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <Droplets className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-white">Fluid Effects</h3>
            </div>

            {/* Preset Buttons */}
            <div className="grid grid-cols-5 gap-1 mb-4">
                {(Object.keys(PRESET_INFO) as FluidType[]).map((preset) => {
                    const info = PRESET_INFO[preset];
                    const isActive = config.type === preset;
                    return (
                        <button
                            key={preset}
                            onClick={() => onApplyPreset(preset)}
                            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${isActive
                                    ? 'bg-zinc-700 ring-2 ring-blue-500'
                                    : 'bg-zinc-800 hover:bg-zinc-700'
                                }`}
                            title={info.label}
                        >
                            <span className={info.color}>{info.icon}</span>
                            <span className="text-xs text-zinc-400">{info.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Controls */}
            <div className={`space-y-3 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
                {/* Emission Rate */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs text-zinc-300">
                            <Gauge className="w-3 h-3" />
                            Emission Rate
                        </label>
                        <span className="text-xs text-blue-400 font-mono">{config.emissionRate}</span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="50"
                        value={config.emissionRate}
                        onChange={(e) => onConfigChange({ emissionRate: Number(e.target.value) })}
                        className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>

                {/* Gravity */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs text-zinc-300">
                            <ArrowDown className="w-3 h-3" />
                            Gravity
                        </label>
                        <span className="text-xs text-blue-400 font-mono">{config.gravity.toFixed(1)}</span>
                    </div>
                    <input
                        type="range"
                        min="-10"
                        max="10"
                        step="0.5"
                        value={config.gravity}
                        onChange={(e) => onConfigChange({ gravity: Number(e.target.value) })}
                        className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between text-xs text-zinc-600">
                        <span>Rise ↑</span>
                        <span>Fall ↓</span>
                    </div>
                </div>

                {/* Lifetime */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs text-zinc-300">
                            <Timer className="w-3 h-3" />
                            Particle Life
                        </label>
                        <span className="text-xs text-blue-400 font-mono">{config.lifetime} frames</span>
                    </div>
                    <input
                        type="range"
                        min="10"
                        max="120"
                        value={config.lifetime}
                        onChange={(e) => onConfigChange({ lifetime: Number(e.target.value) })}
                        className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>

                {/* Spread */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <label className="text-xs text-zinc-300">Spread Angle</label>
                        <span className="text-xs text-blue-400 font-mono">{config.spread}°</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="180"
                        value={config.spread}
                        onChange={(e) => onConfigChange({ spread: Number(e.target.value) })}
                        className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>

                {/* Turbulence */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <label className="text-xs text-zinc-300">Turbulence</label>
                        <span className="text-xs text-blue-400 font-mono">{Math.round(config.turbulence * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={config.turbulence}
                        onChange={(e) => onConfigChange({ turbulence: Number(e.target.value) })}
                        className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>

                {/* Duration */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <label className="text-xs text-zinc-300">Animation Duration</label>
                        <span className="text-xs text-blue-400 font-mono">{duration} frames</span>
                    </div>
                    <input
                        type="range"
                        min="10"
                        max="60"
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>

                {/* Emitter Shape */}
                <div className="flex items-center justify-between">
                    <label className="text-xs text-zinc-300">Emitter</label>
                    <select
                        value={config.emitterShape}
                        onChange={(e) => onConfigChange({ emitterShape: e.target.value as EmitterShape })}
                        className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
                    >
                        <option value="point">Point</option>
                        <option value="line">Line</option>
                        <option value="circle">Circle</option>
                    </select>
                </div>
            </div>

            {/* Color Preview */}
            <div className="mt-3 pt-3 border-t border-zinc-700">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-zinc-400">Color Gradient:</span>
                </div>
                <div className="flex gap-1">
                    {config.colorGradient.map((color, i) => (
                        <div
                            key={i}
                            className="w-6 h-6 rounded border border-zinc-600"
                            style={{ backgroundColor: color }}
                            title={color}
                        />
                    ))}
                </div>
            </div>

            {/* Generate Button */}
            <div className="mt-4">
                <button
                    onClick={onGenerate}
                    disabled={isGenerating || disabled}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Generating...
                        </>
                    ) : (
                        <>
                            <Droplets className="w-4 h-4" />
                            Generate {duration} Frames
                        </>
                    )}
                </button>
                <p className="text-xs text-zinc-600 mt-2 text-center">
                    Creates particle animation at emitter position
                </p>
            </div>
        </div>
    );
}

export default FluidEffectControls;
