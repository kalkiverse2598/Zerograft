/**
 * Palette Extraction Hook
 * Extract optimal color palette from any image using color quantization
 * 
 * Features:
 * - Extract dominant colors from canvas/image
 * - Adjustable palette size
 * - Color clustering using median cut algorithm
 */

import { useCallback } from 'react';

interface Color {
    r: number;
    g: number;
    b: number;
    count: number;
}

interface ColorBox {
    colors: Color[];
    rMin: number;
    rMax: number;
    gMin: number;
    gMax: number;
    bMin: number;
    bMax: number;
}

// Convert RGB to hex
function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (x: number) => {
        const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Calculate the range of a color box
function calculateBoxBounds(colors: Color[]): ColorBox {
    let rMin = 255, rMax = 0;
    let gMin = 255, gMax = 0;
    let bMin = 255, bMax = 0;

    for (const color of colors) {
        rMin = Math.min(rMin, color.r);
        rMax = Math.max(rMax, color.r);
        gMin = Math.min(gMin, color.g);
        gMax = Math.max(gMax, color.g);
        bMin = Math.min(bMin, color.b);
        bMax = Math.max(bMax, color.b);
    }

    return { colors, rMin, rMax, gMin, gMax, bMin, bMax };
}

// Find the longest dimension of a color box
function getLongestDimension(box: ColorBox): 'r' | 'g' | 'b' {
    const rRange = box.rMax - box.rMin;
    const gRange = box.gMax - box.gMin;
    const bRange = box.bMax - box.bMin;

    if (rRange >= gRange && rRange >= bRange) return 'r';
    if (gRange >= rRange && gRange >= bRange) return 'g';
    return 'b';
}

// Split a color box along its longest dimension
function splitBox(box: ColorBox): [ColorBox, ColorBox] {
    const dimension = getLongestDimension(box);
    
    // Sort colors by the longest dimension
    const sorted = [...box.colors].sort((a, b) => a[dimension] - b[dimension]);
    
    // Find the median point
    const midIndex = Math.floor(sorted.length / 2);
    
    const box1 = calculateBoxBounds(sorted.slice(0, midIndex));
    const box2 = calculateBoxBounds(sorted.slice(midIndex));
    
    return [box1, box2];
}

// Calculate the average color of a box
function getAverageColor(box: ColorBox): { r: number; g: number; b: number; count: number } {
    let totalR = 0, totalG = 0, totalB = 0, totalCount = 0;
    
    for (const color of box.colors) {
        totalR += color.r * color.count;
        totalG += color.g * color.count;
        totalB += color.b * color.count;
        totalCount += color.count;
    }
    
    return {
        r: Math.round(totalR / totalCount),
        g: Math.round(totalG / totalCount),
        b: Math.round(totalB / totalCount),
        count: totalCount,
    };
}

export function usePaletteExtraction() {
    
    /**
     * Extract a palette from canvas image data
     * Uses median cut algorithm for color quantization
     */
    const extractFromCanvas = useCallback((
        canvas: HTMLCanvasElement,
        paletteSize: number = 16,
        skipTransparent: boolean = true
    ): string[] => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return [];
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return extractFromImageData(imageData, paletteSize, skipTransparent);
    }, []);

    /**
     * Extract palette from ImageData
     */
    const extractFromImageData = useCallback((
        imageData: ImageData,
        paletteSize: number = 16,
        skipTransparent: boolean = true
    ): string[] => {
        const { data, width, height } = imageData;
        
        // Build color histogram
        const colorMap = new Map<string, Color>();
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            // Skip transparent pixels
            if (skipTransparent && a < 128) continue;
            
            // Quantize to reduce unique colors (5-bit per channel)
            const qr = Math.floor(r / 8) * 8;
            const qg = Math.floor(g / 8) * 8;
            const qb = Math.floor(b / 8) * 8;
            
            const key = `${qr},${qg},${qb}`;
            
            if (colorMap.has(key)) {
                colorMap.get(key)!.count++;
            } else {
                colorMap.set(key, { r: qr, g: qg, b: qb, count: 1 });
            }
        }
        
        const colors = Array.from(colorMap.values());
        
        if (colors.length === 0) return [];
        if (colors.length <= paletteSize) {
            return colors
                .sort((a, b) => b.count - a.count)
                .map(c => rgbToHex(c.r, c.g, c.b));
        }
        
        // Median cut algorithm
        let boxes: ColorBox[] = [calculateBoxBounds(colors)];
        
        while (boxes.length < paletteSize) {
            // Find the box with the most colors
            boxes.sort((a, b) => b.colors.length - a.colors.length);
            
            const boxToSplit = boxes.shift();
            if (!boxToSplit || boxToSplit.colors.length < 2) break;
            
            const [box1, box2] = splitBox(boxToSplit);
            boxes.push(box1, box2);
        }
        
        // Get average color from each box
        const palette = boxes
            .map(box => getAverageColor(box))
            .sort((a, b) => b.count - a.count)
            .map(c => rgbToHex(c.r, c.g, c.b));
        
        return palette;
    }, []);

    /**
     * Extract unique colors (exact, no quantization)
     */
    const extractUniqueColors = useCallback((
        canvas: HTMLCanvasElement,
        maxColors: number = 256,
        skipTransparent: boolean = true
    ): string[] => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return [];
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { data } = imageData;
        
        const colorSet = new Set<string>();
        
        for (let i = 0; i < data.length && colorSet.size < maxColors; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            if (skipTransparent && a < 128) continue;
            
            colorSet.add(rgbToHex(r, g, b));
        }
        
        return Array.from(colorSet);
    }, []);

    /**
     * Sort palette by hue
     */
    const sortByHue = useCallback((palette: string[]): string[] => {
        return [...palette].sort((a, b) => {
            const aRgb = {
                r: parseInt(a.slice(1, 3), 16),
                g: parseInt(a.slice(3, 5), 16),
                b: parseInt(a.slice(5, 7), 16),
            };
            const bRgb = {
                r: parseInt(b.slice(1, 3), 16),
                g: parseInt(b.slice(3, 5), 16),
                b: parseInt(b.slice(5, 7), 16),
            };
            
            // Simple hue calculation
            const aHue = Math.atan2(Math.sqrt(3) * (aRgb.g - aRgb.b), 2 * aRgb.r - aRgb.g - aRgb.b);
            const bHue = Math.atan2(Math.sqrt(3) * (bRgb.g - bRgb.b), 2 * bRgb.r - bRgb.g - bRgb.b);
            
            return aHue - bHue;
        });
    }, []);

    /**
     * Sort palette by luminance (brightness)
     */
    const sortByLuminance = useCallback((palette: string[]): string[] => {
        return [...palette].sort((a, b) => {
            const aLum = parseInt(a.slice(1, 3), 16) * 0.299 +
                         parseInt(a.slice(3, 5), 16) * 0.587 +
                         parseInt(a.slice(5, 7), 16) * 0.114;
            const bLum = parseInt(b.slice(1, 3), 16) * 0.299 +
                         parseInt(b.slice(3, 5), 16) * 0.587 +
                         parseInt(b.slice(5, 7), 16) * 0.114;
            return aLum - bLum;
        });
    }, []);

    return {
        extractFromCanvas,
        extractFromImageData,
        extractUniqueColors,
        sortByHue,
        sortByLuminance,
    };
}

export default usePaletteExtraction;
