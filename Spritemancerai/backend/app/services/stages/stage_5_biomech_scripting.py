"""
Stage 5: Biomechanical Scripting

Generates physics-aware frame-by-frame animation scripts.
"""
from typing import Literal
from app.services.gemini_client import gemini_client
from app.models import CharacterDNA, AnimationScript, AnimationFrame, FrameBudget

# Valid phase values
VALID_PHASES = ["Anticipation", "Contact", "Recovery", "Idle", "Follow-through", "Startup"]

BIOMECH_SCRIPTING_PROMPT = """
Generate a detailed biomechanical animation script for this character.

Character DNA:
{dna}

Action: {action}
Difficulty Tier: {difficulty}
Frame Count: EXACTLY {frame_count} frames

Motion Principles:
- LIGHT: Short anticipation, minimal recovery, compact silhouette
- HEAVY: Extended anticipation, pronounced follow-through, visible recovery
- BOSS: Very long anticipation, extreme follow-through, large silhouette, slow recovery

Phase Distribution Guide:
- 4 frames: 1 Anticipation, 1 Contact (hold), 1 Follow-through, 1 Recovery
- 6 frames: 1 Anticipation, 1 Startup, 1 Contact (hold), 2 Follow-through, 1 Recovery  
- 8 frames: 2 Anticipation, 1 Startup, 1 Contact (hold), 2 Follow-through, 2 Recovery
- 9 frames: 2 Anticipation, 1 Startup, 2 Contact (peak+hold), 2 Follow-through, 2 Recovery
- 12 frames: 3 Anticipation, 1 Startup, 2 Contact (peak+hold), 3 Follow-through, 3 Recovery

Timing Principles:
- Contact/peak frames should be held for emphasis
- Longer anticipation = heavier/more powerful action
- Recovery should be >= anticipation to sell weight

Physics Considerations:
- Weapon mass: {weapon_mass} (affects swing speed and follow-through)
- Anatomical constraints: {constraints}
- Center of mass must remain plausible throughout

Output EXACTLY {frame_count} frames. Each frame must have:
- frame_index: 0 to {max_index}
- phase: EXACTLY one of: Anticipation, Contact, Recovery, Idle, Follow-through, Startup
- pose_description: Detailed pose for pixel artist
- visual_focus: Key element to emphasize

EFFECT SUGGESTIONS (optional but recommended):
Based on action phases, suggest visual effects that would enhance this animation:
- Contact phase: impact sparks, slash trails, hit flashes
- Recovery with landing: dust puffs at feet
- Magic/Cast actions: aura effects, magical particles

Return JSON:
{{
    "physics_reasoning": "Explanation of physics/biomechanics decisions",
    "frames": [
        {{
            "frame_index": 0,
            "phase": "Anticipation",
            "pose_description": "Detailed pose description",
            "visual_focus": "What to emphasize"
        }}
    ],
    "suggested_effects": [
        {{
            "effect_type": "particle",
            "preset": "impact_spark",
            "trigger_frame": 3,
            "duration_frames": 2,
            "position": "center",
            "reason": "Contact phase - weapon impact"
        }}
    ]
}}

CRITICAL: 
- You MUST output EXACTLY {frame_count} frames
- Phase MUST be exactly one of: Anticipation, Contact, Recovery, Idle, Follow-through, Startup
- Effect presets: impact_spark, slash_light, slash_heavy, dust_puff, magic_burst, fire_burst
- Effect positions: center, weapon_tip, feet, head
"""


def normalize_phase(phase: str) -> str:
    """Normalize phase value to match expected literals."""
    phase_lower = phase.lower().strip()
    
    # Map common variations to valid phases
    phase_mapping = {
        "idle": "Idle",
        "idle (base)": "Idle",
        "base": "Idle",
        "anticipation": "Anticipation",
        "wind-up": "Anticipation",
        "windup": "Anticipation",
        "contact": "Contact",
        "impact": "Contact",
        "hit": "Contact",
        "recovery": "Recovery",
        "return": "Recovery",
        "settle": "Recovery",
        "follow-through": "Follow-through",
        "followthrough": "Follow-through",
        "follow through": "Follow-through",
        "startup": "Startup",
        "start": "Startup",
    }
    
    # Check exact match first
    if phase in VALID_PHASES:
        return phase
    
    # Try mapping
    if phase_lower in phase_mapping:
        return phase_mapping[phase_lower]
    
    # Try partial match
    for valid in VALID_PHASES:
        if valid.lower() in phase_lower:
            return valid
    
    # Default to Idle if unknown
    print(f"⚠️ Unknown phase '{phase}', defaulting to 'Idle'")
    return "Idle"


async def generate_biomech_script(
    dna: CharacterDNA,
    action: str,
    difficulty_tier: Literal["LIGHT", "HEAVY", "BOSS"],
    frame_budget: FrameBudget,
) -> AnimationScript:
    """
    Generate a biomechanically-grounded animation script.
    
    Args:
        dna: Character DNA
        action: Action type
        difficulty_tier: Difficulty tier
        frame_budget: Computed frame budget (frame count is binding)
    
    Returns:
        AnimationScript with physics reasoning and frame-by-frame breakdown
    """
    prompt = BIOMECH_SCRIPTING_PROMPT.format(
        dna=dna.model_dump_json(indent=2),
        action=action,
        difficulty=difficulty_tier,
        frame_count=frame_budget.final_frame_count,
        max_index=frame_budget.final_frame_count - 1,
        weapon_mass=dna.weapon_mass,
        constraints=", ".join(dna.anatomical_constraints) or "none",
    )
    
    result = await gemini_client.generate_text(
        prompt=prompt,
        thinking_level="high",
        temperature=0.4,
        stage="5_script",
    )
    
    # Normalize phases and create frames
    frames = []
    for f in result.get("frames", []):
        f["phase"] = normalize_phase(f.get("phase", "Idle"))
        frames.append(AnimationFrame(**f))
    
    if len(frames) != frame_budget.final_frame_count:
        raise ValueError(
            f"Script generated {len(frames)} frames, expected {frame_budget.final_frame_count}"
        )
    
    # Extract suggested effects from AI response
    suggested_effects = result.get("suggested_effects", [])
    
    return AnimationScript(
        action_type=action,
        difficulty_tier=difficulty_tier,
        physics_reasoning=result.get("physics_reasoning", ""),
        frames=frames,
        suggested_effects=suggested_effects,
    )
