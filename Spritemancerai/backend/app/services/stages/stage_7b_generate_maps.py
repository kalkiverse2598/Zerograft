"""
Stage 7b: Lighting Map Generation

Generates Normal Maps and Specular Maps for pixel art sprites.
Uses AI to infer depth, then converts to normal vectors using Sobel filters.
"""
import cv2
import numpy as np
from dataclasses import dataclass
from typing import Optional
import io
import base64

from .stage_7_post_processing import ExtractedFrame


@dataclass
class LightingMaps:
    """Generated lighting maps for a single frame."""
    frame_index: int
    normal_map: np.ndarray  # RGB normal map (purple/blue)
    specular_map: np.ndarray  # Grayscale specular map


@dataclass
class LightingMapsResult:
    """Result of lighting map generation for all frames."""
    frame_maps: list[LightingMaps]
    normal_spritesheet: np.ndarray
    specular_spritesheet: np.ndarray


def depth_from_luminance(sprite: np.ndarray) -> np.ndarray:
    """
    Estimate depth from pixel luminance (simple heuristic).
    Brighter pixels are assumed to be closer (facing light).
    
    Args:
        sprite: BGRA or BGR sprite image
        
    Returns:
        Grayscale depth map (0-255, higher = closer)
    """
    # Convert to grayscale if needed
    if len(sprite.shape) == 3:
        if sprite.shape[2] == 4:
            # BGRA - use alpha to mask
            alpha = sprite[:, :, 3]
            gray = cv2.cvtColor(sprite[:, :, :3], cv2.COLOR_BGR2GRAY)
            # Set transparent pixels to mid-depth
            gray = np.where(alpha > 10, gray, 128)
        else:
            gray = cv2.cvtColor(sprite, cv2.COLOR_BGR2GRAY)
    else:
        gray = sprite
    
    # Apply slight blur to reduce noise
    depth = cv2.GaussianBlur(gray, (3, 3), 0)
    
    return depth.astype(np.uint8)


