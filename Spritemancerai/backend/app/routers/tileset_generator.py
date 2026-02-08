"""
Tileset Generator API Endpoints

Specialized endpoints for game-ready tile generation:
- /generate-terrain-tileset - Complete 9-47 tile terrain sets
- /generate-platform-tiles - Platformer platform tiles
- /generate-wall-tileset - Wall tiles for dungeons/caves
- /generate-decoration - Props and decoration sprites
- /generate-transition-tiles - Terrain transition tiles
- /generate-animated-tile - Enhanced animated environmental tiles

Each endpoint produces production-ready assets for game engines.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Literal
import base64
import uuid
import os
import cv2
import numpy as np

from app.models.tileset_dna import (
    TerrainTilesetDNA, TerrainType, TilesetFormat, TextureStyle, OutlineStyle, Perspective,
    PlatformTileDNA, PlatformType, PlatformMaterial, PlatformStyle,
    AnimatedTileDNA, AnimatedTileType, AnimationStyle, SeamlessMode,
    WallTilesetDNA, WallType, WallStyle,
    DecorationTileDNA, DecorationType,
    TransitionTileDNA, TransitionStyle,
    TERRAIN_TILESET_DNA_SCHEMA, PLATFORM_TILE_DNA_SCHEMA, ANIMATED_TILE_DNA_SCHEMA,
)
from app.services.tileset_generation.terrain_generator import (
    generate_terrain_tileset, encode_tileset_png,
)
from app.services.tileset_generation.platform_generator import (
    generate_platform_tiles, encode_platform_strip_png,
)
from app.services.tileset_generation.wall_generator import (
    generate_wall_tileset, encode_wall_tileset_png,
)
from app.services.tileset_generation.decoration_generator import (
    generate_decoration, encode_decoration_png,
)
from app.services.tileset_generation.transition_generator import (
    generate_transition_tiles, encode_transition_tileset_png,
)
from app.services.tileset_generation.animated_generator import (
    generate_animated_tile, encode_animation_strip_png,
)
from app.services.tileset_generation.tileset_exporter import (
    export_tileset_tres, get_tileset_type_from_string,
    TerrainConfig, TileSetType, encode_tres_base64,
)
from app.services.gemini_client import gemini_client
from app.db.supabase_client import supabase_service

router = APIRouter(tags=["Tileset Generation"])


# ============================================================================
# Request Models
# ============================================================================

class TerrainTilesetRequest(BaseModel):
    """Request for terrain tileset generation."""
    # Option 1: Use preset
    preset: Optional[str] = None
    
    # Option 2: Describe terrain
    prompt: Optional[str] = None
    
    # Option 3: Explicit DNA
    terrain_type: Optional[str] = None  # grass, dirt, stone, brick, etc.
    color_palette: Optional[list[str]] = None
    
    # Common options
    tileset_format: Literal["minimal_9", "wang_16", "blob_47"] = "minimal_9"
    tile_size: int = 32
    texture_style: Literal["flat", "smooth", "noisy", "detailed"] = "noisy"
    outline_style: Literal["none", "dark", "light", "thick"] = "dark"
    perspective: Literal["top_down", "side_view"] = "top_down"
    
    # Advanced background removal
    use_difference_matte: bool = False  # True = better alpha, slower (uses white/black pairs)
    
    # Physics collision
    include_physics: bool = True  # Whether to include collision shapes for tiles


class PlatformTileRequest(BaseModel):
    """Request for platform tile generation."""
    # Option 1: Use preset
    preset: Optional[str] = None
    
    # Option 2: Describe platform
    prompt: Optional[str] = None
    
    # Option 3: Explicit settings
    material: Optional[str] = None  # grass, stone, wood, metal, etc.
    platform_type: Literal["ground", "floating", "one_way", "ice", "bouncy"] = "ground"
    
    # Common options
    tile_size: int = 32
    platform_style: Literal["solid", "thin", "rounded", "angular", "organic"] = "solid"
    has_grass_top: bool = False
    include_slopes: bool = False
    color_palette: Optional[list[str]] = None


class AnimatedTileRequest(BaseModel):
    """Request for animated tile generation."""
    # Option 1: Use preset
    preset: Optional[str] = None
    
    # Option 2: Describe tile
    prompt: Optional[str] = None
    
    # Option 3: Explicit settings
    tile_type: Optional[str] = None  # water, lava, fire, crystal, etc.
    animation_style: Optional[str] = None  # wave, flicker, pulse, flow, etc.
    
    # Common options
    frame_count: int = 4
    tile_size: int = 32
    color_palette: Optional[list[str]] = None
    glow_intensity: float = 0.0
    animation_speed: Literal["slow", "medium", "fast"] = "medium"


class WallTilesetRequest(BaseModel):
    """Request for wall tileset generation."""
    # Option 1: Use preset
    preset: Optional[str] = None
    
    # Option 2: Describe wall
    prompt: Optional[str] = None
    
    # Option 3: Explicit settings
    wall_type: Optional[str] = None  # castle, dungeon, cave, brick, etc.
    wall_style: Literal["pristine", "weathered", "damaged", "mossy", "ancient"] = "weathered"
    
    # Common options
    tile_size: int = 32
    color_palette: Optional[list[str]] = None
    use_difference_matte: bool = False


class DecorationRequest(BaseModel):
    """Request for decoration/prop generation."""
    # Option 1: Use preset
    preset: Optional[str] = None
    
    # Option 2: Describe decoration
    prompt: Optional[str] = None
    
    # Option 3: Explicit settings
    decoration_type: Optional[str] = None  # crate, barrel, bush, rock, etc.
    
    # Common options
    size: str = "32x32"  # WxH format
    variation_count: int = 1
    color_palette: Optional[list[str]] = None
    perspective: Literal["side_view", "top_down", "three_quarter"] = "side_view"
    has_shadow: bool = True
    use_difference_matte: bool = False


class TransitionTileRequest(BaseModel):
    """Request for terrain transition tile generation."""
    # Terrain types to transition between
    from_terrain: str  # e.g., "grass"
    to_terrain: str    # e.g., "dirt"
    
    # Palettes for each terrain
    from_palette: Optional[list[str]] = None
    to_palette: Optional[list[str]] = None
    
    # Common options
    tile_size: int = 32
    transition_style: Literal["hard_edge", "soft_blend", "scattered", "dithered", "organic"] = "scattered"


class TileSetExportRequest(BaseModel):
    """Request for exporting tileset as Godot 4.x .tres resource."""
    tileset_image_base64: str  # The generated tileset PNG
    tile_size: int = 32
    tileset_type: Literal["terrain", "platform", "wall", "decoration", "animated", "transition"] = "terrain"
    texture_path: str = "res://sprites/tilesets/tileset.png"  # Godot resource path
    terrain_name: str = "terrain_0"
    terrain_color: str = "4a7023"  # Hex color for editor display
    include_terrain: bool = True  # Whether to include terrain autotiling config
    include_physics: bool = False  # Whether to include physics layers


# ============================================================================
# Preset Libraries
# ============================================================================

TERRAIN_PRESETS = {
    "grass_meadow": TerrainTilesetDNA(
        terrain_type=TerrainType.GRASS,
        color_palette=["#4A7023", "#5D8A31", "#7CB342", "#90A955"],
        tileset_format=TilesetFormat.MINIMAL_9,
        texture_style=TextureStyle.NOISY,
        outline_style=OutlineStyle.DARK,
    ),
    "dirt_path": TerrainTilesetDNA(
        terrain_type=TerrainType.DIRT,
        color_palette=["#8B4513", "#A0522D", "#CD853F", "#D2B48C"],
        tileset_format=TilesetFormat.MINIMAL_9,
        texture_style=TextureStyle.NOISY,
        outline_style=OutlineStyle.DARK,
    ),
    "stone_floor": TerrainTilesetDNA(
        terrain_type=TerrainType.STONE,
        color_palette=["#696969", "#808080", "#A9A9A9", "#C0C0C0"],
        tileset_format=TilesetFormat.MINIMAL_9,
        texture_style=TextureStyle.DETAILED,
        outline_style=OutlineStyle.DARK,
    ),
    "dungeon_floor": TerrainTilesetDNA(
        terrain_type=TerrainType.DUNGEON,
        color_palette=["#2F2F2F", "#404040", "#5A5A5A", "#1A1A1A"],
        tileset_format=TilesetFormat.MINIMAL_9,
        texture_style=TextureStyle.DETAILED,
        outline_style=OutlineStyle.NONE,
    ),
    "brick_floor": TerrainTilesetDNA(
        terrain_type=TerrainType.BRICK,
        color_palette=["#8B4513", "#A0522D", "#6B3A12", "#CD853F"],
        tileset_format=TilesetFormat.MINIMAL_9,
        texture_style=TextureStyle.DETAILED,
        outline_style=OutlineStyle.DARK,
    ),
    "snow_ground": TerrainTilesetDNA(
        terrain_type=TerrainType.SNOW,
        color_palette=["#FFFFFF", "#E8E8E8", "#D0D0D0", "#B0E0E6"],
        tileset_format=TilesetFormat.MINIMAL_9,
        texture_style=TextureStyle.SMOOTH,
        outline_style=OutlineStyle.LIGHT,
    ),
    "sand_desert": TerrainTilesetDNA(
        terrain_type=TerrainType.SAND,
        color_palette=["#EDC9AF", "#D4A574", "#C49A6B", "#B08B5D"],
        tileset_format=TilesetFormat.MINIMAL_9,
        texture_style=TextureStyle.NOISY,
        outline_style=OutlineStyle.DARK,
    ),
}

PLATFORM_PRESETS = {
    "grass_platform": PlatformTileDNA(
        platform_type=PlatformType.GROUND,
        material=PlatformMaterial.GRASS,
        color_palette=["#4A7023", "#8B4513", "#5D8A31", "#A0522D"],
        platform_style=PlatformStyle.SOLID,
        has_grass_top=True,
    ),
    "stone_platform": PlatformTileDNA(
        platform_type=PlatformType.GROUND,
        material=PlatformMaterial.STONE,
        color_palette=["#696969", "#808080", "#A9A9A9", "#505050"],
        platform_style=PlatformStyle.SOLID,
    ),
    "wooden_platform": PlatformTileDNA(
        platform_type=PlatformType.FLOATING,
        material=PlatformMaterial.WOOD,
        color_palette=["#8B4513", "#A0522D", "#CD853F", "#6B3A12"],
        platform_style=PlatformStyle.SOLID,
    ),
    "ice_platform": PlatformTileDNA(
        platform_type=PlatformType.ICE,
        material=PlatformMaterial.ICE,
        color_palette=["#ADD8E6", "#87CEEB", "#B0E0E6", "#FFFFFF"],
        platform_style=PlatformStyle.ROUNDED,
    ),
    "cloud_platform": PlatformTileDNA(
        platform_type=PlatformType.ONE_WAY,
        material=PlatformMaterial.CLOUD,
        color_palette=["#FFFFFF", "#F0F0F0", "#E8E8E8", "#D0D0D0"],
        platform_style=PlatformStyle.ROUNDED,
    ),
    "metal_platform": PlatformTileDNA(
        platform_type=PlatformType.GROUND,
        material=PlatformMaterial.METAL,
        color_palette=["#4A4A4A", "#6B6B6B", "#8B8B8B", "#2F2F2F"],
        platform_style=PlatformStyle.ANGULAR,
    ),
}

ANIMATED_TILE_PRESETS = {
    "calm_water": AnimatedTileDNA(
        tile_type=AnimatedTileType.WATER,
        animation_style=AnimationStyle.WAVE,
        color_palette=["#1E90FF", "#4169E1", "#00BFFF", "#87CEEB"],
        frame_count=4,
        glow_intensity=0.0,
    ),
    "bubbling_lava": AnimatedTileDNA(
        tile_type=AnimatedTileType.LAVA,
        animation_style=AnimationStyle.BUBBLE,
        color_palette=["#FF4500", "#FF6B00", "#8B0000", "#FFD700"],
        frame_count=6,
        glow_intensity=0.7,
    ),
    "torch_fire": AnimatedTileDNA(
        tile_type=AnimatedTileType.FIRE,
        animation_style=AnimationStyle.FLICKER,
        color_palette=["#FF4500", "#FF6B00", "#FFD700", "#FFFFFF"],
        frame_count=4,
        glow_intensity=0.5,
    ),
    "crystal_pulse": AnimatedTileDNA(
        tile_type=AnimatedTileType.CRYSTAL,
        animation_style=AnimationStyle.PULSE,
        color_palette=["#9B59B6", "#BF55EC", "#E8DAEF", "#FFFFFF"],
        frame_count=4,
        glow_intensity=0.6,
    ),
    "waterfall": AnimatedTileDNA(
        tile_type=AnimatedTileType.WATERFALL,
        animation_style=AnimationStyle.FLOW,
        color_palette=["#00BFFF", "#87CEEB", "#FFFFFF", "#1E90FF"],
        frame_count=4,
        glow_intensity=0.0,
    ),
    "windy_grass": AnimatedTileDNA(
        tile_type=AnimatedTileType.GRASS_WIND,
        animation_style=AnimationStyle.SWAY,
        color_palette=["#228B22", "#32CD32", "#7CFC00"],
        frame_count=4,
        glow_intensity=0.0,
    ),
}

WALL_PRESETS = {
    "dungeon_walls": WallTilesetDNA(
        wall_type=WallType.DUNGEON,
        wall_style=WallStyle.WEATHERED,
        color_palette=["#2F2F2F", "#404040", "#505050", "#1A1A1A"],
    ),
    "castle_walls": WallTilesetDNA(
        wall_type=WallType.CASTLE,
        wall_style=WallStyle.PRISTINE,
        color_palette=["#808080", "#696969", "#A9A9A9", "#505050"],
    ),
    "cave_walls": WallTilesetDNA(
        wall_type=WallType.CAVE,
        wall_style=WallStyle.ANCIENT,
        color_palette=["#5A4A32", "#463828", "#6B5A42", "#382818"],
    ),
    "brick_walls": WallTilesetDNA(
        wall_type=WallType.BRICK,
        wall_style=WallStyle.WEATHERED,
        color_palette=["#8B4513", "#A0522D", "#6B3A12", "#CD853F"],
    ),
    "wooden_walls": WallTilesetDNA(
        wall_type=WallType.WOODEN,
        wall_style=WallStyle.WEATHERED,
        color_palette=["#8B4513", "#A0522D", "#CD853F", "#D2B48C"],
    ),
    "ice_walls": WallTilesetDNA(
        wall_type=WallType.ICE,
        wall_style=WallStyle.PRISTINE,
        color_palette=["#ADD8E6", "#87CEEB", "#B0E0E6", "#E0FFFF"],
    ),
}

DECORATION_PRESETS = {
    "wooden_crate": DecorationTileDNA(
        decoration_type=DecorationType.CRATE,
        color_palette=["#8B4513", "#A0522D", "#CD853F", "#6B3A12"],
        size="32x32",
        variation_count=3,
    ),
    "barrel": DecorationTileDNA(
        decoration_type=DecorationType.BARREL,
        color_palette=["#8B4513", "#A0522D", "#5A3A1A", "#CD853F"],
        size="32x32",
        variation_count=2,
    ),
    "bush": DecorationTileDNA(
        decoration_type=DecorationType.BUSH,
        color_palette=["#228B22", "#32CD32", "#2E8B57", "#006400"],
        size="32x32",
        variation_count=3,
    ),
    "rock": DecorationTileDNA(
        decoration_type=DecorationType.ROCK,
        color_palette=["#696969", "#808080", "#A9A9A9", "#505050"],
        size="32x32",
        variation_count=3,
    ),
    "treasure_chest": DecorationTileDNA(
        decoration_type=DecorationType.CHEST,
        color_palette=["#8B4513", "#FFD700", "#CD853F", "#DAA520"],
        size="32x32",
        variation_count=2,
    ),
    "mushroom": DecorationTileDNA(
        decoration_type=DecorationType.MUSHROOM,
        color_palette=["#FF6347", "#FFFFFF", "#8B0000", "#228B22"],
        size="32x48",
        variation_count=3,
    ),
    "gravestone": DecorationTileDNA(
        decoration_type=DecorationType.GRAVE,
        color_palette=["#708090", "#778899", "#696969", "#2F4F4F"],
        size="32x48",
        variation_count=3,
    ),
}


# ============================================================================
# Helper Functions
# ============================================================================

async def save_tileset_to_storage(
    project_id: str,
    image_bytes: bytes,
    asset_type: str,
    dna: dict,
) -> dict:
    """Save generated tileset to Supabase storage."""
    try:
        # Upload to storage
        file_path = f"{project_id}/{asset_type}_{uuid.uuid4().hex[:8]}.png"
        url = await supabase_service.upload_image(
            "sprites", file_path, image_bytes, "image/png"
        )
        
        # Create/update project
        fake_user_id = "00000000-0000-0000-0000-000000000000"
        data = {
            "user_id": fake_user_id,
            "name": f"{asset_type.replace('_', ' ').title()}",
            "description": f"Generated {asset_type}",
            "status": "completed",
            "latest_spritesheet_url": url,
            "character_dna": dna,
        }
        
        response = supabase_service.client.table("projects").insert(data).execute()
        if response.data:
            project_id = response.data[0]['id']
        
        return {
            "project_id": project_id,
            "url": url,
        }
    except Exception as e:
        print(f"⚠️ Failed to save to storage: {e}")
        return {"project_id": project_id, "url": None}


# ============================================================================
# API Endpoints
# ============================================================================

@router.get("/tileset-presets")
async def list_tileset_presets():
    """List all available tileset presets."""
    return {
        "terrain_presets": list(TERRAIN_PRESETS.keys()),
        "platform_presets": list(PLATFORM_PRESETS.keys()),
        "wall_presets": list(WALL_PRESETS.keys()),
        "decoration_presets": list(DECORATION_PRESETS.keys()),
        "animated_presets": list(ANIMATED_TILE_PRESETS.keys()),
    }


@router.post("/generate-terrain-tileset")
async def api_generate_terrain_tileset(request: TerrainTilesetRequest):
    """
    Generate a complete, game-ready terrain tileset.
    
    Returns a tileset atlas with 9-47 tiles including:
    - Center/fill tiles
    - Edge tiles (top, bottom, left, right)
    - Corner tiles (all 4 corners)
    
    Perfect for autotiling in Godot/Unity.
    """
    try:
        # Build DNA from request
        if request.preset and request.preset in TERRAIN_PRESETS:
            dna = TERRAIN_PRESETS[request.preset]
        elif request.prompt:
            # Use AI to extract DNA from description
            dna_prompt = f"""Analyze this terrain description and extract terrain DNA.

