"""
Stage 7: Post-Processing

OpenCV-based frame extraction, alignment, pivot calculation, and cleanup.
Enhanced with:
- Morphological noise removal
- Watershed segmentation for overlapping sprites
- Row-major contour sorting
- Flying/jumping pose detection with center-of-mass pivots
"""
import cv2
import numpy as np
from dataclasses import dataclass
from typing import Literal


@dataclass
class ExtractedFrame:
    """A single extracted frame with metadata."""
    index: int
    image: np.ndarray
    x: int
    y: int
    width: int
    height: int
    pivot_x: float
    pivot_y: float
    is_airborne: bool = False


@dataclass
class PostProcessingResult:
    """Result of spritesheet post-processing."""
    frames: list[ExtractedFrame]
    frame_width: int
    frame_height: int
    pivots: list[tuple[float, float]]


# ============ Noise Removal ============

def remove_noise_morphological(binary: np.ndarray, kernel_size: int = 3) -> np.ndarray:
    """
    Apply morphological operations to remove small noise and fill holes.
    
    Uses opening (erosion → dilation) to remove noise,
    then closing (dilation → erosion) to fill small holes.
    
    Args:
        binary: Binary image (0 and 255)
        kernel_size: Size of morphological kernel
    
    Returns:
        Cleaned binary image
    """
    kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, (kernel_size, kernel_size)
    )
    
    # Opening: remove small noise (erosion then dilation)
    opened = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    
    # Closing: fill small holes (dilation then erosion)
    closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel)
    
    return closed


def remove_small_components(binary: np.ndarray, min_area: int = 100) -> np.ndarray:
    """
    Remove connected components smaller than min_area pixels.
    
    Args:
        binary: Binary image
        min_area: Minimum area in pixels to keep
    
    Returns:
        Binary image with small components removed
    """
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
        binary, connectivity=8
    )
    
    result = np.zeros_like(binary)
    
    for i in range(1, num_labels):  # Skip background (label 0)
        area = stats[i, cv2.CC_STAT_AREA]
        if area >= min_area:
            result[labels == i] = 255
    
    return result


# ============ Frame Border Removal ============

def remove_frame_borders(
    image: np.ndarray,
    max_border_width: int = 5
) -> np.ndarray:
    """
    Remove thin frame borders/outlines that Gemini sometimes adds around cells.
    
    ONLY removes rows/columns that are UNIFORMLY dark (actual border lines).
    Does NOT crop rows with mixed content (sprite pixels).
    
    Args:
        image: Input BGR image
        max_border_width: Maximum border width to detect and remove (in pixels)
    
    Returns:
        Image with borders removed (cropped)
    """
    h, w = image.shape[:2]
    if h < 20 or w < 20:
        return image  # Too small to process
        
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    
    top_crop = 0
    bottom_crop = h
    left_crop = 0
    right_crop = w
    
    def is_border_line(pixels: np.ndarray) -> bool:
        """Check if a row/column is a uniform border line (not sprite content)."""
        mean_val = np.mean(pixels)
        std_val = np.std(pixels)
        max_val = np.max(pixels)
        
        # Border line criteria:
        # 1. Very uniform (low std) AND dark (mean < 80) - solid dark line
        # 2. OR very uniform AND very bright (mean > 250) - could skip these
        # Key: high std means mixed content (sprite + background) = NOT a border
        
        if std_val < 15 and mean_val < 80:
            return True  # Uniform dark line = border
        return False
    
    # Detect top border - only remove UNIFORM dark lines
    for y in range(min(max_border_width, h)):
        row = gray[y, :]
        if is_border_line(row):
            top_crop = y + 1
        else:
            break  # Stop at first non-border row
    
    # Detect bottom border
    for y in range(h - 1, max(h - max_border_width - 1, 0), -1):
        row = gray[y, :]
        if is_border_line(row):
            bottom_crop = y
        else:
            break
    
    # Detect left border
    for x in range(min(max_border_width, w)):
        col = gray[:, x]
        if is_border_line(col):
            left_crop = x + 1
        else:
            break
    
    # Detect right border
    for x in range(w - 1, max(w - max_border_width - 1, 0), -1):
        col = gray[:, x]
        if is_border_line(col):
            right_crop = x
        else:
            break
    
    # Only crop if we detected borders
    if top_crop > 0 or bottom_crop < h or left_crop > 0 or right_crop < w:
        print(f"  🔲 Removed frame border: top={top_crop}, bottom={h-bottom_crop}, left={left_crop}, right={w-right_crop}")
        return image[top_crop:bottom_crop, left_crop:right_crop]
    
    return image


