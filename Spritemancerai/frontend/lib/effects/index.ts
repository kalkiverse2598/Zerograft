/**
 * Effects Library - Re-export effect types and presets
 */

export {
    // Types
    type EffectType,
    type EffectPosition,
    type BlendMode,
    type EffectEvent,
    type EffectPreset,
    type EffectLayer,
    type EffectSuggestion,

    // Presets
    EFFECT_PRESETS,

    // Helpers
    createEffectEvent,
    createEffectLayer,
    getEventsOnFrame,
    getPresetsByType,
    suggestEffectsForPhase,
} from './effectTypes';

export { useEffectLayers } from './useEffectLayers';
export type { UseEffectLayersReturn } from './useEffectLayers';
