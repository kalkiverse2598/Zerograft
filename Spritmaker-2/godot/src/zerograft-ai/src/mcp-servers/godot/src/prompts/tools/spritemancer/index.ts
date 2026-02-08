/**
 * SpriteMancer Tools
 * 
 * AI sprite generation tools with context requirements.
 * These tools are only available when SpriteMancer backend is running.
 */

import { GodotToolSpec, ModelFamily } from "../../types.js";

export const spritemancer_status: GodotToolSpec = {
    id: "spritemancer_status",
    variant: ModelFamily.GENERIC,
    name: "spritemancer_status",
    description: "Check if SpriteMancer backend is running",
    whenToUse: "Before attempting sprite generation to verify backend is available",
    parameters: [
        {
            name: "explanation", required: true, type: "string",
            description: "Why checking status"
        }
    ]
};

export const spritemancer_create_character: GodotToolSpec = {
    id: "spritemancer_create_character",
    variant: ModelFamily.GENERIC,
    name: "spritemancer_create_character",
    description: "PHASE 1: Create a character reference image using AI. Opens embedded editor for user preview and confirmation before generating animations.",
    whenToUse: "When user asks to create a character. AFTER THIS TOOL, ask user if the character looks good before calling spritemancer_generate_animations.",
    // Only show when SpriteMancer is available
    contextRequirements: (ctx) => ctx.hasSpriteMancer,
    parameters: [
        {
            name: "description", required: true, type: "string",
            description: "Character description (e.g., 'knight with sword')"
        },
        {
            name: "size", required: false, type: "string",
            description: "Sprite size: 32x32, 64x64, 128x128", default: "32x32"
        },
        {
            name: "perspective", required: false, type: "string",
            description: "View: side, front, isometric", default: "side"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why creating this character"
        }
    ]
};

export const spritemancer_use_existing: GodotToolSpec = {
    id: "spritemancer_use_existing",
    variant: ModelFamily.GENERIC,
    name: "spritemancer_use_existing",
    description: "Use an EXISTING reference image from res:// folder instead of generating new. Uploads to SpriteMancer backend for DNA extraction and animation generation.",
    whenToUse: "When user wants to animate a character that ALREADY EXISTS in res://sprites/ folder (e.g., 'use my robot at res://sprites/robot/reference.png')",
    whenNotToUse: "When user wants to CREATE a new character - use spritemancer_create_character instead",
    contextRequirements: (ctx) => ctx.hasSpriteMancer,
    parameters: [
        {
            name: "reference_image_path", required: true, type: "string",
            description: "Path to existing reference image (e.g., 'res://sprites/robot/reference.png')"
        },
        {
            name: "character_name", required: true, type: "string",
            description: "Name for the character (used in project naming)"
        },
        {
            name: "perspective", required: false, type: "string",
            description: "View: side, front, isometric", default: "side"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why using this existing image"
        }
    ]
};

export const spritemancer_generate_animations: GodotToolSpec = {
    id: "spritemancer_generate_animations",
    variant: ModelFamily.GENERIC,
    name: "spritemancer_generate_animations",
    description: `PHASE 2: Generate animations for a CONFIRMED character.

CRITICAL: After this tool completes, you MUST:
1. Call ask_followup_question to ask user: "Does the animation look good?"
2. Wait for explicit user approval BEFORE calling spritemancer_approve_animation
3. NEVER auto-approve - always ask user first

The project_id must be the exact UUID returned by spritemancer_create_character.`,
    whenToUse: "AFTER user confirms the character looks good from Phase 1. Use the EXACT project_id UUID from the Phase 1 result. ALWAYS follow up with ask_followup_question!",
    whenNotToUse: "Do NOT call spritemancer_approve_animation immediately after this - you MUST ask user for approval first",
    contextRequirements: (ctx) => ctx.hasSpriteMancer,
    parameters: [
        {
            name: "project_id", required: true, type: "string",
            description: "EXACT UUID from spritemancer_create_character result"
        },
        {
            name: "character_name", required: true, type: "string",
            description: "Character name for file naming (e.g., 'knight')"
        },
        {
            name: "animations", required: true, type: "array",
            items: { type: "string" },
            description: "Animations to generate: idle, walk, run, attack, jump"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why generating these animations"
        }
    ]
};

