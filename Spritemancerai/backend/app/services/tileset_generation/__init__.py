"""
Tileset Generation Package

Specialized generators for different tile types:
- terrain_generator: Complete terrain tilesets (9-47 tiles)
- platform_generator: Platformer platform tiles
- wall_generator: Wall tilesets for dungeons/caves
- animated_generator: Animated environment tiles
- decoration_generator: Single prop/decoration sprites
- transition_generator: Terrain transition tiles
"""

from .terrain_generator import (
    generate_terrain_tileset,
    generate_terrain_tileset_9,
    TerrainTilesetResult,
    encode_tileset_png,
)
from .platform_generator import (
    generate_platform_tiles,
    PlatformTileResult,
    encode_platform_strip_png,
)
from .wall_generator import (
    generate_wall_tileset,
    WallTilesetResult,
    encode_wall_tileset_png,
)
from .animated_generator import (
    generate_animated_tile,
    AnimatedTileResult,
    encode_animation_strip_png,
)
from .decoration_generator import (
    generate_decoration,
    DecorationResult,
    encode_decoration_png,
)
from .transition_generator import (
    generate_transition_tiles,
    TransitionTileResult,
    encode_transition_tileset_png,
)

__all__ = [
    # Terrain
    "generate_terrain_tileset",
    "generate_terrain_tileset_9",
    "TerrainTilesetResult",
    "encode_tileset_png",
    # Platform
    "generate_platform_tiles",
    "PlatformTileResult",
    "encode_platform_strip_png",
    # Wall
    "generate_wall_tileset",
    "WallTilesetResult",
    "encode_wall_tileset_png",
    # Animated
    "generate_animated_tile",
    "AnimatedTileResult",
    "encode_animation_strip_png",
    # Decoration
    "generate_decoration",
    "DecorationResult",
    "encode_decoration_png",
    # Transition
    "generate_transition_tiles",
    "TransitionTileResult",
    "encode_transition_tileset_png",
]
