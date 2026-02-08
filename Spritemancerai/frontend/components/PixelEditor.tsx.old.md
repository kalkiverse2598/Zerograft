"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { shouldDrawPixel, DitherPattern, DITHER_PATTERNS, getDitherPatternIcon } from "@/lib/pixelEditor/ditherPatterns";
import { useLayerSystem, Layer, BlendMode } from "@/lib/pixelEditor/useLayerSystem";
import { usePixelPerfect } from "@/lib/pixelEditor/usePixelPerfect";
import { useShadingMode } from "@/lib/pixelEditor/useShadingMode";
import { useColorRamp } from "@/lib/pixelEditor/useColorRamp";
import { useColorHarmony } from "@/lib/pixelEditor/useColorHarmony";
import { usePaletteExtraction } from "@/lib/pixelEditor/usePaletteExtraction";
import { useTilePreview } from "@/lib/pixelEditor/useTilePreview";
import { useSeamlessTile } from "@/lib/pixelEditor/useSeamlessTile";
import { useOutlineGenerator } from "@/lib/pixelEditor/useOutlineGenerator";
import { usePixelScaling } from "@/lib/pixelEditor/usePixelScaling";
import { useImageEffects } from "@/lib/pixelEditor/useImageEffects";
import { useTransform } from "@/lib/pixelEditor/useTransform";
import { useSelection, SelectionMask } from "@/lib/pixelEditor/useSelection";
import { AdvancedFeaturesPanel, FeatureCategory } from "@/components/PixelEditor/AdvancedFeaturesPanel";
import { CanvasResizeModal, AnchorPosition } from "@/components/PixelEditor/CanvasResizeModal";
import { OnionSkinOverlay, OnionSkinControls } from "@/components/PixelEditor/OnionSkinOverlay";
import { LayerManager } from "@/components/PixelEditor/LayerManager";
import "./PixelEditor.css";

// Lucide Icons
import {
    Pencil,
    Eraser,
    Pipette,
    PaintBucket,
    Minus,
    Square,
    Circle,
    Scissors,
    FlipHorizontal,
    FlipVertical,
    RotateCcw,
    RotateCw,
    Maximize2,
    Undo2,
    Redo2,
    Save,
    X,
    Grid3X3,
    Copy,
    ClipboardPaste,
    Sparkles,
    ZoomIn,
    ZoomOut,
    Layers,
    Wand2,
    Palette,
    SunMedium,
} from "lucide-react";

interface PixelEditorProps {
    imageUrl: string;
    onSave: (imageData: Blob) => Promise<void>;
    onClose: () => void;
    // Onion skinning support
    prevFrameUrl?: string;
    nextFrameUrl?: string;
}

type Tool = "pencil" | "eraser" | "eyedropper" | "fill" | "line" | "select" | "rect" | "circle" | "dither" | "wand" | "gradient" | "shade";

interface HistoryState {
    imageData: ImageData;
}

interface Selection {
    x: number;
    y: number;
    width: number;
    height: number;
}

// Helper: Convert hex to RGBA array
const hexToRgba = (hex: string): [number, number, number, number] => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b, 255];
};

// Helper: Check if two colors match
const colorsMatch = (a: Uint8ClampedArray | number[], b: number[]): boolean => {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
};

// Helper: Convert RGBA to hex
const rgbaToHex = (r: number, g: number, b: number): string => {
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
};

