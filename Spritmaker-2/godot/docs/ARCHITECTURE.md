# 🏗️ Agentic Godot Architecture

> A comprehensive guide to how everything works under the hood.

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Layer Architecture](#layer-architecture)
3. [Godot C++ Module](#godot-c-module)
4. [TypeScript Agentic Layer](#typescript-agentic-layer)
5. [Gemini 3 Integration](#gemini-3-integration)
6. [Multi-Agent Orchestrator](#multi-agent-orchestrator)
7. [SpriteMancer Integration](#spritemancer-integration)
8. [Tool System](#tool-system)
9. [Communication Flow](#communication-flow)
10. [File Structure](#file-structure)

---

## System Overview

Agentic Godot is a **fork of Godot Engine** with AI capabilities built directly into the editor. The system consists of three main layers:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                                   │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  🎮 Godot Editor (C++ Fork)                                     │    │
│  │  ├── AI Panel (ai_panel.cpp) - Chat + streaming UI             │    │
│  │  ├── Monaco Code Editor - Syntax highlighting                   │    │
│  │  ├── SpriteMancer Dock - Embedded CEF browser                   │    │
│  │  └── Scene Tree / Inspector - Standard Godot UI                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│                      COMMUNICATION BRIDGE                               │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  🔌 TCP Socket Connection (Port 9876)                           │    │
│  │  ├── godot_bridge.cpp → godotBridge.ts                         │    │
│  │  ├── JSON-RPC style messaging                                   │    │
│  │  └── Bidirectional event streaming                              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│                      AI AGENTIC LAYER                                   │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  🤖 TypeScript MCP Server (Node.js)                             │    │
│  │  ├── aiRouter.ts - Main orchestrator                            │    │
│  │  ├── geminiLLMv2.ts - Gemini 3 API                              │    │
│  │  ├── taskExecutor.ts - Agentic loop                             │    │
│  │  ├── Multi-Agent System - Specialized agents                    │    │
│  │  └── Tool Registry - 87 native functions                        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│                      EXTERNAL SERVICES                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  🎨 SpriteMancer Backend (Python/FastAPI)                       │    │
│  │  ├── Nana Banana Pro - Image generation                         │    │
│  │  ├── DNA extraction - Character analysis                        │    │
│  │  └── Animation pipeline - Frame generation                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Layer Architecture

### 1. Godot Editor (C++ Fork)

The forked Godot engine includes custom modules in `src/agentic-godot/modules/godot_bridge/`:

| File | Lines | Purpose |
|------|-------|---------|
| `ai_panel.cpp` | 2,425 | Main AI chat panel with streaming UI |
| `godot_bridge.cpp` | ~800 | TCP socket server for MCP communication |
| `bridge_commands_scene.cpp` | ~1,000 | Scene manipulation commands |
| `bridge_commands_script.cpp` | ~200 | GDScript editing commands |
| `bridge_commands_input.cpp` | ~350 | Input action configuration |
| `bridge_commands_filesystem.cpp` | ~280 | File system operations |
| `bridge_commands_advanced.cpp` | ~950 | Composite/advanced commands |
| `spritemancer_dock.cpp` | ~950 | Embedded CEF browser for SpriteMancer |

### 2. TypeScript Agentic Layer

The MCP server runs as a Node.js process in `src/zerograft-ai/src/mcp-servers/godot/src/`:

| File | Lines | Purpose |
|------|-------|---------|
| `aiRouter.ts` | ~550 | Main request router and orchestrator |
| `geminiLLMv2.ts` | 289 | Gemini 3 API with thinking/streaming |
| `taskExecutor.ts` | 1,270 | Agentic loop with error recovery |
| `spritemancerClient.ts` | 618 | SpriteMancer backend API client |
| `godotBridge.ts` | 215 | TCP client connection to Godot |

### 3. SpriteMancer Backend

Python/FastAPI server for AI asset generation (separate repository):

| Component | Purpose |
|-----------|---------|
| Character generation | Create reference images from prompts |
| DNA extraction | Analyze character pose, colors, anatomy |
| Animation pipeline | Generate animation frames |
| Tileset generation | Create seamless tile patterns |
| Parallax generation | Multi-layer backgrounds with alpha |

---

## Godot C++ Module

### AI Panel (`ai_panel.cpp`)

The AI Panel is a custom Godot editor dock that provides:

```cpp
class AIPanel : public VBoxContainer {
    // Chat UI
    RichTextLabel *chat_history;      // Message display with streaming
    TextEdit *input_field;            // User input
    Button *send_button;              // Send message
    
    // Attachments
    Vector<Ref<Image>> attached_images;  // Screenshot attachments
    HBoxContainer *thumbnail_row;        // Image previews
    
    // Streaming state
    String current_streaming_text;
    bool is_streaming;
    
    // Connection
    GodotBridge *bridge;              // TCP connection to MCP server
};
```

**Key Features:**
- Real-time token streaming display
- Image attachment support (drag & drop)
- Context-aware suggestions
- Plan progress tracking
- Error display with recovery options

### Godot Bridge (`godot_bridge.cpp`)

The bridge provides bidirectional communication:

```cpp
class GodotBridge : public Node {
    // TCP Server
    Ref<TCPServer> server;
    Ref<StreamPeerTCP> client;
    int port = 9876;
    
    // Message handling
    void process_message(const String &json);
    String execute_command(const String &cmd, const Dictionary &args);
    
    // Events
    void emit_scene_changed(const String &path);
    void emit_node_selected(const String &path);
    void emit_script_modified(const String &path);
};
```

**Command Categories:**
1. **Scene Commands** - `create_scene`, `add_node`, `save_scene`, `get_scene_tree`
2. **Script Commands** - `create_script`, `set_script_content`, `get_errors`
3. **Input Commands** - `add_input_action`, `connect_signal`
4. **File Commands** - `list_files`, `read_file`, `create_folder`
5. **Resource Commands** - `create_resource`, `set_property`
6. **Advanced Commands** - `setup_player_collision`, `setup_tilemap_with_physics`

---

## TypeScript Agentic Layer

### AI Router (`aiRouter.ts`)

The main orchestrator handles:

```typescript
class AIRouter {
    // Components
    private gemini: GeminiLLMv2;
    private bridge: GodotBridge;
    private taskExecutor: TaskExecutor;
    private spritemancer: SpriteMancerClient;
    
    // Request flow
    async handleRequest(prompt: string, images?: string[]): Promise<Response> {
        // 1. Analyze request for tool categories
        const tools = await selectTools(prompt);
        
        // 2. Build context (current scene, selection, etc.)
        const context = await this.bridge.getContext();
        
        // 3. Call Gemini with tools
        const response = await this.gemini.chat(prompt, tools, context, images);
        
        // 4. Execute tool calls
        for (const toolCall of response.toolCalls) {
            await this.executeToolCall(toolCall);
        }
        
        return response;
    }
}
```

### Task Executor (`taskExecutor.ts`)

The agentic loop engine with:

```typescript
class TaskExecutor {
    // State management
    private loopCount: number = 0;
    private maxLoops: number = 50;
    private contextSummary: string = "";
    
    // Error recovery
    private errorRecoveryStrategies: Map<ErrorType, RecoveryStrategy>;
    
    // Main loop
    async runLoop(): Promise<void> {
        while (!this.isComplete && this.loopCount < this.maxLoops) {
            // 1. Check for loop detection
            if (this.detectLoop()) {
                await this.breakLoop();
            }
            
            // 2. Inject relevant recipes
            const recipes = findRecipes(this.currentTask);
            
            // 3. Get next action from Gemini
            const action = await this.gemini.getNextAction(this.state, recipes);
            
            // 4. Execute with error recovery
            try {
                await this.executeAction(action);
            } catch (error) {
                await this.handleError(error);
            }
            
            // 5. Update plan progress
            this.updatePlanProgress(action);
            
            this.loopCount++;
        }
    }
}
```

**Features:**
- **Loop Detection** - Prevents infinite repetition of failed actions
- **Context Summarization** - Compresses history to stay within token limits
- **Recipe Injection** - Guides AI with relevant workflow patterns
- **Error Recovery** - Automatic retry with alternative strategies
- **Plan Tracking** - Updates step completion in real-time

---

## Gemini 3 Integration

### GeminiLLMv2 (`geminiLLMv2.ts`)

```typescript
class GeminiLLMv2 {
    private client: GoogleGenerativeAI;
    private modelName: string;
    
    // Gemini 3 features
    supportsThinking(): boolean {
        return this.modelName.includes("2.5") || 
               this.modelName.includes("gemini-3");
    }
    
    async chat(
        prompt: string,
        tools: GeminiFunctionDeclaration[],
        context: GodotContext,
        images?: string[]
    ): Promise<ChatResponse> {
        const modelParams: GenerativeModelParams = {
            model: this.modelName,
            tools: [{ functionDeclarations: tools }],  // Native function calling
        };
        
        // Enable thinking for Gemini 3
        if (this.supportsThinking()) {
            modelParams.generationConfig = {
                thinkingConfig: {
                    thinkingLevel: "low",
                    includeThoughts: true
                }
            };
        }
        
        // Build multimodal message
        const parts: Part[] = [{ text: prompt }];
        for (const img of images) {
            parts.push({
                inlineData: { mimeType: "image/png", data: img }
            });
        }
        
        // Stream response
        const result = await model.sendMessageStream(parts);
        return this.processStream(result);
    }
}
```

**Gemini 3 Features Used:**
1. **Native Function Calling** - 87 tools as function declarations
2. **Extended Thinking** - Planning mode for complex requests
3. **Streaming Responses** - Token-by-token display
4. **Multimodal Vision** - Screenshot analysis

---

## Multi-Agent Orchestrator

### Agent Architecture (`agentic/agents/`)

```typescript
// Base Agent
abstract class BaseAgent {
    protected gemini: GeminiLLMv2;
    protected tools: GodotToolSpec[];
    
    abstract getSystemPrompt(): string;
    abstract getSpecializedTools(): string[];
    
    async execute(task: AgentTask): Promise<AgentResult> {
        // Agent-specific execution
    }
}

// Specialized Agents
class ArchitectureAgent extends BaseAgent {
    // Designs overall game structure
    // Tools: scene management, resource organization
}

class CharacterAgent extends BaseAgent {
    // Creates player/NPC characters
    // Tools: SpriteMancer, AnimatedSprite2D setup
}

class LevelAgent extends BaseAgent {
    // Builds game levels
    // Tools: TileMap, parallax, decorations
}

class QAAgent extends BaseAgent {
    // Verifies game functionality
    // Tools: error checking, test execution
}
```

### Orchestrator State Machine

```typescript
type OrchestratorState = 
    | "idle"
    | "analyzing"
    | "planning"
    | "delegating"
    | "monitoring"
    | "integrating"
    | "verifying"
    | "complete";

class Orchestrator {
    private state: OrchestratorState = "idle";
    private agents: Map<string, BaseAgent>;
    private taskQueue: AgentTask[];
    
    async processRequest(request: string): Promise<void> {
        // 1. Analyze → Break down into sub-tasks
        this.state = "analyzing";
        const tasks = await this.analyzeRequest(request);
        
        // 2. Plan → Assign tasks to agents
        this.state = "planning";
        const assignments = this.assignToAgents(tasks);
        
        // 3. Delegate → Execute in parallel where possible
        this.state = "delegating";
        await Promise.all(
            assignments.map(a => this.agents.get(a.agent).execute(a.task))
        );
        
        // 4. Verify → QA agent checks result
        this.state = "verifying";
        await this.agents.get("qa").verify();
    }
}
```

---

## SpriteMancer Integration

### Client (`spritemancerClient.ts`)

```typescript
class SpriteMancerClient {
    private baseUrl: string = "http://localhost:8000";
    
    // Character Pipeline
    async createCharacter(opts: CharacterOptions): Promise<Project> {
        const response = await fetch(`${this.baseUrl}/generate`, {
            method: "POST",
            body: JSON.stringify({
                prompt: opts.description,
                size: opts.size,
                perspective: opts.perspective
            })
        });
        return response.json();
    }
    
    async generateAnimations(
        projectId: string, 
        animations: string[]
    ): Promise<AnimationResult[]> {
        // Wait for DNA extraction
        await this.waitForDNA(projectId);
        
        // Generate each animation
        const results = [];
        for (const anim of animations) {
            const result = await fetch(`${this.baseUrl}/animate/${projectId}`, {
                method: "POST",
                body: JSON.stringify({ animation_type: anim })
            });
            results.push(await result.json());
        }
        return results;
    }
    
    // Tileset Generation
    async generateTerrain(opts: TerrainOptions): Promise<TilesetResult> {
        return fetch(`${this.baseUrl}/tileset/terrain`, {
            method: "POST",
            body: JSON.stringify(opts)
        }).then(r => r.json());
    }
    
    // Parallax Generation
    async generateParallax(opts: ParallaxOptions): Promise<ParallaxResult> {
        return fetch(`${this.baseUrl}/parallax`, {
            method: "POST",
            body: JSON.stringify(opts)
        }).then(r => r.json());
    }
}
```

### SpriteMancer Features

| Feature | Endpoint | Output |
|---------|----------|--------|
| Character creation | `/generate` | Reference PNG + project ID |
| DNA extraction | `/dna/{id}` | Pose, colors, anatomy data |
| Animation | `/animate/{id}` | Frame PNGs |
| Terrain tileset | `/tileset/terrain` | 9-tile seamless PNG |
| Platform tiles | `/tileset/platform` | 6-piece platform PNG |
| Parallax | `/parallax` | 3-layer background PNGs |
| VFX effects | `/effect` | Animated spritesheet |
| Godot export | `/export/tres` | .tres TileSet resource |

---

## Tool System

### Tool Definition (`prompts/tools/`)

```typescript
interface GodotToolSpec {
    id: string;                           // Unique identifier
    name: string;                         // Function name for Gemini
    description: string;                  // What the tool does
    whenToUse: string;                    // Usage guidance
    whenNotToUse?: string;                // Avoid misuse
    parameters: ParameterSpec[];          // Input parameters
    contextRequirements?: (ctx) => boolean;  // When to show tool
}

// Example tool
const create_scene: GodotToolSpec = {
    id: "create_scene",
    name: "create_scene",
    description: "Create a new scene with root node",
    whenToUse: "When starting a new scene or creating reusable prefab",
    parameters: [
        { name: "path", type: "string", description: "res:// path" },
        { name: "root_type", type: "string", description: "Node2D, CharacterBody2D" },
        { name: "root_name", type: "string", description: "Name of root node" }
    ]
};
```

### Tool Categories (87 total)

| Category | Count | Location |
|----------|-------|----------|
| Scene | 17 | `tools/scene/index.ts` |
| Script | 8 | `tools/script/index.ts` |
| Spritemancer | 25 | `tools/spritemancer/index.ts` |
| Agentic | 7 | `tools/agentic/index.ts` |
| Input | 9 | `tools/input/index.ts` |
| Files | 7 | `tools/files/index.ts` |
| Resources | 14 | `tools/resources/index.ts` |

### Dynamic Tool Selection

```typescript
async function selectTools(prompt: string): Promise<GodotToolSpec[]> {
    const categories = analyzeRequest(prompt);
    
    // Map keywords to tool categories
    if (prompt.includes("character") || prompt.includes("sprite")) {
        categories.add("spritemancer");
    }
    if (prompt.includes("scene") || prompt.includes("node")) {
        categories.add("scene");
    }
    // ... more category detection
    
    return GodotToolSet.getToolsForCategories(categories);
}
```

---

## Communication Flow

### Request Lifecycle

```
1. User types in AI Panel (Godot C++)
   └── "Create a knight with idle animation"

2. AI Panel sends via TCP to MCP Server
   └── { type: "request", prompt: "...", images: [...] }

3. aiRouter.ts receives and processes
   ├── Analyzes request for tool categories
   ├── Builds context (current scene, selection)
   └── Calls Gemini 3 with tools

4. Gemini 3 returns structured response
   ├── Text explanation (streamed to UI)
   └── Tool calls (function_call objects)

5. Tool calls executed via GodotBridge
   ├── spritemancer_create_character → SpriteMancer backend
   ├── create_scene → Godot C++ via TCP
   └── add_node → Godot C++ via TCP

6. Results sent back to AI Panel
   ├── Tool success/failure
   ├── Created assets
   └── Next step guidance

7. User sees real-time updates
   ├── Streaming AI response
   ├── Scene tree updates
   └── Asset previews
```

### Message Format

```typescript
// Request (Godot → MCP)
{
    type: "request",
    id: "uuid",
    prompt: "Create a knight character",
    images: ["base64..."],
    context: {
        currentScene: "res://main.tscn",
        selectedNode: "/root/Player",
        hasSpriteMancer: true
    }
}

// Response (MCP → Godot)
{
    type: "response",
    id: "uuid",
    text: "I'll create a knight character...",
    toolCalls: [
        {
            name: "spritemancer_create_character",
            args: { description: "medieval knight", size: "32x32" },
            result: { project_id: "abc-123" }
        }
    ],
    isComplete: false,
    streaming: true
}

// Event (Godot → MCP)
{
    type: "event",
    event: "scene_changed",
    data: { path: "res://main.tscn" }
}
```

---

## File Structure

```
Spritmaker-2/godot/
├── src/
│   ├── agentic-godot/                    # Godot C++ fork
│   │   └── modules/godot_bridge/
│   │       ├── ai_panel.cpp              # Chat UI (2,425 lines)
│   │       ├── godot_bridge.cpp          # TCP server
│   │       ├── bridge_commands_*.cpp     # Command handlers
│   │       ├── spritemancer_dock.cpp     # CEF browser
│   │       └── drag_drop_texture_rect.cpp
│   │
│   └── zerograft-ai/                    # TypeScript MCP Server
│       └── src/mcp-servers/godot/src/
│           ├── aiRouter.ts               # Main orchestrator
│           ├── geminiLLMv2.ts            # Gemini 3 API
│           ├── spritemancerClient.ts     # SpriteMancer client
│           ├── godotBridge.ts            # TCP client
│           │
│           ├── agentic/                  # Agentic system
│           │   ├── taskExecutor.ts       # Main loop (1,270 lines)
│           │   ├── taskPlanner.ts        # Plan generation
│           │   ├── errorRecovery.ts      # Error handling
│           │   ├── stateManager.ts       # State persistence
│           │   └── agents/               # Specialized agents
│           │       ├── baseAgent.ts
│           │       ├── orchestrator.ts
│           │       ├── architectureAgent.ts
│           │       ├── characterAgent.ts
│           │       ├── levelAgent.ts
│           │       └── qaAgent.ts
│           │
│           ├── prompts/                  # Tool definitions
│           │   ├── tools/
│           │   │   ├── scene/index.ts    # 17 scene tools
│           │   │   ├── script/index.ts   # 8 script tools
│           │   │   ├── spritemancer/     # 25 art tools
│           │   │   ├── agentic/          # 7 control tools
│           │   │   ├── input/            # 9 input tools
│           │   │   ├── files/            # 7 file tools
│           │   │   └── resources/        # 14 resource tools
│           │   └── recipes/              # Workflow patterns
│           │
│           ├── llm/                      # LLM integrations
│           │   └── geminiLLMv2.ts
│           │
│           └── handlers/                 # Tool execution
│               ├── spritemancerHandler.ts
│               └── sceneHandler.ts
│
└── docs/
    ├── ARCHITECTURE.md                   # This file
    └── hackathon_writeup.md
```

---

## Key Design Decisions

### 1. TCP over WebSocket
We chose TCP for the Godot ↔ MCP connection because:
- Lower latency for tool execution
- Simpler implementation in Godot C++
- Reliable ordered delivery

### 2. Native Function Calling
Gemini's native function calling instead of prompt-based tools:
- More reliable execution
- Better parameter validation
- Cleaner separation of concerns

### 3. Multi-Agent Architecture
Specialized agents instead of monolithic LLM:
- Better context management per domain
- Parallel task execution
- Easier to extend/customize

### 4. Embedded CEF Browser
SpriteMancer embedded as CEF browser:
- Full web editor capabilities
- Real-time preview without external apps
- Drag-and-drop integration with Godot

---

## Running the System

### 1. Start SpriteMancer Backend
```bash
cd Spritemancerai/backend
source venv/bin/activate
python main.py  # Port 8000
```

### 2. Start MCP Server
```bash
cd Spritmaker-2/godot/src/zerograft-ai/src/mcp-servers/godot
npm run build
node dist/aiRouter.js  # HTTP 9877, WebSocket 9878 (connects to Godot bridge on 9876)
```

### 3. Run Godot Fork
```bash
cd Spritmaker-2/godot/src/agentic-godot
./bin/godot.macos.editor.arm64
```

The AI Panel will automatically connect to the MCP server on startup.
