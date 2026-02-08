/**
 * Project Organization Recipe
 * Folder structure and naming conventions
 */

export const PROJECT_ORGANIZATION_RECIPE = `
# Project Organization

## Recommended Folder Structure
\`\`\`
res://
├── scenes/
│   ├── characters/
│   │   ├── player.tscn
│   │   ├── player.gd
│   │   └── enemy.tscn
│   ├── levels/
│   │   ├── level_1.tscn
│   │   └── level_2.tscn
│   ├── ui/
│   │   ├── main_menu.tscn
│   │   ├── hud.tscn
│   │   └── pause_menu.tscn
│   └── objects/
│       ├── coin.tscn
│       └── door.tscn
├── sprites/
│   ├── characters/
│   ├── environment/
│   └── ui/
├── autoloads/
│   ├── game_manager.gd
│   ├── music_manager.tscn
│   └── scene_transitioner.tscn
├── scripts/
│   └── utilities/
│       └── helper_functions.gd
└── resources/
    ├── themes/
    └── tilesets/
\`\`\`

## Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Folders | snake_case | player_assets/ |
| Scene files | snake_case | player.tscn |
| Script files | snake_case | player.gd |
| Node names | PascalCase | AnimatedSprite2D |
| Variables | snake_case | player_health |
| Constants | UPPER_SNAKE | MAX_HEALTH |
| Signals | snake_case | health_changed |
| Functions | snake_case | get_health() |

## Best Practices
1. **Keep .tscn and .gd together** - Same folder, same name
2. **Entity-based folders** - Group by game object, not file type
3. **Flat structure** - Avoid deep nesting (max 3 levels)
4. **Autoloads folder** - All singletons in one place

## Scene Naming
- Main scene: main.tscn
- Levels: level_1.tscn, level_2.tscn
- Characters: player.tscn, enemy_slime.tscn
- UI: main_menu.tscn, hud.tscn

## Resource Paths
\`\`\`gdscript
# Absolute paths from res://
var scene = preload("res://scenes/characters/player.tscn")

# Never use relative paths in code
# Bad: preload("../player.tscn")
# Good: preload("res://scenes/characters/player.tscn")
\`\`\`

## Project Settings
- Project Settings → Application → Run → Main Scene
- Project Settings → Autoload → Add singletons
- Project Settings → Input Map → Define actions
`;

export const PROJECT_ORGANIZATION_KEYWORDS = [
    'folder', 'organize', 'structure', 'naming', 'project',
    'convention', 'res://', 'path', 'file'
];
