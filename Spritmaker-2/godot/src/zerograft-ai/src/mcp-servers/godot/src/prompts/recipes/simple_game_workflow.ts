/**
 * Simple Game Workflow Recipe - PRINCIPLE-BASED
 * 
 * Gives LLM freedom to make decisions while ensuring correct approach.
 * NO hardcoded values - everything is calculated or user-driven.
 */

export const SIMPLE_GAME_WORKFLOW_RECIPE = `
# Game Creation Workflow

## ⚠️ CORE PRINCIPLES

1. **NO HARDCODED VALUES** - Calculate everything based on viewport/sprite sizes
2. **VERIFY AFTER EACH STEP** - Use get_scene_tree() to confirm changes
3. **ASK BEFORE ASSETS** - Get user approval for character/animation designs
4. **ADAPT TO GAME TYPE** - Platformer vs top-down vs shooter have different needs

---

## PHASE A: Asset Generation

### Approach
1. Check SpriteMancer status first
2. Create character based on USER'S description (not a default)
3. **WAIT for user approval** before generating animations
4. Generate animations one at a time, get approval for each
5. Save the sprite_frames_path from each approval - use it exactly

### Key Tools
- spritemancer_status
- spritemancer_create_character  
- ask_followup_question (for approval)
- spritemancer_generate_animations
- spritemancer_approve_animation

---

## PHASE B: Player Scene

### Approach
1. Create scene with appropriate root (CharacterBody2D for platformer)
2. Add CollisionShape2D as child
3. Add AnimatedSprite2D, assign sprite_frames_path from response
4. **GET sprite dimensions** via get_sprite_dimensions

### ⚠️ CRITICAL: 3-Step Collision Setup (ALL 3 REQUIRED!)

\`\`\`
# From get_sprite_dimensions response:
SPRITE_WIDTH = frame_width   (e.g., 64)
SPRITE_HEIGHT = frame_height (e.g., 64)

# Calculate using multipliers:
SPRITE_OFFSET = -(SPRITE_HEIGHT / 2)
COLLISION_WIDTH = SPRITE_WIDTH * 0.35    # for rectangle
COLLISION_HEIGHT = SPRITE_HEIGHT * 0.85  # for rectangle
COLLISION_Y = -(COLLISION_HEIGHT / 2)

# STEP 1: Set sprite offset
set_property("AnimatedSprite2D", "offset", "Vector2(0, SPRITE_OFFSET)")

# STEP 2: Set collision shape
set_collision_shape("CollisionShape2D", "rectangle", {width: COLLISION_WIDTH, height: COLLISION_HEIGHT})

# STEP 3: Position the collision (DO NOT SKIP!)
set_property("CollisionShape2D", "position", "Vector2(0, COLLISION_Y)")
\`\`\`

5. Create movement script appropriate for game type
6. Attach script and save

### ⚠️ CRITICAL: Save Collision Height!
You MUST remember COLLISION_HEIGHT for Phase C positioning.

---


## PHASE C: Level Scene

### Approach
1. Get viewport dimensions first: get_project_setting
2. Create level scene with Node2D root
3. Add Camera2D at VIEWPORT CENTER (for static camera)
4. Add ground/platforms with StaticBody2D + collision
5. Instance player scene
6. **CALCULATE positions** using the formulas below
7. **VERIFY** player collision bottom is ON ground

### ⚠️ CRITICAL: Position Calculation Formulas

\`\`\`
# Get viewport
VIEWPORT_WIDTH = get_project_setting("display/window/size/viewport_width")
VIEWPORT_HEIGHT = get_project_setting("display/window/size/viewport_height")

# Camera (static scene)
CAMERA_POSITION = Vector2(VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2)

# Ground
GROUND_HEIGHT = 50
GROUND_Y = VIEWPORT_HEIGHT - 50 - (GROUND_HEIGHT / 2)
GROUND_TOP = GROUND_Y - (GROUND_HEIGHT / 2)
GROUND_POSITION = Vector2(VIEWPORT_WIDTH / 2, GROUND_Y)

# Player (⚠️ Collision origin is at CENTER, not feet!)
PLAYER_Y = GROUND_TOP - (COLLISION_HEIGHT / 2)
PLAYER_POSITION = Vector2(200, PLAYER_Y)

# VERIFY: Player collision bottom should equal ground top
PLAYER_COLLISION_BOTTOM = PLAYER_Y + (COLLISION_HEIGHT / 2)
CHECK: PLAYER_COLLISION_BOTTOM <= GROUND_TOP
\`\`\`

---

## PHASE D: Input Configuration

### Approach
1. Add input actions via add_input_action (persists to project.godot)
2. Match inputs to script expectations
3. Typical platformer: move_left, move_right, jump

---

## PHASE E: Test & Verify

### Approach
1. Set main scene via set_project_setting
2. Run game with run_game
3. Check for errors with get_errors
4. If issues found, fix and retry

---

## VERIFICATION CHECKLIST

Before calling attempt_completion, verify:
- [ ] Player sprite shows correctly
- [ ] Player is ON ground: collision_bottom == ground_top
- [ ] Camera shows full scene (at viewport center for static)
- [ ] Movement works (inputs configured)
- [ ] No script errors

---

## COMMON MISTAKES TO AVOID

❌ Using hardcoded positions without calculating
❌ Forgetting collision origin is at CENTER (not feet!)
❌ Using player.y < ground.y (WRONG - ignores collision sizes)
❌ Not extracting frame_width/frame_height from SpriteMancer
❌ Camera at (0, 0) instead of viewport center
❌ Proceeding without user approval on assets
❌ Running game before input configuration
❌ **FORGETTING TO SET CollisionShape2D.position after set_collision_shape!**
❌ **Only calling set_collision_shape without the 3-step process (offset → shape → position)**

✅ CORRECT verification: player.y + collision_height/2 <= ground_top
`;

/**
 * Keywords that should trigger this workflow recipe
 */
export const SIMPLE_GAME_KEYWORDS = [
  'game',
  'create game',
  'make game',
  'build game',
  'new game',
  'platformer',
  'simple game',
  'basic game',
  'from scratch',
  'start new',
  'pixel art game',
];

/**
 * Quick check to determine if a request is about creating a game
 */
export function isGameCreationRequest(userRequest: string): boolean {
  const lower = userRequest.toLowerCase();
  const hasGame = lower.includes('game');
  const hasCreationVerb = /\b(create|make|build|start|new)\b/.test(lower);
  const isSpecificPattern =
    lower.includes('platformer') ||
    lower.includes('from scratch');
  return (hasGame && hasCreationVerb) || isSpecificPattern;
}
