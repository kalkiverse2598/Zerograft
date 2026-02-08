"""
Wall Tileset Generator

Generates wall tilesets for dungeons, caves, and buildings.
Includes:
- Wall fill tiles
- Top edge (ceiling/void border)
- Side edges
- Corner pieces
- Optional torch/decoration variants
"""
import cv2
import numpy as np
from dataclasses import dataclass
from typing import Optional

from app.services.gemini_client import gemini_client
from app.services.difference_matting import compute_difference_matte
from app.models.tileset_dna import (
    WallTilesetDNA, WallType, WallStyle, TextureStyle, Perspective,
)


@dataclass
class WallTilesetResult:
    """Result of wall tileset generation."""
    tileset_image: np.ndarray
    tile_size: int
    tile_count: int
    individual_tiles: list[np.ndarray]
    validation_passed: bool
    validation_message: str
    background_removal_method: str = "white_removal"


def build_wall_tileset_prompt(dna: WallTilesetDNA) -> str:
    """Build prompt for wall tileset generation (3x3 grid = 9 tiles)."""
    tile_size = dna.tile_size
    total_size = tile_size * 3
    colors = ", ".join(dna.color_palette)
    
    wall_desc = {
        WallType.CASTLE: "medieval castle stone walls with large blocks",
        WallType.DUNGEON: "dark dungeon walls with rough stone and cracks",
        WallType.CAVE: "natural cave walls with rocky, irregular texture",
        WallType.BRICK: "brick walls with mortar lines",
        WallType.WOODEN: "wooden plank walls with visible grain",
        WallType.STONE: "cut stone walls with clean blocks",
        WallType.METAL: "industrial metal walls with rivets and panels",
        WallType.ICE: "frozen ice walls with crystalline texture",
    }.get(dna.wall_type, "stone walls")
    
    style_desc = {
        WallStyle.PRISTINE: "clean and new looking",
        WallStyle.WEATHERED: "slightly worn and aged",
        WallStyle.DAMAGED: "cracked and damaged with missing pieces",
        WallStyle.MOSSY: "covered with moss and vegetation",
        WallStyle.ANCIENT: "very old with significant wear",
    }.get(dna.wall_style, "weathered")
    
    prompt = f"""Generate a COMPLETE pixel art WALL tileset atlas for a 2D game.

IMAGE SIZE: EXACTLY {total_size}x{total_size} pixels
GRID: 3 rows × 3 columns = 9 TILES
EACH TILE: {tile_size}x{tile_size} pixels

WALL TYPE: {dna.wall_type.value.upper()} - {wall_desc}
STYLE: {style_desc}
COLORS: {colors}

=== TILE LAYOUT (3x3 grid for SIDE-VIEW walls) ===

This is a SIDE-VIEW tileset. Player sees the FRONT of the wall.

Row 1 (top):
- Tile 1: TOP-LEFT CORNER - Wall meets ceiling on top and left
- Tile 2: TOP EDGE - Wall meets ceiling/void at top
- Tile 3: TOP-RIGHT CORNER - Wall meets ceiling on top and right

Row 2 (middle):
- Tile 4: LEFT EDGE - Wall meets void on left side
- Tile 5: CENTER FILL - Main wall texture, tiles with itself
- Tile 6: RIGHT EDGE - Wall meets void on right side

Row 3 (bottom):
- Tile 7: BOTTOM-LEFT CORNER - Wall meets floor on bottom and left
- Tile 8: BOTTOM EDGE - Wall meets floor at bottom
- Tile 9: BOTTOM-RIGHT CORNER - Wall meets floor on bottom and right

=== WALL TEXTURE ===
- {wall_desc}
- {style_desc} appearance
- Vertical orientation (this is a wall, not floor)
- Dark outlines to define wall blocks/bricks
- Subtle shading for depth

=== BACKGROUND ===
Empty/void areas: PURE WHITE (#FFFFFF) background for transparency.

=== SEAMLESS REQUIREMENTS ===
- CENTER tile tiles seamlessly with itself
- Edge tiles connect properly to center
- Corner tiles connect to adjacent edges

=== PIXEL ART RULES ===
- Pure pixel art, {tile_size}px tiles
- No anti-aliasing, crisp edges
- Game-ready for dungeon/cave environments

Generate a complete {dna.wall_type.value} wall tileset."""

    return prompt


def validate_wall_tileset(
    tileset: np.ndarray,
    tile_size: int,
) -> tuple[bool, str]:
    """Validate wall tileset."""
    h, w = tileset.shape[:2]
    expected_size = tile_size * 3
    
    if h != expected_size or w != expected_size:
        return False, f"Size mismatch: got {w}x{h}, expected {expected_size}x{expected_size}"
    
    # Check center tile has wall texture (not too bright/dark)
    center = tileset[tile_size:tile_size*2, tile_size:tile_size*2]
    mean_brightness = np.mean(center)
    
    if mean_brightness > 240:
        return False, "Center tile appears empty (too bright)"
    if mean_brightness < 20:
        return False, "Center tile appears too dark"
    
    return True, f"Wall tileset validated (brightness={mean_brightness:.0f})"


def extract_wall_tiles(
    tileset: np.ndarray,
    tile_size: int,
) -> list[np.ndarray]:
    """Extract individual wall tiles."""
    tiles = []
    for row in range(3):
        for col in range(3):
            x = col * tile_size
            y = row * tile_size
            tiles.append(tileset[y:y+tile_size, x:x+tile_size].copy())
    return tiles


