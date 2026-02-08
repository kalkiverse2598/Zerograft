# Phase 0 C++ Test Scenarios - Deep Scene Tree Serialization

> **File**: `bridge_commands_scene.cpp`  
> **Function**: `get_scene_tree()` with `_serialize_node_recursive()` helper

These tests should be run manually in Godot after rebuilding. Use the AI Panel or direct TCP commands.

---

## Prerequisites

1. Rebuild Godot with the updated `bridge_commands_scene.cpp`:
   ```bash
   cd /Users/praveengupta/KalkiVerse/godot/Spritmaker-2/godot/src/agentic-godot
   scons platform=macos target=editor -j8
   ```
2. Start the GodotBridge server
3. Connect via the AI Panel or a TCP client

---

## Test Case 1: Basic Scene Tree with Default Depth

**Setup:**
1. Create a new scene `res://TestScene.tscn` with root `Node2D`
2. Add children:
   - `Player` (CharacterBody2D)
     - `CollisionShape2D`
     - `AnimatedSprite2D`
   - `Camera2D`

**Command:**
```json
{"id": "1", "method": "get_scene_tree", "params": {}}
```

**Expected Output:**
```json
{
  "success": true,
  "root": "Node2D",
  "name": "TestScene",
  "path": "/root/TestScene",
  "max_depth": 5,
  "tree": {
    "name": "TestScene",
    "type": "Node2D",
    "path": "/root/TestScene",
    "child_count": 2,
    "children": [
      {
        "name": "Player",
        "type": "CharacterBody2D",
        "path": "/root/TestScene/Player",
        "child_count": 2,
        "children": [
          {
            "name": "CollisionShape2D",
            "type": "CollisionShape2D",
            "path": "/root/TestScene/Player/CollisionShape2D",
            "child_count": 0
          },
          {
            "name": "AnimatedSprite2D",
            "type": "AnimatedSprite2D",
            "path": "/root/TestScene/Player/AnimatedSprite2D",
            "child_count": 0,
            "visible": true
          }
        ]
      },
      {
        "name": "Camera2D",
        "type": "Camera2D",
        "path": "/root/TestScene/Camera2D",
        "child_count": 0
      }
    ]
  },
  "children": [/* same as tree.children */]
}
```

**Verification:**
- [ ] `success` is `true`
- [ ] `max_depth` is `5`
- [ ] `tree` contains nested `children` arrays
- [ ] All node paths are correct (`/root/TestScene/...`)
- [ ] Child count is accurate
- [ ] CanvasItem nodes have `visible` property

---

## Test Case 2: Custom Max Depth (Shallow)

**Command:**
```json
{"id": "2", "method": "get_scene_tree", "params": {"max_depth": 1}}
```

**Expected Output:**
- Only root and its direct children are serialized
- Nested children (like `CollisionShape2D` inside `Player`) should NOT be included
- `has_more_children` should be `true` for nodes with children

```json
{
  "success": true,
  "max_depth": 1,
  "tree": {
    "name": "TestScene",
    "type": "Node2D",
    "children": [
      {
        "name": "Player",
        "type": "CharacterBody2D",
        "child_count": 2,
        "has_more_children": true
        // NO nested "children" array!
      },
      {
        "name": "Camera2D",
        "type": "Camera2D",
        "child_count": 0
      }
    ]
  }
}
```

**Verification:**
- [ ] `max_depth` is `1`
- [ ] Player has `has_more_children: true`
- [ ] Player does NOT have nested `children` array
- [ ] Camera2D has `child_count: 0` and no `has_more_children`

---

## Test Case 3: Custom Max Depth (Deep)

**Setup:**
Create a deeply nested scene (6+ levels):
```
Root (Node2D)
└── Level1
    └── Level2
        └── Level3
            └── Level4
                └── Level5
                    └── Level6
```

**Command:**
```json
{"id": "3", "method": "get_scene_tree", "params": {"max_depth": 10}}
```

**Expected Output:**
- All 6 levels should be serialized
- `max_depth` should be clamped at 10

**Verification:**
- [ ] All 6 levels are visible in output
- [ ] Path for Level6 is `/root/.../Level6`

---

## Test Case 4: Depth Clamping (Below Minimum)

**Command:**
```json
{"id": "4", "method": "get_scene_tree", "params": {"max_depth": 0}}
```

**Expected Output:**
- `max_depth` should be clamped to `1`
- At least root and direct children should be shown

**Verification:**
- [ ] `max_depth` is `1` (not 0)
- [ ] Response is valid with at least root node info

---

## Test Case 5: Depth Clamping (Above Maximum)

**Command:**
```json
{"id": "5", "method": "get_scene_tree", "params": {"max_depth": 100}}
```

**Expected Output:**
- `max_depth` should be clamped to `10`

**Verification:**
- [ ] `max_depth` is `10` (not 100)

