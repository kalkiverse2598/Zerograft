# Agentic Godot - API Specification

> **Version:** 1.0.0  
> **Date:** January 6, 2026

---

## 1. IPC Bridge Protocol

### Transport
- **Type**: WebSocket
- **Port**: 9876 (configurable)
- **Format**: JSON

### Message Structure

```typescript
interface IPCMessage {
    id: string;           // UUID for request/response pairing
    type: 'request' | 'response' | 'event';
    method?: string;      // For requests
    params?: any;         // For requests
    result?: any;         // For responses
    error?: {             // For error responses
        code: number;
        message: string;
    };
}
```

---

## 2. Godot API Methods

### Scene Operations

#### `godot.getSceneTree`
Get the current scene hierarchy.

```typescript
// Request
{ "method": "godot.getSceneTree", "params": {} }

// Response
{
    "result": {
        "name": "Main",
        "type": "Node2D",
        "path": "/root/Main",
        "script": "res://scenes/main.gd",
        "children": [
            {
                "name": "Player",
                "type": "CharacterBody2D",
                "path": "/root/Main/Player",
                "script": "res://scripts/player.gd",
                "children": []
            }
        ]
    }
}
```

#### `godot.createScene`
Create a new scene file.

```typescript
// Request
{
    "method": "godot.createScene",
    "params": {
        "path": "res://scenes/enemy.tscn",
        "root_type": "CharacterBody2D",
        "root_name": "Enemy"
    }
}

// Response
{ "result": { "success": true, "path": "res://scenes/enemy.tscn" } }
```

#### `godot.addNode`
Add a node to the current scene.

```typescript
// Request
{
    "method": "godot.addNode",
    "params": {
        "parent": "/root/Main/Player",  // or "." for root
        "type": "Sprite2D",
        "name": "Sprite",
        "properties": {
            "texture": "res://assets/player.png",
            "position": { "x": 0, "y": 0 }
        }
    }
}

// Response
{ "result": { "success": true, "path": "/root/Main/Player/Sprite" } }
```

#### `godot.removeNode`
Remove a node from the scene.

```typescript
// Request
{
    "method": "godot.removeNode",
    "params": {
        "path": "/root/Main/Player/OldSprite"
    }
}

// Response
{ "result": { "success": true } }
```

### Script Operations

#### `godot.getScript`
Read script content.

```typescript
// Request
{
    "method": "godot.getScript",
    "params": { "path": "res://scripts/player.gd" }
}

// Response
{
    "result": {
        "content": "extends CharacterBody2D\n\n@export var speed = 200.0\n...",
        "path": "res://scripts/player.gd"
    }
}
```

#### `godot.createScript`
Create a new script file.

```typescript
// Request
{
    "method": "godot.createScript",
    "params": {
        "path": "res://scripts/enemy.gd",
        "content": "extends CharacterBody2D\n\n@export var health = 100\n",
        "attach_to": "/root/Main/Enemy"  // Optional
    }
}

// Response
{ "result": { "success": true, "path": "res://scripts/enemy.gd" } }
```

#### `godot.modifyScript`
Edit an existing script.

```typescript
// Request
{
    "method": "godot.modifyScript",
    "params": {
        "path": "res://scripts/player.gd",
        "changes": [
            {
                "type": "replace",
                "start_line": 5,
                "end_line": 7,
                "content": "@export var speed = 300.0\n@export var jump = -400.0"
            }
        ]
    }
}

// Response
{ "result": { "success": true } }
```

### Property Operations

#### `godot.setProperty`
Set a node property.

```typescript
// Request
{
    "method": "godot.setProperty",
    "params": {
        "node_path": "/root/Main/Player",
        "property": "position",
        "value": { "x": 100, "y": 50 }
    }
}

// Response
{ "result": { "success": true } }
```

#### `godot.connectSignal`
Connect a signal.

```typescript
// Request
{
    "method": "godot.connectSignal",
    "params": {
        "source": "/root/Main/Player/Area2D",
        "signal": "body_entered",
        "target": "/root/Main/Player",
        "method": "_on_body_entered"
    }
}

// Response
{ "result": { "success": true } }
```

### Game Control

#### `godot.runGame`
Run the game.

```typescript
// Request
{
    "method": "godot.runGame",
    "params": { "scene": "res://scenes/main.tscn" }  // Optional
}

// Response
{ "result": { "success": true } }
```

#### `godot.stopGame`
Stop the running game.

```typescript
// Request
{ "method": "godot.stopGame", "params": {} }

// Response
{ "result": { "success": true } }
```

---

## 3. Events (Godot → Void)

### `sceneChanged`
```typescript
{
    "type": "event",
    "method": "sceneChanged",
    "params": {
        "path": "res://scenes/player.tscn",
        "tree": { /* SceneNode */ }
    }
}
```

