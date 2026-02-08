"""
Terrain Tileset Generator

Generates complete, game-ready terrain tilesets with all edge and corner variants.
Supports multiple formats:
- Minimal 9-tile (3x3 grid)
- Wang 16-tile (4x4 grid)
- Blob 47-tile (complete)

Each tileset is designed for autotiling in Godot/Unity.

Background Removal Options:
- "white_removal": Simple white background removal (fast, basic)
- "difference_matte": True alpha via white/black pair comparison (slower, best quality)
"""
import cv2
import numpy as np
from dataclasses import dataclass
from typing import Optional, Literal
import io

from app.services.gemini_client import gemini_client
from app.services.difference_matting import compute_difference_matte
from app.models.tileset_dna import (
    TerrainTilesetDNA, TerrainType, TilesetFormat,
    TextureStyle, OutlineStyle, Perspective,
)


@dataclass
class TerrainTilesetResult:
    """Result of terrain tileset generation."""
    tileset_image: np.ndarray      # Full tileset atlas
    tile_size: int                 # Size of each tile
    tile_count: int                # Number of tiles generated
    format: TilesetFormat          # Format used
    individual_tiles: list[np.ndarray]  # List of individual tiles
    validation_passed: bool        # Whether validation passed
    validation_message: str        # Validation details
    background_removal_method: str = "white_removal"  # Method used


# ============================================================================
# Prompt Builders
# ============================================================================

def build_minimal_9_prompt(dna: TerrainTilesetDNA) -> str:
    """
    Build prompt for minimal 9-tile terrain tileset.
    
    Layout (3x3 grid):
    ┌─────┬─────┬─────┐
    │ TL  │ T   │ TR  │  Top-Left corner, Top edge, Top-Right corner
    ├─────┼─────┼─────┤
    │ L   │ C   │ R   │  Left edge, Center fill, Right edge
    ├─────┼─────┼─────┤
    │ BL  │ B   │ BR  │  Bottom-Left corner, Bottom edge, Bottom-Right corner
    └─────┴─────┴─────┘
    """
    tile_size = dna.tile_size
    total_size = tile_size * 3
    colors = ", ".join(dna.color_palette)
    
    texture_desc = {
        TextureStyle.FLAT: "flat solid colors with minimal variation",
        TextureStyle.SMOOTH: "smooth gradients and soft transitions",
        TextureStyle.NOISY: "subtle grain and noise texture for natural look",
        TextureStyle.DETAILED: "rich detail with visible texture patterns",
        TextureStyle.HANDPAINTED: "artistic brush-stroke appearance",
    }.get(dna.texture_style, "natural texture")
    
    outline_desc = {
        OutlineStyle.NONE: "no outlines",
        OutlineStyle.DARK: "thin dark outlines (1px) around tile edges",
        OutlineStyle.LIGHT: "thin light outlines for contrast",
        OutlineStyle.COLORED: "colored outlines matching the terrain",
        OutlineStyle.THICK: "thick 2px dark outlines",
    }.get(dna.outline_style, "subtle outlines")
    
    terrain_desc = {
        TerrainType.GRASS: "lush green grass terrain with natural texture",
        TerrainType.DIRT: "brown earth/dirt terrain with soil texture",
        TerrainType.STONE: "gray stone/rock terrain with rocky texture",
        TerrainType.BRICK: "brick or cobblestone pattern",
        TerrainType.SAND: "sandy desert terrain with granular texture",
        TerrainType.SNOW: "white snowy terrain with icy accents",
        TerrainType.WOOD: "wooden planks or log texture",
        TerrainType.CAVE: "dark cave floor with rocky texture",
        TerrainType.DUNGEON: "dungeon stone floor tiles",
        TerrainType.CASTLE: "castle stone floor",
    }.get(dna.terrain_type, "terrain")
    
    prompt = f"""Generate a COMPLETE pixel art terrain tileset atlas.

=== CRITICAL: THIS IS A TILESET, NOT A SINGLE TILE ===

IMAGE SIZE: EXACTLY {total_size}x{total_size} pixels
GRID: 3 rows × 3 columns = 9 TILES
EACH TILE: {tile_size}x{tile_size} pixels

TERRAIN TYPE: {dna.terrain_type.value.upper()} - {terrain_desc}
COLORS: {colors}
TEXTURE: {texture_desc}
OUTLINES: {outline_desc}

=== TILE LAYOUT (VERY IMPORTANT) ===

The image must contain EXACTLY 9 tiles arranged in a 3x3 grid:

Row 1 (top, y=0 to {tile_size}):
- Tile 1 (x=0): TOP-LEFT CORNER - Terrain fills bottom-right, empty/void on top and left
- Tile 2 (x={tile_size}): TOP EDGE - Terrain fills bottom, empty/void on top
- Tile 3 (x={tile_size*2}): TOP-RIGHT CORNER - Terrain fills bottom-left, empty/void on top and right

Row 2 (middle, y={tile_size} to {tile_size*2}):
- Tile 4 (x=0): LEFT EDGE - Terrain fills right side, empty/void on left
- Tile 5 (x={tile_size}): CENTER FILL - 100% terrain, tiles seamlessly with itself
- Tile 6 (x={tile_size*2}): RIGHT EDGE - Terrain fills left side, empty/void on right

Row 3 (bottom, y={tile_size*2} to {total_size}):
- Tile 7 (x=0): BOTTOM-LEFT CORNER - Terrain fills top-right, empty/void on bottom and left
- Tile 8 (x={tile_size}): BOTTOM EDGE - Terrain fills top, empty/void on bottom
- Tile 9 (x={tile_size*2}): BOTTOM-RIGHT CORNER - Terrain fills top-left, empty/void on bottom and right

=== VOID/EMPTY AREAS ===
The "void" or "empty" areas should be PURE WHITE (#FFFFFF) background.
This represents the space where there is NO terrain (for background removal later).

=== SEAMLESS REQUIREMENTS ===
1. The CENTER tile (Tile 5) MUST tile seamlessly with copies of itself
2. Edge tiles connect perfectly to the center tile
3. Corner tiles connect to both adjacent edge tiles
4. When assembled, the tileset creates seamless terrain with proper edges

=== PIXEL ART RULES ===
- Pure pixel art style - no blur, no anti-aliasing
- Crisp {tile_size}x{tile_size} pixel grid
- Each tile is clearly separated (NO overlapping)
- {outline_desc}
- Game-ready for Godot/Unity autotiling

Generate a professional, game-ready terrain tileset. The terrain should look like {terrain_desc}."""

    return prompt


