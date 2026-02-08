"""
Decoration/Prop Generator

Generates single decoration sprites and props for game environments.
Includes:
- Crates, barrels, pots
- Signs, lamps, torches
- Bushes, rocks, flowers
- Chests, graves, statues
- With optional variations
"""
import cv2
import numpy as np
from dataclasses import dataclass
from typing import Optional

from app.services.gemini_client import gemini_client
from app.services.difference_matting import compute_difference_matte
from app.models.tileset_dna import (
    DecorationTileDNA, DecorationType, Perspective,
)


@dataclass
class DecorationResult:
    """Result of decoration generation."""
    sprite_image: np.ndarray       # Main sprite (or strip if variations)
    sprite_size: tuple[int, int]   # Width x Height
    variation_count: int
    variations: list[np.ndarray]   # Individual variation sprites
    validation_passed: bool
    validation_message: str
    background_removal_method: str = "white_removal"


def get_decoration_description(decoration_type: DecorationType) -> tuple[str, str]:
    """Get description and size hint for decoration type."""
    descriptions = {
        DecorationType.CRATE: ("wooden crate or box", "square container"),
        DecorationType.BARREL: ("wooden barrel", "cylindrical container"),
        DecorationType.SIGN: ("wooden sign post", "tall vertical sign"),
        DecorationType.BUSH: ("green leafy bush", "round organic shape"),
        DecorationType.TREE: ("tree or large plant", "tall with branches"),
        DecorationType.ROCK: ("stone boulder or rock", "irregular rock shape"),
        DecorationType.CHEST: ("treasure chest", "rectangular with lid"),
        DecorationType.POT: ("ceramic pot or vase", "round vessel"),
        DecorationType.LAMP: ("street lamp or lantern", "tall post with light"),
        DecorationType.FENCE: ("wooden fence section", "horizontal barrier"),
        DecorationType.GRAVE: ("gravestone or tombstone", "vertical stone marker"),
        DecorationType.STATUE: ("stone statue", "figure on pedestal"),
        DecorationType.MUSHROOM: ("large mushroom", "organic fungus shape"),
        DecorationType.FLOWER: ("flower or small plant", "colorful plant"),
        DecorationType.CUSTOM: ("decorative object", "custom prop"),
    }
    return descriptions.get(decoration_type, ("decorative object", "prop"))


def build_decoration_prompt(dna: DecorationTileDNA) -> str:
    """Build prompt for decoration sprite generation."""
    desc, shape = get_decoration_description(dna.decoration_type)
    colors = ", ".join(dna.color_palette)
    
    # Parse size
    size_parts = dna.size.split("x")
    width = int(size_parts[0])
    height = int(size_parts[1]) if len(size_parts) > 1 else width
    
    var_count = dna.variation_count
    total_width = width * var_count
    
    perspective_desc = {
        Perspective.SIDE_VIEW: "viewed from the SIDE (platformer perspective)",
        Perspective.TOP_DOWN: "viewed from ABOVE (top-down perspective)",
        Perspective.THREE_QUARTER: "viewed at a 3/4 angle (slight top-down)",
    }.get(dna.perspective, "side view")
    
    shadow_instruction = ""
    if dna.has_shadow:
        shadow_instruction = "- Include a small drop shadow beneath the object"
    
    if var_count > 1:
        # Build variation layout string outside f-string (Python 3.11 compatibility)
        variation_lines = []
        for i in range(var_count):
            variation_lines.append(f"Variation {i+1} (x={i*width} to {(i+1)*width}): Slightly different {dna.decoration_type.value}")
        variation_layout = "\n".join(variation_lines)
        
        prompt = f"""Generate {var_count} VARIATIONS of a pixel art {desc} in a horizontal strip.

IMAGE SIZE: {total_width}x{height} pixels
LAYOUT: {var_count} sprites arranged left-to-right
EACH SPRITE: {width}x{height} pixels

OBJECT: {dna.decoration_type.value.upper()} - {desc}
COLORS: {colors}
PERSPECTIVE: {perspective_desc}

=== VARIATION LAYOUT ===

The image contains {var_count} variations of the same object type:

{variation_layout}

Each variation should be the same type of object but with minor differences
(different angle, different details, different wear, etc.)

=== SPRITE RULES ===
- Pure pixel art style, crisp edges
- Each sprite centered in its {width}x{height} area
- PURE WHITE (#FFFFFF) background for transparency
- Object should be clearly defined and recognizable
- {perspective_desc}
{shadow_instruction}

=== QUALITY ===
- Game-ready decoration sprites
- Consistent style across all variations
- Suitable for placing in 2D game environments

Generate {var_count} variations of {dna.decoration_type.value} decorations."""
    else:
        prompt = f"""Generate a single pixel art {desc} sprite.

IMAGE SIZE: {width}x{height} pixels
OBJECT: {dna.decoration_type.value.upper()} - {desc}
COLORS: {colors}
PERSPECTIVE: {perspective_desc}

=== SPRITE RULES ===
- Pure pixel art style, crisp edges
- Sprite centered in the image
- PURE WHITE (#FFFFFF) background for transparency
- Object should be clearly defined and recognizable
- {perspective_desc}
{shadow_instruction}

=== QUALITY ===
- Game-ready decoration sprite
- Suitable for placing in 2D game environments

Generate a {dna.decoration_type.value} decoration sprite."""

    return prompt


def parse_size(size_str: str) -> tuple[int, int]:
    """Parse size string like '32x32' to (width, height)."""
    parts = size_str.split("x")
    width = int(parts[0])
    height = int(parts[1]) if len(parts) > 1 else width
    return width, height


