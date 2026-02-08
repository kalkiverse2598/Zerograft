/**
 * Scene Management Tools
 * 
 * Tools for creating, manipulating, and managing Godot scenes.
 */

import { GodotToolSpec, ModelFamily } from "../../types.js";

export const create_scene: GodotToolSpec = {
    id: "create_scene",
    variant: ModelFamily.GENERIC,
    name: "create_scene",
    description: "Create a new scene file",
    whenToUse: "When creating a new game object, level, or UI screen",
    parameters: [
        {
            name: "path", required: true, type: "string",
            description: "Scene path (e.g., res://name.tscn)"
        },
        {
            name: "root_type", required: true, type: "string",
            description: "Root node type (Node2D, CharacterBody2D, Control, etc.)"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why this scene is being created"
        }
    ]
};

export const add_node: GodotToolSpec = {
    id: "add_node",
    variant: ModelFamily.GENERIC,
    name: "add_node",
    description: "Add a node to the current scene",
    whenToUse: "When adding child nodes to build scene hierarchy",
    parameters: [
        {
            name: "parent", required: true, type: "string",
            description: "Parent node path (empty string for root)"
        },
        {
            name: "type", required: true, type: "string",
            description: "Node type (Sprite2D, CollisionShape2D, etc.)"
        },
        {
            name: "name", required: true, type: "string",
            description: "Name for the new node"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why this node is being added"
        }
    ]
};

export const remove_node: GodotToolSpec = {
    id: "remove_node",
    variant: ModelFamily.GENERIC,
    name: "remove_node",
    description: "Remove a node from the scene",
    parameters: [
        {
            name: "path", required: true, type: "string",
            description: "Path to the node to remove"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why this node is being removed"
        }
    ]
};

export const rename_node: GodotToolSpec = {
    id: "rename_node",
    variant: ModelFamily.GENERIC,
    name: "rename_node",
    description: "Rename a node",
    parameters: [
        {
            name: "path", required: true, type: "string",
            description: "Current node path"
        },
        {
            name: "new_name", required: true, type: "string",
            description: "New name for the node"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why this node is being renamed"
        }
    ]
};

export const duplicate_node: GodotToolSpec = {
    id: "duplicate_node",
    variant: ModelFamily.GENERIC,
    name: "duplicate_node",
    description: "Duplicate a node",
    parameters: [
        {
            name: "path", required: true, type: "string",
            description: "Path to the node to duplicate"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why this node is being duplicated"
        }
    ]
};

export const move_node: GodotToolSpec = {
    id: "move_node",
    variant: ModelFamily.GENERIC,
    name: "move_node",
    description: "Move a node to a new parent",
    parameters: [
        {
            name: "path", required: true, type: "string",
            description: "Current node path"
        },
        {
            name: "new_parent", required: true, type: "string",
            description: "Path to new parent node"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why this node is being moved"
        }
    ]
};

export const save_scene: GodotToolSpec = {
    id: "save_scene",
    variant: ModelFamily.GENERIC,
    name: "save_scene",
    description: "Save the current scene",
    parameters: [
        {
            name: "path", required: false, type: "string",
            description: "Save path (empty for current)"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why the scene is being saved"
        }
    ]
};

export const open_scene: GodotToolSpec = {
    id: "open_scene",
    variant: ModelFamily.GENERIC,
    name: "open_scene",
    description: "Open a scene file",
    parameters: [
        {
            name: "path", required: true, type: "string",
            description: "Path to scene (res://scene.tscn)"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why this scene is being opened"
        }
    ]
};

export const list_scenes: GodotToolSpec = {
    id: "list_scenes",
    variant: ModelFamily.GENERIC,
    name: "list_scenes",
    description: "List all scene files in project",
    parameters: [
        {
            name: "explanation", required: true, type: "string",
            description: "Why listing scenes"
        }
    ]
};

export const get_scene_tree: GodotToolSpec = {
    id: "get_scene_tree",
    variant: ModelFamily.GENERIC,
    name: "get_scene_tree",
    description: "Get current scene structure",
    whenToUse: "To understand the current scene hierarchy before making changes",
    parameters: [
        {
            name: "explanation", required: true, type: "string",
            description: "Why getting scene tree"
        }
    ]
};

export const get_node_info: GodotToolSpec = {
    id: "get_node_info",
    variant: ModelFamily.GENERIC,
    name: "get_node_info",
    description: "Get detailed info about a node (properties, children)",
    parameters: [
        {
            name: "path", required: true, type: "string",
            description: "Path to the node"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why getting node info"
        }
    ]
};

export const scene_instantiate: GodotToolSpec = {
    id: "scene_instantiate",
    variant: ModelFamily.GENERIC,
    name: "scene_instantiate",
    description: "Instantiate a .tscn scene file as a child node. Use this instead of add_node when you want to add an existing scene.",
    whenToUse: "When adding a .tscn scene as a child - ALWAYS use this for scenes instead of add_node",
    parameters: [
        {
            name: "scene_path", required: true, type: "string",
            description: "Path to scene file (res://Player.tscn)"
        },
        {
            name: "parent", required: false, type: "string",
            description: "Parent node path (empty for scene root)"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why instantiating this scene"
        }
    ]
};

