/**
 * UI/HUD Recipe
 * Control nodes, health bars, and labels
 */

export const UI_HUD_RECIPE = `
# UI/HUD Setup

## HUD Scene Structure
\`\`\`
HUD.tscn
├── CanvasLayer (layer: 100)
│   └── Control (Full Rect anchor)
│       ├── MarginContainer (top-left anchor)
│       │   └── HBoxContainer
│       │       ├── TextureRect (heart icon)
│       │       └── Label (health text)
│       └── MarginContainer (top-right anchor)
│           └── Label (score)
\`\`\`

## Anchor Presets
| Preset | Use For |
|--------|---------|
| Top Left | Health, lives |
| Top Right | Score, coins |
| Bottom Left | Item slots |
| Bottom Right | Mini-map |
| Center | Dialog, notifications |
| Full Rect | Backgrounds |

## Health Bar
\`\`\`gdscript
# HUD.gd
extends CanvasLayer

@onready var health_bar: ProgressBar = $Control/HealthBar
@onready var health_label: Label = $Control/HealthLabel

func update_health(current: int, max_health: int) -> void:
    health_bar.max_value = max_health
    health_bar.value = current
    health_label.text = "%d/%d" % [current, max_health]
\`\`\`

## Score Display
\`\`\`gdscript
@onready var score_label: Label = $Control/ScoreLabel

func update_score(score: int) -> void:
    score_label.text = "Score: %d" % score
\`\`\`

## Connecting to Player
\`\`\`gdscript
# In Level script
@onready var hud: CanvasLayer = $HUD
@onready var player: CharacterBody2D = $Player

func _ready():
    player.health_changed.connect(hud.update_health)
    player.score_changed.connect(hud.update_score)
\`\`\`

## Common Control Nodes
| Node | Use For |
|------|---------|
| Label | Text display |
| Button | Clickable buttons |
| TextureRect | Images, icons |
| ProgressBar | Health, loading bars |
| VBoxContainer | Vertical layout |
| HBoxContainer | Horizontal layout |
| MarginContainer | Add padding |
| Panel | Background boxes |

## Dialog Box
\`\`\`gdscript
# DialogBox.gd
extends Control

@onready var label: Label = $Panel/Label

func show_dialog(text: String) -> void:
    label.text = text
    visible = true

func hide_dialog() -> void:
    visible = false
\`\`\`

## Pause Menu
\`\`\`gdscript
# PauseMenu.gd
extends Control

func _ready():
    visible = false
    process_mode = Node.PROCESS_MODE_WHEN_PAUSED

func toggle():
    visible = !visible
    get_tree().paused = visible
\`\`\`
`;

export const UI_HUD_KEYWORDS = [
    'ui', 'hud', 'health', 'score', 'label', 'button',
    'control', 'progressbar', 'menu', 'dialog'
];
