"""
Difference Matting Service

Implements the "Difference Matting" technique for extracting true alpha transparency
from AI-generated images. This works by comparing the same image rendered on
white and black backgrounds to mathematically compute the exact alpha channel.

Based on: https://jidefr.medium.com/generating-transparent-background-images-with-nano-banana-pro-2

The math:
- For any pixel P visible on both white (Pw) and black (Pb) backgrounds:
- The difference between Pw and Pb reveals the alpha
- alpha = 1 - (distance(Pw, Pb) / distance(white, black))
- original_color = Pb / alpha (recovering from black version)
"""

import cv2
import numpy as np
from typing import Tuple, Optional
import math


# Distance between pure white and pure black in RGB space
# sqrt(255^2 + 255^2 + 255^2) ≈ 441.67
MAX_BG_DISTANCE = math.sqrt(255**2 + 255**2 + 255**2)


def compute_difference_matte(
    white_image: np.ndarray,
    black_image: np.ndarray,
    edge_refinement: bool = True
) -> np.ndarray:
    """
    Compute true alpha transparency using difference matting.
    
    Given the same subject rendered on white and black backgrounds,
    this computes the mathematically correct alpha channel.
    
    Args:
        white_image: Image with subject on white background (BGR)
        black_image: Image with subject on black background (BGR)
        edge_refinement: Apply edge smoothing for cleaner results
    
    Returns:
        BGRA image with true alpha transparency
    """
    # Ensure same size
    if white_image.shape[:2] != black_image.shape[:2]:
        # Resize black to match white
        black_image = cv2.resize(black_image, (white_image.shape[1], white_image.shape[0]))
    
    # Convert to float for precision
    white_f = white_image.astype(np.float32)
    black_f = black_image.astype(np.float32)
    
    height, width = white_image.shape[:2]
    
    # Calculate pixel-wise distance between white and black versions
    # This reveals how much the background "shows through"
    diff = white_f - black_f
    
    # Euclidean distance per pixel across RGB channels
    pixel_distance = np.sqrt(np.sum(diff ** 2, axis=2))
    
    # Calculate alpha: fully opaque pixels have distance ≈ 0
    # Fully transparent pixels have distance ≈ MAX_BG_DISTANCE
    # alpha = 1 - (pixel_distance / MAX_BG_DISTANCE)
    alpha = 1.0 - (pixel_distance / MAX_BG_DISTANCE)
    
    # Clamp alpha to [0, 1]
    alpha = np.clip(alpha, 0.0, 1.0)
    
    # Recover original foreground color from black version
    # Since Pb = Fg * alpha + Bg * (1-alpha), and Bg = 0 for black:
    # Pb = Fg * alpha, so Fg = Pb / alpha
    # Avoid division by zero
    alpha_safe = np.maximum(alpha, 0.001)
    
    # Recover RGB channels
    recovered = np.zeros((height, width, 3), dtype=np.float32)
    for c in range(3):
        recovered[:, :, c] = black_f[:, :, c] / alpha_safe
    
    # Clamp recovered colors to valid range
    recovered = np.clip(recovered, 0, 255)
    
    # Apply edge refinement if requested
    if edge_refinement:
        alpha = refine_alpha_edges(alpha, recovered)
    
    # Combine into BGRA output
    result = np.zeros((height, width, 4), dtype=np.uint8)
    result[:, :, :3] = recovered.astype(np.uint8)
    result[:, :, 3] = (alpha * 255).astype(np.uint8)
    
    # Count transparency stats
    fully_opaque = np.sum(alpha > 0.99)
    fully_transparent = np.sum(alpha < 0.01)
    semi_transparent = np.sum((alpha >= 0.01) & (alpha <= 0.99))
    
    print(f"🎨 Difference Matte computed:")
    print(f"   Opaque: {fully_opaque} px, Transparent: {fully_transparent} px, Semi: {semi_transparent} px")
    
    return result


def refine_alpha_edges(alpha: np.ndarray, color: np.ndarray) -> np.ndarray:
    """
    Refine alpha channel edges for cleaner compositing.
    
    Applies slight blur and then sharpens to reduce jagged edges
    while maintaining sharp detail.
    
    Args:
        alpha: Alpha channel as float [0, 1]
        color: Recovered RGB as float
    
    Returns:
        Refined alpha channel
    """
    # Convert to uint8 for OpenCV processing
    alpha_u8 = (alpha * 255).astype(np.uint8)
    
    # Light Gaussian blur to smooth jagged edges
    alpha_smooth = cv2.GaussianBlur(alpha_u8, (3, 3), 0.5)
    
    # Use bilateral filter for edge-preserving smoothing
    alpha_refined = cv2.bilateralFilter(alpha_smooth, 5, 25, 25)
    
    # Convert back to float
    return alpha_refined.astype(np.float32) / 255.0


