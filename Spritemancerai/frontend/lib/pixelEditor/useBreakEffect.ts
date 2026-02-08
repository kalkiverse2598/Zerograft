/**
 * Break Effect Hook
 * Slices sprites into pieces and animates them flying apart
 * 
 * Inspired by SpriteMancer's "Break" (Thanos) effect:
 * - Divides image into a grid of pieces
 * - Applies physics simulation to each piece
 * - Generates animation frames of the dispersion
 */

import { useState, useCallback } from 'react';

export interface BreakConfig {
    gridX: number;          // Horizontal slices (2-16)
    gridY: number;          // Vertical slices (2-16)
    gravity: number;        // Downward force (0-10)
    rotationSpeed: number;  // Piece rotation speed (0-360)
    velocity: number;       // Initial outward velocity (1-20)
    duration: number;       // Animation frames to generate (5-30)
    fadeOut: boolean;       // Pieces fade out over time
    randomness: number;     // Variation in physics (0-1)
}

interface Piece {
    // Source region
    srcX: number;
    srcY: number;
    width: number;
    height: number;
    imageData: ImageData;

    // Physics state
    x: number;
    y: number;
    vx: number;
    vy: number;
    rotation: number;
    rotationVelocity: number;
    opacity: number;
}

const DEFAULT_CONFIG: BreakConfig = {
    gridX: 4,
    gridY: 4,
    gravity: 5,
    rotationSpeed: 180,
    velocity: 8,
    duration: 15,
    fadeOut: true,
    randomness: 0.5,
};

/**
 * Slice an image into grid pieces
 */
function sliceIntoPieces(
    sourceData: ImageData,
    gridX: number,
    gridY: number
): Piece[] {
    const pieces: Piece[] = [];
    const srcWidth = sourceData.width;
    const srcHeight = sourceData.height;
    const pieceWidth = Math.floor(srcWidth / gridX);
    const pieceHeight = Math.floor(srcHeight / gridY);

    for (let gy = 0; gy < gridY; gy++) {
        for (let gx = 0; gx < gridX; gx++) {
            const srcX = gx * pieceWidth;
            const srcY = gy * pieceHeight;

            // Handle edge pieces that may be slightly larger
            const actualWidth = gx === gridX - 1 ? srcWidth - srcX : pieceWidth;
            const actualHeight = gy === gridY - 1 ? srcHeight - srcY : pieceHeight;

            // Extract piece image data
            const pieceData = new ImageData(actualWidth, actualHeight);
            let hasContent = false;

            for (let py = 0; py < actualHeight; py++) {
                for (let px = 0; px < actualWidth; px++) {
                    const srcIdx = ((srcY + py) * srcWidth + (srcX + px)) * 4;
                    const dstIdx = (py * actualWidth + px) * 4;

                    pieceData.data[dstIdx] = sourceData.data[srcIdx];
                    pieceData.data[dstIdx + 1] = sourceData.data[srcIdx + 1];
                    pieceData.data[dstIdx + 2] = sourceData.data[srcIdx + 2];
                    pieceData.data[dstIdx + 3] = sourceData.data[srcIdx + 3];

                    if (sourceData.data[srcIdx + 3] > 10) {
                        hasContent = true;
                    }
                }
            }

            // Only add pieces that have visible content
            if (hasContent) {
                pieces.push({
                    srcX,
                    srcY,
                    width: actualWidth,
                    height: actualHeight,
                    imageData: pieceData,
                    x: srcX,
                    y: srcY,
                    vx: 0,
                    vy: 0,
                    rotation: 0,
                    rotationVelocity: 0,
                    opacity: 1,
                });
            }
        }
    }

    return pieces;
}

/**
 * Initialize piece velocities based on their position (radial outward)
 */
function initializePiecePhysics(
    pieces: Piece[],
    sourceWidth: number,
    sourceHeight: number,
    config: BreakConfig
): void {
    const centerX = sourceWidth / 2;
    const centerY = sourceHeight / 2;

    for (const piece of pieces) {
        const pieceCenterX = piece.x + piece.width / 2;
        const pieceCenterY = piece.y + piece.height / 2;

        // Direction from center
        const dx = pieceCenterX - centerX;
        const dy = pieceCenterY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        // Normalize and apply velocity
        const normalizedDx = dx / dist;
        const normalizedDy = dy / dist;

        // Add randomness
        const randomFactor = 1 + (Math.random() - 0.5) * config.randomness;

        piece.vx = normalizedDx * config.velocity * randomFactor;
        piece.vy = normalizedDy * config.velocity * randomFactor - 2; // Slight upward bias

        // Random rotation
        piece.rotationVelocity = (Math.random() - 0.5) * config.rotationSpeed * 2;
    }
}

