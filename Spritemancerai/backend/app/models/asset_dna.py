"""
Asset DNA Models for SpriteMancer Universal Asset Generator.

Defines semantic DNA schemas for all asset types:
- EffectDNA: VFX effects (explosions, slashes, magic)
- TileDNA: Animated environment tiles (water, lava, grass)
- UIElementDNA: Micro-animated UI elements (coins, hearts, gems)

DNA structure is FIXED (predictable schema), values are DYNAMIC (AI-extracted).
"""
from enum import Enum
from typing import Literal, Optional
from pydantic import BaseModel, Field


# ============================================================================
# Asset Type Enum
# ============================================================================

class AssetType(str, Enum):
    """Primary asset type categories."""
    CHARACTER = "character"
    EFFECT = "effect"
    TILE = "tile"
    UI = "ui"
    BACKGROUND = "background"


# ============================================================================
# Effect DNA - For VFX sprite animations
# ============================================================================

class EffectCategory(str, Enum):
    """Categories of visual effects."""
    EXPLOSION = "explosion"
    SLASH = "slash"
    MAGIC = "magic"
    PROJECTILE = "projectile"
    PARTICLE = "particle"
    AURA = "aura"
    IMPACT = "impact"


class ShapePattern(str, Enum):
    """How the effect spreads/moves."""
    RADIAL = "radial"      # Expands outward from center
    LINEAR = "linear"      # Moves in a line/arc
    SPIRAL = "spiral"      # Rotates outward
    WAVE = "wave"          # Ripple pattern
    RANDOM = "random"      # Scattered particles


class EnergyProfile(str, Enum):
    """How intensity changes over time."""
    BURST = "burst"              # Quick explosion, fast fade
    SUSTAINED = "sustained"      # Constant intensity
    FADE_IN_OUT = "fade_in_out"  # Gradual appear and disappear
    PULSE = "pulse"              # Repeating intensity
    INSTANT = "instant"          # Single flash


class ParticleDensity(str, Enum):
    """Visual density of particles."""
    SPARSE = "sparse"
    MODERATE = "moderate"
    DENSE = "dense"


class EffectDNA(BaseModel):
    """
    Semantic DNA for visual effects (VFX).
    Used to generate effect sprite animations.
    """
    effect_category: EffectCategory = Field(
        description="Type of effect (explosion, slash, magic, etc.)"
    )
    shape_pattern: ShapePattern = Field(
        description="How the effect spreads spatially"
    )
    energy_profile: EnergyProfile = Field(
        description="How intensity changes over time"
    )
    color_palette: list[str] = Field(
        min_length=2,
        max_length=5,
        description="2-5 hex colors for the effect"
    )
    particle_density: ParticleDensity = Field(
        default=ParticleDensity.MODERATE,
        description="Visual density of particles"
    )
    suggested_frame_count: int = Field(
        default=6,
        ge=4,
        le=12,
        description="Recommended number of animation frames"
    )
    glow_intensity: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="How much the effect glows (0=none, 1=intense)"
    )


# ============================================================================
# Effect Animation Script (different from biomechanical)
# ============================================================================

class EffectPhase(str, Enum):
    """Phases of an effect animation."""
    SPAWN = "spawn"
    EXPAND = "expand"
    PEAK = "peak"
    FADE = "fade"
    DISPERSE = "disperse"


class EffectAnimationFrame(BaseModel):
    """Single frame in an effect animation."""
    frame_index: int = Field(ge=0)
    phase: EffectPhase
    size_percent: int = Field(
        ge=0, le=200,
        description="Size as percentage of final size (10-150 typical)"
    )
    opacity_percent: int = Field(
        ge=0, le=100,
        description="Opacity percentage"
    )
    particle_spread: str = Field(
        description="How particles are distributed in this frame"
    )


class EffectScript(BaseModel):
    """Animation script for effects (timing-based, not biomechanical)."""
    effect_type: str
    energy_profile: EnergyProfile
    frames: list[EffectAnimationFrame]
    total_duration_ms: int = Field(
        default=500,
        description="Total animation duration in milliseconds"
    )


# ============================================================================
# Tile DNA - For animated environment tiles
# ============================================================================

