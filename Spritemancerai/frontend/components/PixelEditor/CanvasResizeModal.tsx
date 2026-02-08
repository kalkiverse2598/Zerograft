"use client";

import { Button } from "@/components/ui/button";

interface CanvasResizeModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentWidth: number;
    currentHeight: number;
    onResize: (newWidth: number, newHeight: number, anchor: AnchorPosition) => void;
}

export type AnchorPosition = "tl" | "tc" | "tr" | "ml" | "mc" | "mr" | "bl" | "bc" | "br";

export function CanvasResizeModal({
    isOpen,
    onClose,
    currentWidth,
    currentHeight,
    onResize,
}: CanvasResizeModalProps) {
    if (!isOpen) return null;

    const [newWidth, setNewWidth] = useState(currentWidth);
    const [newHeight, setNewHeight] = useState(currentHeight);
    const [anchor, setAnchor] = useState<AnchorPosition>("mc");
    const [lockAspect, setLockAspect] = useState(false);
    const aspectRatio = currentWidth / currentHeight;

    const handleWidthChange = (w: number) => {
        setNewWidth(w);
        if (lockAspect) {
            setNewHeight(Math.round(w / aspectRatio));
        }
    };

    const handleHeightChange = (h: number) => {
        setNewHeight(h);
        if (lockAspect) {
            setNewWidth(Math.round(h * aspectRatio));
        }
    };

    const handleApply = () => {
        if (newWidth > 0 && newHeight > 0) {
            onResize(newWidth, newHeight, anchor);
            onClose();
        }
    };

    const anchorPositions: AnchorPosition[] = ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60">
            <div className="bg-zinc-800 rounded-xl p-6 border border-zinc-600 min-w-[350px]">
                <h3 className="text-lg font-semibold mb-4">Resize Canvas</h3>

                {/* Dimensions */}
                <div className="flex gap-4 mb-4">
                    <div className="flex-1">
                        <label className="text-xs text-zinc-400 block mb-1">Width</label>
                        <input
                            type="number"
                            value={newWidth}
                            onChange={(e) => handleWidthChange(Number(e.target.value))}
                            min={1}
                            max={1024}
                            className="w-full bg-zinc-700 text-white rounded px-3 py-2"
                        />
                    </div>
                    <div className="flex items-end pb-2">
                        <button
                            onClick={() => setLockAspect(!lockAspect)}
                            className={`text-lg ${lockAspect ? "text-blue-400" : "text-zinc-500"}`}
                            title={lockAspect ? "Unlock aspect ratio" : "Lock aspect ratio"}
                        >
                            {lockAspect ? "🔗" : "🔓"}
                        </button>
                    </div>
                    <div className="flex-1">
                        <label className="text-xs text-zinc-400 block mb-1">Height</label>
                        <input
                            type="number"
                            value={newHeight}
                            onChange={(e) => handleHeightChange(Number(e.target.value))}
                            min={1}
                            max={1024}
                            className="w-full bg-zinc-700 text-white rounded px-3 py-2"
                        />
                    </div>
                </div>

                {/* Anchor grid */}
                <div className="mb-4">
                    <label className="text-xs text-zinc-400 block mb-2">Anchor Position</label>
                    <div className="grid grid-cols-3 gap-1 w-24 mx-auto">
                        {anchorPositions.map((pos) => (
                            <button
                                key={pos}
                                onClick={() => setAnchor(pos)}
                                className={`w-7 h-7 rounded ${anchor === pos
                                        ? "bg-blue-500"
                                        : "bg-zinc-600 hover:bg-zinc-500"
                                    }`}
                                title={pos}
                            />
                        ))}
                    </div>
                    <p className="text-xs text-zinc-500 text-center mt-2">
                        Content will be anchored to the {anchor === "mc" ? "center" : anchor}
                    </p>
                </div>

                {/* Preview info */}
                <div className="text-sm text-zinc-400 mb-4 text-center">
                    {currentWidth}×{currentHeight} → {newWidth}×{newHeight}
                    {newWidth > currentWidth || newHeight > currentHeight ? (
                        <span className="text-green-400 ml-2">↑ expanding</span>
                    ) : newWidth < currentWidth || newHeight < currentHeight ? (
                        <span className="text-orange-400 ml-2">↓ cropping</span>
                    ) : (
                        <span className="text-zinc-500 ml-2">no change</span>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={onClose} className="flex-1">
                        Cancel
                    </Button>
                    <Button onClick={handleApply} className="flex-1">
                        Apply
                    </Button>
                </div>
            </div>
        </div>
    );
}

// Import statement needed
import { useState } from "react";