Terrain: {request.prompt}

Extract:
- terrain_type: grass, dirt, stone, brick, sand, snow, wood, cave, dungeon, castle
- color_palette: 3-5 hex colors for this terrain type
- texture_style: flat, smooth, noisy, detailed

Return valid JSON only."""
            
            result = await gemini_client.generate_text(
                prompt=dna_prompt,
                response_schema=TERRAIN_TILESET_DNA_SCHEMA,
                temperature=0.3,
            )
            
            dna = TerrainTilesetDNA(
                terrain_type=TerrainType(result.get("terrain_type", "grass")),
                color_palette=result.get("color_palette", ["#4A7023", "#5D8A31", "#7CB342"]),
                tileset_format=TilesetFormat(request.tileset_format),
                tile_size=request.tile_size,
                texture_style=TextureStyle(result.get("texture_style", "noisy")),
                outline_style=OutlineStyle(request.outline_style),
                perspective=Perspective(request.perspective),
            )
        elif request.terrain_type:
            dna = TerrainTilesetDNA(
                terrain_type=TerrainType(request.terrain_type),
                color_palette=request.color_palette or ["#4A7023", "#5D8A31", "#7CB342", "#90A955"],
                tileset_format=TilesetFormat(request.tileset_format),
                tile_size=request.tile_size,
                texture_style=TextureStyle(request.texture_style),
                outline_style=OutlineStyle(request.outline_style),
                perspective=Perspective(request.perspective),
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="Provide preset, prompt, or terrain_type"
            )
        
        # Generate tileset
        result = await generate_terrain_tileset(dna, use_difference_matte=request.use_difference_matte)
        
        # Encode PNG
        image_bytes = encode_tileset_png(result.tileset_image)
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Save locally
        output_dir = "/tmp/spritemancer_generated"
        os.makedirs(output_dir, exist_ok=True)
        local_path = f"{output_dir}/terrain_{dna.terrain_type.value}_{uuid.uuid4().hex[:8]}.png"
        with open(local_path, "wb") as f:
            f.write(image_bytes)
        
        # Save to cloud
        project_id = str(uuid.uuid4())
        storage_result = await save_tileset_to_storage(
            project_id, image_bytes, "terrain_tileset", dna.dict()
        )
        
        return {
            "asset_type": "terrain_tileset",
            "terrain_type": dna.terrain_type.value,
            "tileset_format": dna.tileset_format.value,
            "tile_size": dna.tile_size,
            "tile_count": result.tile_count,
            "dna": dna.dict(),
            "validation_passed": result.validation_passed,
            "validation_message": result.validation_message,
            "background_removal_method": result.background_removal_method,
            "image_base64": image_base64,
            "local_path": local_path,
            "project_id": storage_result["project_id"],
            "tileset_url": storage_result["url"],
            "status": "generated",
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Terrain tileset generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-platform-tiles")
async def api_generate_platform_tiles(request: PlatformTileRequest):
    """
    Generate platformer-ready platform tiles.
    
    Returns a set of tiles designed for side-view platformer games:
    - Left end cap
    - Center sections (3 variants)
    - Right end cap
    - Single block
    """
    try:
        # Build DNA from request
        if request.preset and request.preset in PLATFORM_PRESETS:
            dna = PLATFORM_PRESETS[request.preset]
        elif request.prompt:
            # Use AI to extract DNA
            dna_prompt = f"""Analyze this platform description and extract platform DNA.

