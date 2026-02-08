"""
Platform Tile Generator

Generates platformer-ready platform tiles with:
- Left end cap
- Center sections (with variations)
- Right end cap
- Single block
- Optional slopes

Designed for side-view 2D platformer games.
"""
import cv2
import numpy as np
from dataclasses import dataclass
from typing import Optional

from app.services.gemini_client import gemini_client
from app.services.difference_matting import compute_difference_matte
from app.models.tileset_dna import (
    PlatformTileDNA, PlatformType, PlatformMaterial,
    PlatformStyle, OutlineStyle,
)


@dataclass
class PlatformTileResult:
    """Result of platform tile generation."""
    strip_image: np.ndarray        # Full horizontal strip
    tile_size: int                 # Size of each tile
    tile_count: int                # Number of tiles generated
    tiles: dict[str, np.ndarray]   # Named tiles: left, center1, center2, center3, right, single
    validation_passed: bool
    validation_message: str
    background_removal_method: str = "white_removal"


# ============================================================================
# Prompt Builder
# ============================================================================

def build_platform_prompt(dna: PlatformTileDNA, background: str = "white") -> str:
    """Build prompt for platform tile generation."""
    tile_size = dna.tile_size
    colors = ", ".join(dna.color_palette)
    
    material_desc = {
        PlatformMaterial.GRASS: "grassy earth platform with grass on top and dirt below",
        PlatformMaterial.STONE: "solid gray stone platform",
        PlatformMaterial.WOOD: "wooden planks platform",
        PlatformMaterial.METAL: "metallic/steel platform with rivets",
        PlatformMaterial.ICE: "icy/frozen platform with slippery surface",
        PlatformMaterial.BRICK: "brick or masonry platform",
        PlatformMaterial.CLOUD: "fluffy white cloud platform",
        PlatformMaterial.CRYSTAL: "translucent crystal platform",
        PlatformMaterial.SAND: "sandy/desert platform",
    }.get(dna.material, "solid platform")
    
    style_desc = {
        PlatformStyle.SOLID: "solid rectangular shape with clear edges",
        PlatformStyle.THIN: "thin platform line, minimal height",
        PlatformStyle.ROUNDED: "rounded, smooth edges",
        PlatformStyle.ANGULAR: "sharp geometric angles",
        PlatformStyle.ORGANIC: "natural, uneven organic edges",
    }.get(dna.platform_style, "solid")
    
    outline_desc = {
        OutlineStyle.NONE: "no outline",
        OutlineStyle.DARK: "1-2px dark outline",
        OutlineStyle.THICK: "thick 2-3px outline",
    }.get(dna.outline_style, "subtle outline")
    
    grass_instruction = ""
    if dna.has_grass_top:
        grass_instruction = "- Add grass/vegetation sprites on top surface (small grass blades)"
    
    bg_color = "#FFFFFF" if background == "white" else "#000000"
    bg_name = "WHITE" if background == "white" else "BLACK"
    
    # Strip layout: 6 tiles horizontal
    strip_width = tile_size * 6
    strip_height = tile_size
    
    prompt = f"""Generate a pixel art PLATFORM TILE SET for a 2D side-scrolling platformer game.

=== IMAGE SIZE ===
TOTAL IMAGE: {strip_width}x{strip_height} pixels
This is a HORIZONTAL STRIP containing 6 tiles arranged left-to-right.
EACH TILE: {tile_size}x{tile_size} pixels

=== PLATFORM TYPE ===
Material: {dna.material.value.upper()} - {material_desc}
Style: {style_desc}
Colors: {colors}

=== TILE LAYOUT (left to right) ===

TILE 1: LEFT END CAP - Rounded left edge
TILE 2-4: CENTER VARIANTS - Middle sections that tile together
TILE 5: RIGHT END CAP - Rounded right edge
TILE 6: SINGLE BLOCK - Standalone small platform

=== CRITICAL RULES ===
1. TOP SURFACE: Clear, flat walkable surface at top
2. SIDE VIEW: Player walks ON TOP of platform
3. CENTER tiles must tile seamlessly with each other
4. END CAPS connect smoothly to CENTER tiles
{grass_instruction}

=== BACKGROUND ===
PURE {bg_name} ({bg_color}) background behind all tiles.

=== PIXEL ART ===
- Crisp {tile_size}x{tile_size} pixels, no blur
- {outline_desc}
- Game-ready quality

Generate a complete {dna.material.value} platform tile set."""

    return prompt


