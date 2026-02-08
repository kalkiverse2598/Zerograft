"""
Stage 3c: Frame Budget Computation

Auto-scales frame count based on action type, difficulty, weapon mass, and perspective.
"""
from typing import Literal
from decimal import Decimal, ROUND_HALF_UP
from app.models import FrameBudget

# Base frame counts per action type
BASE_FRAMES: dict[str, int] = {
    # Basic Movement
    "Idle": 4,
    "Walk": 6,
    "Run": 8,
    "Jump": 6,
    "Dash": 6,
    "Crouch": 4,
    "Climb": 8,
    "Fall": 4,
    "Swim": 8,
    
    # Combat Actions
    "Light Attack": 6,
    "Heavy Attack": 8,
    "Combo Attack": 10,
    "Ranged Attack": 6,
    "Special Attack": 8,
    "Block": 4,
    "Dodge": 6,
    "Cast": 8,
    
    # Reactions & States
    "Hurt": 4,
    "Hit Reaction": 4,  # Legacy alias
    "Stun": 4,
    "Death": 10,
    "Get Up": 6,
    
    # Utility Actions
    "Taunt": 6,
    "Interact": 4,
    "Pick Up": 4,
    "Throw": 6,
    
    # Character States
    "Sleep": 4,
    "Sit": 4,
    "Victory": 8,
    "Spawn": 6,
    
    # Legacy aliases
    "Combo": 10,
    "Special": 8,
}

# Multipliers
DIFFICULTY_MULTIPLIERS: dict[str, float] = {
    "LIGHT": 1.0,
    "HEAVY": 1.25,
    "BOSS": 1.6,
}

MASS_MULTIPLIERS: dict[str, float] = {
    "none": 1.0,
    "light": 1.0,
    "medium": 1.1,
    "heavy": 1.25,
    "oversized": 1.4,
}

PERSPECTIVE_MULTIPLIERS: dict[str, float] = {
    "side": 1.0,
    "front": 1.1,
    "isometric": 1.2,
    "top_down": 0.9,
}

# Preferred frame counts (for grid alignment)
PREFERRED_FRAMES = [4, 6, 8, 9, 12, 16]


def compute_frame_budget(
    action_type: str,
    difficulty_tier: Literal["LIGHT", "HEAVY", "BOSS"],
    weapon_mass: Literal["none", "light", "medium", "heavy", "oversized"],
    perspective: Literal["side", "front", "isometric", "top_down"] = "side",
) -> FrameBudget:
    """
    Compute frame budget for an animation.
    
    Uses base frame count modified by difficulty, weapon mass, and perspective.
    Result is snapped to preferred frame counts for grid alignment.
    
    Args:
        action_type: Type of action (Idle, Walk, Attack, etc.)
        difficulty_tier: LIGHT, HEAVY, or BOSS
        weapon_mass: Weapon weight category
        perspective: View angle
    
    Returns:
        FrameBudget with computed values and justification
    """
    # Get base frames (default to 6 for unknown actions)
    base = BASE_FRAMES.get(action_type, 6)
    
    # Apply multipliers
    difficulty_mult = DIFFICULTY_MULTIPLIERS[difficulty_tier]
    mass_mult = MASS_MULTIPLIERS[weapon_mass]
    perspective_mult = PERSPECTIVE_MULTIPLIERS[perspective]
    
    total_multiplier = difficulty_mult * mass_mult * perspective_mult
    raw_frames = base * total_multiplier
    
    # Round to nearest integer (ROUND_HALF_UP per PRD spec)
    rounded_frames = int(Decimal(str(raw_frames)).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
    
    # Snap to preferred frame count
    final_frames = min(PREFERRED_FRAMES, key=lambda x: abs(x - rounded_frames))
    
    # Clamp to valid range
    final_frames = max(4, min(16, final_frames))
    
    # Determine grid dimension
    if final_frames <= 4:
        grid_dim = 2
    elif final_frames <= 9:
        grid_dim = 3
    else:
        grid_dim = 4
    
    # Build justification
    justification = (
        f"Base {base} frames for {action_type}, "
        f"×{difficulty_mult:.2f} ({difficulty_tier}), "
        f"×{mass_mult:.2f} ({weapon_mass} weapon), "
        f"×{perspective_mult:.2f} ({perspective} view) = "
        f"{raw_frames:.1f} → snapped to {final_frames} frames ({grid_dim}x{grid_dim} grid)"
    )
    
    return FrameBudget(
        action_type=action_type,
        difficulty_tier=difficulty_tier,
        weapon_mass=weapon_mass,
        perspective=perspective,
        base_frames=base,
        multiplier_applied=total_multiplier,
        final_frame_count=final_frames,
        grid_dim=grid_dim,
        justification=justification,
    )
