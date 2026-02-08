/**
 * Tool Definitions for Agentic Godot
 * 
 * Structured definitions for all Godot commands with schemas,
 * descriptions, and usage guidance.
 */

export interface ToolDefinition {
    name: string;
    description: string;
    params: Record<string, {
        type: string;
        description: string;
        required?: boolean;
        default?: unknown;
        items?: { type: string };  // For array types, specifies element type
    }>;
    whenToUse?: string;
    whenNotToUse?: string;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
    // ============================================
    // SCENE MANAGEMENT
    // ============================================
    {
        name: "create_scene",
        description: "Create a new scene file",
        params: {
            path: { type: "string", description: "Scene path (e.g., res://name.tscn)", required: true },
            root_type: { type: "string", description: "Root node type (Node2D, CharacterBody2D, Control, etc.)", required: true },
            explanation: { type: "string", description: "Why this scene is being created", required: true }
        },
        whenToUse: "When creating a new game object, level, or UI screen",
        whenNotToUse: "When modifying an existing scene"
    },
    {
        name: "add_node",
        description: "Add a node to the current scene",
        params: {
            parent: { type: "string", description: "Parent node path (empty string for root)", required: true },
            type: { type: "string", description: "Node type (Sprite2D, CollisionShape2D, etc.)", required: true },
            name: { type: "string", description: "Name for the new node", required: true },
            explanation: { type: "string", description: "Why this node is being added", required: true }
        },
        whenToUse: "When adding child nodes to build scene hierarchy",
        whenNotToUse: "When the node already exists"
    },
    {
        name: "remove_node",
        description: "Remove a node from the scene",
        params: {
            path: { type: "string", description: "Path to the node to remove", required: true },
            explanation: { type: "string", description: "Why this node is being removed", required: true }
        }
    },
    {
        name: "rename_node",
        description: "Rename a node",
        params: {
            path: { type: "string", description: "Current node path", required: true },
            new_name: { type: "string", description: "New name for the node", required: true },
            explanation: { type: "string", description: "Why this node is being renamed", required: true }
        }
    },
    {
        name: "duplicate_node",
        description: "Duplicate a node",
        params: {
            path: { type: "string", description: "Path to the node to duplicate", required: true },
            explanation: { type: "string", description: "Why this node is being duplicated", required: true }
        }
    },
    {
        name: "move_node",
        description: "Move a node to a new parent",
        params: {
            path: { type: "string", description: "Current node path", required: true },
            new_parent: { type: "string", description: "Path to new parent node", required: true },
            explanation: { type: "string", description: "Why this node is being moved", required: true }
        }
    },
    {
        name: "save_scene",
        description: "Save the current scene",
        params: {
            path: { type: "string", description: "Save path (empty for current)", required: false },
            explanation: { type: "string", description: "Why the scene is being saved", required: true }
        }
    },
    {
        name: "open_scene",
        description: "Open a scene file",
        params: {
            path: { type: "string", description: "Path to scene (res://scene.tscn)", required: true },
            explanation: { type: "string", description: "Why this scene is being opened", required: true }
        }
    },
    {
        name: "list_scenes",
        description: "List all scene files in project",
        params: {
            explanation: { type: "string", description: "Why listing scenes", required: true }
        }
    },
    {
        name: "get_node_info",
        description: "Get detailed info about a node (properties, children)",
        params: {
            path: { type: "string", description: "Path to the node", required: true },
            explanation: { type: "string", description: "Why getting node info", required: true }
        }
    },
    {
        name: "copy_node",
        description: "Copy a node to another scene",
        params: {
            from: { type: "string", description: "Source node path", required: true },
            to_scene: { type: "string", description: "Target scene path", required: true },
            explanation: { type: "string", description: "Why copying this node", required: true }
        }
    },
    {
        name: "get_scene_tree",
        description: "Get current scene structure",
        params: {
            explanation: { type: "string", description: "Why getting scene tree", required: true }
        },
        whenToUse: "To understand the current scene hierarchy before making changes"
    },
    {
        name: "scene_instantiate",
        description: "Instantiate a .tscn scene file as a child node. Use this instead of add_node when you want to add an existing scene.",
        params: {
            scene_path: { type: "string", description: "Path to scene file (res://Player.tscn)", required: true },
            parent: { type: "string", description: "Parent node path (empty for scene root)", required: false },
            explanation: { type: "string", description: "Why instantiating this scene", required: true }
        },
        whenToUse: "When adding a .tscn scene as a child - ALWAYS use this for scenes instead of add_node",
        whenNotToUse: "For creating new node types - use add_node instead"
    },
    {
        name: "set_collision_shape",
        description: "Set the shape resource on a CollisionShape2D or CollisionShape3D node",
        params: {
            node: { type: "string", description: "Path to CollisionShape2D/3D node", required: true },
            shape_type: { type: "string", description: "Shape type: rectangle, circle, capsule, segment", required: true },
            size: { type: "object", description: "Size parameters: {width, height} for rectangle, {radius} for circle, {radius, height} for capsule", required: true },
            explanation: { type: "string", description: "Why setting this shape", required: true }
        },
        whenToUse: "After adding a CollisionShape2D/3D node to configure its shape",
        whenNotToUse: "For CollisionPolygon2D - use set_property with polygon points instead"
    },
    {
        name: "attach_script",
        description: "Attach an existing script file to a node",
        params: {
            node: { type: "string", description: "Node path to attach script to", required: true },
            script_path: { type: "string", description: "Path to script file (res://player.gd)", required: true },
            explanation: { type: "string", description: "Why attaching this script", required: true }
        },
        whenToUse: "To attach a script file to a node",
        whenNotToUse: "If creating a new script - use create_script first"
    },

