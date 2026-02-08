"""
Pipeline Orchestrator

Coordinates the full 8-stage sprite generation pipeline.
"""
from typing import Literal, Optional
import uuid
from datetime import datetime

from app.models import (
    CharacterDNA,
    AnimationScript,
    FrameBudget,
    PipelineState,
    PipelineStage,
)
from app.db import redis_client, supabase_service
from app.services.stages import (
    extract_character_dna,
    verify_dna_edit,
    apply_verified_edit,
    suggest_actions,
    validate_action,
    compute_frame_budget,
    mirror_intent,
    generate_biomech_script,
    generate_spritesheet,
    extract_frames,
    normalize_frames,
    encode_frame_png,
    repair_frame,
)


STAGE_NAMES = {
    1: "DNA Extraction",
    2: "DNA Verification",
    3: "Action Definition",
    4: "Intent Mirroring",
    5: "Biomechanical Scripting",
    6: "Image Generation",
    7: "Post-Processing",
    8: "Repair Loop",
}


class PipelineOrchestrator:
    """Orchestrates the 8-stage sprite generation pipeline."""
    
    def __init__(self, project_id: str, on_stage_update=None):
        """
        Initialize pipeline orchestrator.
        
        Args:
            project_id: Project ID to run pipeline for
            on_stage_update: Optional callback for WebSocket updates
        """
        self.project_id = project_id
        self.pipeline_id = str(uuid.uuid4())
        self.on_stage_update = on_stage_update
        self._state: Optional[PipelineState] = None
    
    @property
    def state(self) -> PipelineState:
        """Get current pipeline state."""
        if self._state is None:
            self._state = PipelineState(
                project_id=self.project_id,
                pipeline_id=self.pipeline_id,
                status="idle",
                current_stage=0,
            )
        return self._state
    
    async def _notify_stage_start(self, stage: int):
        """Notify stage start via callback."""
        if self.on_stage_update:
            await self.on_stage_update(
                self.project_id, stage, STAGE_NAMES[stage], "start", {}
            )
    
    async def _notify_stage_complete(self, stage: int, result: dict):
        """Notify stage completion via callback."""
        if self.on_stage_update:
            await self.on_stage_update(
                self.project_id, stage, STAGE_NAMES[stage], "complete", result
            )
    
    async def _notify_stage_error(self, stage: int, error: str):
        """Notify stage error via callback."""
        if self.on_stage_update:
            await self.on_stage_update(
                self.project_id, stage, STAGE_NAMES[stage], "error", {"error": error}
            )
    
    async def _update_stage(
        self,
        stage: int,
        status: str,
        result: Optional[dict] = None,
        error: Optional[str] = None,
    ):
        """Update stage status in state."""
        stage_data = PipelineStage(
            stage_number=stage,
            stage_name=STAGE_NAMES[stage],
            status=status,
            started_at=datetime.utcnow() if status == "running" else None,
            completed_at=datetime.utcnow() if status in ("completed", "failed") else None,
            result=result,
            error=error,
        )
        
        # Update state
        existing = self.state.get_stage(stage)
        if existing:
            idx = self.state.stages.index(existing)
            self.state.stages[idx] = stage_data
        else:
            self.state.stages.append(stage_data)
        
        self.state.current_stage = stage
        self.state.updated_at = datetime.utcnow()
        
        # Save to Redis
        await redis_client.save_pipeline_state(
            self.project_id,
            self.state.model_dump(mode="json"),
        )
    
    # --- Stage 1: DNA Extraction ---
    
    async def run_stage_1(self, reference_image: bytes) -> CharacterDNA:
        """Extract Character DNA from reference image."""
        await self._notify_stage_start(1)
        await self._update_stage(1, "running")
        
        try:
            dna = await extract_character_dna(reference_image)
            self.state.character_dna = dna
            
            await self._update_stage(1, "completed", {"dna": dna.model_dump()})
            await self._notify_stage_complete(1, {"dna": dna.model_dump()})
            
            return dna
        except Exception as e:
            await self._update_stage(1, "failed", error=str(e))
            await self._notify_stage_error(1, str(e))
            raise
    
    # --- Stage 2: DNA Verification ---
    
    async def run_stage_2(
        self,
        user_edit: dict,
        reference_image: bytes,
    ) -> CharacterDNA:
        """Verify and apply user edits to DNA."""
        await self._notify_stage_start(2)
        await self._update_stage(2, "running")
        
        try:
            if not self.state.character_dna:
                raise ValueError("No DNA to verify. Run Stage 1 first.")
            
            verification = await verify_dna_edit(
                self.state.character_dna,
                user_edit,
                reference_image,
            )
            
            if verification.claim_verified:
                updated_dna = await apply_verified_edit(
                    self.state.character_dna,
                    user_edit,
                    verification,
                )
                self.state.character_dna = updated_dna
                self.state.dna_verified = True
            
            result = {
                "verification": verification.model_dump(),
                "dna": self.state.character_dna.model_dump(),
            }
            
            await self._update_stage(2, "completed", result)
            await self._notify_stage_complete(2, result)
            
            return self.state.character_dna
        except Exception as e:
            await self._update_stage(2, "failed", error=str(e))
            await self._notify_stage_error(2, str(e))
            raise
    
    # --- Stage 3: Action Definition ---
    
    async def run_stage_3(
        self,
        action_type: str,
        difficulty_tier: Literal["LIGHT", "HEAVY", "BOSS"],
        perspective: Literal["side", "front", "isometric", "top_down"] = "side",
    ) -> FrameBudget:
        """Validate action and compute frame budget."""
        await self._notify_stage_start(3)
        await self._update_stage(3, "running")
        
        try:
            if not self.state.character_dna:
                raise ValueError("No DNA available. Run Stage 1 first.")
            
            # Validate action
            validation = await validate_action(
                self.state.character_dna,
                action_type,
                difficulty_tier,
            )
            
            if validation.status == "INVALID":
                raise ValueError(f"Invalid action: {validation.reason}")
            
            # Compute frame budget
            frame_budget = compute_frame_budget(
                action_type=action_type,
                difficulty_tier=difficulty_tier,
                weapon_mass=self.state.character_dna.weapon_mass,
                perspective=perspective,
            )
            
            self.state.action_type = action_type
            self.state.difficulty_tier = difficulty_tier
            self.state.perspective = perspective
            self.state.frame_budget = frame_budget
            
            result = {
                "validation": validation.model_dump(),
                "frame_budget": frame_budget.model_dump(),
            }
            
            await self._update_stage(3, "completed", result)
            await self._notify_stage_complete(3, result)
            
            return frame_budget
        except Exception as e:
            await self._update_stage(3, "failed", error=str(e))
            await self._notify_stage_error(3, str(e))
            raise
    
    # --- Stage 4: Intent Mirroring ---
    
    async def run_stage_4(self) -> str:
        """Generate intent summary for confirmation."""
        await self._notify_stage_start(4)
        await self._update_stage(4, "running")
        
        try:
            if not all([self.state.character_dna, self.state.action_type, self.state.frame_budget]):
                raise ValueError("Missing prerequisites. Run stages 1-3 first.")
            
            intent = await mirror_intent(
                self.state.character_dna,
                self.state.action_type,
                self.state.difficulty_tier,
                self.state.frame_budget,
            )
            
            self.state.intent_summary = intent.intent_summary
            
            result = intent.model_dump()
            
            await self._update_stage(4, "completed", result)
            await self._notify_stage_complete(4, result)
            
            return intent.intent_summary
        except Exception as e:
            await self._update_stage(4, "failed", error=str(e))
            await self._notify_stage_error(4, str(e))
            raise
    
    async def confirm_intent(self, confirmed: bool):
        """Confirm or reject intent."""
        self.state.intent_confirmed = confirmed
        await redis_client.save_pipeline_state(
            self.project_id,
            self.state.model_dump(mode="json"),
        )
    
    # --- Stage 5: Biomechanical Scripting ---
    
    async def run_stage_5(self) -> AnimationScript:
        """Generate biomechanical animation script."""
        await self._notify_stage_start(5)
        await self._update_stage(5, "running")
        
        try:
            if not self.state.intent_confirmed:
                raise ValueError("Intent not confirmed. Confirm Stage 4 first.")
            
            script = await generate_biomech_script(
                self.state.character_dna,
                self.state.action_type,
                self.state.difficulty_tier,
                self.state.frame_budget,
            )
            
            self.state.animation_script = script
            
            result = script.model_dump()
            
            await self._update_stage(5, "completed", result)
            await self._notify_stage_complete(5, result)
            
            return script
        except Exception as e:
            await self._update_stage(5, "failed", error=str(e))
            await self._notify_stage_error(5, str(e))
            raise
    
    # --- Stage 6: Image Generation ---
    
    async def run_stage_6(self, reference_image: bytes) -> bytes:
        """Generate spritesheet image."""
        await self._notify_stage_start(6)
        await self._update_stage(6, "running")
        
        try:
            if not self.state.animation_script:
                raise ValueError("No animation script. Run Stage 5 first.")
            
            spritesheet = await generate_spritesheet(
                reference_image=reference_image,
                dna=self.state.character_dna,
                script=self.state.animation_script,
                grid_dim=self.state.frame_budget.grid_dim,
            )
            
            # Upload to Supabase Storage
            path = f"{self.project_id}/{self.pipeline_id}/spritesheet.png"
            url = await supabase_service.upload_image(
                bucket="sprites",
                path=path,
                file_bytes=spritesheet,
            )
            
            self.state.spritesheet_url = url
            
            result = {"spritesheet_url": url}
            
            await self._update_stage(6, "completed", result)
            await self._notify_stage_complete(6, result)
            
            return spritesheet
        except Exception as e:
            await self._update_stage(6, "failed", error=str(e))
            await self._notify_stage_error(6, str(e))
            raise
    
    # --- Stage 7: Post-Processing ---
    
    async def run_stage_7(self, spritesheet: bytes) -> list[bytes]:
        """Extract and normalize frames from spritesheet."""
        await self._notify_stage_start(7)
        await self._update_stage(7, "running")
        
        try:
            import cv2
            import numpy as np
            from app.services.stages.stage_7_post_processing import detect_grid_layout_with_gemini
            
            # Decode image
            nparr = np.frombuffer(spritesheet, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            # Use Gemini Flash to detect grid layout
            detected_rows, detected_cols, gemini_frame_count = await detect_grid_layout_with_gemini(
                spritesheet_bytes=spritesheet
            )
            
            expected_count = self.state.frame_budget.final_frame_count
            
            # Use hybrid extraction: validates Gemini with contour detection
            from app.services.stages.stage_7_post_processing import extract_frames_hybrid
            
            result = extract_frames_hybrid(
                grid_image=img,
                expected_count=expected_count,
                gemini_rows=detected_rows,
                gemini_cols=detected_cols,
                gemini_frame_count=gemini_frame_count,
                is_grounded=True,
            )
            
            # Normalize frames
            normalized = normalize_frames(
                result.frames,
                result.frame_width,
                result.frame_height,
            )
            
            # Encode and upload each frame
            frame_urls = []
            for i, frame in enumerate(normalized):
                frame_bytes = encode_frame_png(frame)
                path = f"{self.project_id}/{self.pipeline_id}/frame_{i:02d}.png"
                url = await supabase_service.upload_image(
                    bucket="sprites",
                    path=path,
                    file_bytes=frame_bytes,
                )
                frame_urls.append(url)
            
            self.state.frame_urls = frame_urls
            self.state.pivots = [{"x": p[0], "y": p[1]} for p in result.pivots]
            
            stage_result = {
                "frame_count": len(frame_urls),
                "frame_urls": frame_urls,
                "pivots": self.state.pivots,
            }
            
            await self._update_stage(7, "completed", stage_result)
            await self._notify_stage_complete(7, stage_result)
            
            return [encode_frame_png(f) for f in normalized]
        except Exception as e:
            await self._update_stage(7, "failed", error=str(e))
            await self._notify_stage_error(7, str(e))
            raise
    
    # --- Full Pipeline Run ---
    
    async def run_full_pipeline(
        self,
        reference_image: bytes,
        action_type: str,
        difficulty_tier: Literal["LIGHT", "HEAVY", "BOSS"],
        perspective: Literal["side", "front", "isometric", "top_down"] = "side",
    ):
        """
        Run the complete pipeline from DNA extraction to frame extraction.
        
        Note: Stage 2 (DNA verification) is skipped in auto mode.
        Note: Stage 8 (repair) is only run on demand.
        """
        self.state.status = "running"
        
        try:
            # Stage 1: DNA Extraction
            await self.run_stage_1(reference_image)
            
            # Stage 2: Skipped (auto-accept DNA)
            self.state.dna_verified = True
            
            # Stage 3: Action Definition
            await self.run_stage_3(action_type, difficulty_tier, perspective)
            
            # Stage 4: Intent Mirroring
            await self.run_stage_4()
            
            # Auto-confirm intent for full pipeline
            await self.confirm_intent(True)
            
            # Stage 5: Biomechanical Scripting
            await self.run_stage_5()
            
            # Stage 6: Image Generation
            spritesheet = await self.run_stage_6(reference_image)
            
            # Stage 7: Post-Processing
            frames = await self.run_stage_7(spritesheet)
            
            self.state.status = "completed"
            
        except Exception as e:
            self.state.status = "failed"
            raise


# Factory function
def create_pipeline(project_id: str, on_stage_update=None) -> PipelineOrchestrator:
    """Create a new pipeline orchestrator instance."""
    return PipelineOrchestrator(project_id, on_stage_update)
