from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Literal
import io
import json
import zipfile
import httpx

from app.db.supabase_client import supabase_service

router = APIRouter()


class ExportRequest(BaseModel):
    """Request model for exporting sprites."""
    project_id: str
    format: Literal["png", "webp", "gif", "json"]
    include_metadata: bool = True
    transparent: bool = True  # New: transparent or white background
    fps: int = 12  # New: FPS for GIF animations


async def download_image(url: str) -> bytes:
    """Download image from URL."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.content


def convert_image(image_bytes: bytes, target_format: str, transparent: bool = True) -> bytes:
    """Convert image to target format using Pillow."""
    from PIL import Image
    
    img = Image.open(io.BytesIO(image_bytes))
    
    # Handle transparency
    if not transparent:
        # Add white background
        if img.mode == 'RGBA':
            background = Image.new('RGB', img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[3])  # Use alpha as mask
            img = background
    
    output = io.BytesIO()
    
    if target_format == "webp":
        if transparent and img.mode == 'RGBA':
            img.save(output, format="WEBP", quality=95, lossless=True)
        else:
            img.convert('RGB').save(output, format="WEBP", quality=95)
    elif target_format == "gif":
        # GIF doesn't support full alpha, convert to palette mode
        if img.mode == 'RGBA':
            # Create a version with white where transparent
            background = Image.new('RGBA', img.size, (255, 255, 255, 255))
            background.paste(img, mask=img.split()[3])
            img = background.convert('P', palette=Image.ADAPTIVE, colors=256)
        img.save(output, format="GIF")
    else:  # png is default
        if transparent:
            img.save(output, format="PNG")
        else:
            img.convert('RGB').save(output, format="PNG")
    
    output.seek(0)
    return output.read()


def create_animated_gif(frames: list[bytes], fps: int = 12, transparent: bool = True) -> bytes:
    """Create an animated GIF from a list of frame images."""
    from PIL import Image
    
    pil_frames = []
    
    for frame_bytes in frames:
        img = Image.open(io.BytesIO(frame_bytes))
        
        # Handle transparency for GIF
        if img.mode == 'RGBA':
            if transparent:
                # Convert to palette mode with transparency
                # Make a copy with white background for palette generation
                bg = Image.new('RGBA', img.size, (255, 255, 255, 255))
                composite = Image.alpha_composite(bg, img)
                # Convert to palette
                palette_img = composite.convert('P', palette=Image.ADAPTIVE, colors=255)
                # Set transparency for white pixels (or use a specific color)
                pil_frames.append(palette_img)
            else:
                # White background, no transparency
                bg = Image.new('RGB', img.size, (255, 255, 255))
                bg.paste(img, mask=img.split()[3])
                pil_frames.append(bg.convert('P', palette=Image.ADAPTIVE, colors=256))
        else:
            pil_frames.append(img.convert('P', palette=Image.ADAPTIVE, colors=256))
    
    if not pil_frames:
        raise ValueError("No frames to create GIF")
    
    output = io.BytesIO()
    duration = int(1000 / fps)  # Convert FPS to milliseconds per frame
    
    # Save animated GIF
    pil_frames[0].save(
        output,
        format="GIF",
        save_all=True,
        append_images=pil_frames[1:],
        duration=duration,
        loop=0,  # 0 = infinite loop
        disposal=2  # Clear frame before next
    )
    
    output.seek(0)
    return output.read()


@router.post("/spritesheet")
async def export_spritesheet(request: ExportRequest):
    """
    Export the generated spritesheet in the requested format.
    Returns a download URL for the converted file.
    """
    # Get project data
    project = await supabase_service.get_project(request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    result = await supabase_service.get_frame_urls(request.project_id)
    if not result or not result.get("spritesheet_url"):
        raise HTTPException(status_code=404, detail="No spritesheet found. Generate sprites first.")
    
    spritesheet_url = result["spritesheet_url"]
    
    # For JSON format, return metadata
    if request.format == "json":
        metadata = await get_project_metadata(request.project_id, project)
        return {
            "project_id": request.project_id,
            "format": "json",
            "download_url": None,  # Inline data
            "data": metadata,
        }
    
    # Download and convert spritesheet
    try:
        image_bytes = await download_image(spritesheet_url)
        
        # Convert format if needed
        if request.format != "png" or not request.transparent:
            image_bytes = convert_image(image_bytes, request.format, request.transparent)
        
        # Upload converted file
        import uuid
        bg_suffix = "_transparent" if request.transparent else "_white"
        export_path = f"exports/{request.project_id}/spritesheet{bg_suffix}_{uuid.uuid4().hex[:8]}.{request.format}"
        
        content_type = {
            "png": "image/png",
            "webp": "image/webp",
            "gif": "image/gif",
        }.get(request.format, "image/png")
        
        download_url = await supabase_service.upload_image(
            "sprites",
            export_path,
            image_bytes,
            content_type
        )
        
        return {
            "project_id": request.project_id,
            "format": request.format,
            "download_url": download_url,
            "transparent": request.transparent,
            "expires_in_seconds": 3600,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.post("/individual-frames")
async def export_individual_frames(request: ExportRequest):
    """
    Export individual frames as a ZIP archive, or as animated GIF.
    """
    # Get project and frames
    project = await supabase_service.get_project(request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    result = await supabase_service.get_frame_urls(request.project_id)
    if not result or not result.get("frame_urls"):
        raise HTTPException(status_code=404, detail="No frames found. Generate sprites first.")
    
    frame_urls = result["frame_urls"]
    
    # For JSON format, return frame metadata only
    if request.format == "json":
        metadata = await get_project_metadata(request.project_id, project)
        metadata["frame_urls"] = frame_urls
        return {
            "project_id": request.project_id,
            "format": "json",
            "download_url": None,
            "frame_count": len(frame_urls),
            "data": metadata,
        }
    
    try:
        # Download all frames
        frame_images = []
        for url in frame_urls:
            frame_bytes = await download_image(url)
            frame_images.append(frame_bytes)
        
        import uuid
        bg_suffix = "_transparent" if request.transparent else "_white"
        
        # For GIF format, create animated GIF instead of ZIP
        if request.format == "gif":
            print(f"🎬 Creating animated GIF with {len(frame_images)} frames at {request.fps} FPS...")
            gif_bytes = create_animated_gif(frame_images, request.fps, request.transparent)
            
            export_path = f"exports/{request.project_id}/animation{bg_suffix}_{uuid.uuid4().hex[:8]}.gif"
            download_url = await supabase_service.upload_image(
                "sprites",
                export_path,
                gif_bytes,
                "image/gif"
            )
            
            return {
                "project_id": request.project_id,
                "format": "gif",
                "download_url": download_url,
                "frame_count": len(frame_urls),
                "fps": request.fps,
                "transparent": request.transparent,
                "type": "animated",
            }
        
        # For other formats, create ZIP
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for i, frame_bytes in enumerate(frame_images):
                # Convert format if needed
                if request.format != "png" or not request.transparent:
                    frame_bytes = convert_image(frame_bytes, request.format, request.transparent)
                
                # Add to ZIP
                filename = f"frame_{i:03d}.{request.format}"
                zf.writestr(filename, frame_bytes)
            
            # Include metadata if requested
            if request.include_metadata:
                metadata = await get_project_metadata(request.project_id, project)
                zf.writestr("metadata.json", json.dumps(metadata, indent=2))
        
        zip_buffer.seek(0)
        
        # Upload ZIP to storage
        zip_path = f"exports/{request.project_id}/frames{bg_suffix}_{uuid.uuid4().hex[:8]}.zip"
        
        download_url = await supabase_service.upload_image(
            "sprites",
            zip_path,
            zip_buffer.read(),
            "application/zip"
        )
        
        return {
            "project_id": request.project_id,
            "format": request.format,
            "download_url": download_url,
            "frame_count": len(frame_urls),
            "transparent": request.transparent,
            "type": "zip",
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.get("/{project_id}/metadata")
async def get_export_metadata(project_id: str):
    """
    Get metadata for exported sprites (pivots, frame timing, etc.).
    """
    project = await supabase_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return await get_project_metadata(project_id, project)


class SavePreviewGifRequest(BaseModel):
    """Request model for saving preview GIF."""
    project_id: str
    fps: int = 12


@router.post("/save-preview-gif")
async def save_preview_gif(request: SavePreviewGifRequest):
    """
    Generate and save a preview GIF for the project card thumbnail.
    This is stored in the project record for display on the projects list.
    """
    # Get project and frames
    project = await supabase_service.get_project(request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    result = await supabase_service.get_frame_urls(request.project_id)
    if not result or not result.get("frame_urls"):
        raise HTTPException(status_code=404, detail="No frames found. Generate sprites first.")
    
    frame_urls = result["frame_urls"]
    
    try:
        # Download all frames
        frame_images = []
        for url in frame_urls:
            frame_bytes = await download_image(url)
            frame_images.append(frame_bytes)
        
        # Create animated GIF
        print(f"🎬 Creating preview GIF with {len(frame_images)} frames at {request.fps} FPS...")
        gif_bytes = create_animated_gif(frame_images, request.fps, transparent=True)
        
        # Upload to a permanent location for the project
        export_path = f"projects/{request.project_id}/preview.gif"
        
        preview_gif_url = await supabase_service.upload_image(
            "sprites",
            export_path,
            gif_bytes,
            "image/gif",
            upsert=True  # Overwrite if exists
        )
        
        # Update project record with preview GIF URL
        await supabase_service.update_project(request.project_id, {
            "preview_gif_url": preview_gif_url
        })
        
        return {
            "status": "success",
            "preview_gif_url": preview_gif_url,
            "frame_count": len(frame_urls),
            "fps": request.fps,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create preview GIF: {str(e)}")


async def get_project_metadata(project_id: str, project: dict) -> dict:
    """
    Build comprehensive metadata for a project's sprites.
    """
    # Get frame URLs to determine frame count
    result = await supabase_service.get_frame_urls(project_id)
    frame_urls = result.get("frame_urls", []) if result else []
    frame_count = len(frame_urls)
    
    # Get animation script for timing/phase info
    animation_script = project.get("animation_script", {})
    frames = animation_script.get("frames", [])
    
    # Get custom pivots or generate defaults
    custom_pivots = project.get("custom_pivots", [])
    if not custom_pivots:
        # Default: bottom-center pivot for each frame
        custom_pivots = [{"x": 0.5, "y": 1.0} for _ in range(frame_count)]
    
    # Determine frame dimensions from script or defaults
    frame_width = 64
    frame_height = 64
    
    # Build animation data from script
    animation_data = {
        "action_type": animation_script.get("action_type", "Idle"),
        "difficulty_tier": animation_script.get("difficulty_tier", "LIGHT"),
        "fps": 12,
        "loop": True,
        "phases": [],
    }
    
    # Extract phase information
    for frame in frames:
        animation_data["phases"].append({
            "frame_index": frame.get("frame_index", 0),
            "phase": frame.get("phase", "Idle"),
            "pose_description": frame.get("pose_description", ""),
        })
    
    return {
        "project_id": project_id,
        "frame_count": frame_count,
        "frame_width": frame_width,
        "frame_height": frame_height,
        "pivots": custom_pivots,
        "animation_data": animation_data,
        "character_dna": project.get("character_dna", {}),
    }