export const set_collision_shape: GodotToolSpec = {
    id: "set_collision_shape",
    variant: ModelFamily.GENERIC,
    name: "set_collision_shape",
    description: "Set the shape resource on a CollisionShape2D or CollisionShape3D node. WARNING: This is STEP 2 of 3! You MUST also: (1) set AnimatedSprite2D.offset via set_property BEFORE this, and (3) set CollisionShape2D.position via set_property AFTER this. The position should be Vector2(0, -(collision_height/2)) to place the collision bottom at the character's feet.",
    whenToUse: "After adding a CollisionShape2D/3D and AFTER setting sprite offset - this is step 2 of 3 for collision setup",
    parameters: [
        {
            name: "node", required: true, type: "string",
            description: "Path to CollisionShape2D/3D node"
        },
        {
            name: "shape_type", required: true, type: "string",
            description: "Shape type: rectangle, circle, capsule, segment. Use recipe multipliers: rectangle(0.35w, 0.85h), capsule(0.20w, 0.70h), circle(0.25w)"
        },
        {
            name: "size", required: true, type: "object",
            description: "Size calculated from sprite dimensions: {width, height} for rectangle, {radius} for circle, {radius, height} for capsule. NEVER hardcode - always calculate from get_sprite_dimensions!"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why setting this shape - include the calculations used"
        }
    ]
};

export const get_sprite_dimensions: GodotToolSpec = {
    id: "get_sprite_dimensions",
    variant: ModelFamily.GENERIC,
    name: "get_sprite_dimensions",
    description: "Get the actual frame width and height of a Sprite2D or AnimatedSprite2D node's texture",
    whenToUse: "Before calculating collision shapes or sprite offsets - to get actual sprite dimensions",
    parameters: [
        {
            name: "node", required: true, type: "string",
            description: "Path to Sprite2D or AnimatedSprite2D node"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why getting sprite dimensions"
        }
    ]
};

export const map_set_cells_batch: GodotToolSpec = {
    id: "map_set_cells_batch",
    variant: ModelFamily.GENERIC,
    name: "map_set_cells_batch",
    description: "Set multiple tile cells on a TileMapLayer at once. Each cell specifies grid position (x, y), source atlas ID, and atlas coordinates. This is the primary tool for placing tiles programmatically.",
    whenToUse: "When placing tiles on a TileMapLayer - use this to fill ground, platforms, walls, or any tile-based level geometry",
    parameters: [
        {
            name: "tilemap_path", required: true, type: "string",
            description: "Path to TileMapLayer node (e.g., '/root/World/Ground')"
        },
        {
            name: "cells", required: true, type: "array",
            description: "Array of cell objects: [{x: 0, y: 5, source: 0, atlas_x: 1, atlas_y: 0}, ...]. 'x' and 'y' are tile grid coordinates. 'source' is the TileSetAtlasSource ID (usually 0). 'atlas_x' and 'atlas_y' are the tile position in the atlas."
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why placing these tiles"
        }
    ]
};

export const map_clear_layer: GodotToolSpec = {
    id: "map_clear_layer",
    variant: ModelFamily.GENERIC,
    name: "map_clear_layer",
    description: "Clear all tiles from a TileMapLayer",
    whenToUse: "When resetting a tile layer before repainting",
    parameters: [
        {
            name: "tilemap_path", required: true, type: "string",
            description: "Path to TileMapLayer node"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why clearing the layer"
        }
    ]
};

export const map_fill_rect: GodotToolSpec = {
    id: "map_fill_rect",
    variant: ModelFamily.GENERIC,
    name: "map_fill_rect",
    description: "Fill a rectangular region with a specific tile. Useful for creating uniform ground, floors, or walls.",
    whenToUse: "When filling a rectangular area with the same tile type",
    parameters: [
        {
            name: "tilemap_path", required: true, type: "string",
            description: "Path to TileMapLayer node"
        },
        {
            name: "start_x", required: true, type: "number",
            description: "Starting X grid coordinate"
        },
        {
            name: "start_y", required: true, type: "number",
            description: "Starting Y grid coordinate"
        },
        {
            name: "width", required: true, type: "number",
            description: "Width in tiles"
        },
        {
            name: "height", required: true, type: "number",
            description: "Height in tiles"
        },
        {
            name: "source", required: false, type: "number",
            description: "TileSetAtlasSource ID (default: 0)"
        },
        {
            name: "atlas_x", required: true, type: "number",
            description: "Atlas X coordinate of tile to fill"
        },
        {
            name: "atlas_y", required: true, type: "number",
            description: "Atlas Y coordinate of tile to fill"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why filling this area"
        }
    ]
};

/** All scene tools */
export const sceneTools: GodotToolSpec[] = [
    create_scene,
    add_node,
    remove_node,
    rename_node,
    duplicate_node,
    move_node,
    save_scene,
    open_scene,
    list_scenes,
    get_scene_tree,
    get_node_info,
    scene_instantiate,
    set_collision_shape,
    get_sprite_dimensions,
    // TileMapLayer tools
    map_set_cells_batch,
    map_clear_layer,
    map_fill_rect,
];

