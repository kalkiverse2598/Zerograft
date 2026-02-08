/**
 * Agentic Tools
 * 
 * Tools for agentic loop control: questions, completion, planning.
 */

import { GodotToolSpec, ModelFamily } from "../../types.js";

export const ask_followup_question: GodotToolSpec = {
    id: "ask_followup_question",
    variant: ModelFamily.GENERIC,
    name: "ask_followup_question",
    description: "Ask the user a question to get clarification or input before continuing",
    whenToUse: "When you need information from the user before proceeding (e.g., sprite size, character name)",
    parameters: [
        {
            name: "question", required: true, type: "string",
            description: "The question to ask the user"
        },
        {
            name: "choices", required: false, type: "array",
            items: { type: "string" },
            description: "Optional list of choices for user to pick from"
        },
        {
            name: "context_key", required: true, type: "string",
            description: "Key to store answer (prevents re-asking)"
        }
    ]
};

export const attempt_completion: GodotToolSpec = {
    id: "attempt_completion",
    variant: ModelFamily.GENERIC,
    name: "attempt_completion",
    description: "Signal that the task is complete and provide a summary",
    whenToUse: "When you have completed ALL steps of the task successfully",
    parameters: [
        {
            name: "result", required: true, type: "string",
            description: "Summary of what was accomplished"
        },
        {
            name: "warnings", required: false, type: "array",
            items: { type: "string" },
            description: "Any issues or warnings to note"
        },
        {
            name: "next_suggestions", required: false, type: "array",
            items: { type: "string" },
            description: "Suggested next steps for user"
        }
    ]
};

export const start_plan: GodotToolSpec = {
    id: "start_plan",
    variant: ModelFamily.GENERIC,
    name: "start_plan",
    description: "Create a task plan with multiple steps. Shows in the Blueprint tab.",
    whenToUse: "When starting a complex multi-step task (3+ distinct steps). Game creation, scene setup, character implementation.",
    whenNotToUse: "For SMALL/SIMPLE tasks: 'add a node', 'change a property', 'fix the color', 'run the game'. Just execute directly!",
    parameters: [
        {
            name: "name", required: true, type: "string",
            description: "Name of the plan/task"
        },
        {
            name: "steps", required: true, type: "array",
            items: { type: "string" },
            description: "Array of step descriptions"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why creating this plan"
        }
    ]
};

export const update_plan: GodotToolSpec = {
    id: "update_plan",
    variant: ModelFamily.GENERIC,
    name: "update_plan",
    description: "Update a plan step status (pending, in_progress, completed)",
    whenToUse: "When completing or starting a plan step",
    parameters: [
        {
            name: "step_index", required: true, type: "number",
            description: "Step index (0-based)"
        },
        {
            name: "status", required: true, type: "string",
            description: "New status: pending, in_progress, completed"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why updating this step"
        }
    ]
};

export const set_task_plan: GodotToolSpec = {
    id: "set_task_plan",
    variant: ModelFamily.GENERIC,
    name: "set_task_plan",
    description: "Update the Blueprint tab with current task plan and step statuses",
    parameters: [
        {
            name: "name", required: true, type: "string",
            description: "Plan name (e.g., 'Create Player Character')"
        },
        {
            name: "steps", required: true, type: "array",
            items: { type: "object" },
            description: "Array of { description, status: 'pending'|'in_progress'|'completed' }"
        }
    ]
};

export const request_user_feedback: GodotToolSpec = {
    id: "request_user_feedback",
    variant: ModelFamily.GENERIC,
    name: "request_user_feedback",
    description: "Ask user to test the game and provide feedback before continuing",
    parameters: [
        {
            name: "message", required: true, type: "string",
            description: "What to test (e.g., 'Try moving the player with arrow keys')"
        }
    ]
};

/**
 * Phase 3: Compound tool that creates a complete player scene with sprites
 * Bridges SpriteMancer output to scene creation in one step
 */
export const setup_player_with_sprites: GodotToolSpec = {
    id: "setup_player_with_sprites",
    variant: ModelFamily.GENERIC,
    name: "setup_player_with_sprites",
    description: "COMPOUND: Creates complete player scene with CharacterBody2D, CollisionShape2D, AnimatedSprite2D (with assigned SpriteFrames), and movement script. Use AFTER spritemancer_approve_animation.",
    whenToUse: "After user approves an animation and you have the sprite_frames_path. This is the fastest way to set up a playable character.",
    whenNotToUse: "When you don't have a sprite_frames_path yet, or when you need custom scene structure.",
    parameters: [
        {
            name: "sprite_frames_path", required: true, type: "string",
            description: "Path to SpriteFrames resource (from spritemancer_approve_animation response)"
        },
        {
            name: "player_name", required: false, type: "string",
            description: "Character name (default: 'Player'). Used for scene and script naming."
        },
        {
            name: "scene_path", required: false, type: "string",
            description: "Player scene path (default: 'res://scenes/{player_name}.tscn')"
        },
        {
            name: "script_path", required: false, type: "string",
            description: "Player script path (default: 'res://scripts/{player_name}.gd')"
        },
        {
            name: "collision_width", required: false, type: "number",
            description: "Collision shape width in pixels (default: 24)"
        },
        {
            name: "collision_height", required: false, type: "number",
            description: "Collision shape height in pixels (default: 48)"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why setting up this player"
        }
    ]
};

/** All agentic tools */
export const agenticTools: GodotToolSpec[] = [
    ask_followup_question,
    attempt_completion,
    start_plan,
    update_plan,
    set_task_plan,
    request_user_feedback,
    setup_player_with_sprites
];

