"""
Seamless Tile Validation & Auto-Fix

Validates that animated tiles can seamlessly tile horizontally and/or vertically
by checking if edges match. Provides auto-fix capabilities for minor mismatches.
"""
import cv2
import numpy as np
from dataclasses import dataclass
from typing import Literal, Optional
from enum import Enum


class SeamlessAxis(str, Enum):
    """Which axes should be seamless."""
    HORIZONTAL = "horizontal"  # Left matches Right
    VERTICAL = "vertical"      # Top matches Bottom
    BOTH = "both"              # All edges match


@dataclass
class SeamlessValidationResult:
    """Result of seamless validation check."""
    is_seamless: bool
    horizontal_score: float  # 0-100, how well left matches right
    vertical_score: float    # 0-100, how well top matches bottom
    overall_score: float     # 0-100, combined score
    edge_mismatch_pixels: int  # Number of mismatched pixels
    message: str


def calculate_edge_similarity(edge1: np.ndarray, edge2: np.ndarray) -> float:
    """
    Calculate similarity between two edges (rows or columns of pixels).
    
    Args:
        edge1: First edge array (Nx3 or Nx4 for RGB/RGBA)
        edge2: Second edge array (Nx3 or Nx4 for RGB/RGBA)
    
    Returns:
        Similarity score 0-100 (100 = identical)
    """
    if edge1.shape != edge2.shape:
        return 0.0
    
    # Calculate per-pixel color difference
    diff = np.abs(edge1.astype(np.float32) - edge2.astype(np.float32))
    
    # Average difference per pixel (normalize by 255 for percentage)
    avg_diff = np.mean(diff) / 255.0 * 100
    
    # Convert to similarity score (100 = perfect match)
    similarity = max(0.0, 100.0 - avg_diff * 4)  # Scale up the sensitivity
    
    return similarity


