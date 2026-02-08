"""
Pydantic models and request schemas for pipeline endpoints.
"""
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel


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
    animation_type: Optional[str] = None  # e.g., "idle", "walk", "attack" - if provided, saves to animations dict


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


class PivotUpdateRequest(BaseModel):
    """Request to update frame pivots."""
    project_id: str
    pivots: list[dict]  # [{x: float, y: float}, ...]


class ScriptUpdateRequest(BaseModel):
    """Request to update animation script."""
    project_id: str
    script: dict  # {frames: [...]}


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


class ReprocessRequest(BaseModel):
    """Request to reprocess spritesheet with manual grid parameters."""
    project_id: str
    grid_rows: int
    grid_cols: int
    frame_count: int
    character: Literal["instigator", "responder"] = "instigator"
    animation_type: Optional[str] = None  # If provided, saves to animations[animation_type] instead of frame_urls
