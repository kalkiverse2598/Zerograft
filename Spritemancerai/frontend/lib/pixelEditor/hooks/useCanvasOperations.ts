"use client";

import { useCallback, RefObject } from "react";
import { hexToRgba } from "./useDrawing";
import { AnchorPosition } from "@/components/PixelEditor/CanvasResizeModal";

export interface CanvasOperationsOptions {
    canvasRef: RefObject<HTMLCanvasElement | null>;
    saveToHistory: () => void;
    setImageWidth: (width: number) => void;
    setImageHeight: (height: number) => void;
}

export interface CanvasOperationsMethods {
    flipCanvas: (direction: "horizontal" | "vertical") => void;
    rotateCanvas: (direction: "cw" | "ccw") => void;
    resizeCanvas: (newWidth: number, newHeight: number, anchor: AnchorPosition) => void;
    colorSwap: (fromColor: string, toColor: string) => void;
    extractPalette: () => string[];
    rgbaToHex: (r: number, g: number, b: number) => string;
}

// Helper: Convert RGBA to hex
const rgbaToHex = (r: number, g: number, b: number): string => {
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
};

export function useCanvasOperations(options: CanvasOperationsOptions): CanvasOperationsMethods {
    const { canvasRef, saveToHistory, setImageWidth, setImageHeight } = options;

    // Flip canvas
    const flipCanvas = useCallback((direction: "horizontal" | "vertical") => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext("2d")!;
        tempCtx.putImageData(imageData, 0, 0);

        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (direction === "horizontal") {
            ctx.scale(-1, 1);
            ctx.drawImage(tempCanvas, -canvas.width, 0);
        } else {
            ctx.scale(1, -1);
            ctx.drawImage(tempCanvas, 0, -canvas.height);
        }
        ctx.restore();
        saveToHistory();
    }, [canvasRef, saveToHistory]);

    // Rotate canvas 90 degrees
    const rotateCanvas = useCallback((direction: "cw" | "ccw") => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const oldWidth = canvas.width;
        const oldHeight = canvas.height;

        // Create temp canvas with swapped dimensions
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = oldHeight;
        tempCanvas.height = oldWidth;
        const tempCtx = tempCanvas.getContext("2d")!;

        // Rotate and draw
        tempCtx.save();
        if (direction === "cw") {
            tempCtx.translate(oldHeight, 0);
            tempCtx.rotate(Math.PI / 2);
        } else {
            tempCtx.translate(0, oldWidth);
            tempCtx.rotate(-Math.PI / 2);
        }

        // Draw original image data onto temp canvas
        const origCanvas = document.createElement("canvas");
        origCanvas.width = oldWidth;
        origCanvas.height = oldHeight;
        const origCtx = origCanvas.getContext("2d")!;
        origCtx.putImageData(imageData, 0, 0);
        tempCtx.drawImage(origCanvas, 0, 0);
        tempCtx.restore();

        // Resize main canvas and copy rotated image
        canvas.width = oldHeight;
        canvas.height = oldWidth;
        setImageWidth(oldHeight);
        setImageHeight(oldWidth);
        ctx.drawImage(tempCanvas, 0, 0);
        saveToHistory();
    }, [canvasRef, saveToHistory, setImageWidth, setImageHeight]);

    // Resize canvas
    const resizeCanvas = useCallback((newWidth: number, newHeight: number, anchor: AnchorPosition) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const oldWidth = canvas.width;
        const oldHeight = canvas.height;

        // Calculate offset based on anchor position
        let offsetX = 0, offsetY = 0;
        if (anchor.includes("c")) offsetX = Math.floor((newWidth - oldWidth) / 2);
        if (anchor.includes("r")) offsetX = newWidth - oldWidth;
        if (anchor[0] === "m") offsetY = Math.floor((newHeight - oldHeight) / 2);
        if (anchor[0] === "b") offsetY = newHeight - oldHeight;

        // Resize canvas
        canvas.width = newWidth;
        canvas.height = newHeight;
        setImageWidth(newWidth);
        setImageHeight(newHeight);

        // Clear and redraw at offset
        ctx.clearRect(0, 0, newWidth, newHeight);
        ctx.putImageData(imageData, offsetX, offsetY);
        saveToHistory();
    }, [canvasRef, saveToHistory, setImageWidth, setImageHeight]);

    // Color swap
    const colorSwap = useCallback((fromColor: string, toColor: string) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const fromRgba = hexToRgba(fromColor);
        const toRgba = hexToRgba(toColor);

        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === fromRgba[0] && data[i + 1] === fromRgba[1] && data[i + 2] === fromRgba[2]) {
                data[i] = toRgba[0];
                data[i + 1] = toRgba[1];
                data[i + 2] = toRgba[2];
            }
        }

        ctx.putImageData(imageData, 0, 0);
        saveToHistory();
    }, [canvasRef, saveToHistory]);

    // Extract palette from current canvas
    const extractPalette = useCallback((): string[] => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return [];

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const colors = new Set<string>();

        for (let i = 0; i < imageData.data.length; i += 4) {
            if (imageData.data[i + 3] > 0) { // Only non-transparent
                const hex = rgbaToHex(imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]);
                colors.add(hex);
            }
        }

        return [...colors].slice(0, 32); // Limit to 32 colors
    }, [canvasRef]);

    return {
        flipCanvas,
        rotateCanvas,
        resizeCanvas,
        colorSwap,
        extractPalette,
        rgbaToHex,
    };
}
