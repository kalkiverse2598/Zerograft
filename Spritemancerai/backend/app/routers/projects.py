from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import uuid

router = APIRouter()


class ProjectCreate(BaseModel):
    """Request model for creating a new project."""
    name: str
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    """Response model for project data."""
    id: str
    name: str
    description: Optional[str]
    status: str
    reference_image_url: Optional[str]
    character_dna: Optional[dict]
    created_at: str
    # Dual-mode fields
    generation_mode: Optional[str] = None
    responder_reference_url: Optional[str] = None
    responder_dna: Optional[dict] = None
    interaction_constraints: Optional[dict] = None
    suggested_responder_actions: Optional[list] = None
    responder_action_type: Optional[str] = None
    animation_script: Optional[dict] = None
    responder_animation_script: Optional[dict] = None
    spritesheet_url: Optional[str] = None
    frame_urls: Optional[list] = None
    responder_spritesheet_url: Optional[str] = None
    responder_frame_urls: Optional[list] = None
    action_type: Optional[str] = None
    difficulty_tier: Optional[str] = None
    perspective: Optional[str] = None


@router.post("/", response_model=ProjectResponse)
async def create_project(project: ProjectCreate):
    """Create a new sprite generation project."""
    # Since we are using an anon key for now and no auth middleware yet, we'll mimic a user_id
    # In a real app, this comes from auth.jwt()
    fake_user_id = "00000000-0000-0000-0000-000000000000"
    
    # ... (imports)
    from app.db.supabase_client import supabase_service
    from app.models.project import Project
    from datetime import datetime
    
    data = {
        "user_id": fake_user_id,
        "name": project.name,
        "description": project.description,
        "status": "created",
        "reference_image_url": None,
        "character_dna": None,
        "latest_spritesheet_url": None,
        "generation_count": 0
    }
    
    # Insert into Supabase
    try:
        response = supabase_service.client.table("projects").insert(data).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to create project in database")
            
        record = response.data[0]
        return ProjectResponse(
            id=record['id'],
            name=record['name'],
            description=record['description'],
            status=record['status'],
            reference_image_url=record['reference_image_url'],
            character_dna=record['character_dna'],
            created_at=record['created_at'].split("T")[0], # simplified
        )
    except Exception as e:
        print(f"DB Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str):
    """Get project details by ID."""
    from app.db.supabase_client import supabase_service
    try:
        response = supabase_service.client.table("projects").select("*").eq("id", project_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Project not found")
            
        record = response.data[0]
        return ProjectResponse(
            id=record['id'],
            name=record['name'],
            description=record.get('description'),
            status=record['status'],
            reference_image_url=record.get('reference_image_url'),
            character_dna=record.get('character_dna'),
            created_at=record['created_at'].split("T")[0],
            # Dual-mode fields
            generation_mode=record.get('generation_mode'),
            responder_reference_url=record.get('responder_reference_url'),
            responder_dna=record.get('responder_dna'),
            interaction_constraints=record.get('interaction_constraints'),
            suggested_responder_actions=record.get('suggested_responder_actions'),
            responder_action_type=record.get('responder_action_type'),
            animation_script=record.get('animation_script'),
            responder_animation_script=record.get('responder_animation_script'),
            spritesheet_url=record.get('spritesheet_url'),
            frame_urls=record.get('frame_urls'),
            responder_spritesheet_url=record.get('responder_spritesheet_url'),
            responder_frame_urls=record.get('responder_frame_urls'),
            action_type=record.get('action_type'),
            difficulty_tier=record.get('difficulty_tier'),
            perspective=record.get('perspective'),
        )
    except Exception as e:
        print(f"DB Error: {e}")
        raise HTTPException(status_code=404, detail="Project not found")


@router.post("/{project_id}/reference-image")
async def upload_reference_image(project_id: str, file: UploadFile = File(...)):
    """Upload reference image for a project."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # 1. Read file content
    content = await file.read()
    
    # 2. Upload to Supabase Storage
    from app.db.supabase_client import supabase_service
    file_path = f"{project_id}/reference_{uuid.uuid4()}.png"
    
    try:
        # Check if bucket exists, if not create (simplified check by just trying upload)
        # Note: In production, ensure bucket 'sprites' exists or handle error
        public_url = await supabase_service.upload_image("sprites", file_path, content, file.content_type)
        
        # Update project with reference URL
        await supabase_service.update_project(project_id, {"reference_image_url": public_url})
        
    except Exception as e:
        print(f"❌ Storage Error: {e}")
        # Continue? No, we need the image for DNA
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {e}")

    # 3. Trigger Gemini DNA Extraction
    from app.services.stages.stage_1_dna_extraction import extract_character_dna
    try:
        print(f"🧬 Starting DNA Extraction for project {project_id}...")
        dna = await extract_character_dna(content)
        
        # 4. Save DNA to DB
        await supabase_service.save_character_dna(project_id, dna.dict())
        print(f"✅ DNA Extracted and Saved: {dna.archetype}")
        
        # 5. Send WebSocket notification to trigger UI refresh
        from app.routers.websocket import send_dna_extracted
        await send_dna_extracted(project_id, dna.dict())
        
        return {
            "project_id": project_id,
            "filename": file.filename,
            "status": "dna_extracted",
            "url": public_url,
            "dna": dna.dict()
        }
    except Exception as e:
        print(f"❌ Gemini/DNA Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to extract DNA: {e}")


@router.post("/{project_id}/reference-image/extract-dna")
async def extract_dna_from_reference(project_id: str):
    """
    Re-extract DNA from an already-uploaded reference image.
    Use this when initial DNA extraction failed or needs to be retried.
    """
    from app.db.supabase_client import supabase_service
    import httpx
    
    # 1. Get project to find reference image URL
    try:
        response = supabase_service.client.table("projects").select("reference_image_url").eq("id", project_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        reference_url = response.data[0].get("reference_image_url")
        if not reference_url:
            raise HTTPException(status_code=400, detail="No reference image uploaded. Upload image first.")
    except Exception as e:
        print(f"DB Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    # 2. Download the image from storage
    try:
        async with httpx.AsyncClient() as client:
            img_response = await client.get(reference_url)
            if img_response.status_code != 200:
                raise HTTPException(status_code=500, detail="Failed to fetch reference image from storage")
            content = img_response.content
    except Exception as e:
        print(f"❌ Image fetch error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch image: {e}")
    
    # 3. Run DNA extraction using Gemini
    from app.services.stages.stage_1_dna_extraction import extract_character_dna
    try:
        print(f"🧬 Re-extracting DNA for project {project_id}...")
        dna = await extract_character_dna(content)
        
        # 4. Save DNA to DB
        await supabase_service.save_character_dna(project_id, dna.dict())
        print(f"✅ DNA Re-extracted and Saved: {dna.archetype}")
        
        # 5. Send WebSocket notification to trigger UI refresh
        from app.routers.websocket import send_dna_extracted
        await send_dna_extracted(project_id, dna.dict())
        
        return {
            "project_id": project_id,
            "status": "dna_extracted",
            "dna": dna.dict()
        }
    except Exception as e:
        print(f"❌ Gemini/DNA Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to extract DNA: {e}")


class SyncReferenceRequest(BaseModel):
    """Request model for syncing reference image via base64."""
    image_base64: str
    description: Optional[str] = None
    character_dna: Optional[dict] = None


@router.post("/{project_id}/sync-reference")
async def sync_reference_image(project_id: str, request: SyncReferenceRequest):
    """
    Sync a reference image to Supabase using base64 data.
    
    Used when:
    1. AI generated a character but db_sync failed
    2. User drags a local file from Godot res:// to embedded editor
    3. Agent retries syncing after initial failure
    
    This creates the project if it doesn't exist, uploads the image,
    and optionally extracts DNA.
    """
    from app.db.supabase_client import supabase_service
    import base64
    
    try:
        # Decode base64 image
        image_bytes = base64.b64decode(request.image_base64)
        print(f"📥 Sync request: project={project_id}, image size={len(image_bytes)} bytes")
        
        # Check if project exists
        existing = supabase_service.client.table("projects").select("id").eq("id", project_id).execute()
        
        if not existing.data:
            # Create the project
            fake_user_id = "00000000-0000-0000-0000-000000000000"
            data = {
                "id": project_id,  # Use the provided project_id
                "user_id": fake_user_id,
                "name": (request.description or "Synced character")[:50],
                "description": request.description,
                "status": "reference_generated",
                "reference_image_url": None,
                "character_dna": request.character_dna,
                "latest_spritesheet_url": None,
                "generation_count": 0
            }
            response = supabase_service.client.table("projects").insert(data).execute()
            if not response.data:
                raise HTTPException(status_code=500, detail="Failed to create project")
            print(f"📁 Project created via sync: {project_id}")
        
        # Upload image to storage
        file_path = f"{project_id}/reference_{uuid.uuid4()}.png"
        public_url = await supabase_service.upload_image(
            "sprites", file_path, image_bytes, "image/png"
        )
        print(f"📤 Reference uploaded: {public_url}")
        
        # Update project with reference URL
        await supabase_service.update_project(project_id, {"reference_image_url": public_url})
        
        # Extract DNA if not provided
        dna = request.character_dna
        if not dna:
            from app.services.stages.stage_1_dna_extraction import extract_character_dna
            try:
                print(f"🧬 Extracting DNA for synced project...")
                extracted_dna = await extract_character_dna(image_bytes)
                dna = extracted_dna.dict()
                await supabase_service.save_character_dna(project_id, dna)
                print(f"✅ DNA extracted: {dna.get('archetype')}")
            except Exception as e:
                print(f"⚠️ DNA extraction failed during sync: {e}")
        
        return {
            "success": True,
            "project_id": project_id,
            "reference_image_url": public_url,
            "dna": dna,
            "message": "Project synced successfully"
        }
        
    except Exception as e:
        print(f"❌ Sync failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
async def list_projects():
    """List all projects for the current user."""
    from app.db.supabase_client import supabase_service
    try:
        response = supabase_service.client.table("projects").select("*").order("created_at", desc=True).execute()
        
        # Transform for response
        projects = []
        for record in response.data:
            projects.append(ProjectResponse(
                id=record['id'],
                name=record['name'],
                description=record['description'],
                status=record['status'],
                reference_image_url=record['reference_image_url'],
                character_dna=record['character_dna'],
                created_at=record['created_at'].split("T")[0]
            ))
            
        return {"projects": projects}
    except Exception as e:
        print(f"DB Error: {e}")
        return {"projects": []}


@router.post("/{project_id}/responder-image")
async def upload_responder_image(project_id: str, file: UploadFile = File(...)):
    """
    Upload responder (second character) reference image for dual-mode animation.
    This is used when generating relational animations between two characters.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # 1. Read file content
    content = await file.read()
    
    # 2. Upload to Supabase Storage
    from app.db.supabase_client import supabase_service
    file_path = f"{project_id}/responder_{uuid.uuid4()}.png"
    
    try:
        public_url = await supabase_service.upload_image("sprites", file_path, content, file.content_type)
        
        # Update project with responder reference URL
        await supabase_service.update_project(project_id, {"responder_reference_url": public_url})
        
    except Exception as e:
        print(f"❌ Storage Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {e}")

    return {
        "project_id": project_id,
        "filename": file.filename,
        "status": "uploaded",
        "url": public_url
    }


@router.post("/{project_id}/responder-image/extract-dna")
async def extract_responder_dna(project_id: str):
    """
    Extract DNA from the already-uploaded responder reference image.
    This should be called after upload_responder_image.
    """
    from app.db.supabase_client import supabase_service
    import httpx
    
    # 1. Get project to find responder image URL
    try:
        response = supabase_service.client.table("projects").select("responder_reference_url").eq("id", project_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        responder_url = response.data[0].get("responder_reference_url")
        if not responder_url:
            raise HTTPException(status_code=400, detail="No responder image uploaded. Upload image first.")
    except Exception as e:
        print(f"DB Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    # 2. Download the image from storage
    try:
        async with httpx.AsyncClient() as client:
            img_response = await client.get(responder_url)
            if img_response.status_code != 200:
                raise HTTPException(status_code=500, detail="Failed to fetch responder image from storage")
            content = img_response.content
    except Exception as e:
        print(f"❌ Image fetch error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch image: {e}")
    
    # 3. Run DNA extraction using Gemini
    from app.services.stages.stage_1_dna_extraction import extract_character_dna
    try:
        print(f"🧬 Starting Responder DNA Extraction for project {project_id}...")
        dna = await extract_character_dna(content)
        
        # 4. Save responder DNA to DB
        await supabase_service.update_project(project_id, {"responder_dna": dna.dict()})
        print(f"✅ Responder DNA Extracted and Saved: {dna.archetype}")
        
        return {
            "project_id": project_id,
            "status": "dna_extracted",
            "responder_dna": dna.dict()
        }
    except Exception as e:
        print(f"❌ Gemini/DNA Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to extract responder DNA: {e}")