---

## Test Case 6: No Scene Open

**Setup:**
Close all scenes in the editor

**Command:**
```json
{"id": "6", "method": "get_scene_tree", "params": {}}
```

**Expected Output:**
```json
{
  "success": false,
  "error": "No scene currently open",
  "hint": "Use create_scene to create a new scene, or open_scene to open an existing one"
}
```

**Verification:**
- [ ] `success` is `false`
- [ ] `error` mentions "No scene"
- [ ] `hint` provides actionable guidance (mentions `create_scene` and `open_scene`)

---

## Test Case 7: Script Info in Output

**Setup:**
1. Create a scene with a node that has an attached script
2. Attach script `res://player.gd` to `Player` node

**Command:**
```json
{"id": "7", "method": "get_scene_tree", "params": {}}
```

**Expected Output:**
```json
{
  "success": true,
  "tree": {
    "children": [
      {
        "name": "Player",
        "type": "CharacterBody2D",
        "script": "res://player.gd"
      }
    ]
  }
}
```

**Verification:**
- [ ] Node with script has `script` property with path
- [ ] Nodes without scripts do NOT have `script` property

---

## Test Case 8: Visibility Property for CanvasItems

**Setup:**
1. Create a scene with Sprite2D nodes
2. Set one Sprite2D to hidden (visible = false)

**Command:**
```json
{"id": "8", "method": "get_scene_tree", "params": {}}
```

**Expected Output:**
- Visible Sprite2D should have `"visible": true`
- Hidden Sprite2D should have `"visible": false`
- Non-CanvasItem nodes should NOT have `visible` property

**Verification:**
- [ ] Sprite2D nodes have `visible` property
- [ ] Hidden nodes have `visible: false`
- [ ] Non-visual nodes (Control, etc.) don't have `visible` if not CanvasItem

---

## Test Case 9: Backwards Compatibility

**Command:**
```json
{"id": "9", "method": "get_scene_tree", "params": {}}
```

**Verification:**
- [ ] `root` property exists at top level (string with class name)
- [ ] `name` property exists at top level
- [ ] `path` property exists at top level
- [ ] `children` property exists at top level (array of direct children)
- [ ] Old consumers that only read `root`, `name`, `path`, `children` still work

---

## Test Case 10: Performance with Large Scene

**Setup:**
Create a scene with 100+ nodes (e.g., a tile-based game level)

**Command:**
```json
{"id": "10", "method": "get_scene_tree", "params": {"max_depth": 3}}
```

**Verification:**
- [ ] Response completed in < 1 second
- [ ] All nodes at depth 1-3 are included
- [ ] No memory issues or crashes
- [ ] Console shows: `GodotBridge: Scene tree serialized with depth 3`

---

## Automated Test Script (GDScript)

You can also test from within Godot using this GDScript:

```gdscript
# test_scene_tree.gd - Attach to any node and run

extends Node

func _ready():
    var bridge = get_node("/root/GodotBridge")  # Assumes autoload
    if not bridge:
        push_error("GodotBridge not found")
        return
    
    # Test 1: Default depth
    var result1 = bridge.get_scene_tree()
    assert(result1.success == true, "Test 1 failed: success should be true")
    assert(result1.has("tree"), "Test 1 failed: should have tree property")
    print("✅ Test 1 passed: Basic scene tree")
    
    # Test 2: Custom depth
    var result2 = bridge.get_scene_tree(2)
    assert(result2.max_depth == 2, "Test 2 failed: max_depth should be 2")
    print("✅ Test 2 passed: Custom depth")
    
    # Test 3: Depth clamping (min)
    var result3 = bridge.get_scene_tree(0)
    assert(result3.max_depth == 1, "Test 3 failed: should clamp to 1")
    print("✅ Test 3 passed: Min depth clamping")
    
    # Test 4: Depth clamping (max)
    var result4 = bridge.get_scene_tree(100)
    assert(result4.max_depth == 10, "Test 4 failed: should clamp to 10")
    print("✅ Test 4 passed: Max depth clamping")
    
    print("\n🎉 All scene tree tests passed!")
```

---

## Summary Checklist

| # | Test Case | Status |
|---|-----------|--------|
| 1 | Basic scene tree with default depth | ⬜ |
| 2 | Custom max_depth (shallow) | ⬜ |
| 3 | Custom max_depth (deep) | ⬜ |
| 4 | Depth clamping (below min) | ⬜ |
| 5 | Depth clamping (above max) | ⬜ |
| 6 | No scene open (error + hint) | ⬜ |
| 7 | Script info in output | ⬜ |
| 8 | Visibility property for CanvasItems | ⬜ |
| 9 | Backwards compatibility | ⬜ |
| 10 | Performance with large scene | ⬜ |

---

**After running all tests, update this checklist with ✅ for passed tests.**