    // ============================================
    // PROPERTIES
    // ============================================
    {
        name: "set_property",
        description: "Set a node property",
        params: {
            node: { type: "string", description: "Node path", required: true },
            property: { type: "string", description: "Property name", required: true },
            value: { type: "any", description: "Property value", required: true },
            explanation: { type: "string", description: "Why setting this property", required: true }
        }
    },
    {
        name: "get_property",
        description: "Get a node property value",
        params: {
            node: { type: "string", description: "Node path", required: true },
            property: { type: "string", description: "Property name", required: true },
            explanation: { type: "string", description: "Why getting this property", required: true }
        }
    },

    // ============================================
    // SCRIPTS
    // ============================================
    {
        name: "create_script",
        description: "Create a GDScript file",
        params: {
            path: { type: "string", description: "Script path (res://name.gd)", required: true },
            content: { type: "string", description: "Full script content (extends ...)", required: true },
            explanation: { type: "string", description: "Why creating this script", required: true }
        },
        whenToUse: "When creating new behavior or logic for game objects",
        whenNotToUse: "When modifying existing script - use edit_script instead"
    },
    {
        name: "read_script",
        description: "Read the contents of a script file",
        params: {
            path: { type: "string", description: "Script path (res://script.gd)", required: true },
            explanation: { type: "string", description: "Why reading this script", required: true }
        },
        whenToUse: "Before editing a script to understand current content"
    },
    {
        name: "edit_script",
        description: "Edit/replace the contents of a script file",
        params: {
            path: { type: "string", description: "Script path", required: true },
            content: { type: "string", description: "New script content", required: true },
            explanation: { type: "string", description: "Why editing this script", required: true }
        },
        whenToUse: "When modifying existing script logic",
        whenNotToUse: "When creating a new script - use create_script instead"
    },
    {
        name: "get_errors",
        description: "Get current script/compilation errors",
        params: {
            explanation: { type: "string", description: "Why checking for errors", required: true }
        },
        whenToUse: "After making script changes to verify correctness"
    },

    // ============================================
    // GAME EXECUTION
    // ============================================
    {
        name: "run_game",
        description: "Run the game",
        params: {
            scene: { type: "string", description: "Scene to run (empty for main)", required: false },
            explanation: { type: "string", description: "Why running the game", required: true }
        }
    },
    {
        name: "stop_game",
        description: "Stop the running game",
        params: {
            explanation: { type: "string", description: "Why stopping the game", required: true }
        }
    },

