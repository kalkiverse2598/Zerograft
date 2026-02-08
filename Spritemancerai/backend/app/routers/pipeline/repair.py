"""
Repair and edit endpoints for pipeline.
Handles /repair, /save-edited-frame, /reprocess endpoints.
"""
import base64
import uuid
import time

import cv2
import numpy as np
from fastapi import APIRouter, HTTPException, Form, File, UploadFile

from app.db.supabase_client import supabase_service

from .schemas import RepairRequest, ReprocessRequest
from .helpers import (
    get_project_or_404,
    get_character_frame_urls,
    download_image,
    decode_image,
    get_sprite_bounds,
    validate_frame_index,
    save_responder_frame_urls,
)

router = APIRouter()


@router.post("/repair")
async def repair_frame(request: RepairRequest):
    """
    Repair a specific frame using Stage 8.
    Now includes previous frames AND animation script as context for better repairs.
    Supports dual mode with character selection (instigator or responder).
    """
    from app.services.stages.stage_8_repair_loop import repair_frame as do_repair
    
    is_responder = request.character == "responder"
    char_label = "responder" if is_responder else "instigator"
    
    # Get current frames based on character
    frame_urls, _ = await get_character_frame_urls(request.project_id, request.character)
    validate_frame_index(request.frame_index, frame_urls)
    
    # Get project for reference image
    project = await get_project_or_404(request.project_id)
    
    # Use correct reference image based on character
    if is_responder:
        reference_url = project.get("responder_reference_url") or project.get("reference_image_url")
    else:
        reference_url = project.get("reference_image_url")
    
    if not reference_url:
        raise HTTPException(status_code=400, detail="Project has no reference image")
    
    # Get animation script for frame context
    frame_script = None
    try:
        if is_responder:
            animation_script = project.get("responder_animation_script")
        else:
            animation_script = project.get("animation_script")
        
        if animation_script and "frames" in animation_script:
            frames = animation_script["frames"]
            if request.frame_index < len(frames):
                frame_script = frames[request.frame_index]
                print(f"📜 {char_label.capitalize()} Frame {request.frame_index} script: {frame_script.get('phase', 'N/A')} - {frame_script.get('pose_description', 'N/A')[:50]}...")
    except Exception as e:
        print(f"⚠️ Could not get animation script: {e}")
    
    # Download images
    frame_bytes = await download_image(frame_urls[request.frame_index])
    reference_bytes = await download_image(reference_url)
    
    # Get canonical height and target dimensions from frame 1
    canonical_height = None
    target_width = None
    target_height = None
    
    if len(frame_urls) > 0:
        frame1_bytes = await download_image(frame_urls[0])
        frame1_img = decode_image(frame1_bytes)
        if frame1_img is not None:
            target_height, target_width = frame1_img.shape[:2]
            print(f"📐 Target dimensions from frame 1: {target_width}x{target_height}px")
            
            _, _, _, canonical_height = get_sprite_bounds(frame1_img)
            print(f"📏 Canonical height from frame 1: {canonical_height}px")
    
    # Get current frame bounds
    current_frame_bounds = None
    current_img = decode_image(frame_bytes)
    if current_img is not None:
        _, _, w, h = get_sprite_bounds(current_img)
        current_frame_bounds = (w, h)
        print(f"📐 Current frame {request.frame_index} bounds: {w}x{h}px")
    
    # Download previous 1-2 frames for context
    context_frames = []
    for prev_idx in range(request.frame_index - 2, request.frame_index):
        if prev_idx >= 0:
            prev_bytes = await download_image(frame_urls[prev_idx])
            context_frames.append(prev_bytes)
    
    if context_frames:
        print(f"📚 Providing {len(context_frames)} previous frames as context for frame {request.frame_index}")
    
    # Create mask from provided data or generate full-white mask
    if request.mask_data:
        mask_bytes = base64.b64decode(request.mask_data)
    else:
        img = decode_image(frame_bytes)
        white_mask = np.ones((img.shape[0], img.shape[1]), dtype=np.uint8) * 255
        _, mask_encoded = cv2.imencode('.png', white_mask)
        mask_bytes = mask_encoded.tobytes()
    
    # Run repair with context frames AND animation script
    try:
        repaired = await do_repair(
            frame_image=frame_bytes,
            mask_bytes=mask_bytes,
            repair_instruction=request.instruction,
            reference_image=reference_bytes,
            context_frames=context_frames if context_frames else None,
            frame_script=frame_script,
            frame_index=request.frame_index,
            total_frames=len(frame_urls),
            canonical_height=canonical_height,
            current_frame_bounds=current_frame_bounds,
            target_width=target_width,
            target_height=target_height,
        )
        
        # Upload repaired frame
        char_prefix = "responder_" if is_responder else ""
        path = f"{request.project_id}/{char_prefix}repaired_frame_{request.frame_index}_{uuid.uuid4().hex[:8]}.png"
        new_url = await supabase_service.upload_image("sprites", path, repaired)
        
        # Update frame URLs for the correct character
        frame_urls[request.frame_index] = new_url
        if is_responder:
            await save_responder_frame_urls(request.project_id, frame_urls)
        else:
            await supabase_service.save_frame_urls(request.project_id, frame_urls)
        
        return {
            "status": "repaired",
            "frame_index": request.frame_index,
            "new_url": new_url,
            "character": char_label,
            "context_frames_used": len(context_frames),
            "frame_script_used": frame_script is not None,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/save-edited-frame")
async def save_edited_frame(
    project_id: str = Form(...),
    frame_index: int = Form(...),
    image: UploadFile = File(...),
    character: str = Form("instigator"),
):
    """
    Save a manually edited frame from the pixel editor.
    Accepts multipart form data with the edited image.
    Supports dual mode with character selection.
    """
    is_responder = character == "responder"
    char_label = "responder" if is_responder else "instigator"
    
    # Get frame URLs based on character
    frame_urls, _ = await get_character_frame_urls(project_id, character)
    validate_frame_index(frame_index, frame_urls)
    
    try:
        # Read the uploaded image
        image_bytes = await image.read()
        
        # Upload to Supabase storage
        char_prefix = "responder_" if is_responder else ""
        path = f"{project_id}/{char_prefix}edited_frame_{frame_index}_{uuid.uuid4().hex[:8]}.png"
        new_url = await supabase_service.upload_image("sprites", path, image_bytes)
        
        # Update frame URLs for the correct character
        frame_urls[frame_index] = new_url
        if is_responder:
            await save_responder_frame_urls(project_id, frame_urls)
        else:
            await supabase_service.save_frame_urls(project_id, frame_urls)
        
        print(f"✅ Saved manually edited {char_label} frame {frame_index} for project {project_id}")
        
        return {
            "status": "saved",
            "frame_index": frame_index,
            "new_url": new_url,
            "character": char_label,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reprocess")
async def reprocess_spritesheet(request: ReprocessRequest):
    """
    Re-extract frames from spritesheet with manual grid parameters.
    Use this when automatic extraction produces wrong results.
    """
    from app.services.stages.stage_7_post_processing import (
        extract_frames,
        normalize_frames,
        encode_frame_png,
    )
    
    project = await get_project_or_404(request.project_id)
    
    # Get the correct spritesheet URL
    # First check new animation-specific storage, then fall back to legacy
    is_responder = request.character == "responder"
    spritesheet_url = None
    
    if is_responder:
        spritesheet_url = project.get("responder_spritesheet_url")
    else:
        # Check new animations dict first
        animations = project.get("animations") or {}
        
        # Use specified animation_type if provided, otherwise auto-detect
        if request.animation_type and request.animation_type in animations:
            anim_data = animations[request.animation_type]
            if anim_data.get("spritesheet_url"):
                spritesheet_url = anim_data["spritesheet_url"]
                print(f"📦 Using specified animation: {request.animation_type}")
        else:
            # Fall back to first animation with spritesheet (legacy behavior)
            for anim_type, anim_data in animations.items():
                if anim_data.get("spritesheet_url"):
                    spritesheet_url = anim_data["spritesheet_url"]
                    print(f"📦 Auto-detected spritesheet from: animations.{anim_type}")
                    break
        
        # Fall back to legacy spritesheet_url
        if not spritesheet_url:
            spritesheet_url = project.get("spritesheet_url")
    
    if not spritesheet_url:
        detail = "No responder spritesheet found" if is_responder else "No spritesheet found"
        raise HTTPException(status_code=404, detail=detail)
    
    try:
        print(f"🔄 Reprocessing {request.character} spritesheet with grid {request.grid_rows}x{request.grid_cols}")
        
        # Download the spritesheet
        spritesheet_bytes = await download_image(spritesheet_url)
        img = decode_image(spritesheet_bytes, with_alpha=False)
        
        if img is None:
            raise HTTPException(status_code=400, detail="Failed to decode spritesheet image")
        
        # Extract frames with manual grid parameters
        result = extract_frames(
            grid_image=img,
            expected_count=request.frame_count,
            grid_rows=request.grid_rows,
            grid_cols=request.grid_cols,
            is_grounded=True,
        )
        
        # Normalize frames
        normalized = normalize_frames(
            result.frames,
            result.frame_width,
            result.frame_height,
        )
        
        # Upload new frames with unique timestamp
        batch_id = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
        
        new_frame_urls = []
        char_prefix = "responder_" if is_responder else ""
        
        for i, frame in enumerate(normalized):
            frame_bytes = encode_frame_png(frame)
            path = f"{request.project_id}/{char_prefix}reprocess_{batch_id}_frame_{i:02d}.png"
            url = await supabase_service.upload_image("sprites", path, frame_bytes)
            new_frame_urls.append(url)
            print(f"  ✅ Uploaded {request.character} frame {i}")
        
        # Determine animation_type to save to
        animation_type = request.animation_type
        
        # If not provided, try to detect from existing animations
        if not animation_type and not is_responder:
            animations = project.get("animations") or {}
            if animations:
                # Use the first animation type that has a spritesheet
                for anim_type, anim_data in animations.items():
                    if anim_data.get("spritesheet_url"):
                        animation_type = anim_type
                        print(f"📦 Auto-detected animation type: {animation_type}")
                        break
        
        # Update database with new frame URLs
        if is_responder:
            await save_responder_frame_urls(request.project_id, new_frame_urls)
        elif animation_type:
            # Save to new animations dict
            await supabase_service.save_animation_frames(
                request.project_id,
                animation_type,
                new_frame_urls,
                spritesheet_url,  # Keep original spritesheet
            )
            print(f"✅ Saved reprocessed frames to animations.{animation_type}")
        else:
            # Fall back to legacy frame_urls
            await supabase_service.save_frame_urls(request.project_id, new_frame_urls)
        
        print(f"✅ Reprocessed {len(new_frame_urls)} {request.character} frames successfully")
        
        return {
            "status": "success",
            "frame_count": len(new_frame_urls),
            "frame_urls": new_frame_urls,
            "character": request.character,
            "animation_type": animation_type,
            "grid": f"{request.grid_rows}x{request.grid_cols}",
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
