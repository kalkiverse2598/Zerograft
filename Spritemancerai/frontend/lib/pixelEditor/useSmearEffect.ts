/**
 * Smear Effect Hook
 * Generates motion blur / smearing between animation frames
 * 
 * Inspired by SpriteMancer's smearing feature:
 * - Detects pixel movement between frames
 * - Stretches pixels along their motion path
 * - Creates smooth motion trails for fast-moving objects
 */

import { useState, useCallback, useRef } from 'react';

export interface SmearConfig {
    enabled: boolean;
    precision: number;      // Interpolation steps (1-10), higher = smoother trails
    trailLength: number;    // Trail opacity falloff (1-5), higher = longer trails
    mode: 'velocity' | 'acceleration'; // Smear calculation mode
    opacity: number;        // Base opacity of smear (0.1-1.0)
    blendMode: 'normal' | 'additive'; // How smear blends with frame
}

interface PixelMotion {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    color: [number, number, number, number]; // RGBA
}

const DEFAULT_CONFIG: SmearConfig = {
    enabled: false,
    precision: 5,
    trailLength: 3,
    mode: 'velocity',
    opacity: 0.7,
    blendMode: 'normal',
};

/**
 * Detect motion between two frames by comparing pixel positions
 * Returns array of pixels that moved between frames
 */
function detectMotion(
    prevImageData: ImageData,
    currImageData: ImageData,
    threshold: number = 10
): PixelMotion[] {
    const motions: PixelMotion[] = [];
    const width = currImageData.width;
    const height = currImageData.height;
    const prevData = prevImageData.data;
    const currData = currImageData.data;

    // For each non-transparent pixel in current frame,
    // find the closest matching pixel in previous frame
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const currIdx = (y * width + x) * 4;
            const currA = currData[currIdx + 3];

            // Skip transparent pixels
            if (currA < 10) continue;

            const currR = currData[currIdx];
            const currG = currData[currIdx + 1];
            const currB = currData[currIdx + 2];

            // Check if this pixel existed in previous frame at same position
            const prevIdx = currIdx;
            const prevA = prevData[prevIdx + 3];

            if (prevA >= 10) {
                // Pixel exists in both frames at same position - no motion
                const prevR = prevData[prevIdx];
                const prevG = prevData[prevIdx + 1];
                const prevB = prevData[prevIdx + 2];

                const colorDiff = Math.abs(currR - prevR) + Math.abs(currG - prevG) + Math.abs(currB - prevB);
                if (colorDiff < threshold) continue; // Same pixel, no motion
            }

            // Search for this pixel's origin in previous frame (limited search radius)
            const searchRadius = 8;
            let bestMatch = { x: -1, y: -1, diff: Infinity };

            for (let sy = Math.max(0, y - searchRadius); sy < Math.min(height, y + searchRadius); sy++) {
                for (let sx = Math.max(0, x - searchRadius); sx < Math.min(width, x + searchRadius); sx++) {
                    if (sx === x && sy === y) continue;

                    const sIdx = (sy * width + sx) * 4;
                    const sA = prevData[sIdx + 3];
                    if (sA < 10) continue;

                    const sR = prevData[sIdx];
                    const sG = prevData[sIdx + 1];
                    const sB = prevData[sIdx + 2];

                    const colorDiff = Math.abs(currR - sR) + Math.abs(currG - sG) + Math.abs(currB - sB);
                    const dist = Math.sqrt((x - sx) ** 2 + (y - sy) ** 2);

                    // Weight by color similarity and distance
                    const score = colorDiff + dist * 5;

                    if (score < bestMatch.diff && colorDiff < threshold * 3) {
                        bestMatch = { x: sx, y: sy, diff: score };
                    }
                }
            }

            // If we found a likely origin, record the motion
            if (bestMatch.x >= 0 && bestMatch.diff < threshold * 10) {
                motions.push({
                    fromX: bestMatch.x,
                    fromY: bestMatch.y,
                    toX: x,
                    toY: y,
                    color: [currR, currG, currB, currA],
                });
            }
        }
    }

    return motions;
}

/**
 * Generate smear effect between two frames
 */