    // ============================================
    // FILE SYSTEM
    // ============================================
    {
        name: "list_files",
        description: "List files in a directory. Use recursive=true to find files in all subdirectories",
        params: {
            path: { type: "string", description: "Directory path (res://sprites)", required: true },
            recursive: { type: "boolean", description: "If true, also lists files in subdirectories", required: false },
            explanation: { type: "string", description: "Why listing files", required: true }
        },
        whenToUse: "To discover files in a directory",
        whenNotToUse: "NEVER use this after spritemancer_generate_animations - use the returned sprite_frames_path instead!"
    },
    {
        name: "create_folder",
        description: "Create a new folder",
        params: {
            path: { type: "string", description: "Folder path (res://new_folder)", required: true },
            explanation: { type: "string", description: "Why creating this folder", required: true }
        }
    },
    {
        name: "delete_file",
        description: "Delete a file or folder",
        params: {
            path: { type: "string", description: "Path to delete", required: true },
            explanation: { type: "string", description: "Why deleting this file", required: true }
        }
    },
    {
        name: "read_file",
        description: "Read the contents of any text file in the project (JSON, TXT, CFG, import settings, etc.)",
        params: {
            path: { type: "string", description: "File path (res://data.json)", required: true },
            explanation: { type: "string", description: "Why reading this file", required: true }
        },
        whenToUse: "To read JSON config files, import settings, or any text-based file (not images)",
        whenNotToUse: "For GDScript files - use read_script instead"
    },
    {
        name: "assets_scan",
        description: "Force Godot to rescan the filesystem for new/changed files. CRITICAL: Call this after generating sprites or importing external files so Godot can see them.",
        params: {
            explanation: { type: "string", description: "Why scanning assets", required: true }
        },
        whenToUse: "ALWAYS call after spritemancer_import or when files are created externally",
        whenNotToUse: "Not needed after create_script or create_scene since those auto-refresh"
    },
    {
        name: "assets_update_file",
        description: "Update Godot's knowledge of a specific file that was changed or added externally",
        params: {
            path: { type: "string", description: "Path to file (res://sprites/knight.png)", required: true },
            explanation: { type: "string", description: "Why updating this file", required: true }
        },
        whenToUse: "When you know a specific file was modified externally and need Godot to reimport it"
    },
    {
        name: "assets_reimport",
        description: "Force reimport of a specific resource file with current import settings",
        params: {
            path: { type: "string", description: "Path to resource (res://sprites/knight.png)", required: true },
            explanation: { type: "string", description: "Why reimporting this asset", required: true }
        },
        whenToUse: "When sprite import settings need to be applied (e.g., pixel art filter disabled)"
    },

    // ============================================
    // SIGNALS & CONNECTIONS
    // ============================================
    {
        name: "connect_signal",
        description: "Connect a signal between nodes",
        params: {
            source: { type: "string", description: "Source node path", required: true },
            signal: { type: "string", description: "Signal name (pressed, body_entered, etc.)", required: true },
            target: { type: "string", description: "Target node path", required: true },
            method: { type: "string", description: "Method name to call", required: true },
            explanation: { type: "string", description: "Why connecting this signal", required: true }
        }
    },
    {
        name: "list_signals",
        description: "List all signals on a node",
        params: {
            node: { type: "string", description: "Node path", required: true },
            explanation: { type: "string", description: "Why listing signals", required: true }
        }
    },

    // ============================================
    // INPUT ACTIONS
    // ============================================
    {
        name: "add_input_action",
        description: "Add an input action with a key binding",
        params: {
            action: { type: "string", description: "Action name (jump, move_left, etc.)", required: true },
            key: { type: "string", description: "Key binding (SPACE, W, A, S, D, etc.)", required: true },
            explanation: { type: "string", description: "Why adding this input action", required: true }
        }
    },
    {
        name: "list_input_actions",
        description: "List all custom input actions",
        params: {
            explanation: { type: "string", description: "Why listing input actions", required: true }
        }
    },
    {
        name: "remove_input_action",
        description: "Remove an input action",
        params: {
            action: { type: "string", description: "Action name to remove", required: true },
            explanation: { type: "string", description: "Why removing this action", required: true }
        }
    },

    // ============================================
    // PROJECT SETTINGS
    // ============================================
    {
        name: "set_project_setting",
        description: "Set a project setting",
        params: {
            setting: { type: "string", description: "Setting path (application/run/main_scene)", required: true },
            value: { type: "any", description: "Setting value", required: true },
            explanation: { type: "string", description: "Why setting this value", required: true }
        }
    },
    {
        name: "get_project_setting",
        description: "Get a project setting value",
        params: {
            setting: { type: "string", description: "Setting path", required: true },
            explanation: { type: "string", description: "Why getting this setting", required: true }
        }
    },

    // ============================================
    // GROUPS
    // ============================================
    {
        name: "add_to_group",
        description: "Add a node to a group",
        params: {
            node: { type: "string", description: "Node path", required: true },
            group: { type: "string", description: "Group name", required: true },
            explanation: { type: "string", description: "Why adding to this group", required: true }
        }
    },
    {
        name: "list_groups",
        description: "List all groups a node belongs to",
        params: {
            node: { type: "string", description: "Node path", required: true },
            explanation: { type: "string", description: "Why listing groups", required: true }
        }
    },
    {
        name: "remove_from_group",
        description: "Remove a node from a group",
        params: {
            node: { type: "string", description: "Node path", required: true },
            group: { type: "string", description: "Group name", required: true },
            explanation: { type: "string", description: "Why removing from this group", required: true }
        }
    },

