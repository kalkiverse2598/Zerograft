"""
Transition Tile Generator

Generates tiles that blend between two terrain types.
Useful for natural terrain borders (grass→dirt, sand→water, etc.)

Generates 8 transition tiles:
- 4 edge transitions (top, bottom, left, right)
- 4 corner transitions (TL, TR, BL, BR)
"""
import cv2
import numpy as np
from dataclasses import dataclass
from typing import Optional

from app.services.gemini_client import gemini_client
from app.services.difference_matting import compute_difference_matte
from app.models.tileset_dna import TransitionTileDNA, TransitionStyle


@dataclass
class TransitionTileResult:
    """Result of transition tile generation."""
    tileset_image: np.ndarray      # 2x4 grid = 8 tiles
    tile_size: int
    tile_count: int
    from_terrain: str
    to_terrain: str
    individual_tiles: list[np.ndarray]
    tile_names: list[str]
    validation_passed: bool
    validation_message: str
    background_removal_method: str = "none"  # Usually no bg removal needed


def build_transition_prompt(dna: TransitionTileDNA) -> str:
    """Build prompt for transition tile generation (2x4 grid = 8 tiles)."""
    tile_size = dna.tile_size
    total_width = tile_size * 4
    total_height = tile_size * 2
    
    from_colors = ", ".join(dna.from_palette)
    to_colors = ", ".join(dna.to_palette)
    
    style_desc = {
        TransitionStyle.HARD_EDGE: "sharp, clean boundary between terrains",
        TransitionStyle.SOFT_BLEND: "smooth gradient blending between terrains",
        TransitionStyle.SCATTERED: "scattered pixels creating a natural blend",
        TransitionStyle.DITHERED: "dithering pattern for retro-style blend",
        TransitionStyle.ORGANIC: "natural, irregular organic edge",
    }.get(dna.transition_style, "natural blend")
    
    prompt = f"""Generate pixel art TERRAIN TRANSITION tiles that blend {dna.from_terrain.upper()} into {dna.to_terrain.upper()}.

IMAGE SIZE: {total_width}x{total_height} pixels
GRID: 2 rows × 4 columns = 8 TILES
EACH TILE: {tile_size}x{tile_size} pixels

FROM TERRAIN: {dna.from_terrain.upper()}
  Colors: {from_colors}

TO TERRAIN: {dna.to_terrain.upper()}
  Colors: {to_colors}

TRANSITION STYLE: {style_desc}

=== TILE LAYOUT (2 rows × 4 columns) ===

Row 1 (y=0 to {tile_size}) - EDGE TRANSITIONS:
- Tile 1: TOP EDGE - {dna.from_terrain} at bottom, {dna.to_terrain} at top
- Tile 2: BOTTOM EDGE - {dna.from_terrain} at top, {dna.to_terrain} at bottom
- Tile 3: LEFT EDGE - {dna.from_terrain} on right, {dna.to_terrain} on left
- Tile 4: RIGHT EDGE - {dna.from_terrain} on left, {dna.to_terrain} on right

Row 2 (y={tile_size} to {total_height}) - CORNER TRANSITIONS:
- Tile 5: TOP-LEFT CORNER - {dna.from_terrain} in bottom-right, {dna.to_terrain} in top-left
- Tile 6: TOP-RIGHT CORNER - {dna.from_terrain} in bottom-left, {dna.to_terrain} in top-right
- Tile 7: BOTTOM-LEFT CORNER - {dna.from_terrain} in top-right, {dna.to_terrain} in bottom-left
- Tile 8: BOTTOM-RIGHT CORNER - {dna.from_terrain} in top-left, {dna.to_terrain} in bottom-right

=== TRANSITION RULES ===
- Each tile shows a GRADUAL transition from one terrain to the other
- The transition should be {style_desc}
- No pure white or black background - tiles are fully covered by the two terrains
- Transitions should look natural and game-ready
- Edge transitions should tile with both terrain types

=== PIXEL ART RULES ===
- Pure pixel art, {tile_size}px tiles
- No anti-aliasing
- Consistent style matching both terrain types
- Game-ready for terrain border placement

Generate transition tiles from {dna.from_terrain} to {dna.to_terrain}."""

    return prompt


def extract_transition_tiles(
    tileset: np.ndarray,
    tile_size: int,
) -> tuple[list[np.ndarray], list[str]]:
    """Extract individual transition tiles with names."""
    names = [
        "edge_top", "edge_bottom", "edge_left", "edge_right",
        "corner_tl", "corner_tr", "corner_bl", "corner_br",
    ]
    tiles = []
    
    for row in range(2):
        for col in range(4):
            x = col * tile_size
            y = row * tile_size
            tiles.append(tileset[y:y+tile_size, x:x+tile_size].copy())
    
    return tiles, names


def validate_transition_tileset(
    tileset: np.ndarray,
    tile_size: int,
) -> tuple[bool, str]:
    """Validate transition tileset."""
    h, w = tileset.shape[:2]
    expected_width = tile_size * 4
    expected_height = tile_size * 2
    
    if w != expected_width or h != expected_height:
        return False, f"Size mismatch: got {w}x{h}, expected {expected_width}x{expected_height}"
    
    return True, "Transition tileset validated"


async def generate_transition_tiles(
    dna: TransitionTileDNA,
) -> TransitionTileResult:
    """
    Generate terrain transition tiles.
    
    Args:
        dna: TransitionTileDNA with terrain specifications
    
    Returns:
        TransitionTileResult with 8 transition tiles
    """
    tile_size = dna.tile_size
    total_width = tile_size * 4
    total_height = tile_size * 2
    
    print(f"🔄 Generating {dna.from_terrain}→{dna.to_terrain} transition tiles...")
    
    prompt = build_transition_prompt(dna)
    
    image_bytes = await gemini_client.generate_image(
        prompt=prompt,
        aspect_ratio="2:1",  # 4 tiles wide x 2 tiles tall
    )
    
    if not image_bytes:
        raise ValueError("Failed to generate transition tiles")
    
    # Decode
    nparr = np.frombuffer(image_bytes, np.uint8)
    tileset = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
    
    if tileset is None:
        raise ValueError("Failed to decode transition tileset")
    
    # Resize if needed
    h, w = tileset.shape[:2]
    if w != total_width or h != total_height:
        print(f"  ⚠️ Resizing from {w}x{h} to {total_width}x{total_height}")
        tileset = cv2.resize(tileset, (total_width, total_height), interpolation=cv2.INTER_NEAREST)
    
    # Validate
    valid, message = validate_transition_tileset(tileset, tile_size)
    print(f"  {'✅' if valid else '⚠️'} {message}")
    
    # Extract tiles
    tiles, names = extract_transition_tiles(tileset, tile_size)
    
    print(f"✅ Generated {len(tiles)} transition tiles ({dna.from_terrain}→{dna.to_terrain})")
    
    return TransitionTileResult(
        tileset_image=tileset,
        tile_size=tile_size,
        tile_count=len(tiles),
        from_terrain=dna.from_terrain,
        to_terrain=dna.to_terrain,
        individual_tiles=tiles,
        tile_names=names,
        validation_passed=valid,
        validation_message=message,
        background_removal_method="none",
    )


def encode_transition_tileset_png(tileset: np.ndarray) -> bytes:
    """Encode transition tileset as PNG bytes."""
    success, buffer = cv2.imencode('.png', tileset)
    if not success:
        raise ValueError("Failed to encode transition tileset")
    return buffer.tobytes()
