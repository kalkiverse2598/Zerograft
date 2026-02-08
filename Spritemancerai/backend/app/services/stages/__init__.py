"""Pipeline stages for SpriteMancer AI."""
from .stage_1_dna_extraction import extract_character_dna
from .stage_2_dna_verification import verify_dna_edit, apply_verified_edit
from .stage_3a_action_suggestion import suggest_actions, ActionSuggestion, ActionSuggestionResult
from .stage_3b_action_validation import validate_action, ActionValidationResult
from .stage_3c_frame_budget import compute_frame_budget
from .stage_4_intent_mirroring import mirror_intent, IntentMirror
from .stage_5_biomech_scripting import generate_biomech_script
from .stage_6_image_generation import generate_spritesheet, build_spritesheet_prompt
from .stage_7_post_processing import (
    extract_frames,
    extract_frames_hybrid,
    extract_frames_by_contour,
    count_sprites_by_contour,
    normalize_frames,
    encode_frame_png,
    detect_grid_layout_with_gemini,
    detect_grid_layout_sync,
    ExtractedFrame,
    PostProcessingResult,
)
from .stage_7b_generate_maps import (
    generate_lighting_maps,
    generate_lighting_maps_for_frame,
    encode_lighting_map_png,
    LightingMaps,
    LightingMapsResult,
)
from .stage_8_repair_loop import repair_frame, auto_detect_issues

# Dual-character stages
from .stage_1b_dual_dna import extract_dual_character_dna
from .stage_2b_responder_action import suggest_responder_actions, get_default_responder_actions
from .stage_5b_responder_script import generate_responder_script, RESPONDER_BINDING

__all__ = [
    # Stage 1
    "extract_character_dna",
    # Stage 1b (Dual)
    "extract_dual_character_dna",
    # Stage 2
    "verify_dna_edit",
    "apply_verified_edit",
    # Stage 2b (Dual)
    "suggest_responder_actions",
    "get_default_responder_actions",
    # Stage 3
    "suggest_actions",
    "ActionSuggestion",
    "ActionSuggestionResult",
    "validate_action",
    "ActionValidationResult",
    "compute_frame_budget",
    # Stage 4
    "mirror_intent",
    "IntentMirror",
    # Stage 5
    "generate_biomech_script",
    # Stage 5b (Dual)
    "generate_responder_script",
    "RESPONDER_BINDING",
    # Stage 6
    "generate_spritesheet",
    "build_spritesheet_prompt",
    # Stage 7
    "extract_frames",
    "extract_frames_hybrid",
    "extract_frames_by_contour",
    "count_sprites_by_contour",
    "normalize_frames",
    "encode_frame_png",
    "detect_grid_layout_with_gemini",
    "detect_grid_layout_sync",
    "ExtractedFrame",
    "PostProcessingResult",
    # Stage 7b (Lighting Maps)
    "generate_lighting_maps",
    "generate_lighting_maps_for_frame",
    "encode_lighting_map_png",
    "LightingMaps",
    "LightingMapsResult",
    # Stage 8
    "repair_frame",
    "auto_detect_issues",
]

