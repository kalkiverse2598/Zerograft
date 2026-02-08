/**
 * Image Effects Hook
 * Provides various image adjustment and effect functions for pixel art
 * 
 * Features:
 * - Brightness/Contrast adjustment
 * - Hue/Saturation/Lightness adjustment
 * - Posterize (reduce color levels)
 * - Blur (pixel-aware box blur)
 * - Sharpen
 */

import { useCallback } from 'react';

// Helper: Clamp value between min and max
function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

// Helper: RGB to HSL conversion
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            case b:
                h = ((r - g) / d + 4) / 6;
                break;
        }
    }

    return [h * 360, s * 100, l * 100];
}

// Helper: HSL to RGB conversion
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    h /= 360;
    s /= 100;
    l /= 100;

    let r, g, b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export function useImageEffects() {

    /**
     * Adjust brightness and contrast
     * @param brightness -100 to 100 (0 = no change)
     * @param contrast -100 to 100 (0 = no change)
     */
    const adjustBrightnessContrast = useCallback((
        sourceCanvas: HTMLCanvasElement,
        brightness: number = 0,
        contrast: number = 0
    ): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        const output = document.createElement('canvas');
        output.width = width;
        output.height = height;

        const sourceCtx = sourceCanvas.getContext('2d');
        const outputCtx = output.getContext('2d');
        if (!sourceCtx || !outputCtx) return output;

        const imageData = sourceCtx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Normalize values
        const brightnessOffset = (brightness / 100) * 255;
        const contrastFactor = (contrast + 100) / 100;
        const contrastOffset = 128 * (1 - contrastFactor);

        for (let i = 0; i < data.length; i += 4) {
            // Skip fully transparent pixels
            if (data[i + 3] === 0) continue;

            // Apply contrast then brightness
            data[i] = clamp(data[i] * contrastFactor + contrastOffset + brightnessOffset, 0, 255);
            data[i + 1] = clamp(data[i + 1] * contrastFactor + contrastOffset + brightnessOffset, 0, 255);
            data[i + 2] = clamp(data[i + 2] * contrastFactor + contrastOffset + brightnessOffset, 0, 255);
        }

        outputCtx.putImageData(imageData, 0, 0);
        return output;
    }, []);

    /**
     * Adjust hue, saturation, and lightness
     * @param hue -180 to 180 degrees (0 = no change)
     * @param saturation -100 to 100 (0 = no change)
     * @param lightness -100 to 100 (0 = no change)
     */
    const adjustHSL = useCallback((
        sourceCanvas: HTMLCanvasElement,
        hue: number = 0,
        saturation: number = 0,
        lightness: number = 0
    ): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        const output = document.createElement('canvas');
        output.width = width;
        output.height = height;

        const sourceCtx = sourceCanvas.getContext('2d');
        const outputCtx = output.getContext('2d');
        if (!sourceCtx || !outputCtx) return output;

        const imageData = sourceCtx.getImageData(0, 0, width, height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            // Skip fully transparent pixels
            if (data[i + 3] === 0) continue;

            // Convert to HSL
            let [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);

            // Apply adjustments
            h = (h + hue + 360) % 360;
            s = clamp(s + saturation, 0, 100);
            l = clamp(l + lightness, 0, 100);

            // Convert back to RGB
            const [r, g, b] = hslToRgb(h, s, l);
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
        }

        outputCtx.putImageData(imageData, 0, 0);
        return output;
    }, []);

    /**
     * Invert colors
     */
    const invert = useCallback((sourceCanvas: HTMLCanvasElement): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        const output = document.createElement('canvas');
        output.width = width;
        output.height = height;

        const sourceCtx = sourceCanvas.getContext('2d');
        const outputCtx = output.getContext('2d');
        if (!sourceCtx || !outputCtx) return output;

        const imageData = sourceCtx.getImageData(0, 0, width, height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;

            data[i] = 255 - data[i];
            data[i + 1] = 255 - data[i + 1];
            data[i + 2] = 255 - data[i + 2];
        }

        outputCtx.putImageData(imageData, 0, 0);
        return output;
    }, []);

    /**
     * Convert to grayscale
     */
    const grayscale = useCallback((sourceCanvas: HTMLCanvasElement): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        const output = document.createElement('canvas');
        output.width = width;
        output.height = height;

        const sourceCtx = sourceCanvas.getContext('2d');
        const outputCtx = output.getContext('2d');
        if (!sourceCtx || !outputCtx) return output;

        const imageData = sourceCtx.getImageData(0, 0, width, height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;

            // Use luminance formula for better perceptual grayscale
            const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
        }

        outputCtx.putImageData(imageData, 0, 0);
        return output;
    }, []);

    /**
     * Posterize - reduce number of color levels
     * @param levels 2-256 (lower = more posterized)
     */
    const posterize = useCallback((
        sourceCanvas: HTMLCanvasElement,
        levels: number = 4
    ): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        const output = document.createElement('canvas');
        output.width = width;
        output.height = height;

        const sourceCtx = sourceCanvas.getContext('2d');
        const outputCtx = output.getContext('2d');
        if (!sourceCtx || !outputCtx) return output;

        const imageData = sourceCtx.getImageData(0, 0, width, height);
        const data = imageData.data;

        const numLevels = clamp(levels, 2, 256);
        const step = 255 / (numLevels - 1);

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;

            data[i] = Math.round(Math.round(data[i] / step) * step);
            data[i + 1] = Math.round(Math.round(data[i + 1] / step) * step);
            data[i + 2] = Math.round(Math.round(data[i + 2] / step) * step);
        }

        outputCtx.putImageData(imageData, 0, 0);
        return output;
    }, []);

    /**
     * Box blur - pixel-aware blur that respects transparency
     * @param radius 1-10 pixels
     */
    const blur = useCallback((
        sourceCanvas: HTMLCanvasElement,
        radius: number = 1
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

        const r = clamp(Math.floor(radius), 1, 10);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;

                // Skip fully transparent pixels
                if (sourceData.data[idx + 3] === 0) {
                    outputData.data[idx + 3] = 0;
                    continue;
                }

                let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
                let count = 0;

                // Sample surrounding pixels
                for (let dy = -r; dy <= r; dy++) {
                    for (let dx = -r; dx <= r; dx++) {
                        const nx = x + dx;
                        const ny = y + dy;

                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const nIdx = (ny * width + nx) * 4;
                            // Only include non-transparent pixels
                            if (sourceData.data[nIdx + 3] > 0) {
                                rSum += sourceData.data[nIdx];
                                gSum += sourceData.data[nIdx + 1];
                                bSum += sourceData.data[nIdx + 2];
                                aSum += sourceData.data[nIdx + 3];
                                count++;
                            }
                        }
                    }
                }

                if (count > 0) {
                    outputData.data[idx] = Math.round(rSum / count);
                    outputData.data[idx + 1] = Math.round(gSum / count);
                    outputData.data[idx + 2] = Math.round(bSum / count);
                    outputData.data[idx + 3] = Math.round(aSum / count);
                }
            }
        }

        outputCtx.putImageData(outputData, 0, 0);
        return output;
    }, []);

    /**
     * Sharpen using unsharp mask technique
     * @param amount 0-200 (100 = normal, higher = more sharp)
     */
    const sharpen = useCallback((
        sourceCanvas: HTMLCanvasElement,
        amount: number = 100
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

        // Sharpen kernel (Laplacian)
        const factor = amount / 100;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;

                // Skip fully transparent pixels
                if (sourceData.data[idx + 3] === 0) {
                    outputData.data[idx + 3] = 0;
                    continue;
                }

                // Get center and neighbor pixels
                const getPixel = (px: number, py: number, channel: number): number => {
                    if (px < 0 || px >= width || py < 0 || py >= height) {
                        return sourceData.data[idx + channel];
                    }
                    const pIdx = (py * width + px) * 4;
                    return sourceData.data[pIdx + channel];
                };

                for (let c = 0; c < 3; c++) {
                    const center = sourceData.data[idx + c];
                    const neighbors = 
                        getPixel(x - 1, y, c) +
                        getPixel(x + 1, y, c) +
                        getPixel(x, y - 1, c) +
                        getPixel(x, y + 1, c);

                    // Laplacian sharpening
                    const sharpened = center + factor * (4 * center - neighbors);
                    outputData.data[idx + c] = clamp(Math.round(sharpened), 0, 255);
                }
                outputData.data[idx + 3] = sourceData.data[idx + 3];
            }
        }

        outputCtx.putImageData(outputData, 0, 0);
        return output;
    }, []);

    /**
     * Pixelate effect - good for creating chunky pixel art from higher res
     * @param blockSize size of each "pixel" block
     */
    const pixelate = useCallback((
        sourceCanvas: HTMLCanvasElement,
        blockSize: number = 2
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

        const size = clamp(blockSize, 2, 32);

        for (let y = 0; y < height; y += size) {
            for (let x = 0; x < width; x += size) {
                // Get average color of block
                let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
                let count = 0;

                for (let dy = 0; dy < size && y + dy < height; dy++) {
                    for (let dx = 0; dx < size && x + dx < width; dx++) {
                        const idx = ((y + dy) * width + (x + dx)) * 4;
                        if (sourceData.data[idx + 3] > 0) {
                            rSum += sourceData.data[idx];
                            gSum += sourceData.data[idx + 1];
                            bSum += sourceData.data[idx + 2];
                            aSum += sourceData.data[idx + 3];
                            count++;
                        }
                    }
                }

                if (count > 0) {
                    const avgR = Math.round(rSum / count);
                    const avgG = Math.round(gSum / count);
                    const avgB = Math.round(bSum / count);
                    const avgA = Math.round(aSum / count);

                    // Fill block with average color
                    for (let dy = 0; dy < size && y + dy < height; dy++) {
                        for (let dx = 0; dx < size && x + dx < width; dx++) {
                            const idx = ((y + dy) * width + (x + dx)) * 4;
                            outputData.data[idx] = avgR;
                            outputData.data[idx + 1] = avgG;
                            outputData.data[idx + 2] = avgB;
                            outputData.data[idx + 3] = avgA;
                        }
                    }
                }
            }
        }

        outputCtx.putImageData(outputData, 0, 0);
        return output;
    }, []);

    /**
     * Sepia tone effect
     */
    const sepia = useCallback((sourceCanvas: HTMLCanvasElement): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        const output = document.createElement('canvas');
        output.width = width;
        output.height = height;

        const sourceCtx = sourceCanvas.getContext('2d');
        const outputCtx = output.getContext('2d');
        if (!sourceCtx || !outputCtx) return output;

        const imageData = sourceCtx.getImageData(0, 0, width, height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;

            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            data[i] = clamp(Math.round(0.393 * r + 0.769 * g + 0.189 * b), 0, 255);
            data[i + 1] = clamp(Math.round(0.349 * r + 0.686 * g + 0.168 * b), 0, 255);
            data[i + 2] = clamp(Math.round(0.272 * r + 0.534 * g + 0.131 * b), 0, 255);
        }

        outputCtx.putImageData(imageData, 0, 0);
        return output;
    }, []);

    return {
        adjustBrightnessContrast,
        adjustHSL,
        invert,
        grayscale,
        posterize,
        blur,
        sharpen,
        pixelate,
        sepia,
    };
}

export default useImageEffects;
