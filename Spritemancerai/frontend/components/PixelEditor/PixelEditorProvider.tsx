"use client";

import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import {
    useEditorState,
    useHistory,
    useDrawing,
    useCanvasOperations,
    useClipboard,
    useCanvas,
    EditorState,
    HistoryManager,
    DrawingMethods,
    CanvasOperationsMethods,
    ClipboardManager,
    CanvasState,
    rgbaToHex,
} from "@/lib/pixelEditor/hooks";
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
import { useSelection } from "@/lib/pixelEditor/useSelection";
import { useAnimationPlayback, AnimationFrame } from "@/lib/pixelEditor/useAnimationPlayback";
import { useFrameStateManager } from "@/lib/pixelEditor/useFrameStateManager";
import { useHitStopPreview } from "@/lib/pixelEditor/useHitStopPreview";
import { useParticleOverlay } from "@/lib/pixelEditor/useParticleOverlay";
import { useSmearEffect } from "@/lib/pixelEditor/useSmearEffect";
import { useBreakEffect } from "@/lib/pixelEditor/useBreakEffect";
import { useFluidParticles } from "@/lib/pixelEditor/useFluidParticles";
import { useFluidGrid } from "@/lib/pixelEditor/useFluidGrid";
import { useEffectLayers } from "@/lib/effects";
import type { EffectEvent, EffectLayer } from "@/lib/effects";

// Types
export interface PixelEditorContextValue {
    // Core state
    editorState: EditorState;
    canvasState: CanvasState;
    historyManager: HistoryManager;
    drawing: DrawingMethods;
    canvasOps: CanvasOperationsMethods;
    clipboardManager: ClipboardManager;

    // Layer system
    layerSystem: ReturnType<typeof useLayerSystem>;
    layersReady: boolean;

    // Advanced features
    pixelPerfect: ReturnType<typeof usePixelPerfect>;
    shadingMode: ReturnType<typeof useShadingMode>;
    colorRamp: ReturnType<typeof useColorRamp>;
    colorHarmony: ReturnType<typeof useColorHarmony>;
    paletteExtraction: ReturnType<typeof usePaletteExtraction>;
    tilePreview: ReturnType<typeof useTilePreview>;
    seamlessTile: ReturnType<typeof useSeamlessTile>;
    outlineGenerator: ReturnType<typeof useOutlineGenerator>;
    pixelScaling: ReturnType<typeof usePixelScaling>;
    imageEffects: ReturnType<typeof useImageEffects>;
    advancedTransform: ReturnType<typeof useTransform>;
    selectionTools: ReturnType<typeof useSelection>;

    // Animation (with frame state management)
    animation: ReturnType<typeof useFrameStateManager>;

    // VFX - Hit-stop preview
    hitStopPreview: ReturnType<typeof useHitStopPreview>;

    // VFX - Particle overlay
    particleOverlay: ReturnType<typeof useParticleOverlay>;

    // VFX - Smear/Motion Blur
    smearEffect: ReturnType<typeof useSmearEffect>;

    // VFX - Break/Dissolve Effect
    breakEffect: ReturnType<typeof useBreakEffect>;

    // VFX - Fluid Particles
    fluidParticles: ReturnType<typeof useFluidParticles>;

    // VFX - Fluid Grid (WebGL)
    fluidGrid: ReturnType<typeof useFluidGrid>;

    // VFX - Effect Layers
    effectLayers: ReturnType<typeof useEffectLayers>;

    // Palette
    palette: string[];
    setPalette: React.Dispatch<React.SetStateAction<string[]>>;

    // Drawing helpers
    getDrawingContext: () => CanvasRenderingContext2D | null;
    updateDisplay: () => void;

    // Handlers for advanced features panel
    handleApplyToCanvas: (resultCanvas: HTMLCanvasElement) => void;
    handlePreviewEffect: (resultCanvas: HTMLCanvasElement) => void;
    handleCancelPreview: () => void;
    handleStartPreview: () => void;

    // Save/close
    onSave: (imageData: Blob) => Promise<void>;
    onClose: () => void;
    isSaving: boolean;
    handleSave: () => Promise<void>;

