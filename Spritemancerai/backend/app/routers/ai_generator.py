"""
AI Asset Generator endpoints.
Generates game assets (characters, effects, tiles, UI) from text descriptions using Gemini.
This enables fully autonomous asset creation without manual image upload.
"""
from fastapi import APIRouter, HTTPException, File, UploadFile, Form
from pydantic import BaseModel
from typing import Optional, Literal
import uuid
import base64
import io
import cv2
import numpy as np
from PIL import Image

from app.services.gemini_client import gemini_client
from app.db.supabase_client import supabase_service
from app.models import (
    EffectDNA, TileDNA, UIElementDNA, BackgroundDNA,
    EFFECT_DNA_SCHEMA, TILE_DNA_SCHEMA, UI_ELEMENT_DNA_SCHEMA, BACKGROUND_DNA_SCHEMA,
)
from app.services.asset_presets import (
    EFFECT_PRESETS, TILE_PRESETS, UI_PRESETS, CHARACTER_STYLE_PRESETS, BACKGROUND_PRESETS,
    get_effect_preset, get_tile_preset, get_ui_preset, get_background_preset, list_presets,
)
from app.services.stages.stage_7_post_processing import (
    remove_white_background,
    remove_background_adaptive,
    make_sprite_transparent,
)

router = APIRouter()


# ============================================================================
# Request/Response Models
# ============================================================================

class GenerateCharacterRequest(BaseModel):
    """Request model for generating a character reference."""
    description: str
    size: str = "32x32"  # 16x16, 32x32, 64x64, 128x128
    perspective: str = "side"  # side, front, isometric, top_down
    style: str = "modern_pixel"  # 8bit_retro, 16bit_snes, modern_pixel, hd_pixel
    auto_extract_dna: bool = True
    remove_background: bool = True  # Apply background removal


class GenerateEffectRequest(BaseModel):
    """Request model for generating VFX effect sprites."""
    prompt: Optional[str] = None  # Text description (optional if using preset)
    preset: Optional[str] = None  # Preset name (e.g., "fire_explosion")
    frame_count: int = 6
    size: str = "64x64"
    remove_background: bool = True


class GenerateTileRequest(BaseModel):
    """Request model for generating animated tiles."""
    prompt: Optional[str] = None
    preset: Optional[str] = None
    frame_count: int = 4
    size: str = "32x32"
    seamless: bool = True
    remove_background: bool = False  # Tiles usually keep background


class GenerateUIElementRequest(BaseModel):
    """Request model for generating UI element sprites."""
    prompt: Optional[str] = None
    preset: Optional[str] = None
    frame_count: int = 6
    size: str = "16x16"
    remove_background: bool = True


class GenerateBackgroundRequest(BaseModel):
    """Request model for generating game backgrounds."""
    prompt: Optional[str] = None
    preset: Optional[str] = None
    parallax_layer: Literal["far", "mid", "near", "full", "pack"] = "full"  # "pack" = all 3 layers
    time_of_day: Literal["day", "night", "sunset", "sunrise", "twilight"] = "day"
    size: str = "320x180"  # 320x180, 480x270, 640x360
    animated: bool = False  # Animated clouds, water, etc.
    use_difference_matte: bool = True  # Use difference matting for true alpha (generates 2 images per layer)


class UnifiedAssetRequest(BaseModel):
    """Unified request for any asset type."""
    asset_type: Literal["character", "effect", "tile", "ui", "background"]
    prompt: str
    preset: Optional[str] = None
    size: str = "32x32"
    frame_count: int = 6
    style: str = "modern_pixel"
    perspective: str = "side"
    remove_background: bool = True


# ============================================================================
# Helper Functions
# ============================================================================

def get_style_prompt_additions(style: str) -> str:
    """Get additional prompt text for a style preset."""
    style_config = CHARACTER_STYLE_PRESETS.get(style, CHARACTER_STYLE_PRESETS["modern_pixel"])
    additions = []
    if style_config.get("color_limit"):
        additions.append(f"limited to {style_config['color_limit']} colors")
    if style_config.get("outline"):
        additions.append("with clean pixel outlines")
    if not style_config.get("dithering"):
        additions.append("no dithering")
    return ", ".join(additions) if additions else ""


def apply_background_removal(image_bytes: bytes, method: str = "white", threshold: int = 240) -> bytes:
    """
    Apply background removal to image bytes.
    
    Args:
        image_bytes: PNG image bytes
        method: "white" for white background, "adaptive" for auto-detect, "checkered" for AI fake transparency
        threshold: Threshold for white detection
    
    Returns:
        PNG bytes with transparent background
    """
    # Convert bytes to numpy array
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
    
    if image is None:
        print("⚠️ Failed to decode image for background removal")
        return image_bytes
    
    # Apply background removal based on method
    if method == "white":
        result = remove_white_background(image, threshold=threshold)
    elif method == "adaptive":
        result = remove_background_adaptive(image)
    elif method == "checkered":
        # Remove AI-generated fake checkered transparency pattern
        result = remove_checkered_pattern(image, threshold=threshold)
    else:
        result = make_sprite_transparent(image, method=method)
    
    # Convert back to PNG bytes
    success, encoded = cv2.imencode('.png', result)
    if success:
        print(f"✨ Background removed ({method} method)")
        return encoded.tobytes()
    
    return image_bytes


def remove_checkered_pattern(image: np.ndarray, threshold: int = 30) -> np.ndarray:
    """
    Remove AI-generated fake checkered transparency patterns.
    
    AI image generators often render a gray/white checkerboard instead of actual alpha.
    This function detects those EXACT checkerboard patterns and makes them truly transparent.
    
    IMPORTANT: Only removes pixels that are part of a true alternating checkerboard pattern,
    NOT any gray pixels that might be part of actual artwork.
    
    Args:
        image: Input image (BGR or BGRA)
        threshold: Color tolerance for matching checkerboard colors
    
    Returns:
        BGRA image with checkered areas made transparent
    """
    # Ensure BGRA format
    if len(image.shape) == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGRA)
    elif image.shape[2] == 3:
        image = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
    
    result = image.copy()
    height, width = image.shape[:2]
    
    # Known AI checkerboard color pairs (BGR format)
    # These are the EXACT colors used by various AI image generators
    checkerboard_pairs = [
        # (color1, color2) - the two alternating colors
        ((34, 34, 34), (51, 51, 51)),      # #222 and #333 - very common dark checker
        ((51, 51, 51), (68, 68, 68)),      # #333 and #444
        ((192, 192, 192), (255, 255, 255)), # #ccc and #fff - light checker
        ((204, 204, 204), (255, 255, 255)), # #ccc and #fff variant
        ((128, 128, 128), (192, 192, 192)), # #808080 and #c0c0c0
        ((153, 153, 153), (204, 204, 204)), # #999 and #ccc
        ((238, 238, 238), (255, 255, 255)), # #eee and #fff - almost white
    ]
    
    # Create mask for checkered pixels
    checker_mask = np.zeros((height, width), dtype=np.uint8)
    
    b, g, r = image[:, :, 0], image[:, :, 1], image[:, :, 2]
    
    for color1, color2 in checkerboard_pairs:
        # Match pixels that are close to either checkerboard color
        # AND are neutral gray (R ≈ G ≈ B)
        
        # Color 1 match
        c1_match = (
            (np.abs(b.astype(int) - color1[0]) <= threshold) &
            (np.abs(g.astype(int) - color1[1]) <= threshold) &
            (np.abs(r.astype(int) - color1[2]) <= threshold)
        )
        
        # Color 2 match
        c2_match = (
            (np.abs(b.astype(int) - color2[0]) <= threshold) &
            (np.abs(g.astype(int) - color2[1]) <= threshold) &
            (np.abs(r.astype(int) - color2[2]) <= threshold)
        )
        
        # Create a combined mask for this color pair
        pair_match = c1_match | c2_match
        
        # Now verify it's actually a CHECKERBOARD pattern, not just gray pixels
        # Checkerboards have a specific spatial pattern: alternating every N pixels
        if np.sum(pair_match) > 0:
            # Check if the pattern has actual checkerboard alternation
            # Look at local 2x2 or 4x4 neighborhoods
            if verify_checkerboard_pattern(image[:, :, :3], pair_match, color1, color2, threshold):
                checker_mask = checker_mask | pair_match.astype(np.uint8)
                print(f"  🔲 Found checkerboard pair: {color1} ↔ {color2}")
    
    # Apply mask - make checkered areas transparent
    pixels_removed = np.sum(checker_mask > 0)
    if pixels_removed > 0:
        result[:, :, 3] = np.where(checker_mask > 0, 0, result[:, :, 3])
        print(f"🔲 Removed checkered pattern: {pixels_removed} pixels made transparent")
    else:
        print("🔲 No checkerboard pattern detected")
    
    return result


