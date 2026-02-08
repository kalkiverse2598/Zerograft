"use client";

import { useCallback, RefObject } from "react";
import { shouldDrawPixel, DitherPattern } from "@/lib/pixelEditor/ditherPatterns";
import { Tool, MirrorMode } from "./useEditorState";

// Helper: Convert hex to RGBA array
export const hexToRgba = (hex: string): [number, number, number, number] => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b, 255];
};

// Helper: Check if two colors match
export const colorsMatch = (a: Uint8ClampedArray | number[], b: number[]): boolean => {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
};

// Helper: Convert RGBA to hex
export const rgbaToHex = (r: number, g: number, b: number): string => {
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
};

export interface DrawingOptions {
    canvasRef: RefObject<HTMLCanvasElement | null>;
    getDrawingContext: () => CanvasRenderingContext2D | null;
    tool: Tool;
    color: string;
    secondaryColor: string;
    brushSize: number;
    mirrorMode: MirrorMode;
    ditherPattern: DitherPattern;
    selectionTools: {
        isPointSelected: (x: number, y: number) => boolean;
    };
    imageWidth: number;
    imageHeight: number;
}

export interface DrawingMethods {
    // Basic drawing
    drawPixelAt: (x: number, y: number, ctx: CanvasRenderingContext2D) => void;

    // Flood fill
    floodFill: (startX: number, startY: number) => void;

    // Shape tools
    drawLine: (x0: number, y0: number, x1: number, y1: number) => void;
    drawRect: (x0: number, y0: number, x1: number, y1: number, filled: boolean) => void;
    drawEllipse: (cx: number, cy: number, rx: number, ry: number) => void;
    drawGradient: (x0: number, y0: number, x1: number, y1: number) => void;

    // Color helpers
    hexToRgba: typeof hexToRgba;
    rgbaToHex: typeof rgbaToHex;
    colorsMatch: typeof colorsMatch;
}