# ============ Background Removal ============

def remove_white_background(
    image: np.ndarray,
    threshold: int = 240,
    feather: int = 1
) -> np.ndarray:
    """
    Remove white background and make it transparent.
    
    Args:
        image: Input BGR or BGRA image
        threshold: Pixels with all channels >= this value are considered white
        feather: Edge feathering radius for smoother edges (0 = sharp)
    
    Returns:
        BGRA image with transparent background
    """
    # Convert to BGRA if needed
    if len(image.shape) == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGRA)
    elif image.shape[2] == 3:
        image = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
    
    # Create mask where all RGB channels are above threshold (white)
    bgr = image[:, :, :3]
    is_white = np.all(bgr >= threshold, axis=2)
    
    # Create alpha channel (255 for sprite, 0 for background)
    alpha = np.where(is_white, 0, 255).astype(np.uint8)
    
    # Apply edge feathering for smoother edges
    if feather > 0:
        # Dilate the sprite mask slightly, then blur
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (feather * 2 + 1, feather * 2 + 1))
        alpha_dilated = cv2.dilate(alpha, kernel, iterations=1)
        alpha = cv2.GaussianBlur(alpha_dilated, (feather * 2 + 1, feather * 2 + 1), 0)
        # Keep original sharp alpha where sprite is
        alpha = np.maximum(alpha, np.where(is_white, 0, 255).astype(np.uint8))
    
    # Set alpha channel
    result = image.copy()
    result[:, :, 3] = alpha
    
    return result


def remove_background_adaptive(
    image: np.ndarray,
    bg_color: tuple[int, int, int] = None,
    tolerance: int = 15
) -> np.ndarray:
    """
    Remove background using adaptive color detection.
    Automatically detects background color from corners if not specified.
    
    Args:
        image: Input BGR image
        bg_color: Background color as (B, G, R) tuple, or None to auto-detect
        tolerance: Color matching tolerance
    
    Returns:
        BGRA image with transparent background
    """
    h, w = image.shape[:2]
    
    # Auto-detect background color from corners
    if bg_color is None:
        corners = [
            image[0, 0],
            image[0, w-1],
            image[h-1, 0],
            image[h-1, w-1]
        ]
        # Use median of corner colors
        bg_color = tuple(int(np.median([c[i] for c in corners])) for i in range(3))
    
    # Convert to BGRA
    if image.shape[2] == 3:
        result = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
    else:
        result = image.copy()
    
    # Create mask based on color distance
    diff = np.abs(image[:, :, :3].astype(np.int16) - np.array(bg_color, dtype=np.int16))
    distance = np.max(diff, axis=2)
    
    # Pixels within tolerance are background
    alpha = np.where(distance <= tolerance, 0, 255).astype(np.uint8)
    
    result[:, :, 3] = alpha
    
    return result


def make_sprite_transparent(
    sprite: np.ndarray,
    method: str = "white",
    threshold: int = 240
) -> np.ndarray:
    """
    Make sprite background transparent using the specified method.
    
    Args:
        sprite: Input image (BGR or BGRA)
        method: "white" for white background, "adaptive" for auto-detection
        threshold: White threshold for "white" method
    
    Returns:
        BGRA image with transparent background
    """
    if method == "white":
        return remove_white_background(sprite, threshold=threshold)
    elif method == "adaptive":
        return remove_background_adaptive(sprite)
    else:
        # Default: just convert to BGRA without removing background
        if len(sprite.shape) == 2:
            return cv2.cvtColor(sprite, cv2.COLOR_GRAY2BGRA)
        elif sprite.shape[2] == 3:
            return cv2.cvtColor(sprite, cv2.COLOR_BGR2BGRA)
        return sprite


# ============ Watershed Segmentation ============

