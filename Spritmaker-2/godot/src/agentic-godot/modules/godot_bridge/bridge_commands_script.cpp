// bridge_commands_script.cpp
// Script operations for GodotBridge

#include "godot_bridge.h"
#include "core/io/file_access.h"
#include "core/io/dir_access.h"
#include "modules/regex/regex.h"

#ifdef TOOLS_ENABLED
#include "editor/editor_file_system.h"
#include "scene/main/scene_tree.h"
#endif

// ============ Script Commands ============

Dictionary GodotBridge::create_script(const String &p_path, const String &p_content) {
	Dictionary result;
	print_line("GodotBridge: Creating script: " + p_path);
	
	String dir_path = p_path.get_base_dir();
	Ref<DirAccess> dir = DirAccess::open("res://");
	if (dir.is_valid()) {
		dir->make_dir_recursive(dir_path.replace("res://", ""));
	}
	
	Ref<FileAccess> file = FileAccess::open(p_path, FileAccess::WRITE);
	
	if (!file.is_valid()) {
		result["error"] = "Cannot create file: " + p_path;
		result["success"] = false;
		return result;
	}
	
	file->store_string(p_content);
	file->close();
	
	result["path"] = p_path;
	result["success"] = true;
	print_line("GodotBridge: Script created: " + p_path);
	
#ifdef TOOLS_ENABLED
	EditorFileSystem::get_singleton()->scan();
#endif
	
	return result;
}

Dictionary GodotBridge::read_script(const String &p_path) {
	Dictionary result;
	
	// Read script file content
	Ref<FileAccess> file = FileAccess::open(p_path, FileAccess::READ);
	if (!file.is_valid()) {
		result["error"] = "Cannot open file: " + p_path;
		result["success"] = false;
		return result;
	}
	
	String content = file->get_as_text();
	file->close();
	
	result["path"] = p_path;
	result["content"] = content;
	result["line_count"] = content.split("\n").size();
	result["success"] = true;
	return result;
}

Dictionary GodotBridge::edit_script(const String &p_path, const String &p_content) {
	Dictionary result;
	
	// Write new content to script file
	Ref<FileAccess> file = FileAccess::open(p_path, FileAccess::WRITE);
	if (!file.is_valid()) {
		result["error"] = "Cannot write file: " + p_path;
		result["success"] = false;
		return result;
	}
	
	file->store_string(p_content);
	file->close();
	
#ifdef TOOLS_ENABLED
	// Reload the resource in editor
	EditorFileSystem *efs = EditorFileSystem::get_singleton();
	if (efs) {
		efs->scan();
	}
#endif
	
	result["path"] = p_path;
	result["success"] = true;
	return result;
}

Dictionary GodotBridge::get_errors() {
	Dictionary result;
	Array errors;
	Array warnings;
	
#ifdef TOOLS_ENABLED
	// Get scene tree for configuration warnings
	SceneTree *tree = SceneTree::get_singleton();
	if (tree && tree->get_edited_scene_root()) {
		Node *root = tree->get_edited_scene_root();
		// Recursively collect warnings from all nodes
		_collect_node_warnings(root, warnings);
	}
	
	result["errors"] = errors;
	result["warnings"] = warnings;
	result["warning_count"] = warnings.size();
	result["error_count"] = errors.size();
	result["success"] = true;
	
	if (warnings.size() > 0) {
		print_line("GodotBridge: Found " + itos(warnings.size()) + " node configuration warnings");
	}
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	
	return result;
}

void GodotBridge::_collect_node_warnings(Node *p_node, Array &r_warnings) {
	if (!p_node) return;
	
	PackedStringArray node_warnings = p_node->get_configuration_warnings();
	for (int i = 0; i < node_warnings.size(); i++) {
		Dictionary w;
		w["node_path"] = String(p_node->get_path());
		w["node_name"] = p_node->get_name();
		w["node_type"] = p_node->get_class();
		w["message"] = node_warnings[i];
		r_warnings.push_back(w);
	}
	
	// Recurse through children
	for (int i = 0; i < p_node->get_child_count(); i++) {
		_collect_node_warnings(p_node->get_child(i), r_warnings);
	}
}

Dictionary GodotBridge::search_in_scripts(const String &p_pattern, bool p_is_regex) {
	Dictionary result;
	Array matches;
	
	// Recursively search all .gd files in res://
	Ref<DirAccess> dir = DirAccess::open("res://");
	if (!dir.is_valid()) {
		result["error"] = "Cannot access project directory";
		result["success"] = false;
		return result;
	}
	
	// Simple recursive search
	Vector<String> script_paths;
	Vector<String> dirs_to_search;
	dirs_to_search.push_back("res://");
	
	while (dirs_to_search.size() > 0) {
		String current_dir = dirs_to_search[0];
		dirs_to_search.remove_at(0);
		
		Ref<DirAccess> d = DirAccess::open(current_dir);
		if (!d.is_valid()) continue;
		
		d->list_dir_begin();
		String item = d->get_next();
		while (!item.is_empty()) {
			if (item != "." && item != "..") {
				String full_path = current_dir.path_join(item);
				if (d->current_is_dir()) {
					dirs_to_search.push_back(full_path);
				} else if (item.ends_with(".gd")) {
					script_paths.push_back(full_path);
				}
			}
			item = d->get_next();
		}
		d->list_dir_end();
	}
	
	// Search each script
	for (int i = 0; i < script_paths.size(); i++) {
		String path = script_paths[i];
		Ref<FileAccess> file = FileAccess::open(path, FileAccess::READ);
		if (!file.is_valid()) continue;
		
		String content = file->get_as_text();
		PackedStringArray lines = content.split("\n");
		
		for (int line_num = 0; line_num < lines.size(); line_num++) {
			String line = lines[line_num];
			bool found = false;
			
			if (p_is_regex) {
				RegEx regex;
				regex.compile(p_pattern);
				if (regex.search(line).is_valid()) {
					found = true;
				}
			} else {
				if (line.find(p_pattern) != -1) {
					found = true;
				}
			}
			
			if (found) {
				Dictionary match;
				match["file"] = path;
				match["line_number"] = line_num + 1;
				match["line_content"] = line.strip_edges();
				matches.push_back(match);
				
				// Limit matches to prevent overwhelming results
				if (matches.size() >= 50) {
					result["truncated"] = true;
					break;
				}
			}
		}
		
		if (matches.size() >= 50) break;
	}
	
	result["pattern"] = p_pattern;
	result["is_regex"] = p_is_regex;
	result["matches"] = matches;
	result["count"] = matches.size();
	result["files_searched"] = script_paths.size();
	result["success"] = true;
	
	return result;
}
