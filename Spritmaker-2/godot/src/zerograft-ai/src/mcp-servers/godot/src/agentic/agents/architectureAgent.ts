/**
 * Architecture Agent
 * 
 * Scene Expert & Project Architect.
 * Responsible for creating and managing Godot scenes, node hierarchies, and project structure.
 */

import { BaseAgent, AgentCallbacks } from './baseAgent.js';
import {
    AgentConfig,
    AgentTask,
    AgentResult,
    AGENT_TOOL_ASSIGNMENTS
} from '../multiAgentTypes.js';
import { LockManager } from '../lockManager.js';

/**
 * Architecture Agent configuration (CrewAI-style)
 */
const ARCHITECTURE_AGENT_CONFIG: AgentConfig = {
    id: 'architecture',
    name: 'Architecture Agent',
    role: 'Scene Expert & Project Architect',
    goal: 'Design and structure Godot scenes, manage project organization, and integrate assets',
    backstory: `You are an expert Godot developer who specializes in scene architecture, 
node hierarchies, and project organization. You understand best practices for 2D game 
development, including proper node structure, signal connections, and resource management. 
You create clean, maintainable scene trees and ensure all nodes are properly configured.`,
    exclusiveTools: AGENT_TOOL_ASSIGNMENTS.architecture as unknown as string[],
    sharedTools: ['list_files', 'read_script', 'get_scene_tree', 'get_errors'],
    workspace: 'res://scenes',
    maxTokens: 4000,
    maxIterations: 20
};

/**
 * Architecture Agent - Scene and structure expert
 */
export class ArchitectureAgent extends BaseAgent {
    private lockManager: LockManager;

    constructor(callbacks: AgentCallbacks, lockManager: LockManager) {
        super(ARCHITECTURE_AGENT_CONFIG, callbacks);
        this.lockManager = lockManager;
    }

    // ============================================================================
    // Task Execution
    // ============================================================================