/**
 * Simulate one step of physics for all pieces
 */
function simulateStep(
    pieces: Piece[],
    config: BreakConfig,
    frameIndex: number,
    totalFrames: number
): void {
    for (const piece of pieces) {
        // Apply gravity
        piece.vy += config.gravity * 0.1;

        // Apply velocity
        piece.x += piece.vx;
        piece.y += piece.vy;

        // Apply rotation
        piece.rotation += piece.rotationVelocity * 0.02;

        // Apply drag (air resistance)
        piece.vx *= 0.98;
        piece.vy *= 0.98;
        piece.rotationVelocity *= 0.95;

        // Fade out over time
        if (config.fadeOut) {
            piece.opacity = 1 - (frameIndex / totalFrames);
        }
    }
}

/**
 * Render all pieces to a canvas at their current positions
 */
function renderPieces(
    pieces: Piece[],
    width: number,
    height: number
): ImageData {
    // Create off-screen canvas for rotation support
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Clear with transparency
    ctx.clearRect(0, 0, width, height);

    for (const piece of pieces) {
        if (piece.opacity <= 0) continue;

        // Create temporary canvas for piece
        const pieceCanvas = document.createElement('canvas');
        pieceCanvas.width = piece.width;
        pieceCanvas.height = piece.height;
        const pieceCtx = pieceCanvas.getContext('2d')!;
        pieceCtx.putImageData(piece.imageData, 0, 0);

        // Save context state
        ctx.save();

        // Apply transformations
        ctx.globalAlpha = piece.opacity;
        ctx.translate(piece.x + piece.width / 2, piece.y + piece.height / 2);
        ctx.rotate(piece.rotation);
        ctx.translate(-piece.width / 2, -piece.height / 2);

        // Draw piece
        ctx.drawImage(pieceCanvas, 0, 0);

        // Restore context state
        ctx.restore();
    }

    return ctx.getImageData(0, 0, width, height);
}

/**
 * Hook for break/dissolve effects
 */
export function useBreakEffect() {
    const [config, setConfig] = useState<BreakConfig>(DEFAULT_CONFIG);
    const [isGenerating, setIsGenerating] = useState(false);

    /**
     * Update break configuration
     */
    const updateConfig = useCallback((updates: Partial<BreakConfig>) => {
        setConfig(prev => ({ ...prev, ...updates }));
    }, []);

    /**
     * Generate break animation frames from source image
     * Returns array of ImageData representing each frame of the animation
     */
    const generateBreakFrames = useCallback((
        sourceData: ImageData,
        customConfig?: Partial<BreakConfig>
    ): ImageData[] => {
        const finalConfig = { ...config, ...customConfig };
        const frames: ImageData[] = [];

        // First frame is the original
        frames.push(sourceData);

        // Slice into pieces
        const pieces = sliceIntoPieces(
            sourceData,
            finalConfig.gridX,
            finalConfig.gridY
        );

        // Initialize physics
        initializePiecePhysics(
            pieces,
            sourceData.width,
            sourceData.height,
            finalConfig
        );

        // Generate each frame
        for (let i = 1; i < finalConfig.duration; i++) {
            // Simulate physics step
            simulateStep(pieces, finalConfig, i, finalConfig.duration);

            // Render current state
            const frame = renderPieces(pieces, sourceData.width, sourceData.height);
            frames.push(frame);
        }

        return frames;
    }, [config]);

    /**
     * Generate break effect and return as animation-ready format
     */
    const generateBreakAnimation = useCallback(async (
        sourceCanvas: HTMLCanvasElement,
        customConfig?: Partial<BreakConfig>
    ): Promise<{
        frames: ImageData[];
        width: number;
        height: number;
    }> => {
        setIsGenerating(true);

        try {
            const ctx = sourceCanvas.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');

            const sourceData = ctx.getImageData(
                0, 0,
                sourceCanvas.width,
                sourceCanvas.height
            );

            const frames = generateBreakFrames(sourceData, customConfig);

            return {
                frames,
                width: sourceCanvas.width,
                height: sourceCanvas.height,
            };
        } finally {
            setIsGenerating(false);
        }
    }, [generateBreakFrames]);

    return {
        config,
        updateConfig,
        setConfig,
        isGenerating,
        generateBreakFrames,
        generateBreakAnimation,
    };
}

export default useBreakEffect;
