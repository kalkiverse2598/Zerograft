/**
 * Parallax Background Recipe
 * Godot 4 parallax scrolling setup using Parallax2D (preferred)
 */

export const PARALLAX_BACKGROUND_RECIPE = `
# Parallax Background Setup

## Preferred Node: Parallax2D (Godot 4.3+)
Use \`Parallax2D\` instead of ParallaxBackground/Layer for simpler setup.

## Scene Structure
\`\`\`
World (Node2D)
├── Parallax2D (sky)          ← scroll_scale: (0.1, 1)
│   └── Sprite2D
├── Parallax2D (mountains)    ← scroll_scale: (0.3, 1)
│   └── Sprite2D
├── Parallax2D (trees)        ← scroll_scale: (0.7, 1)
│   └── Sprite2D
├── TileMap
├── Player
└── Camera2D
\`\`\`

## Scroll Scale Values (from Godot docs)
| Layer | scroll_scale | Distance |
|-------|--------------|----------|
| Sky | (0.1, 1) | Very far |
| Higher Clouds | (0.2, 1) | Far |
| Lower Clouds | (0.3, 1) | Medium-far |
| Hills | (0.5, 1) | Medium |
| Forest/Trees | (0.7, 1) | Close |
| Camera speed | (1.0, 1) | Same as camera |

## Key Properties
| Property | Purpose |
|----------|---------|
| \`scroll_scale\` | Speed multiplier (lower = further away) |
| \`repeat_size\` | Width for infinite scroll (set to texture width) |
| \`repeat_times\` | How many times to repeat |

## Infinite Scrolling Setup
1. Set \`repeat_size.x\` = texture width
2. Position sprite at (0, 0)
3. Disable "Centered" on Sprite2D

## Code Example
\`\`\`gdscript
# Create parallax layer programmatically
var parallax = Parallax2D.new()
parallax.scroll_scale = Vector2(0.5, 1)
parallax.repeat_size = Vector2(1920, 0)  # Texture width
add_child(parallax)

var sprite = Sprite2D.new()
sprite.texture = preload("res://sprites/background.png")
sprite.centered = false
parallax.add_child(sprite)
\`\`\`

## Legacy Method (ParallaxBackground/Layer)
\`\`\`
ParallaxBackground
├── ParallaxLayer             ← motion_scale: (0.5, 0)
│   └── Sprite2D              ← motion_mirroring: (1920, 0)
\`\`\`

## AI Generation with SpriteMancer
Generate parallax backgrounds using AI:
\`\`\`
# Step 1: Generate layers
spritemancer_generate_parallax(
  prompt: "enchanted forest with glowing mushrooms",
  parallax_layer: "pack",  # Generates far, mid, near
  time_of_day: "twilight"
)
→ Saves: res://sprites/backgrounds/enchanted_forest_far.png
         res://sprites/backgrounds/enchanted_forest_mid.png
         res://sprites/backgrounds/enchanted_forest_near.png

# Step 2: Import to scene
import_parallax_to_scene(
  layer_paths: ["...far.png", "...mid.png", "...near.png"],
  motion_scales: [0.2, 0.5, 0.8]
)
→ Creates ParallaxBackground with 3 layers
\`\`\`

## Common Mistakes
- Forgetting to disable "Centered" on sprites
- Not setting repeat_size correctly
- Sprite not positioned at (0, 0)
`;

export const PARALLAX_KEYWORDS = [
    'parallax', 'background', 'scroll', 'layer', 'infinite',
    'repeat', 'scroll_scale', 'motion', 'depth'
];