    // ============================================
    // RESOURCES & AUDIO
    // ============================================
    {
        name: "create_resource",
        description: "Create a new resource file",
        params: {
            type: { type: "string", description: "Resource type (Theme, SpriteFrames, ShaderMaterial)", required: true },
            path: { type: "string", description: "Resource path (res://my_theme.tres)", required: true },
            explanation: { type: "string", description: "Why creating this resource", required: true }
        }
    },
    {
        name: "load_resource",
        description: "Load a resource file",
        params: {
            path: { type: "string", description: "Resource path", required: true },
            explanation: { type: "string", description: "Why loading this resource", required: true }
        }
    },
    {
        name: "set_audio_stream",
        description: "Set audio stream on a player node",
        params: {
            node: { type: "string", description: "AudioStreamPlayer node path", required: true },
            audio_path: { type: "string", description: "Audio file path (res://sounds/jump.wav)", required: true },
            explanation: { type: "string", description: "Why setting this audio", required: true }
        }
    },
    {
        name: "play_audio",
        description: "Play audio from a player node",
        params: {
            node: { type: "string", description: "AudioStreamPlayer node path", required: true },
            explanation: { type: "string", description: "Why playing this audio", required: true }
        }
    },

    // ============================================
    // NEW COMMANDS (Phase 2)
    // ============================================
    {
        name: "undo_last_action",
        description: "Revert the previous command executed",
        params: {
            explanation: { type: "string", description: "Why undoing the last action", required: true }
        },
        whenToUse: "When the last command produced undesired results"
    },
    {
        name: "search_in_scripts",
        description: "Search for text/regex pattern across all GDScript files",
        params: {
            pattern: { type: "string", description: "Search pattern (text or regex)", required: true },
            is_regex: { type: "boolean", description: "Whether pattern is regex", required: false, default: false },
            explanation: { type: "string", description: "Why searching scripts", required: true }
        },
        whenToUse: "When looking for variable usage, function calls, or patterns across scripts"
    },
    {
        name: "get_selected_nodes",
        description: "Get currently selected node(s) in the Scene Tree (2D/3D editor)",
        params: {
            explanation: { type: "string", description: "Why getting selection", required: true }
        },
        whenToUse: "To understand what nodes the user is focused on in the editor"
    },
    {
        name: "get_selected_text",
        description: "Get text selection from the script editor, including cursor position and selected code",
        params: {
            explanation: { type: "string", description: "Why getting text selection", required: true }
        },
        whenToUse: "When user refers to 'selected' code, or asks about code they've highlighted"
    },
    {
        name: "get_selected_files",
        description: "Get files/folders selected in the FileSystem dock",
        params: {
            explanation: { type: "string", description: "Why getting file selection", required: true }
        },
        whenToUse: "When user refers to 'selected' files or when file context is needed"
    },

    // ============================================
    // PLANNING & TASK MANAGEMENT
    // ============================================
    {
        name: "start_plan",
        description: "Create a task plan with multiple steps. Shows in the Blueprint tab.",
        params: {
            name: { type: "string", description: "Name of the plan/task", required: true },
            steps: { type: "array", items: { type: "string" }, description: "Array of step descriptions", required: true },
            explanation: { type: "string", description: "Why creating this plan", required: true }
        },
        whenToUse: "When starting a complex multi-step task. ALWAYS use this for tasks with 3+ steps.",
        whenNotToUse: "For simple single-command requests"
    },
    {
        name: "update_plan",
        description: "Update a plan step status (pending, in_progress, completed)",
        params: {
            step_index: { type: "number", description: "Step index (0-based)", required: true },
            status: { type: "string", description: "New status: pending, in_progress, completed", required: true },
            explanation: { type: "string", description: "Why updating this step", required: true }
        },
        whenToUse: "When completing or starting a plan step"
    },

