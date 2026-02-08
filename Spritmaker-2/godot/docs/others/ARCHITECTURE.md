# Agentic Godot - Technical Architecture

> **Version:** 1.0.0  
> **Date:** January 6, 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Fork Strategy](#2-fork-strategy)
3. [Godot Custom Modules](#3-godot-custom-modules)
4. [Cline Integration](#4-cline-integration)
5. [IPC Bridge](#5-ipc-bridge)
6. [CEF Integration](#6-cef-integration)
7. [LLM Integration](#7-llm-integration)
8. [SpriteMancer Integration](#8-spritemancer-integration)
9. [Build System](#9-build-system)
10. [Distribution](#10-distribution)

---

## 1. System Overview

### 1.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        AGENTIC GODOT                                         │
│                  (SpriteMancer Built-in Edition)                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                      GODOT ENGINE FORK                                 │  │
│  │                                                                        │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │  │
│  │  │ godot_cef   │  │godot_bridge │  │ Godot Core  │  │ Godot Editor │  │  │
│  │  │ (C++ module)│  │ (C++ module)│  │  (stock)    │  │   (stock)    │  │  │
│  │  └──────┬──────┘  └──────┬──────┘  └─────────────┘  └──────────────┘  │  │
│  │         │                │                                             │  │
│  └─────────┼────────────────┼─────────────────────────────────────────────┘  │
│            │                │                                                │
│            │ Host           │ WebSocket                                      │
│            │ WebView        │ IPC                                            │
│            ▼                ▼                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                    UNIFIED BACKEND (Node.js/Python)                    │  │
│  │                                                                        │  │
│  │  ┌───────────────────────────────────────────────────────────────────┐ │  │
│  │  │                    CLINE CORE (TypeScript/React)                  │ │  │
│  │  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────┐  │ │  │
│  │  │  │ Cline UI  │  │ Model     │  │ Agent     │  │ MCP Servers   │  │ │  │
│  │  │  │ (React)   │  │ Service   │  │ Engine    │  │ (Godot/Sprite)│  │ │  │
│  │  │  └───────────┘  └───────────┘  └───────────┘  └───────────────┘  │ │  │
│  │  └───────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                        │  │
│  │  ┌───────────────────────────────────────────────────────────────────┐ │  │
│  │  │               SPRITEMANCER BACKEND (Python) - BUILT-IN            │ │  │
│  │  │                                                                   │ │  │
│  │  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────┐  │ │  │
│  │  │  │ DNA Lab   │  │ Animation │  │ Frame     │  │ Normal Map    │  │ │  │
│  │  │  │ Pipeline  │  │ Generator │  │ Repair    │  │ Generator     │  │ │  │
│  │  │  └───────────┘  └───────────┘  └───────────┘  └───────────────┘  │ │  │
│  │  │                                                                   │ │  │
│  │  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────┐  │ │  │
│  │  │  │ Gemini AI │  │ Spritesheet│ │ Effects   │  │ Export        │  │ │  │
│  │  │  │ Service   │  │ Builder    │ │ Engine    │  │ Pipeline      │  │ │  │
│  │  │  └───────────┘  └───────────┘  └───────────┘  └───────────────┘  │ │  │
│  │  │                                                                   │ │  │
│  │  └───────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                         │                                    │
│                                         ▼                                    │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                    EXTERNAL SERVICES (Only LLMs)                       │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │  │
│  │  │ LLM APIs: Gemini (for sprites) │ Claude/GPT (for code)         │   │  │
│  │  └─────────────────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **Godot Core** | Game engine, rendering, physics, audio |
| **Godot Editor** | Scene tree, inspector, file browser |
| **godot_cef** | Host Cline UI in a CEF WebView panel |
| **godot_bridge** | WebSocket server for IPC with Cline |
| **Cline UI** | AI chat, code editor, SpriteMancer panel |
| **Model Service** | LLM provider abstraction (OpenRouter, Gemini, Ollama) |
| **Agent Engine** | Execute agent mode actions via MCP |
| **Godot MCP Server** | Tool definitions for Godot operations |
| **SpriteMancer MCP** | Tool definitions for sprite generation |
| **SpriteMancer Backend** | **BUILT-IN** AI sprite generation (Python) |

### 1.3 SpriteMancer: Fully Embedded

> **Key Difference**: SpriteMancer is NOT an external API - it's embedded directly into Agentic Godot!

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SPRITEMANCER INTEGRATION                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Traditional Approach (External API):                                       │
│  ───────────────────────────────────                                        │
│    Agentic Godot  ──HTTP──►  SpriteMancer Cloud API  ──►  AI Result        │
│                              (requires internet)                            │
│                                                                             │
│  OUR Approach (Built-in):                                                   │
│  ─────────────────────────                                                  │
│    Agentic Godot  ◄──────────────────────────────────────────────┐         │
│         │                                                        │         │
│         │  Internal IPC                                          │         │
│         ▼                                                        │         │
│    ┌─────────────────────────────────────────────────────────────────┐     │
│    │           EMBEDDED SPRITEMANCER BACKEND (Python)                │     │
│    │                                                                 │     │
│    │   • DNA Extraction Pipeline (from Spritmaker-2/backend)        │     │
│    │   • Animation Generation (multi-frame)                         │     │
│    │   • Frame Repair & Post-processing                             │     │
│    │   • Normal/Specular Map Generation                             │     │
│    │   • Spritesheet Export                                         │     │
│    │   • Dual Character System                                      │     │
│    │                                                                 │     │
│    │   Uses Gemini API internally (user provides their own key)    │     │
│    │                                                                 │     │
│    └─────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  Benefits:                                                                  │
│  ✅ Works offline (except for Gemini calls)                                │
│  ✅ No SpriteMancer subscription needed                                    │
│  ✅ Full feature set included                                              │
│  ✅ Your IP stays in Agentic Godot                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Fork Strategy

### 2.1 Repository Structure

```
github.com/kalkiverse/
│
├── agentic-godot/              # Fork of godotengine/godot
│   ├── modules/
│   │   ├── godot_cef/          # CEF integration
│   │   └── godot_bridge/       # IPC bridge
│   ├── misc/dist/agentic/      # Custom branding
│   └── ...                     # Stock Godot files
│
└── zerograft-ai/              # Fork of cline/cline
    ├── src/
    │   ├── core/               # Cline core (extracted from VS Code)
    │   ├── mcp-servers/
    │   │   ├── godot/          # NEW: Godot MCP Server
    │   │   └── spritemancer/   # NEW: SpriteMancer MCP Server
    │   └── webview/            # React UI
    └── ...                     # Cline files
```

### 2.2 Godot Fork: Files Changed

| Path | Change | Purpose |
|------|--------|---------|
| `modules/godot_cef/` | NEW | CEF WebView module |
| `modules/godot_bridge/` | NEW | IPC bridge module |
| `editor/editor_node.cpp` | MODIFIED | Add Void panel on startup |
| `misc/dist/agentic/` | NEW | Custom icons/splash |
| `core/version.h` | MODIFIED | Branding |

### 2.3 Cline Fork: Files Changed

| Path | Change | Purpose |
|------|--------|---------|
| `src/core/` | EXTRACTED | Core logic without VS Code dependencies |
| `src/mcp-servers/godot/` | NEW | Godot MCP tools |
| `src/mcp-servers/spritemancer/` | NEW | SpriteMancer MCP tools |
| `src/webview/` | MODIFIED | Custom UI panels for Godot |

---

## 3. Godot Custom Modules

### 3.1 godot_cef Module

Embeds Chromium Embedded Framework to host Void's React UI.

```
modules/godot_cef/
├── SCsub                       # Build script
├── config.py                   # Module config
├── register_types.cpp/.h       # Class registration
├── cef_application.cpp/.h      # CEF app lifecycle
├── cef_panel.cpp/.h            # EditorPlugin panel
├── cef_handler.cpp/.h          # Browser callbacks
└── thirdparty/cef/             # CEF binaries
```

**Key Class: CEFPanel**

```cpp
// cef_panel.h
class CEFPanel : public Control {
    GDCLASS(CEFPanel, Control);
    
public:
    void load_url(const String &url);
    void execute_javascript(const String &code);
    void send_message_to_js(const String &name, const Variant &data);
    
    // Signal: js_message_received(name, data)
};
```

### 3.2 godot_bridge Module

WebSocket server for bidirectional communication with Void.

```
modules/godot_bridge/
├── SCsub
├── config.py
├── register_types.cpp/.h
├── bridge_server.cpp/.h        # WebSocket server
├── godot_api.cpp/.h            # Godot operations
└── action_executor.cpp/.h      # Execute agent actions
```

**Key Class: BridgeServer**

```cpp
// bridge_server.h
class BridgeServer : public RefCounted {
    GDCLASS(BridgeServer, RefCounted);
    
public:
    Error start(int port = 9876);
    void stop();
    
    // Handle incoming requests from Void
    Dictionary handle_request(const Dictionary &request);
    
    // Send events to Void
    void send_event(const String &event, const Dictionary &data);
    
    // Godot API methods (called by Void)
    Dictionary get_scene_tree();
    Dictionary get_script(const String &path);
    Error create_scene(const String &path, const String &root_type);
    Error add_node(const String &parent, const String &type, const String &name);
    Error create_script(const String &path, const String &content);
    Error run_game(const String &scene);
};
```

---

## 4. Cline Integration

### 4.1 Cline Architecture Overview

Cline is forked from `cline/cline` (Apache 2.0) and adapted to run standalone within CEF.

**Key Cline Features We Use:**
- Multi-provider LLM support (OpenRouter, Anthropic, OpenAI, Gemini, Ollama)
- Native MCP server management
- Tool execution engine with human-in-the-loop approval
- React-based webview UI
- Checkpoint/state management

### 4.2 Godot MCP Server

```
src/mcp-servers/godot/
├── index.ts                    # MCP server entry point
├── godotBridge.ts              # WebSocket IPC client
├── tools/
│   ├── createScene.ts          # godot_create_scene tool
│   ├── addNode.ts              # godot_add_node tool
│   ├── createScript.ts         # godot_create_script tool
│   ├── setProperty.ts          # godot_set_property tool
│   └── runGame.ts              # godot_run_game tool
└── context/
    └── godotContext.ts         # Scene tree, GDScript context
```

**godotBridge.ts**

```typescript
export class GodotBridge {
    private ws: WebSocket;
    
    // Connect to Godot's WebSocket server
    async connect(port: number = 9876): Promise<void>;
    
    // Query Godot state
    async getSceneTree(): Promise<SceneNode>;
    async getScript(path: string): Promise<string>;
    async getProjectFiles(): Promise<FileEntry[]>;
    
    // Execute actions
    async createScene(path: string, rootType: string): Promise<void>;
    async addNode(parent: string, type: string, name: string): Promise<void>;
    async createScript(path: string, content: string): Promise<void>;
    async setProperty(node: string, prop: string, value: any): Promise<void>;
    async runGame(scene?: string): Promise<void>;
    
    // Listen for events from Godot
    onSceneChanged(callback: (scene: SceneNode) => void): void;
    onSelectionChanged(callback: (nodes: string[]) => void): void;
}
```

### 4.2 MCP Tools

```typescript
// godotTools.ts
export const godotMCPTools = [
    {
        name: 'godot_create_scene',
        description: 'Create a new Godot scene',
        inputSchema: { /* ... */ },
        execute: async (params) => bridge.createScene(params.path, params.rootType)
    },
    {
        name: 'godot_add_node',
        description: 'Add a node to the current scene',
        inputSchema: { /* ... */ },
        execute: async (params) => bridge.addNode(params.parent, params.type, params.name)
    },
    {
        name: 'godot_create_script',
        description: 'Create a GDScript file',
        inputSchema: { /* ... */ },
        execute: async (params) => bridge.createScript(params.path, params.content)
    },
    {
        name: 'godot_run_game',
        description: 'Run the game',
        execute: async (params) => bridge.runGame(params.scene)
    },
    {
        name: 'spritemancer_generate',
        description: 'Generate AI sprites',
        execute: async (params) => spritemancer.generate(params)
    }
];
```

---

## 5. IPC Bridge

### 5.1 Protocol

**Transport**: WebSocket (localhost:9876)

**Message Format**:
```json
{
    "id": "uuid",
    "type": "request" | "response" | "event",
    "method": "string",
    "params": {},
    "result": {},
    "error": { "code": 0, "message": "" }
}
```

### 5.2 Methods

| Method | Direction | Description |
|--------|-----------|-------------|
| `godot.getSceneTree` | Void → Godot | Get current scene hierarchy |
| `godot.getScript` | Void → Godot | Read script content |
| `godot.createScene` | Void → Godot | Create new scene |
| `godot.addNode` | Void → Godot | Add node to scene |
| `godot.removeNode` | Void → Godot | Remove node |
| `godot.createScript` | Void → Godot | Create script file |
| `godot.modifyScript` | Void → Godot | Edit script |
| `godot.setProperty` | Void → Godot | Set node property |
| `godot.connectSignal` | Void → Godot | Connect signal |
| `godot.runGame` | Void → Godot | Play the game |
| `godot.stopGame` | Void → Godot | Stop the game |

### 5.3 Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `sceneChanged` | Godot → Void | Active scene changed |
| `selectionChanged` | Godot → Void | Node selection changed |
| `scriptOpened` | Godot → Void | Script opened in editor |
| `gameStarted` | Godot → Void | Game started running |
| `gameStopped` | Godot → Void | Game stopped |
| `errorOccurred` | Godot → Void | Runtime/parse error |

---

## 6. CEF Integration

### 6.1 CEF Lifecycle

```cpp
// In godot_cef/cef_application.cpp

void CefGodotApplication::OnContextInitialized() {
    // Called when CEF is ready
    // Create browser window, load Void UI
}

void CefGodotApplication::OnBeforeClose(CefBrowser* browser) {
    // Cleanup when closing
}
```

### 6.2 JavaScript ↔ C++ Communication

```cpp
// Send data from C++ to JavaScript
void CEFPanel::send_to_js(const String &name, const Variant &data) {
    String json = JSON::stringify(data);
    String script = vformat("window.godotBridge.receive('%s', %s)", name, json);
    browser->GetMainFrame()->ExecuteJavaScript(script, "", 0);
}

// Receive data from JavaScript via CefMessageRouter
bool CefMessageHandler::OnQuery(CefBrowser* browser,
                                 CefFrame* frame,
                                 const CefString& request,
                                 CefRefPtr<Callback> callback) {
    // Parse request, call appropriate Godot API
    String result = process_request(request.ToString());
    callback->Success(result.utf8().get_data());
    return true;
}
```

---

## 7. LLM Integration

### 7.1 Provider Architecture

```typescript
// In Void: src/vs/workbench/contrib/void/llm/

interface LLMProvider {
    name: string;
    generate(prompt: string, options?: GenerateOptions): Promise<string>;
    streamGenerate(prompt: string, callback: (token: string) => void): Promise<void>;
}

class GeminiProvider implements LLMProvider { /* ... */ }
class ClaudeProvider implements LLMProvider { /* ... */ }
class OpenAIProvider implements LLMProvider { /* ... */ }
class OllamaProvider implements LLMProvider { /* ... */ }
```

### 7.2 Godot System Prompt

```typescript
export function getGodotSystemPrompt(context: GodotContext): string {
    return `
You are an AI assistant in Agentic Godot, an AI-powered game development IDE.

## Your Capabilities
You can create and modify Godot games using these tools:
- godot_create_scene: Create new .tscn files
- godot_add_node: Add nodes to scenes
- godot_create_script: Create GDScript files
- godot_modify_script: Edit existing scripts
- godot_set_property: Set node properties
- godot_connect_signal: Connect signals
- godot_run_game: Run the game
- spritemancer_generate: Generate AI sprites

## Current Context
${formatSceneTree(context.sceneTree)}
${formatOpenScripts(context.scripts)}
${formatSelection(context.selection)}

## Guidelines
1. Use Godot 4 GDScript syntax
2. Use type hints: var speed: float = 200.0
3. Use @export for inspector variables
4. Prefer signals over direct references
5. Follow snake_case naming convention
`;
}
```

---

## 8. SpriteMancer Integration (BUILT-IN)

> **IMPORTANT**: SpriteMancer is NOT an external API call - it runs locally within Agentic Godot!

### 8.1 Architecture

SpriteMancer backend from `Spritmaker-2/backend` is bundled directly:

```
AgenticGodot/
├── AgenticGodot.exe
├── void-backend/               # Void (TypeScript)
├── spritemancer-backend/       # SpriteMancer (Python) ⭐ BUILT-IN
│   ├── python/                 # Bundled Python runtime
│   ├── app/
│   │   ├── core/
│   │   │   ├── gemini.py       # Gemini AI service
│   │   │   └── image_gen.py    # Image generation
│   │   ├── services/
│   │   │   ├── dna_service.py  # DNA extraction
│   │   │   ├── animation_service.py
│   │   │   ├── export_service.py
│   │   │   └── normal_map_service.py
│   │   └── routers/
│   │       ├── projects.py
│   │       ├── animation.py
│   │       └── export.py
│   └── run_spritemancer.py     # Entry point
└── ...
```

### 8.2 Internal Communication

```typescript
// In Void: src/vs/workbench/contrib/spritemancer/localClient.ts

export class SpriteMancerLocalClient {
    // Connects to LOCAL SpriteMancer backend (not cloud!)
    private baseUrl = 'http://localhost:8000';  // Local Python server
    
    async generateCharacter(description: string, options: GenerateOptions): Promise<Sprite> {
        // Calls embedded SpriteMancer backend
        return this.post('/api/generate', { description, ...options });
    }
    
    async extractDNA(imageBase64: string): Promise<CharacterDNA> {
        return this.post('/api/dna/extract', { image: imageBase64 });
    }
    
    async generateAnimation(dna: CharacterDNA, animationType: string): Promise<Animation> {
        return this.post('/api/animation/generate', { dna, animation_type: animationType });
    }
    
    async generateNormalMap(spriteBase64: string): Promise<Buffer> {
        return this.post('/api/maps/normal', { sprite: spriteBase64 });
    }
    
    async exportSpritesheet(projectId: string): Promise<Buffer> {
        return this.get(`/api/export/spritesheet/${projectId}`);
    }
}
```

### 8.3 SpriteMancer Features Included

All SpriteMancer features from your existing backend:

| Feature | Source File | Description |
|---------|-------------|-------------|
| DNA Extraction | `dna_service.py` | Extract character DNA from reference |
| Animation Gen | `animation_service.py` | Generate multi-frame animations |
| Frame Budget | `stage_3c_frame_budget.py` | Intelligent frame allocation |
| Frame Repair | `animation_repair.py` | AI-powered frame cleanup |
| Normal Maps | `normal_map_service.py` | Auto-generate lighting maps |
| Dual Character | `dual_sprites.py` | Two-character interaction |
| Spritesheet Export | `export_service.py` | PNG, GIF, JSON export |
| Effects | `effect_types.py` | Hit-stop, particles, smear |

### 8.4 Local Generation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LOCAL SPRITE GENERATION FLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. User: "Create a knight character with attack animation"                │
│                                │                                            │
│                                ▼                                            │
│  2. Void Agent interprets request                                          │
│                                │                                            │
│                                ▼                                            │
│  3. Calls LOCAL SpriteMancer backend (localhost:8000)                      │
│                                │                                            │
│                                ▼                                            │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │  SPRITEMANCER BACKEND (Python - running locally)           │           │
│  │                                                             │           │
│  │  a. Generate base character via Gemini                      │           │
│  │                    ↓                                        │           │
│  │  b. Extract DNA (pose, colors, style)                       │           │
│  │                    ↓                                        │           │
│  │  c. Generate animation frames                               │           │
│  │                    ↓                                        │           │
│  │  d. Repair frames for consistency                           │           │
│  │                    ↓                                        │           │
│  │  e. Generate normal maps                                    │           │
│  │                    ↓                                        │           │
│  │  f. Build spritesheet                                       │           │
│  │                                                             │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                                │                                            │
│                                ▼                                            │
│  4. Return spritesheet + metadata to Void                                  │
│                                │                                            │
│                                ▼                                            │
│  5. Void imports to Godot project (res://assets/)                          │
│                                │                                            │
│                                ▼                                            │
│  6. Creates SpriteFrames resource automatically                            │
│                                │                                            │
│                                ▼                                            │
│  7. ✅ Ready to use in game!                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.5 User's API Key

Since SpriteMancer uses Gemini AI internally, users provide their own Gemini API key:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FIRST RUN SETUP                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SpriteMancer (Built-in AI Asset Generation)                               │
│                                                                             │
│  SpriteMancer uses Gemini AI to generate sprites.                          │
│  Enter your Google AI Studio API key:                                      │
│                                                                             │
│  Gemini API Key: [____________________________] [Get Free Key]             │
│                                                                             │
│  ℹ️ Free tier includes 60 requests/minute                                  │
│  ℹ️ Your key is stored locally, never sent to KalkiVerse                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Build System

### 9.1 Godot Fork Build

```bash
# Prerequisites
# - Python 3.10+
# - SCons
# - Visual Studio 2022 (Windows) / Xcode (macOS) / GCC (Linux)

# Clone
git clone --recursive https://github.com/kalkiverse/agentic-godot.git
cd agentic-godot

# Build editor
scons platform=windows target=editor arch=x86_64 -j8 \
    module_godot_cef_enabled=yes \
    module_godot_bridge_enabled=yes

# Build export templates
scons platform=windows target=template_release arch=x86_64
scons platform=windows target=template_debug arch=x86_64
```

### 9.2 Void Fork Build

```bash
# Clone
git clone https://github.com/kalkiverse/agentic-void.git
cd agentic-void

# Install dependencies
npm install

# Build for embedding in Godot
npm run build:godot

# Output: dist/void-bundle/
```

### 9.3 Combined Build

```bash
#!/bin/bash
# build.sh

# Build Void
cd agentic-void
npm install
npm run build:godot

# Copy to Godot
cp -r dist/void-bundle ../agentic-godot/modules/godot_cef/web/

# Build Godot
cd ../agentic-godot
scons platform=windows target=editor -j8

echo "Build complete: bin/AgenticGodot.exe"
```

---

## 10. Distribution

### 10.1 Package Structure

```
AgenticGodot-1.0.0-win64/
├── AgenticGodot.exe              # Main editor
├── AgenticGodot.console.exe      # Console variant
├── void-backend/                 # Void runtime
│   ├── node.exe                  # Bundled Node.js
│   ├── server.js                 # Backend entry
│   └── node_modules/             # Dependencies
├── cef/                          # CEF binaries
│   ├── libcef.dll
│   ├── icudtl.dat
│   └── *.pak
├── export_templates/             # (Optional) Export templates
│   ├── windows_debug_x86_64.exe
│   └── windows_release_x86_64.exe
├── templates/                    # Project templates
│   ├── 2d_platformer/
│   ├── top_down/
│   └── visual_novel/
└── models/                       # (Optional) Local LLMs
    └── qwen2.5-coder-3b.gguf
```

### 10.2 Startup Sequence

```
1. User launches AgenticGodot.exe
2. Godot initializes, loads custom modules
3. godot_bridge starts WebSocket server (port 9876)
4. godot_cef launches void-backend subprocess
5. void-backend starts Node.js server (port 9877)
6. CEF panel loads UI from localhost:9877
7. Void connects to bridge at localhost:9876
8. ✅ Ready
```

### 10.3 First-Run Initialization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FIRST-RUN WIZARD                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Step 1: Choose AI Backend                                                  │
│    ○ Local LLM (download ~3GB)                                             │
│    ● Cloud API (Gemini recommended)                                         │
│                                                                             │
│  Step 2: Enter API Key (if cloud)                                          │
│    Gemini API Key: [__________________] [Verify]                           │
│                                                                             │
│  Step 3: SpriteMancer (optional)                                           │
│    API Key: [__________________] [Get Free Key]                            │
│                                                                             │
│  Step 4: Create First Project                                              │
│    ○ Start from template                                                    │
│    ○ Open existing project                                                  │
│    ● Empty project                                                          │
│                                                                             │
│                                             [Previous] [Get Started →]      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Appendix: File Maps

### Godot Module: godot_cef

| File | Lines | Description |
|------|-------|-------------|
| `SCsub` | ~30 | Build configuration |
| `config.py` | ~20 | Module settings |
| `register_types.cpp/h` | ~50 | Class registration |
| `cef_application.cpp/h` | ~200 | CEF lifecycle |
| `cef_panel.cpp/h` | ~300 | WebView Control |
| `cef_handler.cpp/h` | ~150 | Browser callbacks |

### Godot Module: godot_bridge

| File | Lines | Description |
|------|-------|-------------|
| `SCsub` | ~20 | Build configuration |
| `config.py` | ~15 | Module settings |
| `register_types.cpp/h` | ~40 | Class registration |
| `bridge_server.cpp/h` | ~400 | WebSocket server |
| `godot_api.cpp/h` | ~500 | Godot operations |
| `action_executor.cpp/h` | ~300 | Execute actions |

### Void: Godot Integration

| File | Lines | Description |
|------|-------|-------------|
| `godotBridge.ts` | ~200 | IPC client |
| `godotContext.ts` | ~150 | Project context |
| `godotTools.ts` | ~300 | MCP tools |
| `godotLanguage.ts` | ~100 | GDScript support |
| `godotIntegration.ts` | ~100 | Entry point |

---

> **Document Status**: Draft  
> **Last Updated**: January 6, 2026
