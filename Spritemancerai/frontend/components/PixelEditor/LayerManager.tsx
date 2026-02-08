"use client";

import React, { useState } from 'react';
import { Layer, BlendMode } from '@/lib/pixelEditor/useLayerSystem';
import {
    Eye,
    EyeOff,
    Lock,
    Unlock,
    Trash2,
    Copy,
    ChevronUp,
    ChevronDown,
    Plus,
    Layers,
    Merge,
    Square,
} from 'lucide-react';
import './LayerManager.css';

interface LayerManagerProps {
    layers: Layer[];
    activeLayerId: string | null;
    onSelectLayer: (id: string) => void;
    onAddLayer: () => void;
    onDeleteLayer: (id: string) => void;
    onDuplicateLayer: (id: string) => void;
    onMoveLayer: (id: string, newIndex: number) => void;
    onToggleVisibility: (id: string) => void;
    onToggleLock: (id: string) => void;
    onSetOpacity: (id: string, opacity: number) => void;
    onSetBlendMode: (id: string, mode: BlendMode) => void;
    onRenameLayer: (id: string, name: string) => void;
    onMergeDown: (id: string) => void;
    onFlattenAll: () => void;
}

const BLEND_MODES: { value: BlendMode; label: string }[] = [
    { value: 'normal', label: 'Normal' },
    { value: 'multiply', label: 'Multiply' },
    { value: 'screen', label: 'Screen' },
    { value: 'overlay', label: 'Overlay' },
    { value: 'darken', label: 'Darken' },
    { value: 'lighten', label: 'Lighten' },
];

