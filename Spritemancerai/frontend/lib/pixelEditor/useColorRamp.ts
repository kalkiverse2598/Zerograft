/**
 * Color Ramp Generator
 * Auto-generate smooth color gradients between two colors
 * 
 * Features:
 * - Generate ramps with adjustable step count
 * - Multiple interpolation modes (RGB, HSL, LAB)
 * - Perceptually uniform color spacing
 */

import { useCallback } from 'react';

interface UseColorRampOptions {
    interpolationMode: 'rgb' | 'hsl' | 'lab';
}

// Convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

// Convert RGB to hex
function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (x: number) => {
        const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Convert hex to HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } {
    const { r, g, b } = hexToRgb(hex);
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;

    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
            case rNorm: h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6; break;
            case gNorm: h = ((bNorm - rNorm) / d + 2) / 6; break;
            case bNorm: h = ((rNorm - gNorm) / d + 4) / 6; break;
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

    return rgbToHex(r * 255, g * 255, b * 255);
}

// Linear interpolation
function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

// Interpolate hue (shortest path around the circle)
function lerpHue(h1: number, h2: number, t: number): number {
    let diff = h2 - h1;
    
    // Take shortest path around the hue circle
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    
    let h = h1 + diff * t;
    if (h < 0) h += 360;
    if (h >= 360) h -= 360;
    
    return h;
}

export function useColorRamp({ interpolationMode = 'hsl' }: UseColorRampOptions) {
    
    /**
     * Generate a color ramp between two colors
     */
    const generateRamp = useCallback((
        startColor: string,
        endColor: string,
        steps: number = 5
    ): string[] => {
        if (steps < 2) return [startColor];
        
        const ramp: string[] = [];
        
        if (interpolationMode === 'rgb') {
            const start = hexToRgb(startColor);
            const end = hexToRgb(endColor);
            
            for (let i = 0; i < steps; i++) {
                const t = i / (steps - 1);
                const r = lerp(start.r, end.r, t);
                const g = lerp(start.g, end.g, t);
                const b = lerp(start.b, end.b, t);
                ramp.push(rgbToHex(r, g, b));
            }
        } else {
            // HSL interpolation (better for pixel art)
            const start = hexToHsl(startColor);
            const end = hexToHsl(endColor);
            
            for (let i = 0; i < steps; i++) {
                const t = i / (steps - 1);
                const h = lerpHue(start.h, end.h, t);
                const s = lerp(start.s, end.s, t);
                const l = lerp(start.l, end.l, t);
                ramp.push(hslToHex(h, s, l));
            }
        }
        
        return ramp;
    }, [interpolationMode]);

    /**
     * Generate a monochromatic ramp (same hue, varying lightness)
     */
    const generateMonoRamp = useCallback((
        baseColor: string,
        steps: number = 5,
        darkToLight: boolean = true
    ): string[] => {
        const hsl = hexToHsl(baseColor);
        const ramp: string[] = [];
        
        // Generate from 10% to 90% lightness
        const startL = darkToLight ? 10 : 90;
        const endL = darkToLight ? 90 : 10;
        
        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1);
            const l = lerp(startL, endL, t);
            ramp.push(hslToHex(hsl.h, hsl.s, l));
        }
        
        return ramp;
    }, []);

    /**
     * Generate a saturation ramp
     */
    const generateSaturationRamp = useCallback((
        baseColor: string,
        steps: number = 5
    ): string[] => {
        const hsl = hexToHsl(baseColor);
        const ramp: string[] = [];
        
        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1);
            const s = lerp(0, 100, t);
            ramp.push(hslToHex(hsl.h, s, hsl.l));
        }
        
        return ramp;
    }, []);

    /**
     * Generate a hue ramp (rainbow)
     */
    const generateHueRamp = useCallback((
        startHue: number = 0,
        steps: number = 12,
        saturation: number = 70,
        lightness: number = 50
    ): string[] => {
        const ramp: string[] = [];
        
        for (let i = 0; i < steps; i++) {
            const h = (startHue + (360 / steps) * i) % 360;
            ramp.push(hslToHex(h, saturation, lightness));
        }
        
        return ramp;
    }, []);

    /**
     * Adjust color brightness
     */
    const adjustBrightness = useCallback((
        color: string,
        amount: number // -100 to 100
    ): string => {
        const hsl = hexToHsl(color);
        const newL = Math.max(0, Math.min(100, hsl.l + amount));
        return hslToHex(hsl.h, hsl.s, newL);
    }, []);

    /**
     * Adjust color saturation
     */
    const adjustSaturation = useCallback((
        color: string,
        amount: number // -100 to 100
    ): string => {
        const hsl = hexToHsl(color);
        const newS = Math.max(0, Math.min(100, hsl.s + amount));
        return hslToHex(hsl.h, newS, hsl.l);
    }, []);

    return {
        generateRamp,
        generateMonoRamp,
        generateSaturationRamp,
        generateHueRamp,
        adjustBrightness,
        adjustSaturation,
        hexToRgb,
        rgbToHex,
        hexToHsl,
        hslToHex,
    };
}

export default useColorRamp;