export const spritemancer_animate: GodotToolSpec = {
    id: "spritemancer_animate",
    variant: ModelFamily.GENERIC,
    name: "spritemancer_animate",
    description: "Generate a single additional animation for existing character",
    contextRequirements: (ctx) => ctx.hasSpriteMancer,
    parameters: [
        {
            name: "project_id", required: true, type: "string",
            description: "SpriteMancer project ID"
        },
        {
            name: "animation", required: true, type: "string",
            description: "Animation type: idle, walk, run, attack, jump, die"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why generating this animation"
        }
    ]
};

export const spritemancer_approve_animation: GodotToolSpec = {
    id: "spritemancer_approve_animation",
    variant: ModelFamily.GENERIC,
    name: "spritemancer_approve_animation",
    description: `⚠️ MANDATORY USER APPROVAL REQUIRED: Save approved animation frames to Godot project.

CRITICAL WORKFLOW:
1. BEFORE calling this tool, you MUST have called ask_followup_question to ask user: "Does the [animation] animation look good?"
2. You MUST have received an EXPLICIT approval response (e.g., "yes", "looks good", "approved")
3. NEVER call this tool without user confirmation - doing so is a critical error

This tool marks the animation as approved in the database and downloads frames to res:// folder.`,
    whenToUse: "ONLY after calling ask_followup_question AND receiving explicit user approval ('yes', 'looks good', 'approved'). NEVER auto-approve without asking user first!",
    whenNotToUse: "NEVER call this without first asking user via ask_followup_question and getting their explicit approval",
    contextRequirements: (ctx) => ctx.hasSpriteMancer,
    parameters: [
        {
            name: "project_id", required: true, type: "string",
            description: "SpriteMancer project UUID"
        },
        {
            name: "animation", required: true, type: "string",
            description: "Animation type being approved (e.g., 'idle', 'walk')"
        },
        {
            name: "character_name", required: false, type: "string",
            description: "Character name for folder structure (e.g., 'knight')"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why approving this animation"
        }
    ]
};

export const spritemancer_retry_dna: GodotToolSpec = {
    id: "spritemancer_retry_dna",
    variant: ModelFamily.GENERIC,
    name: "spritemancer_retry_dna",
    description: "RECOVERY: Retry DNA extraction for a project when it failed initially. DNA is required before animations can be generated.",
    whenToUse: "When spritemancer_generate_animations fails with 'DNA not extracted yet' error. Call this to retry the DNA extraction.",
    contextRequirements: (ctx) => ctx.hasSpriteMancer,
    parameters: [
        {
            name: "project_id", required: true, type: "string",
            description: "SpriteMancer project UUID that needs DNA re-extraction"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why retrying DNA extraction"
        }
    ]
};

export const spritemancer_import: GodotToolSpec = {
    id: "spritemancer_import",
    variant: ModelFamily.GENERIC,
    name: "spritemancer_import",
    description: "Import generated spritesheet into Godot project",
    contextRequirements: (ctx) => ctx.hasSpriteMancer,
    parameters: [
        {
            name: "project_id", required: true, type: "string",
            description: "SpriteMancer project ID"
        },
        {
            name: "output_path", required: true, type: "string",
            description: "Godot path (res://sprites/character.png)"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why importing to this location"
        }
    ]
};

