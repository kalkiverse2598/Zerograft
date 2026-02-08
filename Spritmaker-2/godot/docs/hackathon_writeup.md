# 🎮 Agentic Godot

## **A fork of Godot Engine with the power of AI**

> Describe your game in natural language → AI generates art, writes code, configures physics, and builds playable scenes.

---

## 🚀 What Is Agentic Godot?

**Agentic Godot** is an MVP prototype that transforms game development into a conversation. Describe what you want in plain English, and Gemini 3 builds it—generating pixel art, writing GDScript, and configuring physics in real-time inside a forked Godot Engine.

### Gemini 3 Powers Everything:

**🔧 87 Native Functions** — Scene creation, node manipulation, GDScript generation, physics setup, and AI art—all as Gemini function declarations. No prompt hacks, pure structured API.

**🧠 Extended Thinking** — Complex requests like "Design a platformer with enemies and parallax" trigger multi-step planning with configurable thinking budgets.

**📡 Live Streaming** — Watch AI reasoning unfold token-by-token in our custom 2,400-line C++ editor panel embedded in Godot's native UI.

**👁️ Vision Debugging** — Attach screenshots. Gemini *sees* your viewport to diagnose positioning bugs and verify visual changes.

### Human-AI Collaboration:

A **multi-agent orchestrator** coordinates Character, Level, Architecture, and QA agents. Built-in approval workflow via `ask_followup_question`—AI proposes, you approve. Loop detection and error recovery ensure reliable 50+ step game builds.

**SpriteMancer** (25 tools) generates pixel-perfect characters, animations, 6 tileset types, VFX effects, and parallax backgrounds—all through Gemini function calls.

**Impact:** One-person studios can now ship games in days and weeks, not months and years.

---

## 🎨 SpriteMancer: AI Art Pipeline

**Powered by:**
- **Nana Banana Pro** — Image generation backbone
- **Gemini 3 Pro** — Script and code generation
- **Gemini 3 Flash** — Generated image analysis
- **Built-in Pixel Editor** — Manual corrections and custom creation

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

**Tools:** `create_character`, `use_existing`, `generate_animations`, `approve_animation`, `retry_dna`, `create_sprite_frames`

---

### Tileset & Environment Generation

| Category | Tools | Examples |
|----------|-------|----------|
| **Terrain** | 9-tile seamless | grass, dirt, stone, sand |
| **Platforms** | 6-piece | wooden, stone, floating island |
| **Walls** | 9-tile dungeon | castle, cave, brick |
| **Decorations** | Props | crates, barrels, chests |
| **Parallax** | 3-layer | far, mid, near with alpha |
| **VFX** | Effects | explosion, fire, magic |

All tilesets export to Godot .tres with optional physics/collision.

---

## 📊 System Architecture

```
╔═══════════════════════════════════════════════════════════════════════╗
║                     🎮 AGENTIC GODOT                                  ║
║           "A Fork of Godot Engine with the Power of AI"              ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║  ┌─────────────────────────────────────────────────────────────────┐  ║
║  │  👤 DEVELOPER INPUT                                             │  ║
║  │  "Create a knight with double-jump" + 📸 Screenshots            │  ║
║  └────────────────────────────┬────────────────────────────────────┘  ║
║                               │                                       ║
║                               ▼                                       ║
║  ╔═════════════════════════════════════════════════════════════════╗  ║
║  ║  🤖 GEMINI 3 API LAYER                                          ║  ║
║  ╠═════════════════════════════════════════════════════════════════╣  ║
║  ║  ⚡ 87 Native    │ 🧠 Extended   │ 📡 Live      │ 👁️ Vision    ║  ║
║  ║     Functions   │    Thinking   │   Streaming  │   Analysis   ║  ║
║  ╚═════════════════════════════════════════════════════════════════╝  ║
║                               │                                       ║
║                               ▼                                       ║
║  ┌─────────────────────────────────────────────────────────────────┐  ║
║  │  🧠 AI ROUTER + TASK EXECUTOR                                   │  ║
║  │  Loop Detection │ Error Recovery │ Context Summarization        │  ║
║  └────────────────────────────┬────────────────────────────────────┘  ║
║                               │                                       ║
║                               ▼                                       ║
║  ╔═════════════════════════════════════════════════════════════════╗  ║
║  ║  🤝 MULTI-AGENT ORCHESTRATOR (LangGraph-style FSM)              ║  ║
║  ╠═════════════════════════════════════════════════════════════════╣  ║
║  ║  🏗️ Architecture │ 👤 Character │ 🗺️ Level │ ✅ QA Agent       ║  ║
║  ║     Agent       │    Agent     │   Agent  │   (Verify)        ║  ║
║  ╚═════════════════════════════════════════════════════════════════╝  ║
║                               │                                       ║
║          ┌────────────────────┴────────────────────┐                  ║
║          ▼                                         ▼                  ║
║  ╔═══════════════════════╗         ╔══════════════════════════════╗   ║
║  ║  🎨 SPRITEMANCER      ║         ║  🎮 GODOT ENGINE (Fork)      ║   ║
║  ╠═══════════════════════╣         ╠══════════════════════════════╣   ║
║  ║  Nana Banana Pro      ║         ║  Custom AI Panel (C++)       ║   ║
║  ║  Gemini 3 Pro/Flash   ║◀───────▶║  Monaco Code Editor          ║   ║
║  ║  Built-in Pixel Editor║         ║  Scene Tree │ Physics        ║   ║
║  ║  25 Generation Tools  ║         ║  GDScript │ TileMaps         ║   ║
║  ╚═══════════════════════╝         ╚══════════════════════════════╝   ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

---

## ⚡ Gemini 3 Features

### 🔧 87 Native Functions

| Category | Count | Examples |
|----------|-------|----------|
| Scene | 17 | `create_scene`, `add_node`, `save_scene` |
| Script | 8 | `create_script`, `edit_script`, `get_errors` |
| SpriteMancer | 25 | Characters, tilesets, parallax, VFX |
| Agentic | 7 | `start_plan`, `ask_followup_question` |
| Input/Files/Resources | 30 | Signals, files, physics |
| **Total** | **87** | |

### 🧠 Extended Thinking + 📡 Streaming

```
🧠 Thinking: User wants a complete platformer...
   → Generate knight character first
   → Create terrain tileset
   → Set up parallax background...

🔧 Calling: spritemancer_create_character
✅ Success: Character preview ready
```

---

## 📈 Before vs After

| Traditional Workflow | Agentic Godot |
|---------------------|---------------|
| Learn Godot (1 week) | "Make a game" |
| Write GDScript (weeks) | AI writes code |
| Create pixel art (days) | SpriteMancer generates |
| Configure physics (hours) | AI handles collisions |
| Search docs & videos (hours) | Ask AI → instant guidance |
| **Total: Months-Years** | **Total: Days-Weeks** |

---

## ✅ Submission Checklist

- [x] **Gemini 3 API** — Native Function Calling, Thinking, Streaming, Multimodal
- [x] **Human-AI Loop** — Built-in approval workflow
- [x] **SpriteMancer** — 25 tools + Nana Banana Pro + Pixel Editor
- [x] **Working MVP** — Testable demo
- [x] **~200 Words** — ✓ Complete
- [ ] **Demo Video** — 3 min walkthrough
- [ ] **Public GitHub** — Ready to publish
