/**
 * Level Agent
 * 
 * Tileset Expert & Level Designer.
 * Responsible for generating tilesets, configuring TileMaps, and designing levels.
 */

import { BaseAgent, AgentCallbacks } from './baseAgent.js';
import {
    AgentConfig,
    AgentTask,
    AgentResult,
    AGENT_TOOL_ASSIGNMENTS
} from '../multiAgentTypes.js';

/**
 * Level Agent configuration (CrewAI-style)
 */
const LEVEL_AGENT_CONFIG: AgentConfig = {
    id: 'level',
    name: 'Level Agent',
    role: 'Tileset Expert & Level Designer',
    goal: 'Create tilesets, design levels, and configure TileMap nodes in Godot',
    backstory: `You are an expert level designer who creates tilesets and designs game levels. 
You understand tile-based game design, collision layers, and Godot's TileMap system. 
You can create visually appealing and functional game environments using tiles.`,
    exclusiveTools: AGENT_TOOL_ASSIGNMENTS.level as unknown as string[],
    sharedTools: ['list_files', 'get_scene_tree'],
    workspace: 'res://tilesets',
    maxTokens: 4000,
    maxIterations: 20
};

/**
 * Common tileset themes
 */
const TILESET_THEMES = ['forest', 'dungeon', 'desert', 'snow', 'cave', 'castle', 'city', 'space'];

/**
 * Level Agent - Tileset and level design specialist
 */
export class LevelAgent extends BaseAgent {
    constructor(callbacks: AgentCallbacks) {
        super(LEVEL_AGENT_CONFIG, callbacks);
    }

    // ============================================================================
    // Task Execution
    // ============================================================================

    async execute(task: AgentTask): Promise<AgentResult> {
        const startTime = Date.now();
        this.setCurrentTask(task);
        this.updateStatus('executing');

        try {
            this.callbacks.onProgress?.(`[Level] Starting: ${task.description}`);

            let result: AgentResult;

            switch (task.type) {
                case 'generate_tileset':
                    result = await this.generateTileset(task);
                    break;
                default:
                    result = await this.handleCustomTask(task);
            }

            // Verify the result
            this.updateStatus('verifying');
            const verification = await this.verifyResult(task, result);

            if (!verification.verified) {
                this.callbacks.onProgress?.(`[Level] Verification issues: ${verification.issues.join(', ')}`);
            }

            this.updateStatus('idle');
            this.setCurrentTask(null);
            return result;

        } catch (error) {
            const errorResult = this.createFailureResult(task, {
                code: 'EXECUTION_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error',
                recoverable: true
            }, Date.now() - startTime);

            this.setCurrentTask(null);
            this.updateStatus('error');
            return errorResult;
        }
    }

    // ============================================================================
    // Tileset Generation
    // ============================================================================