    // ============================================
    // COMPOSITE TOOLS (Multi-step automation)
    // ============================================
    {
        name: "setup_tilemap_with_physics",
        description: `Create a TileMapLayer with a TileSet that has physics/collision enabled.
This composite tool handles:
1. Creates TileMapLayer node
2. Creates or loads TileSet resource with physics layer
3. Configures collision layer/mask
4. Assigns TileSet to TileMapLayer`,
        params: {
            tileset_path: { type: "string", description: "Path to tileset image (PNG) or .tres resource file", required: true },
            tile_size: { type: "number", description: "Tile size in pixels (16, 32, 64)", required: true },
            layer_name: { type: "string", description: "Name for the TileMapLayer node (default: 'TileMapLayer')", required: false },
            parent_node: { type: "string", description: "Parent node path (default: '.' for root)", required: false },
            include_physics: { type: "boolean", description: "Add physics layer for collisions (default: true)", required: false },
            collision_layer: { type: "number", description: "Physics collision layer bitmask (default: 1)", required: false },
            collision_mask: { type: "number", description: "Physics collision mask bitmask (default: 1)", required: false },
            explanation: { type: "string", description: "Why creating this TileMap", required: true }
        },
        whenToUse: "When creating a TileMapLayer for level design, especially when physics/collision is needed",
        whenNotToUse: "When TileMapLayer already exists and just needs tiles placed - use map_set_cells_batch instead"
    },
    {
        name: "setup_player_with_sprites",
        description: `Create a complete player scene from SpriteMancer output.
This composite tool handles ALL player setup in one call:
1. Creates CharacterBody2D scene
2. Adds CollisionShape2D with correct positioning (the 3-step process)
3. Adds AnimatedSprite2D with SpriteFrames
4. Creates and attaches movement script
5. Saves the scene

⚠️ IMPORTANT: This tool automatically handles the collision shape offset and position calculation - no need to do it manually!`,
        params: {
            sprite_frames_path: { type: "string", description: "Path to SpriteFrames .tres file from spritemancer_approve_animation", required: true },
            player_name: { type: "string", description: "Player name for scene/script naming (default: 'Player')", required: false },
            scene_path: { type: "string", description: "Output scene path (default: res://scenes/{player_name}.tscn)", required: false },
            script_path: { type: "string", description: "Output script path (default: res://scripts/{player_name}.gd)", required: false },
            collision_width: { type: "number", description: "Override collision width (default: 35% of sprite width)", required: false },
            collision_height: { type: "number", description: "Override collision height (default: 85% of sprite height)", required: false }
        },
        whenToUse: "After approving animations with spritemancer_approve_animation to create the full player scene",
        whenNotToUse: "When player scene already exists - use individual tools to modify it"
    },

