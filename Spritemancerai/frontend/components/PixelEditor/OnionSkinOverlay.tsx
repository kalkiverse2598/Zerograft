"use client";

import { useEffect, useState } from "react";

interface OnionSkinProps {
    prevFrameUrl?: string;
    nextFrameUrl?: string;
    enabled: boolean;
    opacity: number;
    zoom: number;
    canvasWidth: number;
    canvasHeight: number;
}

export function OnionSkinOverlay({
    prevFrameUrl,
    nextFrameUrl,
    enabled,
    opacity,
    zoom,
    canvasWidth,
    canvasHeight,
}: OnionSkinProps) {
    const [prevImage, setPrevImage] = useState<HTMLImageElement | null>(null);
    const [nextImage, setNextImage] = useState<HTMLImageElement | null>(null);

    // Load previous frame image
    useEffect(() => {
        if (!prevFrameUrl || !enabled) {
            setPrevImage(null);
            return;
        }

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => setPrevImage(img);
        img.onerror = () => setPrevImage(null);
        img.src = prevFrameUrl;
    }, [prevFrameUrl, enabled]);

    // Load next frame image
    useEffect(() => {
        if (!nextFrameUrl || !enabled) {
            setNextImage(null);
            return;
        }

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => setNextImage(img);
        img.onerror = () => setNextImage(null);
        img.src = nextFrameUrl;
    }, [nextFrameUrl, enabled]);

    if (!enabled || (!prevImage && !nextImage)) {
        return null;
    }

    const style = {
        width: canvasWidth * zoom,
        height: canvasHeight * zoom,
        imageRendering: "pixelated" as const,
        pointerEvents: "none" as const,
    };

    return (
        <div className="absolute inset-0 pointer-events-none">
            {/* Previous frame - red tint */}
            {prevImage && (
                <img
                    src={prevFrameUrl}
                    alt="Previous frame"
                    className="absolute top-0 left-0"
                    style={{
                        ...style,
                        opacity,
                        filter: "sepia(100%) saturate(2) hue-rotate(-50deg)",
                        mixBlendMode: "multiply",
                    }}
                />
            )}

            {/* Next frame - blue tint */}
            {nextImage && (
                <img
                    src={nextFrameUrl}
                    alt="Next frame"
                    className="absolute top-0 left-0"
                    style={{
                        ...style,
                        opacity,
                        filter: "sepia(100%) saturate(2) hue-rotate(150deg)",
                        mixBlendMode: "multiply",
                    }}
                />
            )}
        </div>
    );
}

// Controls for onion skinning
interface OnionSkinControlsProps {
    enabled: boolean;
    onToggle: () => void;
    opacity: number;
    onOpacityChange: (opacity: number) => void;
    hasPrevFrame: boolean;
    hasNextFrame: boolean;
}

export function OnionSkinControls({
    enabled,
    onToggle,
    opacity,
    onOpacityChange,
    hasPrevFrame,
    hasNextFrame,
}: OnionSkinControlsProps) {
    if (!hasPrevFrame && !hasNextFrame) {
        return null;
    }

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={onToggle}
                className={`px-2 py-1 rounded text-sm ${enabled ? "bg-purple-600 text-white" : "bg-zinc-700 text-zinc-400"
                    }`}
                title="Toggle onion skinning"
            >
                👻 {enabled ? "On" : "Off"}
            </button>
            {enabled && (
                <input
                    type="range"
                    min="0.1"
                    max="0.7"
                    step="0.1"
                    value={opacity}
                    onChange={(e) => onOpacityChange(Number(e.target.value))}
                    className="w-16 h-1"
                    title={`Opacity: ${Math.round(opacity * 100)}%`}
                />
            )}
        </div>
    );
}