export const spritemancer_generate_asset: GodotToolSpec = {
    id: "spritemancer_generate_asset",
    variant: ModelFamily.GENERIC,
    name: "spritemancer_generate_asset",
    description: "Generate any type of game asset: character reference, effect, tile, or UI element",
    contextRequirements: (ctx) => ctx.hasSpriteMancer,
    parameters: [
        {
            name: "asset_type", required: true, type: "string",
            description: "Type: character, effect, tile, ui"
        },
        {
            name: "prompt", required: true, type: "string",
            description: "Description of the asset (e.g., 'fire explosion', 'gold coin')"
        },
        {
            name: "size", required: false, type: "string",
            description: "Sprite size: 16x16, 32x32, 64x64", default: "32x32"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why generating this asset"
        }
    ]
};

export const spritemancer_open_project: GodotToolSpec = {
    id: "spritemancer_open_project",
    variant: ModelFamily.GENERIC,
    name: "spritemancer_open_project",
    description: "Open a SpriteMancer project in the embedded editor",
    contextRequirements: (ctx) => ctx.hasSpriteMancer,
    parameters: [
        {
            name: "project_id", required: true, type: "string",
            description: "SpriteMancer project UUID"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why opening this project"
        }
    ]
};

export const create_sprite_frames_from_images: GodotToolSpec = {
    id: "create_sprite_frames_from_images",
    variant: ModelFamily.GENERIC,
    name: "create_sprite_frames_from_images",
    description: "Create a SpriteFrames resource from individual PNG files",
    contextRequirements: (ctx) => ctx.hasSpriteMancer,
    parameters: [
        {
            name: "path", required: true, type: "string",
            description: "Output path for .tres file (e.g., res://sprites/knight.tres)"
        },
        {
            name: "animations", required: true, type: "array",
            items: { type: "object" },
            description: "Array of {name, fps, loop, frames} where frames is array of image paths"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why creating this SpriteFrames resource"
        }
    ]
};

// ============================================
// PARALLAX BACKGROUND GENERATION
// ============================================

export const spritemancer_generate_parallax: GodotToolSpec = {
    id: "spritemancer_generate_parallax",
    variant: ModelFamily.GENERIC,
    name: "spritemancer_generate_parallax",
    description: "Generate parallax background layers with true alpha transparency. Uses difference matting for perfect transparency. Can generate single layer or full 3-layer pack (far, mid, near).",
    whenToUse: "When user needs game backgrounds or parallax layers for 2D games",
    contextRequirements: (ctx) => ctx.hasSpriteMancer,
    parameters: [
        {
            name: "prompt", required: true, type: "string",
            description: "Description of the background (e.g., 'enchanted forest with glowing mushrooms')"
        },
        {
            name: "parallax_layer", required: false, type: "string",
            description: "Layer type: 'far' (distant), 'mid' (middle), 'near' (foreground), 'full' (single scene), or 'pack' (all 3 layers). Default: 'pack'"
        },
        {
            name: "time_of_day", required: false, type: "string",
            description: "Lighting: 'day', 'night', 'sunset', 'sunrise', 'twilight'. Default: 'day'"
        },
        {
            name: "size", required: false, type: "string",
            description: "Image size: '320x180', '480x270', '640x360'. Default: '480x270'"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why generating this background"
        }
    ]
};

// ============================================
// TILESET GENERATION - SPECIALIZED TOOLS
// ============================================

export const spritemancer_generate_terrain_tileset: GodotToolSpec = {
    id: "spritemancer_generate_terrain_tileset",
    variant: ModelFamily.GENERIC,
    name: "spritemancer_generate_terrain_tileset",
    description: "Generate a complete terrain tileset with 9 tiles (center, edges, corners). Creates seamless tiles for grass, dirt, stone, sand, etc. Supports presets or custom configuration.",
    whenToUse: "When user needs ground/terrain tiles for level design",
    contextRequirements: (ctx) => ctx.hasSpriteMancer,
    parameters: [
        {
            name: "preset", required: false, type: "string",
            description: "Preset: grass_meadow, dirt_path, stone_floor, desert_sand, ice_terrain, dark_rock, grass_and_dirt, snow_ground"
        },
        {
            name: "terrain_type", required: false, type: "string",
            description: "Custom terrain type: grass, dirt, stone, sand, ice, brick, water"
        },
        {
            name: "tile_size", required: false, type: "number",
            description: "Tile size in pixels (default: 32)"
        },
        {
            name: "use_difference_matte", required: false, type: "boolean",
            description: "Use advanced transparency (slower but better alpha). Default: false"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why generating this terrain"
        }
    ]
};

