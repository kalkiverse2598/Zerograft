/**
 * Animation Playback Hook for Pixel Editor
 * Manages animation frames, playback, and timeline state
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export interface AnimationFrame {
    id: string;
    duration: number; // Duration in milliseconds
    imageData: ImageData | null;
    thumbnailUrl?: string;
}

export interface AnimationState {
    frames: AnimationFrame[];
    currentFrameIndex: number;
    isPlaying: boolean;
    fps: number;
    loop: boolean;
}

interface UseAnimationPlaybackOptions {
    initialFrames?: AnimationFrame[];
    defaultFps?: number;
    onFrameChange?: (frameIndex: number) => void;
}

// Generate unique frame ID
const generateFrameId = () => `frame_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export function useAnimationPlayback({
    initialFrames = [],
    defaultFps = 12,
    onFrameChange,
}: UseAnimationPlaybackOptions = {}) {
    const [frames, setFrames] = useState<AnimationFrame[]>(initialFrames);
    const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [fps, setFps] = useState(defaultFps);
    const [loop, setLoop] = useState(true);

    // Animation timer ref
    const animationTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastFrameTimeRef = useRef<number>(0);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (animationTimerRef.current) {
                clearTimeout(animationTimerRef.current);
            }
        };
    }, []);

    // Handle frame change callback
    useEffect(() => {
        onFrameChange?.(currentFrameIndex);
    }, [currentFrameIndex, onFrameChange]);

    // Animation loop
    useEffect(() => {
        if (!isPlaying || frames.length <= 1) {
            if (animationTimerRef.current) {
                clearTimeout(animationTimerRef.current);
                animationTimerRef.current = null;
            }
            return;
        }

        const currentFrame = frames[currentFrameIndex];
        const frameDuration = currentFrame?.duration || (1000 / fps);

        animationTimerRef.current = setTimeout(() => {
            setCurrentFrameIndex(prev => {
                const nextIndex = prev + 1;
                if (nextIndex >= frames.length) {
                    if (loop) {
                        return 0;
                    } else {
                        setIsPlaying(false);
                        return prev;
                    }
                }
                return nextIndex;
            });
        }, frameDuration);

        return () => {
            if (animationTimerRef.current) {
                clearTimeout(animationTimerRef.current);
            }
        };
    }, [isPlaying, currentFrameIndex, frames, fps, loop]);

    // Play/Pause controls
    const play = useCallback(() => {
        if (frames.length > 1) {
            setIsPlaying(true);
        }
    }, [frames.length]);

    const pause = useCallback(() => {
        setIsPlaying(false);
    }, []);

    const stop = useCallback(() => {
        setIsPlaying(false);
        setCurrentFrameIndex(0);
    }, []);

    const togglePlayPause = useCallback(() => {
        if (isPlaying) {
            pause();
        } else {
            play();
        }
    }, [isPlaying, play, pause]);

    // Frame navigation
    const goToFrame = useCallback((index: number) => {
        const clampedIndex = Math.max(0, Math.min(index, frames.length - 1));
        setCurrentFrameIndex(clampedIndex);
    }, [frames.length]);

    const nextFrame = useCallback(() => {
        setCurrentFrameIndex(prev => {
            const next = prev + 1;
            return loop ? next % frames.length : Math.min(next, frames.length - 1);
        });
    }, [frames.length, loop]);

    const prevFrame = useCallback(() => {
        setCurrentFrameIndex(prev => {
            const next = prev - 1;
            return loop ? (next < 0 ? frames.length - 1 : next) : Math.max(next, 0);
        });
    }, [frames.length, loop]);

    const goToFirstFrame = useCallback(() => {
        setCurrentFrameIndex(0);
    }, []);

    const goToLastFrame = useCallback(() => {
        setCurrentFrameIndex(frames.length - 1);
    }, [frames.length]);

    // Frame CRUD
    const addFrame = useCallback((imageData?: ImageData, insertAfterIndex?: number): AnimationFrame => {
        const newFrame: AnimationFrame = {
            id: generateFrameId(),
            duration: 1000 / fps,
            imageData: imageData || null,
        };

        setFrames(prev => {
            const insertIndex = insertAfterIndex !== undefined
                ? insertAfterIndex + 1
                : prev.length;
            const newFrames = [...prev];
            newFrames.splice(insertIndex, 0, newFrame);
            return newFrames;
        });

        return newFrame;
    }, [fps]);

    const deleteFrame = useCallback((frameId: string) => {
        setFrames(prev => {
            if (prev.length <= 1) return prev; // Keep at least one frame

            const index = prev.findIndex(f => f.id === frameId);
            const newFrames = prev.filter(f => f.id !== frameId);

            // Adjust current frame if needed
            if (currentFrameIndex >= newFrames.length) {
                setCurrentFrameIndex(newFrames.length - 1);
            } else if (currentFrameIndex > index) {
                setCurrentFrameIndex(prev => prev - 1);
            }

            return newFrames;
        });
    }, [currentFrameIndex]);

    const duplicateFrame = useCallback((frameId: string) => {
        const frameIndex = frames.findIndex(f => f.id === frameId);
        const frame = frames[frameIndex];
        if (!frame) return null;

        const newFrame: AnimationFrame = {
            id: generateFrameId(),
            duration: frame.duration,
            imageData: frame.imageData ? new ImageData(
                new Uint8ClampedArray(frame.imageData.data),
                frame.imageData.width,
                frame.imageData.height
            ) : null,
            thumbnailUrl: frame.thumbnailUrl,
        };

        setFrames(prev => {
            const newFrames = [...prev];
            newFrames.splice(frameIndex + 1, 0, newFrame);
            return newFrames;
        });

        return newFrame;
    }, [frames]);

    const moveFrame = useCallback((frameId: string, newIndex: number) => {
        setFrames(prev => {
            const currentIndex = prev.findIndex(f => f.id === frameId);
            if (currentIndex === -1) return prev;

            const newFrames = [...prev];
            const [removed] = newFrames.splice(currentIndex, 1);
            const clampedIndex = Math.max(0, Math.min(newIndex, newFrames.length));
            newFrames.splice(clampedIndex, 0, removed);

            // Adjust current frame index if affected
            if (currentFrameIndex === currentIndex) {
                setCurrentFrameIndex(clampedIndex);
            } else if (currentFrameIndex > currentIndex && currentFrameIndex <= clampedIndex) {
                setCurrentFrameIndex(prev => prev - 1);
            } else if (currentFrameIndex < currentIndex && currentFrameIndex >= clampedIndex) {
                setCurrentFrameIndex(prev => prev + 1);
            }

            return newFrames;
        });
    }, [currentFrameIndex]);

    // Update frame properties
    const updateFrame = useCallback((frameId: string, updates: Partial<Omit<AnimationFrame, 'id'>>) => {
        setFrames(prev =>
            prev.map(frame =>
                frame.id === frameId ? { ...frame, ...updates } : frame
            )
        );
    }, []);

    const setFrameDuration = useCallback((frameId: string, duration: number) => {
        updateFrame(frameId, { duration: Math.max(10, duration) });
    }, [updateFrame]);

    const setFrameImageData = useCallback((frameId: string, imageData: ImageData) => {
        updateFrame(frameId, { imageData });
    }, [updateFrame]);

    // Bulk operations
    const setAllFramesDuration = useCallback((duration: number) => {
        setFrames(prev => prev.map(f => ({ ...f, duration: Math.max(10, duration) })));
    }, []);

    const reorderFrames = useCallback((newOrder: string[]) => {
        setFrames(prev => {
            const frameMap = new Map(prev.map(f => [f.id, f]));
            return newOrder
                .map(id => frameMap.get(id))
                .filter((f): f is AnimationFrame => f !== undefined);
        });
    }, []);

    // Get current frame
    const getCurrentFrame = useCallback((): AnimationFrame | null => {
        return frames[currentFrameIndex] || null;
    }, [frames, currentFrameIndex]);

    // Calculate total animation duration
    const getTotalDuration = useCallback((): number => {
        return frames.reduce((sum, f) => sum + f.duration, 0);
    }, [frames]);

    // Set frames from external source
    const setAllFrames = useCallback((newFrames: AnimationFrame[]) => {
        setFrames(newFrames);
        setCurrentFrameIndex(0);
    }, []);

    return {
        // State
        frames,
        currentFrameIndex,
        isPlaying,
        fps,
        loop,

        // Playback controls
        play,
        pause,
        stop,
        togglePlayPause,
        setFps,
        setLoop,

        // Frame navigation
        goToFrame,
        nextFrame,
        prevFrame,
        goToFirstFrame,
        goToLastFrame,

        // Frame CRUD
        addFrame,
        deleteFrame,
        duplicateFrame,
        moveFrame,
        updateFrame,
        setFrameDuration,
        setFrameImageData,
        setAllFramesDuration,
        reorderFrames,
        setAllFrames,

        // Utilities
        getCurrentFrame,
        getTotalDuration,
    };
}

export default useAnimationPlayback;
