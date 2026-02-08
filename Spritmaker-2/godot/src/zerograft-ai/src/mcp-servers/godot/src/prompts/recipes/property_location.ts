/**
 * Property Location Guide Recipe
 * Where to find and modify common Godot settings
 */

export const PROPERTY_LOCATION_RECIPE = `
# Where to Find Things in Godot

## Project Settings (Project → Project Settings)

### Application
| Setting | Path | Default | Purpose |
|---------|------|---------|---------|
| Window Title | Application/Config/name | "New Godot Project" | Game window title |
| Main Scene | Application/Run/main_scene | "" | First scene to load |
| Window Width | Display/Window/size/viewport_width | 1152 | Base game width |
| Window Height | Display/Window/size/viewport_height | 648 | Base game height |
| Fullscreen | Display/Window/size/mode | 0 (windowed) | 1=fullscreen, 2=maximized |
| VSync | Display/Window/vsync/vsync_mode | 1 | 0=disabled, 1=enabled |
| Stretch Mode | Display/Window/stretch/mode | disabled | canvas_items, viewport |
| Aspect Ratio | Display/Window/stretch/aspect | keep | keep, keep_width, keep_height |

### Physics 2D
| Setting | Path | Default | Purpose |
|---------|------|---------|---------|
| **Gravity** | Physics/2D/default_gravity | 980 | Pixels/second² |
| Gravity Direction | Physics/2D/default_gravity_vector | (0, 1) | Down |
| Linear Damp | Physics/2D/default_linear_damp | 0.1 | Slow moving objects |
| Angular Damp | Physics/2D/default_angular_damp | 1.0 | Slow rotation |

### Rendering
| Setting | Path | Default | Purpose |
|---------|------|---------|---------|
| Background Color | Rendering/Environment/defaults/default_clear_color | Grey | Screen clear color |
| 2D Snap | Rendering/2D/snap/snap_2d_transforms_to_pixel | false | Pixel-perfect rendering |
| Anti-Aliasing | Rendering/Anti_Aliasing/quality/msaa_2d | 0 | 0=disabled, 1=2x, 2=4x |

### Input Map (Project Settings → Input Map tab)
| Common Actions | Keys |
|----------------|------|
| ui_accept | Enter, Space, Gamepad A |
| ui_cancel | Escape, Gamepad B |
| ui_left/right/up/down | Arrow keys, WASD, D-pad |

---

## Node Properties

### CharacterBody2D
| Property | Purpose | Code Access |
|----------|---------|-------------|
| \`velocity\` | Current movement | \`velocity = Vector2(100, 0)\` |
| \`motion_mode\` | Grounded/Floating | Inspector → Motion Mode |
| \`up_direction\` | Which way is "up" | Default: Vector2(0, -1) |
| \`floor_max_angle\` | Max slope walkable | Radians (0.785 = 45°) |

### Camera2D
| Property | Purpose | Code Access |
|----------|---------|-------------|
| \`position_smoothing_enabled\` | Smooth follow | \`camera.position_smoothing_enabled = true\` |
| \`position_smoothing_speed\` | Follow speed | \`camera.position_smoothing_speed = 5.0\` |
| \`limit_left/right/top/bottom\` | Camera bounds | \`camera.limit_left = 0\` |
| \`zoom\` | Zoom level | \`camera.zoom = Vector2(2, 2)\` |

### AudioStreamPlayer
| Property | Purpose | Code Access |
|----------|---------|-------------|
| \`stream\` | Audio file | Drag .wav/.ogg to Inspector |
| \`volume_db\` | Volume | 0 = full, -80 = silent |
| \`bus\` | Audio bus | "Master", "Music", "SFX" |
| \`autoplay\` | Play on start | Check in Inspector |

### AnimatedSprite2D
| Property | Purpose | Code Access |
|----------|---------|-------------|
| \`sprite_frames\` | Animation resource | \`sprite.sprite_frames = frames\` |
| \`animation\` | Current animation | \`sprite.play("run")\` |
| \`speed_scale\` | Playback speed | \`sprite.speed_scale = 1.5\` |
| \`flip_h/flip_v\` | Mirror sprite | \`sprite.flip_h = true\` |

---

## GDScript Access to Settings

### Project Settings in Code
\`\`\`gdscript
# Read setting
var gravity = ProjectSettings.get_setting("physics/2d/default_gravity")

# Modify at runtime (temporary, not saved)
ProjectSettings.set_setting("physics/2d/default_gravity", 500)
\`\`\`

### Input Actions in Code
\`\`\`gdscript
# Check if action exists
if InputMap.has_action("jump"):
    pass

# Add action programmatically
InputMap.add_action("attack")
var event = InputEventKey.new()
event.physical_keycode = KEY_X
InputMap.action_add_event("attack", event)
\`\`\`

---

## Editor Menu Locations

| Task | Menu Path |
|------|-----------|
| Create new scene | Scene → New Scene |
| Save scene | Scene → Save Scene (Ctrl+S) |
| Run project | Project → Run (F5) |
| Run current scene | Scene → Run Current Scene (F6) |
| Export project | Project → Export |
| Project settings | Project → Project Settings |
| Editor settings | Editor → Editor Settings |
| Manage plugins | Project → Project Settings → Plugins tab |
| Add autoload | Project → Project Settings → Autoload tab |
| Input map | Project → Project Settings → Input Map tab |

---

## File Locations

| Resource | Default Path |
|----------|--------------|
| Main scene | res://scenes/main.tscn |
| Player scene | res://scenes/characters/player.tscn |
| Project config | res://project.godot |
| Override config | res://override.cfg |
| Export presets | res://export_presets.cfg |
| Editor settings | ~/.config/godot/editor_settings-*.tres |
`;

export const PROPERTY_LOCATION_KEYWORDS = [
    'where', 'find', 'locate', 'setting', 'property', 'modify',
    'change', 'project settings', 'gravity', 'window', 'title',
    'menu', 'path', 'location', 'config'
];
