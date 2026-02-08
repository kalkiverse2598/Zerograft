"""
Stage 2b: Responder Action Auto-Suggestion

Analyzes instigator action and responder DNA to suggest plausible reactions.
Uses physics/biomechanics reasoning to determine realistic responses.
"""
from app.services.gemini_client import gemini_client
from app.models import CharacterDNA, ResponderActionResult, ResponderSuggestion, InteractionConstraints
from app.prompts import load_prompt


RESPONDER_ACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "instigator_action": {"type": "string"},
        "suggested_actions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "action": {"type": "string"},
                    "reason": {"type": "string"},
                    "recommended": {"type": "boolean"},
                },
                "required": ["action", "reason"],
            },
        },
        "requires_user_confirmation": {"type": "boolean"},
    },
    "required": ["instigator_action", "suggested_actions", "requires_user_confirmation"],
}


async def suggest_responder_actions(
    instigator_action: str,
    difficulty_tier: str,
    instigator_dna: CharacterDNA,
    responder_dna: CharacterDNA,
    interaction_constraints: InteractionConstraints,
) -> ResponderActionResult:
    """
    Suggest plausible responder actions based on physics and biomechanics.
    
    Args:
        instigator_action: The action being performed by the attacker
        difficulty_tier: LIGHT, HEAVY, or BOSS
        instigator_dna: DNA of the attacking character
        responder_dna: DNA of the reacting character
        interaction_constraints: Physics constraints between characters
    
    Returns:
        ResponderActionResult with suggested actions and confirmation flag
    """
    # Format the prompt with context
    prompt = load_prompt("stage_2b_responder_action", {
        "instigator_action": instigator_action,
        "difficulty_tier": difficulty_tier,
        "instigator_dna": instigator_dna.model_dump(),
        "responder_dna": responder_dna.model_dump(),
        "interaction_constraints": interaction_constraints.model_dump(),
    })
    
    result = await gemini_client.generate_text(
        prompt=prompt,
        thinking_level="high",
        temperature=0.4,
        response_schema=RESPONDER_ACTION_SCHEMA,
        stage="3a_action",  # Reuse action suggestion system instruction
    )
    
    # Convert to model
    suggestions = [
        ResponderSuggestion(
            action=s["action"],
            reason=s["reason"],
            recommended=s.get("recommended", False),
        )
        for s in result["suggested_actions"]
    ]
    
    # Ensure at least one is marked recommended
    if suggestions and not any(s.recommended for s in suggestions):
        suggestions[0].recommended = True
    
    return ResponderActionResult(
        instigator_action=result["instigator_action"],
        suggested_actions=suggestions,
        requires_user_confirmation=result.get("requires_user_confirmation", True),
    )


def get_default_responder_actions(
    instigator_action: str,
    responder_mobility: str,
) -> list[ResponderSuggestion]:
    """
    Get default responder actions without AI call.
    Useful for quick suggestions based on basic rules.
    """
    suggestions = []
    
    # High mobility allows dodge
    if responder_mobility in ["high", "medium"]:
        suggestions.append(ResponderSuggestion(
            action="Backstep Dodge",
            reason="Character has sufficient mobility to evade",
            recommended=True,
        ))
    
    # Always allow hit reactions
    suggestions.append(ResponderSuggestion(
        action="Staggered Hit",
        reason="Standard reaction to successful attack",
        recommended=len(suggestions) == 0,
    ))
    
    suggestions.append(ResponderSuggestion(
        action="Full Impact",
        reason="Direct hit with maximum effect",
        recommended=False,
    ))
    
    return suggestions
