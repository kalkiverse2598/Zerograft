/**
 * Tileset Builder - Main Page Component
 * 
 * Visual interface for generating and exporting game-ready tilesets.
 * Features:
 * - Preset selector with thumbnails
 * - Real-time tileset preview
 * - Export options (PNG / Godot .tres)
 */

'use client';

import React, { useState, useCallback } from 'react';
import PresetSelector from './PresetSelector';
import TilesetPreview from './TilesetPreview';
import GenerationSettings from './GenerationSettings';
import ExportOptions from './ExportOptions';
import { useTilesetGeneration } from './hooks/useTilesetGeneration';
import type { TilesetCategory, Preset, GenerationOptions, GeneratedTileset } from './types';

export default function TilesetBuilderPage() {
    // Selected preset and settings
    const [selectedCategory, setSelectedCategory] = useState<TilesetCategory>('terrain');
    const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
    const [settings, setSettings] = useState<GenerationOptions>({
        tileSize: 32,
        useDifferenceMatte: false,
        includePhysics: false,
    });

    // Generation state
    const {
        generatedTileset,
        isGenerating,
        isExporting,
        error,
        generateTileset,
        exportAsTres,
        downloadPng,
        downloadTres,
    } = useTilesetGeneration();

    // Handle preset selection
    const handlePresetSelect = useCallback((preset: Preset) => {
        setSelectedPreset(preset);
    }, []);

    // Handle generate button
    const handleGenerate = useCallback(async () => {
        if (!selectedPreset) return;

        await generateTileset({
            preset: selectedPreset.id,
            category: selectedCategory,
            ...settings,
        });
    }, [selectedPreset, selectedCategory, settings, generateTileset]);

    // Handle export as Godot .tres
    const handleExportTres = useCallback(async () => {
        if (!generatedTileset) return;
        await exportAsTres(generatedTileset, settings);
    }, [generatedTileset, settings, exportAsTres]);

    return (
        <div className="tileset-builder">
            <header className="tileset-builder__header">
                <h1>🧱 Tileset Builder</h1>
                <p>Generate game-ready tilesets with AI</p>
            </header>

            <div className="tileset-builder__content">
                {/* Left Panel: Preset Selection */}
                <aside className="tileset-builder__sidebar">
                    <PresetSelector
                        selectedCategory={selectedCategory}
                        onCategoryChange={setSelectedCategory}
                        selectedPreset={selectedPreset}
                        onPresetSelect={handlePresetSelect}
                    />

                    <GenerationSettings
                        settings={settings}
                        onSettingsChange={setSettings}
                    />

                    <button
                        className="tileset-builder__generate-btn"
                        onClick={handleGenerate}
                        disabled={!selectedPreset || isGenerating}
                    >
                        {isGenerating ? (
                            <>
                                <span className="spinner" />
                                Generating...
                            </>
                        ) : (
                            <>✨ Generate Tileset</>
                        )}
                    </button>
                </aside>

                {/* Main Panel: Preview */}
                <main className="tileset-builder__main">
                    {error && (
                        <div className="tileset-builder__error">
                            ❌ {error}
                        </div>
                    )}

                    <TilesetPreview
                        tileset={generatedTileset}
                        isLoading={isGenerating}
                        tileSize={settings.tileSize}
                    />

                    {generatedTileset && (
                        <ExportOptions
                            tileset={generatedTileset}
                            isExporting={isExporting}
                            onDownloadPng={downloadPng}
                            onDownloadTres={handleExportTres}
                            onExportBoth={async () => {
                                downloadPng();
                                await handleExportTres();
                            }}
                        />
                    )}
                </main>
            </div>

            <style jsx>{`
                .tileset-builder {
                    min-height: 100vh;
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    color: #fff;
                    padding: 2rem;
                }
                
                .tileset-builder__header {
                    text-align: center;
                    margin-bottom: 2rem;
                }
                
                .tileset-builder__header h1 {
                    font-size: 2.5rem;
                    margin-bottom: 0.5rem;
                    background: linear-gradient(135deg, #00d2ff, #3a7bd5);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                
                .tileset-builder__header p {
                    color: #888;
                    font-size: 1.1rem;
                }
                
                .tileset-builder__content {
                    display: grid;
                    grid-template-columns: 320px 1fr;
                    gap: 2rem;
                    max-width: 1400px;
                    margin: 0 auto;
                }
                
                .tileset-builder__sidebar {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                
                .tileset-builder__generate-btn {
                    width: 100%;
                    padding: 1rem;
                    font-size: 1.1rem;
                    font-weight: 600;
                    border: none;
                    border-radius: 12px;
                    background: linear-gradient(135deg, #00d2ff, #3a7bd5);
                    color: white;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                }
                
                .tileset-builder__generate-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 20px rgba(0, 210, 255, 0.3);
                }
                
                .tileset-builder__generate-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                
                .tileset-builder__main {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                
                .tileset-builder__error {
                    padding: 1rem;
                    background: rgba(255, 82, 82, 0.2);
                    border: 1px solid #ff5252;
                    border-radius: 8px;
                }
                
                .spinner {
                    width: 20px;
                    height: 20px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                
                @media (max-width: 1024px) {
                    .tileset-builder__content {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
}
