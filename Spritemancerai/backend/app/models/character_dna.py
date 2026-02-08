from pydantic import BaseModel, Field
from typing import Literal, Optional


class CharacterDNA(BaseModel):
    """
    Semantic Character DNA extracted from reference image.
    This is the source of truth for all animation generation.
    """
    
    archetype: str = Field(
        description="Character archetype (e.g., 'warrior', 'mage', 'rogue')"
    )
    body_type: str = Field(
        description="Body type (e.g., 'humanoid', 'quadruped', 'winged')"
    )
    dominant_colors: list[str] = Field(
        default_factory=list,
        description="List of dominant colors in hex format"
    )
    equipment: list[str] = Field(
        default_factory=list,
        description="Visible equipment and accessories"
    )
    weapon_type: Optional[str] = Field(
        default=None,
        description="Primary weapon type if visible"
    )
    weapon_mass: Literal["none", "light", "medium", "heavy", "oversized"] = Field(
        default="none",
        description="Weapon mass category affecting animation timing"
    )
    special_features: list[str] = Field(
        default_factory=list,
        description="Distinctive visual features (e.g., 'glowing eyes', 'tail')"
    )
    anatomical_constraints: list[str] = Field(
        default_factory=list,
        description="Physical constraints affecting motion (e.g., 'armored joints', 'cape')"
    )


class DNAVerificationResult(BaseModel):
    """Result of DNA verification against reference image."""
    
    claim_verified: bool = Field(
        description="Whether the user's claim is visually verified"
    )
    visual_evidence: str = Field(
        description="Description of visual evidence supporting the decision"
    )
    confidence_score: float = Field(
        ge=0.0, le=1.0,
        description="Confidence in the verification (0-1)"
    )
    action: Literal["UPDATE_DNA", "FLAG_AS_NEW_FEATURE"] = Field(
        description="Recommended action based on verification"
    )
