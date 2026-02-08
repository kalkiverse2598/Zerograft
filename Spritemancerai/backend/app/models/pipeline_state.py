from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime

from .character_dna import CharacterDNA
from .animation_script import AnimationScript, FrameBudget


class PipelineStage(BaseModel):
    """Status of a single pipeline stage."""
    
    stage_number: int = Field(ge=1, le=10)  # Extended for dual mode
    stage_name: str
    status: Literal["pending", "running", "completed", "failed", "skipped"]
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result: Optional[dict] = None
    error: Optional[str] = None


class PipelineState(BaseModel):
    """
    Complete state of the sprite generation pipeline.
    Stored in Redis with TTL for session management.
    """
    
    project_id: str
    pipeline_id: str
    status: Literal["idle", "running", "paused", "completed", "failed", "cancelled"]
    current_stage: int = Field(default=0, ge=0, le=10)  # Extended for dual mode
    
    # Generation mode
    generation_mode: Literal["single", "dual"] = Field(
        default="single",
        description="Single character or dual-character relational animation"
    )
    
    # Stage results - Instigator (or single character)
    character_dna: Optional[CharacterDNA] = None
    dna_verified: bool = False
    
    # Dual mode: Responder character
    responder_dna: Optional[CharacterDNA] = None
    interaction_constraints: Optional[dict] = None
    
    action_type: Optional[str] = None
    difficulty_tier: Optional[Literal["LIGHT", "HEAVY", "BOSS"]] = None
    perspective: Literal["side", "front", "isometric", "top_down"] = "side"
    
    # Dual mode: Responder action
    responder_action_type: Optional[str] = None
    suggested_responder_actions: list[dict] = Field(default_factory=list)
    responder_action_confirmed: bool = False
    
    frame_budget: Optional[FrameBudget] = None
    intent_confirmed: bool = False
    intent_summary: Optional[str] = None
    
    animation_script: Optional[AnimationScript] = None
    
    # Dual mode: Responder animation script
    responder_animation_script: Optional[AnimationScript] = None
    
    # Generated outputs - Instigator (or single character)
    spritesheet_url: Optional[str] = None
    frame_urls: list[str] = Field(default_factory=list)
    pivots: list[dict] = Field(default_factory=list)
    
    # Dual mode: Responder outputs
    responder_spritesheet_url: Optional[str] = None
    responder_frame_urls: list[str] = Field(default_factory=list)
    responder_pivots: list[dict] = Field(default_factory=list)
    
    # Stage tracking
    stages: list[PipelineStage] = Field(default_factory=list)
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    def get_stage(self, stage_number: int) -> Optional[PipelineStage]:
        """Get a specific stage by number."""
        for stage in self.stages:
            if stage.stage_number == stage_number:
                return stage
        return None
    
    def can_rollback_to(self, stage_number: int) -> bool:
        """Check if pipeline can rollback to a specific stage."""
        if stage_number < 1 or stage_number >= self.current_stage:
            return False
        stage = self.get_stage(stage_number)
        return stage is not None and stage.status == "completed"
