"use client";

import React, { useState, useRef, useEffect } from 'react';
import { AnimationFrame } from '@/lib/pixelEditor/useAnimationPlayback';
import {
    Play,
    Pause,
    Square,
    SkipBack,
    SkipForward,
    ChevronLeft,
    ChevronRight,
    Plus,
    Copy,
    Trash2,
    Repeat,
    Clock,
    Zap,
    Gamepad2,
} from 'lucide-react';
import './AnimationTimeline.css';

interface AnimationTimelineProps {
    frames: AnimationFrame[];
    currentFrameIndex: number;
    isPlaying: boolean;
    fps: number;
    loop: boolean;
    onPlay: () => void;
    onPause: () => void;
    onStop: () => void;
    onTogglePlayPause: () => void;
    onGoToFrame: (index: number) => void;
    onNextFrame: () => void;
    onPrevFrame: () => void;
    onGoToFirstFrame: () => void;
    onGoToLastFrame: () => void;
    onAddFrame: () => void;
    onDeleteFrame: (id: string) => void;
    onDuplicateFrame: (id: string) => void;
    onMoveFrame: (id: string, newIndex: number) => void;
    onSetFps: (fps: number) => void;
    onSetLoop: (loop: boolean) => void;
    onSetFrameDuration: (id: string, duration: number) => void;
    // Hit-Stop support
    impactFrames?: Set<number>;
    onToggleImpactFrame?: (index: number) => void;
    hitStopEnabled?: boolean;
    isPreviewPlaying?: boolean;
    onStartHitStopPreview?: () => void;
    onStopHitStopPreview?: () => void;
    // VFX Panel
    onOpenVfxPanel?: () => void;
}

const FPS_PRESETS = [6, 8, 10, 12, 15, 24, 30, 60];

