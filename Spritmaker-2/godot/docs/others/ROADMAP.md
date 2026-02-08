# Agentic Godot - Implementation Roadmap

> **Version:** 1.0.0  
> **Date:** January 6, 2026  
> **Last Updated:** January 9, 2026  
> **Total Duration:** 12 weeks

---

## Overview

```
Week  1   2   3   4   5   6   7   8   9  10  11  12
      |---|---|---|---|---|---|---|---|---|---|---|
Phase 1: Foundation     ████████████
Phase 2: Core Integration         ████████████████
Phase 3: SpriteMancer                       ████████
Phase 4: Polish & Release                       ████████
```

---

## Phase 1: Foundation (Weeks 1-3)

### Goals
- Set up both fork repositories
- Establish build pipelines
- Basic CEF integration
- Proof-of-concept IPC

### Week 1: Repository Setup ✅ COMPLETE

| Task | Owner | Status |
|------|-------|--------|
| Clone godotengine/godot | - | ✅ |
| Clone cline/cline | - | ✅ |
| Create project structure (src/) | - | ✅ |
| Create module scaffolds | - | ✅ |
| Custom branding (icons, splash) | - | ⬜ |

### Week 2: CEF Integration ✅ COMPLETE

| Task | Owner | Status |
|------|-------|--------|
| godot_cef module (CEFPanel) | - | ✅ |
| godot_bridge module (GodotBridge) | - | ✅ |
| Build Godot with modules | - | ✅ |
| Modules appear in editor | - | ✅ |
| Test basic functionality | - | ✅ |

### Week 3: Basic IPC ✅ COMPLETE

| Task | Owner | Status |
|------|-------|--------|
| EditorPlugin (AgenticGodotPlugin) | - | ✅ |
| GodotBridge auto-start | - | ✅ |
| TCP connection working | - | ✅ |
| JSON message parsing | - | ✅ |
| Test external client (nc) | - | ✅ |

**Milestone 1**: ✅ IPC working - external clients can connect to GodotBridge!

---

## Phase 2: Core Integration (Weeks 4-7)

### Goals
- Full IPC protocol
- All agent actions working
- Monaco editor integration
- Real-time context sync

### Week 4: Agent Actions ✅ COMPLETE

| Task | Owner | Status |
|------|-------|--------|
| TypeScript TCP client (godotBridge.ts) | - | ✅ |
| Method routing in GodotBridge C++ | - | ✅ |
| Response sending to client | - | ✅ |
| Full round-trip test | - | ✅ |

**Milestone 2**: ✅ Cline ↔ Godot IPC working!

---

### Week 5: Godot API ✅ COMPLETE

| Task | Owner | Status |
|------|-------|--------|
| Implement get_scene_tree (real) | - | ✅ |
| Implement createScene | - | ✅ |
| Implement addNode/removeNode | - | ✅ |
| Implement createScript | - | ✅ |
| Implement setProperty | - | ✅ |
| Implement run_game/stop_game | - | ✅ |

**Milestone 3**: ✅ Full Godot API working - AI can create scenes, scripts, and nodes!

### Week 6: AI Panel UI ✅ COMPLETE

| Task | Owner | Status |
|------|-------|--------|
| Create AIPanel dock | - | ✅ |
| Chat interface (input/output) | - | ✅ |
| Command parsing | - | ✅ |
| Wire up to GodotBridge | - | ✅ |
| Test create/add/run commands | - | ✅ |

**Milestone 4**: ✅ AI Panel working in Godot editor!

---

### Week 7: LLM Integration ✅ COMPLETE

| Task | Owner | Status |
|------|-------|--------|
| Port Cline core to standalone | - | ⬜ |
| Create Godot MCP Server | - | ✅ |
| Create SpriteMancer MCP Server | - | ✅ |
| GDScript system prompt | - | ✅ |
| Gemini LLM integration | - | ✅ |
| Real-time WebSocket streaming | - | ✅ |
| **Thinking Model Integration** | - | ✅ |

