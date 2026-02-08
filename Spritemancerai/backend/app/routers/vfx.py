"""
VFX Router - AI-powered visual effects generation.

Endpoints for generating particle sprites and motion smear frames using Gemini.
"""

import base64
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.gemini_client import gemini_client, GeminiError

router = APIRouter(prefix="/vfx", tags=["VFX"])


# ============================================================================
# Request/Response Models
# ============================================================================

class GenerateParticlesRequest(BaseModel):
    """Request to generate particle sprites."""
    particle_type: str  # "dust", "blood", "spark", "magic", "smoke", "fire"
    palette: Optional[list[str]] = None  # Hex colors from DNA, e.g. ["#FF5733", "#33FF57"]
    size: int = 32  # Particle sprite size (16, 32, 64)
    frame_count: int = 4  # Number of animation frames


class GenerateParticlesResponse(BaseModel):
    """Response with generated particle sprite."""
    image_base64: str  # Base64 encoded PNG spritesheet
    width: int
    height: int
    frame_count: int


class GenerateSmearRequest(BaseModel):
    """Request to generate motion smear frame."""
    frame_before_base64: str  # Frame N as base64
    frame_after_base64: str  # Frame N+1 as base64
    intensity: float = 0.5  # 0-1 smear amount


class GenerateSmearResponse(BaseModel):
    """Response with generated smear frame."""
    smear_frame_base64: str


# ============================================================================
# Particle Type Prompts
# ============================================================================

PARTICLE_PROMPTS = {
    "dust": """a small dust cloud particle effect, light brown and tan colors, 
               soft edges, dissipating smoke-like, ground impact dust puff""",
    
    "blood": """pixel art blood splatter particle, red droplets, 
                impact splash effect, action game style, visceral""",
    
    "spark": """bright electric spark particle, yellow and white, 
                sharp angular shapes, energy burst, lightning effect""",
    
    "magic": """magical sparkle particle effect, glowing orbs, 
                mystical energy, purple and blue gradient, fantasy RPG style""",
    
    "smoke": """wispy smoke particle, gray and white gradient, 
                soft cloud puff, dissipating vapor effect""",
    
    "fire": """flame particle effect, orange and yellow with red tips, 
               flickering fire animation, burning effect""",
    
    "water": """water splash particle, blue droplets, 
                transparent splash effect, liquid motion""",
    
    "leaf": """falling leaf particle, green and brown autumn colors, 
               nature effect, wind-blown foliage""",
}


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/generate-particles", response_model=GenerateParticlesResponse)
async def generate_particles(request: GenerateParticlesRequest):
    """
    Generate particle sprite sheet using Gemini AI.
    
    Returns a horizontal spritesheet with animated particle frames.
    """
    particle_type = request.particle_type.lower()
    
    # Get base description for particle type
    base_description = PARTICLE_PROMPTS.get(
        particle_type, 
        f"a {particle_type} particle effect for game sprites"
    )
    
    # Build color palette instruction
    palette_instruction = ""
    if request.palette and len(request.palette) > 0:
        colors = ", ".join(request.palette)
        palette_instruction = f"Use ONLY these colors: {colors}. "
    
    # Construct the prompt
    prompt = f"""Generate a pixel art particle sprite sheet.

REQUIREMENTS:
- Style: Retro pixel art, clean and crisp pixels
- Size: {request.size}x{request.size} pixels per frame
- Frames: {request.frame_count} animation frames in a HORIZONTAL strip
- Total image size: {request.size * request.frame_count}x{request.size} pixels
- Background: Completely transparent (alpha channel)
- Effect: {base_description}
{palette_instruction}

IMPORTANT:
- Each frame shows the particle at a different stage of its animation
- Frame 1: Particle appears (spawn)
- Middle frames: Particle expands/moves
- Last frame: Particle fades/dissipates
- Keep pixel art style consistent across all frames
- No anti-aliasing, use clean hard pixels"""

    try:
        # Generate the particle spritesheet
        image_bytes = await gemini_client.generate_image(
            prompt=prompt,
            aspect_ratio="4:1" if request.frame_count == 4 else "1:1"
        )
        
        # Encode as base64
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")
        
        return GenerateParticlesResponse(
            image_base64=image_base64,
            width=request.size * request.frame_count,
            height=request.size,
            frame_count=request.frame_count
        )
        
    except GeminiError as e:
        raise HTTPException(
            status_code=503 if e.retryable else 500,
            detail=f"Failed to generate particles: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error generating particles: {str(e)}"
        )


@router.post("/generate-smear", response_model=GenerateSmearResponse)
async def generate_smear(request: GenerateSmearRequest):
    """
    Generate a motion smear frame between two animation frames.
    
    Uses Gemini to interpolate and create motion blur effect.
    """
    try:
        # Decode the frames
        frame_before = base64.b64decode(request.frame_before_base64)
        frame_after = base64.b64decode(request.frame_after_base64)
        
        # Create prompt for smear generation
        intensity_desc = "subtle" if request.intensity < 0.3 else "moderate" if request.intensity < 0.7 else "strong"
        
        prompt = f"""Create a motion smear frame between these two animation poses.

REQUIREMENTS:
- Analyze the motion direction between Frame 1 and Frame 2
- Generate an intermediate frame with {intensity_desc} motion blur effect
- Stretch pixels in the direction of movement
- Maintain the exact pixel art style of the original frames
- Keep colors consistent with the source frames
- Smear trails should be semi-transparent
- Output a single frame that shows the in-between motion

STYLE:
- Pixel art motion blur, similar to fighting game smear frames
- Clean shapes with stretched motion trails
- No anti-aliasing, maintain crisp pixels where possible"""

        # Use edit_image with both frames as reference
        smear_bytes = await gemini_client.generate_image(
            prompt=prompt,
            reference_images=[frame_before, frame_after]
        )
        
        smear_base64 = base64.b64encode(smear_bytes).decode("utf-8")
        
        return GenerateSmearResponse(smear_frame_base64=smear_base64)
        
    except GeminiError as e:
        raise HTTPException(
            status_code=503 if e.retryable else 500,
            detail=f"Failed to generate smear frame: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error generating smear: {str(e)}"
        )


@router.get("/particle-types")
async def get_particle_types():
    """Get list of available particle effect types."""
    return {
        "types": list(PARTICLE_PROMPTS.keys()),
        "descriptions": {k: v.split(",")[0].strip() for k, v in PARTICLE_PROMPTS.items()}
    }
