"use client";

import { useState, useCallback, RefObject } from "react";

export interface Selection {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ClipboardManager {
    // Selection state
    selection: Selection | null;
    setSelection: React.Dispatch<React.SetStateAction<Selection | null>>;
    selectionStart: { x: number; y: number } | null;
    setSelectionStart: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;

    // Clipboard state
    clipboard: ImageData | null;
    hasClipboard: boolean;

    // Operations
    copySelection: () => void;
    cutSelection: () => void;
    pasteClipboard: () => void;
    clearSelection: () => void;
}

export interface UseClipboardOptions {
    canvasRef: RefObject<HTMLCanvasElement | null>;
    saveToHistory: () => void;
}

export function useClipboard(options: UseClipboardOptions): ClipboardManager {
    const { canvasRef, saveToHistory } = options;

    // Selection state
    const [selection, setSelection] = useState<Selection | null>(null);
    const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);

    // Clipboard state
    const [clipboard, setClipboard] = useState<ImageData | null>(null);

    // Copy selection
    const copySelection = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx || !selection) return;

        const imageData = ctx.getImageData(selection.x, selection.y, selection.width, selection.height);
        setClipboard(imageData);
    }, [canvasRef, selection]);

    // Cut selection
    const cutSelection = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx || !selection) return;

        const imageData = ctx.getImageData(selection.x, selection.y, selection.width, selection.height);
        setClipboard(imageData);
        ctx.clearRect(selection.x, selection.y, selection.width, selection.height);
        saveToHistory();
    }, [canvasRef, selection, saveToHistory]);

    // Paste clipboard
    const pasteClipboard = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx || !clipboard) return;

        // Paste at selection position or top-left
        const x = selection?.x ?? 0;
        const y = selection?.y ?? 0;
        ctx.putImageData(clipboard, x, y);
        saveToHistory();
    }, [canvasRef, clipboard, selection, saveToHistory]);

    // Clear selection
    const clearSelection = useCallback(() => {
        setSelection(null);
        setSelectionStart(null);
    }, []);

    return {
        selection,
        setSelection,
        selectionStart,
        setSelectionStart,
        clipboard,
        hasClipboard: clipboard !== null,
        copySelection,
        cutSelection,
        pasteClipboard,
        clearSelection,
    };
}
