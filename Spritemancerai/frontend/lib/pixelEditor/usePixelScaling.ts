/**
 * Pixel Scaling Hook
 * Scale pixel art using specialized algorithms that preserve sharp edges
 * 
 * Features:
 * - Scale2x / Scale3x algorithms
 * - Nearest neighbor (crisp)
 * - EPX (Eric's Pixel Expansion)
 */

import { useCallback } from 'react';

type ScaleAlgorithm = 'nearest' | 'scale2x' | 'scale3x' | 'epx';

export function usePixelScaling() {

    /**
     * Nearest neighbor scaling (simple pixel duplication)
     */
    const scaleNearest = useCallback((
        sourceCanvas: HTMLCanvasElement,
        scale: number
    ): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        const output = document.createElement('canvas');
        output.width = width * scale;
        output.height = height * scale;

        const ctx = output.getContext('2d');
        if (!ctx) return output;

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sourceCanvas, 0, 0, output.width, output.height);

        return output;
    }, []);

    /**
     * Scale2x algorithm - doubles size with edge detection
     * Creates smoother diagonals while preserving pixel art feel
     */
    const scale2x = useCallback((sourceCanvas: HTMLCanvasElement): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        const output = document.createElement('canvas');
        output.width = width * 2;
        output.height = height * 2;

        const sourceCtx = sourceCanvas.getContext('2d');
        const outputCtx = output.getContext('2d');
        if (!sourceCtx || !outputCtx) return output;

        const sourceData = sourceCtx.getImageData(0, 0, width, height);
        const outputData = outputCtx.createImageData(width * 2, height * 2);

        const getPixel = (x: number, y: number): [number, number, number, number] => {
            if (x < 0 || x >= width || y < 0 || y >= height) {
                return [0, 0, 0, 0];
            }
            const idx = (y * width + x) * 4;
            return [
                sourceData.data[idx],
                sourceData.data[idx + 1],
                sourceData.data[idx + 2],
                sourceData.data[idx + 3],
            ];
        };

        const setPixel = (x: number, y: number, color: [number, number, number, number]) => {
            const idx = (y * width * 2 + x) * 4;
            outputData.data[idx] = color[0];
            outputData.data[idx + 1] = color[1];
            outputData.data[idx + 2] = color[2];
            outputData.data[idx + 3] = color[3];
        };

        const colorsEqual = (a: [number, number, number, number], b: [number, number, number, number]): boolean => {
            return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
        };

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Get surrounding pixels
                const A = getPixel(x, y - 1);     // Top
                const B = getPixel(x - 1, y);     // Left
                const C = getPixel(x, y);         // Center (current)
                const D = getPixel(x + 1, y);     // Right
                const E = getPixel(x, y + 1);     // Bottom

                // Scale2x algorithm
                let E0 = C, E1 = C, E2 = C, E3 = C;

                if (!colorsEqual(B, D) && !colorsEqual(A, E)) {
                    E0 = colorsEqual(A, B) ? A : C;
                    E1 = colorsEqual(A, D) ? A : C;
                    E2 = colorsEqual(E, B) ? E : C;
                    E3 = colorsEqual(E, D) ? E : C;
                }

                // Set output pixels
                setPixel(x * 2, y * 2, E0);
                setPixel(x * 2 + 1, y * 2, E1);
                setPixel(x * 2, y * 2 + 1, E2);
                setPixel(x * 2 + 1, y * 2 + 1, E3);
            }
        }

        outputCtx.putImageData(outputData, 0, 0);
        return output;
    }, []);

    /**
     * Scale3x algorithm - triples size with edge detection
     */
    const scale3x = useCallback((sourceCanvas: HTMLCanvasElement): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        const output = document.createElement('canvas');
        output.width = width * 3;
        output.height = height * 3;

        const sourceCtx = sourceCanvas.getContext('2d');
        const outputCtx = output.getContext('2d');
        if (!sourceCtx || !outputCtx) return output;

        const sourceData = sourceCtx.getImageData(0, 0, width, height);
        const outputData = outputCtx.createImageData(width * 3, height * 3);

        const getPixel = (x: number, y: number): [number, number, number, number] => {
            if (x < 0 || x >= width || y < 0 || y >= height) {
                return [0, 0, 0, 0];
            }
            const idx = (y * width + x) * 4;
            return [
                sourceData.data[idx],
                sourceData.data[idx + 1],
                sourceData.data[idx + 2],
                sourceData.data[idx + 3],
            ];
        };

        const setPixel = (x: number, y: number, color: [number, number, number, number]) => {
            const idx = (y * width * 3 + x) * 4;
            outputData.data[idx] = color[0];
            outputData.data[idx + 1] = color[1];
            outputData.data[idx + 2] = color[2];
            outputData.data[idx + 3] = color[3];
        };

        const colorsEqual = (a: [number, number, number, number], b: [number, number, number, number]): boolean => {
            return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
        };

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Get 3x3 neighborhood
                const A = getPixel(x - 1, y - 1);
                const B = getPixel(x, y - 1);
                const C = getPixel(x + 1, y - 1);
                const D = getPixel(x - 1, y);
                const E = getPixel(x, y);
                const F = getPixel(x + 1, y);
                const G = getPixel(x - 1, y + 1);
                const H = getPixel(x, y + 1);
                const I = getPixel(x + 1, y + 1);

                // Scale3x algorithm - 9 output pixels
                let E0 = E, E1 = E, E2 = E;
                let E3 = E, E4 = E, E5 = E;
                let E6 = E, E7 = E, E8 = E;

                if (!colorsEqual(D, F) && !colorsEqual(B, H)) {
                    E0 = colorsEqual(D, B) ? D : E;
                    E1 = (colorsEqual(D, B) && !colorsEqual(E, C)) || (colorsEqual(B, F) && !colorsEqual(E, A)) ? B : E;
                    E2 = colorsEqual(B, F) ? F : E;
                    E3 = (colorsEqual(D, B) && !colorsEqual(E, G)) || (colorsEqual(D, H) && !colorsEqual(E, A)) ? D : E;
                    E4 = E;
                    E5 = (colorsEqual(B, F) && !colorsEqual(E, I)) || (colorsEqual(H, F) && !colorsEqual(E, C)) ? F : E;
                    E6 = colorsEqual(D, H) ? D : E;
                    E7 = (colorsEqual(D, H) && !colorsEqual(E, I)) || (colorsEqual(H, F) && !colorsEqual(E, G)) ? H : E;
                    E8 = colorsEqual(H, F) ? F : E;
                }

                // Set output pixels
                setPixel(x * 3, y * 3, E0);
                setPixel(x * 3 + 1, y * 3, E1);
                setPixel(x * 3 + 2, y * 3, E2);
                setPixel(x * 3, y * 3 + 1, E3);
                setPixel(x * 3 + 1, y * 3 + 1, E4);
                setPixel(x * 3 + 2, y * 3 + 1, E5);
                setPixel(x * 3, y * 3 + 2, E6);
                setPixel(x * 3 + 1, y * 3 + 2, E7);
                setPixel(x * 3 + 2, y * 3 + 2, E8);
            }
        }

        outputCtx.putImageData(outputData, 0, 0);
        return output;
    }, []);

    /**
     * EPX (Eric's Pixel Expansion) - simpler Scale2x variant
     */
    const epx = useCallback((sourceCanvas: HTMLCanvasElement): HTMLCanvasElement => {
        // EPX is essentially the same as Scale2x
        return scale2x(sourceCanvas);
    }, [scale2x]);

    /**
     * Scale using specified algorithm
     */
    const scale = useCallback((
        sourceCanvas: HTMLCanvasElement,
        algorithm: ScaleAlgorithm,
        factor?: number
    ): HTMLCanvasElement => {
        switch (algorithm) {
            case 'nearest':
                return scaleNearest(sourceCanvas, factor ?? 2);
            case 'scale2x':
                return scale2x(sourceCanvas);
            case 'scale3x':
                return scale3x(sourceCanvas);
            case 'epx':
                return epx(sourceCanvas);
            default:
                return scaleNearest(sourceCanvas, factor ?? 2);
        }
    }, [scaleNearest, scale2x, scale3x, epx]);

    return {
        scale,
        scaleNearest,
        scale2x,
        scale3x,
        epx,
    };
}

export type { ScaleAlgorithm };
export default usePixelScaling;