def verify_checkerboard_pattern(
    image: np.ndarray, 
    mask: np.ndarray, 
    color1: tuple, 
    color2: tuple,
    tolerance: int = 30
) -> bool:
    """
    Verify that matched pixels form an actual checkerboard pattern.
    
    A true checkerboard has alternating colors in a grid pattern.
    This prevents removing gray artwork that happens to match checkerboard colors.
    
    Args:
        image: BGR image
        mask: Boolean mask of matched pixels
        color1, color2: The two checkerboard colors
        tolerance: Color matching tolerance
    
    Returns:
        True if this is a real checkerboard pattern
    """
    if np.sum(mask) < 100:  # Too few pixels to analyze
        return False
    
    height, width = image.shape[:2]
    
    # Sample some regions and check for alternating pattern
    # Checkerboards have consistent block sizes (8x8, 16x16, etc.)
    common_block_sizes = [8, 10, 12, 16, 20]
    
    for block_size in common_block_sizes:
        # Sample grid points and check alternation
        alternation_count = 0
        same_count = 0
        
        for y in range(0, min(height - block_size, 200), block_size):
            for x in range(0, min(width - block_size, 200), block_size):
                # Check if this block and adjacent blocks alternate
                if y + block_size < height and x + block_size < width:
                    # Get center pixel of this block and adjacent
                    cy, cx = y + block_size // 2, x + block_size // 2
                    
                    if not mask[cy, cx]:
                        continue
                    
                    current = image[cy, cx]
                    
                    # Check right neighbor
                    if x + block_size + block_size // 2 < width:
                        ncx = x + block_size + block_size // 2
                        if mask[cy, ncx]:
                            neighbor = image[cy, ncx]
                            # Check if colors alternate
                            current_is_c1 = np.all(np.abs(current.astype(int) - np.array(color1)) <= tolerance)
                            neighbor_is_c1 = np.all(np.abs(neighbor.astype(int) - np.array(color1)) <= tolerance)
                            
                            if current_is_c1 != neighbor_is_c1:
                                alternation_count += 1
                            else:
                                same_count += 1
        
        # If we found significant alternation, it's a real checkerboard
        if alternation_count > 5 and alternation_count > same_count * 0.5:
            print(f"    ✓ Verified checkerboard with block size ~{block_size}px")
            return True
    
    # Could also be a very fine or very coarse checkerboard
    # Fall back to checking overall color distribution
    matched_pixels = image[mask]
    if len(matched_pixels) > 50:
        # Check if the matched pixels are roughly 50/50 split between the two colors
        gray_values = np.mean(matched_pixels, axis=1) if len(matched_pixels.shape) > 1 else matched_pixels
        c1_gray = np.mean(color1)
        c2_gray = np.mean(color2)
        mid_gray = (c1_gray + c2_gray) / 2
        
        count_c1 = np.sum(gray_values < mid_gray)
        count_c2 = np.sum(gray_values >= mid_gray)
        
        ratio = min(count_c1, count_c2) / max(count_c1, count_c2) if max(count_c1, count_c2) > 0 else 0
        
        # True checkerboards have roughly equal amounts of both colors (ratio > 0.3)
        if ratio > 0.3:
            print(f"    ✓ Verified by color distribution (ratio={ratio:.2f})")
            return True
    
    return False



