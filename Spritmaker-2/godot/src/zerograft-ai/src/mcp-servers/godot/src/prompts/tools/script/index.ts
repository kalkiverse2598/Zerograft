/**
 * Script Tools
 * 
 * Tools for creating, reading, and editing GDScript files.
 */

import { GodotToolSpec, ModelFamily } from "../../types.js";

export const create_script: GodotToolSpec = {
    id: "create_script",
    variant: ModelFamily.GENERIC,
    name: "create_script",
    description: "Create a GDScript file",
    whenToUse: "When creating new behavior or logic for game objects",
    parameters: [
        {
            name: "path", required: true, type: "string",
            description: "Script path (res://name.gd)"
        },
        {
            name: "content", required: true, type: "string",
            description: "Full script content (extends ...)"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why creating this script"
        }
    ]
};

export const read_script: GodotToolSpec = {
    id: "read_script",
    variant: ModelFamily.GENERIC,
    name: "read_script",
    description: "Read the contents of a script file",
    whenToUse: "Before editing a script to understand current content",
    parameters: [
        {
            name: "path", required: true, type: "string",
            description: "Script path (res://script.gd)"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why reading this script"
        }
    ]
};

export const edit_script: GodotToolSpec = {
    id: "edit_script",
    variant: ModelFamily.GENERIC,
    name: "edit_script",
    description: "Edit/replace the contents of a script file",
    whenToUse: "When modifying existing script logic",
    parameters: [
        {
            name: "path", required: true, type: "string",
            description: "Script path"
        },
        {
            name: "content", required: true, type: "string",
            description: "New script content"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why editing this script"
        }
    ]
};

export const attach_script: GodotToolSpec = {
    id: "attach_script",
    variant: ModelFamily.GENERIC,
    name: "attach_script",
    description: "Attach an existing script file to a node",
    whenToUse: "To attach a script file to a node",
    parameters: [
        {
            name: "node", required: true, type: "string",
            description: "Node path to attach script to"
        },
        {
            name: "script_path", required: true, type: "string",
            description: "Path to script file (res://player.gd)"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why attaching this script"
        }
    ]
};

export const get_errors: GodotToolSpec = {
    id: "get_errors",
    variant: ModelFamily.GENERIC,
    name: "get_errors",
    description: "Get node configuration warnings and script compilation errors from the current scene. Returns detailed messages about missing textures, invalid collision shapes, empty containers, and other node issues.",
    whenToUse: "When debugging issues, when user reports errors/warnings, or after making changes to verify correctness. ALWAYS call this FIRST when user mentions any error, warning, or problem.",
    parameters: [
        {
            name: "explanation", required: true, type: "string",
            description: "Why checking for errors"
        }
    ]
};

export const get_runtime_errors: GodotToolSpec = {
    id: "get_runtime_errors",
    variant: ModelFamily.GENERIC,
    name: "get_runtime_errors",
    description: "Get runtime errors that appear in the Godot debugger/console. These are errors like 'Failed loading resource', 'Invalid call', 'Null instance' etc. that happen during game execution. Returns errors with file, line, function, and timestamp.",
    whenToUse: "When user mentions 'debugger error', 'console error', 'runtime error', or errors that happen when running the game. Use alongside get_errors for complete error visibility.",
    parameters: [
        {
            name: "explanation", required: true, type: "string",
            description: "Why checking for runtime errors"
        }
    ]
};

export const clear_runtime_errors: GodotToolSpec = {
    id: "clear_runtime_errors",
    variant: ModelFamily.GENERIC,
    name: "clear_runtime_errors",
    description: "Clear the captured runtime errors buffer. Use after fixing errors to get a fresh start.",
    whenToUse: "After fixing runtime errors and before re-running the game to verify the fix.",
    parameters: [
        {
            name: "explanation", required: true, type: "string",
            description: "Why clearing errors"
        }
    ]
};

export const search_in_scripts: GodotToolSpec = {
    id: "search_in_scripts",
    variant: ModelFamily.GENERIC,
    name: "search_in_scripts",
    description: "Search for text/regex pattern across all GDScript files",
    whenToUse: "When looking for variable usage, function calls, or patterns across scripts",
    parameters: [
        {
            name: "pattern", required: true, type: "string",
            description: "Search pattern (text or regex)"
        },
        {
            name: "is_regex", required: false, type: "boolean",
            description: "Whether pattern is regex", default: false
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why searching scripts"
        }
    ]
};

/** All script tools */
export const scriptTools: GodotToolSpec[] = [
    create_script,
    read_script,
    edit_script,
    attach_script,
    get_errors,
    get_runtime_errors,
    clear_runtime_errors,
    search_in_scripts
];
