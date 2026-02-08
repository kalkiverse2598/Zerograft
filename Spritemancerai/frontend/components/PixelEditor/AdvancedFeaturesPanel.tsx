"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import {
    Sparkles,
    Grid3X3,
    Wand2,
    Sun,
    Moon,
    Palette,
    Rainbow,
    Pipette,
    RotateCw,
    FlipHorizontal,
    FlipVertical,
    Move,
    Maximize2,
    RefreshCw,
    Shuffle,
    Layers,
    Copy,
    Scissors,
    ZoomIn,
    ChevronDown,
    ChevronRight,
    Check,
    X,
    SunMedium,
    Contrast,
    Droplets,
    Focus,
    Sliders,
} from 'lucide-react';

// Category types
export type FeatureCategory = 'drawing-color' | 'tiling-patterns' | 'transform' | 'effects' | 'selection' | null;

// Props for the panel
interface AdvancedFeaturesPanelProps {
    category: FeatureCategory;
    onClose: () => void;
    // Drawing & Color props
    pixelPerfectEnabled: boolean;
    setPixelPerfectEnabled: (enabled: boolean) => void;
    shadingModeEnabled: boolean;
    setShadingModeEnabled: (enabled: boolean) => void;
    shadeSteps: number;
    setShadeSteps: (steps: number) => void;
    // Color props
    color: string;
    setColor: (color: string) => void;
    palette: string[];
    setPalette: (palette: string[]) => void;
    // Canvas ref for palette extraction
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    // Hooks
    colorRamp: {
        generateRamp: (start: string, end: string, steps: number) => string[];
        generateMonoRamp: (base: string, steps: number) => string[];
        generateHueRamp: (startHue: number, steps: number, sat: number, light: number) => string[];
    };
    colorHarmony: {
        getComplementary: (color: string) => string[];
        getAnalogous: (color: string) => string[];
        getTriadic: (color: string) => string[];
        getSplitComplementary: (color: string) => string[];
        getTetradic: (color: string) => string[];
        getMonochromatic: (color: string, steps: number) => string[];
        generatePixelArtPalette: (color: string) => string[];
    };
    paletteExtraction: {
        extractFromCanvas: (canvas: HTMLCanvasElement, size: number) => string[];
        extractUniqueColors: (canvas: HTMLCanvasElement, max: number) => string[];
        sortByHue: (palette: string[]) => string[];
        sortByLuminance: (palette: string[]) => string[];
    };
    // Tiling & Patterns hooks
    tilePreview: {
        generateTilePreview: (source: HTMLCanvasElement, target: HTMLCanvasElement, options?: { gridSize?: number }) => void;
        checkSeamless: (canvas: HTMLCanvasElement) => { horizontal: boolean; vertical: boolean; score: number };
        gridSize: 2 | 3 | 4;
        setGridSize: (size: 2 | 3 | 4) => void;
    };
    seamlessTile: {
        makeSeamless: (source: HTMLCanvasElement, target?: HTMLCanvasElement) => HTMLCanvasElement;
        createMirrorTile: (source: HTMLCanvasElement) => HTMLCanvasElement;
        createOffsetTile: (source: HTMLCanvasElement, offsetX?: number, offsetY?: number) => HTMLCanvasElement;
    };
    // Transform hooks
    outlineGenerator: {
        generateOutline: (source: HTMLCanvasElement, options?: { color?: string; style?: 'outer' | 'inner' | 'both' }) => HTMLCanvasElement;
        generateDropShadow: (source: HTMLCanvasElement, offsetX?: number, offsetY?: number, color?: string) => HTMLCanvasElement;
        removeOutline: (source: HTMLCanvasElement, options?: { thickness?: number; preserveCorners?: boolean }) => HTMLCanvasElement;
        removeOutlineByColor: (source: HTMLCanvasElement, targetColor?: string, tolerance?: number) => HTMLCanvasElement;
        getOutlineColors: (source: HTMLCanvasElement) => { color: string; count: number }[];
        recolorOutline: (source: HTMLCanvasElement, newColor: string, options?: { targetColor?: string; tolerance?: number }) => HTMLCanvasElement;
        createOutlineSelectionMask: (source: HTMLCanvasElement, highlightColor?: string) => HTMLCanvasElement;
    };
    pixelScaling: {
        scale: (source: HTMLCanvasElement, algorithm: 'nearest' | 'scale2x' | 'scale3x' | 'epx', factor?: number) => HTMLCanvasElement;
        scaleNearest: (source: HTMLCanvasElement, scale: number) => HTMLCanvasElement;
        scale2x: (source: HTMLCanvasElement) => HTMLCanvasElement;
        scale3x: (source: HTMLCanvasElement) => HTMLCanvasElement;
    };
    // Callbacks for applying changes
    onApplyToCanvas: (canvas: HTMLCanvasElement) => void;
    // Preview callbacks for real-time effects
    onPreviewEffect: (canvas: HTMLCanvasElement) => void;
    onCancelPreview: () => void;
    onStartPreview: () => void;
    // Advanced Transform hooks
    advancedTransform: {
        rotate: (source: HTMLCanvasElement, angle: number, preserveSize?: boolean) => HTMLCanvasElement;
        flipHorizontal: (source: HTMLCanvasElement) => HTMLCanvasElement;
        flipVertical: (source: HTMLCanvasElement) => HTMLCanvasElement;
        skewHorizontal: (source: HTMLCanvasElement, angle: number, preserveSize?: boolean) => HTMLCanvasElement;
        skewVertical: (source: HTMLCanvasElement, angle: number, preserveSize?: boolean) => HTMLCanvasElement;
        perspective: (source: HTMLCanvasElement, topScale: number, bottomScale: number, preserveSize?: boolean) => HTMLCanvasElement;
        stretch: (source: HTMLCanvasElement, scaleX: number, scaleY: number) => HTMLCanvasElement;
        offset: (source: HTMLCanvasElement, offsetX: number, offsetY: number) => HTMLCanvasElement;
    };
    // Selection hooks
    selectionTools: {
        selectionMask: { width: number; height: number; data: Uint8Array } | null;
        magicWand: (canvas: HTMLCanvasElement, x: number, y: number, tolerance: number, contiguous: boolean) => { width: number; height: number; data: Uint8Array };
        selectByColor: (canvas: HTMLCanvasElement, color: string, tolerance: number) => { width: number; height: number; data: Uint8Array };
        selectAll: (canvas: HTMLCanvasElement) => { width: number; height: number; data: Uint8Array };
        growSelection: (pixels: number) => { width: number; height: number; data: Uint8Array } | null;
        shrinkSelection: (pixels: number) => { width: number; height: number; data: Uint8Array } | null;
        invertSelection: () => { width: number; height: number; data: Uint8Array } | null;
        clearSelection: () => void;
        deleteSelected: (canvas: HTMLCanvasElement) => void;
        fillSelected: (canvas: HTMLCanvasElement, color: string) => void;
        getSelectionBounds: () => { x: number; y: number; width: number; height: number } | null;
    };
    wandTolerance: number;
    setWandTolerance: (tolerance: number) => void;
    wandContiguous: boolean;
    setWandContiguous: (contiguous: boolean) => void;
    // Frame tracking for resetting effect state
    currentFrameIndex?: number;
    // Effects hooks
    imageEffects: {
        adjustBrightnessContrast: (source: HTMLCanvasElement, brightness: number, contrast: number) => HTMLCanvasElement;
        adjustHSL: (source: HTMLCanvasElement, hue: number, saturation: number, lightness: number) => HTMLCanvasElement;
        invert: (source: HTMLCanvasElement) => HTMLCanvasElement;
        grayscale: (source: HTMLCanvasElement) => HTMLCanvasElement;
        posterize: (source: HTMLCanvasElement, levels: number) => HTMLCanvasElement;
        blur: (source: HTMLCanvasElement, radius: number) => HTMLCanvasElement;
        sharpen: (source: HTMLCanvasElement, amount: number) => HTMLCanvasElement;
        pixelate: (source: HTMLCanvasElement, blockSize: number) => HTMLCanvasElement;
        sepia: (source: HTMLCanvasElement) => HTMLCanvasElement;
    };
}