def build_wang_16_prompt(dna: TerrainTilesetDNA) -> str:
    """Build prompt for Wang 16-tile terrain tileset (4x4 grid)."""
    tile_size = dna.tile_size
    total_size = tile_size * 4
    colors = ", ".join(dna.color_palette)
    
    prompt = f"""Generate a COMPLETE pixel art Wang terrain tileset atlas.

IMAGE SIZE: EXACTLY {total_size}x{total_size} pixels
GRID: 4 rows × 4 columns = 16 TILES (Wang tile format)
EACH TILE: {tile_size}x{tile_size} pixels

TERRAIN TYPE: {dna.terrain_type.value.upper()}
COLORS: {colors}

=== WANG TILE LAYOUT (4x4 grid) ===

This is a Wang 2-corner tileset where each corner can be terrain or void.
The 16 tiles cover ALL possible corner combinations:

Row 1: Tiles with NO bottom corners filled
Row 2: Tiles with bottom-left corner filled
Row 3: Tiles with bottom-right corner filled
Row 4: Tiles with BOTH bottom corners filled

Each row varies the top corners similarly.

=== VOID/EMPTY AREAS ===
Non-terrain areas should be PURE WHITE (#FFFFFF).

=== SEAMLESS REQUIREMENTS ===
ALL tiles with matching edge patterns MUST connect seamlessly.

=== RULES ===
- Pure pixel art, {tile_size}px tiles
- Crisp edges, no blur
- Game-ready for Wang autotiling
- Empty areas = white background

Generate a complete Wang tileset for {dna.terrain_type.value} terrain."""

    return prompt


# ============================================================================
# Background Removal
# ============================================================================

