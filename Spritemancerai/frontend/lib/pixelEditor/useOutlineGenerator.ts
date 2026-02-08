/**
 * Outline Generator Hook
 * Auto-generate outlines around sprites with various styles
 * 
 * Features:
 * - Single pixel outline
 * - Inner/outer outline options
 * - Configurable outline color
 * - Corner style options
 */

import { useCallback } from 'react';

type OutlineStyle = 'outer' | 'inner' | 'both';
type CornerStyle = 'square' | 'round' | 'sharp';

interface UseOutlineGeneratorOptions {
    outlineColor: string;
    outlineStyle: OutlineStyle;
    cornerStyle: CornerStyle;
}

// Convert hex to RGBA array
function hexToRgba(hex: string): [number, number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b, 255];
}

export function useOutlineGenerator({
    outlineColor = '#000000',
    outlineStyle = 'outer',
    cornerStyle = 'square',
}: UseOutlineGeneratorOptions) {

    /**
     * Check if a pixel is transparent
     */
    const isTransparent = useCallback((data: Uint8ClampedArray, idx: number, threshold: number = 128): boolean => {
        return data[idx + 3] < threshold;
    }, []);

    /**
     * Check if a pixel is opaque
     */
    const isOpaque = useCallback((data: Uint8ClampedArray, idx: number, threshold: number = 128): boolean => {
        return data[idx + 3] >= threshold;
    }, []);

    /**
     * Generate outline around opaque pixels
     */
    const generateOutline = useCallback((
        sourceCanvas: HTMLCanvasElement,
        options?: {
            color?: string;
            style?: OutlineStyle;
            corner?: CornerStyle;
        }
    ): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;
        const color = options?.color ?? outlineColor;
        const style = options?.style ?? outlineStyle;
        const corner = options?.corner ?? cornerStyle;

        const output = document.createElement('canvas');
        output.width = width;
        output.height = height;

        const sourceCtx = sourceCanvas.getContext('2d');
        const outputCtx = output.getContext('2d');
        if (!sourceCtx || !outputCtx) return output;

        const sourceData = sourceCtx.getImageData(0, 0, width, height);
        const outputData = outputCtx.createImageData(width, height);
        
        // Copy source to output first
        outputData.data.set(sourceData.data);

        const rgba = hexToRgba(color);

        // Directions for neighbor check (8-way for square, 4-way for round corners)
        const directions4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        const directions8 = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
        const directions = corner === 'round' ? directions4 : directions8;

        const getIdx = (x: number, y: number) => (y * width + x) * 4;

        // Find outline pixels
        const outlinePixels: [number, number][] = [];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = getIdx(x, y);
                const pixelOpaque = isOpaque(sourceData.data, idx);

                if (style === 'outer' || style === 'both') {
                    // Outer outline: transparent pixels adjacent to opaque pixels
                    if (isTransparent(sourceData.data, idx)) {
                        for (const [dx, dy] of directions) {
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                const nIdx = getIdx(nx, ny);
                                if (isOpaque(sourceData.data, nIdx)) {
                                    outlinePixels.push([x, y]);
                                    break;
                                }
                            }
                        }
                    }
                }

                if (style === 'inner' || style === 'both') {
                    // Inner outline: opaque pixels adjacent to transparent pixels
                    if (pixelOpaque) {
                        for (const [dx, dy] of directions) {
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
                                outlinePixels.push([x, y]);
                                break;
                            }
                            const nIdx = getIdx(nx, ny);
                            if (isTransparent(sourceData.data, nIdx)) {
                                outlinePixels.push([x, y]);
                                break;
                            }
                        }
                    }
                }
            }
        }

        // Apply outline color to found pixels
        for (const [x, y] of outlinePixels) {
            const idx = getIdx(x, y);
            outputData.data[idx] = rgba[0];
            outputData.data[idx + 1] = rgba[1];
            outputData.data[idx + 2] = rgba[2];
            outputData.data[idx + 3] = rgba[3];
        }

        outputCtx.putImageData(outputData, 0, 0);
        return output;
    }, [outlineColor, outlineStyle, cornerStyle, isOpaque, isTransparent]);

    /**
     * Generate drop shadow
     */
    const generateDropShadow = useCallback((
        sourceCanvas: HTMLCanvasElement,
        offsetX: number = 1,
        offsetY: number = 1,
        shadowColor: string = '#000000'
    ): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        const output = document.createElement('canvas');
        output.width = width;
        output.height = height;

        const ctx = output.getContext('2d');
        if (!ctx) return output;

        ctx.imageSmoothingEnabled = false;

        // Draw shadow first
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = shadowColor;
        
        const sourceCtx = sourceCanvas.getContext('2d');
        if (sourceCtx) {
            const sourceData = sourceCtx.getImageData(0, 0, width, height);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    if (sourceData.data[idx + 3] > 128) {
                        const sx = x + offsetX;
                        const sy = y + offsetY;
                        if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
                            ctx.fillRect(sx, sy, 1, 1);
                        }
                    }
                }
            }
        }

        // Draw original on top
        ctx.globalAlpha = 1;
        ctx.drawImage(sourceCanvas, 0, 0);

        return output;
    }, []);

    /**
     * Remove outline from sprite by detecting edge pixels and making them transparent
     * Works by finding opaque pixels that are adjacent to transparent pixels
     */
    const removeOutline = useCallback((
        sourceCanvas: HTMLCanvasElement,
        options?: {
            thickness?: number; // Number of pixels to remove (1-3)
            preserveCorners?: boolean; // Keep diagonal corner pixels
        }
    ): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;
        const thickness = options?.thickness ?? 1;
        const preserveCorners = options?.preserveCorners ?? false;

        const output = document.createElement('canvas');
        output.width = width;
        output.height = height;

        const sourceCtx = sourceCanvas.getContext('2d');
        const outputCtx = output.getContext('2d');
        if (!sourceCtx || !outputCtx) return output;

        // Copy source to output first
        outputCtx.drawImage(sourceCanvas, 0, 0);

        const getIdx = (x: number, y: number) => (y * width + x) * 4;

        // Process each layer of outline removal
        for (let layer = 0; layer < thickness; layer++) {
            const currentData = outputCtx.getImageData(0, 0, width, height);
            const newData = outputCtx.createImageData(width, height);
            newData.data.set(currentData.data);

            // 4-way directions (cardinal)
            const directions4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            // 8-way directions (includes diagonals)
            const directions8 = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
            
            const directions = preserveCorners ? directions4 : directions8;

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = getIdx(x, y);
                    
                    // Skip if already transparent
                    if (currentData.data[idx + 3] < 128) continue;

                    // Check if this pixel is on the edge (adjacent to transparent)
                    let isEdge = false;
                    for (const [dx, dy] of directions) {
                        const nx = x + dx;
                        const ny = y + dy;
                        
                        // Edge of canvas counts as transparent
                        if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
                            isEdge = true;
                            break;
                        }
                        
                        const nIdx = getIdx(nx, ny);
                        if (currentData.data[nIdx + 3] < 128) {
                            isEdge = true;
                            break;
                        }
                    }

                    // If edge pixel, make it transparent
                    if (isEdge) {
                        newData.data[idx + 3] = 0; // Set alpha to 0
                    }
                }
            }

            outputCtx.putImageData(newData, 0, 0);
        }

        return output;
    }, []);

    /**
     * Smart outline removal - tries to detect outline color and only remove that
     */
    const removeOutlineByColor = useCallback((
        sourceCanvas: HTMLCanvasElement,
        targetColor?: string, // If not provided, auto-detect
        tolerance: number = 30
    ): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        const output = document.createElement('canvas');
        output.width = width;
        output.height = height;

        const sourceCtx = sourceCanvas.getContext('2d');
        const outputCtx = output.getContext('2d');
        if (!sourceCtx || !outputCtx) return output;

        const sourceData = sourceCtx.getImageData(0, 0, width, height);
        const outputData = outputCtx.createImageData(width, height);
        outputData.data.set(sourceData.data);

        const getIdx = (x: number, y: number) => (y * width + x) * 4;

        // Auto-detect outline color if not provided (most common edge color)
        let outlineRgba: [number, number, number, number];
        if (targetColor) {
            outlineRgba = hexToRgba(targetColor);
        } else {
            // Find the most common color on edges
            const edgeColors = new Map<string, number>();
            const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = getIdx(x, y);
                    if (sourceData.data[idx + 3] < 128) continue;

                    // Check if edge pixel
                    let isEdge = false;
                    for (const [dx, dy] of directions) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
                            isEdge = true;
                            break;
                        }
                        const nIdx = getIdx(nx, ny);
                        if (sourceData.data[nIdx + 3] < 128) {
                            isEdge = true;
                            break;
                        }
                    }

                    if (isEdge) {
                        const colorKey = `${sourceData.data[idx]},${sourceData.data[idx + 1]},${sourceData.data[idx + 2]}`;
                        edgeColors.set(colorKey, (edgeColors.get(colorKey) || 0) + 1);
                    }
                }
            }

            // Find most common edge color
            let maxCount = 0;
            let mostCommonColor = '0,0,0';
            edgeColors.forEach((count, color) => {
                if (count > maxCount) {
                    maxCount = count;
                    mostCommonColor = color;
                }
            });

            const [r, g, b] = mostCommonColor.split(',').map(Number);
            outlineRgba = [r, g, b, 255];
        }

        // Remove pixels matching outline color on edges
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = getIdx(x, y);
                if (sourceData.data[idx + 3] < 128) continue;

                // Check if edge pixel
                let isEdge = false;
                for (const [dx, dy] of directions) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
                        isEdge = true;
                        break;
                    }
                    const nIdx = getIdx(nx, ny);
                    if (sourceData.data[nIdx + 3] < 128) {
                        isEdge = true;
                        break;
                    }
                }

                if (isEdge) {
                    // Check if color matches outline color within tolerance
                    const rDiff = Math.abs(sourceData.data[idx] - outlineRgba[0]);
                    const gDiff = Math.abs(sourceData.data[idx + 1] - outlineRgba[1]);
                    const bDiff = Math.abs(sourceData.data[idx + 2] - outlineRgba[2]);

                    if (rDiff <= tolerance && gDiff <= tolerance && bDiff <= tolerance) {
                        outputData.data[idx + 3] = 0; // Make transparent
                    }
                }
            }
        }

        outputCtx.putImageData(outputData, 0, 0);
        return output;
    }, []);

    /**
     * Get outline pixel coordinates - returns array of {x, y} for all edge pixels
     */
    const getOutlinePixels = useCallback((
        sourceCanvas: HTMLCanvasElement
    ): { x: number; y: number; color: string }[] => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        const sourceCtx = sourceCanvas.getContext('2d');
        if (!sourceCtx) return [];

        const sourceData = sourceCtx.getImageData(0, 0, width, height);
        const outlinePixels: { x: number; y: number; color: string }[] = [];

        const getIdx = (x: number, y: number) => (y * width + x) * 4;
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = getIdx(x, y);
                if (sourceData.data[idx + 3] < 128) continue;

                // Check if edge pixel
                let isEdge = false;
                for (const [dx, dy] of directions) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
                        isEdge = true;
                        break;
                    }
                    const nIdx = getIdx(nx, ny);
                    if (sourceData.data[nIdx + 3] < 128) {
                        isEdge = true;
                        break;
                    }
                }

                if (isEdge) {
                    const r = sourceData.data[idx];
                    const g = sourceData.data[idx + 1];
                    const b = sourceData.data[idx + 2];
                    const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                    outlinePixels.push({ x, y, color });
                }
            }
        }

        return outlinePixels;
    }, []);

    /**
     * Create a selection mask canvas highlighting outline pixels
     */
    const createOutlineSelectionMask = useCallback((
        sourceCanvas: HTMLCanvasElement,
        highlightColor: string = '#ff0000'
    ): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        const mask = document.createElement('canvas');
        mask.width = width;
        mask.height = height;

        const maskCtx = mask.getContext('2d');
        if (!maskCtx) return mask;

        const outlinePixels = getOutlinePixels(sourceCanvas);
        const rgba = hexToRgba(highlightColor);

        // Draw semi-transparent highlight on outline pixels
        const imageData = maskCtx.createImageData(width, height);
        for (const pixel of outlinePixels) {
            const idx = (pixel.y * width + pixel.x) * 4;
            imageData.data[idx] = rgba[0];
            imageData.data[idx + 1] = rgba[1];
            imageData.data[idx + 2] = rgba[2];
            imageData.data[idx + 3] = 180; // Semi-transparent
        }

        maskCtx.putImageData(imageData, 0, 0);
        return mask;
    }, [getOutlinePixels]);

    /**
     * Recolor outline pixels with a new color
     */
    const recolorOutline = useCallback((
        sourceCanvas: HTMLCanvasElement,
        newColor: string,
        options?: {
            targetColor?: string; // Only recolor this specific color
            tolerance?: number;
        }
    ): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;
        const targetColor = options?.targetColor;
        const tolerance = options?.tolerance ?? 30;

        const output = document.createElement('canvas');
        output.width = width;
        output.height = height;

        const sourceCtx = sourceCanvas.getContext('2d');
        const outputCtx = output.getContext('2d');
        if (!sourceCtx || !outputCtx) return output;

        const sourceData = sourceCtx.getImageData(0, 0, width, height);
        const outputData = outputCtx.createImageData(width, height);
        outputData.data.set(sourceData.data);

        const newRgba = hexToRgba(newColor);
        const targetRgba = targetColor ? hexToRgba(targetColor) : null;

        const getIdx = (x: number, y: number) => (y * width + x) * 4;
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = getIdx(x, y);
                if (sourceData.data[idx + 3] < 128) continue;

                // Check if edge pixel
                let isEdge = false;
                for (const [dx, dy] of directions) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
                        isEdge = true;
                        break;
                    }
                    const nIdx = getIdx(nx, ny);
                    if (sourceData.data[nIdx + 3] < 128) {
                        isEdge = true;
                        break;
                    }
                }

                if (isEdge) {
                    // If target color specified, only recolor matching pixels
                    if (targetRgba) {
                        const rDiff = Math.abs(sourceData.data[idx] - targetRgba[0]);
                        const gDiff = Math.abs(sourceData.data[idx + 1] - targetRgba[1]);
                        const bDiff = Math.abs(sourceData.data[idx + 2] - targetRgba[2]);

                        if (rDiff > tolerance || gDiff > tolerance || bDiff > tolerance) {
                            continue; // Skip - doesn't match target color
                        }
                    }

                    // Apply new color
                    outputData.data[idx] = newRgba[0];
                    outputData.data[idx + 1] = newRgba[1];
                    outputData.data[idx + 2] = newRgba[2];
                    // Keep original alpha
                }
            }
        }

        outputCtx.putImageData(outputData, 0, 0);
        return output;
    }, []);

    /**
     * Get unique colors used in outline
     */
    const getOutlineColors = useCallback((
        sourceCanvas: HTMLCanvasElement
    ): { color: string; count: number }[] => {
        const outlinePixels = getOutlinePixels(sourceCanvas);
        const colorCounts = new Map<string, number>();

        for (const pixel of outlinePixels) {
            colorCounts.set(pixel.color, (colorCounts.get(pixel.color) || 0) + 1);
        }

        return Array.from(colorCounts.entries())
            .map(([color, count]) => ({ color, count }))
            .sort((a, b) => b.count - a.count);
    }, [getOutlinePixels]);

    return {
        generateOutline,
        generateDropShadow,
        removeOutline,
        removeOutlineByColor,
        getOutlinePixels,
        createOutlineSelectionMask,
        recolorOutline,
        getOutlineColors,
    };
}

export default useOutlineGenerator;
