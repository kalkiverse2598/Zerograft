"""
Stage 1: Character DNA Extraction

Extracts semantic Character DNA from a reference image using
gemini-3-pro-preview with high thinking level.
"""
from app.services.gemini_client import gemini_client
from app.models import CharacterDNA

DNA_EXTRACTION_PROMPT = """
You are analyzing a reference image to extract Character DNA for 2D pixel art animation.

Extract the following information from the image and return as JSON:

{
    "archetype": "Character archetype (warrior, mage, rogue, archer, etc.)",
    "body_type": "Body type (humanoid, quadruped, winged, mechanical, etc.)",
    "dominant_colors": ["#hex1", "#hex2", "#hex3"],
    "equipment": ["visible equipment items"],
    "weapon_type": "Primary weapon if visible, or null",
    "weapon_mass": "none|light|medium|heavy|oversized based on weapon size",
    "special_features": ["distinctive visual features"],
    "anatomical_constraints": ["physical constraints affecting motion"]
}

Guidelines:
- Be precise about colors - use actual hex values from the image
- List ALL visible equipment including armor, accessories, clothing
- For weapon_mass: none=no weapon, light=dagger/wand, medium=sword/staff, heavy=axe/hammer, oversized=giant weapons
- Special features include: glowing effects, tails, wings, horns, capes, etc.
- Anatomical constraints include: heavy armor (limits flexibility), cape/cloak (affects silhouette), prosthetics, etc.

Analyze the image thoroughly and extract accurate Character DNA.
"""

DNA_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "archetype": {"type": "string"},
        "body_type": {"type": "string"},
        "dominant_colors": {"type": "array", "items": {"type": "string"}},
        "equipment": {"type": "array", "items": {"type": "string"}},
        "weapon_type": {"type": "string", "nullable": True},
        "weapon_mass": {"type": "string", "enum": ["none", "light", "medium", "heavy", "oversized"]},
        "special_features": {"type": "array", "items": {"type": "string"}},
        "anatomical_constraints": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["archetype", "body_type", "dominant_colors", "equipment", "weapon_mass", "special_features", "anatomical_constraints"],
}


async def extract_character_dna(image_bytes: bytes) -> CharacterDNA:
    """
    Extract Character DNA from a reference image.
    
    Args:
        image_bytes: Reference image in PNG/JPG format
    
    Returns:
        CharacterDNA model with extracted semantic information
    """
    result = await gemini_client.generate_text_with_image(
        prompt=DNA_EXTRACTION_PROMPT,
        image_bytes=image_bytes,
        thinking_level="high",
        temperature=0.3,
        response_schema=DNA_RESPONSE_SCHEMA,
        stage="1_dna",
    )
    
    return CharacterDNA(**result)
