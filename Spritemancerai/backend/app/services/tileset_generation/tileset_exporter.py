"""
Godot 4.x TileSet Resource Exporter

Exports generated tilesets as Godot 4.x .tres TileSet resources with:
- TileSetAtlasSource configuration
- Terrain autotile setup (3x3 minimal or bitmask templates)
- Physics collision layers
- Navigation polygons (optional)
"""

import numpy as np
import base64
import io
import cv2
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from enum import Enum


class TileSetType(Enum):
    """Types of tilesets with different terrain configurations."""
    TERRAIN_3X3 = "terrain_3x3"  # 9 tiles in 3x3 grid
    PLATFORM_STRIP = "platform_strip"  # 6 tiles horizontal
    WALL_3X3 = "wall_3x3"  # 9 tiles for walls
    DECORATION = "decoration"  # No terrain, just sprites
    ANIMATED = "animated"  # Horizontal animation strip
    TRANSITION = "transition"  # 8 tiles in 2x4 grid


@dataclass
class TerrainConfig:
    """Configuration for terrain autotiling."""
    terrain_set_id: int = 0
    terrain_id: int = 0
    terrain_name: str = "terrain_0"
    terrain_color: str = "ffffff"  # Hex color for editor display


@dataclass
class PhysicsConfig:
    """Physics layer configuration."""
    layer: int = 1
    mask: int = 1
    collision_polygon: bool = True  # Auto-generate collision from tile bounds


@dataclass
class TileSetExportResult:
    """Result of tileset export."""
    tres_content: str
    image_path_reference: str
    tile_count: int
    terrain_configured: bool


# Terrain peering bit positions for Godot 4.x
# These match Godot's TileSet terrain peering bit enum
PEERING_BITS = {
    "top_left_corner": 0,
    "top_side": 1,
    "top_right_corner": 2,
    "left_side": 3,
    "center": 4,  # Not used in Godot but helpful for logic
    "right_side": 5,
    "bottom_left_corner": 6,
    "bottom_side": 7,
    "bottom_right_corner": 8,
}


def generate_tres_header() -> str:
    """Generate the .tres file header for TileSet resource."""
    return '[gd_resource type="TileSet" load_steps=2 format=3]\n\n'


def generate_texture_resource(texture_path: str, resource_id: str = "1") -> str:
    """Generate external resource reference for the tileset texture."""
    return f'[ext_resource type="Texture2D" path="{texture_path}" id="{resource_id}"]\n\n'


def generate_tileset_atlas_source(
    tile_size: int,
    grid_width: int,
    grid_height: int,
    terrain_config: Optional[TerrainConfig] = None,
    tileset_type: TileSetType = TileSetType.TERRAIN_3X3,
    include_physics: bool = False,
) -> str:
    """Generate TileSetAtlasSource sub-resource with terrain configuration."""
    
    lines = [
        '[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_1"]',
        'texture = ExtResource("1")',
        f'texture_region_size = Vector2i({tile_size}, {tile_size})',
    ]
    
    # Generate tile entries based on tileset type
    if tileset_type == TileSetType.TERRAIN_3X3:
        lines.extend(_generate_terrain_3x3_tiles(terrain_config, include_physics, tile_size))
    elif tileset_type == TileSetType.PLATFORM_STRIP:
        lines.extend(_generate_platform_tiles(grid_width, terrain_config, include_physics, tile_size))
    elif tileset_type == TileSetType.WALL_3X3:
        lines.extend(_generate_wall_3x3_tiles(terrain_config, include_physics, tile_size))
    elif tileset_type == TileSetType.DECORATION:
        lines.extend(_generate_decoration_tiles(grid_width, grid_height, include_physics, tile_size))
    elif tileset_type == TileSetType.ANIMATED:
        lines.extend(_generate_animated_tiles(grid_width))
    elif tileset_type == TileSetType.TRANSITION:
        lines.extend(_generate_transition_tiles(terrain_config, include_physics, tile_size))
    else:
        # Default: just register tiles without terrain
        for y in range(grid_height):
            for x in range(grid_width):
                lines.append(f'{x}:{y}/0 = 0')
                if include_physics:
                    lines.extend(_generate_physics_polygon(x, y, tile_size))
    
    return '\n'.join(lines)


def _generate_physics_polygon(x: int, y: int, tile_size: int) -> List[str]:
    """Generate physics collision polygon for a tile (full tile rectangle)."""
    # Godot uses PackedVector2Array for collision polygon points
    # Points are relative to tile origin (0,0 to tile_size,tile_size)
    return [
        f'{x}:{y}/0/physics_layer_0/polygon_0/points = PackedVector2Array(0, 0, {tile_size}, 0, {tile_size}, {tile_size}, 0, {tile_size})'
    ]


