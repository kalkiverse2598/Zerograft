# ZeroGraft Demo Guide

> **For Judges:** Copy-paste these prompts into the **AI Panel** inside the Godot editor.
> The AI will call tools automatically — watch it create scenes, write code, and generate art in real-time.

## Prerequisites

Make sure all 4 terminals are running (see README):

| Terminal | Service | How to verify |
|----------|---------|---------------|
| 1 | Godot Editor | Editor window is open |
| 2 | AI Router | `Godot MCP Server running` in console |
| 3 | SpriteMancer Backend | `Uvicorn running on port 8000` |
| 4 | SpriteMancer Frontend | `ready on localhost:3000` |

> Set your `GEMINI_API_KEY` in the `.env` file before starting the AI Router.

---

## Demo 1: Scene Creation + GDScript (No API needed for art)

Paste this into the AI Panel chat:

```
Create a 2D platformer scene called "Level1" with:
- A CharacterBody2D player with a Sprite2D and CollisionShape2D
- A StaticBody2D ground platform
- Write a GDScript for the player with movement (left/right arrows) and jump (space)
- Save everything
```

**What to watch:** The AI will call `create_scene`, `add_node` (multiple times), `create_script`, `attach_script`, and `save_scene` — all streamed live in the panel.

---

## Demo 2: AI Art Generation with SpriteMancer

```
Create a pixel art knight character with a sword, 32x32 side view
```

**What to watch:** The AI calls `spritemancer_create_character`, which generates a reference image via Gemini. It will then ask you to confirm before generating animations.

When it asks "Does this look good?", reply:

```
Yes, looks great! Generate idle, walk, and attack animations
```

**What to watch:** `spritemancer_generate_animations` triggers the full pipeline — DNA extraction → frame generation → post-processing. The AI will ask for approval before saving frames to the project.

---

## Demo 3: Multi-Step Game Building

```
Build me a simple coin collector game:
- A player character that can move and jump
- 5 coins scattered around the level
- A score counter in the top-left corner
- The coins disappear when the player touches them
```

**What to watch:** The AI uses extended thinking to plan multiple steps, then executes 10-15+ tool calls: creating scenes, nodes, scripts, and wiring up signals — all in one conversation.

---

## Demo 4: Vision Debugging (Screenshot)

1. Run the game in Godot (press F5)
2. If something looks wrong, take a screenshot
3. Paste the screenshot into the AI Panel and ask:

```
The player seems to be floating above the ground. Can you fix the collision?
```

**What to watch:** Gemini analyzes the screenshot, identifies the visual issue, and calls `get_sprite_dimensions` → `set_collision_shape` → `set_property` to fix it.

---

## Demo 5: Quick Commands

Try these one-liners to see individual tools in action:

| Prompt | Tools Called |
|--------|-------------|
| `Show me the scene tree` | `get_scene_tree` |
| `List all scenes in the project` | `list_scenes` |
| `Check for errors` | `get_errors` |
| `Add a Camera2D to the player` | `add_node` |
| `Create a health bar UI` | `create_scene`, `add_node` (multiple) |
| `Write a script that makes an enemy patrol between two points` | `create_script` |

---

## Tips

- **Watch the AI Panel** — you'll see thinking tokens stream in real-time, then tool calls execute
- **The AI asks before destructive actions** — it uses `ask_followup_question` for approval
- **SpriteMancer is optional** — Demos 1, 3, 4, 5 work without it. Demo 2 requires the backend
- **Everything happens inside Godot** — no browser or external tools needed for core features
