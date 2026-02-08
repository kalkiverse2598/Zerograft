"""
Common helper utilities for pipeline endpoints.
Reduces code duplication across pipeline submodules.
"""
import traceback
from typing import Optional

import httpx
import cv2
import numpy as np
from fastapi import HTTPException

from app.db.supabase_client import supabase_service
from app.routers.websocket import send_stage_update


async def get_project_or_404(project_id: str) -> dict:
    """Get project or raise 404 HTTPException."""
    project = await supabase_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def require_reference_image(project: dict) -> None:
    """Validate project has reference image or raise 400."""
    if not project.get("reference_image_url"):
        raise HTTPException(status_code=400, detail="No reference image uploaded")


async def require_dna(project: dict) -> None:
    """Validate project has DNA or raise 400."""
    if not project.get("character_dna"):
        raise HTTPException(status_code=400, detail="DNA not extracted yet")


async def require_animation_script(project: dict) -> None:
    """Validate project has animation script or raise 400."""
    if not project.get("animation_script"):
        raise HTTPException(
            status_code=400,
            detail="No animation script. Run /generate-script first."
        )


async def download_image(url: str) -> bytes:
    """Download image from URL and return bytes."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        return resp.content


async def download_images(urls: list[str]) -> list[bytes]:
    """Download multiple images concurrently."""
    async with httpx.AsyncClient() as client:
        results = []
        for url in urls:
            resp = await client.get(url)
            results.append(resp.content)
        return results


def decode_image(image_bytes: bytes, with_alpha: bool = True) -> np.ndarray:
    """Decode image bytes to numpy array."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    flag = cv2.IMREAD_UNCHANGED if with_alpha else cv2.IMREAD_COLOR
    return cv2.imdecode(nparr, flag)


def get_sprite_bounds(img: np.ndarray) -> tuple[int, int, int, int]:
    """Get bounding box of sprite content (x, y, w, h)."""
    if len(img.shape) == 3 and img.shape[2] == 4:
        alpha = img[:, :, 3]
        coords = cv2.findNonZero(alpha)
    else:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, binary = cv2.threshold(gray, 250, 255, cv2.THRESH_BINARY_INV)
        coords = cv2.findNonZero(binary)
    
    if coords is not None:
        return cv2.boundingRect(coords)
    return (0, 0, img.shape[1], img.shape[0])


async def get_character_frame_urls(
    project_id: str, 
    character: str = "instigator"
) -> tuple[list[str], dict]:
    """
    Get frame URLs for a character.
    Returns (frame_urls, full_result_dict).
    """
    result = await supabase_service.get_frame_urls(project_id)
    if not result:
        raise HTTPException(status_code=404, detail="No frames found")
    
    is_responder = character == "responder"
    
    if is_responder:
        frame_urls = result.get("responder_frame_urls", [])
        if not frame_urls:
            raise HTTPException(status_code=404, detail="No responder frames found")
    else:
        frame_urls = result.get("frame_urls", [])
        if not frame_urls:
            raise HTTPException(status_code=404, detail="No frames found")
    
    return frame_urls, result


async def handle_pipeline_error(
    e: Exception, 
    project_id: str, 
    context: str = "Pipeline"
) -> None:
    """Log error and send error stage update."""
    print(f"❌ {context} Error: {e}")
    traceback.print_exc()
    await send_stage_update(project_id, 0, "Error", "error", {"message": str(e)})


async def save_responder_frame_urls(project_id: str, frame_urls: list[str]) -> None:
    """Save responder frame URLs (uses sync call internally)."""
    supabase_service.client.table("projects").update({
        "responder_frame_urls": frame_urls
    }).eq("id", project_id).execute()


def validate_frame_index(frame_index: int, frame_urls: list[str]) -> None:
    """Validate frame index is in range."""
    if frame_index >= len(frame_urls):
        raise HTTPException(
            status_code=400, 
            detail=f"Frame index {frame_index} out of range"
        )