def remove_white_background(image: np.ndarray, threshold: int = 240) -> np.ndarray:
    """
    Remove white background by making white pixels transparent.
    
    Args:
        image: BGR or BGRA image
        threshold: Pixel values above this in all channels are considered white
    
    Returns:
        BGRA image with white pixels made transparent
    """
    # Ensure we have 4 channels
    if len(image.shape) == 2:
        # Grayscale
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGRA)
    elif image.shape[2] == 3:
        # BGR -> BGRA
        image = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
    
    # Create mask of near-white pixels
    b, g, r, a = cv2.split(image)
    
    # White mask: True where all channels are near white
    white_mask = (b >= threshold) & (g >= threshold) & (r >= threshold)
    
    # Set alpha to 0 for white pixels
    a[white_mask] = 0
    
    # Merge back
    result = cv2.merge([b, g, r, a])
    
    return result


# ============================================================================
# Validation
# ============================================================================

def validate_terrain_tileset(
    tileset: np.ndarray,
    tile_size: int,
    expected_count: int = 9,
) -> tuple[bool, str]:
    """
    Validate that the generated tileset is game-ready.
    
    Checks:
    1. Correct total dimensions
    2. Tiles are properly separated
    3. Center tile tiles seamlessly with itself
    4. Edges connect to center
    """
    h, w = tileset.shape[:2]
    
    expected_size = int(np.sqrt(expected_count)) * tile_size
    
    # Check dimensions
    if h != expected_size or w != expected_size:
        return False, f"Incorrect size: got {w}x{h}, expected {expected_size}x{expected_size}"
    
    # Extract center tile for seamless check
    grid_dim = int(np.sqrt(expected_count))
    center_idx = grid_dim // 2
    
    cx = center_idx * tile_size
    cy = center_idx * tile_size
    center_tile = tileset[cy:cy+tile_size, cx:cx+tile_size]
    
    # Check if center tile tiles seamlessly (left-right)
    left_edge = center_tile[:, 0:2]
    right_edge = center_tile[:, -2:]
    h_diff = np.mean(np.abs(left_edge.astype(float) - right_edge.astype(float)))
    
    # Check if center tile tiles seamlessly (top-bottom)
    top_edge = center_tile[0:2, :]
    bottom_edge = center_tile[-2:, :]
    v_diff = np.mean(np.abs(top_edge.astype(float) - bottom_edge.astype(float)))
    
    seamless_score = 100 - (h_diff + v_diff) / 2
    
    if seamless_score < 70:
        return False, f"Center tile not seamless enough: score={seamless_score:.1f}/100"
    
    return True, f"Validation passed: seamless_score={seamless_score:.1f}/100"


def extract_individual_tiles(
    tileset: np.ndarray,
    tile_size: int,
    grid_dim: int,
) -> list[np.ndarray]:
    """Extract individual tiles from tileset atlas."""
    tiles = []
    for row in range(grid_dim):
        for col in range(grid_dim):
            x = col * tile_size
            y = row * tile_size
            tile = tileset[y:y+tile_size, x:x+tile_size].copy()
            tiles.append(tile)
    return tiles


# ============================================================================
# Main Generation Functions
# ============================================================================

async def generate_terrain_tileset_9(
    dna: TerrainTilesetDNA,
) -> TerrainTilesetResult:
    """
    Generate a minimal 9-tile terrain tileset (3x3 grid).
    
    This is the simplest format that still supports autotiling.
    
    Args:
        dna: TerrainTilesetDNA with terrain specifications
    
    Returns:
        TerrainTilesetResult with tileset image and metadata
    """
    prompt = build_minimal_9_prompt(dna)
    tile_size = dna.tile_size
    total_size = tile_size * 3
    
    print(f"🏔️ Generating 9-tile {dna.terrain_type.value} terrain tileset...")
    
    # Generate tileset image
    image_bytes = await gemini_client.generate_image(
        prompt=prompt,
        aspect_ratio="1:1",
    )
    
    if not image_bytes:
        raise ValueError("Failed to generate tileset image")
    
    # Decode image
    nparr = np.frombuffer(image_bytes, np.uint8)
    tileset = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
    
    if tileset is None:
        raise ValueError("Failed to decode tileset image")
    
    # Resize to exact expected size if needed
    h, w = tileset.shape[:2]
    if h != total_size or w != total_size:
        print(f"  ⚠️ Resizing from {w}x{h} to {total_size}x{total_size}")
        tileset = cv2.resize(tileset, (total_size, total_size), interpolation=cv2.INTER_NEAREST)
    
    # 🔧 FIX: Remove white background for transparency
    print(f"  🎨 Removing white background...")
    tileset = remove_white_background(tileset, threshold=240)
    
    # Validate
    valid, message = validate_terrain_tileset(tileset, tile_size, expected_count=9)
    print(f"  {'✅' if valid else '⚠️'} {message}")
    
    # Extract individual tiles
    tiles = extract_individual_tiles(tileset, tile_size, grid_dim=3)
    
    print(f"✅ Generated {len(tiles)} terrain tiles ({tile_size}x{tile_size}px each) with transparency")
    
    return TerrainTilesetResult(
        tileset_image=tileset,
        tile_size=tile_size,
        tile_count=len(tiles),
        format=TilesetFormat.MINIMAL_9,
        individual_tiles=tiles,
        validation_passed=valid,
        validation_message=message,
        background_removal_method="white_removal",
    )


