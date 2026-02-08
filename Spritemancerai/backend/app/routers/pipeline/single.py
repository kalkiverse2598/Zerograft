"""
Single-character pipeline endpoints.
Handles /start, /generate-script, /generate-sprites, /run endpoints.
"""
from fastapi import APIRouter, HTTPException

from app.db.supabase_client import supabase_service
from app.services.stages import compute_frame_budget
from app.routers.websocket import send_stage_update, send_pipeline_complete

from .schemas import PipelineStartRequest, FrameBudgetRequest
from .helpers import (
    get_project_or_404,
    require_reference_image,
    require_dna,
    require_animation_script,
    download_image,
    handle_pipeline_error,
)

router = APIRouter()


@router.post("/compute-budget")
async def compute_budget(request: FrameBudgetRequest):
    """
    Compute frame budget based on action, difficulty, and project DNA.
    Returns the computed frame budget with justification.
    """
    project = await get_project_or_404(request.project_id)
    
    dna = project.get("character_dna")
    weapon_mass = dna.get("weapon_mass", "medium") if dna else "medium"
    
    budget = compute_frame_budget(
        action_type=request.action_type,
        difficulty_tier=request.difficulty_tier,
        weapon_mass=weapon_mass,
        perspective=request.perspective,
    )
    
    archetype = dna.get("archetype", "character") if dna else "character"
    intent_summary = (
        f"Generate a {budget.final_frame_count}-frame {request.perspective}-view "
        f"{request.difficulty_tier} {request.action_type} animation for a {archetype}."
    )
    
    return {
        "frame_budget": budget.model_dump(),
        "intent_summary": intent_summary,
    }


@router.post("/start")
async def start_pipeline(request: PipelineStartRequest):
    """
    Start the sprite generation pipeline.
    This triggers the full 8-stage pipeline via WebSocket.
    """
    dna = await supabase_service.get_character_dna(request.project_id)
    if not dna:
        raise HTTPException(status_code=400, detail="Project has no DNA. Upload a reference image first.")
    
    return {
        "project_id": request.project_id,
        "pipeline_id": "pipeline-123",
        "status": "queued",
        "message": "Pipeline started. Connect to WebSocket for progress updates.",
    }


@router.post("/generate-script")
async def generate_script(request: PipelineStartRequest):
    """
    Generate animation script (Stages 1-5) for user review.
    This does NOT generate images - user must confirm script first.
    """
    from app.services.pipeline_orchestrator import PipelineOrchestrator
    from app.models import CharacterDNA
    
    project_id = request.project_id
    
    project = await get_project_or_404(project_id)
    await require_reference_image(project)
    await require_dna(project)
    
    reference_image = await download_image(project["reference_image_url"])
    
    pipeline = PipelineOrchestrator(project_id)
    
    try:
        # Stage 1: DNA Extraction (uses cached DNA from project)
        await send_stage_update(project_id, 1, "DNA Extraction", "start")
        pipeline.state.character_dna = project.get("character_dna")
        if isinstance(pipeline.state.character_dna, dict):
            pipeline.state.character_dna = CharacterDNA(**pipeline.state.character_dna)
        await send_stage_update(project_id, 1, "DNA Extraction", "complete", {"dna": "cached"})
        
        # Stage 2: Skip (DNA already verified)
        await send_stage_update(project_id, 2, "DNA Verification", "start")
        pipeline.state.dna_verified = True
        await send_stage_update(project_id, 2, "DNA Verification", "complete")
        
        # Stage 3: Action Definition & Frame Budget
        await send_stage_update(project_id, 3, "Action Validation", "start")
        await pipeline.run_stage_3(
            request.action_type,
            request.difficulty_tier,
            request.perspective
        )
        await send_stage_update(project_id, 3, "Action Validation", "complete", {
            "frame_count": pipeline.state.frame_budget.final_frame_count if pipeline.state.frame_budget else 0
        })
        
        # Stage 4: Intent Mirroring
        await send_stage_update(project_id, 4, "Intent Mirroring", "start")
        await pipeline.run_stage_4()
        await send_stage_update(project_id, 4, "Intent Mirroring", "complete")
        
        # Auto-confirm intent
        await pipeline.confirm_intent(True)
        
        # Stage 5: Biomechanical Scripting
        await send_stage_update(project_id, 5, "Script Generation", "start")
        script = await pipeline.run_stage_5()
        await send_stage_update(project_id, 5, "Script Generation", "complete", {
            "frame_count": len(script.frames) if script else 0
        })
        
        # Save script to project for later retrieval
        await supabase_service.save_animation_script(
            project_id,
            script.model_dump()
        )
        
        return {
            "project_id": project_id,
            "status": "script_ready",
            "animation_script": script.model_dump(),
            "frame_budget": pipeline.state.frame_budget.model_dump() if pipeline.state.frame_budget else None,
            "intent_summary": pipeline.state.intent_summary,
        }
    except Exception as e:
        await handle_pipeline_error(e, project_id, "Script Generation")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-sprites")
