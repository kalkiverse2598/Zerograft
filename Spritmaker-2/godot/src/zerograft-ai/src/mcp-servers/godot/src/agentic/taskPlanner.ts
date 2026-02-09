/**
 * Task Planner
 * 
 * Breaks down user requests into agent-assignable tasks.
 * Identifies dependencies and parallelizable task groups.
 */

import { randomUUID } from 'crypto';
import {
    TaskPlan,
    AgentTask,
    AgentTaskType,
    TaskDependency,
    ProjectState,
    AGENT_TOOL_ASSIGNMENTS
} from './multiAgentTypes.js';

/**
 * Keywords that indicate task types
 */
const TASK_KEYWORDS: Record<AgentTaskType, string[]> = {
    create_scene: ['scene', 'level', 'screen', 'menu', 'game', 'platformer', 'project'],
    create_script: ['create script', 'write script', 'generate script', '.gd', 'player.gd', 'gdscript'],
    attach_script: ['attach script', 'add script to', 'assign script', 'connect script'],
    generate_character: ['character', 'charcter', 'charactor', 'player', 'enemy', 'npc', 'sprite', 'animation', 'walk', 'run', 'idle', 'attack', 'hero', 'knight', 'wizard'],
    generate_tileset: ['tileset', 'tiles', 'terrain', 'ground', 'platform', 'background', 'floor', 'wall', 'level design'],
    add_node: ['add node', 'add child', 'add component', 'insert node', 'collision shape', 'physics body'],
    integrate_asset: ['import', 'integrate', 'add to scene', 'setup', 'configure'],
    validate_project: ['test', 'validate', 'check', 'error', 'fix'],
    custom: []
};

/**
 * Task type to agent mapping
 */
const TASK_TO_AGENT: Record<AgentTaskType, string> = {
    create_scene: 'architecture',
    create_script: 'character',  // Character agent handles player/character scripts
    attach_script: 'character',
    generate_character: 'character',
    generate_tileset: 'level',
    add_node: 'architecture',
    integrate_asset: 'architecture',
    validate_project: 'qa',
    custom: 'architecture'  // Use architecture as fallback, NOT orchestrator
};

/**
 * TaskPlanner breaks down user requests into executable task plans
 */
export class TaskPlanner {

    // ============================================================================
    // Plan Creation
    // ============================================================================

    /**
     * Create a task plan from a user request
     */
    createPlan(userRequest: string, projectState: ProjectState): TaskPlan {
        const planId = randomUUID();

        // Analyze the request to identify tasks
        const tasks = this.analyzeTasks(userRequest);

        // Build dependency graph
        const dependencies = this.buildDependencies(tasks);

        // Identify parallel groups
        const parallelGroups = this.identifyParallelGroups(tasks, dependencies);

        const plan: TaskPlan = {
            id: planId,
            userRequest,
            tasks,
            dependencies,
            parallelGroups,
            status: 'created'
        };

        // Detailed plan logging
        console.log(`\n${'='.repeat(60)}`);
        console.log(`[TaskPlanner] 📋 EXECUTION PLAN`);
        console.log(`${'='.repeat(60)}`);
        console.log(`Request: "${userRequest.substring(0, 50)}..."`);
        console.log(`Total Tasks: ${tasks.length} | Parallel Groups: ${parallelGroups.length}`);
        console.log(`${'─'.repeat(60)}`);

        // Print each task and its assignment
        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            const deps = task.dependencies.length > 0
                ? `depends on: ${task.dependencies.map(d => tasks.find(t => t.id === d)?.type || 'unknown').join(', ')}`
                : 'no dependencies';
            console.log(`  ${i + 1}. [${task.type}] → ${task.assignedAgent.toUpperCase()} Agent (${deps})`);
        }

        console.log(`${'─'.repeat(60)}`);
        console.log(`Execution Order:`);
        for (let i = 0; i < parallelGroups.length; i++) {
            const groupTasks = parallelGroups[i].map(id => {
                const t = tasks.find(task => task.id === id);
                return t ? `${t.assignedAgent}:${t.type}` : 'unknown';
            });
            console.log(`  Group ${i + 1} (parallel): ${groupTasks.join(' | ')}`);
        }
        console.log(`${'='.repeat(60)}\n`);

