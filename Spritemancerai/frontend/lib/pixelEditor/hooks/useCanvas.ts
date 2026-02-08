"use client";

import { useState, useRef, useEffect, useCallback, RefObject } from "react";

export interface CanvasState {
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    containerRef: React.RefObject<HTMLDivElement | null>;
    canvasWrapperRef: React.RefObject<HTMLDivElement | null>;

    // Loading state
    isLoading: boolean;
    loadedImage: HTMLImageElement | null;

    // Dimensions
    imageWidth: number;
    imageHeight: number;
    setImageWidth: (width: number) => void;
    setImageHeight: (height: number) => void;

    // Cursor state
    cursorPos: { x: number; y: number } | null;
    setCursorPos: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;

    // Canvas coordinate helper
    getCanvasCoords: (e: React.MouseEvent<HTMLCanvasElement | HTMLDivElement>) => { x: number; y: number };

    // Calculate fit-to-screen zoom
    calculateFitZoom: () => number;
}

export interface UseCanvasOptions {
    imageUrl: string;
}

export function useCanvas(options: UseCanvasOptions): CanvasState {
    const { imageUrl } = options;

    // Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasWrapperRef = useRef<HTMLDivElement>(null);

    // Loading state
    const [isLoading, setIsLoading] = useState(true);
    const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);

    // Dimensions
    const [imageWidth, setImageWidth] = useState(0);
    const [imageHeight, setImageHeight] = useState(0);

    // Cursor state
    const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

    // Load image
    useEffect(() => {
        console.log("🔄 Starting image load:", imageUrl);
        const img = new Image();
        img.crossOrigin = "anonymous";

        img.onload = () => {
            console.log("✅ Image loaded:", img.width, "x", img.height);
            setImageWidth(img.width);
            setImageHeight(img.height);
            setLoadedImage(img);
            setIsLoading(false);
        };

        img.onerror = (err) => {
            console.error("❌ Failed to load image:", err);
            console.error("Image URL:", imageUrl);
            alert("Failed to load image. This may be a CORS issue with the storage URL.");
            setIsLoading(false);
        };

        img.src = imageUrl;
    }, [imageUrl]);

    // Get canvas coordinates from mouse event
    const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement | HTMLDivElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: Math.floor((e.clientX - rect.left) * scaleX),
            y: Math.floor((e.clientY - rect.top) * scaleY),
        };
    }, []);

    // Calculate fit-to-screen zoom
    const calculateFitZoom = useCallback(() => {
        const container = containerRef.current;
        if (!container || !loadedImage) return 8;

        // Account for padding (32px on each side) and some margin
        const availableWidth = container.clientWidth - 100;
        const availableHeight = container.clientHeight - 100;

        const zoomX = availableWidth / loadedImage.width;
        const zoomY = availableHeight / loadedImage.height;

        // Use the smaller zoom to fit both dimensions, clamp between 1 and 32
        return Math.max(1, Math.min(32, Math.floor(Math.min(zoomX, zoomY))));
    }, [loadedImage]);

    return {
        canvasRef,
        containerRef,
        canvasWrapperRef,
        isLoading,
        loadedImage,
        imageWidth,
        imageHeight,
        setImageWidth,
        setImageHeight,
        cursorPos,
        setCursorPos,
        getCanvasCoords,
        calculateFitZoom,
    };
}
