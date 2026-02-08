"""
Stage 8: Repair Loop

Single-frame mask-based repairs using gemini-3-pro-image-preview edit_image.
Includes previous frame context for animation consistency.
Now includes full post-processing pipeline for repaired frames.
"""
from app.services.gemini_client import gemini_client
from app.services.stages.stage_7_post_processing import (
    make_sprite_transparent,
    remove_noise_morphological,
    remove_small_components,
)


async def repair_frame(
    frame_image: bytes,
    mask_bytes: bytes,
    repair_instruction: str,
    reference_image: bytes,
    context_frames: list[bytes] = None,
    frame_script: dict = None,
    frame_index: int = 0,
    total_frames: int = 1,
    canonical_height: int = None,
    current_frame_bounds: tuple = None,
    target_width: int = None,
    target_height: int = None,
) -> bytes:
    """
    Repair a single frame using mask-based inpainting with context from nearby frames.
    
    This is the repair loop stage - we NEVER regenerate the entire grid,
    only the specific frame that needs fixing.
    
    Args:
        frame_image: The frame to repair (PNG bytes)
        mask_bytes: Mask indicating area to edit (white = edit area)
        repair_instruction: Natural language description of the repair
        reference_image: Original reference image for consistency
        context_frames: Previous 1-2 frames for animation consistency (optional)
        frame_script: Animation script data for this frame (phase, pose, etc.)
        frame_index: Which frame is being repaired (0-indexed)
        total_frames: Total frames in animation
        canonical_height: Standing height from frame 1 (scale reference in pixels)
        current_frame_bounds: (width, height) of this frame's sprite bounding box
    
    Returns:
        Repaired frame as PNG bytes (with transparent background)
    """
    # Build size reference section
    size_reference = ""
    if canonical_height:
        size_reference = f"""
=== SIZE REFERENCE ===
- Character canonical height (standing): {canonical_height}px
- Current frame bounds: {current_frame_bounds[0]}x{current_frame_bounds[1]}px
- The character SCALE must remain consistent with other frames
- Pose may change bounding box, but body parts must not shrink/grow
""" if current_frame_bounds else f"""
=== SIZE REFERENCE ===
- Character canonical height (standing): {canonical_height}px
- The character SCALE must remain consistent with other frames
- Body parts must not shrink/grow
"""
    
    # Build frame requirements section
    frame_requirements = ""
    if frame_script:
        phase = frame_script.get("phase", "unknown")
        pose = frame_script.get("pose_description", "")
        visual_focus = frame_script.get("visual_focus", "")
        frame_requirements = f"""
=== CURRENT FRAME REQUIREMENTS ===
- Phase: {phase}
- Pose: {pose}
- Visual Focus: {visual_focus}
"""
    
    # Build the improved repair prompt
    repair_prompt = f"""
=== OUTPUT FORMAT (MANDATORY) ===
- Return PNG with WHITE background (#FFFFFF)
- Character sprite on pure white background
- Pixel art style: clean edges, no anti-aliasing, no gradients

=== REPAIR TASK ===
Instruction: {repair_instruction}

=== ANIMATION CONTEXT ===
- Repairing frame {frame_index + 1} of {total_frames}
- {len(context_frames) if context_frames else 0} previous frame(s) provided as reference
- Character SIZE, POSITION, and SCALE must match the animation sequence
{size_reference}
{frame_requirements}

=== CONSTRAINTS ===

1. SCALE PRESERVATION:
   - Match the character scale from context frames
   - Body proportions must stay consistent
   - Do NOT enlarge or shrink the character

2. POSE PRESERVATION:
   - Keep the EXACT pose from the original frame
   - Do NOT change to standing/idle pose
   - Silhouette must remain nearly identical

3. REPAIR SCOPE:
   - Apply ONLY the requested repair
   - For effects (glow, aura): add around character, don't modify character pixels
   - For fixes (color, artifact): modify only the affected area

4. STYLE CONSISTENCY:
   - Match pixel art style (clean edges, no anti-aliasing)
   - Same color palette as existing frames
   - Same level of detail

=== DO NOT ===
- Scale character up or down
- Change pose to standing/idle
- Use any background color other than pure white (#FFFFFF)
- Apply anti-aliasing to pixel edges
- Add gradients or soft shadows
- Modify unrelated areas of the sprite
"""
    
    # Pass context frames to the edit_image function
    repaired_bytes = await gemini_client.edit_image(
        image_bytes=frame_image,
        mask_bytes=mask_bytes,
        edit_prompt=repair_prompt,
        reference_image=reference_image,
        context_images=context_frames,
    )
    
    # Apply full post-processing pipeline to repaired frame
    repaired_bytes = await post_process_repaired_frame(
        repaired_bytes,
        target_width=target_width,
        target_height=target_height,
    )
    
    return repaired_bytes


