"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { FluidGridConfig, DEFAULT_FLUID_GRID_CONFIG } from "@/lib/pixelEditor/useFluidGrid";
import { Droplets, Loader2, Play, Pause, RotateCcw, Video, Flame, Wind, Sparkles, Layers, Target, MousePointer } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

type EffectPreset = 'fire' | 'smoke' | 'magic' | 'custom';
type BlendMode = 'normal' | 'add' | 'screen' | 'multiply';
type EmitterPosition = 'center' | 'bottom' | 'top' | 'custom';
type ApplyMode = 'new' | 'overlay' | 'background';

interface PresetConfig {
    colors: [number, number, number][];
    curlStrength: number;
    velocityDissipation: number;
    densityDissipation: number;
    splatRadius: number;
    emitterY: number;  // 0 = bottom, 1 = top
    forceY: number;    // negative = up
    // 5-point color gradient (outside to inside / cold to hot)
    colorRamp: [
        [number, number, number],
        [number, number, number],
        [number, number, number],
        [number, number, number],
        [number, number, number],
    ];
}

const PRESETS: Record<EffectPreset, PresetConfig> = {
    fire: {
        colors: [[1, 0.6, 0], [1, 0.3, 0], [1, 0.1, 0], [0.8, 0, 0]],
        curlStrength: 40,
        velocityDissipation: 0.97,
        densityDissipation: 0.95,
        splatRadius: 0.008,
        emitterY: 0.1,
        forceY: -0.03,
        // Fire: black → dark red → orange → yellow → white
        colorRamp: [
            [0.05, 0.0, 0.0],  // Dark (outside)
            [0.6, 0.1, 0.0],   // Dark red
            [1.0, 0.4, 0.0],   // Orange
            [1.0, 0.8, 0.2],   // Yellow
            [1.0, 1.0, 0.9],   // White-hot (center)
        ],
    },
    smoke: {
        colors: [[0.5, 0.5, 0.5], [0.4, 0.4, 0.4], [0.3, 0.3, 0.3]],
        curlStrength: 20,
        velocityDissipation: 0.99,
        densityDissipation: 0.98,
        splatRadius: 0.012,
        emitterY: 0.2,
        forceY: -0.02,
        // Smoke: transparent → light gray → medium gray → dark gray → near-black
        colorRamp: [
            [0.1, 0.1, 0.12],  // Nearly transparent/dark
            [0.25, 0.25, 0.28],// Dark gray
            [0.4, 0.4, 0.45],  // Medium gray
            [0.55, 0.55, 0.6], // Light gray
            [0.7, 0.7, 0.75],  // Lightest (center)
        ],
    },
    magic: {
        colors: [[1, 0, 1], [0.5, 0, 1], [0, 0.5, 1], [0, 1, 1], [1, 1, 1]],
        curlStrength: 50,
        velocityDissipation: 0.95,
        densityDissipation: 0.96,
        splatRadius: 0.006,
        emitterY: 0.5,
        forceY: -0.01,
        // Magic: dark purple → purple → cyan → light blue → white
        colorRamp: [
            [0.1, 0.0, 0.2],   // Dark purple (outside)
            [0.5, 0.0, 0.8],   // Purple
            [0.2, 0.4, 1.0],   // Blue
            [0.3, 0.8, 1.0],   // Cyan
            [1.0, 1.0, 1.0],   // White sparkle (center)
        ],
    },
    custom: {
        colors: [[1, 0.5, 0]],
        curlStrength: 30,
        velocityDissipation: 0.98,
        densityDissipation: 0.97,
        splatRadius: 0.005,
        emitterY: 0.5,
        forceY: -0.02,
        colorRamp: [
            [0.1, 0.0, 0.0],
            [0.8, 0.1, 0.0],
            [1.0, 0.5, 0.0],
            [1.0, 0.8, 0.2],
            [1.0, 1.0, 0.8],
        ],
    },
};

// ============================================================================
// Props
// ============================================================================

interface FluidGridControlsProps {
    config: FluidGridConfig;
    onConfigChange: (updates: Partial<FluidGridConfig>) => void;
    onInitialize: (canvas: HTMLCanvasElement) => boolean;
    onStep: (dt: number) => void;
    onRender: () => void;
    onSplat: (x: number, y: number, dx: number, dy: number, color: [number, number, number]) => void;
    onGenerate: (width: number, height: number, duration: number) => Promise<{ frames: ImageData[] }>;
    onDispose: () => void;
    isInitialized: boolean;
    isGenerating: boolean;
    targetWidth: number;
    targetHeight: number;
    // New props for existing frames support
    existingFrames?: ImageData[];
    onApplyToFrames?: (frames: ImageData[]) => void;
    // Callback that receives pixelated frames directly
    onGeneratePixelated?: (frames: ImageData[]) => void;
}

