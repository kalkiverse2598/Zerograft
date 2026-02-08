/**
 * Tile Preview Hook
 * Real-time tile repetition preview for seamless pattern creation
 * 
 * Features:
 * - Preview tiles in 2x2, 3x3, or custom grid
 * - Offset preview to check seams
 * - Animated tile scrolling preview
 */

import { useCallback, useRef, useState } from 'react';

interface UseTilePreviewOptions {
    enabled: boolean;
}

export function useTilePreview({ enabled }: UseTilePreviewOptions) {
    const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const [gridSize, setGridSize] = useState<2 | 3 | 4>(3);
    const [offsetX, setOffsetX] = useState(0);
    const [offsetY, setOffsetY] = useState(0);

    /**
     * Generate a tiled preview from source canvas
     */
    const generateTilePreview = useCallback((
        sourceCanvas: HTMLCanvasElement,
        targetCanvas: HTMLCanvasElement,
        options?: {
            gridSize?: number;
            offsetX?: number;
            offsetY?: number;
        }
    ) => {
        if (!enabled) return;

        const ctx = targetCanvas.getContext('2d');
        if (!ctx) return;

        const grid = options?.gridSize ?? gridSize;
        const offX = options?.offsetX ?? offsetX;
        const offY = options?.offsetY ?? offsetY;

        const tileWidth = sourceCanvas.width;
        const tileHeight = sourceCanvas.height;

        // Set target canvas size
        targetCanvas.width = tileWidth * grid;
        targetCanvas.height = tileHeight * grid;

        ctx.imageSmoothingEnabled = false;

        // Draw tiles with offset
        for (let row = 0; row < grid; row++) {
            for (let col = 0; col < grid; col++) {
                const x = col * tileWidth + offX;
                const y = row * tileHeight + offY;
                
                // Draw with wrapping
                ctx.drawImage(sourceCanvas, x % tileWidth - tileWidth, y % tileHeight - tileHeight);
                ctx.drawImage(sourceCanvas, x % tileWidth, y % tileHeight - tileHeight);
                ctx.drawImage(sourceCanvas, x % tileWidth - tileWidth, y % tileHeight);
                ctx.drawImage(sourceCanvas, x % tileWidth, y % tileHeight);
            }
        }
    }, [enabled, gridSize, offsetX, offsetY]);

    /**
     * Check if edges match for seamless tiling
     */
    const checkSeamless = useCallback((canvas: HTMLCanvasElement): {
        horizontal: boolean;
        vertical: boolean;
        score: number;
    } => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return { horizontal: false, vertical: false, score: 0 };

        const width = canvas.width;
        const height = canvas.height;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        let horizontalDiff = 0;
        let verticalDiff = 0;
        const threshold = 30; // Color difference threshold

        // Check horizontal seam (left edge vs right edge)
        for (let y = 0; y < height; y++) {
            const leftIdx = (y * width + 0) * 4;
            const rightIdx = (y * width + (width - 1)) * 4;
            
            const rDiff = Math.abs(data[leftIdx] - data[rightIdx]);
            const gDiff = Math.abs(data[leftIdx + 1] - data[rightIdx + 1]);
            const bDiff = Math.abs(data[leftIdx + 2] - data[rightIdx + 2]);
            
            horizontalDiff += (rDiff + gDiff + bDiff) / 3;
        }

        // Check vertical seam (top edge vs bottom edge)
        for (let x = 0; x < width; x++) {
            const topIdx = (0 * width + x) * 4;
            const bottomIdx = ((height - 1) * width + x) * 4;
            
            const rDiff = Math.abs(data[topIdx] - data[bottomIdx]);
            const gDiff = Math.abs(data[topIdx + 1] - data[bottomIdx + 1]);
            const bDiff = Math.abs(data[topIdx + 2] - data[bottomIdx + 2]);
            
            verticalDiff += (rDiff + gDiff + bDiff) / 3;
        }

        const avgHorizontal = horizontalDiff / height;
        const avgVertical = verticalDiff / width;

        const isHorizontalSeamless = avgHorizontal < threshold;
        const isVerticalSeamless = avgVertical < threshold;
        
        // Score from 0-100 (100 = perfect seamless)
        const maxPossibleDiff = 255;
        const score = Math.round(100 - ((avgHorizontal + avgVertical) / 2 / maxPossibleDiff * 100));

        return {
            horizontal: isHorizontalSeamless,
            vertical: isVerticalSeamless,
            score: Math.max(0, Math.min(100, score)),
        };
    }, []);

    /**
     * Create a preview canvas element
     */
    const createPreviewCanvas = useCallback((width: number, height: number): HTMLCanvasElement => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        previewCanvasRef.current = canvas;
        return canvas;
    }, []);

    return {
        generateTilePreview,
        checkSeamless,
        createPreviewCanvas,
        previewCanvasRef,
        gridSize,
        setGridSize,
        offsetX,
        setOffsetX,
        offsetY,
        setOffsetY,
    };
}

export default useTilePreview;
