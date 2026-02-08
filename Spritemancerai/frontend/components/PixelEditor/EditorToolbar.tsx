"use client";

import React from "react";
import { usePixelEditorContext } from "./PixelEditorProvider";
import {
    Pencil,
    Eraser,
    Pipette,
    PaintBucket,
    Minus,
    Square,
    Circle,
    FlipHorizontal,
    FlipVertical,
    Grid3X3,
    Wand2,
    Scissors,
    Grid,
    Columns,
    Rows,
    Blend,
    Sun,
} from "lucide-react";
import { DITHER_PATTERNS, getDitherPatternName, getDitherPatternIcon, DitherPattern } from "@/lib/pixelEditor/ditherPatterns";
import { Tool } from "@/lib/pixelEditor/hooks";

interface ToolButtonProps {
    tool: Tool;
    icon: React.ReactNode;
    title: string;
    shortcut?: string;
}

function ToolButton({ tool, icon, title, shortcut }: ToolButtonProps) {
    const { editorState } = usePixelEditorContext();
    const { tool: currentTool, setTool } = editorState;

    return (
        <button
            onClick={() => setTool(tool)}
            className={`pe-tool-btn ${currentTool === tool ? "active" : ""}`}
            title={`${title}${shortcut ? ` (${shortcut})` : ""}`}
        >
            {icon}
        </button>
    );
}

