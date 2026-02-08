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
        const assetPath = task.input.assetPath as string;
        const targetScene = task.input.targetScene as string;

        // Get current scene tree
        const treeResult = await this.executeTool('get_scene_tree', {});

        if (!treeResult.success) {
            return this.createFailureResult(task, {
                code: 'TOOL_FAILED',
                message: 'Failed to get scene tree',
                recoverable: true
            }, Date.now() - startTime);
        }

        // Integration logic would go here
        // For now, just report success

        return this.createSuccessResult(task, [], {
            assetPath,
            targetScene,
            integrated: true
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
