"use client";

import React from "react";
import { usePixelEditorContext } from "./PixelEditorProvider";
import { Button } from "@/components/ui/button";
import { Sparkles, ZoomIn, ZoomOut, Undo2, Redo2, Save, X, Layers, Film } from "lucide-react";
import { ImportExportMenu } from "./ImportExportMenu";

export function EditorHeader() {
    const {
        editorState,
        historyManager,
        isSaving,
        handleSave,
        onClose,
    } = usePixelEditorContext();

    const { zoom, setZoom, showLayerPanel, setShowLayerPanel, showTimeline, setShowTimeline } = editorState;
    const { undo, redo, canUndo, canRedo } = historyManager;

    const handleZoomIn = () => setZoom(z => Math.min(z + 2, 32));
    const handleZoomOut = () => setZoom(z => Math.max(z - 2, 2));

    return (
        <div className="pe-header flex items-center justify-between px-4 py-2.5">
            <h2 className="pe-title text-lg font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Pixel Editor
            </h2>
            <div className="flex items-center gap-5">
                {/* Zoom Controls */}
                <div className="flex items-center gap-3">
                    <button onClick={handleZoomOut} className="pe-tool-btn pe-tool-btn-sm" title="Zoom Out">
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2">
                        <input
                            type="range"
                            min="2"
                            max="32"
                            step="2"
                            value={zoom}
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="pe-slider w-20"
                        />
                        <span className="pe-zoom-label min-w-[40px]">{zoom}x</span>
                    </div>
                    <button onClick={handleZoomIn} className="pe-tool-btn pe-tool-btn-sm" title="Zoom In">
                        <ZoomIn className="w-4 h-4" />
                    </button>
                </div>

                <div className="pe-divider" />

                {/* History */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={undo}
                        disabled={!canUndo}
                        className="pe-tool-btn pe-tool-btn-sm"
                        title="Undo (Cmd+Z)"
                    >
                        <Undo2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={redo}
                        disabled={!canRedo}
                        className="pe-tool-btn pe-tool-btn-sm"
                        title="Redo (Cmd+Shift+Z)"
                    >
                        <Redo2 className="w-4 h-4" />
                    </button>
                </div>

                <div className="pe-divider" />

                {/* Animation & Layers Toggles */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowTimeline(!showTimeline)}
                        className={`pe-tool-btn pe-tool-btn-sm ${showTimeline ? "active" : ""}`}
                        title="Toggle Animation Panel"
                    >
                        <Film className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setShowLayerPanel(!showLayerPanel)}
                        className={`pe-tool-btn pe-tool-btn-sm ${showLayerPanel ? "active" : ""}`}
                        title="Toggle Layers Panel"
                    >
                        <Layers className="w-4 h-4" />
                    </button>
                </div>

                <div className="pe-divider" />

                {/* Import/Export */}
                <ImportExportMenu />

                {/* Save & Close */}
                <div className="flex items-center gap-2">
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="pe-btn pe-btn-primary"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {isSaving ? "Saving..." : "Save"}
                    </Button>
                    <button onClick={onClose} className="pe-tool-btn pe-tool-btn-sm" title="Close">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
