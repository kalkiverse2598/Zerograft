/**
 * Particle Overlay Hook
 * Manages particle sprites that can be placed on the canvas
 * - Stores placed particles with position and animation state
 * - Handles particle animation timing
 * - Renders particles on canvas during playback
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export interface ParticleInstance {
    id: string;
    imageBase64: string;       // Base64 encoded spritesheet
    x: number;                 // Position on canvas
    y: number;
    frameCount: number;        // Number of animation frames
    frameWidth: number;        // Width of single frame
    frameHeight: number;       // Height of single frame
    currentFrame: number;      // Current animation frame (0-based)
    opacity: number;           // 0-1
    scale: number;             // Scale factor
    rotation: number;          // Rotation in degrees
    loop: boolean;             // Whether to loop animation
    finished: boolean;         // Whether animation is complete
    startFrame?: number;       // Animation frame to start on (for triggering on impact)
}

interface UseParticleOverlayOptions {
    fps?: number;              // Animation FPS
    canvasWidth: number;
    canvasHeight: number;
}

export function useParticleOverlay({
    fps = 12,
    canvasWidth,
    canvasHeight,
}: UseParticleOverlayOptions) {
    // All placed particle instances
    const [particles, setParticles] = useState<ParticleInstance[]>([]);

    // Placement mode state
    const [isPlacingMode, setIsPlacingMode] = useState(false);
    const [pendingParticle, setPendingParticle] = useState<{
        imageBase64: string;
        frameCount: number;
        frameWidth: number;
        frameHeight: number;
    } | null>(null);

    // Animation loop
    const [isAnimating, setIsAnimating] = useState(false);
    const animationRef = useRef<number | null>(null);
    const lastFrameTimeRef = useRef<number>(0);

    // Generate unique ID
    const generateId = () => `particle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    /**
     * Enter placement mode with a particle to place
     */
    const startPlacement = useCallback((
        imageBase64: string,
        frameCount: number,
        frameWidth: number,
        frameHeight: number
    ) => {
        setPendingParticle({ imageBase64, frameCount, frameWidth, frameHeight });
        setIsPlacingMode(true);
    }, []);

    /**
     * Cancel placement mode
     */
    const cancelPlacement = useCallback(() => {
        setPendingParticle(null);
        setIsPlacingMode(false);
    }, []);

    /**
     * Place particle at specified canvas coordinates
     */
    const placeParticle = useCallback((x: number, y: number, options?: {
        opacity?: number;
        scale?: number;
        rotation?: number;
        loop?: boolean;
        startFrame?: number;
    }) => {
        if (!pendingParticle) return null;

        const newParticle: ParticleInstance = {
            id: generateId(),
            imageBase64: pendingParticle.imageBase64,
            x: Math.round(x - pendingParticle.frameWidth / 2), // Center on click
            y: Math.round(y - pendingParticle.frameHeight / 2),
            frameCount: pendingParticle.frameCount,
            frameWidth: pendingParticle.frameWidth,
            frameHeight: pendingParticle.frameHeight,
            currentFrame: 0,
            opacity: options?.opacity ?? 1,
            scale: options?.scale ?? 1,
            rotation: options?.rotation ?? 0,
            loop: options?.loop ?? false,
            finished: false,
            startFrame: options?.startFrame,
        };

        setParticles(prev => [...prev, newParticle]);
        setIsPlacingMode(false);
        setPendingParticle(null);

        return newParticle.id;
    }, [pendingParticle]);

    /**
     * Remove a particle by ID
     */
    const removeParticle = useCallback((id: string) => {
        setParticles(prev => prev.filter(p => p.id !== id));
    }, []);

    /**
     * Clear all particles
     */
    const clearAllParticles = useCallback(() => {
        setParticles([]);
    }, []);

    /**
     * Update particle animation frames
     */
    const advanceAnimations = useCallback(() => {
        setParticles(prev => prev.map(particle => {
            if (particle.finished) return particle;

            const nextFrame = particle.currentFrame + 1;

            if (nextFrame >= particle.frameCount) {
                if (particle.loop) {
                    return { ...particle, currentFrame: 0 };
                } else {
                    return { ...particle, finished: true };
                }
            }

            return { ...particle, currentFrame: nextFrame };
        }));
    }, []);

    /**
     * Reset all particle animations to frame 0
     */
    const resetAnimations = useCallback(() => {
        setParticles(prev => prev.map(p => ({
            ...p,
            currentFrame: 0,
            finished: false,
        })));
    }, []);

    /**
     * Start animation loop
     */
    const startAnimation = useCallback(() => {
        setIsAnimating(true);
        lastFrameTimeRef.current = performance.now();
    }, []);

    /**
     * Stop animation loop
     */
    const stopAnimation = useCallback(() => {
        setIsAnimating(false);
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }
    }, []);

    // Animation loop effect
    useEffect(() => {
        if (!isAnimating) return;

        const frameDuration = 1000 / fps;

        const animate = (timestamp: number) => {
            const elapsed = timestamp - lastFrameTimeRef.current;

            if (elapsed >= frameDuration) {
                advanceAnimations();
                lastFrameTimeRef.current = timestamp;
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isAnimating, fps, advanceAnimations]);

    /**
     * Draw all particles onto a canvas context
     * Call this in your render loop
     */
    const drawParticles = useCallback((ctx: CanvasRenderingContext2D, imageCache: Map<string, HTMLImageElement>) => {
        particles.forEach(particle => {
            if (particle.finished && !particle.loop) return;

            let img = imageCache.get(particle.imageBase64);

            if (!img) {
                // Load image if not cached
                img = new Image();
                img.src = `data:image/png;base64,${particle.imageBase64}`;
                imageCache.set(particle.imageBase64, img);
            }

            if (!img.complete) return;

            const sourceX = particle.currentFrame * particle.frameWidth;

            ctx.save();
            ctx.globalAlpha = particle.opacity;

            // Apply transformations
            if (particle.rotation !== 0 || particle.scale !== 1) {
                const centerX = particle.x + particle.frameWidth / 2;
                const centerY = particle.y + particle.frameHeight / 2;
                ctx.translate(centerX, centerY);
                ctx.rotate((particle.rotation * Math.PI) / 180);
                ctx.scale(particle.scale, particle.scale);
                ctx.translate(-centerX, -centerY);
            }

            // Draw the current frame from spritesheet
            ctx.drawImage(
                img,
                sourceX, 0,                           // Source position
                particle.frameWidth, particle.frameHeight,  // Source size
                particle.x, particle.y,               // Destination position
                particle.frameWidth, particle.frameHeight   // Destination size
            );

            ctx.restore();
        });
    }, [particles]);

    return {
        // Particle instances
        particles,

        // Placement mode
        isPlacingMode,
        pendingParticle,
        startPlacement,
        cancelPlacement,
        placeParticle,

        // Management
        removeParticle,
        clearAllParticles,

        // Animation
        isAnimating,
        startAnimation,
        stopAnimation,
        advanceAnimations,
        resetAnimations,

        // Rendering
        drawParticles,
    };
}

export default useParticleOverlay;
