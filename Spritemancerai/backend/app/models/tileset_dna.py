"""
Tileset DNA Models for SpriteMancer Game-Ready Tile Generation.

Specialized DNA schemas for different tile types:
- TerrainTilesetDNA: Complete terrain sets with edges/corners (9-47 tiles)
- PlatformTileDNA: Platformer platform tiles with end caps
- WallTilesetDNA: Wall tiles with top edges and corners
- AnimatedTileDNA: Enhanced animated tiles (water, lava, fire)
- DecorationTileDNA: Single prop/decoration sprites
- TransitionTileDNA: Blend tiles between terrain types

Each schema is optimized for its specific use case to generate game-ready assets.
"""
from enum import Enum
from typing import Optional, Literal
from pydantic import BaseModel, Field


# ============================================================================
# Shared Enums
# ============================================================================

class TileSize(int, Enum):
    """Standard tile sizes in pixels."""
    TINY = 8
    SMALL = 16
    MEDIUM = 32
    LARGE = 64
    XLARGE = 128


class TextureStyle(str, Enum):
    """How the tile texture appears."""
    FLAT = "flat"           # Solid colors, minimal detail
    SMOOTH = "smooth"       # Subtle gradients
    NOISY = "noisy"         # Grain/noise texture
    DETAILED = "detailed"   # High detail, non-repeating elements
    HANDPAINTED = "handpainted"  # Artistic brush-like strokes


class OutlineStyle(str, Enum):
    """Outline style for tiles."""
    NONE = "none"           # No outline
    DARK = "dark"           # Dark outline (1-2px)
    LIGHT = "light"         # Light outline for dark tiles
    COLORED = "colored"     # Outline matches tile colors
    THICK = "thick"         # Thick 2-3px outline


class Perspective(str, Enum):
    """Visual perspective of tiles."""
    TOP_DOWN = "top_down"       # Looking straight down
    SIDE_VIEW = "side_view"     # Side scrolling view
    ISOMETRIC = "isometric"     # 2:1 isometric
    THREE_QUARTER = "three_quarter"  # Slight top-down angle


# ============================================================================
# Terrain Tileset DNA (9-47 tile complete sets)
# ============================================================================

class TerrainType(str, Enum):
    """Types of terrain for tileset generation."""
    GRASS = "grass"
    DIRT = "dirt"
    STONE = "stone"
    BRICK = "brick"
    SAND = "sand"
    SNOW = "snow"
    WOOD = "wood"
    METAL = "metal"
    WATER_EDGE = "water_edge"   # For water borders
    LAVA_EDGE = "lava_edge"     # For lava borders
    CAVE = "cave"
    DUNGEON = "dungeon"
    CASTLE = "castle"
    CUSTOM = "custom"


class TilesetFormat(str, Enum):
    """Tileset output format/complexity."""
    MINIMAL_9 = "minimal_9"     # 3x3 grid (9 tiles) - simplest
    WANG_16 = "wang_16"         # 4x4 grid (16 tiles) - standard Wang
    BLOB_47 = "blob_47"         # 47 tiles - full blob terrain
    RPG_MAKER = "rpg_maker"     # RPG Maker A2 format


class TerrainTilesetDNA(BaseModel):
    """
    DNA for complete terrain tileset generation.
    
    Generates a full set of tiles with edges, corners, and fill tiles
    ready for autotiling in Godot/Unity.
    """
    terrain_type: TerrainType = Field(
        description="Type of terrain (grass, dirt, stone, brick, etc.)"
    )
    tileset_format: TilesetFormat = Field(
        default=TilesetFormat.MINIMAL_9,
        description="Output format - minimal_9 is 3x3 grid, wang_16 is 4x4, blob_47 is complete"
    )
    tile_size: int = Field(
        default=32,
        description="Size of each tile in pixels (16, 32, 64)"
    )
    color_palette: list[str] = Field(
        min_length=2,
        max_length=6,
        description="3-6 hex colors for the terrain"
    )
    texture_style: TextureStyle = Field(
        default=TextureStyle.NOISY,
        description="Surface texture style"
    )
    outline_style: OutlineStyle = Field(
        default=OutlineStyle.DARK,
        description="Outline style for tile edges"
    )
    perspective: Perspective = Field(
        default=Perspective.TOP_DOWN,
        description="Visual perspective"
    )
    include_variations: bool = Field(
        default=True,
        description="Include multiple variations for center tiles"
    )
    seamless: bool = Field(
        default=True,
        description="Ensure all tiles connect seamlessly"
    )


