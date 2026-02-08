# Agentic Godot

Agentic Godot is an AI-enabled Godot fork with a native editor panel, a TypeScript AI router, and SpriteMancer integration for character/asset generation.

## Current Status

This repository contains a working MVP used for Gemini hackathon submissions.

Core implemented capabilities:
- Native Gemini function calling with 87 registered tools
- Streaming chat + thinking UI inside Godot editor
- Scene/script/property/file operations via TCP bridge
- SpriteMancer workflow for character and asset generation
- Multi-agent orchestration and approval gates

## Repository Layout

```
Spritmaker-2/godot/
├── docs/
│   ├── ARCHITECTURE.md
│   └── hackathon_writeup.md
└── src/
    ├── agentic-godot/
    │   ├── build_godot.sh
    │   └── modules/godot_bridge/
    └── zerograft-ai/
        └── src/mcp-servers/godot/
```

## Quick Start

### Prerequisites

Godot 4.3 source and gdCEF are included as **git submodules**. Make sure you cloned with:

```bash
git clone --recurse-submodules https://github.com/kalkiverse2598/Zerograft.git
```

You also need [scons](https://scons.org/) and standard C++ build tools. See [Godot build docs](https://docs.godotengine.org/en/stable/contributing/development/compiling/index.html).

### 1. Build and Run Godot Fork

```bash
cd src/agentic-godot
./build_godot.sh    # Symlinks custom modules + builds
cd godot-engine
./bin/godot.macos.editor.arm64 --editor --path ../project
```

### 2. Build and Run AI Router

```bash
cd src/zerograft-ai/src/mcp-servers/godot
cp .env.example .env
# Edit .env and set GEMINI_API_KEY
npm run build
node dist/aiRouter.js
```

### 3. (Optional) Run SpriteMancer Backend

```bash
cd ../../../../Spritemancerai/backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env and set GEMINI_API_KEY, SUPABASE_URL, SUPABASE_KEY
uvicorn main:app --reload --port 8000
```

## Runtime Ports

| Service | Port |
|---------|------|
| Godot bridge TCP | `9876` |
| AI router HTTP | `9877` (`/chat`) |
| AI router WebSocket | `9878` |
| SpriteMancer backend | `8000` |

## Validation Commands

```bash
cd src/zerograft-ai/src/mcp-servers/godot
npm run build
npm test
```

## License

- Godot Engine base: MIT
- Void/Cline base components: MIT
- Agentic Godot and SpriteMancer integrations: proprietary (KalkiVerse / ZeroGraft)
