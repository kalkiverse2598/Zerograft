"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface MaskDrawerProps {
    imageUrl: string;
    onMaskComplete: (maskDataUrl: string) => void;
}

export function MaskDrawer({ imageUrl, onMaskComplete }: MaskDrawerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const [brushSize, setBrushSize] = useState(20);
    const [imageWidth, setImageWidth] = useState(256);
    const [imageHeight, setImageHeight] = useState(256);
    const [displayScale, setDisplayScale] = useState(1);
    const [hasMask, setHasMask] = useState(false);
    const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);

    // Load image first (separate from canvas setup)
    useEffect(() => {
        console.log("🔄 MaskDrawer: Loading image:", imageUrl);
        const img = new Image();
        img.crossOrigin = "anonymous";

        img.onload = () => {
            console.log("✅ MaskDrawer: Image loaded:", img.width, "x", img.height);
            setImageWidth(img.width);
            setImageHeight(img.height);

            // Calculate display scale to fit container
            const maxWidth = 400;
            const scale = Math.min(1, maxWidth / img.width);
            setDisplayScale(scale);

            setLoadedImage(img);
            setIsLoading(false);
        };

        img.onerror = (err) => {
            console.error("❌ MaskDrawer: Failed to load image:", err);
            console.error("Image URL:", imageUrl);
            setLoadError(true);
            setIsLoading(false);
        };

        img.src = imageUrl;
    }, [imageUrl]);

    // Setup canvas after image is loaded
    useEffect(() => {
        if (!loadedImage) return;

        const canvas = canvasRef.current;
        const maskCanvas = maskCanvasRef.current;
        if (!canvas || !maskCanvas) return;

        canvas.width = loadedImage.width;
        canvas.height = loadedImage.height;
        maskCanvas.width = loadedImage.width;
        maskCanvas.height = loadedImage.height;

        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.drawImage(loadedImage, 0, 0);
        }

        // Initialize mask canvas as transparent
        const maskCtx = maskCanvas.getContext("2d");
        if (maskCtx) {
            maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        }

        console.log("✅ MaskDrawer: Canvases initialized");
    }, [loadedImage]);

    // Get canvas coordinates from mouse event
    const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = maskCanvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / displayScale);
        const y = Math.floor((e.clientY - rect.top) / displayScale);

        return { x, y };
    }, [displayScale]);

    // Draw on mask canvas
    const drawMask = useCallback((x: number, y: number) => {
        const maskCanvas = maskCanvasRef.current;
        const ctx = maskCanvas?.getContext("2d");
        if (!maskCanvas || !ctx) return;

        // Draw white circle (mask area)
        ctx.fillStyle = "rgba(255, 0, 0, 0.5)"; // Semi-transparent red for visibility
        ctx.beginPath();
        ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();

        setHasMask(true);
    }, [brushSize]);

    // Mouse handlers
    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        setIsDrawing(true);
        const { x, y } = getCanvasCoords(e);
        drawMask(x, y);
    }, [getCanvasCoords, drawMask]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const { x, y } = getCanvasCoords(e);
        drawMask(x, y);
    }, [isDrawing, getCanvasCoords, drawMask]);

    const handleMouseUp = useCallback(() => {
        setIsDrawing(false);
    }, []);

    // Clear mask
    const handleClear = useCallback(() => {
        const maskCanvas = maskCanvasRef.current;
        const ctx = maskCanvas?.getContext("2d");
        if (!maskCanvas || !ctx) return;

        ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        setHasMask(false);
    }, []);

    // Generate mask as base64
    const handleApplyMask = useCallback(() => {
        const maskCanvas = maskCanvasRef.current;
        if (!maskCanvas) return;

        // Create a new canvas for the actual mask (white on black)
        const outputCanvas = document.createElement("canvas");
        outputCanvas.width = maskCanvas.width;
        outputCanvas.height = maskCanvas.height;
        const ctx = outputCanvas.getContext("2d");
        if (!ctx) return;

        // Fill with black background
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);

        // Get mask data and convert red areas to white
        const maskCtx = maskCanvas.getContext("2d");
        if (!maskCtx) return;

        const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
        const outputData = ctx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);

        for (let i = 0; i < maskData.data.length; i += 4) {
            // If there's any red/alpha, make it white in output
            if (maskData.data[i] > 0 || maskData.data[i + 3] > 0) {
                outputData.data[i] = 255;     // R
                outputData.data[i + 1] = 255; // G
                outputData.data[i + 2] = 255; // B
                outputData.data[i + 3] = 255; // A
            }
        }

        ctx.putImageData(outputData, 0, 0);

        // Convert to base64
        const dataUrl = outputCanvas.toDataURL("image/png");
        onMaskComplete(dataUrl);
    }, [onMaskComplete]);

    if (loadError) {
        return (
            <div className="aspect-square bg-zinc-900 rounded-xl flex items-center justify-center">
                <div className="text-center text-zinc-400">
                    <p className="text-red-400 mb-2">❌ Failed to load image</p>
                    <p className="text-xs">Check browser console for details</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Canvas Container */}
            <div
                ref={containerRef}
                className="relative bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden flex items-center justify-center"
                style={{ minHeight: "300px" }}
            >
                {/* Loading overlay */}
                {isLoading && (
                    <div className="absolute inset-0 bg-zinc-900/80 flex items-center justify-center z-10">
                        <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                    </div>
                )}

                {/* Base image canvas */}
                <canvas
                    ref={canvasRef}
                    className="absolute"
                    style={{
                        width: imageWidth * displayScale,
                        height: imageHeight * displayScale,
                        imageRendering: "pixelated",
                    }}
                />

                {/* Mask drawing canvas (overlay) */}
                <canvas
                    ref={maskCanvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    className="relative cursor-crosshair"
                    style={{
                        width: imageWidth * displayScale,
                        height: imageHeight * displayScale,
                    }}
                />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <label className="text-sm text-zinc-400">Brush:</label>
                    <select
                        value={brushSize}
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                        className="bg-zinc-800 text-white text-sm rounded px-2 py-1"
                    >
                        <option value={10}>10px</option>
                        <option value={20}>20px</option>
                        <option value={40}>40px</option>
                        <option value={60}>60px</option>
                        <option value={80}>80px</option>
                    </select>

                    <Button variant="secondary" size="sm" onClick={handleClear}>
                        Clear
                    </Button>
                </div>

                <Button
                    onClick={handleApplyMask}
                    disabled={!hasMask}
                    size="sm"
                >
                    Apply Mask ✓
                </Button>
            </div>

            {/* Instructions */}
            <p className="text-xs text-zinc-500">
                🖌️ Paint over the area that needs repair. Red = area to fix.
            </p>
        </div>
    );
}