def segment_overlapping_sprites(
    binary: np.ndarray,
    color_image: np.ndarray,
    expected_count: int
) -> list[np.ndarray]:
    """
    Use watershed algorithm to separate overlapping sprites.
    
    This is useful when Gemini generates sprites that touch or overlap.
    
    Args:
        binary: Binary mask of all sprites
        color_image: Original color image
        expected_count: Expected number of sprites
    
    Returns:
        List of masks, one per separated sprite
    """
    # Distance transform to find centers
    dist = cv2.distanceTransform(binary, cv2.DIST_L2, 5)
    
    # Normalize and threshold to find sure foreground
    cv2.normalize(dist, dist, 0, 1.0, cv2.NORM_MINMAX)
    _, sure_fg = cv2.threshold(dist, 0.5 * dist.max(), 255, cv2.THRESH_BINARY)
    sure_fg = np.uint8(sure_fg)
    
    # Find markers from connected components
    num_labels, markers = cv2.connectedComponents(sure_fg)
    
    # If we found approximately the expected count, use them
    if abs(num_labels - 1 - expected_count) <= 2:
        # Markers found match expectation
        markers = markers + 1
        markers[binary == 0] = 0
        
        # Apply watershed
        markers = cv2.watershed(color_image, markers)
        
        # Extract individual masks
        masks = []
        for i in range(2, markers.max() + 1):
            mask = np.zeros_like(binary)
            mask[markers == i] = 255
            if np.sum(mask) > 0:
                masks.append(mask)
        
        return masks
    
    # Fallback: just return the full binary as one mask
    return [binary]


# ============ Contour Sorting ============

def sort_contours_row_major(
    contours: list[np.ndarray],
    grid_dim: int,
    cell_w: int,
    cell_h: int
) -> list[tuple[np.ndarray, int, int]]:
    """
    Sort contours in row-major order based on their bounding box positions.
    
    Args:
        contours: List of contours
        grid_dim: Expected grid dimension
        cell_w: Expected cell width
        cell_h: Expected cell height
    
    Returns:
        List of (contour, row, col) sorted row-major
    """
    # Calculate center of each contour
    contour_info = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        cx = x + w // 2
        cy = y + h // 2
        
        # Determine grid position
        col = min(cx // cell_w, grid_dim - 1)
        row = min(cy // cell_h, grid_dim - 1)
        
        contour_info.append((c, row, col, y, x))  # Include y,x for sub-sorting
    
    # Sort by (row, col, y, x) for stable row-major ordering
    contour_info.sort(key=lambda item: (item[1], item[2], item[3], item[4]))
    
    return [(c, row, col) for c, row, col, _, _ in contour_info]


# ============ Pivot Detection ============

def detect_airborne_pose(
    sprite_mask: np.ndarray,
    bottom_threshold: float = 0.15
) -> bool:
    """
    Detect if a sprite is in an airborne (flying/jumping) pose.
    
    Analyzes the vertical distribution of pixels. If most mass is in
    the upper portion with little at the bottom, it's likely airborne.
    
    Args:
        sprite_mask: Binary mask of the sprite
        bottom_threshold: Fraction of height to check at bottom
    
    Returns:
        True if likely airborne, False if grounded
    """
    h = sprite_mask.shape[0]
    bottom_rows = int(h * bottom_threshold)
    
    if bottom_rows < 1:
        return False
    
    # Calculate pixel density at bottom vs total
    total_pixels = np.sum(sprite_mask > 0)
    if total_pixels == 0:
        return False
    
    bottom_pixels = np.sum(sprite_mask[-bottom_rows:, :] > 0)
    bottom_ratio = bottom_pixels / total_pixels
    
    # If less than 10% of pixels are in the bottom 15%, likely airborne
    return bottom_ratio < 0.10


def calculate_smart_pivot(
    sprite_mask: np.ndarray,
    action_type: str = "unknown"
) -> tuple[float, float, bool]:
    """
    Calculate pivot point based on sprite pose and action type.
    
    For grounded poses: bottom-center pivot
    For airborne poses: center-of-mass pivot
    
    Args:
        sprite_mask: Binary mask of the sprite
        action_type: Type of action (for hints)
    
    Returns:
        (pivot_x, pivot_y, is_airborne)
    """
    # Check if action hints at airborne
    airborne_actions = {"jump", "fly", "leap", "hover", "fall", "aerial", "air"}
    is_action_airborne = any(a in action_type.lower() for a in airborne_actions)
    
    # Detect from pixel distribution
    is_pose_airborne = detect_airborne_pose(sprite_mask)
    
    is_airborne = is_action_airborne or is_pose_airborne
    
    if is_airborne:
        # Use center-of-mass
        moments = cv2.moments(sprite_mask)
        if moments["m00"] > 0:
            cx = moments["m10"] / moments["m00"]
            cy = moments["m01"] / moments["m00"]
            h, w = sprite_mask.shape
            pivot_x = cx / w
            pivot_y = cy / h
        else:
            pivot_x, pivot_y = 0.5, 0.5
    else:
        # Grounded: bottom-center
        pivot_x = 0.5
        pivot_y = 1.0
    
    return pivot_x, pivot_y, is_airborne


# ============ Contour-Based Sprite Detection ============

def remove_grid_lines(binary: np.ndarray, line_thickness: int = 5) -> np.ndarray:
    """
    Remove horizontal and vertical grid lines from binary image.
    Grid lines connect sprites and break contour detection.
    
    Args:
        binary: Binary image (0 and 255)
        line_thickness: Maximum thickness of grid lines to remove
    
    Returns:
        Binary image with grid lines removed
    """
    h, w = binary.shape
    result = binary.copy()
    
    # Detect horizontal lines using morphological operations
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (w // 4, 1))
    horizontal_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, horizontal_kernel)
    
    # Detect vertical lines
    vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, h // 4))
    vertical_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, vertical_kernel)
    
    # Dilate lines slightly to ensure full removal
    dilate_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (line_thickness, line_thickness))
    horizontal_lines = cv2.dilate(horizontal_lines, dilate_kernel)
    vertical_lines = cv2.dilate(vertical_lines, dilate_kernel)
    
    # Remove lines from result
    result[horizontal_lines > 0] = 0
    result[vertical_lines > 0] = 0
    
    return result


