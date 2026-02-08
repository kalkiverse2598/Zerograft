"""
Effect Types - Shared schema for hybrid effects system

Pydantic models matching frontend TypeScript types for pipeline integration.
"""
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# ============================================================================
# Effect Type Enums
# ============================================================================

class EffectType(str, Enum):
    PARTICLE = "particle"
    FLUID = "fluid"
    BREAK = "break"
    SMEAR = "smear"
    SLASH = "slash"


class EffectPosition(str, Enum):
    CENTER = "center"
    WEAPON_TIP = "weapon_tip"
    FEET = "feet"
    HEAD = "head"
    CUSTOM = "custom"


class BlendMode(str, Enum):
    NORMAL = "normal"
    ADD = "add"
    SCREEN = "screen"
    MULTIPLY = "multiply"


# ============================================================================
# Effect Event - Core schema for when/where effects trigger
# ============================================================================

class EffectEvent(BaseModel):
    """Effect event triggered on a specific animation frame."""
    id: str = ""
    effect_type: EffectType
    preset: str                                    # e.g., 'fire_slash', 'dust_puff'
    trigger_frame: int                             # Animation frame index
    duration_frames: int                           # How many frames effect plays
    position: EffectPosition = EffectPosition.CENTER
    custom_offset: Optional[dict] = None           # {x, y} for custom position
    palette: Optional[list[str]] = None            # Hex colors from DNA
    intensity: float = 1.0                         # 0-1 effect strength
    blend_mode: BlendMode = BlendMode.ADD


# ============================================================================
# Effect Suggestion - Pipeline output for auto-suggested effects
# ============================================================================

class EffectSuggestion(BaseModel):
    """AI-suggested effect based on animation analysis."""
    effect_type: EffectType
    preset: str
    trigger_frame: int
    duration_frames: int
    position: EffectPosition = EffectPosition.CENTER
    reason: str                                    # Why this effect was suggested
    confidence: float = Field(ge=0, le=1)          # 0-1 confidence score


# ============================================================================
# Phase to Effect Mapping
# ============================================================================

PHASE_EFFECT_SUGGESTIONS: dict[str, list[dict]] = {
    "Contact": [
        {
            "effect_type": EffectType.SLASH,
            "preset": "slash_light",
            "duration_frames": 2,
            "position": EffectPosition.WEAPON_TIP,
            "reason": "Contact phase - weapon strike",
            "actions": ["attack", "slash", "strike", "hit"],
        },
        {
            "effect_type": EffectType.PARTICLE,
            "preset": "impact_spark",
            "duration_frames": 3,
            "position": EffectPosition.CENTER,
            "reason": "Contact phase - hit impact",
            "actions": ["attack", "slash", "strike", "hit"],
        },
    ],
    "Recovery": [
        {
            "effect_type": EffectType.PARTICLE,
            "preset": "dust_puff",
            "duration_frames": 4,
            "position": EffectPosition.FEET,
            "reason": "Recovery phase - ground impact",
            "actions": ["jump", "land", "dash"],
        },
    ],
    "Anticipation": [
        {
            "effect_type": EffectType.PARTICLE,
            "preset": "magic_burst",
            "duration_frames": 4,
            "position": EffectPosition.CENTER,
            "reason": "Anticipation phase - magic charging",
            "actions": ["cast", "magic", "spell"],
        },
    ],
}


def suggest_effects_for_script(
    frames: list[dict],
    action_type: str,
) -> list[EffectSuggestion]:
    """
    Generate effect suggestions based on animation script.
    
    Args:
        frames: List of animation frames with phase info
        action_type: The action being animated
    
    Returns:
        List of suggested effects with frame timing
    """
    suggestions = []
    action_lower = action_type.lower()
    
    for frame in frames:
        phase = frame.get("phase", "")
        frame_index = frame.get("frame_index", 0)
        
        phase_suggestions = PHASE_EFFECT_SUGGESTIONS.get(phase, [])
        
        for suggestion_template in phase_suggestions:
            # Check if this action matches the suggestion
            matching_actions = suggestion_template.get("actions", [])
            if any(action in action_lower for action in matching_actions):
                suggestion = EffectSuggestion(
                    effect_type=suggestion_template["effect_type"],
                    preset=suggestion_template["preset"],
                    trigger_frame=frame_index,
                    duration_frames=suggestion_template["duration_frames"],
                    position=suggestion_template["position"],
                    reason=suggestion_template["reason"],
                    confidence=0.8,
                )
                suggestions.append(suggestion)
    
    return suggestions
