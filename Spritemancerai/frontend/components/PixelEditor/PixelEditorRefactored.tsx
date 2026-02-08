"use client";

import React, { useEffect } from "react";
import { PixelEditorProvider, usePixelEditorContext } from "./PixelEditorProvider";
import { EditorHeader } from "./EditorHeader";
import { EditorToolbar } from "./EditorToolbar";
import { EditorCanvas } from "./EditorCanvas";
import { EditorFooter } from "./EditorFooter";
import { AdvancedFeaturesPanel } from "./AdvancedFeaturesPanel";
import { LayerManager } from "./LayerManager";
import { CanvasResizeModal } from "./CanvasResizeModal";
import { OnionSkinControls } from "./OnionSkinOverlay";
import { AnimationTimeline } from "./AnimationTimeline";
import { HitStopControls } from "./HitStopControls";
import { SmearControls } from "./SmearControls";
import { BreakEffectControls } from "./BreakEffectControls";
import { FluidEffectControls } from "./FluidEffectControls";
import { FluidGridControls } from "./FluidGridControls";
import { FloatingPanel } from "./FloatingPanel";
import { ParticleLibrary } from "./ParticleLibrary";
import { Button } from "@/components/ui/button";
import { Copy, Scissors, ClipboardPaste, Maximize2, Sparkles, Grid3X3, Wand2, SunMedium, FlipHorizontal, FlipVertical, Palette, Gamepad2, Zap, Wind, Droplets, Layers } from "lucide-react";
import { EffectTimeline } from "./EffectTimeline";
import { EffectPresetPicker } from "./EffectPresetPicker";
import "./PixelEditor.css";

