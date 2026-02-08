from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.routers import projects, pipeline, websocket, export, vfx, ai_generator, tileset_generator
from app.db import redis_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    print("🚀 SpriteMancer AI Backend starting...")
    
    # Connect to Redis (handles errors internally, app works without it)
    await redis_client.connect()
    
    yield
    
    # Shutdown
    print("👋 SpriteMancer AI Backend shutting down...")
    await redis_client.disconnect()


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="AI-powered 2D pixel art sprite generation system",
    version="0.1.0",
    lifespan=lifespan,
    redirect_slashes=False,  # Prevent redirects that break CORS preflight
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(pipeline.router, prefix="/api/pipeline", tags=["Pipeline"])
app.include_router(websocket.router, prefix="/ws", tags=["WebSocket"])
app.include_router(export.router, prefix="/api/export", tags=["Export"])
app.include_router(vfx.router, prefix="/api", tags=["VFX"])
app.include_router(ai_generator.router, prefix="/api/ai", tags=["AI Generator"])
app.include_router(tileset_generator.router, prefix="/api/tilesets", tags=["Tileset Generation"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": settings.app_name}
