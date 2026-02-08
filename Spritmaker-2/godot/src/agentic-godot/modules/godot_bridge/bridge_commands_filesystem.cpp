// bridge_commands_filesystem.cpp
// File system and asset operations for GodotBridge

#include "godot_bridge.h"
#include "core/io/file_access.h"
#include "core/io/dir_access.h"
#include "core/io/resource_saver.h"
#include "core/io/resource_loader.h"
#include "scene/resources/theme.h"
#include "scene/resources/material.h"
#include "scene/resources/sprite_frames.h"

#ifdef TOOLS_ENABLED
#include "editor/editor_file_system.h"
#endif

// ============ File System Commands ============

Dictionary GodotBridge::list_files(const String &p_path, bool p_recursive) {
	Dictionary result;
	Array files;
	Array folders;
	
	_list_files_internal(p_path, p_recursive, files, folders);
	
	result["path"] = p_path;
	result["files"] = files;
	result["folders"] = folders;
	result["recursive"] = p_recursive;
	result["success"] = true;
	return result;
}

void GodotBridge::_list_files_internal(const String &p_path, bool p_recursive, Array &r_files, Array &r_folders) {
	Ref<DirAccess> dir = DirAccess::open(p_path);
	if (!dir.is_valid()) {
		return;
	}
	
	dir->list_dir_begin();
	String file_name = dir->get_next();
	while (!file_name.is_empty()) {
		if (file_name != "." && file_name != "..") {
			String full_path = p_path.path_join(file_name);
			if (dir->current_is_dir()) {
				r_folders.push_back(full_path);
				// Recurse into subdirectories if recursive mode
				if (p_recursive) {
					_list_files_internal(full_path, true, r_files, r_folders);
				}
			} else {
				r_files.push_back(full_path);
			}
		}
		file_name = dir->get_next();
	}
	dir->list_dir_end();
}

Dictionary GodotBridge::read_file(const String &p_path) {
	Dictionary result;
	
	// Check if file exists
	if (!FileAccess::exists(p_path)) {
		result["error"] = "File not found: " + p_path;
		result["success"] = false;
		return result;
	}
	
	// Open and read file
	Ref<FileAccess> file = FileAccess::open(p_path, FileAccess::READ);
	if (!file.is_valid()) {
		result["error"] = "Cannot open file: " + p_path;
		result["success"] = false;
		return result;
	}
	
	// Read content (limit to 100KB for safety)
	int64_t file_size = file->get_length();
	const int64_t MAX_SIZE = 100 * 1024; // 100KB
	
	if (file_size > MAX_SIZE) {
		result["warning"] = "File truncated to 100KB";
		file_size = MAX_SIZE;
	}
	
	String content = file->get_as_text();
	if (content.length() > MAX_SIZE) {
		content = content.substr(0, MAX_SIZE);
	}
	
	result["path"] = p_path;
	result["content"] = content;
	result["size"] = file_size;
	result["success"] = true;
	return result;
}

Dictionary GodotBridge::create_folder(const String &p_path) {
	Dictionary result;
	
	Ref<DirAccess> dir = DirAccess::open("res://");
	if (!dir.is_valid()) {
		result["error"] = "Cannot access res://";
		result["success"] = false;
		return result;
	}
	
	Error err = dir->make_dir_recursive(p_path);
	if (err == OK) {
		result["path"] = p_path;
		result["success"] = true;
	} else {
		result["error"] = "Failed to create folder: " + p_path;
		result["success"] = false;
	}
	return result;
}

Dictionary GodotBridge::delete_file(const String &p_path) {
	Dictionary result;
	
	Ref<DirAccess> dir = DirAccess::open("res://");
	if (!dir.is_valid()) {
		result["error"] = "Cannot access res://";
		result["success"] = false;
		return result;
	}
	
	Error err = dir->remove(p_path);
	if (err == OK) {
		result["path"] = p_path;
		result["success"] = true;
	} else {
		result["error"] = "Failed to delete: " + p_path;
		result["success"] = false;
	}
	return result;
}

// ============ Resource Commands ============

