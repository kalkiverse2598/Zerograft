"""
Dual-character pipeline endpoints.
Handles /dual/* endpoints for two-character animations.
"""
from fastapi import APIRouter, HTTPException

from app.db.supabase_client import supabase_service
from app.routers.websocket import send_stage_update, send_pipeline_complete

from .schemas import DualPipelineRequest, ResponderConfirmRequest
from .helpers import (
    get_project_or_404,
    download_image,
    handle_pipeline_error,
)

router = APIRouter(prefix="/dual")


@router.post("/generate-script")
async def generate_dual_script(request: DualPipelineRequest):
    """
    Generate animation scripts for both instigator and responder (Dual Stages 1-7).
    Requires two reference images uploaded to the project.
    """
    from app.services.dual_pipeline_orchestrator import DualPipelineOrchestrator
    
    project_id = request.project_id
    
    project = await get_project_or_404(project_id)
    if not project.get("reference_image_url"):
        raise HTTPException(status_code=400, detail="No instigator reference image uploaded")
    if not project.get("responder_reference_url"):
        raise HTTPException(
            status_code=400, 
            detail="No responder reference image. Upload second image for dual mode."
        )
    
    # Download both reference images
    instigator_image = await download_image(project["reference_image_url"])
    responder_image = await download_image(project["responder_reference_url"])
    
    pipeline = DualPipelineOrchestrator(project_id)
    
    try:
        # Stage 1: Dual DNA Extraction
        await send_stage_update(project_id, 1, "Dual DNA Extraction", "start")
        dual_dna = await pipeline.run_stage_1(instigator_image, responder_image)
        await send_stage_update(project_id, 1, "Dual DNA Extraction", "complete", {
            "instigator": dual_dna.instigator.archetype,
            "responder": dual_dna.responder.archetype,
        })
        
        # Stage 3: Instigator Action Definition
        await send_stage_update(project_id, 3, "Action Definition", "start")
        frame_budget = await pipeline.run_stage_3(
            request.action_type,
            request.difficulty_tier,
            request.perspective
        )
        await send_stage_update(project_id, 3, "Action Definition", "complete", {
            "frame_count": frame_budget.final_frame_count
        })
        
        # Stage 4: Responder Action Suggestion
        await send_stage_update(project_id, 4, "Responder Suggestion", "start")
        suggestions = await pipeline.run_stage_4()
        await send_stage_update(project_id, 4, "Responder Suggestion", "complete", {
            "suggestions": [s.action for s in suggestions.suggested_actions]
        })
        
        # Save state for later
        await supabase_service.update_project(project_id, {
            "generation_mode": "dual",
            "action_type": request.action_type,
            "difficulty_tier": request.difficulty_tier,
            "perspective": request.perspective,
            "character_dna": pipeline.state.character_dna.model_dump() if pipeline.state.character_dna else None,
            "responder_dna": pipeline.state.responder_dna.model_dump() if pipeline.state.responder_dna else None,
            "interaction_constraints": pipeline.state.interaction_constraints,
            "suggested_responder_actions": pipeline.state.suggested_responder_actions,
        })
        
        return {
            "project_id": project_id,
            "status": "awaiting_responder_selection",
            "instigator_dna": dual_dna.instigator.model_dump(),
            "responder_dna": dual_dna.responder.model_dump(),
            "interaction": dual_dna.interaction.model_dump(),
            "frame_budget": frame_budget.model_dump(),
            "suggested_responder_actions": suggestions.model_dump(),
        }
    except Exception as e:
        await handle_pipeline_error(e, project_id, "Dual Script Generation")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/confirm-responder")
