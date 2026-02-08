/**
 * Fluid Particles Hook
 * Generates particle-based fluid effects (smoke, fire, sparks, magic)
 * 
 * Features:
 * - Multiple emission shapes (point, line, circle)
 * - Physics simulation (gravity, buoyancy, turbulence)
 * - Color gradients over particle lifetime
 * - Generates animation frames for timeline
 */

import { useState, useCallback, useRef } from 'react';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type FluidType = 'smoke' | 'fire' | 'sparks' | 'magic' | 'custom';
export type EmitterShape = 'point' | 'line' | 'circle';

export interface FluidConfig {
    type: FluidType;
    emitterShape: EmitterShape;
    emitterSize: number;           // Radius for circle, length for line
    emissionRate: number;          // Particles per frame (1-50)
    lifetime: number;              // Particle lifetime in frames (10-120)
    gravity: number;               // Gravity force (-10 to 10, negative = rise)
    spread: number;                // Emission spread angle (0-180 degrees)
    initialVelocity: number;       // Initial speed (0-20)
    size: { min: number; max: number };
    opacity: { start: number; end: number };
    colorGradient: string[];       // Colors over lifetime
    turbulence: number;            // Random motion strength (0-1)
    buoyancy: number;              // Rising force for hot particles (0-1)
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    opacity: number;
    age: number;
    lifetime: number;
    color: string;
}

// ============================================================================
// Presets
// ============================================================================

export const FLUID_PRESETS: Record<FluidType, FluidConfig> = {
    smoke: {
        type: 'smoke',
        emitterShape: 'point',
        emitterSize: 5,
        emissionRate: 8,
        lifetime: 60,
        gravity: -1.5,
        spread: 30,
        initialVelocity: 2,
        size: { min: 3, max: 8 },
        opacity: { start: 0.7, end: 0 },
        colorGradient: ['#888888', '#666666', '#444444', '#222222'],
        turbulence: 0.3,
        buoyancy: 0.2,
    },
    fire: {
        type: 'fire',
        emitterShape: 'line',
        emitterSize: 20,
        emissionRate: 15,
        lifetime: 40,
        gravity: -4,
        spread: 25,
        initialVelocity: 4,
        size: { min: 2, max: 6 },
        opacity: { start: 1, end: 0 },
        colorGradient: ['#FFFF00', '#FFA500', '#FF4500', '#FF0000', '#880000'],
        turbulence: 0.5,
        buoyancy: 0.8,
    },
    sparks: {
        type: 'sparks',
        emitterShape: 'point',
        emitterSize: 3,
        emissionRate: 20,
        lifetime: 25,
        gravity: 3,
        spread: 120,
        initialVelocity: 8,
        size: { min: 1, max: 2 },
        opacity: { start: 1, end: 0 },
        colorGradient: ['#FFFFFF', '#FFFF00', '#FFA500', '#FF4500'],
        turbulence: 0.2,
        buoyancy: 0,
    },
    magic: {
        type: 'magic',
        emitterShape: 'circle',
        emitterSize: 15,
        emissionRate: 12,
        lifetime: 50,
        gravity: -0.5,
        spread: 360,
        initialVelocity: 1.5,
        size: { min: 2, max: 5 },
        opacity: { start: 0.9, end: 0 },
        colorGradient: ['#FF00FF', '#8B00FF', '#00BFFF', '#00FFFF', '#FFFFFF'],
        turbulence: 0.6,
        buoyancy: 0.1,
    },
    custom: {
        type: 'custom',
        emitterShape: 'point',
        emitterSize: 10,
        emissionRate: 10,
        lifetime: 45,
        gravity: -2,
        spread: 45,
        initialVelocity: 3,
        size: { min: 2, max: 5 },
        opacity: { start: 1, end: 0 },
        colorGradient: ['#FFFFFF', '#AAAAAA', '#555555'],
        turbulence: 0.4,
        buoyancy: 0.3,
    },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
    } : { r: 255, g: 255, b: 255 };
}

/**
 * Interpolate between colors based on progress (0-1)
 */
function interpolateColor(colors: string[], progress: number): string {
    if (colors.length === 0) return '#FFFFFF';
    if (colors.length === 1) return colors[0];

    const clampedProgress = Math.max(0, Math.min(1, progress));
    const segment = clampedProgress * (colors.length - 1);
    const index = Math.floor(segment);
    const t = segment - index;

    if (index >= colors.length - 1) {
        return colors[colors.length - 1];
    }

    const c1 = hexToRgb(colors[index]);
    const c2 = hexToRgb(colors[index + 1]);

    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);

    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Random value between min and max
 */
function randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

/**
 * Simple noise function for turbulence
 */
function noise(x: number, y: number, seed: number): number {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
    return n - Math.floor(n);
}

// ============================================================================
// Main Hook
// ============================================================================