export const spritemancer_generate_platform_tiles: GodotToolSpec = {
    id: "spritemancer_generate_platform_tiles",
    variant: ModelFamily.GENERIC,
    name: "spritemancer_generate_platform_tiles",
    description: "Generate 6-piece platform tiles for platformer games: left cap, 3 center variants, right cap, single. Creates seamless platform tiles.",
    whenToUse: "When building platformer games that need jumpable platforms",
    contextRequirements: (ctx) => ctx.hasSpriteMancer,
    parameters: [
        {
            name: "preset", required: false, type: "string",
            description: "Preset: grass_platform, stone_platform, wooden_platform, floating_island"
        },
        {
            name: "material", required: false, type: "string",
            description: "Platform material: grass, stone, wood, metal, ice, brick, cloud, crystal, sand"
        },
        {
            name: "tile_size", required: false, type: "number",
            description: "Tile size in pixels (default: 32)"
        },
        {
            name: "use_difference_matte", required: false, type: "boolean",
            description: "Use advanced transparency. Default: false"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why generating these platforms"
        }
    ]
};

export const spritemancer_generate_wall_tileset: GodotToolSpec = {
    id: "spritemancer_generate_wall_tileset",
    variant: ModelFamily.GENERIC,
    name: "spritemancer_generate_wall_tileset",
    description: "Generate 9-tile wall tileset for dungeons, caves, and buildings. Includes center fill, edges, and corners.",
    whenToUse: "When building indoor environments like dungeons, caves, or buildings",
    contextRequirements: (ctx) => ctx.hasSpriteMancer,
    parameters: [
        {
            name: "preset", required: false, type: "string",
            description: "Preset: dungeon_walls, castle_walls, cave_walls, brick_walls, wooden_walls, ice_walls"
        },
        {
            name: "wall_type", required: false, type: "string",
            description: "Wall type: castle, dungeon, cave, brick, wooden, stone, metal, ice"
        },
        {
            name: "wall_style", required: false, type: "string",
            description: "Style: pristine, weathered, damaged, mossy, ancient. Default: weathered"
        },
        {
            name: "tile_size", required: false, type: "number",
            description: "Tile size in pixels (default: 32)"
        },
        {
            name: "use_difference_matte", required: false, type: "boolean",
            description: "Use advanced transparency. Default: false"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why generating these walls"
        }
    ]
};

export const spritemancer_generate_decoration: GodotToolSpec = {
    id: "spritemancer_generate_decoration",
    variant: ModelFamily.GENERIC,
    name: "spritemancer_generate_decoration",
    description: "Generate decoration/prop sprites like crates, barrels, bushes, rocks, chests, etc. Can generate multiple variations.",
    whenToUse: "When user needs environmental props, decorations, or interactable objects",
    contextRequirements: (ctx) => ctx.hasSpriteMancer,
    parameters: [
        {
            name: "preset", required: false, type: "string",
            description: "Preset: wooden_crate, barrel, bush, rock, treasure_chest, mushroom, gravestone"
        },
        {
            name: "decoration_type", required: false, type: "string",
            description: "Type: crate, barrel, sign, bush, tree, rock, chest, pot, lamp, fence, grave, statue, mushroom, flower"
        },
        {
            name: "size", required: false, type: "string",
            description: "Sprite size in WxH format (e.g., '32x32', '32x48'). Default: '32x32'"
        },
        {
            name: "variation_count", required: false, type: "number",
            description: "Number of visual variations to generate (1-5). Default: 1"
        },
        {
            name: "use_difference_matte", required: false, type: "boolean",
            description: "Use advanced transparency. Default: false"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why generating this decoration"
        }
    ]
};

