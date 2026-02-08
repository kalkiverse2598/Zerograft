"use client";

import React, { useEffect, useRef, useMemo } from 'react';
import { ParticleInstance } from '@/lib/pixelEditor/useParticleOverlay';

interface ParticleOverlayCanvasProps {
    particles: ParticleInstance[];
    width: number;
    height: number;
    zoom: number;
    isAnimating?: boolean;
}

/**
 * Canvas overlay that renders placed particles
 * Positioned absolutely over the main editor canvas
 */
export function ParticleOverlayCanvas({
    particles,
    width,
    height,
    zoom,
    isAnimating = false,
}: ParticleOverlayCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

    // Preload particle images
    useEffect(() => {
        particles.forEach(particle => {
            if (!imageCache.current.has(particle.imageBase64)) {
                const img = new Image();
                img.src = `data:image/png;base64,${particle.imageBase64}`;
                img.onload = () => {
                    // Force re-render when image loads
                    if (canvasRef.current) {
                        renderParticles();
                    }
                };
                imageCache.current.set(particle.imageBase64, img);
            }
        });
    }, [particles]);

    // Render particles to canvas
    const renderParticles = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw each particle
        particles.forEach(particle => {
            if (particle.finished && !particle.loop) return;

            const img = imageCache.current.get(particle.imageBase64);
            if (!img || !img.complete) return;

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
                sourceX, 0,                                     // Source position
                particle.frameWidth, particle.frameHeight,      // Source size
                particle.x, particle.y,                         // Destination position
                particle.frameWidth, particle.frameHeight       // Destination size
            );

            ctx.restore();
        });
    };

    // Re-render when particles change or animate
    useEffect(() => {
        renderParticles();
    }, [particles, isAnimating]);

    // Memoize style to prevent unnecessary re-renders
    const canvasStyle = useMemo(() => ({
        width: width * zoom,
        height: height * zoom,
        imageRendering: 'pixelated' as const,
    }), [width, height, zoom]);

    if (particles.length === 0) return null;

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="absolute inset-0 pointer-events-none"
            style={canvasStyle}
        />
    );
}

export default ParticleOverlayCanvas;
