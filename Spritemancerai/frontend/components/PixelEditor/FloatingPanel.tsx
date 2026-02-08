"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { X, GripVertical } from "lucide-react";

interface FloatingPanelProps {
    title: string;
    icon?: React.ReactNode;
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    defaultPosition?: { x: number; y: number };
    width?: number;
}

/**
 * Floating, draggable panel component
 * Can be moved anywhere on screen by dragging the header
 */
export function FloatingPanel({
    title,
    icon,
    isOpen,
    onClose,
    children,
    defaultPosition = { x: 100, y: 100 },
    width = 320,
}: FloatingPanelProps) {
    const [position, setPosition] = useState(defaultPosition);
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const panelRef = useRef<HTMLDivElement>(null);

    // Handle drag start
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.floating-panel-header')) {
            e.preventDefault();
            setIsDragging(true);
            const rect = panelRef.current?.getBoundingClientRect();
            if (rect) {
                dragOffset.current = {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                };
            }
        }
    }, []);

    // Handle drag move
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const newX = e.clientX - dragOffset.current.x;
            const newY = e.clientY - dragOffset.current.y;

            // Keep panel within viewport
            const maxX = window.innerWidth - width - 20;
            const maxY = window.innerHeight - 100;

            setPosition({
                x: Math.max(0, Math.min(newX, maxX)),
                y: Math.max(0, Math.min(newY, maxY)),
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, width]);

    if (!isOpen) return null;

    return (
        <div
            ref={panelRef}
            className="fixed z-50 bg-zinc-900/95 border border-zinc-700 rounded-xl shadow-2xl backdrop-blur-sm"
            style={{
                left: position.x,
                top: position.y,
                width,
                cursor: isDragging ? 'grabbing' : 'auto',
            }}
            onMouseDown={handleMouseDown}
        >
            {/* Header - Draggable */}
            <div className="floating-panel-header flex items-center justify-between px-4 py-3 border-b border-zinc-700/50 cursor-grab active:cursor-grabbing select-none">
                <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-zinc-500" />
                    {icon}
                    <span className="font-semibold text-white">{title}</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                    <X className="w-4 h-4 text-zinc-400 hover:text-white" />
                </button>
            </div>

            {/* Content */}
            <div className="p-4 max-h-[70vh] overflow-y-auto">
                {children}
            </div>
        </div>
    );
}

export default FloatingPanel;
