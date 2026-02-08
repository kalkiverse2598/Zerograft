/**
 * Input Mapping Recipe
 * Setting up input actions in Godot 4
 */

export const INPUT_MAPPING_RECIPE = `
# Input Mapping

## Project Settings → Input Map
| Action | Keys | Purpose |
|--------|------|---------|
| move_left | A, Left Arrow | Move left |
| move_right | D, Right Arrow | Move right |
| move_up | W, Up Arrow | Move up (top-down) |
| move_down | S, Down Arrow | Move down (top-down) |
| jump | Space, W | Jump (platformer) |
| attack | Mouse Left, X | Attack |
| interact | E, Enter | Interact with objects |
| pause | Escape, P | Pause game |

## Adding Input Actions via Code
\`\`\`gdscript
# In an autoload _ready() or main scene
func setup_inputs():
    # Create action if doesn't exist
    if not InputMap.has_action("jump"):
        InputMap.add_action("jump")
        
        var event = InputEventKey.new()
        event.physical_keycode = KEY_SPACE
        InputMap.action_add_event("jump", event)
\`\`\`

## Reading Input

### Single Key Check
\`\`\`gdscript
# Just pressed (one frame)
if Input.is_action_just_pressed("jump"):
    jump()

# Being held
if Input.is_action_pressed("attack"):
    charge_attack()

# Just released
if Input.is_action_just_released("jump"):
    cancel_jump()
\`\`\`

### Direction Input (Recommended)
\`\`\`gdscript
# 8-way movement (returns Vector2 from -1 to 1)
var direction = Input.get_vector("move_left", "move_right", "move_up", "move_down")
velocity = direction * speed

# Single axis (returns float from -1 to 1)
var horizontal = Input.get_axis("move_left", "move_right")
velocity.x = horizontal * speed
\`\`\`

### Mouse Input
\`\`\`gdscript
# Mouse position
var mouse_pos = get_global_mouse_position()

# Look at mouse
look_at(mouse_pos)

# Get aim direction
var aim_direction = (mouse_pos - global_position).normalized()
\`\`\`

## Pause Handling
\`\`\`gdscript
func _input(event: InputEvent) -> void:
    if event.is_action_pressed("pause"):
        get_tree().paused = !get_tree().paused
\`\`\`

## Process Mode for Pause
In Inspector → Process → Mode:
- Inherit: Follows parent
- Pausable: Stops when paused (default)
- When Paused: Only runs when paused (for pause menu)
- Always: Never pauses

\`\`\`gdscript
# In code
node.process_mode = Node.PROCESS_MODE_WHEN_PAUSED
\`\`\`
`;

export const INPUT_KEYWORDS = [
    'input', 'key', 'action', 'control', 'keyboard', 'mouse',
    'get_axis', 'get_vector', 'pressed', 'pause'
];