### `selectionChanged`
```typescript
{
    "type": "event",
    "method": "selectionChanged",
    "params": {
        "nodes": ["/root/Main/Player", "/root/Main/Player/Sprite"]
    }
}
```

### `scriptOpened`
```typescript
{
    "type": "event",
    "method": "scriptOpened",
    "params": {
        "path": "res://scripts/player.gd"
    }
}
```

### `errorOccurred`
```typescript
{
    "type": "event",
    "method": "errorOccurred",
    "params": {
        "type": "parse" | "runtime",
        "message": "Unexpected token at line 42",
        "file": "res://scripts/player.gd",
        "line": 42
    }
}
```

---

## 4. MCP Tool Definitions

### godot_create_scene
```json
{
    "name": "godot_create_scene",
    "description": "Create a new Godot scene file",
    "inputSchema": {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Scene path (e.g., res://scenes/player.tscn)"
            },
            "root_type": {
                "type": "string",
                "description": "Root node type (e.g., CharacterBody2D)"
            },
            "root_name": {
                "type": "string",
                "description": "Root node name"
            }
        },
        "required": ["path", "root_type", "root_name"]
    }
}
```

### godot_add_node
```json
{
    "name": "godot_add_node",
    "description": "Add a node to the current scene",
    "inputSchema": {
        "type": "object",
        "properties": {
            "parent": {
                "type": "string",
                "description": "Parent node path (use '.' for root)"
            },
            "type": {
                "type": "string",
                "description": "Node type (e.g., Sprite2D)"
            },
            "name": {
                "type": "string",
                "description": "Node name"
            },
            "properties": {
                "type": "object",
                "description": "Initial property values"
            }
        },
        "required": ["parent", "type", "name"]
    }
}
```

### godot_create_script
```json
{
    "name": "godot_create_script",
    "description": "Create a GDScript file",
    "inputSchema": {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Script path"
            },
            "content": {
                "type": "string",
                "description": "Full script content"
            },
            "attach_to": {
                "type": "string",
                "description": "Optional: node path to attach script"
            }
        },
        "required": ["path", "content"]
    }
}
```

### godot_run_game
```json
{
    "name": "godot_run_game",
    "description": "Run the game",
    "inputSchema": {
        "type": "object",
        "properties": {
            "scene": {
                "type": "string",
                "description": "Optional: specific scene to run"
            }
        }
    }
}
```

### spritemancer_generate
```json
{
    "name": "spritemancer_generate",
    "description": "Generate AI sprites using SpriteMancer",
    "inputSchema": {
        "type": "object",
        "properties": {
            "description": {
                "type": "string",
                "description": "Character/sprite description"
            },
            "animations": {
                "type": "array",
                "items": { "type": "string" },
                "description": "Animation types (idle, run, jump, attack)"
            },
            "style": {
                "type": "string",
                "description": "Art style (default: pixel_art)"
            },
            "size": {
                "type": "integer",
                "description": "Sprite size in pixels (default: 32)"
            }
        },
        "required": ["description"]
    }
}
```

---

## 5. SpriteMancer API

### Generate Character
```
POST /api/generate
Authorization: Bearer {api_key}

{
    "description": "pixel art knight character with sword",
    "style": "pixel_art",
    "width": 32,
    "height": 32
}

Response:
{
    "id": "proj_abc123",
    "status": "completed",
    "sprite_url": "https://...",
    "frames": [...]
}
```

### Generate Animation
```
POST /api/animation/generate
Authorization: Bearer {api_key}

{
    "project_id": "proj_abc123",
    "animation_type": "run",
    "frame_count": 6
}

Response:
{
    "id": "anim_xyz789",
    "frames": [...],
    "spritesheet_url": "https://..."
}
```

### Export Spritesheet
```
GET /api/export/spritesheet/{project_id}
Authorization: Bearer {api_key}

Response: PNG binary
```

### Generate Normal Map
```
POST /api/maps/normal
Authorization: Bearer {api_key}

{
    "sprite_id": "proj_abc123"
}

Response:
{
    "normal_map_url": "https://..."
}
```

---

## 6. Error Codes

| Code | Name | Description |
|------|------|-------------|
| 1000 | SCENE_NOT_FOUND | Scene does not exist |
| 1001 | NODE_NOT_FOUND | Node not found in scene |
| 1002 | SCRIPT_NOT_FOUND | Script file not found |
| 1003 | INVALID_NODE_TYPE | Unknown node type |
| 1004 | INVALID_PROPERTY | Property does not exist |
| 2000 | FILE_WRITE_ERROR | Cannot write to file |
| 2001 | FILE_READ_ERROR | Cannot read file |
| 3000 | GAME_ALREADY_RUNNING | Game is already running |
| 3001 | GAME_NOT_RUNNING | No game running |
| 4000 | SPRITEMANCER_ERROR | SpriteMancer API error |
| 5000 | INTERNAL_ERROR | Internal error |