export function PixelEditor({ imageUrl, onSave, onClose, prevFrameUrl, nextFrameUrl }: PixelEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasWrapperRef = useRef<HTMLDivElement>(null);

    // Editor state
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [tool, setTool] = useState<Tool>("pencil");
    const [color, setColor] = useState("#ff0000");
    const [secondaryColor, setSecondaryColor] = useState("#0000ff"); // For gradients
    const [brushSize, setBrushSize] = useState(1);
    const [zoom, setZoom] = useState(8);
    const [showGrid, setShowGrid] = useState(true);
    const [isDrawing, setIsDrawing] = useState(false);

    // History for undo/redo
    const [history, setHistory] = useState<HistoryState[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Image dimensions
    const [imageWidth, setImageWidth] = useState(0);
    const [imageHeight, setImageHeight] = useState(0);

    // Loaded image reference
    const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);

    // Line tool state
    const [lineStart, setLineStart] = useState<{ x: number; y: number } | null>(null);

    // Cursor preview state
    const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

    // Selection state (Phase 2)
    const [selection, setSelection] = useState<Selection | null>(null);
    const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
    const [clipboard, setClipboard] = useState<ImageData | null>(null);

    // Color palette state (Phase 2)
    const [recentColors, setRecentColors] = useState<string[]>([]);
    const [palette, setPalette] = useState<string[]>([]);
    const [showColorSwap, setShowColorSwap] = useState(false);
    const [swapFromColor, setSwapFromColor] = useState("#000000");
    const [swapToColor, setSwapToColor] = useState("#ffffff");

    // Mirror mode (Phase 3)
    const [mirrorMode, setMirrorMode] = useState<"none" | "h" | "v" | "both">("none");

    // Dithering patterns (Phase 4)
    const [ditherPattern, setDitherPattern] = useState<DitherPattern>("none");

    // Pixel Perfect Stroke (Drawing & Color Features)
    const [pixelPerfectEnabled, setPixelPerfectEnabled] = useState(true);

    // Shading Mode (Drawing & Color Features)
    const [shadingModeEnabled, setShadingModeEnabled] = useState(false);
    const [shadeSteps, setShadeSteps] = useState(15);

    // Advanced Features Panel - category selection
    const [activeFeatureCategory, setActiveFeatureCategory] = useState<FeatureCategory>(null);

    // Magic Wand tolerance (Phase 2)
    const [wandTolerance, setWandTolerance] = useState(32);
    const [wandContiguous, setWandContiguous] = useState(true);

    // Canvas resize modal (Phase 4)
    const [showResizeModal, setShowResizeModal] = useState(false);
    const [resizeWidth, setResizeWidth] = useState(0);
    const [resizeHeight, setResizeHeight] = useState(0);
    const [resizeAnchor, setResizeAnchor] = useState<"tl" | "tc" | "tr" | "ml" | "mc" | "mr" | "bl" | "bc" | "br">("mc");

    // Onion skinning (Phase 4)
    const [onionSkinEnabled, setOnionSkinEnabled] = useState(false);
    const [onionSkinOpacity, setOnionSkinOpacity] = useState(0.3);
    const [prevFrameImage, setPrevFrameImage] = useState<HTMLImageElement | null>(null);
    const [nextFrameImage, setNextFrameImage] = useState<HTMLImageElement | null>(null);

    // Pan tool (Phase 5)
    const [isPanning, setIsPanning] = useState(false);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);

    // Layer system (Epic Phase 1)
    const [showLayerPanel, setShowLayerPanel] = useState(true);
    const [layersReady, setLayersReady] = useState(false);
    const layerSystem = useLayerSystem({
        width: imageWidth,
        height: imageHeight,
    });

    // Pixel Perfect Stroke hook
    const pixelPerfect = usePixelPerfect({
        enabled: pixelPerfectEnabled,
        brushSize,
    });

    // Shading Mode hook
    const shadingMode = useShadingMode({
        enabled: shadingModeEnabled,
        palette,
        shadeSteps,
    });

    // Color Ramp hook
    const colorRamp = useColorRamp({
        interpolationMode: 'hsl',
    });

    // Color Harmony hook
    const colorHarmony = useColorHarmony();

    // Palette Extraction hook
    const paletteExtraction = usePaletteExtraction();

    // Tiling & Patterns hooks
    const tilePreview = useTilePreview({ enabled: true });
    const seamlessTile = useSeamlessTile({ blendWidth: 8 });

    // Transform hooks
    const outlineGenerator = useOutlineGenerator({
        outlineColor: '#000000',
        outlineStyle: 'outer',
        cornerStyle: 'square',
    });
    const pixelScaling = usePixelScaling();

    // Image Effects hook
    const imageEffects = useImageEffects();

    // Advanced Transform hook
    const advancedTransform = useTransform();

    // Selection hook
    const selectionTools = useSelection();

    // Mark layers as ready when they are populated with valid canvas
    useEffect(() => {
        if (layerSystem.layers.length > 0 && layerSystem.layers[0]?.canvas && !layersReady) {
            setLayersReady(true);
            console.log("✅ Layers ready with dimensions:", layerSystem.layers[0].canvas.width, "x", layerSystem.layers[0].canvas.height);
        }
    }, [layerSystem.layers, layersReady]);

    // Get the drawing context - from active layer if available, otherwise main canvas
    const getDrawingContext = useCallback((): CanvasRenderingContext2D | null => {
        // If layers are ready and we have an active layer, use its context
        if (layersReady && layerSystem.layers.length > 0) {
            const activeLayerCtx = layerSystem.getActiveContext();
            if (activeLayerCtx) {
                return activeLayerCtx;
            }
        }
        // Fallback to main canvas
        return canvasRef.current?.getContext('2d') || null;
    }, [layersReady, layerSystem]);

    // Update the display canvas by compositing all layers
    const updateDisplay = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !layersReady || layerSystem.layers.length === 0) return;

        layerSystem.compositeToCanvas(canvas);
        
        // Render selection outline (marching ants) if there's a pixel-level selection
        if (selectionTools.selectionMask) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                selectionTools.renderSelectionOutline(ctx, selectionTools.selectionMask, selectionTools.marchingAntsOffset);
            }
        }
    }, [layersReady, layerSystem, selectionTools]);

    // Animate marching ants for selection
    useEffect(() => {
        if (!selectionTools.selectionMask) return;
        
        const interval = setInterval(() => {
            selectionTools.setMarchingAntsOffset(prev => (prev + 1) % 8);
            updateDisplay(); // Re-render with new offset
        }, 150);
        
        return () => clearInterval(interval);
    }, [selectionTools.selectionMask, selectionTools, updateDisplay]);

    // Re-composite display when layer properties change (opacity, visibility, blend mode, order)
    useEffect(() => {
        if (layersReady && layerSystem.layers.length > 0 && canvasRef.current) {
            layerSystem.compositeToCanvas(canvasRef.current);
        }
    }, [layersReady, layerSystem.layers]);

    // Add to recent colors
    const addToRecentColors = useCallback((newColor: string) => {
        setRecentColors(prev => {
            const filtered = prev.filter(c => c !== newColor);
            return [newColor, ...filtered].slice(0, 12);
        });
    }, []);

    // Load image first (doesn't need canvas)
    useEffect(() => {
        console.log("🔄 Starting image load:", imageUrl);
        const img = new Image();
        img.crossOrigin = "anonymous";

        img.onload = () => {
            console.log("✅ Image loaded:", img.width, "x", img.height);
            setImageWidth(img.width);
            setImageHeight(img.height);
            setLoadedImage(img);
            setIsLoading(false);
        };

        img.onerror = (err) => {
            console.error("❌ Failed to load image:", err);
            console.error("Image URL:", imageUrl);
            alert("Failed to load image. This may be a CORS issue with the storage URL.");
            setIsLoading(false);
        };

        img.src = imageUrl;
    }, [imageUrl]);

    // Draw image to canvas once both are ready
    useEffect(() => {
        if (!loadedImage || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = loadedImage.width;
        canvas.height = loadedImage.height;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(loadedImage, 0, 0);

        // Get the image data to initialize the background layer
        const initialImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Initialize the layer system with this image data (creates layer with correct dimensions)
        layerSystem.initializeWithImageData(initialImageData);

        // Save initial state to history
        setHistory([{ imageData: initialImageData }]);
        setHistoryIndex(0);

        // Calculate fit-to-screen zoom (after a brief delay to ensure container is mounted)
        setTimeout(() => {
            const container = containerRef.current;
            if (container) {
                // Account for padding (32px on each side) and some margin
                const availableWidth = container.clientWidth - 100;
                const availableHeight = container.clientHeight - 100;

                const zoomX = availableWidth / loadedImage.width;
                const zoomY = availableHeight / loadedImage.height;

                // Use the smaller zoom to fit both dimensions, clamp between 1 and 32
                const fitZoom = Math.max(1, Math.min(32, Math.floor(Math.min(zoomX, zoomY))));
                setZoom(fitZoom);
            }
        }, 50);

        // Extract palette from image
        extractPalette();

        console.log("✅ Canvas initialized with layer system");
    }, [loadedImage]);

    // Mouse wheel zoom handler - Cmd/Ctrl+scroll for zoom, regular scroll for panning
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            // Check if mouse is over the canvas area
            const wrapper = canvasWrapperRef.current;
            if (!wrapper) return;

            const rect = wrapper.getBoundingClientRect();
            const isOverCanvas = e.clientX >= rect.left && e.clientX <= rect.right &&
                e.clientY >= rect.top && e.clientY <= rect.bottom;

            // Only zoom if Cmd/Ctrl is held, otherwise allow normal scrolling
            if (isOverCanvas && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                e.stopPropagation();
                const delta = e.deltaY > 0 ? -2 : 2;
                setZoom(z => Math.max(2, Math.min(32, z + delta)));
            }
            // Without Cmd/Ctrl, allow default scrolling behavior for panning
        };

        container.addEventListener("wheel", handleWheel, { passive: false });
        return () => container.removeEventListener("wheel", handleWheel);
    }, []);

    // Extract palette from current canvas
    const extractPalette = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const colors = new Set<string>();

        for (let i = 0; i < imageData.data.length; i += 4) {
            if (imageData.data[i + 3] > 0) { // Only non-transparent
                const hex = rgbaToHex(imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]);
                colors.add(hex);
            }
        }

        setPalette([...colors].slice(0, 32)); // Limit to 32 colors
    }, []);

    // Save current state to history
    const saveToHistory = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push({ imageData: currentState });

        if (newHistory.length > 50) {
            newHistory.shift();
        }

        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }, [history, historyIndex]);

    // Store original canvas for preview/cancel
    const originalCanvasDataRef = useRef<ImageData | null>(null);

    // Apply canvas from transform operations (Tiling & Transform features)
    const handleApplyToCanvas = useCallback((resultCanvas: HTMLCanvasElement) => {
        // Get the active layer canvas
        const activeLayer = layerSystem.getActiveLayer();
        if (activeLayer?.canvas) {
            const layerCtx = activeLayer.canvas.getContext('2d');
            if (layerCtx) {
                // Clear and draw the result
                layerCtx.clearRect(0, 0, activeLayer.canvas.width, activeLayer.canvas.height);
                layerCtx.drawImage(resultCanvas, 0, 0);
                updateDisplay();
                saveToHistory();
                // Clear the original data after applying
                originalCanvasDataRef.current = null;
            }
        }
    }, [layerSystem, updateDisplay, saveToHistory]);

    // Start preview - save original canvas state
    const handleStartPreview = useCallback(() => {
        const activeLayer = layerSystem.getActiveLayer();
        if (activeLayer?.canvas) {
            const ctx = activeLayer.canvas.getContext('2d');
            if (ctx) {
                originalCanvasDataRef.current = ctx.getImageData(0, 0, activeLayer.canvas.width, activeLayer.canvas.height);
            }
        }
    }, [layerSystem]);

    // Preview effect - apply temporarily without saving to history
    const handlePreviewEffect = useCallback((resultCanvas: HTMLCanvasElement) => {
        const activeLayer = layerSystem.getActiveLayer();
        if (activeLayer?.canvas) {
            const layerCtx = activeLayer.canvas.getContext('2d');
            if (layerCtx) {
                layerCtx.clearRect(0, 0, activeLayer.canvas.width, activeLayer.canvas.height);
                layerCtx.drawImage(resultCanvas, 0, 0);
                updateDisplay();
            }
        }
    }, [layerSystem, updateDisplay]);

    // Cancel preview - restore original canvas state
    const handleCancelPreview = useCallback(() => {
        if (originalCanvasDataRef.current) {
            const activeLayer = layerSystem.getActiveLayer();
            if (activeLayer?.canvas) {
                const ctx = activeLayer.canvas.getContext('2d');
                if (ctx) {
                    ctx.putImageData(originalCanvasDataRef.current, 0, 0);
                    updateDisplay();
                    originalCanvasDataRef.current = null;
                }
            }
        }
    }, [layerSystem, updateDisplay]);

    // Undo
    const handleUndo = useCallback(() => {
        if (historyIndex <= 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        const newIndex = historyIndex - 1;
        ctx.putImageData(history[newIndex].imageData, 0, 0);
        setHistoryIndex(newIndex);
    }, [history, historyIndex]);

    // Redo
    const handleRedo = useCallback(() => {
        if (historyIndex >= history.length - 1) return;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        const newIndex = historyIndex + 1;
        ctx.putImageData(history[newIndex].imageData, 0, 0);
        setHistoryIndex(newIndex);
    }, [history, historyIndex]);

    // Get canvas coordinates from mouse event
    const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement | HTMLDivElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: Math.floor((e.clientX - rect.left) * scaleX),
            y: Math.floor((e.clientY - rect.top) * scaleY),
        };
    }, []);

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
    }, [tool, color, brushSize, mirrorMode, ditherPattern, selectionTools]);

    // Flood fill algorithm
    const floodFill = useCallback((startX: number, startY: number) => {
        // Get context from active layer or fallback to main canvas
        const ctx = getDrawingContext();
        const canvas = canvasRef.current;
        if (!canvas || !ctx) return;

        // Get the layer's canvas dimensions (use imageWidth/imageHeight for consistency)
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
        addToRecentColors(color);
    }, [color, addToRecentColors, getDrawingContext, imageWidth, imageHeight]);

    // Magic Wand selection - flood-fill based color selection
    const magicWandSelect = useCallback((startX: number, startY: number) => {
        const activeLayer = layerSystem.getActiveLayer();
        const canvas = activeLayer?.canvas || canvasRef.current;
        if (!canvas) return;

        // Use the new selection hook for pixel-level selection
        const mask = selectionTools.magicWand(canvas, startX, startY, wandTolerance, wandContiguous);
        
        // Also update the rectangular selection for compatibility
        const bounds = selectionTools.getSelectionBounds();
        if (bounds) {
            setSelection({
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
            });
        }
        
        // Trigger re-render to show selection
        updateDisplay();
    }, [layerSystem, selectionTools, wandTolerance, wandContiguous, updateDisplay]);

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
        updateDisplay();
    }, [getDrawingContext, imageWidth, imageHeight, color, secondaryColor, updateDisplay]);

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
        addToRecentColors(color);
    }, [color, brushSize, drawPixelAt, addToRecentColors]);

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
        addToRecentColors(color);
    }, [color, addToRecentColors]);

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
        addToRecentColors(color);
    }, [color, addToRecentColors]);

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
    }, [saveToHistory]);

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
    }, [saveToHistory]);

    // Color swap
    const colorSwap = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const fromRgba = hexToRgba(swapFromColor);
        const toRgba = hexToRgba(swapToColor);

        for (let i = 0; i < data.length; i += 4) {
            if (data[i] === fromRgba[0] && data[i + 1] === fromRgba[1] && data[i + 2] === fromRgba[2]) {
                data[i] = toRgba[0];
                data[i + 1] = toRgba[1];
                data[i + 2] = toRgba[2];
            }
        }

        ctx.putImageData(imageData, 0, 0);
        saveToHistory();
        setShowColorSwap(false);
    }, [swapFromColor, swapToColor, saveToHistory]);

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
        setShowResizeModal(false);
    }, [saveToHistory]);

    // Copy selection
    const copySelection = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx || !selection) return;

        const imageData = ctx.getImageData(selection.x, selection.y, selection.width, selection.height);
        setClipboard(imageData);
    }, [selection]);

    // Cut selection
    const cutSelection = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx || !selection) return;

        const imageData = ctx.getImageData(selection.x, selection.y, selection.width, selection.height);
        setClipboard(imageData);
        ctx.clearRect(selection.x, selection.y, selection.width, selection.height);
        saveToHistory();
    }, [selection, saveToHistory]);

    // Paste clipboard
    const pasteClipboard = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx || !clipboard) return;

        // Paste at selection position or top-left
        const x = selection?.x ?? 0;
        const y = selection?.y ?? 0;
        ctx.putImageData(clipboard, x, y);
        saveToHistory();
    }, [clipboard, selection, saveToHistory]);

    // Draw pixel(s)
    const drawPixel = useCallback((x: number, y: number) => {
        // Get context from active layer or fallback to main canvas
        const ctx = getDrawingContext();
        const canvas = canvasRef.current;
        if (!canvas || !ctx) return;

        if (tool === "eyedropper") {
            // Eyedropper should sample from display (composited) canvas
            const displayCtx = canvas.getContext("2d");
            if (displayCtx) {
                const pixel = displayCtx.getImageData(x, y, 1, 1).data;
                const hexColor = rgbaToHex(pixel[0], pixel[1], pixel[2]);
                setColor(hexColor);
            }
            setTool("pencil");
            return;
        }

        if (tool === "fill") {
            floodFill(x, y);
            saveToHistory();
            updateDisplay(); // Update display after fill
            return;
        }

        if (tool === "wand") {
            magicWandSelect(x, y);
            return;
        }

        // Pixel Perfect: check if we need to remove an L-shaped corner
        if (pixelPerfectEnabled && brushSize === 1 && tool === "pencil") {
            const pointToRemove = pixelPerfect.processPoint({ x, y });
            if (pointToRemove) {
                // Clear the corner pixel from the layer
                ctx.clearRect(pointToRemove.x, pointToRemove.y, 1, 1);
            }
        }

        drawPixelAt(x, y, ctx);
        updateDisplay(); // Update display after drawing
        addToRecentColors(color);
    }, [tool, floodFill, saveToHistory, drawPixelAt, addToRecentColors, color, getDrawingContext, updateDisplay, magicWandSelect, pixelPerfectEnabled, brushSize, pixelPerfect]);

    // Mouse handlers
    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const { x, y } = getCanvasCoords(e);

        // Reset pixel perfect history for new stroke
        if (pixelPerfectEnabled) {
            pixelPerfect.resetHistory();
        }

        if (tool === "select" || tool === "wand") {
            if (tool === "select") {
                setSelectionStart({ x, y });
                setSelection(null);
                setIsDrawing(true);
            } else {
                // Magic wand - single click selection
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
    }, [getCanvasCoords, drawPixel, tool, pixelPerfectEnabled, pixelPerfect]);

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
    }, [isDrawing, getCanvasCoords, drawPixel, tool, selectionStart]);

    const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const { x, y } = getCanvasCoords(e);

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
            saveToHistory();
        } else if (tool === "rect" && lineStart && isDrawing) {
            drawRect(lineStart.x, lineStart.y, x, y, e.shiftKey);
            setLineStart(null);
            saveToHistory();
        } else if (tool === "circle" && lineStart && isDrawing) {
            const rx = Math.abs(x - lineStart.x);
            const ry = Math.abs(y - lineStart.y);
            drawEllipse(lineStart.x, lineStart.y, rx, ry);
            setLineStart(null);
            saveToHistory();
        } else if (tool === "gradient" && lineStart && isDrawing) {
            drawGradient(lineStart.x, lineStart.y, x, y);
            setLineStart(null);
            saveToHistory();
        } else if (isDrawing && tool !== "fill" && tool !== "select") {
            saveToHistory();
        }
        setIsDrawing(false);
    }, [isDrawing, tool, lineStart, selectionStart, getCanvasCoords, drawLine, drawRect, drawEllipse, drawGradient, saveToHistory]);

    const handleMouseLeave = useCallback(() => {
        setCursorPos(null);
        if (isDrawing && tool !== "line" && tool !== "select" && tool !== "rect" && tool !== "circle" && tool !== "gradient") {
            saveToHistory();
        }
        setIsDrawing(false);
        setLineStart(null);
        setSelectionStart(null);
    }, [isDrawing, tool, saveToHistory]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.metaKey || e.ctrlKey) {
                if (e.key === "z") {
                    e.preventDefault();
                    if (e.shiftKey) {
                        handleRedo();
                    } else {
                        handleUndo();
                    }
                }
                if (e.key === "c" && selection) {
                    e.preventDefault();
                    copySelection();
                }
                if (e.key === "x" && selection) {
                    e.preventDefault();
                    cutSelection();
                }
                if (e.key === "v" && clipboard) {
                    e.preventDefault();
                    pasteClipboard();
                }
            }

            // Tool shortcuts
            if (e.key === "p") setTool("pencil");
            if (e.key === "e") setTool("eraser");
            if (e.key === "i") setTool("eyedropper");
            if (e.key === "f") setTool("fill");
            if (e.key === "l") setTool("line");
            if (e.key === "s") setTool("select");
            if (e.key === "w") setTool("wand");
            if (e.key === "r") setTool("rect");
            if (e.key === "c" && !e.metaKey && !e.ctrlKey) setTool("circle");
            if (e.key === "g") setShowGrid(prev => !prev);
            if (e.key === "m") setMirrorMode(prev =>
                prev === "none" ? "h" : prev === "h" ? "v" : prev === "v" ? "both" : "none"
            );
            if (e.key === "Escape") {
                setSelection(null);
                setLineStart(null);
                selectionTools.clearSelection();
                updateDisplay();
            }
            
            // Delete selected pixels
            if (e.key === "Delete" || e.key === "Backspace") {
                if (selectionTools.selectionMask) {
                    const activeLayer = layerSystem.getActiveLayer();
                    if (activeLayer?.canvas) {
                        selectionTools.deleteSelected(activeLayer.canvas);
                        updateDisplay();
                        saveToHistory();
                    }
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleUndo, handleRedo, selection, clipboard, copySelection, cutSelection, pasteClipboard, selectionTools, updateDisplay, layerSystem, saveToHistory]);

    // Save image
    const handleSave = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        setIsSaving(true);
        try {
            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((b) => {
                    if (b) resolve(b);
                    else reject(new Error("Failed to create blob"));
                }, "image/png");
            });
            await onSave(blob);
        } catch (err) {
            console.error("Failed to save:", err);
            alert("Failed to save image");
        } finally {
            setIsSaving(false);
        }
    };

    // Zoom controls
    const handleZoomIn = () => setZoom(z => Math.min(z + 2, 32));
    const handleZoomOut = () => setZoom(z => Math.max(z - 2, 2));

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                <div className="text-white">Loading editor...</div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 flex flex-col z-50" style={{ background: 'var(--pe-bg-deep, #0a0a0f)' }}>
            {/* ===== HEADER ===== */}
            <div className="pe-header flex items-center justify-between px-4 py-2.5">
                <h2 className="pe-title text-lg font-bold flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Pixel Editor
                </h2>
                <div className="flex items-center gap-5">
                    {/* Zoom Controls */}
                    <div className="flex items-center gap-3">
                        <button onClick={handleZoomOut} className="pe-tool-btn pe-tool-btn-sm" title="Zoom Out">
                            <ZoomOut className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min="2"
                                max="32"
                                value={zoom}
                                onChange={(e) => setZoom(parseInt(e.target.value))}
                                className="pe-zoom-slider"
                            />
                            <span className="pe-label w-8 text-center">{zoom}x</span>
                        </div>
                        <button onClick={handleZoomIn} className="pe-tool-btn pe-tool-btn-sm" title="Zoom In">
                            <ZoomIn className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Grid Toggle */}
                    <button
                        onClick={() => setShowGrid(!showGrid)}
                        className={`pe-tool-btn pe-tool-btn-sm ${showGrid ? 'active' : ''}`}
                        title="Toggle Grid (G)"
                    >
                        <Grid3X3 className="w-4 h-4" />
                    </button>

                    {/* Layer Panel Toggle */}
                    <button
                        onClick={() => setShowLayerPanel(!showLayerPanel)}
                        className={`pe-tool-btn pe-tool-btn-sm ${showLayerPanel ? 'active' : ''}`}
                        title="Toggle Layers Panel"
                    >
                        <Layers className="w-4 h-4" />
                    </button>

                    {/* Undo/Redo */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleUndo}
                            disabled={historyIndex <= 0}
                            className={`pe-tool-btn pe-tool-btn-sm ${historyIndex <= 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
                            title="Undo (Cmd+Z)"
                        >
                            <Undo2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleRedo}
                            disabled={historyIndex >= history.length - 1}
                            className={`pe-tool-btn pe-tool-btn-sm ${historyIndex >= history.length - 1 ? 'opacity-40 cursor-not-allowed' : ''}`}
                            title="Redo (Cmd+Shift+Z)"
                        >
                            <Redo2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                    <button onClick={onClose} className="pe-btn pe-btn-secondary">
                        <X className="w-4 h-4" />
                        Cancel
                    </button>
                    <button onClick={handleSave} disabled={isSaving} className="pe-btn pe-btn-primary">
                        <Save className="w-4 h-4" />
                        {isSaving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>

            {/* ===== MAIN CONTENT (3-PANEL) ===== */}
            <div className="flex-1 flex overflow-hidden">
                {/* LEFT SIDEBAR - TOOLS */}
                <div className="pe-sidebar w-16 flex flex-col items-center py-4">
                    {/* Drawing Tools */}
                    <div className="pe-tool-group">
                        <button onClick={() => setTool("pencil")} className={`pe-tool-btn ${tool === "pencil" ? "active" : ""}`} title="Pencil (P)">
                            <Pencil className="w-5 h-5" />
                        </button>
                        <button onClick={() => setTool("eraser")} className={`pe-tool-btn ${tool === "eraser" ? "active" : ""}`} title="Eraser (E)">
                            <Eraser className="w-5 h-5" />
                        </button>
                        <button onClick={() => setTool("eyedropper")} className={`pe-tool-btn ${tool === "eyedropper" ? "active" : ""}`} title="Eyedropper (I)">
                            <Pipette className="w-5 h-5" />
                        </button>
                        <button onClick={() => setTool("fill")} className={`pe-tool-btn ${tool === "fill" ? "active" : ""}`} title="Fill (F)">
                            <PaintBucket className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Shape Tools */}
                    <div className="pe-tool-group">
                        <button onClick={() => setTool("line")} className={`pe-tool-btn ${tool === "line" ? "active" : ""}`} title="Line (L)">
                            <Minus className="w-5 h-5" />
                        </button>
                        <button onClick={() => setTool("rect")} className={`pe-tool-btn ${tool === "rect" ? "active" : ""}`} title="Rectangle (R)">
                            <Square className="w-5 h-5" />
                        </button>
                        <button onClick={() => setTool("circle")} className={`pe-tool-btn ${tool === "circle" ? "active" : ""}`} title="Circle (C)">
                            <Circle className="w-5 h-5" />
                        </button>
                        <button onClick={() => setTool("select")} className={`pe-tool-btn ${tool === "select" ? "active" : ""}`} title="Select (S)">
                            <Scissors className="w-5 h-5" />
                        </button>
                        <button onClick={() => setTool("wand")} className={`pe-tool-btn ${tool === "wand" ? "active" : ""}`} title="Magic Wand (W)">
                            <Wand2 className="w-5 h-5" />
                        </button>
                        <button onClick={() => setTool("gradient")} className={`pe-tool-btn ${tool === "gradient" ? "active" : ""}`} title="Gradient (G)">
                            <Palette className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Transform Tools */}
                    <div className="pe-tool-group">
                        <button onClick={() => flipCanvas("horizontal")} className="pe-tool-btn" title="Flip Horizontal">
                            <FlipHorizontal className="w-5 h-5" />
                        </button>
                        <button onClick={() => flipCanvas("vertical")} className="pe-tool-btn" title="Flip Vertical">
                            <FlipVertical className="w-5 h-5" />
                        </button>
                        <button onClick={() => rotateCanvas("ccw")} className="pe-tool-btn" title="Rotate CCW">
                            <RotateCcw className="w-5 h-5" />
                        </button>
                        <button onClick={() => rotateCanvas("cw")} className="pe-tool-btn" title="Rotate CW">
                            <RotateCw className="w-5 h-5" />
                        </button>
                        <button onClick={() => { setResizeWidth(imageWidth); setResizeHeight(imageHeight); setShowResizeModal(true); }} className="pe-tool-btn" title="Resize Canvas">
                            <Maximize2 className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* CENTER - CANVAS */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Toolbar Row */}
                    <div className="pe-toolbar flex items-center gap-4 px-4 py-2.5 flex-wrap">
                        {/* Drawing Tools - Mini version for toolbar */}
                        <div className="flex items-center gap-1">
                            <button onClick={() => setTool("pencil")} className={`pe-tool-btn pe-tool-btn-sm ${tool === "pencil" ? "active" : ""}`} title="Pencil (P)">
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => setTool("eraser")} className={`pe-tool-btn pe-tool-btn-sm ${tool === "eraser" ? "active" : ""}`} title="Eraser (E)">
                                <Eraser className="w-4 h-4" />
                            </button>
                            <button onClick={() => setTool("eyedropper")} className={`pe-tool-btn pe-tool-btn-sm ${tool === "eyedropper" ? "active" : ""}`} title="Eyedropper (I)">
                                <Pipette className="w-4 h-4" />
                            </button>
                            <button onClick={() => setTool("fill")} className={`pe-tool-btn pe-tool-btn-sm ${tool === "fill" ? "active" : ""}`} title="Fill Bucket (F)">
                                <PaintBucket className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="pe-divider" />

                        {/* Shape Tools */}
                        <div className="flex items-center gap-1">
                            <button onClick={() => setTool("line")} className={`pe-tool-btn pe-tool-btn-sm ${tool === "line" ? "active" : ""}`} title="Line (L)">
                                <Minus className="w-4 h-4" />
                            </button>
                            <button onClick={() => setTool("rect")} className={`pe-tool-btn pe-tool-btn-sm ${tool === "rect" ? "active" : ""}`} title="Rectangle (R)">
                                <Square className="w-4 h-4" />
                            </button>
                            <button onClick={() => setTool("circle")} className={`pe-tool-btn pe-tool-btn-sm ${tool === "circle" ? "active" : ""}`} title="Circle (C)">
                                <Circle className="w-4 h-4" />
                            </button>
                            <button onClick={() => setTool("select")} className={`pe-tool-btn pe-tool-btn-sm ${tool === "select" ? "active" : ""}`} title="Select (S)">
                                <Scissors className="w-4 h-4" />
                            </button>
                            <button onClick={() => setTool("wand")} className={`pe-tool-btn pe-tool-btn-sm ${tool === "wand" ? "active" : ""}`} title="Magic Wand (W)">
                                <Wand2 className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Magic Wand Options */}
                        {tool === "wand" && (
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="pe-label">Tolerance:</span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="128"
                                        value={wandTolerance}
                                        onChange={(e) => setWandTolerance(parseInt(e.target.value))}
                                        className="pe-slider w-20"
                                    />
                                    <span className="pe-value">{wandTolerance}</span>
                                </div>
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={wandContiguous}
                                        onChange={(e) => setWandContiguous(e.target.checked)}
                                        className="pe-checkbox"
                                    />
                                    <span className="pe-label">Contiguous</span>
                                </label>
                            </div>
                        )}

                        {/* Selection Actions */}
                        {selectionTools.selectionMask && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => { selectionTools.growSelection(1); updateDisplay(); }}
                                    className="pe-tool-btn pe-tool-btn-sm"
                                    title="Grow Selection"
                                >
                                    +
                                </button>
                                <button
                                    onClick={() => { selectionTools.shrinkSelection(1); updateDisplay(); }}
                                    className="pe-tool-btn pe-tool-btn-sm"
                                    title="Shrink Selection"
                                >
                                    −
                                </button>
                                <button
                                    onClick={() => { selectionTools.invertSelection(); updateDisplay(); }}
                                    className="pe-tool-btn pe-tool-btn-sm"
                                    title="Invert Selection"
                                >
                                    ⊘
                                </button>
                                <button
                                    onClick={() => {
                                        const activeLayer = layerSystem.getActiveLayer();
                                        if (activeLayer?.canvas) {
                                            selectionTools.deleteSelected(activeLayer.canvas);
                                            updateDisplay();
                                            saveToHistory();
                                        }
                                    }}
                                    className="pe-tool-btn pe-tool-btn-sm text-red-400"
                                    title="Delete Selected (Del)"
                                >
                                    🗑
                                </button>
                                <button
                                    onClick={() => {
                                        const activeLayer = layerSystem.getActiveLayer();
                                        if (activeLayer?.canvas) {
                                            selectionTools.fillSelected(activeLayer.canvas, color);
                                            updateDisplay();
                                            saveToHistory();
                                        }
                                    }}
                                    className="pe-tool-btn pe-tool-btn-sm"
                                    title="Fill Selected with Current Color"
                                >
                                    🪣
                                </button>
                                <button
                                    onClick={() => {
                                        selectionTools.clearSelection();
                                        setSelection(null);
                                        updateDisplay();
                                    }}
                                    className="pe-tool-btn pe-tool-btn-sm"
                                    title="Clear Selection (Esc)"
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        <div className="pe-divider" />

                        {/* Color Picker + Recent Colors */}
                        <div className="flex items-center gap-3">
                            <input
                                type="color"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                className="pe-color-picker"
                                title="Primary Color"
                            />
                            {/* Secondary Color for Gradient */}
                            {tool === "gradient" && (
                                <input
                                    type="color"
                                    value={secondaryColor}
                                    onChange={(e) => setSecondaryColor(e.target.value)}
                                    className="pe-color-picker"
                                    title="Secondary Color (Gradient End)"
                                />
                            )}
                            <div className="flex items-center gap-1">
                                {recentColors.slice(0, 6).map((c, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setColor(c)}
                                        className="pe-color-swatch"
                                        style={{ backgroundColor: c }}
                                        title={c}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="pe-divider" />

                        {/* Canvas Size - Quick Access */}
                        <button
                            onClick={() => { setResizeWidth(imageWidth); setResizeHeight(imageHeight); setShowResizeModal(true); }}
                            className="pe-btn pe-btn-secondary flex items-center gap-2"
                            title="Resize Canvas"
                        >
                            <Maximize2 className="w-4 h-4" />
                            <span className="text-xs">{imageWidth}×{imageHeight}</span>
                        </button>

                        <div className="pe-divider" />

                        {/* Brush Size */}
                        <div className="flex items-center gap-2">
                            <label className="pe-label">Size</label>
                            <select
                                value={brushSize}
                                onChange={(e) => setBrushSize(Number(e.target.value))}
                                className="pe-select"
                            >
                                {[1, 2, 3, 4, 6, 8, 10, 12].map(s => (
                                    <option key={s} value={s}>{s}px</option>
                                ))}
                            </select>
                        </div>

                        <div className="pe-divider" />

                        {/* Drawing & Color Features */}
                        <button
                            onClick={() => setActiveFeatureCategory(prev => prev === 'drawing-color' ? null : 'drawing-color')}
                            className={`pe-tool-btn pe-tool-btn-sm ${activeFeatureCategory === 'drawing-color' ? "active" : ""}`}
                            title="Drawing & Color Features (Pixel Perfect, Shading, Color Ramp, Harmony)"
                        >
                            <Sparkles className="w-4 h-4" />
                        </button>

                        {/* Tiling & Patterns */}
                        <button
                            onClick={() => setActiveFeatureCategory(prev => prev === 'tiling-patterns' ? null : 'tiling-patterns')}
                            className={`pe-tool-btn pe-tool-btn-sm ${activeFeatureCategory === 'tiling-patterns' ? "active" : ""}`}
                            title="Tiling & Patterns Features"
                        >
                            <Grid3X3 className="w-4 h-4" />
                        </button>

                        {/* Transform & Algorithms */}
                        <button
                            onClick={() => setActiveFeatureCategory(prev => prev === 'transform' ? null : 'transform')}
                            className={`pe-tool-btn pe-tool-btn-sm ${activeFeatureCategory === 'transform' ? "active" : ""}`}
                            title="Transform & Algorithm Features"
                        >
                            <Wand2 className="w-4 h-4" />
                        </button>

                        {/* Effects & Adjustments */}
                        <button
                            onClick={() => setActiveFeatureCategory(prev => prev === 'effects' ? null : 'effects')}
                            className={`pe-tool-btn pe-tool-btn-sm ${activeFeatureCategory === 'effects' ? "active" : ""}`}
                            title="Effects & Adjustments (Brightness, HSL, Posterize, Blur)"
                        >
                            <SunMedium className="w-4 h-4" />
                        </button>

                        {/* Selection Tools */}
                        <button
                            onClick={() => setActiveFeatureCategory(prev => prev === 'selection' ? null : 'selection')}
                            className={`pe-tool-btn pe-tool-btn-sm ${activeFeatureCategory === 'selection' ? "active" : ""}`}
                            title="Selection Tools (Magic Wand, Select by Color)"
                        >
                            <Scissors className="w-4 h-4" />
                        </button>

                        {/* Mirror Mode */}
                        <button
                            onClick={() => setMirrorMode(prev => prev === "none" ? "h" : prev === "h" ? "v" : prev === "v" ? "both" : "none")}
                            className={`pe-tool-btn pe-tool-btn-sm ${mirrorMode !== "none" ? "active" : ""}`}
                            title="Mirror Mode (M)"
                        >
                            {mirrorMode === "none" ? <FlipHorizontal className="w-4 h-4 opacity-50" /> :
                                mirrorMode === "h" ? <FlipHorizontal className="w-4 h-4" /> :
                                    mirrorMode === "v" ? <FlipVertical className="w-4 h-4" /> :
                                        <><FlipHorizontal className="w-3 h-3" /><FlipVertical className="w-3 h-3" /></>}
                        </button>

                        {/* Dithering Pattern */}
                        <select
                            value={ditherPattern}
                            onChange={(e) => setDitherPattern(e.target.value as DitherPattern)}
                            className="pe-select"
                            title="Dithering Pattern"
                        >
                            {DITHER_PATTERNS.map(p => (
                                <option key={p} value={p}>{getDitherPatternIcon(p)} {p === "none" ? "Solid" : p}</option>
                            ))}
                        </select>

                        {/* Onion Skinning */}
                        {(prevFrameUrl || nextFrameUrl) && (
                            <OnionSkinControls
                                enabled={onionSkinEnabled}
                                onToggle={() => setOnionSkinEnabled(!onionSkinEnabled)}
                                opacity={onionSkinOpacity}
                                onOpacityChange={setOnionSkinOpacity}
                                hasPrevFrame={!!prevFrameUrl}
                                hasNextFrame={!!nextFrameUrl}
                            />
                        )}

                        {/* Selection Actions */}
                        {selection && (
                            <div className="flex items-center gap-1 ml-2">
                                <button onClick={copySelection} className="pe-tool-btn pe-tool-btn-sm" title="Copy (Cmd+C)">
                                    <Copy className="w-4 h-4" />
                                </button>
                                <button onClick={cutSelection} className="pe-tool-btn pe-tool-btn-sm" title="Cut (Cmd+X)">
                                    <Scissors className="w-4 h-4" />
                                </button>
                                {clipboard && (
                                    <button onClick={pasteClipboard} className="pe-tool-btn pe-tool-btn-sm" title="Paste (Cmd+V)">
                                        <ClipboardPaste className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Canvas Area */}
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
                                style={{ width: imageWidth * zoom, height: imageHeight * zoom, flexShrink: 0 }}
                            >
                                {/* Onion Skinning Overlay */}
                                <OnionSkinOverlay
                                    prevFrameUrl={prevFrameUrl}
                                    nextFrameUrl={nextFrameUrl}
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
                                    }}
                                />

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
                </div>

                {/* RIGHT SIDEBAR */}
                <div className="flex flex-row h-full">
                    {/* Advanced Features Panel */}
                    {activeFeatureCategory && (
                        <div className="w-64 border-r border-white/10 bg-zinc-900/50">
                            <AdvancedFeaturesPanel
                                category={activeFeatureCategory}
                                onClose={() => setActiveFeatureCategory(null)}
                                pixelPerfectEnabled={pixelPerfectEnabled}
                                setPixelPerfectEnabled={setPixelPerfectEnabled}
                                shadingModeEnabled={shadingModeEnabled}
                                setShadingModeEnabled={setShadingModeEnabled}
                                shadeSteps={shadeSteps}
                                setShadeSteps={setShadeSteps}
                                color={color}
                                setColor={setColor}
                                palette={palette}
                                setPalette={setPalette}
                                canvasRef={canvasRef}
                                colorRamp={colorRamp}
                                colorHarmony={colorHarmony}
                                paletteExtraction={paletteExtraction}
                                tilePreview={tilePreview}
                                seamlessTile={seamlessTile}
                                outlineGenerator={outlineGenerator}
                                pixelScaling={pixelScaling}
                                onApplyToCanvas={handleApplyToCanvas}
                                onPreviewEffect={handlePreviewEffect}
                                onCancelPreview={handleCancelPreview}
                                onStartPreview={handleStartPreview}
                                advancedTransform={advancedTransform}
                                selectionTools={selectionTools}
                                wandTolerance={wandTolerance}
                                setWandTolerance={setWandTolerance}
                                wandContiguous={wandContiguous}
                                setWandContiguous={setWandContiguous}
                                imageEffects={imageEffects}
                            />
                        </div>
                    )}
                    
                    {/* Layers Panel */}
                    {showLayerPanel && (
                        <LayerManager
                            layers={layerSystem.layers}
                            activeLayerId={layerSystem.activeLayerId}
                            onSelectLayer={layerSystem.setActiveLayerId}
                            onAddLayer={layerSystem.addLayer}
                            onDeleteLayer={layerSystem.deleteLayer}
                            onDuplicateLayer={layerSystem.duplicateLayer}
                            onMoveLayer={layerSystem.moveLayer}
                            onToggleVisibility={layerSystem.toggleVisibility}
                            onToggleLock={layerSystem.toggleLock}
                            onSetOpacity={layerSystem.setOpacity}
                            onSetBlendMode={layerSystem.setBlendMode}
                            onRenameLayer={layerSystem.renameLayer}
                            onMergeDown={layerSystem.mergeDown}
                            onFlattenAll={layerSystem.flattenAll}
                        />
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="pe-footer px-4 py-2 flex justify-between items-center">
                <div className="pe-footer-text">
                    <span className="pe-footer-highlight">{imageWidth}×{imageHeight}px</span>
                    <span className="opacity-40">|</span>
                    <span>P E I F L S R C G M</span>
                    <span className="opacity-40">|</span>
                    <span>Cmd+Z/X/C/V</span>
                    <span className="opacity-40">|</span>
                    <span>⌘+Scroll=Zoom</span>
                </div>
                <div className="pe-footer-text">
                    {selection && <span className="pe-footer-highlight">Selection: {selection.width}×{selection.height}px</span>}
                </div>
            </div>

            {/* Color Swap Modal */}
            {showColorSwap && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60">
                    <div className="bg-zinc-800 rounded-xl p-6 border border-zinc-600 min-w-[300px]">
                        <h3 className="text-lg font-semibold mb-4">Color Swap</h3>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs text-zinc-400">From</span>
                                <input type="color" value={swapFromColor} onChange={(e) => setSwapFromColor(e.target.value)} className="w-12 h-12 rounded cursor-pointer" />
                            </div>
                            <span className="text-2xl">→</span>
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs text-zinc-400">To</span>
                                <input type="color" value={swapToColor} onChange={(e) => setSwapToColor(e.target.value)} className="w-12 h-12 rounded cursor-pointer" />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => setShowColorSwap(false)} className="flex-1">Cancel</Button>
                            <Button onClick={colorSwap} className="flex-1">Swap Colors</Button>
                        </div>
                    </div>
                </div>
            )}

            <CanvasResizeModal
                isOpen={showResizeModal}
                onClose={() => setShowResizeModal(false)}
                currentWidth={imageWidth}
                currentHeight={imageHeight}
                onResize={resizeCanvas}
            />
        </div>
    );
}