async def confirm_responder(request: ResponderConfirmRequest):
    """
    Confirm user-selected responder action and generate both scripts.
    """
    from app.models import CharacterDNA, InteractionConstraints
    from app.services.stages import compute_frame_budget, generate_biomech_script, generate_responder_script
    
    project_id = request.project_id
    
    project = await get_project_or_404(project_id)
    if project.get("generation_mode") != "dual":
        raise HTTPException(status_code=400, detail="Project is not in dual mode")
    
    # Restore state
    instigator_dna = CharacterDNA(**project["character_dna"])
    responder_dna = CharacterDNA(**project["responder_dna"])
    interaction = InteractionConstraints(**project["interaction_constraints"])
    
    try:
        # Compute frame budget
        frame_budget = compute_frame_budget(
            action_type=project.get("action_type") or "Attack",
            difficulty_tier=project.get("difficulty_tier") or "HEAVY",
            weapon_mass=instigator_dna.weapon_mass,
            perspective=project.get("perspective") or "side",
        )
        
        # Stage 5: Intent Mirroring (auto-confirm for dual)
        await send_stage_update(project_id, 5, "Intent Mirroring", "start")
        await send_stage_update(project_id, 5, "Intent Mirroring", "complete")
        
        # Stage 6: Instigator Script
        await send_stage_update(project_id, 6, "Instigator Script", "start")
        instigator_script = await generate_biomech_script(
            instigator_dna,
            project.get("action_type") or "Attack",
            project.get("difficulty_tier") or "HEAVY",
            frame_budget,
        )
        await send_stage_update(project_id, 6, "Instigator Script", "complete", {
            "frame_count": len(instigator_script.frames)
        })
        
        # Stage 7: Responder Script (DERIVED)
        await send_stage_update(project_id, 7, "Responder Script", "start")
        responder_script = await generate_responder_script(
            instigator_script=instigator_script,
            responder_dna=responder_dna,
            responder_action=request.responder_action,
            difficulty_tier=project.get("difficulty_tier") or "HEAVY",
            interaction=interaction,
        )
        await send_stage_update(project_id, 7, "Responder Script", "complete", {
            "frame_count": len(responder_script.frames)
        })
        
        # Save scripts
        await supabase_service.update_project(project_id, {
            "animation_script": instigator_script.model_dump(),
            "responder_animation_script": responder_script.model_dump(),
            "responder_action_type": request.responder_action,
        })
        
        return {
            "project_id": project_id,
            "status": "scripts_ready",
            "instigator_script": instigator_script.model_dump(),
            "responder_script": responder_script.model_dump(),
            "frame_count": len(instigator_script.frames),
        }
    except Exception as e:
        await handle_pipeline_error(e, project_id, "Dual Script Confirmation")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-sprites")
