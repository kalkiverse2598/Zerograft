/**
 * Seamless Tile Generator Hook
 * Auto-blend edges to create seamless tileable textures
 * 
 * Features:
 * - Automatic edge blending
 * - Wang tile generation
 * - Mirror tile creation
 */

import { useCallback } from 'react';

interface UseSeamlessTileOptions {
    blendWidth: number; // Pixels to blend at edges
}

export function useSeamlessTile({ blendWidth = 8 }: UseSeamlessTileOptions) {

    /**
     * Create a seamless tile by blending edges
     */
    const makeSeamless = useCallback((
        sourceCanvas: HTMLCanvasElement,
        targetCanvas?: HTMLCanvasElement
    ): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        const output = targetCanvas || document.createElement('canvas');
        output.width = width;
        output.height = height;

        const sourceCtx = sourceCanvas.getContext('2d');
        const outputCtx = output.getContext('2d');
        if (!sourceCtx || !outputCtx) return output;

        // Get source image data
        const sourceData = sourceCtx.getImageData(0, 0, width, height);
        const outputData = outputCtx.createImageData(width, height);

        // Copy source to output
        outputData.data.set(sourceData.data);

        const blend = Math.min(blendWidth, Math.floor(width / 4), Math.floor(height / 4));

        // Blend horizontal edges
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < blend; x++) {
                const t = x / blend; // 0 to 1
                
                const leftIdx = (y * width + x) * 4;
                const rightIdx = (y * width + (width - 1 - x)) * 4;
                const mirrorLeftIdx = (y * width + (width - 1 - x)) * 4;
                const mirrorRightIdx = (y * width + x) * 4;

                // Blend left edge with wrapped right edge
                for (let c = 0; c < 4; c++) {
                    const leftVal = sourceData.data[leftIdx + c];
                    const rightVal = sourceData.data[mirrorLeftIdx + c];
                    outputData.data[leftIdx + c] = Math.round(leftVal * t + rightVal * (1 - t));
                    
                    const rightOrigVal = sourceData.data[rightIdx + c];
                    const leftOrigVal = sourceData.data[mirrorRightIdx + c];
                    outputData.data[rightIdx + c] = Math.round(rightOrigVal * t + leftOrigVal * (1 - t));
                }
            }
        }

        // Blend vertical edges
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < blend; y++) {
                const t = y / blend;
                
                const topIdx = (y * width + x) * 4;
                const bottomIdx = ((height - 1 - y) * width + x) * 4;

                for (let c = 0; c < 4; c++) {
                    const topVal = outputData.data[topIdx + c];
                    const bottomVal = outputData.data[bottomIdx + c];
                    
                    outputData.data[topIdx + c] = Math.round(topVal * t + bottomVal * (1 - t));
                    outputData.data[bottomIdx + c] = Math.round(bottomVal * t + topVal * (1 - t));
                }
            }
        }

        outputCtx.putImageData(outputData, 0, 0);
        return output;
    }, [blendWidth]);

    /**
     * Create a mirror tile (flip and combine for guaranteed seamless)
     */
    const createMirrorTile = useCallback((
        sourceCanvas: HTMLCanvasElement
    ): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        const output = document.createElement('canvas');
        output.width = width * 2;
        output.height = height * 2;

        const ctx = output.getContext('2d');
        if (!ctx) return output;

        ctx.imageSmoothingEnabled = false;

        // Top-left: original
        ctx.drawImage(sourceCanvas, 0, 0);

        // Top-right: horizontal flip
        ctx.save();
        ctx.translate(width * 2, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(sourceCanvas, 0, 0);
        ctx.restore();

        // Bottom-left: vertical flip
        ctx.save();
        ctx.translate(0, height * 2);
        ctx.scale(1, -1);
        ctx.drawImage(sourceCanvas, 0, 0);
        ctx.restore();

        // Bottom-right: both flips
        ctx.save();
        ctx.translate(width * 2, height * 2);
        ctx.scale(-1, -1);
        ctx.drawImage(sourceCanvas, 0, 0);
        ctx.restore();

        return output;
    }, []);

    /**
     * Create offset tile (useful for brick patterns)
     */
    const createOffsetTile = useCallback((
        sourceCanvas: HTMLCanvasElement,
        offsetX: number = 0.5, // 0-1, percentage offset
        offsetY: number = 0
    ): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        const output = document.createElement('canvas');
        output.width = width;
        output.height = height * 2;

        const ctx = output.getContext('2d');
        if (!ctx) return output;

        ctx.imageSmoothingEnabled = false;

        const pixelOffsetX = Math.round(width * offsetX);
        const pixelOffsetY = Math.round(height * offsetY);

        // Row 1: original
        ctx.drawImage(sourceCanvas, 0, 0);

        // Row 2: offset
        ctx.drawImage(sourceCanvas, pixelOffsetX, height);
        ctx.drawImage(sourceCanvas, pixelOffsetX - width, height);

        return output;
    }, []);

    return {
        makeSeamless,
        createMirrorTile,
        createOffsetTile,
    };
}

export default useSeamlessTile;