    private async generateTileset(task: AgentTask): Promise<AgentResult> {
        const startTime = Date.now();
        const artifacts: string[] = [];
        const taskContext = this.getTaskContextText(task);
        const taskContextLower = taskContext.toLowerCase();

        // Extract tileset details
        const theme = (task.input.theme as string) || this.detectTheme(taskContext);
        const tilesetName = (task.input.tilesetName as string) || `${theme}_tileset`;
        const tileSize = (task.input.tileSize as number) || 32;

        this.callbacks.onProgress?.(`[Level] Creating ${theme} tileset...`);

        // Step 1: Generate tileset via SpriteMancer using CORRECT parameters
        // Backend requires: preset (e.g., grass_meadow), prompt, OR terrain_type (e.g., grass)
        const createResult = await this.executeTool('spritemancer_generate_terrain_tileset', {
            preset: this.mapThemeToPreset(theme),        // e.g., "grass_meadow"
            terrain_type: this.mapThemeToTerrainType(theme), // Fallback: grass, dirt, stone, etc.
            tile_size: tileSize,
            prompt: taskContext,  // Keep full user intent for generation quality
            include_physics: true // Request collision shapes
        });

        if (!createResult.success) {
            this.callbacks.onProgress?.(`[Level] Terrain tileset failed, trying platform tiles...`);

            // Fallback to platform tiles - Backend requires: preset, prompt, OR material
            const platformResult = await this.executeTool('spritemancer_generate_platform_tiles', {
                preset: this.mapThemeToPreset(theme)?.replace('_meadow', '_platform')?.replace('_floor', '_platform') || 'grass_platform',
                material: this.mapThemeToMaterial(theme),
                tile_size: tileSize,
                prompt: taskContext
            });

            if (!platformResult.success) {
                return this.createFailureResult(task, {
                    code: 'SPRITEMANCER_TILESET_FAILED',
                    message: platformResult.message || 'Failed to create tileset',
                    recoverable: true,
                    suggestedAction: 'Check SpriteMancer backend is running'
                }, Date.now() - startTime);
            }
        }

        const projectId = (createResult.data as any)?.project_id || (createResult.data as any)?.projectId;
        const tilesetResourcePath = (createResult.data as any)?.tileset_path || `res://tilesets/${tilesetName}.tres`;
        artifacts.push(tilesetResourcePath);

        // Step 2: Export tileset resource if available
        this.callbacks.onProgress?.(`[Level] Exporting tileset to Godot...`);

        const exportResult = await this.executeTool('spritemancer_export_tileset_resource', {
            project_id: projectId,
            output_path: tilesetResourcePath,
            tile_size: tileSize,
            include_physics: true
        });

        if (!exportResult.success) {
            this.callbacks.onProgress?.(`[Level] Warning: Tileset export had issues, continuing...`);
        }

        // Step 3: Create TileMapLayer node in the scene
        const isPlatformer = taskContextLower.includes('platform') ||
            taskContextLower.includes('plateform');

        if (isPlatformer) {
            this.callbacks.onProgress?.(`[Level] Creating TileMapLayer node...`);

            const tileMapResult = await this.executeTool('add_node', {
                name: 'WorldTileMap',
                type: 'TileMapLayer',
                parent: '.'
            });

            if (tileMapResult.success) {
                // Step 4: Assign the tileset resource to the TileMap
                this.callbacks.onProgress?.(`[Level] Assigning tileset to TileMapLayer...`);

                await this.executeTool('set_property', {
                    node: 'WorldTileMap',
                    property: 'tile_set',
                    value: tilesetResourcePath,
                    explanation: 'Assigning generated tileset to TileMapLayer'
                });

                // Step 5: Paint a basic floor for platformer
                this.callbacks.onProgress?.(`[Level] Painting basic platformer level...`);

                // Create a simple floor pattern
                const floorScript = this.generateLevelPaintingScript(tileSize);
                const scriptPath = `res://scripts/level_painter.gd`;

                const scriptResult = await this.executeTool('create_script', {
                    path: scriptPath,
                    content: floorScript,
                    explanation: 'Creating level painter tool script'
                });

                if (scriptResult.success) {
                    artifacts.push(scriptPath);

                    // Attach and execute the script to paint the level
                    await this.executeTool('attach_script', {
                        node: 'WorldTileMap',
                        script_path: scriptPath,
                        explanation: 'Attaching level painter to TileMapLayer'
                    });
                }
            }
        }

        // Report completion via A2A
        await this.sessionsSend(
            'orchestrator',
            `Tileset ${tilesetName} created at ${tilesetResourcePath}${isPlatformer ? ' with TileMapLayer' : ''}`,
            'task_result'
        );

        return this.createSuccessResult(task, artifacts, {
            tilesetName,
            theme,
            tileSize,
            tilesetPath: tilesetResourcePath,
            projectId,
            hasTileMap: isPlatformer
        }, Date.now() - startTime);
    }