export function LayerManager({
    layers,
    activeLayerId,
    onSelectLayer,
    onAddLayer,
    onDeleteLayer,
    onDuplicateLayer,
    onMoveLayer,
    onToggleVisibility,
    onToggleLock,
    onSetOpacity,
    onSetBlendMode,
    onRenameLayer,
    onMergeDown,
    onFlattenAll,
}: LayerManagerProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const activeLayer = layers.find(l => l.id === activeLayerId);

    const handleDoubleClick = (layer: Layer) => {
        setEditingId(layer.id);
        setEditName(layer.name);
    };

    const handleNameSubmit = (layerId: string) => {
        if (editName.trim()) {
            onRenameLayer(layerId, editName.trim());
        }
        setEditingId(null);
    };

    const handleDragStart = (e: React.DragEvent, layerId: string) => {
        setDraggedId(layerId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        setDragOverIndex(index);
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        if (draggedId) {
            onMoveLayer(draggedId, targetIndex);
        }
        setDraggedId(null);
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedId(null);
        setDragOverIndex(null);
    };

    // Layers are rendered top-to-bottom (visually top layer is first in render)
    const reversedLayers = [...layers].reverse();

    return (
        <div className="layer-manager">
            {/* Header */}
            <div className="layer-header">
                <div className="layer-header-title">
                    <Layers className="w-4 h-4" />
                    <span>Layers</span>
                </div>
                <div className="layer-header-actions">
                    <button
                        onClick={() => onAddLayer()}
                        className="layer-action-btn"
                        title="Add Layer"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onFlattenAll()}
                        className="layer-action-btn"
                        title="Flatten All"
                        disabled={layers.length <= 1}
                    >
                        <Merge className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Active Layer Controls */}
            {activeLayer && (
                <div className="layer-controls">
                    <div className="layer-control-row">
                        <label className="layer-control-label">Opacity</label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={activeLayer.opacity}
                            onChange={(e) => onSetOpacity(activeLayer.id, parseInt(e.target.value))}
                            className="layer-opacity-slider"
                        />
                        <span className="layer-opacity-value">{activeLayer.opacity}%</span>
                    </div>
                    <div className="layer-control-row">
                        <label className="layer-control-label">Blend</label>
                        <select
                            value={activeLayer.blendMode}
                            onChange={(e) => onSetBlendMode(activeLayer.id, e.target.value as BlendMode)}
                            className="layer-blend-select"
                        >
                            {BLEND_MODES.map(mode => (
                                <option key={mode.value} value={mode.value}>{mode.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* Layer List */}
            <div className="layer-list">
                {reversedLayers.map((layer, displayIndex) => {
                    const realIndex = layers.length - 1 - displayIndex;
                    const isActive = layer.id === activeLayerId;
                    const isDragging = layer.id === draggedId;
                    const isDragOver = dragOverIndex === realIndex;

                    return (
                        <div
                            key={layer.id}
                            className={`layer-item ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                            onClick={() => onSelectLayer(layer.id)}
                            draggable
                            onDragStart={(e) => handleDragStart(e, layer.id)}
                            onDragOver={(e) => handleDragOver(e, realIndex)}
                            onDrop={(e) => handleDrop(e, realIndex)}
                            onDragEnd={handleDragEnd}
                        >
                            {/* Layer Preview Thumbnail */}
                            <div className="layer-thumbnail">
                                {layer.canvas && (
                                    <canvas
                                        width={32}
                                        height={32}
                                        ref={(el) => {
                                            if (el && layer.canvas) {
                                                const ctx = el.getContext('2d');
                                                if (ctx) {
                                                    ctx.imageSmoothingEnabled = false;
                                                    ctx.clearRect(0, 0, 32, 32);
                                                    // Draw checkerboard background
                                                    ctx.fillStyle = '#666';
                                                    ctx.fillRect(0, 0, 32, 32);
                                                    ctx.fillStyle = '#888';
                                                    for (let y = 0; y < 4; y++) {
                                                        for (let x = 0; x < 4; x++) {
                                                            if ((x + y) % 2 === 0) {
                                                                ctx.fillRect(x * 8, y * 8, 8, 8);
                                                            }
                                                        }
                                                    }
                                                    // Draw layer content
                                                    ctx.globalAlpha = layer.opacity / 100;
                                                    ctx.drawImage(layer.canvas, 0, 0, 32, 32);
                                                    ctx.globalAlpha = 1;
                                                }
                                            }
                                        }}
                                        style={{ width: 32, height: 32, imageRendering: 'pixelated' }}
                                    />
                                )}
                            </div>

                            {/* Layer Name */}
                            <div className="layer-info">
                                {editingId === layer.id ? (
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onBlur={() => handleNameSubmit(layer.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleNameSubmit(layer.id);
                                            if (e.key === 'Escape') setEditingId(null);
                                        }}
                                        className="layer-name-input"
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <span
                                        className="layer-name"
                                        onDoubleClick={() => handleDoubleClick(layer)}
                                    >
                                        {layer.name}
                                    </span>
                                )}
                            </div>

                            {/* Layer Actions */}
                            <div className="layer-actions">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                                    className={`layer-btn ${!layer.visible ? 'inactive' : ''}`}
                                    title={layer.visible ? 'Hide Layer' : 'Show Layer'}
                                >
                                    {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onToggleLock(layer.id); }}
                                    className={`layer-btn ${layer.locked ? 'active' : ''}`}
                                    title={layer.locked ? 'Unlock Layer' : 'Lock Layer'}
                                >
                                    {layer.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Layer Toolbar */}
            {activeLayer && (
                <div className="layer-toolbar">
                    <button
                        onClick={() => onMoveLayer(activeLayer.id, layers.findIndex(l => l.id === activeLayer.id) + 1)}
                        disabled={layers.findIndex(l => l.id === activeLayer.id) >= layers.length - 1}
                        className="layer-toolbar-btn"
                        title="Move Up"
                    >
                        <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onMoveLayer(activeLayer.id, layers.findIndex(l => l.id === activeLayer.id) - 1)}
                        disabled={layers.findIndex(l => l.id === activeLayer.id) <= 0}
                        className="layer-toolbar-btn"
                        title="Move Down"
                    >
                        <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onDuplicateLayer(activeLayer.id)}
                        className="layer-toolbar-btn"
                        title="Duplicate Layer"
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onMergeDown(activeLayer.id)}
                        disabled={layers.findIndex(l => l.id === activeLayer.id) <= 0}
                        className="layer-toolbar-btn"
                        title="Merge Down"
                    >
                        <Merge className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onDeleteLayer(activeLayer.id)}
                        disabled={layers.length <= 1}
                        className="layer-toolbar-btn delete"
                        title="Delete Layer"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}

export default LayerManager;
