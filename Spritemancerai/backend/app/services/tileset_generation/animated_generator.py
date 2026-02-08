"""
Animated Tile Generator (Enhanced)

Generates seamless animated tile strips for environmental effects.
Improved from original with better prompting and validation.

Tile types:
- Water (waves, ripples)
- Lava (flow, bubbles)
- Fire (flames, flickering)
- Crystal (pulsing glow)
- Waterfall (flowing down)
- Smoke (rising, dissipating)
- Electric (sparks, arcs)
"""
import cv2
import numpy as np
from dataclasses import dataclass
from typing import Optional

from app.services.gemini_client import gemini_client
from app.services.seamless_validation import validate_and_fix_seamless
from app.models.tileset_dna import (
    AnimatedTileDNA, AnimatedTileType, AnimationStyle, SeamlessMode,
)


@dataclass
class AnimatedTileResult:
    """Result of animated tile generation."""
    strip_image: np.ndarray        # Full animation strip
    tile_size: int
    frame_count: int
    frames: list[np.ndarray]       # Individual frames
    is_seamless: bool
    seamless_score: float
    validation_message: str


# ============================================================================
# Prompt Builders
# ============================================================================

def get_animation_description(tile_type: AnimatedTileType, style: AnimationStyle) -> str:
    """Get detailed animation description for the tile type."""
    descriptions = {
        AnimatedTileType.WATER: {
            AnimationStyle.WAVE: "gentle water waves rippling across surface, subtle light reflections moving",
            AnimationStyle.FLOW: "water flowing smoothly in one direction, consistent movement",
            AnimationStyle.BUBBLE: "calm water surface with occasional bubbles rising",
        },
        AnimatedTileType.LAVA: {
            AnimationStyle.FLOW: "molten lava flowing slowly, glowing orange-red surface shifting",
            AnimationStyle.BUBBLE: "bubbling lava with pockets of gas popping, bright spots appearing",
            AnimationStyle.PULSE: "lava surface pulsing brighter and dimmer with heat",
        },
        AnimatedTileType.FIRE: {
            AnimationStyle.FLICKER: "flames flickering rapidly, bright yellow-orange dancing tips",
            AnimationStyle.PULSE: "fire glowing brighter and dimmer rhythmically",
            AnimationStyle.WAVE: "flames swaying left and right gently",
        },
        AnimatedTileType.CRYSTAL: {
            AnimationStyle.PULSE: "crystal glowing brighter and dimmer with inner light",
            AnimationStyle.SPARKLE: "tiny sparkles moving across crystal surface",
        },
        AnimatedTileType.WATERFALL: {
            AnimationStyle.FLOW: "water rushing downward continuously, white foam patterns shifting",
        },
        AnimatedTileType.SMOKE: {
            AnimationStyle.FLOW: "smoke rising upward slowly, wisps shifting and fading",
            AnimationStyle.WAVE: "smoke drifting and swirling gently",
        },
        AnimatedTileType.ELECTRICITY: {
            AnimationStyle.FLICKER: "electric sparks crackling randomly, bright flashes",
            AnimationStyle.PULSE: "electrical glow pulsing with energy",
        },
        AnimatedTileType.TORCH: {
            AnimationStyle.FLICKER: "torch flame dancing unpredictably, casting moving light",
        },
        AnimatedTileType.GRASS_WIND: {
            AnimationStyle.SWAY: "grass blades swaying gently side-to-side in the wind",
            AnimationStyle.WAVE: "grass moving in wave patterns as wind passes through",
        },
        AnimatedTileType.PORTAL: {
            AnimationStyle.PULSE: "portal energy swirling and pulsing with otherworldly light",
            AnimationStyle.SPARKLE: "magical particles spiraling around portal center",
        },
    }
    
    type_desc = descriptions.get(tile_type, {})
    return type_desc.get(style, f"{tile_type.value} with {style.value} animation")