async def generate_wall_tileset(
    dna: WallTilesetDNA,
    use_difference_matte: bool = False,
) -> WallTilesetResult:
    """
    Generate a complete wall tileset.
    
    Args:
        dna: WallTilesetDNA with wall specifications
        use_difference_matte: Use advanced background removal
    
    Returns:
        WallTilesetResult with wall tiles
    """
    tile_size = dna.tile_size
    total_size = tile_size * 3
    
    print(f"🧱 Generating {dna.wall_type.value} wall tileset...")
    
    if use_difference_matte:
        # Generate with difference matting
        return await generate_wall_tileset_with_matte(dna)
    
    # Standard generation
    prompt = build_wall_tileset_prompt(dna)
    
    image_bytes = await gemini_client.generate_image(
        prompt=prompt,
        aspect_ratio="1:1",
    )
    
    if not image_bytes:
        raise ValueError("Failed to generate wall tileset")
    
    # Decode
    nparr = np.frombuffer(image_bytes, np.uint8)
    tileset = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
    
    if tileset is None:
        raise ValueError("Failed to decode wall tileset")
    
    # Resize if needed
    h, w = tileset.shape[:2]
    if h != total_size or w != total_size:
        print(f"  ⚠️ Resizing from {w}x{h} to {total_size}x{total_size}")
        tileset = cv2.resize(tileset, (total_size, total_size), interpolation=cv2.INTER_NEAREST)
    
    # Validate
    valid, message = validate_wall_tileset(tileset, tile_size)
    print(f"  {'✅' if valid else '⚠️'} {message}")
    
    # Extract tiles
    tiles = extract_wall_tiles(tileset, tile_size)
    
    print(f"✅ Generated {len(tiles)} wall tiles ({tile_size}x{tile_size}px each)")
    
    return WallTilesetResult(
        tileset_image=tileset,
        tile_size=tile_size,
        tile_count=len(tiles),
        individual_tiles=tiles,
        validation_passed=valid,
        validation_message=message,
        background_removal_method="white_removal",
    )


async def generate_wall_tileset_with_matte(
    dna: WallTilesetDNA,
) -> WallTilesetResult:
    """Generate wall tileset with difference matting for true alpha."""
    tile_size = dna.tile_size
    total_size = tile_size * 3
    colors = ", ".join(dna.color_palette)
    
    wall_desc = {
        WallType.CASTLE: "castle stone walls",
        WallType.DUNGEON: "dungeon stone walls",
        WallType.CAVE: "cave rocky walls",
        WallType.BRICK: "brick walls",
    }.get(dna.wall_type, "stone walls")
    
    print(f"🧱 Generating {dna.wall_type.value} wall tileset with DIFFERENCE MATTING...")
    
    # White background version
    white_prompt = f"""Generate a {dna.wall_type.value} wall tileset (3x3 grid, 9 tiles).

IMAGE SIZE: {total_size}x{total_size} pixels
EACH TILE: {tile_size}x{tile_size} pixels
WALL TYPE: {wall_desc}
COLORS: {colors}

CRITICAL: Render on PURE SOLID WHITE (#FFFFFF) background.
Edge/corner tiles show wall transitioning to white void.
Center tile is solid wall texture."""

    white_bytes = await gemini_client.generate_image(
        prompt=white_prompt,
        aspect_ratio="1:1",
    )
    
    if not white_bytes:
        raise ValueError("Failed to generate white background version")
    
    # Edit to black background
    edit_prompt = """Change ONLY the white background areas to pure black (#000000).
Keep all wall artwork exactly the same - same position, same colors.
Only replace white (#FFFFFF) pixels with black (#000000)."""

    print(f"  🖤 Creating BLACK background version...")
    black_bytes = await gemini_client.edit_image_simple(
        image_bytes=white_bytes,
        edit_prompt=edit_prompt,
    )
    
    if not black_bytes:
        print(f"  ⚠️ Failed to create black version, using standard method")
        return await generate_wall_tileset(dna, use_difference_matte=False)
    
    # Compute difference matte
    print(f"  🎨 Computing difference matte...")
    white_arr = np.frombuffer(white_bytes, np.uint8)
    black_arr = np.frombuffer(black_bytes, np.uint8)
    
    white_img = cv2.imdecode(white_arr, cv2.IMREAD_COLOR)
    black_img = cv2.imdecode(black_arr, cv2.IMREAD_COLOR)
    
    if white_img is None or black_img is None:
        return await generate_wall_tileset(dna, use_difference_matte=False)
    
    tileset = compute_difference_matte(white_img, black_img, edge_refinement=True)
    
    # Resize if needed
    h, w = tileset.shape[:2]
    if h != total_size or w != total_size:
        tileset = cv2.resize(tileset, (total_size, total_size), interpolation=cv2.INTER_NEAREST)
    
    # Validate
    valid, message = validate_wall_tileset(tileset, tile_size)
    print(f"  {'✅' if valid else '⚠️'} {message}")
    
    # Extract tiles
    tiles = extract_wall_tiles(tileset, tile_size)
    
    print(f"✅ Generated {len(tiles)} wall tiles with TRUE ALPHA")
    
    return WallTilesetResult(
        tileset_image=tileset,
        tile_size=tile_size,
        tile_count=len(tiles),
        individual_tiles=tiles,
        validation_passed=valid,
        validation_message=message,
        background_removal_method="difference_matte",
    )


def encode_wall_tileset_png(tileset: np.ndarray) -> bytes:
    """Encode wall tileset as PNG bytes."""
    success, buffer = cv2.imencode('.png', tileset)
    if not success:
        raise ValueError("Failed to encode wall tileset")
    return buffer.tobytes()
