/**
 * Animations Recipe
 * AnimatedSprite2D and SpriteFrames setup
 */

export const ANIMATIONS_RECIPE = `
# AnimatedSprite2D Setup

## Scene Structure
\`\`\`
Player.tscn
├── CharacterBody2D
│   ├── AnimatedSprite2D  ← Holds all animations
│   └── CollisionShape2D
\`\`\`

## Creating Animations
1. Add AnimatedSprite2D node
2. In Inspector: Sprite Frames → New SpriteFrames
3. Click SpriteFrames to open animation panel (bottom)
4. Add animations: "idle", "run", "jump", "fall"

## From Sprite Sheet
1. In SpriteFrames panel: Click grid icon (Add frames from sprite sheet)
2. Select your sprite sheet
3. Set horizontal/vertical divisions
4. Select frames → Add

## Animation Properties
| Property | Purpose |
|----------|---------|
| Animation | Current animation name |
| FPS | Frames per second |
| Loop | Whether to repeat |
| Autoplay | Play on scene start |

## Playing Animations in Code
\`\`\`gdscript
@onready var sprite: AnimatedSprite2D = $AnimatedSprite2D

func _physics_process(delta: float) -> void:
    # State-based animation
    if not is_on_floor():
        if velocity.y < 0:
            sprite.play("jump")
        else:
            sprite.play("fall")
    elif velocity.x != 0:
        sprite.play("run")
    else:
        sprite.play("idle")
    
    # Flip sprite based on direction
    if velocity.x < 0:
        sprite.flip_h = true
    elif velocity.x > 0:
        sprite.flip_h = false
\`\`\`

## Animation Signals
\`\`\`gdscript
func _ready():
    sprite.animation_finished.connect(_on_animation_finished)

func _on_animation_finished():
    if sprite.animation == "attack":
        sprite.play("idle")
\`\`\`

## SpriteMancer Integration
\`\`\`gdscript
# After spritemancer_generate_animations returns sprite_frames_path:
var sprite_frames = load(sprite_frames_path)
$AnimatedSprite2D.sprite_frames = sprite_frames
$AnimatedSprite2D.play("idle")
\`\`\`
`;

export const ANIMATIONS_KEYWORDS = [
    'animation', 'sprite', 'frames', 'spriteframes', 'animatedsprite2d',
    'play', 'loop', 'fps', 'flip'
];
