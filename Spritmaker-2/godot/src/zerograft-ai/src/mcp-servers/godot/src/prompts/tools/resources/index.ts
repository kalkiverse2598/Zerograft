/**
 * Resource and Signal Tools
 * 
 * Tools for managing resources, signals, groups, and audio.
 */

import { GodotToolSpec, ModelFamily } from "../../types.js";

/** Signal tools */
export const connect_signal: GodotToolSpec = {
    id: "connect_signal",
    variant: ModelFamily.GENERIC,
    name: "connect_signal",
    description: "Connect a signal between nodes",
    parameters: [
        {
            name: "source", required: true, type: "string",
            description: "Source node path"
        },
        {
            name: "signal", required: true, type: "string",
            description: "Signal name (pressed, body_entered, etc.)"
        },
        {
            name: "target", required: true, type: "string",
            description: "Target node path"
        },
        {
            name: "method", required: true, type: "string",
            description: "Method name to call"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why connecting this signal"
        }
    ]
};

export const list_signals: GodotToolSpec = {
    id: "list_signals",
    variant: ModelFamily.GENERIC,
    name: "list_signals",
    description: "List all signals on a node",
    parameters: [
        {
            name: "node", required: true, type: "string",
            description: "Node path"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why listing signals"
        }
    ]
};

/** Group tools */
export const add_to_group: GodotToolSpec = {
    id: "add_to_group",
    variant: ModelFamily.GENERIC,
    name: "add_to_group",
    description: "Add a node to a group",
    parameters: [
        {
            name: "node", required: true, type: "string",
            description: "Node path"
        },
        {
            name: "group", required: true, type: "string",
            description: "Group name"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why adding to this group"
        }
    ]
};

export const list_groups: GodotToolSpec = {
    id: "list_groups",
    variant: ModelFamily.GENERIC,
    name: "list_groups",
    description: "List all groups a node belongs to",
    parameters: [
        {
            name: "node", required: true, type: "string",
            description: "Node path"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why listing groups"
        }
    ]
};

export const remove_from_group: GodotToolSpec = {
    id: "remove_from_group",
    variant: ModelFamily.GENERIC,
    name: "remove_from_group",
    description: "Remove a node from a group",
    parameters: [
        {
            name: "node", required: true, type: "string",
            description: "Node path"
        },
        {
            name: "group", required: true, type: "string",
            description: "Group name"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why removing from this group"
        }
    ]
};

/** Resource tools */
export const create_resource: GodotToolSpec = {
    id: "create_resource",
    variant: ModelFamily.GENERIC,
    name: "create_resource",
    description: "Create a new resource file",
    parameters: [
        {
            name: "type", required: true, type: "string",
            description: "Resource type (Theme, SpriteFrames, ShaderMaterial)"
        },
        {
            name: "path", required: true, type: "string",
            description: "Resource path (res://my_theme.tres)"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why creating this resource"
        }
    ]
};

export const load_resource: GodotToolSpec = {
    id: "load_resource",
    variant: ModelFamily.GENERIC,
    name: "load_resource",
    description: "Load a resource file",
    parameters: [
        {
            name: "path", required: true, type: "string",
            description: "Resource path"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why loading this resource"
        }
    ]
};

/** Audio tools */
export const set_audio_stream: GodotToolSpec = {
    id: "set_audio_stream",
    variant: ModelFamily.GENERIC,
    name: "set_audio_stream",
    description: "Set audio stream on a player node",
    parameters: [
        {
            name: "node", required: true, type: "string",
            description: "AudioStreamPlayer node path"
        },
        {
            name: "audio_path", required: true, type: "string",
            description: "Audio file path (res://sounds/jump.wav)"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why setting this audio"
        }
    ]
};

export const play_audio: GodotToolSpec = {
    id: "play_audio",
    variant: ModelFamily.GENERIC,
    name: "play_audio",
    description: "Play audio from a player node",
    parameters: [
        {
            name: "node", required: true, type: "string",
            description: "AudioStreamPlayer node path"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why playing this audio"
        }
    ]
};

/** Selection tools */
export const get_selected_nodes: GodotToolSpec = {
    id: "get_selected_nodes",
    variant: ModelFamily.GENERIC,
    name: "get_selected_nodes",
    description: "Get currently selected node(s) in the Scene Tree",
    parameters: [
        {
            name: "explanation", required: true, type: "string",
            description: "Why getting selection"
        }
    ]
};

export const get_selected_text: GodotToolSpec = {
    id: "get_selected_text",
    variant: ModelFamily.GENERIC,
    name: "get_selected_text",
    description: "Get text selection from the script editor",
    parameters: [
        {
            name: "explanation", required: true, type: "string",
            description: "Why getting text selection"
        }
    ]
};

export const get_selected_files: GodotToolSpec = {
    id: "get_selected_files",
    variant: ModelFamily.GENERIC,
    name: "get_selected_files",
    description: "Get files/folders selected in the FileSystem dock",
    parameters: [
        {
            name: "explanation", required: true, type: "string",
            description: "Why getting file selection"
        }
    ]
};

/** Utility tools */
export const undo_last_action: GodotToolSpec = {
    id: "undo_last_action",
    variant: ModelFamily.GENERIC,
    name: "undo_last_action",
    description: "Revert the previous command executed",
    parameters: [
        {
            name: "explanation", required: true, type: "string",
            description: "Why undoing the last action"
        }
    ]
};

export const get_godot_help: GodotToolSpec = {
    id: "get_godot_help",
    variant: ModelFamily.GENERIC,
    name: "get_godot_help",
    description: "Get detailed reference information about Godot 4 classes, methods, properties, or patterns",
    parameters: [
        {
            name: "topic", required: true, type: "string",
            description: "Topic: CharacterBody2D, AnimatedSprite2D, signals, @onready, etc."
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why you need this information"
        }
    ]
};

/** All resource tools */
export const resourceTools: GodotToolSpec[] = [
    connect_signal,
    list_signals,
    add_to_group,
    list_groups,
    remove_from_group,
    create_resource,
    load_resource,
    set_audio_stream,
    play_audio,
    get_selected_nodes,
    get_selected_text,
    get_selected_files,
    undo_last_action,
    get_godot_help
];
