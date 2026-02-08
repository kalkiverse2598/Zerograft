/**
 * Effect Types - Shared schema for hybrid effects system
 * Used by both pipeline (auto-suggestions) and Pixel Studio (manual effects)
 */

// ============================================================================
// Effect Type Enums
// ============================================================================

export type EffectType = 'particle' | 'fluid' | 'break' | 'smear' | 'slash';

export type EffectPosition =
    | 'center'
    | 'weapon_tip'
    | 'feet'
    | 'head'
    | 'custom';

export type BlendMode = 'normal' | 'add' | 'screen' | 'multiply';

// ============================================================================
// Effect Event - Core schema for when/where effects trigger
// ============================================================================

export interface EffectEvent {
    id: string;
    effect_type: EffectType;
    preset: string;              // e.g., 'fire_slash', 'dust_puff', 'magic_burst'
    trigger_frame: number;       // Animation frame index when effect starts
    duration_frames: number;     // How many frames effect plays
    position: EffectPosition;
    custom_offset?: { x: number; y: number };  // Pixel offset for 'custom' position
    palette?: string[];          // Hex colors from DNA (optional override)
    intensity?: number;          // 0-1 effect strength
    blend_mode?: BlendMode;
}

// ============================================================================
// Effect Preset - Predefined effect configurations
// ============================================================================

export interface EffectPreset {
    id: string;
    name: string;
    effect_type: EffectType;
    description: string;
    icon: string;                // Emoji or icon name
    default_duration: number;
    default_position: EffectPosition;
    supports_palette: boolean;   // Can use DNA colors
    generation_config: {
        // For AI-generated particles
        particle_type?: string;
        size?: number;
        frame_count?: number;
        // For fluid simulation
        fluid_preset?: 'fire' | 'smoke' | 'magic' | 'custom';
        // For break effect
        grid?: { x: number; y: number };
    };
}

// ============================================================================
// Effect Layer - Collection of effects rendered to frames
// ============================================================================

export interface EffectLayer {
    id: string;
    name: string;
    events: EffectEvent[];
    visible: boolean;
    locked: boolean;
    blend_mode: BlendMode;
    opacity: number;             // 0-1
    frames?: ImageData[];        // Rendered effect frames (populated after generation)
}

// ============================================================================
// Effect Suggestion - Pipeline output for auto-suggested effects
// ============================================================================

export interface EffectSuggestion {
    effect_type: EffectType;
    preset: string;
    trigger_frame: number;
    duration_frames: number;
    position: EffectPosition;
    reason: string;              // Why this effect was suggested (e.g., "Contact phase - impact")
    confidence: number;          // 0-1 how confident the suggestion is
}

// ============================================================================
// Preset Library - Built-in effect presets
// ============================================================================

