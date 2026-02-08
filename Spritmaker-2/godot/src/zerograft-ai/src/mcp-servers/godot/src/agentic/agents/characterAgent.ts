/**
 * Character Agent
 * 
 * SpriteMancer Expert & Character Artist.
 * Responsible for generating character sprites, animations, and integrating them into Godot.
 */

import { BaseAgent, AgentCallbacks } from './baseAgent.js';
import {
    AgentConfig,
    AgentTask,
    AgentResult,
    AGENT_TOOL_ASSIGNMENTS
} from '../multiAgentTypes.js';

/**
 * Character Agent configuration (CrewAI-style)
 */
const CHARACTER_AGENT_CONFIG: AgentConfig = {
    id: 'character',
    name: 'Character Agent',
    role: 'SpriteMancer Expert & Character Artist',
    goal: 'Generate character sprites, animations, and integrate them into Godot as AnimatedSprite2D nodes',
    backstory: `You are an expert pixel artist who uses SpriteMancer to create game characters. 
You understand animation cycles, sprite sheets, and how to import assets into Godot as 
AnimatedSprite2D nodes. You can create characters with multiple animations (idle, walk, run, 
attack, etc.) and ensure they are properly configured with frame timing and looping.`,
    exclusiveTools: AGENT_TOOL_ASSIGNMENTS.character as unknown as string[],
    sharedTools: ['list_files', 'read_script', 'get_scene_tree'],
    workspace: 'res://sprites/characters',
    maxTokens: 4000,
    maxIterations: 25
};

/**
 * Animation types commonly requested
 */
const ANIMATION_TYPES = ['idle', 'walk', 'run', 'jump', 'attack', 'death', 'hurt'];

/**
 * Character Agent - Character generation specialist
 */
export class CharacterAgent extends BaseAgent {
    constructor(callbacks: AgentCallbacks) {
        super(CHARACTER_AGENT_CONFIG, callbacks);
    }

    // ============================================================================
    // Task Execution
    // ============================================================================