**Milestone 5**: ✅ AI Thinking Streaming working with gemini-2.5-flash!

### Week 7: Context & Events ✅ COMPLETE

| Task | Owner | Status |
|------|-------|--------|
| Scene changed events | - | ✅ |
| Selection changed events | - | ✅ |
| Script opened events | - | ✅ |
| Real-time context updates | - | ✅ |

**Milestone 6**: ✅ AI knows current scene, selected nodes, and open scripts!

### Week 8: Core Editor Commands ✅ COMPLETE

| Task | Owner | Status |
|------|-------|--------|
| rename_node | - | ✅ |
| duplicate_node | - | ✅ |
| move_node | - | ✅ |
| get_property | - | ✅ |
| save_scene | - | ✅ |
| open_scene | - | ✅ |

**Milestone 7**: ✅ Total 14 AI commands available!

### Week 9: Advanced AI ✅ COMPLETE

| Task | Owner | Status |
|------|-------|--------|
| read_script | - | ✅ |
| edit_script | - | ✅ |
| get_errors | - | ✅ |

**Milestone 8**: ✅ AI can read, edit, and debug scripts! Total 17 commands!

### Week 10: Extended Commands ✅ COMPLETE

| Task | Status |
|------|--------|
| list_scenes | ✅ |
| get_node_info | ✅ |
| copy_node | ✅ |
| list_files | ✅ |
| create_folder | ✅ |
| delete_file | ✅ |
| connect_signal | ✅ |
| list_signals | ✅ |

**Milestone 9**: ✅ Total 25 AI commands - Full project navigation!

### Week 11: Input & Groups ✅ COMPLETE

| Task | Status |
|------|--------|
| add_input_action | ✅ |
| list_input_actions | ✅ |
| set_project_setting | ✅ |
| get_project_setting | ✅ |
| add_to_group | ✅ |
| list_groups | ✅ |

**Milestone 10**: ✅ Total 31 commands - Complete playable games!

### Week 12: Remaining Gaps ✅ COMPLETE

| Task | Status |
|------|--------|
| remove_input_action | ✅ |
| remove_from_group | ✅ |
| create_resource | ✅ |
| load_resource | ✅ |
| set_audio_stream | ✅ |
| play_audio | ✅ |

**Milestone 11**: ✅ Total 37 commands - All game development gaps covered!

### Week 13: Phase 10 Enhanced Agent Capabilities ✅ COMPLETE

| Task | Status |
|------|--------|
| TypeScript prompt restructuring | ✅ |
| `prompts/` module (systemPrompt, toolDefinitions, examples) | ✅ |
| `llm/` module (baseLLM abstract, provider registry) | ✅ |
| `undo_last_action` C++ command | ✅ |
| `search_in_scripts` C++ command | ✅ |
| `get_selected_nodes` C++ command | ✅ |
| `start_plan` C++ command | ✅ |
| `update_plan` C++ command | ✅ |

**Milestone 12**: ✅ Total 42 commands + Model-agnostic architecture!

### Week 14: Phase 11-14 Critical Architecture ✅ COMPLETE

| Task | Status |
|------|--------|
| `get_open_scenes` | ✅ |
| `assets_scan` | ✅ |
| `assets_reimport` | ✅ |
| `assets_move_and_rename` | ✅ |
| `set_owner_recursive` | ✅ |
| `scene_pack` | ✅ |
| `scene_instantiate` | ✅ |
| `reparent_node` | ✅ |
| `tileset_create_atlas` | ✅ |
| `map_set_cells_batch` | ✅ |
| `navmesh_bake` | ✅ |
| `build_execute` | ✅ |
| `build_verify` | ✅ |

**Milestone 13**: ✅ Total 55 commands - Full 2D game creation + export!

### Week 15: GodotBridge Refactoring ✅ COMPLETE