export function useDrawing(options: DrawingOptions): DrawingMethods {
    const {
        canvasRef,
        getDrawingContext,
        tool,
        color,
        secondaryColor,
        brushSize,
        mirrorMode,
        ditherPattern,
        selectionTools,
        imageWidth,
        imageHeight,
    } = options;

    // Draw single pixel with optional mirror and dithering
    const drawPixelAt = useCallback((x: number, y: number, ctx: CanvasRenderingContext2D) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        ctx.imageSmoothingEnabled = false;

        const drawAt = (px: number, py: number) => {
            // Apply dithering - check each pixel in brush
            for (let bx = 0; bx < brushSize; bx++) {
                for (let by = 0; by < brushSize; by++) {
                    const pixelX = px + bx;
                    const pixelY = py + by;
                    // Skip this pixel if dithering pattern says no
                    if (!shouldDrawPixel(pixelX, pixelY, ditherPattern)) continue;

                    // Skip if pixel is outside selection (when selection exists)
                    if (!selectionTools.isPointSelected(pixelX, pixelY)) continue;

                    if (tool === "eraser") {
                        ctx.clearRect(pixelX, pixelY, 1, 1);
                    } else {
                        ctx.fillStyle = color;
                        ctx.fillRect(pixelX, pixelY, 1, 1);
                    }
                }
            }
        };

        drawAt(x, y);

        // Mirror mode
        if (mirrorMode === "h" || mirrorMode === "both") {
            drawAt(canvas.width - 1 - x - brushSize + 1, y);
        }
        if (mirrorMode === "v" || mirrorMode === "both") {
            drawAt(x, canvas.height - 1 - y - brushSize + 1);
        }
        if (mirrorMode === "both") {
            drawAt(canvas.width - 1 - x - brushSize + 1, canvas.height - 1 - y - brushSize + 1);
        }
    }, [canvasRef, tool, color, brushSize, mirrorMode, ditherPattern, selectionTools]);

    // Flood fill algorithm
    const floodFill = useCallback((startX: number, startY: number) => {
        const ctx = getDrawingContext();
        const canvas = canvasRef.current;
        if (!canvas || !ctx) return;

        const width = imageWidth || canvas.width;
        const height = imageHeight || canvas.height;

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        const getPixelIndex = (x: number, y: number) => (y * width + x) * 4;
        const getPixelColor = (x: number, y: number): number[] => {
            const i = getPixelIndex(x, y);
            return [data[i], data[i + 1], data[i + 2], data[i + 3]];
        };

        const targetColor = getPixelColor(startX, startY);
        const fillColor = hexToRgba(color);

        if (colorsMatch(targetColor, fillColor)) return;

        const stack: [number, number][] = [[startX, startY]];
        const visited = new Set<string>();

        while (stack.length > 0) {
            const [x, y] = stack.pop()!;
            const key = `${x},${y}`;

            if (visited.has(key)) continue;
            if (x < 0 || x >= width || y < 0 || y >= height) continue;

            const currentColor = getPixelColor(x, y);
            if (!colorsMatch(currentColor, targetColor)) continue;

            const i = getPixelIndex(x, y);
            data[i] = fillColor[0];
            data[i + 1] = fillColor[1];
            data[i + 2] = fillColor[2];
            data[i + 3] = fillColor[3];

            visited.add(key);
            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }

        ctx.putImageData(imageData, 0, 0);
    }, [canvasRef, color, getDrawingContext, imageWidth, imageHeight]);

    // Bresenham's line algorithm
    const drawLine = useCallback((x0: number, y0: number, x1: number, y1: number) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = color;

        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        let currentX = x0;
        let currentY = y0;

        while (true) {
            drawPixelAt(currentX, currentY, ctx);
            if (currentX === x1 && currentY === y1) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; currentX += sx; }
            if (e2 < dx) { err += dx; currentY += sy; }
        }
    }, [canvasRef, color, drawPixelAt]);

    // Draw rectangle
    const drawRect = useCallback((x0: number, y0: number, x1: number, y1: number, filled: boolean) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = color;

        const minX = Math.min(x0, x1);
        const minY = Math.min(y0, y1);
        const maxX = Math.max(x0, x1);
        const maxY = Math.max(y0, y1);

        if (filled) {
            ctx.fillRect(minX, minY, maxX - minX + 1, maxY - minY + 1);
        } else {
            // Draw outline using lines
            for (let x = minX; x <= maxX; x++) {
                ctx.fillRect(x, minY, 1, 1);
                ctx.fillRect(x, maxY, 1, 1);
            }
            for (let y = minY; y <= maxY; y++) {
                ctx.fillRect(minX, y, 1, 1);
                ctx.fillRect(maxX, y, 1, 1);
            }
        }
    }, [canvasRef, color]);

    // Draw ellipse (midpoint algorithm)
    const drawEllipse = useCallback((cx: number, cy: number, rx: number, ry: number) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = color;

        // Simple ellipse using parametric approach
        const steps = Math.max(rx, ry) * 8;
        for (let i = 0; i < steps; i++) {
            const angle = (i / steps) * 2 * Math.PI;
            const x = Math.round(cx + rx * Math.cos(angle));
            const y = Math.round(cy + ry * Math.sin(angle));
            ctx.fillRect(x, y, 1, 1);
        }
    }, [canvasRef, color]);

    // Draw linear gradient between two points
    const drawGradient = useCallback((x0: number, y0: number, x1: number, y1: number) => {
        const ctx = getDrawingContext();
        const canvas = canvasRef.current;
        if (!canvas || !ctx) return;

        const width = imageWidth || canvas.width;
        const height = imageHeight || canvas.height;

        // Parse colors
        const startRgb = hexToRgba(color);
        const endRgb = hexToRgba(secondaryColor);

        // Calculate gradient direction and length
        const dx = x1 - x0;
        const dy = y1 - y0;
        const gradientLength = Math.sqrt(dx * dx + dy * dy);

        if (gradientLength === 0) return;

        // Get current image data
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // For each pixel, calculate its position along the gradient line
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Vector from start point to current pixel
                const px = x - x0;
                const py = y - y0;

                // Project pixel onto gradient line
                const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (gradientLength * gradientLength)));

                // Interpolate colors
                const r = Math.round(startRgb[0] + t * (endRgb[0] - startRgb[0]));
                const g = Math.round(startRgb[1] + t * (endRgb[1] - startRgb[1]));
                const b = Math.round(startRgb[2] + t * (endRgb[2] - startRgb[2]));
                const a = Math.round(startRgb[3] + t * (endRgb[3] - startRgb[3]));

                const i = (y * width + x) * 4;
                data[i] = r;
                data[i + 1] = g;
                data[i + 2] = b;
                data[i + 3] = a;
            }
        }

        ctx.putImageData(imageData, 0, 0);
    }, [canvasRef, getDrawingContext, imageWidth, imageHeight, color, secondaryColor]);

    return {
        drawPixelAt,
        floodFill,
        drawLine,
        drawRect,
        drawEllipse,
        drawGradient,
        hexToRgba,
        rgbaToHex,
        colorsMatch,
    };
}
