"use client";

import React, { useMemo, useState } from "react";
import {
    EFFECT_PRESETS,
    EffectPreset,
    getPresetsByType,
    EffectType
} from "@/lib/effects/effectTypes";
import { Sparkles, Flame, Wind, Zap, Droplets, Grid3X3, Plus } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface EffectPresetPickerProps {
    onSelect: (presetId: string) => void;
    selectedPreset?: string;
    currentFrame: number;
}

// ============================================================================
// Category Icons
// ============================================================================

const CATEGORY_ICONS: Record<EffectType, React.ReactNode> = {
    slash: <Zap className="w-4 h-4" />,
    particle: <Sparkles className="w-4 h-4" />,
    fluid: <Droplets className="w-4 h-4" />,
    smear: <Wind className="w-4 h-4" />,
    break: <Grid3X3 className="w-4 h-4" />,
};

const CATEGORY_COLORS: Record<EffectType, string> = {
    slash: 'text-red-400 border-red-500/50',
    particle: 'text-yellow-400 border-yellow-500/50',
    fluid: 'text-purple-400 border-purple-500/50',
    smear: 'text-blue-400 border-blue-500/50',
    break: 'text-orange-400 border-orange-500/50',
};

// ============================================================================
// Component
// ============================================================================

export function EffectPresetPicker({
    onSelect,
    selectedPreset,
    currentFrame,
}: EffectPresetPickerProps) {
    const [activeCategory, setActiveCategory] = useState<EffectType | 'all'>('all');

    // Get presets filtered by category
    const filteredPresets = useMemo(() => {
        const allPresets = Object.entries(EFFECT_PRESETS);
        if (activeCategory === 'all') {
            return allPresets;
        }
        return allPresets.filter(([_, preset]) => preset.effect_type === activeCategory);
    }, [activeCategory]);

    // Group presets by category for 'all' view
    const categories = useMemo(() => {
        return ['slash', 'particle', 'fluid', 'smear', 'break'] as EffectType[];
    }, []);

    return (
        <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-3">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium text-white">Effect Presets</span>
                <span className="text-xs text-zinc-500 ml-auto">Frame {currentFrame}</span>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-1 mb-3 p-1 bg-zinc-800/50 rounded-lg">
                <button
                    onClick={() => setActiveCategory('all')}
                    className={`flex-1 py-1.5 text-xs rounded-md transition-colors ${activeCategory === 'all'
                            ? 'bg-zinc-700 text-white'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                >
                    All
                </button>
                {categories.map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`flex items-center justify-center p-1.5 rounded-md transition-colors ${activeCategory === cat
                                ? `bg-zinc-700 ${CATEGORY_COLORS[cat]}`
                                : 'text-zinc-400 hover:text-white'
                            }`}
                        title={cat.charAt(0).toUpperCase() + cat.slice(1)}
                    >
                        {CATEGORY_ICONS[cat]}
                    </button>
                ))}
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {filteredPresets.map(([id, preset]) => (
                    <button
                        key={id}
                        onClick={() => onSelect(id)}
                        className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-left ${selectedPreset === id
                                ? `${CATEGORY_COLORS[preset.effect_type]} bg-zinc-800`
                                : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/50'
                            }`}
                    >
                        <span className="text-lg">{preset.icon}</span>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-white truncate">
                                {preset.name}
                            </div>
                            <div className="text-[10px] text-zinc-500 truncate">
                                {preset.default_duration}f
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Add Hint */}
            <p className="text-[10px] text-zinc-600 mt-2 text-center">
                Select preset, then click timeline to add
            </p>
        </div>
    );
}

export default EffectPresetPicker;
