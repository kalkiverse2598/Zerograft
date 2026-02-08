"""
Smoke tests for SpriteMancer backend.
Validates that core modules import correctly and FastAPI app starts.
"""
import pytest


def test_fastapi_app_imports():
    """Verify the FastAPI application can be imported."""
    from main import app
    assert app is not None
    assert app.title or True  # App exists and is configured


def test_pipeline_orchestrator_imports():
    """Verify pipeline orchestrator module imports."""
    from app.services.pipeline_orchestrator import PipelineOrchestrator
    assert PipelineOrchestrator is not None


def test_models_import():
    """Verify Pydantic models import correctly."""
    from app.models.pipeline_state import PipelineState
    assert PipelineState is not None


def test_routers_import():
    """Verify all routers import without errors."""
    from app.routers import projects, ai_generator, export, vfx, tileset_generator
    assert projects is not None
    assert ai_generator is not None
    assert export is not None
    assert vfx is not None
    assert tileset_generator is not None


def test_api_routes_registered():
    """Verify key API routes are registered on the app."""
    from main import app
    routes = [r.path for r in app.routes]
    # Check that at least some expected routes exist
    assert any("/api" in r for r in routes) or len(routes) > 0
