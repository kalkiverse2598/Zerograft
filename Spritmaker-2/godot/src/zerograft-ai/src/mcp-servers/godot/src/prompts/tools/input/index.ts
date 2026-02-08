/**
 * Input Action Tools
 * 
 * Tools for managing input actions and key bindings.
 */

import { GodotToolSpec, ModelFamily } from "../../types.js";

export const add_input_action: GodotToolSpec = {
    id: "add_input_action",
    variant: ModelFamily.GENERIC,
    name: "add_input_action",
    description: "Add an input action with a key binding",
    parameters: [
        {
            name: "action", required: true, type: "string",
            description: "Action name (jump, move_left, etc.)"
        },
        {
            name: "key", required: true, type: "string",
            description: "Key binding (SPACE, W, A, S, D, etc.)"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why adding this input action"
        }
    ]
};

export const list_input_actions: GodotToolSpec = {
    id: "list_input_actions",
    variant: ModelFamily.GENERIC,
    name: "list_input_actions",
    description: "List all custom input actions",
    parameters: [
        {
            name: "explanation", required: true, type: "string",
            description: "Why listing input actions"
        }
    ]
};

export const remove_input_action: GodotToolSpec = {
    id: "remove_input_action",
    variant: ModelFamily.GENERIC,
    name: "remove_input_action",
    description: "Remove an input action",
    parameters: [
        {
            name: "action", required: true, type: "string",
            description: "Action name to remove"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why removing this action"
        }
    ]
};

/** Property tools */
export const set_property: GodotToolSpec = {
    id: "set_property",
    variant: ModelFamily.GENERIC,
    name: "set_property",
    description: "Set a node property",
    parameters: [
        {
            name: "node", required: true, type: "string",
            description: "Node path"
        },
        {
            name: "property", required: true, type: "string",
            description: "Property name"
        },
        {
            name: "value", required: true, type: "string",
            description: "Property value"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why setting this property"
        }
    ]
};

export const get_property: GodotToolSpec = {
    id: "get_property",
    variant: ModelFamily.GENERIC,
    name: "get_property",
    description: "Get a node property value",
    parameters: [
        {
            name: "node", required: true, type: "string",
            description: "Node path"
        },
        {
            name: "property", required: true, type: "string",
            description: "Property name"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why getting this property"
        }
    ]
};

/** Project settings */
export const set_project_setting: GodotToolSpec = {
    id: "set_project_setting",
    variant: ModelFamily.GENERIC,
    name: "set_project_setting",
    description: "Set a project setting",
    parameters: [
        {
            name: "setting", required: true, type: "string",
            description: "Setting path (application/run/main_scene)"
        },
        {
            name: "value", required: true, type: "string",
            description: "Setting value"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why setting this value"
        }
    ]
};

export const get_project_setting: GodotToolSpec = {
    id: "get_project_setting",
    variant: ModelFamily.GENERIC,
    name: "get_project_setting",
    description: "Get a project setting value",
    parameters: [
        {
            name: "setting", required: true, type: "string",
            description: "Setting path"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why getting this setting"
        }
    ]
};

/** Game execution */
export const run_game: GodotToolSpec = {
    id: "run_game",
    variant: ModelFamily.GENERIC,
    name: "run_game",
    description: "Run the game",
    parameters: [
        {
            name: "scene", required: false, type: "string",
            description: "Scene to run (empty for main)"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why running the game"
        }
    ]
};

export const stop_game: GodotToolSpec = {
    id: "stop_game",
    variant: ModelFamily.GENERIC,
    name: "stop_game",
    description: "Stop the running game",
    parameters: [
        {
            name: "explanation", required: true, type: "string",
            description: "Why stopping the game"
        }
    ]
};

/** All input/property/execution tools */
export const inputTools: GodotToolSpec[] = [
    add_input_action,
    list_input_actions,
    remove_input_action,
    set_property,
    get_property,
    set_project_setting,
    get_project_setting,
    run_game,
    stop_game
];