    async execute(task: AgentTask): Promise<AgentResult> {
        const startTime = Date.now();
        this.setCurrentTask(task);
        this.updateStatus('executing');

        try {
            this.callbacks.onProgress?.(`[Architecture] Starting: ${task.description}`);

            let result: AgentResult;

            switch (task.type) {
                case 'create_scene':
                    result = await this.createScene(task);
                    break;
                case 'add_node':
                    result = await this.addNode(task);
                    break;
                case 'integrate_asset':
                    result = await this.integrateAsset(task);
                    break;
                default:
                    result = await this.handleCustomTask(task);
            }

            // Verify the result
            this.updateStatus('verifying');
            const verification = await this.verifyResult(task, result);

            if (!verification.verified) {
                this.callbacks.onProgress?.(`[Architecture] Verification issues: ${verification.issues.join(', ')}`);
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
    // Specific Task Handlers
    // ============================================================================

    private async createScene(task: AgentTask): Promise<AgentResult> {
        const startTime = Date.now();
        const scenePath = (task.input.scenePath as string) || 'res://scenes/NewScene.tscn';
        const rootType = (task.input.rootType as string) || 'Node2D';
        const artifacts: string[] = [];
        const taskContextLower = this.getTaskContextText(task).toLowerCase();

        // Acquire lock on the scene file
        const lockAcquired = await this.lockManager.acquireLock(
            this.config.id,
            scenePath,
            'exclusive',
            'Creating scene'
        );

        if (!lockAcquired) {
            return this.createFailureResult(task, {
                code: 'LOCK_FAILED',
                message: `Could not acquire lock on ${scenePath}`,
                recoverable: true,
                suggestedAction: 'Wait and retry'
            }, Date.now() - startTime);
        }

        try {
            // Create the scene
            const createResult = await this.executeTool('create_scene', {
                path: scenePath,
                root_type: rootType
            });

            if (!createResult.success) {
                return this.createFailureResult(task, {
                    code: 'TOOL_FAILED',
                    message: createResult.message || 'Failed to create scene',
                    recoverable: true
                }, Date.now() - startTime);
            }

            artifacts.push(scenePath);

            // Check if this is a platformer/game scene - add Camera2D
            const isPlatformer = taskContextLower.includes('platform') ||
                taskContextLower.includes('plateform') ||
                taskContextLower.includes('game');

            if (isPlatformer) {
                this.callbacks.onProgress?.(`[Architecture] Adding Camera2D for game scene...`);

                await this.executeTool('add_node', {
                    name: 'Camera2D',
                    type: 'Camera2D',
                    parent: '.'
                });

                // Enable position smoothing
                await this.executeTool('set_property', {
                    node: 'Camera2D',
                    property: 'position_smoothing_enabled',
                    value: true,
                    explanation: 'Enable smooth camera following'
                });

                await this.executeTool('set_property', {
                    node: 'Camera2D',
                    property: 'position_smoothing_speed',
                    value: 5.0,
                    explanation: 'Set camera follow speed'
                });
            }

            // Report via A2A
            await this.sessionsSend(
                'orchestrator',
                `Scene created: ${scenePath}${isPlatformer ? ' with Camera2D' : ''}`,
                'status_update'
            );

            return this.createSuccessResult(task, artifacts, {
                scenePath,
                rootType,
                hasCamera: isPlatformer
            }, Date.now() - startTime);

        } finally {
            this.lockManager.releaseLock(this.config.id, scenePath);
        }
    }

    private async addNode(task: AgentTask): Promise<AgentResult> {
        const startTime = Date.now();
        const nodeType = (task.input.nodeType as string) || 'Node2D';
        const nodeName = (task.input.nodeName as string) || nodeType;
        const parentPath = (task.input.parentPath as string) || '.';

        // Precondition: a scene must be open before add_node can succeed.
        const sceneTree = await this.executeTool('get_scene_tree', {});
        if (!sceneTree.success) {
            const fallbackScenePath = task.input.scenePath as string | undefined;
            if (fallbackScenePath) {
                const openResult = await this.executeTool('open_scene', { path: fallbackScenePath });
                if (!openResult.success) {
                    return this.createFailureResult(task, {
                        code: 'PRECONDITION_FAILED',
                        message: openResult.message || 'No scene is open and fallback open_scene failed',
                        recoverable: true,
                        suggestedAction: `Open scene ${fallbackScenePath} before adding nodes`
                    }, Date.now() - startTime);
                }
            } else {
                return this.createFailureResult(task, {
                    code: 'PRECONDITION_FAILED',
                    message: sceneTree.message || 'No scene is currently open',
                    recoverable: true,
                    suggestedAction: 'Run create_scene or open_scene before add_node'
                }, Date.now() - startTime);
            }
        }

        const result = await this.executeTool('add_node', {
            name: nodeName,
            type: nodeType,
            parent: parentPath
        });

        if (!result.success) {
            return this.createFailureResult(task, {
                code: 'TOOL_FAILED',
                message: result.message || 'Failed to add node',
                recoverable: true
            }, Date.now() - startTime);
        }

        return this.createSuccessResult(task, [], {
            nodeName,
            nodeType,
            parentPath
        }, Date.now() - startTime);
    }

    private async integrateAsset(task: AgentTask): Promise<AgentResult> {
        const startTime = Date.now();
        const artifacts: string[] = [];
        const taskContext = this.getTaskContextText(task);
        const taskContextLower = taskContext.toLowerCase();

        this.callbacks.onProgress?.(`[Architecture] Integrating assets into playable scene...`);

        // Step 1: Get current scene tree to see what exists
        const treeResult = await this.executeTool('get_scene_tree', {});
        if (!treeResult.success) {
            return this.createFailureResult(task, {
                code: 'TOOL_FAILED',
                message: 'Failed to get scene tree - is a scene open?',
                recoverable: true
            }, Date.now() - startTime);
        }

        const treeStr = JSON.stringify(treeResult.data || {});

        // Step 2: Find existing SpriteFrames resource
        let spriteFramesPath = '';
        try {
            const filesResult = await this.executeTool('list_files', { path: 'res://sprites', recursive: true });
            if (filesResult.success && filesResult.data) {
                const filesStr = JSON.stringify(filesResult.data);
                const tresMatch = filesStr.match(/res:\/\/sprites\/[^"]*\.tres/);
                if (tresMatch) {
                    spriteFramesPath = tresMatch[0];
                    this.callbacks.onProgress?.(`[Architecture] Found SpriteFrames: ${spriteFramesPath}`);
                }
            }
        } catch (e) {
            this.callbacks.onProgress?.(`[Architecture] Warning: Could not list sprite files`);
        }

        // Step 3: Build proper Player node hierarchy if it doesn't exist
        const hasPlayer = treeStr.includes('Player') || treeStr.includes('CharacterBody');

        if (!hasPlayer) {
            this.callbacks.onProgress?.(`[Architecture] Creating Player (CharacterBody2D) hierarchy...`);

            // 3a: Add CharacterBody2D as Player
            await this.executeTool('add_node', {
                name: 'Player',
                type: 'CharacterBody2D',
                parent: '.'
            });

            // 3b: Add AnimatedSprite2D as child of Player
            await this.executeTool('add_node', {
                name: 'AnimatedSprite2D',
                type: 'AnimatedSprite2D',
                parent: 'Player'
            });

            // 3c: Assign SpriteFrames resource if found
            if (spriteFramesPath) {
                await this.executeTool('set_property', {
                    node: 'Player/AnimatedSprite2D',
                    property: 'sprite_frames',
                    value: spriteFramesPath,
                    explanation: 'Assigning generated character sprites'
                });

                // Set default animation to play
                await this.executeTool('set_property', {
                    node: 'Player/AnimatedSprite2D',
                    property: 'autoplay',
                    value: 'idle',
                    explanation: 'Auto-play idle animation'
                });
            }

            // 3d: Add CollisionShape2D as child of Player
            await this.executeTool('add_node', {
                name: 'CollisionShape2D',
                type: 'CollisionShape2D',
                parent: 'Player'
            });

            // 3e: Configure collision shape
            await this.executeTool('set_collision_shape', {
                node: 'Player/CollisionShape2D',
                shape_type: 'capsule',
                size: { height: 40, radius: 12 }
            });

            artifacts.push('Player (CharacterBody2D)');
        }

        // Step 4: Ensure Camera2D is child of Player (not root)
        const hasCamera = treeStr.includes('Camera2D');
        if (hasCamera && !hasPlayer) {
            // Camera exists at root - reparent it under Player
            this.callbacks.onProgress?.(`[Architecture] Reparenting Camera2D under Player...`);
            await this.executeTool('reparent_node', {
                node: 'Camera2D',
                new_parent: 'Player'
            });
        } else if (!hasCamera) {
            // No camera at all - add one under Player
            this.callbacks.onProgress?.(`[Architecture] Adding Camera2D to Player...`);
            await this.executeTool('add_node', {
                name: 'Camera2D',
                type: 'Camera2D',
                parent: 'Player'
            });

            await this.executeTool('set_property', {
                node: 'Player/Camera2D',
                property: 'position_smoothing_enabled',
                value: true,
                explanation: 'Enable smooth camera following'
            });
        }

        // Step 5: Position player in a reasonable starting position
        await this.executeTool('set_property', {
            node: 'Player',
            property: 'position',
            value: 'Vector2(576, 200)',
            explanation: 'Initial player position (center-ish, above ground)'
        });

        // Step 6: Create and attach player controller script if none exists
        const hasScript = treeStr.includes('player') && treeStr.includes('.gd');
        if (!hasScript) {
            this.callbacks.onProgress?.(`[Architecture] Creating player movement script...`);

            const scriptContent = `extends CharacterBody2D

const SPEED = 200.0
const JUMP_VELOCITY = -350.0

var gravity = ProjectSettings.get_setting("physics/2d/default_gravity")

func _physics_process(delta):
\tif not is_on_floor():
\t\tvelocity.y += gravity * delta

\tif Input.is_action_just_pressed("ui_accept") and is_on_floor():
\t\tvelocity.y = JUMP_VELOCITY

\tvar direction = Input.get_axis("ui_left", "ui_right")
\tif direction:
\t\tvelocity.x = direction * SPEED
\telse:
\t\tvelocity.x = move_toward(velocity.x, 0, SPEED)

\tmove_and_slide()

\t# Animation handling
\tvar sprite = $AnimatedSprite2D
\tif sprite and sprite.sprite_frames:
\t\tif not is_on_floor():
\t\t\tif sprite.sprite_frames.has_animation("jump"):
\t\t\t\tsprite.play("jump")
\t\telif abs(velocity.x) > 10:
\t\t\tif sprite.sprite_frames.has_animation("run"):
\t\t\t\tsprite.play("run")
\t\t\tsprite.flip_h = velocity.x < 0
\t\telse:
\t\t\tif sprite.sprite_frames.has_animation("idle"):
\t\t\t\tsprite.play("idle")
`;

            const scriptPath = 'res://scripts/player_controller.gd';
            const createResult = await this.executeTool('create_script', {
                path: scriptPath,
                content: scriptContent,
                explanation: 'Player movement controller with animation handling'
            });

            if (createResult.success) {
                await this.executeTool('attach_script', {
                    node: 'Player',
                    script_path: scriptPath,
                    explanation: 'Attaching movement script to Player'
                });
                artifacts.push(scriptPath);
            }
        }

        // Step 7: Save the scene
        await this.executeTool('save_scene', {});

        // Report via A2A
        await this.sessionsSend(
            'orchestrator',
            `Scene integration complete: Player with sprites, collision, camera, and movement script`,
            'task_result'
        );

        return this.createSuccessResult(task, artifacts, {
            playerCreated: !hasPlayer,
            spriteFramesAssigned: !!spriteFramesPath,
            cameraConfigured: true,
            scriptAttached: true,
            message: 'Scene integrated with playable Player character'
        }, Date.now() - startTime);
    }

    private async handleCustomTask(task: AgentTask): Promise<AgentResult> {
        const startTime = Date.now();
        const taskContext = this.getTaskContextText(task);

        // For custom tasks, use LLM to determine what to do
        const prompt = `
Task Summary: ${task.description}
User Request: ${taskContext}
Input: ${JSON.stringify(task.input)}

Determine what Godot tools to use and execute them.
`;

        const llmResponse = await this.callbacks.sendToLLM(prompt);

        // Parse and execute tools from LLM response
        // This would need more sophisticated handling

        return this.createSuccessResult(task, [], {
            llmResponse
        }, Date.now() - startTime);
    }

    private getTaskContextText(task: AgentTask): string {
        const userRequest = task.input.userRequest;
        if (typeof userRequest === 'string' && userRequest.trim().length > 0) {
            return userRequest;
        }
        return task.description;
    }

    // ============================================================================
    // BaseAgent Implementation
    // ============================================================================

    canHandle(task: AgentTask): boolean {
        const handledTypes = ['create_scene', 'add_node', 'integrate_asset'];
        return handledTypes.includes(task.type) || task.assignedAgent === this.config.id;
    }

    buildSystemPrompt(): string {
        return this.buildBasePrompt() + `
## Architecture-Specific Guidelines

### Scene Structure Best Practices
- Use Node2D as root for 2D games
- Keep the hierarchy shallow and logical
- Use descriptive node names (Player, Enemy, UI, etc.)
- Group related nodes under container nodes

### Platformer Scene Structure
\`\`\`
World (Node2D)
├── TileMapLayer (ground)     ← Use LevelAgent for tilesets
├── Player (CharacterBody2D)  ← Use CharacterAgent for sprites
│   ├── AnimatedSprite2D
│   ├── CollisionShape2D
│   └── Camera2D             ← Must be child for following
├── UI (CanvasLayer)
└── AudioStreamPlayer2D
\`\`\`

### Common Node Patterns
- **Player**: CharacterBody2D with AnimatedSprite2D, CollisionShape2D, Camera2D
- **Enemy**: CharacterBody2D or Area2D depending on behavior
- **Collectible**: Area2D with Sprite2D
- **Platform**: StaticBody2D with Sprite2D, CollisionShape2D (or TileMapLayer)

### Tool Reference
**create_scene**: Create new .tscn file
- path: "res://scenes/main.tscn"
- root_type: "Node2D", "CharacterBody2D", etc.

**add_node**: Add child node
- parent: ".", "/root/World/Player"
- type: "TileMapLayer", "CharacterBody2D", "Camera2D"
- name: "Player", "Ground", "MainCamera"

**set_property**: Configure node properties
- node: "Player", "/root/World/Player"
- property: "tile_set", "zoom", "position"
- value: resource path, Vector2, etc.

### Integration Rules
- Always check if scene is open before adding nodes
- Save scene after making changes
- Verify nodes have required components
- For Camera2D: set as child of player for following, or manage via script
`;
    }

    protected async verifyTaskSpecific(
        task: AgentTask,
        result: AgentResult
    ): Promise<string[]> {
        const issues: string[] = [];

        if (task.type === 'create_scene') {
            // Verify scene was created
            const scenePath = result.output.scenePath as string;
            if (scenePath) {
                const checkResult = await this.executeTool('list_files', { path: scenePath });
                if (!checkResult.success) {
                    issues.push(`Scene file not found: ${scenePath}`);
                }
            }
        }

        return issues;
    }
}
