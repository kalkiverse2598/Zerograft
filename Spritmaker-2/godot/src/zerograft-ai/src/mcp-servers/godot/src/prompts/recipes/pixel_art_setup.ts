/**
 * Pixel Art Project Setup Recipe
 * Essential project settings for pixel art games (from Brackeys tutorial)
 */

export const PIXEL_ART_SETUP_RECIPE = `
# Pixel Art Project Setup

These settings can be applied automatically by the agent.

---

## Fix Blurry Sprites

Godot defaults to Linear filtering which blurs pixel art. Set to Nearest:

\`\`\`
Tool: set_project_setting
  setting: "rendering/textures/canvas_textures/default_texture_filter"
  value: 0
\`\`\`

(0 = Nearest/sharp, 1 = Linear/blurry)

---

## Input Actions

Add standard movement inputs:

\`\`\`
Tool: add_input_action
  action: "move_left",  key: "A"
  action: "move_left",  key: "LEFT"
  action: "move_right", key: "D"  
  action: "move_right", key: "RIGHT"
  action: "jump",       key: "SPACE"
\`\`\`

---

## Optional: Small Viewport for Pixel Art

For pixel-perfect scaling, use small viewport + large window:

\`\`\`
Tool: set_project_setting
  setting: "display/window/size/viewport_width",  value: 320
  setting: "display/window/size/viewport_height", value: 180
  setting: "display/window/size/window_width_override",  value: 1280
  setting: "display/window/size/window_height_override", value: 720
  setting: "display/window/stretch/mode", value: "viewport"
\`\`\`

Alternative: Use Camera2D zoom (4x) instead.

---

## Summary

| Setting | Tool | Value |
|---------|------|-------|
| Texture Filter | set_project_setting | 0 (Nearest) |
| Input Actions | add_input_action | jump, move_left, move_right |
| Viewport | set_project_setting | 320x180 (optional) |
`;

export const PIXEL_ART_SETUP_KEYWORDS = [
    'pixel art',
    'pixelart',
    'blurry',
    'blur',
    'blurry sprites',
    'texture filter',
    'nearest',
    'pixel perfect',
    'crisp pixels',
    'sharp pixels'
];
