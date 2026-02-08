/**
 * Agentic Tool Handler - Tools for AI agent task management
 * Extracted from aiRouter.ts handleAgenticTool method
 */

import * as fs from "fs/promises";
import { SpriteMancerClient } from "../spritemancerClient.js";
import { SpriteMancerPipeline, SpriteSheetMeta } from "../agentic/spritemancerPipeline.js";

export interface AgenticContext {
    sendToGodot: (method: string, params: Record<string, unknown>) => Promise<unknown>;
    spritemancer: SpriteMancerClient;
}

export class AgenticToolHandler {
    constructor(private ctx: AgenticContext) { }

    /**
     * Route agentic tool to appropriate handler
     */
    async handle(method: string, params: Record<string, unknown>): Promise<unknown> {
        console.log(`[AgenticTool] Handling: ${method}`);

        switch (method) {
            case "set_task_plan":
            case "start_plan":
                return this.setTaskPlan(params);

            case "update_plan":
                return this.updatePlan(params);

            case "add_diff_entry":
                return this.addDiffEntry(params);

            case "capture_viewport":
                return this.captureViewport(params);

            case "see_viewport":
                return this.seeViewport(params);

            case "get_runtime_state":
                return this.getRuntimeState(params);

            case "request_user_feedback":
                return this.requestUserFeedback(params);

            case "create_animated_sprite":
                return this.createAnimatedSprite(params);

            case "get_godot_help":
                return this.getGodotHelp(params);

            // Phase 3: Compound tool for bridging SpriteMancer → Scene creation
            case "setup_player_with_sprites":
                return this.setupPlayerWithSprites(params);

            // Phase 4: Compound tool for TileMap with physics
            case "setup_tilemap_with_physics":
                return this.setupTilemapWithPhysics(params);

            default:
                return { success: false, error: `Unknown agentic tool: ${method}` };
        }
    }

    // ============================================
    // Individual Tool Handlers
    // ============================================

    private async setTaskPlan(params: Record<string, unknown>): Promise<unknown> {
        return await this.ctx.sendToGodot("set_current_plan", {
            name: params.name,
            steps: params.steps
        });
    }

    private async updatePlan(params: Record<string, unknown>): Promise<unknown> {
        return await this.ctx.sendToGodot("update_plan", {
            step_index: params.step_index,
            status: params.status,
            explanation: params.explanation
        });
    }

    private async addDiffEntry(params: Record<string, unknown>): Promise<unknown> {
        console.log(`[AgenticTool] Diff entry: ${params.file} [${params.status}]`);
        return await this.ctx.sendToGodot("add_diff_entry", {
            file: params.file,
            status: params.status
        });
    }

    private async captureViewport(params: Record<string, unknown>): Promise<unknown> {
        return await this.ctx.sendToGodot("capture_viewport", {
            save_path: params.save_path,
            viewport: params.viewport || "editor"
        });
    }

    private async seeViewport(params: Record<string, unknown>): Promise<unknown> {
        // Capture viewport as base64 for AI vision analysis
        const viewport = (params.viewport as string) || "editor";
        console.log(`[AgenticTool] 👁️ AI vision: capturing ${viewport} viewport`);

        const result = await this.ctx.sendToGodot("capture_viewport", {
            save_path: "base64",
            viewport
        }) as Record<string, unknown>;

        if (result.success && result.image_base64) {
            console.log(`[AgenticTool] 👁️ Captured ${result.width}x${result.height} image`);
            return {
                success: true,
                viewport,
                image_base64: result.image_base64,
                width: result.width,
                height: result.height,
                description: `Captured ${viewport} viewport (${result.width}x${result.height}). Use this image to analyze the scene.`
            };
        } else {
            return {
                success: false,
                viewport,
                error: result.error || "Failed to capture viewport",
                description: "Could not capture viewport. The AI cannot see the current scene."
            };
        }
    }

    private async getRuntimeState(params: Record<string, unknown>): Promise<unknown> {
        return await this.ctx.sendToGodot("get_runtime_state", {
            node_path: params.node_path,
            properties: params.properties
        });
    }

