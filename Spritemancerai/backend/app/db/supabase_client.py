from supabase import create_client, Client
from functools import lru_cache
from typing import Optional

from app.config import get_settings


@lru_cache
def get_supabase_client() -> Client:
    """Get cached Supabase client instance."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_key)


class SupabaseService:
    """Service for Supabase database and storage operations."""
    
    def __init__(self):
        self.client = get_supabase_client()
        self.settings = get_settings()
    
    # --- Storage Operations ---
    
    async def upload_image(self, bucket: str, path: str, file_bytes: bytes, content_type: str = "image/png", upsert: bool = False) -> str:
        """Upload an image to Supabase Storage."""
        self.client.storage.from_(bucket).upload(
            path=path,
            file=file_bytes,
            file_options={"content-type": content_type, "upsert": str(upsert).lower()}
        )
        return self.get_public_url(bucket, path)
    
    def get_public_url(self, bucket: str, path: str) -> str:
        """Get public URL for a stored file."""
        return self.client.storage.from_(bucket).get_public_url(path)
    
    async def delete_file(self, bucket: str, path: str) -> None:
        """Delete a file from storage."""
        self.client.storage.from_(bucket).remove([path])
    
    # --- Project Operations ---
    
    async def create_project(self, user_id: str, name: str, description: str = None) -> dict:
        """Create a new project record."""
        data = {
            "user_id": user_id,
            "name": name,
            "description": description,
            "status": "created",
        }
        result = self.client.table("projects").insert(data).execute()
        return result.data[0] if result.data else None
    
    async def get_project(self, project_id: str) -> Optional[dict]:
        """Get project by ID."""
        result = self.client.table("projects").select("*").eq("id", project_id).single().execute()
        return result.data
    
    async def update_project(self, project_id: str, updates: dict) -> Optional[dict]:
        """Update project fields."""
        result = self.client.table("projects").update(updates).eq("id", project_id).execute()
        return result.data[0] if result.data else None
    
    async def list_projects(self, user_id: str, limit: int = 50) -> list[dict]:
        """List projects for a user."""
        result = (
            self.client.table("projects")
            .select("id, name, status, generation_mode, preview_gif_url, reference_image_url, spritesheet_url, created_at, updated_at")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []
    
    # --- Character DNA Operations ---
    
    async def save_character_dna(self, project_id: str, dna: dict) -> None:
        """Save Character DNA for a project."""
        self.client.table("projects").update({
            "character_dna": dna,
            "status": "dna_extracted"
        }).eq("id", project_id).execute()
    
    async def get_character_dna(self, project_id: str) -> Optional[dict]:
        """Get Character DNA for a project."""
        result = (
            self.client.table("projects")
            .select("character_dna")
            .eq("id", project_id)
            .single()
            .execute()
        )
        return result.data.get("character_dna") if result.data else None
    
    # --- Animation Script & Frames Operations ---
    
    async def save_animation_script(self, project_id: str, script: dict) -> None:
        """Save animation script for a project."""
        self.client.table("projects").update({
            "animation_script": script,
            "status": "script_generated"
        }).eq("id", project_id).execute()
    
    async def get_animation_script(self, project_id: str) -> Optional[dict]:
        """Get animation script for a project."""
        result = (
            self.client.table("projects")
            .select("animation_script")
            .eq("id", project_id)
            .single()
            .execute()
        )
        return result.data.get("animation_script") if result.data else None
    
    async def save_frame_urls(self, project_id: str, frame_urls: list, spritesheet_url: str = None) -> None:
        """Save generated frame URLs for a project."""
        update_data = {
            "frame_urls": frame_urls,
            "status": "completed"
        }
        if spritesheet_url:
            update_data["spritesheet_url"] = spritesheet_url
        self.client.table("projects").update(update_data).eq("id", project_id).execute()
    
    async def get_frame_urls(self, project_id: str) -> Optional[dict]:
        """Get frame URLs for a project (including responder frames for dual mode)."""
        result = (
            self.client.table("projects")
            .select("frame_urls, spritesheet_url, responder_frame_urls, responder_spritesheet_url")
            .eq("id", project_id)
            .single()
            .execute()
        )
        if result.data:
            return {
                "frame_urls": result.data.get("frame_urls") or [],
                "spritesheet_url": result.data.get("spritesheet_url"),
                "responder_frame_urls": result.data.get("responder_frame_urls") or [],
                "responder_spritesheet_url": result.data.get("responder_spritesheet_url"),
            }
        return None
    
    # --- Generation Log ---
    
    async def log_generation(self, project_id: str, pipeline_id: str, metadata: dict) -> None:
        """Log a generation attempt."""
        data = {
            "project_id": project_id,
            "pipeline_id": pipeline_id,
            "metadata": metadata,
        }
        self.client.table("generation_logs").insert(data).execute()
    
    # --- Dual-Character Helper Methods ---
    
    async def save_dual_dna(
        self, 
        project_id: str, 
        instigator_dna: dict, 
        responder_dna: dict, 
        interaction_constraints: dict
    ) -> None:
        """Save DNA for both characters in dual mode."""
        self.client.table("projects").update({
            "generation_mode": "dual",
            "character_dna": instigator_dna,
            "responder_dna": responder_dna,
            "interaction_constraints": interaction_constraints,
            "status": "dna_extracted"
        }).eq("id", project_id).execute()
    
    async def save_responder_script(self, project_id: str, script: dict) -> None:
        """Save responder animation script."""
        self.client.table("projects").update({
            "responder_animation_script": script,
        }).eq("id", project_id).execute()
    
    async def save_dual_frame_urls(
        self, 
        project_id: str, 
        instigator_urls: list, 
        responder_urls: list,
        instigator_spritesheet: str = None,
        responder_spritesheet: str = None,
    ) -> None:
        """Save frame URLs for both characters."""
        update_data = {
            "frame_urls": instigator_urls,
            "responder_frame_urls": responder_urls,
            "status": "completed"
        }
        if instigator_spritesheet:
            update_data["spritesheet_url"] = instigator_spritesheet
        if responder_spritesheet:
            update_data["responder_spritesheet_url"] = responder_spritesheet
        self.client.table("projects").update(update_data).eq("id", project_id).execute()
    
    async def get_dual_project_data(self, project_id: str) -> Optional[dict]:
        """Get all dual-related fields for a project."""
        result = (
            self.client.table("projects")
            .select(
                "id, generation_mode, character_dna, responder_dna, "
                "interaction_constraints, animation_script, responder_animation_script, "
                "frame_urls, responder_frame_urls, spritesheet_url, responder_spritesheet_url, "
                "suggested_responder_actions, responder_action_type, "
                "action_type, difficulty_tier, perspective, animations"
            )
            .eq("id", project_id)
            .single()
            .execute()
        )
        return result.data
    
    # --- Animation-Specific Storage (Multiple Animations per Project) ---
    
    async def save_animation_frames(
        self, 
        project_id: str, 
        animation_type: str,
        frame_urls: list, 
        spritesheet_url: str = None,
        animation_script: dict = None
    ) -> None:
        """
        Save frames for a specific animation type (e.g., 'idle', 'walk', 'attack').
        This allows multiple animations per project without overwriting.
        """
        from datetime import datetime
        
        # Get existing animations dict
        project = await self.get_project(project_id)
        animations = project.get("animations") or {} if project else {}
        
        # Update this animation type
        animations[animation_type] = {
            "frame_urls": frame_urls,
            "spritesheet_url": spritesheet_url,
            "animation_script": animation_script,
            "status": "generated",
            "generated_at": datetime.utcnow().isoformat()
        }
        
        self.client.table("projects").update({
            "animations": animations
        }).eq("id", project_id).execute()
    
    async def get_animation_frames(
        self, 
        project_id: str, 
        animation_type: str = None
    ) -> Optional[dict]:
        """
        Get frames for a specific animation type or all animations.
        
        Args:
            project_id: Project ID
            animation_type: Optional - if provided, returns only that animation's data
                           If None, returns all animations dict
        """
        result = (
            self.client.table("projects")
            .select("animations")
            .eq("id", project_id)
            .single()
            .execute()
        )
        
        if not result.data:
            return None
        
        animations = result.data.get("animations") or {}
        
        if animation_type:
            return animations.get(animation_type)
        return animations
    
    async def list_animations(self, project_id: str) -> list[dict]:
        """
        List all animations for a project with their status.
        Returns: [{"type": "idle", "status": "approved", "frame_count": 8}, ...]
        """
        animations = await self.get_animation_frames(project_id)
        if not animations:
            return []
        
        return [
            {
                "type": anim_type,
                "status": anim_data.get("status", "unknown"),
                "frame_count": len(anim_data.get("frame_urls", [])),
                "spritesheet_url": anim_data.get("spritesheet_url"),
                "generated_at": anim_data.get("generated_at"),
            }
            for anim_type, anim_data in animations.items()
        ]
    
    async def approve_animation(self, project_id: str, animation_type: str) -> bool:
        """Mark an animation as approved by user."""
        project = await self.get_project(project_id)
        if not project:
            return False
        
        animations = project.get("animations") or {}
        
        if animation_type not in animations:
            return False
        
        animations[animation_type]["status"] = "approved"
        
        self.client.table("projects").update({
            "animations": animations
        }).eq("id", project_id).execute()
        
        return True


# Singleton instance
supabase_service = SupabaseService()