class TileCategory(str, Enum):
    """Categories of animated tiles."""
    WATER = "water"
    LAVA = "lava"
    GRASS = "grass"
    FIRE = "fire"
    CRYSTAL = "crystal"
    SMOKE = "smoke"
    WATERFALL = "waterfall"
    CUSTOM = "custom"


class TileMovementPattern(str, Enum):
    """How the tile animates."""
    WAVE = "wave"        # Ripple/wave motion
    FLICKER = "flicker"  # Random intensity changes
    SWAY = "sway"        # Side-to-side movement
    PULSE = "pulse"      # Size/brightness pulsing
    FLOW = "flow"        # Directional movement
    BUBBLE = "bubble"    # Bubbling/popping


class SeamlessAxis(str, Enum):
    """Which axes must tile seamlessly."""
    HORIZONTAL = "horizontal"
    VERTICAL = "vertical"
    BOTH = "both"


class LoopStyle(str, Enum):
    """Style of animation loop."""
    SMOOTH = "smooth"    # Linear interpolation
    CHOPPY = "choppy"    # Distinct frames
    ORGANIC = "organic"  # Natural variation


class TileDNA(BaseModel):
    """
    Semantic DNA for animated environment tiles.
    Used to generate seamless tileable sprite animations.
    """
    tile_category: TileCategory = Field(
        description="Type of tile (water, lava, grass, etc.)"
    )
    movement_pattern: TileMovementPattern = Field(
        description="How the tile animates"
    )
    seamless_axis: SeamlessAxis = Field(
        default=SeamlessAxis.BOTH,
        description="Which axes must tile seamlessly"
    )
    loop_style: LoopStyle = Field(
        default=LoopStyle.SMOOTH,
        description="Style of animation looping"
    )
    color_palette: list[str] = Field(
        min_length=2,
        max_length=4,
        description="2-4 hex colors for the tile"
    )
    suggested_frame_count: int = Field(
        default=4,
        ge=2,
        le=8,
        description="Recommended number of animation frames (tiles are shorter)"
    )
    tile_size: int = Field(
        default=32,
        description="Tile size in pixels (16, 32, 64)"
    )


# ============================================================================
# UI Element DNA - For micro-animated UI
# ============================================================================

class UIElementType(str, Enum):
    """Types of UI elements."""
    COIN = "coin"
    GEM = "gem"
    HEART = "heart"
    STAR = "star"
    BUTTON = "button"
    ARROW = "arrow"
    KEY = "key"
    CHEST = "chest"
    CUSTOM = "custom"


class UIAnimationStyle(str, Enum):
    """Animation styles for UI elements."""
    SPIN = "spin"        # Full rotation
    PULSE = "pulse"      # Size pulsing
    BOUNCE = "bounce"    # Bounce motion
    SPARKLE = "sparkle"  # Sparkle effect
    GLOW = "glow"        # Glow intensity change
    SHAKE = "shake"      # Rapid small movement


class UIElementDNA(BaseModel):
    """
    Semantic DNA for micro-animated UI elements.
    Used to generate simple looping animations.
    """
    element_type: UIElementType = Field(
        description="Type of UI element (coin, heart, star, etc.)"
    )
    animation_style: UIAnimationStyle = Field(
        description="How the element animates"
    )
    color_palette: list[str] = Field(
        min_length=1,
        max_length=3,
        description="1-3 hex colors for the element"
    )
    suggested_frame_count: int = Field(
        default=6,
        ge=4,
        le=12,
        description="Recommended number of animation frames"
    )
    element_size: int = Field(
        default=16,
        description="Element size in pixels (16, 24, 32)"
    )


# ============================================================================
# Background DNA - For parallax backgrounds
# ============================================================================

class BackgroundType(str, Enum):
    """Types of game backgrounds."""
    FOREST = "forest"
    MOUNTAIN = "mountain"
    SKY = "sky"
    UNDERWATER = "underwater"
    CAVE = "cave"
    CITY = "city"
    DESERT = "desert"
    SPACE = "space"
    DUNGEON = "dungeon"
    CUSTOM = "custom"


class ParallaxLayer(str, Enum):
    """Parallax layer for depth effect."""
    FAR = "far"            # Sky, distant mountains (moves slowest)
    MID = "mid"            # Hills, trees
    NEAR = "near"          # Ground, foliage (moves fastest)
    FULL = "full"          # Complete scene (no parallax)


