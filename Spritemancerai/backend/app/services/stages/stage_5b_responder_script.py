"""
Stage 5b: Responder Animation Script Derivation

Generates responder animation scripts that are DERIVED from the instigator's timeline.
Enforces temporal causality: responder cannot react before instigator acts.
"""
from typing import Literal
from app.services.gemini_client import gemini_client
from app.models import CharacterDNA, AnimationScript, AnimationFrame, InteractionConstraints
from app.prompts import load_prompt
from .stage_5_biomech_scripting import normalize_phase


# Responder binding rules
RESPONDER_BINDING = {
    "impact": "reaction_start",  # Responder reacts when instigator hits
    "recovery": "stagger_or_reset"  # Responder recovers after hit
}


RESPONDER_SCRIPT_PROMPT = """
Generate a REACTIVE animation script for the responder character.
This script MUST be temporally bound to the instigator's timeline.

INSTIGATOR SCRIPT (AUTHORITATIVE TIMELINE):
{instigator_script}

RESPONDER DNA:
{responder_dna}

RESPONDER ACTION: {responder_action}
DIFFICULTY TIER: {difficulty_tier}
FRAME COUNT: EXACTLY {frame_count} frames (MUST match instigator)

BINDING RULES (CRITICAL):
1. Responder CANNOT react before instigator's Anticipation phase
2. Responder's reaction MUST align to instigator's impact_window frames
3. Frame count MUST be exactly {frame_count} - same as instigator

PHASE MAPPING:
| Instigator Phase       | Responder Phase (if hit)    |
|------------------------|----------------------------|
| Anticipation/Startup   | Ready/Anticipation          |
| Contact (impact_window)| Impact Received/React Start |
| Follow-through         | Stagger/Knockback           |
| Recovery               | Recovery                    |

For {responder_action}, describe each frame with:
- frame_index: 0 to {max_index}
- phase: Anticipation, Contact, Recovery, or Idle
- pose_description: Detailed reactive pose
- visual_focus: Key visual element
- impact_window: true if THIS is when responder receives impact
- force_vector: Direction of knockback/reaction (opposite of attack)

Return JSON:
{{
    "physics_reasoning": "How responder's reaction connects to instigator's attack",
    "frames": [
        {{
            "frame_index": 0,
            "phase": "Anticipation",
            "pose_description": "Detailed pose",
            "visual_focus": "Key element",
            "impact_window": false,
            "force_vector": null
        }}
    ]
}}
"""


async def generate_responder_script(
    instigator_script: AnimationScript,
    responder_dna: CharacterDNA,
    responder_action: str,
    difficulty_tier: Literal["LIGHT", "HEAVY", "BOSS"],
    interaction: InteractionConstraints = None,
) -> AnimationScript:
    """
    Generate responder animation script bound to instigator's timeline.
    
    Args:
        instigator_script: The authoritative instigator animation script
        responder_dna: DNA of the responding character
        responder_action: Selected reaction (e.g., "Staggered Hit", "Backstep Dodge")
        difficulty_tier: Difficulty tier
        interaction: Optional interaction constraints
    
    Returns:
        AnimationScript with frames aligned to instigator's impact windows
    """
    frame_count = instigator_script.frame_count
    
    # Format instigator script for prompt
    instigator_frames_json = []
    for frame in instigator_script.frames:
        instigator_frames_json.append({
            "frame_index": frame.frame_index,
            "phase": frame.phase,
            "pose_description": frame.pose_description[:50] + "...",
            "impact_window": getattr(frame, "impact_window", False),
            "force_vector": getattr(frame, "force_vector", None),
        })
    
    prompt = RESPONDER_SCRIPT_PROMPT.format(
        instigator_script=instigator_frames_json,
        responder_dna=responder_dna.model_dump_json(indent=2),
        responder_action=responder_action,
        difficulty_tier=difficulty_tier,
        frame_count=frame_count,
        max_index=frame_count - 1,
    )
    
    result = await gemini_client.generate_text(
        prompt=prompt,
        thinking_level="high",
        temperature=0.4,
        stage="5b_responder",
    )
    
    # Normalize phases and create frames
    frames = []
    for f in result.get("frames", []):
        f["phase"] = normalize_phase(f.get("phase", "Idle"))
        
        # Convert force_vector to string if Gemini returned a dict
        fv = f.get("force_vector")
        if isinstance(fv, dict):
            force_vector = f"({fv.get('x', 0)}, {fv.get('y', 0)})"
        elif fv:
            force_vector = str(fv)
        else:
            force_vector = None
        
        frames.append(AnimationFrame(
            frame_index=f["frame_index"],
            phase=f["phase"],
            pose_description=f["pose_description"],
            visual_focus=f["visual_focus"],
            impact_window=f.get("impact_window", False),
            force_vector=force_vector,
        ))
    
    # Validate frame count matches
    if len(frames) != frame_count:
        raise ValueError(
            f"Responder script has {len(frames)} frames, must match instigator's {frame_count}"
        )
    
    # Validate temporal causality
    _validate_temporal_binding(instigator_script, frames)
    
    return AnimationScript(
        action_type=responder_action,
        difficulty_tier=difficulty_tier,
        physics_reasoning=result.get("physics_reasoning", ""),
        frames=frames,
    )


def _validate_temporal_binding(
    instigator_script: AnimationScript,
    responder_frames: list[AnimationFrame],
) -> None:
    """
    Validate that responder script obeys temporal causality rules.
    
    Rules:
    1. Responder cannot react (non-Idle/Anticipation) before instigator's first Contact
    2. Responder impact_window must align with instigator's Contact/impact phases
    """
    # Find instigator's first contact frame
    instigator_contact_frame = None
    for frame in instigator_script.frames:
        if frame.phase == "Contact" or getattr(frame, "impact_window", False):
            instigator_contact_frame = frame.frame_index
            break
    
    if instigator_contact_frame is None:
        # No impact in instigator script - responder is just reacting generally
        return
    
    # Check responder doesn't react too early
    for frame in responder_frames:
        if frame.frame_index < instigator_contact_frame:
            # Before impact - responder should only be anticipating
            if frame.phase not in ["Anticipation", "Idle", "Startup"]:
                print(
                    f"⚠️ Temporal warning: Responder {frame.phase} at frame {frame.frame_index} "
                    f"before instigator contact at frame {instigator_contact_frame}"
                )