def extract_variations(
    strip: np.ndarray,
    width: int,
    count: int,
) -> list[np.ndarray]:
    """Extract individual variation sprites from strip."""
    variations = []
    for i in range(count):
        x = i * width
        variations.append(strip[:, x:x+width].copy())
    return variations


async def generate_decoration(
    dna: DecorationTileDNA,
    use_difference_matte: bool = False,
) -> DecorationResult:
    """
    Generate decoration/prop sprites.
    
    Args:
        dna: DecorationTileDNA with decoration specifications
        use_difference_matte: Use advanced background removal
    
    Returns:
        DecorationResult with sprite(s)
    """
    width, height = parse_size(dna.size)
    var_count = dna.variation_count
    total_width = width * var_count
    
    print(f"🎨 Generating {dna.decoration_type.value} decoration ({var_count} variation(s))...")
    
    if use_difference_matte:
        return await generate_decoration_with_matte(dna)
    
    # Standard generation
    prompt = build_decoration_prompt(dna)
    
    # Calculate aspect ratio
    if var_count > 1:
        aspect = f"{var_count}:1"
    else:
        aspect = "1:1" if width == height else f"{width}:{height}"
    
    image_bytes = await gemini_client.generate_image(
        prompt=prompt,
        aspect_ratio=aspect,
    )
    
    if not image_bytes:
        raise ValueError("Failed to generate decoration")
    
    # Decode
    nparr = np.frombuffer(image_bytes, np.uint8)
    sprite = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
    
    if sprite is None:
        raise ValueError("Failed to decode decoration sprite")
    
    # Resize if needed
    h, w = sprite.shape[:2]
    if w != total_width or h != height:
        print(f"  ⚠️ Resizing from {w}x{h} to {total_width}x{height}")
        sprite = cv2.resize(sprite, (total_width, height), interpolation=cv2.INTER_NEAREST)
    
    # Extract variations
    variations = extract_variations(sprite, width, var_count)
    
    print(f"✅ Generated {len(variations)} {dna.decoration_type.value} sprite(s)")
    
    return DecorationResult(
        sprite_image=sprite,
        sprite_size=(width, height),
        variation_count=len(variations),
        variations=variations,
        validation_passed=True,
        validation_message="Decoration generated successfully",
        background_removal_method="white_removal",
    )


async def generate_decoration_with_matte(
    dna: DecorationTileDNA,
) -> DecorationResult:
    """Generate decoration with difference matting for true alpha."""
    width, height = parse_size(dna.size)
    var_count = dna.variation_count
    total_width = width * var_count
    colors = ", ".join(dna.color_palette)
    
    desc, _ = get_decoration_description(dna.decoration_type)
    
    print(f"🎨 Generating {dna.decoration_type.value} with DIFFERENCE MATTING...")
    
    # White background version
    white_prompt = f"""Generate {var_count} pixel art {desc} sprite(s).

IMAGE SIZE: {total_width}x{height} pixels
{"LAYOUT: " + str(var_count) + " sprites left-to-right" if var_count > 1 else "Single sprite"}
COLORS: {colors}

CRITICAL: Render on PURE SOLID WHITE (#FFFFFF) background.
The object should be centered with flat white surrounding it."""

    aspect = f"{var_count}:1" if var_count > 1 else "1:1"
    
    white_bytes = await gemini_client.generate_image(
        prompt=white_prompt,
        aspect_ratio=aspect,
    )
    
    if not white_bytes:
        raise ValueError("Failed to generate white background version")
    
    # Edit to black
    edit_prompt = """Change ONLY the white background to pure black (#000000).
Keep the object exactly the same - same position, same colors.
Only replace white pixels with black pixels."""

    print(f"  🖤 Creating BLACK background version...")
    black_bytes = await gemini_client.edit_image_simple(
        image_bytes=white_bytes,
        edit_prompt=edit_prompt,
    )
    
    if not black_bytes:
        print(f"  ⚠️ Failed, using standard method")
        return await generate_decoration(dna, use_difference_matte=False)
    
    # Compute difference matte
    print(f"  🎨 Computing difference matte...")
    white_arr = np.frombuffer(white_bytes, np.uint8)
    black_arr = np.frombuffer(black_bytes, np.uint8)
    
    white_img = cv2.imdecode(white_arr, cv2.IMREAD_COLOR)
    black_img = cv2.imdecode(black_arr, cv2.IMREAD_COLOR)
    
    if white_img is None or black_img is None:
        return await generate_decoration(dna, use_difference_matte=False)
    
    sprite = compute_difference_matte(white_img, black_img, edge_refinement=True)
    
    # Resize if needed
    h, w = sprite.shape[:2]
    if w != total_width or h != height:
        sprite = cv2.resize(sprite, (total_width, height), interpolation=cv2.INTER_NEAREST)
    
    # Extract variations
    variations = extract_variations(sprite, width, var_count)
    
    print(f"✅ Generated {len(variations)} {dna.decoration_type.value} sprite(s) with TRUE ALPHA")
    
    return DecorationResult(
        sprite_image=sprite,
        sprite_size=(width, height),
        variation_count=len(variations),
        variations=variations,
        validation_passed=True,
        validation_message="Decoration generated with difference matting",
        background_removal_method="difference_matte",
    )


def encode_decoration_png(sprite: np.ndarray) -> bytes:
    """Encode decoration sprite as PNG bytes."""
    success, buffer = cv2.imencode('.png', sprite)
    if not success:
        raise ValueError("Failed to encode decoration")
    return buffer.tobytes()