async def generate_dual_sprites(request: DualPipelineRequest):
    """
    Generate sprite images for both characters (Dual Stages 8-10).
    Requires both animation scripts to exist.
    """
    from app.services.dual_pipeline_orchestrator import DualPipelineOrchestrator
    from app.models import CharacterDNA, AnimationScript
    from app.services.stages import compute_frame_budget
    
    project_id = request.project_id
    
    project = await get_project_or_404(project_id)
    if not project.get("animation_script"):
        raise HTTPException(status_code=400, detail="No instigator script. Run /dual/generate-script first.")
    if not project.get("responder_animation_script"):
        raise HTTPException(status_code=400, detail="No responder script. Run /dual/confirm-responder first.")
    
    # Download reference images
    instigator_image = await download_image(project["reference_image_url"])
    responder_image = await download_image(project["responder_reference_url"])
    
    # Setup pipeline
    pipeline = DualPipelineOrchestrator(project_id)
    
    # Load existing data
    pipeline.state.character_dna = CharacterDNA(**project["character_dna"])
    pipeline.state.responder_dna = CharacterDNA(**project["responder_dna"])
    pipeline.state.animation_script = AnimationScript(**project["animation_script"])
    pipeline.state.responder_animation_script = AnimationScript(**project["responder_animation_script"])
    pipeline.state.intent_confirmed = True
    pipeline.state.responder_action_confirmed = True
    
    # Compute frame budget
    pipeline.state.frame_budget = compute_frame_budget(
        action_type=project.get("action_type") or request.action_type,
        difficulty_tier=project.get("difficulty_tier") or request.difficulty_tier,
        weapon_mass=pipeline.state.character_dna.weapon_mass,
        perspective=project.get("perspective") or request.perspective,
    )
    
    try:
        # Stage 8: Instigator Image Generation
        await send_stage_update(project_id, 8, "Instigator Sprites", "start")
        ins_spritesheet = await pipeline.run_stage_8(instigator_image)
        await send_stage_update(project_id, 8, "Instigator Sprites", "complete")
        
        # Stage 9: Responder Image Generation
        await send_stage_update(project_id, 9, "Responder Sprites", "start")
        resp_spritesheet = await pipeline.run_stage_9(responder_image)
        await send_stage_update(project_id, 9, "Responder Sprites", "complete")
        
        # Stage 10: Post-Processing (both)
        await send_stage_update(project_id, 10, "Post-Processing", "start")
        result = await pipeline.run_stage_10(ins_spritesheet, resp_spritesheet)
        await send_stage_update(project_id, 10, "Post-Processing", "complete", result)
        
        # Save results
        await supabase_service.update_project(project_id, {
            "spritesheet_url": pipeline.state.spritesheet_url,
            "frame_urls": pipeline.state.frame_urls,
            "responder_spritesheet_url": pipeline.state.responder_spritesheet_url,
            "responder_frame_urls": pipeline.state.responder_frame_urls,
        })
        
        # Send completion
        await send_pipeline_complete(
            project_id,
            pipeline.state.spritesheet_url or "",
            pipeline.state.frame_urls or []
        )
        
        return {
            "project_id": project_id,
            "status": "completed",
            "instigator": {
                "spritesheet_url": pipeline.state.spritesheet_url,
                "frame_urls": pipeline.state.frame_urls,
                "frame_count": len(pipeline.state.frame_urls),
            },
            "responder": {
                "spritesheet_url": pipeline.state.responder_spritesheet_url,
                "frame_urls": pipeline.state.responder_frame_urls,
                "frame_count": len(pipeline.state.responder_frame_urls),
            },
        }
    except Exception as e:
        await handle_pipeline_error(e, project_id, "Dual Sprite Generation")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}/status")
async def get_dual_pipeline_status(project_id: str):
    """Get current dual pipeline status for a project."""
    project = await get_project_or_404(project_id)
    
    is_dual = project.get("generation_mode") == "dual"
    
    return {
        "project_id": project_id,
        "generation_mode": project.get("generation_mode", "single"),
        "is_dual": is_dual,
        # Status flags
        "has_instigator_dna": project.get("character_dna") is not None,
        "has_responder_dna": project.get("responder_dna") is not None,
        "has_instigator_script": project.get("animation_script") is not None,
        "has_responder_script": project.get("responder_animation_script") is not None,
        "has_instigator_frames": project.get("frame_urls") is not None,
        "has_responder_frames": project.get("responder_frame_urls") is not None,
        # Actual data
        "instigator_dna": project.get("character_dna"),
        "responder_dna": project.get("responder_dna"),
        "interaction_constraints": project.get("interaction_constraints"),
        "instigator_script": project.get("animation_script"),
        "responder_script": project.get("responder_animation_script"),
        "instigator_spritesheet_url": project.get("spritesheet_url"),
        "instigator_frame_urls": project.get("frame_urls"),
        "responder_spritesheet_url": project.get("responder_spritesheet_url"),
        "responder_frame_urls": project.get("responder_frame_urls"),
        "suggested_responder_actions": project.get("suggested_responder_actions", []),
        "responder_action_type": project.get("responder_action_type"),
        # Pipeline parameters
        "action_type": project.get("action_type"),
        "difficulty_tier": project.get("difficulty_tier"),
        "perspective": project.get("perspective"),
    }