        return plan;
    }

    /**
     * Analyze request to extract individual tasks
     */
    private analyzeTasks(userRequest: string): AgentTask[] {
        const tasks: AgentTask[] = [];
        const lowerRequest = userRequest.toLowerCase();
        const keywordRequest = lowerRequest.replace(/\b[a-z0-9_./-]+\.tscn\b/g, ' ');
        const inferredScenePath = this.extractScenePath(userRequest);
        const inferredScriptPath = this.extractScriptPath(userRequest);

        // Check for each task type
        const detectedTypes: AgentTaskType[] = [];

        for (const [taskType, keywords] of Object.entries(TASK_KEYWORDS)) {
            for (const keyword of keywords) {
                if (this.matchesKeyword(keywordRequest, keyword)) {
                    detectedTypes.push(taskType as AgentTaskType);
                    break;
                }
            }
        }

        // Natural language like "add Camera2D" should map to add_node.
        if (/\b(add|attach|insert)\b/i.test(userRequest) && this.extractNodeType(userRequest)) {
            detectedTypes.push('add_node');
        }

        const attachScriptIntent =
            /\b(attach|assign|bind)\b[\s\S]{0,40}\bscript\b/i.test(userRequest) ||
            /\bscript\b[\s\S]{0,40}\b(to|onto|on)\b/i.test(userRequest);
        const createScriptIntent =
            /\b(create|write|generate|make)\b[\s\S]{0,40}\bscript\b/i.test(userRequest) ||
            /\b(with|using)\b[\s\S]{0,40}\b(ui_left|ui_right|ui_accept|movement|jump|input)\b/i.test(userRequest);

        if (attachScriptIntent) {
            detectedTypes.push('attach_script');
        }
        if (inferredScriptPath && (createScriptIntent || lowerRequest.includes('.gd with'))) {
            detectedTypes.push('create_script');
        }

        // If a .tscn path or explicit root-node request exists, treat it as scene creation.
        const hasExplicitRootType = /\broot(?:\s+node)?(?:\s+type)?\s*(?:is|as|=)?\s*[A-Za-z_][A-Za-z0-9_]*/i.test(userRequest);
        if (inferredScenePath || hasExplicitRootType) {
            if (!detectedTypes.includes('create_scene')) {
                detectedTypes.push('create_scene');
            }
        }

        // Special case: If "game" or "platformer" is mentioned, ensure we have a comprehensive plan
        const isGameCreation = keywordRequest.includes('game') ||
            keywordRequest.includes('platformer') ||
            keywordRequest.includes('project');

        if (isGameCreation) {
            // Ensure we have all essential tasks for a game
            const essentialTypes: AgentTaskType[] = ['create_scene', 'generate_character'];

            // Add platform/tileset for platformer games (with fuzzy matching for typos)
            const platformerPatterns = ['platformer', 'platform', 'plateformer', 'plataformer', 'platformar'];
            const isPlatformer = platformerPatterns.some(p => keywordRequest.includes(p));

            if (isPlatformer) {
                essentialTypes.push('generate_tileset');
            }

            // Always add integrate_asset as the final assembly step for game creation
            // This wires Player, AnimatedSprite2D, CollisionShape2D, Camera2D, and movement script
            essentialTypes.push('integrate_asset');

            for (const type of essentialTypes) {
                if (!detectedTypes.includes(type)) {
                    detectedTypes.push(type);
                }
            }
        }

        // Remove duplicates
        const uniqueTypes = Array.from(new Set(detectedTypes));

        // Guardrail: mentions like "player position" or "character collision"
        // should not trigger SpriteMancer generation unless creation intent exists.
        // Skip guardrail for game creation — user clearly wants characters generated.
        if (!isGameCreation && uniqueTypes.includes('generate_character') && !this.isCharacterGenerationRequest(userRequest, keywordRequest)) {
            const idx = uniqueTypes.indexOf('generate_character');
            if (idx >= 0) {
                uniqueTypes.splice(idx, 1);
            }
        }

        if (uniqueTypes.includes('attach_script') && inferredScriptPath && !uniqueTypes.includes('create_script')) {
            uniqueTypes.push('create_script');
        }

        const explicitSceneIntent = /\b(create|open|new|make)\b[\s\S]{0,30}\bscene\b/i.test(userRequest) || !!inferredScenePath;
        if (!isGameCreation && !explicitSceneIntent && uniqueTypes.includes('create_scene') && (uniqueTypes.includes('create_script') || uniqueTypes.includes('attach_script'))) {
            const idx = uniqueTypes.indexOf('create_scene');
            if (idx >= 0) {
                uniqueTypes.splice(idx, 1);
            }
        }

        // Create tasks for each detected type
        for (const taskType of uniqueTypes) {
            const task = this.createTaskForType(taskType, userRequest, tasks.length);
            tasks.push(task);
        }

        // If no tasks detected, create a custom task for a concrete agent.
        if (tasks.length === 0) {
            tasks.push({
                id: randomUUID(),
                type: 'custom',
                description: this.summarizeRequest(userRequest, 80),
                assignedAgent: TASK_TO_AGENT.custom,
                dependencies: [],
                priority: 1,
                input: { userRequest }
            });
        }

        return tasks;
    }

    /**
     * Detect whether request is explicitly asking to create/generate a character asset.
     */
    private isCharacterGenerationRequest(userRequest: string, normalizedLower: string): boolean {
        const generationVerbs = /\b(create|generate|make|design|draw|build|craft|spawn)\b/i;
        const characterTargets = /\b(character|charcter|charactor|player|enemy|npc|sprite|hero|knight|wizard|firemaze)\b/i;
        const animationTargets = /\b(animation|animate|idle|walk|run|attack)\b/i;

        if (/\bspritemancer\b/i.test(userRequest)) {
            return true;
        }

        if (generationVerbs.test(userRequest) && (characterTargets.test(userRequest) || animationTargets.test(userRequest))) {
            return true;
        }

        // Requests explicitly about animation authoring should still route here.
        if (/\b(generate|create)\s+(an?\s+)?animation\b/i.test(userRequest)) {
            return true;
        }

        // Pure transform/collision/property edits should not spawn character generation.
        const editOnlyIntent =
            /\b(set|move|position|align|resize|scale|adjust|change|update|collision)\b/i.test(userRequest) &&
            !generationVerbs.test(userRequest);
        if (editOnlyIntent) {
            return false;
        }

        // Conservative default: avoid expensive asset generation unless intent is clear.
        return false;
    }

    /**
     * Create a task for a specific type
     */
    private createTaskForType(
        taskType: AgentTaskType,
        userRequest: string,
        index: number
    ): AgentTask {
        const agent = TASK_TO_AGENT[taskType];
        const taskInput: Record<string, unknown> = {
            userRequest,
            taskType
        };

        if (taskType === 'create_scene') {
            taskInput.scenePath = this.extractScenePath(userRequest) || 'res://scenes/NewScene.tscn';
            taskInput.rootType = this.extractRootType(userRequest) || 'Node2D';
        }

        if (taskType === 'create_script') {
            taskInput.scriptPath = this.extractScriptPath(userRequest) || 'res://scripts/player.gd';
            taskInput.scriptContent = userRequest; // Pass full request for LLM to generate
        }

        if (taskType === 'attach_script') {
            taskInput.scriptPath = this.extractScriptPath(userRequest) || 'res://scripts/player.gd';
            taskInput.nodePath = this.extractAttachTarget(userRequest) || 'Player';
        }

        if (taskType === 'add_node') {
            const nodeType = this.extractNodeType(userRequest);
            taskInput.nodeType = nodeType || 'Node2D';
            taskInput.nodeName = this.extractNodeName(userRequest, nodeType || 'Node2D');
            taskInput.parentPath = this.extractParentPath(userRequest) || '.';
        }

        return {
            id: randomUUID(),
            type: taskType,
            description: this.generateTaskDescription(taskType, userRequest, taskInput),
            assignedAgent: agent,
            dependencies: [],
            priority: this.getTaskPriority(taskType),
            input: taskInput
        };
    }

    /**
     * Generate a description for a task
     */
    private generateTaskDescription(
        taskType: AgentTaskType,
        userRequest: string,
        taskInput: Record<string, unknown>
    ): string {
        switch (taskType) {
            case 'create_scene': {
                const scenePath = String(taskInput.scenePath || 'res://scenes/NewScene.tscn');
                const rootType = String(taskInput.rootType || 'Node2D');
                const sceneFile = scenePath.split('/').pop() || scenePath;
                return `Create scene ${sceneFile} (${rootType})`;
            }
            case 'create_script': {
                const scriptPath = String(taskInput.scriptPath || 'player.gd');
                return `Create GDScript: ${scriptPath}`;
            }
            case 'attach_script': {
                const scriptPath = String(taskInput.scriptPath || 'script.gd');
                const nodePath = String(taskInput.nodePath || 'Player');
                return `Attach ${scriptPath} to ${nodePath}`;
            }
            case 'generate_character':
                return 'Generate character sprites and core animations';
            case 'generate_tileset':
                return 'Generate tileset and prepare TileMap resources';
            case 'add_node': {
                const nodeType = String(taskInput.nodeType || 'Node2D');
                const parentPath = String(taskInput.parentPath || '.');
                return `Add ${nodeType} node under ${parentPath}`;
            }
            case 'integrate_asset':
                return 'Integrate generated assets into the active scene';
            case 'validate_project':
                return 'Run project validation checks';
            default:
                return this.summarizeRequest(userRequest, 80);
        }
    }

    private summarizeRequest(userRequest: string, maxLen: number): string {
        const clean = userRequest.replace(/\s+/g, ' ').trim();
        if (clean.length <= maxLen) {
            return clean;
        }
        return `${clean.slice(0, maxLen - 3)}...`;
    }

    /**
     * Get priority for a task type (lower = higher priority)
     */
    private getTaskPriority(taskType: AgentTaskType): number {
        const priorities: Record<AgentTaskType, number> = {
            create_scene: 1,      // Scene first
            create_script: 2,     // Scripts after scene
            attach_script: 3,     // Attach after create
            generate_character: 2, // Assets can be parallel
            generate_tileset: 2,   // Assets can be parallel
            add_node: 3,           // After assets
            integrate_asset: 4,    // After nodes
            validate_project: 5,   // Last
            custom: 3
        };
        return priorities[taskType];
    }

    // ============================================================================
    // Dependency Analysis
    // ============================================================================

    /**
     * Build dependency graph between tasks
     */
    private buildDependencies(tasks: AgentTask[]): TaskDependency[] {
        const dependencies: TaskDependency[] = [];

        // Sort tasks by priority
        const sortedTasks = [...tasks].sort((a, b) => a.priority - b.priority);

        // Find scene creation task
        const sceneTask = sortedTasks.find(t => t.type === 'create_scene');
        const addNodeTasks = sortedTasks.filter(t => t.type === 'add_node');
        const createScriptTasks = sortedTasks.filter(t => t.type === 'create_script');
        const attachScriptTasks = sortedTasks.filter(t => t.type === 'attach_script');

        // Asset generation depends on scene (if applicable)
        const assetTasks = sortedTasks.filter(t =>
            t.type === 'generate_character' || t.type === 'generate_tileset'
        );

        // Integration depends on assets
        const integrationTask = sortedTasks.find(t => t.type === 'integrate_asset');

        // Validation depends on everything
        const validationTask = sortedTasks.find(t => t.type === 'validate_project');

        // Build dependencies
        if (sceneTask) {
            // Node additions should only run after a scene exists/open.
            for (const addNodeTask of addNodeTasks) {
                dependencies.push({
                    taskId: addNodeTask.id,
                    dependsOn: sceneTask.id
                });
                addNodeTask.dependencies.push(sceneTask.id);
            }

            // Assets can start after scene is created
            for (const assetTask of assetTasks) {
                dependencies.push({
                    taskId: assetTask.id,
                    dependsOn: sceneTask.id
                });
                assetTask.dependencies.push(sceneTask.id);
            }

            for (const attachScriptTask of attachScriptTasks) {
                dependencies.push({
                    taskId: attachScriptTask.id,
                    dependsOn: sceneTask.id
                });
                attachScriptTask.dependencies.push(sceneTask.id);
            }
        }

        for (const attachScriptTask of attachScriptTasks) {
            for (const createScriptTask of createScriptTasks) {
                dependencies.push({
                    taskId: attachScriptTask.id,
                    dependsOn: createScriptTask.id
                });
                attachScriptTask.dependencies.push(createScriptTask.id);
            }
        }

        if (integrationTask) {
            // Integration depends on scene and all assets
            if (sceneTask) {
                dependencies.push({
                    taskId: integrationTask.id,
                    dependsOn: sceneTask.id
                });
                integrationTask.dependencies.push(sceneTask.id);
            }
            for (const assetTask of assetTasks) {
                dependencies.push({
                    taskId: integrationTask.id,
                    dependsOn: assetTask.id
                });
                integrationTask.dependencies.push(assetTask.id);
            }
        }

        if (validationTask) {
            // Validation depends on everything else
            for (const task of sortedTasks) {
                if (task.id !== validationTask.id) {
                    dependencies.push({
                        taskId: validationTask.id,
                        dependsOn: task.id
                    });
                    validationTask.dependencies.push(task.id);
                }
            }
        }

        return dependencies;
    }

    private extractScenePath(userRequest: string): string | null {
        const sceneMatch = userRequest.match(/\b([A-Za-z0-9_./-]+\.tscn)\b/i);
        if (!sceneMatch) {
            return null;
        }

        const rawPath = sceneMatch[1].trim();
        if (rawPath.startsWith('res://')) {
            return rawPath;
        }
        if (rawPath.includes('/')) {
            return `res://${rawPath.replace(/^\/+/, '')}`;
        }
        return `res://scenes/${rawPath}`;
    }

    private extractScriptPath(userRequest: string): string | null {
        // Match .gd file paths like player.gd, res://scripts/player.gd
        const scriptMatch = userRequest.match(/\b([A-Za-z0-9_./-]+\.gd)\b/i);
        if (!scriptMatch) {
            return null;
        }

        const rawPath = scriptMatch[1].trim();
        if (rawPath.startsWith('res://')) {
            return rawPath;
        }
        if (rawPath.includes('/')) {
            return `res://${rawPath.replace(/^\/+/, '')}`;
        }
        return `res://scripts/${rawPath}`;
    }

    private extractRootType(userRequest: string): string | null {
        const explicitRootMatch = userRequest.match(/\broot(?:\s+node)?(?:\s+type)?\s*(?:is|as|=)?\s*([A-Za-z_][A-Za-z0-9_]*)\b/i);
        if (explicitRootMatch) {
            return explicitRootMatch[1];
        }

        const knownRootTypes = [
            'Node2D',
            'CharacterBody2D',
            'Node3D',
            'Control',
            'CanvasLayer',
            'Area2D',
            'RigidBody2D'
        ];

        for (const rootType of knownRootTypes) {
            if (new RegExp(`\\b${rootType}\\b`, 'i').test(userRequest)) {
                return rootType;
            }
        }

        return null;
    }

    private extractAttachTarget(userRequest: string): string | null {
        const targetMatch = userRequest.match(/\b(?:to|onto|on)\s+([A-Za-z_][A-Za-z0-9_/-]*)\b/i);
        if (targetMatch) {
            return targetMatch[1];
        }
        if (/\bplayer\b/i.test(userRequest)) {
            return 'Player';
        }
        return null;
    }

    private matchesKeyword(text: string, keyword: string): boolean {
        if (!text || !keyword) {
            return false;
        }

        if (/^[a-z0-9_]+$/i.test(keyword)) {
            const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
        }

        return text.includes(keyword);
    }

    private extractNodeType(userRequest: string): string | null {
        const addTypeMatch = userRequest.match(/\b(?:add|attach|insert)\s+(?:a|an)?\s*([A-Z][A-Za-z0-9_]*)\b/);
        if (addTypeMatch) {
            return addTypeMatch[1];
        }

        const knownNodeTypes = [
            'Sprite2D',
            'CollisionShape2D',
            'CharacterBody2D',
            'RigidBody2D',
            'Area2D',
            'Camera2D',
            'TileMapLayer',
            'AnimatedSprite2D'
        ];

        for (const nodeType of knownNodeTypes) {
            if (new RegExp(`\\b${nodeType}\\b`, 'i').test(userRequest)) {
                return nodeType;
            }
        }

        return null;
    }

    private extractNodeName(userRequest: string, fallbackType: string): string {
        const nameMatch = userRequest.match(/\b(?:named|called)\s+([A-Za-z_][A-Za-z0-9_]*)\b/i);
        if (nameMatch) {
            return nameMatch[1];
        }
        return fallbackType;
    }

    private extractParentPath(userRequest: string): string | null {
        const explicitParentMatch = userRequest.match(/\bparent\s+([./A-Za-z0-9_/-]+)\b/i);
        if (explicitParentMatch) {
            return explicitParentMatch[1];
        }

        const underMatch = userRequest.match(/\b(?:under|inside)\s+([./A-Za-z0-9_/-]+)\b/i);
        if (underMatch) {
            return underMatch[1];
        }

        return null;
    }

    // ============================================================================
    // Parallel Execution
    // ============================================================================

    /**
     * Identify groups of tasks that can run in parallel
     */
    identifyParallelGroups(tasks: AgentTask[], dependencies: TaskDependency[]): string[][] {
        const groups: string[][] = [];
        const completed = new Set<string>();
        const taskMap = new Map(tasks.map(t => [t.id, t]));

        while (completed.size < tasks.length) {
            // Find tasks whose dependencies are all completed
            const ready: string[] = [];

            for (const task of tasks) {
                if (completed.has(task.id)) continue;

                const allDepsComplete = task.dependencies.every(dep => completed.has(dep));
                if (allDepsComplete) {
                    ready.push(task.id);
                }
            }

            if (ready.length === 0) {
                // Shouldn't happen if dependencies are valid
                console.error('[TaskPlanner] Circular dependency detected!');
                break;
            }

            // These tasks can run in parallel
            groups.push(ready);

            // Mark as completed for next iteration
            for (const taskId of ready) {
                completed.add(taskId);
            }
        }

        return groups;
    }

    // ============================================================================
    // Plan Updates
    // ============================================================================

    /**
     * Update plan after a task completes
     */
    updatePlanAfterCompletion(
        plan: TaskPlan,
        completedTaskId: string,
        success: boolean
    ): TaskPlan {
        const updatedPlan = { ...plan };

        if (!success) {
            updatedPlan.status = 'failed';
            return updatedPlan;
        }

        // Check if all tasks are complete
        const remainingTasks = plan.tasks.filter(t =>
            !plan.parallelGroups.flat().includes(t.id) || t.id === completedTaskId
        );

        // Recalculate parallel groups without completed task
        const incompleteTasks = plan.tasks.filter(t => t.id !== completedTaskId);

        if (incompleteTasks.length === 0) {
            updatedPlan.status = 'completed';
        }

        return updatedPlan;
    }

    // ============================================================================
    // LLM-Based Planning
    // ============================================================================

    /**
     * Create a plan using the LLM to understand the user's intent.
     * Falls back to keyword-based planning if LLM fails.
     */
    async createPlanWithLLM(
        userRequest: string,
        projectState: ProjectState,
        sendToLLM: (context: string) => Promise<string>
    ): Promise<TaskPlan> {
        try {
            const prompt = this.buildPlannerPrompt(userRequest, projectState);
            console.log('[TaskPlanner] 🧠 Using LLM to analyze request and create plan...');

            const llmResponse = await sendToLLM(prompt);
            const tasks = this.parseLLMPlanResponse(llmResponse, userRequest);

            if (tasks.length > 0) {
                console.log(`[TaskPlanner] ✅ LLM generated ${tasks.length} tasks`);
                return this.buildPlanFromTasks(tasks, userRequest);
            }

            console.warn('[TaskPlanner] LLM returned no tasks, falling back to keyword planner');
        } catch (error) {
            console.warn('[TaskPlanner] LLM planning failed, falling back to keyword planner:', error);
        }

        // Fallback to keyword-based planning
        return this.createPlan(userRequest, projectState);
    }

    /**
     * Build the prompt that tells the LLM how to decompose a request into tasks
     */
    private buildPlannerPrompt(userRequest: string, projectState: ProjectState): string {
        const existingScenes = projectState.scenes?.size > 0
            ? Array.from(projectState.scenes.keys()).join(', ')
            : 'none';
        const existingAssets = projectState.assets?.size > 0
            ? Array.from(projectState.assets.keys()).join(', ')
            : 'none';

        return `You are a task planner for a Godot game engine AI assistant. 
Analyze the user's request and break it into specific tasks.

## Available Agents & Task Types

| Agent | Task Type | What It Does |
|-------|-----------|-------------|
| architecture | create_scene | Creates a new .tscn scene with root node |
| architecture | add_node | Adds nodes (CharacterBody2D, CollisionShape2D, etc.) to scenes |
| architecture | integrate_asset | Wires everything into a playable game: Player hierarchy, sprites, collision, camera, movement script |
| character | generate_character | Uses SpriteMancer AI to generate character sprites + animations |
| character | create_script | Creates GDScript files (player controller, enemy AI, etc.) |
| character | attach_script | Attaches an existing script to a node |
| level | generate_tileset | Uses SpriteMancer AI to generate tilesets, backgrounds, terrain |
| qa | validate_project | Runs validation checks on the project |

## Rules
- For "create a game" requests: ALWAYS include create_scene, generate_character, generate_tileset, and integrate_asset
- integrate_asset is the FINAL assembly step — it creates the Player (CharacterBody2D) with AnimatedSprite2D, CollisionShape2D, Camera2D, assigns sprites, and creates+attaches a movement script
- integrate_asset must run LAST, after generate_character and generate_tileset complete
- Do NOT include create_script for player movement — integrate_asset handles that automatically
- create_scene must come FIRST (other tasks depend on it)
- generate_character and generate_tileset can run in PARALLEL after create_scene
- If user mentions SpriteMancer, use generate_character and/or generate_tileset
- Keep plans focused: 3-5 tasks for most requests

## Current Project State
- Scenes: ${existingScenes}
- Assets: ${existingAssets}

## User Request
"${userRequest}"

## Output Format
Return ONLY a JSON array of tasks. No other text, no markdown, no explanation.
Each task object must have:
- "type": one of the task types above
- "agent": the agent name
- "description": what specifically to do
- "depends_on": array of task indices (0-based) this task depends on, or empty []

Example:
[
  {"type": "create_scene", "agent": "architecture", "description": "Create main game scene with Node2D root and Camera2D", "depends_on": []},
  {"type": "generate_character", "agent": "character", "description": "Generate fire mage character with idle, walk, jump, attack animations", "depends_on": [0]},
  {"type": "generate_tileset", "agent": "level", "description": "Generate stone platform tileset and lava background for fire maze theme", "depends_on": [0]},
  {"type": "create_script", "agent": "character", "description": "Create player controller script with movement, jump, and gravity", "depends_on": [0, 1]}
]`;
    }

    /**
     * Parse the LLM's JSON response into AgentTask objects
     */
    private parseLLMPlanResponse(response: string, userRequest: string): AgentTask[] {
        console.log(`[TaskPlanner] LLM response (first 300 chars): ${response.substring(0, 300)}`);

        // Try multiple strategies to extract the task array
        let parsed: any[] | null = null;

        // Strategy 1: Direct parse as array
        try {
            const direct = JSON.parse(response.trim());
            if (Array.isArray(direct)) {
                parsed = direct;
            } else if (direct && typeof direct === 'object') {
                // LLM may have returned {"tasks": [...]} or {"plan": [...]}
                const arrayProp = Object.values(direct).find(v => Array.isArray(v)) as any[] | undefined;
                if (arrayProp && arrayProp.length > 0) {
                    console.log('[TaskPlanner] Extracted array from object wrapper');
                    parsed = arrayProp;
                }
            }
        } catch { /* not valid JSON at top level */ }

        // Strategy 2: Extract from markdown code blocks
        if (!parsed) {
            const codeMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (codeMatch) {
                try {
                    const inner = JSON.parse(codeMatch[1].trim());
                    if (Array.isArray(inner)) parsed = inner;
                } catch { /* ignore */ }
            }
        }

        // Strategy 3: Find [ ... ] substring
        if (!parsed) {
            const arrayStart = response.indexOf('[');
            const arrayEnd = response.lastIndexOf(']');
            if (arrayStart !== -1 && arrayEnd > arrayStart) {
                try {
                    parsed = JSON.parse(response.substring(arrayStart, arrayEnd + 1));
                } catch { /* ignore */ }
            }
        }

        if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
            console.warn('[TaskPlanner] Could not extract task array from LLM response');
            return [];
        }

        // Valid task types
        const validTypes = new Set<string>([
            'create_scene', 'create_script', 'attach_script',
            'generate_character', 'generate_tileset', 'add_node',
            'integrate_asset', 'validate_project', 'custom'
        ]);

        // Convert to AgentTask objects
        const tasks: AgentTask[] = [];
        const idMap = new Map<number, string>(); // index -> UUID

        // First pass: create tasks with IDs
        for (let i = 0; i < parsed.length; i++) {
            const item = parsed[i];
            const taskType = validTypes.has(item.type) ? item.type as AgentTaskType : 'custom';
            const agent = TASK_TO_AGENT[taskType] || item.agent || 'architecture';
            const id = randomUUID();
            idMap.set(i, id);

            tasks.push({
                id,
                type: taskType,
                description: item.description || this.generateTaskDescription(taskType, userRequest, { userRequest }),
                assignedAgent: agent,
                dependencies: [], // filled in second pass
                priority: this.getTaskPriority(taskType),
                input: { userRequest, taskType }
            });
        }

        // Second pass: resolve dependencies
        for (let i = 0; i < parsed.length; i++) {
            const deps = parsed[i].depends_on;
            if (Array.isArray(deps)) {
                for (const depIdx of deps) {
                    const depId = idMap.get(depIdx);
                    if (depId) {
                        tasks[i].dependencies.push(depId);
                    }
                }
            }
        }

        return tasks;
    }

    /**
     * Build a full TaskPlan from a list of tasks
     */
    private buildPlanFromTasks(tasks: AgentTask[], userRequest: string): TaskPlan {
        const planId = randomUUID();

        // Build dependency objects
        const dependencies: TaskDependency[] = [];
        for (const task of tasks) {
            for (const depId of task.dependencies) {
                dependencies.push({ taskId: task.id, dependsOn: depId });
            }
        }

        // Identify parallel groups
        const parallelGroups = this.identifyParallelGroups(tasks, dependencies);

        const plan: TaskPlan = {
            id: planId,
            userRequest,
            tasks,
            dependencies,
            parallelGroups,
            status: 'created'
        };

        // Log the plan
        console.log(`\n${'='.repeat(60)}`);
        console.log(`[TaskPlanner] 📋 LLM-GENERATED EXECUTION PLAN`);
        console.log(`${'='.repeat(60)}`);
        console.log(`Request: "${userRequest.substring(0, 50)}..."`);
        console.log(`Total Tasks: ${tasks.length} | Parallel Groups: ${parallelGroups.length}`);
        console.log(`${'─'.repeat(60)}`);

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            const deps = task.dependencies.length > 0
                ? `depends on: ${task.dependencies.map(d => tasks.find(t => t.id === d)?.type || '?').join(', ')}`
                : 'no dependencies';
            console.log(`  ${i + 1}. [${task.type}] → ${task.assignedAgent.toUpperCase()} Agent (${deps})`);
            console.log(`     "${task.description}"`);
        }

        console.log(`${'─'.repeat(60)}`);
        console.log(`Execution Order:`);
        for (let i = 0; i < parallelGroups.length; i++) {
            const groupTasks = parallelGroups[i].map(id => {
                const t = tasks.find(task => task.id === id);
                return t ? `${t.assignedAgent}:${t.type}` : 'unknown';
            });
            console.log(`  Group ${i + 1} (parallel): ${groupTasks.join(' | ')}`);
        }
        console.log(`${'='.repeat(60)}\n`);

        return plan;
    }

    /**
     * Get next tasks to execute from a plan
     */
    getNextTasks(plan: TaskPlan, completedTaskIds: Set<string>): AgentTask[] {
        const nextTasks: AgentTask[] = [];

        for (const task of plan.tasks) {
            if (completedTaskIds.has(task.id)) continue;

            const allDepsComplete = task.dependencies.every(dep => completedTaskIds.has(dep));
            if (allDepsComplete) {
                nextTasks.push(task);
            }
        }

        return nextTasks;
    }
}