def validate_seamless(
    image: np.ndarray,
    axis: SeamlessAxis = SeamlessAxis.BOTH,
    edge_width: int = 2,
    threshold: float = 85.0,
) -> SeamlessValidationResult:
    """
    Validate if a tile image is seamlessly tileable.
    
    Args:
        image: Input image (BGR or BGRA numpy array)
        axis: Which axis/axes to validate
        edge_width: How many pixels to compare at edges (1-5)
        threshold: Minimum similarity score to consider seamless (0-100)
    
    Returns:
        SeamlessValidationResult with scores and pass/fail status
    """
    h, w = image.shape[:2]
    edge_width = min(edge_width, min(h, w) // 4)  # Don't exceed 1/4 of image
    
    horizontal_score = 100.0
    vertical_score = 100.0
    
    # Check horizontal seamlessness (left edge matches right edge)
    if axis in [SeamlessAxis.HORIZONTAL, SeamlessAxis.BOTH]:
        left_edge = image[:, :edge_width]
        right_edge = image[:, -edge_width:]
        horizontal_score = calculate_edge_similarity(
            left_edge.reshape(-1, image.shape[2] if len(image.shape) > 2 else 1),
            right_edge.reshape(-1, image.shape[2] if len(image.shape) > 2 else 1)
        )
    
    # Check vertical seamlessness (top edge matches bottom edge)
    if axis in [SeamlessAxis.VERTICAL, SeamlessAxis.BOTH]:
        top_edge = image[:edge_width, :]
        bottom_edge = image[-edge_width:, :]
        vertical_score = calculate_edge_similarity(
            top_edge.reshape(-1, image.shape[2] if len(image.shape) > 2 else 1),
            bottom_edge.reshape(-1, image.shape[2] if len(image.shape) > 2 else 1)
        )
    
    # Calculate overall score based on axis
    if axis == SeamlessAxis.HORIZONTAL:
        overall_score = horizontal_score
    elif axis == SeamlessAxis.VERTICAL:
        overall_score = vertical_score
    else:
        overall_score = (horizontal_score + vertical_score) / 2
    
    is_seamless = overall_score >= threshold
    
    # Estimate mismatched pixels
    total_edge_pixels = (w * edge_width * 2 + h * edge_width * 2) if axis == SeamlessAxis.BOTH else \
                        (w * edge_width * 2) if axis == SeamlessAxis.HORIZONTAL else \
                        (h * edge_width * 2)
    mismatch_estimate = int(total_edge_pixels * (1 - overall_score / 100))
    
    message = f"{'✅ Seamless' if is_seamless else '⚠️ Not seamless'} - " \
              f"H:{horizontal_score:.0f}% V:{vertical_score:.0f}% Overall:{overall_score:.0f}%"
    
    return SeamlessValidationResult(
        is_seamless=is_seamless,
        horizontal_score=horizontal_score,
        vertical_score=vertical_score,
        overall_score=overall_score,
        edge_mismatch_pixels=mismatch_estimate,
        message=message,
    )


def make_seamless(
    image: np.ndarray,
    axis: SeamlessAxis = SeamlessAxis.BOTH,
    blend_width: int = 4,
) -> np.ndarray:
    """
    Auto-fix a tile to be seamlessly tileable by blending edges.
    
    Uses a simple gradient blend at edges to ensure smooth transitions
    when the tile is repeated.
    
    Args:
        image: Input image (BGR or BGRA numpy array)
        axis: Which axis/axes to make seamless
        blend_width: How many pixels to blend at edges
    
    Returns:
        Modified image with seamless edges
    """
    h, w = image.shape[:2]
    result = image.copy().astype(np.float32)
    blend_width = min(blend_width, min(h, w) // 4)
    
    if axis in [SeamlessAxis.HORIZONTAL, SeamlessAxis.BOTH]:
        # Create horizontal blend
        # We'll blend the left and right edges so they match
        for i in range(blend_width):
            alpha = i / blend_width  # 0 at edge, 1 at blend_width
            
            # Blend left edge towards right edge values
            result[:, i] = (
                result[:, i] * alpha + 
                result[:, -(blend_width - i)] * (1 - alpha)
            )
            
            # Blend right edge towards left edge values
            result[:, -(i + 1)] = (
                result[:, -(i + 1)] * alpha + 
                result[:, blend_width - i - 1] * (1 - alpha)
            )
    
    if axis in [SeamlessAxis.VERTICAL, SeamlessAxis.BOTH]:
        # Create vertical blend
        for i in range(blend_width):
            alpha = i / blend_width
            
            # Blend top edge towards bottom edge values
            result[i, :] = (
                result[i, :] * alpha + 
                result[-(blend_width - i), :] * (1 - alpha)
            )
            
            # Blend bottom edge towards top edge values
            result[-(i + 1), :] = (
                result[-(i + 1), :] * alpha + 
                result[blend_width - i - 1, :] * (1 - alpha)
            )
    
    return np.clip(result, 0, 255).astype(np.uint8)


def validate_and_fix_seamless(
    image_bytes: bytes,
    axis: str = "horizontal",
    auto_fix: bool = True,
    threshold: float = 85.0,
) -> tuple[bytes, SeamlessValidationResult]:
    """
    High-level function to validate and optionally fix seamless tiling.
    
    Args:
        image_bytes: PNG image bytes
        axis: "horizontal", "vertical", or "both"
        auto_fix: Whether to automatically fix non-seamless tiles
        threshold: Minimum score to consider seamless
    
    Returns:
        (possibly_fixed_bytes, validation_result)
    """
    # Decode image
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)
    
    if image is None:
        return image_bytes, SeamlessValidationResult(
            is_seamless=False,
            horizontal_score=0,
            vertical_score=0,
            overall_score=0,
            edge_mismatch_pixels=0,
            message="❌ Failed to decode image",
        )
    
    # Map string to enum
    axis_enum = {
        "horizontal": SeamlessAxis.HORIZONTAL,
        "vertical": SeamlessAxis.VERTICAL,
        "both": SeamlessAxis.BOTH,
    }.get(axis.lower(), SeamlessAxis.HORIZONTAL)
    
    # Validate
    result = validate_seamless(image, axis_enum, threshold=threshold)
    
    print(f"🔲 Tile Validation: {result.message}")
    
    # Auto-fix if needed
    if not result.is_seamless and auto_fix:
        print(f"🔧 Auto-fixing seamless edges...")
        fixed_image = make_seamless(image, axis_enum)
        
        # Re-validate
        fixed_result = validate_seamless(fixed_image, axis_enum, threshold=threshold)
        
        if fixed_result.overall_score > result.overall_score:
            print(f"✅ Fixed: {result.overall_score:.0f}% → {fixed_result.overall_score:.0f}%")
            
            # Encode and return fixed image
            success, encoded = cv2.imencode('.png', fixed_image)
            if success:
                return encoded.tobytes(), fixed_result
        else:
            print(f"⚠️ Fix did not improve seamlessness")
    
    return image_bytes, result