export const spritemancer_generate_transition_tiles: GodotToolSpec = {
    id: "spritemancer_generate_transition_tiles",
    variant: ModelFamily.GENERIC,
    name: "spritemancer_generate_transition_tiles",
    description: "Generate 8 transition tiles that blend between two terrain types. Creates edge and corner transitions for natural terrain borders.",
    whenToUse: "When creating smooth transitions between different terrain types (grass→dirt, sand→water, etc.)",
    contextRequirements: (ctx) => ctx.hasSpriteMancer,
    parameters: [
        {
            name: "from_terrain", required: true, type: "string",
            description: "Source terrain type (e.g., 'grass', 'dirt', 'stone', 'sand', 'snow', 'water')"
        },
        {
            name: "to_terrain", required: true, type: "string",
            description: "Destination terrain type (e.g., 'dirt', 'stone', 'sand')"
        },
        {
            name: "tile_size", required: false, type: "number",
            description: "Tile size in pixels (default: 32)"
        },
        {
            name: "transition_style", required: false, type: "string",
            description: "Style: hard_edge, soft_blend, scattered, dithered, organic. Default: scattered"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why generating these transitions"
        }
    ]
};

export const spritemancer_generate_animated_tile: GodotToolSpec = {
    id: "spritemancer_generate_animated_tile",
    variant: ModelFamily.GENERIC,
    name: "spritemancer_generate_animated_tile",
    description: "Generate animated environment tiles like water, lava, fire, crystals, waterfalls. Creates seamless looping animation frames.",
    whenToUse: "When user needs animated environmental elements for levels",
    contextRequirements: (ctx) => ctx.hasSpriteMancer,
    parameters: [
        {
            name: "preset", required: false, type: "string",
            description: "Preset: calm_water, bubbling_lava, torch_fire, crystal_pulse, waterfall, windy_grass"
        },
        {
            name: "tile_type", required: false, type: "string",
            description: "Type: water, lava, fire, crystal, waterfall, grass_wind, portal, energy, acid, fog"
        },
        {
            name: "animation_style", required: false, type: "string",
            description: "Animation: wave, flicker, pulse, flow, sway, sparkle, ripple, bubble"
        },
        {
            name: "frame_count", required: false, type: "number",
            description: "Number of animation frames (4-8). Default: 4"
        },
        {
            name: "tile_size", required: false, type: "number",
            description: "Tile size in pixels (default: 32)"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why generating this animated tile"
        }
    ]
};

export const spritemancer_list_tileset_presets: GodotToolSpec = {
    id: "spritemancer_list_tileset_presets",
    variant: ModelFamily.GENERIC,
    name: "spritemancer_list_tileset_presets",
    description: "List all available presets for tileset generation across terrain, platform, wall, decoration, and animated tiles.",
    whenToUse: "When user wants to see available tileset options or presets",
    contextRequirements: (ctx) => ctx.hasSpriteMancer,
    parameters: [
        {
            name: "explanation", required: true, type: "string",
            description: "Why listing presets"
        }
    ]
};

// ============================================
// EFFECT GENERATION
// ============================================

export const spritemancer_generate_effect: GodotToolSpec = {
    id: "spritemancer_generate_effect",
    variant: ModelFamily.GENERIC,
    name: "spritemancer_generate_effect",
    description: "Generate VFX effect sprites like explosions, fire, magic spells, particles, etc.",
    whenToUse: "When user needs visual effects, particles, or VFX sprites for the game",
    contextRequirements: (ctx) => ctx.hasSpriteMancer,
    parameters: [
        {
            name: "prompt", required: true, type: "string",
            description: "Description of effect (e.g., 'blue magic explosion', 'fire burst')"
        },
        {
            name: "preset", required: false, type: "string",
            description: "Effect preset: 'explosion', 'fire', 'smoke', 'magic', 'electric', 'water', 'heal'"
        },
        {
            name: "frame_count", required: false, type: "number",
            description: "Number of animation frames: 4, 6, 8, 12. Default: 8"
        },
        {
            name: "size", required: false, type: "string",
            description: "Effect size: '32x32', '64x64', '128x128'. Default: '64x64'"
        },
        {
            name: "looping", required: false, type: "boolean",
            description: "Whether the effect loops. Default: true"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why generating this effect"
        }
    ]
};