def compute_matte_from_bytes(
    white_bytes: bytes,
    black_bytes: bytes
) -> bytes:
    """
    Convenience function to compute difference matte from image bytes.
    
    Args:
        white_bytes: PNG/JPG bytes of white background version
        black_bytes: PNG/JPG bytes of black background version
    
    Returns:
        PNG bytes with true alpha transparency
    """
    # Decode images
    white_arr = np.frombuffer(white_bytes, np.uint8)
    black_arr = np.frombuffer(black_bytes, np.uint8)
    
    white_img = cv2.imdecode(white_arr, cv2.IMREAD_COLOR)
    black_img = cv2.imdecode(black_arr, cv2.IMREAD_COLOR)
    
    if white_img is None or black_img is None:
        raise ValueError("Failed to decode one or both images")
    
    # Compute matte
    result = compute_difference_matte(white_img, black_img)
    
    # Encode as PNG
    success, encoded = cv2.imencode('.png', result)
    if not success:
        raise ValueError("Failed to encode result image")
    
    return encoded.tobytes()


def verify_image_alignment(
    white_image: np.ndarray,
    black_image: np.ndarray,
    tolerance: float = 0.1
) -> Tuple[bool, float]:
    """
    Verify that white and black versions are properly aligned.
    
    The difference matting technique requires the subject to be
    in exactly the same position in both images.
    
    Args:
        white_image: White background version
        black_image: Black background version
        tolerance: Maximum allowed misalignment ratio
    
    Returns:
        (is_aligned, alignment_score)
    """
    # Convert to grayscale
    if len(white_image.shape) == 3:
        white_gray = cv2.cvtColor(white_image, cv2.COLOR_BGR2GRAY)
        black_gray = cv2.cvtColor(black_image, cv2.COLOR_BGR2GRAY)
    else:
        white_gray = white_image
        black_gray = black_image
    
    # Create masks for non-background pixels
    _, white_mask = cv2.threshold(white_gray, 250, 255, cv2.THRESH_BINARY_INV)
    _, black_mask = cv2.threshold(black_gray, 5, 255, cv2.THRESH_BINARY)
    
    # Calculate IoU (Intersection over Union) of the masks
    intersection = np.sum((white_mask > 0) & (black_mask > 0))
    union = np.sum((white_mask > 0) | (black_mask > 0))
    
    if union == 0:
        return True, 1.0
    
    iou = intersection / union
    is_aligned = iou > (1 - tolerance)
    
    print(f"📐 Alignment check: IoU = {iou:.3f} ({'✓' if is_aligned else '✗'})")
    
    return is_aligned, iou


def prepare_for_matte_generation(prompt: str, layer_type: str) -> Tuple[str, str]:
    """
    Prepare prompts for generating white and black background versions.
    
    Args:
        prompt: Original user prompt for the layer
        layer_type: "far", "mid", or "near"
    
    Returns:
        (white_prompt, black_prompt)
    """
    layer_hints = {
        "far": "distant background layer with mountains, sky, clouds",
        "mid": "middle ground layer with trees, hills, structures",
        "near": "foreground layer with rocks, grass, plants, close details"
    }
    
    layer_hint = layer_hints.get(layer_type, "")
    
    white_prompt = f"""Generate a {layer_type} parallax layer for: {prompt}
    
CRITICAL: Render the subject on a PURE SOLID WHITE (#FFFFFF) background.
The background must be completely flat white with no gradients or patterns.
{layer_hint}

Style: pixel art, game-ready, suitable for 2D game backgrounds"""

    black_prompt = f"""Generate a {layer_type} parallax layer for: {prompt}
    
CRITICAL: Render the subject on a PURE SOLID BLACK (#000000) background.
The background must be completely flat black with no gradients or patterns.
Keep the exact same subject, position, and style as the white version.
{layer_hint}

Style: pixel art, game-ready, suitable for 2D game backgrounds"""

    return white_prompt, black_prompt