// ============================================================================
// Compositing Helpers
// ============================================================================

function compositeFrames(
    baseFrame: ImageData,
    overlayFrame: ImageData,
    blendMode: BlendMode,
    applyMode: ApplyMode
): ImageData {
    const width = baseFrame.width;
    const height = baseFrame.height;
    const result = new ImageData(width, height);

    // Scale overlay if sizes don't match
    let overlayData = overlayFrame.data;
    if (overlayFrame.width !== width || overlayFrame.height !== height) {
        overlayData = scaleImageData(overlayFrame, width, height).data;
    }

    for (let i = 0; i < result.data.length; i += 4) {
        const baseR = baseFrame.data[i] / 255;
        const baseG = baseFrame.data[i + 1] / 255;
        const baseB = baseFrame.data[i + 2] / 255;
        const baseA = baseFrame.data[i + 3] / 255;

        const overlayR = overlayData[i] / 255;
        const overlayG = overlayData[i + 1] / 255;
        const overlayB = overlayData[i + 2] / 255;
        const overlayA = overlayData[i + 3] / 255;

        let finalR: number, finalG: number, finalB: number, finalA: number;

        // Determine which is foreground/background based on apply mode
        const [fgR, fgG, fgB, fgA, bgR, bgG, bgB, bgA] = applyMode === 'background'
            ? [baseR, baseG, baseB, baseA, overlayR, overlayG, overlayB, overlayA]
            : [overlayR, overlayG, overlayB, overlayA, baseR, baseG, baseB, baseA];

        // Apply blend mode
        switch (blendMode) {
            case 'add':
                finalR = Math.min(1, bgR + fgR * fgA);
                finalG = Math.min(1, bgG + fgG * fgA);
                finalB = Math.min(1, bgB + fgB * fgA);
                finalA = Math.max(bgA, fgA);
                break;
            case 'screen':
                finalR = 1 - (1 - bgR) * (1 - fgR * fgA);
                finalG = 1 - (1 - bgG) * (1 - fgG * fgA);
                finalB = 1 - (1 - bgB) * (1 - fgB * fgA);
                finalA = Math.max(bgA, fgA);
                break;
            case 'multiply':
                finalR = bgR * (fgR * fgA + (1 - fgA));
                finalG = bgG * (fgG * fgA + (1 - fgA));
                finalB = bgB * (fgB * fgA + (1 - fgA));
                finalA = Math.max(bgA, fgA);
                break;
            case 'normal':
            default:
                // Standard alpha compositing
                finalA = fgA + bgA * (1 - fgA);
                if (finalA > 0) {
                    finalR = (fgR * fgA + bgR * bgA * (1 - fgA)) / finalA;
                    finalG = (fgG * fgA + bgG * bgA * (1 - fgA)) / finalA;
                    finalB = (fgB * fgA + bgB * bgA * (1 - fgA)) / finalA;
                } else {
                    finalR = finalG = finalB = 0;
                }
                break;
        }

        result.data[i] = Math.round(finalR * 255);
        result.data[i + 1] = Math.round(finalG * 255);
        result.data[i + 2] = Math.round(finalB * 255);
        result.data[i + 3] = Math.round(finalA * 255);
    }

    return result;
}

function scaleImageData(imageData: ImageData, newWidth: number, newHeight: number): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);

    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = newWidth;
    scaledCanvas.height = newHeight;
    const scaledCtx = scaledCanvas.getContext('2d')!;
    scaledCtx.drawImage(canvas, 0, 0, newWidth, newHeight);

    return scaledCtx.getImageData(0, 0, newWidth, newHeight);
}

/**
 * Pixelate image data for chunky pixel art look
 * Downscales then upscales with nearest-neighbor sampling
 * EXPORTED for use in parent components
 */