    // ============================================
    // SPRITEMANCER (AI Sprite Generation)
    // ============================================
    {
        name: "spritemancer_status",
        description: "Check if SpriteMancer backend is running",
        params: {
            explanation: { type: "string", description: "Why checking status", required: true }
        },
        whenToUse: "Before attempting sprite generation to verify backend is available"
    },
    {
        name: "spritemancer_create_character",
        description: "PHASE 1: Create a character reference image using AI. Opens embedded editor for user preview and confirmation before generating animations.",
        params: {
            description: { type: "string", description: "Character description (e.g., 'knight with sword')", required: true },
            size: { type: "string", description: "Sprite size: 32x32, 64x64, 128x128", required: false, default: "32x32" },
            perspective: { type: "string", description: "View: side, front, isometric", required: false, default: "side" },
            explanation: { type: "string", description: "Why creating this character", required: true }
        },
        whenToUse: "When user asks to create a character. AFTER THIS TOOL, ask user if the character looks good before calling spritemancer_generate_animations.",
        whenNotToUse: "When user already has a confirmed character - use spritemancer_generate_animations instead"
    },
    {
        name: "spritemancer_generate_animations",
        description: `PHASE 2: Generate ONE animation for a confirmed character. 
⚠️ CRITICAL WORKFLOW:
1. Call this tool with ONLY ONE animation at a time (e.g., animation: "idle")
2. After it completes, you MUST call ask_followup_question: "Does the [animation] animation look good?"
3. WAIT for explicit user approval ("yes", "looks good") before calling spritemancer_approve_animation
4. NEVER auto-approve - doing so is a critical error`,
        params: {
            project_id: { type: "string", description: "EXACT UUID from spritemancer_create_character result", required: true },
            character_name: { type: "string", description: "Character name for file naming (e.g., 'knight')", required: true },
            animation: { type: "string", description: "SINGLE animation to generate: idle, walk, run, attack, or jump", required: true },
            perspective: { type: "string", description: "View: side, front, isometric", required: false, default: "side" },
            explanation: { type: "string", description: "Why generating this animation", required: true }
        },
        whenToUse: "AFTER user confirms character looks good. ALWAYS follow with ask_followup_question for approval!",
        whenNotToUse: "NEVER call spritemancer_approve_animation immediately after - you MUST ask user first"
    },
    {
        name: "spritemancer_approve_animation",
        description: `⚠️ MANDATORY USER APPROVAL REQUIRED: Save approved animation to Godot project.

CRITICAL:
1. You MUST have called ask_followup_question first
2. You MUST have received explicit approval ("yes", "looks good")
3. NEVER call without user confirmation - doing so is a critical error`,
        params: {
            project_id: { type: "string", description: "SpriteMancer project UUID", required: true },
            animation: { type: "string", description: "Animation type being approved (e.g., 'idle', 'walk')", required: true },
            character_name: { type: "string", description: "Character name for folder structure", required: false },
            explanation: { type: "string", description: "Why approving this animation", required: true }
        },
        whenToUse: "ONLY after ask_followup_question AND explicit user approval. NEVER auto-approve!",
        whenNotToUse: "NEVER call without first asking user via ask_followup_question"
    },
    {
        name: "spritemancer_download_sprites",
        description: "⚠️ DEPRECATED: Use spritemancer_approve_animation instead! That tool handles both approval AND downloading automatically. This tool is only for legacy bulk downloads.",
        params: {
            project_id: { type: "string", description: "EXACT UUID from spritemancer_create_character", required: true },
            character_name: { type: "string", description: "Character name for folder and file naming", required: true },
            animations: { type: "array", items: { type: "string" }, description: "Animations to download (e.g., ['idle', 'walk'])", required: true },
            explanation: { type: "string", description: "Why downloading these sprites", required: true }
        },
        whenToUse: "DEPRECATED - use spritemancer_approve_animation instead which handles download automatically",
        whenNotToUse: "Almost always - prefer spritemancer_approve_animation for the standard workflow"
    },
    {
        name: "spritemancer_animate",
        description: "Generate a single additional animation for existing character (requires project_id from create_character)",
        params: {
            project_id: { type: "string", description: "SpriteMancer project ID", required: true },
            animation: { type: "string", description: "Animation type: idle, walk, run, attack, jump, die", required: true },
            difficulty: { type: "string", description: "Animation quality: quick, standard, advanced", required: false, default: "standard" },
            explanation: { type: "string", description: "Why generating this animation", required: true }
        },
        whenToUse: "To add more animations to an existing character one at a time"
    },
    {
        name: "spritemancer_import",
        description: "Import generated spritesheet into Godot project",
        params: {
            project_id: { type: "string", description: "SpriteMancer project ID", required: true },
            output_path: { type: "string", description: "Godot path (res://sprites/character.png)", required: true },
            explanation: { type: "string", description: "Why importing to this location", required: true }
        },
        whenToUse: "After sprite generation completes, to bring assets into Godot"
    },
    {
        name: "spritemancer_generate_asset",
        description: "Generate any type of game asset: character reference, effect, tile, or UI element",
        params: {
            asset_type: { type: "string", description: "Type: character, effect, tile, ui", required: true },
            prompt: { type: "string", description: "Description of the asset (e.g., 'fire explosion', 'gold coin')", required: true },
            size: { type: "string", description: "Sprite size: 16x16, 32x32, 64x64", required: false, default: "32x32" },
            frame_count: { type: "number", description: "Number of animation frames (for effects/tiles/ui)", required: false, default: 6 },
            explanation: { type: "string", description: "Why generating this asset", required: true }
        },
        whenToUse: "When user asks to create effects, tiles, UI elements, or character references"
    },
    {
        name: "spritemancer_open_panel",
        description: "Open SpriteMancer panel or switch to full editor view",
        params: {
            view: { type: "string", description: "View to open: dock, main_screen, browser", required: false, default: "dock" },
            explanation: { type: "string", description: "Why opening this view", required: true }
        },
        whenToUse: "When user wants to see SpriteMancer UI or full pixel editor"
    },
    {
        name: "spritemancer_list_presets",
        description: "List available presets for asset generation",
        params: {
            asset_type: { type: "string", description: "Type: character, effect, tile, ui", required: true },
            explanation: { type: "string", description: "Why listing presets", required: true }
        },
        whenToUse: "When user wants to see available presets before generating"
    },

