from fastapi import APIRouter, HTTPException, Form, File, UploadFile
from pydantic import BaseModel
from typing import Literal, Optional
from enum import Enum

from app.db.supabase_client import supabase_service
from app.services.stages import compute_frame_budget
from app.routers.websocket import send_stage_update, send_pipeline_complete

router = APIRouter()


class DualPipelineErrorCode(str, Enum):
    """Error codes specific to dual-character pipeline."""
    MISSING_INSTIGATOR_IMAGE = "MISSING_INSTIGATOR_IMAGE"
    MISSING_RESPONDER_IMAGE = "MISSING_RESPONDER_IMAGE"
    INSTIGATOR_DNA_FAILED = "INSTIGATOR_DNA_FAILED"
    RESPONDER_DNA_FAILED = "RESPONDER_DNA_FAILED"
    INSTIGATOR_SCRIPT_FAILED = "INSTIGATOR_SCRIPT_FAILED"
    RESPONDER_SCRIPT_FAILED = "RESPONDER_SCRIPT_FAILED"
    TEMPORAL_BINDING_MISMATCH = "TEMPORAL_BINDING_MISMATCH"
    RESPONDER_ACTION_NOT_CONFIRMED = "RESPONDER_ACTION_NOT_CONFIRMED"
    INSTIGATOR_SPRITE_FAILED = "INSTIGATOR_SPRITE_FAILED"
    RESPONDER_SPRITE_FAILED = "RESPONDER_SPRITE_FAILED"


class PipelineStartRequest(BaseModel):
    """Request to start the sprite generation pipeline."""
    project_id: str
    action_type: str
    difficulty_tier: Literal["LIGHT", "HEAVY", "BOSS"]
    perspective: Literal["side", "front", "isometric", "top_down"] = "side"


class FrameBudgetRequest(BaseModel):
    """Request to compute frame budget."""
    project_id: str
    action_type: str
    difficulty_tier: Literal["LIGHT", "HEAVY", "BOSS"]
    perspective: Literal["side", "front", "isometric", "top_down"] = "side"


class DNAEditRequest(BaseModel):
    """Request to edit Character DNA."""
    project_id: str
    edits: dict
    character: Literal["instigator", "responder"] = "instigator"


class IntentConfirmRequest(BaseModel):
    """Request to confirm or reject intent mirroring."""
    project_id: str
    confirmed: bool
    feedback: Optional[str] = None


class RepairRequest(BaseModel):
    """Request to repair a frame."""
    project_id: str
    frame_index: int
    instruction: str
    mask_data: Optional[str] = None  # Base64 encoded mask image
    character: Optional[str] = "instigator"  # "instigator" or "responder" for dual mode