class TimeOfDay(str, Enum):
    """Time of day lighting."""
    DAY = "day"
    NIGHT = "night"
    SUNSET = "sunset"
    SUNRISE = "sunrise"
    TWILIGHT = "twilight"


class Weather(str, Enum):
    """Weather conditions."""
    CLEAR = "clear"
    CLOUDY = "cloudy"
    FOGGY = "foggy"
    RAINY = "rainy"
    SNOWY = "snowy"


class BackgroundDNA(BaseModel):
    """
    Semantic DNA for game backgrounds.
    Supports single layer or complete parallax pack generation.
    """
    background_type: BackgroundType = Field(
        description="Type of environment (forest, mountain, city, etc.)"
    )
    parallax_layer: ParallaxLayer = Field(
        default=ParallaxLayer.FULL,
        description="Which parallax layer to generate (far/mid/near/full)"
    )
    time_of_day: TimeOfDay = Field(
        default=TimeOfDay.DAY,
        description="Time of day for lighting"
    )
    weather: Weather = Field(
        default=Weather.CLEAR,
        description="Weather condition"
    )
    color_palette: list[str] = Field(
        min_length=3,
        max_length=6,
        description="3-6 hex colors for the background"
    )
    animated: bool = Field(
        default=False,
        description="Whether the background has animation (clouds, water, etc.)"
    )
    suggested_width: int = Field(
        default=320,
        description="Width in pixels (320, 480, 640)"
    )
    suggested_height: int = Field(
        default=180,
        description="Height in pixels (180, 270, 360)"
    )


# ============================================================================
# Schema exports for Gemini API
# ============================================================================

EFFECT_DNA_SCHEMA = {
    "type": "object",
    "properties": {
        "effect_category": {"type": "string", "enum": [e.value for e in EffectCategory]},
        "shape_pattern": {"type": "string", "enum": [e.value for e in ShapePattern]},
        "energy_profile": {"type": "string", "enum": [e.value for e in EnergyProfile]},
        "color_palette": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 5},
        "particle_density": {"type": "string", "enum": [e.value for e in ParticleDensity]},
        "suggested_frame_count": {"type": "integer", "minimum": 4, "maximum": 12},
        "glow_intensity": {"type": "number", "minimum": 0, "maximum": 1},
    },
    "required": ["effect_category", "shape_pattern", "energy_profile", "color_palette"],
}

TILE_DNA_SCHEMA = {
    "type": "object",
    "properties": {
        "tile_category": {"type": "string", "enum": [e.value for e in TileCategory]},
        "movement_pattern": {"type": "string", "enum": [e.value for e in TileMovementPattern]},
        "seamless_axis": {"type": "string", "enum": [e.value for e in SeamlessAxis]},
        "loop_style": {"type": "string", "enum": [e.value for e in LoopStyle]},
        "color_palette": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 4},
        "suggested_frame_count": {"type": "integer", "minimum": 2, "maximum": 8},
        "tile_size": {"type": "integer"},
    },
    "required": ["tile_category", "movement_pattern", "color_palette"],
}

UI_ELEMENT_DNA_SCHEMA = {
    "type": "object",
    "properties": {
        "element_type": {"type": "string", "enum": [e.value for e in UIElementType]},
        "animation_style": {"type": "string", "enum": [e.value for e in UIAnimationStyle]},
        "color_palette": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 3},
        "suggested_frame_count": {"type": "integer", "minimum": 4, "maximum": 12},
        "element_size": {"type": "integer"},
    },
    "required": ["element_type", "animation_style", "color_palette"],
}

BACKGROUND_DNA_SCHEMA = {
    "type": "object",
    "properties": {
        "background_type": {"type": "string", "enum": [e.value for e in BackgroundType]},
        "parallax_layer": {"type": "string", "enum": [e.value for e in ParallaxLayer]},
        "time_of_day": {"type": "string", "enum": [e.value for e in TimeOfDay]},
        "weather": {"type": "string", "enum": [e.value for e in Weather]},
        "color_palette": {"type": "array", "items": {"type": "string"}, "minItems": 3, "maxItems": 6},
        "animated": {"type": "boolean"},
        "suggested_width": {"type": "integer"},
        "suggested_height": {"type": "integer"},
    },
    "required": ["background_type", "color_palette"],
}
