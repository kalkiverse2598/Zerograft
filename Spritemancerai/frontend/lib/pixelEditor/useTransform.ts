/**
 * Transform Hook
 * Provides advanced transformation functions for pixel art
 * 
 * Features:
 * - Free rotation by any angle
 * - Skew horizontal/vertical
 * - Perspective distortion
 */

import { useCallback } from 'react';

export function useTransform() {

    /**
     * Rotate canvas by any angle (in degrees)
     * Uses pixel-aware rotation that maintains crisp edges
     * @param angle Rotation angle in degrees
     * @param preserveSize If true, keeps original canvas size (for preview/layer); if false, expands to fit
     */
    const rotate = useCallback((
        sourceCanvas: HTMLCanvasElement,
        angle: number,
        preserveSize: boolean = true
    ): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;
        const radians = (angle * Math.PI) / 180;

        // Calculate new dimensions
        let newWidth = width;
        let newHeight = height;
        
        if (!preserveSize) {
            // Calculate bounding box of rotated rectangle
            const cos = Math.abs(Math.cos(radians));
            const sin = Math.abs(Math.sin(radians));
            newWidth = Math.ceil(width * cos + height * sin);
            newHeight = Math.ceil(width * sin + height * cos);
        }

        const output = document.createElement('canvas');
        output.width = newWidth;
        output.height = newHeight;

        const ctx = output.getContext('2d');
        if (!ctx) return output;

        // Disable smoothing for pixel art
        ctx.imageSmoothingEnabled = false;

        // Move to center, rotate, then draw centered
        ctx.translate(newWidth / 2, newHeight / 2);
        ctx.rotate(radians);
        ctx.drawImage(sourceCanvas, -width / 2, -height / 2);

        return output;
    }, []);

    /**
     * Flip canvas horizontally
     */
    const flipHorizontal = useCallback((sourceCanvas: HTMLCanvasElement): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        const output = document.createElement('canvas');
        output.width = width;
        output.height = height;

        const ctx = output.getContext('2d');
        if (!ctx) return output;

        ctx.imageSmoothingEnabled = false;
        ctx.scale(-1, 1);
        ctx.drawImage(sourceCanvas, -width, 0);

        return output;
    }, []);

    /**
     * Flip canvas vertically
     */
    const flipVertical = useCallback((sourceCanvas: HTMLCanvasElement): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        const output = document.createElement('canvas');
        output.width = width;
        output.height = height;

        const ctx = output.getContext('2d');
        if (!ctx) return output;

        ctx.imageSmoothingEnabled = false;
        ctx.scale(1, -1);
        ctx.drawImage(sourceCanvas, 0, -height);

        return output;
    }, []);

    /**
     * Skew canvas horizontally
     * @param angle Skew angle in degrees (-45 to 45)
     * @param preserveSize If true, keeps original canvas size
     */
    const skewHorizontal = useCallback((
        sourceCanvas: HTMLCanvasElement,
        angle: number,
        preserveSize: boolean = true
    ): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;
        const radians = (Math.max(-45, Math.min(45, angle)) * Math.PI) / 180;
        const skewAmount = Math.tan(radians);

        const output = document.createElement('canvas');
        
        if (preserveSize) {
            // Keep original size, skew content within bounds
            output.width = width;
            output.height = height;

            const ctx = output.getContext('2d');
            if (!ctx) return output;

            ctx.imageSmoothingEnabled = false;
            
            // Center the skewed content
            const offsetX = (height * skewAmount) / 2;
            ctx.transform(1, 0, skewAmount, 1, -offsetX, 0);
            ctx.drawImage(sourceCanvas, 0, 0);
        } else {
            // Expand canvas to fit
            const extraWidth = Math.abs(height * skewAmount);
            output.width = Math.ceil(width + extraWidth);
            output.height = height;

            const ctx = output.getContext('2d');
            if (!ctx) return output;

            ctx.imageSmoothingEnabled = false;
            ctx.transform(1, 0, skewAmount, 1, skewAmount < 0 ? extraWidth : 0, 0);
            ctx.drawImage(sourceCanvas, 0, 0);
        }

        return output;
    }, []);

    /**
     * Skew canvas vertically
     * @param angle Skew angle in degrees (-45 to 45)
     * @param preserveSize If true, keeps original canvas size
     */
    const skewVertical = useCallback((
        sourceCanvas: HTMLCanvasElement,
        angle: number,
        preserveSize: boolean = true
    ): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;
        const radians = (Math.max(-45, Math.min(45, angle)) * Math.PI) / 180;
        const skewAmount = Math.tan(radians);

        const output = document.createElement('canvas');

        if (preserveSize) {
            // Keep original size, skew content within bounds
            output.width = width;
            output.height = height;

            const ctx = output.getContext('2d');
            if (!ctx) return output;

            ctx.imageSmoothingEnabled = false;
            
            // Center the skewed content
            const offsetY = (width * skewAmount) / 2;
            ctx.transform(1, skewAmount, 0, 1, 0, -offsetY);
            ctx.drawImage(sourceCanvas, 0, 0);
        } else {
            // Expand canvas to fit
            const extraHeight = Math.abs(width * skewAmount);
            output.width = width;
            output.height = Math.ceil(height + extraHeight);

            const ctx = output.getContext('2d');
            if (!ctx) return output;

            ctx.imageSmoothingEnabled = false;
            ctx.transform(1, skewAmount, 0, 1, 0, skewAmount < 0 ? extraHeight : 0);
            ctx.drawImage(sourceCanvas, 0, 0);
        }

        return output;
    }, []);

    /**
     * Apply perspective transform (trapezoid distortion)
     * @param topScale Scale factor for top edge (0.5 = half width, 1.5 = 1.5x width)
     * @param bottomScale Scale factor for bottom edge
     * @param preserveSize If true, keeps original canvas size
     */
    const perspective = useCallback((
        sourceCanvas: HTMLCanvasElement,
        topScale: number = 1,
        bottomScale: number = 1,
        preserveSize: boolean = true
    ): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        // Calculate output dimensions
        const maxScale = Math.max(topScale, bottomScale);
        const outputWidth = preserveSize ? width : Math.ceil(width * maxScale);

        const output = document.createElement('canvas');
        output.width = outputWidth;
        output.height = height;

        const sourceCtx = sourceCanvas.getContext('2d');
        const outputCtx = output.getContext('2d');
        if (!sourceCtx || !outputCtx) return output;

        const sourceData = sourceCtx.getImageData(0, 0, width, height);
        const outputData = outputCtx.createImageData(outputWidth, height);

        // For each row, calculate the scaled position
        for (let y = 0; y < height; y++) {
            // Interpolate scale between top and bottom
            const t = height > 1 ? y / (height - 1) : 0;
            const rowScale = topScale * (1 - t) + bottomScale * t;
            const rowWidth = width * rowScale;
            const rowOffset = (outputWidth - rowWidth) / 2;

            for (let x = 0; x < width; x++) {
                // Map source x to destination x
                const destX = Math.floor(rowOffset + (x / width) * rowWidth);
                
                if (destX >= 0 && destX < outputWidth) {
                    const srcIdx = (y * width + x) * 4;
                    const dstIdx = (y * outputWidth + destX) * 4;

                    outputData.data[dstIdx] = sourceData.data[srcIdx];
                    outputData.data[dstIdx + 1] = sourceData.data[srcIdx + 1];
                    outputData.data[dstIdx + 2] = sourceData.data[srcIdx + 2];
                    outputData.data[dstIdx + 3] = sourceData.data[srcIdx + 3];
                }
            }
        }

        outputCtx.putImageData(outputData, 0, 0);
        return output;
    }, []);

    /**
     * Stretch/squash the image
     * @param scaleX Horizontal scale factor
     * @param scaleY Vertical scale factor
     */
    const stretch = useCallback((
        sourceCanvas: HTMLCanvasElement,
        scaleX: number = 1,
        scaleY: number = 1
    ): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        const newWidth = Math.max(1, Math.round(width * scaleX));
        const newHeight = Math.max(1, Math.round(height * scaleY));

        const output = document.createElement('canvas');
        output.width = newWidth;
        output.height = newHeight;

        const ctx = output.getContext('2d');
        if (!ctx) return output;

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sourceCanvas, 0, 0, newWidth, newHeight);

        return output;
    }, []);

    /**
     * Offset/wrap the image (tile offset)
     * @param offsetX Horizontal offset in pixels
     * @param offsetY Vertical offset in pixels
     */
    const offset = useCallback((
        sourceCanvas: HTMLCanvasElement,
        offsetX: number = 0,
        offsetY: number = 0
    ): HTMLCanvasElement => {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        // Normalize offsets to be within bounds
        const normX = ((offsetX % width) + width) % width;
        const normY = ((offsetY % height) + height) % height;

        const output = document.createElement('canvas');
        output.width = width;
        output.height = height;

        const ctx = output.getContext('2d');
        if (!ctx) return output;

        ctx.imageSmoothingEnabled = false;

        // Draw four quadrants to create wrap effect
        ctx.drawImage(sourceCanvas, normX, normY);
        ctx.drawImage(sourceCanvas, normX - width, normY);
        ctx.drawImage(sourceCanvas, normX, normY - height);
        ctx.drawImage(sourceCanvas, normX - width, normY - height);

        return output;
    }, []);

    return {
        rotate,
        flipHorizontal,
        flipVertical,
        skewHorizontal,
        skewVertical,
        perspective,
        stretch,
        offset,
    };
}

export default useTransform;
