"""
Pipeline router module.
Combines all pipeline sub-routers into a single router.
"""
from fastapi import APIRouter

from .single import router as single_router
from .dual import router as dual_router
from .repair import router as repair_router
from .utils import router as utils_router
from .lighting import router as lighting_router

# Re-export schemas for backward compatibility
from .schemas import (
    DualPipelineErrorCode,
    PipelineStartRequest,
    FrameBudgetRequest,
    DNAEditRequest,
    IntentConfirmRequest,
    RepairRequest,
    PivotUpdateRequest,
    ScriptUpdateRequest,
    DualPipelineRequest,
    ResponderConfirmRequest,
    ReprocessRequest,
)

# Create main router
router = APIRouter()

# Include all sub-routers
# Note: Order matters! Static routes (repair_router) must come before dynamic routes (single_router with /{project_id}/...)
router.include_router(repair_router)      # /repair, /save-edited-frame, /reprocess - MUST BE FIRST
router.include_router(single_router)      # /compute-budget, /start, /generate-script, /generate-sprites, /run, /{project_id}/animations
router.include_router(dual_router)        # /dual/*
router.include_router(utils_router)       # /{project_id}/status, /dna/edit, /intent/confirm, etc.
router.include_router(lighting_router)    # /{project_id}/generate-lighting-maps, /{project_id}/lighting-maps

__all__ = [
    "router",
    # Schemas
    "DualPipelineErrorCode",
    "PipelineStartRequest",
    "FrameBudgetRequest",
    "DNAEditRequest",
    "IntentConfirmRequest",
    "RepairRequest",
    "PivotUpdateRequest",
    "ScriptUpdateRequest",
    "DualPipelineRequest",
    "ResponderConfirmRequest",
    "ReprocessRequest",
]