export const EFFECT_PRESETS: Record<string, EffectPreset> = {
    // Combat Effects
    slash_light: {
        id: 'slash_light',
        name: 'Light Slash',
        effect_type: 'slash',
        description: 'Quick weapon swing arc',
        icon: '⚔️',
        default_duration: 2,
        default_position: 'weapon_tip',
        supports_palette: true,
        generation_config: {
            particle_type: 'spark',
            size: 32,
            frame_count: 3,
        },
    },
    slash_heavy: {
        id: 'slash_heavy',
        name: 'Heavy Slash',
        effect_type: 'slash',
        description: 'Powerful weapon swing with trails',
        icon: '🗡️',
        default_duration: 4,
        default_position: 'weapon_tip',
        supports_palette: true,
        generation_config: {
            particle_type: 'spark',
            size: 64,
            frame_count: 4,
        },
    },
    impact_spark: {
        id: 'impact_spark',
        name: 'Impact Sparks',
        effect_type: 'particle',
        description: 'Sparks on hit contact',
        icon: '✨',
        default_duration: 3,
        default_position: 'center',
        supports_palette: true,
        generation_config: {
            particle_type: 'spark',
            size: 32,
            frame_count: 4,
        },
    },
    hit_flash: {
        id: 'hit_flash',
        name: 'Hit Flash',
        effect_type: 'particle',
        description: 'White flash on damage',
        icon: '💥',
        default_duration: 2,
        default_position: 'center',
        supports_palette: false,
        generation_config: {
            particle_type: 'spark',
            size: 48,
            frame_count: 2,
        },
    },

    // Movement Effects
    dust_puff: {
        id: 'dust_puff',
        name: 'Dust Puff',
        effect_type: 'particle',
        description: 'Ground dust on landing/dash',
        icon: '💨',
        default_duration: 4,
        default_position: 'feet',
        supports_palette: false,
        generation_config: {
            particle_type: 'dust',
            size: 32,
            frame_count: 4,
        },
    },
    speed_lines: {
        id: 'speed_lines',
        name: 'Speed Lines',
        effect_type: 'smear',
        description: 'Motion blur trails',
        icon: '💨',
        default_duration: 2,
        default_position: 'center',
        supports_palette: false,
        generation_config: {},
    },

    // Magic Effects
    magic_burst: {
        id: 'magic_burst',
        name: 'Magic Burst',
        effect_type: 'particle',
        description: 'Magical energy release',
        icon: '✨',
        default_duration: 4,
        default_position: 'center',
        supports_palette: true,
        generation_config: {
            particle_type: 'magic',
            size: 48,
            frame_count: 4,
        },
    },
    aura_glow: {
        id: 'aura_glow',
        name: 'Aura Glow',
        effect_type: 'fluid',
        description: 'Ambient magical aura',
        icon: '🌟',
        default_duration: 8,
        default_position: 'center',
        supports_palette: true,
        generation_config: {
            fluid_preset: 'magic',
        },
    },

    // Elemental Effects
    fire_burst: {
        id: 'fire_burst',
        name: 'Fire Burst',
        effect_type: 'fluid',
        description: 'Explosive flames',
        icon: '🔥',
        default_duration: 6,
        default_position: 'center',
        supports_palette: false,
        generation_config: {
            fluid_preset: 'fire',
        },
    },
    smoke_trail: {
        id: 'smoke_trail',
        name: 'Smoke Trail',
        effect_type: 'fluid',
        description: 'Rising smoke effect',
        icon: '🌫️',
        default_duration: 8,
        default_position: 'feet',
        supports_palette: false,
        generation_config: {
            fluid_preset: 'smoke',
        },
    },

    // Death/Destruction
    break_shatter: {
        id: 'break_shatter',
        name: 'Shatter',
        effect_type: 'break',
        description: 'Sprite shatters into pieces',
        icon: '💔',
        default_duration: 12,
        default_position: 'center',
        supports_palette: false,
        generation_config: {
            grid: { x: 4, y: 4 },
        },
    },
    dissolve: {
        id: 'dissolve',
        name: 'Dissolve',
        effect_type: 'break',
        description: 'Sprite fades and breaks apart',
        icon: '✨',
        default_duration: 16,
        default_position: 'center',
        supports_palette: false,
        generation_config: {
            grid: { x: 8, y: 8 },
        },
    },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a new effect event with defaults from preset
 */
export function createEffectEvent(
    presetId: string,
    triggerFrame: number,
    overrides?: Partial<EffectEvent>
): EffectEvent {
    const preset = EFFECT_PRESETS[presetId];
    if (!preset) {
        throw new Error(`Unknown effect preset: ${presetId}`);
    }

    return {
        id: `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        effect_type: preset.effect_type,
        preset: presetId,
        trigger_frame: triggerFrame,
        duration_frames: preset.default_duration,
        position: preset.default_position,
        intensity: 1.0,
        blend_mode: preset.effect_type === 'fluid' ? 'add' : 'normal',
        ...overrides,
    };
}

/**
 * Create a new empty effect layer
 */
export function createEffectLayer(name: string = 'Effects'): EffectLayer {
    return {
        id: `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        events: [],
        visible: true,
        locked: false,
        blend_mode: 'add',
        opacity: 1.0,
    };
}

/**
 * Get events active on a specific frame
 */
export function getEventsOnFrame(events: EffectEvent[], frameIndex: number): EffectEvent[] {
    return events.filter(event => {
        const start = event.trigger_frame;
        const end = event.trigger_frame + event.duration_frames;
        return frameIndex >= start && frameIndex < end;
    });
}

/**
 * Get presets by effect type
 */
export function getPresetsByType(type: EffectType): EffectPreset[] {
    return Object.values(EFFECT_PRESETS).filter(p => p.effect_type === type);
}

/**
 * Map animation phase to suggested effect types
 */
export function suggestEffectsForPhase(
    phase: string,
    actionType: string
): EffectSuggestion[] {
    const suggestions: EffectSuggestion[] = [];

    // Contact phase - impact effects
    if (phase === 'Contact') {
        if (actionType.toLowerCase().includes('attack') || actionType.toLowerCase().includes('slash')) {
            suggestions.push({
                effect_type: 'slash',
                preset: 'slash_light',
                trigger_frame: 0, // Will be set by caller
                duration_frames: 2,
                position: 'weapon_tip',
                reason: 'Contact phase - weapon strike',
                confidence: 0.8,
            });
            suggestions.push({
                effect_type: 'particle',
                preset: 'impact_spark',
                trigger_frame: 0,
                duration_frames: 3,
                position: 'center',
                reason: 'Contact phase - hit impact',
                confidence: 0.9,
            });
        }
    }

    // Recovery with landing
    if (phase === 'Recovery') {
        if (actionType.toLowerCase().includes('jump') || actionType.toLowerCase().includes('land')) {
            suggestions.push({
                effect_type: 'particle',
                preset: 'dust_puff',
                trigger_frame: 0,
                duration_frames: 4,
                position: 'feet',
                reason: 'Recovery phase - ground impact',
                confidence: 0.85,
            });
        }
    }

    // Anticipation for magic/cast
    if (phase === 'Anticipation') {
        if (actionType.toLowerCase().includes('cast') || actionType.toLowerCase().includes('magic')) {
            suggestions.push({
                effect_type: 'particle',
                preset: 'magic_burst',
                trigger_frame: 0,
                duration_frames: 4,
                position: 'center',
                reason: 'Anticipation phase - magic charging',
                confidence: 0.7,
            });
        }
    }

    return suggestions;
}

export default EFFECT_PRESETS;
