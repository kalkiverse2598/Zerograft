"""
Prompt template loader for SpriteMancer AI stages.
"""
import os
import json
from pathlib import Path
from typing import Any


PROMPTS_DIR = Path(__file__).parent


def load_system_instruction() -> dict:
    """Load the main system instruction JSON."""
    path = PROMPTS_DIR / "system_instruction.json"
    if not path.exists():
        raise FileNotFoundError(f"System instruction not found at {path}")
    
    with open(path, "r") as f:
        return json.load(f)


def load_prompt(stage_name: str, variables: dict[str, Any] = None) -> str:
    """
    Load and format a stage-specific prompt template.
    
    Args:
        stage_name: Name of the stage (e.g., "stage_1_dna", "stage_5_script")
        variables: Dictionary of variables to substitute into the template
    
    Returns:
        Formatted prompt string
    """
    path = PROMPTS_DIR / f"{stage_name}.txt"
    if not path.exists():
        raise FileNotFoundError(f"Prompt template not found: {path}")
    
    with open(path, "r") as f:
        template = f.read()
    
    if variables:
        # Simple string formatting with .format()
        # For complex structures, convert to JSON
        formatted_vars = {}
        for key, value in variables.items():
            if isinstance(value, (dict, list)):
                formatted_vars[key] = json.dumps(value, indent=2)
            else:
                formatted_vars[key] = str(value)
        
        try:
            template = template.format(**formatted_vars)
        except KeyError as e:
            # Missing variable - leave placeholder
            print(f"Warning: Missing template variable: {e}")
    
    return template


def get_dna_extraction_prompt() -> str:
    """Get the Stage 1 DNA extraction prompt."""
    return load_prompt("stage_1_dna")


def get_frame_budget_prompt(
    action_type: str,
    difficulty_tier: str,
    weapon_mass: str,
    perspective: str
) -> str:
    """Get the Stage 3 frame budget prompt with variables."""
    return load_prompt("stage_3_budget", {
        "action_type": action_type,
        "difficulty_tier": difficulty_tier,
        "weapon_mass": weapon_mass,
        "perspective": perspective,
    })


def get_intent_mirror_prompt(
    archetype: str,
    body_type: str,
    action_type: str,
    difficulty_tier: str,
    frame_count: int,
    perspective: str
) -> str:
    """Get the Stage 4 intent mirroring prompt with variables."""
    return load_prompt("stage_4_intent", {
        "archetype": archetype,
        "body_type": body_type,
        "action_type": action_type,
        "difficulty_tier": difficulty_tier,
        "frame_count": frame_count,
        "perspective": perspective,
    })


def get_biomech_script_prompt(
    character_dna: dict,
    action_type: str,
    difficulty_tier: str,
    frame_count: int,
    perspective: str,
    weapon_mass: str = "medium"
) -> str:
    """Get the Stage 5 biomechanical script prompt with variables."""
    return load_prompt("stage_5_script", {
        "character_dna_json": character_dna,
        "action_type": action_type,
        "difficulty_tier": difficulty_tier,
        "frame_count": frame_count,
        "perspective": perspective,
        "weapon_mass": weapon_mass,
    })


def get_image_generation_prompt(
    character_dna: dict,
    animation_script: dict,
    grid_dim: int,
    frame_count: int
) -> str:
    """Get the Stage 6 image generation prompt with variables."""
    # Build frame layout description
    frame_layout_lines = []
    for i in range(frame_count):
        row = i // grid_dim
        col = i % grid_dim
        frame_layout_lines.append(f"- Frame {i+1}: Row {row+1}, Column {col+1}")
    frame_layout = "\n".join(frame_layout_lines)
    
    return load_prompt("stage_6_image", {
        "character_dna_json": character_dna,
        "animation_script_json": animation_script,
        "grid_dim": grid_dim,
        "frame_count": frame_count,
        "frame_layout": frame_layout,
    })
