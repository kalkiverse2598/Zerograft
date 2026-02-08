"""
Dual Pipeline Orchestrator

Coordinates dual-character relational animation generation.
Extends PipelineOrchestrator with responder-specific stages.
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
    DualCharacterDNA,
    InteractionConstraints,
    ResponderActionResult,
)
from app.db import redis_client, supabase_service
from app.services.stages import (
    extract_dual_character_dna,
    suggest_responder_actions,
    compute_frame_budget,
    mirror_intent,
    generate_biomech_script,
    generate_responder_script,
    generate_spritesheet,
    extract_frames,
    normalize_frames,
    encode_frame_png,
)


DUAL_STAGE_NAMES = {
    1: "Dual DNA Extraction",
    2: "DNA Verification",
    3: "Instigator Action Definition",
    4: "Responder Action Suggestion",
    5: "Intent Mirroring",
    6: "Instigator Script Generation",
    7: "Responder Script Derivation",
    8: "Instigator Image Generation",
    9: "Responder Image Generation",
    10: "Post-Processing",
}


class DualPipelineOrchestrator:
    """
    Orchestrates dual-character animation generation.
    
    Pipeline order:
    1. Dual DNA Extraction (both characters)
    2. DNA Verification (optional)
    3. Instigator Action Definition
    4. Responder Action Suggestion + Confirmation
    5. Intent Mirroring
    6. Instigator Biomech Scripting (PRIMARY)
    7. Responder Biomech Scripting (DERIVED)
    8. Instigator Image Generation
    9. Responder Image Generation
    10. Post-Processing (both)
    """
    
    def __init__(self, project_id: str, on_stage_update=None):
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
                generation_mode="dual",
            )
        return self._state
    
    async def _notify_stage(self, stage: int, status: str, result: dict = None):
        """Notify stage update via callback."""
        if self.on_stage_update:
            await self.on_stage_update(
                self.project_id, 
                stage, 
                DUAL_STAGE_NAMES.get(stage, f"Stage {stage}"), 
                status, 
                result or {}
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
            stage_name=DUAL_STAGE_NAMES.get(stage, f"Stage {stage}"),
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
    
    # --- Stage 1: Dual DNA Extraction ---
    
    async def run_stage_1(
        self, 
        instigator_image: bytes, 
        responder_image: bytes,
    ) -> DualCharacterDNA:
        """Extract Character DNA for both characters."""
        await self._notify_stage(1, "start")
        await self._update_stage(1, "running")
        
        try:
            dual_dna = await extract_dual_character_dna(
                instigator_image=instigator_image,
                responder_image=responder_image,
            )
            
            self.state.character_dna = dual_dna.instigator
            self.state.responder_dna = dual_dna.responder
            self.state.interaction_constraints = dual_dna.interaction.model_dump()
            
            result = {
                "instigator_dna": dual_dna.instigator.model_dump(),
                "responder_dna": dual_dna.responder.model_dump(),
                "interaction": dual_dna.interaction.model_dump(),
            }
            
            await self._update_stage(1, "completed", result)
            await self._notify_stage(1, "complete", result)
            
            return dual_dna
        except Exception as e:
            await self._update_stage(1, "failed", error=str(e))
            await self._notify_stage(1, "error", {"error": str(e)})
            raise
    
    # --- Stage 3: Instigator Action Definition ---
    
    async def run_stage_3(
        self,
        action_type: str,
        difficulty_tier: Literal["LIGHT", "HEAVY", "BOSS"],
        perspective: Literal["side", "front", "isometric", "top_down"] = "side",
    ) -> FrameBudget:
        """Define instigator action and compute frame budget."""
        await self._notify_stage(3, "start")
        await self._update_stage(3, "running")
        
        try:
            if not self.state.character_dna:
                raise ValueError("No DNA available. Run Stage 1 first.")
            
            # Compute frame budget using instigator DNA
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
            
            result = {"frame_budget": frame_budget.model_dump()}
            
            await self._update_stage(3, "completed", result)
            await self._notify_stage(3, "complete", result)
            
            return frame_budget
        except Exception as e:
            await self._update_stage(3, "failed", error=str(e))
            await self._notify_stage(3, "error", {"error": str(e)})
            raise
    
    # --- Stage 4: Responder Action Suggestion ---
    
    async def run_stage_4(self) -> ResponderActionResult:
        """Suggest responder actions based on physics."""
        await self._notify_stage(4, "start")
        await self._update_stage(4, "running")
        
        try:
            if not all([self.state.character_dna, self.state.responder_dna, self.state.action_type]):
                raise ValueError("Missing prerequisites. Run stages 1 and 3 first.")
            
            interaction = InteractionConstraints(**self.state.interaction_constraints)
            
            suggestions = await suggest_responder_actions(
                instigator_action=self.state.action_type,
                difficulty_tier=self.state.difficulty_tier,
                instigator_dna=self.state.character_dna,
                responder_dna=self.state.responder_dna,
                interaction_constraints=interaction,
            )
            
            self.state.suggested_responder_actions = [
                s.model_dump() for s in suggestions.suggested_actions
            ]
            
            result = suggestions.model_dump()
            
            await self._update_stage(4, "completed", result)
            await self._notify_stage(4, "complete", result)
            
            return suggestions
        except Exception as e:
            await self._update_stage(4, "failed", error=str(e))
            await self._notify_stage(4, "error", {"error": str(e)})
            raise
    
    async def confirm_responder_action(self, action: str):
        """Confirm user-selected responder action."""
        self.state.responder_action_type = action
        self.state.responder_action_confirmed = True
        await redis_client.save_pipeline_state(
            self.project_id,
            self.state.model_dump(mode="json"),
        )
    
    # --- Stage 6: Instigator Script Generation ---
    
    async def run_stage_6(self) -> AnimationScript:
        """Generate instigator biomechanical animation script (PRIMARY)."""
        await self._notify_stage(6, "start")
        await self._update_stage(6, "running")
        
        try:
            if not self.state.intent_confirmed:
                raise ValueError("Intent not confirmed.")
            
            script = await generate_biomech_script(
                self.state.character_dna,
                self.state.action_type,
                self.state.difficulty_tier,
                self.state.frame_budget,
            )
            
            self.state.animation_script = script
            
            result = script.model_dump()
            
            await self._update_stage(6, "completed", result)
            await self._notify_stage(6, "complete", result)
            
            return script
        except Exception as e:
            await self._update_stage(6, "failed", error=str(e))
            await self._notify_stage(6, "error", {"error": str(e)})
            raise
    
    # --- Stage 7: Responder Script Derivation ---
    
    async def run_stage_7(self) -> AnimationScript:
        """Generate responder animation script (DERIVED from instigator)."""
        await self._notify_stage(7, "start")
        await self._update_stage(7, "running")
        
        try:
            if not self.state.animation_script:
                raise ValueError("No instigator script. Run Stage 6 first.")
            
            if not self.state.responder_action_confirmed:
                raise ValueError("Responder action not confirmed.")
            
            interaction = InteractionConstraints(**self.state.interaction_constraints)
            
            responder_script = await generate_responder_script(
                instigator_script=self.state.animation_script,
                responder_dna=self.state.responder_dna,
                responder_action=self.state.responder_action_type,
                difficulty_tier=self.state.difficulty_tier,
                interaction=interaction,
            )
            
            self.state.responder_animation_script = responder_script
            
            result = responder_script.model_dump()
            
            await self._update_stage(7, "completed", result)
            await self._notify_stage(7, "complete", result)
            
            return responder_script
        except Exception as e:
            await self._update_stage(7, "failed", error=str(e))
            await self._notify_stage(7, "error", {"error": str(e)})
            raise
    
    # --- Stage 8: Instigator Image Generation ---
    
    async def run_stage_8(self, reference_image: bytes) -> bytes:
        """Generate instigator spritesheet."""
        await self._notify_stage(8, "start")
        await self._update_stage(8, "running")
        
        try:
            if not self.state.animation_script:
                raise ValueError("No animation script. Run Stage 6 first.")
            
            spritesheet = await generate_spritesheet(
                reference_image=reference_image,
                dna=self.state.character_dna,
                script=self.state.animation_script,
                grid_dim=self.state.frame_budget.grid_dim,
            )
            
            # Upload
            path = f"{self.project_id}/{self.pipeline_id}/instigator_spritesheet.png"
            url = await supabase_service.upload_image(
                bucket="sprites",
                path=path,
                file_bytes=spritesheet,
            )
            
            self.state.spritesheet_url = url
            
            result = {"spritesheet_url": url}
            
            await self._update_stage(8, "completed", result)
            await self._notify_stage(8, "complete", result)
            
            return spritesheet
        except Exception as e:
            await self._update_stage(8, "failed", error=str(e))
            await self._notify_stage(8, "error", {"error": str(e)})
            raise
    
    # --- Stage 9: Responder Image Generation ---
    
    async def run_stage_9(self, reference_image: bytes) -> bytes:
        """Generate responder spritesheet."""
        await self._notify_stage(9, "start")
        await self._update_stage(9, "running")
        
        try:
            if not self.state.responder_animation_script:
                raise ValueError("No responder script. Run Stage 7 first.")
            
            spritesheet = await generate_spritesheet(
                reference_image=reference_image,
                dna=self.state.responder_dna,
                script=self.state.responder_animation_script,
                grid_dim=self.state.frame_budget.grid_dim,
            )
            
            # Upload
            path = f"{self.project_id}/{self.pipeline_id}/responder_spritesheet.png"
            url = await supabase_service.upload_image(
                bucket="sprites",
                path=path,
                file_bytes=spritesheet,
            )
            
            self.state.responder_spritesheet_url = url
            
            result = {"responder_spritesheet_url": url}
            
            await self._update_stage(9, "completed", result)
            await self._notify_stage(9, "complete", result)
            
            return spritesheet
        except Exception as e:
            await self._update_stage(9, "failed", error=str(e))
            await self._notify_stage(9, "error", {"error": str(e)})
            raise
    
    # --- Stage 10: Post-Processing ---
    
    async def run_stage_10(
        self, 
        instigator_spritesheet: bytes, 
        responder_spritesheet: bytes,
    ) -> dict:
        """Extract and normalize frames from both spritesheets."""
        await self._notify_stage(10, "start")
        await self._update_stage(10, "running")
        
        try:
            import cv2
            import numpy as np
            from app.services.stages.stage_7_post_processing import detect_grid_layout_with_gemini
            
            expected_count = self.state.frame_budget.final_frame_count
            default_grid_dim = self.state.frame_budget.grid_dim
            
            # Process instigator - detect grid with Gemini Flash + hybrid extraction
            from app.services.stages.stage_7_post_processing import extract_frames_hybrid
            
            ins_rows, ins_cols, ins_gemini_count = await detect_grid_layout_with_gemini(
                spritesheet_bytes=instigator_spritesheet
            )
            
            nparr = np.frombuffer(instigator_spritesheet, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            result_ins = extract_frames_hybrid(
                grid_image=img,
                expected_count=expected_count,
                gemini_rows=ins_rows,
                gemini_cols=ins_cols,
                gemini_frame_count=ins_gemini_count,
                is_grounded=True,
            )
            
            normalized_ins = normalize_frames(
                result_ins.frames,
                result_ins.frame_width,
                result_ins.frame_height,
            )
            
            # Upload instigator frames
            instigator_urls = []
            for i, frame in enumerate(normalized_ins):
                frame_bytes = encode_frame_png(frame)
                path = f"{self.project_id}/{self.pipeline_id}/instigator_frame_{i:02d}.png"
                url = await supabase_service.upload_image(
                    bucket="sprites", path=path, file_bytes=frame_bytes
                )
                instigator_urls.append(url)
            
            self.state.frame_urls = instigator_urls
            self.state.pivots = [{"x": p[0], "y": p[1]} for p in result_ins.pivots]
            
            # Process responder - detect grid with Gemini Flash + hybrid extraction
            resp_rows, resp_cols, resp_gemini_count = await detect_grid_layout_with_gemini(
                spritesheet_bytes=responder_spritesheet
            )
            
            nparr = np.frombuffer(responder_spritesheet, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            result_resp = extract_frames_hybrid(
                grid_image=img,
                expected_count=expected_count,
                gemini_rows=resp_rows,
                gemini_cols=resp_cols,
                gemini_frame_count=resp_gemini_count,
                is_grounded=True,
            )
            
            normalized_resp = normalize_frames(
                result_resp.frames,
                result_resp.frame_width,
                result_resp.frame_height,
            )
            
            # Upload responder frames
            responder_urls = []
            for i, frame in enumerate(normalized_resp):
                frame_bytes = encode_frame_png(frame)
                path = f"{self.project_id}/{self.pipeline_id}/responder_frame_{i:02d}.png"
                url = await supabase_service.upload_image(
                    bucket="sprites", path=path, file_bytes=frame_bytes
                )
                responder_urls.append(url)
            
            self.state.responder_frame_urls = responder_urls
            self.state.responder_pivots = [{"x": p[0], "y": p[1]} for p in result_resp.pivots]
            
            stage_result = {
                "instigator_frame_count": len(instigator_urls),
                "instigator_frame_urls": instigator_urls,
                "responder_frame_count": len(responder_urls),
                "responder_frame_urls": responder_urls,
            }
            
            await self._update_stage(10, "completed", stage_result)
            await self._notify_stage(10, "complete", stage_result)
            
            return stage_result
        except Exception as e:
            await self._update_stage(10, "failed", error=str(e))
            await self._notify_stage(10, "error", {"error": str(e)})
            raise


def create_dual_pipeline(project_id: str, on_stage_update=None) -> DualPipelineOrchestrator:
    """Create a new dual pipeline orchestrator instance."""
    return DualPipelineOrchestrator(project_id, on_stage_update)