@router.post("/compute-budget")
async def compute_budget(request: FrameBudgetRequest):
    """
    Compute frame budget based on action, difficulty, and project DNA.
    Returns the computed frame budget with justification.
    """
    # Get project DNA to determine weapon mass
    project = await supabase_service.get_project(request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    dna = project.get("character_dna")
    weapon_mass = dna.get("weapon_mass", "medium") if dna else "medium"
    
    # Compute frame budget
    budget = compute_frame_budget(
        action_type=request.action_type,
        difficulty_tier=request.difficulty_tier,
        weapon_mass=weapon_mass,
        perspective=request.perspective,
    )
    
    # Generate intent summary
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
    # Validate project has DNA
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
    import httpx
    
    project_id = request.project_id
    
    # Validate project has DNA and reference image
    project = await supabase_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.get("reference_image_url"):
        raise HTTPException(status_code=400, detail="No reference image uploaded")
    if not project.get("character_dna"):
        raise HTTPException(status_code=400, detail="DNA not extracted yet")
    
    # Download reference image
    async with httpx.AsyncClient() as client:
        resp = await client.get(project["reference_image_url"])
        reference_image = resp.content
    
    # Run pipeline stages 1-5 only
    pipeline = PipelineOrchestrator(project_id)
    
    try:
        # Stage 1: DNA Extraction (uses cached DNA from project)
        await send_stage_update(project_id, 1, "DNA Extraction", "start")
        pipeline.state.character_dna = project.get("character_dna")
        if isinstance(pipeline.state.character_dna, dict):
            from app.models import CharacterDNA
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
        import traceback
        print(f"❌ Script Generation Error: {e}")
        traceback.print_exc()
        await send_stage_update(project_id, 0, "Error", "error", {"message": str(e)})
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-sprites")
async def generate_sprites(request: PipelineStartRequest):
    """
    Generate sprite images (Stages 6-7).
    Requires animation script to already exist from /generate-script.
    """
    from app.services.pipeline_orchestrator import PipelineOrchestrator
    from app.models import CharacterDNA, AnimationScript, FrameBudget
    import httpx
    
    project_id = request.project_id
    
    # Validate project has DNA, reference image, AND animation script
    project = await supabase_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.get("reference_image_url"):
        raise HTTPException(status_code=400, detail="No reference image uploaded")
    if not project.get("animation_script"):
        raise HTTPException(
            status_code=400, 
            detail="No animation script. Run /generate-script first."
        )
    
    # Download reference image
    async with httpx.AsyncClient() as client:
        resp = await client.get(project["reference_image_url"])
        reference_image = resp.content
    
    # Setup pipeline with existing script
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
    from app.services.stages import compute_frame_budget
    weapon_mass = pipeline.state.character_dna.weapon_mass if pipeline.state.character_dna else "medium"
    pipeline.state.frame_budget = compute_frame_budget(
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
        import traceback
        print(f"❌ Sprite Generation Error: {e}")
        traceback.print_exc()
        await send_stage_update(project_id, 0, "Error", "error", {"message": str(e)})
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/run")
async def run_full_pipeline(request: PipelineStartRequest):
    """
    Run the full pipeline synchronously (Stages 1-7).
    This is for backward compatibility and testing.
    For production, use /generate-script then /generate-sprites.
    """
    from app.services.pipeline_orchestrator import PipelineOrchestrator
    import httpx
    
    # Validate project has DNA and reference image
    project = await supabase_service.get_project(request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.get("reference_image_url"):
        raise HTTPException(status_code=400, detail="No reference image uploaded")
    if not project.get("character_dna"):
        raise HTTPException(status_code=400, detail="DNA not extracted yet")
    
    # Download reference image
    async with httpx.AsyncClient() as client:
        resp = await client.get(project["reference_image_url"])
        reference_image = resp.content
    
    # Run pipeline
    pipeline = PipelineOrchestrator(request.project_id)
    
    try:
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
            await supabase_service.save_frame_urls(
                request.project_id,
                pipeline.state.frame_urls,
                pipeline.state.spritesheet_url
            )
        
        return {
            "project_id": request.project_id,
            "status": "completed",
            "animation_script": pipeline.state.animation_script.model_dump() if pipeline.state.animation_script else None,
            "frame_urls": pipeline.state.frame_urls,
            "spritesheet_url": pipeline.state.spritesheet_url,
        }
    except Exception as e:
        import traceback
        print(f"❌ Pipeline Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/dna/edit")
async def edit_dna(request: DNAEditRequest):
    """
    Edit Character DNA with verification.
    Triggers Stage 2 DNA Verification.
    Supports both instigator and responder characters for dual mode.
    """
    from app.services.stages.stage_2_dna_verification import verify_dna_edit, apply_verified_edit
    from app.models import CharacterDNA
    import httpx
    
    project_id = request.project_id
    
    # Get project
    project = await supabase_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
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
        async with httpx.AsyncClient() as client:
            img_response = await client.get(image_url)
            reference_image = img_response.content
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


@router.get("/{project_id}/status")
async def get_pipeline_status(project_id: str):
    """Get current pipeline status for a project."""
    project = await supabase_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
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
async def get_frames(project_id: str):
    """Get the generated frames for a project."""
    result = await supabase_service.get_frame_urls(project_id)
    if not result or not result.get("frame_urls"):
        raise HTTPException(status_code=404, detail="No frames found. Run the pipeline first.")
    
    return result


@router.post("/repair")
async def repair_frame(request: RepairRequest):
    """
    Repair a specific frame using Stage 8.
    Now includes previous frames AND animation script as context for better repairs.
    Supports dual mode with character selection (instigator or responder).
    """
    from app.services.stages.stage_8_repair_loop import repair_frame as do_repair
    
    # Determine which character's frames to repair
    is_responder = request.character == "responder"
    
    # Get current frames based on character
    result = await supabase_service.get_frame_urls(request.project_id)
    if not result:
        raise HTTPException(status_code=404, detail="No frames to repair")
    
    if is_responder:
        frame_urls = result.get("responder_frame_urls", [])
        if not frame_urls:
            raise HTTPException(status_code=404, detail="No responder frames to repair")
    else:
        frame_urls = result.get("frame_urls", [])
        if not frame_urls:
            raise HTTPException(status_code=404, detail="No frames to repair")
    
    if request.frame_index >= len(frame_urls):
        raise HTTPException(status_code=400, detail=f"Frame index {request.frame_index} out of range")
    
    # Get project for reference image
    project = await supabase_service.get_project(request.project_id)
    
    # Use correct reference image based on character
    if is_responder:
        reference_url = project.get("responder_reference_url") or project.get("reference_image_url")
    else:
        reference_url = project.get("reference_image_url")
    
    if not reference_url:
        raise HTTPException(status_code=400, detail="Project has no reference image")
    
    # Get animation script for frame context (use correct script for character)
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
                char_label = "Responder" if is_responder else "Instigator"
                print(f"📜 {char_label} Frame {request.frame_index} script: {frame_script.get('phase', 'N/A')} - {frame_script.get('pose_description', 'N/A')[:50]}...")
    except Exception as e:
        print(f"⚠️ Could not get animation script: {e}")
    
    # Download the frame to repair, reference image, and previous frames for context
    import httpx
    import cv2
    import numpy as np
    
    async with httpx.AsyncClient() as client:
        frame_resp = await client.get(frame_urls[request.frame_index])
        frame_bytes = frame_resp.content
        
        ref_resp = await client.get(reference_url)
        reference_bytes = ref_resp.content
        
        # Download frame 1 to get canonical height (scale reference) and target dimensions
        canonical_height = None
        target_width = None
        target_height = None
        if len(frame_urls) > 0:
            frame1_resp = await client.get(frame_urls[0])
            frame1_bytes = frame1_resp.content
            nparr = np.frombuffer(frame1_bytes, np.uint8)
            frame1_img = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
            if frame1_img is not None:
                # Get target dimensions from frame 1 (all frames should match)
                target_height, target_width = frame1_img.shape[:2]
                print(f"📐 Target dimensions from frame 1: {target_width}x{target_height}px")
                
                # Get sprite bounding box from alpha channel or non-white pixels
                if frame1_img.shape[2] == 4:
                    alpha = frame1_img[:, :, 3]
                    coords = cv2.findNonZero(alpha)
                else:
                    gray = cv2.cvtColor(frame1_img, cv2.COLOR_BGR2GRAY)
                    _, binary = cv2.threshold(gray, 250, 255, cv2.THRESH_BINARY_INV)
                    coords = cv2.findNonZero(binary)
                
                if coords is not None:
                    _, _, _, canonical_height = cv2.boundingRect(coords)
                    print(f"📏 Canonical height from frame 1: {canonical_height}px")
        
        # Get current frame bounds
        current_frame_bounds = None
        nparr = np.frombuffer(frame_bytes, np.uint8)
        current_img = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
        if current_img is not None:
            if len(current_img.shape) == 3 and current_img.shape[2] == 4:
                alpha = current_img[:, :, 3]
                coords = cv2.findNonZero(alpha)
            else:
                gray = cv2.cvtColor(current_img, cv2.COLOR_BGR2GRAY)
                _, binary = cv2.threshold(gray, 250, 255, cv2.THRESH_BINARY_INV)
                coords = cv2.findNonZero(binary)
            
            if coords is not None:
                _, _, w, h = cv2.boundingRect(coords)
                current_frame_bounds = (w, h)
                print(f"📐 Current frame {request.frame_index} bounds: {w}x{h}px")
        
        # Download previous 1-2 frames for context
        context_frames = []
        for prev_idx in range(request.frame_index - 2, request.frame_index):
            if prev_idx >= 0:
                prev_resp = await client.get(frame_urls[prev_idx])
                context_frames.append(prev_resp.content)
        
        if context_frames:
            print(f"📚 Providing {len(context_frames)} previous frames as context for frame {request.frame_index}")
    
    # Create mask from provided data or generate full-white mask
    mask_bytes = None
    if request.mask_data:
        import base64
        mask_bytes = base64.b64decode(request.mask_data)
    else:
        # Generate full-white mask (entire frame editable)
        import cv2
        import numpy as np
        nparr = np.frombuffer(frame_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
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
        
        # Upload repaired frame (now with transparent background applied)
        import uuid
        char_prefix = "responder_" if is_responder else ""
        path = f"{request.project_id}/{char_prefix}repaired_frame_{request.frame_index}_{uuid.uuid4().hex[:8]}.png"
        new_url = await supabase_service.upload_image("sprites", path, repaired)
        
        # Update frame URLs for the correct character
        frame_urls[request.frame_index] = new_url
        if is_responder:
            # Save responder frame URLs (sync call - no await)
            supabase_service.client.table("projects").update({
                "responder_frame_urls": frame_urls
            }).eq("id", request.project_id).execute()
        else:
            await supabase_service.save_frame_urls(request.project_id, frame_urls)
        
        char_label = "responder" if is_responder else "instigator"
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
    character: str = Form("instigator"),  # "instigator" or "responder" for dual mode
):
    """
    Save a manually edited frame from the pixel editor.
    Accepts multipart form data with the edited image.
    Supports dual mode with character selection.
    """
    import uuid
    
    is_responder = character == "responder"
    
    # Get frame URLs based on character
    result = await supabase_service.get_frame_urls(project_id)
    if not result:
        raise HTTPException(status_code=404, detail="No frames found")
    
    if is_responder:
        frame_urls = result.get("responder_frame_urls", [])
        if not frame_urls:
            raise HTTPException(status_code=404, detail="No responder frames found")
    else:
        frame_urls = result.get("frame_urls", [])
        if not frame_urls:
            raise HTTPException(status_code=404, detail="No frames found")
    
    if frame_index >= len(frame_urls):
        raise HTTPException(status_code=400, detail=f"Frame index {frame_index} out of range")
    
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
            # Sync call - no await
            supabase_service.client.table("projects").update({
                "responder_frame_urls": frame_urls
            }).eq("id", project_id).execute()
        else:
            await supabase_service.save_frame_urls(project_id, frame_urls)
        
        char_label = "responder" if is_responder else "instigator"
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


# === New Endpoints ===

class PivotUpdateRequest(BaseModel):
    """Request to update frame pivots."""
    project_id: str
    pivots: list[dict]  # [{x: float, y: float}, ...]


class ScriptUpdateRequest(BaseModel):
    """Request to update animation script."""
    project_id: str
    script: dict  # {frames: [...]}


@router.get("/{project_id}/suggest-actions")
async def suggest_actions(project_id: str):
    """
    Get AI-suggested animation actions based on character DNA.
    Uses Stage 3a Action Suggestion logic.
    """
    from app.services.stages.stage_3a_action_suggestion import suggest_actions as get_suggestions
    
    project = await supabase_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
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
    project = await supabase_service.get_project(request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
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
    project = await supabase_service.get_project(request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
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


# ============================================================
# DUAL-CHARACTER ANIMATION ENDPOINTS
# ============================================================

class DualPipelineRequest(BaseModel):
    """Request for dual-character animation pipeline."""
    project_id: str
    action_type: str
    difficulty_tier: Literal["LIGHT", "HEAVY", "BOSS"]
    perspective: Literal["side", "front", "isometric", "top_down"] = "side"


class ResponderConfirmRequest(BaseModel):
    """Request to confirm responder action selection."""
    project_id: str
    responder_action: str


@router.post("/dual/generate-script")
async def generate_dual_script(request: DualPipelineRequest):
    """
    Generate animation scripts for both instigator and responder (Dual Stages 1-7).
    Requires two reference images uploaded to the project.
    """
    from app.services.dual_pipeline_orchestrator import DualPipelineOrchestrator
    from app.routers.websocket import send_stage_update
    import httpx
    
    project_id = request.project_id
    
    # Validate project has both reference images
    project = await supabase_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.get("reference_image_url"):
        raise HTTPException(status_code=400, detail="No instigator reference image uploaded")
    if not project.get("responder_reference_url"):
        raise HTTPException(
            status_code=400, 
            detail="No responder reference image. Upload second image for dual mode."
        )
    
    # Download both reference images
    async with httpx.AsyncClient() as client:
        ins_resp = await client.get(project["reference_image_url"])
        instigator_image = ins_resp.content
        
        resp_resp = await client.get(project["responder_reference_url"])
        responder_image = resp_resp.content
    
    # Run dual pipeline stages 1-7 (scripts only)
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
        import traceback
        print(f"❌ Dual Script Generation Error: {e}")
        traceback.print_exc()
        await send_stage_update(project_id, 0, "Error", "error", {"message": str(e)})
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/dual/confirm-responder")
async def confirm_responder(request: ResponderConfirmRequest):
    """
    Confirm user-selected responder action and generate both scripts.
    """
    from app.services.dual_pipeline_orchestrator import DualPipelineOrchestrator
    from app.models import CharacterDNA, InteractionConstraints
    from app.services.stages import compute_frame_budget, generate_biomech_script, generate_responder_script
    from app.routers.websocket import send_stage_update
    
    project_id = request.project_id
    
    # Get project with stored state
    project = await supabase_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.get("generation_mode") != "dual":
        raise HTTPException(status_code=400, detail="Project is not in dual mode")
    
    # Restore state
    instigator_dna = CharacterDNA(**project["character_dna"])
    responder_dna = CharacterDNA(**project["responder_dna"])
    interaction = InteractionConstraints(**project["interaction_constraints"])
    
    try:
        # Compute frame budget (use `or` to handle None values from DB)
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
        import traceback
        print(f"❌ Dual Script Confirmation Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/dual/generate-sprites")
async def generate_dual_sprites(request: DualPipelineRequest):
    """
    Generate sprite images for both characters (Dual Stages 8-10).
    Requires both animation scripts to exist.
    """
    from app.services.dual_pipeline_orchestrator import DualPipelineOrchestrator
    from app.models import CharacterDNA, AnimationScript
    from app.services.stages import compute_frame_budget
    from app.routers.websocket import send_stage_update, send_pipeline_complete
    import httpx
    
    project_id = request.project_id
    
    # Validate project has both scripts
    project = await supabase_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.get("animation_script"):
        raise HTTPException(status_code=400, detail="No instigator script. Run /dual/generate-script first.")
    if not project.get("responder_animation_script"):
        raise HTTPException(status_code=400, detail="No responder script. Run /dual/confirm-responder first.")
    
    # Download reference images
    async with httpx.AsyncClient() as client:
        ins_resp = await client.get(project["reference_image_url"])
        instigator_image = ins_resp.content
        
        resp_resp = await client.get(project["responder_reference_url"])
        responder_image = resp_resp.content
    
    # Setup pipeline
    pipeline = DualPipelineOrchestrator(project_id)
    
    # Load existing data
    pipeline.state.character_dna = CharacterDNA(**project["character_dna"])
    pipeline.state.responder_dna = CharacterDNA(**project["responder_dna"])
    pipeline.state.animation_script = AnimationScript(**project["animation_script"])
    pipeline.state.responder_animation_script = AnimationScript(**project["responder_animation_script"])
    pipeline.state.intent_confirmed = True
    pipeline.state.responder_action_confirmed = True
    
    # Compute frame budget - use 'or' to handle None values from DB
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
        import traceback
        print(f"❌ Dual Sprite Generation Error: {e}")
        traceback.print_exc()
        await send_stage_update(project_id, 0, "Error", "error", {"message": str(e)})
        raise HTTPException(status_code=500, detail=str(e))


class ReprocessRequest(BaseModel):
    """Request to reprocess spritesheet with manual grid parameters."""
    project_id: str
    grid_rows: int
    grid_cols: int
    frame_count: int
    character: Literal["instigator", "responder"] = "instigator"


@router.post("/reprocess")
async def reprocess_spritesheet(request: ReprocessRequest):
    """
    Re-extract frames from spritesheet with manual grid parameters.
    Use this when automatic extraction produces wrong results.
    """
    import cv2
    import numpy as np
    import httpx
    
    from app.services.stages.stage_7_post_processing import (
        extract_frames,
        normalize_frames,
        encode_frame_png,
    )
    
    project = await supabase_service.get_project(request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get the correct spritesheet URL
    is_responder = request.character == "responder"
    if is_responder:
        spritesheet_url = project.get("responder_spritesheet_url")
        if not spritesheet_url:
            raise HTTPException(status_code=404, detail="No responder spritesheet found")
    else:
        spritesheet_url = project.get("spritesheet_url")
        if not spritesheet_url:
            raise HTTPException(status_code=404, detail="No spritesheet found")
    
    try:
        print(f"🔄 Reprocessing {request.character} spritesheet with grid {request.grid_rows}x{request.grid_cols}")
        
        # Download the spritesheet
        async with httpx.AsyncClient() as client:
            response = await client.get(spritesheet_url)
            spritesheet_bytes = response.content
        
        # Decode image
        nparr = np.frombuffer(spritesheet_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
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
        
        # Upload new frames with unique timestamp to avoid conflicts
        import uuid
        import time
        batch_id = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
        
        new_frame_urls = []
        char_prefix = "responder_" if is_responder else ""
        
        for i, frame in enumerate(normalized):
            frame_bytes = encode_frame_png(frame)
            path = f"{request.project_id}/{char_prefix}reprocess_{batch_id}_frame_{i:02d}.png"
            url = await supabase_service.upload_image("sprites", path, frame_bytes)
            new_frame_urls.append(url)
            print(f"  ✅ Uploaded {request.character} frame {i}")
        
        # Update database with new frame URLs
        if is_responder:
            supabase_service.client.table("projects").update({
                "responder_frame_urls": new_frame_urls
            }).eq("id", request.project_id).execute()
        else:
            await supabase_service.save_frame_urls(request.project_id, new_frame_urls)
        
        print(f"✅ Reprocessed {len(new_frame_urls)} {request.character} frames successfully")
        
        return {
            "status": "success",
            "frame_count": len(new_frame_urls),
            "frame_urls": new_frame_urls,
            "character": request.character,
            "grid": f"{request.grid_rows}x{request.grid_cols}",
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dual/{project_id}/status")
async def get_dual_pipeline_status(project_id: str):
    """Get current dual pipeline status for a project."""
    project = await supabase_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
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


# ============================================================
# LIGHTING MAP GENERATION (Stage 7b)
# ============================================================

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
    import httpx
    import cv2
    import numpy as np
    import uuid
    import math
    
    # Get project frames
    result = await supabase_service.get_frame_urls(project_id)
    if not result or not result.get("frame_urls"):
        raise HTTPException(status_code=404, detail="No frames found. Generate sprites first.")
    
    frame_urls = result["frame_urls"]
    
    # Download each frame and convert to ExtractedFrame
    extracted_frames: list[ExtractedFrame] = []
    frame_width = 0
    frame_height = 0
    
    async with httpx.AsyncClient() as client:
        for idx, url in enumerate(frame_urls):
            resp = await client.get(url)
            nparr = np.frombuffer(resp.content, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
            
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
    project = await supabase_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
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