// VFX Panel Content with tabs
function VfxPanelContent({
    hitStopPreview,
    particleOverlay,
    smearEffect,
    breakEffect,
    fluidParticles,
    fluidGrid,
    canvasRef,
    layerSystem,
    canvasState,
    animation,
    updateDisplay,
}: {
    hitStopPreview: ReturnType<typeof import('./PixelEditorProvider').usePixelEditorContext>['hitStopPreview'];
    particleOverlay: ReturnType<typeof import('./PixelEditorProvider').usePixelEditorContext>['particleOverlay'];
    smearEffect: ReturnType<typeof import('./PixelEditorProvider').usePixelEditorContext>['smearEffect'];
    breakEffect: ReturnType<typeof import('./PixelEditorProvider').usePixelEditorContext>['breakEffect'];
    fluidParticles: ReturnType<typeof import('./PixelEditorProvider').usePixelEditorContext>['fluidParticles'];
    fluidGrid: ReturnType<typeof import('./PixelEditorProvider').usePixelEditorContext>['fluidGrid'];
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    layerSystem: ReturnType<typeof import('./PixelEditorProvider').usePixelEditorContext>['layerSystem'];
    canvasState: ReturnType<typeof import('./PixelEditorProvider').usePixelEditorContext>['canvasState'];
    animation: ReturnType<typeof import('./PixelEditorProvider').usePixelEditorContext>['animation'];
    updateDisplay: () => void;
}) {
    const [activeTab, setActiveTab] = React.useState<'hitstop' | 'particles' | 'smear' | 'break' | 'fluids' | 'effects'>('hitstop');
    const [fluidMode, setFluidMode] = React.useState<'particles' | 'grid'>('particles');
    const [isApplyingSmear, setIsApplyingSmear] = React.useState(false);
    const [fluidDuration, setFluidDuration] = React.useState(30);
    const [selectedPreset, setSelectedPreset] = React.useState<string | undefined>();

    const handleParticleGenerated = React.useCallback((imageBase64: string, frameCount: number, size: number) => {
        particleOverlay.startPlacement(imageBase64, frameCount, size, size);
    }, [particleOverlay]);

    // Apply smear effect to all animation frames
    const handleApplySmear = React.useCallback(async () => {
        if (animation.frames.length < 2) return;

        setIsApplyingSmear(true);

        try {
            // Collect all frame ImageData
            const frameImages: ImageData[] = [];
            for (const frame of animation.frames) {
                if (frame.imageData) {
                    frameImages.push(frame.imageData);
                }
            }

            if (frameImages.length < 2) {
                console.warn('Need at least 2 frames with image data to apply smear');
                return;
            }

            // Generate smeared frames
            const smearedFrames = smearEffect.generateSmearAnimation(frameImages);

            // Update each frame with smeared version
            for (let i = 0; i < smearedFrames.length; i++) {
                const frame = animation.frames[i];
                if (frame) {
                    animation.setFrameImageData(frame.id, smearedFrames[i]);
                }
            }

            // Refresh display
            updateDisplay();
            console.log(`✨ Applied smear effect to ${smearedFrames.length} frames`);
        } finally {
            setIsApplyingSmear(false);
        }
    }, [animation, smearEffect, updateDisplay]);

    // Generate break animation and add frames
    const handleGenerateBreak = React.useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Get current canvas image
        const activeLayer = layerSystem.getActiveLayer();
        const sourceCanvas = activeLayer?.canvas || canvas;

        const result = await breakEffect.generateBreakAnimation(sourceCanvas);

        // Add generated frames to animation
        for (let i = 1; i < result.frames.length; i++) {
            animation.addFrame(result.frames[i]);
        }

        console.log(`✨ Generated ${result.frames.length} break animation frames`);
    }, [canvasRef, layerSystem, breakEffect, animation]);

    // Generate fluid animation and add frames
    const handleGenerateFluids = React.useCallback(async () => {
        const width = canvasState.imageWidth;
        const height = canvasState.imageHeight;

        const result = await fluidParticles.generateAnimation(width, height, fluidDuration);

        // Add generated frames to animation
        for (const frame of result.frames) {
            animation.addFrame(frame);
        }

        console.log(`✨ Generated ${result.frames.length} fluid animation frames`);
    }, [canvasState, fluidParticles, fluidDuration, animation]);

    return (
        <div>
            {/* Tabs */}
            <div className="flex border-b border-zinc-700 mb-4">
                <button
                    onClick={() => setActiveTab('hitstop')}
                    className={`flex-1 py-2 px-2 text-xs font-medium flex items-center justify-center gap-1 border-b-2 transition-colors ${activeTab === 'hitstop'
                        ? 'border-yellow-500 text-yellow-400'
                        : 'border-transparent text-zinc-400 hover:text-white'
                        }`}
                >
                    <Zap className="w-3 h-3" />
                    Hit-Stop
                </button>
                <button
                    onClick={() => setActiveTab('particles')}
                    className={`flex-1 py-2 px-2 text-xs font-medium flex items-center justify-center gap-1 border-b-2 transition-colors ${activeTab === 'particles'
                        ? 'border-violet-500 text-violet-400'
                        : 'border-transparent text-zinc-400 hover:text-white'
                        }`}
                >
                    <Sparkles className="w-3 h-3" />
                    Particles
                </button>
                <button
                    onClick={() => setActiveTab('smear')}
                    className={`flex-1 py-2 px-2 text-xs font-medium flex items-center justify-center gap-1 border-b-2 transition-colors ${activeTab === 'smear'
                        ? 'border-cyan-500 text-cyan-400'
                        : 'border-transparent text-zinc-400 hover:text-white'
                        }`}
                >
                    <Wind className="w-3 h-3" />
                    Smear
                </button>
                <button
                    onClick={() => setActiveTab('break')}
                    className={`flex-1 py-2 px-2 text-xs font-medium flex items-center justify-center gap-1 border-b-2 transition-colors ${activeTab === 'break'
                        ? 'border-orange-500 text-orange-400'
                        : 'border-transparent text-zinc-400 hover:text-white'
                        }`}
                >
                    <Grid3X3 className="w-3 h-3" />
                    Break
                </button>
                <button
                    onClick={() => setActiveTab('fluids')}
                    className={`flex-1 py-2 px-2 text-xs font-medium flex items-center justify-center gap-1 border-b-2 transition-colors ${activeTab === 'fluids'
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-zinc-400 hover:text-white'
                        }`}
                >
                    <Droplets className="w-3 h-3" />
                    Fluids
                </button>
                <button
                    onClick={() => setActiveTab('effects')}
                    className={`flex-1 py-2 px-2 text-xs font-medium flex items-center justify-center gap-1 border-b-2 transition-colors ${activeTab === 'effects'
                        ? 'border-purple-500 text-purple-400'
                        : 'border-transparent text-zinc-400 hover:text-white'
                        }`}
                >
                    <Layers className="w-3 h-3" />
                    Effects
                </button>
            </div>

            {/* Placement Mode Indicator */}
            {particleOverlay.isPlacingMode && (
                <div className="mb-4 p-3 rounded-lg bg-violet-500/20 border border-violet-500/50 text-violet-300 text-sm">
                    👆 Click on the canvas to place particle
                    <button
                        onClick={() => particleOverlay.cancelPlacement()}
                        className="ml-2 text-violet-400 hover:text-white underline"
                    >
                        Cancel
                    </button>
                </div>
            )}

            {/* Tab Content */}
            {activeTab === 'hitstop' && (
                <HitStopControls
                    config={hitStopPreview.config}
                    onConfigChange={hitStopPreview.updateConfig}
                    impactFrameCount={hitStopPreview.impactFrames.size}
                    isPreviewPlaying={hitStopPreview.isPreviewPlaying}
                    onStartPreview={hitStopPreview.startPreview}
                    onStopPreview={hitStopPreview.stopPreview}
                    onClearImpactFrames={hitStopPreview.clearImpactFrames}
                />
            )}

            {activeTab === 'particles' && (
                <ParticleLibrary
                    onParticleGenerated={handleParticleGenerated}
                />
            )}

            {activeTab === 'smear' && (
                <SmearControls
                    config={smearEffect.config}
                    onConfigChange={smearEffect.updateConfig}
                    onApply={handleApplySmear}
                    isApplying={isApplyingSmear}
                    frameCount={animation.frames.length}
                />
            )}

            {activeTab === 'break' && (
                <BreakEffectControls
                    config={breakEffect.config}
                    onConfigChange={breakEffect.updateConfig}
                    onGenerate={handleGenerateBreak}
                    isGenerating={breakEffect.isGenerating}
                />
            )}

            {activeTab === 'fluids' && (
                <div>
                    {/* Fluid Type Toggle */}
                    <div className="flex gap-1 mb-3 p-1 bg-zinc-800 rounded-lg">
                        <button
                            onClick={() => setFluidMode('particles')}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${fluidMode === 'particles'
                                ? 'bg-blue-600 text-white'
                                : 'text-zinc-400 hover:text-white'
                                }`}
                        >
                            Particles
                        </button>
                        <button
                            onClick={() => setFluidMode('grid')}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${fluidMode === 'grid'
                                ? 'bg-purple-600 text-white'
                                : 'text-zinc-400 hover:text-white'
                                }`}
                        >
                            WebGL Grid
                        </button>
                    </div>

                    {fluidMode === 'particles' && (
                        <FluidEffectControls
                            config={fluidParticles.config}
                            onConfigChange={fluidParticles.updateConfig}
                            onApplyPreset={fluidParticles.applyPreset}
                            onGenerate={handleGenerateFluids}
                            isGenerating={fluidParticles.isGenerating}
                        />
                    )}

                    {fluidMode === 'grid' && (
                        <FluidGridControls
                            config={fluidGrid.config}
                            onConfigChange={fluidGrid.updateConfig}
                            onInitialize={fluidGrid.initSimulation}
                            onStep={fluidGrid.step}
                            onRender={fluidGrid.render}
                            onSplat={fluidGrid.splat}
                            onGenerate={async (w, h, d) => {
                                // Just generate frames, don't add them yet
                                // handleGenerate in FluidGridControls will pixelate
                                // and call onGeneratePixelated to add them
                                const result = await fluidGrid.generateAnimation(w, h, d);
                                return result;
                            }}
                            onGeneratePixelated={(frames) => {
                                // Add the pixelated frames to animation
                                for (const frame of frames) {
                                    animation.addFrame(frame);
                                }
                            }}
                            onDispose={fluidGrid.dispose}
                            isInitialized={fluidGrid.isInitialized}
                            isGenerating={fluidGrid.isGenerating}
                            targetWidth={canvasState.imageWidth}
                            targetHeight={canvasState.imageHeight}
                            existingFrames={animation.frames.map((f: { id: string }) => {
                                // Get ImageData for each frame
                                const canvas = document.createElement('canvas');
                                canvas.width = canvasState.imageWidth;
                                canvas.height = canvasState.imageHeight;
                                const ctx = canvas.getContext('2d');
                                if (!ctx) return new ImageData(canvasState.imageWidth, canvasState.imageHeight);
                                // For now, return empty ImageData - frames need to be extracted from layerSystem
                                return new ImageData(canvasState.imageWidth, canvasState.imageHeight);
                            })}
                            onApplyToFrames={(frames) => {
                                // Update each frame with composited result
                                frames.forEach((frame, i) => {
                                    const frameId = animation.frames[i]?.id;
                                    if (animation.setFrameImageData && frameId) {
                                        animation.setFrameImageData(frameId, frame);
                                    }
                                });
                            }}
                        />
                    )}
                </div>
            )}

            {/* Effects Tab - Timeline-based effect management */}
            {activeTab === 'effects' && (
                <div className="space-y-3">
                    <EffectPresetPicker
                        onSelect={setSelectedPreset}
                        selectedPreset={selectedPreset}
                        currentFrame={animation.currentFrameIndex}
                    />
                    <p className="text-xs text-zinc-500 text-center">
                        Select a preset above, then use the Effect Timeline (below animation frames) to add effects
                    </p>
                </div>
            )}

            {/* Placed Particles List */}
            {particleOverlay.particles.length > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-700">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-zinc-400">Placed Particles ({particleOverlay.particles.length})</span>
                        <button
                            onClick={() => particleOverlay.clearAllParticles()}
                            className="text-xs text-red-400 hover:text-red-300"
                        >
                            Clear All
                        </button>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                        {particleOverlay.particles.map((p, i) => (
                            <div key={p.id} className="flex items-center justify-between text-xs bg-zinc-800 rounded px-2 py-1">
                                <span className="text-zinc-300">Particle {i + 1}</span>
                                <span className="text-zinc-500">({p.x}, {p.y})</span>
                                <button
                                    onClick={() => particleOverlay.removeParticle(p.id)}
                                    className="text-red-400 hover:text-red-300"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

interface PixelEditorProps {
    imageUrl: string;
    onSave: (imageData: Blob) => Promise<void>;
    onClose: () => void;
    prevFrameUrl?: string;
    nextFrameUrl?: string;
}

// Main content component that uses context
function PixelEditorContent() {
    const ctx = usePixelEditorContext();

    const {
        editorState,
        canvasState,
        historyManager,
        clipboardManager,
        canvasOps,
        layerSystem,
        selectionTools,
        updateDisplay,

        // Advanced features
        colorRamp,
        colorHarmony,
        paletteExtraction,
        tilePreview,
        seamlessTile,
        outlineGenerator,
        pixelScaling,
        imageEffects,
        advancedTransform,
        palette,
        setPalette,
        handleApplyToCanvas,
        handlePreviewEffect,
        handleCancelPreview,
        handleStartPreview,
        prevFrameUrl,
        nextFrameUrl,
        animation,
        hitStopPreview,
        particleOverlay,
    } = ctx;

    const {
        showLayerPanel,
        activeFeatureCategory,
        setActiveFeatureCategory,
        pixelPerfectEnabled,
        setPixelPerfectEnabled,
        shadingModeEnabled,
        setShadingModeEnabled,
        shadeSteps,
        setShadeSteps,
        color,
        setColor,
        showResizeModal,
        setShowResizeModal,
        showColorSwap,
        setShowColorSwap,
        swapFromColor,
        setSwapFromColor,
        swapToColor,
        setSwapToColor,
        wandTolerance,
        setWandTolerance,
        wandContiguous,
        setWandContiguous,
        onionSkinEnabled,
        setOnionSkinEnabled,
        onionSkinOpacity,
        setOnionSkinOpacity,
        showTimeline,
        setShowTimeline,
    } = editorState;

    // VFX Panel state
    const [showVfxPanel, setShowVfxPanel] = React.useState(false);

    const { imageWidth, imageHeight, canvasRef } = canvasState;
    const { selection, clipboard, copySelection, cutSelection, pasteClipboard } = clipboardManager;
    const { saveToHistory, undo, redo } = historyManager;

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.metaKey || e.ctrlKey) {
                if (e.key === "z") {
                    e.preventDefault();
                    if (e.shiftKey) {
                        redo();
                    } else {
                        undo();
                    }
                }
                if (e.key === "c" && selection) {
                    e.preventDefault();
                    copySelection();
                }
                if (e.key === "x" && selection) {
                    e.preventDefault();
                    cutSelection();
                }
                if (e.key === "v" && clipboard) {
                    e.preventDefault();
                    pasteClipboard();
                }
            }

            // Tool shortcuts
            if (e.key === "p") editorState.setTool("pencil");
            if (e.key === "e") editorState.setTool("eraser");
            if (e.key === "i") editorState.setTool("eyedropper");
            if (e.key === "f") editorState.setTool("fill");
            if (e.key === "l") editorState.setTool("line");
            if (e.key === "s") editorState.setTool("select");
            if (e.key === "w") editorState.setTool("wand");
            if (e.key === "r") editorState.setTool("rect");
            if (e.key === "c" && !e.metaKey && !e.ctrlKey) editorState.setTool("circle");
            if (e.key === "d") editorState.setTool("dither");
            if (e.key === "h") editorState.setTool("shade");
            if (e.key === "g") editorState.setShowGrid(prev => !prev);
            if (e.key === "m") editorState.setMirrorMode(prev =>
                prev === "none" ? "h" : prev === "h" ? "v" : prev === "v" ? "both" : "none"
            );
            if (e.key === "Escape") {
                clipboardManager.clearSelection();
                selectionTools.clearSelection();
                updateDisplay();
            }

            // Delete selected pixels
            if (e.key === "Delete" || e.key === "Backspace") {
                if (selectionTools.selectionMask) {
                    const activeLayer = layerSystem.getActiveLayer();
                    if (activeLayer?.canvas) {
                        selectionTools.deleteSelected(activeLayer.canvas);
                        updateDisplay();
                        saveToHistory();
                    }
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [undo, redo, selection, clipboard, copySelection, cutSelection, pasteClipboard, selectionTools, updateDisplay, layerSystem, saveToHistory, clipboardManager, editorState]);

    return (
        <div className="fixed inset-0 flex flex-col z-50" style={{ background: 'var(--pe-bg-deep, #0a0a0f)' }}>
            <EditorHeader />

            <div className="flex flex-1 overflow-hidden">
                {/* Left Toolbar */}
                <EditorToolbar />

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    {/* Secondary Toolbar */}
                    <div className="pe-secondary-toolbar flex items-center gap-3 px-4 py-2 border-b border-white/10">
                        {/* Selection Actions */}
                        {selectionTools.selectionMask && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => { selectionTools.growSelection(1); updateDisplay(); }}
                                    className="pe-tool-btn pe-tool-btn-sm"
                                    title="Grow Selection"
                                >
                                    +
                                </button>
                                <button
                                    onClick={() => { selectionTools.shrinkSelection(1); updateDisplay(); }}
                                    className="pe-tool-btn pe-tool-btn-sm"
                                    title="Shrink Selection"
                                >
                                    −
                                </button>
                                <button
                                    onClick={() => { selectionTools.invertSelection(); updateDisplay(); }}
                                    className="pe-tool-btn pe-tool-btn-sm"
                                    title="Invert Selection"
                                >
                                    ⊘
                                </button>
                                <button
                                    onClick={() => {
                                        const activeLayer = layerSystem.getActiveLayer();
                                        if (activeLayer?.canvas) {
                                            selectionTools.deleteSelected(activeLayer.canvas);
                                            updateDisplay();
                                            saveToHistory();
                                        }
                                    }}
                                    className="pe-tool-btn pe-tool-btn-sm text-red-400"
                                    title="Delete Selected (Del)"
                                >
                                    🗑
                                </button>
                                <button
                                    onClick={() => {
                                        const activeLayer = layerSystem.getActiveLayer();
                                        if (activeLayer?.canvas) {
                                            selectionTools.fillSelected(activeLayer.canvas, color);
                                            updateDisplay();
                                            saveToHistory();
                                        }
                                    }}
                                    className="pe-tool-btn pe-tool-btn-sm"
                                    title="Fill Selected"
                                >
                                    🪣
                                </button>
                                <button
                                    onClick={() => {
                                        selectionTools.clearSelection();
                                        clipboardManager.clearSelection();
                                        updateDisplay();
                                    }}
                                    className="pe-tool-btn pe-tool-btn-sm"
                                    title="Clear Selection (Esc)"
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        {/* Canvas Size */}
                        <button
                            onClick={() => setShowResizeModal(true)}
                            className="pe-btn pe-btn-secondary flex items-center gap-2"
                            title="Resize Canvas"
                        >
                            <Maximize2 className="w-4 h-4" />
                            <span className="text-xs">{imageWidth}×{imageHeight}</span>
                        </button>

                        <div className="pe-divider" />

                        {/* Feature Panels */}
                        <button
                            onClick={() => setActiveFeatureCategory(prev => prev === 'drawing-color' ? null : 'drawing-color')}
                            className={`pe-tool-btn pe-tool-btn-sm ${activeFeatureCategory === 'drawing-color' ? "active" : ""}`}
                            title="Drawing & Color Features"
                        >
                            <Sparkles className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setActiveFeatureCategory(prev => prev === 'tiling-patterns' ? null : 'tiling-patterns')}
                            className={`pe-tool-btn pe-tool-btn-sm ${activeFeatureCategory === 'tiling-patterns' ? "active" : ""}`}
                            title="Tiling & Patterns"
                        >
                            <Grid3X3 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setActiveFeatureCategory(prev => prev === 'transform' ? null : 'transform')}
                            className={`pe-tool-btn pe-tool-btn-sm ${activeFeatureCategory === 'transform' ? "active" : ""}`}
                            title="Transform"
                        >
                            <Wand2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setActiveFeatureCategory(prev => prev === 'effects' ? null : 'effects')}
                            className={`pe-tool-btn pe-tool-btn-sm ${activeFeatureCategory === 'effects' ? "active" : ""}`}
                            title="Effects"
                        >
                            <SunMedium className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setActiveFeatureCategory(prev => prev === 'selection' ? null : 'selection')}
                            className={`pe-tool-btn pe-tool-btn-sm ${activeFeatureCategory === 'selection' ? "active" : ""}`}
                            title="Selection Tools"
                        >
                            <Scissors className="w-4 h-4" />
                        </button>

                        <div className="pe-divider" />

                        {/* Quick Transform Actions */}
                        <button
                            onClick={() => {
                                const activeLayer = layerSystem.getActiveLayer();
                                if (activeLayer?.canvas) {
                                    const result = advancedTransform.flipHorizontal(activeLayer.canvas);
                                    const ctx = activeLayer.canvas.getContext('2d');
                                    if (ctx) {
                                        ctx.clearRect(0, 0, activeLayer.canvas.width, activeLayer.canvas.height);
                                        ctx.drawImage(result, 0, 0);
                                        updateDisplay();
                                        saveToHistory();
                                    }
                                }
                            }}
                            className="pe-tool-btn pe-tool-btn-sm"
                            title="Flip Canvas Horizontal"
                        >
                            <FlipHorizontal className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => {
                                const activeLayer = layerSystem.getActiveLayer();
                                if (activeLayer?.canvas) {
                                    const result = advancedTransform.flipVertical(activeLayer.canvas);
                                    const ctx = activeLayer.canvas.getContext('2d');
                                    if (ctx) {
                                        ctx.clearRect(0, 0, activeLayer.canvas.width, activeLayer.canvas.height);
                                        ctx.drawImage(result, 0, 0);
                                        updateDisplay();
                                        saveToHistory();
                                    }
                                }
                            }}
                            className="pe-tool-btn pe-tool-btn-sm"
                            title="Flip Canvas Vertical"
                        >
                            <FlipVertical className="w-4 h-4" />
                        </button>

                        {/* Color Swap Button */}
                        <button
                            onClick={() => setShowColorSwap(true)}
                            className="pe-tool-btn pe-tool-btn-sm"
                            title="Color Swap"
                        >
                            <Palette className="w-4 h-4" />
                        </button>

                        {/* Onion Skinning */}
                        {(prevFrameUrl || nextFrameUrl) && (
                            <OnionSkinControls
                                enabled={onionSkinEnabled}
                                onToggle={() => setOnionSkinEnabled(!onionSkinEnabled)}
                                opacity={onionSkinOpacity}
                                onOpacityChange={setOnionSkinOpacity}
                                hasPrevFrame={!!prevFrameUrl}
                                hasNextFrame={!!nextFrameUrl}
                            />
                        )}

                        {/* Clipboard Actions */}
                        {selection && (
                            <div className="flex items-center gap-1 ml-auto">
                                <button onClick={copySelection} className="pe-tool-btn pe-tool-btn-sm" title="Copy (Cmd+C)">
                                    <Copy className="w-4 h-4" />
                                </button>
                                <button onClick={cutSelection} className="pe-tool-btn pe-tool-btn-sm" title="Cut (Cmd+X)">
                                    <Scissors className="w-4 h-4" />
                                </button>
                                {clipboard && (
                                    <button onClick={pasteClipboard} className="pe-tool-btn pe-tool-btn-sm" title="Paste (Cmd+V)">
                                        <ClipboardPaste className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Canvas + Right Panels Row */}
                    <div className="flex flex-1 overflow-hidden">
                        <EditorCanvas />

                        {/* Right Sidebar */}
                        <div className="flex flex-row h-full">
                            {/* Advanced Features Panel */}
                            {activeFeatureCategory && (
                                <div className="w-64 border-l border-white/10 bg-zinc-900/50">
                                    <AdvancedFeaturesPanel
                                        category={activeFeatureCategory}
                                        onClose={() => setActiveFeatureCategory(null)}
                                        pixelPerfectEnabled={pixelPerfectEnabled}
                                        setPixelPerfectEnabled={setPixelPerfectEnabled}
                                        shadingModeEnabled={shadingModeEnabled}
                                        setShadingModeEnabled={setShadingModeEnabled}
                                        shadeSteps={shadeSteps}
                                        setShadeSteps={setShadeSteps}
                                        color={color}
                                        setColor={setColor}
                                        palette={palette}
                                        setPalette={setPalette}
                                        canvasRef={canvasRef}
                                        colorRamp={colorRamp}
                                        colorHarmony={colorHarmony}
                                        paletteExtraction={paletteExtraction}
                                        tilePreview={tilePreview}
                                        seamlessTile={seamlessTile}
                                        outlineGenerator={outlineGenerator}
                                        pixelScaling={pixelScaling}
                                        onApplyToCanvas={handleApplyToCanvas}
                                        onPreviewEffect={handlePreviewEffect}
                                        onCancelPreview={handleCancelPreview}
                                        onStartPreview={handleStartPreview}
                                        advancedTransform={advancedTransform}
                                        selectionTools={selectionTools}
                                        wandTolerance={wandTolerance}
                                        setWandTolerance={setWandTolerance}
                                        wandContiguous={wandContiguous}
                                        setWandContiguous={setWandContiguous}
                                        currentFrameIndex={animation.currentFrameIndex}
                                        imageEffects={imageEffects}
                                    />
                                </div>
                            )}

                            {/* Layer Manager */}
                            {showLayerPanel && (
                                <LayerManager
                                    layers={layerSystem.layers}
                                    activeLayerId={layerSystem.activeLayerId}
                                    onSelectLayer={layerSystem.setActiveLayerId}
                                    onAddLayer={layerSystem.addLayer}
                                    onDeleteLayer={layerSystem.deleteLayer}
                                    onDuplicateLayer={layerSystem.duplicateLayer}
                                    onMoveLayer={layerSystem.moveLayer}
                                    onToggleVisibility={layerSystem.toggleVisibility}
                                    onToggleLock={layerSystem.toggleLock}
                                    onSetOpacity={layerSystem.setOpacity}
                                    onSetBlendMode={layerSystem.setBlendMode}
                                    onRenameLayer={layerSystem.renameLayer}
                                    onMergeDown={layerSystem.mergeDown}
                                    onFlattenAll={layerSystem.flattenAll}
                                />
                            )}
                        </div>
                    </div>

                    {/* Animation Timeline */}
                    {showTimeline && (
                        <AnimationTimeline
                            frames={animation.frames}
                            currentFrameIndex={animation.currentFrameIndex}
                            isPlaying={animation.isPlaying}
                            fps={animation.fps}
                            loop={animation.loop}
                            onPlay={animation.play}
                            onPause={animation.pause}
                            onStop={animation.stop}
                            onTogglePlayPause={animation.togglePlayPause}
                            onGoToFrame={animation.goToFrame}
                            onNextFrame={animation.nextFrame}
                            onPrevFrame={animation.prevFrame}
                            onGoToFirstFrame={animation.goToFirstFrame}
                            onGoToLastFrame={animation.goToLastFrame}
                            onAddFrame={() => animation.addFrame()}
                            onDeleteFrame={animation.deleteFrame}
                            onDuplicateFrame={animation.duplicateFrame}
                            onMoveFrame={animation.moveFrame}
                            onSetFps={animation.setFps}
                            onSetLoop={animation.setLoop}
                            onSetFrameDuration={animation.setFrameDuration}
                            // Hit-Stop Props
                            impactFrames={hitStopPreview.impactFrames}
                            onToggleImpactFrame={hitStopPreview.toggleImpactFrame}
                            hitStopEnabled={hitStopPreview.config.enabled}
                            isPreviewPlaying={hitStopPreview.isPreviewPlaying}
                            onStartHitStopPreview={hitStopPreview.startPreview}
                            onStopHitStopPreview={hitStopPreview.stopPreview}
                            // Open VFX panel callback
                            onOpenVfxPanel={() => setShowVfxPanel(true)}
                        />
                    )}

                    {/* Effect Timeline - Below Animation Timeline */}
                    {showTimeline && ctx.effectLayers.layers.length > 0 && (
                        <EffectTimeline
                            layers={ctx.effectLayers.layers}
                            currentFrame={animation.currentFrameIndex}
                            totalFrames={animation.frames.length}
                            onLayerToggle={ctx.effectLayers.toggleLayerVisibility}
                            onLayerDelete={ctx.effectLayers.removeLayer}
                            onEventSelect={(event) => console.log('Selected effect:', event)}
                            onEventDelete={ctx.effectLayers.removeEvent}
                            onAddEvent={(layerId, frame) => {
                                // Add a default effect - could be enhanced with preset picker state
                                ctx.effectLayers.addEvent(layerId, 'impact_spark', frame);
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Floating VFX Panel with Tabs */}
            <FloatingPanel
                title="Game Feel VFX"
                icon={<Gamepad2 className="w-5 h-5 text-yellow-500" />}
                isOpen={showVfxPanel}
                onClose={() => setShowVfxPanel(false)}
                defaultPosition={{ x: window.innerWidth - 380, y: 100 }}
                width={360}
            >
                <VfxPanelContent
                    hitStopPreview={hitStopPreview}
                    particleOverlay={particleOverlay}
                    smearEffect={ctx.smearEffect}
                    breakEffect={ctx.breakEffect}
                    fluidParticles={ctx.fluidParticles}
                    fluidGrid={ctx.fluidGrid}
                    canvasRef={canvasRef}
                    layerSystem={layerSystem}
                    canvasState={ctx.canvasState}
                    animation={animation}
                    updateDisplay={updateDisplay}
                />
            </FloatingPanel>

            {/* Color Swap Modal */}
            {
                showColorSwap && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60">
                        <div className="bg-zinc-800 rounded-xl p-6 border border-zinc-600 min-w-[300px]">
                            <h3 className="text-lg font-semibold mb-4">Color Swap</h3>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="flex flex-col items-center gap-2">
                                    <span className="text-xs text-zinc-400">From</span>
                                    <input
                                        type="color"
                                        value={swapFromColor}
                                        onChange={(e) => setSwapFromColor(e.target.value)}
                                        className="w-12 h-12 rounded cursor-pointer"
                                    />
                                </div>
                                <span className="text-2xl">→</span>
                                <div className="flex flex-col items-center gap-2">
                                    <span className="text-xs text-zinc-400">To</span>
                                    <input
                                        type="color"
                                        value={swapToColor}
                                        onChange={(e) => setSwapToColor(e.target.value)}
                                        className="w-12 h-12 rounded cursor-pointer"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={() => setShowColorSwap(false)} className="flex-1">Cancel</Button>
                                <Button onClick={() => { canvasOps.colorSwap(swapFromColor, swapToColor); setShowColorSwap(false); }} className="flex-1">Swap Colors</Button>
                            </div>
                        </div>
                    </div>
                )
            }

            <CanvasResizeModal
                isOpen={showResizeModal}
                onClose={() => setShowResizeModal(false)}
                currentWidth={imageWidth}
                currentHeight={imageHeight}
                onResize={canvasOps.resizeCanvas}
            />

            {/* Footer with keyboard shortcuts */}
            <EditorFooter />
        </div >
    );
}

// Main export - wraps content with provider
export function PixelEditor({ imageUrl, onSave, onClose, prevFrameUrl, nextFrameUrl }: PixelEditorProps) {
    return (
        <PixelEditorProvider
            imageUrl={imageUrl}
            onSave={onSave}
            onClose={onClose}
            prevFrameUrl={prevFrameUrl}
            nextFrameUrl={nextFrameUrl}
        >
            <PixelEditorContent />
        </PixelEditorProvider>
    );
}

// Keep default export for backward compatibility
export default PixelEditor;