| Task | Status |
|------|--------|
| Create `bridge_command_registry.h` | ✅ |
| Split to `bridge_commands_scene.cpp` | ✅ |
| Split to `bridge_commands_script.cpp` | ✅ |
| Split to `bridge_commands_filesystem.cpp` | ✅ |
| Split to `bridge_commands_input.cpp` | ✅ |
| Split to `bridge_commands_advanced.cpp` | ✅ |
| Replace 220-line if-else with registry | ✅ |
| Build verification | ✅ |

**Milestone 14**: ✅ Modular architecture - 85% code reduction in main file!

### Week 16: AI Panel UI Redesign ✅ COMPLETE

| Task | Status |
|------|--------|
| Tab system (Scene/Blueprint/Diff) | ✅ |
| [H] Chat History button | ✅ |
| Editable session name | ✅ |
| [+] New session button | ✅ |
| Blueprint → current_plan integration | ✅ |
| Diff tab file tracking | ✅ |
| `start_plan` / `update_plan` tools | ✅ |

**Milestone 15**: ✅ Modern AI IDE UI - Augment Code inspired!

### Week 16: Selection Detection & Agentic Loop ✅ COMPLETE

| Task | Status |
|------|--------|
| `get_selected_text` C++ command | ✅ |
| `get_selected_files` C++ command | ✅ |
| Made ScriptEditor methods public | ✅ |
| Tool definitions in TypeScript | ✅ |
| AI Panel result display | ✅ |
| **Agentic tool loop** (execute → analyze) | ✅ |
| Build verification | ✅ |

**Milestone 16**: ✅ 57 commands + Agentic Loop = Modern AI IDE experience!

---

## Phase 3: SpriteMancer (Weeks 8-9)

### Goals
- SpriteMancer panel in UI
- Full asset generation workflow
- Auto-import to Godot

### Week 17: SpriteMancer Integration 🚧 IN PROGRESS

| Task | Owner | Status |
|------|-------|--------|
| SpriteMancer API client (`spritemancerClient.ts`) | - | ✅ |
| SpriteMancer tool definitions (4 tools) | - | ✅ |
| Character generation workflow | - | ✅ |
| Animation generation workflow | - | ⚠️ Partial |
| aiRouter SpriteMancer routing | - | ✅ |
| **SpriteMancer Dock Panel** | - | ✅ |
| **SpriteMancer Main Screen** | - | ✅ |
| **Dock → Main Screen sync** | - | ✅ |
| **Agentic loop for SpriteMancer results** | - | ✅ |

### Week 18: SpriteMancer Pending 🔜

| Task | Owner | Status |
|------|-------|--------|
| Fix animation generation (difficulty tier) | - | ⬜ |
| Pixel editor WebView in Godot | - | ⬜ |
| AI Panel inline sprite preview | - | ⬜ |
| Download sprites to local | - | ⬜ |
| Import to res:// with proper resource | - | ⬜ |
| Create SpriteFrames from spritesheets | - | ⬜ |
| Normal map support | - | ⬜ |

**Milestone 17**: 🚧 SpriteMancer Panel UI complete, animation workflow pending!

### Week 18: macOS Rendering Crash Fix ✅ COMPLETE

| Task | Status |
|------|--------|
| Diagnose SIGSEGV in RenderingServerDefault::_init() | ✅ |
| Trace null `_create_func` in RendererCompositor | ✅ |
| Add safety guard with helpful error message | ✅ |
| Install MoltenVK via Homebrew | ✅ |
| Rebuild with `opengl3=yes vulkan=yes` | ✅ |
| Verify OpenGL + Vulkan both working | ✅ |

**Milestone 18**: ✅ macOS M4 rendering fixed - both OpenGL 4.1 Metal and Vulkan 1.2.323 working!

### Week 19: Animation & Preview Fixes ✅ COMPLETE

| Task | Status |
|------|--------|
| Fix animations array coercion (string→array) | ✅ |
| Fix difficulty_tier default (standard→LIGHT) | ✅ |
| Add spritesheet download to res://sprites/ | ✅ |
| AI Panel inline sprite preview | ✅ |
| Create project.godot for demo project | ✅ |

