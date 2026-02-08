"use client";

import React from "react";
import { usePixelEditorContext } from "./PixelEditorProvider";

export function EditorFooter() {
    const { canvasState, clipboardManager } = usePixelEditorContext();
    const { imageWidth, imageHeight } = canvasState;
    const { selection } = clipboardManager;

    return (
        <div className="pe-footer px-4 py-2 flex justify-between items-center">
            <div className="pe-footer-text">
                <span className="pe-footer-highlight">{imageWidth}×{imageHeight}px</span>
                <span className="opacity-40">|</span>
                <span>P E I F L S R C D H W G M</span>
                <span className="opacity-40">|</span>
                <span>Cmd+Z/X/C/V</span>
                <span className="opacity-40">|</span>
                <span>⌘+Scroll=Zoom</span>
            </div>
            <div className="pe-footer-text">
                {selection && (
                    <span className="pe-footer-highlight">
                        Selection: {selection.width}×{selection.height}px
                    </span>
                )}
            </div>
        </div>
    );
}
