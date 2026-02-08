# End-to-End Game Creation Test Checklist

> **Version:** 1.0  
> **Date:** 2026-01-24  
> **Purpose:** Manual testing scenarios for the Agent Game Creation workflow

---

## Prerequisites

### Backend Services
- [ ] **SpriteMancer Backend** running at `http://localhost:8000`
  ```bash
  cd Spritemancerai/backend && uvicorn main:app --reload --port 8000
  ```
- [ ] **MCP Server** running (auto-started by Godot)
  ```bash
  cd src/zerograft-ai/src/mcp-servers/godot && npm start
  ```

### Godot Editor
- [ ] Godot built with AI panel (`scons -j8 platform=macos target=editor`)
- [ ] AI panel visible in bottom dock
- [ ] Empty or new project open

---

## Scenario 1: Full Game Creation Flow

**Prompt:** "Create a simple platformer game"

### Expected Flow

| Step | Agent Action | User Action | Expected Result |
|------|-------------|-------------|-----------------|
| 1 | `start_plan` | - | Plan appears in Blueprint tab |
| 2 | `spritemancer_create_character` | - | Character reference image generated |
| 3 | `ask_followup_question` | Say "yes" | - |
| 4 | `spritemancer_generate_animations` | - | Idle animation generated |
| 5 | `ask_followup_question` | Say "looks good" | - |
| 6 | `spritemancer_approve_animation` | - | Frames saved to `res://sprites/` |
| 7 | `setup_player_with_sprites` | - | Player.tscn created with script |
| 8 | `create_scene` (Level) | - | Level.tscn created |
| 9 | `scene_instantiate` | - | Player added to Level |
| 10 | `add_input_action` (×3) | - | move_left, move_right, jump |
| 11 | `set_project_setting` | - | Main scene set |
| 12 | `run_game` | Test movement | Game runs, player moves |
| 13 | `attempt_completion` | - | Summary shown |

### Success Criteria
- [ ] Total tool calls: **< 20**
- [ ] No repeated failed attempts
- [ ] Player.tscn exists at `res://scenes/Player.tscn`
- [ ] Player has AnimatedSprite2D with assigned sprite_frames
- [ ] Game runs with arrow keys / WASD movement
- [ ] Player can jump (if jump input exists)

---

## Scenario 2: Small Task (Skip Plan)

### Test 2a: Add a Node
**Prompt:** "Add a Sprite2D node"

| Expected | Actual |
|----------|--------|
| NO `start_plan` called | [ ] |
| Direct `add_node` call | [ ] |
| `attempt_completion` in < 3 calls | [ ] |

### Test 2b: Run Game
**Prompt:** "Run the game"

| Expected | Actual |
|----------|--------|
| Direct `run_game` call | [ ] |
| Total calls: 1-2 | [ ] |

### Test 2c: Change Property
**Prompt:** "Change the player position to 100, 200"

| Expected | Actual |
|----------|--------|
| NO `start_plan` | [ ] |
| Direct `set_property` call | [ ] |

---

## Scenario 3: SpriteMancer → Scene Bridge

**Setup:** Have a SpriteMancer project with generated character

**Prompt:** "Set up a player with sprite_frames_path res://sprites/knight_abc123/knight.tres"

### Success Criteria
- [ ] `setup_player_with_sprites` called
- [ ] Player scene created in single compound call
- [ ] Contains: CharacterBody2D, CollisionShape2D, AnimatedSprite2D
- [ ] AnimatedSprite2D has sprite_frames assigned
- [ ] Movement script attached

---

## Scenario 4: Error Recovery

### Test 4a: No Scene Open
**Prompt:** (with no scene open) "Add a player node"

| Expected | Actual |
|----------|--------|
| Error detected | [ ] |
| Recovery hint shown | [ ] |
| Agent creates/opens scene | [ ] |

### Test 4b: DNA Extraction Failed
**Setup:** Character created but DNA sync failed

| Expected | Actual |
|----------|--------|
| `spritemancer_retry_dna` called | [ ] |
| DNA extracted successfully | [ ] |

---

## Test Results Summary

| Scenario | Pass/Fail | Notes |
|----------|-----------|-------|
| 1: Game Creation | - | |
| 2a: Add Node | - | |
| 2b: Run Game | - | |
| 2c: Change Property | - | |
| 3: SpriteMancer Bridge | - | |
| 4a: No Scene Recovery | - | |
| 4b: DNA Retry | - | |

**Overall Result:** ⬜ Pass / ⬜ Fail

---

## Debugging Tips

### Check Agent Logs
```bash
# MCP Server logs (in terminal running npm start)
[TaskExecutor] Small task detected - will skip plan guidance
[TaskExecutor] Injected recipe context: simple_game_workflow
```

### Check SpriteMancer Backend
```bash
# Should see requests to /api/generate/* endpoints
curl http://localhost:8000/health
```

### Verify Test Count
```bash
cd src/zerograft-ai/src/mcp-servers/godot
npm test  # Should show 121+ tests passing
```

---

## Legend
- ⬜ Not tested
- ✅ Passed
- ❌ Failed