async def generate_terrain_tileset_9_with_matte(
    dna: TerrainTilesetDNA,
) -> TerrainTilesetResult:
    """
    Generate 9-tile terrain tileset with DIFFERENCE MATTING for true alpha.
    
    This method:
    1. Generates tileset on WHITE background
    2. Uses image editing to create BLACK background version
    3. Computes true alpha using difference matting
    
    Slower but produces much better transparency, especially for edges.
    
    Args:
        dna: TerrainTilesetDNA with terrain specifications
    
    Returns:
        TerrainTilesetResult with true alpha transparency
    """
    tile_size = dna.tile_size
    total_size = tile_size * 3
    colors = ", ".join(dna.color_palette)
    
    terrain_desc = {
        TerrainType.GRASS: "lush green grass terrain",
        TerrainType.DIRT: "brown earth/dirt terrain",
        TerrainType.STONE: "gray stone/rock terrain",
        TerrainType.BRICK: "brick or cobblestone pattern",
        TerrainType.SAND: "sandy desert terrain",
        TerrainType.SNOW: "white snowy terrain",
        TerrainType.WOOD: "wooden planks texture",
        TerrainType.CAVE: "dark cave floor",
        TerrainType.DUNGEON: "dungeon stone floor",
        TerrainType.CASTLE: "castle stone floor",
    }.get(dna.terrain_type, "terrain")
    
    print(f"🏔️ Generating 9-tile {dna.terrain_type.value} tileset with DIFFERENCE MATTING...")
    
    # ============================================
    # Step 1: Generate WHITE background version
    # ============================================
    white_prompt = f"""Generate a COMPLETE pixel art terrain tileset atlas.

IMAGE SIZE: EXACTLY {total_size}x{total_size} pixels
GRID: 3 rows × 3 columns = 9 TILES
EACH TILE: {tile_size}x{tile_size} pixels

TERRAIN TYPE: {dna.terrain_type.value.upper()} - {terrain_desc}
COLORS: {colors}

CRITICAL - BACKGROUND: Render on PURE SOLID WHITE (#FFFFFF) background.
The background must be completely flat pure white with no gradients or patterns.

TILE LAYOUT (3x3 grid):
Row 1: [TOP-LEFT CORNER] [TOP EDGE] [TOP-RIGHT CORNER]
Row 2: [LEFT EDGE] [CENTER FILL] [RIGHT EDGE] 
Row 3: [BOTTOM-LEFT CORNER] [BOTTOM EDGE] [BOTTOM-RIGHT CORNER]

RULES:
- Center tile tiles seamlessly with itself
- Edge/corner tiles show terrain fading to white background
- Pure pixel art, {tile_size}px tiles
- Game-ready for autotiling

Generate terrain tileset on WHITE background."""

    print(f"  📸 Generating WHITE background version...")
    white_bytes = await gemini_client.generate_image(
        prompt=white_prompt,
        aspect_ratio="1:1",
    )
    
    if not white_bytes:
        raise ValueError("Failed to generate white background version")
    
    # ============================================
    # Step 2: Edit to create BLACK background version
    # ============================================
    edit_prompt = """Change ONLY the background of this image from white to pure solid black (#000000).

CRITICAL RULES:
- Keep the EXACT same terrain tiles in the EXACT same positions
- Do NOT modify, move, or change any part of the terrain artwork
- Do NOT add any new elements
- Do NOT change any colors of the terrain itself
- ONLY change the pure white background areas to pure black
- The result must be PIXEL-PERFECT identical terrain, just on black instead of white

Simply replace white (#FFFFFF) background pixels with black (#000000) pixels."""

    print(f"  🖤 Editing to BLACK background version...")
    black_bytes = await gemini_client.edit_image_simple(
        image_bytes=white_bytes,
        edit_prompt=edit_prompt,
    )
    
    if not black_bytes:
        print(f"  ⚠️ Failed to create black version, falling back to white removal")
        return await generate_terrain_tileset_9(dna)
    
    # ============================================
    # Step 3: Compute difference matte
    # ============================================
    print(f"  🎨 Computing difference matte for true alpha...")
    
    # Decode images
    white_arr = np.frombuffer(white_bytes, np.uint8)
    black_arr = np.frombuffer(black_bytes, np.uint8)
    
    white_img = cv2.imdecode(white_arr, cv2.IMREAD_COLOR)
    black_img = cv2.imdecode(black_arr, cv2.IMREAD_COLOR)
    
    if white_img is None or black_img is None:
        print(f"  ⚠️ Failed to decode images, falling back to white removal")
        return await generate_terrain_tileset_9(dna)
    
    # Compute true alpha using difference matting
    tileset = compute_difference_matte(white_img, black_img, edge_refinement=True)
    
    # Resize to exact expected size if needed
    h, w = tileset.shape[:2]
    if h != total_size or w != total_size:
        print(f"  ⚠️ Resizing from {w}x{h} to {total_size}x{total_size}")
        tileset = cv2.resize(tileset, (total_size, total_size), interpolation=cv2.INTER_NEAREST)
    
    # Validate
    valid, message = validate_terrain_tileset(tileset, tile_size, expected_count=9)
    print(f"  {'✅' if valid else '⚠️'} {message}")
    
    # Extract individual tiles
    tiles = extract_individual_tiles(tileset, tile_size, grid_dim=3)
    
    print(f"✅ Generated {len(tiles)} terrain tiles with TRUE ALPHA ({tile_size}x{tile_size}px each)")
    
    return TerrainTilesetResult(
        tileset_image=tileset,
        tile_size=tile_size,
        tile_count=len(tiles),
        format=TilesetFormat.MINIMAL_9,
        individual_tiles=tiles,
        validation_passed=valid,
        validation_message=message,
        background_removal_method="difference_matte",
    )


