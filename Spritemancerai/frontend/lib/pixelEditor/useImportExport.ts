/**
 * Import/Export Hook for Pixel Editor
 * Handles exporting frames as PNG, ZIP, spritesheet, and GIF
 * Also supports exporting directly to Godot when running in embedded mode
 */

import { useCallback } from 'react';
import { AnimationFrame } from './useAnimationPlayback';
import { godotBridge, SpritesheetExportData } from '@/lib/godotBridge';

export interface SpritesheetConfig {
    layout: 'horizontal' | 'vertical' | 'grid';
    columns?: number; // For grid layout
    padding: number;
    backgroundColor: string; // 'transparent' or hex color
    scale: number; // 1, 2, 4
    includeEffects?: boolean; // Composite effect layers
    effectBlendMode?: 'add' | 'normal' | 'screen';
}

export interface ExportResult {
    blob: Blob;
    filename: string;
}

// Effect layer type for compositing
export interface EffectLayerData {
    frames: ImageData[];
    blendMode: 'add' | 'normal' | 'screen';
    opacity: number;
}

// Helper to download a blob
const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// Helper to composite effect layer onto frame
const compositeEffectLayer = (
    baseData: ImageData,
    effectData: ImageData,
    blendMode: 'add' | 'normal' | 'screen',
    opacity: number = 1.0
): ImageData => {
    const result = new ImageData(
        new Uint8ClampedArray(baseData.data),
        baseData.width,
        baseData.height
    );

    for (let i = 0; i < result.data.length; i += 4) {
        const baseR = baseData.data[i] / 255;
        const baseG = baseData.data[i + 1] / 255;
        const baseB = baseData.data[i + 2] / 255;
        const baseA = baseData.data[i + 3] / 255;

        const effectR = (effectData.data[i] / 255) * opacity;
        const effectG = (effectData.data[i + 1] / 255) * opacity;
        const effectB = (effectData.data[i + 2] / 255) * opacity;
        const effectA = (effectData.data[i + 3] / 255) * opacity;

        let finalR: number, finalG: number, finalB: number;

        switch (blendMode) {
            case 'add':
                finalR = Math.min(1, baseR + effectR * effectA);
                finalG = Math.min(1, baseG + effectG * effectA);
                finalB = Math.min(1, baseB + effectB * effectA);
                break;
            case 'screen':
                finalR = 1 - (1 - baseR) * (1 - effectR * effectA);
                finalG = 1 - (1 - baseG) * (1 - effectG * effectA);
                finalB = 1 - (1 - baseB) * (1 - effectB * effectA);
                break;
            case 'normal':
            default:
                finalR = effectR * effectA + baseR * (1 - effectA);
                finalG = effectG * effectA + baseG * (1 - effectA);
                finalB = effectB * effectA + baseB * (1 - effectA);
                break;
        }

        result.data[i] = Math.round(finalR * 255);
        result.data[i + 1] = Math.round(finalG * 255);
        result.data[i + 2] = Math.round(finalB * 255);
        result.data[i + 3] = Math.max(baseData.data[i + 3], effectData.data[i + 3]);
    }

    return result;
};

// Helper to get ImageData from canvas or create from AnimationFrame
const getFrameCanvas = (frame: AnimationFrame, width: number, height: number): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx && frame.imageData) {
        ctx.putImageData(frame.imageData, 0, 0);
    }
    return canvas;
};

interface UseImportExportOptions {
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    frames: AnimationFrame[];
    currentFrameIndex: number;
    imageWidth: number;
    imageHeight: number;
    effectLayers?: EffectLayerData[]; // Optional effect layers for compositing
}

