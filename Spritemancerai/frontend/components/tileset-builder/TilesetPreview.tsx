/**
 * TilesetPreview Component
 * 
 * Displays the generated tileset with zoom controls and tile grid overlay.
 */

'use client';

import React, { useState } from 'react';
import type { GeneratedTileset } from './types';

interface TilesetPreviewProps {
    tileset: GeneratedTileset | null;
    isLoading: boolean;
    tileSize: number;
}

export default function TilesetPreview({
    tileset,
    isLoading,
    tileSize,
}: TilesetPreviewProps) {
    const [zoom, setZoom] = useState(2);
    const [showGrid, setShowGrid] = useState(true);

    const zoomLevels = [1, 2, 3, 4, 6, 8];

    if (isLoading) {
        return (
            <div className="tileset-preview tileset-preview--loading">
                <div className="tileset-preview__loading">
                    <div className="loading-spinner" />
                    <p>Generating tileset...</p>
                    <span className="loading-tip">This may take 10-30 seconds</span>
                </div>

                <style jsx>{styles}</style>
            </div>
        );
    }

    if (!tileset) {
        return (
            <div className="tileset-preview tileset-preview--empty">
                <div className="tileset-preview__empty">
                    <span className="empty-icon">🧱</span>
                    <p>Select a preset and click Generate</p>
                    <span className="empty-hint">Your tileset will appear here</span>
                </div>

                <style jsx>{styles}</style>
            </div>
        );
    }

    return (
        <div className="tileset-preview">
            {/* Toolbar */}
            <div className="tileset-preview__toolbar">
                <div className="tileset-preview__info">
                    <span className="info-badge">{tileset.tileCount} tiles</span>
                    <span className="info-badge">{tileset.tileSize}×{tileset.tileSize}px</span>
                    <span className="info-badge">{tileset.presetName}</span>
                </div>

                <div className="tileset-preview__controls">
                    <label className="grid-toggle">
                        <input
                            type="checkbox"
                            checked={showGrid}
                            onChange={(e) => setShowGrid(e.target.checked)}
                        />
                        <span>Grid</span>
                    </label>

                    <div className="zoom-controls">
                        <span>Zoom:</span>
                        {zoomLevels.map((level) => (
                            <button
                                key={level}
                                className={`zoom-btn ${zoom === level ? 'active' : ''}`}
                                onClick={() => setZoom(level)}
                            >
                                {level}×
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Image Container */}
            <div className="tileset-preview__container">
                <div
                    className={`tileset-preview__image ${showGrid ? 'show-grid' : ''}`}
                    style={{
                        '--zoom': zoom,
                        '--tile-size': `${tileSize * zoom}px`,
                    } as React.CSSProperties}
                >
                    <img
                        src={`data:image/png;base64,${tileset.imageBase64}`}
                        alt={tileset.presetName}
                        style={{
                            imageRendering: 'pixelated',
                            transform: `scale(${zoom})`,
                            transformOrigin: 'top left',
                        }}
                    />
                </div>
            </div>

            <style jsx>{styles}</style>
        </div>
    );
}

const styles = `
    .tileset-preview {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        overflow: hidden;
        min-height: 400px;
    }
    
    .tileset-preview--loading,
    .tileset-preview--empty {
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .tileset-preview__loading,
    .tileset-preview__empty {
        text-align: center;
        padding: 3rem;
    }
    
    .loading-spinner {
        width: 48px;
        height: 48px;
        border: 3px solid rgba(255, 255, 255, 0.1);
        border-top-color: #00d2ff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 1rem;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    .loading-tip,
    .empty-hint {
        display: block;
        color: #666;
        font-size: 0.85rem;
        margin-top: 0.5rem;
    }
    
    .empty-icon {
        font-size: 3rem;
        display: block;
        margin-bottom: 1rem;
        opacity: 0.5;
    }
    
    .tileset-preview__toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        background: rgba(0, 0, 0, 0.2);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .tileset-preview__info {
        display: flex;
        gap: 0.5rem;
    }
    
    .info-badge {
        padding: 0.25rem 0.5rem;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        font-size: 0.75rem;
        color: #aaa;
    }
    
    .tileset-preview__controls {
        display: flex;
        align-items: center;
        gap: 1rem;
    }
    
    .grid-toggle {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        font-size: 0.85rem;
        color: #aaa;
    }
    
    .zoom-controls {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.85rem;
        color: #aaa;
    }
    
    .zoom-btn {
        padding: 0.25rem 0.5rem;
        border: none;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.05);
        color: #aaa;
        cursor: pointer;
        font-size: 0.75rem;
        transition: all 0.2s ease;
    }
    
    .zoom-btn:hover {
        background: rgba(255, 255, 255, 0.1);
    }
    
    .zoom-btn.active {
        background: #00d2ff;
        color: #000;
    }
    
    .tileset-preview__container {
        overflow: auto;
        padding: 2rem;
        background: repeating-conic-gradient(
            #1a1a2e 0% 25%,
            #0f0f1a 0% 50%
        ) 0 0 / 20px 20px;
    }
    
    .tileset-preview__image {
        display: inline-block;
        position: relative;
    }
    
    .tileset-preview__image.show-grid::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-image: 
            linear-gradient(rgba(255, 255, 255, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.3) 1px, transparent 1px);
        background-size: var(--tile-size) var(--tile-size);
        pointer-events: none;
    }
    
    .tileset-preview__image img {
        display: block;
    }
`;
