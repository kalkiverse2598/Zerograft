/**
 * Effect Layer State Hook
 * Manages effect layers, events, and synchronization with animation frames
 */

import { useState, useCallback } from 'react';
import {
    EffectEvent,
    EffectLayer,
    createEffectEvent,
    createEffectLayer,
    getEventsOnFrame,
} from '@/lib/effects/effectTypes';

// ============================================================================
// Types
// ============================================================================

export interface UseEffectLayersOptions {
    totalFrames: number;
    dnaPalette?: string[];
}

export interface UseEffectLayersReturn {
    layers: EffectLayer[];
    addLayer: (name?: string) => EffectLayer;
    removeLayer: (layerId: string) => void;
    toggleLayerVisibility: (layerId: string) => void;
    addEvent: (layerId: string, presetId: string, triggerFrame: number) => EffectEvent;
    removeEvent: (layerId: string, eventId: string) => void;
    updateEvent: (layerId: string, eventId: string, updates: Partial<EffectEvent>) => void;
    getActiveEvents: (frameIndex: number) => EffectEvent[];
    clearAll: () => void;
    importFromSuggestions: (suggestions: Array<{
        effect_type: string;
        preset: string;
        trigger_frame: number;
        duration_frames: number;
        position: string;
    }>) => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useEffectLayers({
    totalFrames,
    dnaPalette,
}: UseEffectLayersOptions): UseEffectLayersReturn {
    const [layers, setLayers] = useState<EffectLayer[]>([]);

    /**
     * Add a new effect layer
     */
    const addLayer = useCallback((name?: string): EffectLayer => {
        const layer = createEffectLayer(name);
        setLayers(prev => [...prev, layer]);
        return layer;
    }, []);

    /**
     * Remove a layer by ID
     */
    const removeLayer = useCallback((layerId: string) => {
        setLayers(prev => prev.filter(l => l.id !== layerId));
    }, []);

    /**
     * Toggle layer visibility
     */
    const toggleLayerVisibility = useCallback((layerId: string) => {
        setLayers(prev => prev.map(layer =>
            layer.id === layerId
                ? { ...layer, visible: !layer.visible }
                : layer
        ));
    }, []);

    /**
     * Add an effect event to a layer
     */
    const addEvent = useCallback((
        layerId: string,
        presetId: string,
        triggerFrame: number
    ): EffectEvent => {
        const event = createEffectEvent(presetId, triggerFrame, {
            palette: dnaPalette,
        });

        setLayers(prev => prev.map(layer =>
            layer.id === layerId
                ? { ...layer, events: [...layer.events, event] }
                : layer
        ));

        return event;
    }, [dnaPalette]);

    /**
     * Remove an event from a layer
     */
    const removeEvent = useCallback((layerId: string, eventId: string) => {
        setLayers(prev => prev.map(layer =>
            layer.id === layerId
                ? { ...layer, events: layer.events.filter(e => e.id !== eventId) }
                : layer
        ));
    }, []);

    /**
     * Update an event's properties
     */
    const updateEvent = useCallback((
        layerId: string,
        eventId: string,
        updates: Partial<EffectEvent>
    ) => {
        setLayers(prev => prev.map(layer =>
            layer.id === layerId
                ? {
                    ...layer,
                    events: layer.events.map(event =>
                        event.id === eventId
                            ? { ...event, ...updates }
                            : event
                    )
                }
                : layer
        ));
    }, []);

    /**
     * Get all events active on a specific frame (across all visible layers)
     */
    const getActiveEvents = useCallback((frameIndex: number): EffectEvent[] => {
        return layers
            .filter(layer => layer.visible)
            .flatMap(layer => getEventsOnFrame(layer.events, frameIndex));
    }, [layers]);

    /**
     * Clear all layers and events
     */
    const clearAll = useCallback(() => {
        setLayers([]);
    }, []);

    /**
     * Import effect suggestions from pipeline response
     */
    const importFromSuggestions = useCallback((suggestions: Array<{
        effect_type: string;
        preset: string;
        trigger_frame: number;
        duration_frames: number;
        position: string;
    }>) => {
        if (suggestions.length === 0) return;

        // Create a new layer for imported effects
        const layer = createEffectLayer('Suggested Effects');

        // Convert suggestions to events
        const events: EffectEvent[] = suggestions.map(suggestion => ({
            id: `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            effect_type: suggestion.effect_type as EffectEvent['effect_type'],
            preset: suggestion.preset,
            trigger_frame: suggestion.trigger_frame,
            duration_frames: suggestion.duration_frames,
            position: suggestion.position as EffectEvent['position'],
            intensity: 1.0,
            blend_mode: suggestion.effect_type === 'fluid' ? 'add' : 'normal',
            palette: dnaPalette,
        }));

        layer.events = events;
        setLayers(prev => [...prev, layer]);
    }, [dnaPalette]);

    return {
        layers,
        addLayer,
        removeLayer,
        toggleLayerVisibility,
        addEvent,
        removeEvent,
        updateEvent,
        getActiveEvents,
        clearAll,
        importFromSuggestions,
    };
}

export default useEffectLayers;
