"""
Stage 3a: Action Suggestion

Suggests physically plausible actions based on Character DNA.
"""
from __future__ import annotations
from typing import Literal
from pydantic import BaseModel
from app.services.gemini_client import gemini_client
from app.models import CharacterDNA


class ActionSuggestion(BaseModel):
    """A suggested action with applicable difficulty tiers."""
    action: str
    description: str
    difficulty_tiers: list[Literal["LIGHT", "HEAVY", "BOSS"]]
    recommended_tier: Literal["LIGHT", "HEAVY", "BOSS"]


class ActionSuggestionResult(BaseModel):
    """Result of action suggestion."""
    suggested_actions: list[ActionSuggestion]
    auto_suggested_weapon: str | None = None


ACTION_SUGGESTION_PROMPT = """
Based on the Character DNA below, suggest appropriate animation actions.

Character DNA:
{dna}

For each suggested action, provide:
1. Action name (e.g., "Sword Slash", "Fireball Cast", "Dash")
2. Brief description of the motion
3. Which difficulty tiers are applicable (LIGHT, HEAVY, BOSS)
4. Recommended default tier

Guidelines:
- Only suggest actions that are physically plausible given the character's anatomy
- Consider weapon_type and weapon_mass when suggesting attack animations
- If no weapon is specified, suggest unarmed or suggest a weapon type
- Include at least: Idle, Walk/Run, basic attacks, special abilities
- For BOSS tier, only suggest if the character could plausibly be a boss enemy

Return JSON:
{{
    "suggested_actions": [
        {{
            "action": "Action Name",
            "description": "Brief motion description",
            "difficulty_tiers": ["LIGHT", "HEAVY", "BOSS"],
            "recommended_tier": "LIGHT"
        }}
    ],
    "auto_suggested_weapon": "weapon type if none specified, else null"
}}
"""


async def suggest_actions(dna: CharacterDNA) -> ActionSuggestionResult:
    """
    Suggest animation actions based on Character DNA.
    
    Args:
        dna: Character DNA to analyze
    
    Returns:
        ActionSuggestionResult with list of suggested actions
    """
    prompt = ACTION_SUGGESTION_PROMPT.format(
        dna=dna.model_dump_json(indent=2),
    )
    
    result = await gemini_client.generate_text(
        prompt=prompt,
        thinking_level="low",
        temperature=0.5,
        stage="3a_action",
    )
    
    return ActionSuggestionResult(**result)
