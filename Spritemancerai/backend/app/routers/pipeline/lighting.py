"""
Lighting map generation endpoints (Stage 7b).
Handles Normal Map and Specular Map generation.
"""
import math
import uuid

import cv2
import numpy as np
from fastapi import APIRouter, HTTPException

from app.db.supabase_client import supabase_service

from .helpers import get_project_or_404, download_image, decode_image

router = APIRouter()


@router.post("/{project_id}/generate-lighting-maps")
async def generate_lighting_maps_endpoint(project_id: str):
    """
    Generate Normal Maps and Specular Maps for all frames.
    Uses Stage 7b to create lighting textures from sprite luminance.
    """
    from app.services.stages.stage_7b_generate_maps import (
        generate_lighting_maps,
        encode_lighting_map_png,
    )
    from app.services.stages.stage_7_post_processing import ExtractedFrame
    
    # Get project frames
    result = await supabase_service.get_frame_urls(project_id)
    if not result or not result.get("frame_urls"):
        raise HTTPException(status_code=404, detail="No frames found. Generate sprites first.")
    
    frame_urls = result["frame_urls"]
    
    # Download each frame and convert to ExtractedFrame
    extracted_frames: list[ExtractedFrame] = []
    frame_width = 0
    frame_height = 0
    
    for idx, url in enumerate(frame_urls):
        frame_bytes = await download_image(url)
        img = decode_image(frame_bytes)
        
        if img is not None:
            h, w = img.shape[:2]
            frame_width = max(frame_width, w)
            frame_height = max(frame_height, h)
            
            extracted_frames.append(ExtractedFrame(
                index=idx,
                image=img,
                x=0,
                y=0,
                width=w,
                height=h,
                pivot_x=0.5,
                pivot_y=1.0,
            ))
    
    if not extracted_frames:
        raise HTTPException(status_code=500, detail="Failed to load any frames")
    
    # Determine grid dimension
    grid_dim = math.ceil(math.sqrt(len(extracted_frames)))
    
    # Generate lighting maps
    lighting_result = generate_lighting_maps(
        frames=extracted_frames,
        frame_width=frame_width,
        frame_height=frame_height,
        grid_dim=grid_dim,
        normal_strength=1.0,
    )
    
    # Encode and upload spritesheets
    normal_bytes = encode_lighting_map_png(lighting_result.normal_spritesheet)
    specular_bytes = encode_lighting_map_png(lighting_result.specular_spritesheet)
    
    normal_path = f"{project_id}/normal_map_{uuid.uuid4().hex[:8]}.png"
    specular_path = f"{project_id}/specular_map_{uuid.uuid4().hex[:8]}.png"
    
    normal_url = await supabase_service.upload_image("sprites", normal_path, normal_bytes)
    specular_url = await supabase_service.upload_image("sprites", specular_path, specular_bytes)
    
    # Save URLs to project
    await supabase_service.update_project(project_id, {
        "normal_map_url": normal_url,
        "specular_map_url": specular_url,
    })
    
    print(f"⚡ Generated lighting maps for project {project_id}")
    
    return {
        "project_id": project_id,
        "status": "success",
        "frame_count": len(extracted_frames),
        "normal_map_url": normal_url,
        "specular_map_url": specular_url,
    }


@router.get("/{project_id}/lighting-maps")
async def get_lighting_maps(project_id: str):
    """
    Get existing lighting maps for a project.
    Returns URLs to Normal Map and Specular Map spritesheets.
    """
    project = await get_project_or_404(project_id)
    
    normal_url = project.get("normal_map_url")
    specular_url = project.get("specular_map_url")
    
    if not normal_url or not specular_url:
        return {
            "project_id": project_id,
            "has_lighting_maps": False,
            "normal_map_url": None,
            "specular_map_url": None,
        }
    
    return {
        "project_id": project_id,
        "has_lighting_maps": True,
        "normal_map_url": normal_url,
        "specular_map_url": specular_url,
    }