# ============================================================================
# Platform Tile DNA (Platformer-specific)
# ============================================================================

class PlatformType(str, Enum):
    """Types of platforms for platformer games."""
    GROUND = "ground"           # Solid ground platform
    FLOATING = "floating"       # Floating platform
    ONE_WAY = "one_way"         # Can jump through from below
    MOVING = "moving"           # For moving platforms
    CRUMBLING = "crumbling"     # Breaks after standing on it
    ICE = "ice"                 # Slippery surface
    BOUNCY = "bouncy"           # Trampoline-like


class PlatformMaterial(str, Enum):
    """Material appearance for platforms."""
    GRASS = "grass"
    STONE = "stone"
    WOOD = "wood"
    METAL = "metal"
    ICE = "ice"
    BRICK = "brick"
    CLOUD = "cloud"
    CRYSTAL = "crystal"
    SAND = "sand"


class PlatformStyle(str, Enum):
    """Visual style of platform shape."""
    SOLID = "solid"             # Rectangular, solid look
    THIN = "thin"               # Thin platform line
    ROUNDED = "rounded"         # Rounded edges
    ANGULAR = "angular"         # Sharp geometric
    ORGANIC = "organic"         # Natural, uneven edges


class PlatformTileDNA(BaseModel):
    """
    DNA for platformer platform tiles.
    
    Generates a set of tiles designed for side-view platformer games:
    - Left end cap
    - Center sections (with variations)
    - Right end cap
    - Single block
    - Optional slopes
    """
    platform_type: PlatformType = Field(
        description="Type of platform behavior"
    )
    material: PlatformMaterial = Field(
        description="Visual material (grass, stone, wood, etc.)"
    )
    platform_style: PlatformStyle = Field(
        default=PlatformStyle.SOLID,
        description="Visual style of platform shape"
    )
    tile_size: int = Field(
        default=32,
        description="Size of each tile in pixels"
    )
    color_palette: list[str] = Field(
        min_length=2,
        max_length=5,
        description="2-5 hex colors for the platform"
    )
    has_grass_top: bool = Field(
        default=False,
        description="Add grass/vegetation on top surface"
    )
    include_slopes: bool = Field(
        default=False,
        description="Include slope tiles (45° left and right)"
    )
    include_single_block: bool = Field(
        default=True,
        description="Include a standalone single-tile block"
    )
    outline_style: OutlineStyle = Field(
        default=OutlineStyle.DARK,
        description="Outline style"
    )


# ============================================================================
# Wall Tileset DNA
# ============================================================================

class WallType(str, Enum):
    """Types of wall tilesets."""
    CASTLE = "castle"
    DUNGEON = "dungeon"
    CAVE = "cave"
    BRICK = "brick"
    WOODEN = "wooden"
    STONE = "stone"
    METAL = "metal"
    ICE = "ice"


class WallStyle(str, Enum):
    """Condition/style of wall."""
    PRISTINE = "pristine"       # Clean, new
    WEATHERED = "weathered"     # Slightly worn
    DAMAGED = "damaged"         # Cracks, missing bricks
    MOSSY = "mossy"             # Overgrown
    ANCIENT = "ancient"         # Very old, worn


