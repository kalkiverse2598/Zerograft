/**
 * Frame State Types for Animation Frame-Layer Sync
 * Each frame stores a complete snapshot of the layer system state
 */

import type { BlendMode } from '../useLayerSystem';

/**
 * Serializable snapshot of a single layer
 * Contains all metadata + pixel data
 */
export interface LayerSnapshot {
    id: string;
    name: string;
    visible: boolean;
    locked: boolean;
    opacity: number;
    blendMode: BlendMode;
    /** Raw pixel data for this layer */
    imageData: ImageData;
}

/**
 * Complete snapshot of a frame's layer state
 * This is what gets stored/restored when switching frames
 */
export interface FrameLayerSnapshot {
    /** The frame ID this snapshot belongs to */
    frameId: string;
    /** All layers with their complete state */
    layers: LayerSnapshot[];
    /** Which layer was active when this snapshot was taken */
    activeLayerId: string | null;
    /** Timestamp of when this snapshot was created */
    timestamp: number;
}

/**
 * Partial snapshot (without frameId/timestamp) for serialization
 */
export type LayerSystemState = Omit<FrameLayerSnapshot, 'frameId' | 'timestamp'>;

/**
 * Helper to create a deep copy of ImageData
 */
export function cloneImageData(imageData: ImageData): ImageData {
    return new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
    );
}

/**
 * Helper to create blank ImageData
 */
export function createBlankImageData(width: number, height: number): ImageData {
    return new ImageData(width, height);
}