def build_animated_tile_prompt(dna: AnimatedTileDNA) -> str:
    """Build prompt for animated tile generation."""
    tile_size = dna.tile_size
    frame_count = dna.frame_count
    strip_width = tile_size * frame_count
    colors = ", ".join(dna.color_palette)
    
    animation_desc = get_animation_description(dna.tile_type, dna.animation_style)
    
    glow_instruction = ""
    if dna.glow_intensity > 0:
        glow_instruction = f"- Add glowing effect with intensity {int(dna.glow_intensity * 100)}%"
    
    seamless_desc = {
        SeamlessMode.HORIZONTAL: "LEFT edge must match RIGHT edge exactly (horizontal tiling)",
        SeamlessMode.VERTICAL: "TOP edge must match BOTTOM edge exactly (vertical tiling)",
        SeamlessMode.BOTH: "ALL edges must match (tiles in all directions)",
        SeamlessMode.LOOP_ONLY: "Animation must loop smoothly (last frame connects to first)",
    }.get(dna.seamless_mode, "tiles seamlessly")
    
    prompt = f"""Generate a pixel art ANIMATED TILE sprite sheet.

=== IMAGE SPECIFICATIONS ===
TOTAL IMAGE: {strip_width}x{tile_size} pixels (horizontal strip)
FRAMES: {frame_count} frames arranged left-to-right
EACH FRAME: {tile_size}x{tile_size} pixels

=== TILE TYPE ===
Type: {dna.tile_type.value.upper()}
Animation: {dna.animation_style.value.upper()} - {animation_desc}
Colors: {colors}
{glow_instruction}

=== FRAME LAYOUT ===

Frame 1 (x=0 to {tile_size}): Starting/base frame
Frame 2 (x={tile_size} to {tile_size*2}): Animation progresses...
...
Frame {frame_count} (x={tile_size*(frame_count-1)} to {strip_width}): Final frame before loop

Animation should progress smoothly from Frame 1 through Frame {frame_count}, 
then loop perfectly back to Frame 1.

=== SEAMLESS REQUIREMENTS ===
{seamless_desc}

For the animation to look natural when tiled:
1. Each frame must tile seamlessly with copies of itself
2. The animation must loop smoothly (Frame {frame_count} → Frame 1)
3. Subtle, organic animation - not too drastic frame-to-frame

=== ANIMATION TIMING ===
Speed: {dna.animation_speed.upper()}
- SLOW: Very subtle changes between frames
- MEDIUM: Noticeable but smooth motion
- FAST: Quick, energetic animation

=== PIXEL ART RULES ===
- Pure pixel art - crisp {tile_size}x{tile_size} grid
- No anti-aliasing, no blur
- Consistent style across all frames
- Game-ready for environmental backgrounds

=== BACKGROUND ===
{f'PURE WHITE (#FFFFFF) background for transparency extraction' if dna.tile_type not in [AnimatedTileType.WATER, AnimatedTileType.LAVA] else 'Full coverage - the entire tile should be the animated element'}

Generate a smooth, looping animated {dna.tile_type.value} tile strip."""

    return prompt


# ============================================================================
# Frame Extraction & Validation
# ============================================================================

def extract_frames(
    strip: np.ndarray,
    tile_size: int,
    frame_count: int,
) -> list[np.ndarray]:
    """Extract individual frames from animation strip."""
    frames = []
    for i in range(frame_count):
        x = i * tile_size
        frame = strip[:, x:x+tile_size].copy()
        frames.append(frame)
    return frames


