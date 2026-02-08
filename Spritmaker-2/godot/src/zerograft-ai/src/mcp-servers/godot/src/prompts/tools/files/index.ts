/**
 * File System Tools
 * 
 * Tools for file and folder operations in Godot project.
 */

import { GodotToolSpec, ModelFamily } from "../../types.js";

export const list_files: GodotToolSpec = {
    id: "list_files",
    variant: ModelFamily.GENERIC,
    name: "list_files",
    description: "List files in a directory. Use recursive=true to find files in all subdirectories",
    whenToUse: "To discover files in a directory",
    whenNotToUse: "NEVER use this after spritemancer_generate_animations - use the returned sprite_frames_path instead!",
    parameters: [
        {
            name: "path", required: true, type: "string",
            description: "Directory path (res://sprites)"
        },
        {
            name: "recursive", required: false, type: "boolean",
            description: "If true, also lists files in subdirectories"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why listing files"
        }
    ]
};

export const create_folder: GodotToolSpec = {
    id: "create_folder",
    variant: ModelFamily.GENERIC,
    name: "create_folder",
    description: "Create a new folder",
    parameters: [
        {
            name: "path", required: true, type: "string",
            description: "Folder path (res://new_folder)"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why creating this folder"
        }
    ]
};

export const delete_file: GodotToolSpec = {
    id: "delete_file",
    variant: ModelFamily.GENERIC,
    name: "delete_file",
    description: "Delete a file or folder",
    parameters: [
        {
            name: "path", required: true, type: "string",
            description: "Path to delete"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why deleting this file"
        }
    ]
};

export const read_file: GodotToolSpec = {
    id: "read_file",
    variant: ModelFamily.GENERIC,
    name: "read_file",
    description: "Read the contents of any text file in the project (JSON, TXT, CFG, etc.)",
    parameters: [
        {
            name: "path", required: true, type: "string",
            description: "File path (res://data.json)"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why reading this file"
        }
    ]
};

export const assets_scan: GodotToolSpec = {
    id: "assets_scan",
    variant: ModelFamily.GENERIC,
    name: "assets_scan",
    description: "Force Godot to rescan the filesystem for new/changed files",
    whenToUse: "ALWAYS call after spritemancer_import or when files are created externally",
    parameters: [
        {
            name: "explanation", required: true, type: "string",
            description: "Why scanning assets"
        }
    ]
};

export const assets_update_file: GodotToolSpec = {
    id: "assets_update_file",
    variant: ModelFamily.GENERIC,
    name: "assets_update_file",
    description: "Update Godot's knowledge of a specific file that was changed externally",
    parameters: [
        {
            name: "path", required: true, type: "string",
            description: "Path to file (res://sprites/knight.png)"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why updating this file"
        }
    ]
};

export const assets_reimport: GodotToolSpec = {
    id: "assets_reimport",
    variant: ModelFamily.GENERIC,
    name: "assets_reimport",
    description: "Force reimport of a specific resource file with current import settings",
    parameters: [
        {
            name: "path", required: true, type: "string",
            description: "Path to resource (res://sprites/knight.png)"
        },
        {
            name: "explanation", required: true, type: "string",
            description: "Why reimporting this asset"
        }
    ]
};

/** All file system tools */
export const fileTools: GodotToolSpec[] = [
    list_files,
    create_folder,
    delete_file,
    read_file,
    assets_scan,
    assets_update_file,
    assets_reimport
];