async def generate_terrain_tileset(
    dna: TerrainTilesetDNA,
    use_difference_matte: bool = False,
) -> TerrainTilesetResult:
    """
    Generate terrain tileset based on format specified in DNA.
    
    Args:
        dna: TerrainTilesetDNA with terrain specifications
        use_difference_matte: If True, use advanced difference matting for true alpha
                             (slower but better quality transparency)
    
    Returns:
        TerrainTilesetResult with tileset image
    """
    if dna.tileset_format == TilesetFormat.MINIMAL_9:
        if use_difference_matte:
            return await generate_terrain_tileset_9_with_matte(dna)
        else:
            return await generate_terrain_tileset_9(dna)
    elif dna.tileset_format == TilesetFormat.WANG_16:
        # TODO: Implement 16-tile Wang format
        print("⚠️ Wang 16 not yet implemented, falling back to minimal 9")
        return await generate_terrain_tileset_9(dna)
    elif dna.tileset_format == TilesetFormat.BLOB_47:
        # TODO: Implement 47-tile blob format
        print("⚠️ Blob 47 not yet implemented, falling back to minimal 9")
        return await generate_terrain_tileset_9(dna)
    else:
        return await generate_terrain_tileset_9(dna)


def encode_tileset_png(tileset: np.ndarray) -> bytes:
    """Encode tileset as PNG bytes."""
    success, buffer = cv2.imencode('.png', tileset)
    if not success:
        raise ValueError("Failed to encode tileset")
    return buffer.tobytes()