export function useFluidParticles() {
    const [config, setConfig] = useState<FluidConfig>(FLUID_PRESETS.smoke);
    const [isGenerating, setIsGenerating] = useState(false);
    const particlesRef = useRef<Particle[]>([]);
    const seedRef = useRef(Math.random() * 1000);

    /**
     * Update config
     */
    const updateConfig = useCallback((updates: Partial<FluidConfig>) => {
        setConfig(prev => ({ ...prev, ...updates }));
    }, []);

    /**
     * Apply a preset
     */
    const applyPreset = useCallback((preset: FluidType) => {
        setConfig(FLUID_PRESETS[preset]);
    }, []);

    /**
     * Emit new particles based on emitter shape
     */
    const emitParticles = useCallback((
        centerX: number,
        centerY: number,
        count: number,
        cfg: FluidConfig
    ): Particle[] => {
        const newParticles: Particle[] = [];

        for (let i = 0; i < count; i++) {
            let x = centerX;
            let y = centerY;

            // Position based on emitter shape
            switch (cfg.emitterShape) {
                case 'line':
                    x = centerX + randomRange(-cfg.emitterSize / 2, cfg.emitterSize / 2);
                    break;
                case 'circle':
                    const angle = Math.random() * Math.PI * 2;
                    const radius = Math.random() * cfg.emitterSize;
                    x = centerX + Math.cos(angle) * radius;
                    y = centerY + Math.sin(angle) * radius;
                    break;
                case 'point':
                default:
                    x = centerX + randomRange(-2, 2);
                    y = centerY + randomRange(-2, 2);
                    break;
            }

            // Velocity based on spread angle
            const spreadRad = (cfg.spread / 2) * (Math.PI / 180);
            const baseAngle = -Math.PI / 2; // Upward
            const particleAngle = baseAngle + randomRange(-spreadRad, spreadRad);
            const speed = cfg.initialVelocity * randomRange(0.7, 1.3);

            newParticles.push({
                x,
                y,
                vx: Math.cos(particleAngle) * speed,
                vy: Math.sin(particleAngle) * speed,
                size: randomRange(cfg.size.min, cfg.size.max),
                opacity: cfg.opacity.start,
                age: 0,
                lifetime: cfg.lifetime * randomRange(0.8, 1.2),
                color: cfg.colorGradient[0],
            });
        }

        return newParticles;
    }, []);

    /**
     * Update particle physics for one frame
     */
    const updateParticles = useCallback((
        particles: Particle[],
        cfg: FluidConfig,
        frameIndex: number
    ): Particle[] => {
        return particles
            .map(p => {
                const progress = p.age / p.lifetime;

                // Apply gravity
                p.vy += cfg.gravity * 0.1;

                // Apply buoyancy (opposes gravity based on "heat")
                const heatFactor = 1 - progress; // Hotter when younger
                p.vy -= cfg.buoyancy * heatFactor * 0.5;

                // Apply turbulence
                if (cfg.turbulence > 0) {
                    const noiseVal = noise(p.x * 0.1, p.y * 0.1 + frameIndex * 0.1, seedRef.current);
                    p.vx += (noiseVal - 0.5) * cfg.turbulence * 2;
                    p.vy += (noise(p.y * 0.1, p.x * 0.1, seedRef.current + 100) - 0.5) * cfg.turbulence;
                }

                // Apply velocity
                p.x += p.vx;
                p.y += p.vy;

                // Apply drag
                p.vx *= 0.98;
                p.vy *= 0.98;

                // Update age
                p.age++;

                // Update opacity
                p.opacity = cfg.opacity.start + (cfg.opacity.end - cfg.opacity.start) * progress;

                // Update color
                p.color = interpolateColor(cfg.colorGradient, progress);

                // Shrink over time
                p.size *= (1 - progress * 0.02);

                return p;
            })
            .filter(p => p.age < p.lifetime && p.opacity > 0.01);
    }, []);

    /**
     * Render particles to ImageData
     */
    const renderParticles = useCallback((
        particles: Particle[],
        width: number,
        height: number
    ): ImageData => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;

        // Clear with transparency
        ctx.clearRect(0, 0, width, height);

        // Draw particles
        for (const p of particles) {
            if (p.opacity <= 0) continue;

            ctx.globalAlpha = Math.max(0, Math.min(1, p.opacity));
            ctx.fillStyle = p.color;

            // Draw as pixel-perfect squares for pixel art style
            const size = Math.max(1, Math.round(p.size));
            const px = Math.round(p.x - size / 2);
            const py = Math.round(p.y - size / 2);

            ctx.fillRect(px, py, size, size);
        }

        ctx.globalAlpha = 1;
        return ctx.getImageData(0, 0, width, height);
    }, []);

    /**
     * Generate fluid animation frames
     */
    const generateFluidFrames = useCallback((
        width: number,
        height: number,
        emitterX: number,
        emitterY: number,
        duration: number,
        customConfig?: Partial<FluidConfig>
    ): ImageData[] => {
        const cfg = { ...config, ...customConfig };
        const frames: ImageData[] = [];
        let particles: Particle[] = [];

        // Reset seed for reproducibility within a generation
        seedRef.current = Math.random() * 1000;

        for (let frame = 0; frame < duration; frame++) {
            // Emit new particles (only during first half of animation)
            if (frame < duration * 0.6) {
                const newParticles = emitParticles(
                    emitterX,
                    emitterY,
                    Math.ceil(cfg.emissionRate * randomRange(0.8, 1.2)),
                    cfg
                );
                particles = [...particles, ...newParticles];
            }

            // Update physics
            particles = updateParticles(particles, cfg, frame);

            // Render frame
            const imageData = renderParticles(particles, width, height);
            frames.push(imageData);
        }

        return frames;
    }, [config, emitParticles, updateParticles, renderParticles]);

    /**
     * Generate and return animation frames
     */
    const generateAnimation = useCallback(async (
        width: number,
        height: number,
        duration: number = 30,
        emitterX?: number,
        emitterY?: number
    ): Promise<{
        frames: ImageData[];
        width: number;
        height: number;
    }> => {
        setIsGenerating(true);

        try {
            // Default emitter position is bottom-center
            const x = emitterX ?? width / 2;
            const y = emitterY ?? height * 0.8;

            const frames = generateFluidFrames(width, height, x, y, duration);

            return { frames, width, height };
        } finally {
            setIsGenerating(false);
        }
    }, [generateFluidFrames]);

    return {
        config,
        setConfig,
        updateConfig,
        applyPreset,
        isGenerating,
        generateAnimation,
        generateFluidFrames,
        PRESETS: FLUID_PRESETS,
    };
}

export default useFluidParticles;
