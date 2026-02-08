/**
 * Pixel Perfect Stroke Hook
 * Removes L-shaped pixels to create clean 1px diagonal lines
 * 
 * The algorithm tracks the last few pixels drawn and detects L-shaped patterns.
 * When an L-shape is detected, the corner pixel is removed to create a smooth diagonal.
 * 
 * Example:
 * Before (L-shape):    After (Pixel Perfect):
 *   X X                  X
 *     X                    X
 */

import { useCallback, useRef } from 'react';

interface Point {
    x: number;
    y: number;
}

interface UsePixelPerfectOptions {
    enabled: boolean;
    brushSize: number;
}

export function usePixelPerfect({ enabled, brushSize }: UsePixelPerfectOptions) {
    // Track last 3 points for L-shape detection
    const lastPointsRef = useRef<Point[]>([]);

    /**
     * Reset the point history (call on mouse down)
     */
    const resetHistory = useCallback(() => {
        lastPointsRef.current = [];
    }, []);

    /**
     * Check if two points are adjacent (including diagonal)
     */
    const areAdjacent = useCallback((p1: Point, p2: Point): boolean => {
        const dx = Math.abs(p1.x - p2.x);
        const dy = Math.abs(p1.y - p2.y);
        return dx <= 1 && dy <= 1 && (dx + dy > 0);
    }, []);

    /**
     * Check if three points form an L-shape
     * An L-shape occurs when we have two perpendicular moves
     */
    const isLShape = useCallback((p1: Point, p2: Point, p3: Point): boolean => {
        // Vector from p1 to p2
        const v1x = p2.x - p1.x;
        const v1y = p2.y - p1.y;
        
        // Vector from p2 to p3
        const v2x = p3.x - p2.x;
        const v2y = p3.y - p2.y;

        // Check if vectors are perpendicular (one horizontal, one vertical)
        // L-shape: one move is purely horizontal, the other purely vertical
        const isV1Horizontal = v1y === 0 && v1x !== 0;
        const isV1Vertical = v1x === 0 && v1y !== 0;
        const isV2Horizontal = v2y === 0 && v2x !== 0;
        const isV2Vertical = v2x === 0 && v2y !== 0;

        return (isV1Horizontal && isV2Vertical) || (isV1Vertical && isV2Horizontal);
    }, []);

    /**
     * Process a new point and determine if the previous point should be removed
     * Returns the point to remove (if any) and updates the history
     */
    const processPoint = useCallback((newPoint: Point): Point | null => {
        // Pixel perfect only works with brush size 1
        if (!enabled || brushSize !== 1) {
            lastPointsRef.current = [newPoint];
            return null;
        }

        const points = lastPointsRef.current;
        
        // Need at least 2 previous points to detect L-shape
        if (points.length < 2) {
            points.push(newPoint);
            return null;
        }

        const p1 = points[points.length - 2]; // Two points ago
        const p2 = points[points.length - 1]; // Previous point (potential corner)
        const p3 = newPoint;                   // Current point

        // Check if points are adjacent (continuous stroke)
        if (!areAdjacent(p1, p2) || !areAdjacent(p2, p3)) {
            // Stroke is not continuous, reset and start fresh
            lastPointsRef.current = [newPoint];
            return null;
        }

        // Check for L-shape pattern
        if (isLShape(p1, p2, p3)) {
            // Remove the corner point (p2) and replace with direct diagonal
            // Update history: remove p2, add p3
            lastPointsRef.current = [p1, p3];
            return p2; // Return the point to be removed/cleared
        }

        // No L-shape, just add the new point
        points.push(newPoint);
        
        // Keep only last 3 points to prevent memory growth
        if (points.length > 3) {
            points.shift();
        }

        return null;
    }, [enabled, brushSize, areAdjacent, isLShape]);

    /**
     * Clear a pixel at the given coordinates
     */
    const clearPixel = useCallback((
        ctx: CanvasRenderingContext2D,
        point: Point,
        tool: string,
        color: string
    ) => {
        if (tool === "eraser") {
            // For eraser, we need to "un-erase" (restore the pixel)
            // This is complex, so for eraser we just don't apply pixel perfect
            return;
        }
        
        // Clear the L-shaped corner pixel
        ctx.clearRect(point.x, point.y, 1, 1);
    }, []);

    return {
        resetHistory,
        processPoint,
        clearPixel,
    };
}

export default usePixelPerfect;