def count_sprites_by_contour(
    grid_image: np.ndarray,
    min_sprite_area: int = 500,
) -> tuple[int, list[tuple[int, int, int, int]]]:
    """
    Count sprites by finding connected components (contours).
    Works regardless of grid spacing inconsistencies.
    Handles spritesheets with visible grid lines/borders.
    
    Args:
        grid_image: Input spritesheet (BGR numpy array)
        min_sprite_area: Minimum area to consider as a sprite
    
    Returns:
        (sprite_count, bounding_boxes) - Count and list of (x, y, w, h) for each sprite
    """
    h, w = grid_image.shape[:2]
    
    # Convert to grayscale
    gray = cv2.cvtColor(grid_image, cv2.COLOR_BGR2GRAY)
    
    # Binary threshold (white bg → black, sprite → white)
    _, binary = cv2.threshold(gray, 250, 255, cv2.THRESH_BINARY_INV)
    
    # Remove grid lines that might connect sprites
    binary = remove_grid_lines(binary, line_thickness=5)
    
    # Apply noise removal
    binary = remove_noise_morphological(binary, kernel_size=3)
    binary = remove_small_components(binary, min_area=50)
    
    # Find connected components
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
        binary, connectivity=8
    )
    
    # Calculate expected sprite size (roughly 1/16 to 1/4 of image)
    min_expected_size = (w * h) // 64  # At least 1/64 of image per sprite
    max_expected_size = (w * h) // 4   # At most 1/4 of image per sprite
    
    # Filter by area and collect bounding boxes
    bboxes = []
    for i in range(1, num_labels):  # Skip background (label 0)
        area = stats[i, cv2.CC_STAT_AREA]
        x = stats[i, cv2.CC_STAT_LEFT]
        y = stats[i, cv2.CC_STAT_TOP]
        bw = stats[i, cv2.CC_STAT_WIDTH]
        bh = stats[i, cv2.CC_STAT_HEIGHT]
        
        # Skip if too small or too large (likely the whole grid)
        if area < min_sprite_area:
            continue
        if area > max_expected_size:
            print(f"  ⚠️ Skipping oversized component: {bw}x{bh} area={area}")
            continue
            
        bboxes.append((x, y, bw, bh))
    
    # Sort by position: top-to-bottom, left-to-right (row-major order)
    if bboxes:
        avg_height = sum(b[3] for b in bboxes) / len(bboxes)
        row_threshold = max(avg_height * 0.5, 50)  # Minimum threshold
        
        # Sort by y first, then x
        bboxes.sort(key=lambda b: (b[1] // int(row_threshold), b[0]))
    
    print(f"🔍 Contour detection: found {len(bboxes)} sprites (min_area={min_sprite_area})")
    return len(bboxes), bboxes


def extract_frames_by_contour(
    grid_image: np.ndarray,
    bboxes: list[tuple[int, int, int, int]],
    action_type: str = "unknown",
    padding: int = 5,
) -> PostProcessingResult:
    """
    Extract frames using pre-detected bounding boxes (contour-based).
    
    Args:
        grid_image: Input spritesheet (BGR numpy array)
        bboxes: List of (x, y, w, h) bounding boxes for each sprite
        action_type: Action type for pivot hints
        padding: Padding around each sprite
    
    Returns:
        PostProcessingResult with extracted frames and pivots
    """
    print(f"📐 Contour-based extraction: {len(bboxes)} sprites")
    
    h, w = grid_image.shape[:2]
    frames: list[ExtractedFrame] = []
    
    for idx, (bx, by, bw, bh) in enumerate(bboxes):
        # Add padding
        x1 = max(0, bx - padding)
        y1 = max(0, by - padding)
        x2 = min(w, bx + bw + padding)
        y2 = min(h, by + bh + padding)
        
        # Extract sprite and remove any borders
        sprite = grid_image[y1:y2, x1:x2]
        sprite = remove_frame_borders(sprite)  # Clean up Gemini-added borders
        
        # Create mask for pivot calculation
        sprite_gray = cv2.cvtColor(sprite, cv2.COLOR_BGR2GRAY)
        _, sprite_mask = cv2.threshold(sprite_gray, 250, 255, cv2.THRESH_BINARY_INV)
        
        # Calculate smart pivot
        pivot_x, pivot_y, is_airborne = calculate_smart_pivot(sprite_mask, action_type)
        
        frames.append(ExtractedFrame(
            index=idx,
            image=sprite,
            x=x1,
            y=y1,
            width=x2 - x1,
            height=y2 - y1,
            pivot_x=pivot_x,
            pivot_y=pivot_y,
            is_airborne=is_airborne,
        ))
        print(f"  ✅ Frame {idx}: bbox ({bx},{by},{bw},{bh}) → sprite {x2-x1}x{y2-y1}px")
    
    print(f"📦 Extracted {len(frames)} frames via contour method")
    
    # Determine uniform frame size
    if frames:
        max_w = max(f.width for f in frames)
        max_h = max(f.height for f in frames)
    else:
        max_w = max_h = 0
    
    pivots = [(f.pivot_x, f.pivot_y) for f in frames]
    
    return PostProcessingResult(
        frames=frames,
        frame_width=max_w,
        frame_height=max_h,
        pivots=pivots,
    )


# ============ Grid Detection (Gemini Flash) ============

async def detect_grid_layout_with_gemini(
    spritesheet_bytes: bytes,
) -> tuple[int, int, int]:
    """
    Use Gemini Flash to detect grid layout from a spritesheet.
    
    Args:
        spritesheet_bytes: PNG bytes of the spritesheet
    
    Returns:
        (rows, cols, frame_count) - Grid dimensions and frame count
    """
    from app.services.gemini_client import gemini_client
    from app.config import get_settings
    
    settings = get_settings()
    
    prompt = """Analyze this spritesheet image and count the animation frames.

The image contains a grid of character sprites for animation.
Count ONLY cells that contain actual sprite content (not empty/white cells).

Return ONLY a JSON object with these exact fields:
{
    "rows": <number of rows in the grid>,
    "cols": <number of columns in the grid>,
    "frame_count": <total number of non-empty cells with sprites>
}

IMPORTANT:
- Count actual sprites, not empty grid cells
- The grid may have empty cells at the end
- Return ONLY the JSON, no explanation"""

    try:
        result = await gemini_client.generate_text_with_image(
            prompt=prompt,
            image_bytes=spritesheet_bytes,
            thinking_level="low",
            temperature=0.1,
            model_override=settings.gemini_flash_model
        )
        
        # Handle both dict (already parsed) and string (raw) responses
        if isinstance(result, dict):
            # generate_text_with_image returns parsed dict
            data = result
        else:
            # Legacy fallback for raw string response
            import json
            import re
            json_match = re.search(r'\{[^}]+\}', result, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
            else:
                raise ValueError("Could not parse grid response from string")
        
        rows = int(data.get("rows", 4))
        cols = int(data.get("cols", 4))
        frame_count = int(data.get("frame_count", rows * cols))
        
        print(f"🤖 Gemini detected grid: {rows}x{cols} with {frame_count} frames")
        return (rows, cols, frame_count)
    except Exception as e:
        print(f"⚠️ Gemini grid detection failed: {e}")
    
    # Fallback
    print("⚠️ Using fallback grid: 4x4")
    return (4, 4, 16)


def detect_grid_layout_sync(
    grid_image: np.ndarray,
    expected_count: int = None,
) -> tuple[int, int, int]:
    """
    Synchronous fallback for grid detection (simple heuristic).
    Used when async Gemini call is not available.
    
    Args:
        grid_image: Input spritesheet (BGR numpy array)
        expected_count: Expected number of frames
    
    Returns:
        (rows, cols, frame_count) - Grid dimensions and frame count
    """
    # Simple heuristic: use expected count to determine grid
    if expected_count:
        import math
        # Find smallest square grid that fits expected count
        grid_dim = math.ceil(math.sqrt(expected_count))
        return (grid_dim, grid_dim, expected_count)
    
    return (4, 4, 16)


def extract_frames_hybrid(
    grid_image: np.ndarray,
    expected_count: int,
    gemini_rows: int,
    gemini_cols: int,
    gemini_frame_count: int,
    is_grounded: bool = True,
    action_type: str = "unknown",
    apply_noise_removal: bool = True,
) -> PostProcessingResult:
    """
    Hybrid frame extraction: validates Gemini detection with contour counting.
    
    Strategy:
    1. Count sprites using contour detection
    2. Compare with Gemini's count
    3. If match → use grid extraction (faster, more uniform)
    4. If mismatch → use contour extraction (handles irregular spacing)
    
    Args:
        grid_image: Input spritesheet (BGR numpy array)
        expected_count: Expected number of frames from pipeline
        gemini_rows: Rows detected by Gemini
        gemini_cols: Columns detected by Gemini
        gemini_frame_count: Frame count detected by Gemini
        is_grounded: Default grounded assumption
        action_type: Action type for pivot hints
        apply_noise_removal: Whether to apply morphological cleanup
    
    Returns:
        PostProcessingResult with extracted frames and pivots
    """
    print(f"🔄 Hybrid extraction: Gemini={gemini_rows}x{gemini_cols}={gemini_frame_count}, Expected={expected_count}")
    
    # Step 1: Count sprites using contour detection
    contour_count, bboxes = count_sprites_by_contour(grid_image, min_sprite_area=500)
    
    # Step 2: Determine which method to use
    gemini_diff = abs(gemini_frame_count - expected_count)
    contour_diff = abs(contour_count - expected_count)
    
    use_contour = False
    
    # Contour detection failed if it found way too few sprites (< 50% of expected)
    contour_failed = contour_count < expected_count * 0.5
    
    if contour_failed:
        print(f"⚠️ Contour detection failed: found only {contour_count} vs expected {expected_count}")
        use_contour = False
    elif contour_count == expected_count:
        # Contour matches expected perfectly
        print(f"✅ Contour count ({contour_count}) matches expected ({expected_count})")
        use_contour = True
    elif contour_diff < gemini_diff and contour_count >= expected_count * 0.8:
        # Contour is closer to expected AND found at least 80% of expected
        print(f"✅ Contour count ({contour_count}) closer to expected than Gemini ({gemini_frame_count})")
        use_contour = True
    elif gemini_frame_count > expected_count * 1.3 and contour_count >= expected_count * 0.8:
        # Gemini detected too many, contour found reasonable amount
        print(f"⚠️ Gemini detected too many ({gemini_frame_count}), contour found {contour_count}")
        use_contour = True
    
    # Step 3: Extract using chosen method
    if use_contour and contour_count > 0:
        print(f"🎯 Using CONTOUR-BASED extraction ({contour_count} sprites)")
        return extract_frames_by_contour(grid_image, bboxes, action_type)
    else:
        # Fall back to grid-based extraction
        # Use expected count, not Gemini count (Gemini might be wrong due to grid lines)
        grid_rows = gemini_rows
        grid_cols = gemini_cols
        
        # If Gemini count doesn't match expected, recalculate grid from expected
        if gemini_frame_count != expected_count:
            import math
            grid_dim = math.ceil(math.sqrt(expected_count))
            # Check if expected fits in Gemini's grid
            if gemini_rows * gemini_cols >= expected_count:
                # Use Gemini's grid but cap frame count
                pass
            else:
                # Recalculate grid
                grid_rows = grid_cols = grid_dim
                print(f"  ↳ Adjusted grid to {grid_rows}x{grid_cols} for {expected_count} frames")
        
        print(f"🎯 Using GRID-BASED extraction ({grid_rows}x{grid_cols}, {expected_count} frames)")
        return extract_frames(
            grid_image=grid_image,
            expected_count=expected_count,
            grid_rows=grid_rows,
            grid_cols=grid_cols,
            is_grounded=is_grounded,
            action_type=action_type,
            apply_noise_removal=apply_noise_removal,
        )


# ============ Main Extraction ============

def extract_frames(
    grid_image: np.ndarray,
    expected_count: int,
    grid_rows: int,
    grid_cols: int = None,
    is_grounded: bool = True,
    action_type: str = "unknown",
    apply_noise_removal: bool = True,
) -> PostProcessingResult:
    """
    Extract individual frames from a spritesheet using grid-based approach.
    
    Enhanced with:
    - Morphological noise removal
    - Row-major contour sorting
    - Smart pivot detection for airborne poses
    
    Args:
        grid_image: Input spritesheet (BGR numpy array)
        expected_count: Number of frames to extract
        grid_rows: Number of rows in the grid
        grid_cols: Number of columns in the grid (defaults to grid_rows if not provided)
        is_grounded: Default grounded assumption
        action_type: Action type for pivot hints
        apply_noise_removal: Whether to apply morphological cleanup
    
    Returns:
        PostProcessingResult with extracted frames and pivots
    """
    h, w = grid_image.shape[:2]
    
    # Use provided grid dimensions
    rows = grid_rows
    cols = grid_cols if grid_cols is not None else grid_rows
    frame_count = expected_count
    
    cell_w = w // cols
    cell_h = h // rows
    
    print(f"📐 Grid extraction: {rows}x{cols}, extracting up to {frame_count} frames")
    print(f"📐 Image size: {w}x{h}, Cell size: {cell_w}x{cell_h}")
    
    # Convert to grayscale for processing
    gray = cv2.cvtColor(grid_image, cv2.COLOR_BGR2GRAY)
    
    # Binary inverse threshold (white bg → black, sprite → white)
    _, binary = cv2.threshold(gray, 250, 255, cv2.THRESH_BINARY_INV)
    
    # Apply morphological noise removal
    if apply_noise_removal:
        print("🧹 Applying morphological noise removal...")
        binary = remove_noise_morphological(binary, kernel_size=3)
        binary = remove_small_components(binary, min_area=50)
    
    frames: list[ExtractedFrame] = []
    
    # Extract frames from each grid cell
    for row in range(rows):
        for col in range(cols):
            frame_idx = row * cols + col
            if frame_idx >= frame_count:
                break
            
            # Cell bounds
            x1 = col * cell_w
            y1 = row * cell_h
            x2 = x1 + cell_w
            y2 = y1 + cell_h
            
            # Extract cell and remove any frame borders
            cell = grid_image[y1:y2, x1:x2]
            cell = remove_frame_borders(cell)  # Clean up Gemini-added borders
            
            # Recalculate binary for the cleaned cell
            cell_gray = cv2.cvtColor(cell, cv2.COLOR_BGR2GRAY)
            _, cell_binary = cv2.threshold(cell_gray, 250, 255, cv2.THRESH_BINARY_INV)
            if apply_noise_removal:
                cell_binary = remove_noise_morphological(cell_binary, kernel_size=3)
                cell_binary = remove_small_components(cell_binary, min_area=50)
            
            # Find contours and sort row-major
            contours, _ = cv2.findContours(
                cell_binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )
            
            if contours:
                # Merge all contours to get overall bounding box
                all_points = np.vstack(contours)
                bx, by, bw, bh = cv2.boundingRect(all_points)
                
                # Extract sprite with padding
                padding = 5
                sx1 = max(0, bx - padding)
                sy1 = max(0, by - padding)
                sx2 = min(cell_w, bx + bw + padding)
                sy2 = min(cell_h, by + bh + padding)
                
                sprite = cell[sy1:sy2, sx1:sx2]
                sprite_mask = cell_binary[sy1:sy2, sx1:sx2]
                
                # Calculate smart pivot
                pivot_x, pivot_y, is_airborne = calculate_smart_pivot(
                    sprite_mask, action_type
                )
                
                frames.append(ExtractedFrame(
                    index=frame_idx,
                    image=sprite,
                    x=x1 + sx1,
                    y=y1 + sy1,
                    width=sx2 - sx1,
                    height=sy2 - sy1,
                    pivot_x=pivot_x,
                    pivot_y=pivot_y,
                    is_airborne=is_airborne,
                ))
                print(f"  ✅ Frame {frame_idx}: cell ({row},{col}) → sprite {sx2-sx1}x{sy2-sy1}px {'🦅 airborne' if is_airborne else '🦶 grounded'}")
            else:
                print(f"  ⚠️ Frame {frame_idx}: cell ({row},{col}) is empty")
    
    print(f"📦 Extracted {len(frames)} frames")
    
    # Determine uniform frame size
    if frames:
        max_w = max(f.width for f in frames)
        max_h = max(f.height for f in frames)
    else:
        max_w = max_h = 0
    
    pivots = [(f.pivot_x, f.pivot_y) for f in frames]
    
    return PostProcessingResult(
        frames=frames,
        frame_width=max_w,
        frame_height=max_h,
        pivots=pivots,
    )


def normalize_frames(frames: list[ExtractedFrame], target_w: int, target_h: int) -> list[np.ndarray]:
    """
    Normalize all frames to the same size with transparent background.
    
    Args:
        frames: List of extracted frames
        target_w: Target width
        target_h: Target height
    
    Returns:
        List of normalized frame images (BGRA)
    """
    normalized = []
    
    for frame in frames:
        # Create transparent canvas
        canvas = np.zeros((target_h, target_w, 4), dtype=np.uint8)
        
        # Remove white background and convert to BGRA
        frame_rgba = make_sprite_transparent(frame.image, method="white", threshold=240)
        
        # Use actual image dimensions (may differ from stored width/height after border removal)
        actual_h, actual_w = frame_rgba.shape[:2]
        
        # Position based on pivot
        if frame.is_airborne:
            # Center alignment for airborne
            dx = (target_w - actual_w) // 2
            dy = (target_h - actual_h) // 2
        else:
            # Bottom-center alignment for grounded
            dx = (target_w - actual_w) // 2
            dy = target_h - actual_h
        
        # Clamp to canvas bounds
        src_x1 = max(0, -dx)
        src_y1 = max(0, -dy)
        src_x2 = min(actual_w, target_w - dx)
        src_y2 = min(actual_h, target_h - dy)
        
        dst_x1 = max(0, dx)
        dst_y1 = max(0, dy)
        dst_x2 = dst_x1 + (src_x2 - src_x1)
        dst_y2 = dst_y1 + (src_y2 - src_y1)
        
        if dst_x2 > dst_x1 and dst_y2 > dst_y1:
            canvas[dst_y1:dst_y2, dst_x1:dst_x2] = frame_rgba[src_y1:src_y2, src_x1:src_x2]
        
        normalized.append(canvas)
    
    print(f"🎨 Applied transparency to {len(normalized)} frames")
    return normalized


def encode_frame_png(frame: np.ndarray) -> bytes:
    """Encode a frame as PNG bytes with transparency support."""
    # Ensure BGRA format for transparency
    if len(frame.shape) == 2:
        frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGRA)
    elif frame.shape[2] == 3:
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2BGRA)
    
    success, buffer = cv2.imencode('.png', frame)
    if not success:
        raise RuntimeError("Failed to encode frame as PNG")
    return buffer.tobytes()