    private async requestUserFeedback(params: Record<string, unknown>): Promise<unknown> {
        console.log(`[AgenticTool] User feedback requested: ${params.message}`);
        return {
            success: true,
            message: params.message,
            note: "User should test the game and provide feedback"
        };
    }

    private async createAnimatedSprite(params: Record<string, unknown>): Promise<unknown> {
        const projectId = params.project_id as string;
        const nodeName = (params.node_name as string) || "AnimatedSprite2D";
        const parentNode = (params.parent_node as string) || ".";

        if (!projectId) {
            return { success: false, error: "project_id is required" };
        }

        console.log(`[AgenticTool] Creating AnimatedSprite via pipeline: ${projectId}`);

        const pipeline = new SpriteMancerPipeline((step, percent) => {
            console.log(`[Pipeline] ${step} (${percent}%)`);
        });

        // Fetch sprite metadata from SpriteMancer
        const fetchSprites = async (id: string): Promise<SpriteSheetMeta> => {
            const projectData = await this.ctx.spritemancer.getProject(id) as unknown as Record<string, unknown>;
            const sheets = (projectData.sheets as { url: string }[] | undefined) || [];
            return {
                imagePath: sheets[0]?.url || `res://sprites/${id}/spritesheet.png`,
                frameWidth: (projectData.frame_width as number) || 32,
                frameHeight: (projectData.frame_height as number) || 32,
                columns: (projectData.columns as number) || 4,
                rows: (projectData.rows as number) || 1,
                animations: [{ name: 'idle', frameCount: 4, fps: 12, loop: true }]
            };
        };

        // Execute Godot commands via bridge
        const executeGodot = async (name: string, p: Record<string, unknown>) => {
            return await this.ctx.sendToGodot(name, p);
        };

        // Convert string[] animations to proper format
        const animationDefs = Array.isArray(params.animations)
            ? (params.animations as { name: string; fps?: number; loop?: boolean }[]).map(a =>
                typeof a === 'string'
                    ? { name: a, fps: 12, loop: true }
                    : { name: a.name, fps: a.fps || 12, loop: a.loop !== false }
            )
            : [{ name: 'idle', fps: 12, loop: true }];

        const result = await pipeline.execute(
            {
                project_id: projectId,
                node_name: nodeName,
                parent_node: parentNode,
                animations: animationDefs
            },
            fetchSprites,
            executeGodot
        );

        return result;
    }

    private async getGodotHelp(params: Record<string, unknown>): Promise<unknown> {
        // Query recipes first, then fall back to Godot reference JSON
        const topic = (params.topic as string || "").toLowerCase();
        console.log(`[AgenticTool] 📚 Looking up Godot help: ${topic}`);

        // Import recipe finder dynamically
        const { findRecipes } = await import('../prompts/recipes/index.js');

        // 1. Check game development recipes first
        const recipes = findRecipes(topic);
        if (recipes.length > 0) {
            const topRecipe = recipes[0];
            console.log(`[AgenticTool] 📖 Found recipe: ${topRecipe.name}`);
            return {
                success: true,
                topic,
                source: "game_development_recipes",
                recipe_name: topRecipe.name,
                reference: topRecipe.content,
                additional_recipes: recipes.slice(1, 3).map(r => r.name)
            };
        }

        // 2. Fall back to structured Godot reference JSON
        try {
            const docsPath = new URL('../docs/godot_reference.json', import.meta.url).pathname;
            const referenceContent = await fs.readFile(docsPath, 'utf-8');
            const reference = JSON.parse(referenceContent);

            // Search for matching topics
            const results: { topic: string; data: unknown }[] = [];

            for (const [key, value] of Object.entries(reference.topics)) {
                const keyLower = key.toLowerCase();
                const valueStr = JSON.stringify(value).toLowerCase();

                if (keyLower.includes(topic) || topic.includes(keyLower) || valueStr.includes(topic)) {
                    results.push({ topic: key, data: value });
                }
            }

            if (results.length > 0) {
                const formatted = results.slice(0, 2).map(r => {
                    const data = r.data as Record<string, unknown>;
                    let output = `## ${r.topic}\n`;
                    if (data.description) output += `${data.description}\n\n`;
                    if (data.properties) output += `**Properties:** ${Object.keys(data.properties as object).join(', ')}\n`;
                    if (data.methods) output += `**Methods:** ${Object.keys(data.methods as object).join(', ')}\n`;
                    if (data.signals) output += `**Signals:** ${Object.keys(data.signals as object).join(', ')}\n`;
                    if (data.code_example) output += `\n**Example:**\n\`\`\`gdscript\n${data.code_example}\n\`\`\``;
                    return output;
                }).join('\n\n---\n\n');

                return {
                    success: true,
                    topic,
                    source: "godot_reference.json",
                    reference: formatted,
                    matches_found: results.length,
                    available_topics: Object.keys(reference.topics)
                };
            }

            return {
                success: true,
                topic,
                source: "godot_reference.json",
                reference: `No reference found for "${topic}".`,
                matches_found: 0,
                available_topics: Object.keys(reference.topics)
            };
        } catch (err) {
            console.error(`[AgenticTool] ❌ Failed to read godot_reference.json:`, err);
            return {
                success: false,
                topic,
                error: `Could not load reference: ${err}`
            };
        }
    }