// ============================================
// SCENE IMPORT TOOLS
// ============================================

export const import_parallax_to_scene: GodotToolSpec = {
    id: "import_parallax_to_scene",
    variant: ModelFamily.GENERIC,
    name: "import_parallax_to_scene",
    description: "Create a ParallaxBackground node hierarchy in the current scene from generated parallax layers",
    whenToUse: "After generating parallax layers with spritemancer_generate_parallax, to add them to the scene",
    contextRequirements: (ctx) => ctx.hasSpriteMancer,
    parameters: [
        {
            name: "layer_paths", required: true, type: "array",
            items: { type: "string" },
            description: "Array of layer image paths in order [far, mid, near] (e.g., ['res://sprites/backgrounds/forest_far.png', ...])"
        },
        {
            name: "parent_node", required: false, type: "string",
            description: "Parent node path to add ParallaxBackground to (default: scene root)"
        },
        {
            name: "motion_scales", required: false, type: "array",
            items: { type: "number" },
            description: "Motion scale for each layer [far, mid, near] (default: [0.2, 0.5, 0.8])"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why importing this parallax background"
        }
    ]
};

export const import_tileset_to_scene: GodotToolSpec = {
    id: "import_tileset_to_scene",
    variant: ModelFamily.GENERIC,
    name: "import_tileset_to_scene",
    description: "Create a TileSet resource from a generated tileset image",
    whenToUse: "After generating tileset with spritemancer_generate_tileset, to create a TileSet resource for TileMap use",
    contextRequirements: (ctx) => ctx.hasSpriteMancer,
    parameters: [
        {
            name: "image_path", required: true, type: "string",
            description: "Path to tileset image (e.g., 'res://sprites/tiles/grass_tileset.png')"
        },
        {
            name: "tile_size", required: false, type: "string",
            description: "Size of each tile: '16x16', '32x32', '64x64' (default: '16x16')"
        },
        {
            name: "output_path", required: false, type: "string",
            description: "Output path for .tres file (default: same folder as image)"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why importing this tileset"
        }
    ]
};

export const import_effect_to_scene: GodotToolSpec = {
    id: "import_effect_to_scene",
    variant: ModelFamily.GENERIC,
    name: "import_effect_to_scene",
    description: "Create an AnimatedSprite2D node with SpriteFrames from a generated effect spritesheet",
    whenToUse: "After generating effect with spritemancer_generate_effect, to add it to the scene as an AnimatedSprite2D",
    contextRequirements: (ctx) => ctx.hasSpriteMancer,
    parameters: [
        {
            name: "spritesheet_path", required: true, type: "string",
            description: "Path to effect spritesheet (e.g., 'res://sprites/effects/explosion_effect.png')"
        },
        {
            name: "parent_node", required: false, type: "string",
            description: "Parent node path for the AnimatedSprite2D (default: scene root)"
        },
        {
            name: "node_name", required: false, type: "string",
            description: "Name for the AnimatedSprite2D node (default: 'Effect')"
        },
        {
            name: "frame_count", required: false, type: "number",
            description: "Number of frames in the spritesheet (default: 8)"
        },
        {
            name: "fps", required: false, type: "number",
            description: "Frames per second for animation (default: 12)"
        },
        {
            name: "loop", required: false, type: "boolean",
            description: "Whether animation loops (default: true)"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why importing this effect"
        }
    ]
};

// ============================================
// GODOT TILESET EXPORT (.tres)
// ============================================

