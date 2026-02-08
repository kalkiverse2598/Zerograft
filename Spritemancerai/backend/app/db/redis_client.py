import redis.asyncio as redis
import asyncio
import json
from typing import Optional
from datetime import timedelta

from app.config import get_settings

# Fast timeout for startup - don't block if Redis is unavailable
REDIS_CONNECT_TIMEOUT = 3  # seconds


class RedisClient:
    """Async Redis client for session and pipeline state management.
    
    All operations are fail-safe - if Redis is unavailable, operations
    silently fail and the app continues without caching.
    """
    
    def __init__(self):
        self.settings = get_settings()
        self._client: Optional[redis.Redis] = None
        self._connected = False
    
    async def connect(self) -> None:
        """Establish Redis connection with fast timeout."""
        if not self._client:
            try:
                self._client = redis.from_url(
                    self.settings.redis_url,
                    encoding="utf-8",
                    decode_responses=True,
                    socket_timeout=REDIS_CONNECT_TIMEOUT,
                    socket_connect_timeout=REDIS_CONNECT_TIMEOUT,
                )
                # Test the connection with timeout
                await asyncio.wait_for(
                    self._client.ping(),
                    timeout=REDIS_CONNECT_TIMEOUT
                )
                self._connected = True
                print("✅ Redis connected and verified")
            except asyncio.TimeoutError:
                print(f"⚠️ Redis connection timed out after {REDIS_CONNECT_TIMEOUT}s (continuing without Redis)")
                self._client = None
                self._connected = False
            except Exception as e:
                print(f"⚠️ Redis connection failed: {e}")
                self._client = None
                self._connected = False
    
    async def disconnect(self) -> None:
        """Close Redis connection."""
        if self._client:
            try:
                await self._client.close()
            except Exception:
                pass
            self._client = None
            self._connected = False
    
    @property
    def is_connected(self) -> bool:
        """Check if Redis is available."""
        return self._connected and self._client is not None
    
    # --- Pipeline State Operations ---
    
    def _pipeline_key(self, project_id: str) -> str:
        """Generate Redis key for pipeline state."""
        return f"pipeline:{project_id}"
    
    async def save_pipeline_state(self, project_id: str, state: dict) -> None:
        """Save pipeline state with TTL. Silently skips if Redis not available."""
        if not self.is_connected:
            return
        try:
            key = self._pipeline_key(project_id)
            ttl = timedelta(hours=self.settings.session_ttl_hours)
            await self._client.setex(key, ttl, json.dumps(state))
        except Exception as e:
            print(f"⚠️ Redis save_pipeline_state failed: {e}")
            self._connected = False  # Mark as disconnected
    
    async def get_pipeline_state(self, project_id: str) -> Optional[dict]:
        """Get pipeline state if exists. Returns None if Redis unavailable."""
        if not self.is_connected:
            return None
        try:
            key = self._pipeline_key(project_id)
            data = await self._client.get(key)
            return json.loads(data) if data else None
        except Exception as e:
            print(f"⚠️ Redis get_pipeline_state failed: {e}")
            self._connected = False
            return None
    
    async def delete_pipeline_state(self, project_id: str) -> None:
        """Delete pipeline state. Silently skips if Redis unavailable."""
        if not self.is_connected:
            return
        try:
            key = self._pipeline_key(project_id)
            await self._client.delete(key)
        except Exception as e:
            print(f"⚠️ Redis delete_pipeline_state failed: {e}")
            self._connected = False
    
    async def update_pipeline_stage(self, project_id: str, stage: int, stage_data: dict) -> None:
        """Update a specific stage in the pipeline state."""
        if not self.is_connected:
            return
        try:
            state = await self.get_pipeline_state(project_id)
            if state:
                state["current_stage"] = stage
                state["stages"] = state.get("stages", [])
                # Update or append stage
                existing = next((s for s in state["stages"] if s.get("stage_number") == stage), None)
                if existing:
                    existing.update(stage_data)
                else:
                    stage_data["stage_number"] = stage
                    state["stages"].append(stage_data)
                await self.save_pipeline_state(project_id, state)
        except Exception as e:
            print(f"⚠️ Redis update_pipeline_stage failed: {e}")
            self._connected = False
    
    # --- Session Operations ---
    
    def _session_key(self, session_id: str) -> str:
        """Generate Redis key for user session."""
        return f"session:{session_id}"
    
    async def save_session(self, session_id: str, session_data: dict) -> None:
        """Save session data with TTL. Silently skips if Redis unavailable."""
        if not self.is_connected:
            return
        try:
            key = self._session_key(session_id)
            ttl = timedelta(hours=self.settings.session_ttl_hours)
            await self._client.setex(key, ttl, json.dumps(session_data))
        except Exception as e:
            print(f"⚠️ Redis save_session failed: {e}")
            self._connected = False
    
    async def get_session(self, session_id: str) -> Optional[dict]:
        """Get session data if exists. Returns None if Redis unavailable."""
        if not self.is_connected:
            return None
        try:
            key = self._session_key(session_id)
            data = await self._client.get(key)
            return json.loads(data) if data else None
        except Exception as e:
            print(f"⚠️ Redis get_session failed: {e}")
            self._connected = False
            return None
    
    async def refresh_session_ttl(self, session_id: str) -> None:
        """Refresh session TTL. Silently skips if Redis unavailable."""
        if not self.is_connected:
            return
        try:
            key = self._session_key(session_id)
            ttl = timedelta(hours=self.settings.session_ttl_hours)
            await self._client.expire(key, int(ttl.total_seconds()))
        except Exception as e:
            print(f"⚠️ Redis refresh_session_ttl failed: {e}")
            self._connected = False


# Singleton instance
redis_client = RedisClient()
