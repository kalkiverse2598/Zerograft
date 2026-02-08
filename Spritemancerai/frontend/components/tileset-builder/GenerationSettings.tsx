/**
 * GenerationSettings Component
 * 
 * Configuration panel for tileset generation options.
 */

'use client';

import React from 'react';
import type { GenerationOptions } from './types';

interface GenerationSettingsProps {
    settings: GenerationOptions;
    onSettingsChange: (settings: GenerationOptions) => void;
}

export default function GenerationSettings({
    settings,
    onSettingsChange,
}: GenerationSettingsProps) {
    const tileSizeOptions = [16, 32, 48, 64];

    const updateSetting = <K extends keyof GenerationOptions>(
        key: K,
        value: GenerationOptions[K]
    ) => {
        onSettingsChange({ ...settings, [key]: value });
    };

    return (
        <div className="generation-settings">
            <h4>⚙️ Settings</h4>

            {/* Tile Size */}
            <div className="setting-group">
                <label>Tile Size</label>
                <div className="button-group">
                    {tileSizeOptions.map((size) => (
                        <button
                            key={size}
                            className={`size-btn ${settings.tileSize === size ? 'active' : ''}`}
                            onClick={() => updateSetting('tileSize', size)}
                        >
                            {size}px
                        </button>
                    ))}
                </div>
            </div>

            {/* Difference Matte Toggle */}
            <div className="setting-group">
                <label className="toggle-label">
                    <input
                        type="checkbox"
                        checked={settings.useDifferenceMatte}
                        onChange={(e) => updateSetting('useDifferenceMatte', e.target.checked)}
                    />
                    <span>High-Quality Alpha</span>
                </label>
                <span className="setting-hint">
                    Better transparency, slower generation
                </span>
            </div>

            {/* Include Physics */}
            <div className="setting-group">
                <label className="toggle-label">
                    <input
                        type="checkbox"
                        checked={settings.includePhysics}
                        onChange={(e) => updateSetting('includePhysics', e.target.checked)}
                    />
                    <span>Include Physics Layers</span>
                </label>
                <span className="setting-hint">
                    Add collision shapes to .tres export
                </span>
            </div>

            <style jsx>{`
                .generation-settings {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 16px;
                    padding: 1rem;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                
                .generation-settings h4 {
                    font-size: 1rem;
                    margin-bottom: 1rem;
                    color: #fff;
                }
                
                .setting-group {
                    margin-bottom: 1rem;
                }
                
                .setting-group label {
                    display: block;
                    font-size: 0.85rem;
                    color: #aaa;
                    margin-bottom: 0.5rem;
                }
                
                .button-group {
                    display: flex;
                    gap: 0.5rem;
                }
                
                .size-btn {
                    flex: 1;
                    padding: 0.5rem;
                    border: none;
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.05);
                    color: #aaa;
                    cursor: pointer;
                    font-size: 0.85rem;
                    transition: all 0.2s ease;
                }
                
                .size-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
                
                .size-btn.active {
                    background: linear-gradient(135deg, #00d2ff, #3a7bd5);
                    color: #000;
                }
                
                .toggle-label {
                    display: flex !important;
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                }
                
                .toggle-label input {
                    width: 18px;
                    height: 18px;
                    cursor: pointer;
                    accent-color: #00d2ff;
                }
                
                .toggle-label span {
                    color: #ccc;
                }
                
                .setting-hint {
                    display: block;
                    font-size: 0.75rem;
                    color: #666;
                    margin-top: 0.25rem;
                    margin-left: 26px;
                }
            `}</style>
        </div>
    );
}