Platform: {request.prompt}

Extract:
- platform_type: ground, floating, one_way, ice, bouncy
- material: grass, stone, wood, metal, ice, brick, cloud
- color_palette: 3-4 hex colors
- has_grass_top: true if platform should have grass on top

Return valid JSON only."""
            
            result = await gemini_client.generate_text(
                prompt=dna_prompt,
                response_schema=PLATFORM_TILE_DNA_SCHEMA,
                temperature=0.3,
            )
            
            dna = PlatformTileDNA(
                platform_type=PlatformType(result.get("platform_type", "ground")),
                material=PlatformMaterial(result.get("material", "stone")),
                color_palette=result.get("color_palette", ["#696969", "#808080", "#A9A9A9"]),
                platform_style=PlatformStyle(request.platform_style),
                tile_size=request.tile_size,
                has_grass_top=result.get("has_grass_top", request.has_grass_top),
                include_slopes=request.include_slopes,
            )
        elif request.material:
            dna = PlatformTileDNA(
                platform_type=PlatformType(request.platform_type),
                material=PlatformMaterial(request.material),
                color_palette=request.color_palette or ["#696969", "#808080", "#A9A9A9", "#505050"],
                platform_style=PlatformStyle(request.platform_style),
                tile_size=request.tile_size,
                has_grass_top=request.has_grass_top,
                include_slopes=request.include_slopes,
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="Provide preset, prompt, or material"
            )
        
        # Generate tiles
        result = await generate_platform_tiles(dna)
        
        # Encode PNG
        image_bytes = encode_platform_strip_png(result.strip_image)
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Save locally
        output_dir = "/tmp/spritemancer_generated"
        os.makedirs(output_dir, exist_ok=True)
        local_path = f"{output_dir}/platform_{dna.material.value}_{uuid.uuid4().hex[:8]}.png"
        with open(local_path, "wb") as f:
            f.write(image_bytes)
        
        # Save to cloud
        project_id = str(uuid.uuid4())
        storage_result = await save_tileset_to_storage(
            project_id, image_bytes, "platform_tiles", dna.dict()
        )
        
        return {
            "asset_type": "platform_tiles",
            "platform_type": dna.platform_type.value,
            "material": dna.material.value,
            "tile_size": dna.tile_size,
            "tile_count": result.tile_count,
            "tile_names": list(result.tiles.keys()),
            "dna": dna.dict(),
            "validation_passed": result.validation_passed,
            "validation_message": result.validation_message,
            "image_base64": image_base64,
            "local_path": local_path,
            "project_id": storage_result["project_id"],
            "tileset_url": storage_result["url"],
            "status": "generated",
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Platform tile generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-animated-tile")
async def api_generate_animated_tile(request: AnimatedTileRequest):
    """
    Generate animated environmental tile.
    
    Returns a seamless animation strip for effects like:
    - Water (waves, ripples)
    - Lava (flow, bubbles)
    - Fire (flames, flickering)
    - Crystal (pulsing glow)
    - And more...
    """
    try:
        # Build DNA from request
        if request.preset and request.preset in ANIMATED_TILE_PRESETS:
            dna = ANIMATED_TILE_PRESETS[request.preset]
        elif request.prompt:
            # Use AI to extract DNA
            dna_prompt = f"""Analyze this animated tile description and extract DNA.

