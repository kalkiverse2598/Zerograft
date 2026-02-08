"use client";

import React, { useState } from "react";
import { usePixelEditorContext } from "./PixelEditorProvider";
import {
    Download,
    FileImage,
    FolderArchive,
    Film,
    Grid3X3,
    LayoutGrid,
    ChevronDown,
    Rows3,
    Columns3,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ImportExportMenu() {
    const {
        canvasState,
        animation,
    } = usePixelEditorContext();

    const [isExporting, setIsExporting] = useState(false);

    // Lazy import the hook to avoid circular dependencies
    const handleExportCurrentFrame = async () => {
        setIsExporting(true);
        try {
            const canvas = canvasState.canvasRef.current;
            if (!canvas) return;

            const blob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob(resolve, 'image/png');
            });

            if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `frame_${animation.currentFrameIndex + 1}_${Date.now()}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportAllFramesAsZip = async () => {
        setIsExporting(true);
        try {
            const { frames } = animation;
            if (frames.length === 0) return;

            const JSZip = (await import('jszip')).default;
            const zip = new JSZip();
            const folder = zip.folder('animation');
            if (!folder) return;

            for (let i = 0; i < frames.length; i++) {
                const frame = frames[i];
                if (!frame.imageData) continue;

                // Create canvas from ImageData
                const canvas = document.createElement('canvas');
                canvas.width = frame.imageData.width;
                canvas.height = frame.imageData.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) continue;
                ctx.putImageData(frame.imageData, 0, 0);

                const blob = await new Promise<Blob | null>((resolve) => {
                    canvas.toBlob(resolve, 'image/png');
                });

                if (blob) {
                    const paddedIndex = String(i + 1).padStart(3, '0');
                    folder.file(`frame_${paddedIndex}.png`, blob);
                }
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `animation_frames_${Date.now()}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportAsGif = async (gifFps: number = 12) => {
        setIsExporting(true);
        try {
            const { frames } = animation;
            if (frames.length === 0) return;

            // Dynamically import gif.js (we'll use a simpler approach - encode to GIF via canvas)
            // Since gif.js requires workers, we'll create a simple GIF using the GIFEncoder approach
            // For now, create individual PNGs and bundle them for the user to convert
            // OR use a simpler approach: create an APNG or use backend

            // For a quick solution, we'll create a preview and offer download as spritesheet
            // In a full implementation, you'd use gif.js or similar

            // Use a simple approach: encode frames to base64 and create a downloadable format
            // For pixel art, we can use a custom simple GIF encoder

            // Create frame data for GIF encoding
            const frameDataUrls: string[] = [];

            for (let i = 0; i < frames.length; i++) {
                const frame = frames[i];
                if (!frame.imageData) continue;

                const canvas = document.createElement('canvas');
                canvas.width = frame.imageData.width;
                canvas.height = frame.imageData.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) continue;
                ctx.putImageData(frame.imageData, 0, 0);

                frameDataUrls.push(canvas.toDataURL('image/png'));
            }

            // Simple GIF creation using omggif (lightweight encoder)
            // Since we don't have it installed, let's use a workaround:
            // Convert to a GIF using the Canvas API and createImageBitmap

            // For now, export as an animated WebP (better browser support) or fallback to spritesheet
            // Most modern browsers support WebP animation

            // Create animated image using Canvas animation recording
            // This is a simplified approach - for production, use gif.js

            // Fallback: Create a downloadable HTML file that plays the animation
            const htmlContent = `<!DOCTYPE html>
<html>
<head><title>Animation Preview</title>
<style>
body { background: #1a1a1a; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
#animation { image-rendering: pixelated; image-rendering: crisp-edges; }
</style>
</head>
<body>
<img id="animation" />
<script>
const frames = ${JSON.stringify(frameDataUrls)};
const fps = ${gifFps};
let currentFrame = 0;
const img = document.getElementById('animation');
function animate() {
    img.src = frames[currentFrame];
    currentFrame = (currentFrame + 1) % frames.length;
    setTimeout(animate, 1000 / fps);
}
animate();
</script>
</body>
</html>`;

            // For a proper GIF, we need gif.js - let's try loading it dynamically
            try {
                // Try to use gif.js if available on window
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const GIF = (window as any).GIF;

                if (GIF) {
                    const gif = new GIF({
                        workers: 2,
                        quality: 10,
                        width: frames[0].imageData?.width || 64,
                        height: frames[0].imageData?.height || 64,
                        workerScript: '/gif.worker.js',
                    });

                    for (const frame of frames) {
                        if (!frame.imageData) continue;
                        const canvas = document.createElement('canvas');
                        canvas.width = frame.imageData.width;
                        canvas.height = frame.imageData.height;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) continue;
                        ctx.putImageData(frame.imageData, 0, 0);
                        gif.addFrame(canvas, { delay: Math.round(1000 / gifFps) });
                    }

                    gif.on('finished', (blob: Blob) => {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `animation_${Date.now()}.gif`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    });

                    gif.render();
                    return;
                }
            } catch {
                // gif.js not available, use fallback
            }

            // Fallback: Download as HTML animation preview
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `animation_preview_${Date.now()}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            alert('GIF export requires the gif.js library. Downloaded HTML preview instead.\n\nTo get a proper GIF, export frames as ZIP and use an online converter.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportSpritesheet = async (layout: 'horizontal' | 'vertical' | 'grid', columns: number = 4) => {
        setIsExporting(true);
        try {
            const { frames } = animation;
            if (frames.length === 0) return;

            // Get dimensions from first frame
            const firstFrame = frames.find(f => f.imageData);
            if (!firstFrame?.imageData) return;

            const frameWidth = firstFrame.imageData.width;
            const frameHeight = firstFrame.imageData.height;
            const padding = 0;

            // Calculate dimensions
            let cols: number, rows: number;
            switch (layout) {
                case 'horizontal':
                    cols = frames.length;
                    rows = 1;
                    break;
                case 'vertical':
                    cols = 1;
                    rows = frames.length;
                    break;
                case 'grid':
                default:
                    cols = Math.min(columns, frames.length);
                    rows = Math.ceil(frames.length / cols);
                    break;
            }

            const sheetWidth = cols * (frameWidth + padding) + padding;
            const sheetHeight = rows * (frameHeight + padding) + padding;

            // Create spritesheet canvas
            const spritesheetCanvas = document.createElement('canvas');
            spritesheetCanvas.width = sheetWidth;
            spritesheetCanvas.height = sheetHeight;
            const ctx = spritesheetCanvas.getContext('2d');
            if (!ctx) return;

            ctx.imageSmoothingEnabled = false;

            // Draw frames
            for (let i = 0; i < frames.length; i++) {
                const frame = frames[i];
                if (!frame.imageData) continue;

                const col = i % cols;
                const row = Math.floor(i / cols);
                const x = padding + col * (frameWidth + padding);
                const y = padding + row * (frameHeight + padding);

                // Create temp canvas for frame
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = frameWidth;
                tempCanvas.height = frameHeight;
                const tempCtx = tempCanvas.getContext('2d');
                if (!tempCtx) continue;
                tempCtx.putImageData(frame.imageData, 0, 0);

                ctx.drawImage(tempCanvas, x, y);
            }

            // Export
            const blob = await new Promise<Blob | null>((resolve) => {
                spritesheetCanvas.toBlob(resolve, 'image/png');
            });

            if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `spritesheet_${layout}_${frames.length}frames_${Date.now()}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    className="pe-tool-btn pe-tool-btn-sm flex items-center gap-1"
                    disabled={isExporting}
                    title="Export"
                >
                    <Download className="w-4 h-4" />
                    <ChevronDown className="w-3 h-3" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Export Options</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Export Current Frame */}
                <DropdownMenuItem onClick={handleExportCurrentFrame}>
                    <FileImage className="w-4 h-4 mr-2" />
                    Current Frame (PNG)
                </DropdownMenuItem>

                {/* Export All Frames as ZIP */}
                <DropdownMenuItem
                    onClick={handleExportAllFramesAsZip}
                    disabled={animation.frames.length <= 1}
                >
                    <FolderArchive className="w-4 h-4 mr-2" />
                    All Frames (ZIP)
                    {animation.frames.length > 1 && (
                        <span className="ml-auto text-xs text-muted-foreground">
                            {animation.frames.length} frames
                        </span>
                    )}
                </DropdownMenuItem>

                {/* Export as Animated GIF */}
                <DropdownMenuItem
                    onClick={() => handleExportAsGif(animation.fps)}
                    disabled={animation.frames.length <= 1}
                >
                    <Film className="w-4 h-4 mr-2" />
                    Animated GIF
                    {animation.frames.length > 1 && (
                        <span className="ml-auto text-xs text-muted-foreground">
                            {animation.fps} FPS
                        </span>
                    )}
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">Spritesheet</DropdownMenuLabel>

                {/* Spritesheet - Horizontal */}
                <DropdownMenuItem
                    onClick={() => handleExportSpritesheet('horizontal')}
                    disabled={animation.frames.length <= 1}
                >
                    <Columns3 className="w-4 h-4 mr-2" />
                    Horizontal Strip
                </DropdownMenuItem>

                {/* Spritesheet - Vertical */}
                <DropdownMenuItem
                    onClick={() => handleExportSpritesheet('vertical')}
                    disabled={animation.frames.length <= 1}
                >
                    <Rows3 className="w-4 h-4 mr-2" />
                    Vertical Strip
                </DropdownMenuItem>

                {/* Spritesheet - Grid */}
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger disabled={animation.frames.length <= 1}>
                        <LayoutGrid className="w-4 h-4 mr-2" />
                        Grid Layout
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => handleExportSpritesheet('grid', 2)}>
                            2 Columns
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExportSpritesheet('grid', 4)}>
                            4 Columns
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExportSpritesheet('grid', 8)}>
                            8 Columns
                        </DropdownMenuItem>
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default ImportExportMenu;
