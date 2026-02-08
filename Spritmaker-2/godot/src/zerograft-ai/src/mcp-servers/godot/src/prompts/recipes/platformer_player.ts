/**
 * Platformer Player Recipe
 * CharacterBody2D movement script and scene structure
 */

export const PLATFORMER_PLAYER_RECIPE = `
# Platformer Player Reference

This is a REFERENCE with examples. Adapt based on game requirements.

---

## Core Principles

1. **CharacterBody2D** - Use for physics-based player movement
2. **Gravity from ProjectSettings** - Keeps consistency with RigidBodies
3. **Input.get_axis()** - Cleaner than checking both directions separately
4. **Animation states** - Tie to physics state (is_on_floor, velocity)

---

## Example Scene Structure

\`\`\`
Player.tscn
├── CharacterBody2D (root)
│   ├── AnimatedSprite2D  ← holds sprite animations
│   ├── CollisionShape2D  ← physics collision
│   └── Camera2D          ← optional, for follow camera
\`\`\`

**Tips:**
- Z-Index ~5 helps player render above tiles
- Camera zoom ~4x for pixel art visibility
- CircleShape2D slides off edges smoothly

---

## Example Movement Script

A simple, reliable pattern:

\`\`\`gdscript
extends CharacterBody2D

const SPEED = 130.0
const JUMP_VELOCITY = -300.0

var gravity = ProjectSettings.get_setting("physics/2d/default_gravity")
@onready var animated_sprite = $AnimatedSprite2D

func _physics_process(delta):
    # Gravity
    if not is_on_floor():
        velocity.y += gravity * delta

    # Jump
    if Input.is_action_just_pressed("jump") and is_on_floor():
        velocity.y = JUMP_VELOCITY

    # Horizontal input
    var direction = Input.get_axis("move_left", "move_right")
    
    # Sprite flip
    if direction > 0:
        animated_sprite.flip_h = false
    elif direction < 0:
        animated_sprite.flip_h = true
    
    # Animations (adapt based on available animations)
    if is_on_floor():
        animated_sprite.play("run" if direction else "idle")
    else:
        animated_sprite.play("jump")
    
    # Movement
    if direction:
        velocity.x = direction * SPEED
    else:
        velocity.x = move_toward(velocity.x, 0, SPEED)

    move_and_slide()
\`\`\`

---

## Optional Enhancements

**Coyote Time** - Allow jump briefly after leaving edge:
\`\`\`gdscript
var coyote_time = 0.15
var coyote_timer = 0.0

if was_on_floor and not is_on_floor():
    coyote_timer = coyote_time
coyote_timer -= delta
can_jump = is_on_floor() or coyote_timer > 0
\`\`\`

**Jump Buffering** - Remember jump input before landing.

**Acceleration/Friction** - Use move_toward() for smoother feel.

---

## Common Input Actions

| Action | Typical Keys |
|--------|-------------|
| move_left | A, Left Arrow |
| move_right | D, Right Arrow |
| jump | Space, W |

Adapt to game needs.
`;

export const PLATFORMER_PLAYER_KEYWORDS = [
    'player', 'movement', 'walk', 'run', 'jump', 'platformer',
    'characterbody2d', 'velocity', 'gravity', 'move_and_slide'
];
