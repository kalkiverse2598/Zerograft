/**
 * Camera Setup Recipe
 * Camera2D follow, smoothing, and limits
 */

export const CAMERA_SETUP_RECIPE = `
# Camera2D Setup

## ⚠️ Godot Coordinate System Reminder
- Origin (0, 0) is TOP-LEFT of viewport
- Y increases DOWNWARD
- Camera position = what appears at viewport CENTER

---

## Static Scene Camera (Camera at Level Root)

For simple games where camera doesn't follow player:

\`\`\`
First get viewport size:
Tool: get_project_setting
  setting: "display/window/size/viewport_width"  → VIEWPORT_WIDTH
  setting: "display/window/size/viewport_height" → VIEWPORT_HEIGHT

Camera position:
CAMERA_X = VIEWPORT_WIDTH / 2
CAMERA_Y = VIEWPORT_HEIGHT / 2

Example (1152 x 648 viewport):
- Camera position = Vector2(576, 324)
\`\`\`

Level Structure:
\`\`\`
Level.tscn
├── Node2D (root)
│   ├── Camera2D        ← Position at (viewport/2, viewport/2)
│   ├── Ground
│   └── Player (instance)
\`\`\`

---

## Player-Follow Camera
\`\`\`
Player.tscn
├── CharacterBody2D
│   ├── AnimatedSprite2D
│   ├── CollisionShape2D
│   └── Camera2D        ← Child of player for auto-follow
\`\`\`

## Key Camera Properties (Brackeys Pixel Art Settings)
| Property | Value | Purpose |
|----------|-------|---------|
| Zoom | Vector2(4, 4) | **Pixel art visibility** (see sprites clearly) |
| Position Smoothing → Enabled | true | Smooth follow |
| Position Smoothing → Speed | 5.0 | Higher = faster catch-up |
| Limit → Left/Right/Top/Bottom | Level bounds | Prevent showing outside |
| Limit Smoothed | true | Smooth limit transitions |

## Setting Limits from TileMap
\`\`\`gdscript
func set_camera_limits(tilemap: TileMap) -> void:
    var camera = $Camera2D
    var used_rect = tilemap.get_used_rect()
    var tile_size = tilemap.tile_set.tile_size
    
    camera.limit_left = used_rect.position.x * tile_size.x
    camera.limit_right = used_rect.end.x * tile_size.x
    camera.limit_top = used_rect.position.y * tile_size.y
    camera.limit_bottom = used_rect.end.y * tile_size.y
\`\`\`

## Camera Shake Effect
\`\`\`gdscript
extends Camera2D

var shake_strength: float = 0.0
var shake_decay: float = 5.0

func _process(delta: float) -> void:
    if shake_strength > 0:
        offset = Vector2(
            randf_range(-shake_strength, shake_strength),
            randf_range(-shake_strength, shake_strength)
        )
        shake_strength = lerp(shake_strength, 0.0, shake_decay * delta)

func shake(strength: float = 10.0) -> void:
    shake_strength = strength
\`\`\`

## Zoom Control
\`\`\`gdscript
# Zoom in
camera.zoom = Vector2(2, 2)

# Smooth zoom
var target_zoom = Vector2(1.5, 1.5)
camera.zoom = camera.zoom.lerp(target_zoom, delta * 2.0)
\`\`\`

## Multiple Cameras
\`\`\`gdscript
# Make this camera active
camera.make_current()

# Check if current
if camera.is_current():
    pass
\`\`\`

## Camera in Code (not child of player)
\`\`\`gdscript
extends Camera2D

@export var target: Node2D

func _process(delta: float) -> void:
    if target:
        global_position = target.global_position
\`\`\`
`;

export const CAMERA_KEYWORDS = [
    'camera', 'camera2d', 'follow', 'smooth', 'limit',
    'zoom', 'shake', 'position_smoothing'
];
