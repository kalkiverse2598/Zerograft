"""Pydantic models for SpriteMancer AI."""
from .character_dna import CharacterDNA, DNAVerificationResult
from .animation_script import AnimationScript, AnimationFrame, FrameBudget
from .pipeline_state import PipelineState, PipelineStage
from .project import Project, ProjectListItem
from .dual_character_dna import (
    DualCharacterDNA,
    InteractionConstraints,
    ResponderSuggestion,
    ResponderActionResult,
)
from .effect_types import (
    EffectType,
    EffectPosition,
    EffectEvent,
    EffectSuggestion,
    suggest_effects_for_script,
)
from .asset_dna import (
    AssetType,
    EffectDNA, EffectCategory, ShapePattern, EnergyProfile, ParticleDensity,
    EffectPhase, EffectAnimationFrame, EffectScript,
    TileDNA, TileCategory, TileMovementPattern, SeamlessAxis, LoopStyle,
    UIElementDNA, UIElementType, UIAnimationStyle,
    BackgroundDNA, BackgroundType, ParallaxLayer, TimeOfDay, Weather,
    EFFECT_DNA_SCHEMA, TILE_DNA_SCHEMA, UI_ELEMENT_DNA_SCHEMA, BACKGROUND_DNA_SCHEMA,
)

__all__ = [
    "CharacterDNA",
    "DNAVerificationResult",
    "AnimationScript",
    "AnimationFrame",
    "FrameBudget",
    "PipelineState",
    "PipelineStage",
    "Project",
    "ProjectListItem",
    "DualCharacterDNA",
    "InteractionConstraints",
    "ResponderSuggestion",
    "ResponderActionResult",
    "EffectType",
    "EffectPosition",
    "EffectEvent",
    "EffectSuggestion",
    "suggest_effects_for_script",
    # New Asset DNA
    "AssetType",
    "EffectDNA", "EffectCategory", "ShapePattern", "EnergyProfile", "ParticleDensity",
    "EffectPhase", "EffectAnimationFrame", "EffectScript",
    "TileDNA", "TileCategory", "TileMovementPattern", "SeamlessAxis", "LoopStyle",
    "UIElementDNA", "UIElementType", "UIAnimationStyle",
    "BackgroundDNA", "BackgroundType", "ParallaxLayer", "TimeOfDay", "Weather",
    "EFFECT_DNA_SCHEMA", "TILE_DNA_SCHEMA", "UI_ELEMENT_DNA_SCHEMA", "BACKGROUND_DNA_SCHEMA",
]

