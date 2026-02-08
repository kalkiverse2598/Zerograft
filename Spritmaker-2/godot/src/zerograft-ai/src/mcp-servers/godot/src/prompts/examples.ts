/**
 * Command Examples for Agentic Godot
 * 
 * Usage examples that teach the AI how to respond to various requests.
 */

export interface CommandExample {
    userRequest: string;
    response: string;
    commands: Array<{
        method: string;
        params: Record<string, unknown>;
        explanation: string;
    }>;
}

export const COMMAND_EXAMPLES: CommandExample[] = [
    // Scene Creation Examples
    {
        userRequest: "Create a player scene",
        response: "I'll create a player scene with a CharacterBody2D root, add a CollisionShape2D for physics, and create a movement script.",
        commands: [
            {
                method: "create_scene",
                params: { path: "res://scenes/player.tscn", root_type: "CharacterBody2D" },
                explanation: "Creating player scene with CharacterBody2D for physics-based movement"
            },
            {
                method: "add_node",
                params: { parent: "", type: "CollisionShape2D", name: "CollisionShape2D" },
                explanation: "Adding collision shape for player physics interactions"
            },
            {
                method: "add_node",
                params: { parent: "", type: "Sprite2D", name: "Sprite" },
                explanation: "Adding sprite for visual representation"
            }
        ]
    },
    {
        userRequest: "Add an enemy to my game",
        response: "I'll create an enemy scene with CharacterBody2D root and set it up for AI behavior.",
        commands: [
            {
                method: "create_scene",
                params: { path: "res://scenes/enemy.tscn", root_type: "CharacterBody2D" },
                explanation: "Creating enemy scene with physics body for movement"
            }
        ]
    },

    // Script Examples
    {
        userRequest: "Make the player move with WASD",
        response: "I'll create a movement script that handles WASD input for player movement.",
        commands: [
            {
                method: "add_input_action",
                params: { action: "move_left", key: "A" },
                explanation: "Adding left movement input binding"
            },
            {
                method: "add_input_action",
                params: { action: "move_right", key: "D" },
                explanation: "Adding right movement input binding"
            },
            {
                method: "add_input_action",
                params: { action: "move_up", key: "W" },
                explanation: "Adding up movement input binding"
            },
            {
                method: "add_input_action",
                params: { action: "move_down", key: "S" },
                explanation: "Adding down movement input binding"
            },
            {
                method: "create_script",
                params: {
                    path: "res://scripts/player_movement.gd",
                    content: `extends CharacterBody2D

@export var speed: float = 200.0

func _physics_process(delta: float) -> void:
    var direction = Vector2.ZERO
    
    if Input.is_action_pressed("move_left"):
        direction.x -= 1
    if Input.is_action_pressed("move_right"):
        direction.x += 1
    if Input.is_action_pressed("move_up"):
        direction.y -= 1
    if Input.is_action_pressed("move_down"):
        direction.y += 1
    
    velocity = direction.normalized() * speed
    move_and_slide()
`
                },
                explanation: "Creating movement script with WASD input handling"
            }
        ]
    },

    // Game Execution Examples
    {
        userRequest: "Run my game",
        response: "Starting the game...",
        commands: [
            {
                method: "run_game",
                params: { scene: "" },
                explanation: "Running the main scene"
            }
        ]
    },
    {
        userRequest: "Stop the game",
        response: "Stopping the running game.",
        commands: [
            {
                method: "stop_game",
                params: {},
                explanation: "Stopping game execution"
            }
        ]
    },

    // Debugging Examples
    {
        userRequest: "Are there any errors?",
        response: "Let me check for any script or compilation errors.",
        commands: [
            {
                method: "get_errors",
                params: {},
                explanation: "Checking for compilation and script errors"
            }
        ]
    },
    {
        userRequest: "Show me the player script",
        response: "I'll read the player script to show you its contents.",
        commands: [
            {
                method: "read_script",
                params: { path: "res://scripts/player.gd" },
                explanation: "Reading player script to display contents"
            }
        ]
    },

    // Node Manipulation Examples
    {
        userRequest: "Rename Player to Hero",
        response: "Renaming the Player node to Hero.",
        commands: [
            {
                method: "rename_node",
                params: { path: "Player", new_name: "Hero" },
                explanation: "Renaming node for clarity"
            }
        ]
    },
    {
        userRequest: "Duplicate the enemy",
        response: "Duplicating the enemy node.",
        commands: [
            {
                method: "duplicate_node",
                params: { path: "Enemy" },
                explanation: "Creating a copy of the enemy node"
            }
        ]
    },

    // Signal Examples
    {
        userRequest: "Connect the button to a handler",
        response: "I'll connect the button's pressed signal to a handler method.",
        commands: [
            {
                method: "connect_signal",
                params: { source: "Button", signal: "pressed", target: ".", method: "_on_button_pressed" },
                explanation: "Connecting button press to handler method"
            }
        ]
    },

    // Audio Examples
    {
        userRequest: "Add a jump sound",
        response: "I'll set up an audio player with the jump sound.",
        commands: [
            {
                method: "add_node",
                params: { parent: "", type: "AudioStreamPlayer", name: "JumpSound" },
                explanation: "Adding audio player node for jump sound"
            },
            {
                method: "set_audio_stream",
                params: { node: "JumpSound", audio_path: "res://sounds/jump.wav" },
                explanation: "Assigning jump audio file to the player"
            }
        ]
    },

    // Search Examples (New)
    {
        userRequest: "Find where velocity is used",
        response: "I'll search all scripts for velocity usage.",
        commands: [
            {
                method: "search_in_scripts",
                params: { pattern: "velocity", is_regex: false },
                explanation: "Searching for velocity variable usage across all scripts"
            }
        ]
    },

    // Undo Example (New)
    {
        userRequest: "Undo that change",
        response: "Reverting the last action.",
        commands: [
            {
                method: "undo_last_action",
                params: {},
                explanation: "Reverting the previous command"
            }
        ]
    }
];

/**
 * Generates the examples section for the system prompt
 */
export function getExamplesPrompt(): string {
    let prompt = "## Examples\n\n";

    for (const example of COMMAND_EXAMPLES.slice(0, 10)) { // Limit to 10 examples
        prompt += `- "${example.userRequest}" -> ${example.commands.map(c => c.method).join(", ")}\n`;
    }

    return prompt;
}

/**
 * Get examples for a specific command
 */
export function getExamplesForCommand(commandName: string): CommandExample[] {
    return COMMAND_EXAMPLES.filter(ex =>
        ex.commands.some(cmd => cmd.method === commandName)
    );
}