export function AnimationTimeline({
    frames,
    currentFrameIndex,
    isPlaying,
    fps,
    loop,
    onPlay,
    onPause,
    onStop,
    onTogglePlayPause,
    onGoToFrame,
    onNextFrame,
    onPrevFrame,
    onGoToFirstFrame,
    onGoToLastFrame,
    onAddFrame,
    onDeleteFrame,
    onDuplicateFrame,
    onMoveFrame,
    onSetFps,
    onSetLoop,
    onSetFrameDuration,
    // Hit-Stop props
    impactFrames,
    onToggleImpactFrame,
    hitStopEnabled,
    isPreviewPlaying,
    onStartHitStopPreview,
    onStopHitStopPreview,
    onOpenVfxPanel,
}: AnimationTimelineProps) {
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [contextMenuFrame, setContextMenuFrame] = useState<{ index: number; x: number; y: number } | null>(null);
    const frameListRef = useRef<HTMLDivElement>(null);

    const currentFrame = frames[currentFrameIndex];

    // Auto-scroll to current frame during playback
    useEffect(() => {
        if (isPlaying && frameListRef.current) {
            const frameElements = frameListRef.current.querySelectorAll('.timeline-frame');
            const currentEl = frameElements[currentFrameIndex] as HTMLElement;
            if (currentEl) {
                currentEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [currentFrameIndex, isPlaying]);

    const handleDragStart = (e: React.DragEvent, frameId: string) => {
        setDraggedId(frameId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        setDragOverIndex(index);
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        if (draggedId) {
            onMoveFrame(draggedId, targetIndex);
        }
        setDraggedId(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedId(null);
        setDragOverIndex(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === ' ') {
            e.preventDefault();
            onTogglePlayPause();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            onPrevFrame();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            onNextFrame();
        } else if (e.key === 'Escape') {
            setContextMenuFrame(null);
        }
    };

    const handleFrameContextMenu = (e: React.MouseEvent, index: number) => {
        e.preventDefault();
        setContextMenuFrame({ index, x: e.clientX, y: e.clientY });
    };

    // Close context menu on outside click
    useEffect(() => {
        const handleClick = () => setContextMenuFrame(null);
        if (contextMenuFrame) {
            document.addEventListener('click', handleClick);
            return () => document.removeEventListener('click', handleClick);
        }
    }, [contextMenuFrame]);

    return (
        <div className="animation-timeline" onKeyDown={handleKeyDown} tabIndex={0}>
            {/* Controls Row */}
            <div className="timeline-controls">
                {/* Playback Controls */}
                <div className="timeline-playback">
                    <button
                        onClick={onGoToFirstFrame}
                        className="timeline-btn"
                        title="Go to First Frame"
                        disabled={frames.length <= 1}
                    >
                        <SkipBack className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onPrevFrame}
                        className="timeline-btn"
                        title="Previous Frame (←)"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onTogglePlayPause}
                        className="timeline-btn timeline-btn-play"
                        title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                    >
                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                    <button
                        onClick={onStop}
                        className="timeline-btn"
                        title="Stop"
                    >
                        <Square className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onNextFrame}
                        className="timeline-btn"
                        title="Next Frame (→)"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onGoToLastFrame}
                        className="timeline-btn"
                        title="Go to Last Frame"
                        disabled={frames.length <= 1}
                    >
                        <SkipForward className="w-4 h-4" />
                    </button>
                </div>

                {/* Divider */}
                <div className="timeline-divider" />

                {/* FPS Control */}
                <div className="timeline-fps">
                    <Clock className="w-3 h-3" />
                    <select
                        value={fps}
                        onChange={(e) => onSetFps(parseInt(e.target.value))}
                        className="timeline-fps-select"
                    >
                        {FPS_PRESETS.map(f => (
                            <option key={f} value={f}>{f} FPS</option>
                        ))}
                    </select>
                </div>

                {/* Loop Toggle */}
                <button
                    onClick={() => onSetLoop(!loop)}
                    className={`timeline-btn ${loop ? 'active' : ''}`}
                    title={loop ? "Loop On" : "Loop Off"}
                >
                    <Repeat className="w-4 h-4" />
                </button>

                {/* Divider */}
                <div className="timeline-divider" />

                {/* Frame Info */}
                <div className="timeline-info">
                    <span className="timeline-frame-counter">
                        {currentFrameIndex + 1} / {frames.length}
                    </span>
                </div>

                {/* Game Feel Preview Button */}
                {onStartHitStopPreview && onStopHitStopPreview && (
                    <>
                        <div className="timeline-divider" />
                        {/* VFX Settings Button */}
                        {onOpenVfxPanel && (
                            <button
                                onClick={onOpenVfxPanel}
                                className="timeline-btn timeline-btn-vfx"
                                title="Open Game Feel VFX Settings"
                            >
                                <Gamepad2 className="w-4 h-4" />
                            </button>
                        )}
                        {/* Preview Button */}
                        <button
                            onClick={isPreviewPlaying ? onStopHitStopPreview : onStartHitStopPreview}
                            className={`timeline-btn ${hitStopEnabled ? 'timeline-btn-vfx' : ''} ${isPreviewPlaying ? 'active' : ''}`}
                            title={isPreviewPlaying ? "Stop Game Feel Preview" : "Preview with Effects"}
                            disabled={!hitStopEnabled || (impactFrames?.size ?? 0) === 0}
                        >
                            {isPreviewPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                    </>
                )}

                {/* Divider */}
                <div className="timeline-divider" />
                <div className="timeline-actions">
                    <button
                        onClick={onAddFrame}
                        className="timeline-btn"
                        title="Add Frame"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => currentFrame && onDuplicateFrame(currentFrame.id)}
                        className="timeline-btn"
                        title="Duplicate Frame"
                        disabled={!currentFrame}
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => currentFrame && onDeleteFrame(currentFrame.id)}
                        className="timeline-btn timeline-btn-delete"
                        title="Delete Frame"
                        disabled={frames.length <= 1 || !currentFrame}
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Frame Strip */}
            <div className="timeline-frames" ref={frameListRef}>
                {frames.map((frame, index) => {
                    const isActive = index === currentFrameIndex;
                    const isDragging = frame.id === draggedId;
                    const isDragOver = dragOverIndex === index;
                    const isImpact = impactFrames?.has(index) ?? false;

                    return (
                        <div
                            key={frame.id}
                            className={`timeline-frame ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''} ${isImpact ? 'impact' : ''}`}
                            onClick={() => onGoToFrame(index)}
                            onContextMenu={(e) => handleFrameContextMenu(e, index)}
                            draggable
                            onDragStart={(e) => handleDragStart(e, frame.id)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={(e) => handleDrop(e, index)}
                            onDragEnd={handleDragEnd}
                        >
                            {/* Impact Indicator */}
                            {isImpact && (
                                <div className="timeline-frame-impact">
                                    <Zap className="w-3 h-3" />
                                </div>
                            )}
                            {/* Frame Thumbnail */}
                            <div className="timeline-frame-thumbnail">
                                {frame.imageData ? (
                                    <canvas
                                        width={48}
                                        height={48}
                                        ref={(el) => {
                                            if (el && frame.imageData) {
                                                const ctx = el.getContext('2d');
                                                if (ctx) {
                                                    ctx.imageSmoothingEnabled = false;
                                                    // Draw checkerboard
                                                    ctx.fillStyle = '#444';
                                                    ctx.fillRect(0, 0, 48, 48);
                                                    ctx.fillStyle = '#555';
                                                    for (let y = 0; y < 6; y++) {
                                                        for (let x = 0; x < 6; x++) {
                                                            if ((x + y) % 2 === 0) {
                                                                ctx.fillRect(x * 8, y * 8, 8, 8);
                                                            }
                                                        }
                                                    }
                                                    // Draw frame content scaled to fit
                                                    const scale = Math.min(48 / frame.imageData.width, 48 / frame.imageData.height);
                                                    const w = frame.imageData.width * scale;
                                                    const h = frame.imageData.height * scale;
                                                    const offX = (48 - w) / 2;
                                                    const offY = (48 - h) / 2;

                                                    const tempCanvas = document.createElement('canvas');
                                                    tempCanvas.width = frame.imageData.width;
                                                    tempCanvas.height = frame.imageData.height;
                                                    const tempCtx = tempCanvas.getContext('2d')!;
                                                    tempCtx.putImageData(frame.imageData, 0, 0);

                                                    ctx.drawImage(tempCanvas, offX, offY, w, h);
                                                }
                                            }
                                        }}
                                        style={{ width: 48, height: 48, imageRendering: 'pixelated' }}
                                    />
                                ) : (
                                    <div className="timeline-frame-empty">
                                        {index + 1}
                                    </div>
                                )}
                            </div>

                            {/* Frame Number */}
                            <div className="timeline-frame-number">{index + 1}</div>

                            {/* Duration Badge */}
                            <div className="timeline-frame-duration">
                                {frame.duration}ms
                            </div>
                        </div>
                    );
                })}

                {/* Add Frame Button at End */}
                <button
                    className="timeline-add-frame"
                    onClick={onAddFrame}
                    title="Add Frame"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            {/* Context Menu */}
            {contextMenuFrame && onToggleImpactFrame && (
                <div
                    className="timeline-context-menu"
                    style={{ left: contextMenuFrame.x, top: contextMenuFrame.y }}
                >
                    <button
                        onClick={() => {
                            onToggleImpactFrame(contextMenuFrame.index);
                            setContextMenuFrame(null);
                        }}
                        className="timeline-context-item"
                    >
                        <Zap className="w-4 h-4" />
                        {impactFrames?.has(contextMenuFrame.index) ? 'Remove Impact Mark' : 'Mark as Impact'}
                    </button>
                </div>
            )}
        </div>
    );
}

export default AnimationTimeline;