    /**
     * Phase 3: Compound tool that bridges SpriteMancer output to scene creation
     * Creates a complete player scene with:
     * - CharacterBody2D root
     * - CollisionShape2D with rectangle shape
     * - AnimatedSprite2D with assigned SpriteFrames
     * - Attached movement script
     */
    private async setupPlayerWithSprites(params: Record<string, unknown>): Promise<unknown> {
        const spriteFramesPath = params.sprite_frames_path as string;
        const playerName = (params.player_name as string) || "Player";
        const scenePath = (params.scene_path as string) || `res://scenes/${playerName}.tscn`;
        const scriptPath = (params.script_path as string) || `res://scripts/${playerName.toLowerCase()}.gd`;

        const toNumber = (value: unknown): number | undefined => {
            if (typeof value === "number" && Number.isFinite(value)) return value;
            if (typeof value === "string") {
                const parsed = Number(value);
                if (Number.isFinite(parsed)) return parsed;
            }
            return undefined;
        };

        const collisionWidthOverride = toNumber(params.collision_width);
        const collisionHeightOverride = toNumber(params.collision_height);

        if (!spriteFramesPath) {
            return {
                success: false,
                error: "sprite_frames_path is required. Get this from spritemancer_approve_animation response.",
                hint: "After approving an animation with spritemancer_approve_animation, use the returned sprite_frames_path."
            };
        }

        console.log(`[AgenticTool] 🎮 Setting up player scene: ${scenePath}`);
        console.log(`[AgenticTool]   📁 SpriteFrames: ${spriteFramesPath}`);

        const steps: { step: string; success: boolean; error?: string }[] = [];

        try {
            // Step 1: Create the player scene
            console.log(`[AgenticTool] Step 1: Creating scene ${scenePath}...`);
            const createResult = await this.ctx.sendToGodot("create_scene", {
                path: scenePath,
                root_type: "CharacterBody2D"
            }) as { success?: boolean; error?: string };

            steps.push({ step: "create_scene", success: !!createResult?.success, error: createResult?.error });
            if (!createResult?.success) {
                return { success: false, error: `Failed to create scene: ${createResult?.error}`, steps };
            }

            // Step 2: Open the scene
            console.log(`[AgenticTool] Step 2: Opening scene...`);
            const openResult = await this.ctx.sendToGodot("open_scene", {
                path: scenePath
            }) as { success?: boolean; error?: string };

            steps.push({ step: "open_scene", success: !!openResult?.success, error: openResult?.error });
            if (!openResult?.success) {
                return { success: false, error: `Failed to open scene: ${openResult?.error}`, steps };
            }

            // Step 3: Add CollisionShape2D
            console.log(`[AgenticTool] Step 3: Adding CollisionShape2D...`);
            const collisionResult = await this.ctx.sendToGodot("add_node", {
                parent: ".",
                type: "CollisionShape2D",
                name: "CollisionShape2D"
            }) as { success?: boolean; error?: string };

            steps.push({ step: "add_collision_node", success: !!collisionResult?.success, error: collisionResult?.error });

            // Step 4: Add AnimatedSprite2D
            console.log(`[AgenticTool] Step 4: Adding AnimatedSprite2D...`);
            const spriteResult = await this.ctx.sendToGodot("add_node", {
                parent: ".",
                type: "AnimatedSprite2D",
                name: "AnimatedSprite2D"
            }) as { success?: boolean; error?: string };

            steps.push({ step: "add_sprite_node", success: !!spriteResult?.success, error: spriteResult?.error });

            // Step 5: Assign SpriteFrames resource
            if (spriteResult?.success) {
                console.log(`[AgenticTool] Step 5: Assigning SpriteFrames...`);
                const assignResult = await this.ctx.sendToGodot("set_property", {
                    node: "AnimatedSprite2D",
                    property: "sprite_frames",
                    value: spriteFramesPath
                }) as { success?: boolean; error?: string };

                steps.push({ step: "assign_sprite_frames", success: !!assignResult?.success, error: assignResult?.error });

                // Step 6: Get sprite dimensions and compute collision
                if (assignResult?.success && collisionResult?.success) {
                    console.log(`[AgenticTool] Step 6: Getting sprite dimensions...`);
                    const dimensionsResult = await this.ctx.sendToGodot("get_sprite_dimensions", {
                        node: "AnimatedSprite2D"
                    }) as { success?: boolean; frame_width?: number; frame_height?: number; error?: string };

                    steps.push({
                        step: "get_sprite_dimensions",
                        success: !!dimensionsResult?.success,
                        error: dimensionsResult?.error
                    });

                    const frameWidth = toNumber(dimensionsResult?.frame_width);
                    const frameHeight = toNumber(dimensionsResult?.frame_height);

                    const collisionWidth = collisionWidthOverride ?? (frameWidth !== undefined ? frameWidth * 0.35 : undefined);
                    const collisionHeight = collisionHeightOverride ?? (frameHeight !== undefined ? frameHeight * 0.85 : undefined);

                    if (frameHeight !== undefined) {
                        const spriteOffsetY = -(frameHeight / 2);
                        console.log(`[AgenticTool] Step 7: Setting sprite offset...`);
                        const offsetResult = await this.ctx.sendToGodot("set_property", {
                            node: "AnimatedSprite2D",
                            property: "offset",
                            value: `Vector2(0, ${spriteOffsetY})`
                        }) as { success?: boolean; error?: string };

                        steps.push({ step: "set_sprite_offset", success: !!offsetResult?.success, error: offsetResult?.error });
                    }

                    if (collisionWidth === undefined || collisionHeight === undefined) {
                        steps.push({
                            step: "compute_collision_size",
                            success: false,
                            error: "Could not compute collision size. Ensure sprite dimensions are available or pass collision_width/collision_height."
                        });
                    } else {
                        console.log(`[AgenticTool] Step 8: Configuring collision shape...`);
                        const shapeResult = await this.ctx.sendToGodot("set_collision_shape", {
                            node: "CollisionShape2D",
                            shape_type: "rectangle",
                            width: collisionWidth,
                            height: collisionHeight
                        }) as { success?: boolean; error?: string };

                        steps.push({ step: "set_collision_shape", success: !!shapeResult?.success, error: shapeResult?.error });

                        if (shapeResult?.success) {
                            const collisionY = -(collisionHeight / 2);
                            console.log(`[AgenticTool] Step 9: Positioning collision shape...`);
                            const positionResult = await this.ctx.sendToGodot("set_property", {
                                node: "CollisionShape2D",
                                property: "position",
                                value: `Vector2(0, ${collisionY})`
                            }) as { success?: boolean; error?: string };

                            steps.push({ step: "set_collision_position", success: !!positionResult?.success, error: positionResult?.error });
                        }
                    }
                }
            }

            // Step 10: Create movement script
            console.log(`[AgenticTool] Step 10: Creating movement script...`);
            const scriptContent = `extends CharacterBody2D

@export var speed: float = 300.0
@export var jump_velocity: float = -500.0

var gravity: float = ProjectSettings.get_setting("physics/2d/default_gravity")
@onready var sprite: AnimatedSprite2D = $AnimatedSprite2D

func _physics_process(delta: float) -> void:
    # Apply gravity
    if not is_on_floor():
        velocity.y += gravity * delta
    
    # Handle jump
    if Input.is_action_just_pressed("jump") and is_on_floor():
        velocity.y = jump_velocity
    
    # Get horizontal input
    var direction := Input.get_axis("move_left", "move_right")
    velocity.x = direction * speed
    
    # Handle animations
    if sprite.sprite_frames:
        if direction != 0:
            sprite.flip_h = direction < 0
            if sprite.sprite_frames.has_animation("walk"):
                sprite.play("walk")
            elif sprite.sprite_frames.has_animation("idle"):
                sprite.play("idle")
        else:
            if sprite.sprite_frames.has_animation("idle"):
                sprite.play("idle")
    
    move_and_slide()
`;

            const scriptResult = await this.ctx.sendToGodot("create_script", {
                path: scriptPath,
                content: scriptContent
            }) as { success?: boolean; error?: string };

            steps.push({ step: "create_script", success: !!scriptResult?.success, error: scriptResult?.error });

            // Step 11: Attach script to player
            if (scriptResult?.success) {
                console.log(`[AgenticTool] Step 11: Attaching script...`);
                const attachResult = await this.ctx.sendToGodot("attach_script", {
                    node: ".",
                    script_path: scriptPath
                }) as { success?: boolean; error?: string };

                steps.push({ step: "attach_script", success: !!attachResult?.success, error: attachResult?.error });
            }

            // Step 12: Save the scene
            console.log(`[AgenticTool] Step 12: Saving scene...`);
            const saveResult = await this.ctx.sendToGodot("save_scene", {}) as { success?: boolean; error?: string };
            steps.push({ step: "save_scene", success: !!saveResult?.success, error: saveResult?.error });

            // Calculate success
            const successCount = steps.filter(s => s.success).length;
            const totalSteps = steps.length;
            const allSuccess = successCount === totalSteps;

            console.log(`[AgenticTool] ✅ Player setup complete: ${successCount}/${totalSteps} steps succeeded`);

            return {
                success: allSuccess,
                player_name: playerName,
                scene_path: scenePath,
                script_path: scriptPath,
                sprite_frames_path: spriteFramesPath,
                steps,
                steps_completed: `${successCount}/${totalSteps}`,
                message: allSuccess
                    ? `✅ Player scene created successfully at ${scenePath}! Script: ${scriptPath}`
                    : `⚠️ Player scene partially created (${successCount}/${totalSteps} steps). Check steps for errors.`,

                next_action: {
                    description: "Now create a Level scene and add this player to it",
                    tool: "create_scene",
                    suggested_params: {
                        path: "res://scenes/Level.tscn",
                        root_type: "Node2D"
                    },
                    then: `After creating level, use scene_instantiate(scene_path="${scenePath}", parent=".") to add player`
                }
            };

        } catch (error) {
            console.error(`[AgenticTool] ❌ Player setup failed:`, error);
            return {
                success: false,
                error: String(error),
                steps,
                hint: "Check each step's result and fix the failing step manually."
            };
        }
    }

