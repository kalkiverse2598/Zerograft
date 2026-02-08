/**
 * Common Scripts Recipe
 * State machines, signals, preload patterns
 */

export const COMMON_SCRIPTS_RECIPE = `
# Common Script Patterns

## State Machine
\`\`\`gdscript
extends CharacterBody2D

enum State { IDLE, RUN, JUMP, FALL, ATTACK }
var current_state: State = State.IDLE

func _physics_process(delta: float) -> void:
    match current_state:
        State.IDLE:
            if velocity.x != 0:
                change_state(State.RUN)
            if not is_on_floor():
                change_state(State.FALL)
        State.RUN:
            if velocity.x == 0:
                change_state(State.IDLE)
            if not is_on_floor():
                change_state(State.FALL)
        State.JUMP:
            if velocity.y > 0:
                change_state(State.FALL)
        State.FALL:
            if is_on_floor():
                change_state(State.IDLE)
    
    move_and_slide()

func change_state(new_state: State) -> void:
    current_state = new_state
    match new_state:
        State.IDLE: sprite.play("idle")
        State.RUN: sprite.play("run")
        State.JUMP: sprite.play("jump")
        State.FALL: sprite.play("fall")
\`\`\`

## Signals (Custom)
\`\`\`gdscript
# Defining signals
signal died
signal health_changed(new_health: int)
signal coin_collected(value: int)

# Emitting signals
func take_damage(amount: int) -> void:
    health -= amount
    health_changed.emit(health)
    if health <= 0:
        died.emit()

# Connecting signals
func _ready() -> void:
    player.died.connect(_on_player_died)
    player.health_changed.connect(hud.update_health)

func _on_player_died() -> void:
    get_tree().reload_current_scene()
\`\`\`

## Preload vs Load
\`\`\`gdscript
# Preload - compile time, instant access (use for common resources)
const BULLET_SCENE = preload("res://scenes/bullet.tscn")
const COIN_TEXTURE = preload("res://sprites/coin.png")

# Load - runtime, use for large/optional resources
func load_level(level_num: int) -> void:
    var path = "res://scenes/levels/level_%d.tscn" % level_num
    var scene = load(path)
    get_tree().change_scene_to_packed(scene)
\`\`\`

## Autoload Singleton (Global Game State)
\`\`\`gdscript
# autoloads/game_manager.gd
extends Node

var score: int = 0
var current_level: int = 1
var player_health: int = 100

signal score_updated(new_score: int)

func add_score(value: int) -> void:
    score += value
    score_updated.emit(score)

func reset_game() -> void:
    score = 0
    current_level = 1
    player_health = 100
\`\`\`

## Object Pooling
\`\`\`gdscript
# BulletPool.gd
extends Node

const BULLET_SCENE = preload("res://scenes/bullet.tscn")
var pool: Array[Node] = []

func get_bullet() -> Node:
    for bullet in pool:
        if not bullet.visible:
            return bullet
    
    # Create new if none available
    var bullet = BULLET_SCENE.instantiate()
    add_child(bullet)
    pool.append(bullet)
    return bullet

func return_bullet(bullet: Node) -> void:
    bullet.visible = false
    bullet.set_physics_process(false)
\`\`\`

## Timer Pattern
\`\`\`gdscript
# One-shot timer
func start_cooldown(duration: float) -> void:
    var timer = get_tree().create_timer(duration)
    await timer.timeout
    can_attack = true

# Repeating timer
var attack_timer: Timer

func _ready():
    attack_timer = Timer.new()
    attack_timer.wait_time = 0.5
    attack_timer.timeout.connect(_on_attack_timer)
    add_child(attack_timer)
    attack_timer.start()
\`\`\`
`;

export const COMMON_SCRIPTS_KEYWORDS = [
    'signal', 'state', 'preload', 'load', 'pattern', 'autoload',
    'singleton', 'pool', 'timer', 'global'
];