# ============================================================================
# Validation
# ============================================================================

def validate_platform_tiles(
    strip: np.ndarray,
    tile_size: int,
) -> tuple[bool, str]:
    """Validate platform tile strip."""
    h, w = strip.shape[:2]
    expected_width = tile_size * 6
    expected_height = tile_size
    
    if w != expected_width:
        return False, f"Width incorrect: got {w}, expected {expected_width}"
    if h != expected_height:
        return False, f"Height incorrect: got {h}, expected {expected_height}"
    
    # Check that center tiles (2,3,4) have matching edges
    center1 = strip[:, tile_size:tile_size*2]
    center2 = strip[:, tile_size*2:tile_size*3]
    
    # Compare right edge of center1 to left edge of center2
    edge1 = center1[:, -2:]
    edge2 = center2[:, :2]
    diff = np.mean(np.abs(edge1.astype(float) - edge2.astype(float)))
    
    if diff > 50:
        return False, f"Center tiles don't connect well: diff={diff:.1f}"
    
    return True, "Platform tiles validated successfully"


def extract_platform_tiles(
    strip: np.ndarray,
    tile_size: int,
) -> dict[str, np.ndarray]:
    """Extract named platform tiles from strip."""
    tiles = {
        "left_cap": strip[:, 0:tile_size].copy(),
        "center_1": strip[:, tile_size:tile_size*2].copy(),
        "center_2": strip[:, tile_size*2:tile_size*3].copy(),
        "center_3": strip[:, tile_size*3:tile_size*4].copy(),
        "right_cap": strip[:, tile_size*4:tile_size*5].copy(),
        "single": strip[:, tile_size*5:tile_size*6].copy(),
    }
    return tiles


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
    # A pixel is "white" if all BGR channels are >= threshold
    b, g, r, a = cv2.split(image)
    
    # White mask: True where all channels are near white
    white_mask = (b >= threshold) & (g >= threshold) & (r >= threshold)
    
    # Set alpha to 0 for white pixels
    a[white_mask] = 0
    
    # Merge back
    result = cv2.merge([b, g, r, a])
    
    return result


# ============================================================================
# Main Generation Functions
# ============================================================================

async def generate_platform_tiles(
    dna: PlatformTileDNA,
    use_difference_matte: bool = False,
) -> PlatformTileResult:
    """
    Generate a complete set of platformer platform tiles.
    
    Args:
        dna: PlatformTileDNA with platform specifications
        use_difference_matte: Use advanced background removal
    
    Returns:
        PlatformTileResult with tile images and metadata
    """
    if use_difference_matte:
        return await generate_platform_tiles_with_matte(dna)
    
    prompt = build_platform_prompt(dna)
    tile_size = dna.tile_size
    
    print(f"🎮 Generating {dna.material.value} platform tiles...")
    
    # Generate image
    image_bytes = await gemini_client.generate_image(
        prompt=prompt,
        aspect_ratio="6:1",  # Wide aspect for strip
    )
    
    if not image_bytes:
        raise ValueError("Failed to generate platform tiles")
    
    # Decode
    nparr = np.frombuffer(image_bytes, np.uint8)
    strip = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
    
    if strip is None:
        raise ValueError("Failed to decode platform tiles")
    
    # Resize if needed
    expected_width = tile_size * 6
    expected_height = tile_size
    h, w = strip.shape[:2]
    
    if w != expected_width or h != expected_height:
        print(f"  ⚠️ Resizing from {w}x{h} to {expected_width}x{expected_height}")
        strip = cv2.resize(strip, (expected_width, expected_height), interpolation=cv2.INTER_NEAREST)
    
    # 🔧 FIX: Remove white background for transparency
    print(f"  🎨 Removing white background...")
    strip = remove_white_background(strip, threshold=240)
    
    # Validate
    valid, message = validate_platform_tiles(strip, tile_size)
    print(f"  {'✅' if valid else '⚠️'} {message}")
    
    # Extract named tiles
    tiles = extract_platform_tiles(strip, tile_size)
    
    print(f"✅ Generated {len(tiles)} platform tiles ({tile_size}x{tile_size}px each) with transparency")
    
    return PlatformTileResult(
        strip_image=strip,
        tile_size=tile_size,
        tile_count=len(tiles),
        tiles=tiles,
        validation_passed=valid,
        validation_message=message,
        background_removal_method="white_removal",
    )


