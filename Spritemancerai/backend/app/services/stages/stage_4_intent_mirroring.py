"""
Stage 4: Intent Mirroring

Summarizes user intent for confirmation before generation.
"""
from typing import Literal
from pydantic import BaseModel
from app.services.gemini_client import gemini_client
from app.models import CharacterDNA, FrameBudget


class IntentMirror(BaseModel):
    """Intent mirroring result for user confirmation."""
    intent_summary: str
    status: Literal["ALIGNED", "EDIT_REQUIRED"]
    key_points: list[str]


INTENT_MIRRORING_PROMPT = """
Summarize the animation intent for user confirmation.

Character DNA:
{dna}

Action: {action}
Difficulty Tier: {difficulty}
Frame Budget: {frame_count} frames ({grid}x{grid} grid)
Justification: {justification}

Create a concise, human-readable summary of what will be generated.
Highlight key points the user should verify before proceeding.

Return JSON:
{{
    "intent_summary": "One clear sentence describing the animation to be generated",
    "status": "ALIGNED",
    "key_points": [
        "Key point 1 for user to verify",
        "Key point 2 for user to verify"
    ]
}}

Example intent_summary:
"A 6-frame side-view LIGHT sword slash animation for a humanoid warrior with medium armor."

Keep it concise but complete.
"""


async def mirror_intent(
    dna: CharacterDNA,
    action: str,
    difficulty_tier: Literal["LIGHT", "HEAVY", "BOSS"],
    frame_budget: FrameBudget,
) -> IntentMirror:
    """
    Generate intent summary for user confirmation.
    
    Args:
        dna: Character DNA
        action: Selected action
        difficulty_tier: Selected difficulty
        frame_budget: Computed frame budget
    
    Returns:
        IntentMirror with summary and key points
    """
    prompt = INTENT_MIRRORING_PROMPT.format(
        dna=dna.model_dump_json(indent=2),
        action=action,
        difficulty=difficulty_tier,
        frame_count=frame_budget.final_frame_count,
        grid=frame_budget.grid_dim,
        justification=frame_budget.justification,
    )
    
    result = await gemini_client.generate_text(
        prompt=prompt,
        thinking_level="low",
        temperature=0.3,
        stage="4_intent",
    )
    
    return IntentMirror(**result)
