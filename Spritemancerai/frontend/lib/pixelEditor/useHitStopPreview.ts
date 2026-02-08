/**
 * Hit-Stop Preview Hook
 * Provides "game feel" effects during animation preview:
 * - Freeze frames (hit-stop/pause on impact)
 * - Screen shake (canvas jitter)
 * - White flash overlay
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export interface HitStopConfig {
    enabled: boolean;
    freezeFrames: number;      // Number of times to repeat the impact frame (1-5)
    shakeIntensity: number;    // Shake magnitude in pixels (0-4)
    shakeDuration: number;     // How many frames to shake (1-5)
    whiteFlash: boolean;       // Enable white flash on impact
    flashIntensity: number;    // Flash opacity (0-1)
}

export interface ImpactFrame {
    frameIndex: number;
    frameId: string;
}

interface UseHitStopPreviewOptions {
    fps: number;
    totalFrames: number;
    onShakeOffset?: (x: number, y: number) => void;
    onFrameChange?: (frameIndex: number) => void;
}

const DEFAULT_CONFIG: HitStopConfig = {
    enabled: false,
    freezeFrames: 3,
    shakeIntensity: 2,
    shakeDuration: 3,
    whiteFlash: true,
    flashIntensity: 0.5,
};

// Generate random shake offset
const getShakeOffset = (intensity: number): { x: number; y: number } => {
    if (intensity === 0) return { x: 0, y: 0 };
    return {
        x: Math.round((Math.random() - 0.5) * 2 * intensity),
        y: Math.round((Math.random() - 0.5) * 2 * intensity),
    };
};

export function useHitStopPreview({
    fps,
    totalFrames,
    onShakeOffset,
    onFrameChange,
}: UseHitStopPreviewOptions) {
    // Configuration
    const [config, setConfig] = useState<HitStopConfig>(DEFAULT_CONFIG);

    // Marked impact frames
    const [impactFrames, setImpactFrames] = useState<Set<number>>(new Set());

    // Preview state
    const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
    const [previewFrameIndex, setPreviewFrameIndex] = useState(0);
    const [shakeOffset, setShakeOffset] = useState({ x: 0, y: 0 });
    const [flashOpacity, setFlashOpacity] = useState(0);
    const [animationTick, setAnimationTick] = useState(0); // Tick counter to force re-renders

    // Internal tracking
    const freezeCountRef = useRef(0);
    const shakeCountRef = useRef(0);
    const animationTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (animationTimerRef.current) {
                clearTimeout(animationTimerRef.current);
            }
        };
    }, []);

    // Update shake offset callback
    useEffect(() => {
        onShakeOffset?.(shakeOffset.x, shakeOffset.y);
    }, [shakeOffset, onShakeOffset]);

    // Update frame change callback to sync with main animation
    useEffect(() => {
        if (isPreviewPlaying) {
            onFrameChange?.(previewFrameIndex);
        }
    }, [previewFrameIndex, isPreviewPlaying, onFrameChange]);

    /**
     * Mark/unmark a frame as an impact frame
     */
    const toggleImpactFrame = useCallback((frameIndex: number) => {
        setImpactFrames(prev => {
            const next = new Set(prev);
            if (next.has(frameIndex)) {
                next.delete(frameIndex);
            } else {
                next.add(frameIndex);
            }
            return next;
        });
    }, []);

    /**
     * Check if a frame is marked as impact
     */
    const isImpactFrame = useCallback((frameIndex: number) => {
        return impactFrames.has(frameIndex);
    }, [impactFrames]);

    /**
     * Clear all impact frames
     */
    const clearImpactFrames = useCallback(() => {
        setImpactFrames(new Set());
    }, []);

    /**
     * Update config
     */
    const updateConfig = useCallback((updates: Partial<HitStopConfig>) => {
        setConfig(prev => ({ ...prev, ...updates }));
    }, []);

    /**
     * Start hit-stop preview playback
     */
    const startPreview = useCallback(() => {
        setIsPreviewPlaying(true);
        setPreviewFrameIndex(0);
        setAnimationTick(0);
        freezeCountRef.current = 0;
        shakeCountRef.current = 0;
        setShakeOffset({ x: 0, y: 0 });
        setFlashOpacity(0);
    }, []);

    /**
     * Stop hit-stop preview
     */
    const stopPreview = useCallback(() => {
        setIsPreviewPlaying(false);
        if (animationTimerRef.current) {
            clearTimeout(animationTimerRef.current);
            animationTimerRef.current = null;
        }
        setShakeOffset({ x: 0, y: 0 });
        setFlashOpacity(0);
        freezeCountRef.current = 0;
        shakeCountRef.current = 0;
    }, []);

    /**
     * Preview animation loop with hit-stop effects
     */
    useEffect(() => {
        if (!isPreviewPlaying || !config.enabled) {
            if (animationTimerRef.current) {
                clearTimeout(animationTimerRef.current);
                animationTimerRef.current = null;
            }
            return;
        }

        const frameDuration = 1000 / fps;
        const currentIsImpact = impactFrames.has(previewFrameIndex);

        // Handle impact frame
        if (currentIsImpact) {
            // Check if we're still in freeze phase
            if (freezeCountRef.current < config.freezeFrames) {
                // Trigger flash on first freeze frame
                if (freezeCountRef.current === 0 && config.whiteFlash) {
                    setFlashOpacity(config.flashIntensity);
                }

                // Apply shake during freeze
                if (config.shakeIntensity > 0) {
                    setShakeOffset(getShakeOffset(config.shakeIntensity));
                }

                // Fade flash
                if (freezeCountRef.current > 0 && config.whiteFlash) {
                    setFlashOpacity(prev => Math.max(0, prev - (config.flashIntensity / config.freezeFrames)));
                }

                freezeCountRef.current++;

                // Force re-render with tick increment (same frame index won't trigger re-render)
                animationTimerRef.current = setTimeout(() => {
                    setAnimationTick(t => t + 1);
                }, frameDuration);
                return;
            } else {
                // Freeze complete, reset and continue shake
                freezeCountRef.current = 0;
                shakeCountRef.current = config.shakeDuration;
            }
        }

        // Handle post-impact shake
        if (shakeCountRef.current > 0) {
            setShakeOffset(getShakeOffset(config.shakeIntensity * (shakeCountRef.current / config.shakeDuration)));
            shakeCountRef.current--;
        } else {
            setShakeOffset({ x: 0, y: 0 });
        }

        // Advance to next frame
        animationTimerRef.current = setTimeout(() => {
            setPreviewFrameIndex(prev => {
                const next = prev + 1;
                if (next >= totalFrames) {
                    setIsPreviewPlaying(false);
                    return 0;
                }
                return next;
            });
        }, frameDuration);

        return () => {
            if (animationTimerRef.current) {
                clearTimeout(animationTimerRef.current);
            }
        };
    }, [isPreviewPlaying, previewFrameIndex, animationTick, config, fps, impactFrames, totalFrames]);

    return {
        // Config
        config,
        updateConfig,
        setConfig,

        // Impact frame management
        impactFrames,
        toggleImpactFrame,
        isImpactFrame,
        clearImpactFrames,

        // Preview state
        isPreviewPlaying,
        previewFrameIndex,
        shakeOffset,
        flashOpacity,

        // Preview controls
        startPreview,
        stopPreview,
    };
}

export default useHitStopPreview;
