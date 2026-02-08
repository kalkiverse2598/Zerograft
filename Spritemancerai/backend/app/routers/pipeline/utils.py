"""
Utility endpoints for pipeline.
Handles status, frames, animation script, DNA edit, pivots, etc.
"""
from fastapi import APIRouter, HTTPException

from app.db.supabase_client import supabase_service

from .schemas import DNAEditRequest, IntentConfirmRequest, PivotUpdateRequest, ScriptUpdateRequest
from .helpers import get_project_or_404, download_image

router = APIRouter()


@router.get("/{project_id}/status")
async def get_pipeline_status(project_id: str):
    """Get current pipeline status for a project."""
    project = await get_project_or_404(project_id)
    
    return {
        "project_id": project_id,
        "status": project.get("status", "idle"),
        "has_dna": project.get("character_dna") is not None,
        "has_script": project.get("animation_script") is not None,
        "has_frames": project.get("frame_urls") is not None,
    }


@router.get("/{project_id}/animation-script")
async def get_animation_script(project_id: str):
    """Get the animation script for a project."""
    script = await supabase_service.get_animation_script(project_id)
    if not script:
        raise HTTPException(status_code=404, detail="No animation script found. Run the pipeline first.")
    
    return script


@router.get("/{project_id}/frames")
async def get_frames(project_id: str, animation_type: str = None):
    """
    Get the generated frames for a project.
    
    Args:
        project_id: Project ID
        animation_type: Optional - if provided, get frames for specific animation from animations dict
    """
    # First check new animation-specific storage
    if animation_type:
        anim_data = await supabase_service.get_animation_frames(project_id, animation_type)
        if anim_data and anim_data.get("frame_urls"):
            return anim_data
    
    # Check animations dict for any animation
    all_animations = await supabase_service.get_animation_frames(project_id)
    if all_animations:
        # Return first available animation's frames
        for anim_type, anim_data in all_animations.items():
            if anim_data.get("frame_urls"):
                return {
                    "animation_type": anim_type,
                    **anim_data
                }
    
    # Fallback to legacy frame_urls field
    result = await supabase_service.get_frame_urls(project_id)
    if result and result.get("frame_urls"):
        return result
    
    raise HTTPException(status_code=404, detail="No frames found. Run the pipeline first.")


@router.post("/dna/edit")
async def edit_dna(request: DNAEditRequest):
    """
    Edit Character DNA with verification.
    Triggers Stage 2 DNA Verification.
    Supports both instigator and responder characters for dual mode.
    """
    from app.services.stages.stage_2_dna_verification import verify_dna_edit, apply_verified_edit
    from app.models import CharacterDNA
    
    project_id = request.project_id
    project = await get_project_or_404(project_id)
    
    # Determine which DNA and image to use
    if request.character == "responder":
        dna_field = "responder_dna"
        image_url = project.get("responder_reference_url")
    else:
        dna_field = "character_dna"
        image_url = project.get("reference_image_url")
    
    current_dna_dict = project.get(dna_field)
    if not current_dna_dict:
        raise HTTPException(status_code=400, detail=f"No {request.character} DNA found. Extract DNA first.")
    
    if not image_url:
        raise HTTPException(status_code=400, detail=f"No {request.character} reference image found.")
    
    current_dna = CharacterDNA(**current_dna_dict)
    
    # Download reference image for verification
    try:
        reference_image = await download_image(image_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch reference image: {e}")
    
    # Run verification
    try:
        verification = await verify_dna_edit(current_dna, request.edits, reference_image)
        
        if verification.action == "UPDATE_DNA":
            # Apply the verified edit
            updated_dna = await apply_verified_edit(current_dna, request.edits, verification)
            
            # Save to database
            await supabase_service.update_project(project_id, {
                dna_field: updated_dna.model_dump()
            })
            
            return {
                "project_id": project_id,
                "character": request.character,
                "status": "updated",
                "verification": verification.model_dump(),
                "updated_dna": updated_dna.model_dump(),
            }
        else:
            # Flag as new feature - don't apply automatically
            return {
                "project_id": project_id,
                "character": request.character,
                "status": "flagged_as_new_feature",
                "verification": verification.model_dump(),
                "message": "Edit not verified against reference image. Consider as creative addition.",
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DNA verification failed: {e}")


@router.post("/intent/confirm")
async def confirm_intent(request: IntentConfirmRequest):
    """
    Confirm or reject intent mirroring (Stage 4).
    """
    if not request.confirmed:
        return {
            "status": "rejected",
            "message": "Please provide feedback for re-generation.",
        }
    
    # TODO: Proceed to Stage 5
    return {
        "status": "confirmed",
        "message": "Proceeding to biomechanical scripting.",
    }


@router.get("/{project_id}/suggest-actions")
async def suggest_actions(project_id: str):
    """
    Get AI-suggested animation actions based on character DNA.
    Uses Stage 3a Action Suggestion logic.
    """
    from app.services.stages.stage_3a_action_suggestion import suggest_actions as get_suggestions
    
    project = await get_project_or_404(project_id)
    
    dna = project.get("character_dna")
    if not dna:
        raise HTTPException(status_code=400, detail="Project has no DNA. Extract DNA first.")
    
    try:
        suggestions = await get_suggestions(dna)
        return {
            "project_id": project_id,
            "suggestions": suggestions,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update-pivots")
async def update_pivots(request: PivotUpdateRequest):
    """
    Update pivot points for animation frames.
    Pivots are stored as normalized coordinates (0-1).
    """
    project = await get_project_or_404(request.project_id)
    
    # Validate pivots format
    for i, pivot in enumerate(request.pivots):
        if "x" not in pivot or "y" not in pivot:
            raise HTTPException(
                status_code=400, 
                detail=f"Pivot {i} missing x or y coordinate"
            )
        if not (0 <= pivot["x"] <= 1 and 0 <= pivot["y"] <= 1):
            raise HTTPException(
                status_code=400,
                detail=f"Pivot {i} coordinates must be between 0 and 1"
            )
    
    # Save pivots to project
    try:
        await supabase_service.update_project(request.project_id, {
            "custom_pivots": request.pivots,
        })
        
        return {
            "status": "updated",
            "project_id": request.project_id,
            "pivot_count": len(request.pivots),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update-script")
async def update_script(request: ScriptUpdateRequest):
    """
    Update animation script with user edits.
    Allows modification of frame phases, descriptions, and ordering.
    """
    project = await get_project_or_404(request.project_id)
    
    existing_script = project.get("animation_script")
    if not existing_script:
        raise HTTPException(
            status_code=400,
            detail="No existing script to update. Generate a script first."
        )
    
    # Validate and merge script updates
    frames = request.script.get("frames", [])
    if not frames:
        raise HTTPException(status_code=400, detail="Script must contain frames")
    
    # Validate frame structure
    for i, frame in enumerate(frames):
        required = ["frame_index", "phase", "pose_description", "visual_focus"]
        for field in required:
            if field not in frame:
                raise HTTPException(
                    status_code=400,
                    detail=f"Frame {i} missing required field: {field}"
                )
    
    # Update the script
    updated_script = {
        **existing_script,
        "frames": frames,
        "frame_count": len(frames),
    }
    
    try:
        await supabase_service.save_animation_script(
            request.project_id,
            updated_script
        )
        
        return {
            "status": "updated",
            "project_id": request.project_id,
            "frame_count": len(frames),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