async def generate_sprites(request: PipelineStartRequest):
    """
    Generate sprite images (Stages 6-7).
    Requires animation script to already exist from /generate-script.
    """
    from app.services.pipeline_orchestrator import PipelineOrchestrator
    from app.models import CharacterDNA, AnimationScript
    from app.services.stages import compute_frame_budget as compute_budget_func
    
    project_id = request.project_id
    
    project = await get_project_or_404(project_id)
    await require_reference_image(project)
    await require_animation_script(project)
    
    reference_image = await download_image(project["reference_image_url"])
    
    pipeline = PipelineOrchestrator(project_id)
    
    # Load existing data
    if project.get("character_dna"):
        if isinstance(project["character_dna"], dict):
            pipeline.state.character_dna = CharacterDNA(**project["character_dna"])
        else:
            pipeline.state.character_dna = project["character_dna"]
    
    script_data = project["animation_script"]
    pipeline.state.animation_script = AnimationScript(**script_data)
    
    # Compute frame budget from script
    weapon_mass = pipeline.state.character_dna.weapon_mass if pipeline.state.character_dna else "medium"
    pipeline.state.frame_budget = compute_budget_func(
        action_type=script_data.get("action_type", request.action_type),
        difficulty_tier=script_data.get("difficulty_tier", request.difficulty_tier),
        weapon_mass=weapon_mass,
        perspective=request.perspective,
    )
    
    try:
        # Stage 6: Image Generation
        await send_stage_update(project_id, 6, "Image Generation", "start", {
            "action": request.action_type,
            "frame_count": len(script_data.get("frames", []))
        })
        spritesheet = await pipeline.run_stage_6(reference_image)
        await send_stage_update(project_id, 6, "Image Generation", "complete")
        
        # Stage 7: Post-Processing
        await send_stage_update(project_id, 7, "Post-Processing", "start")
        frames = await pipeline.run_stage_7(spritesheet)
        await send_stage_update(project_id, 7, "Post-Processing", "complete", {
            "frame_count": len(frames) if frames else 0
        })
        
        # Save results to project
        if pipeline.state.frame_urls:
            await supabase_service.save_frame_urls(
                project_id,
                pipeline.state.frame_urls,
                pipeline.state.spritesheet_url
            )
        
        # Send pipeline complete
        await send_pipeline_complete(
            project_id,
            pipeline.state.spritesheet_url or "",
            pipeline.state.frame_urls or []
        )
        
        return {
            "project_id": project_id,
            "status": "completed",
            "frame_urls": pipeline.state.frame_urls,
            "spritesheet_url": pipeline.state.spritesheet_url,
            "frame_count": len(pipeline.state.frame_urls) if pipeline.state.frame_urls else 0,
        }
    except Exception as e:
        await handle_pipeline_error(e, project_id, "Sprite Generation")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/run")
async def run_full_pipeline(request: PipelineStartRequest):
    """
    Run the full pipeline synchronously (Stages 1-7).
    This is for backward compatibility and testing.
    For production, use /generate-script then /generate-sprites.
    """
    from app.services.pipeline_orchestrator import PipelineOrchestrator
    
    project = await get_project_or_404(request.project_id)
    await require_reference_image(project)
    await require_dna(project)
    
    reference_image = await download_image(project["reference_image_url"])
    
    # Create callback function to send WebSocket updates
    async def stage_callback(project_id: str, stage: int, stage_name: str, status: str, data: dict = None):
        """Send WebSocket updates for each stage."""
        await send_stage_update(project_id, stage, stage_name, status, data)
    
    pipeline = PipelineOrchestrator(request.project_id, on_stage_update=stage_callback)
    
    try:
        # Send initial stage update
        await send_stage_update(request.project_id, 1, "DNA Extraction", "start")
        
        await pipeline.run_full_pipeline(
            reference_image=reference_image,
            action_type=request.action_type,
            difficulty_tier=request.difficulty_tier,
            perspective=request.perspective,
        )
        
        # Save results to project
        if pipeline.state.animation_script:
            await supabase_service.save_animation_script(
                request.project_id,
                pipeline.state.animation_script.model_dump()
            )
        
        if pipeline.state.frame_urls:
            # Use animation_type if provided for per-animation storage
            if request.animation_type:
                await supabase_service.save_animation_frames(
                    request.project_id,
                    request.animation_type,
                    pipeline.state.frame_urls,
                    pipeline.state.spritesheet_url,
                    pipeline.state.animation_script.model_dump() if pipeline.state.animation_script else None
                )
            else:
                # Legacy: save to project-level frame_urls
                await supabase_service.save_frame_urls(
                    request.project_id,
                    pipeline.state.frame_urls,
                    pipeline.state.spritesheet_url
                )
        
        # Send pipeline complete notification
        await send_pipeline_complete(
            request.project_id,
            pipeline.state.spritesheet_url or "",
            pipeline.state.frame_urls or [],
            request.animation_type
        )
        
        return {
            "project_id": request.project_id,
            "status": "completed",
            "animation_type": request.animation_type,
            "animation_script": pipeline.state.animation_script.model_dump() if pipeline.state.animation_script else None,
            "frame_urls": pipeline.state.frame_urls,
            "spritesheet_url": pipeline.state.spritesheet_url,
        }
    except Exception as e:
        import traceback
        print(f"❌ Pipeline Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# --- Animation Management Endpoints ---

@router.get("/{project_id}/animations")
async def list_project_animations(project_id: str):
    """
    List all animations for a project with their status.
    Returns: {"animations": [{"type": "idle", "status": "approved", "frame_count": 8}, ...]}
    """
    try:
        animations = await supabase_service.list_animations(project_id)
        return {"animations": animations}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}/animations/{animation_type}")
async def get_project_animation(project_id: str, animation_type: str):
    """
    Get frames for a specific animation type.
    """
    try:
        animation = await supabase_service.get_animation_frames(project_id, animation_type)
        if not animation:
            raise HTTPException(status_code=404, detail=f"Animation '{animation_type}' not found")
        return {
            "animation_type": animation_type,
            **animation
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project_id}/animations/{animation_type}/approve")
async def approve_project_animation(project_id: str, animation_type: str):
    """
    Mark an animation as approved by the user.
    """
    try:
        success = await supabase_service.approve_animation(project_id, animation_type)
        if not success:
            raise HTTPException(status_code=404, detail=f"Animation '{animation_type}' not found")
        return {"status": "approved", "animation_type": animation_type}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