class WallTilesetDNA(BaseModel):
    """
    DNA for wall tileset generation.
    
    Generates wall tiles suitable for dungeon/cave/building interiors:
    - Wall fill tiles
    - Top edge (where wall meets ceiling/void)
    - Bottom edge (where wall meets floor)
    - Left/right edges
    - Corners
    """
    wall_type: WallType = Field(
        description="Type of wall (castle, dungeon, cave, etc.)"
    )
    wall_style: WallStyle = Field(
        default=WallStyle.WEATHERED,
        description="Visual condition of the wall"
    )
    tile_size: int = Field(
        default=32,
        description="Size of each tile in pixels"
    )
    color_palette: list[str] = Field(
        min_length=2,
        max_length=5,
        description="2-5 hex colors"
    )
    texture_style: TextureStyle = Field(
        default=TextureStyle.DETAILED,
        description="Surface texture detail level"
    )
    include_top_edge: bool = Field(
        default=True,
        description="Include top edge tiles"
    )
    include_torch_variants: bool = Field(
        default=False,
        description="Include wall tiles with torch sconces"
    )
    perspective: Perspective = Field(
        default=Perspective.SIDE_VIEW,
        description="Visual perspective"
    )


# ============================================================================
# Animated Tile DNA (Enhanced from existing)
# ============================================================================

class AnimatedTileType(str, Enum):
    """Types of animated environmental tiles."""
    WATER = "water"
    LAVA = "lava"
    FIRE = "fire"
    CRYSTAL = "crystal"
    WATERFALL = "waterfall"
    SMOKE = "smoke"
    POISON = "poison"
    ELECTRICITY = "electricity"
    PORTAL = "portal"
    GRASS_WIND = "grass_wind"
    TORCH = "torch"


class AnimationStyle(str, Enum):
    """How the tile animates."""
    WAVE = "wave"           # Ripple/wave motion
    FLICKER = "flicker"     # Random intensity changes
    PULSE = "pulse"         # Size/brightness pulsing
    FLOW = "flow"           # Directional movement
    BUBBLE = "bubble"       # Bubbling effect
    SWAY = "sway"           # Side-to-side swaying
    SPARKLE = "sparkle"     # Twinkling points


class SeamlessMode(str, Enum):
    """How the tile should seamlessly tile."""
    HORIZONTAL = "horizontal"   # Left-right seamless
    VERTICAL = "vertical"       # Top-bottom seamless
    BOTH = "both"               # All directions
    LOOP_ONLY = "loop_only"     # Only animation loops, not spatial


class AnimatedTileDNA(BaseModel):
    """
    Enhanced DNA for animated environment tiles.
    
    Generates seamless animated tile strips for environmental effects
    like water, lava, fire, etc.
    """
    tile_type: AnimatedTileType = Field(
        description="Type of animated tile"
    )
    animation_style: AnimationStyle = Field(
        description="How the tile animates"
    )
    frame_count: int = Field(
        default=4,
        ge=2,
        le=12,
        description="Number of animation frames (2-12)"
    )
    tile_size: int = Field(
        default=32,
        description="Size of each tile in pixels"
    )
    color_palette: list[str] = Field(
        min_length=2,
        max_length=5,
        description="2-5 hex colors"
    )
    seamless_mode: SeamlessMode = Field(
        default=SeamlessMode.BOTH,
        description="How the tile should tile seamlessly"
    )
    glow_intensity: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Glow/emission intensity (0-1)"
    )
    animation_speed: Literal["slow", "medium", "fast"] = Field(
        default="medium",
        description="Suggested animation speed"
    )


# ============================================================================
# Decoration/Prop DNA
# ============================================================================

class DecorationType(str, Enum):
    """Types of decoration/prop sprites."""
    CRATE = "crate"
    BARREL = "barrel"
    SIGN = "sign"
    BUSH = "bush"
    TREE = "tree"
    ROCK = "rock"
    CHEST = "chest"
    POT = "pot"
    LAMP = "lamp"
    FENCE = "fence"
    GRAVE = "grave"
    STATUE = "statue"
    MUSHROOM = "mushroom"
    FLOWER = "flower"
    CUSTOM = "custom"


class DecorationTileDNA(BaseModel):
    """
    DNA for decoration and prop sprites.
    
    Generates single static sprites for environmental decoration.
    """
    decoration_type: DecorationType = Field(
        description="Type of decoration/prop"
    )
    size: str = Field(
        default="32x32",
        description="Sprite size (e.g., '32x32', '64x32')"
    )
    color_palette: list[str] = Field(
        min_length=2,
        max_length=4,
        description="2-4 hex colors"
    )
    style: str = Field(
        default="pixel_art",
        description="Art style"
    )
    has_shadow: bool = Field(
        default=False,
        description="Include drop shadow"
    )
    perspective: Perspective = Field(
        default=Perspective.SIDE_VIEW,
        description="Visual perspective"
    )
    variation_count: int = Field(
        default=1,
        ge=1,
        le=4,
        description="Number of variations to generate (1-4)"
    )


