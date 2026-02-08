"""
Stage 3b: Action Validation

Validates user-selected action against Character DNA constraints.
"""
from __future__ import annotations
from typing import Literal
from pydantic import BaseModel
from app.services.gemini_client import gemini_client
from app.models import CharacterDNA


class ActionValidationResult(BaseModel):
    """Result of action validation."""
    status: Literal["VALID", "INVALID", "AMBIGUOUS"]
    reason: str
    suggested_alternatives: list[str] = []
    clarifying_question: str | None = None


ACTION_VALIDATION_PROMPT = """
Validate whether the requested action is physically plausible for this character.

Character DNA:
{dna}

Requested Action: {action}
Difficulty Tier: {difficulty}

Validation Rules:
1. Check if the action is compatible with the character's body_type
2. Verify the action matches weapon_type (if applicable)
3. Ensure difficulty tier is appropriate for anatomical_constraints
4. Consider equipment effects on motion

Return JSON:
{{
    "status": "VALID" | "INVALID" | "AMBIGUOUS",
    "reason": "Explanation of the validation result",
    "suggested_alternatives": ["Alternative action if invalid"],
    "clarifying_question": "Question to ask if ambiguous, else null"
}}

Examples of INVALID:
- Requesting "Wing Flap" for a character without wings
- Requesting "Sword Slash" when weapon_type is "staff"
- Requesting BOSS tier for a clearly minor character

Examples of AMBIGUOUS:
- Action could be interpreted multiple ways
- Difficulty tier seems mismatched but could work
"""


async def validate_action(
    dna: CharacterDNA,
    action: str,
    difficulty_tier: Literal["LIGHT", "HEAVY", "BOSS"],
) -> ActionValidationResult:
    """
    Validate an action against Character DNA.
    
    Args:
        dna: Character DNA
        action: Requested action type
        difficulty_tier: Requested difficulty tier
    
    Returns:
        ActionValidationResult with status and alternatives
    """
    prompt = ACTION_VALIDATION_PROMPT.format(
        dna=dna.model_dump_json(indent=2),
        action=action,
        difficulty=difficulty_tier,
    )
    
    result = await gemini_client.generate_text(
        prompt=prompt,
        thinking_level="low",
        temperature=0.2,
    )
    
    # Handle unexpected response types from Gemini
    if isinstance(result, dict):
        return ActionValidationResult(**result)
    else:
        # Fallback: if Gemini returns list or other type, assume valid
        print(f"⚠️ Unexpected validation response type: {type(result)}, assuming VALID")
        return ActionValidationResult(
            status="VALID",
            reason="Action validation returned unexpected format, proceeding as valid.",
            suggested_alternatives=[],
            clarifying_question=None,
        )

