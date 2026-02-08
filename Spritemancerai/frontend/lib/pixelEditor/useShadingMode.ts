/**
 * Shading Mode Hook
 * Click to lighten/darken colors using palette neighbors or HSL adjustments
 * 
 * Features:
 * - Left click: Darken the pixel color
 * - Right click: Lighten the pixel color
 * - Works with current palette or generates shades dynamically
 */

import { useCallback, useMemo } from 'react';

interface UseShadingModeOptions {
    enabled: boolean;
    palette: string[];
    shadeSteps: number; // How much to adjust per click (0-100)
}

// Convert hex to HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
}

// Convert HSL to hex
function hslToHex(h: number, s: number, l: number): string {
    h = h / 360;
    s = s / 100;
    l = l / 100;

    const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };

    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    const toHex = (x: number) => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Calculate color distance for palette matching
function colorDistance(hex1: string, hex2: string): number {
    const r1 = parseInt(hex1.slice(1, 3), 16);
    const g1 = parseInt(hex1.slice(3, 5), 16);
    const b1 = parseInt(hex1.slice(5, 7), 16);
    const r2 = parseInt(hex2.slice(1, 3), 16);
    const g2 = parseInt(hex2.slice(3, 5), 16);
    const b2 = parseInt(hex2.slice(5, 7), 16);
    
    return Math.sqrt(
        Math.pow(r2 - r1, 2) + 
        Math.pow(g2 - g1, 2) + 
        Math.pow(b2 - b1, 2)
    );
}

export function useShadingMode({ enabled, palette, shadeSteps = 10 }: UseShadingModeOptions) {
    
    // Sort palette by lightness for shade finding
    const sortedPalette = useMemo(() => {
        if (!palette || palette.length === 0) return [];
        
        return [...palette]
            .map(color => ({ color, hsl: hexToHsl(color) }))
            .sort((a, b) => a.hsl.l - b.hsl.l);
    }, [palette]);

    /**
     * Find the next darker color in the palette
     */
    const findDarkerColor = useCallback((currentColor: string): string | null => {
        if (!enabled || sortedPalette.length === 0) return null;
        
        const currentHsl = hexToHsl(currentColor);
        
        // Find colors with similar hue but lower lightness
        const candidates = sortedPalette.filter(({ hsl }) => {
            const hueDiff = Math.abs(hsl.h - currentHsl.h);
            const hueMatch = hueDiff < 30 || hueDiff > 330; // Allow some hue variance
            return hueMatch && hsl.l < currentHsl.l;
        });
        
        if (candidates.length === 0) {
            // No palette match, generate dynamically
            const newL = Math.max(0, currentHsl.l - shadeSteps);
            return hslToHex(currentHsl.h, currentHsl.s, newL);
        }
        
        // Find closest by lightness
        candidates.sort((a, b) => b.hsl.l - a.hsl.l);
        return candidates[0].color;
    }, [enabled, sortedPalette, shadeSteps]);

    /**
     * Find the next lighter color in the palette
     */
    const findLighterColor = useCallback((currentColor: string): string | null => {
        if (!enabled || sortedPalette.length === 0) return null;
        
        const currentHsl = hexToHsl(currentColor);
        
        // Find colors with similar hue but higher lightness
        const candidates = sortedPalette.filter(({ hsl }) => {
            const hueDiff = Math.abs(hsl.h - currentHsl.h);
            const hueMatch = hueDiff < 30 || hueDiff > 330;
            return hueMatch && hsl.l > currentHsl.l;
        });
        
        if (candidates.length === 0) {
            // No palette match, generate dynamically
            const newL = Math.min(100, currentHsl.l + shadeSteps);
            return hslToHex(currentHsl.h, currentHsl.s, newL);
        }
        
        // Find closest by lightness
        candidates.sort((a, b) => a.hsl.l - b.hsl.l);
        return candidates[0].color;
    }, [enabled, sortedPalette, shadeSteps]);

    /**
     * Shade a pixel - darken or lighten based on direction
     * @param currentColor - The current color of the pixel
     * @param direction - 'darken' or 'lighten'
     * @returns The new color
     */
    const shadeColor = useCallback((currentColor: string, direction: 'darken' | 'lighten'): string => {
        if (!enabled) return currentColor;
        
        // If palette is empty, use dynamic shading
        if (sortedPalette.length === 0) {
            const hsl = hexToHsl(currentColor);
            const newL = direction === 'darken' 
                ? Math.max(0, hsl.l - shadeSteps)
                : Math.min(100, hsl.l + shadeSteps);
            return hslToHex(hsl.h, hsl.s, newL);
        }
        
        // Use palette-based shading
        const result = direction === 'darken' 
            ? findDarkerColor(currentColor)
            : findLighterColor(currentColor);
            
        return result || currentColor;
    }, [enabled, sortedPalette, shadeSteps, findDarkerColor, findLighterColor]);

    /**
     * Get a shade ramp for a color (for preview/UI)
     */
    const getShadeRamp = useCallback((baseColor: string, steps: number = 5): string[] => {
        const hsl = hexToHsl(baseColor);
        const ramp: string[] = [];
        
        // Generate shades from dark to light
        for (let i = 0; i < steps; i++) {
            const l = (100 / (steps - 1)) * i;
            ramp.push(hslToHex(hsl.h, hsl.s, l));
        }
        
        return ramp;
    }, []);

    return {
        shadeColor,
        findDarkerColor,
        findLighterColor,
        getShadeRamp,
        hexToHsl,
        hslToHex,
    };
}

export default useShadingMode;
