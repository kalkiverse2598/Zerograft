"use client";

import { useState, useCallback, RefObject } from "react";

export interface HistoryState {
    imageData: ImageData;
}

export interface HistoryManager {
    history: HistoryState[];
    historyIndex: number;
    saveToHistory: () => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    initializeHistory: (imageData: ImageData) => void;
}

export interface UseHistoryOptions {
    maxHistorySize?: number;
}

export function useHistory(
    canvasRef: RefObject<HTMLCanvasElement | null>,
    options: UseHistoryOptions = {}
): HistoryManager {
    const { maxHistorySize = 50 } = options;

    const [history, setHistory] = useState<HistoryState[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Initialize history with first state
    const initializeHistory = useCallback((imageData: ImageData) => {
        setHistory([{ imageData }]);
        setHistoryIndex(0);
    }, []);

    // Save current state to history
    const saveToHistory = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);

        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push({ imageData: currentState });

            if (newHistory.length > maxHistorySize) {
                newHistory.shift();
                return newHistory;
            }
            return newHistory;
        });

        setHistoryIndex(prev => Math.min(prev + 1, maxHistorySize - 1));
    }, [canvasRef, historyIndex, maxHistorySize]);

    // Undo
    const undo = useCallback(() => {
        if (historyIndex <= 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        const newIndex = historyIndex - 1;
        ctx.putImageData(history[newIndex].imageData, 0, 0);
        setHistoryIndex(newIndex);
    }, [canvasRef, history, historyIndex]);

    // Redo
    const redo = useCallback(() => {
        if (historyIndex >= history.length - 1) return;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        const newIndex = historyIndex + 1;
        ctx.putImageData(history[newIndex].imageData, 0, 0);
        setHistoryIndex(newIndex);
    }, [canvasRef, history, historyIndex]);

    return {
        history,
        historyIndex,
        saveToHistory,
        undo,
        redo,
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1,
        initializeHistory,
    };
}
