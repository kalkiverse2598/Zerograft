"""
Stage 6: Image Generation

Generates 4K grid spritesheet using gemini-3-pro-image-preview.
"""
from typing import Literal
from app.services.gemini_client import gemini_client
from app.models import CharacterDNA, AnimationScript

# Grid dimensions based on frame count
GRID_STRATEGY = {
    4: (2, 2),
    6: (3, 3),  # 6 frames in 3x3 grid (3 empty)
    8: (3, 3),  # 8 frames in 3x3 grid (1 empty)
    9: (3, 3),
    12: (4, 4),  # 12 frames in 4x4 grid (4 empty)
    16: (4, 4),
}


def build_spritesheet_prompt(
    dna: CharacterDNA,
    script: AnimationScript,
    grid_dim: int,
    resolution: int = 4096,
) -> str:
    """Build the image generation prompt for spritesheet."""
    
    # Build frame descriptions
    frame_descriptions = []
    for frame in script.frames:
        frame_descriptions.append(
            f"Frame {frame.frame_index + 1}: [{frame.phase}] {frame.pose_description}"
        )
    
    frames_text = "\n".join(frame_descriptions)
    
    # Build ASCII grid layout
    cell_size = resolution // grid_dim
    grid_visual = []
    frame_num = 1
    for row in range(grid_dim):
        row_str = "|"
        for col in range(grid_dim):
            if frame_num <= len(script.frames):
                row_str += f" F{frame_num} |"
                frame_num += 1
            else:
                row_str += "    |"
        grid_visual.append(row_str)
    grid_ascii = "\n".join(grid_visual)
    
    prompt = f"""Create a pixel art animation spritesheet.

IMAGE SIZE: {resolution}x{resolution} pixels

GRID LAYOUT: {grid_dim} rows × {grid_dim} columns
Each cell is {cell_size}x{cell_size} pixels

{grid_ascii}

CHARACTER:
- Type: {dna.archetype}
- Body: {dna.body_type}
- Colors: {', '.join(dna.dominant_colors)}
- Equipment: {', '.join(dna.equipment)}

ANIMATION: {script.action_type} ({script.difficulty_tier})

FRAMES (one character per cell):
{frames_text}

CRITICAL RULES:
1. WHITE background (#FFFFFF) everywhere - pure white, no grey, no texture
2. ONE character sprite per grid cell
3. Character MUST be the SAME design in ALL frames (same colors, proportions, outfit)
4. Each cell contains ONE frame of the animation
5. Read left-to-right, top-to-bottom: Frame 1 is top-left
6. Pixel art style - crisp pixels, no blur, no anti-aliasing
7. Total frames: {script.frame_count} (remaining cells empty/white)
8. Character SIZE must be IDENTICAL in every frame - same height, same proportions
9. Silhouette must remain readable and consistent across all frames

SPRITE POSITIONING (VERY IMPORTANT):
- Each sprite must be CENTERED in its cell
- Leave at least 50 pixels of WHITE MARGIN on ALL sides (top, bottom, left, right)
- Sprite should occupy ~80% of cell size, with 10% margin on each side
- NO part of the sprite should touch the cell edges
- This margin ensures clean extraction of individual frames

ABSOLUTELY FORBIDDEN:
- NO grid lines, borders, frames, boxes, or dividers between cells
- NO black lines, grey lines, or any colored lines separating the cells  
- NO outlines, halos, or glows around sprites
- NO decorative elements on the background
- Sprites must NOT touch or overlap cell boundaries

Generate a game-ready spritesheet. Background must be PURE WHITE (#FFFFFF). Each sprite must have clear white margins around it.
"""
    return prompt


async def generate_spritesheet(
    reference_image: bytes,
    dna: CharacterDNA,
    script: AnimationScript,
    grid_dim: int,
    resolution: int = 4096,
) -> bytes:
    """
    Generate a spritesheet using gemini-3-pro-image-preview.
    
    Args:
        reference_image: Reference character image for consistency
        dna: Character DNA
        script: Animation script with frame descriptions
        grid_dim: Grid dimension (2, 3, or 4)
        resolution: Output resolution (default 4096x4096)
    
    Returns:
        Generated spritesheet as PNG bytes
    """
    prompt = build_spritesheet_prompt(dna, script, grid_dim, resolution)
    
    # Use reference image for character consistency
    image_bytes = await gemini_client.generate_image(
        prompt=prompt,
        reference_images=[reference_image],
        aspect_ratio="1:1",
    )
    
    return image_bytes
