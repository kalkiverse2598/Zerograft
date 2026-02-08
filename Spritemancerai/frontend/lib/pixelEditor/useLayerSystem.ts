/**
 * Layer System Hook for Pixel Editor
 * Manages multiple canvas layers with opacity, visibility, and blending modes
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { LayerSystemState, LayerSnapshot } from './types/frameState';

// Layer blend modes supporting pixel art workflows
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten';

export interface Layer {
    id: string;
    name: string;
    visible: boolean;
    locked: boolean;
    opacity: number; // 0-100
    blendMode: BlendMode;
    canvas: HTMLCanvasElement | null;
}

// LayerSystemState is now imported from './types/frameState'

interface UseLayerSystemOptions {
    width: number;
    height: number;
    initialImageData?: ImageData;
}

// Generate unique layer ID
const generateLayerId = () => `layer_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// Create an off-screen canvas for a layer
const createLayerCanvas = (width: number, height: number): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
};

export function useLayerSystem({ width, height, initialImageData }: UseLayerSystemOptions) {
    const [layers, setLayers] = useState<Layer[]>([]);
    const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

    // CRITICAL: Refs to track current state - prevents stale closure issues
    // These refs are always up-to-date and can be read from any callback
    const layersRef = useRef<Layer[]>(layers);
    const activeLayerIdRef = useRef<string | null>(activeLayerId);
    
    // Keep refs in sync with state - SYNCHRONOUSLY during render
    // This ensures refs are updated BEFORE any callbacks that might use them
    layersRef.current = layers;
    activeLayerIdRef.current = activeLayerId;

    // Composite canvas for final output
    const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // Initialize with a base layer (only if dimensions are valid and no layers exist)
    useEffect(() => {
        if (width > 0 && height > 0 && layers.length === 0) {
            const baseLayer = createLayer('Background', initialImageData);
            setLayers([baseLayer]);
            setActiveLayerId(baseLayer.id);
        }
    }, [width, height]);

    // Explicit initialization with image data - call this when image loads
    const initializeWithImageData = useCallback((imageData: ImageData) => {
        if (imageData.width <= 0 || imageData.height <= 0) return;

        // Create a new canvas with the correct dimensions
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.putImageData(imageData, 0, 0);
        }

        const newLayer: Layer = {
            id: generateLayerId(),
            name: 'Background',
            visible: true,
            locked: false,
            opacity: 100,
            blendMode: 'normal',
            canvas,
        };

        setLayers([newLayer]);
        setActiveLayerId(newLayer.id);
    }, []);

    // Create a new layer
    const createLayer = useCallback((name: string = 'New Layer', imageData?: ImageData): Layer => {
        const canvas = createLayerCanvas(width, height);
        const ctx = canvas.getContext('2d');

        if (ctx && imageData) {
            ctx.putImageData(imageData, 0, 0);
        }

        return {
            id: generateLayerId(),
            name,
            visible: true,
            locked: false,
            opacity: 100,
            blendMode: 'normal',
            canvas,
        };
    }, [width, height]);

    // Add a new layer above the active layer
    const addLayer = useCallback((name?: string) => {
        const newLayer = createLayer(name);

        setLayers(prevLayers => {
            const activeIndex = prevLayers.findIndex(l => l.id === activeLayerId);
            const insertIndex = activeIndex >= 0 ? activeIndex + 1 : prevLayers.length;
            const newLayers = [...prevLayers];
            newLayers.splice(insertIndex, 0, newLayer);
            return newLayers;
        });

        setActiveLayerId(newLayer.id);
        return newLayer;
    }, [createLayer, activeLayerId]);

    // Delete a layer
    const deleteLayer = useCallback((layerId: string) => {
        setLayers(prevLayers => {
            if (prevLayers.length <= 1) return prevLayers; // Keep at least one layer

            // Clean up canvas memory before removing
            const layerToDelete = prevLayers.find(l => l.id === layerId);
            if (layerToDelete?.canvas) {
                layerToDelete.canvas.width = 0;
                layerToDelete.canvas.height = 0;
            }

            const index = prevLayers.findIndex(l => l.id === layerId);
            const newLayers = prevLayers.filter(l => l.id !== layerId);

            // Update active layer if we deleted the active one
            if (activeLayerId === layerId) {
                const newActiveIndex = Math.min(index, newLayers.length - 1);
                setActiveLayerId(newLayers[newActiveIndex]?.id || null);
            }

            return newLayers;
        });
    }, [activeLayerId]);

    // Duplicate a layer
    const duplicateLayer = useCallback((layerId: string) => {
        const layer = layers.find(l => l.id === layerId);
        if (!layer || !layer.canvas) return null;

        const ctx = layer.canvas.getContext('2d');
        if (!ctx) return null;

        const imageData = ctx.getImageData(0, 0, width, height);
        const newLayer = createLayer(`${layer.name} Copy`, imageData);
        newLayer.opacity = layer.opacity;
        newLayer.blendMode = layer.blendMode;

        setLayers(prevLayers => {
            const index = prevLayers.findIndex(l => l.id === layerId);
            const newLayers = [...prevLayers];
            newLayers.splice(index + 1, 0, newLayer);
            return newLayers;
        });

        setActiveLayerId(newLayer.id);
        return newLayer;
    }, [layers, width, height, createLayer]);

    // Move layer to new position
    const moveLayer = useCallback((layerId: string, newIndex: number) => {
        setLayers(prevLayers => {
            const currentIndex = prevLayers.findIndex(l => l.id === layerId);
            if (currentIndex === -1) return prevLayers;

            const newLayers = [...prevLayers];
            const [removed] = newLayers.splice(currentIndex, 1);
            newLayers.splice(Math.max(0, Math.min(newIndex, newLayers.length)), 0, removed);
            return newLayers;
        });
    }, []);

    // Update layer properties
    const updateLayer = useCallback((layerId: string, updates: Partial<Omit<Layer, 'id' | 'canvas'>>) => {
        setLayers(prevLayers =>
            prevLayers.map(layer =>
                layer.id === layerId ? { ...layer, ...updates } : layer
            )
        );
    }, []);

    // Toggle layer visibility
    const toggleVisibility = useCallback((layerId: string) => {
        updateLayer(layerId, { visible: !layers.find(l => l.id === layerId)?.visible });
    }, [layers, updateLayer]);

    // Toggle layer lock
    const toggleLock = useCallback((layerId: string) => {
        updateLayer(layerId, { locked: !layers.find(l => l.id === layerId)?.locked });
    }, [layers, updateLayer]);

    // Set layer opacity
    const setOpacity = useCallback((layerId: string, opacity: number) => {
        updateLayer(layerId, { opacity: Math.max(0, Math.min(100, opacity)) });
    }, [updateLayer]);

    // Set layer blend mode
    const setBlendMode = useCallback((layerId: string, blendMode: BlendMode) => {
        updateLayer(layerId, { blendMode });
    }, [updateLayer]);

    // Rename layer
    const renameLayer = useCallback((layerId: string, name: string) => {
        updateLayer(layerId, { name });
    }, [updateLayer]);

    // Merge layer down (merge with layer below)
    const mergeDown = useCallback((layerId: string) => {
        setLayers(prevLayers => {
            const index = prevLayers.findIndex(l => l.id === layerId);
            if (index <= 0) return prevLayers; // Can't merge the bottom layer

            const topLayer = prevLayers[index];
            const bottomLayer = prevLayers[index - 1];

            if (!topLayer.canvas || !bottomLayer.canvas) return prevLayers;

            const bottomCtx = bottomLayer.canvas.getContext('2d');
            if (!bottomCtx) return prevLayers;

            // Apply blend mode and opacity when merging
            bottomCtx.globalAlpha = topLayer.opacity / 100;
            bottomCtx.globalCompositeOperation = getCompositeOperation(topLayer.blendMode);
            bottomCtx.drawImage(topLayer.canvas, 0, 0);
            bottomCtx.globalAlpha = 1;
            bottomCtx.globalCompositeOperation = 'source-over';

            // Remove the top layer
            const newLayers = prevLayers.filter(l => l.id !== layerId);

            if (activeLayerId === layerId) {
                setActiveLayerId(bottomLayer.id);
            }

            return newLayers;
        });
    }, [activeLayerId]);

    // Flatten all layers
    const flattenAll = useCallback(() => {
        if (layers.length <= 1) return;

        const compositeCanvas = createLayerCanvas(width, height);
        const ctx = compositeCanvas.getContext('2d');
        if (!ctx) return;

        // Draw all visible layers from bottom to top
        for (const layer of layers) {
            if (!layer.visible || !layer.canvas) continue;

            ctx.globalAlpha = layer.opacity / 100;
            ctx.globalCompositeOperation = getCompositeOperation(layer.blendMode);
            ctx.drawImage(layer.canvas, 0, 0);
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        const flattenedLayer: Layer = {
            id: generateLayerId(),
            name: 'Flattened',
            visible: true,
            locked: false,
            opacity: 100,
            blendMode: 'normal',
            canvas: compositeCanvas,
        };

        setLayers([flattenedLayer]);
        setActiveLayerId(flattenedLayer.id);
    }, [layers, width, height]);

    // Get the active layer - USES REFS to prevent stale closure issues
    // This ensures we always get the CURRENT active layer, not a stale one
    const getActiveLayer = useCallback((): Layer | null => {
        // Read from refs to get the most current values
        const currentLayers = layersRef.current;
        const currentActiveId = activeLayerIdRef.current;
        return currentLayers.find(l => l.id === currentActiveId) || null;
    }, []); // No dependencies - reads from refs

    // Get the active layer's canvas context - USES REFS via getActiveLayer
    const getActiveContext = useCallback((): CanvasRenderingContext2D | null => {
        const layer = getActiveLayer();
        if (!layer?.canvas) return null;
        return layer.canvas.getContext('2d');
    }, [getActiveLayer]);

    // Composite all layers onto a single canvas
    const compositeToCanvas = useCallback((targetCanvas: HTMLCanvasElement) => {
        const ctx = targetCanvas.getContext('2d');
        if (!ctx) return;

        // Use target canvas dimensions for clearing to ensure full canvas is cleared
        ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

        // Draw layers from bottom to top
        for (const layer of layers) {
            if (!layer.visible || !layer.canvas) continue;

            ctx.globalAlpha = layer.opacity / 100;
            ctx.globalCompositeOperation = getCompositeOperation(layer.blendMode);
            ctx.drawImage(layer.canvas, 0, 0);
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }, [layers, width, height]);

    // Get composited image data
    const getComposedImageData = useCallback((): ImageData | null => {
        if (!compositeCanvasRef.current) {
            compositeCanvasRef.current = createLayerCanvas(width, height);
        }

        compositeToCanvas(compositeCanvasRef.current);
        const ctx = compositeCanvasRef.current.getContext('2d');
        return ctx?.getImageData(0, 0, width, height) || null;
    }, [compositeToCanvas, width, height]);

    // Resize all layer canvases
    const resizeLayers = useCallback((newWidth: number, newHeight: number) => {
        setLayers(prevLayers =>
            prevLayers.map(layer => {
                if (!layer.canvas) return layer;

                const oldCtx = layer.canvas.getContext('2d');
                const imageData = oldCtx?.getImageData(0, 0, layer.canvas.width, layer.canvas.height);

                const newCanvas = createLayerCanvas(newWidth, newHeight);
                const newCtx = newCanvas.getContext('2d');

                if (newCtx && imageData) {
                    newCtx.putImageData(imageData, 0, 0);
                }

                return { ...layer, canvas: newCanvas };
            })
        );
    }, []);

    // ========================================
    // FRAME STATE SNAPSHOT METHODS (V2)
    // ========================================

    /**
     * Serialize the current layer state into a snapshot
     * Used when saving frame state before switching to another frame
     */
    const serializeState = useCallback((): LayerSystemState => {
        const layerSnapshots: LayerSnapshot[] = layers.map(layer => {
            let imageData: ImageData;

            if (layer.canvas) {
                const ctx = layer.canvas.getContext('2d');
                imageData = ctx
                    ? ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height)
                    : new ImageData(width, height);
            } else {
                imageData = new ImageData(width, height);
            }

            return {
                id: layer.id,
                name: layer.name,
                visible: layer.visible,
                locked: layer.locked,
                opacity: layer.opacity,
                blendMode: layer.blendMode,
                imageData,
            };
        });

        return {
            layers: layerSnapshots,
            activeLayerId,
        };
    }, [layers, activeLayerId, width, height]);

    /**
     * Restore layer state from a snapshot
     * Used when loading a frame's state after switching
     */
    const restoreState = useCallback((snapshot: LayerSystemState) => {
        // Recreate all layers from the snapshot
        const newLayers: Layer[] = snapshot.layers.map(snap => {
            const canvas = createLayerCanvas(width, height);
            const ctx = canvas.getContext('2d');
            if (ctx && snap.imageData) {
                ctx.putImageData(snap.imageData, 0, 0);
            }

            return {
                id: snap.id,
                name: snap.name,
                visible: snap.visible,
                locked: snap.locked,
                opacity: snap.opacity,
                blendMode: snap.blendMode,
                canvas,
            };
        });

        setLayers(newLayers);
        setActiveLayerId(snapshot.activeLayerId);
    }, [width, height]);

    /**
     * Clear all layers except background (for new frames)
     */
    const clearForNewFrame = useCallback(() => {
        setLayers(prevLayers =>
            prevLayers.map((layer, index) => {
                if (!layer.canvas) {
                    return layer;
                }

                const oldCanvas = layer.canvas;
                const oldCtx = oldCanvas.getContext('2d');
                const imageData = oldCtx
                    ? oldCtx.getImageData(0, 0, oldCanvas.width, oldCanvas.height)
                    : null;

                const newCanvas = createLayerCanvas(width, height);
                const newCtx = newCanvas.getContext('2d');

                if (newCtx && imageData && index === 0) {
                    newCtx.putImageData(imageData, 0, 0);
                }

                return {
                    ...layer,
                    canvas: newCanvas,
                };
            })
        );
    }, [width, height]);

    return {
        // State
        layers,
        activeLayerId,

        // Layer selection
        setActiveLayerId,
        getActiveLayer,
        getActiveContext,

        // Layer CRUD
        addLayer,
        deleteLayer,
        duplicateLayer,
        moveLayer,

        // Layer properties
        updateLayer,
        toggleVisibility,
        toggleLock,
        setOpacity,
        setBlendMode,
        renameLayer,

        // Layer operations
        mergeDown,
        flattenAll,

        // Compositing
        compositeToCanvas,
        getComposedImageData,

        // Resize
        resizeLayers,

        // Initialization
        initializeWithImageData,

        // Frame state snapshot methods (V2)
        serializeState,
        restoreState,
        clearForNewFrame,
    };
}

// Helper: Convert blend mode to canvas composite operation
function getCompositeOperation(blendMode: BlendMode): GlobalCompositeOperation {
    const map: Record<BlendMode, GlobalCompositeOperation> = {
        normal: 'source-over',
        multiply: 'multiply',
        screen: 'screen',
        overlay: 'overlay',
        darken: 'darken',
        lighten: 'lighten',
    };
    return map[blendMode] || 'source-over';
}

export default useLayerSystem;
