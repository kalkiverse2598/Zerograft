/**
 * Scene Transitions Recipe
 * Autoload fade transitions between scenes
 */

export const SCENE_TRANSITIONS_RECIPE = `
# Scene Transitions

## Transition Scene Structure
\`\`\`
SceneTransitioner.tscn
├── CanvasLayer (layer: 100)    ← Always on top
│   ├── ColorRect (Full Rect)   ← Black overlay
│   └── AnimationPlayer
\`\`\`

## Setup Steps
1. Create scene with CanvasLayer (layer: 100)
2. Add ColorRect child, set to Full Rect, color black
3. Add AnimationPlayer
4. Create "fade_out" animation: ColorRect modulate alpha 0→1 (0.5s)
5. Create "fade_in" animation: ColorRect modulate alpha 1→0 (0.5s)
6. Add as Autoload: Project Settings → Autoload → Add SceneTransitioner.tscn

## Transition Script
\`\`\`gdscript
# SceneTransitioner.gd
extends CanvasLayer

@onready var color_rect: ColorRect = $ColorRect
@onready var anim: AnimationPlayer = $AnimationPlayer

func _ready() -> void:
    # Start transparent
    color_rect.modulate.a = 0

func change_scene(path: String) -> void:
    # Fade out
    anim.play("fade_out")
    await anim.animation_finished
    
    # Change scene
    get_tree().change_scene_to_file(path)
    
    # Fade in
    anim.play("fade_in")
    await anim.animation_finished
\`\`\`

## Using the Transition
\`\`\`gdscript
# From anywhere in your code:
SceneTransitioner.change_scene("res://scenes/levels/level_2.tscn")

# Or for menu:
SceneTransitioner.change_scene("res://scenes/ui/main_menu.tscn")
\`\`\`

## Simple Scene Change (No Transition)
\`\`\`gdscript
# Immediate scene change
get_tree().change_scene_to_file("res://scenes/levels/level_2.tscn")

# Or with packed scene
var scene = preload("res://scenes/levels/level_2.tscn")
get_tree().change_scene_to_packed(scene)
\`\`\`

## Level Transition Door
\`\`\`gdscript
# Door.gd
extends Area2D

@export var next_level: String = "res://scenes/levels/level_2.tscn"

func _ready():
    body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node2D):
    if body.is_in_group("player"):
        SceneTransitioner.change_scene(next_level)
\`\`\`
`;

export const SCENE_TRANSITIONS_KEYWORDS = [
    'transition', 'fade', 'scene', 'change_scene', 'level',
    'autoload', 'load', 'next'
];
