from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json

router = APIRouter()

# Active WebSocket connections per project (supports multiple connections)
connections: Dict[str, Set[WebSocket]] = {}


@router.websocket("/{project_id}")
async def pipeline_websocket(websocket: WebSocket, project_id: str):
    """
    WebSocket endpoint for real-time pipeline progress.
    
    Message types sent to client:
    - stage_start: Pipeline stage has started
    - stage_progress: Progress update within a stage
    - stage_complete: Stage completed with result
    - stage_error: Stage failed with error
    - pipeline_complete: Full pipeline completed
    """
    # Accept WebSocket connection from any origin (CORS doesn't apply to WS)
    # Check origin header but don't reject - just log it
    origin = websocket.headers.get("origin", "unknown")
    print(f"[WebSocket] Connection from origin: {origin} for project: {project_id}")
    
    try:
        await websocket.accept()
    except Exception as e:
        print(f"[WebSocket] Failed to accept connection: {e}")
        return
    
    # Add to connections set for this project
    if project_id not in connections:
        connections[project_id] = set()
    connections[project_id].add(websocket)
    
    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connected",
            "project_id": project_id,
            "message": "WebSocket connected. Ready for pipeline updates.",
        })
        
        # Keep connection alive and handle incoming messages
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle client messages (e.g., cancel, pause)
            if message.get("type") == "cancel":
                await websocket.send_json({
                    "type": "cancelled",
                    "project_id": project_id,
                })
                break
                
    except WebSocketDisconnect:
        pass
    finally:
        # Remove this specific connection
        if project_id in connections:
            connections[project_id].discard(websocket)
            # Clean up empty sets
            if not connections[project_id]:
                del connections[project_id]


async def send_stage_update(project_id: str, stage: int, stage_name: str, status: str, data: dict = None):
    """Send a stage update to all connected WebSocket clients for a project."""
    if project_id not in connections:
        return
    
    message = {
        "type": f"stage_{status}",
        "project_id": project_id,
        "stage": stage,
        "stage_name": stage_name,
        "data": data or {},
    }
    
    # Send to all connected clients
    disconnected = set()
    for websocket in connections[project_id]:
        try:
            await websocket.send_json(message)
        except Exception:
            disconnected.add(websocket)
    
    # Clean up disconnected clients
    connections[project_id] -= disconnected


async def send_pipeline_complete(project_id: str, spritesheet_url: str, frames: list, animation_type: str = None):
    """Send pipeline completion notification to all connected clients."""
    if project_id not in connections:
        return
    
    message = {
        "type": "pipeline_complete",
        "project_id": project_id,
        "spritesheet_url": spritesheet_url,
        "frames": frames,
        "animation_type": animation_type,
    }
    
    # Send to all connected clients
    disconnected = set()
    for websocket in connections[project_id]:
        try:
            await websocket.send_json(message)
        except Exception:
            disconnected.add(websocket)
    
    # Clean up disconnected clients
    connections[project_id] -= disconnected


async def send_dna_extracted(project_id: str, dna: dict):
    """Send DNA extraction notification to trigger UI refresh."""
    if project_id not in connections:
        return
    
    message = {
        "type": "dna_extracted",
        "project_id": project_id,
        "dna": dna,
    }
    
    disconnected = set()
    for websocket in connections[project_id]:
        try:
            await websocket.send_json(message)
        except Exception:
            disconnected.add(websocket)
    
    connections[project_id] -= disconnected


async def send_project_updated(project_id: str, update_type: str = "general"):
    """Send general project update notification to trigger frontend refetch."""
    if project_id not in connections:
        return
    
    message = {
        "type": "project_updated",
        "project_id": project_id,
        "update_type": update_type,  # "dna", "animation", "frames", etc.
    }
    
    disconnected = set()
    for websocket in connections[project_id]:
        try:
            await websocket.send_json(message)
        except Exception:
            disconnected.add(websocket)
    
    connections[project_id] -= disconnected