    // Onion skin frames
    prevFrameUrl?: string;
    nextFrameUrl?: string;
}

interface PixelEditorProviderProps {
    imageUrl: string;
    onSave: (imageData: Blob) => Promise<void>;
    onClose: () => void;
    prevFrameUrl?: string;
    nextFrameUrl?: string;
    children: React.ReactNode;
}

const PixelEditorContext = createContext<PixelEditorContextValue | null>(null);

export function usePixelEditorContext(): PixelEditorContextValue {
    const context = useContext(PixelEditorContext);
    if (!context) {
        throw new Error("usePixelEditorContext must be used within a PixelEditorProvider");
    }
    return context;
}

export function PixelEditorProvider({
    imageUrl,
    onSave,
    onClose,
    prevFrameUrl,
    nextFrameUrl,
    children,
}: PixelEditorProviderProps) {
    // Palette state (shared across components)
    const [palette, setPalette] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [layersReady, setLayersReady] = useState(false);

    // Note: Frame layer storage is now handled by useFrameStateManager

    // Core hooks - MUST be before frame storage functions that use them
    const canvasState = useCanvas({ imageUrl });
    const editorState = useEditorState();
    const historyManager = useHistory(canvasState.canvasRef);
    const clipboardManager = useClipboard({
        canvasRef: canvasState.canvasRef,
        saveToHistory: historyManager.saveToHistory,
    });

    // Layer system - MUST be before frame state manager
    const layerSystem = useLayerSystem({
        width: canvasState.imageWidth,
        height: canvasState.imageHeight,
    });

    // Animation playback hook (raw, for internal use)
    const animationPlayback = useAnimationPlayback({
        defaultFps: 12,
    });

    // Mark layers as ready when populated
    useEffect(() => {
        if (layerSystem.layers.length > 0 && layerSystem.layers[0]?.canvas && !layersReady) {
            setLayersReady(true);
            console.log("✅ Layers ready:", layerSystem.layers[0].canvas.width, "x", layerSystem.layers[0].canvas.height);
        }
    }, [layerSystem.layers, layersReady]);

    // Frame State Manager (V2) - handles all frame-layer synchronization
    const frameStateManager = useFrameStateManager({
        layerSystem,
        animation: animationPlayback,
        canvasRef: canvasState.canvasRef,
        layersReady,
    });

    // Get drawing context from active layer or fallback
    // IMPORTANT: Include activeLayerId in deps so this updates when layer selection changes
    // Returns null if layer is locked to prevent drawing
    const getDrawingContext = useCallback((): CanvasRenderingContext2D | null => {
        if (layersReady && layerSystem.layers.length > 0) {
            const activeLayer = layerSystem.getActiveLayer();
            // Return null if layer is locked (prevents drawing)
            if (activeLayer?.locked) return null;
            if (activeLayer?.canvas) {
                return activeLayer.canvas.getContext("2d");
            }
        }
        return canvasState.canvasRef.current?.getContext("2d") || null;
    }, [layersReady, layerSystem, layerSystem.activeLayerId, canvasState.canvasRef]);

    // Selection tools
    const selectionTools = useSelection();

    // Update display by compositing all layers
    const updateDisplay = useCallback(() => {
        const canvas = canvasState.canvasRef.current;
        if (!canvas || !layersReady || layerSystem.layers.length === 0) return;

        layerSystem.compositeToCanvas(canvas);

        // Render selection outline if there's a pixel-level selection
        if (selectionTools.selectionMask) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
                selectionTools.renderSelectionOutline(ctx, selectionTools.selectionMask, selectionTools.marchingAntsOffset);
            }
        }
    }, [layersReady, layerSystem, selectionTools, canvasState.canvasRef]);

    // Animate marching ants
    useEffect(() => {
        if (!selectionTools.selectionMask) return;
        const interval = setInterval(() => {
            selectionTools.setMarchingAntsOffset(prev => (prev + 1) % 8);
            updateDisplay();
        }, 150);
        return () => clearInterval(interval);
    }, [selectionTools.selectionMask, selectionTools, updateDisplay]);

    // Re-composite when layer properties change
    useEffect(() => {
        if (layersReady && layerSystem.layers.length > 0 && canvasState.canvasRef.current) {
            layerSystem.compositeToCanvas(canvasState.canvasRef.current);
        }
    }, [layersReady, layerSystem.layers, canvasState.canvasRef, layerSystem]);

    // Drawing hook
    const drawing = useDrawing({
        canvasRef: canvasState.canvasRef,
        getDrawingContext,
        tool: editorState.tool,
        color: editorState.color,
        secondaryColor: editorState.secondaryColor,
        brushSize: editorState.brushSize,
        mirrorMode: editorState.mirrorMode,
        ditherPattern: editorState.ditherPattern,
        selectionTools,
        imageWidth: canvasState.imageWidth,
        imageHeight: canvasState.imageHeight,
    });

    // Canvas operations
    const canvasOps = useCanvasOperations({
        canvasRef: canvasState.canvasRef,
        saveToHistory: historyManager.saveToHistory,
        setImageWidth: canvasState.setImageWidth,
        setImageHeight: canvasState.setImageHeight,
    });

    // Advanced feature hooks
    const pixelPerfect = usePixelPerfect({
        enabled: editorState.pixelPerfectEnabled,
        brushSize: editorState.brushSize,
    });

    const shadingMode = useShadingMode({
        enabled: editorState.shadingModeEnabled,
        palette,
        shadeSteps: editorState.shadeSteps,
    });

    const colorRamp = useColorRamp({ interpolationMode: "hsl" });
    const colorHarmony = useColorHarmony();
    const paletteExtraction = usePaletteExtraction();
    const tilePreview = useTilePreview({ enabled: true });
    const seamlessTile = useSeamlessTile({ blendWidth: 8 });
    const outlineGenerator = useOutlineGenerator({
        outlineColor: "#000000",
        outlineStyle: "outer",
        cornerStyle: "square",
    });
    const pixelScaling = usePixelScaling();
    const imageEffects = useImageEffects();
    const advancedTransform = useTransform();

    // VFX - Hit-Stop Preview
    const hitStopPreview = useHitStopPreview({
        fps: frameStateManager.fps,
        totalFrames: frameStateManager.frames.length,
        onFrameChange: useCallback((frameIndex: number) => {
            // Update the main animation frame during preview
            frameStateManager.goToFrame(frameIndex);
        }, [frameStateManager]),
    });

    // VFX - Particle Overlay
    const particleOverlay = useParticleOverlay({
        fps: frameStateManager.fps,
        canvasWidth: canvasState.imageWidth,
        canvasHeight: canvasState.imageHeight,
    });

    // VFX - Smear/Motion Blur
    const smearEffect = useSmearEffect();

    // VFX - Break/Dissolve Effect
    const breakEffect = useBreakEffect();

    // VFX - Fluid Particles
    const fluidParticles = useFluidParticles();

    // VFX - Fluid Grid (WebGL)
    const fluidGrid = useFluidGrid();

    // VFX - Effect Layers (for timeline and rendering)
    const effectLayers = useEffectLayers({
        totalFrames: animationPlayback.frames.length || 1,
        dnaPalette: palette,
    });

    // Store original canvas for preview/cancel
    const originalCanvasDataRef = useRef<ImageData | null>(null);

    // CRITICAL: Clear preview state when frame changes to prevent cross-frame infection
    useEffect(() => {
        // When frame changes, invalidate any cached preview data
        if (originalCanvasDataRef.current) {
            console.log('🔄 Frame changed in Provider - clearing preview cache');
            originalCanvasDataRef.current = null;
        }
    }, [frameStateManager.currentFrameIndex]);

    // Handlers for advanced features panel
    const handleStartPreview = useCallback(() => {
        const activeLayer = layerSystem.getActiveLayer();
        if (activeLayer?.canvas) {
            const ctx = activeLayer.canvas.getContext("2d");
            if (ctx) {
                originalCanvasDataRef.current = ctx.getImageData(0, 0, activeLayer.canvas.width, activeLayer.canvas.height);
            }
        }
    }, [layerSystem]);

    const handlePreviewEffect = useCallback((resultCanvas: HTMLCanvasElement) => {
        const activeLayer = layerSystem.getActiveLayer();
        if (activeLayer?.canvas) {
            const layerCtx = activeLayer.canvas.getContext("2d");
            if (layerCtx) {
                layerCtx.clearRect(0, 0, activeLayer.canvas.width, activeLayer.canvas.height);
                layerCtx.drawImage(resultCanvas, 0, 0);
                updateDisplay();
            }
        }
    }, [layerSystem, updateDisplay]);

    const handleCancelPreview = useCallback(() => {
        if (originalCanvasDataRef.current) {
            const activeLayer = layerSystem.getActiveLayer();
            if (activeLayer?.canvas) {
                const ctx = activeLayer.canvas.getContext("2d");
                if (ctx) {
                    ctx.putImageData(originalCanvasDataRef.current, 0, 0);
                    updateDisplay();
                    originalCanvasDataRef.current = null;
                }
            }
        }
    }, [layerSystem, updateDisplay]);

    const handleApplyToCanvas = useCallback((resultCanvas: HTMLCanvasElement) => {
        const activeLayer = layerSystem.getActiveLayer();
        if (activeLayer?.canvas) {
            const layerCtx = activeLayer.canvas.getContext("2d");
            if (layerCtx) {
                layerCtx.clearRect(0, 0, activeLayer.canvas.width, activeLayer.canvas.height);
                layerCtx.drawImage(resultCanvas, 0, 0);
                updateDisplay();
                historyManager.saveToHistory();
                originalCanvasDataRef.current = null;

                // Update animation frame thumbnail immediately after applying effect
                const currentFrame = frameStateManager.frames[frameStateManager.currentFrameIndex];
                if (currentFrame) {
                    frameStateManager.saveToFrame(currentFrame.id);
                }
            }
        }
    }, [layerSystem, updateDisplay, historyManager, frameStateManager]);

    // Initialize canvas with image
    useEffect(() => {
        if (!canvasState.loadedImage || !canvasState.canvasRef.current) return;

        const canvas = canvasState.canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = canvasState.loadedImage.width;
        canvas.height = canvasState.loadedImage.height;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(canvasState.loadedImage, 0, 0);

        // Initialize layer system
        const initialImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        layerSystem.initializeWithImageData(initialImageData);

        // Initialize history
        historyManager.initializeHistory(initialImageData);

        // Calculate fit-to-screen zoom
        setTimeout(() => {
            editorState.setZoom(canvasState.calculateFitZoom());
        }, 50);

        // Extract palette
        const extractedPalette = canvasOps.extractPalette();
        setPalette(extractedPalette);

        // Initialize animation with first frame
        if (animationPlayback.frames.length === 0) {
            animationPlayback.addFrame(initialImageData);
        }

        // Check for pending multi-frame import from sessionStorage
        const pendingImport = sessionStorage.getItem('pendingFrameImport');
        if (pendingImport) {
            try {
                const { frameUrls } = JSON.parse(pendingImport) as { projectId: string; frameUrls: string[] };
                sessionStorage.removeItem('pendingFrameImport'); // Clear immediately

                // If we have multiple frames to import, load them after the first
                if (frameUrls && frameUrls.length > 1) {
                    console.log(`📦 Loading ${frameUrls.length} frames from import...`);

                    // Load remaining frames sequentially to preserve order
                    const loadFramesSequentially = async () => {
                        for (let i = 1; i < frameUrls.length; i++) {
                            const url = frameUrls[i];
                            try {
                                const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                                    const image = new Image();
                                    image.crossOrigin = 'anonymous';
                                    image.onload = () => resolve(image);
                                    image.onerror = reject;
                                    image.src = url;
                                });

                                // Create a canvas to get ImageData
                                const tempCanvas = document.createElement('canvas');
                                tempCanvas.width = img.width;
                                tempCanvas.height = img.height;
                                const tempCtx = tempCanvas.getContext('2d');
                                if (tempCtx) {
                                    tempCtx.drawImage(img, 0, 0);
                                    const frameImageData = tempCtx.getImageData(0, 0, img.width, img.height);
                                    animationPlayback.addFrame(frameImageData);
                                    console.log(`✅ Loaded frame ${i + 1}/${frameUrls.length}`);
                                }
                            } catch (err) {
                                console.error(`Failed to load frame ${i + 1}:`, err);
                            }
                        }
                        console.log(`📦 All ${frameUrls.length} frames loaded!`);
                    };

                    // Start loading (don't await - let it run in background)
                    loadFramesSequentially();
                }
            } catch (err) {
                console.error('Failed to parse pending frame import:', err);
                sessionStorage.removeItem('pendingFrameImport');
            }
        }

        console.log("✅ Canvas initialized with layer system and animation");
    }, [canvasState.loadedImage]);

    // Save initial frame's layer state once layers are ready
    useEffect(() => {
        if (layersReady && frameStateManager.frames.length > 0) {
            const firstFrame = frameStateManager.frames[0];
            // Only save if no snapshot exists yet (initial load)
            if (firstFrame && !frameStateManager.frameSnapshots.has(firstFrame.id)) {
                console.log('💾 Saving initial frame layer state');
                frameStateManager.saveToFrame(firstFrame.id);
            }
        }
    }, [layersReady, frameStateManager]);

    // Save image
    const handleSave = async () => {
        const canvas = canvasState.canvasRef.current;
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

    // frameStateManager is our animation wrapper with proper save/load
    // No need for augmentedAnimation anymore - frameStateManager handles it

    // Wrap undo/redo to sync with layer system
    const wrappedUndo = useCallback(() => {
        historyManager.undo();
        // After undo, sync the display canvas back to active layer
        const canvas = canvasState.canvasRef.current;
        const activeLayer = layerSystem.getActiveLayer();
        if (canvas && activeLayer?.canvas) {
            const ctx = canvas.getContext("2d");
            const layerCtx = activeLayer.canvas.getContext("2d");
            if (ctx && layerCtx) {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                layerCtx.putImageData(imageData, 0, 0);
            }
        }
    }, [historyManager, canvasState.canvasRef, layerSystem]);

    const wrappedRedo = useCallback(() => {
        historyManager.redo();
        // After redo, sync the display canvas back to active layer
        const canvas = canvasState.canvasRef.current;
        const activeLayer = layerSystem.getActiveLayer();
        if (canvas && activeLayer?.canvas) {
            const ctx = canvas.getContext("2d");
            const layerCtx = activeLayer.canvas.getContext("2d");
            if (ctx && layerCtx) {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                layerCtx.putImageData(imageData, 0, 0);
            }
        }
    }, [historyManager, canvasState.canvasRef, layerSystem]);

    // Augmented history manager with layer-aware undo/redo
    const augmentedHistoryManager: HistoryManager = {
        ...historyManager,
        undo: wrappedUndo,
        redo: wrappedRedo,
    };

    const value: PixelEditorContextValue = {
        editorState,
        canvasState,
        historyManager: augmentedHistoryManager,
        drawing,
        canvasOps,
        clipboardManager,
        layerSystem,
        layersReady,
        pixelPerfect,
        shadingMode,
        colorRamp,
        colorHarmony,
        paletteExtraction,
        tilePreview,
        seamlessTile,
        outlineGenerator,
        pixelScaling,
        imageEffects,
        advancedTransform,
        selectionTools,
        palette,
        setPalette,
        getDrawingContext,
        updateDisplay,
        handleApplyToCanvas,
        handlePreviewEffect,
        handleCancelPreview,
        handleStartPreview,
        onSave,
        onClose,
        isSaving,
        handleSave,
        prevFrameUrl,
        nextFrameUrl,
        animation: frameStateManager,  // Use frame state manager for proper frame-layer sync
        hitStopPreview,
        particleOverlay,
        smearEffect,
        breakEffect,
        fluidParticles,
        fluidGrid,
        effectLayers,
    };

    return (
        <PixelEditorContext.Provider value={value}>
            {children}
        </PixelEditorContext.Provider>
    );
}