Dictionary GodotBridge::create_resource(const String &p_type, const String &p_path) {
	Dictionary result;
	
	Ref<Resource> resource;
	
	// Create resource based on type
	if (p_type == "Theme") {
		Ref<Theme> theme;
		theme.instantiate();
		resource = theme;
	} else if (p_type == "Material" || p_type == "ShaderMaterial") {
		Ref<ShaderMaterial> mat;
		mat.instantiate();
		resource = mat;
	} else if (p_type == "SpriteFrames") {
		Ref<SpriteFrames> frames;
		frames.instantiate();
		resource = frames;
	} else {
		result["error"] = "Unknown resource type: " + p_type;
		result["success"] = false;
		return result;
	}
	
	// Save to path
	Error err = ResourceSaver::save(resource, p_path);
	if (err == OK) {
		result["type"] = p_type;
		result["path"] = p_path;
		result["success"] = true;
	} else {
		result["error"] = "Failed to save resource";
		result["success"] = false;
	}
	
	return result;
}

Dictionary GodotBridge::load_resource(const String &p_path) {
	Dictionary result;
	
	if (!ResourceLoader::exists(p_path)) {
		result["error"] = "Resource not found: " + p_path;
		result["success"] = false;
		return result;
	}
	
	Ref<Resource> resource = ResourceLoader::load(p_path);
	if (resource.is_valid()) {
		result["path"] = p_path;
		result["type"] = resource->get_class();
		result["success"] = true;
	} else {
		result["error"] = "Failed to load resource: " + p_path;
		result["success"] = false;
	}
	
	return result;
}

// ============ Asset Pipeline Commands ============

Dictionary GodotBridge::assets_scan() {
	Dictionary result;
#ifdef TOOLS_ENABLED
	EditorFileSystem *efs = EditorFileSystem::get_singleton();
	if (!efs) {
		result["error"] = "EditorFileSystem not available";
		result["success"] = false;
		return result;
	}
	
	// Trigger full filesystem scan
	efs->scan();
	
	result["message"] = "File system scan initiated";
	result["success"] = true;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::assets_update_file(const String &p_path) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	EditorFileSystem *efs = EditorFileSystem::get_singleton();
	if (!efs) {
		result["error"] = "EditorFileSystem not available";
		result["success"] = false;
		return result;
	}
	
	// Use scan() like the SpriteMancer dock does - most reliable way to detect new files
	efs->scan();
	
	result["path"] = p_path;
	result["message"] = "Filesystem scan triggered";
	result["success"] = true;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::assets_update_files(const Array &p_paths) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	EditorFileSystem *efs = EditorFileSystem::get_singleton();
	if (!efs) {
		result["error"] = "EditorFileSystem not available";
		result["success"] = false;
		return result;
	}
	
	// Use scan() like the SpriteMancer dock does - most reliable way to detect new files
	efs->scan();
	
	result["paths"] = p_paths;
	result["count"] = p_paths.size();
	result["message"] = "Filesystem scan triggered";
	result["success"] = true;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::assets_reimport(const String &p_path) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	EditorFileSystem *efs = EditorFileSystem::get_singleton();
	if (!efs) {
		result["error"] = "EditorFileSystem not available";
		result["success"] = false;
		return result;
	}
	
	// First ensure the file is in the filesystem
	efs->update_file(p_path);
	
	PackedStringArray paths;
	paths.push_back(p_path);
	efs->reimport_files(paths);
	
	result["path"] = p_path;
	result["message"] = "Reimport triggered";
	result["success"] = true;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::assets_move_and_rename(const String &p_from, const String &p_to) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	EditorFileSystem *efs = EditorFileSystem::get_singleton();
	if (!efs) {
		result["error"] = "EditorFileSystem not available";
		result["success"] = false;
		return result;
	}
	
	// Move using DirAccess (handles dependencies automatically through EditorFileSystem)
	Ref<DirAccess> dir = DirAccess::open("res://");
	if (!dir.is_valid()) {
		result["error"] = "Cannot access project directory";
		result["success"] = false;
		return result;
	}
	
	Error err = dir->rename(p_from, p_to);
	if (err == OK) {
		// Trigger rescan to update dependency tracking
		efs->scan();
		result["from"] = p_from;
		result["to"] = p_to;
		result["success"] = true;
	} else {
		result["error"] = "Failed to move/rename file";
		result["success"] = false;
	}
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}