export const spritemancer_export_tileset_resource: GodotToolSpec = {
    id: "spritemancer_export_tileset_resource",
    variant: ModelFamily.GENERIC,
    name: "spritemancer_export_tileset_resource",
    description: "Export a generated tileset as a Godot 4.x .tres TileSet resource with terrain autotiling. Use after generating a tileset to create a ready-to-use TileSet for TileMapLayer.",
    whenToUse: "After generating a tileset with any generation tool, to export it as a Godot .tres resource",
    contextRequirements: (ctx) => ctx.hasSpriteMancer,
    parameters: [
        {
            name: "tileset_image_base64", required: true, type: "string",
            description: "Base64-encoded PNG of the tileset (from previous generation result)"
        },
        {
            name: "tile_size", required: false, type: "number",
            description: "Tile size in pixels (default: 32)"
        },
        {
            name: "tileset_type", required: false, type: "string",
            description: "Type: 'terrain', 'platform', 'wall', 'decoration', 'animated', 'transition'. Default: 'terrain'"
        },
        {
            name: "texture_path", required: false, type: "string",
            description: "Godot resource path for the texture (e.g., 'res://sprites/tilesets/grass.png')"
        },
        {
            name: "terrain_name", required: false, type: "string",
            description: "Name for the terrain in Godot editor. Default: 'terrain_0'"
        },
        {
            name: "include_terrain", required: false, type: "boolean",
            description: "Include terrain autotiling configuration. Default: true"
        },
        {
            name: "include_physics", required: false, type: "boolean",
            description: "Include physics collision layers. Default: false"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why exporting this tileset"
        }
    ]
};

export const spritemancer_generate_and_export_terrain: GodotToolSpec = {
    id: "spritemancer_generate_and_export_terrain",
    variant: ModelFamily.GENERIC,
    name: "spritemancer_generate_and_export_terrain",
    description: "Generate terrain tileset AND export as Godot .tres in one call. Returns both PNG and .tres file ready for Godot import. Convenience tool that combines generation + export.",
    whenToUse: "When you want to generate terrain tiles and immediately export for Godot use",
    contextRequirements: (ctx) => ctx.hasSpriteMancer,
    parameters: [
        {
            name: "preset", required: false, type: "string",
            description: "Preset: grass_meadow, dirt_path, stone_floor, desert_sand, ice_terrain, dark_rock, grass_and_dirt, snow_ground"
        },
        {
            name: "terrain_type", required: false, type: "string",
            description: "Custom terrain type: grass, dirt, stone, sand, ice, brick, water"
        },
        {
            name: "tile_size", required: false, type: "number",
            description: "Tile size in pixels (default: 32)"
        },
        {
            name: "use_difference_matte", required: false, type: "boolean",
            description: "Use high-quality alpha (slower but better transparency). Default: false"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why generating this terrain"
        }
    ]
};

/** All SpriteMancer tools */
export const spritemancerTools: GodotToolSpec[] = [
    spritemancer_status,
    spritemancer_create_character,
    spritemancer_use_existing,  // NEW: Use existing res:// reference image
    spritemancer_generate_animations,
    spritemancer_approve_animation,
    spritemancer_retry_dna,
    spritemancer_animate,
    spritemancer_import,
    spritemancer_generate_asset,
    spritemancer_open_project,
    create_sprite_frames_from_images,
    // Dedicated asset generators
    spritemancer_generate_parallax,
    spritemancer_generate_effect,
    // Tileset generation tools
    spritemancer_generate_terrain_tileset,
    spritemancer_generate_platform_tiles,
    spritemancer_generate_wall_tileset,
    spritemancer_generate_decoration,
    spritemancer_generate_transition_tiles,
    spritemancer_generate_animated_tile,
    spritemancer_list_tileset_presets,
    // Tileset export tools
    spritemancer_export_tileset_resource,
    spritemancer_generate_and_export_terrain,
    // Scene import tools
    import_parallax_to_scene,
    import_tileset_to_scene,
    import_effect_to_scene,
];
