/**
 * Selection Hook
 * Provides selection tools for pixel art editing
 * 
 * Features:
 * - Magic Wand (flood fill selection)
 * - Select All of Color
 * - Grow/Shrink selection
 * - Invert selection
 * - Selection mask operations
 */

import { useCallback, useState } from 'react';

export interface SelectionMask {
    width: number;
    height: number;
    data: Uint8Array; // 0 = not selected, 255 = selected
}

export function useSelection() {
    const [selectionMask, setSelectionMask] = useState<SelectionMask | null>(null);
    const [marchingAntsOffset, setMarchingAntsOffset] = useState(0);

    /**
     * Helper to get pixel color at position
     */
    const getPixelColor = (imageData: ImageData, x: number, y: number): [number, number, number, number] => {
        const idx = (y * imageData.width + x) * 4;
        return [
            imageData.data[idx],
            imageData.data[idx + 1],
            imageData.data[idx + 2],
            imageData.data[idx + 3],
        ];
    };

    /**
     * Check if two colors match within tolerance
     */
    const colorsMatch = (
        c1: [number, number, number, number],
        c2: [number, number, number, number],
        tolerance: number
    ): boolean => {
        return (
            Math.abs(c1[0] - c2[0]) <= tolerance &&
            Math.abs(c1[1] - c2[1]) <= tolerance &&
            Math.abs(c1[2] - c2[2]) <= tolerance &&
            Math.abs(c1[3] - c2[3]) <= tolerance
        );
    };

    /**
     * Magic Wand selection - flood fill from a point
     * Selects all connected pixels of similar color
     */
    const magicWand = useCallback((
        canvas: HTMLCanvasElement,
        startX: number,
        startY: number,
        tolerance: number = 0,
        contiguous: boolean = true
    ): SelectionMask => {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return { width: canvas.width, height: canvas.height, data: new Uint8Array(canvas.width * canvas.height) };
        }

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { width, height } = imageData;
        const mask = new Uint8Array(width * height);

        const targetColor = getPixelColor(imageData, Math.floor(startX), Math.floor(startY));

        if (contiguous) {
            // Flood fill selection
            const stack: [number, number][] = [[Math.floor(startX), Math.floor(startY)]];
            const visited = new Set<number>();

            while (stack.length > 0) {
                const [x, y] = stack.pop()!;
                const idx = y * width + x;

                if (x < 0 || x >= width || y < 0 || y >= height) continue;
                if (visited.has(idx)) continue;
                visited.add(idx);

                const pixelColor = getPixelColor(imageData, x, y);
                if (!colorsMatch(pixelColor, targetColor, tolerance)) continue;

                mask[idx] = 255;

                // Add neighbors
                stack.push([x + 1, y]);
                stack.push([x - 1, y]);
                stack.push([x, y + 1]);
                stack.push([x, y - 1]);
            }
        } else {
            // Select all matching pixels (non-contiguous)
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const pixelColor = getPixelColor(imageData, x, y);
                    if (colorsMatch(pixelColor, targetColor, tolerance)) {
                        mask[y * width + x] = 255;
                    }
                }
            }
        }

        const newMask = { width, height, data: mask };
        setSelectionMask(newMask);
        return newMask;
    }, []);

    /**
     * Select all pixels of a specific color
     */
    const selectByColor = useCallback((
        canvas: HTMLCanvasElement,
        color: string,
        tolerance: number = 0
    ): SelectionMask => {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return { width: canvas.width, height: canvas.height, data: new Uint8Array(canvas.width * canvas.height) };
        }

        // Parse hex color to RGBA
        const hex = color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const a = hex.length === 8 ? parseInt(hex.substring(6, 8), 16) : 255;
        const targetColor: [number, number, number, number] = [r, g, b, a];

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { width, height } = imageData;
        const mask = new Uint8Array(width * height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixelColor = getPixelColor(imageData, x, y);
                if (colorsMatch(pixelColor, targetColor, tolerance)) {
                    mask[y * width + x] = 255;
                }
            }
        }

        const newMask = { width, height, data: mask };
        setSelectionMask(newMask);
        return newMask;
    }, []);

    /**
     * Select all non-transparent pixels
     */
    const selectAll = useCallback((canvas: HTMLCanvasElement): SelectionMask => {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return { width: canvas.width, height: canvas.height, data: new Uint8Array(canvas.width * canvas.height) };
        }

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { width, height } = imageData;
        const mask = new Uint8Array(width * height);

        for (let i = 0; i < width * height; i++) {
            // Select if alpha > 0
            if (imageData.data[i * 4 + 3] > 0) {
                mask[i] = 255;
            }
        }

        const newMask = { width, height, data: mask };
        setSelectionMask(newMask);
        return newMask;
    }, []);

    /**
     * Grow selection by specified pixels
     */
    const growSelection = useCallback((pixels: number = 1): SelectionMask | null => {
        if (!selectionMask) return null;

        const { width, height, data } = selectionMask;
        const newMask = new Uint8Array(width * height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                
                // Check if any pixel within radius is selected
                let isNearSelected = false;
                for (let dy = -pixels; dy <= pixels && !isNearSelected; dy++) {
                    for (let dx = -pixels; dx <= pixels && !isNearSelected; dx++) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            if (data[ny * width + nx] > 0) {
                                isNearSelected = true;
                            }
                        }
                    }
                }
                
                if (isNearSelected) {
                    newMask[idx] = 255;
                }
            }
        }

        const result = { width, height, data: newMask };
        setSelectionMask(result);
        return result;
    }, [selectionMask]);

    /**
     * Shrink selection by specified pixels
     */
    const shrinkSelection = useCallback((pixels: number = 1): SelectionMask | null => {
        if (!selectionMask) return null;

        const { width, height, data } = selectionMask;
        const newMask = new Uint8Array(width * height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                
                if (data[idx] === 0) continue;

                // Check if all pixels within radius are selected
                let allSelected = true;
                for (let dy = -pixels; dy <= pixels && allSelected; dy++) {
                    for (let dx = -pixels; dx <= pixels && allSelected; dx++) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            if (data[ny * width + nx] === 0) {
                                allSelected = false;
                            }
                        } else {
                            // Edge pixel - shrink it
                            allSelected = false;
                        }
                    }
                }
                
                if (allSelected) {
                    newMask[idx] = 255;
                }
            }
        }

        const result = { width, height, data: newMask };
        setSelectionMask(result);
        return result;
    }, [selectionMask]);

    /**
     * Invert selection
     */
    const invertSelection = useCallback((): SelectionMask | null => {
        if (!selectionMask) return null;

        const { width, height, data } = selectionMask;
        const newMask = new Uint8Array(width * height);

        for (let i = 0; i < data.length; i++) {
            newMask[i] = data[i] === 0 ? 255 : 0;
        }

        const result = { width, height, data: newMask };
        setSelectionMask(result);
        return result;
    }, [selectionMask]);

    /**
     * Clear selection
     */
    const clearSelection = useCallback(() => {
        setSelectionMask(null);
    }, []);

    /**
     * Add to existing selection (union)
     */
    const addToSelection = useCallback((newMask: SelectionMask): SelectionMask => {
        if (!selectionMask) {
            setSelectionMask(newMask);
            return newMask;
        }

        const combined = new Uint8Array(selectionMask.data.length);
        for (let i = 0; i < combined.length; i++) {
            combined[i] = selectionMask.data[i] > 0 || newMask.data[i] > 0 ? 255 : 0;
        }

        const result = { ...selectionMask, data: combined };
        setSelectionMask(result);
        return result;
    }, [selectionMask]);

    /**
     * Subtract from existing selection
     */
    const subtractFromSelection = useCallback((maskToSubtract: SelectionMask): SelectionMask | null => {
        if (!selectionMask) return null;

        const result = new Uint8Array(selectionMask.data.length);
        for (let i = 0; i < result.length; i++) {
            result[i] = selectionMask.data[i] > 0 && maskToSubtract.data[i] === 0 ? 255 : 0;
        }

        const newMask = { ...selectionMask, data: result };
        setSelectionMask(newMask);
        return newMask;
    }, [selectionMask]);

    /**
     * Render selection outline (marching ants) to a canvas
     */
    const renderSelectionOutline = useCallback((
        ctx: CanvasRenderingContext2D,
        mask: SelectionMask,
        offset: number = 0
    ) => {
        const { width, height, data } = mask;
        
        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = offset;

        // Find edge pixels and draw outline
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (data[idx] === 0) continue;

                // Check if this is an edge pixel
                const isTop = y === 0 || data[(y - 1) * width + x] === 0;
                const isBottom = y === height - 1 || data[(y + 1) * width + x] === 0;
                const isLeft = x === 0 || data[y * width + (x - 1)] === 0;
                const isRight = x === width - 1 || data[y * width + (x + 1)] === 0;

                if (isTop) {
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + 1, y);
                    ctx.stroke();
                }
                if (isBottom) {
                    ctx.beginPath();
                    ctx.moveTo(x, y + 1);
                    ctx.lineTo(x + 1, y + 1);
                    ctx.stroke();
                }
                if (isLeft) {
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x, y + 1);
                    ctx.stroke();
                }
                if (isRight) {
                    ctx.beginPath();
                    ctx.moveTo(x + 1, y);
                    ctx.lineTo(x + 1, y + 1);
                    ctx.stroke();
                }
            }
        }

        // Draw white dashes offset
        ctx.strokeStyle = '#ffffff';
        ctx.lineDashOffset = offset + 4;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (data[idx] === 0) continue;

                const isTop = y === 0 || data[(y - 1) * width + x] === 0;
                const isBottom = y === height - 1 || data[(y + 1) * width + x] === 0;
                const isLeft = x === 0 || data[y * width + (x - 1)] === 0;
                const isRight = x === width - 1 || data[y * width + (x + 1)] === 0;

                if (isTop) {
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + 1, y);
                    ctx.stroke();
                }
                if (isBottom) {
                    ctx.beginPath();
                    ctx.moveTo(x, y + 1);
                    ctx.lineTo(x + 1, y + 1);
                    ctx.stroke();
                }
                if (isLeft) {
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x, y + 1);
                    ctx.stroke();
                }
                if (isRight) {
                    ctx.beginPath();
                    ctx.moveTo(x + 1, y);
                    ctx.lineTo(x + 1, y + 1);
                    ctx.stroke();
                }
            }
        }

        ctx.restore();
    }, []);

    /**
     * Check if a point is within the selection
     */
    const isPointSelected = useCallback((x: number, y: number): boolean => {
        if (!selectionMask) return true; // No selection = everything is "selected"
        const idx = Math.floor(y) * selectionMask.width + Math.floor(x);
        return selectionMask.data[idx] > 0;
    }, [selectionMask]);

    /**
     * Get selection bounds (bounding box)
     */
    const getSelectionBounds = useCallback((): { x: number, y: number, width: number, height: number } | null => {
        if (!selectionMask) return null;

        const { width, height, data } = selectionMask;
        let minX = width, minY = height, maxX = 0, maxY = 0;
        let hasSelection = false;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (data[y * width + x] > 0) {
                    hasSelection = true;
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }
        }

        if (!hasSelection) return null;

        return {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1,
        };
    }, [selectionMask]);

    /**
     * Delete selected pixels (make transparent)
     */
    const deleteSelected = useCallback((canvas: HTMLCanvasElement): void => {
        if (!selectionMask) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        for (let i = 0; i < selectionMask.data.length; i++) {
            if (selectionMask.data[i] > 0) {
                const idx = i * 4;
                imageData.data[idx] = 0;
                imageData.data[idx + 1] = 0;
                imageData.data[idx + 2] = 0;
                imageData.data[idx + 3] = 0;
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }, [selectionMask]);

    /**
     * Fill selected area with color
     */
    const fillSelected = useCallback((canvas: HTMLCanvasElement, color: string): void => {
        if (!selectionMask) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Parse color
        const hex = color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const a = hex.length === 8 ? parseInt(hex.substring(6, 8), 16) : 255;

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        for (let i = 0; i < selectionMask.data.length; i++) {
            if (selectionMask.data[i] > 0) {
                const idx = i * 4;
                imageData.data[idx] = r;
                imageData.data[idx + 1] = g;
                imageData.data[idx + 2] = b;
                imageData.data[idx + 3] = a;
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }, [selectionMask]);

    return {
        // State
        selectionMask,
        setSelectionMask,
        marchingAntsOffset,
        setMarchingAntsOffset,
        
        // Selection creation
        magicWand,
        selectByColor,
        selectAll,
        
        // Selection modification
        growSelection,
        shrinkSelection,
        invertSelection,
        clearSelection,
        addToSelection,
        subtractFromSelection,
        
        // Rendering
        renderSelectionOutline,
        
        // Utilities
        isPointSelected,
        getSelectionBounds,
        deleteSelected,
        fillSelected,
    };
}

export default useSelection;
