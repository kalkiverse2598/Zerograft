/**
 * TypeScript type definitions for Tileset Builder
 */

export type TilesetCategory =
    | 'terrain'
    | 'platform'
    | 'wall'
    | 'decoration'
    | 'transition'
    | 'animated';

export interface Preset {
    id: string;
    name: string;
    description: string;
    category: TilesetCategory;
    thumbnail?: string;
    tags?: string[];
}

export interface GenerationOptions {
    tileSize: number;
    useDifferenceMatte: boolean;
    includePhysics: boolean;
    terrainName?: string;
    terrainColor?: string;
}

export interface GeneratedTileset {
    imageBase64: string;
    tileSize: number;
    tileCount: number;
    category: TilesetCategory;
    presetId: string;
    presetName: string;
    // Export data
    tresBase64?: string;
    texturePath?: string;
    tresPath?: string;
}

export interface GenerateRequest {
    preset: string;
    category: TilesetCategory;
    tileSize: number;
    useDifferenceMatte: boolean;
}

export interface ExportRequest {
    tilesetImageBase64: string;
    tileSize: number;
    tilesetType: string;
    texturePath: string;
    terrainName: string;
    terrainColor: string;
    includeTerrain: boolean;
    includePhysics: boolean;
}

// Preset definitions for each category
export const PRESET_CATEGORIES: Record<TilesetCategory, { name: string; icon: string; description: string }> = {
    terrain: {
        name: 'Terrain',
        icon: '🏔️',
        description: 'Ground tiles with edges and corners',
    },
    platform: {
        name: 'Platform',
        icon: '🎮',
        description: 'Platformer game platforms',
    },
    wall: {
        name: 'Wall',
        icon: '🧱',
        description: 'Dungeon and cave walls',
    },
    decoration: {
        name: 'Decoration',
        icon: '🎨',
        description: 'Props and environmental objects',
    },
    transition: {
        name: 'Transition',
        icon: '🔄',
        description: 'Terrain blend tiles',
    },
    animated: {
        name: 'Animated',
        icon: '💧',
        description: 'Animated environment tiles',
    },
};

export const PRESETS: Record<TilesetCategory, Preset[]> = {
    terrain: [
        { id: 'grass_meadow', name: 'Grass Meadow', description: 'Lush green grass tiles', category: 'terrain' },
        { id: 'dirt_path', name: 'Dirt Path', description: 'Brown dirt and path tiles', category: 'terrain' },
        { id: 'stone_floor', name: 'Stone Floor', description: 'Gray stone floor tiles', category: 'terrain' },
        { id: 'desert_sand', name: 'Desert Sand', description: 'Sandy desert tiles', category: 'terrain' },
        { id: 'ice_terrain', name: 'Ice Terrain', description: 'Frozen ice and snow tiles', category: 'terrain' },
        { id: 'dark_rock', name: 'Dark Rock', description: 'Dark volcanic rock tiles', category: 'terrain' },
        { id: 'grass_and_dirt', name: 'Grass & Dirt', description: 'Mixed grass and dirt', category: 'terrain' },
        { id: 'snow_ground', name: 'Snow Ground', description: 'Snowy ground tiles', category: 'terrain' },
    ],
    platform: [
        { id: 'grass_platform', name: 'Grass Platform', description: 'Grassy floating platforms', category: 'platform' },
        { id: 'stone_platform', name: 'Stone Platform', description: 'Stone block platforms', category: 'platform' },
        { id: 'wooden_platform', name: 'Wooden Platform', description: 'Wooden plank platforms', category: 'platform' },
        { id: 'floating_island', name: 'Floating Island', description: 'Island-style platforms', category: 'platform' },
    ],
    wall: [
        { id: 'dungeon_walls', name: 'Dungeon Walls', description: 'Dark dungeon walls', category: 'wall' },
        { id: 'castle_walls', name: 'Castle Walls', description: 'Medieval castle walls', category: 'wall' },
        { id: 'cave_walls', name: 'Cave Walls', description: 'Natural cave walls', category: 'wall' },
        { id: 'brick_walls', name: 'Brick Walls', description: 'Red brick walls', category: 'wall' },
        { id: 'wooden_walls', name: 'Wooden Walls', description: 'Wooden plank walls', category: 'wall' },
        { id: 'ice_walls', name: 'Ice Walls', description: 'Frozen ice walls', category: 'wall' },
    ],
    decoration: [
        { id: 'wooden_crate', name: 'Wooden Crate', description: 'Stackable wooden crates', category: 'decoration' },
        { id: 'barrel', name: 'Barrel', description: 'Wooden barrels', category: 'decoration' },
        { id: 'bush', name: 'Bush', description: 'Green bushes', category: 'decoration' },
        { id: 'rock', name: 'Rock', description: 'Natural rocks', category: 'decoration' },
        { id: 'treasure_chest', name: 'Treasure Chest', description: 'Loot chests', category: 'decoration' },
        { id: 'mushroom', name: 'Mushroom', description: 'Forest mushrooms', category: 'decoration' },
        { id: 'gravestone', name: 'Gravestone', description: 'Cemetery gravestones', category: 'decoration' },
    ],
    transition: [
        // Transitions are configured dynamically
    ],
    animated: [
        { id: 'calm_water', name: 'Calm Water', description: 'Gentle water animation', category: 'animated' },
        { id: 'bubbling_lava', name: 'Bubbling Lava', description: 'Hot lava with bubbles', category: 'animated' },
        { id: 'torch_fire', name: 'Torch Fire', description: 'Flickering torch flames', category: 'animated' },
        { id: 'crystal_pulse', name: 'Crystal Pulse', description: 'Glowing crystal pulses', category: 'animated' },
        { id: 'waterfall', name: 'Waterfall', description: 'Flowing waterfall', category: 'animated' },
        { id: 'windy_grass', name: 'Windy Grass', description: 'Grass swaying in wind', category: 'animated' },
    ],
};