def validate_animation_loop(frames: list[np.ndarray]) -> tuple[bool, float, str]:
    """
    Validate that animation loops smoothly.
    
    Compares first and last frames for similarity.
    """
    if len(frames) < 2:
        return False, 0.0, "Not enough frames"
    
    first = frames[0].astype(float)
    last = frames[-1].astype(float)
    
    # Calculate similarity
    diff = np.mean(np.abs(first - last))
    similarity = max(0, 100 - diff)
    
    # For a good loop, frames shouldn't be identical but should be similar
    if similarity > 95:
        return True, similarity, "Animation loops well (very similar start/end)"
    elif similarity > 70:
        return True, similarity, "Animation loops reasonably well"
    else:
        return False, similarity, f"Animation may not loop smoothly (similarity={similarity:.1f}%)"


# ============================================================================
# Main Generation Function
# ============================================================================

async def generate_animated_tile(
    dna: AnimatedTileDNA,
    auto_fix_seamless: bool = True,
) -> AnimatedTileResult:
    """
    Generate an animated environment tile.
    
    Args:
        dna: AnimatedTileDNA with tile specifications
        auto_fix_seamless: Try to automatically fix seamless issues
    
    Returns:
        AnimatedTileResult with animation frames and metadata
    """
    prompt = build_animated_tile_prompt(dna)
    tile_size = dna.tile_size
    frame_count = dna.frame_count
    
    print(f"🌊 Generating animated {dna.tile_type.value} tile ({frame_count} frames)...")
    
    # Calculate aspect ratio
    width_ratio = frame_count
    aspect = f"{width_ratio}:1"
    
    # Generate image
    image_bytes = await gemini_client.generate_image(
        prompt=prompt,
        aspect_ratio=aspect,
    )
    
    if not image_bytes:
        raise ValueError(f"Failed to generate {dna.tile_type.value} tile")
    
    # Apply seamless validation/fix if enabled
    seamless_result = None
    if auto_fix_seamless:
        axis = {
            SeamlessMode.HORIZONTAL: "horizontal",
            SeamlessMode.VERTICAL: "vertical",
            SeamlessMode.BOTH: "both",
            SeamlessMode.LOOP_ONLY: "horizontal",  # Check first frame against last
        }.get(dna.seamless_mode, "horizontal")
        
        image_bytes, seamless_result = validate_and_fix_seamless(
            image_bytes,
            axis=axis,
            auto_fix=True,
            threshold=80.0,
        )
    
    # Decode
    nparr = np.frombuffer(image_bytes, np.uint8)
    strip = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
    
    if strip is None:
        raise ValueError("Failed to decode animated tile")
    
    # Resize if needed
    expected_width = tile_size * frame_count
    expected_height = tile_size
    h, w = strip.shape[:2]
    
    if w != expected_width or h != expected_height:
        print(f"  ⚠️ Resizing from {w}x{h} to {expected_width}x{expected_height}")
        strip = cv2.resize(strip, (expected_width, expected_height), interpolation=cv2.INTER_NEAREST)
    
    # Extract frames
    frames = extract_frames(strip, tile_size, frame_count)
    
    # Validate loop
    loop_valid, loop_score, loop_message = validate_animation_loop(frames)
    
    # Get seamless score
    seamless_score = 100.0
    is_seamless = True
    if seamless_result:
        is_seamless = bool(seamless_result.is_seamless)
        seamless_score = float(seamless_result.overall_score)
    
    validation_message = f"Loop: {loop_message}. Seamless: {seamless_score:.0f}%"
    print(f"  {'✅' if loop_valid and is_seamless else '⚠️'} {validation_message}")
    
    print(f"✅ Generated {len(frames)} animation frames ({tile_size}x{tile_size}px each)")
    
    return AnimatedTileResult(
        strip_image=strip,
        tile_size=tile_size,
        frame_count=len(frames),
        frames=frames,
        is_seamless=is_seamless,
        seamless_score=seamless_score,
        validation_message=validation_message,
    )


def encode_animation_strip_png(strip: np.ndarray) -> bytes:
    """Encode animation strip as PNG bytes."""
    success, buffer = cv2.imencode('.png', strip)
    if not success:
        raise ValueError("Failed to encode animation strip")
    return buffer.tobytes()
