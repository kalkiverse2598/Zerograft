from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class Project(BaseModel):
    """Project model representing a sprite generation project."""
    
    id: str = Field(description="Unique project ID (UUID)")
    user_id: str = Field(description="Owner user ID")
    name: str = Field(description="Project name")
    description: Optional[str] = None
    
    # Reference image
    reference_image_url: Optional[str] = None
    reference_image_hash: Optional[str] = None
    
    # Current state
    status: str = Field(
        default="created",
        description="Project status: created, dna_extracted, generating, completed, failed"
    )
    current_pipeline_id: Optional[str] = None
    
    # Outputs
    latest_spritesheet_url: Optional[str] = None
    generation_count: int = Field(default=0, description="Number of generations performed")
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ProjectListItem(BaseModel):
    """Lightweight project model for list views."""
    
    id: str
    name: str
    status: str
    thumbnail_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
