/**
 * Color Harmony Hook
 * Suggest complementary, analogous, triadic, and other color harmonies
 * 
 * Features:
 * - Generate color harmonies based on color theory
 * - Multiple harmony types (complementary, analogous, triadic, etc.)
 * - Adjustable parameters for fine-tuning
 */

import { useCallback } from 'react';

type HarmonyType = 'complementary' | 'analogous' | 'triadic' | 'split-complementary' | 'tetradic' | 'monochromatic';

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
    h = ((h % 360) + 360) % 360; // Normalize hue to 0-360
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

export function useColorHarmony() {
    
    /**
     * Generate complementary colors (opposite on color wheel)
     */
    const getComplementary = useCallback((baseColor: string): string[] => {
        const hsl = hexToHsl(baseColor);
        const complementHue = (hsl.h + 180) % 360;
        
        return [
            baseColor,
            hslToHex(complementHue, hsl.s, hsl.l),
        ];
    }, []);

    /**
     * Generate analogous colors (adjacent on color wheel)
     */
    const getAnalogous = useCallback((baseColor: string, angle: number = 30): string[] => {
        const hsl = hexToHsl(baseColor);
        
        return [
            hslToHex(hsl.h - angle, hsl.s, hsl.l),
            baseColor,
            hslToHex(hsl.h + angle, hsl.s, hsl.l),
        ];
    }, []);

    /**
     * Generate triadic colors (equidistant on color wheel)
     */
    const getTriadic = useCallback((baseColor: string): string[] => {
        const hsl = hexToHsl(baseColor);
        
        return [
            baseColor,
            hslToHex(hsl.h + 120, hsl.s, hsl.l),
            hslToHex(hsl.h + 240, hsl.s, hsl.l),
        ];
    }, []);

    /**
     * Generate split-complementary colors
     */
    const getSplitComplementary = useCallback((baseColor: string, angle: number = 30): string[] => {
        const hsl = hexToHsl(baseColor);
        const complementHue = (hsl.h + 180) % 360;
        
        return [
            baseColor,
            hslToHex(complementHue - angle, hsl.s, hsl.l),
            hslToHex(complementHue + angle, hsl.s, hsl.l),
        ];
    }, []);

    /**
     * Generate tetradic/square colors (4 colors evenly spaced)
     */
    const getTetradic = useCallback((baseColor: string): string[] => {
        const hsl = hexToHsl(baseColor);
        
        return [
            baseColor,
            hslToHex(hsl.h + 90, hsl.s, hsl.l),
            hslToHex(hsl.h + 180, hsl.s, hsl.l),
            hslToHex(hsl.h + 270, hsl.s, hsl.l),
        ];
    }, []);

    /**
     * Generate monochromatic variations
     */
    const getMonochromatic = useCallback((baseColor: string, steps: number = 5): string[] => {
        const hsl = hexToHsl(baseColor);
        const colors: string[] = [];
        
        // Generate variations with different lightness
        for (let i = 0; i < steps; i++) {
            const l = 20 + (60 / (steps - 1)) * i; // Range from 20% to 80%
            colors.push(hslToHex(hsl.h, hsl.s, l));
        }
        
        return colors;
    }, []);

    /**
     * Get harmony by type
     */
    const getHarmony = useCallback((baseColor: string, type: HarmonyType): string[] => {
        switch (type) {
            case 'complementary':
                return getComplementary(baseColor);
            case 'analogous':
                return getAnalogous(baseColor);
            case 'triadic':
                return getTriadic(baseColor);
            case 'split-complementary':
                return getSplitComplementary(baseColor);
            case 'tetradic':
                return getTetradic(baseColor);
            case 'monochromatic':
                return getMonochromatic(baseColor);
            default:
                return [baseColor];
        }
    }, [getComplementary, getAnalogous, getTriadic, getSplitComplementary, getTetradic, getMonochromatic]);

    /**
     * Generate a complete pixel art palette based on a base color
     * Includes darks, mids, lights, and accent colors
     */
    const generatePixelArtPalette = useCallback((baseColor: string): string[] => {
        const hsl = hexToHsl(baseColor);
        const palette: string[] = [];
        
        // Base color variations (darks to lights)
        palette.push(hslToHex(hsl.h, hsl.s * 0.8, 15));  // Very dark
        palette.push(hslToHex(hsl.h, hsl.s * 0.9, 30));  // Dark
        palette.push(hslToHex(hsl.h, hsl.s, 45));        // Dark mid
        palette.push(baseColor);                          // Base
        palette.push(hslToHex(hsl.h, hsl.s * 0.9, 65));  // Light mid
        palette.push(hslToHex(hsl.h, hsl.s * 0.7, 80));  // Light
        palette.push(hslToHex(hsl.h, hsl.s * 0.5, 92));  // Very light
        
        // Warm accent (shifted hue towards red/orange)
        const warmHue = (hsl.h + 30) % 360;
        palette.push(hslToHex(warmHue, hsl.s, 50));
        
        // Cool accent (shifted hue towards blue)
        const coolHue = (hsl.h - 30 + 360) % 360;
        palette.push(hslToHex(coolHue, hsl.s, 50));
        
        // Complementary accent
        const compHue = (hsl.h + 180) % 360;
        palette.push(hslToHex(compHue, hsl.s * 0.8, 45));
        
        return palette;
    }, []);

    /**
     * Suggest harmonious colors for a given palette
     */
    const suggestForPalette = useCallback((palette: string[]): string[] => {
        if (palette.length === 0) return [];
        
        const suggestions: Set<string> = new Set();
        
        // Get complementary and analogous for each color
        for (const color of palette.slice(0, 3)) { // Limit to first 3 colors
            const comp = getComplementary(color);
            const analog = getAnalogous(color);
            
            comp.forEach(c => suggestions.add(c));
            analog.forEach(c => suggestions.add(c));
        }
        
        // Remove colors already in palette
        for (const color of palette) {
            suggestions.delete(color);
        }
        
        return Array.from(suggestions).slice(0, 8);
    }, [getComplementary, getAnalogous]);

    return {
        getComplementary,
        getAnalogous,
        getTriadic,
        getSplitComplementary,
        getTetradic,
        getMonochromatic,
        getHarmony,
        generatePixelArtPalette,
        suggestForPalette,
        hexToHsl,
        hslToHex,
    };
}

export type { HarmonyType };
export default useColorHarmony;