async def generate_platform_tiles_with_matte(
    dna: PlatformTileDNA,
) -> PlatformTileResult:
    """Generate platform tiles with difference matting for true alpha."""
    tile_size = dna.tile_size
    expected_width = tile_size * 6
    expected_height = tile_size
    
    print(f"🎮 Generating {dna.material.value} platform tiles with DIFFERENCE MATTING...")
    
    # Generate white background version
    white_prompt = build_platform_prompt(dna, background="white")
    
    print(f"  📸 Generating WHITE background version...")
    white_bytes = await gemini_client.generate_image(
        prompt=white_prompt,
        aspect_ratio="6:1",
    )
    
    if not white_bytes:
        raise ValueError("Failed to generate white background version")
    
    # Edit to black background
    edit_prompt = """Change ONLY the white background areas to pure black (#000000).
Keep all platform artwork exactly the same - same position, same colors.
Only replace white (#FFFFFF) pixels with black (#000000) pixels."""

    print(f"  🖤 Creating BLACK background version...")
    black_bytes = await gemini_client.edit_image_simple(
        image_bytes=white_bytes,
        edit_prompt=edit_prompt,
    )
    
    if not black_bytes:
        print(f"  ⚠️ Failed to create black version, using standard method")
        return await generate_platform_tiles(dna, use_difference_matte=False)
    
    # Compute difference matte
    print(f"  🎨 Computing difference matte...")
    white_arr = np.frombuffer(white_bytes, np.uint8)
    black_arr = np.frombuffer(black_bytes, np.uint8)
    
    white_img = cv2.imdecode(white_arr, cv2.IMREAD_COLOR)
    black_img = cv2.imdecode(black_arr, cv2.IMREAD_COLOR)
    
    if white_img is None or black_img is None:
        print(f"  ⚠️ Failed to decode, using standard method")
        return await generate_platform_tiles(dna, use_difference_matte=False)
    
    strip = compute_difference_matte(white_img, black_img, edge_refinement=True)
    
    # Resize if needed
    h, w = strip.shape[:2]
    if w != expected_width or h != expected_height:
        print(f"  ⚠️ Resizing from {w}x{h} to {expected_width}x{expected_height}")
        strip = cv2.resize(strip, (expected_width, expected_height), interpolation=cv2.INTER_NEAREST)
    
    # Validate
    valid, message = validate_platform_tiles(strip, tile_size)
    print(f"  {'✅' if valid else '⚠️'} {message}")
    
    # Extract named tiles
    tiles = extract_platform_tiles(strip, tile_size)
    
    print(f"✅ Generated {len(tiles)} platform tiles with TRUE ALPHA")
    
    return PlatformTileResult(
        strip_image=strip,
        tile_size=tile_size,
        tile_count=len(tiles),
        tiles=tiles,
        validation_passed=valid,
        validation_message=message,
        background_removal_method="difference_matte",
    )


def encode_platform_strip_png(strip: np.ndarray) -> bytes:
    """Encode platform strip as PNG bytes."""
    success, buffer = cv2.imencode('.png', strip)
    if not success:
        raise ValueError("Failed to encode platform strip")
    return buffer.tobytes()
