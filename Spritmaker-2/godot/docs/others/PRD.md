# Agentic Godot - Product Requirements Document

> **Version:** 1.0.0  
> **Date:** January 6, 2026  
> **Author:** KalkiVerse Team  
> **Status:** Planning Phase

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Product Vision](#3-product-vision)
4. [Target Users](#4-target-users)
5. [Competitive Analysis](#5-competitive-analysis)
6. [Core Features](#6-core-features)
7. [Technical Architecture](#7-technical-architecture)
8. [User Experience](#8-user-experience)
9. [Integration Requirements](#9-integration-requirements)
10. [Success Metrics](#10-success-metrics)
11. [Risks & Mitigations](#11-risks--mitigations)
12. [Implementation Roadmap](#12-implementation-roadmap)
13. [Future Vision](#13-future-vision)

---

## 1. Executive Summary

### 1.1 What is Agentic Godot?

Agentic Godot is the **first unified AI game development IDE** that combines:

| Component | Source | What It Provides |
|-----------|--------|------------------|
| **Void Editor** | Fork of voideditor/void | Proven AI agent architecture, MCP support, Monaco editor |
| **Godot Engine** | Fork of godotengine/godot | Full 2D/3D game engine, GDScript, cross-platform export |
| **SpriteMancer** | **BUILT-IN** from Spritmaker-2 | AI-powered sprite generation, animations, normal maps |

> **Note**: SpriteMancer runs **locally** within Agentic Godot - it's not an external API call!

### 1.2 The Value Proposition

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║   "Describe your game in plain English. Ship it in hours, not months."       ║
║                                                                               ║
║   • Natural language → working game code                                      ║
║   • AI generates sprites, animations, and assets                              ║
║   • One download, one app, complete experience                                ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### 1.3 Key Differentiators

| What We Have | What Others Don't |
|--------------|-------------------|
| **Unified Application** | Single download vs. plugins + addons |
| **Void's AI Stack** | Proven agent architecture with MCP |
| **SpriteMancer Integration** | Native AI asset generation (built-in) |
| **Monaco Editor** | Full VS Code editing in a game engine |
| **KalkiVerse Quality** | Professional-grade, polished product |

---

## 2. Problem Statement

### 2.1 The Current Game Development Landscape

Game development requires expertise across multiple domains:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     TRADITIONAL GAME DEVELOPMENT                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐  │
│   │ PROGRAMMING │     │    ART      │     │       DESIGN            │  │
│   │             │     │             │     │                         │  │
│   │ • GDScript  │     │ • Aseprite  │     │ • Level design          │  │
│   │ • C#        │     │ • Photoshop │     │ • Game mechanics        │  │
│   │ • Visual    │     │ • Animation │     │ • UX/UI                 │  │
│   │   scripting │     │   software  │     │                         │  │
│   └─────────────┘     └─────────────┘     └─────────────────────────┘  │
│         │                   │                       │                  │
│         └───────────────────┼───────────────────────┘                  │
│                             │                                          │
│                             ▼                                          │
│                    ┌─────────────────┐                                 │
│                    │  MULTIPLE TOOLS │                                 │
│                    │  STEEP LEARNING │                                 │
│                    │  HIGH BARRIER   │                                 │
│                    └─────────────────┘                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Pain Points

| Pain Point | Impact | Who Suffers |
|------------|--------|-------------|
| **Tool Fragmentation** | Context switching, lost productivity | All developers |
| **Steep Learning Curve** | Months to become proficient | Beginners, hobbyists |
| **Art Creation Barrier** | Programmers can't make good art | Solo devs, small teams |
| **Code Complexity** | Writing GDScript from scratch | Artists, designers |
| **AI Tools Scattered** | No unified AI experience | Everyone |
| **Plugins Don't Integrate** | Manual setup, compatibility issues | Power users |

### 2.3 The Opportunity

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MARKET OPPORTUNITY                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  • Godot is the fastest-growing open-source game engine                │
│  • AI coding assistants are becoming mainstream                         │
│  • No unified AI+Engine solution exists for Godot                      │
│  • Unity/Unreal adding AI but proprietary and expensive                │
│  • Indie game market continues to grow                                 │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  "The market is ready for an AI-native, open-source game IDE"          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Product Vision

### 3.1 Vision Statement

> **"Transform game development from a technical discipline into a creative conversation."**

### 3.2 Core Principles

| Principle | Description |
|-----------|-------------|
| **AI-Native** | AI is not an add-on; it's fundamental to the experience |
| **Unified** | One application, not scattered plugins |
| **Extensible** | Plugin-friendly, MCP-based tool ecosystem |
| **Accessible** | Lower the barrier for all skill levels |
| **Powerful** | Professional capabilities, not just a toy |

### 3.3 The Agentic Godot Experience

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      THE AGENTIC GODOT EXPERIENCE                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   User: "Create a platformer with a knight that can double jump"       │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │  🤖 AI Agent Response:                                          │  │
│   │                                                                 │  │
│   │  ⚡ Creating scene: res://scenes/player.tscn                    │  │
│   │  ✅ Created CharacterBody2D with collision                      │  │
│   │                                                                 │  │
│   │  ⚡ Generating script: res://scripts/player.gd                  │  │
│   │  ✅ Added double jump with 2 mid-air jumps                      │  │
│   │                                                                 │  │
│   │  🎨 Generating sprites with SpriteMancer...                     │  │
│   │  ✅ Created knight_idle (4 frames)                              │  │
│   │  ✅ Created knight_run (6 frames)                               │  │
│   │  ✅ Created knight_jump (3 frames)                              │  │
│   │                                                                 │  │
│   │  ⚡ Importing assets to project...                              │  │
│   │  ✅ All assets imported with SpriteFrames                       │  │
│   │                                                                 │  │
│   │  🎮 Ready to play! Press F5 to test.                            │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│   Time elapsed: 47 seconds                                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Target Users

### 4.1 Primary Personas

#### Persona 1: The Indie Developer

| Attribute | Description |
|-----------|-------------|
| **Who** | Solo or 2-3 person team |
| **Skills** | Some programming, limited art |
| **Pain** | Wears too many hats, slow progress |
| **Goal** | Ship games faster with fewer resources |
| **Our Value** | AI handles code + art, 10x faster development |

#### Persona 2: The Game Jam Warrior

| Attribute | Description |
|-----------|-------------|
| **Who** | Participates in 48-72 hour jams |
| **Skills** | Good at one thing (code or art) |
| **Pain** | Never enough time, ideas die incomplete |
| **Goal** | Complete a game in the jam timeframe |
| **Our Value** | Rapid prototyping, instant assets |

#### Persona 3: The Hobbyist/Learner

| Attribute | Description |
|-----------|-------------|
| **Who** | Wants to make games, not a programmer |
| **Skills** | Creative ideas, minimal technical skills |
| **Pain** | Steep learning curve discourages them |
| **Goal** | Make their dream game a reality |
| **Our Value** | Natural language development, gentle onramp |

#### Persona 4: The Artist-Developer

| Attribute | Description |
|-----------|-------------|
| **Who** | Strong art skills, struggles with code |
| **Skills** | Expert in visual arts, basic scripting |
| **Pain** | Code is a bottleneck for their vision |
| **Goal** | Focus on art while AI handles logic |
| **Our Value** | AI writes code, they focus on aesthetics |

### 4.2 User Journey Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER JOURNEY                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  DISCOVER          ONBOARD           CREATE            SHIP             │
│     │                 │                 │                │              │
│     ▼                 ▼                 ▼                ▼              │
│  ┌─────┐          ┌─────┐          ┌─────────┐      ┌─────────┐        │
│  │Find │──────────│Setup│──────────│ Make    │──────│ Export  │        │
│  │tool │          │ LLM │          │ game    │      │ & Share │        │
│  └─────┘          └─────┘          └─────────┘      └─────────┘        │
│     │                 │                 │                │              │
│     │                 │                 │                │              │
│  "I need a        "That was        "Wow, it         "I shipped        │
│   better way"      easy!"           actually          a game!"         │
│                                     works!"                             │
│                                                                         │
│  Touchpoints:      Touchpoints:     Touchpoints:     Touchpoints:      │
│  • Website         • First-run      • AI chat        • Export wizard   │
│  • socials         • wizard         • SpriteMancer   • Itch.io         │
│  • word of         • Templates      • Live preview   • Steam           │
│    mouth                                                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Competitive Analysis

### 5.1 Direct Competitors

#### Godot AI Plugins

| Competitor | Strengths | Weaknesses | Our Advantage |
|------------|-----------|------------|---------------|
| **Godot AI Suite** | Agent mode, project context | Plugin only, no Monaco | Unified app, Void stack |
| **AI Assistant Hub** | Embedded AI, Ollama support | Code focus only | Full engine + assets |
| **GameDev Assistant** | One-click actions | Limited scope | Complete solution |
| **Orca Engine** | Scene manipulation | Separate backend | Single application |

#### Text-to-Game Platforms

| Competitor | Strengths | Weaknesses | Our Advantage |
|------------|-----------|------------|---------------|
| **Rosebud AI** | Easy text-to-game | Not a real engine | Full Godot engine |
| **Chaotix.ai** | Simple games fast | Very limited scope | Professional games |
| **Replit Game** | Browser-based | Simple 2D only | Full 2D/3D |
| **GDevelop** | No-code | Limited AI | True agentic AI |

#### Enterprise Solutions

| Competitor | Strengths | Weaknesses | Our Advantage |
|------------|-----------|------------|---------------|
| **Unity AI** | Official Unity | Proprietary, expensive | Open source, free |
| **Unreal Ludus** | 3D generation | Complex, enterprise | Accessible, 2D focus |

### 5.2 Competitive Positioning Map

```
                          HIGH AI CAPABILITY
                                 │
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    │  AGENTIC   │  Unity AI  │
                    │  GODOT ⭐  │            │
                    │            │            │
      OPEN ─────────┼────────────┼────────────┼───────── PROPRIETARY
      SOURCE        │            │            │
                    │  Godot AI  │  Rosebud   │
                    │  Suite     │            │
                    │            │            │
                    └────────────┼────────────┘
                                 │
                                 │
                         LOW AI CAPABILITY
```

### 5.3 Unique Value Proposition

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║  NOBODY ELSE HAS THIS COMBINATION:                                            ║
║                                                                               ║
║  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────────┐     ║
║  │   VOID'S AI     │ + │   GODOT ENGINE  │ + │   SPRITEMANCER          │     ║
║  │   ARCHITECTURE  │   │                 │   │   ASSET GENERATION      │     ║
║  │                 │   │                 │   │                         │     ║
║  │ • MCP Protocol  │   │ • Full 2D/3D    │   │ • AI Sprites            │     ║
║  │ • Agent Mode    │   │ • GDScript      │   │ • Animations            │     ║
║  │ • Multi-LLM     │   │ • Live Preview  │   │ • Normal Maps           │     ║
║  │ • Monaco Editor │   │ • Cross-export  │   │ • Auto-import           │     ║
║  └─────────────────┘   └─────────────────┘   └─────────────────────────┘     ║
║                                                                               ║
║                    ═════════════════════════════════                          ║
║                                   ║                                           ║
║                                   ▼                                           ║
║                         AGENTIC GODOT 🚀                                      ║
║                                                                               ║
║  • Proprietary software (KalkiVerse)                                         ║
║  • One downloadable application                                               ║
║  • Works offline with local LLMs                                              ║
║  • Professional-grade output                                                  ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## 6. Core Features

### 6.1 Feature Overview

| Category | Feature | Priority | Status |
|----------|---------|----------|--------|
| **AI Agent** | Natural language game development | P0 | Planned |
| **AI Agent** | Agent Mode (autonomous actions) | P0 | Planned |
| **AI Agent** | Gather Mode (codebase Q&A) | P1 | Planned |
| **Editor** | Monaco code editor | P0 | Planned |
| **Editor** | Scene tree integration | P0 | Planned |
| **Editor** | GDScript completions | P0 | Planned |
| **Assets** | SpriteMancer panel | P1 | Planned |
| **Assets** | AI sprite generation | P1 | Planned |
| **Assets** | Auto-import to Godot | P1 | Planned |
| **LLM** | Multi-provider support | P0 | Planned |
| **LLM** | Local LLM (Ollama) | P1 | Planned |
| **Engine** | Full Godot 4.3 | P0 | Planned |
| **Engine** | Custom branding | P2 | Planned |

### 6.2 Feature Details

#### 6.2.1 AI Agent Panel

**Description**: The primary interface for AI-assisted development

**User Stories**:
- As a user, I want to describe game features in natural language
- As a user, I want the AI to create scenes and scripts for me
- As a user, I want to see what actions the AI is taking
- As a user, I want to undo AI actions if I don't like them

**UI Mockup**:
```
┌────────────────────────────────────────────┐
│  🤖 AI Agent                          [⚙️] │
├────────────────────────────────────────────┤
│ ┌────────────────────────────────────────┐ │
│ │ Mode: [Agent ▼]  [Gather]              │ │
│ └────────────────────────────────────────┘ │
├────────────────────────────────────────────┤
│ ┌────────────────────────────────────────┐ │
│ │ 🤖 Ready! Describe what you want to    │ │
│ │ create.                                │ │
│ └────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────┐ │
│ │ 👤 Create a player with wall jump     │ │
│ └────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────┐ │
│ │ 🤖 Creating player...                  │ │
│ │                                        │ │
│ │ ⚡ Creating scene: player.tscn         │ │
│ │ ✅ Done                                │ │
│ │                                        │ │
│ │ ⚡ Creating script: player.gd          │ │
│ │ ✅ Done                                │ │
│ │                                        │ │
│ │ ```gdscript                            │ │
│ │ extends CharacterBody2D                │ │
│ │ @export var wall_jump_force = 300      │ │
│ │ ...                                    │ │
│ │ ```                                    │ │
│ │                                        │ │
│ │ [Apply] [Show Full] [Undo]             │ │
│ └────────────────────────────────────────┘ │
├────────────────────────────────────────────┤
│ ┌────────────────────────────────────────┐ │
│ │ 📊 Context                             │ │
│ │ Scene: player.tscn                     │ │
│ │ Nodes: 4  Scripts: 1                   │ │
│ └────────────────────────────────────────┘ │
├────────────────────────────────────────────┤
│ ┌────────────────────────────────────────┐ │
│ │                                        │ │
│ │ Type your message...                   │ │
│ │                                        │ │
│ └────────────────────────────────────────┘ │
│ [📎] [🎨 Sprite]                [Send ➤] │
└────────────────────────────────────────────┘
```

**Acceptance Criteria**:
- [ ] User can type natural language commands
- [ ] AI responds with actions and results
- [ ] Actions are executed in Godot
- [ ] All actions support undo/redo
- [ ] Context is shown (current scene, selection)
- [ ] Mode can be switched (Agent/Gather)

#### 6.2.2 SpriteMancer Panel

**Description**: AI-powered sprite and animation generation

**User Stories**:
- As a user, I want to generate sprites from text descriptions
- As a user, I want to preview generated sprites with animation
- As a user, I want to import sprites directly into my Godot project
- As a user, I want normal maps generated automatically

**UI Mockup**:
```
┌────────────────────────────────────────────┐
│  🎨 SpriteMancer                      [⚙️] │
├────────────────────────────────────────────┤
│ ┌────────────────────────────────────────┐ │
│ │         ┌─────────────────┐            │ │
│ │         │                 │            │ │
│ │         │      🏃‍♂️         │            │ │
│ │         │    Preview      │            │ │
│ │         │                 │            │ │
│ │         └─────────────────┘            │ │
│ │                                        │ │
│ │ [◀] Frame 2/6 [▶]      [▶ Play]       │ │
│ └────────────────────────────────────────┘ │
├────────────────────────────────────────────┤
│ ┌────────────────────────────────────────┐ │
│ │ Animations:                            │ │
│ │ [idle✓] [run✓] [jump] [attack]        │ │
│ └────────────────────────────────────────┘ │
├────────────────────────────────────────────┤
│ ┌────────────────────────────────────────┐ │
│ │ Current: Knight Character              │ │
│ │ Size: 32x32                            │ │
│ │ Frames: 16 total                       │ │
│ │                                        │ │
│ │ ☑ Include Normal Map                   │ │
│ │ ☐ Include Specular Map                 │ │
│ └────────────────────────────────────────┘ │
├────────────────────────────────────────────┤
│                                            │
│ [Generate New]     [Import to Godot]       │
│                                            │
└────────────────────────────────────────────┘
```

**Acceptance Criteria**:
- [ ] User can describe character/object in text
- [ ] System generates sprite with multiple frames
- [ ] Preview shows animation playback
- [ ] One-click import to Godot project
- [ ] SpriteFrames resource created automatically
- [ ] Normal maps generated on request

#### 6.2.3 Agent Actions

**Description**: Actions the AI can execute in Godot

| Action | Parameters | Description |
|--------|------------|-------------|
| `create_scene` | path, root_type, root_name | Create a new .tscn file |
| `add_node` | parent, type, name, properties | Add node to scene |
| `remove_node` | node_path | Remove node from scene |
| `create_script` | path, content, attach_to | Create .gd file |
| `modify_script` | path, changes | Edit existing script |
| `set_property` | node_path, property, value | Set node property |
| `connect_signal` | source, signal, target, method | Connect signals |
| `request_sprite` | description, animations | Generate via SpriteMancer |
| `import_asset` | source, destination | Import to res:// |
| `run_game` | scene? | Run the game |

---

## 7. Technical Architecture

### 7.1 Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        AGENTIC GODOT ARCHITECTURE                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                      GODOT ENGINE FORK                                 │  │
│  │                                                                        │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │  │
│  │  │                    GODOT CORE (C++)                              │ │  │
│  │  │  Scenes │ Rendering │ Physics │ Audio │ Networking              │ │  │
│  │  └──────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                        │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │  │
│  │  │                  CUSTOM MODULES (C++)                            │ │  │
│  │  │                                                                  │ │  │
│  │  │  ┌──────────────────┐  ┌──────────────────────────────────────┐ │ │  │
│  │  │  │ godot_cef        │  │ godot_void_bridge                    │ │ │  │
│  │  │  │ (WebView Host)   │  │ (IPC to Void)                        │ │ │  │
│  │  │  └──────────────────┘  └──────────────────────────────────────┘ │ │  │
│  │  │                                                                  │ │  │
│  │  └──────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                        │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │  │
│  │  │                    GODOT EDITOR                                  │ │  │
│  │  │                                                                  │ │  │
│  │  │  ┌────────────┐ ┌────────────┐ ┌──────────────────────────────┐ │ │  │
│  │  │  │ Scene Tree │ │ Inspector  │ │       VOID PANEL             │ │ │  │
│  │  │  │ (Native)   │ │ (Native)   │ │       (CEF WebView)          │ │ │  │
│  │  │  │            │ │            │ │                              │ │ │  │
│  │  │  │            │ │            │ │  • AI Chat (Monaco)          │ │ │  │
│  │  │  │            │ │            │ │  • SpriteMancer              │ │ │  │
│  │  │  │            │ │            │ │  • Code Editor               │ │ │  │
│  │  │  └────────────┘ └────────────┘ └──────────────────────────────┘ │ │  │
│  │  │                                                                  │ │  │
│  │  │  ┌──────────────────────────────────────────────────────────┐   │ │  │
│  │  │  │               VIEWPORT (Game Preview)                    │   │ │  │
│  │  │  └──────────────────────────────────────────────────────────┘   │ │  │
│  │  │                                                                  │ │  │
│  │  └──────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                        │                                     │
│                                        │ WebSocket IPC                       │
│                                        ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                       VOID BACKEND (Node.js)                           │  │
│  │                                                                        │  │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌────────────────────────┐   │  │
│  │  │ VoidModelService│ │ AgentOrchestrator│ │ MCP Server            │   │  │
│  │  │                 │ │                 │ │                        │   │  │
│  │  │ • Gemini        │ │ • Agent Mode    │ │ • GodotTools           │   │  │
│  │  │ • Claude        │ │ • Gather Mode   │ │ • SpriteMancerTools    │   │  │
│  │  │ • OpenAI        │ │ • Plan Mode     │ │ • FileSystemTools      │   │  │
│  │  │ • Local/Ollama  │ │                 │ │                        │   │  │
│  │  └─────────────────┘ └─────────────────┘ └────────────────────────┘   │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Component Details

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed technical specifications.

### 7.3 Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Game Engine** | Godot 4.3 (C++) | Core engine |
| **AI Backend** | Void (Node.js/TypeScript) | Agent logic |
| **WebView** | CEF (Chromium) | Embed Void UI |
| **Code Editor** | Monaco | GDScript editing |
| **IPC** | WebSocket | Godot ↔ Void |
| **LLM** | Multi-provider | AI generation |
| **Assets** | SpriteMancer API | Sprite generation |

---

## 8. User Experience

### 8.1 First-Run Experience

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                       Welcome to Agentic Godot!                         │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   🤖 AI-Powered Game Development                                       │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                                                                 │  │
│   │   Choose your AI backend:                                       │  │
│   │                                                                 │  │
│   │   ○ Local LLM (Privacy-first, runs on your computer)           │  │
│   │     └ Download Qwen 2.5 Coder (3GB)                            │  │
│   │                                                                 │  │
│   │   ○ Cloud API (Faster, requires API key)                       │  │
│   │     ├ Gemini (Free tier available) ⭐ Recommended              │  │
│   │     ├ Claude                                                    │  │
│   │     └ OpenAI                                                    │  │
│   │                                                                 │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │   SpriteMancer (AI Asset Generation):                           │  │
│   │   API Key: [________________________] [Get Free Key]            │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│   [Skip for Now]                                   [Get Started →]     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Main Editor Layout

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  🎮 Agentic Godot        [Project Name]                   [▶ Run] [🐛 Debug] ⚙️ │
├──────────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌──────────────────────────────────────┐ ┌─────────────────┐ │
│ │                 │ │                                      │ │                 │ │
│ │  📁 EXPLORER    │ │                                      │ │  🤖 AI CHAT     │ │
│ │                 │ │                                      │ │                 │ │
│ │  📂 scenes/     │ │                                      │ │  ┌───────────┐  │ │
│ │    └ main.tscn  │ │         [CODE EDITOR]                │ │  │ Agent     │  │ │
│ │    └ player.tscn│ │                                      │ │  │ Mode: ON  │  │ │
│ │  📂 scripts/    │ │         player.gd                    │ │  └───────────┘  │ │
│ │    └ player.gd  │ │                                      │ │                 │ │
│ │  📂 assets/     │ │  1  extends CharacterBody2D          │ │  Messages...    │ │
│ │    └ sprites/   │ │  2                                   │ │                 │ │
│ │                 │ │  3  @export var speed = 200          │ │                 │ │
│ │ ──────────────  │ │  4  @export var jump = -400          │ │                 │ │
│ │                 │ │  5                                   │ │ ────────────────│ │
│ │  🌳 SCENE TREE  │ │  6  func _physics_process(delta):   │ │                 │ │
│ │                 │ │  7      ...                         │ │  📊 CONTEXT     │ │
│ │  ▼ Player       │ │                                      │ │                 │ │
│ │    ├ Sprite2D   │ │                                      │ │  Scene: player  │ │
│ │    ├ Collision  │ │                                      │ │  Nodes: 4       │ │
│ │    └ Camera2D   │ │                                      │ │                 │ │
│ │                 │ │                                      │ │                 │ │
│ ├─────────────────┤ ├──────────────────────────────────────┤ │                 │ │
│ │                 │ │                                      │ │ ────────────────│ │
│ │  🎨 SPRITEMANCER│ │         [GAME PREVIEW]               │ │                 │ │
│ │                 │ │                                      │ │  [Input field]  │ │
│ │  [Generate]     │ │    ┌─────────────────────┐           │ │                 │ │
│ │  ┌───────────┐  │ │    │                     │           │ │  [Send]         │ │
│ │  │  Preview  │  │ │    │     🎮 Game         │           │ │                 │ │
│ │  └───────────┘  │ │    │                     │           │ │                 │ │
│ │                 │ │    └─────────────────────┘           │ │                 │ │
│ └─────────────────┘ └──────────────────────────────────────┘ └─────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────────┤
│ 🟢 AI Connected │ GDScript │ Ln 6, Col 4 │ UTF-8 │ Gemini 1.5 Pro               │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Integration Requirements

### 9.1 SpriteMancer Integration

| Endpoint | Purpose |
|----------|---------|
| `POST /api/generate` | Generate base sprite |
| `POST /api/dna/extract` | Extract character DNA |
| `POST /api/animation/generate` | Generate animation frames |
| `POST /api/export/spritesheet` | Export as spritesheet |
| `POST /api/maps/normal` | Generate normal map |

### 9.2 LLM Providers

| Provider | API | Local Option |
|----------|-----|--------------|
| **Gemini** | Google AI Studio | No |
| **Claude** | Anthropic API | No |
| **OpenAI** | OpenAI API | No |
| **Ollama** | Local HTTP | Yes |
| **llama.cpp** | Native | Yes |

### 9.3 IPC Protocol

See [API_SPEC.md](./API_SPEC.md) for detailed protocol specification.

---

## 10. Success Metrics

### 10.1 KPIs

| Category | Metric | Target | Measurement |
|----------|--------|--------|-------------|
| **Acquisition** | Downloads | 10,000 in first month | Analytics |
| **Activation** | Complete first-run | 80% | Analytics |
| **Engagement** | DAU/MAU | 40% | Analytics |
| **Retention** | 7-day retention | 50% | Analytics |
| **Satisfaction** | NPS score | > 50 | Survey |
| **Technical** | Agent success rate | > 85% | Logs |
| **Technical** | Startup time | < 5s | Performance |

### 10.2 Qualitative Goals

- [ ] "Wow" moment in first 5 minutes
- [ ] Users complete a playable game in first session
- [ ] Positive social media buzz
- [ ] Featured on Godot community channels
- [ ] Contributions from community

---

## 11. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Fork maintenance burden** | High | Medium | Minimal engine changes, focus on modules |
| **CEF size (~100MB)** | Certain | Medium | Lazy loading, optional download |
| **LLM costs for users** | Medium | Medium | Promote free tiers, local options |
| **Performance issues** | Medium | High | Early profiling, optimization phase |
| **Godot version updates** | High | Medium | Track stable branch, planned rebasing |
| **SpriteMancer dependency** | Low | High | Graceful degradation without it |

---

## 12. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-3)
- Fork Godot and Void repositories
- Set up build pipelines
- Integrate CEF into Godot
- Basic IPC between Godot and Void

### Phase 2: Core Integration (Weeks 4-7)
- Implement all agent actions
- GDScript context provider
- Monaco editor integration
- Scene tree bidirectional sync

### Phase 3: SpriteMancer (Weeks 8-9)
- SpriteMancer panel UI
- Asset generation workflow
- Auto-import to Godot
- SpriteFrames creation

### Phase 4: Polish (Weeks 10-12)
- First-run wizard
- Settings/preferences
- Documentation
- Alpha release

See [ROADMAP.md](./ROADMAP.md) for detailed timeline.

---

## 13. Future Vision

### Post-MVP Features

| Version | Features |
|---------|----------|
| **v1.1** | Tilemap AI generation, level design assist |
| **v1.2** | Audio/SFX integration |
| **v1.3** | 3D support, 3D asset generation |
| **v2.0** | Collaborative editing, cloud sync |

### Long-term Vision

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║   THE FUTURE OF GAME DEVELOPMENT:                                             ║
║                                                                               ║
║   "In 5 years, every game developer will have an AI copilot.                 ║
║    We're building that copilot as an open-source platform that               ║
║    anyone can use, extend, and improve."                                     ║
║                                                                               ║
║   • AI understands game design, not just code                                ║
║   • Natural language replaces complex UIs                                    ║
║   • Asset creation is instant, not a bottleneck                              ║
║   • Solo developers can build AAA-quality games                              ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| **Agent Mode** | AI operates autonomously, making changes |
| **Gather Mode** | AI analyzes codebase without changes |
| **GDScript** | Godot's Python-like scripting language |
| **MCP** | Model Context Protocol (AI tool calling) |
| **CEF** | Chromium Embedded Framework |
| **IPC** | Inter-Process Communication |

### B. References

- [Godot Engine](https://godotengine.org/)
- [Void Editor](https://voideditor.com/)
- [SpriteMancer](https://spritemancer.ai/)
- [Model Context Protocol](https://modelcontextprotocol.io/)

---

> **Document Status**: Draft  
> **Last Updated**: January 6, 2026  
> **Next Review**: Upon stakeholder feedback
