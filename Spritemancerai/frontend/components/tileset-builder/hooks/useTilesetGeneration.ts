/**
 * useTilesetGeneration Hook
 * 
 * React hook for tileset generation API calls.
 */

'use client';

import { useState, useCallback } from 'react';
import type { GeneratedTileset, TilesetCategory } from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface GenerateOptions {
    preset: string;
    category: TilesetCategory;
    tileSize: number;
    useDifferenceMatte: boolean;
}

interface GenerationSettings {
    tileSize: number;
    includePhysics: boolean;
    terrainName?: string;
    terrainColor?: string;
}

export function useTilesetGeneration() {
    const [generatedTileset, setGeneratedTileset] = useState<GeneratedTileset | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Map category to API endpoint
    const getEndpoint = (category: TilesetCategory): string => {
        const endpoints: Record<TilesetCategory, string> = {
            terrain: '/api/tilesets/generate-terrain-tileset',
            platform: '/api/tilesets/generate-platform-tiles',
            wall: '/api/tilesets/generate-wall-tileset',
            decoration: '/api/tilesets/generate-decoration',
            transition: '/api/tilesets/generate-transition-tiles',
            animated: '/api/tilesets/generate-animated-tile',
        };
        return endpoints[category];
    };

    // Generate tileset
    const generateTileset = useCallback(async (options: GenerateOptions) => {
        setIsGenerating(true);
        setError(null);

        try {
            const endpoint = getEndpoint(options.category);
            const response = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    preset: options.preset,
                    tile_size: options.tileSize,
                    use_difference_matte: options.useDifferenceMatte,
                }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Generation failed');
            }

            const result = await response.json();

            setGeneratedTileset({
                imageBase64: result.image_base64,
                tileSize: result.tile_size || options.tileSize,
                tileCount: result.tile_count || 9,
                category: options.category,
                presetId: options.preset,
                presetName: options.preset.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            console.error('Tileset generation failed:', err);
        } finally {
            setIsGenerating(false);
        }
    }, []);

    // Export as Godot .tres
    const exportAsTres = useCallback(async (
        tileset: GeneratedTileset,
        settings: GenerationSettings
    ) => {
        setIsExporting(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE}/api/tilesets/export-tileset-resource`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tileset_image_base64: tileset.imageBase64,
                    tile_size: settings.tileSize,
                    tileset_type: tileset.category,
                    texture_path: `res://sprites/tilesets/${tileset.presetId}_tileset.png`,
                    terrain_name: settings.terrainName || tileset.presetId,
                    terrain_color: settings.terrainColor || '4a7023',
                    include_terrain: true,
                    include_physics: settings.includePhysics,
                }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Export failed');
            }

            const result = await response.json();

            // Update tileset with .tres data
            setGeneratedTileset(prev => prev ? {
                ...prev,
                tresBase64: result.tres_base64,
                texturePath: result.texture_path,
                tresPath: result.texture_path?.replace('.png', '.tres'),
            } : null);

            // Trigger download
            downloadBase64(result.tres_base64, `${tileset.presetId}_tileset.tres`, 'text/plain');

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Export failed');
            console.error('TileSet export failed:', err);
        } finally {
            setIsExporting(false);
        }
    }, []);

    // Download PNG
    const downloadPng = useCallback(() => {
        if (!generatedTileset) return;

        downloadBase64(
            generatedTileset.imageBase64,
            `${generatedTileset.presetId}_tileset.png`,
            'image/png'
        );
    }, [generatedTileset]);

    // Download .tres
    const downloadTres = useCallback(() => {
        if (!generatedTileset?.tresBase64) return;

        downloadBase64(
            generatedTileset.tresBase64,
            `${generatedTileset.presetId}_tileset.tres`,
            'text/plain'
        );
    }, [generatedTileset]);

    return {
        generatedTileset,
        isGenerating,
        isExporting,
        error,
        generateTileset,
        exportAsTres,
        downloadPng,
        downloadTres,
    };
}

// Helper: Download base64 as file
function downloadBase64(base64: string, filename: string, mimeType: string) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
