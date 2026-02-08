/**
 * VFX Effects Recipe
 * Godot 4 visual effects with AnimatedSprite2D and AI generation
 */

export const VFX_EFFECTS_RECIPE = `
# Visual Effects (VFX) Setup

## Common VFX Patterns
| Effect Type | Node | Technique |
|-------------|------|-----------|
| Explosion | AnimatedSprite2D | Spritesheet animation |
| Fire/Smoke | GPUParticles2D | Particle system |
| Magic spell | AnimatedSprite2D + Light2D | Animation + glow |
| Trail | Line2D | Points following path |
| Impact | CPUParticles2D | One-shot burst |

## AnimatedSprite2D for VFX
\`\`\`
ExplosionEffect (AnimatedSprite2D)
├── sprite_frames: SpriteFrames resource
├── animation: "explode"
├── one_shot: true (for non-looping)
└── Script: queue_free() on animation_finished
\`\`\`

## Code Example - One-Shot Effect
\`\`\`gdscript
extends AnimatedSprite2D

func _ready() -> void:
    animation_finished.connect(_on_animation_finished)
    play("explode")

func _on_animation_finished() -> void:
    queue_free()
\`\`\`

## Spawning Effects Dynamically
\`\`\`gdscript
const ExplosionScene = preload("res://effects/explosion.tscn")

func spawn_explosion(pos: Vector2) -> void:
    var explosion = ExplosionScene.instantiate()
    explosion.global_position = pos
    get_tree().current_scene.add_child(explosion)
\`\`\`

## GPUParticles2D for Continuous Effects
\`\`\`
FireEffect (GPUParticles2D)
├── amount: 50
├── process_material: ParticleProcessMaterial
│   ├── emission_shape: sphere
│   ├── gravity: (0, -100)
│   ├── initial_velocity: 50
│   └── color_ramp: orange → red → transparent
└── texture: spark.png
\`\`\`

## AI Generation with SpriteMancer
Generate VFX spritesheets using AI:
\`\`\`
# Step 1: Generate effect spritesheet
spritemancer_generate_effect(
  prompt: "blue magic explosion with sparkles",
  preset: "magic",
  frame_count: 8,
  size: "64x64",
  looping: false
)
→ Saves: res://sprites/effects/blue_magic_effect.png

# Step 2: Import to scene
import_effect_to_scene(
  spritesheet_path: "res://sprites/effects/blue_magic_effect.png",
  parent_node: ".",
  node_name: "MagicExplosion",
  frame_count: 8,
  fps: 12,
  loop: false
)
→ Creates AnimatedSprite2D with SpriteFrames
\`\`\`

## Effect Presets
| Preset | Description |
|--------|-------------|
| \`explosion\` | Fire burst, debris |
| \`fire\` | Looping flame animation |
| \`smoke\` | Puff, dissipate |
| \`magic\` | Sparkles, glow |
| \`electric\` | Lightning, sparks |
| \`water\` | Splash, ripple |
| \`heal\` | Green particles, glow |

## Common Mistakes
- Not setting one_shot for single effects
- Forgetting to queue_free() after animation
- Effect not centered (use centered = true)
- Too many particles impacting performance
`;

export const VFX_KEYWORDS = [
    'effect', 'vfx', 'explosion', 'fire', 'smoke', 'particle',
    'magic', 'spell', 'impact', 'animation', 'spritesheet'
];