    /**
     * Generate a script that paints a basic platformer level
     */
    private generateLevelPaintingScript(tileSize: number): string {
        return `extends TileMapLayer

# Level Painter - Auto-generated
# This script paints a basic platformer level on _ready

func _ready():
    paint_basic_level()

func paint_basic_level():
    # Get viewport size for level width
    var screen_width = get_viewport_rect().size.x
    var screen_height = get_viewport_rect().size.y
    
    var tile_size = ${tileSize}
    var tiles_wide = int(screen_width / tile_size) + 5
    var tiles_high = int(screen_height / tile_size)
    
    # Paint ground floor (bottom 2 rows)
    var ground_y = tiles_high - 2
    for x in range(-2, tiles_wide):
        # Use source_id 0, atlas coords (0,0) for ground tile
        set_cell(Vector2i(x, ground_y), 0, Vector2i(0, 0))
        set_cell(Vector2i(x, ground_y + 1), 0, Vector2i(0, 0))
    
    # Paint some platforms
    # Platform 1: Left side
    for x in range(3, 8):
        set_cell(Vector2i(x, ground_y - 4), 0, Vector2i(0, 0))
    
    # Platform 2: Middle
    for x in range(12, 18):
        set_cell(Vector2i(x, ground_y - 6), 0, Vector2i(0, 0))
    
    # Platform 3: Right side  
    for x in range(22, 27):
        set_cell(Vector2i(x, ground_y - 3), 0, Vector2i(0, 0))
    
    print("[LevelPainter] Basic platformer level painted!")
`;
    }

    // ============================================================================
    // Helper Methods
    // ============================================================================

    private detectTheme(description: string): string {
        const lowerDesc = description.toLowerCase();

        for (const theme of TILESET_THEMES) {
            if (lowerDesc.includes(theme)) {
                return theme;
            }
        }

        // Default theme based on keywords
        if (lowerDesc.includes('platform')) return 'forest';
        if (lowerDesc.includes('rpg')) return 'dungeon';
        if (lowerDesc.includes('outdoor')) return 'forest';

        return 'forest'; // Default
    }

    /**
     * Map theme to a valid SpriteMancer preset name
     * Available presets: grass_meadow, dirt_path, stone_floor, dungeon_floor, brick_floor, snow_ground, sand_desert
     */
    private mapThemeToPreset(theme: string): string {
        const presetMap: Record<string, string> = {
            'forest': 'grass_meadow',
            'grass': 'grass_meadow',
            'meadow': 'grass_meadow',
            'dirt': 'dirt_path',
            'path': 'dirt_path',
            'stone': 'stone_floor',
            'cave': 'stone_floor',
            'dungeon': 'dungeon_floor',
            'castle': 'stone_floor',
            'brick': 'brick_floor',
            'snow': 'snow_ground',
            'ice': 'snow_ground',
            'winter': 'snow_ground',
            'sand': 'sand_desert',
            'desert': 'sand_desert',
            'beach': 'sand_desert'
        };
        return presetMap[theme.toLowerCase()] || 'grass_meadow';
    }

    /**
     * Map theme to a valid terrain_type for the backend
     * Available terrain types: grass, dirt, stone, brick, sand, snow, wood, cave, dungeon, castle
     */
    private mapThemeToTerrainType(theme: string): string {
        const terrainMap: Record<string, string> = {
            'forest': 'grass',
            'grass': 'grass',
            'meadow': 'grass',
            'dirt': 'dirt',
            'path': 'dirt',
            'stone': 'stone',
            'cave': 'cave',
            'dungeon': 'dungeon',
            'castle': 'castle',
            'brick': 'brick',
            'snow': 'snow',
            'ice': 'snow',
            'winter': 'snow',
            'sand': 'sand',
            'desert': 'sand',
            'beach': 'sand',
            'wood': 'wood'
        };
        return terrainMap[theme.toLowerCase()] || 'grass';
    }

