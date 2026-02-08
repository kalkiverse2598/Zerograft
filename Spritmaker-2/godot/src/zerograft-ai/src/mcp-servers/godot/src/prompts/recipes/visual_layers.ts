/**
 * Visual Layers Recipe
 * Godot 4 rendering order and layer management
 */

export const VISUAL_LAYERS_RECIPE = `
# Visual Layers & Rendering Order

## Rendering Priority (highest to lowest)
1. **CanvasLayers** (layer property) — Separate rendering contexts
2. **Z-index** — Within same CanvasLayer
3. **YSort** — Y-position based sorting (top-down games)
4. **Scene tree order** — Lower in tree = drawn on top

## Recommended Z-Index Convention
| Layer | Z-Index |
|-------|---------|
| Far background | -100 |
| Mid background | -50 |
| Ground/TileMap | -10 |
| Characters | 0 |
| Props/Items | 10 |
| Foreground | 50 |
| UI (CanvasLayer) | layer: 100 |

## Best Practices
- Leave numerical gaps (0, 10, 20) for flexibility
- Use CanvasLayer for UI (HUD, menus) — stays fixed on screen
- Use \`Z as Relative\` for shadows behind parent
- YSort nodes sort children by Y position automatically

## CanvasLayer Usage
\`\`\`gdscript
# UI stays fixed while game scrolls
CanvasLayer (layer: 100)
└── Control (Full Rect)
    └── HUD elements
\`\`\`

## Code Example
\`\`\`gdscript
# Set z-index in code
sprite.z_index = 10

# Make child z-index relative to parent
sprite.z_as_relative = true

# CanvasLayer for UI
var ui_layer = CanvasLayer.new()
ui_layer.layer = 100
add_child(ui_layer)
\`\`\`
`;

export const VISUAL_LAYERS_KEYWORDS = [
    'z-index', 'layer', 'order', 'canvas', 'canvaslayer',
    'ysort', 'render', 'depth', 'foreground', 'background'
];