def _generate_terrain_3x3_tiles(terrain_config: Optional[TerrainConfig], include_physics: bool = False, tile_size: int = 32) -> List[str]:
    """
    Generate 3x3 terrain tileset configuration.
    
    Layout:
    [0,0] TL Corner  [1,0] T Edge   [2,0] TR Corner
    [0,1] L Edge     [1,1] Center   [2,1] R Edge
    [0,2] BL Corner  [1,2] B Edge   [2,2] BR Corner
    """
    lines = []
    
    # Peering bit configurations for each tile position
    # 1 = terrain, 0 = no terrain
    # Format: [top_left, top, top_right, left, right, bottom_left, bottom, bottom_right]
    tile_peering = {
        (0, 0): [0, 0, 0, 0, 1, 0, 1, 1],  # TL Corner
        (1, 0): [0, 0, 0, 1, 1, 1, 1, 1],  # T Edge
        (2, 0): [0, 0, 0, 1, 0, 1, 1, 0],  # TR Corner
        (0, 1): [0, 1, 1, 0, 1, 0, 1, 1],  # L Edge
        (1, 1): [1, 1, 1, 1, 1, 1, 1, 1],  # Center (all terrain)
        (2, 1): [1, 1, 0, 1, 0, 1, 1, 0],  # R Edge
        (0, 2): [0, 1, 1, 0, 1, 0, 0, 0],  # BL Corner
        (1, 2): [1, 1, 1, 1, 1, 0, 0, 0],  # B Edge
        (2, 2): [1, 1, 0, 1, 0, 0, 0, 0],  # BR Corner
    }
    
    terrain_set = terrain_config.terrain_set_id if terrain_config else 0
    terrain_id = terrain_config.terrain_id if terrain_config else 0
    
    for (x, y), peering in tile_peering.items():
        lines.append(f'{x}:{y}/0 = 0')
        
        if terrain_config:
            lines.append(f'{x}:{y}/0/terrain_set = {terrain_set}')
            
            # Add peering bits
            peering_names = [
                "top_left_corner", "top_side", "top_right_corner",
                "left_side", "right_side",
                "bottom_left_corner", "bottom_side", "bottom_right_corner"
            ]
            
            for i, (name, value) in enumerate(zip(peering_names, peering)):
                if value == 1:
                    lines.append(f'{x}:{y}/0/terrains_peering_bit/{name} = {terrain_id}')
        
        # Add physics collision polygon if requested
        if include_physics:
            lines.extend(_generate_physics_polygon(x, y, tile_size))
    
    return lines


def _generate_platform_tiles(width: int, terrain_config: Optional[TerrainConfig], include_physics: bool = False, tile_size: int = 32) -> List[str]:
    """
    Generate platform tileset configuration (horizontal strip).
    
    Layout: [Left Cap] [Center1] [Center2] [Center3] [Right Cap] [Single]
    """
    lines = []
    
    terrain_set = terrain_config.terrain_set_id if terrain_config else 0
    terrain_id = terrain_config.terrain_id if terrain_config else 0
    
    # Platform tiles: left_side and right_side indicate extendability
    tile_configs = [
        {"peering": ["right_side"]},  # Left cap - extends right
        {"peering": ["left_side", "right_side"]},  # Center 1
        {"peering": ["left_side", "right_side"]},  # Center 2
        {"peering": ["left_side", "right_side"]},  # Center 3
        {"peering": ["left_side"]},  # Right cap - extends left
        {"peering": []},  # Single block - no extension
    ]
    
    for x, config in enumerate(tile_configs[:width]):
        lines.append(f'{x}:0/0 = 0')
        
        if terrain_config:
            lines.append(f'{x}:0/0/terrain_set = {terrain_set}')
            for peering_name in config["peering"]:
                lines.append(f'{x}:0/0/terrains_peering_bit/{peering_name} = {terrain_id}')
        
        # Add physics collision polygon if requested
        if include_physics:
            lines.extend(_generate_physics_polygon(x, 0, tile_size))
    
    return lines


def _generate_wall_3x3_tiles(terrain_config: Optional[TerrainConfig], include_physics: bool = False, tile_size: int = 32) -> List[str]:
    """Generate wall tileset (3x3) - similar to terrain but for vertical surfaces."""
    # Walls use same layout as terrain but with different semantic meaning
    return _generate_terrain_3x3_tiles(terrain_config, include_physics, tile_size)


def _generate_decoration_tiles(width: int, height: int, include_physics: bool = False, tile_size: int = 32) -> List[str]:
    """Generate decoration tiles - no terrain, just sprites."""
    lines = []
    for y in range(height):
        for x in range(width):
            lines.append(f'{x}:{y}/0 = 0')
            # Add physics collision polygon if requested
            if include_physics:
                lines.extend(_generate_physics_polygon(x, y, tile_size))
    return lines


def _generate_animated_tiles(frame_count: int) -> List[str]:
    """Generate animated tile configuration (horizontal strip)."""
    lines = []
    for x in range(frame_count):
        lines.append(f'{x}:0/0 = 0')
        # Animation frames are handled separately in Godot's animation system
    return lines


