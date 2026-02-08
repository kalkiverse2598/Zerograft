"""
Stage 2: DNA Verification

Verifies user edits to Character DNA against the reference image
to ensure claims are visually grounded.
"""
from app.services.gemini_client import gemini_client
from app.models import CharacterDNA, DNAVerificationResult

DNA_VERIFICATION_PROMPT = """
You are verifying a user's edit to Character DNA against a reference image.

Current DNA:
{current_dna}

User's proposed edit:
{user_edit}

Examine the reference image and determine:
1. Is the user's claim visually present in the image?
2. What visual evidence supports or contradicts this claim?
3. Should we UPDATE_DNA or FLAG_AS_NEW_FEATURE?

Return JSON:
{{
    "claim_verified": true/false,
    "visual_evidence": "Description of what you see in the image",
    "confidence_score": 0.0-1.0,
    "action": "UPDATE_DNA" or "FLAG_AS_NEW_FEATURE"
}}

Rules:
- If the claim is clearly visible in the image, set claim_verified=true and action=UPDATE_DNA
- If the claim is NOT visible but could be added, set claim_verified=false and action=FLAG_AS_NEW_FEATURE
- If the claim contradicts what's visible, set claim_verified=false with low confidence
- Be conservative - only verify what you can clearly see
"""

VERIFICATION_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "claim_verified": {"type": "boolean"},
        "visual_evidence": {"type": "string"},
        "confidence_score": {"type": "number", "minimum": 0, "maximum": 1},
        "action": {"type": "string", "enum": ["UPDATE_DNA", "FLAG_AS_NEW_FEATURE"]},
    },
    "required": ["claim_verified", "visual_evidence", "confidence_score", "action"],
}


async def verify_dna_edit(
    current_dna: CharacterDNA,
    user_edit: dict,
    reference_image: bytes,
) -> DNAVerificationResult:
    """
    Verify a user's edit to Character DNA against the reference image.
    
    Args:
        current_dna: Current Character DNA
        user_edit: Dictionary of proposed changes
        reference_image: Original reference image bytes
    
    Returns:
        DNAVerificationResult with verification status and recommended action
    """
    prompt = DNA_VERIFICATION_PROMPT.format(
        current_dna=current_dna.model_dump_json(indent=2),
        user_edit=str(user_edit),
    )
    
    result = await gemini_client.generate_text_with_image(
        prompt=prompt,
        image_bytes=reference_image,
        thinking_level="high",
        temperature=0.2,
        response_schema=VERIFICATION_RESPONSE_SCHEMA,
    )
    
    return DNAVerificationResult(**result)


async def apply_verified_edit(
    current_dna: CharacterDNA,
    user_edit: dict,
    verification: DNAVerificationResult,
) -> CharacterDNA:
    """
    Apply a verified edit to Character DNA.
    
    Args:
        current_dna: Current DNA
        user_edit: Verified edit to apply
        verification: Verification result (must have action=UPDATE_DNA)
    
    Returns:
        Updated CharacterDNA
    """
    if verification.action != "UPDATE_DNA":
        raise ValueError("Cannot apply unverified edit. Verification action must be UPDATE_DNA.")
    
    # Merge edit into current DNA
    dna_dict = current_dna.model_dump()
    dna_dict.update(user_edit)
    
    return CharacterDNA(**dna_dict)
