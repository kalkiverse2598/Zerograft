/**
 * Frame State Manager Hook
 * Manages per-frame layer state snapshots for animation
 * 
 * This hook provides the coordination layer between:
 * - useLayerSystem (manages the active/working layer state)
 * - useAnimationPlayback (manages animation frames and playback)
 * 
 * Each animation frame gets its own complete snapshot of layer state
 */

import { useCallback, useRef, useEffect } from 'react';
import type { FrameLayerSnapshot, LayerSystemState } from './types/frameState';
import { cloneImageData } from './types/frameState';
import type { useLayerSystem } from './useLayerSystem';
import type { useAnimationPlayback } from './useAnimationPlayback';

interface UseFrameStateManagerOptions {
    layerSystem: ReturnType<typeof useLayerSystem>;
    animation: ReturnType<typeof useAnimationPlayback>;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    layersReady: boolean;
}

export function useFrameStateManager({
    layerSystem,
    animation,
    canvasRef,
    layersReady,
}: UseFrameStateManagerOptions) {
    // Storage for all frame snapshots
    const frameSnapshots = useRef<Map<string, FrameLayerSnapshot>>(new Map());

    // Track which frame is currently loaded into the layer system
    const loadedFrameIdRef = useRef<string | null>(null);

    // Track previous frame index to detect changes
    const prevFrameIndexRef = useRef<number>(-1);

    const layerSystemRef = useRef(layerSystem);
    layerSystemRef.current = layerSystem;

    /**
     * Save current layer state to a specific frame
     */
    const saveToFrame = useCallback((frameId: string) => {
        if (!layersReady || layerSystem.layers.length === 0) {
            console.log('⚠️ Cannot save - layers not ready');
            return;
        }

        // 1) Serialize per-layer state for restoration
        const state = layerSystem.serializeState();
        const snapshot: FrameLayerSnapshot = {
            frameId,
            ...state,
            timestamp: Date.now(),
        };

        frameSnapshots.current.set(frameId, snapshot);

        // 2) Update the animation frame's ImageData so that
        //    thumbnails and playback stay in sync with the
        //    current layer composition.
        const composed = layerSystem.getComposedImageData();
        if (composed) {
            animation.setFrameImageData(frameId, composed);
        }

        console.log(`💾 SAVED frame ${frameId} (${snapshot.layers.length} layers)`);
    }, [layerSystem, layersReady, animation]);

    /**
     * Load a frame's state into the layer system
     */
    const loadFromFrame = useCallback((frameId: string) => {
        const snapshot = frameSnapshots.current.get(frameId);

        if (snapshot) {
            // Restore from snapshot
            layerSystem.restoreState(snapshot);
            console.log(`📂 LOADED frame ${frameId} (${snapshot.layers.length} layers)`);
        } else {
            // No snapshot - check if frame has imageData from import
            const frame = animation.frames.find(f => f.id === frameId);
            if (frame?.imageData) {
                // Initialize layer system with the imported imageData
                layerSystem.initializeWithImageData(frame.imageData);
                console.log(`📦 INITIALIZED frame ${frameId} from imported imageData`);

                // Create and save snapshot immediately so it's available next time
                const state = layerSystem.serializeState();
                const newSnapshot: FrameLayerSnapshot = {
                    frameId,
                    ...state,
                    timestamp: Date.now(),
                };
                frameSnapshots.current.set(frameId, newSnapshot);
            } else {
                // Truly new/empty frame - clear for fresh start
                layerSystem.clearForNewFrame();
                console.log(`🆕 New frame ${frameId} - cleared for fresh start`);
            }
        }

        loadedFrameIdRef.current = frameId;

        // Note: Display update is handled by the useEffect in PixelEditorProvider
        // that watches layerSystem.layers changes. We don't use setTimeout here
        // because it causes race conditions with React's async state updates.
    }, [layerSystem, animation.frames]);

    /**
     * Save current frame before any navigation
     */
    const saveCurrentFrame = useCallback(() => {
        const currentFrame = animation.frames[animation.currentFrameIndex];
        if (currentFrame) {
            // Always save current frame before navigating away
            saveToFrame(currentFrame.id);
            loadedFrameIdRef.current = currentFrame.id;
        }
    }, [animation.frames, animation.currentFrameIndex, saveToFrame]);

    // ========================================
    // WRAPPED NAVIGATION FUNCTIONS
    // ========================================

    /**
     * Navigate to a specific frame (saves current first)
     */
    const goToFrame = useCallback((index: number) => {
        if (index === animation.currentFrameIndex) return;
        if (index < 0 || index >= animation.frames.length) return;

        saveCurrentFrame();
        animation.goToFrame(index);
    }, [animation, saveCurrentFrame]);

    /**
     * Go to next frame (saves current first)
     */
    const nextFrame = useCallback(() => {
        saveCurrentFrame();
        animation.nextFrame();
    }, [animation, saveCurrentFrame]);

    /**
     * Go to previous frame (saves current first)
     */
    const prevFrame = useCallback(() => {
        saveCurrentFrame();
        animation.prevFrame();
    }, [animation, saveCurrentFrame]);

    /**
     * Add a new frame (saves current first)
     */
    const addFrame = useCallback((imageData?: ImageData) => {
        saveCurrentFrame();
        const newFrame = animation.addFrame(imageData);
        // The useEffect will handle loading the new frame
        return newFrame;
    }, [animation, saveCurrentFrame]);

    /**
     * Delete a frame
     */
    const deleteFrame = useCallback((frameId: string) => {
        // Remove snapshot for deleted frame
        frameSnapshots.current.delete(frameId);
        animation.deleteFrame(frameId);
    }, [animation]);

    /**
     * Duplicate a frame (including its layer state)
     */
    const duplicateFrame = useCallback((frameId: string) => {
        // First duplicate in animation
        const newFrame = animation.duplicateFrame(frameId);
        if (!newFrame) return null;

        // Deep copy the snapshot to the new frame (prevents shared reference leakage)
        const sourceSnapshot = frameSnapshots.current.get(frameId);
        if (sourceSnapshot) {
            // Deep copy each layer and its ImageData to prevent frame leakage
            const newLayers = sourceSnapshot.layers.map(layer => ({
                ...layer,
                imageData: cloneImageData(layer.imageData),
            }));

            const newSnapshot: FrameLayerSnapshot = {
                frameId: newFrame.id,
                layers: newLayers,
                activeLayerId: sourceSnapshot.activeLayerId,
                timestamp: Date.now(),
            };
            frameSnapshots.current.set(newFrame.id, newSnapshot);
        }

        return newFrame;
    }, [animation]);

    // ========================================
    // AUTO-LOAD ON FRAME CHANGE
    // ========================================

    // Use refs to avoid dependency issues
    const animationRef = useRef(animation);
    animationRef.current = animation;

    const loadFromFrameRef = useRef(loadFromFrame);
    loadFromFrameRef.current = loadFromFrame;

    const layersReadyRef = useRef(layersReady);
    layersReadyRef.current = layersReady;

    // Only trigger on currentFrameIndex changes - NOT on frames array changes
    useEffect(() => {
        const anim = animationRef.current;
        if (anim.frames.length === 0) return;
        if (!layersReadyRef.current) return;

        const currentIndex = anim.currentFrameIndex;
        const newFrame = anim.frames[currentIndex];
        if (!newFrame) return;

        // Check if this is a DIFFERENT frame than what's currently loaded
        // This handles both initial load (null) and subsequent switches
        if (loadedFrameIdRef.current === newFrame.id) {
            // Same frame, no need to load
            return;
        }

        console.log(`🎬 Frame changed: loading ${newFrame.id} (was: ${loadedFrameIdRef.current})`);

        // Update ref FIRST to prevent re-runs
        prevFrameIndexRef.current = currentIndex;

        // Load the new frame's state
        loadFromFrameRef.current(newFrame.id);
    }, [animation.currentFrameIndex, animation.frames.length, layersReady]); // Include layersReady and frames.length

    // ========================================
    // EXPOSE API
    // ========================================

    return {
        // State
        frameSnapshots: frameSnapshots.current,
        loadedFrameId: loadedFrameIdRef.current,

        // Core operations
        saveToFrame,
        loadFromFrame,
        saveCurrentFrame,

        // Wrapped navigation (use these instead of animation.* directly)
        goToFrame,
        nextFrame,
        prevFrame,
        addFrame,
        deleteFrame,
        duplicateFrame,

        // Pass through animation state (read-only)
        frames: animation.frames,
        currentFrameIndex: animation.currentFrameIndex,
        isPlaying: animation.isPlaying,
        fps: animation.fps,
        loop: animation.loop,

        // Pass through playback controls (these don't need wrapping)
        play: animation.play,
        pause: animation.pause,
        stop: animation.stop,
        togglePlayPause: animation.togglePlayPause,
        setFps: animation.setFps,
        setLoop: animation.setLoop,
        setFrameDuration: animation.setFrameDuration,
        setFrameImageData: animation.setFrameImageData,
        goToFirstFrame: animation.goToFirstFrame,
        goToLastFrame: animation.goToLastFrame,
        moveFrame: animation.moveFrame,
    };
}

export default useFrameStateManager;