def _generate_transition_tiles(terrain_config: Optional[TerrainConfig], include_physics: bool = False, tile_size: int = 32) -> List[str]:
    """
    Generate transition tileset (2x4 grid).
    
    Row 1: Edge transitions (top, bottom, left, right)
    Row 2: Corner transitions (TL, TR, BL, BR)
    """
    lines = []
    
    for y in range(2):
        for x in range(4):
            lines.append(f'{x}:{y}/0 = 0')
            # Transition tiles typically don't use terrain autotiling
            # They're manually placed for blending
            # Add physics collision polygon if requested
            if include_physics:
                lines.extend(_generate_physics_polygon(x, y, tile_size))
    
    return lines


def generate_main_resource(
    tile_size: int,
    terrain_config: Optional[TerrainConfig] = None,
    include_physics: bool = False,
) -> str:
    """Generate the main TileSet resource definition."""
    lines = ['[resource]']
    lines.append('tile_shape = 0')  # 0 = Square
    lines.append(f'tile_size = Vector2i({tile_size}, {tile_size})')
    
    # Add physics layer if requested
    if include_physics:
        lines.append('physics_layers_count = 1')
        lines.append('physics_layer_0/collision_layer = 1')
        lines.append('physics_layer_0/collision_mask = 1')
    
    if terrain_config:
        # Add terrain set definition
        lines.append('terrain_sets_count = 1')
        lines.append('terrains_count = 1')
        lines.append(f'terrain_set_0/name = "{terrain_config.terrain_name}"')
        lines.append('terrain_set_0/mode = 0')  # 0 = Match corners and sides
        lines.append(f'terrain_set_0/terrain_0/name = "{terrain_config.terrain_name}"')
        lines.append(f'terrain_set_0/terrain_0/color = Color({_hex_to_color(terrain_config.terrain_color)})')
    
    lines.append('sources/0 = SubResource("TileSetAtlasSource_1")')
    
    return '\n'.join(lines)


def _hex_to_color(hex_color: str) -> str:
    """Convert hex color to Godot Color format."""
    hex_color = hex_color.lstrip('#')
    r = int(hex_color[0:2], 16) / 255.0
    g = int(hex_color[2:4], 16) / 255.0
    b = int(hex_color[4:6], 16) / 255.0
    return f'{r:.4f}, {g:.4f}, {b:.4f}, 1.0'


def export_tileset_tres(
    tileset_image: np.ndarray,
    tile_size: int,
    texture_path: str,
    tileset_type: TileSetType = TileSetType.TERRAIN_3X3,
    terrain_config: Optional[TerrainConfig] = None,
    include_physics: bool = False,
) -> TileSetExportResult:
    """
    Export a tileset image as a Godot 4.x .tres TileSet resource.
    
    Args:
        tileset_image: NumPy array of the tileset image
        tile_size: Size of each tile in pixels
        texture_path: Godot resource path for the texture (e.g., "res://sprites/terrain.png")
        tileset_type: Type of tileset for terrain configuration
        terrain_config: Optional terrain configuration for autotiling
        include_physics: Whether to include physics collision layers
    
    Returns:
        TileSetExportResult with .tres content and metadata
    """
    height, width = tileset_image.shape[:2]
    grid_width = width // tile_size
    grid_height = height // tile_size
    tile_count = grid_width * grid_height
    
    # Build .tres file content
    tres_parts = []
    
    # Header
    tres_parts.append(generate_tres_header())
    
    # External texture reference
    tres_parts.append(generate_texture_resource(texture_path))
    
    # TileSetAtlasSource sub-resource
    tres_parts.append(generate_tileset_atlas_source(
        tile_size=tile_size,
        grid_width=grid_width,
        grid_height=grid_height,
        terrain_config=terrain_config,
        tileset_type=tileset_type,
        include_physics=include_physics,
    ))
    
    tres_parts.append('')  # Empty line separator
    
    # Main resource
    tres_parts.append(generate_main_resource(
        tile_size=tile_size,
        terrain_config=terrain_config,
        include_physics=include_physics,
    ))
    
    tres_content = '\n'.join(tres_parts)
    
    return TileSetExportResult(
        tres_content=tres_content,
        image_path_reference=texture_path,
        tile_count=tile_count,
        terrain_configured=terrain_config is not None,
    )


def get_tileset_type_from_string(type_str: str) -> TileSetType:
    """Convert string tileset type to enum."""
    type_map = {
        "terrain": TileSetType.TERRAIN_3X3,
        "terrain_3x3": TileSetType.TERRAIN_3X3,
        "platform": TileSetType.PLATFORM_STRIP,
        "platform_strip": TileSetType.PLATFORM_STRIP,
        "wall": TileSetType.WALL_3X3,
        "wall_3x3": TileSetType.WALL_3X3,
        "decoration": TileSetType.DECORATION,
        "animated": TileSetType.ANIMATED,
        "transition": TileSetType.TRANSITION,
    }
    return type_map.get(type_str.lower(), TileSetType.TERRAIN_3X3)


def encode_tres_base64(tres_content: str) -> str:
    """Encode .tres content as base64 for API transmission."""
    return base64.b64encode(tres_content.encode('utf-8')).decode('utf-8')
