/**
 * Platformer Level Recipe
 * Level scene structure and TileMap setup
 */

export const PLATFORMER_LEVEL_RECIPE = `
# Platformer Level Setup (Godot 4.3+)

## Level Scene Structure (TileMapLayer - Modern Approach)
\`\`\`
Level.tscn
├── Node2D (root)
│   ├── Parallax2D (sky)         ← scroll_scale: (0.1, 1)
│   │   └── Sprite2D
│   ├── Parallax2D (mountains)   ← scroll_scale: (0.5, 1)
│   │   └── Sprite2D
│   ├── GroundLayer (TileMapLayer) ← Physics enabled, z_index: -10
│   ├── WallLayer (TileMapLayer)   ← Physics enabled
│   ├── DecorationLayer (TileMapLayer) ← No physics, Y-Sort
│   ├── Player (instanced)
│   ├── Enemies (Node2D)
│   ├── Collectibles (Node2D)
│   └── CanvasLayer (layer: 100) ← UI overlay
│       └── HUD
\`\`\`

## TileMapLayer vs TileMap (Godot 4.3 Refactor)
| Old (Deprecated) | New (Recommended) |
|-----------------|-------------------|
| Single \`TileMap\` with internal layers | Multiple \`TileMapLayer\` nodes |
| Layer index system | Direct node references |
| Hard to Y-sort specific layers | Each layer can have own Y-Sort |

## TileMapLayer Benefits
- Toggle visibility per layer (hide roof when entering building)
- Optimize physics (only enable on layers that need it)
- Y-Sort decorations while keeping ground flat

## TileMapLayer Collision Setup
1. Create TileSet resource (shared across layers)
2. TileSet → Physics Layers → Add Element
3. Select tile → Add collision polygon (press 'F' for full rect)
4. Assign TileSet to each TileMapLayer

## One-Way Platforms (Jump-Through)
1. Select tile in TileSet editor
2. Physics → Polygon → One Way Collision: enabled
3. Set direction (usually down)

## TileMapLayer Scripting
\`\`\`gdscript
# Reference by node name
@onready var ground: TileMapLayer = $GroundLayer

# Set a tile
ground.set_cell(Vector2i(5, 10), 0, Vector2i(0, 0))

# Get all used cells
var cells = ground.get_used_cells()

# Get custom tile data
var tile_data = ground.get_cell_tile_data(Vector2i(5, 10))
var terrain_type = tile_data.get_custom_data("terrain_type")
\`\`\`

## Camera Limits from TileMapLayer
\`\`\`gdscript
func set_camera_limits(ground_layer: TileMapLayer, camera: Camera2D) -> void:
    var used_rect = ground_layer.get_used_rect()
    var tile_size = ground_layer.tile_set.tile_size
    camera.limit_left = used_rect.position.x * tile_size.x
    camera.limit_right = used_rect.end.x * tile_size.x
    camera.limit_top = used_rect.position.y * tile_size.y
    camera.limit_bottom = used_rect.end.y * tile_size.y
\`\`\`

## Spawn Points
\`\`\`
Level.tscn
├── ...
├── Marker2D (name: SpawnPoint)
├── Marker2D (name: Checkpoint1)
\`\`\`
`;

export const PLATFORMER_LEVEL_KEYWORDS = [
    'level', 'tilemap', 'tiles', 'ground', 'platform', 'scene',
    'spawn', 'checkpoint', 'instance', 'collision'
];