    // ============================================
    // AGENTIC LOOP TOOLS
    // ============================================
    {
        name: "ask_followup_question",
        description: "Ask the user a question to get clarification or input before continuing",
        params: {
            question: { type: "string", description: "The question to ask the user", required: true },
            choices: { type: "array", items: { type: "string" }, description: "Optional list of choices for user to pick from", required: false },
            default: { type: "string", description: "Default answer if user doesn't respond", required: false },
            timeout_seconds: { type: "number", description: "Seconds to wait before using default (default: 60)", required: false, default: 60 },
            allow_skip: { type: "boolean", description: "Allow user to skip without answering", required: false, default: true },
            context_key: { type: "string", description: "Key to store answer (prevents re-asking)", required: true }
        },
        whenToUse: "When you need information from the user before proceeding (e.g., sprite size, character name)",
        whenNotToUse: "For decisions you can make yourself based on context"
    },
    {
        name: "attempt_completion",
        description: "Signal that the task is complete and provide a summary",
        params: {
            result: { type: "string", description: "Summary of what was accomplished", required: true },
            artifacts: {
                type: "object",
                description: "Files and nodes created/modified",
                required: false,
                default: {}
            },
            warnings: { type: "array", items: { type: "string" }, description: "Any issues or warnings to note", required: false },
            next_suggestions: { type: "array", items: { type: "string" }, description: "Suggested next steps for user", required: false },
            demo_command: { type: "string", description: "Optional command to demonstrate result (e.g., run_game)", required: false }
        },
        whenToUse: "When you have completed ALL steps of the task successfully",
        whenNotToUse: "When there are still pending steps or the task is incomplete"
    },
    {
        name: "create_animated_sprite",
        description: "Create an AnimatedSprite2D node from SpriteMancer character with proper import settings and SpriteFrames",
        params: {
            project_id: { type: "string", description: "SpriteMancer project ID to fetch sprites from", required: true },
            parent_node: { type: "string", description: "Parent node path (e.g., /root/Player)", required: true },
            node_name: { type: "string", description: "Name for the AnimatedSprite2D node", required: true },
            animations: {
                type: "array",
                items: { type: "object" },
                description: "Array of {name, fps, loop} objects for each animation",
                required: true
            },
            import_settings: {
                type: "object",
                description: "Pixel art import settings: filter (false), mipmaps (false), compress_mode ('lossless')",
                required: false
            },
            output_path: { type: "string", description: "Output folder (default: res://sprites/{name}/)", required: false }
        },
        whenToUse: "After generating a character with SpriteMancer, to import it as a ready-to-use AnimatedSprite2D",
        whenNotToUse: "For non-SpriteMancer sprites or when you need manual control over import"
    },

    // ============================================
    // BLUEPRINT/DIFF TAB INTEGRATION
    // ============================================
    {
        name: "set_task_plan",
        description: "Update the Blueprint tab with current task plan and step statuses",
        params: {
            name: { type: "string", description: "Plan name (e.g., 'Create Player Character')", required: true },
            steps: {
                type: "array",
                items: { type: "object" },
                description: "Array of { description, status: 'pending'|'in_progress'|'completed' }",
                required: true
            }
        },
        whenToUse: "At the start of a multi-step task and whenever step status changes",
        whenNotToUse: "For simple single-tool operations"
    },
    {
        name: "add_diff_entry",
        description: "Add a file change entry to the Diff tab",
        params: {
            file: { type: "string", description: "File path (e.g., 'Player.tscn')", required: true },
            status: { type: "string", description: "'created' | 'edited' | 'deleted'", required: true }
        },
        whenToUse: "After creating, modifying, or deleting any file",
        whenNotToUse: "For read-only operations"
    },

    // ============================================
    // PREVIEW/TEST LOOP (Phase 5)
    // ============================================
    {
        name: "capture_viewport",
        description: "Capture a screenshot of the current viewport or running game",
        params: {
            save_path: { type: "string", description: "Path to save screenshot (default: res://screenshots/)", required: false },
            viewport: { type: "string", description: "'editor' or 'game' (default: 'editor')", required: false }
        },
        whenToUse: "To verify visual changes or capture game state for debugging",
        whenNotToUse: "When you don't need visual verification"
    },
    {
        name: "see_viewport",
        description: "Use AI vision to 'see' and analyze the current Godot viewport. Returns a screenshot that the AI can visually understand to check scene layout, node positions, colors, and visual issues.",
        params: {
            viewport: { type: "string", description: "'editor' for 2D/3D editor viewport, 'game' for running game preview (default: 'editor')", required: false }
        },
        whenToUse: "When you need to visually inspect the scene to understand layout, verify visual changes, or debug positioning issues",
        whenNotToUse: "For non-visual checks - use get_scene_tree or get_property instead"
    },
    {
        name: "get_runtime_state",
        description: "Get property values from nodes while the game is running",
        params: {
            node_path: { type: "string", description: "Path to node (e.g., '/root/Player')", required: true },
            properties: { type: "array", items: { type: "string" }, description: "List of property names to read", required: true }
        },
        whenToUse: "To check runtime values like position, velocity, health during testing",
        whenNotToUse: "When game is not running"
    },
    {
        name: "request_user_feedback",
        description: "Ask user to test the game and provide feedback before continuing",
        params: {
            message: { type: "string", description: "What to test (e.g., 'Try moving the player with arrow keys')", required: true },
            wait_for_stop: { type: "boolean", description: "Wait until user stops the game (default: true)", required: false }
        },
        whenToUse: "When you need human verification of gameplay behavior",
        whenNotToUse: "For visual changes that can be verified with capture_viewport"
    },