async def create_asset_project(
    asset_type: str,
    name: str,
    description: str,
    spritesheet_bytes: bytes,
    frame_count: int = 1,
    dna: dict = None,
) -> dict:
    """
    Create a project in the database for a generated asset.
    
    This allows the asset to be viewed in the existing /projects/[id]/preview page.
    
    Returns:
        dict with project_id, spritesheet_url, and frame_urls
    """
    import uuid as uuid_module
    
    project_id = str(uuid_module.uuid4())
    fake_user_id = "00000000-0000-0000-0000-000000000000"
    spritesheet_url = None
    frame_urls = []
    
    try:
        # Create project in database
        data = {
            "user_id": fake_user_id,
            "name": name[:50],
            "description": description[:200] if description else f"Generated {asset_type} asset",
            "status": "sprites_generated",
            "reference_image_url": None,
            "character_dna": dna,
            "latest_spritesheet_url": None,
            "generation_count": 1,
        }
        
        response = supabase_service.client.table("projects").insert(data).execute()
        
        if response.data:
            project_id = response.data[0]['id']
            
            # Upload spritesheet to storage
            sheet_path = f"{project_id}/spritesheet_{uuid_module.uuid4().hex[:8]}.png"
            spritesheet_url = await supabase_service.upload_image(
                "sprites", sheet_path, spritesheet_bytes, "image/png"
            )
            
            # Extract and upload individual frames
            nparr = np.frombuffer(spritesheet_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
            
            if img is not None and frame_count > 1:
                h, w = img.shape[:2]
                frame_width = w // frame_count
                
                for i in range(frame_count):
                    # Extract frame
                    frame = img[:, i * frame_width:(i + 1) * frame_width]
                    _, frame_bytes = cv2.imencode('.png', frame)
                    
                    # Upload frame
                    frame_path = f"{project_id}/frame_{i:02d}.png"
                    frame_url = await supabase_service.upload_image(
                        "sprites", frame_path, frame_bytes.tobytes(), "image/png"
                    )
                    frame_urls.append(frame_url)
            elif img is not None:
                # Single frame asset
                frame_urls = [spritesheet_url]
            
            # Update project with spritesheet URL
            await supabase_service.update_project(project_id, {
                "latest_spritesheet_url": spritesheet_url,
                "status": "completed",
            })
            
            # Save frame URLs
            if frame_urls:
                await supabase_service.save_frame_urls(project_id, frame_urls, spritesheet_url)
            
            print(f"📦 Project created: {project_id} ({len(frame_urls)} frames)")
            
    except Exception as e:
        print(f"⚠️ Could not create project: {e}")
        # Return local project_id anyway - asset is still usable
    
    return {
        "project_id": project_id,
        "spritesheet_url": spritesheet_url,
        "frame_urls": frame_urls,
    }


# ============================================================================
# List Presets Endpoint
# ============================================================================

@router.get("/presets")
async def get_all_presets():
    """List all available presets by category."""
    return {
        "presets": list_presets(),
        "effects": list(EFFECT_PRESETS.keys()),
        "tiles": list(TILE_PRESETS.keys()),
        "ui_elements": list(UI_PRESETS.keys()),
        "backgrounds": list(BACKGROUND_PRESETS.keys()),
        "styles": list(CHARACTER_STYLE_PRESETS.keys()),
    }


# ============================================================================
# Background Removal Tool
# ============================================================================

@router.post("/remove-background")
async def remove_background(
    file: UploadFile = File(...),
    method: str = Form(default="white"),
    threshold: int = Form(default=240),
):
    """
    Remove background from an uploaded image.
    
    Args:
        file: Image file (PNG, JPG, WebP)
        method: Removal method - "white" (remove white bg), "adaptive" (auto-detect), "green" (greenscreen)
        threshold: Threshold for white detection (0-255, default 240)
    
    Returns:
        PNG image with transparent background (base64 encoded)
    """
    import os
    import uuid as uuid_module
    
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image (PNG, JPG, WebP)")
        
        # Read file bytes
        image_bytes = await file.read()
        if len(image_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty file uploaded")
        
        print(f"🖼️ Processing image: {file.filename} ({len(image_bytes)} bytes)")
        print(f"   Method: {method}, Threshold: {threshold}")
        
        # Apply background removal
        result_bytes = apply_background_removal(image_bytes, method=method, threshold=threshold)
        
        # Save locally for preview
        output_dir = "/tmp/spritemancer_generated"
        os.makedirs(output_dir, exist_ok=True)
        
        # Generate output filename
        original_name = os.path.splitext(file.filename or "image")[0]
        output_filename = f"{output_dir}/{original_name}_nobg_{uuid_module.uuid4().hex[:8]}.png"
        
        with open(output_filename, "wb") as f:
            f.write(result_bytes)
        
        print(f"✅ Background removed: {output_filename}")
        
        # Convert to base64 for response
        result_base64 = base64.b64encode(result_bytes).decode('utf-8')
        
        return {
            "success": True,
            "original_filename": file.filename,
            "method": method,
            "threshold": threshold,
            "output_size": len(result_bytes),
            "local_path": output_filename,
            "image_base64": result_base64,
            "data_url": f"data:image/png;base64,{result_base64}",
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Background removal failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Difference Matting (True Alpha from White/Black Versions)
# ============================================================================

@router.post("/difference-matte")
async def apply_difference_matte(
    white_image: UploadFile = File(..., description="Image with subject on WHITE background"),
    black_image: UploadFile = File(..., description="Image with subject on BLACK background"),
):
    """
    Compute true alpha transparency using Difference Matting technique.
    
    This technique uses two versions of the same subject - one on white background
    and one on black background - to mathematically compute the exact alpha channel.
    
    The result has:
    - Perfect semi-transparency (glass, smoke, etc.)
    - Preserved soft shadows
    - No edge halos or artifacts
    
    Args:
        white_image: Image with subject on pure white (#FFFFFF) background
        black_image: Same subject on pure black (#000000) background
    
    Returns:
        PNG image with true alpha transparency
    """
    from app.services.difference_matting import (
        compute_difference_matte,
        verify_image_alignment,
    )
    import os
    import uuid as uuid_module
    
    try:
        # Validate file types
        for img, name in [(white_image, "white"), (black_image, "black")]:
            if not img.content_type or not img.content_type.startswith("image/"):
                raise HTTPException(status_code=400, detail=f"{name}_image must be an image file")
        
        # Read image bytes
        white_bytes = await white_image.read()
        black_bytes = await black_image.read()
        
        if len(white_bytes) == 0 or len(black_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty file uploaded")
        
        print(f"🎨 Difference Matting: white={len(white_bytes)} bytes, black={len(black_bytes)} bytes")
        
        # Decode images
        white_arr = np.frombuffer(white_bytes, np.uint8)
        black_arr = np.frombuffer(black_bytes, np.uint8)
        
        white_img = cv2.imdecode(white_arr, cv2.IMREAD_COLOR)
        black_img = cv2.imdecode(black_arr, cv2.IMREAD_COLOR)
        
        if white_img is None or black_img is None:
            raise HTTPException(status_code=400, detail="Failed to decode one or both images")
        
        # Verify alignment
        is_aligned, iou = verify_image_alignment(white_img, black_img)
        if not is_aligned:
            print(f"⚠️ Warning: Images may not be properly aligned (IoU={iou:.3f})")
        
        # Compute difference matte
        result = compute_difference_matte(white_img, black_img, edge_refinement=True)
        
        # Save locally
        output_dir = "/tmp/spritemancer_generated"
        os.makedirs(output_dir, exist_ok=True)
        
        output_filename = f"{output_dir}/matte_{uuid_module.uuid4().hex[:8]}.png"
        cv2.imwrite(output_filename, result)
        
        print(f"✅ Difference matte saved: {output_filename}")
        
        # Encode as PNG for response
        success, encoded = cv2.imencode('.png', result)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to encode result")
        
        result_bytes = encoded.tobytes()
        result_base64 = base64.b64encode(result_bytes).decode('utf-8')
        
        return {
            "success": True,
            "method": "difference_matte",
            "alignment_score": float(iou),
            "output_size": len(result_bytes),
            "local_path": output_filename,
            "image_base64": result_base64,
            "data_url": f"data:image/png;base64,{result_base64}",
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Difference matting failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Character Generation (Enhanced)
# ============================================================================

@router.post("/generate-character")
async def generate_character(request: GenerateCharacterRequest):
    """
    Generate a character reference image from text description.
    
    Features:
    - Style presets (8bit_retro, 16bit_snes, modern_pixel, hd_pixel)
    - Automatic DNA extraction
    - Works with or without database
    """
    import os
    import uuid as uuid_module
    
    try:
        # Get style additions
        style_additions = get_style_prompt_additions(request.style)
        
        # Craft enhanced prompt
        prompt = f"""Create a {request.size} pixel art character sprite: {request.description}

Requirements:
- Clean {request.size} pixel art style{', ' + style_additions if style_additions else ''}
- {request.perspective} view perspective
- Single character, centered, on a pure white or transparent background
- Game-ready sprite suitable for a 2D platformer or RPG
- Sharp pixel edges, minimal anti-aliasing
- Vibrant colors with clear silhouette
- Simple, iconic design suitable for animation
- Style: {request.style.replace('_', ' ').title()}

Generate a single static idle pose that can be used as a reference for generating animation frames."""

        print(f"🎨 Generating character: {request.description} (style: {request.style})")
        
        # Generate the reference image
        image_bytes = await gemini_client.generate_image(
            prompt=prompt,
            aspect_ratio="1:1"
        )
        
        if not image_bytes:
            raise HTTPException(status_code=500, detail="Failed to generate image")
        
        print(f"✅ Image generated: {len(image_bytes)} bytes")
        
        # Apply background removal if requested
        if request.remove_background:
            image_bytes = apply_background_removal(image_bytes, method="white", threshold=240)
        
        # Save locally
        output_dir = "/tmp/spritemancer_generated"
        os.makedirs(output_dir, exist_ok=True)
        local_filename = f"{output_dir}/character_{uuid_module.uuid4().hex[:8]}.png"
        with open(local_filename, "wb") as f:
            f.write(image_bytes)
        print(f"💾 Image saved: {local_filename}")
        
        # Convert to base64
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Project setup
        project_id = str(uuid_module.uuid4())
        public_url = None
        dna_extracted = False
        dna = None
        
        # Extract DNA if requested
        if request.auto_extract_dna:
            from app.services.stages.stage_1_dna_extraction import extract_character_dna
            try:
                dna = await extract_character_dna(image_bytes)
                dna_extracted = True
                print(f"🧬 DNA extracted: {dna.archetype}")
            except Exception as e:
                print(f"⚠️ DNA extraction failed: {e}")
        
        # Try database save with retry logic
        db_project_id = None
        max_retries = 3
        retry_delay = 1.0  # seconds
        
        fake_user_id = "00000000-0000-0000-0000-000000000000"
        data = {
            "user_id": fake_user_id,
            "name": request.description[:50],
            "description": request.description,
            "status": "reference_generated",
            "reference_image_url": None,
            "character_dna": dna.dict() if dna else None,
            "latest_spritesheet_url": None,
            "generation_count": 0
        }
        
        # Step 1: Create project in database with retries
        for attempt in range(max_retries):
            try:
                response = supabase_service.client.table("projects").insert(data).execute()
                if response.data:
                    db_project_id = response.data[0]['id']
                    project_id = db_project_id  # Use database ID as the canonical ID
                    print(f"📁 Project created in DB: {project_id}")
                    break
            except Exception as db_error:
                print(f"⚠️ DB insert attempt {attempt + 1}/{max_retries} failed: {db_error}")
                if attempt < max_retries - 1:
                    import asyncio
                    await asyncio.sleep(retry_delay * (attempt + 1))  # Exponential backoff
                else:
                    print(f"❌ All DB insert attempts failed, using local ID: {project_id}")
        
        # Step 2: Upload reference image to storage (if DB succeeded)
        if db_project_id:
            for attempt in range(max_retries):
                try:
                    file_path = f"{db_project_id}/reference_{uuid_module.uuid4()}.png"
                    public_url = await supabase_service.upload_image(
                        "sprites", file_path, image_bytes, "image/png"
                    )
                    print(f"📤 Reference image uploaded: {public_url}")
                    break
                except Exception as upload_error:
                    print(f"⚠️ Upload attempt {attempt + 1}/{max_retries} failed: {upload_error}")
                    if attempt < max_retries - 1:
                        import asyncio
                        await asyncio.sleep(retry_delay * (attempt + 1))
                    else:
                        print(f"❌ All upload attempts failed")
        
        # Step 3: Update project with reference URL (if upload succeeded)
        if db_project_id and public_url:
            for attempt in range(max_retries):
                try:
                    await supabase_service.update_project(db_project_id, {"reference_image_url": public_url})
                    print(f"✅ Project updated with reference URL")
                    break
                except Exception as update_error:
                    print(f"⚠️ Update attempt {attempt + 1}/{max_retries} failed: {update_error}")
                    if attempt < max_retries - 1:
                        import asyncio
                        await asyncio.sleep(retry_delay * (attempt + 1))
                    else:
                        print(f"❌ All update attempts failed")
        
        return {
            "project_id": project_id,
            "asset_type": "character",
            "description": request.description,
            "style": request.style,
            "size": request.size,
            "reference_image_url": public_url,
            "reference_image_base64": image_base64,
            "local_path": local_filename,
            "dna_extracted": dna_extracted,
            "dna": dna.dict() if dna else None,
            "status": "ready_for_animation" if dna_extracted else "image_generated",
            "db_synced": db_project_id is not None and public_url is not None,  # True if fully synced to DB
        }
        
    except Exception as e:
        print(f"❌ Character generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Effect Generation
# ============================================================================

@router.post("/generate-effect")
async def generate_effect(request: GenerateEffectRequest):
    """
    Generate VFX effect sprite animation.
    
    Use preset for quick generation, or prompt for custom effects.
    """
    import os
    import uuid as uuid_module
    
    try:
        # Get DNA from preset or extract from prompt
        effect_dna = None
        if request.preset:
            effect_dna = get_effect_preset(request.preset)
            if not effect_dna:
                raise HTTPException(status_code=400, detail=f"Unknown preset: {request.preset}")
        elif request.prompt:
            # Extract DNA from prompt using AI
            dna_prompt = f"""Analyze this effect description and extract EffectDNA.

Effect: {request.prompt}

Extract:
- effect_category: explosion, slash, magic, projectile, particle, aura, or impact
- shape_pattern: radial, linear, spiral, wave, or random  
- energy_profile: burst, sustained, fade_in_out, pulse, or instant
- color_palette: 2-5 hex colors that match the description
- particle_density: sparse, moderate, or dense
- suggested_frame_count: 4-12 frames
- glow_intensity: 0-1 float

Return valid JSON only."""

            result = await gemini_client.generate_text(
                prompt=dna_prompt,
                response_schema=EFFECT_DNA_SCHEMA,
                temperature=0.3,
            )
            effect_dna = EffectDNA(**result)
            print(f"🧬 Effect DNA extracted: {effect_dna.effect_category}")
        else:
            raise HTTPException(status_code=400, detail="Either prompt or preset required")
        
        # Build sprite generation prompt
        colors = ", ".join(effect_dna.color_palette)
        grid_dim = 3 if request.frame_count <= 9 else 4
        
        sprite_prompt = f"""Create a pixel art VFX sprite sheet animation.

IMAGE SIZE: 1024x1024 pixels
GRID LAYOUT: {grid_dim}x{grid_dim} grid ({request.frame_count} frames, read left-to-right, top-to-bottom)

EFFECT TYPE: {effect_dna.effect_category.value.title()}
SHAPE: {effect_dna.shape_pattern.value}
TIMING: {effect_dna.energy_profile.value}
COLORS: {colors}
DENSITY: {effect_dna.particle_density.value}

ANIMATION PHASES:
- Frame 1-2: Spawn/appear phase (small, building)
- Frame 3-4: Expand/grow phase (getting larger)
- Frame 5: Peak intensity (maximum size/brightness)
- Frame 6+: Fade/disperse phase (shrinking, fading)

RULES:
- Pure white background (#FFFFFF)
- Each frame in its own grid cell
- Pixel art style, {request.size} effective size per frame
- Glow intensity: {effect_dna.glow_intensity:.1f}
- No grid lines or borders between frames
- Center each effect sprite in its cell

Generate a game-ready VFX sprite sheet."""

        print(f"✨ Generating effect: {effect_dna.effect_category.value}")
        
        image_bytes = await gemini_client.generate_image(
            prompt=sprite_prompt,
            aspect_ratio="1:1"
        )
        
        if not image_bytes:
            raise HTTPException(status_code=500, detail="Failed to generate effect sprites")
        
        # Apply background removal if requested
        if request.remove_background:
            image_bytes = apply_background_removal(image_bytes, method="white", threshold=240)
        
        # Save locally
        output_dir = "/tmp/spritemancer_generated"
        os.makedirs(output_dir, exist_ok=True)
        local_filename = f"{output_dir}/effect_{effect_dna.effect_category.value}_{uuid_module.uuid4().hex[:8]}.png"
        with open(local_filename, "wb") as f:
            f.write(image_bytes)
        
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Create project for preview page
        project_info = await create_asset_project(
            asset_type="effect",
            name=f"Effect: {effect_dna.effect_category.value}",
            description=request.prompt or f"{effect_dna.effect_category.value} effect",
            spritesheet_bytes=image_bytes,
            frame_count=request.frame_count,
            dna=effect_dna.dict(),
        )
        
        print(f"✅ Effect generated: {local_filename}")
        
        return {
            "asset_type": "effect",
            "effect_category": effect_dna.effect_category.value,
            "preset_used": request.preset,
            "dna": effect_dna.dict(),
            "frame_count": request.frame_count,
            "size": request.size,
            "spritesheet_base64": image_base64,
            "local_path": local_filename,
            "status": "generated",
            "project_id": project_info["project_id"],
            "spritesheet_url": project_info["spritesheet_url"],
            "frame_urls": project_info["frame_urls"],
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Effect generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Tile Generation
# ============================================================================

@router.post("/generate-tile")
async def generate_tile(request: GenerateTileRequest):
    """
    Generate animated tile sprite sheet.
    
    Tiles are designed to loop seamlessly for environment backgrounds.
    """
    import os
    import uuid as uuid_module
    
    try:
        tile_dna = None
        if request.preset:
            tile_dna = get_tile_preset(request.preset)
            if not tile_dna:
                raise HTTPException(status_code=400, detail=f"Unknown preset: {request.preset}")
        elif request.prompt:
            dna_prompt = f"""Analyze this tile description and extract TileDNA.

Tile: {request.prompt}

Extract:
- tile_category: water, lava, grass, fire, crystal, smoke, waterfall, or custom
- movement_pattern: wave, flicker, sway, pulse, flow, or bubble
- seamless_axis: horizontal, vertical, or both
- loop_style: smooth, choppy, or organic
- color_palette: 2-4 hex colors
- suggested_frame_count: 2-8 frames

Return valid JSON only."""

            result = await gemini_client.generate_text(
                prompt=dna_prompt,
                response_schema=TILE_DNA_SCHEMA,
                temperature=0.3,
            )
            tile_dna = TileDNA(**result)
            print(f"🧬 Tile DNA extracted: {tile_dna.tile_category}")
        else:
            raise HTTPException(status_code=400, detail="Either prompt or preset required")
        
        colors = ", ".join(tile_dna.color_palette)
        
        sprite_prompt = f"""Create a pixel art animated tile sprite sheet.

IMAGE SIZE: 512x128 pixels (horizontal strip)
LAYOUT: {request.frame_count} tiles in a row, each {request.size}

TILE TYPE: {tile_dna.tile_category.value.title()}
ANIMATION: {tile_dna.movement_pattern.value}
LOOP STYLE: {tile_dna.loop_style.value}
COLORS: {colors}

SEAMLESS REQUIREMENTS:
- {"Left edge MUST match right edge exactly" if tile_dna.seamless_axis in ["horizontal", "both"] else ""}
- {"Top edge MUST match bottom edge exactly" if tile_dna.seamless_axis in ["vertical", "both"] else ""}
- Animation loops perfectly from last frame to first frame

RULES:
- Each tile is exactly {request.size}
- Pure pixel art style
- Tiles arranged horizontally in order
- No gaps between tiles
- Subtle animation changes between frames
- Environment tile suitable for game backgrounds

Generate a seamlessly tileable animation strip."""

        print(f"🏔️ Generating tile: {tile_dna.tile_category.value}")
        
        image_bytes = await gemini_client.generate_image(
            prompt=sprite_prompt,
            aspect_ratio="4:1"
        )
        
        if not image_bytes:
            raise HTTPException(status_code=500, detail="Failed to generate tile sprites")
        
        # Apply background removal if requested (tiles usually keep background)
        if request.remove_background:
            image_bytes = apply_background_removal(image_bytes, method="white", threshold=240)
        
        # Apply seamless validation and auto-fix if requested
        seamless_result = None
        if request.seamless:
            from app.services.seamless_validation import validate_and_fix_seamless
            
            axis = "horizontal"  # Default for most tiles
            if hasattr(tile_dna, 'movement_pattern'):
                if tile_dna.movement_pattern in ['flow', 'wave']:
                    axis = "horizontal"
                elif tile_dna.movement_pattern in ['bubble', 'pulse']:
                    axis = "vertical"
            
            image_bytes, seamless_result = validate_and_fix_seamless(
                image_bytes,
                axis=axis,
                auto_fix=True,
                threshold=85.0
            )
        
        output_dir = "/tmp/spritemancer_generated"
        os.makedirs(output_dir, exist_ok=True)
        local_filename = f"{output_dir}/tile_{tile_dna.tile_category.value}_{uuid_module.uuid4().hex[:8]}.png"
        with open(local_filename, "wb") as f:
            f.write(image_bytes)
        
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Create project for preview page
        project_info = await create_asset_project(
            asset_type="tile",
            name=f"Tile: {tile_dna.tile_category.value}",
            description=request.prompt or f"{tile_dna.tile_category.value} animated tile",
            spritesheet_bytes=image_bytes,
            frame_count=request.frame_count,
            dna=tile_dna.dict(),
        )
        
        print(f"✅ Tile generated: {local_filename}")
        
        response = {
            "asset_type": "tile",
            "tile_category": tile_dna.tile_category.value,
            "preset_used": request.preset,
            "dna": tile_dna.dict(),
            "frame_count": request.frame_count,
            "size": request.size,
            "seamless": request.seamless,
            "spritesheet_base64": image_base64,
            "local_path": local_filename,
            "status": "generated",
            "project_id": project_info["project_id"],
            "spritesheet_url": project_info["spritesheet_url"],
            "frame_urls": project_info["frame_urls"],
        }
        
        # Add seamless validation result if available
        if seamless_result:
            response["seamless_validation"] = {
                "is_seamless": bool(seamless_result.is_seamless),  # Convert numpy.bool to Python bool
                "horizontal_score": float(seamless_result.horizontal_score),
                "vertical_score": float(seamless_result.vertical_score),
                "overall_score": float(seamless_result.overall_score),
                "message": str(seamless_result.message),
            }
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Tile generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# UI Element Generation
# ============================================================================

@router.post("/generate-ui")
async def generate_ui_element(request: GenerateUIElementRequest):
    """
    Generate animated UI element sprite sheet.
    
    Small, looping animations for game UI (coins, hearts, gems, etc.)
    """
    import os
    import uuid as uuid_module
    
    try:
        ui_dna = None
        if request.preset:
            ui_dna = get_ui_preset(request.preset)
            if not ui_dna:
                raise HTTPException(status_code=400, detail=f"Unknown preset: {request.preset}")
        elif request.prompt:
            dna_prompt = f"""Analyze this UI element description and extract UIElementDNA.

Element: {request.prompt}

Extract:
- element_type: coin, gem, heart, star, button, arrow, key, chest, or custom
- animation_style: spin, pulse, bounce, sparkle, glow, or shake
- color_palette: 1-3 hex colors
- suggested_frame_count: 4-12 frames

Return valid JSON only."""

            result = await gemini_client.generate_text(
                prompt=dna_prompt,
                response_schema=UI_ELEMENT_DNA_SCHEMA,
                temperature=0.3,
            )
            ui_dna = UIElementDNA(**result)
            print(f"🧬 UI DNA extracted: {ui_dna.element_type}")
        else:
            raise HTTPException(status_code=400, detail="Either prompt or preset required")
        
        colors = ", ".join(ui_dna.color_palette)
        
        sprite_prompt = f"""Create a pixel art animated UI element sprite sheet.

IMAGE SIZE: 256x32 pixels (horizontal strip)
LAYOUT: {request.frame_count} frames in a row, each {request.size}

ELEMENT TYPE: {ui_dna.element_type.value.title()}
ANIMATION: {ui_dna.animation_style.value}
COLORS: {colors}

ANIMATION GUIDE:
{"- Full 360° rotation across all frames" if ui_dna.animation_style.value == "spin" else ""}
{"- Size pulses larger and smaller smoothly" if ui_dna.animation_style.value == "pulse" else ""}
{"- Bounces up and down" if ui_dna.animation_style.value == "bounce" else ""}
{"- Sparkle/shine effects moving across surface" if ui_dna.animation_style.value == "sparkle" else ""}
{"- Glow intensity increases and decreases" if ui_dna.animation_style.value == "glow" else ""}

RULES:
- Each frame is exactly {request.size}
- Pure pixel art style, crisp edges
- Frames arranged horizontally in order
- Transparent or white background
- Animation loops perfectly
- Iconic, readable silhouette
- Game-UI quality suitable for inventory/HUD

Generate a looping UI element animation strip."""

        print(f"🎮 Generating UI element: {ui_dna.element_type.value}")
        
        image_bytes = await gemini_client.generate_image(
            prompt=sprite_prompt,
            aspect_ratio="8:1"
        )
        
        if not image_bytes:
            raise HTTPException(status_code=500, detail="Failed to generate UI sprites")
        
        # Apply background removal if requested
        if request.remove_background:
            image_bytes = apply_background_removal(image_bytes, method="white", threshold=240)
        
        output_dir = "/tmp/spritemancer_generated"
        os.makedirs(output_dir, exist_ok=True)
        local_filename = f"{output_dir}/ui_{ui_dna.element_type.value}_{uuid_module.uuid4().hex[:8]}.png"
        with open(local_filename, "wb") as f:
            f.write(image_bytes)
        
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Create project for preview page
        project_info = await create_asset_project(
            asset_type="ui",
            name=f"UI: {ui_dna.element_type.value}",
            description=request.prompt or f"{ui_dna.element_type.value} UI element",
            spritesheet_bytes=image_bytes,
            frame_count=request.frame_count,
            dna=ui_dna.dict(),
        )
        
        print(f"✅ UI element generated: {local_filename}")
        
        return {
            "asset_type": "ui",
            "element_type": ui_dna.element_type.value,
            "preset_used": request.preset,
            "dna": ui_dna.dict(),
            "frame_count": request.frame_count,
            "size": request.size,
            "spritesheet_base64": image_base64,
            "local_path": local_filename,
            "status": "generated",
            "project_id": project_info["project_id"],
            "spritesheet_url": project_info["spritesheet_url"],
            "frame_urls": project_info["frame_urls"],
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ UI element generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Background Generation
# ============================================================================

@router.post("/generate-background")
async def generate_background(request: GenerateBackgroundRequest):
    """
    Generate game background images.
    
    Features:
    - Single layer (far, mid, near, or full scene)
    - Parallax pack (generates all 3 layers at once)
    - Preset-based or custom prompt generation
    - Optional animation (clouds, water, etc.)
    """
    import os
    import uuid as uuid_module
    
    try:
        bg_dna = None
        if request.preset:
            bg_dna = get_background_preset(request.preset)
            if not bg_dna:
                raise HTTPException(status_code=400, detail=f"Unknown preset: {request.preset}")
        elif request.prompt:
            # Extract DNA from prompt using AI
            dna_prompt = f"""Analyze this background description and extract BackgroundDNA.

Background: {request.prompt}

Extract:
- background_type: forest, mountain, sky, underwater, cave, city, desert, space, dungeon, or custom
- parallax_layer: far, mid, near, or full
- time_of_day: day, night, sunset, sunrise, or twilight
- weather: clear, cloudy, foggy, rainy, or snowy
- color_palette: 3-6 hex colors that match the description
- animated: true if the background should have animation (clouds, water, particles)

Return valid JSON only."""

            result = await gemini_client.generate_text(
                prompt=dna_prompt,
                response_schema=BACKGROUND_DNA_SCHEMA,
                temperature=0.3,
            )
            bg_dna = BackgroundDNA(**result)
            print(f"🧬 Background DNA extracted: {bg_dna.background_type}")
        else:
            raise HTTPException(status_code=400, detail="Either prompt or preset required")
        
        # Override with request params
        layer = request.parallax_layer or bg_dna.parallax_layer.value
        time_of_day = request.time_of_day or bg_dna.time_of_day.value
        colors = ", ".join(bg_dna.color_palette)
        
        # Parse size
        width, height = map(int, request.size.split("x"))
        
        output_dir = "/tmp/spritemancer_generated"
        os.makedirs(output_dir, exist_ok=True)
        
        generated_layers = []
        
        # If generating a pack, do all 3 layers
        layers_to_generate = ["far", "mid", "near"] if layer == "pack" else [layer]
        
        for current_layer in layers_to_generate:
            # Build layer-specific prompt
            layer_desc = {
                "far": "distant background layer with sky, distant mountains or horizon. Very simple shapes, minimal detail. Used as the slowest-moving parallax layer.",
                "mid": "middle distance layer with hills, trees, or buildings. Medium detail level. Moves at medium speed in parallax.",
                "near": "foreground layer with closest elements like bushes, rocks, or platforms. Most detail. Moves fastest in parallax.",
                "full": "complete scene background with all depth layers unified. Single static or animated background.",
            }
            
            aspect = "16:9"  # Standard game aspect ratio
            
            # Use difference matting for parallax layers (not full scenes)
            use_matte = request.use_difference_matte and current_layer != "full"
            
            if use_matte:
                # ============================================
                # DIFFERENCE MATTING: Generate WHITE version
                # ============================================
                white_prompt = f"""Create a pixel art game background image.

IMAGE SIZE: {width}x{height} pixels
ASPECT RATIO: {aspect}
LAYER TYPE: {current_layer.upper()} - {layer_desc.get(current_layer, layer_desc['full'])}

ENVIRONMENT: {bg_dna.background_type.value.title()}
TIME OF DAY: {time_of_day.title()}
WEATHER: {bg_dna.weather.value.title()}
COLORS: {colors}

{"ANIMATED ELEMENTS: Include subtle movement suggestion for clouds, water, or particles" if request.animated else "STATIC: No animation needed"}

CRITICAL - BACKGROUND: Render on a PURE SOLID WHITE (#FFFFFF) background.
The background must be completely flat pure white with no gradients, patterns, or textures.

RULES:
- Pure pixel art style
- Elements float on pure white background
- Game-ready background suitable for 2D platformer or RPG
- {current_layer.upper()} layer details only (don't include elements from other layers)
- NO checkered patterns - pure solid white behind all elements

Generate a beautiful game background layer on white."""

                print(f"🏔️ Generating {current_layer} (WHITE version) for difference matte...")
                
                white_bytes = await gemini_client.generate_image(
                    prompt=white_prompt,
                    aspect_ratio=aspect
                )
                
                if not white_bytes:
                    raise HTTPException(status_code=500, detail=f"Failed to generate {current_layer} white version")
                
                # ============================================
                # DIFFERENCE MATTING: Edit WHITE to BLACK
                # ============================================
                # Use image editing to change ONLY the background color
                # This ensures the exact same subject, just different background
                
                edit_prompt = """Change ONLY the background of this image from white to pure solid black (#000000).

CRITICAL RULES:
- Keep the EXACT same subject elements in the EXACT same positions
- Do NOT modify, move, or change any part of the subject/artwork
- Do NOT add any new elements
- Do NOT change any colors of the subject
- ONLY change the pure white background to pure black
- The result must be PIXEL-PERFECT identical to the original, except background is black instead of white

Simply replace white (#FFFFFF) background pixels with black (#000000) pixels."""

                print(f"🏔️ Editing {current_layer} to BLACK version for difference matte...")
                
                black_bytes = await gemini_client.edit_image_simple(
                    image_bytes=white_bytes,
                    edit_prompt=edit_prompt
                )
                
                if not black_bytes:
                    raise HTTPException(status_code=500, detail=f"Failed to edit {current_layer} to black version")
                
                # ============================================
                # DIFFERENCE MATTING: Compute true alpha
                # ============================================
                from app.services.difference_matting import compute_difference_matte
                
                # Decode images
                white_arr = np.frombuffer(white_bytes, np.uint8)
                black_arr = np.frombuffer(black_bytes, np.uint8)
                
                white_img = cv2.imdecode(white_arr, cv2.IMREAD_COLOR)
                black_img = cv2.imdecode(black_arr, cv2.IMREAD_COLOR)
                
                if white_img is None or black_img is None:
                    print(f"⚠️ Failed to decode images, falling back to white removal")
                    image_bytes = apply_background_removal(white_bytes, method="white", threshold=250)
                else:
                    print(f"🎨 Computing difference matte for {current_layer}...")
                    result_img = compute_difference_matte(white_img, black_img, edge_refinement=True)
                    
                    # Encode as PNG
                    success, encoded = cv2.imencode('.png', result_img)
                    if success:
                        image_bytes = encoded.tobytes()
                        print(f"✨ Difference matte computed for {current_layer}")
                    else:
                        print(f"⚠️ Encoding failed, falling back to white removal")
                        image_bytes = apply_background_removal(white_bytes, method="white", threshold=250)
            else:
                # Standard generation (no difference matting)
                sprite_prompt = f"""Create a pixel art game background image.

IMAGE SIZE: {width}x{height} pixels
ASPECT RATIO: {aspect}
LAYER TYPE: {current_layer.upper()} - {layer_desc.get(current_layer, layer_desc['full'])}

ENVIRONMENT: {bg_dna.background_type.value.title()}
TIME OF DAY: {time_of_day.title()}
WEATHER: {bg_dna.weather.value.title()}
COLORS: {colors}

{"ANIMATED ELEMENTS: Include subtle movement suggestion for clouds, water, or particles" if request.animated else "STATIC: No animation needed"}

RULES:
- Pure pixel art style
- {"Transparent background for parallax layering" if current_layer != "full" else "Complete scene"}
- Game-ready background suitable for 2D platformer or RPG
- Horizontal scrolling friendly (edges should tile or fade)
- Consistent lighting based on time of day
- {current_layer.upper()} layer details only (don't include elements from other layers)

Generate a beautiful game background {"layer" if current_layer != "full" else "scene"}."""

                print(f"🏔️ Generating background: {bg_dna.background_type.value} ({current_layer})")
                
                image_bytes = await gemini_client.generate_image(
                    prompt=sprite_prompt,
                    aspect_ratio=aspect
                )
                
                if not image_bytes:
                    raise HTTPException(status_code=500, detail=f"Failed to generate {current_layer} background layer")
                
                # Apply background removal for parallax layers (not full scenes)
                if current_layer != "full":
                    image_bytes = apply_background_removal(image_bytes, method="white", threshold=250)
            
            # Save locally
            local_filename = f"{output_dir}/bg_{bg_dna.background_type.value}_{current_layer}_{uuid_module.uuid4().hex[:8]}.png"
            with open(local_filename, "wb") as f:
                f.write(image_bytes)
            
            image_base64 = base64.b64encode(image_bytes).decode('utf-8')
            
            generated_layers.append({
                "layer": current_layer,
                "image_base64": image_base64,
                "local_path": local_filename,
                "method": "difference_matte" if use_matte else "white_removal",
            })
            
            print(f"✅ {current_layer.upper()} layer generated: {local_filename}")
        
        # Create project for single layer or primary layer of pack
        primary_layer = generated_layers[0]
        with open(primary_layer["local_path"], "rb") as f:
            primary_bytes = f.read()
        
        project_info = await create_asset_project(
            asset_type="background",
            name=f"Background: {bg_dna.background_type.value}",
            description=request.prompt or f"{bg_dna.background_type.value} background",
            spritesheet_bytes=primary_bytes,
            frame_count=1,
            dna=bg_dna.dict(),
        )
        
        response = {
            "asset_type": "background",
            "background_type": bg_dna.background_type.value,
            "preset_used": request.preset,
            "dna": bg_dna.dict(),
            "size": request.size,
            "parallax_layer": layer,
            "time_of_day": time_of_day,
            "animated": request.animated,
            "status": "generated",
            "project_id": project_info["project_id"],
            "spritesheet_url": project_info["spritesheet_url"],
        }
        
        # Add layers to response
        if layer == "pack":
            response["layers"] = generated_layers
            response["far_layer"] = generated_layers[0]
            response["mid_layer"] = generated_layers[1]
            response["near_layer"] = generated_layers[2]
        else:
            response["image_base64"] = generated_layers[0]["image_base64"]
            response["local_path"] = generated_layers[0]["local_path"]
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Background generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Unified Asset Generation
# ============================================================================

@router.post("/generate-asset")
async def generate_asset(request: UnifiedAssetRequest):
    """
    Unified endpoint for generating any asset type.
    
    Routes to the appropriate generator based on asset_type.
    """
    if request.asset_type == "character":
        return await generate_character(GenerateCharacterRequest(
            description=request.prompt,
            size=request.size,
            perspective=request.perspective,
            style=request.style,
        ))
    elif request.asset_type == "effect":
        return await generate_effect(GenerateEffectRequest(
            prompt=request.prompt,
            preset=request.preset,
            frame_count=request.frame_count,
            size=request.size,
        ))
    elif request.asset_type == "tile":
        return await generate_tile(GenerateTileRequest(
            prompt=request.prompt,
            preset=request.preset,
            frame_count=request.frame_count,
            size=request.size,
        ))
    elif request.asset_type == "ui":
        return await generate_ui_element(GenerateUIElementRequest(
            prompt=request.prompt,
            preset=request.preset,
            frame_count=request.frame_count,
            size=request.size,
        ))
    elif request.asset_type == "background":
        return await generate_background(GenerateBackgroundRequest(
            prompt=request.prompt,
            preset=request.preset,
            size=request.size,
        ))
    else:
        raise HTTPException(status_code=400, detail=f"Unknown asset type: {request.asset_type}")


# ============================================================================
# Full Character Animation Generation (Reference + Pipeline)
# ============================================================================

class GenerateCharacterAnimationRequest(BaseModel):
    """Request for full character animation generation."""
    description: str
    action_type: str = "idle"  # walk, run, attack, idle, jump, etc.
    difficulty_tier: Literal["LIGHT", "HEAVY", "BOSS"] = "LIGHT"
    size: str = "32x32"
    perspective: Literal["side", "front", "isometric", "top_down"] = "side"
    style: str = "modern_pixel"
    remove_background: bool = True


@router.post("/generate-character-animation")
async def generate_character_animation(request: GenerateCharacterAnimationRequest):
    """
    Generate full character animation from text description.
    
    This chains two operations:
    1. Generate character reference image from description
    2. Run full animation pipeline to create spritesheet
    
    Returns complete animation spritesheet ready for games.
    """
    import os
    import uuid as uuid_module
    
    try:
        print(f"🎬 Starting full animation generation: {request.description}")
        print(f"   Action: {request.action_type}, Difficulty: {request.difficulty_tier}")
        
        # ===== STEP 1: Generate Character Reference =====
        style_additions = get_style_prompt_additions(request.style)
        
        char_prompt = f"""Create a {request.size} pixel art character sprite: {request.description}

Requirements:
- Clean {request.size} pixel art style{', ' + style_additions if style_additions else ''}
- {request.perspective} view perspective
- Single character, centered, on a pure white background
- Game-ready sprite suitable for animation
- Sharp pixel edges, minimal anti-aliasing
- Vibrant colors with clear silhouette
- Style: {request.style.replace('_', ' ').title()}

Generate a single static idle pose as a reference for animation frames."""

        print(f"🎨 Step 1: Generating character reference...")
        
        image_bytes = await gemini_client.generate_image(
            prompt=char_prompt,
            aspect_ratio="1:1"
        )
        
        if not image_bytes:
            raise HTTPException(status_code=500, detail="Failed to generate character reference")
        
        # Apply background removal
        if request.remove_background:
            image_bytes = apply_background_removal(image_bytes, method="white", threshold=240)
        
        print(f"✅ Character reference generated: {len(image_bytes)} bytes")
        
        # ===== STEP 2: Extract DNA =====
        print(f"🧬 Step 2: Extracting character DNA...")
        
        from app.services.stages.stage_1_dna_extraction import extract_character_dna
        dna = await extract_character_dna(image_bytes)
        print(f"✅ DNA extracted: {dna.archetype}")
        
        # ===== STEP 3: Create Project in Database =====
        print(f"📁 Step 3: Creating project...")
        
        project_id = str(uuid_module.uuid4())
        fake_user_id = "00000000-0000-0000-0000-000000000000"
        public_url = None
        
        try:
            # Create project
            data = {
                "user_id": fake_user_id,
                "name": f"{request.description[:30]} - {request.action_type}",
                "description": request.description,
                "status": "dna_extracted",
                "reference_image_url": None,
                "character_dna": dna.dict(),
                "latest_spritesheet_url": None,
                "generation_count": 0
            }
            
            response = supabase_service.client.table("projects").insert(data).execute()
            if response.data:
                project_id = response.data[0]['id']
                
                # Upload reference image
                file_path = f"{project_id}/reference_{uuid_module.uuid4().hex[:8]}.png"
                public_url = await supabase_service.upload_image(
                    "sprites", file_path, image_bytes, "image/png"
                )
                await supabase_service.update_project(project_id, {
                    "reference_image_url": public_url,
                    "status": "ready_for_pipeline"
                })
                print(f"✅ Project created: {project_id}")
        except Exception as db_error:
            print(f"⚠️ Database unavailable: {db_error}")
            # Can't run full pipeline without database, return reference only
            image_base64 = base64.b64encode(image_bytes).decode('utf-8')
            return {
                "status": "reference_only",
                "message": "Database unavailable - returning reference image only",
                "project_id": project_id,
                "reference_image_base64": image_base64,
                "dna": dna.dict(),
            }
        
        # ===== STEP 4: Run Animation Pipeline =====
        print(f"🎬 Step 4: Running animation pipeline...")
        
        from app.services.pipeline_orchestrator import PipelineOrchestrator
        
        pipeline = PipelineOrchestrator(project_id)
        
        await pipeline.run_full_pipeline(
            reference_image=image_bytes,
            action_type=request.action_type,
            difficulty_tier=request.difficulty_tier,
            perspective=request.perspective,
        )
        
        # Save results
        if pipeline.state.animation_script:
            await supabase_service.save_animation_script(
                project_id,
                pipeline.state.animation_script.model_dump()
            )
        
        if pipeline.state.frame_urls:
            await supabase_service.save_frame_urls(
                project_id,
                pipeline.state.frame_urls,
                pipeline.state.spritesheet_url
            )
        
        print(f"✅ Animation pipeline complete!")
        print(f"   Frames generated: {len(pipeline.state.frame_urls) if pipeline.state.frame_urls else 0}")
        
        # Get spritesheet as base64 for response
        spritesheet_base64 = None
        if pipeline.state.spritesheet_url:
            try:
                import httpx
                async with httpx.AsyncClient() as client:
                    resp = await client.get(pipeline.state.spritesheet_url, timeout=30)
                    if resp.status_code == 200:
                        ss_bytes = resp.content
                        if request.remove_background:
                            ss_bytes = apply_background_removal(ss_bytes, method="white")
                        spritesheet_base64 = base64.b64encode(ss_bytes).decode('utf-8')
            except Exception as e:
                print(f"⚠️ Could not fetch spritesheet: {e}")
        
        # Save locally
        output_dir = "/tmp/spritemancer_generated"
        os.makedirs(output_dir, exist_ok=True)
        ref_filename = f"{output_dir}/anim_{request.action_type}_{uuid_module.uuid4().hex[:8]}_ref.png"
        with open(ref_filename, "wb") as f:
            f.write(image_bytes)
        
        return {
            "status": "completed",
            "project_id": project_id,
            "description": request.description,
            "action_type": request.action_type,
            "difficulty_tier": request.difficulty_tier,
            "style": request.style,
            "reference_image_url": public_url,
            "reference_image_base64": base64.b64encode(image_bytes).decode('utf-8'),
            "spritesheet_url": pipeline.state.spritesheet_url,
            "spritesheet_base64": spritesheet_base64,
            "frame_urls": pipeline.state.frame_urls,
            "frame_count": len(pipeline.state.frame_urls) if pipeline.state.frame_urls else 0,
            "animation_script": pipeline.state.animation_script.model_dump() if pipeline.state.animation_script else None,
            "dna": dna.dict(),
            "local_reference_path": ref_filename,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Full animation generation failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


