/**
 * SpriteMancer AI - TypeScript Types
 * Matches backend Pydantic models
 */

// Character DNA
export interface CharacterDNA {
    archetype: string;
    body_type: string;
    dominant_colors: string[];
    equipment: string[];
    weapon_type: string | null;
    weapon_mass: "none" | "light" | "medium" | "heavy" | "oversized";
    special_features: string[];
    anatomical_constraints: string[];
}

// DNA Verification
export interface DNAVerificationResult {
    claim_verified: boolean;
    visual_evidence: string;
    confidence_score: number;
    action: "UPDATE_DNA" | "FLAG_AS_NEW_FEATURE";
}

// Animation Frame
export interface AnimationFrame {
    frame_index: number;
    phase: "Anticipation" | "Contact" | "Recovery" | "Idle" | "Follow-through" | "Startup";
    pose_description: string;
    visual_focus: string;
}

// Animation Script
export interface AnimationScript {
    action_type: string;
    difficulty_tier: DifficultyTier;
    physics_reasoning: string;
    frames: AnimationFrame[];
    suggested_effects?: EffectSuggestion[];  // AI-suggested effects (optional)
}

// Effect Suggestion (from pipeline)
export interface EffectSuggestion {
    effect_type: 'particle' | 'fluid' | 'break' | 'smear' | 'slash';
    preset: string;
    trigger_frame: number;
    duration_frames: number;
    position: 'center' | 'weapon_tip' | 'feet' | 'head' | 'custom';
    reason?: string;
    confidence?: number;
}

// Frame Budget
export interface FrameBudget {
    action_type: string;
    difficulty_tier: DifficultyTier;
    weapon_mass: string;
    perspective: Perspective;
    base_frames: number;
    multiplier_applied: number;
    final_frame_count: number;
    grid_dim: 2 | 3 | 4;
    justification: string;
}

// Pipeline Stage
export interface PipelineStage {
    stage_number: number;
    stage_name: string;
    status: "pending" | "running" | "completed" | "failed" | "skipped";
    started_at?: string;
    completed_at?: string;
    result?: Record<string, unknown>;
    error?: string;
}

// Pipeline State
export interface PipelineState {
    project_id: string;
    pipeline_id: string;
    status: "idle" | "running" | "paused" | "completed" | "failed" | "cancelled";
    current_stage: number;
    character_dna?: CharacterDNA;
    dna_verified: boolean;
    action_type?: string;
    difficulty_tier?: DifficultyTier;
    perspective: Perspective;
    frame_budget?: FrameBudget;
    intent_confirmed: boolean;
    intent_summary?: string;
    animation_script?: AnimationScript;
    spritesheet_url?: string;
    frame_urls: string[];
    pivots: Array<{ x: number; y: number }>;
    stages: PipelineStage[];
    created_at: string;
    updated_at: string;
}

// Project
export interface Project {
    id: string;
    name: string;
    description?: string;
    status: string;
    generation_mode?: "single" | "dual";
    reference_image_url?: string;
    preview_gif_url?: string;
    spritesheet_url?: string;
    character_dna?: CharacterDNA;
    // Per-animation storage: { idle: {frame_urls, spritesheet_url, status}, walk: {...}, ... }
    animations?: Record<string, {
        frame_urls?: string[];
        spritesheet_url?: string;
        status?: string;
        animation_script?: AnimationScript;
    }>;
    created_at: string;
    updated_at?: string;
}

// Action Suggestion
export interface ActionSuggestion {
    action: string;
    description: string;
    difficulty_tiers: DifficultyTier[];
    recommended_tier: DifficultyTier;
}

// Intent Mirror
export interface IntentMirror {
    intent_summary: string;
    status: "ALIGNED" | "EDIT_REQUIRED";
    key_points: string[];
}

// Enums
export type DifficultyTier = "LIGHT" | "HEAVY" | "BOSS";
export type Perspective = "side" | "front" | "isometric" | "top_down";

// WebSocket Message Types
export interface WSMessage {
    type: "connected" | "stage_start" | "stage_complete" | "stage_error" | "pipeline_complete" | "cancelled" | "dna_extracted" | "project_updated";
    project_id: string;
    stage?: number;
    stage_name?: string;
    data?: Record<string, unknown>;
    spritesheet_url?: string;
    frames?: string[];
    error?: string;
    // New fields for DNA and project updates
    dna?: CharacterDNA;
    update_type?: string;
    animation_type?: string;
}

// API Response Types
export interface APIResponse<T> {
    data?: T;
    error?: string;
}

// =======================================================
// DUAL-CHARACTER ANIMATION TYPES
// =======================================================

export type GenerationMode = "single" | "dual";

// Interaction constraints between two characters
export interface InteractionConstraints {
    reach_advantage: "A" | "B" | "equal";
    speed_advantage: "A" | "B" | "equal";
    mass_ratio: number;
    likely_responses: string[];
}

// Responder action suggestion
export interface ResponderSuggestion {
    action: string;
    reason: string;
    recommended: boolean;
}

// Result of responder action auto-suggestion
export interface ResponderActionResult {
    instigator_action: string;
    suggested_actions: ResponderSuggestion[];
    requires_user_confirmation: boolean;
}

// Dual character DNA (both characters)
export interface DualCharacterDNA {
    instigator: CharacterDNA;
    responder: CharacterDNA;
    interaction: InteractionConstraints;
}

// Extended animation frame with impact window
export interface DualAnimationFrame extends AnimationFrame {
    impact_window?: boolean;
    force_vector?: string | null;
}

// Dual pipeline status
export interface DualPipelineStatus {
    project_id: string;
    generation_mode: GenerationMode;
    is_dual: boolean;
    // Status flags
    has_instigator_dna: boolean;
    has_responder_dna: boolean;
    has_instigator_script: boolean;
    has_responder_script: boolean;
    has_instigator_frames: boolean;
    has_responder_frames: boolean;
    // Actual data
    instigator_dna?: CharacterDNA;
    responder_dna?: CharacterDNA;
    interaction_constraints?: InteractionConstraints;
    instigator_script?: AnimationScript;
    responder_script?: AnimationScript;
    instigator_spritesheet_url?: string;
    instigator_frame_urls?: string[];
    responder_spritesheet_url?: string;
    responder_frame_urls?: string[];
    suggested_responder_actions: ResponderSuggestion[];
    responder_action_type?: string;
    // Pipeline parameters
    action_type?: string;
    difficulty_tier?: DifficultyTier;
    perspective?: Perspective;
}


// Dual script generation result
export interface DualScriptResult {
    project_id: string;
    status: string;
    instigator_dna: CharacterDNA;
    responder_dna: CharacterDNA;
    interaction: InteractionConstraints;
    frame_budget: FrameBudget;
    suggested_responder_actions: ResponderActionResult;
}

// Dual sprite generation result
export interface DualSpriteResult {
    project_id: string;
    status: string;
    instigator: {
        spritesheet_url: string;
        frame_urls: string[];
        frame_count: number;
    };
    responder: {
        spritesheet_url: string;
        frame_urls: string[];
        frame_count: number;
    };
}

