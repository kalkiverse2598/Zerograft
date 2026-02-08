"""Dual-character DNA models for relational animations."""
from pydantic import BaseModel, Field
from typing import Literal, Optional

from .character_dna import CharacterDNA


class InteractionConstraints(BaseModel):
    """
    Physics-based interaction constraints between two characters.
    Used to determine plausible reactions and timing.
    """
    
    reach_advantage: Literal["A", "B", "equal"] = Field(
        description="Which character has longer attack reach"
    )
    speed_advantage: Literal["A", "B", "equal"] = Field(
        description="Which character is faster/more mobile"
    )
    mass_ratio: float = Field(
        ge=0.1, le=10.0,
        description="Instigator mass / Responder mass ratio"
    )
    likely_responses: list[str] = Field(
        default_factory=lambda: ["dodge", "block", "partial_hit", "full_hit"],
        description="Plausible reaction types based on physics"
    )


class DualCharacterDNA(BaseModel):
    """
    Combined DNA for Instigator + Responder character pair.
    Used for dual-character relational animations.
    """
    
    instigator: CharacterDNA = Field(
        description="DNA of the attacking/initiating character"
    )
    responder: CharacterDNA = Field(
        description="DNA of the reacting character"
    )
    interaction: InteractionConstraints = Field(
        description="Physics constraints governing their interaction"
    )


class ResponderSuggestion(BaseModel):
    """A suggested action for the responder character."""
    
    action: str = Field(
        description="The suggested reaction action"
    )
    reason: str = Field(
        description="Why this reaction is plausible given the physics"
    )
    recommended: bool = Field(
        default=False,
        description="Whether this is the AI-recommended option"
    )


class ResponderActionResult(BaseModel):
    """Result of responder action auto-suggestion."""
    
    instigator_action: str = Field(
        description="The instigator's action being responded to"
    )
    suggested_actions: list[ResponderSuggestion] = Field(
        description="List of plausible responder reactions"
    )
    requires_user_confirmation: bool = Field(
        default=True,
        description="Whether user must confirm before proceeding"
    )
