"""
Stage 1b: Dual Character DNA Extraction

Extends Stage 1 to analyze TWO reference images for relational animations.
Extracts DNA for both instigator and responder, plus interaction constraints.
"""
from app.services.gemini_client import gemini_client
from app.models import CharacterDNA, DualCharacterDNA, InteractionConstraints
from app.prompts import load_prompt


DUAL_DNA_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "instigator": {
            "type": "object",
            "properties": {
                "archetype": {"type": "string"},
                "mass_class": {"type": "string", "enum": ["light", "medium", "heavy"]},
                "mobility": {"type": "string", "enum": ["low", "medium", "high"]},
                "weapon_type": {"type": "string", "nullable": True},
                "weapon_mass": {"type": "string", "enum": ["none", "light", "medium", "heavy", "oversized"]},
                "limb_constraints": {"type": "string", "nullable": True},
            },
            "required": ["archetype", "mass_class", "mobility", "weapon_mass"],
        },
        "responder": {
            "type": "object",
            "properties": {
                "archetype": {"type": "string"},
                "mass_class": {"type": "string", "enum": ["light", "medium", "heavy"]},
                "mobility": {"type": "string", "enum": ["low", "medium", "high"]},
                "weapon_type": {"type": "string", "nullable": True},
                "weapon_mass": {"type": "string", "enum": ["none", "light", "medium", "heavy", "oversized"]},
                "limb_constraints": {"type": "string", "nullable": True},
            },
            "required": ["archetype", "mass_class", "mobility", "weapon_mass"],
        },
        "interaction": {
            "type": "object",
            "properties": {
                "reach_advantage": {"type": "string", "enum": ["A", "B", "equal"]},
                "speed_advantage": {"type": "string", "enum": ["A", "B", "equal"]},
                "mass_ratio": {"type": "number"},
                "likely_responses": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["reach_advantage", "speed_advantage", "mass_ratio", "likely_responses"],
        },
    },
    "required": ["instigator", "responder", "interaction"],
}


def _convert_to_full_dna(compact_dna: dict) -> CharacterDNA:
    """Convert compact dual-DNA format to full CharacterDNA model."""
    return CharacterDNA(
        archetype=compact_dna["archetype"],
        body_type="humanoid",  # Default for dual mode
        dominant_colors=[],
        equipment=[],
        weapon_type=compact_dna.get("weapon_type"),
        weapon_mass=compact_dna.get("weapon_mass", "medium"),
        special_features=[],
        anatomical_constraints=[compact_dna["limb_constraints"]] if compact_dna.get("limb_constraints") else [],
    )


async def extract_dual_character_dna(
    instigator_image: bytes,
    responder_image: bytes,
) -> DualCharacterDNA:
    """
    Extract Character DNA for both instigator and responder.
    
    Args:
        instigator_image: Reference image for attacking character
        responder_image: Reference image for reacting character
    
    Returns:
        DualCharacterDNA with both characters and interaction constraints
    """
    from google.genai import types
    
    # Load the dual DNA prompt
    prompt = load_prompt("stage_1b_dual_dna")
    
    # Create image parts
    instigator_part = types.Part.from_bytes(data=instigator_image, mime_type="image/png")
    responder_part = types.Part.from_bytes(data=responder_image, mime_type="image/png")
    
    # Call Gemini with both images
    # We need to use the raw client for multi-image
    config = types.GenerateContentConfig(
        system_instruction=gemini_client.get_system_instruction("1b_dual_dna"),
        temperature=0.3,
        response_mime_type="application/json",
        thinking_config=types.ThinkingConfig(thinking_budget=8192),
    )
    
    response = await gemini_client.client.aio.models.generate_content(
        model=gemini_client.settings.gemini_text_model,
        contents=[
            "Image 1 (Instigator - the attacker):",
            instigator_part,
            "Image 2 (Responder - the reactor):",
            responder_part,
            prompt,
        ],
        config=config,
    )
    
    result = gemini_client._parse_json_response(response.text)
    
    # Convert to full models
    instigator_dna = _convert_to_full_dna(result["instigator"])
    responder_dna = _convert_to_full_dna(result["responder"])
    
    interaction = InteractionConstraints(
        reach_advantage=result["interaction"]["reach_advantage"],
        speed_advantage=result["interaction"]["speed_advantage"],
        mass_ratio=result["interaction"]["mass_ratio"],
        likely_responses=result["interaction"]["likely_responses"],
    )
    
    return DualCharacterDNA(
        instigator=instigator_dna,
        responder=responder_dna,
        interaction=interaction,
    )