Tile: {request.prompt}

Extract:
- tile_type: water, lava, fire, crystal, waterfall, smoke, electricity, torch, grass_wind
- animation_style: wave, flicker, pulse, flow, bubble, sway, sparkle
- color_palette: 3-4 hex colors
- glow_intensity: 0-1 for glowing tiles

Return valid JSON only."""
            
            result = await gemini_client.generate_text(
                prompt=dna_prompt,
                response_schema=ANIMATED_TILE_DNA_SCHEMA,
                temperature=0.3,
            )
            
            dna = AnimatedTileDNA(
                tile_type=AnimatedTileType(result.get("tile_type", "water")),
                animation_style=AnimationStyle(result.get("animation_style", "wave")),
                color_palette=result.get("color_palette", ["#1E90FF", "#4169E1", "#00BFFF"]),
                frame_count=request.frame_count,
                tile_size=request.tile_size,
                glow_intensity=result.get("glow_intensity", request.glow_intensity),
            )
        elif request.tile_type:
            dna = AnimatedTileDNA(
                tile_type=AnimatedTileType(request.tile_type),
                animation_style=AnimationStyle(request.animation_style or "wave"),
                color_palette=request.color_palette or ["#1E90FF", "#4169E1", "#00BFFF", "#87CEEB"],
                frame_count=request.frame_count,
                tile_size=request.tile_size,
                glow_intensity=request.glow_intensity,
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="Provide preset, prompt, or tile_type"
            )
        
        # Generate tile
        result = await generate_animated_tile(dna)
        
        # Encode PNG
        image_bytes = encode_animation_strip_png(result.strip_image)
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Save locally
        output_dir = "/tmp/spritemancer_generated"
        os.makedirs(output_dir, exist_ok=True)
        local_path = f"{output_dir}/animated_{dna.tile_type.value}_{uuid.uuid4().hex[:8]}.png"
        with open(local_path, "wb") as f:
            f.write(image_bytes)
        
        # Save to cloud
        project_id = str(uuid.uuid4())
        storage_result = await save_tileset_to_storage(
            project_id, image_bytes, "animated_tile", dna.dict()
        )
        
        return {
            "asset_type": "animated_tile",
            "tile_type": dna.tile_type.value,
            "animation_style": dna.animation_style.value,
            "tile_size": dna.tile_size,
            "frame_count": result.frame_count,
            "dna": dna.dict(),
            "is_seamless": result.is_seamless,
            "seamless_score": result.seamless_score,
            "validation_message": result.validation_message,
            "image_base64": image_base64,
            "local_path": local_path,
            "project_id": storage_result["project_id"],
            "tileset_url": storage_result["url"],
            "status": "generated",
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Animated tile generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-wall-tileset")
async def api_generate_wall_tileset(request: WallTilesetRequest):
    """
    Generate a complete wall tileset for dungeons, caves, and buildings.
    
    Returns a 3x3 grid (9 tiles) including:
    - Center/fill wall tiles
    - Edge tiles (top, bottom, left, right)
    - Corner tiles (all 4 corners)
    """
    try:
        # Build DNA from request
        if request.preset and request.preset in WALL_PRESETS:
            dna = WALL_PRESETS[request.preset]
        elif request.wall_type:
            dna = WallTilesetDNA(
                wall_type=WallType(request.wall_type),
                wall_style=WallStyle(request.wall_style),
                color_palette=request.color_palette or ["#404040", "#505050", "#606060", "#303030"],
                tile_size=request.tile_size,
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="Provide preset or wall_type"
            )
        
        # Generate tileset
        result = await generate_wall_tileset(dna, use_difference_matte=request.use_difference_matte)
        
        # Encode PNG
        image_bytes = encode_wall_tileset_png(result.tileset_image)
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Save locally
        output_dir = "/tmp/spritemancer_generated"
        os.makedirs(output_dir, exist_ok=True)
        local_path = f"{output_dir}/wall_{dna.wall_type.value}_{uuid.uuid4().hex[:8]}.png"
        with open(local_path, "wb") as f:
            f.write(image_bytes)
        
        # Save to cloud
        project_id = str(uuid.uuid4())
        storage_result = await save_tileset_to_storage(
            project_id, image_bytes, "wall_tileset", dna.dict()
        )
        
        return {
            "asset_type": "wall_tileset",
            "wall_type": dna.wall_type.value,
            "tile_size": dna.tile_size,
            "tile_count": result.tile_count,
            "dna": dna.dict(),
            "validation_passed": result.validation_passed,
            "validation_message": result.validation_message,
            "background_removal_method": result.background_removal_method,
            "image_base64": image_base64,
            "local_path": local_path,
            "project_id": storage_result["project_id"],
            "tileset_url": storage_result["url"],
            "status": "generated",
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Wall tileset generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-decoration")
async def api_generate_decoration(request: DecorationRequest):
    """
    Generate decoration/prop sprites with optional variations.
    
    Returns one or more sprites for objects like:
    - Crates, barrels, pots
    - Bushes, rocks, flowers
    - Signs, lamps, torches
    - Chests, gravestones, etc.
    """
    try:
        # Build DNA from request
        if request.preset and request.preset in DECORATION_PRESETS:
            dna = DECORATION_PRESETS[request.preset]
        elif request.decoration_type:
            dna = DecorationTileDNA(
                decoration_type=DecorationType(request.decoration_type),
                color_palette=request.color_palette or ["#808080", "#696969", "#A9A9A9", "#505050"],
                size=request.size,
                variation_count=request.variation_count,
                perspective=Perspective(request.perspective),
                has_shadow=request.has_shadow,
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="Provide preset or decoration_type"
            )
        
        # Generate decoration
        result = await generate_decoration(dna, use_difference_matte=request.use_difference_matte)
        
        # Encode PNG
        image_bytes = encode_decoration_png(result.sprite_image)
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Save locally
        output_dir = "/tmp/spritemancer_generated"
        os.makedirs(output_dir, exist_ok=True)
        local_path = f"{output_dir}/decoration_{dna.decoration_type.value}_{uuid.uuid4().hex[:8]}.png"
        with open(local_path, "wb") as f:
            f.write(image_bytes)
        
        # Save to cloud
        project_id = str(uuid.uuid4())
        storage_result = await save_tileset_to_storage(
            project_id, image_bytes, "decoration", dna.dict()
        )
        
        return {
            "asset_type": "decoration",
            "decoration_type": dna.decoration_type.value,
            "sprite_size": result.sprite_size,
            "variation_count": result.variation_count,
            "dna": dna.dict(),
            "validation_passed": result.validation_passed,
            "validation_message": result.validation_message,
            "background_removal_method": result.background_removal_method,
            "image_base64": image_base64,
            "local_path": local_path,
            "project_id": storage_result["project_id"],
            "sprite_url": storage_result["url"],
            "status": "generated",
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Decoration generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-transition-tiles")
async def api_generate_transition_tiles(request: TransitionTileRequest):
    """
    Generate terrain transition tiles for blending between two terrain types.
    
    Returns 8 tiles (2x4 grid) with:
    - 4 edge transitions (top, bottom, left, right)
    - 4 corner transitions (TL, TR, BL, BR)
    """
    try:
        # Default palettes based on terrain types
        default_palettes = {
            "grass": ["#4A7023", "#5D8A31", "#7CB342", "#90A955"],
            "dirt": ["#8B4513", "#A0522D", "#CD853F", "#D2B48C"],
            "stone": ["#696969", "#808080", "#A9A9A9", "#C0C0C0"],
            "sand": ["#EDC9AF", "#D4A574", "#C49A6B", "#B08B5D"],
            "snow": ["#FFFFFF", "#E8E8E8", "#D0D0D0", "#B0E0E6"],
            "water": ["#1E90FF", "#4169E1", "#00BFFF", "#87CEEB"],
        }
        
        from_palette = request.from_palette or default_palettes.get(
            request.from_terrain.lower(), ["#808080", "#707070", "#909090", "#606060"]
        )
        to_palette = request.to_palette or default_palettes.get(
            request.to_terrain.lower(), ["#505050", "#404040", "#606060", "#303030"]
        )
        
        dna = TransitionTileDNA(
            from_terrain=request.from_terrain,
            to_terrain=request.to_terrain,
            from_palette=from_palette,
            to_palette=to_palette,
            tile_size=request.tile_size,
            transition_style=TransitionStyle(request.transition_style),
        )
        
        # Generate transition tiles
        result = await generate_transition_tiles(dna)
        
        # Encode PNG
        image_bytes = encode_transition_tileset_png(result.tileset_image)
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Save locally
        output_dir = "/tmp/spritemancer_generated"
        os.makedirs(output_dir, exist_ok=True)
        local_path = f"{output_dir}/transition_{dna.from_terrain}_{dna.to_terrain}_{uuid.uuid4().hex[:8]}.png"
        with open(local_path, "wb") as f:
            f.write(image_bytes)
        
        # Save to cloud
        project_id = str(uuid.uuid4())
        storage_result = await save_tileset_to_storage(
            project_id, image_bytes, "transition_tiles", dna.dict()
        )
        
        return {
            "asset_type": "transition_tiles",
            "from_terrain": dna.from_terrain,
            "to_terrain": dna.to_terrain,
            "tile_size": dna.tile_size,
            "tile_count": result.tile_count,
            "tile_names": result.tile_names,
            "dna": dna.dict(),
            "validation_passed": result.validation_passed,
            "validation_message": result.validation_message,
            "image_base64": image_base64,
            "local_path": local_path,
            "project_id": storage_result["project_id"],
            "tileset_url": storage_result["url"],
            "status": "generated",
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Transition tile generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export-tileset-resource")
async def api_export_tileset_resource(request: TileSetExportRequest):
    """
    Export a tileset image as a Godot 4.x .tres TileSet resource.
    
    The exported .tres file includes:
    - TileSetAtlasSource configuration
    - Terrain autotile setup (peering bits for seamless tiling)
    - Proper tile size and grid configuration
    
    Returns both the .tres file content and the original image for saving.
    """
    try:
        # Decode the tileset image
        image_bytes = base64.b64decode(request.tileset_image_base64)
        np_array = np.frombuffer(image_bytes, np.uint8)
        tileset_image = cv2.imdecode(np_array, cv2.IMREAD_UNCHANGED)
        
        if tileset_image is None:
            raise HTTPException(
                status_code=400,
                detail="Failed to decode tileset image"
            )
        
        # Build terrain config if needed
        terrain_config = None
        if request.include_terrain:
            terrain_config = TerrainConfig(
                terrain_set_id=0,
                terrain_id=0,
                terrain_name=request.terrain_name,
                terrain_color=request.terrain_color,
            )
        
        # Get tileset type
        tileset_type = get_tileset_type_from_string(request.tileset_type)
        
        # Export as .tres
        result = export_tileset_tres(
            tileset_image=tileset_image,
            tile_size=request.tile_size,
            texture_path=request.texture_path,
            tileset_type=tileset_type,
            terrain_config=terrain_config,
            include_physics=request.include_physics,
        )
        
        # Encode .tres content as base64
        tres_base64 = encode_tres_base64(result.tres_content)
        
        # Save locally
        output_dir = "/tmp/spritemancer_generated"
        os.makedirs(output_dir, exist_ok=True)
        
        # Generate filenames
        safe_name = request.terrain_name.replace(" ", "_").lower()[:20]
        timestamp = uuid.uuid4().hex[:8]
        tres_filename = f"{safe_name}_{timestamp}.tres"
        png_filename = f"{safe_name}_{timestamp}.png"
        
        # Save .tres file
        tres_path = f"{output_dir}/{tres_filename}"
        with open(tres_path, "w") as f:
            f.write(result.tres_content)
        
        # Save PNG file
        png_path = f"{output_dir}/{png_filename}"
        with open(png_path, "wb") as f:
            f.write(image_bytes)
        
        print(f"✅ Exported TileSet: {tres_path}")
        
        return {
            "success": True,
            "asset_type": "tileset_resource",
            "tileset_type": request.tileset_type,
            "tile_size": request.tile_size,
            "tile_count": result.tile_count,
            "terrain_configured": result.terrain_configured,
            "texture_path": result.image_path_reference,
            "tres_base64": tres_base64,
            "image_base64": request.tileset_image_base64,
            "local_tres_path": tres_path,
            "local_png_path": png_path,
            "tres_filename": tres_filename,
            "png_filename": png_filename,
            "message": f"✅ TileSet exported with {result.tile_count} tiles, terrain: {result.terrain_configured}",
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ TileSet export failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-and-export-terrain")
async def api_generate_and_export_terrain(request: TerrainTilesetRequest):
    """
    Combined endpoint: Generate terrain tileset AND export as Godot .tres resource.
    
    This is a convenience endpoint that:
    1. Generates a terrain tileset
    2. Exports it as a Godot 4.x TileSet resource
    3. Returns both PNG and .tres files
    """
    try:
        # Step 1: Generate terrain tileset
        if request.preset and request.preset in TERRAIN_PRESETS:
            dna = TERRAIN_PRESETS[request.preset]
        elif request.terrain_type:
            dna = TerrainTilesetDNA(
                terrain_type=TerrainType(request.terrain_type),
                color_palette=request.color_palette or ["#808080", "#707070", "#909090", "#606060"],
                tileset_format=TilesetFormat(request.tileset_format),
                tile_size=request.tile_size,
                texture_style=TextureStyle(request.texture_style),
                outline_style=OutlineStyle(request.outline_style),
                perspective=Perspective(request.perspective),
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="Provide preset or terrain_type"
            )
        
        result = await generate_terrain_tileset(dna, use_difference_matte=request.use_difference_matte)
        
        # Step 2: Encode the tileset image
        image_bytes = encode_tileset_png(result.tileset_image)
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Step 3: Export as .tres
        terrain_name = request.preset or request.terrain_type or "terrain"
        texture_path = f"res://sprites/tilesets/{terrain_name}_tileset.png"
        
        terrain_config = TerrainConfig(
            terrain_set_id=0,
            terrain_id=0,
            terrain_name=terrain_name,
            terrain_color=dna.color_palette[0].lstrip('#') if dna.color_palette else "4a7023",
        )
        
        export_result = export_tileset_tres(
            tileset_image=result.tileset_image,
            tile_size=dna.tile_size,
            texture_path=texture_path,
            tileset_type=TileSetType.TERRAIN_3X3,
            terrain_config=terrain_config,
            include_physics=request.include_physics,
        )
        
        tres_base64 = encode_tres_base64(export_result.tres_content)
        
        # Save files locally
        output_dir = "/tmp/spritemancer_generated"
        os.makedirs(output_dir, exist_ok=True)
        timestamp = uuid.uuid4().hex[:8]
        
        png_path = f"{output_dir}/{terrain_name}_{timestamp}.png"
        tres_path = f"{output_dir}/{terrain_name}_{timestamp}.tres"
        
        with open(png_path, "wb") as f:
            f.write(image_bytes)
        with open(tres_path, "w") as f:
            f.write(export_result.tres_content)
        
        # Save to cloud storage
        project_id = str(uuid.uuid4())
        storage_result = await save_tileset_to_storage(
            project_id, image_bytes, "terrain_tileset", dna.dict()
        )
        
        return {
            "success": True,
            "asset_type": "terrain_tileset_with_resource",
            "terrain_type": dna.terrain_type.value,
            "tile_size": dna.tile_size,
            "tile_count": export_result.tile_count,
            "terrain_configured": True,
            "dna": dna.dict(),
            "validation_passed": result.validation_passed,
            "validation_message": result.validation_message,
            "background_removal_method": result.background_removal_method,
            # Images
            "image_base64": image_base64,
            "tres_base64": tres_base64,
            # Godot paths
            "texture_path": texture_path,
            "tres_path": texture_path.replace(".png", ".tres"),
            # Local paths
            "local_png_path": png_path,
            "local_tres_path": tres_path,
            # Cloud
            "project_id": storage_result["project_id"],
            "tileset_url": storage_result["url"],
            "status": "generated",
            "message": f"✅ Generated and exported terrain tileset with {export_result.tile_count} tiles",
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Generate and export failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
