from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache
import json


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # App
    app_name: str = "SpriteMancer AI"
    debug: bool = False
    
    # Gemini API
    gemini_api_key: str
    gemini_text_model: str = "gemini-3-pro-preview"
    gemini_image_model: str = "gemini-3-pro-image-preview"
    gemini_flash_model: str = "gemini-3-flash-preview"
    
    # Supabase
    supabase_url: str
    supabase_key: str
    supabase_storage_bucket: str = "sprites"
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    session_ttl_hours: int = 24
    
    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]
    
    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """Parse CORS origins from JSON string or list."""
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                # If not valid JSON, treat as comma-separated string
                return [origin.strip() for origin in v.split(",")]
        return v
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # Ignore extra fields like UPSTASH_REDIS_REST_URL/TOKEN


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