export function useImportExport({
    canvasRef,
    frames,
    currentFrameIndex,
    imageWidth,
    imageHeight,
}: UseImportExportOptions) {

    /**
     * Export current frame as PNG
     */
    const exportCurrentFrame = useCallback(async (filename?: string): Promise<void> => {
        const canvas = canvasRef.current;
        if (!canvas) {
            console.error('No canvas available for export');
            return;
        }

        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) {
                    const name = filename || `frame_${currentFrameIndex + 1}_${Date.now()}.png`;
                    downloadBlob(blob, name);
                    resolve();
                } else {
                    reject(new Error('Failed to create blob from canvas'));
                }
            }, 'image/png');
        });
    }, [canvasRef, currentFrameIndex]);

    /**
     * Export all frames as a ZIP file
     */
    const exportAllFramesAsZip = useCallback(async (baseFilename?: string): Promise<void> => {
        if (frames.length === 0) {
            console.error('No frames to export');
            return;
        }

        // Dynamically import JSZip
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();

        const baseName = baseFilename || 'animation';
        const folder = zip.folder(baseName);
        if (!folder) return;

        // Add each frame to the ZIP
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            if (!frame.imageData) continue;

            const canvas = getFrameCanvas(frame, imageWidth, imageHeight);
            const blob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob(resolve, 'image/png');
            });

            if (blob) {
                const paddedIndex = String(i + 1).padStart(3, '0');
                folder.file(`${baseName}_${paddedIndex}.png`, blob);
            }
        }

        // Generate and download ZIP
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(zipBlob, `${baseName}_frames.zip`);
    }, [frames, imageWidth, imageHeight]);

    /**
     * Export frames as a spritesheet
     */
    const exportSpritesheet = useCallback(async (config: SpritesheetConfig, filename?: string): Promise<void> => {
        if (frames.length === 0) {
            console.error('No frames to export');
            return;
        }

        const { layout, columns = 4, padding, backgroundColor, scale } = config;
        const frameWidth = imageWidth * scale;
        const frameHeight = imageHeight * scale;
        const paddedWidth = frameWidth + padding;
        const paddedHeight = frameHeight + padding;

        // Calculate spritesheet dimensions
        let sheetWidth: number;
        let sheetHeight: number;
        let cols: number;
        let rows: number;

        switch (layout) {
            case 'horizontal':
                cols = frames.length;
                rows = 1;
                sheetWidth = cols * paddedWidth + padding;
                sheetHeight = paddedHeight + padding;
                break;
            case 'vertical':
                cols = 1;
                rows = frames.length;
                sheetWidth = paddedWidth + padding;
                sheetHeight = rows * paddedHeight + padding;
                break;
            case 'grid':
            default:
                cols = Math.min(columns, frames.length);
                rows = Math.ceil(frames.length / cols);
                sheetWidth = cols * paddedWidth + padding;
                sheetHeight = rows * paddedHeight + padding;
                break;
        }

        // Create spritesheet canvas
        const spritesheetCanvas = document.createElement('canvas');
        spritesheetCanvas.width = sheetWidth;
        spritesheetCanvas.height = sheetHeight;
        const ctx = spritesheetCanvas.getContext('2d');
        if (!ctx) return;

        // Fill background
        if (backgroundColor !== 'transparent') {
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, sheetWidth, sheetHeight);
        }

        // Disable image smoothing for pixel art
        ctx.imageSmoothingEnabled = false;

        // Draw each frame
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            if (!frame.imageData) continue;

            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = padding + col * paddedWidth;
            const y = padding + row * paddedHeight;

            // Get frame canvas
            const frameCanvas = getFrameCanvas(frame, imageWidth, imageHeight);

            // Draw scaled frame
            ctx.drawImage(frameCanvas, x, y, frameWidth, frameHeight);
        }

        // Export as PNG
        const blob = await new Promise<Blob | null>((resolve) => {
            spritesheetCanvas.toBlob(resolve, 'image/png');
        });

        if (blob) {
            const name = filename || `spritesheet_${layout}_${Date.now()}.png`;
            downloadBlob(blob, name);
        }
    }, [frames, imageWidth, imageHeight]);

    /**
     * Quick export spritesheet with default settings
     */
    const exportSpritesheetHorizontal = useCallback(async () => {
        await exportSpritesheet({
            layout: 'horizontal',
            padding: 0,
            backgroundColor: 'transparent',
            scale: 1,
        });
    }, [exportSpritesheet]);

    const exportSpritesheetVertical = useCallback(async () => {
        await exportSpritesheet({
            layout: 'vertical',
            padding: 0,
            backgroundColor: 'transparent',
            scale: 1,
        });
    }, [exportSpritesheet]);

    const exportSpritesheetGrid = useCallback(async (columns: number = 4) => {
        await exportSpritesheet({
            layout: 'grid',
            columns,
            padding: 0,
            backgroundColor: 'transparent',
            scale: 1,
        });
    }, [exportSpritesheet]);

    /**
     * Check if running inside Godot (embedded mode)
     */
    const isGodotAvailable = useCallback((): boolean => {
        return godotBridge.isAvailable();
    }, []);

    /**
     * Export current frame directly to Godot's res://sprites/ folder
     */
    const exportCurrentFrameToGodot = useCallback(async (filename?: string): Promise<boolean> => {
        const canvas = canvasRef.current;
        if (!canvas) {
            console.error('[GodotExport] No canvas available');
            return false;
        }

        if (!godotBridge.isAvailable()) {
            console.warn('[GodotExport] Not running in Godot - falling back to download');
            await exportCurrentFrame(filename);
            return false;
        }

        const name = filename || `sprite_${Date.now()}.png`;
        const success = godotBridge.saveCanvasAsSprite(canvas, name);

        if (success) {
            console.log('[GodotExport] Saved to Godot:', name);
        }

        return success;
    }, [canvasRef, exportCurrentFrame]);

    /**
     * Export spritesheet directly to Godot
     */
    const exportSpritesheetToGodot = useCallback(async (config: SpritesheetConfig, filename?: string): Promise<boolean> => {
        if (frames.length === 0) {
            console.error('[GodotExport] No frames to export');
            return false;
        }

        if (!godotBridge.isAvailable()) {
            console.warn('[GodotExport] Not running in Godot - falling back to download');
            await exportSpritesheet(config, filename);
            return false;
        }

        const { layout, columns = 4, scale } = config;
        const frameWidth = imageWidth * scale;
        const frameHeight = imageHeight * scale;

        // Calculate layout
        let cols: number;
        let rows: number;
        switch (layout) {
            case 'horizontal':
                cols = frames.length;
                rows = 1;
                break;
            case 'vertical':
                cols = 1;
                rows = frames.length;
                break;
            case 'grid':
            default:
                cols = Math.min(columns, frames.length);
                rows = Math.ceil(frames.length / cols);
                break;
        }

        // Create spritesheet canvas (same as regular export)
        const spritesheetCanvas = document.createElement('canvas');
        spritesheetCanvas.width = cols * frameWidth;
        spritesheetCanvas.height = rows * frameHeight;
        const ctx = spritesheetCanvas.getContext('2d');
        if (!ctx) return false;

        ctx.imageSmoothingEnabled = false;

        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            if (!frame.imageData) continue;

            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = col * frameWidth;
            const y = row * frameHeight;

            const frameCanvas = getFrameCanvas(frame, imageWidth, imageHeight);
            ctx.drawImage(frameCanvas, x, y, frameWidth, frameHeight);
        }

        // Send to Godot
        const name = filename || `spritesheet_${Date.now()}.png`;
        const base64Data = spritesheetCanvas.toDataURL('image/png');
        const success = godotBridge.saveSprite(base64Data, name);

        if (success) {
            // Also send metadata for SpriteFrames creation
            const exportData: SpritesheetExportData = {
                filename: name,
                imageData: base64Data,
                frameCount: frames.length,
                frameWidth: frameWidth,
                frameHeight: frameHeight,
                columns: cols,
                rows: rows,
            };
            godotBridge.exportSpritesheet(exportData);
            console.log('[GodotExport] Spritesheet saved to Godot:', name);
        }

        return success;
    }, [frames, imageWidth, imageHeight, exportSpritesheet]);

    return {
        // Export functions
        exportCurrentFrame,
        exportAllFramesAsZip,
        exportSpritesheet,

        // Convenience functions
        exportSpritesheetHorizontal,
        exportSpritesheetVertical,
        exportSpritesheetGrid,

        // Godot integration
        isGodotAvailable,
        exportCurrentFrameToGodot,
        exportSpritesheetToGodot,
    };
}

export default useImportExport;