# ============================================================================
# Transition Tile DNA
# ============================================================================

class TransitionStyle(str, Enum):
    """How terrain transitions blend."""
    HARD_EDGE = "hard_edge"     # Sharp boundary
    SOFT_BLEND = "soft_blend"   # Gradient blend
    SCATTERED = "scattered"     # Random scattered pixels
    DITHERED = "dithered"       # Dithering pattern
    ORGANIC = "organic"         # Natural, irregular


class TransitionTileDNA(BaseModel):
    """
    DNA for terrain transition tiles.
    
    Generates tiles that blend between two terrain types.
    """
    from_terrain: str = Field(
        description="Source terrain type (e.g., 'grass')"
    )
    to_terrain: str = Field(
        description="Target terrain type (e.g., 'dirt')"
    )
    from_palette: list[str] = Field(
        min_length=2,
        max_length=4,
        description="Colors for source terrain"
    )
    to_palette: list[str] = Field(
        min_length=2,
        max_length=4,
        description="Colors for target terrain"
    )
    transition_style: TransitionStyle = Field(
        default=TransitionStyle.SOFT_BLEND,
        description="How the transition blends"
    )
    tile_size: int = Field(
        default=32,
        description="Size of each tile in pixels"
    )
    include_corners: bool = Field(
        default=True,
        description="Include corner transition tiles"
    )


# ============================================================================
# JSON Schemas for Gemini API
# ============================================================================

TERRAIN_TILESET_DNA_SCHEMA = {
    "type": "object",
    "properties": {
        "terrain_type": {"type": "string", "enum": [e.value for e in TerrainType]},
        "tileset_format": {"type": "string", "enum": [e.value for e in TilesetFormat]},
        "tile_size": {"type": "integer", "enum": [16, 32, 64]},
        "color_palette": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 6},
        "texture_style": {"type": "string", "enum": [e.value for e in TextureStyle]},
        "outline_style": {"type": "string", "enum": [e.value for e in OutlineStyle]},
        "perspective": {"type": "string", "enum": [e.value for e in Perspective]},
    },
    "required": ["terrain_type", "color_palette"],
}

PLATFORM_TILE_DNA_SCHEMA = {
    "type": "object",
    "properties": {
        "platform_type": {"type": "string", "enum": [e.value for e in PlatformType]},
        "material": {"type": "string", "enum": [e.value for e in PlatformMaterial]},
        "platform_style": {"type": "string", "enum": [e.value for e in PlatformStyle]},
        "tile_size": {"type": "integer", "enum": [16, 32, 64]},
        "color_palette": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 5},
        "has_grass_top": {"type": "boolean"},
        "include_slopes": {"type": "boolean"},
    },
    "required": ["platform_type", "material", "color_palette"],
}

ANIMATED_TILE_DNA_SCHEMA = {
    "type": "object",
    "properties": {
        "tile_type": {"type": "string", "enum": [e.value for e in AnimatedTileType]},
        "animation_style": {"type": "string", "enum": [e.value for e in AnimationStyle]},
        "frame_count": {"type": "integer", "minimum": 2, "maximum": 12},
        "tile_size": {"type": "integer", "enum": [16, 32, 64]},
        "color_palette": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 5},
        "glow_intensity": {"type": "number", "minimum": 0, "maximum": 1},
    },
    "required": ["tile_type", "animation_style", "color_palette"],
}

DECORATION_DNA_SCHEMA = {
    "type": "object",
    "properties": {
        "decoration_type": {"type": "string", "enum": [e.value for e in DecorationType]},
        "size": {"type": "string"},
        "color_palette": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 4},
        "has_shadow": {"type": "boolean"},
        "variation_count": {"type": "integer", "minimum": 1, "maximum": 4},
    },
    "required": ["decoration_type", "color_palette"],
}
