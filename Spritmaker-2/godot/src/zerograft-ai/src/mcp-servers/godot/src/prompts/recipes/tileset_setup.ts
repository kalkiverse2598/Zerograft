/**
 * Tileset Setup Recipe
 * Godot 4 TileMap/TileSet workflow with AI generation
 */

export const TILESET_SETUP_RECIPE = `
# Tileset Setup for TileMap

## Scene Structure
\`\`\`
World (Node2D)
├── TileMapLayer (ground)      ← Godot 4.3+ modular layers
├── TileMapLayer (platforms)
├── TileMapLayer (decorations)
├── Player
└── Camera2D
\`\`\`

## Creating a TileSet Resource
1. Use spritemancer_generate_and_export_terrain for one-shot generation + .tres export
2. Or use spritemancer_generate_terrain_tileset + spritemancer_export_tileset_resource separately

## Key Properties
| Property | Purpose |
|----------|---------|
| \`tile_size\` | Size of each tile (16x16, 32x32) |
| \`TileSetAtlasSource\` | Source texture with grid layout |
| \`physics_layer\` | Collision shapes for tiles |
| \`custom_data_layer\` | Tile metadata (damage, type) |

## Code Example
\`\`\`gdscript
# Access TileMapLayer
var tilemap: TileMapLayer = $TileMapLayer

# Place tile programmatically
tilemap.set_cell(Vector2i(5, 3), 0, Vector2i(1, 0))  # source_id, atlas_coords

# Get tile at position
var world_pos = get_global_mouse_position()
var tile_pos = tilemap.local_to_map(world_pos)
var tile_data = tilemap.get_cell_tile_data(tile_pos)

# Check if position has tile
if tilemap.get_cell_source_id(tile_pos) != -1:
    print("Has tile!")
\`\`\`

## AI Generation + Export (One-Shot)
Best approach - generate AND export in one call:
\`\`\`
spritemancer_generate_and_export_terrain(
  preset: "grass_meadow",  # or terrain_type for custom
  tile_size: 32,
  use_difference_matte: false
)
→ Creates: res://sprites/tilesets/terrain/grass_meadow_tileset.tres
\`\`\`

## AI Generation (Step-by-Step)
For more control, use separate generation and export:
\`\`\`
# Step 1: Generate terrain tileset image
spritemancer_generate_terrain_tileset(
  prompt: "grass and dirt terrain tiles",
  tile_size: 32,
  grid_size: "3x3"
)
→ Returns: image_base64

# Step 2: Export as Godot .tres resource
spritemancer_export_tileset_resource(
  tileset_image_base64: <from step 1>,
  tile_size: 32,
  tileset_type: "terrain",
  texture_path: "res://sprites/tilesets/my_tileset.png",
  include_terrain: true
)
→ Creates TileSet .tres with terrain autotiling
\`\`\`

## Available Tileset Tools
| Tool | Purpose |
|------|---------|
| \`spritemancer_generate_terrain_tileset\` | 3x3 terrain with autotile |
| \`spritemancer_generate_platform_tiles\` | 6-tile platform strip |
| \`spritemancer_generate_wall_tileset\` | 3x3 wall tiles |
| \`spritemancer_generate_decoration\` | Single decorative tiles |
| \`spritemancer_generate_transition_tiles\` | Biome transitions |
| \`spritemancer_generate_animated_tile\` | Animated tiles |
| \`spritemancer_export_tileset_resource\` | Export to .tres |
| \`spritemancer_generate_and_export_terrain\` | Generate + export |

## Tileset Presets (for terrain)
| Preset | Contains |
|--------|----------|
| \`grass_meadow\` | Lush grass terrain |
| \`forest_floor\` | Forest ground tiles |
| \`dirt_path\` | Dirt/earth terrain |
| \`stone_cobble\` | Stone/cobblestone |
| \`water_shore\` | Water transitions |

## Tile Placement Tools
| Tool | Purpose |
|------|---------|
| \`map_set_cells_batch\` | Place multiple tiles |
| \`map_fill_rect\` | Fill rectangle with tile |
| \`map_clear_layer\` | Clear all tiles |

## Common Mistakes
- Using deprecated TileMap (use TileMapLayer in 4.3+)
- Forgetting physics layer for collision
- Tile size mismatch between source and atlas
- Not using terrain autotiling for natural-looking edges
- **Using Godot 3.x API** (see API Reference below)

## ⚠️ Godot 4 TileSet API Reference
CRITICAL: These are the ONLY valid methods. Do NOT use deprecated methods!

### TileSet Physics Layer (Godot 4.x)
\`\`\`gdscript
# Get physics layers count (Godot 4.x)
var layer_count: int = tileset.get_physics_layers_count()  # NOTE: "layers" plural!

# Add physics layer
tileset.add_physics_layer()

# Set collision layer/mask
tileset.set_physics_layer_collision_layer(layer_idx, layer_value)
tileset.set_physics_layer_collision_mask(layer_idx, mask_value)

# Get TileData for specific tile
var tile_data: TileData = tileset.get_tile_data(source_id, atlas_coords, alt_id)

# Set collision polygon on TileData
tile_data.set_collision_polygons_count(layer_idx, polygon_count)
tile_data.set_collision_polygon_points(layer_idx, polygon_idx, PackedVector2Array)
\`\`\`

### INVALID/REMOVED Methods (DO NOT USE!)
- ~~get_physics_layer_count()~~ → Use \`get_physics_layers_count()\` (plural!)
- ~~tile_set_texture()~~ → Use TileSetAtlasSource
- ~~tile_set_region()~~ → Use TileSetAtlasSource.set_texture_region_size()
- ~~autotile_set_bitmask()~~ → Use terrain system

### TileMapLayer API (Godot 4.3+)
\`\`\`gdscript
# Set tile at position
tilemap.set_cell(coords: Vector2i, source_id: int, atlas_coords: Vector2i)

# Get tile at position
var source_id = tilemap.get_cell_source_id(coords)
var atlas_coords = tilemap.get_cell_atlas_coords(coords)
var tile_data = tilemap.get_cell_tile_data(coords)

# Clear tile
tilemap.erase_cell(coords)

# Clear entire layer
tilemap.clear()
\`\`\`
`;

export const TILESET_KEYWORDS = [
  'tileset', 'tilemap', 'tile', 'terrain', 'autotile',
  'atlas', 'grid', 'platformer', 'level', 'floor', 'wall',
  'generate tileset', 'create tileset', 'tile generation'
];