export function pixelateImageData(imageData: ImageData, pixelSize: number): ImageData {
    if (pixelSize <= 1) return imageData;

    const { width, height, data } = imageData;
    const result = new ImageData(width, height);

    // For each "block" of pixels
    for (let y = 0; y < height; y += pixelSize) {
        for (let x = 0; x < width; x += pixelSize) {
            // Sample from center of block
            const sampleX = Math.min(x + Math.floor(pixelSize / 2), width - 1);
            const sampleY = Math.min(y + Math.floor(pixelSize / 2), height - 1);
            const sampleIdx = (sampleY * width + sampleX) * 4;

            // Get color with quantization for more pixel-art feel
            let r = data[sampleIdx];
            let g = data[sampleIdx + 1];
            let b = data[sampleIdx + 2];
            let a = data[sampleIdx + 3];

            // Quantize colors to reduce gradients (8 levels per channel)
            const levels = 8;
            r = Math.round(r / (256 / levels)) * (256 / levels);
            g = Math.round(g / (256 / levels)) * (256 / levels);
            b = Math.round(b / (256 / levels)) * (256 / levels);

            // Threshold alpha for hard edges
            a = a > 32 ? a : 0;

            // Fill the entire block with this color
            for (let py = y; py < Math.min(y + pixelSize, height); py++) {
                for (let px = x; px < Math.min(x + pixelSize, width); px++) {
                    const idx = (py * width + px) * 4;
                    result.data[idx] = r;
                    result.data[idx + 1] = g;
                    result.data[idx + 2] = b;
                    result.data[idx + 3] = a;
                }
            }
        }
    }

    return result;
}

// ============================================================================
// Component
// ============================================================================

