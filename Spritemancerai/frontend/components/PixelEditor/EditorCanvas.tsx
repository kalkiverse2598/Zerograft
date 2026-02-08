"use client";

import React, { useCallback, useEffect } from "react";
import { usePixelEditorContext } from "./PixelEditorProvider";
import { OnionSkinOverlay } from "./OnionSkinOverlay";
import { ParticleOverlayCanvas } from "./ParticleOverlayCanvas";
import { rgbaToHex } from "@/lib/pixelEditor/hooks";

export function EditorCanvas() {
    const {
        editorState,
        canvasState,
        drawing,
        historyManager,
        clipboardManager,
        selectionTools,
        updateDisplay,
        pixelPerfect,
        getDrawingContext,
        animation,
        hitStopPreview,
        particleOverlay,
    } = usePixelEditorContext();

    const {
        tool,
        setTool,
        color,
        setColor,
        brushSize,
        zoom,
        showGrid,
        mirrorMode,
        pixelPerfectEnabled,
        onionSkinEnabled,
        onionSkinOpacity,
    } = editorState;

    const {
        canvasRef,
        containerRef,
        canvasWrapperRef,
        imageWidth,
        imageHeight,
        cursorPos,
        setCursorPos,
        getCanvasCoords,
    } = canvasState;

    const { drawPixelAt, floodFill, drawLine, drawRect, drawEllipse, drawGradient } = drawing;
    const { saveToHistory } = historyManager;
    const { selection, setSelection, selectionStart, setSelectionStart } = clipboardManager;

    // Helper to sync current frame thumbnail after drawing operations
    const syncCurrentFrameThumbnail = useCallback(() => {
        const currentFrame = animation.frames[animation.currentFrameIndex];
        if (currentFrame) {
            animation.saveToFrame(currentFrame.id);
        }
    }, [animation]);

    // Line/shape tool state
    const [isDrawing, setIsDrawing] = React.useState(false);
    const [lineStart, setLineStart] = React.useState<{ x: number; y: number } | null>(null);

    // Draw pixel handler
    const drawPixel = useCallback((x: number, y: number) => {
        // Use getDrawingContext which returns the LAYER canvas context, not the main canvas
        const ctx = getDrawingContext();
        if (!ctx) return;

        if (tool === "eyedropper") {
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            const hexColor = rgbaToHex(pixel[0], pixel[1], pixel[2]);
            setColor(hexColor);
            setTool("pencil");
            return;
        }

        if (tool === "fill") {
            floodFill(x, y);
            updateDisplay();
            saveToHistory();
            return;
        }

        if (tool === "wand") {
            selectionTools.magicWand(canvasRef.current!, x, y, editorState.wandTolerance, editorState.wandContiguous);
            updateDisplay();
            return;
        }

        // Pixel Perfect stroke
        if (pixelPerfectEnabled && brushSize === 1 && tool === "pencil") {
            const pointToRemove = pixelPerfect.processPoint({ x, y });
            if (pointToRemove) {
                ctx.clearRect(pointToRemove.x, pointToRemove.y, 1, 1);
            }
        }

        drawPixelAt(x, y, ctx);
        updateDisplay();
        editorState.addToRecentColors(color);
    }, [
        getDrawingContext, canvasRef, tool, setTool, color, setColor, floodFill, saveToHistory,
        updateDisplay, selectionTools, editorState, pixelPerfectEnabled,
        brushSize, pixelPerfect, drawPixelAt
    ]);

    // Mouse handlers
    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const { x, y } = getCanvasCoords(e);

        // Handle particle placement mode
        if (particleOverlay.isPlacingMode) {
            particleOverlay.placeParticle(x, y);
            return;
        }

        if (pixelPerfectEnabled) {
            pixelPerfect.resetHistory();
        }

        if (tool === "select" || tool === "wand") {
            if (tool === "select") {
                setSelectionStart({ x, y });
                setSelection(null);
                setIsDrawing(true);
            } else {
                drawPixel(x, y);
            }
            return;
        }

        if (tool === "line" || tool === "rect" || tool === "circle" || tool === "gradient") {
            setLineStart({ x, y });
            setIsDrawing(true);
            return;
        }

        setIsDrawing(true);
        drawPixel(x, y);
    }, [getCanvasCoords, tool, pixelPerfectEnabled, pixelPerfect, drawPixel, setSelectionStart, setSelection, particleOverlay]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const { x, y } = getCanvasCoords(e);
        setCursorPos({ x, y });

        if (!isDrawing) return;

        if (tool === "select" && selectionStart) {
            setSelection({
                x: Math.min(selectionStart.x, x),
                y: Math.min(selectionStart.y, y),
                width: Math.abs(x - selectionStart.x) + 1,
                height: Math.abs(y - selectionStart.y) + 1,
            });
            return;
        }

        if (tool === "line" || tool === "rect" || tool === "circle") {
            return;
        }

        drawPixel(x, y);
    }, [isDrawing, getCanvasCoords, setCursorPos, tool, selectionStart, setSelection, drawPixel]);

    const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const { x, y } = getCanvasCoords(e);
        let didDraw = false;

        if (tool === "select" && selectionStart) {
            setSelection({
                x: Math.min(selectionStart.x, x),
                y: Math.min(selectionStart.y, y),
                width: Math.abs(x - selectionStart.x) + 1,
                height: Math.abs(y - selectionStart.y) + 1,
            });
            setSelectionStart(null);
        } else if (tool === "line" && lineStart && isDrawing) {
            drawLine(lineStart.x, lineStart.y, x, y);
            setLineStart(null);
            updateDisplay();
            saveToHistory();
            didDraw = true;
        } else if (tool === "rect" && lineStart && isDrawing) {
            drawRect(lineStart.x, lineStart.y, x, y, e.shiftKey);
            setLineStart(null);
            updateDisplay();
            saveToHistory();
            didDraw = true;
        } else if (tool === "circle" && lineStart && isDrawing) {
            const rx = Math.abs(x - lineStart.x);
            const ry = Math.abs(y - lineStart.y);
            drawEllipse(lineStart.x, lineStart.y, rx, ry);
            setLineStart(null);
            updateDisplay();
            saveToHistory();
            didDraw = true;
        } else if (tool === "gradient" && lineStart && isDrawing) {
            drawGradient(lineStart.x, lineStart.y, x, y);
            setLineStart(null);
            updateDisplay();
            saveToHistory();
            didDraw = true;
        } else if (isDrawing && tool !== "fill" && tool !== "select") {
            updateDisplay();
            saveToHistory();
            didDraw = true;
        }
        setIsDrawing(false);

        // Sync animation frame thumbnail after drawing stroke completes
        if (didDraw) {
            syncCurrentFrameThumbnail();
        }
    }, [isDrawing, tool, lineStart, selectionStart, getCanvasCoords, drawLine, drawRect, drawEllipse, drawGradient, updateDisplay, saveToHistory, setSelection, setSelectionStart, syncCurrentFrameThumbnail]);

    const handleMouseLeave = useCallback(() => {
        setCursorPos(null);
        const shouldSave = isDrawing && tool !== "line" && tool !== "select" && tool !== "rect" && tool !== "circle" && tool !== "gradient";
        if (shouldSave) {
            updateDisplay();
            saveToHistory();
            syncCurrentFrameThumbnail();
        }
        setIsDrawing(false);
        setLineStart(null);
        setSelectionStart(null);
    }, [isDrawing, tool, updateDisplay, saveToHistory, setCursorPos, setSelectionStart, syncCurrentFrameThumbnail]);

    // Wheel zoom handler
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            const wrapper = canvasWrapperRef.current;
            if (!wrapper) return;

            const rect = wrapper.getBoundingClientRect();
            const isOverCanvas = e.clientX >= rect.left && e.clientX <= rect.right &&
                e.clientY >= rect.top && e.clientY <= rect.bottom;

            if (isOverCanvas && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                e.stopPropagation();
                const delta = e.deltaY > 0 ? -2 : 2;
                editorState.setZoom(z => Math.max(2, Math.min(32, z + delta)));
            }
        };

        container.addEventListener("wheel", handleWheel, { passive: false });
        return () => container.removeEventListener("wheel", handleWheel);
    }, [containerRef, canvasWrapperRef, editorState]);

    return (
        <div
            ref={containerRef}
            className="pe-canvas-area flex-1 overflow-scroll"
            style={{
                backgroundImage: showGrid
                    ? `linear-gradient(45deg, #1a1a1f 25%, transparent 25%), 
                       linear-gradient(-45deg, #1a1a1f 25%, transparent 25%), 
                       linear-gradient(45deg, transparent 75%, #1a1a1f 75%), 
                       linear-gradient(-45deg, transparent 75%, #1a1a1f 75%)`
                    : "none",
                backgroundSize: "20px 20px",
                backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
            }}
        >
            <div
                style={{
                    display: 'inline-block',
                    padding: "32px",
                    minWidth: 'max-content',
                    minHeight: 'max-content',
                }}
            >
                <div
                    ref={canvasWrapperRef}
                    className="relative"
                    style={{
                        width: imageWidth * zoom,
                        height: imageHeight * zoom,
                        flexShrink: 0,
                        // Apply shake offset when hit-stop preview is active
                        transform: hitStopPreview.isPreviewPlaying && hitStopPreview.config.enabled
                            ? `translate(${hitStopPreview.shakeOffset.x}px, ${hitStopPreview.shakeOffset.y}px)`
                            : 'none',
                        transition: 'none',
                    }}
                >
                    {/* Onion Skinning Overlay */}
                    <OnionSkinOverlay
                        prevFrameUrl={undefined}
                        nextFrameUrl={undefined}
                        enabled={onionSkinEnabled}
                        opacity={onionSkinOpacity}
                        zoom={zoom}
                        canvasWidth={imageWidth}
                        canvasHeight={imageHeight}
                    />

                    <canvas
                        ref={canvasRef}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseLeave}
                        className="cursor-crosshair"
                        style={{
                            width: imageWidth * zoom,
                            height: imageHeight * zoom,
                            imageRendering: "pixelated",
                            border: "1px solid #555",
                            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                            // Apply brightness filter for white flash on sprite only
                            filter: hitStopPreview.isPreviewPlaying && hitStopPreview.flashOpacity > 0
                                ? `brightness(${1 + hitStopPreview.flashOpacity * 2})`
                                : 'none',
                        }}
                    />

                    {/* Particle Overlay - renders placed particle effects */}
                    {particleOverlay.particles.length > 0 && (
                        <ParticleOverlayCanvas
                            particles={particleOverlay.particles}
                            width={imageWidth}
                            height={imageHeight}
                            zoom={zoom}
                            isAnimating={particleOverlay.isAnimating}
                        />
                    )}

                    {/* Pixel Grid Overlay */}
                    {showGrid && zoom >= 4 && (
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                backgroundImage: `
                                    linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px),
                                    linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)
                                `,
                                backgroundSize: `${zoom}px ${zoom}px`,
                            }}
                        />
                    )}

                    {/* Cursor Preview */}
                    {cursorPos && !["eyedropper", "fill", "select"].includes(tool) && (
                        <div
                            className="absolute pointer-events-none border-2 border-white/50 rounded-sm"
                            style={{
                                left: cursorPos.x * zoom,
                                top: cursorPos.y * zoom,
                                width: brushSize * zoom,
                                height: brushSize * zoom,
                                boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
                            }}
                        />
                    )}

                    {/* Selection Overlay */}
                    {selection && (
                        <div
                            className="absolute pointer-events-none border-2 border-dashed border-blue-400"
                            style={{
                                left: selection.x * zoom,
                                top: selection.y * zoom,
                                width: selection.width * zoom,
                                height: selection.height * zoom,
                                backgroundColor: "rgba(59, 130, 246, 0.1)",
                                animation: "marching-ants 0.5s linear infinite",
                            }}
                        />
                    )}

                    {/* Mirror Guide Lines */}
                    {mirrorMode !== "none" && (
                        <>
                            {(mirrorMode === "h" || mirrorMode === "both") && (
                                <div className="absolute top-0 bottom-0 w-px bg-violet-500/50 pointer-events-none" style={{ left: "50%" }} />
                            )}
                            {(mirrorMode === "v" || mirrorMode === "both") && (
                                <div className="absolute left-0 right-0 h-px bg-violet-500/50 pointer-events-none" style={{ top: "50%" }} />
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
