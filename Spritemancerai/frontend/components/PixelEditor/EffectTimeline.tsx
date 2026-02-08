"use client";

import React, { useMemo } from "react";
import {
    EffectEvent,
    EffectLayer,
    EFFECT_PRESETS,
    getEventsOnFrame
} from "@/lib/effects/effectTypes";
import { Sparkles, Eye, EyeOff, Trash2, Plus } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface EffectTimelineProps {
    layers: EffectLayer[];
    currentFrame: number;
    totalFrames: number;
    onLayerToggle: (layerId: string) => void;
    onLayerDelete: (layerId: string) => void;
    onEventSelect: (event: EffectEvent) => void;
    onEventDelete: (layerId: string, eventId: string) => void;
    onAddEvent: (layerId: string, triggerFrame: number) => void;
    selectedEventId?: string;
}

// ============================================================================
// Effect Color Mapping
// ============================================================================

const EFFECT_TYPE_COLORS: Record<string, string> = {
    particle: 'bg-yellow-500/80',
    fluid: 'bg-purple-500/80',
    break: 'bg-orange-500/80',
    smear: 'bg-blue-500/80',
    slash: 'bg-red-500/80',
};

// ============================================================================
// Component
// ============================================================================

export function EffectTimeline({
    layers,
    currentFrame,
    totalFrames,
    onLayerToggle,
    onLayerDelete,
    onEventSelect,
    onEventDelete,
    onAddEvent,
    selectedEventId,
}: EffectTimelineProps) {
    // Generate frame markers
    const frameMarkers = useMemo(() => {
        return Array.from({ length: totalFrames }, (_, i) => i);
    }, [totalFrames]);

    // Calculate event position and width as percentage
    const getEventStyle = (event: EffectEvent) => {
        const left = (event.trigger_frame / totalFrames) * 100;
        const width = (event.duration_frames / totalFrames) * 100;
        return {
            left: `${left}%`,
            width: `${Math.max(width, 3)}%`, // Minimum 3% for visibility
        };
    };

    if (layers.length === 0) {
        return (
            <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-4">
                <div className="flex items-center gap-2 text-zinc-500 text-sm">
                    <Sparkles className="w-4 h-4" />
                    <span>No effect layers. Add effects from the VFX panel to see them here.</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-800/50 border-b border-zinc-700">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-medium text-white">Effect Timeline</span>
                </div>
                <span className="text-xs text-zinc-500">{layers.length} layer(s)</span>
            </div>

            {/* Frame ruler */}
            <div className="flex px-[100px] border-b border-zinc-800 bg-zinc-900/30">
                <div className="flex w-full">
                    {frameMarkers.map((frame) => (
                        <div
                            key={frame}
                            className={`flex-1 text-center text-[10px] py-1 border-l border-zinc-800 ${frame === currentFrame
                                    ? 'bg-purple-600/30 text-purple-300'
                                    : 'text-zinc-600'
                                }`}
                        >
                            {frame}
                        </div>
                    ))}
                </div>
            </div>

            {/* Effect layers */}
            <div className="divide-y divide-zinc-800">
                {layers.map((layer) => (
                    <div key={layer.id} className="flex">
                        {/* Layer controls */}
                        <div className="w-[100px] flex-shrink-0 flex items-center gap-1 px-2 py-2 bg-zinc-900">
                            <button
                                onClick={() => onLayerToggle(layer.id)}
                                className="p-1 hover:bg-zinc-700 rounded"
                                title={layer.visible ? "Hide layer" : "Show layer"}
                            >
                                {layer.visible ? (
                                    <Eye className="w-3 h-3 text-zinc-400" />
                                ) : (
                                    <EyeOff className="w-3 h-3 text-zinc-600" />
                                )}
                            </button>
                            <span
                                className={`flex-1 text-xs truncate ${layer.visible ? 'text-zinc-300' : 'text-zinc-600'
                                    }`}
                            >
                                {layer.name}
                            </span>
                            <button
                                onClick={() => onLayerDelete(layer.id)}
                                className="p-1 hover:bg-red-900/50 rounded opacity-50 hover:opacity-100"
                                title="Delete layer"
                            >
                                <Trash2 className="w-3 h-3 text-red-400" />
                            </button>
                        </div>

                        {/* Timeline track */}
                        <div
                            className={`flex-1 relative h-8 bg-zinc-950/50 ${!layer.visible ? 'opacity-40' : ''
                                }`}
                            onClick={(e) => {
                                // Add event on double-click
                                if (e.detail === 2) {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const x = e.clientX - rect.left;
                                    const frame = Math.floor((x / rect.width) * totalFrames);
                                    onAddEvent(layer.id, frame);
                                }
                            }}
                        >
                            {/* Current frame indicator */}
                            <div
                                className="absolute top-0 bottom-0 w-0.5 bg-purple-500 z-10 pointer-events-none"
                                style={{ left: `${(currentFrame / totalFrames) * 100}%` }}
                            />

                            {/* Effect event blocks */}
                            {layer.events.map((event) => {
                                const preset = EFFECT_PRESETS[event.preset];
                                const colorClass = EFFECT_TYPE_COLORS[event.effect_type] || 'bg-zinc-500/80';
                                const isSelected = selectedEventId === event.id;

                                return (
                                    <div
                                        key={event.id}
                                        className={`absolute top-1 bottom-1 rounded cursor-pointer transition-all
                                            ${colorClass}
                                            ${isSelected ? 'ring-2 ring-white' : 'hover:brightness-110'}
                                        `}
                                        style={getEventStyle(event)}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEventSelect(event);
                                        }}
                                        title={`${preset?.name || event.preset} (Frame ${event.trigger_frame}-${event.trigger_frame + event.duration_frames - 1})`}
                                    >
                                        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                                            <span className="text-[9px] font-medium text-white/90 truncate px-1">
                                                {preset?.icon || '✨'} {preset?.name || event.preset}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Empty state hint */}
                            {layer.events.length === 0 && (
                                <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-xs">
                                    Double-click to add effect
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer hint */}
            <div className="px-3 py-1.5 bg-zinc-900/50 border-t border-zinc-800">
                <p className="text-[10px] text-zinc-600">
                    Double-click timeline to add • Click event to select • Effects sync with animation playback
                </p>
            </div>
        </div>
    );
}

export default EffectTimeline;