export function FluidGridControls({
    config,
    onConfigChange,
    onInitialize,
    onStep,
    onRender,
    onSplat,
    onGenerate,
    onDispose,
    isInitialized,
    isGenerating,
    targetWidth,
    targetHeight,
    existingFrames = [],
    onApplyToFrames,
    onGeneratePixelated,
}: FluidGridControlsProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(30);
    const [preset, setPreset] = useState<EffectPreset>('fire');
    const [blendMode, setBlendMode] = useState<BlendMode>('add');
    const [applyMode, setApplyMode] = useState<ApplyMode>('overlay');
    const [emitterPosition, setEmitterPosition] = useState<EmitterPosition>('bottom');
    const [customEmitterPos, setCustomEmitterPos] = useState({ x: 0.5, y: 0.2 });
    const [isApplying, setIsApplying] = useState(false);
    const [pixelSize, setPixelSize] = useState(4); // Pixel art chunky size

    const lastMouseRef = useRef<{ x: number; y: number } | null>(null);
    const animationRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);

    // Get current preset config
    const presetConfig = PRESETS[preset];

    // Initialize simulation when component mounts
    useEffect(() => {
        if (canvasRef.current && !isInitialized) {
            const success = onInitialize(canvasRef.current);
            if (success) {
                // Apply preset settings
                onConfigChange({
                    curlStrength: presetConfig.curlStrength,
                    velocityDissipation: presetConfig.velocityDissipation,
                    densityDissipation: presetConfig.densityDissipation,
                    splatRadius: presetConfig.splatRadius,
                });
                // Add initial splat with preset
                setTimeout(() => {
                    const emitY = getEmitterY();
                    const color = presetConfig.colors[0];
                    onSplat(0.5, emitY, 0, presetConfig.forceY, color);
                    onStep(0.016);
                    onRender();
                }, 100);
            }
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isInitialized]);

    // Get emitter Y position based on setting
    const getEmitterY = useCallback(() => {
        switch (emitterPosition) {
            case 'bottom': return 0.15;
            case 'top': return 0.85;
            case 'center': return 0.5;
            case 'custom': return customEmitterPos.y;
            default: return presetConfig.emitterY;
        }
    }, [emitterPosition, customEmitterPos, presetConfig]);

    // Animation loop with auto-splats
    useEffect(() => {
        if (!isPlaying || !isInitialized) return;

        let frameCount = 0;
        const animate = (time: number) => {
            const dt = Math.min((time - lastTimeRef.current) / 1000, 0.016);
            lastTimeRef.current = time;

            // Auto-splat based on preset
            if (frameCount % 3 === 0) {
                const emitY = getEmitterY();
                const x = 0.4 + Math.random() * 0.2;
                const colorIndex = Math.floor(Math.random() * presetConfig.colors.length);
                const color = presetConfig.colors[colorIndex];
                const dx = (Math.random() - 0.5) * 0.01;
                onSplat(x, emitY, dx, presetConfig.forceY, color);
            }

            onStep(dt);
            onRender();
            frameCount++;

            animationRef.current = requestAnimationFrame(animate);
        };

        lastTimeRef.current = performance.now();
        animationRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isPlaying, isInitialized, onStep, onRender, onSplat, presetConfig, getEmitterY]);

    // Mouse interaction
    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isInitialized || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = 1.0 - (e.clientY - rect.top) / rect.height;

        if (lastMouseRef.current && (e.buttons === 1)) {
            const dx = (x - lastMouseRef.current.x) * 0.5;
            const dy = (y - lastMouseRef.current.y) * 0.5;
            const colorIndex = Math.floor(Math.random() * presetConfig.colors.length);
            const color = presetConfig.colors[colorIndex];
            onSplat(x, y, dx, dy, color);
        }

        lastMouseRef.current = { x, y };
    }, [isInitialized, onSplat, presetConfig]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isInitialized || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = 1.0 - (e.clientY - rect.top) / rect.height;

        lastMouseRef.current = { x, y };
        const colorIndex = Math.floor(Math.random() * presetConfig.colors.length);
        const color = presetConfig.colors[colorIndex];
        onSplat(x, y, 0, presetConfig.forceY, color);
    }, [isInitialized, onSplat, presetConfig]);

    const handleMouseUp = useCallback(() => {
        lastMouseRef.current = null;
    }, []);

    // Apply preset - also resets simulation to clear old colors
    const applyPreset = useCallback((newPreset: EffectPreset) => {
        setPreset(newPreset);
        const config = PRESETS[newPreset];
        onConfigChange({
            curlStrength: config.curlStrength,
            velocityDissipation: config.velocityDissipation,
            densityDissipation: config.densityDissipation,
            splatRadius: config.splatRadius,
            colorRamp: config.colorRamp,
            useColorRamp: true,  // Always use color ramp for polished look
            alphaThreshold: 0.05,
        });

        // Reset simulation to clear old colors when changing preset
        setIsPlaying(false);
        onDispose();
        if (canvasRef.current) {
            setTimeout(() => {
                onInitialize(canvasRef.current!);
                // Add initial splat with new preset colors
                const emitY = newPreset === 'fire' ? 0.15 : newPreset === 'smoke' ? 0.2 : 0.5;
                const color = config.colors[0];
                onSplat(0.5, emitY, 0, config.forceY, color);
                onStep(0.016);
                onRender();
            }, 50);
        }
    }, [onConfigChange, onDispose, onInitialize, onSplat, onStep, onRender]);

    // Reset simulation
    const handleReset = useCallback(() => {
        setIsPlaying(false);
        onDispose();
        if (canvasRef.current) {
            onInitialize(canvasRef.current);
        }
    }, [onDispose, onInitialize]);

    // Generate new frames with pixelation
    const handleGenerate = useCallback(async () => {
        if (!isInitialized) return;
        setIsPlaying(false);

        // Generate raw frames from WebGL simulation
        const result = await onGenerate(targetWidth, targetHeight, duration);

        // Apply pixelation to each frame for chunky pixel art look
        if (onGeneratePixelated && result.frames.length > 0) {
            const pixelatedFrames = result.frames.map(frame =>
                pixelateImageData(frame, pixelSize)
            );
            onGeneratePixelated(pixelatedFrames);
        }

    }, [isInitialized, onGenerate, targetWidth, targetHeight, duration, pixelSize, onGeneratePixelated]);

    // Apply to existing frames with compositing
    const handleApplyToExisting = useCallback(async () => {
        if (!isInitialized || !onApplyToFrames || existingFrames.length === 0) return;

        setIsApplying(true);
        setIsPlaying(false);

        try {
            // Generate fluid frames matching existing frame count
            const result = await onGenerate(targetWidth, targetHeight, existingFrames.length);

            // Composite each fluid frame onto existing frame with pixelation
            const compositedFrames = existingFrames.map((existingFrame, i) => {
                let fluidFrame = result.frames[i] || result.frames[result.frames.length - 1];
                // Apply pixelation for chunky pixel art look
                fluidFrame = pixelateImageData(fluidFrame, pixelSize);
                return compositeFrames(existingFrame, fluidFrame, blendMode, applyMode);
            });

            onApplyToFrames(compositedFrames);
        } finally {
            setIsApplying(false);
        }
    }, [isInitialized, onApplyToFrames, existingFrames, onGenerate, targetWidth, targetHeight, blendMode, applyMode, pixelSize]);

    const hasExistingFrames = existingFrames.length > 0;

    return (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <Droplets className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-white">Grid Fluids (WebGL)</h3>
            </div>

            {/* Effect Presets */}
            <div className="grid grid-cols-4 gap-1 mb-4">
                <button
                    onClick={() => applyPreset('fire')}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${preset === 'fire' ? 'bg-orange-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                >
                    <Flame className="w-4 h-4" />
                    <span className="text-xs">Fire</span>
                </button>
                <button
                    onClick={() => applyPreset('smoke')}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${preset === 'smoke' ? 'bg-gray-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                >
                    <Wind className="w-4 h-4" />
                    <span className="text-xs">Smoke</span>
                </button>
                <button
                    onClick={() => applyPreset('magic')}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${preset === 'magic' ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                >
                    <Sparkles className="w-4 h-4" />
                    <span className="text-xs">Magic</span>
                </button>
                <button
                    onClick={() => applyPreset('custom')}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${preset === 'custom' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                >
                    <Droplets className="w-4 h-4" />
                    <span className="text-xs">Custom</span>
                </button>
            </div>

            {/* Preview Canvas */}
            <div className="mb-3 rounded-lg overflow-hidden border border-zinc-700 bg-black">
                <canvas
                    ref={canvasRef}
                    width={256}
                    height={256}
                    className="w-full aspect-square cursor-crosshair"
                    onMouseMove={handleMouseMove}
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                />
            </div>

            {/* Playback Controls */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    disabled={!isInitialized}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium text-sm transition-colors ${isPlaying ? 'bg-orange-600 hover:bg-orange-500' : 'bg-green-600 hover:bg-green-500'
                        } text-white disabled:bg-zinc-700 disabled:text-zinc-500`}
                >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                    onClick={handleReset}
                    className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg"
                    title="Reset"
                >
                    <RotateCcw className="w-4 h-4" />
                </button>
            </div>

            {/* Apply Mode & Blend Mode (only if existing frames) */}
            {hasExistingFrames && (
                <div className="space-y-3 mb-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                    <div className="flex items-center gap-2 text-xs text-green-400 mb-2">
                        <Layers className="w-3 h-3" />
                        {existingFrames.length} existing frames detected
                    </div>

                    <div className="flex items-center justify-between">
                        <label className="text-xs text-zinc-300">Apply Mode</label>
                        <select
                            value={applyMode}
                            onChange={(e) => setApplyMode(e.target.value as ApplyMode)}
                            className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300"
                        >
                            <option value="overlay">Overlay (on top)</option>
                            <option value="background">Background (behind)</option>
                            <option value="new">New frames only</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-between">
                        <label className="text-xs text-zinc-300">Blend Mode</label>
                        <select
                            value={blendMode}
                            onChange={(e) => setBlendMode(e.target.value as BlendMode)}
                            className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300"
                        >
                            <option value="add">Add (glow)</option>
                            <option value="screen">Screen</option>
                            <option value="normal">Normal</option>
                            <option value="multiply">Multiply</option>
                        </select>
                    </div>

                    {/* Pixel Size for chunky look */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <label className="text-xs text-zinc-300">🎮 Pixel Size</label>
                            <span className="text-xs text-purple-400 font-mono">{pixelSize}px</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="8"
                            value={pixelSize}
                            onChange={(e) => setPixelSize(Number(e.target.value))}
                            className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                        <p className="text-[10px] text-zinc-600">Higher = chunkier pixel art look</p>
                    </div>
                </div>
            )}

            {/* Emitter Position */}
            <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-1 text-xs text-zinc-300">
                    <Target className="w-3 h-3" />
                    Emitter
                </label>
                <select
                    value={emitterPosition}
                    onChange={(e) => setEmitterPosition(e.target.value as EmitterPosition)}
                    className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300"
                >
                    <option value="bottom">Bottom</option>
                    <option value="center">Center</option>
                    <option value="top">Top</option>
                </select>
            </div>

            {/* Duration */}
            <div className="space-y-1 mb-4">
                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1 text-xs text-zinc-300">
                        <Video className="w-3 h-3" />
                        Frames
                    </label>
                    <span className="text-xs text-purple-400 font-mono">{duration}</span>
                </div>
                <input
                    type="range"
                    min="10"
                    max="60"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
                {hasExistingFrames && applyMode !== 'new' && (
                    <button
                        onClick={handleApplyToExisting}
                        disabled={!isInitialized || isApplying}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors"
                    >
                        {isApplying ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Applying...
                            </>
                        ) : (
                            <>
                                <Layers className="w-4 h-4" />
                                Apply to {existingFrames.length} Frames
                            </>
                        )}
                    </button>
                )}

                <button
                    onClick={handleGenerate}
                    disabled={!isInitialized || isGenerating}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Recording...
                        </>
                    ) : (
                        <>
                            <Video className="w-4 h-4" />
                            Generate {duration} New Frames
                        </>
                    )}
                </button>
            </div>

            <p className="text-xs text-zinc-600 mt-2 text-center">
                {hasExistingFrames
                    ? "Apply to composite fluid onto your animation"
                    : "Click & drag to paint, then generate frames"
                }
            </p>
        </div>
    );
}

export default FluidGridControls;
