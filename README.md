# ZeroGraft — Agentic Godot

### A fork of Godot Engine with the power of AI

> Describe your game in natural language → AI generates art, writes code, configures physics, and builds playable scenes.

**Live Demo:** [spritemancer.zerograft.online](https://spritemancer.zerograft.online)

---

## What Is This?

**ZeroGraft (Agentic Godot)** is an MVP prototype that transforms game development into a conversation. Describe what you want in plain English, and Gemini 3 builds it — generating pixel art, writing GDScript, and configuring physics in real-time inside a forked Godot Engine.

### Gemini 3 Powers Everything

- **87 Native Functions** — Scene creation, node manipulation, GDScript generation, physics setup, and AI art — all as Gemini function declarations. No prompt hacks, pure structured API.
- **Extended Thinking** — Complex requests like "Design a platformer with enemies and parallax" trigger multi-step planning with configurable thinking budgets.
- **Live Streaming** — Watch AI reasoning unfold token-by-token in a custom 2,400-line C++ editor panel embedded in Godot's native UI.
- **Vision Debugging** — Attach screenshots. Gemini *sees* your viewport to diagnose positioning bugs and verify visual changes.

### Human-AI Collaboration

A **multi-agent orchestrator** coordinates Character, Level, Architecture, and QA agents. Built-in approval workflow via `ask_followup_question` — AI proposes, you approve. Loop detection and error recovery ensure reliable 50+ step game builds.

**SpriteMancer** (25 tools) generates pixel-perfect characters, animations, 6 tileset types, VFX effects, and parallax backgrounds — all through Gemini function calls.

**Impact:** One-person studios can now ship games in days and weeks, not months and years.

---

## Quick Start (Clone → Run)

```bash
# 1. Clone with submodules (includes Godot 4.3 source + gdCEF)
git clone --recurse-submodules https://github.com/kalkiverse2598/Zerograft.git
cd Zerograft

# 2. One-command setup (builds Godot, installs dependencies)
./setup.sh
```

After setup, run in separate terminals:

```bash
# Terminal 1: Godot Editor
cd Spritmaker-2/godot/src/agentic-godot/godot-engine
./bin/godot.macos.editor.arm64 --editor --path ../project

# Terminal 2: AI Router
cd Spritmaker-2/godot/src/zerograft-ai/src/mcp-servers/godot
npm run dev

# Terminal 3: SpriteMancer Backend
cd Spritemancerai/backend
uvicorn main:app --reload --port 8000

# Terminal 4: SpriteMancer Frontend
cd Spritemancerai/frontend
npm run dev
```

> **Note:** Set your `GEMINI_API_KEY` in `Spritmaker-2/godot/src/zerograft-ai/src/mcp-servers/godot/.env` before running.

---

## Architecture

```
╔═══════════════════════════════════════════════════════════════╗
║                     AGENTIC GODOT                             ║
║           "A Fork of Godot Engine with the Power of AI"       ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  ┌───────────────────────────────────────────────────────┐    ║
║  │  DEVELOPER INPUT                                       │    ║
║  │  "Create a knight with double-jump" + Screenshots      │    ║
║  └─────────────────────────┬─────────────────────────────┘    ║
║                             │                                  ║
║                             ▼                                  ║
║  ╔═══════════════════════════════════════════════════════╗     ║
║  ║  GEMINI 3 API LAYER                                    ║     ║
║  ╠═══════════════════════════════════════════════════════╣     ║
║  ║  87 Native    │ Extended    │ Live       │ Vision      ║     ║
║  ║  Functions    │ Thinking    │ Streaming  │ Analysis    ║     ║
║  ╚═══════════════════════════════════════════════════════╝     ║
║                             │                                  ║
║                             ▼                                  ║
║  ┌───────────────────────────────────────────────────────┐    ║
║  │  AI ROUTER + TASK EXECUTOR                             │    ║
║  │  Loop Detection │ Error Recovery │ Context Summary     │    ║
║  └─────────────────────────┬─────────────────────────────┘    ║
║                             │                                  ║
║                             ▼                                  ║
║  ╔═══════════════════════════════════════════════════════╗     ║
║  ║  MULTI-AGENT ORCHESTRATOR (LangGraph-style FSM)        ║     ║
║  ╠═══════════════════════════════════════════════════════╣     ║
║  ║  Architecture │ Character │ Level  │ QA Agent          ║     ║
║  ║  Agent        │ Agent     │ Agent  │ (Verify)          ║     ║
║  ╚═══════════════════════════════════════════════════════╝     ║
║                             │                                  ║
║          ┌──────────────────┴──────────────────┐               ║
║          ▼                                     ▼               ║
║  ╔═══════════════════╗         ╔══════════════════════════╗    ║
║  ║  SPRITEMANCER      ║         ║  GODOT ENGINE (Fork)      ║    ║
║  ╠═══════════════════╣         ╠══════════════════════════╣    ║
║  ║  Gemini 3 Pro      ║         ║  Custom AI Panel (C++)     ║    ║
║  ║  Gemini 3 Flash    ║◀───────▶║  Monaco Code Editor        ║    ║
║  ║  Pixel Editor      ║         ║  Scene Tree │ Physics      ║    ║
║  ║  25 Gen Tools      ║         ║  GDScript │ TileMaps       ║    ║
║  ╚═══════════════════╝         ╚══════════════════════════╝    ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## SpriteMancer: AI Art Pipeline

SpriteMancer is a complete AI-powered game asset generation system with **25 dedicated tools**.

### Character Pipeline

```
CREATE ──▶ DNA EXTRACTION ──▶ ANIMATE ──▶ APPROVE ──▶ EXPORT
   │                              │           │
   └─ AI generates reference      └─ idle,    └─ User confirms
      Opens embedded preview         walk,       before export
                                     run,
                                     attack,
                                     jump
```

### Tileset & Environment Generation

| Category | Tools | Examples |
|----------|-------|----------|
| **Terrain** | 9-tile seamless | grass, dirt, stone, sand |
| **Platforms** | 6-piece | wooden, stone, floating island |
| **Walls** | 9-tile dungeon | castle, cave, brick |
| **Decorations** | Props | crates, barrels, chests |
| **Parallax** | 3-layer | far, mid, near with alpha |
| **VFX** | Effects | explosion, fire, magic |

All tilesets export to Godot `.tres` with optional physics/collision.

---

## Gemini 3 Features

### 87 Native Functions

| Category | Count | Examples |
|----------|-------|----------|
| Scene | 17 | `create_scene`, `add_node`, `save_scene` |
| Script | 8 | `create_script`, `edit_script`, `get_errors` |
| SpriteMancer | 25 | Characters, tilesets, parallax, VFX |
| Agentic | 7 | `start_plan`, `ask_followup_question` |
| Input/Files/Resources | 30 | Signals, files, physics |
| **Total** | **87** | |

### Extended Thinking + Streaming

```
Thinking: User wants a complete platformer...
   → Generate knight character first
   → Create terrain tileset
   → Set up parallax background...

Calling: spritemancer_create_character
Success: Character preview ready
```

---

## Repository Structure

```
.
├── Spritemancerai/          # SpriteMancer AI (web app)
│   ├── backend/             # FastAPI Python backend
│   │   ├── app/
│   │   │   ├── models/      # Pydantic data models
│   │   │   ├── prompts/     # AI prompt templates (stages 1-8)
│   │   │   ├── routers/     # API endpoints
│   │   │   ├── services/    # Pipeline stages & orchestrators
│   │   │   └── db/          # Redis + Supabase clients
│   │   └── requirements.txt
│   ├── frontend/            # Next.js React frontend
│   │   ├── app/             # Pages & layouts
│   │   ├── components/      # UI components
│   │   └── lib/             # API client & utilities
│   └── docs/                # Dual character system docs
│
├── Spritmaker-2/godot/      # Agentic Godot (engine fork)
│   ├── src/agentic-godot/
│   │   ├── modules/
│   │   │   ├── godot_bridge/ # C++ AI integration module
│   │   │   │   ├── ai_panel.cpp          # 2,400-line chat UI
│   │   │   │   ├── godot_bridge.cpp      # TCP bridge server
│   │   │   │   ├── spritemancer_dock.cpp  # Embedded browser
│   │   │   │   └── bridge_commands_*.cpp  # Scene/script/input
│   │   │   └── gdcef/       # Chromium Embedded Framework
│   │   └── project/         # Demo Godot project
│   ├── docs/                # Architecture, hackathon writeup
│   └── branding/            # App icons & splash
│
└── deploy/                  # Docker deployment
    ├── docker-compose.yml   # Full stack orchestration
    ├── Caddyfile            # Reverse proxy + HTTPS
    ├── DEPLOY.md            # KVM deployment guide
    └── Dockerfiles          # Per-service build configs
```

---

## Before vs After

| Traditional Workflow | Agentic Godot |
|---------------------|---------------|
| Learn Godot (1 week) | "Make a game" |
| Write GDScript (weeks) | AI writes code |
| Create pixel art (days) | SpriteMancer generates |
| Configure physics (hours) | AI handles collisions |
| Search docs & videos (hours) | Ask AI → instant guidance |
| **Total: Months-Years** | **Total: Days-Weeks** |

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Game Engine** | Godot 4.3 (custom C++ fork) |
| **AI Model** | Gemini 3 Pro/Flash (function calling, thinking, streaming, vision) |
| **AI Router** | TypeScript / Node.js |
| **Backend** | Python / FastAPI |
| **Frontend** | Next.js / React / TailwindCSS |
| **Database** | Supabase (Postgres + Storage) |
| **Cache** | Upstash Redis |
| **Deployment** | Docker Compose + Caddy (KVM VPS) |

---

## Runtime Ports

| Service | Port |
|---------|------|
| Godot bridge TCP | `9876` |
| AI router HTTP | `9877` |
| AI router WebSocket | `9878` |
| SpriteMancer backend | `8000` |
| SpriteMancer frontend | `3000` |

---

## License

- **Godot Engine base:** MIT
- **Agentic Godot & SpriteMancer integrations:** Proprietary (KalkiVerse / ZeroGraft)