export function EditorToolbar() {
    const {
        editorState,
        canvasOps,
        historyManager,
    } = usePixelEditorContext();

    const {
        color,
        setColor,
        secondaryColor,
        setSecondaryColor,
        recentColors,
        tool,
        brushSize,
        setBrushSize,
        showGrid,
        setShowGrid,
        mirrorMode,
        setMirrorMode,
        ditherPattern,
        setDitherPattern,
    } = editorState;

    // Derived state for color swapping interface if needed, 
    // but for now we keep it simple as per reference: 
    // Primary/Secondary color boxes + swap icon maybe?

    return (
        <div className="pe-toolbar flex flex-col gap-4 p-3 border-r border-white/10 w-[120px] shrink-0 h-full overflow-y-auto bg-gradient-to-b from-zinc-900/80 to-zinc-950/90">

            {/* Main Tools Grid (2 cols) */}
            <div className="grid grid-cols-2 gap-2">
                <ToolButton tool="pencil" icon={<Pencil className="w-5 h-5" />} title="Pencil" shortcut="P" />
                <ToolButton tool="eraser" icon={<Eraser className="w-5 h-5" />} title="Eraser" shortcut="E" />
                <ToolButton tool="select" icon={<Scissors className="w-5 h-5" />} title="Select" shortcut="S" />
                <ToolButton tool="wand" icon={<Wand2 className="w-5 h-5" />} title="Magic Wand" shortcut="W" />
                <ToolButton tool="eyedropper" icon={<Pipette className="w-5 h-5" />} title="Eyedropper" shortcut="I" />
                <ToolButton tool="fill" icon={<PaintBucket className="w-5 h-5" />} title="Fill" shortcut="F" />
                <ToolButton tool="line" icon={<Minus className="w-5 h-5" />} title="Line" shortcut="L" />
                <ToolButton tool="rect" icon={<Square className="w-5 h-5" />} title="Rectangle" shortcut="R" />
                <ToolButton tool="circle" icon={<Circle className="w-5 h-5" />} title="Circle" shortcut="C" />
                <ToolButton tool="dither" icon={<Blend className="w-5 h-5" />} title="Dither" shortcut="D" />
                <ToolButton tool="shade" icon={<Sun className="w-5 h-5" />} title="Shade" shortcut="H" />
                <ToolButton tool="gradient" icon={<Grid3X3 className="w-5 h-5" />} title="Gradient" />
            </div>

            {/* Dither Pattern Selector - shown when dither tool selected */}
            {tool === "dither" && (
                <div className="flex flex-col gap-2">
                    <span className="text-[10px] text-zinc-400 uppercase">Dither Pattern</span>
                    <div className="grid grid-cols-4 gap-1">
                        {DITHER_PATTERNS.map((pattern) => (
                            <button
                                key={pattern}
                                onClick={() => setDitherPattern(pattern)}
                                className={`pe-tool-btn text-xs ${ditherPattern === pattern ? "active" : ""}`}
                                title={getDitherPatternName(pattern)}
                            >
                                {getDitherPatternIcon(pattern)}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            {/* Color Section - Overlapping style like reference */}
            <div className="flex flex-col gap-3 items-center">
                {/* Primary/Secondary Colors - Overlapping */}
                <div className="relative w-16 h-16 mx-auto">
                    {/* Secondary (back) */}
                    <div
                        className="absolute bottom-0 right-0 w-10 h-10 rounded-lg border-2 border-white/20 shadow-xl cursor-pointer transition-transform hover:scale-105"
                        style={{ backgroundColor: secondaryColor }}
                        title="Secondary Color (Right-click)"
                    >
                        <input
                            type="color"
                            value={secondaryColor}
                            onChange={(e) => setSecondaryColor(e.target.value)}
                            className="opacity-0 w-full h-full cursor-pointer absolute inset-0"
                        />
                    </div>
                    {/* Primary (front) */}
                    <div
                        className="absolute top-0 left-0 w-12 h-12 rounded-lg border-2 border-purple-500/50 shadow-2xl cursor-pointer transition-transform hover:scale-105 ring-2 ring-purple-500/20"
                        style={{ backgroundColor: color }}
                        title="Primary Color"
                    >
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="opacity-0 w-full h-full cursor-pointer absolute inset-0"
                        />
                    </div>
                </div>

                {/* Recent Colors */}
                {recentColors.length > 0 && (
                    <div className="grid grid-cols-4 gap-1.5 w-full">
                        {recentColors.slice(0, 8).map((c, i) => (
                            <button
                                key={i}
                                onClick={() => setColor(c)}
                                className="w-full aspect-square rounded-md border border-white/10 hover:border-purple-400 hover:scale-110 transition-all shadow-sm"
                                style={{ backgroundColor: c }}
                                title={c}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            {/* Brush Size - Single Row */}
            <div className="flex items-center gap-2 w-full">
                <span className="text-[10px] text-zinc-400 uppercase whitespace-nowrap">Size</span>
                <select
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="flex-1 bg-zinc-800/80 border border-white/10 rounded-md px-2 py-1.5 text-xs text-center cursor-pointer hover:border-purple-500/50 focus:border-purple-500 focus:outline-none transition-colors"
                >
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32].map(size => (
                        <option key={size} value={size}>{size}px</option>
                    ))}
                </select>
            </div>

            {/* Grid & Mirror Row */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setShowGrid(!showGrid)}
                    className={`pe-tool-btn flex-1 ${showGrid ? "active" : ""}`}
                    title="Toggle Grid (G)"
                >
                    <Grid className="w-4 h-4" />
                </button>
                <button
                    onClick={() => setMirrorMode(prev => prev === "h" ? "none" : prev === "both" ? "v" : prev === "v" ? "both" : "h")}
                    className={`pe-tool-btn flex-1 ${mirrorMode === "h" || mirrorMode === "both" ? "active" : ""}`}
                    title="Mirror Horizontal (M)"
                >
                    <FlipHorizontal className="w-4 h-4" />
                </button>
                <button
                    onClick={() => setMirrorMode(prev => prev === "v" ? "none" : prev === "both" ? "h" : prev === "h" ? "both" : "v")}
                    className={`pe-tool-btn flex-1 ${mirrorMode === "v" || mirrorMode === "both" ? "active" : ""}`}
                    title="Mirror Vertical (M)"
                >
                    <FlipVertical className="w-4 h-4" />
                </button>
            </div>

        </div>
    );
}