**Pending for Future:**
- [ ] Download individual frames (post-processed) vs raw spritesheet
- [ ] Auto-create SpriteFrames resource
- [ ] Fix Gemini grid detection (dict instead of string bug)
- [ ] Pixel Editor WebView integration (CEF/external browser)

**Milestone 19**: ✅ Animation generation fully working + AI Panel shows sprites inline!

### Week 20: gdCEF Embedded Browser ✅ COMPLETE

| Task | Status |
|------|--------|
| Build gdCEF for Godot 4.3 arm64 macOS | ✅ |
| Patch build.py (symlinks=True) | ✅ |
| Patch SConstruct (optional cef_sandbox) | ✅ |
| Copy cef_artifacts to project | ✅ |
| Test HelloCEF demo | ✅ |
| SpriteMancer main screen toggle button | ✅ |
| Dynamic GDScript scene loading | ✅ |
| GDCef ClassDB.instantiate() | ✅ |
| Add @tool for editor context | ✅ |
| CEF initializes and browser creates | ✅ |

**Milestone 20**: ✅ Embedded Chromium browser in Godot - Pixel editor loads inside SpriteMancer dock!

### Week 21: JavaScript IPC & Optimization ✅ COMPLETE

| Task | Status |
|------|--------|
| GDScript ↔ JavaScript IPC | ✅ |
| window.GodotBridge injection | ✅ |
| Save sprite to res://sprites/ | ✅ |
| Export spritesheet with metadata | ✅ |
| React godotBridge.ts utility | ✅ |
| useImportExport Godot functions | ✅ |
| spritemancer_open_in_editor command | ✅ |
| AI workflow integration | ✅ |
| Remove 659 unused locales | ✅ |
| Clear cache (141MB saved) | ✅ |
| 60fps → 30fps optimization | ✅ |
| Browser pause/resume C++ methods | ✅ |
| setHidden() CEF integration | ✅ |
| setFrameRate() CEF integration | ✅ |

**Optimization Results:**
- File size: 435MB → 247MB (43% reduction)
- CPU: 50%+ reduction via frame rate + pause

**Milestone 21**: ✅ Full Godot-Web IPC + Optimized embedded browser (247MB, auto-pause)

### CEF Bundling (for Distribution)
- `cef_artifacts/` bundled next to Godot executable
- C++ auto-detects location (no user setup needed)
- Distribution: use `cp -RL` to dereference symlinks

### Week 22: CEF Native Module Integration ✅ COMPLETE

| Task | Status |
|------|--------|
| Convert gdCEF GDExtension → native module | ✅ |
| pimpl pattern for CEF/Godot header isolation | ✅ |
| Dynamic framework loading on macOS | ✅ |
| Off-screen rendering pipeline | ✅ |
| Input forwarding (mouse/keyboard) | ✅ |
| Toggle crash fix (hide/show not destroy) | ✅ |
| Auto-pause on tab visibility change | ✅ |
| Browser resize on window change | ✅ |

**Milestone 22**: ✅ CEF embedded as native Godot module with full input/rendering!

---


## Phase 4: Polish & Release (Weeks 10-12)

### Goals
- First-run experience
- Settings/preferences
- Documentation
- Alpha release

### Week 10: User Experience

| Task | Owner | Status |
|------|-------|--------|
| First-run wizard | - | ⬜ |
| LLM provider setup | - | ⬜ |
| API key management | - | ⬜ |
| Settings persistence | - | ⬜ |

### Week 11: Templates & Docs

| Task | Owner | Status |
|------|-------|--------|
| Project templates (3+) | - | ⬜ |
| User documentation | - | ⬜ |
| Tutorial videos | - | ⬜ |
| README/website | - | ⬜ |

### Week 12: Release Prep

| Task | Owner | Status |
|------|-------|--------|
| Full QA testing | - | ⬜ |
| Performance optimization | - | ⬜ |
| Build all platforms | - | ⬜ |
| Release packaging | - | ⬜ |
| Launch announcement | - | ⬜ |

