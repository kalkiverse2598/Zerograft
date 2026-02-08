/**
 * ExportOptions Component
 * 
 * Export buttons for downloading PNG and Godot .tres files.
 */

'use client';

import React from 'react';
import type { GeneratedTileset } from './types';

interface ExportOptionsProps {
    tileset: GeneratedTileset;
    isExporting: boolean;
    onDownloadPng: () => void;
    onDownloadTres: () => void;
    onExportBoth: () => void;
}

export default function ExportOptions({
    tileset,
    isExporting,
    onDownloadPng,
    onDownloadTres,
    onExportBoth,
}: ExportOptionsProps) {
    return (
        <div className="export-options">
            <h4>📦 Export</h4>

            <div className="export-options__buttons">
                <button
                    className="export-btn export-btn--png"
                    onClick={onDownloadPng}
                    disabled={isExporting}
                >
                    <span className="export-btn__icon">🖼️</span>
                    <span className="export-btn__label">Download PNG</span>
                    <span className="export-btn__desc">Tileset image only</span>
                </button>

                <button
                    className="export-btn export-btn--tres"
                    onClick={onDownloadTres}
                    disabled={isExporting}
                >
                    {isExporting ? (
                        <>
                            <span className="export-btn__spinner" />
                            <span className="export-btn__label">Exporting...</span>
                        </>
                    ) : (
                        <>
                            <span className="export-btn__icon">🎮</span>
                            <span className="export-btn__label">Export .tres</span>
                            <span className="export-btn__desc">Godot TileSet resource</span>
                        </>
                    )}
                </button>

                <button
                    className="export-btn export-btn--both"
                    onClick={onExportBoth}
                    disabled={isExporting}
                >
                    <span className="export-btn__icon">📦</span>
                    <span className="export-btn__label">Export Both</span>
                    <span className="export-btn__desc">PNG + .tres bundle</span>
                </button>
            </div>

            <div className="export-options__info">
                <p>
                    💡 The <code>.tres</code> file includes terrain autotiling configuration
                    for seamless tile placement in Godot 4.x
                </p>
            </div>

            <style jsx>{`
                .export-options {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 16px;
                    padding: 1rem;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                
                .export-options h4 {
                    font-size: 1rem;
                    margin-bottom: 1rem;
                    color: #fff;
                }
                
                .export-options__buttons {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 0.75rem;
                    margin-bottom: 1rem;
                }
                
                .export-btn {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 1rem;
                    border: none;
                    border-radius: 12px;
                    background: rgba(255, 255, 255, 0.05);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .export-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                }
                
                .export-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                
                .export-btn--png:hover:not(:disabled) {
                    background: rgba(76, 175, 80, 0.2);
                    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.2);
                }
                
                .export-btn--tres:hover:not(:disabled) {
                    background: rgba(63, 81, 181, 0.2);
                    box-shadow: 0 4px 12px rgba(63, 81, 181, 0.2);
                }
                
                .export-btn--both:hover:not(:disabled) {
                    background: rgba(0, 210, 255, 0.2);
                    box-shadow: 0 4px 12px rgba(0, 210, 255, 0.2);
                }
                
                .export-btn__icon {
                    font-size: 1.5rem;
                    margin-bottom: 0.5rem;
                }
                
                .export-btn__label {
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: #fff;
                }
                
                .export-btn__desc {
                    font-size: 0.75rem;
                    color: #888;
                    margin-top: 0.25rem;
                }
                
                .export-btn__spinner {
                    width: 24px;
                    height: 24px;
                    border: 2px solid rgba(255, 255, 255, 0.2);
                    border-top-color: #00d2ff;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    margin-bottom: 0.5rem;
                }
                
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                
                .export-options__info {
                    padding: 0.75rem;
                    background: rgba(0, 210, 255, 0.1);
                    border-radius: 8px;
                    border: 1px solid rgba(0, 210, 255, 0.2);
                }
                
                .export-options__info p {
                    font-size: 0.85rem;
                    color: #aaa;
                    margin: 0;
                }
                
                .export-options__info code {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 0.1rem 0.3rem;
                    border-radius: 4px;
                    color: #00d2ff;
                }
                
                @media (max-width: 768px) {
                    .export-options__buttons {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
}
