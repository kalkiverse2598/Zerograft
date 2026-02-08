/**
 * Game Positioning Recipe
 * Provides adaptive position calculations for game elements
 */

// ============================================
// CONFIGURABLE COLLISION MULTIPLIERS
// ============================================

// RECTANGLE (for character/body collision)
export const RECTANGLE_WIDTH_MULTIPLIER = 0.35;   // 35% of sprite width
export const RECTANGLE_HEIGHT_MULTIPLIER = 0.85;  // 85% of sprite height

// CIRCLE (for simple/round objects)
export const CIRCLE_RADIUS_MULTIPLIER = 0.25;     // 25% of sprite width

// CAPSULE (for character collision - smooth edges)
export const CAPSULE_RADIUS_MULTIPLIER = 0.20;    // 20% of sprite width
export const CAPSULE_HEIGHT_MULTIPLIER = 0.70;    // 70% of sprite height

// SEGMENT (for ground/platforms)
export const SEGMENT_LENGTH_MULTIPLIER = 1.0;     // 100% of platform width

export const POSITIONING_RECIPE = `
# Node Positioning Guide

## Configurable Multipliers (gamePositioning.ts)

| Shape | Parameter | Multiplier | Description |
|-------|-----------|------------|-------------|
| Rectangle | width | 0.35 | 35% of sprite width |
| Rectangle | height | 0.85 | 85% of sprite height |
| Circle | radius | 0.25 | 25% of sprite width |
| Capsule | radius | 0.20 | 20% of sprite width |
| Capsule | height | 0.70 | 70% of sprite height |
| Segment | length | 1.0 | 100% of platform width |

## ⚠️ Never Hardcode Positions!

Always CALCULATE from viewport size and sprite dimensions.

---

## Step 1: Get Sprite Dimensions

\`\`\`
Tool: get_sprite_dimensions
  node: "AnimatedSprite2D"

Returns:
  frame_width: 210
  frame_height: 317  ← LARGE sprite
  success: true
\`\`\`

---

## Step 2: Choose Collision Approach

| Sprite Height | Approach | Collision |
|---------------|----------|-----------|
| < 100px | Feet-only | Circle at feet |
| >= 100px | Full-body | Rectangle centered on body |

---

## For SMALL Sprites (< 100px): Feet-Only Collision

\`\`\`
CharacterBody2D (position = feet on ground)
├── CollisionShape2D (position.y = -radius)      ← Circle BOTTOM at feet!
└── AnimatedSprite2D (offset.y = -height/2)

Tool: get_sprite_dimensions (node: "AnimatedSprite2D")

COLLISION_RADIUS = width * 0.25
CIRCLE_Y = -(COLLISION_RADIUS)               ← Circle bottom at feet!
SPRITE_OFFSET_Y = -(height/2)
\`\`\`
---

## For LARGE Sprites (>= 100px): Body Collision

⚠️ **YOU MUST COMPLETE ALL 3 STEPS - DO NOT STOP AFTER STEP 1!**

Choose shape based on character type:
- **Rectangle**: Good for blocky/square characters
- **Capsule**: Good for smooth-edged characters (rounded corners)
- **Circle**: Good for round characters

\`\`\`
CharacterBody2D (position = feet on ground)
├── CollisionShape2D (position.y = calculated, NOT (0,0)!)
└── AnimatedSprite2D (offset.y = -(sprite_height/2))

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: Get dimensions
  Tool: get_sprite_dimensions (node: "AnimatedSprite2D")
  
  → THEN IMMEDIATELY PROCEED TO STEP 2! ←
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 2: Calculate based on shape type:

FOR RECTANGLE:
  SPRITE_OFFSET = -(sprite_height / 2)
  COLLISION_WIDTH = sprite_width * 0.35
  COLLISION_HEIGHT = sprite_height * 0.85
  COLLISION_Y = -(COLLISION_HEIGHT / 2)
  size = { width: COLLISION_WIDTH, height: COLLISION_HEIGHT }

FOR CAPSULE:
  SPRITE_OFFSET = -(sprite_height / 2)
  COLLISION_RADIUS = sprite_width * 0.20
  COLLISION_HEIGHT = sprite_height * 0.70
  COLLISION_Y = -(COLLISION_HEIGHT / 2)
  size = { radius: COLLISION_RADIUS, height: COLLISION_HEIGHT }

FOR CIRCLE:
  SPRITE_OFFSET = -(sprite_height / 2)
  COLLISION_RADIUS = sprite_width * 0.25
  COLLISION_Y = -(COLLISION_RADIUS)
  size = { radius: COLLISION_RADIUS }

  → THEN IMMEDIATELY PROCEED TO STEP 3! ←
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 3: Apply (ALL THREE REQUIRED - DO NOT SKIP!):
  1. set_property("AnimatedSprite2D", "offset", "Vector2(0, SPRITE_OFFSET)")
  2. set_collision_shape("CollisionShape2D", "shape_type", size)
  3. set_property("CollisionShape2D", "position", "Vector2(0, COLLISION_Y)")

⚠️ IMPORTANT: COLLISION_Y must be calculated, NEVER use (0,0)!
\`\`\`

---

## Math Explanation (sprite 100x320, collision 40x272)

\`\`\`
SPRITE_OFFSET = -160
Half gap = (sprite_height - COLLISION_HEIGHT) / 2 = (320 - 272) / 2 = 24

COLLISION_Y = SPRITE_OFFSET + half_gap = -160 + 24 = -136
           = -(COLLISION_HEIGHT / 2) = -(272/2) = -136 ✓

Collision (center at -136, height 272):
  TOP = -136 - 136 = -272
  BOTTOM = -136 + 136 = 0 (at feet) ✓
\`\`\`

---

## Example: 210x317 Sprite

\`\`\`
Sprite dimensions: 210 x 317

Calculations:
  SPRITE_OFFSET = -(317/2) = -158
  COLLISION_WIDTH = 210 * 0.35 = 73
  COLLISION_HEIGHT = 317 * 0.85 = 269
  COLLISION_Y = -(269/2) = -135

Tool calls:
  set_property("AnimatedSprite2D", "offset", "Vector2(0, -158)")
  set_collision_shape("CollisionShape2D", "rectangle", {width: 73, height: 269})
  set_property("CollisionShape2D", "position", "Vector2(0, -135)")
\`\`\`

---

## Get Ground Position

\`\`\`
Tool: get_project_setting
  setting: "display/window/size/viewport_height"
→ VIEWPORT_HEIGHT (default: 648)

GROUND_TOP = VIEWPORT_HEIGHT - MARGIN_BOTTOM - GROUND_HEIGHT
Example: 648 - 50 - 50 = 548
\`\`\`

---

## Camera2D Positioning

Player-Following: position = (0,0), follows automatically
Static: position = (VIEWPORT_WIDTH/2, VIEWPORT_HEIGHT/2)
Zoom for pixel art: Vector2(4, 4)
`;

export const POSITIONING_KEYWORDS = [
  'position',
  'positioning',
  'place',
  'placement',
  'where',
  'location',
  'ground position',
  'player position',
  'above ground',
  'on ground',
  'coordinates',
  'Vector2',
  'sprite dimensions',
  'collision size',
];