    /**
     * Map theme to a valid platform material for the backend
     * Available materials: grass, stone, wood, metal, ice, brick, cloud
     */
    private mapThemeToMaterial(theme: string): string {
        const materialMap: Record<string, string> = {
            'forest': 'grass',
            'grass': 'grass',
            'stone': 'stone',
            'cave': 'stone',
            'dungeon': 'stone',
            'castle': 'stone',
            'brick': 'brick',
            'wood': 'wood',
            'snow': 'ice',
            'ice': 'ice',
            'metal': 'metal',
            'cloud': 'cloud'
        };
        return materialMap[theme.toLowerCase()] || 'grass';
    }

    private async handleCustomTask(task: AgentTask): Promise<AgentResult> {
        const startTime = Date.now();

        // Check if it's tileset-related
        const desc = this.getTaskContextText(task).toLowerCase();
        if (desc.includes('tileset') || desc.includes('tile') || desc.includes('level')) {
            return this.generateTileset(task);
        }

        return this.createFailureResult(task, {
            code: 'UNSUPPORTED_TASK',
            message: `Level Agent cannot handle: ${task.description}`,
            recoverable: false
        }, Date.now() - startTime);
    }

    // ============================================================================
    // BaseAgent Implementation
    // ============================================================================

    canHandle(task: AgentTask): boolean {
        if (task.type === 'generate_tileset') return true;
        if (task.assignedAgent === this.config.id) return true;

        // Check description for level-related keywords
        const desc = this.getTaskContextText(task).toLowerCase();
        return desc.includes('tileset') ||
            desc.includes('tile') ||
            desc.includes('level') ||
            desc.includes('terrain') ||
            desc.includes('platform');
    }

    private getTaskContextText(task: AgentTask): string {
        const userRequest = task.input.userRequest;
        if (typeof userRequest === 'string' && userRequest.trim().length > 0) {
            return userRequest;
        }
        return task.description;
    }

    buildSystemPrompt(): string {
        return this.buildBasePrompt() + `
## Tileset Generation Guidelines

### SpriteMancer Workflow for Tilesets
1. Generate terrain tileset via spritemancer_generate_terrain_tileset (preset or terrain_type required)
2. OR generate platforms via spritemancer_generate_platform_tiles (preset or material required)
3. Export to Godot via spritemancer_export_tileset_resource
4. Add TileMapLayer node to scene via add_node
5. Assign tileset via set_property(tile_set = "path/to/tileset.tres")

### Tool Parameter Reference
**spritemancer_generate_terrain_tileset**:
- preset: grass_meadow, dirt_path, stone_floor, dungeon_floor, snow_ground, sand_desert
- terrain_type: grass, dirt, stone, sand, snow, cave, dungeon, castle
- tile_size: 16, 32, 64 (default: 32)

**spritemancer_generate_platform_tiles**:
- preset: grass_platform, stone_platform, wooden_platform
- material: grass, stone, wood, metal, ice, brick, cloud
- tile_size: 16, 32, 64 (default: 32)

### Common Tileset Components
- Ground/floor tiles (terrain tileset)
- Wall tiles (wall tileset)
- Platform tiles (platform tiles)
- Decoration tiles
- Animated tiles (water, lava, etc.)

### Tile Size Standards
- 16x16: Classic pixel art
- 32x32: Detailed pixel art (default)
- 64x64: High-res pixel art

### Collision Best Practices
- Use include_physics: true for automatic collision shapes
- Collision is configured IN the TileSet, not TileMapLayer
- Mark solid tiles with collision shapes
- Consider one-way platforms for platformers

### Output Structure
Tilesets are saved to: res://sprites/tilesets/<type>/
- <name>_tileset.tres (TileSet resource)
- <name>.png (tileset image)
`;
    }

    protected async verifyTaskSpecific(
        task: AgentTask,
        result: AgentResult
    ): Promise<string[]> {
        const issues: string[] = [];

        if (task.type === 'generate_tileset') {
            const tilesetPath = result.output.tilesetPath as string;
            if (!tilesetPath) {
                issues.push('No tileset path returned');
            }
        }

        return issues;
    }
}