    /**
     * Phase 4: Compound tool for TileMap with physics setup
     * Creates a TileMapLayer with TileSet and physics configuration
     */
    private async setupTilemapWithPhysics(params: Record<string, unknown>): Promise<unknown> {
        const tilesetPath = params.tileset_path as string;
        const tileSize = (params.tile_size as number) || 32;
        const layerName = (params.layer_name as string) || "TileMapLayer";
        const parentNode = (params.parent_node as string) || ".";
        const includePhysics = params.include_physics !== false; // default true
        const collisionLayer = (params.collision_layer as number) || 1;
        const collisionMask = (params.collision_mask as number) || 1;

        if (!tilesetPath) {
            return {
                success: false,
                error: "tileset_path is required. Provide path to PNG tileset image or .tres resource.",
                hint: "Use spritemancer_generate_and_export_terrain to generate a tileset first."
            };
        }

        console.log(`[AgenticTool] 🗺️ Setting up TileMapLayer: ${layerName}`);
        console.log(`[AgenticTool]   📁 TileSet: ${tilesetPath}`);
        console.log(`[AgenticTool]   📏 Tile size: ${tileSize}x${tileSize}`);
        console.log(`[AgenticTool]   ⚡ Physics: ${includePhysics}`);

        const steps: { step: string; success: boolean; error?: string }[] = [];

        try {
            // Step 1: Add TileMapLayer node
            console.log(`[AgenticTool] Step 1: Adding TileMapLayer node...`);
            const addNodeResult = await this.ctx.sendToGodot("add_node", {
                parent: parentNode,
                type: "TileMapLayer",
                name: layerName
            }) as { success?: boolean; error?: string };

            steps.push({ step: "add_tilemap_node", success: !!addNodeResult?.success, error: addNodeResult?.error });
            if (!addNodeResult?.success) {
                return { success: false, error: `Failed to add TileMapLayer: ${addNodeResult?.error}`, steps };
            }

            // Step 2: Check if tileset is a .tres resource or an image
            const isTresResource = tilesetPath.endsWith('.tres');
            let tilesetResourcePath = tilesetPath;

            if (!isTresResource) {
                // Need to create TileSet resource from image
                console.log(`[AgenticTool] Step 2: Creating TileSet resource from image...`);

                // Generate .tres path from image path
                const baseName = tilesetPath.replace(/\.[^.]+$/, '').split('/').pop() || 'tileset';
                tilesetResourcePath = `res://tilesets/${baseName}.tres`;

                // Create TileSet resource with the image as atlas source
                const createTilesetResult = await this.ctx.sendToGodot("create_tileset_from_image", {
                    image_path: tilesetPath,
                    output_path: tilesetResourcePath,
                    tile_size: tileSize,
                    include_physics: includePhysics,
                    collision_layer: collisionLayer,
                    collision_mask: collisionMask
                }) as { success?: boolean; error?: string; tileset_path?: string };

                steps.push({ step: "create_tileset_resource", success: !!createTilesetResult?.success, error: createTilesetResult?.error });

                if (createTilesetResult?.success && createTilesetResult.tileset_path) {
                    tilesetResourcePath = createTilesetResult.tileset_path;
                } else if (!createTilesetResult?.success) {
                    // Fallback: Try to assign the image directly
                    console.log(`[AgenticTool] Fallback: Assigning image path directly...`);
                    tilesetResourcePath = tilesetPath;
                }
            } else {
                steps.push({ step: "tileset_already_tres", success: true });
            }

            // Step 3: Assign TileSet to TileMapLayer
            console.log(`[AgenticTool] Step 3: Assigning TileSet to TileMapLayer...`);
            const assignResult = await this.ctx.sendToGodot("set_property", {
                node: layerName,
                property: "tile_set",
                value: tilesetResourcePath
            }) as { success?: boolean; error?: string };

            steps.push({ step: "assign_tileset", success: !!assignResult?.success, error: assignResult?.error });

            // Calculate success
            const successCount = steps.filter(s => s.success).length;
            const totalSteps = steps.length;
            const criticalSteps = ['add_tilemap_node', 'assign_tileset'];
            const criticalSuccess = steps
                .filter(s => criticalSteps.includes(s.step))
                .every(s => s.success);

            console.log(`[AgenticTool] ✅ TileMap setup complete: ${successCount}/${totalSteps} steps`);

            return {
                success: criticalSuccess,
                layer_name: layerName,
                tileset_path: tilesetResourcePath,
                tile_size: tileSize,
                physics_enabled: includePhysics,
                steps,
                message: criticalSuccess
                    ? `✅ TileMapLayer "${layerName}" created with TileSet`
                    : `⚠️ TileMapLayer partially configured. Check steps for errors.`,
                next_actions: [
                    { tool: "map_set_cells_batch", description: "Place tiles" },
                    { tool: "map_fill_rect", description: "Fill area with tiles" }
                ]
            };

        } catch (error) {
            console.error(`[AgenticTool] ❌ TileMap setup failed:`, error);
            return {
                success: false,
                error: String(error),
                steps,
                hint: "Check each step's result and fix the failing step manually."
            };
        }
    }
}