    // ============================================
    // SPRITEMANCER UI CONTROL
    // ============================================
    {
        name: "create_sprite_frames_from_images",
        description: "Create a SpriteFrames resource from individual PNG files. Preserves transparency better than sprite sheets.",
        params: {
            path: { type: "string", description: "Output path for .tres file (e.g., res://sprites/knight.tres)", required: true },
            animations: { type: "array", items: { type: "object" }, description: "Array of {name, fps, loop, frames} where frames is array of image paths", required: true },
            explanation: { type: "string", description: "Why creating this SpriteFrames resource", required: true }
        },
        whenToUse: "After generating individual frame PNGs for character animations",
        whenNotToUse: "When using a single sprite sheet image"
    },
    {
        name: "spritemancer_open_project",
        description: "Open a SpriteMancer project in the embedded editor so the user can see generation progress or make manual edits",
        params: {
            project_id: { type: "string", description: "SpriteMancer project UUID from spritemancer_create_character result", required: true },
            explanation: { type: "string", description: "Why opening this project in embedded editor", required: true }
        },
        whenToUse: "After creating a character to let user see the result in embedded editor"
    },
    {
        name: "spritemancer_retry_postprocess",
        description: "Retry post-processing on an animation if it failed or produced poor results",
        params: {
            project_id: { type: "string", description: "SpriteMancer project UUID", required: true },
            animation: { type: "string", description: "Animation name to retry (idle, walk, etc.)", required: true },
            explanation: { type: "string", description: "Why retrying post-processing", required: true }
        },
        whenToUse: "When post-processing failed or user reports quality issues with an animation"
    },
    {
        name: "spritemancer_navigate",
        description: "Navigate to a specific view in the SpriteMancer embedded editor",
        params: {
            view: { type: "string", description: "View: 'animation', 'postprocess', 'export', 'layers'", required: true },
            explanation: { type: "string", description: "Why navigating to this view", required: true }
        },
        whenToUse: "To guide user to specific editor features"
    },

    // ============================================
    // GODOT REFERENCE
    // ============================================
    {
        name: "get_godot_help",
        description: "Get detailed reference information about Godot 4 classes, methods, properties, or patterns. Returns documentation from the built-in Godot reference.",
        params: {
            topic: { type: "string", description: "Topic to look up: CharacterBody2D, AnimatedSprite2D, SpriteFrames, signals, @onready, @export, preload, move_and_slide, etc.", required: true },
            explanation: { type: "string", description: "Why you need this information", required: true }
        },
        whenToUse: "When you need details about Godot classes, properties, methods, or GDScript patterns before implementing",
        whenNotToUse: "For basic operations you already know how to perform"
    }
];

/**
 * Generates the tools section for the system prompt
 */
export function getToolsPrompt(): string {
    let prompt = "## Available Commands\n\n";

    let commandNumber = 1;
    for (const tool of TOOL_DEFINITIONS) {
        const requiredParams = Object.entries(tool.params)
            .filter(([_, v]) => v.required)
            .map(([k, v]) => `${k}: "${v.description}"`)
            .join(", ");

        prompt += `${commandNumber}. ${tool.name} - ${tool.description}\n`;
        prompt += `   params: { ${requiredParams} }\n`;

        if (tool.whenToUse) {
            prompt += `   Use when: ${tool.whenToUse}\n`;
        }

        prompt += "\n";
        commandNumber++;
    }

    return prompt;
}

/**
 * Get count of available tools
 */
export function getToolCount(): number {
    return TOOL_DEFINITIONS.length;
}