export function AdvancedFeaturesPanel({
    category,
    onClose,
    pixelPerfectEnabled,
    setPixelPerfectEnabled,
    shadingModeEnabled,
    setShadingModeEnabled,
    shadeSteps,
    setShadeSteps,
    color,
    setColor,
    palette,
    setPalette,
    canvasRef,
    colorRamp,
    colorHarmony,
    paletteExtraction,
    tilePreview,
    seamlessTile,
    outlineGenerator,
    pixelScaling,
    onApplyToCanvas,
    onPreviewEffect,
    onCancelPreview,
    onStartPreview,
    advancedTransform,
    selectionTools,
    wandTolerance,
    setWandTolerance,
    wandContiguous,
    setWandContiguous,
    currentFrameIndex,
    imageEffects,
}: AdvancedFeaturesPanelProps) {
    
    // Local state for UI
    const [rampStartColor, setRampStartColor] = useState('#000000');
    const [rampEndColor, setRampEndColor] = useState('#ffffff');
    const [rampSteps, setRampSteps] = useState(5);
    const [generatedRamp, setGeneratedRamp] = useState<string[]>([]);
    const [harmonyType, setHarmonyType] = useState<'complementary' | 'analogous' | 'triadic' | 'split' | 'tetradic' | 'mono'>('complementary');
    const [harmonyColors, setHarmonyColors] = useState<string[]>([]);
    const [extractedPalette, setExtractedPalette] = useState<string[]>([]);
    const [paletteSize, setPaletteSize] = useState(16);

    // Tiling & Patterns state
    const [seamlessScore, setSeamlessScore] = useState<{ horizontal: boolean; vertical: boolean; score: number } | null>(null);
    const [tilePreviewCanvas, setTilePreviewCanvas] = useState<HTMLCanvasElement | null>(null);

    // Transform state
    const [outlineColor, setOutlineColor] = useState('#000000');
    const [outlineStyle, setOutlineStyle] = useState<'outer' | 'inner' | 'both'>('outer');
    const [shadowOffsetX, setShadowOffsetX] = useState(1);
    const [shadowOffsetY, setShadowOffsetY] = useState(1);
    const [scaleAlgorithm, setScaleAlgorithm] = useState<'nearest' | 'scale2x' | 'scale3x' | 'epx'>('scale2x');
    // Outline removal state
    const [removeThickness, setRemoveThickness] = useState(1);
    const [preserveCorners, setPreserveCorners] = useState(false);
    const [removeByColor, setRemoveByColor] = useState(false);
    const [removeColorTolerance, setRemoveColorTolerance] = useState(30);
    // Outline selection/recolor state
    const [detectedOutlineColors, setDetectedOutlineColors] = useState<{ color: string; count: number }[]>([]);
    const [selectedOutlineColor, setSelectedOutlineColor] = useState<string | null>(null);
    const [newOutlineColor, setNewOutlineColor] = useState('#ffffff');

    // Effects state
    const [brightness, setBrightness] = useState(0);
    const [contrast, setContrast] = useState(0);
    const [hueShift, setHueShift] = useState(0);
    const [saturation, setSaturation] = useState(0);
    const [lightness, setLightness] = useState(0);
    const [posterizeLevels, setPosterizeLevels] = useState(4);
    const [blurRadius, setBlurRadius] = useState(1);
    const [sharpenAmount, setSharpenAmount] = useState(100);
    
    // Advanced Transform state
    const [rotationAngle, setRotationAngle] = useState(0);
    const [expandOnRotate, setExpandOnRotate] = useState(true);
    const [skewHAngle, setSkewHAngle] = useState(0);
    const [skewVAngle, setSkewVAngle] = useState(0);
    const [perspectiveTop, setPerspectiveTop] = useState(1);
    const [perspectiveBottom, setPerspectiveBottom] = useState(1);

    // Preview state
    const [previewActive, setPreviewActive] = useState(false);
    const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const lastFrameIndexRef = useRef<number | undefined>(currentFrameIndex);

    // CRITICAL: Reset cached canvas when frame changes to prevent cross-frame infection
    useEffect(() => {
        if (currentFrameIndex !== lastFrameIndexRef.current) {
            // Frame changed - invalidate cached canvas and cancel any active preview
            if (originalCanvasRef.current) {
                console.log('🔄 Frame changed - resetting effect cache');
                originalCanvasRef.current = null;
            }
            if (previewActive) {
                onCancelPreview();
                setBrightness(0);
                setContrast(0);
                setHueShift(0);
                setSaturation(0);
                setLightness(0);
                setRotationAngle(0);
                setSkewHAngle(0);
                setSkewVAngle(0);
                setPerspectiveTop(1);
                setPerspectiveBottom(1);
                setPreviewActive(false);
            }
            lastFrameIndexRef.current = currentFrameIndex;
        }
    }, [currentFrameIndex, previewActive, onCancelPreview]);

    // Helper to get or create original canvas snapshot
    const getOriginalCanvas = useCallback(() => {
        if (!originalCanvasRef.current && canvasRef.current) {
            // Create a copy of the original canvas
            const original = document.createElement('canvas');
            original.width = canvasRef.current.width;
            original.height = canvasRef.current.height;
            const ctx = original.getContext('2d');
            if (ctx) {
                ctx.drawImage(canvasRef.current, 0, 0);
            }
            originalCanvasRef.current = original;
        }
        return originalCanvasRef.current;
    }, [canvasRef]);

    // Expanded sections (moved up for useEffect dependencies)
    const [expandedSections, setExpandedSections] = useState({
        pixelPerfect: true,
        shading: false,
        colorRamp: false,
        harmony: false,
        extraction: false,
        // Tiling sections
        tilePreview: true,
        seamless: false,
        // Transform sections
        outline: true,
        outlineRemoval: false,
        outlineSelect: false,
        shadow: false,
        scaling: false,
        // Advanced Transform sections
        freeRotation: false,
        skew: false,
        perspectiveTransform: false,
        // Effects sections
        brightnessContrast: true,
        hsl: false,
        posterize: false,
        blurSharpen: false,
        quickEffects: false,
    });

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Real-time preview for Brightness/Contrast
    useEffect(() => {
        if (category !== 'effects' || !expandedSections.brightnessContrast) return;
        
        // Start preview on first change (when values change from 0)
        if ((brightness !== 0 || contrast !== 0) && !previewActive) {
            onStartPreview();
            setPreviewActive(true);
        }

        // Debounce the preview
        if (previewTimeoutRef.current) {
            clearTimeout(previewTimeoutRef.current);
        }
        
        previewTimeoutRef.current = setTimeout(() => {
            // Always use the original canvas for applying effects
            const originalCanvas = getOriginalCanvas();
            if (originalCanvas) {
                const result = imageEffects.adjustBrightnessContrast(originalCanvas, brightness, contrast);
                onPreviewEffect(result);
            }
        }, 50);

        return () => {
            if (previewTimeoutRef.current) {
                clearTimeout(previewTimeoutRef.current);
            }
        };
    }, [brightness, contrast, category, expandedSections.brightnessContrast, previewActive, onStartPreview, getOriginalCanvas, imageEffects, onPreviewEffect]);

    // Real-time preview for HSL
    useEffect(() => {
        if (category !== 'effects' || !expandedSections.hsl) return;
        
        if ((hueShift !== 0 || saturation !== 0 || lightness !== 0) && !previewActive) {
            onStartPreview();
            setPreviewActive(true);
        }

        if (previewTimeoutRef.current) {
            clearTimeout(previewTimeoutRef.current);
        }
        
        previewTimeoutRef.current = setTimeout(() => {
            // Always use the original canvas for applying effects
            const originalCanvas = getOriginalCanvas();
            if (originalCanvas) {
                const result = imageEffects.adjustHSL(originalCanvas, hueShift, saturation, lightness);
                onPreviewEffect(result);
            }
        }, 50);

        return () => {
            if (previewTimeoutRef.current) {
                clearTimeout(previewTimeoutRef.current);
            }
        };
    }, [hueShift, saturation, lightness, category, expandedSections.hsl, previewActive, onStartPreview, getOriginalCanvas, imageEffects, onPreviewEffect]);

    // Real-time preview for Free Rotation
    useEffect(() => {
        if (category !== 'transform' || !expandedSections.freeRotation) return;
        
        if (rotationAngle !== 0 && !previewActive) {
            onStartPreview();
            setPreviewActive(true);
        }

        if (previewTimeoutRef.current) {
            clearTimeout(previewTimeoutRef.current);
        }
        
        previewTimeoutRef.current = setTimeout(() => {
            const originalCanvas = getOriginalCanvas();
            if (originalCanvas) {
                const result = advancedTransform.rotate(originalCanvas, rotationAngle, true);
                onPreviewEffect(result);
            }
        }, 50);

        return () => {
            if (previewTimeoutRef.current) {
                clearTimeout(previewTimeoutRef.current);
            }
        };
    }, [rotationAngle, category, expandedSections.freeRotation, previewActive, onStartPreview, getOriginalCanvas, advancedTransform, onPreviewEffect]);

    // Real-time preview for Skew
    useEffect(() => {
        if (category !== 'transform' || !expandedSections.skew) return;
        
        if ((skewHAngle !== 0 || skewVAngle !== 0) && !previewActive) {
            onStartPreview();
            setPreviewActive(true);
        }

        if (previewTimeoutRef.current) {
            clearTimeout(previewTimeoutRef.current);
        }
        
        previewTimeoutRef.current = setTimeout(() => {
            const originalCanvas = getOriginalCanvas();
            if (originalCanvas) {
                // Apply both skews in sequence
                let result = originalCanvas;
                if (skewHAngle !== 0) {
                    result = advancedTransform.skewHorizontal(result, skewHAngle, true);
                }
                if (skewVAngle !== 0) {
                    result = advancedTransform.skewVertical(result, skewVAngle, true);
                }
                onPreviewEffect(result);
            }
        }, 50);

        return () => {
            if (previewTimeoutRef.current) {
                clearTimeout(previewTimeoutRef.current);
            }
        };
    }, [skewHAngle, skewVAngle, category, expandedSections.skew, previewActive, onStartPreview, getOriginalCanvas, advancedTransform, onPreviewEffect]);

    // Real-time preview for Perspective
    useEffect(() => {
        if (category !== 'transform' || !expandedSections.perspectiveTransform) return;
        
        if ((perspectiveTop !== 1 || perspectiveBottom !== 1) && !previewActive) {
            onStartPreview();
            setPreviewActive(true);
        }

        if (previewTimeoutRef.current) {
            clearTimeout(previewTimeoutRef.current);
        }
        
        previewTimeoutRef.current = setTimeout(() => {
            const originalCanvas = getOriginalCanvas();
            if (originalCanvas) {
                const result = advancedTransform.perspective(originalCanvas, perspectiveTop, perspectiveBottom, true);
                onPreviewEffect(result);
            }
        }, 50);

        return () => {
            if (previewTimeoutRef.current) {
                clearTimeout(previewTimeoutRef.current);
            }
        };
    }, [perspectiveTop, perspectiveBottom, category, expandedSections.perspectiveTransform, previewActive, onStartPreview, getOriginalCanvas, advancedTransform, onPreviewEffect]);

    // Handle apply with commit
    const handleApplyBrightnessContrast = useCallback(() => {
        const originalCanvas = getOriginalCanvas();
        if (originalCanvas) {
            const result = imageEffects.adjustBrightnessContrast(originalCanvas, brightness, contrast);
            onApplyToCanvas(result);
            setBrightness(0);
            setContrast(0);
            setPreviewActive(false);
            originalCanvasRef.current = null; // Clear original after apply
        }
    }, [getOriginalCanvas, imageEffects, brightness, contrast, onApplyToCanvas]);

    const handleApplyHSL = useCallback(() => {
        const originalCanvas = getOriginalCanvas();
        if (originalCanvas) {
            const result = imageEffects.adjustHSL(originalCanvas, hueShift, saturation, lightness);
            onApplyToCanvas(result);
            setHueShift(0);
            setSaturation(0);
            setLightness(0);
            setPreviewActive(false);
            originalCanvasRef.current = null; // Clear original after apply
        }
    }, [getOriginalCanvas, imageEffects, hueShift, saturation, lightness, onApplyToCanvas]);

    // Handle cancel/reset for effects
    const handleCancelEffect = useCallback(() => {
        onCancelPreview();
        setBrightness(0);
        setContrast(0);
        setHueShift(0);
        setSaturation(0);
        setLightness(0);
        setPreviewActive(false);
        originalCanvasRef.current = null; // Clear original on cancel
    }, [onCancelPreview]);

    // Handle apply/cancel for transforms
    const handleApplyRotation = useCallback(() => {
        const originalCanvas = getOriginalCanvas();
        if (originalCanvas) {
            const result = advancedTransform.rotate(originalCanvas, rotationAngle, true);
            onApplyToCanvas(result);
            setRotationAngle(0);
            setPreviewActive(false);
            originalCanvasRef.current = null;
        }
    }, [getOriginalCanvas, advancedTransform, rotationAngle, onApplyToCanvas]);

    const handleApplySkew = useCallback(() => {
        const originalCanvas = getOriginalCanvas();
        if (originalCanvas) {
            let result = originalCanvas;
            if (skewHAngle !== 0) {
                result = advancedTransform.skewHorizontal(result, skewHAngle, true);
            }
            if (skewVAngle !== 0) {
                result = advancedTransform.skewVertical(result, skewVAngle, true);
            }
            onApplyToCanvas(result);
            setSkewHAngle(0);
            setSkewVAngle(0);
            setPreviewActive(false);
            originalCanvasRef.current = null;
        }
    }, [getOriginalCanvas, advancedTransform, skewHAngle, skewVAngle, onApplyToCanvas]);

    const handleApplyPerspective = useCallback(() => {
        const originalCanvas = getOriginalCanvas();
        if (originalCanvas) {
            const result = advancedTransform.perspective(originalCanvas, perspectiveTop, perspectiveBottom, true);
            onApplyToCanvas(result);
            setPerspectiveTop(1);
            setPerspectiveBottom(1);
            setPreviewActive(false);
            originalCanvasRef.current = null;
        }
    }, [getOriginalCanvas, advancedTransform, perspectiveTop, perspectiveBottom, onApplyToCanvas]);

    const handleCancelTransform = useCallback(() => {
        onCancelPreview();
        setRotationAngle(0);
        setSkewHAngle(0);
        setSkewVAngle(0);
        setPerspectiveTop(1);
        setPerspectiveBottom(1);
        setPreviewActive(false);
        originalCanvasRef.current = null;
    }, [onCancelPreview]);

    // Generate color ramp
    const handleGenerateRamp = useCallback(() => {
        const ramp = colorRamp.generateRamp(rampStartColor, rampEndColor, rampSteps);
        setGeneratedRamp(ramp);
    }, [colorRamp, rampStartColor, rampEndColor, rampSteps]);

    // Generate harmony
    const handleGenerateHarmony = useCallback(() => {
        let colors: string[] = [];
        switch (harmonyType) {
            case 'complementary':
                colors = colorHarmony.getComplementary(color);
                break;
            case 'analogous':
                colors = colorHarmony.getAnalogous(color);
                break;
            case 'triadic':
                colors = colorHarmony.getTriadic(color);
                break;
            case 'split':
                colors = colorHarmony.getSplitComplementary(color);
                break;
            case 'tetradic':
                colors = colorHarmony.getTetradic(color);
                break;
            case 'mono':
                colors = colorHarmony.getMonochromatic(color, 5);
                break;
        }
        setHarmonyColors(colors);
    }, [colorHarmony, color, harmonyType]);

    // Extract palette from canvas
    const handleExtractPalette = useCallback(() => {
        if (canvasRef.current) {
            const extracted = paletteExtraction.extractFromCanvas(canvasRef.current, paletteSize);
            setExtractedPalette(extracted);
        }
    }, [paletteExtraction, canvasRef, paletteSize]);

    // Add colors to palette
    const addToPalette = useCallback((colors: string[]) => {
        const newPalette = [...palette];
        colors.forEach(c => {
            if (!newPalette.includes(c)) {
                newPalette.push(c);
            }
        });
        setPalette(newPalette.slice(0, 32)); // Limit to 32 colors
    }, [palette, setPalette]);

    if (!category) return null;

    // Render Drawing & Color category
    const renderDrawingColorCategory = () => (
        <div className="space-y-3">
            {/* Pixel Perfect Stroke */}
            <div className="pe-panel-section">
                <button 
                    className="w-full flex items-center justify-between py-2 px-1 hover:bg-white/5 rounded"
                    onClick={() => toggleSection('pixelPerfect')}
                >
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-medium">Pixel Perfect</span>
                    </div>
                    {expandedSections.pixelPerfect ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {expandedSections.pixelPerfect && (
                    <div className="pl-6 py-2 space-y-2">
                        <p className="text-xs text-gray-400">Removes L-shaped corners for clean 1px diagonal lines</p>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={pixelPerfectEnabled}
                                onChange={(e) => setPixelPerfectEnabled(e.target.checked)}
                                className="pe-checkbox"
                            />
                            <span className="text-sm">Enable Pixel Perfect</span>
                        </label>
                    </div>
                )}
            </div>

            {/* Shading Mode */}
            <div className="pe-panel-section">
                <button 
                    className="w-full flex items-center justify-between py-2 px-1 hover:bg-white/5 rounded"
                    onClick={() => toggleSection('shading')}
                >
                    <div className="flex items-center gap-2">
                        <Sun className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm font-medium">Shading Mode</span>
                    </div>
                    {expandedSections.shading ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {expandedSections.shading && (
                    <div className="pl-6 py-2 space-y-3">
                        <p className="text-xs text-gray-400">Left click to darken, right click to lighten</p>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={shadingModeEnabled}
                                onChange={(e) => setShadingModeEnabled(e.target.checked)}
                                className="pe-checkbox"
                            />
                            <span className="text-sm">Enable Shading Mode</span>
                        </label>
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-400">Shade Steps:</label>
                            <input
                                type="range"
                                min="5"
                                max="30"
                                value={shadeSteps}
                                onChange={(e) => setShadeSteps(Number(e.target.value))}
                                className="flex-1"
                            />
                            <span className="text-xs w-6">{shadeSteps}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Color Ramp Generator */}
            <div className="pe-panel-section">
                <button 
                    className="w-full flex items-center justify-between py-2 px-1 hover:bg-white/5 rounded"
                    onClick={() => toggleSection('colorRamp')}
                >
                    <div className="flex items-center gap-2">
                        <Rainbow className="w-4 h-4 text-pink-400" />
                        <span className="text-sm font-medium">Color Ramp</span>
                    </div>
                    {expandedSections.colorRamp ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {expandedSections.colorRamp && (
                    <div className="pl-6 py-2 space-y-3">
                        <p className="text-xs text-gray-400">Generate smooth color gradients</p>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={rampStartColor}
                                onChange={(e) => setRampStartColor(e.target.value)}
                                className="w-8 h-8 rounded cursor-pointer"
                                title="Start Color"
                            />
                            <span className="text-xs">→</span>
                            <input
                                type="color"
                                value={rampEndColor}
                                onChange={(e) => setRampEndColor(e.target.value)}
                                className="w-8 h-8 rounded cursor-pointer"
                                title="End Color"
                            />
                            <select
                                value={rampSteps}
                                onChange={(e) => setRampSteps(Number(e.target.value))}
                                className="pe-select text-xs"
                            >
                                {[3, 4, 5, 6, 7, 8, 10, 12].map(n => (
                                    <option key={n} value={n}>{n} steps</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={handleGenerateRamp}
                            className="pe-btn pe-btn-sm w-full"
                        >
                            Generate Ramp
                        </button>
                        {generatedRamp.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex flex-wrap gap-1">
                                    {generatedRamp.map((c, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setColor(c)}
                                            className="w-6 h-6 rounded border border-white/20 hover:scale-110 transition-transform"
                                            style={{ backgroundColor: c }}
                                            title={c}
                                        />
                                    ))}
                                </div>
                                <button
                                    onClick={() => addToPalette(generatedRamp)}
                                    className="text-xs text-purple-400 hover:text-purple-300"
                                >
                                    + Add to Palette
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Color Harmony */}
            <div className="pe-panel-section">
                <button 
                    className="w-full flex items-center justify-between py-2 px-1 hover:bg-white/5 rounded"
                    onClick={() => toggleSection('harmony')}
                >
                    <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium">Color Harmony</span>
                    </div>
                    {expandedSections.harmony ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {expandedSections.harmony && (
                    <div className="pl-6 py-2 space-y-3">
                        <p className="text-xs text-gray-400">Generate harmonious color schemes</p>
                        <div className="flex items-center gap-2">
                            <div 
                                className="w-8 h-8 rounded border border-white/20"
                                style={{ backgroundColor: color }}
                                title="Current Color"
                            />
                            <select
                                value={harmonyType}
                                onChange={(e) => setHarmonyType(e.target.value as typeof harmonyType)}
                                className="pe-select text-xs flex-1"
                            >
                                <option value="complementary">Complementary</option>
                                <option value="analogous">Analogous</option>
                                <option value="triadic">Triadic</option>
                                <option value="split">Split-Complementary</option>
                                <option value="tetradic">Tetradic</option>
                                <option value="mono">Monochromatic</option>
                            </select>
                        </div>
                        <button
                            onClick={handleGenerateHarmony}
                            className="pe-btn pe-btn-sm w-full"
                        >
                            Generate Harmony
                        </button>
                        {harmonyColors.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex flex-wrap gap-1">
                                    {harmonyColors.map((c, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setColor(c)}
                                            className="w-6 h-6 rounded border border-white/20 hover:scale-110 transition-transform"
                                            style={{ backgroundColor: c }}
                                            title={c}
                                        />
                                    ))}
                                </div>
                                <button
                                    onClick={() => addToPalette(harmonyColors)}
                                    className="text-xs text-purple-400 hover:text-purple-300"
                                >
                                    + Add to Palette
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Palette Extraction */}
            <div className="pe-panel-section">
                <button 
                    className="w-full flex items-center justify-between py-2 px-1 hover:bg-white/5 rounded"
                    onClick={() => toggleSection('extraction')}
                >
                    <div className="flex items-center gap-2">
                        <Pipette className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-medium">Palette Extraction</span>
                    </div>
                    {expandedSections.extraction ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {expandedSections.extraction && (
                    <div className="pl-6 py-2 space-y-3">
                        <p className="text-xs text-gray-400">Extract colors from canvas</p>
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-400">Colors:</label>
                            <select
                                value={paletteSize}
                                onChange={(e) => setPaletteSize(Number(e.target.value))}
                                className="pe-select text-xs"
                            >
                                {[8, 12, 16, 24, 32].map(n => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={handleExtractPalette}
                            className="pe-btn pe-btn-sm w-full"
                        >
                            Extract from Canvas
                        </button>
                        {extractedPalette.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex flex-wrap gap-1">
                                    {extractedPalette.map((c, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setColor(c)}
                                            className="w-5 h-5 rounded border border-white/20 hover:scale-110 transition-transform"
                                            style={{ backgroundColor: c }}
                                            title={c}
                                        />
                                    ))}
                                </div>
                                <button
                                    onClick={() => setPalette(extractedPalette)}
                                    className="text-xs text-purple-400 hover:text-purple-300"
                                >
                                    Replace Palette
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    // Handle seamless check
    const handleCheckSeamless = useCallback(() => {
        if (canvasRef.current) {
            const result = tilePreview.checkSeamless(canvasRef.current);
            setSeamlessScore(result);
        }
    }, [canvasRef, tilePreview]);

    // Handle make seamless
    const handleMakeSeamless = useCallback(() => {
        if (canvasRef.current) {
            const result = seamlessTile.makeSeamless(canvasRef.current);
            onApplyToCanvas(result);
        }
    }, [canvasRef, seamlessTile, onApplyToCanvas]);

    // Handle create mirror tile
    const handleCreateMirrorTile = useCallback(() => {
        if (canvasRef.current) {
            const result = seamlessTile.createMirrorTile(canvasRef.current);
            onApplyToCanvas(result);
        }
    }, [canvasRef, seamlessTile, onApplyToCanvas]);

    // Render Tiling & Patterns category
    const renderTilingPatternsCategory = () => (
        <div className="space-y-3">
            {/* Tile Preview */}
            <div className="pe-panel-section">
                <button 
                    className="w-full flex items-center justify-between py-2 px-1 hover:bg-white/5 rounded"
                    onClick={() => toggleSection('tilePreview')}
                >
                    <div className="flex items-center gap-2">
                        <Grid3X3 className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm font-medium">Tile Preview</span>
                    </div>
                    {expandedSections.tilePreview ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {expandedSections.tilePreview && (
                    <div className="pl-6 py-2 space-y-3">
                        <p className="text-xs text-gray-400">Check if your tile is seamless</p>
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-400">Grid Size:</label>
                            <select
                                value={tilePreview.gridSize}
                                onChange={(e) => tilePreview.setGridSize(Number(e.target.value) as 2 | 3 | 4)}
                                className="pe-select text-xs"
                            >
                                <option value={2}>2×2</option>
                                <option value={3}>3×3</option>
                                <option value={4}>4×4</option>
                            </select>
                        </div>
                        <button
                            onClick={handleCheckSeamless}
                            className="pe-btn pe-btn-sm w-full"
                        >
                            Check Seamless
                        </button>
                        {seamlessScore && (
                            <div className="bg-black/20 rounded p-2 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-400">Score:</span>
                                    <span className={`text-sm font-bold ${seamlessScore.score >= 80 ? 'text-green-400' : seamlessScore.score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                        {seamlessScore.score}%
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                    <span className={seamlessScore.horizontal ? 'text-green-400' : 'text-red-400'}>
                                        {seamlessScore.horizontal ? '✓' : '✗'} Horizontal
                                    </span>
                                    <span className={seamlessScore.vertical ? 'text-green-400' : 'text-red-400'}>
                                        {seamlessScore.vertical ? '✓' : '✗'} Vertical
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Seamless Tile Generator */}
            <div className="pe-panel-section">
                <button 
                    className="w-full flex items-center justify-between py-2 px-1 hover:bg-white/5 rounded"
                    onClick={() => toggleSection('seamless')}
                >
                    <div className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm font-medium">Seamless Generator</span>
                    </div>
                    {expandedSections.seamless ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {expandedSections.seamless && (
                    <div className="pl-6 py-2 space-y-3">
                        <p className="text-xs text-gray-400">Auto-blend edges for seamless tiling</p>
                        <button
                            onClick={handleMakeSeamless}
                            className="pe-btn pe-btn-sm w-full"
                        >
                            Make Seamless
                        </button>
                        <button
                            onClick={handleCreateMirrorTile}
                            className="pe-btn pe-btn-sm w-full"
                        >
                            Create Mirror Tile (2×2)
                        </button>
                        <p className="text-xs text-gray-500 italic">⚠️ This will modify the canvas</p>
                    </div>
                )}
            </div>
        </div>
    );

    // Handle generate outline
    const handleGenerateOutline = useCallback(() => {
        if (canvasRef.current) {
            const result = outlineGenerator.generateOutline(canvasRef.current, {
                color: outlineColor,
                style: outlineStyle,
            });
            onApplyToCanvas(result);
        }
    }, [canvasRef, outlineGenerator, outlineColor, outlineStyle, onApplyToCanvas]);

    // Handle remove outline
    const handleRemoveOutline = useCallback(() => {
        if (canvasRef.current) {
            let result: HTMLCanvasElement;
            if (removeByColor) {
                result = outlineGenerator.removeOutlineByColor(
                    canvasRef.current,
                    outlineColor,
                    removeColorTolerance
                );
            } else {
                result = outlineGenerator.removeOutline(canvasRef.current, {
                    thickness: removeThickness,
                    preserveCorners,
                });
            }
            onApplyToCanvas(result);
        }
    }, [canvasRef, outlineGenerator, removeByColor, outlineColor, removeColorTolerance, removeThickness, preserveCorners, onApplyToCanvas]);

    // Handle detect outline colors
    const handleDetectOutlineColors = useCallback(() => {
        if (canvasRef.current) {
            const colors = outlineGenerator.getOutlineColors(canvasRef.current);
            setDetectedOutlineColors(colors);
            if (colors.length > 0) {
                setSelectedOutlineColor(colors[0].color);
            }
        }
    }, [canvasRef, outlineGenerator]);

    // Handle recolor outline
    const handleRecolorOutline = useCallback(() => {
        if (canvasRef.current) {
            const result = outlineGenerator.recolorOutline(
                canvasRef.current,
                newOutlineColor,
                selectedOutlineColor ? { targetColor: selectedOutlineColor, tolerance: 30 } : undefined
            );
            onApplyToCanvas(result);
        }
    }, [canvasRef, outlineGenerator, newOutlineColor, selectedOutlineColor, onApplyToCanvas]);

    // Handle remove selected outline color
    const handleRemoveSelectedOutline = useCallback(() => {
        if (canvasRef.current && selectedOutlineColor) {
            const result = outlineGenerator.removeOutlineByColor(
                canvasRef.current,
                selectedOutlineColor,
                30
            );
            onApplyToCanvas(result);
            // Refresh detected colors
            handleDetectOutlineColors();
        }
    }, [canvasRef, outlineGenerator, selectedOutlineColor, onApplyToCanvas, handleDetectOutlineColors]);

    // Handle drop shadow
    const handleGenerateShadow = useCallback(() => {
        if (canvasRef.current) {
            const result = outlineGenerator.generateDropShadow(
                canvasRef.current,
                shadowOffsetX,
                shadowOffsetY,
                outlineColor
            );
            onApplyToCanvas(result);
        }
    }, [canvasRef, outlineGenerator, shadowOffsetX, shadowOffsetY, outlineColor, onApplyToCanvas]);

    // Handle pixel scaling
    const handleScale = useCallback(() => {
        if (canvasRef.current) {
            const result = pixelScaling.scale(canvasRef.current, scaleAlgorithm);
            onApplyToCanvas(result);
        }
    }, [canvasRef, pixelScaling, scaleAlgorithm, onApplyToCanvas]);

    // Render Transform & Algorithms category
    const renderTransformCategory = () => (
        <div className="space-y-3">
            {/* Outline Generator */}
            <div className="pe-panel-section">
                <button 
                    className="w-full flex items-center justify-between py-2 px-1 hover:bg-white/5 rounded"
                    onClick={() => toggleSection('outline')}
                >
                    <div className="flex items-center gap-2">
                        <Wand2 className="w-4 h-4 text-orange-400" />
                        <span className="text-sm font-medium">Outline Generator</span>
                    </div>
                    {expandedSections.outline ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {expandedSections.outline && (
                    <div className="pl-6 py-2 space-y-3">
                        <p className="text-xs text-gray-400">Add outlines around sprites</p>
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-400">Color:</label>
                            <input
                                type="color"
                                value={outlineColor}
                                onChange={(e) => setOutlineColor(e.target.value)}
                                className="w-8 h-6 rounded cursor-pointer"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-400">Style:</label>
                            <select
                                value={outlineStyle}
                                onChange={(e) => setOutlineStyle(e.target.value as 'outer' | 'inner' | 'both')}
                                className="pe-select text-xs flex-1"
                            >
                                <option value="outer">Outer</option>
                                <option value="inner">Inner</option>
                                <option value="both">Both</option>
                            </select>
                        </div>
                        <button
                            onClick={handleGenerateOutline}
                            className="pe-btn pe-btn-sm w-full"
                        >
                            Generate Outline
                        </button>
                    </div>
                )}
            </div>

            {/* Outline Removal */}
            <div className="pe-panel-section">
                <button 
                    className="w-full flex items-center justify-between py-2 px-1 hover:bg-white/5 rounded"
                    onClick={() => toggleSection('outlineRemoval')}
                >
                    <div className="flex items-center gap-2">
                        <Scissors className="w-4 h-4 text-red-400" />
                        <span className="text-sm font-medium">Outline Removal</span>
                    </div>
                    {expandedSections.outlineRemoval ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {expandedSections.outlineRemoval && (
                    <div className="pl-6 py-2 space-y-3">
                        <p className="text-xs text-gray-400">Remove outline pixels from sprite</p>
                        
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="removeByColor"
                                checked={removeByColor}
                                onChange={(e) => setRemoveByColor(e.target.checked)}
                                className="pe-checkbox"
                            />
                            <label htmlFor="removeByColor" className="text-xs text-gray-400">
                                Remove by color (smart)
                            </label>
                        </div>

                        {removeByColor ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-gray-400">Color:</label>
                                    <input
                                        type="color"
                                        value={outlineColor}
                                        onChange={(e) => setOutlineColor(e.target.value)}
                                        className="w-8 h-6 rounded cursor-pointer"
                                    />
                                    <span className="text-xs text-gray-500">(or auto-detect)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-gray-400">Tolerance:</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={removeColorTolerance}
                                        onChange={(e) => setRemoveColorTolerance(Number(e.target.value))}
                                        className="flex-1"
                                    />
                                    <span className="text-xs text-gray-500 w-8">{removeColorTolerance}</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-gray-400">Thickness:</label>
                                    <select
                                        value={removeThickness}
                                        onChange={(e) => setRemoveThickness(Number(e.target.value))}
                                        className="pe-select text-xs"
                                    >
                                        <option value={1}>1px</option>
                                        <option value={2}>2px</option>
                                        <option value={3}>3px</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="preserveCorners"
                                        checked={preserveCorners}
                                        onChange={(e) => setPreserveCorners(e.target.checked)}
                                        className="pe-checkbox"
                                    />
                                    <label htmlFor="preserveCorners" className="text-xs text-gray-400">
                                        Preserve corners
                                    </label>
                                </div>
                            </>
                        )}

                        <button
                            onClick={handleRemoveOutline}
                            className="pe-btn pe-btn-sm w-full bg-red-900/30 hover:bg-red-800/40"
                        >
                            Remove Outline
                        </button>
                        <p className="text-xs text-gray-500 italic">⚠️ This will modify the sprite</p>
                    </div>
                )}
            </div>

            {/* Outline Selection & Recolor */}
            <div className="pe-panel-section">
                <button 
                    className="w-full flex items-center justify-between py-2 px-1 hover:bg-white/5 rounded"
                    onClick={() => toggleSection('outlineSelect')}
                >
                    <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-medium">Select & Recolor Outline</span>
                    </div>
                    {expandedSections.outlineSelect ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {expandedSections.outlineSelect && (
                    <div className="pl-6 py-2 space-y-3">
                        <p className="text-xs text-gray-400">Detect outline colors and change them</p>
                        
                        <button
                            onClick={handleDetectOutlineColors}
                            className="pe-btn pe-btn-sm w-full"
                        >
                            Detect Outline Colors
                        </button>

                        {detectedOutlineColors.length > 0 && (
                            <>
                                <div className="space-y-2">
                                    <label className="text-xs text-gray-400">Found {detectedOutlineColors.length} color(s):</label>
                                    <div className="flex flex-wrap gap-1">
                                        {detectedOutlineColors.map((item, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setSelectedOutlineColor(item.color)}
                                                className={`w-6 h-6 rounded border-2 transition-all ${
                                                    selectedOutlineColor === item.color 
                                                        ? 'border-white scale-110' 
                                                        : 'border-white/20 hover:border-white/50'
                                                }`}
                                                style={{ backgroundColor: item.color }}
                                                title={`${item.color} (${item.count}px)`}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {selectedOutlineColor && (
                                    <div className="bg-black/20 rounded p-2 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-400">Selected:</span>
                                            <div 
                                                className="w-5 h-5 rounded border border-white/30"
                                                style={{ backgroundColor: selectedOutlineColor }}
                                            />
                                            <span className="text-xs text-gray-500">{selectedOutlineColor}</span>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-400">New color:</span>
                                            <input
                                                type="color"
                                                value={newOutlineColor}
                                                onChange={(e) => setNewOutlineColor(e.target.value)}
                                                className="w-8 h-6 rounded cursor-pointer"
                                            />
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleRecolorOutline}
                                                className="pe-btn pe-btn-sm flex-1 bg-purple-900/30 hover:bg-purple-800/40"
                                            >
                                                Recolor
                                            </button>
                                            <button
                                                onClick={handleRemoveSelectedOutline}
                                                className="pe-btn pe-btn-sm flex-1 bg-red-900/30 hover:bg-red-800/40"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={() => {
                                        if (canvasRef.current) {
                                            const result = outlineGenerator.recolorOutline(canvasRef.current, newOutlineColor);
                                            onApplyToCanvas(result);
                                        }
                                    }}
                                    className="pe-btn pe-btn-sm w-full"
                                >
                                    Recolor All Outline
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Drop Shadow */}
            <div className="pe-panel-section">
                <button 
                    className="w-full flex items-center justify-between py-2 px-1 hover:bg-white/5 rounded"
                    onClick={() => toggleSection('shadow')}
                >
                    <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-orange-400" />
                        <span className="text-sm font-medium">Drop Shadow</span>
                    </div>
                    {expandedSections.shadow ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {expandedSections.shadow && (
                    <div className="pl-6 py-2 space-y-3">
                        <p className="text-xs text-gray-400">Add a drop shadow effect</p>
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-400">Offset X:</label>
                            <input
                                type="number"
                                value={shadowOffsetX}
                                onChange={(e) => setShadowOffsetX(Number(e.target.value))}
                                className="pe-select text-xs w-16"
                                min="-10"
                                max="10"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-400">Offset Y:</label>
                            <input
                                type="number"
                                value={shadowOffsetY}
                                onChange={(e) => setShadowOffsetY(Number(e.target.value))}
                                className="pe-select text-xs w-16"
                                min="-10"
                                max="10"
                            />
                        </div>
                        <button
                            onClick={handleGenerateShadow}
                            className="pe-btn pe-btn-sm w-full"
                        >
                            Add Shadow
                        </button>
                    </div>
                )}
            </div>

            {/* Pixel Scaling */}
            <div className="pe-panel-section">
                <button 
                    className="w-full flex items-center justify-between py-2 px-1 hover:bg-white/5 rounded"
                    onClick={() => toggleSection('scaling')}
                >
                    <div className="flex items-center gap-2">
                        <Maximize2 className="w-4 h-4 text-orange-400" />
                        <span className="text-sm font-medium">Pixel Scaling</span>
                    </div>
                    {expandedSections.scaling ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {expandedSections.scaling && (
                    <div className="pl-6 py-2 space-y-3">
                        <p className="text-xs text-gray-400">Scale with pixel-art algorithms</p>
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-400">Algorithm:</label>
                            <select
                                value={scaleAlgorithm}
                                onChange={(e) => setScaleAlgorithm(e.target.value as 'nearest' | 'scale2x' | 'scale3x' | 'epx')}
                                className="pe-select text-xs flex-1"
                            >
                                <option value="scale2x">Scale2x (2×)</option>
                                <option value="scale3x">Scale3x (3×)</option>
                                <option value="epx">EPX (2×)</option>
                                <option value="nearest">Nearest (2×)</option>
                            </select>
                        </div>
                        <button
                            onClick={handleScale}
                            className="pe-btn pe-btn-sm w-full"
                        >
                            Apply Scaling
                        </button>
                        <p className="text-xs text-gray-500 italic">⚠️ This will resize the canvas</p>
                    </div>
                )}
            </div>

            {/* Free Rotation */}
            <div className="pe-panel-section">
                <button 
                    className="w-full flex items-center justify-between py-2 px-1 hover:bg-white/5 rounded"
                    onClick={() => toggleSection('freeRotation')}
                >
                    <div className="flex items-center gap-2">
                        <RotateCw className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm font-medium">Free Rotation</span>
                    </div>
                    {expandedSections.freeRotation ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {expandedSections.freeRotation && (
                    <div className="pl-6 py-2 space-y-3">
                        <p className="text-xs text-gray-400">Rotate by any angle</p>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-gray-400">Angle</label>
                                <span className="text-xs text-gray-500">{rotationAngle}°</span>
                            </div>
                            <input
                                type="range"
                                min="-180"
                                max="180"
                                value={rotationAngle}
                                onChange={(e) => setRotationAngle(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="expandOnRotate"
                                checked={expandOnRotate}
                                onChange={(e) => setExpandOnRotate(e.target.checked)}
                                className="pe-checkbox"
                            />
                            <label htmlFor="expandOnRotate" className="text-xs text-gray-400">
                                Expand canvas to fit
                            </label>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setRotationAngle(-90)}
                                className="pe-btn pe-btn-sm flex-1"
                            >
                                -90°
                            </button>
                            <button
                                onClick={() => setRotationAngle(-45)}
                                className="pe-btn pe-btn-sm flex-1"
                            >
                                -45°
                            </button>
                            <button
                                onClick={() => setRotationAngle(45)}
                                className="pe-btn pe-btn-sm flex-1"
                            >
                                +45°
                            </button>
                            <button
                                onClick={() => setRotationAngle(90)}
                                className="pe-btn pe-btn-sm flex-1"
                            >
                                +90°
                            </button>
                        </div>
                        {previewActive && rotationAngle !== 0 && (
                            <p className="text-xs text-green-400 italic">✨ Live preview active</p>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={handleApplyRotation}
                                className="pe-btn pe-btn-sm flex-1 bg-green-900/30 hover:bg-green-800/40"
                            >
                                Apply
                            </button>
                            <button
                                onClick={handleCancelTransform}
                                className="pe-btn pe-btn-sm flex-1 bg-red-900/30 hover:bg-red-800/40"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Skew */}
            <div className="pe-panel-section">
                <button 
                    className="w-full flex items-center justify-between py-2 px-1 hover:bg-white/5 rounded"
                    onClick={() => toggleSection('skew')}
                >
                    <div className="flex items-center gap-2">
                        <Shuffle className="w-4 h-4 text-pink-400" />
                        <span className="text-sm font-medium">Skew</span>
                    </div>
                    {expandedSections.skew ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {expandedSections.skew && (
                    <div className="pl-6 py-2 space-y-3">
                        <p className="text-xs text-gray-400">Shear the image horizontally or vertically</p>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-gray-400">Horizontal Skew</label>
                                <span className="text-xs text-gray-500">{skewHAngle}°</span>
                            </div>
                            <input
                                type="range"
                                min="-45"
                                max="45"
                                value={skewHAngle}
                                onChange={(e) => setSkewHAngle(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-gray-400">Vertical Skew</label>
                                <span className="text-xs text-gray-500">{skewVAngle}°</span>
                            </div>
                            <input
                                type="range"
                                min="-45"
                                max="45"
                                value={skewVAngle}
                                onChange={(e) => setSkewVAngle(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                        {previewActive && (skewHAngle !== 0 || skewVAngle !== 0) && (
                            <p className="text-xs text-green-400 italic">✨ Live preview active</p>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={handleApplySkew}
                                className="pe-btn pe-btn-sm flex-1 bg-green-900/30 hover:bg-green-800/40"
                            >
                                Apply
                            </button>
                            <button
                                onClick={handleCancelTransform}
                                className="pe-btn pe-btn-sm flex-1 bg-red-900/30 hover:bg-red-800/40"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Perspective */}
            <div className="pe-panel-section">
                <button 
                    className="w-full flex items-center justify-between py-2 px-1 hover:bg-white/5 rounded"
                    onClick={() => toggleSection('perspectiveTransform')}
                >
                    <div className="flex items-center gap-2">
                        <Maximize2 className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-medium">Perspective</span>
                    </div>
                    {expandedSections.perspectiveTransform ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {expandedSections.perspectiveTransform && (
                    <div className="pl-6 py-2 space-y-3">
                        <p className="text-xs text-gray-400">Apply perspective distortion</p>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-gray-400">Top Scale</label>
                                <span className="text-xs text-gray-500">{perspectiveTop.toFixed(2)}x</span>
                            </div>
                            <input
                                type="range"
                                min="0.5"
                                max="2"
                                step="0.05"
                                value={perspectiveTop}
                                onChange={(e) => setPerspectiveTop(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-gray-400">Bottom Scale</label>
                                <span className="text-xs text-gray-500">{perspectiveBottom.toFixed(2)}x</span>
                            </div>
                            <input
                                type="range"
                                min="0.5"
                                max="2"
                                step="0.05"
                                value={perspectiveBottom}
                                onChange={(e) => setPerspectiveBottom(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setPerspectiveTop(0.7); setPerspectiveBottom(1.3); }}
                                className="pe-btn pe-btn-sm flex-1"
                                title="Wider at bottom"
                            >
                                ▽
                            </button>
                            <button
                                onClick={() => { setPerspectiveTop(1.3); setPerspectiveBottom(0.7); }}
                                className="pe-btn pe-btn-sm flex-1"
                                title="Wider at top"
                            >
                                △
                            </button>
                            <button
                                onClick={() => { setPerspectiveTop(1); setPerspectiveBottom(1); }}
                                className="pe-btn pe-btn-sm flex-1"
                            >
                                Reset
                            </button>
                        </div>
                        {previewActive && (perspectiveTop !== 1 || perspectiveBottom !== 1) && (
                            <p className="text-xs text-green-400 italic">✨ Live preview active</p>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={handleApplyPerspective}
                                className="pe-btn pe-btn-sm flex-1 bg-green-900/30 hover:bg-green-800/40"
                            >
                                Apply
                            </button>
                            <button
                                onClick={handleCancelTransform}
                                className="pe-btn pe-btn-sm flex-1 bg-red-900/30 hover:bg-red-800/40"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Flip Buttons */}
            <div className="pe-panel-section">
                <div className="flex items-center gap-2 py-2 px-1">
                    <span className="text-xs text-gray-400">Quick Flip:</span>
                    <button
                        onClick={() => {
                            if (canvasRef.current) {
                                const result = advancedTransform.flipHorizontal(canvasRef.current);
                                onApplyToCanvas(result);
                            }
                        }}
                        className="pe-btn pe-btn-sm flex-1"
                        title="Flip Horizontal"
                    >
                        ↔ H
                    </button>
                    <button
                        onClick={() => {
                            if (canvasRef.current) {
                                const result = advancedTransform.flipVertical(canvasRef.current);
                                onApplyToCanvas(result);
                            }
                        }}
                        className="pe-btn pe-btn-sm flex-1"
                        title="Flip Vertical"
                    >
                        ↕ V
                    </button>
                </div>
            </div>
        </div>
    );

    // Render Effects category
    const renderEffectsCategory = () => (
        <div className="space-y-3">
            {/* Brightness & Contrast */}
            <div className="pe-panel-section">
                <button 
                    className="w-full flex items-center justify-between py-2 px-1 hover:bg-white/5 rounded"
                    onClick={() => toggleSection('brightnessContrast')}
                >
                    <div className="flex items-center gap-2">
                        <SunMedium className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm font-medium">Brightness & Contrast</span>
                    </div>
                    {expandedSections.brightnessContrast ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {expandedSections.brightnessContrast && (
                    <div className="pl-6 py-2 space-y-3">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-gray-400">Brightness</label>
                                <span className="text-xs text-gray-500">{brightness}</span>
                            </div>
                            <input
                                type="range"
                                min="-100"
                                max="100"
                                value={brightness}
                                onChange={(e) => setBrightness(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-gray-400">Contrast</label>
                                <span className="text-xs text-gray-500">{contrast}</span>
                            </div>
                            <input
                                type="range"
                                min="-100"
                                max="100"
                                value={contrast}
                                onChange={(e) => setContrast(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                        {previewActive && (
                            <p className="text-xs text-green-400 italic">✨ Live preview active</p>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={handleApplyBrightnessContrast}
                                className="pe-btn pe-btn-sm flex-1 bg-green-900/30 hover:bg-green-800/40"
                            >
                                Apply
                            </button>
                            <button
                                onClick={handleCancelEffect}
                                className="pe-btn pe-btn-sm flex-1 bg-red-900/30 hover:bg-red-800/40"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Hue / Saturation / Lightness */}
            <div className="pe-panel-section">
                <button 
                    className="w-full flex items-center justify-between py-2 px-1 hover:bg-white/5 rounded"
                    onClick={() => toggleSection('hsl')}
                >
                    <div className="flex items-center gap-2">
                        <Droplets className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium">Hue / Saturation / Lightness</span>
                    </div>
                    {expandedSections.hsl ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {expandedSections.hsl && (
                    <div className="pl-6 py-2 space-y-3">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-gray-400">Hue Shift</label>
                                <span className="text-xs text-gray-500">{hueShift}°</span>
                            </div>
                            <input
                                type="range"
                                min="-180"
                                max="180"
                                value={hueShift}
                                onChange={(e) => setHueShift(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-gray-400">Saturation</label>
                                <span className="text-xs text-gray-500">{saturation}</span>
                            </div>
                            <input
                                type="range"
                                min="-100"
                                max="100"
                                value={saturation}
                                onChange={(e) => setSaturation(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-gray-400">Lightness</label>
                                <span className="text-xs text-gray-500">{lightness}</span>
                            </div>
                            <input
                                type="range"
                                min="-100"
                                max="100"
                                value={lightness}
                                onChange={(e) => setLightness(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                        {previewActive && (
                            <p className="text-xs text-green-400 italic">✨ Live preview active</p>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={handleApplyHSL}
                                className="pe-btn pe-btn-sm flex-1 bg-green-900/30 hover:bg-green-800/40"
                            >
                                Apply
                            </button>
                            <button
                                onClick={handleCancelEffect}
                                className="pe-btn pe-btn-sm flex-1 bg-red-900/30 hover:bg-red-800/40"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Posterize */}
            <div className="pe-panel-section">
                <button 
                    className="w-full flex items-center justify-between py-2 px-1 hover:bg-white/5 rounded"
                    onClick={() => toggleSection('posterize')}
                >
                    <div className="flex items-center gap-2">
                        <Contrast className="w-4 h-4 text-pink-400" />
                        <span className="text-sm font-medium">Posterize</span>
                    </div>
                    {expandedSections.posterize ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {expandedSections.posterize && (
                    <div className="pl-6 py-2 space-y-3">
                        <p className="text-xs text-gray-400">Reduce color levels for stylized look</p>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-gray-400">Levels</label>
                                <span className="text-xs text-gray-500">{posterizeLevels}</span>
                            </div>
                            <input
                                type="range"
                                min="2"
                                max="32"
                                value={posterizeLevels}
                                onChange={(e) => setPosterizeLevels(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                        <button
                            onClick={() => {
                                if (canvasRef.current) {
                                    const result = imageEffects.posterize(canvasRef.current, posterizeLevels);
                                    onApplyToCanvas(result);
                                }
                            }}
                            className="pe-btn pe-btn-sm w-full"
                        >
                            Apply Posterize
                        </button>
                    </div>
                )}
            </div>

            {/* Blur & Sharpen */}
            <div className="pe-panel-section">
                <button 
                    className="w-full flex items-center justify-between py-2 px-1 hover:bg-white/5 rounded"
                    onClick={() => toggleSection('blurSharpen')}
                >
                    <div className="flex items-center gap-2">
                        <Focus className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-medium">Blur & Sharpen</span>
                    </div>
                    {expandedSections.blurSharpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {expandedSections.blurSharpen && (
                    <div className="pl-6 py-2 space-y-3">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-gray-400">Blur Radius</label>
                                <span className="text-xs text-gray-500">{blurRadius}px</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                value={blurRadius}
                                onChange={(e) => setBlurRadius(Number(e.target.value))}
                                className="w-full"
                            />
                            <button
                                onClick={() => {
                                    if (canvasRef.current) {
                                        const result = imageEffects.blur(canvasRef.current, blurRadius);
                                        onApplyToCanvas(result);
                                    }
                                }}
                                className="pe-btn pe-btn-sm w-full"
                            >
                                Apply Blur
                            </button>
                        </div>
                        <div className="border-t border-white/10 pt-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-gray-400">Sharpen Amount</label>
                                <span className="text-xs text-gray-500">{sharpenAmount}%</span>
                            </div>
                            <input
                                type="range"
                                min="50"
                                max="200"
                                value={sharpenAmount}
                                onChange={(e) => setSharpenAmount(Number(e.target.value))}
                                className="w-full"
                            />
                            <button
                                onClick={() => {
                                    if (canvasRef.current) {
                                        const result = imageEffects.sharpen(canvasRef.current, sharpenAmount);
                                        onApplyToCanvas(result);
                                    }
                                }}
                                className="pe-btn pe-btn-sm w-full"
                            >
                                Apply Sharpen
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Effects */}
            <div className="pe-panel-section">
                <button 
                    className="w-full flex items-center justify-between py-2 px-1 hover:bg-white/5 rounded"
                    onClick={() => toggleSection('quickEffects')}
                >
                    <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-medium">Quick Effects</span>
                    </div>
                    {expandedSections.quickEffects ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {expandedSections.quickEffects && (
                    <div className="pl-6 py-2 space-y-2">
                        <button
                            onClick={() => {
                                if (canvasRef.current) {
                                    const result = imageEffects.grayscale(canvasRef.current);
                                    onApplyToCanvas(result);
                                }
                            }}
                            className="pe-btn pe-btn-sm w-full"
                        >
                            Grayscale
                        </button>
                        <button
                            onClick={() => {
                                if (canvasRef.current) {
                                    const result = imageEffects.invert(canvasRef.current);
                                    onApplyToCanvas(result);
                                }
                            }}
                            className="pe-btn pe-btn-sm w-full"
                        >
                            Invert Colors
                        </button>
                        <button
                            onClick={() => {
                                if (canvasRef.current) {
                                    const result = imageEffects.sepia(canvasRef.current);
                                    onApplyToCanvas(result);
                                }
                            }}
                            className="pe-btn pe-btn-sm w-full"
                        >
                            Sepia Tone
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    // Render Selection category
    const renderSelectionCategory = () => (
        <div className="space-y-3">
            {/* Magic Wand Settings */}
            <div className="pe-panel-section">
                <div className="py-2 px-1">
                    <div className="flex items-center gap-2 mb-3">
                        <Wand2 className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm font-medium">Magic Wand Settings</span>
                    </div>
                    <div className="pl-2 space-y-3">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-gray-400">Tolerance</label>
                                <span className="text-xs text-gray-500">{wandTolerance}</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="128"
                                value={wandTolerance}
                                onChange={(e) => setWandTolerance(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={wandContiguous}
                                onChange={(e) => setWandContiguous(e.target.checked)}
                                className="pe-checkbox"
                            />
                            <span className="text-xs text-gray-400">Contiguous (connected pixels only)</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Selection Actions */}
            <div className="pe-panel-section">
                <div className="py-2 px-1">
                    <div className="flex items-center gap-2 mb-3">
                        <Scissors className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-medium">Selection Actions</span>
                    </div>
                    <div className="pl-2 space-y-2">
                        {selectionTools.selectionMask ? (
                            <>
                                <p className="text-xs text-green-400 italic mb-2">✓ Selection active</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => selectionTools.growSelection(1)}
                                        className="pe-btn pe-btn-sm"
                                    >
                                        Grow (+1px)
                                    </button>
                                    <button
                                        onClick={() => selectionTools.shrinkSelection(1)}
                                        className="pe-btn pe-btn-sm"
                                    >
                                        Shrink (-1px)
                                    </button>
                                    <button
                                        onClick={() => selectionTools.invertSelection()}
                                        className="pe-btn pe-btn-sm"
                                    >
                                        Invert
                                    </button>
                                    <button
                                        onClick={() => selectionTools.clearSelection()}
                                        className="pe-btn pe-btn-sm"
                                    >
                                        Clear (Esc)
                                    </button>
                                </div>
                                <div className="border-t border-white/10 pt-2 mt-2 space-y-2">
                                    <button
                                        onClick={() => {
                                            if (canvasRef.current) {
                                                selectionTools.deleteSelected(canvasRef.current);
                                                onApplyToCanvas(canvasRef.current);
                                            }
                                        }}
                                        className="pe-btn pe-btn-sm w-full bg-red-900/30 hover:bg-red-800/40"
                                    >
                                        🗑 Delete Selected
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (canvasRef.current) {
                                                selectionTools.fillSelected(canvasRef.current, color);
                                                onApplyToCanvas(canvasRef.current);
                                            }
                                        }}
                                        className="pe-btn pe-btn-sm w-full bg-blue-900/30 hover:bg-blue-800/40"
                                    >
                                        🪣 Fill with Current Color
                                    </button>
                                </div>
                            </>
                        ) : (
                            <p className="text-xs text-gray-500 italic">No selection. Use Magic Wand (W) to select.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Select By Color */}
            <div className="pe-panel-section">
                <div className="py-2 px-1">
                    <div className="flex items-center gap-2 mb-3">
                        <Pipette className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-medium">Select By Color</span>
                    </div>
                    <div className="pl-2 space-y-2">
                        <p className="text-xs text-gray-400">Select all pixels of the current color</p>
                        <button
                            onClick={() => {
                                if (canvasRef.current) {
                                    selectionTools.selectByColor(canvasRef.current, color, wandTolerance);
                                }
                            }}
                            className="pe-btn pe-btn-sm w-full"
                        >
                            Select Color: {color}
                        </button>
                        <button
                            onClick={() => {
                                if (canvasRef.current) {
                                    selectionTools.selectAll(canvasRef.current);
                                }
                            }}
                            className="pe-btn pe-btn-sm w-full"
                        >
                            Select All Non-Transparent
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    // Get category title and icon
    const getCategoryInfo = () => {
        switch (category) {
            case 'drawing-color':
                return { title: 'Drawing & Color', icon: <Sparkles className="w-4 h-4" /> };
            case 'tiling-patterns':
                return { title: 'Tiling & Patterns', icon: <Grid3X3 className="w-4 h-4" /> };
            case 'transform':
                return { title: 'Transform', icon: <Wand2 className="w-4 h-4" /> };
            case 'effects':
                return { title: 'Effects & Adjustments', icon: <Sliders className="w-4 h-4" /> };
            case 'selection':
                return { title: 'Selection', icon: <Scissors className="w-4 h-4" /> };
            default:
                return { title: 'Features', icon: null };
        }
    };

    const { title, icon } = getCategoryInfo();

    return (
        <div className="pe-advanced-panel w-full h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                <div className="flex items-center gap-2 text-purple-400">
                    {icon}
                    <span className="text-sm font-semibold">{title}</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-white/10 rounded"
                    title="Close Panel"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-2">
                {category === 'drawing-color' && renderDrawingColorCategory()}
                {category === 'tiling-patterns' && renderTilingPatternsCategory()}
                {category === 'transform' && renderTransformCategory()}
                {category === 'effects' && renderEffectsCategory()}
                {category === 'selection' && renderSelectionCategory()}
            </div>
        </div>
    );
}

export default AdvancedFeaturesPanel;
