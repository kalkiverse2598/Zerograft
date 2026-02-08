/**
 * PresetSelector Component
 * 
 * Visual grid of preset thumbnails organized by category.
 * Shows tabs for each category and a grid of presets within.
 */

'use client';

import React from 'react';
import type { TilesetCategory, Preset } from './types';
import { PRESET_CATEGORIES, PRESETS } from './types';

interface PresetSelectorProps {
    selectedCategory: TilesetCategory;
    onCategoryChange: (category: TilesetCategory) => void;
    selectedPreset: Preset | null;
    onPresetSelect: (preset: Preset) => void;
}

export default function PresetSelector({
    selectedCategory,
    onCategoryChange,
    selectedPreset,
    onPresetSelect,
}: PresetSelectorProps) {
    const categories = Object.entries(PRESET_CATEGORIES) as [TilesetCategory, typeof PRESET_CATEGORIES[TilesetCategory]][];
    const presets = PRESETS[selectedCategory] || [];

    return (
        <div className="preset-selector">
            {/* Category Tabs */}
            <div className="preset-selector__tabs">
                {categories.map(([key, { icon }]) => (
                    <button
                        key={key}
                        className={`preset-selector__tab ${selectedCategory === key ? 'active' : ''}`}
                        onClick={() => onCategoryChange(key)}
                        title={PRESET_CATEGORIES[key].name}
                    >
                        {icon}
                    </button>
                ))}
            </div>

            {/* Category Header */}
            <div className="preset-selector__header">
                <h3>
                    {PRESET_CATEGORIES[selectedCategory].icon}{' '}
                    {PRESET_CATEGORIES[selectedCategory].name}
                </h3>
                <p>{PRESET_CATEGORIES[selectedCategory].description}</p>
            </div>

            {/* Preset Grid */}
            <div className="preset-selector__grid">
                {presets.length > 0 ? (
                    presets.map((preset) => (
                        <button
                            key={preset.id}
                            className={`preset-card ${selectedPreset?.id === preset.id ? 'selected' : ''}`}
                            onClick={() => onPresetSelect(preset)}
                        >
                            <div className="preset-card__thumbnail">
                                {preset.thumbnail ? (
                                    <img src={preset.thumbnail} alt={preset.name} />
                                ) : (
                                    <div className="preset-card__placeholder">
                                        {preset.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <span className="preset-card__name">{preset.name}</span>
                        </button>
                    ))
                ) : (
                    <div className="preset-selector__empty">
                        No presets available for this category
                    </div>
                )}
            </div>

            <style jsx>{`
                .preset-selector {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 16px;
                    padding: 1rem;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                
                .preset-selector__tabs {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                    padding-bottom: 0.75rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    overflow-x: auto;
                }
                
                .preset-selector__tab {
                    width: 40px;
                    height: 40px;
                    border: none;
                    border-radius: 10px;
                    background: rgba(255, 255, 255, 0.05);
                    font-size: 1.2rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    flex-shrink: 0;
                }
                
                .preset-selector__tab:hover {
                    background: rgba(255, 255, 255, 0.1);
                    transform: translateY(-2px);
                }
                
                .preset-selector__tab.active {
                    background: linear-gradient(135deg, #00d2ff, #3a7bd5);
                    box-shadow: 0 4px 12px rgba(0, 210, 255, 0.3);
                }
                
                .preset-selector__header {
                    margin-bottom: 1rem;
                }
                
                .preset-selector__header h3 {
                    font-size: 1.1rem;
                    margin-bottom: 0.25rem;
                }
                
                .preset-selector__header p {
                    font-size: 0.85rem;
                    color: #888;
                }
                
                .preset-selector__grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 0.75rem;
                    max-height: 300px;
                    overflow-y: auto;
                }
                
                .preset-card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 0.75rem;
                    border: 2px solid transparent;
                    border-radius: 12px;
                    background: rgba(255, 255, 255, 0.03);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .preset-card:hover {
                    background: rgba(255, 255, 255, 0.08);
                    border-color: rgba(0, 210, 255, 0.3);
                }
                
                .preset-card.selected {
                    background: rgba(0, 210, 255, 0.15);
                    border-color: #00d2ff;
                }
                
                .preset-card__thumbnail {
                    width: 48px;
                    height: 48px;
                    border-radius: 8px;
                    overflow: hidden;
                    margin-bottom: 0.5rem;
                    background: rgba(0, 0, 0, 0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .preset-card__thumbnail img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    image-rendering: pixelated;
                }
                
                .preset-card__placeholder {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    font-weight: bold;
                    background: linear-gradient(135deg, #3a3a4a 0%, #2a2a3a 100%);
                    color: #666;
                }
                
                .preset-card__name {
                    font-size: 0.75rem;
                    text-align: center;
                    color: #ccc;
                }
                
                .preset-selector__empty {
                    grid-column: span 2;
                    text-align: center;
                    padding: 2rem;
                    color: #666;
                }
            `}</style>
        </div>
    );
}
