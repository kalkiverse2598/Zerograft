/**
 * Custom Resources Recipe
 * Data-driven design with Godot's Resource system
 */

export const CUSTOM_RESOURCES_RECIPE = `
# Custom Resources (Data-Driven Design)

## Why Custom Resources?
Instead of JSON/dictionaries, Godot encourages type-safe Resource classes:
- **Type Safety**: Engine knows exactly what data is available
- **Editor Integration**: Designers edit data in Inspector (no JSON parsing)
- **Performance**: Binary-serialized, native engine loading

## Creating a Custom Resource

### 1. Define the Resource Class
\`\`\`gdscript
# res://resources/item_data.gd
class_name ItemData
extends Resource

@export var name: String
@export var icon: Texture2D
@export var value: int = 10
@export var stackable: bool = true
@export_multiline var description: String
\`\`\`

### 2. Create Resource Instances
1. In FileSystem, right-click → New Resource
2. Search for "ItemData"
3. Creates a \`.tres\` file
4. Fill in data via Inspector

### 3. Use in Scripts
\`\`\`gdscript
# In an item pickup script
extends Area2D

@export var item: ItemData  # Drag & drop .tres file here!

func _on_body_entered(body):
    if body.has_method("add_to_inventory"):
        body.add_to_inventory(item)
        queue_free()
\`\`\`

## Example: Weapon Stats
\`\`\`gdscript
# res://resources/weapon_data.gd
class_name WeaponData
extends Resource

@export_group("Base Stats")
@export var weapon_name: String
@export var damage: int = 10
@export var attack_speed: float = 1.0

@export_group("Visuals")
@export var sprite: Texture2D
@export var animation_set: SpriteFrames

@export_group("Audio")
@export var attack_sound: AudioStream
@export var hit_sound: AudioStream
\`\`\`

## Example: Enemy Configuration
\`\`\`gdscript
# res://resources/enemy_data.gd
class_name EnemyData
extends Resource

@export var enemy_name: String
@export var max_health: int = 100
@export var move_speed: float = 50.0
@export var damage: int = 10
@export var drop_item: ItemData  # Reference another resource!
@export var xp_reward: int = 25
\`\`\`

## Benefits Over JSON
| JSON | Custom Resource |
|------|-----------------|
| No type checking | Strongly typed |
| Parse at runtime | Native loading |
| No editor preview | Full Inspector UI |
| Manual serialization | Automatic save/load |

## File Organization
\`\`\`
res://resources/
├── items/
│   ├── sword.tres
│   ├── potion.tres
│   └── key.tres
├── enemies/
│   ├── slime.tres
│   └── goblin.tres
└── definitions/
    ├── item_data.gd
    └── enemy_data.gd
\`\`\`
`;

export const CUSTOM_RESOURCES_KEYWORDS = [
    'resource', 'data', 'custom', 'tres', 'export',
    'class_name', 'extends', 'item', 'stats', 'configuration'
];
