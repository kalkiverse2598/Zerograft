# Agent Game Creation Enhancement - Implementation Plan

> **Created**: 2026-01-24  
> **Goal**: Enable the AI agent to reliably create simple games using SpriteMancer for asset generation  
> **Estimated Total Effort**: 20-30 hours

---

## Table of Contents

1. [Phase 0: Critical Runtime Fixes](#0-phase-0-critical-runtime-fixes-new---quick-wins)
2. [Executive Summary](#1-executive-summary)
3. [Phase 1: Game Creation Meta-Recipe](#2-phase-1-game-creation-meta-recipe)
4. [Phase 2: Auto-Context Enhancement](#3-phase-2-auto-context-enhancement)
5. [Phase 3: SpriteMancer-Scene Bridge](#4-phase-3-spritemancer-scene-bridge)
6. [Phase 4: Plan Enforcement](#5-phase-4-plan-enforcement)
7. [Phase 5: Game Templates](#6-phase-5-game-templates-future)
8. [Testing Strategy](#7-testing-strategy)
9. [Rollout Plan](#8-rollout-plan)

---

## 0. Phase 0: Critical Runtime Fixes (NEW - Quick Wins)

> ⚠️ **These issues were identified as root causes for tool failures and must be addressed FIRST**

### 0.1 Deep Scene Tree Support (C++ Change)

**Problem**: `get_scene_tree()` only returns root + direct children, not nested nodes. Agent can't validate or navigate hierarchy.

**File**: `src/agentic-godot/modules/godot_bridge/bridge_commands_scene.cpp` (lines 33-72)

**Current Code (Shallow)**:
```cpp
for (int i = 0; i < root->get_child_count(); i++) {
    Node *child = root->get_child(i);
    // Only captures immediate children, no recursion!
}
```

**Solution**: Add recursive helper function:

```cpp
// Add helper function before get_scene_tree()
Dictionary GodotBridge::_serialize_node_recursive(Node *node, int depth, int max_depth) {
    Dictionary info;
    info["name"] = node->get_name();
    info["type"] = node->get_class();
    info["path"] = String(node->get_path());
    
    // Recursively get children up to max_depth
    if (depth < max_depth && node->get_child_count() > 0) {
        Array children;
        for (int i = 0; i < node->get_child_count(); i++) {
            Node *child = node->get_child(i);
            children.push_back(_serialize_node_recursive(child, depth + 1, max_depth));
        }
        info["children"] = children;
    }
    
    return info;
}

// Modify get_scene_tree() to use recursive serialization
Dictionary GodotBridge::get_scene_tree() {
    Dictionary result;
    
#ifdef TOOLS_ENABLED
    EditorInterface *editor = EditorInterface::get_singleton();
    if (!editor) {
        result["error"] = "EditorInterface not available";
        result["success"] = false;
        return result;
    }
    
    Node *root = editor->get_edited_scene_root();
    
    if (root) {
        // NEW: Recursive serialization with depth limit (default 5)
        int max_depth = 5;
        result = _serialize_node_recursive(root, 0, max_depth);
        result["success"] = true;
        result["scene_path"] = root->get_scene_file_path();  // Also add scene path!
    } else {
        result["error"] = "No scene currently open";
        result["success"] = false;
    }
#else
    result["error"] = "Editor tools not available";
    result["success"] = false;
#endif
    
    return result;
}
```

**Header Addition** (`godot_bridge.h`):
```cpp
private:
    Dictionary _serialize_node_recursive(Node *node, int depth, int max_depth);
```

**Impact**: Agent can now see full hierarchy like:
```json
{
  "name": "Level",
  "type": "Node2D",
  "children": [
    {
      "name": "Player",
      "type": "CharacterBody2D",
      "children": [
        {"name": "CollisionShape2D", "type": "CollisionShape2D"},
        {"name": "AnimatedSprite2D", "type": "AnimatedSprite2D"}
      ]
    }
  ]
}
```

---

### 0.2 Pre-Tool Guardrails (Scene Open Check)

**Problem**: Many tools assume a scene is open; if none, `add_node` fails immediately with cryptic error.

**File**: `src/zerograft-ai/src/mcp-servers/godot/src/agentic/taskExecutor.ts`

**Solution**: Add pre-execution guardrails:

```typescript
// Add after line ~200 in TaskExecutor

/**
 * Tools that require an open scene to work
 */
private readonly SCENE_REQUIRED_TOOLS = [
    'add_node', 'remove_node', 'rename_node', 'duplicate_node', 'move_node',
    'set_property', 'get_property', 'set_collision_shape', 'attach_script',
    'save_scene', 'connect_signal', 'set_owner_recursive'
];

/**
 * Check and enforce preconditions before tool execution
 */
private async ensureToolPreconditions(toolName: string): Promise<{ready: boolean; action?: string}> {
    // Check if tool requires an open scene
    if (this.SCENE_REQUIRED_TOOLS.includes(toolName)) {
        try {
            const sceneTree = await this.callbacks.executeTool("get_scene_tree", {});
            if (!(sceneTree as any).success) {
                // No scene open - try to help
                console.log(`[TaskExecutor] ⚠️ ${toolName} requires open scene, none found`);
                
                // Check if there are any scenes to open
                const scenes = await this.callbacks.executeTool("list_scenes", {});
                const sceneList = (scenes as any).scenes || [];
                
                if (sceneList.length > 0) {
                    // Auto-open the first scene (or main scene if set)
                    const mainScene = sceneList.find((s: string) => s.includes("Level") || s.includes("Main")) || sceneList[0];
                    console.log(`[TaskExecutor] 🔧 Auto-opening scene: ${mainScene}`);
                    await this.callbacks.executeTool("open_scene", { path: mainScene });
                    return { ready: true, action: `Auto-opened scene: ${mainScene}` };
                } else {
                    // No scenes exist - tell agent to create one first
                    return { 
                        ready: false, 
                        action: `No scene is open and no scenes exist. Call create_scene first, then open_scene.` 
                    };
                }
            }
            return { ready: true };
        } catch (error) {
            return { ready: false, action: `Precondition check failed: ${error}` };
        }
    }
    
    return { ready: true };
}
```

**Integration** (modify the tool execution loop ~line 265):

```typescript
// Before executing the tool
const precondition = await this.ensureToolPreconditions(toolCall.name);
if (!precondition.ready) {
    // Add guidance to conversation instead of failing
    this.conversationHistory.push(
        `⚠️ PRECONDITION FAILED for ${toolCall.name}: ${precondition.action}`
    );
    result = {
        success: false,
        code: ErrorCode.MISSING_CONTEXT,
        message: precondition.action
    };
} else {
    if (precondition.action) {
        this.conversationHistory.push(`ℹ️ Auto-fix: ${precondition.action}`);
    }
    // Execute the tool normally
    result = await this.executeToolWithRetry(toolCall);
}
```

---

### 0.3 Structured Error Recovery Sequence

**Problem**: Tool failures are logged but no structured recovery is triggered.

**File**: `src/zerograft-ai/src/mcp-servers/godot/src/agentic/taskExecutor.ts`

**Solution**: Add recovery sequences for common failures:

```typescript
/**
 * Attempt recovery after tool failure
 * Returns true if recovery was attempted (even if it failed)
 */
private async attemptRecovery(
    toolCall: ToolCall, 
    result: ToolResult
): Promise<{recovered: boolean; message: string; retryRecommended: boolean}> {
    const errorMsg = result.message?.toLowerCase() || '';
    
    // Recovery: Scene not open / node not found
    if (errorMsg.includes('no scene') || errorMsg.includes('scene not open') || 
        errorMsg.includes('node not found') || errorMsg.includes('parent node not found')) {
        
        console.log(`[TaskExecutor] 🔄 Attempting scene recovery...`);
        
        // Step 1: Get current state
        const sceneTree = await this.callbacks.executeTool("get_scene_tree", {});
        
        if (!(sceneTree as any).success) {
            // No scene open - check available scenes
            const scenes = await this.callbacks.executeTool("list_scenes", {});
            const sceneList = (scenes as any).scenes || [];
            
            if (sceneList.length > 0) {
                // Open first available scene
                await this.callbacks.executeTool("open_scene", { path: sceneList[0] });
                return {
                    recovered: true,
                    message: `Opened scene ${sceneList[0]}. Retry the operation.`,
                    retryRecommended: true
                };
            } else {
                return {
                    recovered: false,
                    message: `No scenes available. Create a scene first with create_scene.`,
                    retryRecommended: false
                };
            }
        } else {
            // Scene is open but node not found - provide context
            return {
                recovered: true,
                message: `Scene is open. Current tree: ${JSON.stringify(sceneTree)}. Check node path.`,
                retryRecommended: false
            };
        }
    }
    
    // Recovery: Script error
    if (errorMsg.includes('script') && (errorMsg.includes('error') || errorMsg.includes('syntax'))) {
        const errors = await this.callbacks.executeTool("get_errors", {});
        return {
            recovered: true,
            message: `Script has errors: ${JSON.stringify(errors)}. Fix with edit_script.`,
            retryRecommended: false
        };
    }
    
    // Recovery: Resource not found
    if (errorMsg.includes('not found') && errorMsg.includes('res://')) {
        await this.callbacks.executeTool("assets_scan", {});
        return {
            recovered: true,
            message: `Triggered filesystem scan. Wait a moment and retry.`,
            retryRecommended: true
        };
    }
    
    return { recovered: false, message: '', retryRecommended: false };
}
```

**Integration** (after tool execution fails ~line 324):

```typescript
if (!result.success) {
    // Log the error
    console.log(`[TaskExecutor] Tool ${toolCall.name} failed: ${result.message}`);
    
    // NEW: Attempt structured recovery
    const recovery = await this.attemptRecovery(toolCall, result);
    if (recovery.recovered) {
        this.conversationHistory.push(`🔧 RECOVERY: ${recovery.message}`);
        
        if (recovery.retryRecommended) {
            // Auto-retry once
            console.log(`[TaskExecutor] 🔄 Auto-retrying ${toolCall.name}...`);
            result = await this.executeToolWithRetry(toolCall);
        }
    }
}
```

---

### 0.4 Priority Order

| Item | Effort | Impact | Do First? |
|------|--------|--------|-----------|
| Deep scene tree (C++) | 2h | 🔴 Critical | Yes - fixes path errors |
| Pre-tool guardrails | 2h | 🔴 Critical | Yes - prevents common failures |
| Structured recovery | 3h | 🟠 High | Yes - auto-fixes issues |
| **Total Phase 0** | **7h** | | |

---

## 1. Executive Summary

### Problem Statement
The agent has 57+ tools and 18 recipes but cannot reliably create a simple game because:
- No unified "create game" workflow exists
- Recipes aren't auto-injected into LLM context
- SpriteMancer output doesn't flow automatically into scene creation
- Agent lacks project state awareness at task start

### Solution Overview
| Phase | Description | Priority | Effort |
|-------|-------------|----------|--------|
| **Phase 0** | **Critical Runtime Fixes (C++ & Guards)** | 🔴 Critical | 7h |
| Phase 1 | Game Creation Meta-Recipe | 🔴 Critical | 4h |
| Phase 2 | Auto-Context Enhancement | 🔴 Critical | 6h |
| Phase 3 | SpriteMancer-Scene Bridge | 🟠 High | 6h |
| Phase 4 | Plan Enforcement | 🟡 Medium | 5h |
| Phase 5 | Game Templates | 🟡 Medium | 8h |

---

## 2. Phase 1: Game Creation Meta-Recipe

### 2.1 Objective
Create a unified recipe that orchestrates the entire game creation workflow, combining SpriteMancer asset generation with Godot scene building.

### 2.2 Files to Create/Modify

#### 2.2.1 Create: `simple_game_workflow.ts`
**Path**: `src/zerograft-ai/src/mcp-servers/godot/src/prompts/recipes/simple_game_workflow.ts`

```typescript
/**
 * Simple Game Workflow Recipe
 * Master orchestration for creating a complete game with SpriteMancer
 */

export const SIMPLE_GAME_WORKFLOW_RECIPE = `
# Creating a Simple Game (Complete Workflow)

## ⚠️ CRITICAL: This is the MANDATORY execution order for game creation

You MUST follow this exact sequence. Do NOT skip steps or change order.

---

## PHASE A: Asset Generation with SpriteMancer

### Step A1: Check SpriteMancer Status
\`\`\`
Tool: spritemancer_status
Why: Verify backend is running before sprite generation
\`\`\`

### Step A2: Create Player Character Reference
\`\`\`
Tool: spritemancer_create_character
Params:
  description: "pixel art [CHARACTER_TYPE] character"
  size: "32x32" (or user preference)
  perspective: "side" (for platformer) or "front" (for top-down)
  
Wait for: Response with project_id
\`\`\`

### Step A3: User Confirmation (MANDATORY)
\`\`\`
Tool: ask_followup_question
Params:
  question: "Does this character look good? I can regenerate if needed."
  context_key: "character_approved"

Wait for: User says "yes" or approves
If no: Call spritemancer_create_character again with modified description
\`\`\`

### Step A4: Generate Idle Animation
\`\`\`
Tool: spritemancer_generate_animations
Params:
  project_id: [UUID from Step A2]
  character_name: [name from user or derived]
  animations: ["idle"]
  
Wait for: Response with spritesheet_url
\`\`\`

### Step A5: User Animation Confirmation
\`\`\`
Tool: ask_followup_question
Params:
  question: "Does the idle animation look good?"
  context_key: "idle_approved"
\`\`\`

### Step A6: Approve and Save Animation
\`\`\`
Tool: spritemancer_approve_animation
Params:
  project_id: [UUID]
  animation: "idle"
  character_name: [name]
  
IMPORTANT: Save the sprite_frames_path from the response!
Example: "res://sprites/knight_abc12345/knight.tres"
\`\`\`

### Step A7: (Optional) Generate Additional Animations
Repeat Steps A4-A6 for: walk, run, jump, attack
Always get user approval between each!

---

## PHASE B: Scene Structure Creation

### Step B1: Create Player Scene
\`\`\`
Tool: create_scene
Params:
  path: "res://scenes/Player.tscn"
  root_type: "CharacterBody2D"
\`\`\`

### Step B2: Open Player Scene
\`\`\`
Tool: open_scene
Params:
  path: "res://scenes/Player.tscn"
\`\`\`

### Step B3: Add Collision Shape
\`\`\`
Tool: add_node
Params:
  parent: "."
  type: "CollisionShape2D"
  name: "CollisionShape2D"
\`\`\`

### Step B4: Configure Collision Shape
\`\`\`
Tool: set_collision_shape
Params:
  node: "CollisionShape2D"
  shape_type: "rectangle"
  width: 32
  height: 64
\`\`\`

### Step B5: Add AnimatedSprite2D
\`\`\`
Tool: add_node
Params:
  parent: "."
  type: "AnimatedSprite2D"
  name: "AnimatedSprite2D"
\`\`\`

### Step B6: Assign Sprite Frames (USE PATH FROM A6!)
\`\`\`
Tool: set_property
Params:
  node: "AnimatedSprite2D"
  property: "sprite_frames"
  value: [sprite_frames_path from Step A6]
  
⚠️ Use EXACT path from spritemancer_approve_animation response!
⚠️ DO NOT call list_files or assets_scan!
\`\`\`

### Step B7: Create Movement Script
\`\`\`
Tool: create_script
Params:
  path: "res://scripts/player.gd"
  content: |
    extends CharacterBody2D
    
    @export var speed: float = 300.0
    @export var jump_velocity: float = -500.0
    
    var gravity: float = ProjectSettings.get_setting("physics/2d/default_gravity")
    @onready var sprite: AnimatedSprite2D = $AnimatedSprite2D
    
    func _physics_process(delta: float) -> void:
        if not is_on_floor():
            velocity.y += gravity * delta
        
        if Input.is_action_just_pressed("jump") and is_on_floor():
            velocity.y = jump_velocity
        
        var direction := Input.get_axis("move_left", "move_right")
        velocity.x = direction * speed
        
        # Animation handling
        if direction != 0:
            sprite.flip_h = direction < 0
        
        move_and_slide()
\`\`\`

### Step B8: Attach Script to Player
\`\`\`
Tool: attach_script
Params:
  node: "."
  script_path: "res://scripts/player.gd"
\`\`\`

### Step B9: Save Player Scene
\`\`\`
Tool: save_scene
\`\`\`

---

## PHASE C: Level Scene Creation

### Step C1: Create Level Scene
\`\`\`
Tool: create_scene
Params:
  path: "res://scenes/Level.tscn"
  root_type: "Node2D"
\`\`\`

### Step C2: Open Level Scene
\`\`\`
Tool: open_scene
Params:
  path: "res://scenes/Level.tscn"
\`\`\`

### Step C3: Add Camera
\`\`\`
Tool: add_node
Params:
  parent: "."
  type: "Camera2D"
  name: "Camera2D"
\`\`\`

### Step C4: Add Ground
\`\`\`
Tool: add_node
Params:
  parent: "."
  type: "StaticBody2D"
  name: "Ground"
\`\`\`

### Step C5: Add Ground Collision
\`\`\`
Tool: add_node
Params:
  parent: "Ground"
  type: "CollisionShape2D"
  name: "CollisionShape2D"
\`\`\`

### Step C6: Configure Ground Size
\`\`\`
Tool: set_collision_shape
Params:
  node: "Ground/CollisionShape2D"
  shape_type: "rectangle"
  width: 1000
  height: 50
\`\`\`

### Step C7: Position Ground
\`\`\`
Tool: set_property
Params:
  node: "Ground"
  property: "position"
  value: "Vector2(500, 500)"
\`\`\`

### Step C8: Add Ground Visual
\`\`\`
Tool: add_node
Params:
  parent: "Ground"
  type: "ColorRect"
  name: "ColorRect"

Tool: set_property
Params:
  node: "Ground/ColorRect"
  property: "size"
  value: "Vector2(1000, 50)"
  
Tool: set_property
Params:
  node: "Ground/ColorRect"
  property: "position"
  value: "Vector2(-500, -25)"
  
Tool: set_property
Params:
  node: "Ground/ColorRect"
  property: "color"
  value: "Color(0.4, 0.3, 0.2, 1)"
\`\`\`

### Step C9: Instance Player
\`\`\`
Tool: scene_instantiate
Params:
  scene_path: "res://scenes/Player.tscn"
  parent: "."
\`\`\`

### Step C10: Position Player
\`\`\`
Tool: set_property
Params:
  node: "Player"
  property: "position"
  value: "Vector2(200, 400)"
\`\`\`

### Step C11: Save Level Scene
\`\`\`
Tool: save_scene
\`\`\`

---

## PHASE D: Input Configuration

### Step D1: Add Input Actions
\`\`\`
Tool: add_input_action
Params: { action: "move_left", key: "A" }

Tool: add_input_action
Params: { action: "move_left", key: "LEFT" }

Tool: add_input_action
Params: { action: "move_right", key: "D" }

Tool: add_input_action
Params: { action: "move_right", key: "RIGHT" }

Tool: add_input_action
Params: { action: "jump", key: "SPACE" }

Tool: add_input_action
Params: { action: "jump", key: "W" }
\`\`\`

---

## PHASE E: Project Configuration & Testing

### Step E1: Set Main Scene
\`\`\`
Tool: set_project_setting
Params:
  setting: "application/run/main_scene"
  value: "res://scenes/Level.tscn"
\`\`\`

### Step E2: Run Game Test
\`\`\`
Tool: run_game
\`\`\`

### Step E3: Check for Errors
\`\`\`
Tool: get_errors
(Run after stopping game if issues occur)
\`\`\`

### Step E4: Task Completion
\`\`\`
Tool: attempt_completion
Params:
  result: "Created platformer game with [character] player. Use WASD to move, Space to jump."
  next_suggestions:
    - "Add more animations (walk, jump)"
    - "Generate background with spritemancer_generate_parallax"
    - "Add enemies"
\`\`\`

---

## COMMON MISTAKES TO AVOID

1. ❌ Calling list_files after sprite generation (path is in response!)
2. ❌ Calling assets_scan unnecessarily (slows down and may fail)
3. ❌ Skipping user confirmation for sprites
4. ❌ Using node TYPE instead of NAME in paths
5. ❌ Prefixing paths with scene root name (use "." for root)
6. ❌ Creating scripts before scene structure exists
7. ❌ Running game before setting main_scene

## RECOVERY PATTERNS

### If sprite generation fails:
1. Check spritemancer_status
2. Wait 30 seconds and retry
3. If DNA extraction fails, call spritemancer_retry_dna

### If set_property fails:
1. Verify node exists with get_scene_tree
2. Check property name spelling
3. Try different value format (e.g., "Vector2(x,y)" vs {x:x, y:y})

### If script has errors:
1. Call get_errors to see specific issue
2. Call read_script to check content
3. Fix with edit_script
`;

export const SIMPLE_GAME_KEYWORDS = [
    'game', 'create', 'make', 'build', 'simple', 'platformer', 'demo',
    'start', 'new', 'basic', 'tutorial', 'beginner', 'scratch'
];
```

#### 2.2.2 Modify: `recipes/index.ts`
**Path**: `src/zerograft-ai/src/mcp-servers/godot/src/prompts/recipes/index.ts`

Add the new recipe to the registry:

```typescript
// Add import at top
import { SIMPLE_GAME_WORKFLOW_RECIPE, SIMPLE_GAME_KEYWORDS } from './simple_game_workflow.js';

// Add to RECIPES array (make it FIRST for priority)
export const RECIPES: Recipe[] = [
    { name: 'simple_game_workflow', content: SIMPLE_GAME_WORKFLOW_RECIPE, keywords: SIMPLE_GAME_KEYWORDS },
    // ... existing recipes
];
```

### 2.3 Verification Steps
1. Run TypeScript compilation: `npm run build`
2. Test recipe lookup: `findRecipes("create game")` should return `simple_game_workflow` first
3. Test via `get_godot_help` tool with topic "create game"

---

## 3. Phase 2: Auto-Context Enhancement

### 3.1 Objective
Automatically inject relevant recipes and gather project state at the start of each task.

### 3.2 Files to Modify

#### 3.2.1 Modify: `taskExecutor.ts`
**Path**: `src/zerograft-ai/src/mcp-servers/godot/src/agentic/taskExecutor.ts`

##### Change 1: Add recipe injection method (after line ~350)

```typescript
/**
 * Find and format relevant recipes for a user request
 */
private async getRelevantRecipeContext(userRequest: string): Promise<string> {
    try {
        const { findRecipes } = await import('../prompts/recipes/index.js');
        const recipes = findRecipes(userRequest);
        
        if (recipes.length > 0) {
            // Include top recipe content (most relevant)
            let context = "\n=== RELEVANT GUIDE (Follow This!) ===\n";
            context += recipes[0].content;
            
            // Mention other available recipes
            if (recipes.length > 1) {
                context += `\n\nOther relevant guides: ${recipes.slice(1, 3).map(r => r.name).join(', ')}`;
                context += `\nUse get_godot_help(topic="[name]") to view them.`;
            }
            
            return context;
        }
    } catch (error) {
        console.error('[TaskExecutor] Recipe lookup failed:', error);
    }
    return '';
}
```

##### Change 2: Add project state gathering method (after recipe method)

```typescript
/**
 * Gather current project state for context
 * Only uses read-only tools, safe to call at task start
 */
private async gatherProjectContext(): Promise<string> {
    const context: string[] = [];
    
    // Get current scene tree
    try {
        const sceneTree = await this.callbacks.executeTool("get_scene_tree", {});
        if (sceneTree && (sceneTree as any).success) {
            context.push(`Current Scene: ${(sceneTree as any).name} (${(sceneTree as any).root})`);
            const children = (sceneTree as any).children || [];
            if (children.length > 0) {
                context.push(`  Children: ${children.map((c: any) => c.name).join(', ')}`);
            }
        } else {
            context.push('No scene currently open');
        }
    } catch {
        context.push('No scene currently open');
    }
    
    // List existing scenes
    try {
        const scenes = await this.callbacks.executeTool("list_scenes", {});
        if (scenes && (scenes as any).scenes) {
            const sceneList = (scenes as any).scenes as string[];
            if (sceneList.length > 0) {
                context.push(`Existing scenes: ${sceneList.join(', ')}`);
            } else {
                context.push('No scenes in project yet');
            }
        }
    } catch {
        context.push('Could not list scenes');
    }
    
    // Get main scene setting
    try {
        const mainScene = await this.callbacks.executeTool("get_project_setting", 
            { setting: "application/run/main_scene" });
        if (mainScene && (mainScene as any).value) {
            context.push(`Main scene: ${(mainScene as any).value}`);
        } else {
            context.push('Main scene: Not set');
        }
    } catch {
        context.push('Main scene: Not set');
    }
    
    // Check SpriteMancer availability
    try {
        const smStatus = await this.callbacks.executeTool("spritemancer_status", {});
        const running = (smStatus as any)?.running;
        context.push(`SpriteMancer: ${running ? '✅ Available' : '❌ Not running'}`);
    } catch {
        context.push('SpriteMancer: ❌ Not running');
    }
    
    return context.length > 0 ? '\n=== PROJECT STATE ===\n' + context.join('\n') : '';
}
```

##### Change 3: Modify `start` method to inject context (~line 150)

```typescript
async start(userRequest: string, imageData?: string): Promise<void> {
    console.log('[TaskExecutor] Starting task:', userRequest.substring(0, 50));
    this.setState(TaskState.RUNNING);
    this.context.userRequest = userRequest;
    this.pendingImageData = imageData;
    
    // NEW: Gather project context and relevant recipes at task start
    this.callbacks.onProgress("Analyzing project state...");
    const projectContext = await this.gatherProjectContext();
    const recipeContext = await this.getRelevantRecipeContext(userRequest);
    
    // Add to conversation history as system context
    if (projectContext || recipeContext) {
        this.conversationHistory.push(
            `=== TASK START CONTEXT ===` +
            projectContext +
            recipeContext +
            `\n=== END CONTEXT ===`
        );
    }
    
    // Add user message
    this.conversationHistory.push(`User: ${userRequest}`);
    
    // Start the agentic loop
    await this.runLoop();
}
```

##### Change 4: Modify `buildContextString` to include state info (~line 361)

```typescript
private buildContextString(): string {
    const parts = [
        "=== Conversation History ===",
        ...this.conversationHistory,
        "",
        "=== Current Task State ===",
        `Tool calls: ${this.context.toolCallCount}/${this.settings.maxToolCallsPerTask}`,
        `Created files: ${this.context.artifacts.createdFiles.join(", ") || "none"}`,
        `Modified files: ${this.context.artifacts.modifiedFiles.join(", ") || "none"}`,
        `Added nodes: ${this.context.artifacts.addedNodes.join(", ") || "none"}`,
    ];
    
    // Add plan status if active
    if (this.planState && this.planState.stepCount > 0) {
        parts.push("");
        parts.push("=== PLAN STATUS ===");
        parts.push(`Current step: ${this.planState.currentStepIndex + 1} of ${this.planState.stepCount}`);
        parts.push(`Focus on completing step ${this.planState.currentStepIndex + 1} before proceeding.`);
    }
    
    return parts.join("\n");
}
```

### 3.3 Verification Steps
1. Start a new task with "create a simple game"
2. Check console logs for "[TaskExecutor] Analyzing project state..."
3. Verify LLM receives project context and simple_game_workflow recipe
4. Test that SpriteMancer status is checked automatically

---

## 4. Phase 3: SpriteMancer-Scene Bridge

### 4.1 Objective
Create automatic workflows that bridge SpriteMancer output to scene creation.

### 4.2 Files to Create/Modify

#### 4.2.1 Modify: `spritemancerHandler.ts`
**Path**: `src/zerograft-ai/src/mcp-servers/godot/src/handlers/spritemancerHandler.ts`

##### Change 1: Add `next_action` to `approveAnimation` response (~line 602)

```typescript
private async approveAnimation(params: Record<string, unknown>): Promise<unknown> {
    // ... existing code ...
    
    return {
        success: true,
        phase: "approval",
        project_id: projectId,
        approved_animation: animationType,
        download_result: downloadResult,
        sprite_frames_path: downloadResult.sprite_frames_path,  // Bubble up the path!
        message: `✅ "${animationType}" approved and saved to Godot!`,
        
        // NEW: Explicit next action guidance
        next_action: {
            description: "Now create an AnimatedSprite2D node and assign the sprite frames",
            option_1: {
                tool: "setup_player_with_sprites",
                description: "Automated: Creates complete player scene with the sprites",
                params: {
                    sprite_frames_path: downloadResult.sprite_frames_path,
                    player_name: characterName
                }
            },
            option_2: {
                tool: "set_property",
                description: "Manual: Set sprite_frames on existing AnimatedSprite2D",
                params: {
                    node: "AnimatedSprite2D",
                    property: "sprite_frames",
                    value: downloadResult.sprite_frames_path
                }
            }
        },
        
        // Reinforcement for LLM
        important_note: `Use sprite_frames_path="${downloadResult.sprite_frames_path}" directly. DO NOT call list_files or assets_scan!`
    };
}
```

##### Change 2: Add `next_action` to `createCharacter` response (~line 195)

```typescript
// After line 195, modify the response object
const response: Record<string, unknown> = {
    // ... existing fields ...
    
    // NEW: Clearer next action
    next_action: {
        description: "Ask user if the character looks good before generating animations",
        tool: "ask_followup_question",
        params: {
            question: "Does this character look good? I can regenerate with a different description if needed.",
            choices: ["Yes, looks good!", "No, try again"],
            context_key: "character_approval"
        }
    },
    
    workflow_hint: `After user approval, call spritemancer_generate_animations with project_id="${character.project_id}"`
};
```

#### 4.2.2 Create: `setup_player_with_sprites` tool
**Path**: Add to `src/zerograft-ai/src/mcp-servers/godot/src/handlers/agenticToolHandler.ts`

```typescript
// Add new case in handle() method switch statement
case "setup_player_with_sprites":
    return this.setupPlayerWithSprites(params);

// Add new method
private async setupPlayerWithSprites(params: Record<string, unknown>): Promise<unknown> {
    const spriteFramesPath = params.sprite_frames_path as string;
    const playerName = (params.player_name as string) || "Player";
    const scenePath = (params.scene_path as string) || `res://scenes/${playerName}.tscn`;
    const scriptPath = `res://scripts/${playerName.toLowerCase()}.gd`;
    
    if (!spriteFramesPath) {
        return { success: false, error: "sprite_frames_path is required" };
    }
    
    console.log(`[AgenticTool] 🎮 Setting up player with sprites: ${spriteFramesPath}`);
    
    const results: { step: string; success: boolean; details?: unknown }[] = [];
    
    try {
        // Step 1: Create player scene
        const createResult = await this.ctx.sendToGodot("create_scene", {
            path: scenePath,
            root_type: "CharacterBody2D"
        });
        results.push({ step: "create_scene", success: (createResult as any).success, details: createResult });
        
        // Step 2: Open the scene
        await this.ctx.sendToGodot("open_scene", { path: scenePath });
        results.push({ step: "open_scene", success: true });
        
        // Step 3: Add CollisionShape2D
        const collisionResult = await this.ctx.sendToGodot("add_node", {
            parent: ".",
            type: "CollisionShape2D",
            name: "CollisionShape2D"
        });
        results.push({ step: "add_collision", success: (collisionResult as any).success });
        
        // Step 4: Set collision shape
        const shapeResult = await this.ctx.sendToGodot("set_collision_shape", {
            node: "CollisionShape2D",
            shape_type: "capsule",
            radius: 16,
            height: 32
        });
        results.push({ step: "set_shape", success: (shapeResult as any).success });
        
        // Step 5: Add AnimatedSprite2D
        const spriteResult = await this.ctx.sendToGodot("add_node", {
            parent: ".",
            type: "AnimatedSprite2D",
            name: "AnimatedSprite2D"
        });
        results.push({ step: "add_sprite", success: (spriteResult as any).success });
        
        // Step 6: Set sprite_frames
        const framesResult = await this.ctx.sendToGodot("set_property", {
            node: "AnimatedSprite2D",
            property: "sprite_frames",
            value: spriteFramesPath
        });
        results.push({ step: "set_sprite_frames", success: (framesResult as any).success });
        
        // Step 7: Create movement script
        const scriptContent = `extends CharacterBody2D

@export var speed: float = 300.0
@export var jump_velocity: float = -500.0

var gravity: float = ProjectSettings.get_setting("physics/2d/default_gravity")
@onready var sprite: AnimatedSprite2D = $AnimatedSprite2D

func _physics_process(delta: float) -> void:
    if not is_on_floor():
        velocity.y += gravity * delta
    
    if Input.is_action_just_pressed("jump") and is_on_floor():
        velocity.y = jump_velocity
    
    var direction := Input.get_axis("move_left", "move_right")
    velocity.x = direction * speed
    
    if direction != 0:
        sprite.flip_h = direction < 0
    
    move_and_slide()
`;
        
        const scriptResult = await this.ctx.sendToGodot("create_script", {
            path: scriptPath,
            content: scriptContent
        });
        results.push({ step: "create_script", success: (scriptResult as any).success });
        
        // Step 8: Attach script
        const attachResult = await this.ctx.sendToGodot("attach_script", {
            node: ".",
            script_path: scriptPath
        });
        results.push({ step: "attach_script", success: (attachResult as any).success });
        
        // Step 9: Save scene
        const saveResult = await this.ctx.sendToGodot("save_scene", {});
        results.push({ step: "save_scene", success: (saveResult as any).success });
        
        const allSuccess = results.every(r => r.success);
        
        return {
            success: allSuccess,
            scene_path: scenePath,
            script_path: scriptPath,
            sprite_frames_path: spriteFramesPath,
            steps_completed: results,
            message: allSuccess 
                ? `✅ Created player "${playerName}" with all components!`
                : `⚠️ Some steps failed. Check steps_completed for details.`,
            next_steps: [
                "Create a Level scene and instance Player.tscn",
                "Set up input actions (move_left, move_right, jump)",
                "Set application/run/main_scene to your Level scene"
            ]
        };
        
    } catch (error) {
        return {
            success: false,
            error: String(error),
            steps_completed: results
        };
    }
}
```

#### 4.2.3 Add tool definition
**Path**: `src/zerograft-ai/src/mcp-servers/godot/src/prompts/tools/agentic/index.ts`

```typescript
export const setup_player_with_sprites: GodotToolSpec = {
    id: "setup_player_with_sprites",
    variant: ModelFamily.GENERIC,
    name: "setup_player_with_sprites",
    description: "AUTOMATED WORKFLOW: Creates a complete player scene (CharacterBody2D) with collision, AnimatedSprite2D assigned with sprites, movement script, all in one call. Use after spritemancer_approve_animation.",
    whenToUse: "After receiving sprite_frames_path from spritemancer_approve_animation. This automates the entire player scene creation.",
    parameters: [
        {
            name: "sprite_frames_path", required: true, type: "string",
            description: "Path to .tres file from spritemancer_approve_animation (e.g., 'res://sprites/knight_xxx/knight.tres')"
        },
        {
            name: "player_name", required: false, type: "string",
            description: "Player name for scene/script files (default: 'Player')"
        },
        {
            name: "scene_path", required: false, type: "string",
            description: "Custom scene path (default: 'res://scenes/[player_name].tscn')"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why creating this player"
        }
    ]
};

// Add to agenticTools array
export const agenticTools: GodotToolSpec[] = [
    // ... existing tools
    setup_player_with_sprites,
];
```

### 4.3 Verification Steps
1. Run through SpriteMancer flow: create_character → approve → generate_animations → approve_animation
2. Verify `next_action` appears in responses
3. Test `setup_player_with_sprites` creates complete player scene
4. Verify sprite_frames is correctly assigned (run game, player should have animation)

---

## 5. Phase 4: Plan Enforcement

### 5.1 Objective
Ensure the agent follows created plans and verifies step completion.

### 5.2 Files to Modify

#### 5.2.1 Modify: `taskExecutor.ts`
**Path**: `src/zerograft-ai/src/mcp-servers/godot/src/agentic/taskExecutor.ts`

##### Change: Add plan step verification (~after line 300)

```typescript
/**
 * Verify that a plan step was actually completed
 */
private async verifyStepCompletion(toolName: string, params: Record<string, unknown>, result: any): Promise<{verified: boolean; evidence?: string}> {
    // Skip verification for read-only tools
    const readOnlyTools = ['get_scene_tree', 'read_script', 'get_errors', 'list_scenes', 'get_property'];
    if (readOnlyTools.includes(toolName)) {
        return { verified: true, evidence: 'Read-only tool' };
    }
    
    // Verification by tool type
    switch (toolName) {
        case 'create_scene': {
            const path = params.path as string;
            try {
                const scenes = await this.callbacks.executeTool("list_scenes", {});
                const exists = ((scenes as any).scenes || []).includes(path);
                return { verified: exists, evidence: exists ? `Scene ${path} exists` : `Scene ${path} not found` };
            } catch {
                return { verified: result.success, evidence: 'Could not verify' };
            }
        }
        
        case 'add_node': {
            const name = params.name as string;
            try {
                const tree = await this.callbacks.executeTool("get_scene_tree", {});
                const children = (tree as any).children || [];
                const exists = children.some((c: any) => c.name === name);
                return { verified: exists, evidence: exists ? `Node ${name} exists` : `Node ${name} not found` };
            } catch {
                return { verified: result.success, evidence: 'Could not verify' };
            }
        }
        
        case 'create_script': {
            const path = params.path as string;
            try {
                const content = await this.callbacks.executeTool("read_script", { path });
                const exists = !!(content as any).content;
                return { verified: exists, evidence: exists ? `Script ${path} exists` : `Script ${path} not found` };
            } catch {
                return { verified: result.success, evidence: 'Could not verify' };
            }
        }
        
        default:
            return { verified: result.success, evidence: 'Verified by result.success' };
    }
}
```

##### Change: Inject verification into tool processing loop

```typescript
// After tool execution (~line 295), add:
if (result.success && this.planState) {
    const verification = await this.verifyStepCompletion(toolCall.name, toolCall.params, result);
    
    if (!verification.verified) {
        // Add warning to conversation for LLM to see
        this.conversationHistory.push(
            `⚠️ VERIFICATION WARNING: Tool ${toolCall.name} reported success but verification failed.\n` +
            `Evidence: ${verification.evidence}\n` +
            `Consider retrying or verifying manually with get_scene_tree.`
        );
    }
}
```

### 5.3 Verification Steps
1. Start a multi-step task with `start_plan`
2. Verify each step gets verified after completion
3. Test that failed verification injects warning to context
4. Confirm agent recovers from verification failures

---

## 6. Phase 5: Game Templates (Future)

### 6.1 Objective
Pre-built game templates that can be instantiated with customization.

### 6.2 Structure
```
src/zerograft-ai/src/mcp-servers/godot/templates/
├── minimal_platformer/
│   ├── template.json        # Template metadata
│   ├── scenes/
│   │   ├── Level.tscn
│   │   └── Player.tscn
│   ├── scripts/
│   │   └── player.gd
│   └── README.md
├── top_down_rpg/
└── endless_runner/
```

### 6.3 Implementation (Deferred)
This phase is lower priority - the meta-recipe + compound tools approach is more flexible.

---

## 7. Testing Strategy

### 7.1 Unit Tests

```typescript
// tests/recipes.test.ts
describe('Recipe Lookup', () => {
    it('should find simple_game_workflow for "create game"', () => {
        const recipes = findRecipes("create game");
        expect(recipes[0].name).toBe('simple_game_workflow');
    });
    
    it('should find simple_game_workflow for "make platformer"', () => {
        const recipes = findRecipes("make platformer");
        expect(recipes[0].name).toBe('simple_game_workflow');
    });
});
```

### 7.2 Integration Tests

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| **Recipe Injection** | Ask "create simple game" | LLM receives workflow recipe in context |
| **SpriteMancer Flow** | Create character → approve | Correct project_id passed through |
| **Auto Player Setup** | Call setup_player_with_sprites | Scene with all components created |
| **Full Game Creation** | "create simple platformer" | Playable game with player movement |

### 7.3 Manual Testing Checklist

- [ ] TypeScript compiles without errors
- [ ] AI Router starts successfully
- [ ] Connect to Godot bridge
- [ ] Ask "create a simple platformer game"
- [ ] Verify SpriteMancer status is checked first
- [ ] Verify character creation triggers approval question
- [ ] Verify animation generation and approval
- [ ] Verify player scene has AnimatedSprite2D with sprites
- [ ] Verify Level scene has player instanced
- [ ] Verify input actions are configured
- [ ] Run game and test movement

---

## 8. Rollout Plan

### Week 0: Critical Runtime Fixes (Phase 0) ⚡ DO FIRST!
- [x] Day 1: Deep scene tree C++ implementation (recursive serialization) ✅ **COMPLETED**
  - Added `_serialize_node_recursive()` helper function
  - Updated `get_scene_tree()` to accept `max_depth` parameter (default 5)
  - Added script info, visibility, and nested children to output
  - Updated command registry for new parameter
- [x] Day 2: Rebuild Godot with updated `bridge_commands_scene.cpp` ⚠️ **REQUIRES GODOT REBUILD**
- [x] Day 3: Pre-tool guardrails in `taskExecutor.ts` ✅ **COMPLETED**
  - Added `TOOLS_REQUIRING_SCENE` set
  - Implemented `ensureToolPreconditions()` method
  - Checks for open scene before scene-requiring tools
  - Injects guidance into conversation history on failure
- [x] Day 4: Structured error recovery in `taskExecutor.ts` ✅ **COMPLETED**
  - Added `ERROR_RECOVERY_STRATEGIES` with pattern matching
  - Implemented `attemptRecovery()` method
  - Enhanced error messages with recovery hints
- [x] Day 5: Test all guardrails and recovery sequences ✅ **COMPLETED**
  - Created `src/tests/phase0.test.ts` - 33 unit tests
  - Created `src/tests/phase0-integration.test.ts` - 5 integration tests
  - Created `src/tests/PHASE0_CPP_TEST_SCENARIOS.md` - 10 manual C++ test scenarios
  - All 38 automated tests passing
  - Run tests with: `npm test`

### Week 1: Foundation (Phases 1-2)
- [x] Day 1-2: Create `simple_game_workflow.ts` recipe ✅ **COMPLETED**
  - Created comprehensive 5-phase game creation workflow
  - Covers SpriteMancer → Scene → Level → Input → Testing
  - 300+ lines of step-by-step instructions
  - 29 unit tests passing
- [x] Day 2: Updated `recipes/index.ts` with priority system ✅ **COMPLETED**
  - Added priority field for recipe ordering
  - simple_game_workflow matched first for game creation requests
  - Updated findRecipes to support multi-word keyword matching
- [x] Day 3-4: Implement auto-context enhancement in `taskExecutor.ts` ✅ **COMPLETED**
  - Added `getRelevantRecipeContext()` - injects relevant recipe into LLM context
  - Added `gatherProjectContext()` - gathers scene tree, existing scenes, main scene, SpriteMancer status
  - Modified `startTask()` to inject context at task start
  - Enhanced `buildContextString()` to include plan status
  - 8 integration tests passing
- [x] Day 5: Testing and bug fixes ✅ **COMPLETED**
  - Created `tests/phase2-context.test.ts` - 8 integration tests
  - All 80+ tests across Phase 0/1/2 passing

### Week 2: Bridge (Phase 3)
- [x] Day 1-2: Add `next_action` to SpriteMancer responses ✅ **COMPLETED**
  - Enhanced `generateAnimations` with `next_action.if_approved` and `if_rejected` guidance
  - Enhanced `approveAnimation` with `sprite_frames_path` at top level
  - Added `next_action.recommended` (setup_player_with_sprites) and `alternative` (manual steps)
  - Added `important_note` to prevent list_files/assets_scan mistakes
- [x] Day 3-4: Implement `setup_player_with_sprites` compound tool ✅ **COMPLETED**
  - Creates CharacterBody2D scene with CollisionShape2D, AnimatedSprite2D
  - Assigns SpriteFrames resource from spritemancer_approve_animation
  - Generates and attaches platformer movement script
  - 9-step process with detailed step tracking
  - Added tool definition to agenticTools
- [x] Day 5: Integration testing ✅ **COMPLETED**
  - All existing tests (75+) passing
  - TypeScript build successful

### Week 3: Polish (Phase 4)
- [x] Day 1: Smart plan skipping for small tasks ✅ **COMPLETED**
  - Added `isSmallTask()` function to detect simple tasks
  - Pattern matching for node operations, property changes, queries
  - Short request detection (<= 4 words)
  - Updated `getRelevantRecipeContext()` to inject skip-plan guidance
  - Updated `start_plan` tool definition with `whenNotToUse`
  - 30 tests passing
- [ ] Day 2: Add plan step verification
- [ ] Day 3: End-to-end testing
- [ ] Day 4-5: Documentation and cleanup

---

## File Change Summary

| File | Action | Phase |
|------|--------|-------|
| **`modules/godot_bridge/bridge_commands_scene.cpp`** | **MODIFY** | **0** ✅ |
| **`modules/godot_bridge/godot_bridge.h`** | **MODIFY** | **0** ✅ |
| **`modules/godot_bridge/godot_bridge.cpp`** | **MODIFY** | **0** ✅ |
| **`agentic/taskExecutor.ts`** | **MODIFY** | **0**, **2**, **4** ✅ |
| **`agentic/types.ts`** | **MODIFY** | **0** ✅ |
| **`tests/phase0.test.ts`** | **CREATE** | **0** ✅ |
| **`tests/phase0-integration.test.ts`** | **CREATE** | **0** ✅ |
| **`tests/PHASE0_CPP_TEST_SCENARIOS.md`** | **CREATE** | **0** ✅ |
| **`prompts/recipes/simple_game_workflow.ts`** | **CREATE** | **1** ✅ |
| **`prompts/recipes/index.ts`** | **MODIFY** | **1**, **4** ✅ |
| **`tests/phase1-recipes.test.ts`** | **CREATE** | **1** ✅ |
| **`tests/phase2-context.test.ts`** | **CREATE** | **2** ✅ |
| **`handlers/spritemancerHandler.ts`** | **MODIFY** | **3** ✅ |
| **`handlers/agenticToolHandler.ts`** | **MODIFY** | **3** ✅ |
| **`prompts/tools/agentic/index.ts`** | **MODIFY** | **3**, **4** ✅ |
| **`tests/phase3-bridge.test.ts`** | **CREATE** | **3** ✅ |
| **`tests/phase4-small-tasks.test.ts`** | **CREATE** | **4** ✅ |

---

## Success Metrics

1. **Primary**: Agent can create a playable platformer game in <15 tool calls
2. **Secondary**: No looping or repeated failed attempts during game creation
3. **Tertiary**: User intervention only needed for sprite approval (by design)

---

## Notes

- All changes are additive and backward-compatible
- Existing tool functionality is unaffected
- Recipe system is opt-in (auto-injected but doesn't break manual use)
- Compound tools are optional (agent can still use individual tools)