async def post_process_repaired_frame(
    repaired_bytes: bytes,
    target_width: int = None,
    target_height: int = None,
) -> bytes:
    """
    Apply the SAME post-processing pipeline as normal sprite generation.
    
    This ensures repaired frames match the visual quality and style of original frames.
    Matches stage_7_post_processing.py extract_frames() + normalize_frames() pipeline.
    
    Pipeline (aligned with normal generation):
    1. Create binary mask from white background
    2. Apply morphological noise removal (same as extract_frames)
    3. Remove small components <50px (same as extract_frames)
    4. Resize to match target dimensions (if provided)
    5. Make background transparent (same as normalize_frames)
    6. Encode as PNG with alpha
    
    Args:
        repaired_bytes: Raw repaired image from Gemini (white background)
        target_width: Target width to resize to (from other frames)
        target_height: Target height to resize to (from other frames)
    
    Returns:
        Post-processed PNG bytes matching normal generation quality
    """
    import cv2
    import numpy as np
    from io import BytesIO
    from PIL import Image
    
    try:
        # Load the repaired image
        img = Image.open(BytesIO(repaired_bytes))
        img_array = np.array(img)
        
        print(f"🔧 Post-processing repaired frame (full pipeline): {img_array.shape}")
        
        # Convert RGB to BGR for OpenCV if needed
        if len(img_array.shape) == 3:
            if img_array.shape[2] == 3:
                img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
            elif img_array.shape[2] == 4:
                # If already has alpha, extract BGR
                img_array = cv2.cvtColor(img_array, cv2.COLOR_RGBA2BGRA)
                img_array = img_array[:, :, :3]  # Drop alpha, we'll regenerate it
        
        # Step 1: Create binary mask (same as extract_frames)
        gray = cv2.cvtColor(img_array, cv2.COLOR_BGR2GRAY)
        _, binary = cv2.threshold(gray, 250, 255, cv2.THRESH_BINARY_INV)
        print("  ✓ Created binary mask (threshold=250)")
        
        # Step 2: Morphological noise removal (same as extract_frames)
        binary = remove_noise_morphological(binary, kernel_size=3)
        print("  ✓ Applied morphological noise removal")
        
        # Step 3: Remove small components (same as extract_frames)
        binary = remove_small_components(binary, min_area=50)
        print("  ✓ Removed small components (<50px)")
        
        # Step 4: Resize to match target dimensions (if provided)
        if target_width and target_height:
            current_h, current_w = img_array.shape[:2]
            if current_w != target_width or current_h != target_height:
                print(f"  ↳ Resizing from {current_w}x{current_h} to {target_width}x{target_height}")
                # Use INTER_NEAREST for pixel art to preserve sharp edges
                img_array = cv2.resize(img_array, (target_width, target_height), interpolation=cv2.INTER_NEAREST)
                binary = cv2.resize(binary, (target_width, target_height), interpolation=cv2.INTER_NEAREST)
                print("  ✓ Resized to match other frames")
        
        # Step 5: Apply cleaned mask to create transparency
        # Convert to BGRA
        if img_array.shape[2] == 3:
            result = cv2.cvtColor(img_array, cv2.COLOR_BGR2BGRA)
        else:
            result = img_array.copy()
        
        # Set alpha from cleaned binary mask
        result[:, :, 3] = binary
        print("  ✓ Applied transparency from cleaned mask")
        
        # Step 5: Encode back to PNG with transparency
        success, encoded = cv2.imencode('.png', result)
        if success:
            repaired_bytes = encoded.tobytes()
            print("✅ Post-processing complete (full pipeline matched)")
        
    except Exception as e:
        print(f"⚠️ Post-processing failed, returning raw image: {e}")
    
    return repaired_bytes


async def auto_detect_issues(frame_image: bytes, reference_image: bytes) -> dict:
    """
    Automatically detect issues in a frame that may need repair.
    
    Args:
        frame_image: Frame to analyze
        reference_image: Reference image for comparison
    
    Returns:
        Dictionary with detected issues and suggested repairs
    """
    analysis_prompt = """
Analyze this pixel art sprite frame for quality issues.

Check for:
1. Inconsistent colors compared to reference
2. Broken silhouette or missing pixels
3. Incorrect proportions
4. Animation artifacts (ghosting, stretching)
5. Style inconsistency

Return JSON:
{
    "has_issues": true/false,
    "issues": [
        {
            "type": "color_inconsistency|broken_silhouette|proportion_error|artifact|style_mismatch",
            "description": "What's wrong",
            "suggested_repair": "How to fix it",
            "severity": "low|medium|high"
        }
    ]
}
"""
    
    result = await gemini_client.generate_text_with_image(
        prompt=analysis_prompt,
        image_bytes=frame_image,
        thinking_level="low",
        temperature=0.2,
    )
    
    return result