function generateSmear(
    prevImageData: ImageData,
    currImageData: ImageData,
    config: SmearConfig
): ImageData {
    const width = currImageData.width;
    const height = currImageData.height;

    // Create output canvas with current frame as base
    const output = new ImageData(
        new Uint8ClampedArray(currImageData.data),
        width,
        height
    );

    // Detect pixel motions
    const motions = detectMotion(prevImageData, currImageData);

    if (motions.length === 0) {
        return output; // No motion detected, return current frame
    }

    // Draw smear trails for each motion
    for (const motion of motions) {
        const dx = motion.toX - motion.fromX;
        const dy = motion.toY - motion.fromY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 1) continue;

        // Interpolate along the motion path
        const steps = Math.min(config.precision, Math.ceil(distance));

        for (let step = 0; step < steps; step++) {
            const t = step / steps;
            const x = Math.round(motion.fromX + dx * t);
            const y = Math.round(motion.fromY + dy * t);

            if (x < 0 || x >= width || y < 0 || y >= height) continue;

            const idx = (y * width + x) * 4;

            // Calculate opacity falloff based on position in trail
            const falloff = 1 - (t * (1 / config.trailLength));
            const alpha = Math.max(0, motion.color[3] * config.opacity * falloff);

            // Blend smear with existing pixel
            if (config.blendMode === 'additive') {
                output.data[idx] = Math.min(255, output.data[idx] + motion.color[0] * (alpha / 255));
                output.data[idx + 1] = Math.min(255, output.data[idx + 1] + motion.color[1] * (alpha / 255));
                output.data[idx + 2] = Math.min(255, output.data[idx + 2] + motion.color[2] * (alpha / 255));
                output.data[idx + 3] = Math.min(255, output.data[idx + 3] + alpha);
            } else {
                // Normal blend
                const existingAlpha = output.data[idx + 3];
                const blendAlpha = alpha / 255;

                if (existingAlpha < alpha) {
                    output.data[idx] = motion.color[0];
                    output.data[idx + 1] = motion.color[1];
                    output.data[idx + 2] = motion.color[2];
                    output.data[idx + 3] = Math.max(existingAlpha, alpha);
                }
            }
        }
    }

    return output;
}

/**
 * Hook for smear/motion blur effects
 */
export function useSmearEffect() {
    const [config, setConfig] = useState<SmearConfig>(DEFAULT_CONFIG);
    const prevFrameRef = useRef<ImageData | null>(null);

    /**
     * Update smear configuration
     */
    const updateConfig = useCallback((updates: Partial<SmearConfig>) => {
        setConfig(prev => ({ ...prev, ...updates }));
    }, []);

    /**
     * Apply smear effect to a frame
     * Call this when advancing to a new frame during playback
     */
    const applySmear = useCallback((
        currentFrameData: ImageData,
        previousFrameData?: ImageData
    ): ImageData => {
        if (!config.enabled) {
            return currentFrameData;
        }

        const prevData = previousFrameData || prevFrameRef.current;

        if (!prevData) {
            // No previous frame to compare against
            prevFrameRef.current = new ImageData(
                new Uint8ClampedArray(currentFrameData.data),
                currentFrameData.width,
                currentFrameData.height
            );
            return currentFrameData;
        }

        // Generate smeared frame
        const result = generateSmear(prevData, currentFrameData, config);

        // Store current frame for next comparison
        prevFrameRef.current = new ImageData(
            new Uint8ClampedArray(currentFrameData.data),
            currentFrameData.width,
            currentFrameData.height
        );

        return result;
    }, [config]);

    /**
     * Reset the previous frame reference
     * Call this when stopping playback or changing animations
     */
    const resetSmear = useCallback(() => {
        prevFrameRef.current = null;
    }, []);

    /**
     * Generate smear frames for entire animation
     * Returns array of smeared ImageData for each frame
     */
    const generateSmearAnimation = useCallback((
        frames: ImageData[]
    ): ImageData[] => {
        if (!config.enabled || frames.length < 2) {
            return frames;
        }

        const results: ImageData[] = [frames[0]]; // First frame unchanged

        for (let i = 1; i < frames.length; i++) {
            const smeared = generateSmear(frames[i - 1], frames[i], config);
            results.push(smeared);
        }

        return results;
    }, [config]);

    return {
        config,
        updateConfig,
        setConfig,
        applySmear,
        resetSmear,
        generateSmearAnimation,
    };
}

export default useSmearEffect;