    async execute(task: AgentTask): Promise<AgentResult> {
        const startTime = Date.now();
        this.setCurrentTask(task);
        this.updateStatus('executing');

        try {
            this.callbacks.onProgress?.(`[Character] Starting: ${task.description}`);

            let result: AgentResult;

            switch (task.type) {
                case 'generate_character':
                    result = await this.generateCharacter(task);
                    break;
                case 'create_script':
                    result = await this.createScript(task);
                    break;
                case 'attach_script':
                    result = await this.attachScript(task);
                    break;
                default:
                    result = await this.handleCustomTask(task);
            }

            // Verify the result
            this.updateStatus('verifying');
            const verification = await this.verifyResult(task, result);

            if (!verification.verified) {
                this.callbacks.onProgress?.(`[Character] Verification issues: ${verification.issues.join(', ')}`);
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
    // Character Generation
    // ============================================================================

    private async generateCharacter(task: AgentTask): Promise<AgentResult> {
        const startTime = Date.now();
        const artifacts: string[] = [];
        const taskContext = this.getTaskContextText(task);
        const taskContextLower = taskContext.toLowerCase();

        // Extract character details from task
        const characterName = (task.input.characterName as string) ||
            this.extractCharacterName(taskContext);
        const animations = (task.input.animations as string[]) ||
            this.detectRequestedAnimations(taskContext);
        const style = (task.input.style as string) || 'pixel art';

        this.callbacks.onProgress?.(`[Character] Creating ${characterName} with animations: ${animations.join(', ')}`);

        // Step 1: Create the character in SpriteMancer
        const createResult = await this.executeTool('spritemancer_create_character', {
            name: characterName,
            style: style,
            description: taskContext
        });

        if (!createResult.success) {
            return this.createFailureResult(task, {
                code: 'SPRITEMANCER_CREATE_FAILED',
                message: createResult.message || 'Failed to create character',
                recoverable: true,
                suggestedAction: 'Check SpriteMancer connection'
            }, Date.now() - startTime);
        }

        // SpriteMancer returns project_id (snake_case), not projectId (camelCase)
        const projectId = (createResult.data as any)?.project_id || (createResult.data as any)?.projectId;
        if (!projectId) {
            this.callbacks.onProgress?.(`[Character] Warning: No project_id returned from spritemancer_create_character`);
        }
        artifacts.push(`spritemancer://projects/${projectId}`);

        // Step 2: Request approval for character reference
        this.callbacks.onProgress?.(`[Character] Requesting approval for character reference...`);
        const characterApproved = await this.requestApproval(
            'character_reference',
            `Character "${characterName}" reference created. Does it look good?`
        );

        if (!characterApproved) {
            this.callbacks.onProgress?.(`[Character] Character reference not approved, stopping`);
            return this.createSuccessResult(task, artifacts, {
                characterName,
                projectId,
                status: 'awaiting_approval'
            }, Date.now() - startTime);
        }

        // Step 3: Generate animations with approval for each (with retry on rejection)
        const generatedAnimations: string[] = [];
        const MAX_RETRIES = 3;

        for (const animationType of animations) {
            let approved = false;
            let retryCount = 0;

            while (!approved && retryCount < MAX_RETRIES) {
                retryCount++;
                this.callbacks.onProgress?.(`[Character] Generating ${animationType} animation (attempt ${retryCount})...`);

                const animResult = await this.executeTool('spritemancer_generate_animations', {
                    project_id: projectId,
                    character_name: characterName,
                    animations: [animationType]
                });

                if (!animResult.success) {
                    this.callbacks.onProgress?.(`[Character] Warning: Failed to generate ${animationType}`);
                    break; // Don't retry on generation failure
                }

                // Request approval for the animation
                this.callbacks.onProgress?.(`[Character] Requesting approval for ${animationType} animation...`);
                const animApproved = await this.requestApproval(
                    `animation_${animationType}`,
                    `Animation "${animationType}" generated for ${characterName}. Does it look good?`
                );

                if (animApproved) {
                    approved = true;
                    generatedAnimations.push(animationType);

                    // Approve the animation in SpriteMancer
                    await this.executeTool('spritemancer_approve_animation', {
                        project_id: projectId,
                        character_name: characterName,
                        animation: animationType
                    });
                } else {
                    this.callbacks.onProgress?.(`[Character] Animation ${animationType} rejected, regenerating...`);
                    // Loop will continue to regenerate
                }
            }

            if (!approved) {
                this.callbacks.onProgress?.(`[Character] Animation ${animationType} not approved after ${MAX_RETRIES} attempts, skipping`);
            }
        }

        // Step 4: Create full character node structure if we have approved animations
        if (generatedAnimations.length > 0) {
            const spritePath = `res://sprites/characters/${characterName.toLowerCase()}/`;
            const scriptPath = `res://scripts/${characterName.toLowerCase()}_controller.gd`;

            // 4a: Create AnimatedSprite2D node
            this.callbacks.onProgress?.(`[Character] Creating AnimatedSprite2D node...`);
            const spriteResult = await this.executeTool('create_animated_sprite', {
                project_id: projectId,
                output_path: spritePath,
                node_name: characterName
            });

            if (spriteResult.success) {
                artifacts.push(spritePath);
            }

            // 4b: Wrap in CharacterBody2D for platformer characters
            const isPlatformer = taskContextLower.includes('platform') ||
                taskContextLower.includes('plateform');

            if (isPlatformer) {
                this.callbacks.onProgress?.(`[Character] Setting up CharacterBody2D wrapper...`);

                // Add CharacterBody2D as parent
                await this.executeTool('add_node', {
                    name: `${characterName}Body`,
                    type: 'CharacterBody2D',
                    parent: '.'
                });

                // Add CollisionShape2D
                this.callbacks.onProgress?.(`[Character] Adding CollisionShape2D...`);
                await this.executeTool('add_node', {
                    name: 'CollisionShape2D',
                    type: 'CollisionShape2D',
                    parent: `${characterName}Body`
                });

                // Configure collision shape (rectangle for platformer)
                await this.executeTool('set_property', {
                    node: `${characterName}Body/CollisionShape2D`,
                    property: 'shape',
                    value: 'RectangleShape2D',
                    explanation: 'Setting collision shape for character'
                });

                // 4c: Create player movement script
                this.callbacks.onProgress?.(`[Character] Creating player controller script...`);
                const scriptContent = this.generatePlatformerScript(characterName);

                const createScriptResult = await this.executeTool('create_script', {
                    path: scriptPath,
                    content: scriptContent,
                    explanation: 'Creating player movement controller'
                });

                if (createScriptResult.success) {
                    artifacts.push(scriptPath);

                    // Attach script to CharacterBody2D
                    await this.executeTool('attach_script', {
                        node: `${characterName}Body`,
                        script_path: scriptPath,
                        explanation: 'Attaching player controller to character'
                    });
                }
            }
        }

        // Report completion via A2A
        await this.sessionsSend(
            'orchestrator',
            `Character ${characterName} created with ${generatedAnimations.length} approved animations`,
            'task_result'
        );

        return this.createSuccessResult(task, artifacts, {
            characterName,
            projectId,
            animations: generatedAnimations,
            spritePath: generatedAnimations.length > 0 ? `res://sprites/characters/${characterName.toLowerCase()}/` : null
        }, Date.now() - startTime);
    }

    /**
     * Generate a basic platformer movement script
     */
    private generatePlatformerScript(characterName: string): string {
        return `extends CharacterBody2D

# ${characterName} Player Controller
# Auto-generated for platformer movement

const SPEED = 300.0
const JUMP_VELOCITY = -400.0

# Get the gravity from the project settings
var gravity = ProjectSettings.get_setting("physics/2d/default_gravity")

@onready var animated_sprite = $AnimatedSprite2D

func _physics_process(delta):
	# Add gravity
	if not is_on_floor():
		velocity.y += gravity * delta

	# Handle jump
	if Input.is_action_just_pressed("ui_accept") and is_on_floor():
		velocity.y = JUMP_VELOCITY
		if animated_sprite:
			animated_sprite.play("jump")

	# Get horizontal input
	var direction = Input.get_axis("ui_left", "ui_right")
	
	if direction:
		velocity.x = direction * SPEED
		if animated_sprite:
			animated_sprite.flip_h = direction < 0
			if is_on_floor():
				animated_sprite.play("run")
	else:
		velocity.x = move_toward(velocity.x, 0, SPEED)
		if animated_sprite and is_on_floor():
			animated_sprite.play("idle")

	move_and_slide()
`;
    }

    // ============================================================================
    // Helper Methods
    // ============================================================================

    private extractCharacterName(description: string): string {
        // Try to extract character name from description
        const patterns = [
            /create (?:a )?(\w+) character/i,
            /generate (?:a )?(\w+) sprite/i,
            /(\w+) with \w+ animation/i,
            /make (?:a )?(\w+)/i
        ];

        for (const pattern of patterns) {
            const match = description.match(pattern);
            if (match) {
                return match[1].charAt(0).toUpperCase() + match[1].slice(1);
            }
        }

        return 'Character';
    }

    private detectRequestedAnimations(description: string): string[] {
        const detected: string[] = [];
        const lowerDesc = description.toLowerCase();

        for (const animType of ANIMATION_TYPES) {
            if (lowerDesc.includes(animType)) {
                detected.push(animType);
            }
        }

        // For platformer games, ensure essential animations
        const platformerPatterns = ['platformer', 'platform', 'plateformer', 'plataformer'];
        const isPlatformer = platformerPatterns.some(p => lowerDesc.includes(p));

        if (isPlatformer && detected.length === 0) {
            // Platformers need at minimum: idle, run, jump
            return ['idle', 'run', 'jump'];
        }

        // Default to idle if none specified
        if (detected.length === 0) {
            detected.push('idle');
        }

        return detected;
    }

    private async handleCustomTask(task: AgentTask): Promise<AgentResult> {
        const startTime = Date.now();
        const context = this.getTaskContextText(task).toLowerCase();

        // For custom tasks, analyze and route appropriately
        if (context.includes('character') ||
            context.includes('sprite') ||
            context.includes('animation')) {
            return this.generateCharacter(task);
        }

        return this.createFailureResult(task, {
            code: 'UNSUPPORTED_TASK',
            message: `Character Agent cannot handle: ${task.description}`,
            recoverable: false
        }, Date.now() - startTime);
    }

    private async createScript(task: AgentTask): Promise<AgentResult> {
        const startTime = Date.now();
        const artifacts: string[] = [];
        const contextText = this.getTaskContextText(task);
        const scriptPath = (task.input.scriptPath as string) || 'res://scripts/player.gd';
        const characterName = this.extractCharacterName(contextText);
        const scriptContent = this.generatePlatformerScript(characterName);

        const createResult = await this.executeTool('create_script', {
            path: scriptPath,
            content: scriptContent,
            explanation: 'Creating movement/controller script requested by user'
        });

        if (!createResult.success) {
            return this.createFailureResult(task, {
                code: 'CREATE_SCRIPT_FAILED',
                message: createResult.message || `Failed to create script ${scriptPath}`,
                recoverable: true
            }, Date.now() - startTime);
        }

        artifacts.push(scriptPath);
        return this.createSuccessResult(task, artifacts, {
            scriptPath,
            controllerFor: characterName
        }, Date.now() - startTime);
    }

    private async attachScript(task: AgentTask): Promise<AgentResult> {
        const startTime = Date.now();
        const scriptPath = (task.input.scriptPath as string) || 'res://scripts/player.gd';
        const nodePath = (task.input.nodePath as string) || 'Player';

        const attachToNode = async (targetNode: string) =>
            this.executeTool('attach_script', {
                node: targetNode,
                script_path: scriptPath,
                explanation: 'Attaching controller script to target node'
            });

        let attachResult = await attachToNode(nodePath);

        // Recover common case: requested node doesn't exist in open scene.
        if (!attachResult.success && /node not found/i.test(attachResult.message || '')) {
            // Ensure a scene is open before trying fallbacks.
            const treeResult = await this.executeTool('get_scene_tree', {
                explanation: 'Checking scene availability before script attach retry'
            });
            if (!treeResult.success) {
                return this.createFailureResult(task, {
                    code: 'ATTACH_SCRIPT_FAILED',
                    message: `No open scene to attach script. ${attachResult.message || ''}`.trim(),
                    recoverable: true,
                    suggestedAction: 'Open or create a scene first, then attach script'
                }, Date.now() - startTime);
            }

            // If target is a simple node name, auto-create it under root and retry.
            const simpleNodeName = /^[A-Za-z_][A-Za-z0-9_]*$/.test(nodePath) ? nodePath : '';
            if (simpleNodeName && simpleNodeName !== '.') {
                const inferredType = /player|character/i.test(simpleNodeName) ? 'CharacterBody2D' : 'Node2D';
                const addNodeResult = await this.executeTool('add_node', {
                    name: simpleNodeName,
                    type: inferredType,
                    parent: '.'
                });
                if (addNodeResult.success) {
                    attachResult = await attachToNode(simpleNodeName);
                    if (attachResult.success) {
                        return this.createSuccessResult(task, [], {
                            scriptPath,
                            nodePath: simpleNodeName,
                            autoCreatedNode: true
                        }, Date.now() - startTime);
                    }
                }
            }

            // Final fallback: attach to scene root.
            const rootAttach = await attachToNode('.');
            if (rootAttach.success) {
                return this.createSuccessResult(task, [], {
                    scriptPath,
                    nodePath: '.',
                    fallbackFrom: nodePath
                }, Date.now() - startTime);
            }
        }

        if (!attachResult.success) {
            return this.createFailureResult(task, {
                code: 'ATTACH_SCRIPT_FAILED',
                message: attachResult.message || `Failed to attach ${scriptPath} to ${nodePath}`,
                recoverable: true
            }, Date.now() - startTime);
        }

        return this.createSuccessResult(task, [], {
            scriptPath,
            nodePath
        }, Date.now() - startTime);
    }

    // ============================================================================
    // BaseAgent Implementation
    // ============================================================================

    canHandle(task: AgentTask): boolean {
        if (task.type === 'generate_character' || task.type === 'create_script' || task.type === 'attach_script') return true;
        if (task.assignedAgent === this.config.id) return true;

        // Check description for character-related keywords
        const desc = this.getTaskContextText(task).toLowerCase();
        return desc.includes('character') ||
            desc.includes('sprite') ||
            desc.includes('animation') ||
            desc.includes('player');
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
## Character Generation Guidelines

### SpriteMancer Workflow
1. Create character via spritemancer_create_character (description, size, perspective)
2. Wait for user approval of the reference image
3. Generate each animation via spritemancer_generate_animations (project_id, character_name, animations)
4. Request user approval for each animation before proceeding
5. Save approved animations via spritemancer_approve_animation
6. Create AnimatedSprite2D in Godot with create_sprite_frames_from_images

### Tool Parameter Reference
**spritemancer_create_character**:
- description: "knight with sword", "wizard with staff" (required)
- size: 32x32, 64x64, 128x128 (default: 32x32)
- perspective: side, front, isometric (default: side)

**spritemancer_generate_animations**:
- project_id: UUID from create_character result (required)
- character_name: "knight" (required)
- animations: ["idle", "walk", "run", "jump", "attack"] (required)

### Animation Best Practices
- Idle: 4-6 frames, looping
- Walk: 6-8 frames, looping
- Run: 6-8 frames, looping, faster than walk
- Jump: 3-5 frames, can be non-looping
- Attack: 4-6 frames, non-looping
- Death: 4-8 frames, non-looping

### Common Character Types
- Player character: Needs idle, walk, jump, attack
- Enemy: Needs idle, walk, attack, death
- NPC: Needs idle, maybe walk
- Boss: Needs all animations plus special moves

### Platformer Integration
After generating character, wrap in CharacterBody2D:
1. add_node(type: "CharacterBody2D", name: "Player")
2. add_node(parent: "Player", type: "AnimatedSprite2D")
3. add_node(parent: "Player", type: "CollisionShape2D")
4. set_property(node: "Player/CollisionShape2D", property: "shape", value: RectangleShape2D)
5. create_script + attach_script for player controller

### Output Structure
Characters are saved to: res://sprites/<character_name>_<id>/
- reference.png
- <animation>_spritesheet.png for each animation
`;
    }

    protected async verifyTaskSpecific(
        task: AgentTask,
        result: AgentResult
    ): Promise<string[]> {
        const issues: string[] = [];

        if (task.type === 'generate_character') {
            const projectId = result.output.projectId;
            if (!projectId) {
                issues.push('No SpriteMancer project ID returned');
            }

            const animations = result.output.animations as string[];
            if (!animations || animations.length === 0) {
                issues.push('No animations generated');
            }
        }

        return issues;
    }
}
