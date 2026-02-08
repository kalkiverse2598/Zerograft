"use client";

import { useState, useCallback } from "react";
import { DitherPattern } from "@/lib/pixelEditor/ditherPatterns";
import { FeatureCategory } from "@/components/PixelEditor/AdvancedFeaturesPanel";

// Types
export type Tool = "pencil" | "eraser" | "eyedropper" | "fill" | "line" | "select" | "rect" | "circle" | "dither" | "wand" | "gradient" | "shade";
export type MirrorMode = "none" | "h" | "v" | "both";

export interface EditorState {
    // Tool state
    tool: Tool;
    setTool: (tool: Tool) => void;
    brushSize: number;
    setBrushSize: (size: number) => void;

    // Color state
    color: string;
    setColor: (color: string) => void;
    secondaryColor: string;
    setSecondaryColor: (color: string) => void;
    recentColors: string[];
    addToRecentColors: (color: string) => void;

    // View state
    zoom: number;
    setZoom: React.Dispatch<React.SetStateAction<number>>;
    showGrid: boolean;
    setShowGrid: React.Dispatch<React.SetStateAction<boolean>>;
    mirrorMode: MirrorMode;
    setMirrorMode: React.Dispatch<React.SetStateAction<MirrorMode>>;
    ditherPattern: DitherPattern;
    setDitherPattern: (pattern: DitherPattern) => void;

    // Panel visibility
    showLayerPanel: boolean;
    setShowLayerPanel: React.Dispatch<React.SetStateAction<boolean>>;
    activeFeatureCategory: FeatureCategory;
    setActiveFeatureCategory: React.Dispatch<React.SetStateAction<FeatureCategory>>;

    // Animation Panel
    showTimeline: boolean;
    setShowTimeline: React.Dispatch<React.SetStateAction<boolean>>;

    // Pixel Perfect
    pixelPerfectEnabled: boolean;
    setPixelPerfectEnabled: React.Dispatch<React.SetStateAction<boolean>>;

    // Shading Mode
    shadingModeEnabled: boolean;
    setShadingModeEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    shadeSteps: number;
    setShadeSteps: (steps: number) => void;

    // Magic Wand
    wandTolerance: number;
    setWandTolerance: (tolerance: number) => void;
    wandContiguous: boolean;
    setWandContiguous: (contiguous: boolean) => void;

    // Onion Skinning
    onionSkinEnabled: boolean;
    setOnionSkinEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    onionSkinOpacity: number;
    setOnionSkinOpacity: (opacity: number) => void;

    // Color Swap Modal
    showColorSwap: boolean;
    setShowColorSwap: React.Dispatch<React.SetStateAction<boolean>>;
    swapFromColor: string;
    setSwapFromColor: (color: string) => void;
    swapToColor: string;
    setSwapToColor: (color: string) => void;

    // Resize Modal
    showResizeModal: boolean;
    setShowResizeModal: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface UseEditorStateOptions {
    initialTool?: Tool;
    initialColor?: string;
    initialSecondaryColor?: string;
    initialZoom?: number;
}

export function useEditorState(options: UseEditorStateOptions = {}): EditorState {
    const {
        initialTool = "pencil",
        initialColor = "#ff0000",
        initialSecondaryColor = "#0000ff",
        initialZoom = 8,
    } = options;

    // Tool state
    const [tool, setTool] = useState<Tool>(initialTool);
    const [brushSize, setBrushSize] = useState(1);

    // Color state
    const [color, setColor] = useState(initialColor);
    const [secondaryColor, setSecondaryColor] = useState(initialSecondaryColor);
    const [recentColors, setRecentColors] = useState<string[]>([]);

    // View state
    const [zoom, setZoom] = useState(initialZoom);
    const [showGrid, setShowGrid] = useState(true);
    const [mirrorMode, setMirrorMode] = useState<MirrorMode>("none");
    const [ditherPattern, setDitherPattern] = useState<DitherPattern>("none");

    // Panel visibility
    const [showLayerPanel, setShowLayerPanel] = useState(true);
    const [showTimeline, setShowTimeline] = useState(true);
    const [activeFeatureCategory, setActiveFeatureCategory] = useState<FeatureCategory>(null);

    // Pixel Perfect
    const [pixelPerfectEnabled, setPixelPerfectEnabled] = useState(true);

    // Shading Mode
    const [shadingModeEnabled, setShadingModeEnabled] = useState(false);
    const [shadeSteps, setShadeSteps] = useState(15);

    // Magic Wand
    const [wandTolerance, setWandTolerance] = useState(32);
    const [wandContiguous, setWandContiguous] = useState(true);

    // Onion Skinning
    const [onionSkinEnabled, setOnionSkinEnabled] = useState(false);
    const [onionSkinOpacity, setOnionSkinOpacity] = useState(0.3);

    // Color Swap Modal
    const [showColorSwap, setShowColorSwap] = useState(false);
    const [swapFromColor, setSwapFromColor] = useState("#000000");
    const [swapToColor, setSwapToColor] = useState("#ffffff");

    // Resize Modal
    const [showResizeModal, setShowResizeModal] = useState(false);

    // Add to recent colors
    const addToRecentColors = useCallback((newColor: string) => {
        setRecentColors(prev => {
            const filtered = prev.filter(c => c !== newColor);
            return [newColor, ...filtered].slice(0, 12);
        });
    }, []);

    return {
        // Tool
        tool,
        setTool,
        brushSize,
        setBrushSize,

        // Color
        color,
        setColor,
        secondaryColor,
        setSecondaryColor,
        recentColors,
        addToRecentColors,

        // View
        zoom,
        setZoom,
        showGrid,
        setShowGrid,
        mirrorMode,
        setMirrorMode,
        ditherPattern,
        setDitherPattern,

        // Panels
        showLayerPanel,
        setShowLayerPanel,
        showTimeline,
        setShowTimeline,
        activeFeatureCategory,
        setActiveFeatureCategory,

        // Features
        pixelPerfectEnabled,
        setPixelPerfectEnabled,
        shadingModeEnabled,
        setShadingModeEnabled,
        shadeSteps,
        setShadeSteps,
        wandTolerance,
        setWandTolerance,
        wandContiguous,
        setWandContiguous,
        onionSkinEnabled,
        setOnionSkinEnabled,
        onionSkinOpacity,
        setOnionSkinOpacity,

        // Modals
        showColorSwap,
        setShowColorSwap,
        swapFromColor,
        setSwapFromColor,
        swapToColor,
        setSwapToColor,
        showResizeModal,
        setShowResizeModal,
    };
}