**Milestone 4**: v1.0.0 Alpha Release

---

### Week 22: Agentic Engine ✅ COMPLETE

| Task | Status |
|------|--------|
| Agentic loop state machine | ✅ |
| ToolQueue with safety guards | ✅ |
| TaskExecutor main loop | ✅ |
| ask_followup_question + attempt_completion | ✅ |
| Error recovery + logging | ✅ |
| SpriteMancer pipeline | ✅ |
| Blueprint/Diff tab integration | ✅ |
| Preview/test loop tools | ✅ |

**Files Created:** 6 TypeScript modules in `src/agentic/`  
**Tools Added:** 8 new tool definitions

---

### Week 23: Godot Game Development Recipes ✅ COMPLETE

| Task | Status |
|------|--------|
| Research Godot 4 best practices | ✅ |
| Create 16 recipe files (visual_layers, parallax, etc.) | ✅ |
| Enhanced `platformer_player` with Coyote Time/Jump Buffering | ✅ |
| Updated `platformer_level` with TileMapLayer (4.3+) | ✅ |
| Created `custom_resources` recipe | ✅ |
| Created `property_location` recipe (WHERE to modify settings) | ✅ |
| Keyword-based recipe lookup (`findRecipes()`) | ✅ |
| Integrate recipes into `get_godot_help` | ✅ |
| TypeScript compilation verified | ✅ |

**Milestone 23**: ✅ 16 comprehensive recipes for LLM-guided game development!

---

### Week 24: Agent Game Creation System ✅ COMPLETE

| Task | Status |
|------|--------|
| Phase 0: Error pattern detection + auto-recovery | ✅ |
| Phase 0: Loop detection (warns on 3 repeated tools) | ✅ |
| Phase 0: Scene state caching | ✅ |
| Phase 1: spritemancer_generate_character tool | ✅ |
| Phase 1: spritemancer_generate_animations tool | ✅ |
| Phase 1: spritemancer_approve_animation tool | ✅ |
| Phase 2: getRelevantRecipeContext() | ✅ |
| Phase 2: gatherProjectContext() | ✅ |
| Phase 3: next_action guidance in SpriteMancer responses | ✅ |
| Phase 3: setup_player_with_sprites compound tool | ✅ |
| Phase 4: isSmallTask() smart plan skipping | ✅ |
| Phase 4: verifyStepCompletion() with confidence scoring | ✅ |

**Test Coverage:** 117 automated tests across all phases

**Key Features:**
- AI creates complete playable games from natural language
- Character → Animation → Scene pipeline fully automated
- Smart plan skipping for simple tasks (faster execution)
- Tool-step verification prevents plan drift

**Documentation:**
- `docs/IMPLEMENTATION_PLAN_AGENT_GAME_CREATION.md`
- `docs/E2E_GAME_CREATION_TEST.md`

**Milestone 24**: ✅ Agent can create complete playable games in Godot!

---

## Post-Launch Roadmap

| Version | Timeline | Features |
|---------|----------|----------|
| v1.1 | +4 weeks | Tilemap AI, level design |
| v1.2 | +8 weeks | Audio/SFX integration |
| v1.3 | +12 weeks | Basic 3D support |
| v2.0 | +6 months | Collaborative, cloud sync |

---

## Resource Requirements

### Team
- 1 C++ developer (Godot modules)
- 1 TypeScript developer (Void integration)
- 1 Full-stack developer (SpriteMancer)
- 0.5 Designer (UI/UX)

### Infrastructure
- GitHub (repositories, Actions)
- CEF binary distribution
- SpriteMancer API access
- Test devices (Windows, macOS, Linux)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| CEF complexity | Start early, dedicated C++ dev |
| Fork maintenance | Minimal changes, modular approach |
| LLM costs | Promote free tiers, local options |
| Performance | Profile early, optimize phase 4 |
