/**
 * Collision Detection Recipe
 * Area2D signals and collision layers/masks
 */

export const COLLISION_DETECTION_RECIPE = `
# Collision Detection

## Area2D for Detection (Coins, Damage Zones)
\`\`\`
Coin.tscn
├── Area2D (root)
│   ├── CollisionShape2D
│   └── Sprite2D (or AnimatedSprite2D)
\`\`\`

## Collision Layers Convention
| Layer | Name | Used For |
|-------|------|----------|
| 1 | World | Ground, walls, TileMap |
| 2 | Player | Player character |
| 3 | Enemies | Enemy characters |
| 4 | Collectibles | Coins, items |
| 5 | Hazards | Damage zones |

## Setting Up Area2D Detection
\`\`\`gdscript
extends Area2D

signal collected

func _ready() -> void:
    body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node2D) -> void:
    if body.is_in_group("player"):
        collected.emit()
        queue_free()
\`\`\`

## Collision Layer/Mask Setup
- **Collision Layer**: What layer this body IS ON
- **Collision Mask**: What layers this body DETECTS

Example for collectible:
- Collision Layer: 4 (Collectibles)
- Collision Mask: 2 (Player) — only detect player

## CharacterBody2D Collision
\`\`\`gdscript
func _physics_process(delta: float) -> void:
    move_and_slide()
    
    # Check for collisions after move
    for i in get_slide_collision_count():
        var collision = get_slide_collision(i)
        var collider = collision.get_collider()
        
        if collider.is_in_group("enemies"):
            take_damage()
\`\`\`

## Area2D Signals
| Signal | Triggers When |
|--------|---------------|
| body_entered | PhysicsBody2D enters |
| body_exited | PhysicsBody2D exits |
| area_entered | Another Area2D enters |
| area_exited | Another Area2D exits |

## Damage Zone Example
\`\`\`gdscript
# DamageZone.gd
extends Area2D

@export var damage: int = 10

func _ready():
    body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node2D):
    if body.has_method("take_damage"):
        body.take_damage(damage)
\`\`\`

## Using Groups
\`\`\`gdscript
# Add node to group
add_to_group("player")
add_to_group("enemies")

# Check group membership
if body.is_in_group("player"):
    # Handle player collision
\`\`\`
`;

export const COLLISION_KEYWORDS = [
    'area2d', 'detect', 'overlap', 'trigger', 'collision',
    'body_entered', 'layer', 'mask', 'group', 'signal'
];