def depth_to_normal(depth: np.ndarray, strength: float = 1.0) -> np.ndarray:
    """
    Convert depth map to normal map using Sobel gradients.
    
    Args:
        depth: Grayscale depth map
        strength: Normal strength multiplier (1.0 = standard)
        
    Returns:
        RGB normal map (X=R, Y=G, Z=B)
    """
    # Calculate gradients using Sobel
    sobel_x = cv2.Sobel(depth.astype(np.float32), cv2.CV_32F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(depth.astype(np.float32), cv2.CV_32F, 0, 1, ksize=3)
    
    # Apply strength
    sobel_x *= strength
    sobel_y *= strength
    
    # Normalize gradients to [-1, 1] range
    # These become the X and Y components of the normal
    max_gradient = max(np.abs(sobel_x).max(), np.abs(sobel_y).max(), 1)
    nx = sobel_x / max_gradient
    ny = sobel_y / max_gradient
    
    # Z component: always pointing "up" (toward camera)
    # Compute from x,y to ensure unit length
    nz = np.sqrt(np.maximum(1.0 - nx**2 - ny**2, 0.0))
    
    # Convert from [-1, 1] to [0, 255] for image storage
    # Standard normal map convention: R=X, G=Y, B=Z
    normal_r = ((nx + 1.0) * 0.5 * 255).astype(np.uint8)
    normal_g = ((ny + 1.0) * 0.5 * 255).astype(np.uint8)
    normal_b = ((nz + 1.0) * 0.5 * 255).astype(np.uint8)
    
    # Stack into BGR (OpenCV format)
    normal_map = cv2.merge([normal_b, normal_g, normal_r])
    
    return normal_map


def generate_specular_map(
    sprite: np.ndarray,
    metallic_threshold: int = 200,
    specular_boost: float = 1.2
) -> np.ndarray:
    """
    Generate specular map from sprite.
    Bright, high-contrast areas are assumed metallic/shiny.
    
    Args:
        sprite: BGRA or BGR sprite image
        metallic_threshold: Brightness above which pixels are considered shiny
        specular_boost: Multiplier for specular intensity
        
    Returns:
        Grayscale specular map (0=matte, 255=shiny)
    """
    # Convert to grayscale
    if len(sprite.shape) == 3:
        if sprite.shape[2] == 4:
            alpha = sprite[:, :, 3]
            gray = cv2.cvtColor(sprite[:, :, :3], cv2.COLOR_BGR2GRAY)
        else:
            gray = cv2.cvtColor(sprite, cv2.COLOR_BGR2GRAY)
            alpha = np.ones_like(gray) * 255
    else:
        gray = sprite
        alpha = np.ones_like(gray) * 255
    
    # Calculate local contrast (edge strength = specularity hint)
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    contrast = np.abs(laplacian).astype(np.float32)
    contrast = cv2.GaussianBlur(contrast, (5, 5), 0)
    
    # Normalize contrast
    if contrast.max() > 0:
        contrast = (contrast / contrast.max() * 255).astype(np.uint8)
    else:
        contrast = np.zeros_like(gray)
    
    # Combine with brightness for specular map
    brightness_factor = np.clip(gray.astype(np.float32) / metallic_threshold, 0, 1)
    specular = (contrast.astype(np.float32) * brightness_factor * specular_boost)
    specular = np.clip(specular, 0, 255).astype(np.uint8)
    
    # Mask out transparent pixels
    specular = np.where(alpha > 10, specular, 0)
    
    return specular


def generate_lighting_maps_for_frame(
    frame: ExtractedFrame,
    normal_strength: float = 1.0
) -> LightingMaps:
    """
    Generate normal and specular maps for a single frame.
    
    Args:
        frame: Extracted frame with image data
        normal_strength: Strength of normal map effect
        
    Returns:
        LightingMaps with normal and specular maps
    """
    sprite = frame.image
    
    # Generate depth from luminance
    depth = depth_from_luminance(sprite)
    
    # Convert depth to normal map
    normal_map = depth_to_normal(depth, strength=normal_strength)
    
    # Generate specular map
    specular_map = generate_specular_map(sprite)
    
    return LightingMaps(
        frame_index=frame.index,
        normal_map=normal_map,
        specular_map=specular_map
    )


def create_lighting_spritesheet(
    maps: list[LightingMaps],
    frame_width: int,
    frame_height: int,
    grid_dim: int
) -> tuple[np.ndarray, np.ndarray]:
    """
    Combine individual lighting maps into spritesheets.
    
    Args:
        maps: List of LightingMaps for each frame
        frame_width: Width of each frame
        frame_height: Height of each frame
        grid_dim: Grid dimension (e.g., 4 for 4x4)
        
    Returns:
        (normal_spritesheet, specular_spritesheet)
    """
    sheet_size = grid_dim * max(frame_width, frame_height)
    
    # Create empty sheets
    normal_sheet = np.full((sheet_size, sheet_size, 3), (255, 128, 128), dtype=np.uint8)  # Neutral normal
    specular_sheet = np.zeros((sheet_size, sheet_size), dtype=np.uint8)
    
    for lm in maps:
        row = lm.frame_index // grid_dim
        col = lm.frame_index % grid_dim
        
        x = col * frame_width
        y = row * frame_height
        
        h, w = lm.normal_map.shape[:2]
        
        # Ensure we don't exceed sheet bounds
        if y + h <= sheet_size and x + w <= sheet_size:
            normal_sheet[y:y+h, x:x+w] = lm.normal_map
            specular_sheet[y:y+h, x:x+w] = lm.specular_map
    
    return normal_sheet, specular_sheet


def generate_lighting_maps(
    frames: list[ExtractedFrame],
    frame_width: int,
    frame_height: int,
    grid_dim: int = 4,
    normal_strength: float = 1.0
) -> LightingMapsResult:
    """
    Generate lighting maps for all frames.
    
    Args:
        frames: List of extracted frames
        frame_width: Normalized frame width
        frame_height: Normalized frame height
        grid_dim: Grid dimension for spritesheet
        normal_strength: Strength of normal map effect
        
    Returns:
        LightingMapsResult with all maps and spritesheets
    """
    print(f"⚡ Generating lighting maps for {len(frames)} frames...")
    
    frame_maps = []
    for frame in frames:
        lm = generate_lighting_maps_for_frame(frame, normal_strength)
        frame_maps.append(lm)
        print(f"  ✅ Frame {frame.index}: normal + specular generated")
    
    # Create combined spritesheets
    normal_sheet, specular_sheet = create_lighting_spritesheet(
        frame_maps, frame_width, frame_height, grid_dim
    )
    
    print(f"📦 Created lighting spritesheets: {normal_sheet.shape}")
    
    return LightingMapsResult(
        frame_maps=frame_maps,
        normal_spritesheet=normal_sheet,
        specular_spritesheet=specular_sheet
    )


def encode_lighting_map_png(image: np.ndarray) -> bytes:
    """Encode lighting map as PNG bytes."""
    success, buffer = cv2.imencode('.png', image)
    if not success:
        raise ValueError("Failed to encode lighting map")
    return buffer.tobytes()
