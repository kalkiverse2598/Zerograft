/**
 * Tilemap Placement Recipe
 * Comprehensive guide for placing tiles in Godot 4.3+
 * Includes static tiles, movable objects, and layer organization
 */

export const TILEMAP_PLACEMENT_RECIPE = `
# Tilemap Placement Guide

## Scene Hierarchy (Layer Order)
\`\`\`
World (Node2D)
├── Background (TileMapLayer)       ← Layer 0: Sky, distant objects
├── BackgroundDecor (TileMapLayer)  ← Layer 1: Trees, clouds
├── Ground (TileMapLayer)           ← Layer 2: Main walkable terrain
├── Platforms (TileMapLayer)        ← Layer 3: Jump-through platforms
├── Foreground (TileMapLayer)       ← Layer 4: Decorations in front
├── Objects (Node2D)                ← Dynamic objects (not tiles)
│   ├── PushableBlock
│   ├── BreakableCrate
│   └── MovingPlatform
├── Player
└── Camera2D
\`\`\`

## CRITICAL: Static vs Dynamic Objects

### Static Tiles (Use TileMapLayer)
- Ground tiles ✅
- Walls ✅
- Background decorations ✅
- Static platforms ✅

### Dynamic Objects (Use Separate Nodes - NOT Tiles)
- Pushable blocks → RigidBody2D + Sprite2D
- Breakable crates → Area2D or CharacterBody2D + Sprite2D
- Moving platforms → AnimatableBody2D
- Collectibles → Area2D + Sprite2D

## Placing Tiles with Agent Commands

### 1. Generate Tileset First
\`\`\`
spritemancer_generate_and_export_terrain(
  preset: "grass_meadow",
  tile_size: 32
)
→ Creates: res://sprites/tilesets/terrain/grass_meadow_tileset.tres
\`\`\`

### 2. Add TileMapLayer to Scene
\`\`\`
add_node(
  parent: "/root/World",
  type: "TileMapLayer",
  name: "Ground"
)
\`\`\`

### 3. Assign TileSet to TileMapLayer
\`\`\`
set_property(
  node_path: "/root/World/Ground",
  property: "tile_set",
  value: "res://sprites/tilesets/terrain/grass_meadow_tileset.tres"
)
\`\`\`

### 4. Place Tiles in Batch
\`\`\`
map_set_cells_batch(
  tilemap_path: "/root/World/Ground",
  cells: [
    { x: 0, y: 5, source: 0, atlas: [1, 1] },
    { x: 1, y: 5, source: 0, atlas: [1, 1] },
    { x: 2, y: 5, source: 0, atlas: [1, 1] },
    { x: 3, y: 5, source: 0, atlas: [2, 1] }
  ]
)
\`\`\`

## TileMapLayer Properties

| Property | Value | Purpose |
|----------|-------|---------|
| \`tile_set\` | Resource path (.tres) | The tileset to use |
| \`z_index\` | Layer number | Render order |
| \`collision_enabled\` | true/false | Physics collision |
| \`collision_visibility_mode\` | 0-2 | Show collisions in editor |
| \`y_sort_enabled\` | true/false | Sort by Y position |

## Layer Z-Index Convention
| Layer | z_index | Contents |
|-------|---------|----------|
| Background | -10 | Sky, parallax |
| BackDecor | -5 | Trees behind player |
| Ground | 0 | Main terrain |
| Platforms | 1 | Jumpable platforms |
| Player | 5 | Player character |
| Foreground | 10 | Decorations in front |

## Creating Pushable/Movable Objects

For objects the player can push, DON'T use tiles - create separate nodes:

### Pushable Crate
\`\`\`gdscript
# pushable_crate.gd
extends RigidBody2D

@export var push_force: float = 50.0

func _ready():
    mass = 1.0
    linear_damp = 5.0  # Friction
\`\`\`

### Breakable Block
\`\`\`gdscript
# breakable_block.gd
extends StaticBody2D

@export var health: int = 3
@onready var sprite = $Sprite2D

func take_damage(damage: int = 1):
    health -= damage
    if health <= 0:
        # Spawn particles, drop items
        queue_free()
\`\`\`

### Moving Platform
\`\`\`gdscript
# moving_platform.gd
extends AnimatableBody2D

@export var move_distance: Vector2 = Vector2(0, 64)
@export var speed: float = 50.0

var start_pos: Vector2
var direction: int = 1

func _ready():
    start_pos = global_position

func _physics_process(delta):
    var target = start_pos + (move_distance * direction)
    var velocity = global_position.direction_to(target) * speed
    
    if global_position.distance_to(target) < 5:
        direction *= -1
    
    sync_to_physics = false
    global_position += velocity * delta
\`\`\`

## Tile Placement Patterns

### Ground Line
\`\`\`
Atlas coords for 3x3 terrain:
[0,0] [1,0] [2,0]  ← Top edge
[0,1] [1,1] [2,1]  ← Middle (center = [1,1])
[0,2] [1,2] [2,2]  ← Bottom edge

Ground line: [0,0], [1,0], [1,0], [1,0], [2,0]
            ↑left   ↑center  ↑center  ↑center ↑right
\`\`\`

### Platform (6-tile strip)
\`\`\`
[0],[1],[1],[1],[2],[3]
 ↑    ↑  center   ↑   ↑
left              right single
\`\`\`

## Common Agent Patterns

### Create a simple level floor
\`\`\`
1. add_node(parent="/root/World", type="TileMapLayer", name="Ground")
2. set_property(node="/root/World/Ground", property="tile_set", value="res://tileset.tres")
3. set_property(node="/root/World/Ground", property="z_index", value=0)
4. map_set_cells_batch(tilemap="/root/World/Ground", cells=[
     {x:0, y:10, source:0, atlas:[0,0]},   // left edge
     {x:1, y:10, source:0, atlas:[1,0]},   // center
     {x:2, y:10, source:0, atlas:[1,0]},   // center
     {x:3, y:10, source:0, atlas:[2,0]}    // right edge
   ])
\`\`\`

### Add collision to tiles
- Collision is configured IN the TileSet resource, not on TileMapLayer
- When generating with spritemancer_generate_and_export_terrain, collision shapes are auto-configured
- Verify by setting collision_visibility_mode = 2 in editor

## Mistakes to Avoid
1. ❌ Using tiles for movable objects → Use RigidBody2D/CharacterBody2D instead
2. ❌ One TileMapLayer for everything → Separate layers by purpose
3. ❌ Wrong z_index → Player walks behind/in front of wrong tiles
4. ❌ Forgetting physics layer in TileSet → No collision
5. ❌ Placing tiles at wrong atlas coordinates → Know your tileset layout
`;

export const TILEMAP_PLACEMENT_KEYWORDS = [
    'tilemap', 'place tile', 'tile placement', 'tilemaplayer', 'ground',
    'platform', 'floor', 'wall', 'movable', 'pushable', 'breakable',
    'moving platform', 'layer', 'z-index', 'z index', 'collision',
    'static tile', 'dynamic tile', 'object placement', 'level design'
];
