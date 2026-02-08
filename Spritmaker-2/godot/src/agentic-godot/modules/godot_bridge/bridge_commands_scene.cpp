// bridge_commands_scene.cpp
// Scene and node management commands for GodotBridge

#include "godot_bridge.h"
#include "core/io/file_access.h"
#include "core/io/dir_access.h"
#include "core/io/resource_saver.h"
#include "scene/resources/packed_scene.h"
#include "scene/2d/node_2d.h"
#include "scene/main/canvas_item.h"
#include "core/io/resource_loader.h"

// Collision shape includes for set_collision_shape
#include "scene/2d/physics/collision_shape_2d.h"
#include "scene/3d/physics/collision_shape_3d.h"
#include "scene/resources/2d/shape_2d.h"
#include "scene/resources/2d/rectangle_shape_2d.h"
#include "scene/resources/2d/circle_shape_2d.h"
#include "scene/resources/2d/capsule_shape_2d.h"
#include "scene/resources/2d/segment_shape_2d.h"
#include "scene/resources/3d/shape_3d.h"
#include "scene/resources/3d/box_shape_3d.h"
#include "scene/resources/3d/sphere_shape_3d.h"
#include "scene/resources/3d/capsule_shape_3d.h"

#ifdef TOOLS_ENABLED
#include "editor/editor_node.h"
#include "editor/editor_interface.h"
#include "editor/editor_file_system.h"
#endif

// ============ Scene Tree and Node Operations ============

// Helper function to recursively serialize a node and its children
// Returns a Dictionary containing node info with nested children array
Dictionary GodotBridge::_serialize_node_recursive(Node *p_node, int p_current_depth, int p_max_depth) {
	Dictionary node_info;
	
	if (!p_node) {
		return node_info;
	}
	
	// Basic node properties
	node_info["name"] = p_node->get_name();
	node_info["type"] = p_node->get_class();
	node_info["path"] = String(p_node->get_path());
	node_info["child_count"] = p_node->get_child_count();
	
	// Add script info if attached
	Ref<Script> script = p_node->get_script();
	if (script.is_valid()) {
		node_info["script"] = script->get_path();
	}
	
	// Add visibility for CanvasItem nodes
	CanvasItem *canvas_item = Object::cast_to<CanvasItem>(p_node);
	if (canvas_item) {
		node_info["visible"] = canvas_item->is_visible();
	}
	
	// Recursively serialize children if within depth limit
	if (p_current_depth < p_max_depth && p_node->get_child_count() > 0) {
		Array children;
		for (int i = 0; i < p_node->get_child_count(); i++) {
			Node *child = p_node->get_child(i);
			Dictionary child_info = _serialize_node_recursive(child, p_current_depth + 1, p_max_depth);
			children.push_back(child_info);
		}
		node_info["children"] = children;
	} else if (p_node->get_child_count() > 0) {
		// At max depth, still indicate there are children but don't serialize them
		node_info["has_more_children"] = true;
	}
	
	return node_info;
}

Dictionary GodotBridge::get_scene_tree(int p_max_depth) {
	Dictionary result;
	
	// Clamp max_depth to reasonable bounds (1-10)
	int max_depth = CLAMP(p_max_depth, 1, 10);
	
#ifdef TOOLS_ENABLED
	EditorInterface *editor = EditorInterface::get_singleton();
	if (!editor) {
		result["error"] = "EditorInterface not available";
		result["success"] = false;
		return result;
	}
	
	Node *root = editor->get_edited_scene_root();
	
	if (root) {
		// Serialize the entire tree recursively
		Dictionary tree = _serialize_node_recursive(root, 0, max_depth);
		
		// Flatten top-level info for backwards compatibility
		result["root"] = tree["type"];
		result["name"] = tree["name"];
		result["path"] = tree["path"];
		result["children"] = tree.has("children") ? Array(tree["children"]) : Array();
		
		// Also include the full tree structure for agents that need it
		result["tree"] = tree;
		result["max_depth"] = max_depth;
		result["success"] = true;
		
		print_line("GodotBridge: Scene tree serialized with depth " + itos(max_depth));
	} else {
		result["error"] = "No scene currently open";
		result["success"] = false;
		result["hint"] = "Use create_scene to create a new scene, or open_scene to open an existing one";
	}
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	
	return result;
}

Dictionary GodotBridge::create_scene(const String &p_path, const String &p_root_type) {
	Dictionary result;
	print_line("GodotBridge: Creating scene: " + p_path + " with root: " + p_root_type);
	
	// VALIDATION: Check for empty path
	if (p_path.is_empty() || p_path == "res://" || p_path == "res:///" || !p_path.begins_with("res://")) {
		result["error"] = "Invalid scene path: path must start with res:// and include a filename";
		result["success"] = false;
		result["hint"] = "Use a path like res://scenes/MyScene.tscn";
		return result;
	}
	
	// VALIDATION: Ensure path ends with .tscn
	String scene_path = p_path;
	if (!scene_path.ends_with(".tscn")) {
		scene_path += ".tscn";
	}
	
#ifdef TOOLS_ENABLED
	// AUTO-CREATE: Ensure parent directory exists
	String dir_path = scene_path.get_base_dir();
	if (!dir_path.is_empty() && dir_path != "res://") {
		Ref<DirAccess> dir = DirAccess::open("res://");
		if (dir.is_valid()) {
			String relative_dir = dir_path.replace("res://", "");
			if (!dir->dir_exists(relative_dir)) {
				Error mkdir_err = dir->make_dir_recursive(relative_dir);
				if (mkdir_err != OK) {
					result["error"] = "Failed to create directory: " + dir_path;
					result["success"] = false;
					return result;
				}
				print_line("GodotBridge: Created directory: " + dir_path);
			}
		}
	}

	Node *root_node = nullptr;
	
	if (ClassDB::class_exists(p_root_type)) {
		Object *obj = ClassDB::instantiate(p_root_type);
		root_node = Object::cast_to<Node>(obj);
	}
	
	if (!root_node) {
		root_node = memnew(Node2D);
	}
	
	String filename = scene_path.get_file().get_basename();
	if (filename.is_empty()) {
		result["error"] = "Invalid scene path: no filename specified";
		result["success"] = false;
		memdelete(root_node);
		return result;
	}
	root_node->set_name(filename);
	
	Ref<PackedScene> packed_scene;
	packed_scene.instantiate();
	Error pack_err = packed_scene->pack(root_node);
	
	if (pack_err != OK) {
		memdelete(root_node);
		result["error"] = "Failed to pack scene";
		result["success"] = false;
		return result;
	}
	
	Error save_err = ResourceSaver::save(packed_scene, scene_path);
	
	memdelete(root_node);
	
	if (save_err != OK) {
		result["error"] = "Failed to save scene to: " + scene_path;
		result["success"] = false;
	} else {
		result["path"] = scene_path;
		result["root_type"] = p_root_type;
		result["success"] = true;
		print_line("GodotBridge: Scene created successfully: " + scene_path);
		
		// Trigger filesystem rescan to ensure the new file is recognized
		EditorFileSystem::get_singleton()->scan();
		
		// CRITICAL: Open the newly created scene in the editor
		// This ensures the scene_changed event is properly emitted with the correct path,
		// allowing subsequent add_node commands to work correctly
		EditorInterface *editor = EditorInterface::get_singleton();
		if (editor) {
			editor->open_scene_from_path(scene_path);
			print_line("GodotBridge: Opened new scene in editor: " + scene_path);
		}
	}
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	
	return result;
}

Dictionary GodotBridge::add_node(const String &p_parent, const String &p_type, const String &p_name) {
	Dictionary result;
	print_line("GodotBridge: Adding node: " + p_name + " of type " + p_type + " to " + p_parent);
	
#ifdef TOOLS_ENABLED
	Node *parent_node = _get_node_by_path(p_parent);
	
	if (!parent_node) {
		result["error"] = "Parent node not found: " + p_parent;
		result["success"] = false;
		return result;
	}
	
	Node *new_node = nullptr;
	
	if (ClassDB::class_exists(p_type)) {
		Object *obj = ClassDB::instantiate(p_type);
		new_node = Object::cast_to<Node>(obj);
	}
	
	if (!new_node) {
		result["error"] = "Invalid node type: " + p_type;
		result["success"] = false;
		return result;
	}
	
	new_node->set_name(p_name);
	parent_node->add_child(new_node);
	new_node->set_owner(parent_node->get_owner() ? parent_node->get_owner() : parent_node);
	
	result["name"] = new_node->get_name();
	result["type"] = p_type;
	result["path"] = String(new_node->get_path());
	result["success"] = true;
	print_line("GodotBridge: Node added: " + p_name);
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	
	return result;
}

Dictionary GodotBridge::remove_node(const String &p_path) {
	Dictionary result;
	print_line("GodotBridge: Removing node: " + p_path);
	
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_path);
	
	if (!node) {
		result["error"] = "Node not found: " + p_path;
		result["success"] = false;
		return result;
	}
	
	Node *parent = node->get_parent();
	if (parent) {
		parent->remove_child(node);
		memdelete(node);
		result["success"] = true;
		print_line("GodotBridge: Node removed: " + p_path);
	} else {
		result["error"] = "Cannot remove root node";
		result["success"] = false;
	}
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	
	return result;
}

Dictionary GodotBridge::rename_node(const String &p_path, const String &p_new_name) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_path);
	if (!node) {
		result["error"] = "Node not found: " + p_path;
		result["success"] = false;
		return result;
	}
	
	String old_name = node->get_name();
	node->set_name(p_new_name);
	result["old_name"] = old_name;
	result["new_name"] = node->get_name();
	result["success"] = true;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::duplicate_node(const String &p_path) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_path);
	if (!node) {
		result["error"] = "Node not found: " + p_path;
		result["success"] = false;
		return result;
	}
	
	Node *parent = node->get_parent();
	if (!parent) {
		result["error"] = "Cannot duplicate root node";
		result["success"] = false;
		return result;
	}
	
	Node *duplicate = node->duplicate();
	parent->add_child(duplicate, true);
	duplicate->set_owner(parent->get_owner() ? parent->get_owner() : parent);
	
	result["name"] = duplicate->get_name();
	result["path"] = String(duplicate->get_path());
	result["success"] = true;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::move_node(const String &p_path, const String &p_new_parent) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_path);
	if (!node) {
		result["error"] = "Node not found: " + p_path;
		result["success"] = false;
		return result;
	}
	
	Node *new_parent = _get_node_by_path(p_new_parent);
	if (!new_parent) {
		result["error"] = "New parent not found: " + p_new_parent;
		result["success"] = false;
		return result;
	}
	
	Node *old_parent = node->get_parent();
	if (old_parent) {
		old_parent->remove_child(node);
	}
	new_parent->add_child(node, true);
	node->set_owner(new_parent->get_owner() ? new_parent->get_owner() : new_parent);
	
	result["new_path"] = String(node->get_path());
	result["success"] = true;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::get_property(const String &p_node, const String &p_property) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_node);
	if (!node) {
		result["error"] = "Node not found: " + p_node;
		result["success"] = false;
		return result;
	}
	
	Variant value = node->get(p_property);
	result["property"] = p_property;
	result["value"] = value;
	result["success"] = true;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::set_property(const String &p_node, const String &p_property, const Variant &p_value) {
	Dictionary result;
	print_line("GodotBridge: Setting property " + p_property + " on " + p_node + " value type: " + itos(p_value.get_type()));
	
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_node);
	
	if (!node) {
		result["error"] = "Node not found: " + p_node;
		result["success"] = false;
		return result;
	}
	
	// Parse string values into proper Godot types
	Variant converted_value = p_value;
	
	if (p_value.get_type() == Variant::STRING) {
		String str_val = p_value;
		str_val = str_val.strip_edges();
		
		// Vector2 parsing: "Vector2(x, y)" or "(x, y)" or "(x,y)"
		if (str_val.begins_with("Vector2(") || str_val.begins_with("(")) {
			String inner = str_val;
			inner = inner.replace("Vector2(", "").replace("(", "").replace(")", "").strip_edges();
			PackedStringArray parts = inner.split(",");
			if (parts.size() >= 2) {
				float x = parts[0].strip_edges().to_float();
				float y = parts[1].strip_edges().to_float();
				converted_value = Vector2(x, y);
				print_line("GodotBridge: Parsed Vector2(" + rtos(x) + ", " + rtos(y) + ")");
			}
		}
		// Vector3 parsing: "Vector3(x, y, z)"
		else if (str_val.begins_with("Vector3(")) {
			String inner = str_val.replace("Vector3(", "").replace(")", "").strip_edges();
			PackedStringArray parts = inner.split(",");
			if (parts.size() >= 3) {
				float x = parts[0].strip_edges().to_float();
				float y = parts[1].strip_edges().to_float();
				float z = parts[2].strip_edges().to_float();
				converted_value = Vector3(x, y, z);
				print_line("GodotBridge: Parsed Vector3(" + rtos(x) + ", " + rtos(y) + ", " + rtos(z) + ")");
			}
		}
		// Color parsing: "Color(r, g, b)" or "Color(r, g, b, a)" or named colors
		else if (str_val.begins_with("Color(")) {
			String inner = str_val.replace("Color(", "").replace(")", "").strip_edges();
			PackedStringArray parts = inner.split(",");
			if (parts.size() >= 3) {
				float r = parts[0].strip_edges().to_float();
				float g = parts[1].strip_edges().to_float();
				float b = parts[2].strip_edges().to_float();
				float a = (parts.size() >= 4) ? parts[3].strip_edges().to_float() : 1.0f;
				converted_value = Color(r, g, b, a);
				print_line("GodotBridge: Parsed Color(" + rtos(r) + ", " + rtos(g) + ", " + rtos(b) + ", " + rtos(a) + ")");
			}
		}
		// Named color support
		else if (str_val.to_lower() == "skyblue" || str_val.to_lower() == "sky_blue") {
			converted_value = Color(0.529f, 0.808f, 0.922f);
		}
		else if (str_val.to_lower() == "lightblue" || str_val.to_lower() == "light_blue") {
			converted_value = Color(0.678f, 0.847f, 0.902f);
		}
		else if (str_val.to_lower() == "red") {
			converted_value = Color(1.0f, 0.0f, 0.0f);
		}
		else if (str_val.to_lower() == "green") {
			converted_value = Color(0.0f, 1.0f, 0.0f);
		}
		else if (str_val.to_lower() == "blue") {
			converted_value = Color(0.0f, 0.0f, 1.0f);
		}
		else if (str_val.to_lower() == "white") {
			converted_value = Color(1.0f, 1.0f, 1.0f);
		}
		else if (str_val.to_lower() == "black") {
			converted_value = Color(0.0f, 0.0f, 0.0f);
		}
		// Boolean parsing
		else if (str_val.to_lower() == "true") {
			converted_value = true;
		}
		else if (str_val.to_lower() == "false") {
			converted_value = false;
		}
		// Try to load as resource path
		else if (str_val.begins_with("res://")) {
			Ref<Resource> res = ResourceLoader::load(str_val);
			if (res.is_valid()) {
				converted_value = res;
				print_line("GodotBridge: Loaded resource: " + str_val);
			}
		}
	}
	// Handle Dictionary with x/y keys as Vector2
	else if (p_value.get_type() == Variant::DICTIONARY) {
		Dictionary dict = p_value;
		if (dict.has("x") && dict.has("y")) {
			float x = dict["x"];
			float y = dict["y"];
			if (dict.has("z")) {
				float z = dict["z"];
				converted_value = Vector3(x, y, z);
			} else {
				converted_value = Vector2(x, y);
			}
			print_line("GodotBridge: Converted dict to Vector2/3");
		}
	}
	
	// Get original value to verify change
	Variant old_value = node->get(p_property);
	
	// Set the property
	node->set(p_property, converted_value);
	
	// Verify the value was actually set
	Variant new_value = node->get(p_property);
	bool value_changed = (old_value != new_value);
	
	result["node"] = p_node;
	result["property"] = p_property;
	result["old_value"] = old_value;
	result["new_value"] = new_value;
	result["success"] = true;
	
	if (!value_changed && converted_value != old_value) {
		print_line("GodotBridge: WARNING - Property set may have failed! Value unchanged from " + String(old_value));
		result["warning"] = "Value may not have been set correctly";
	}
	
	print_line("GodotBridge: Property set complete. Old: " + String(old_value) + " New: " + String(new_value));
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	
	return result;
}


Dictionary GodotBridge::save_scene(const String &p_path) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	EditorInterface *editor = EditorInterface::get_singleton();
	if (!editor) {
		result["error"] = "EditorInterface not available";
		result["success"] = false;
		return result;
	}
	
	Node *scene_root = editor->get_edited_scene_root();
	if (!scene_root) {
		result["error"] = "No scene open";
		result["success"] = false;
		return result;
	}
	
	String save_path = p_path.is_empty() ? scene_root->get_scene_file_path() : p_path;
	if (save_path.is_empty()) {
		result["error"] = "No path specified and scene has no file path";
		result["success"] = false;
		return result;
	}
	
	Ref<PackedScene> packed_scene;
	packed_scene.instantiate();
	packed_scene->pack(scene_root);
	Error err = ResourceSaver::save(packed_scene, save_path);
	
	if (err == OK) {
		result["path"] = save_path;
		result["success"] = true;
	} else {
		result["error"] = "Failed to save scene";
		result["success"] = false;
	}
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::open_scene(const String &p_path) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	EditorInterface *editor = EditorInterface::get_singleton();
	if (!editor) {
		result["error"] = "EditorInterface not available";
		result["success"] = false;
		return result;
	}
	
	editor->open_scene_from_path(p_path);
	result["path"] = p_path;
	result["success"] = true;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::run_game(const String &p_scene) {
	Dictionary result;
	print_line("GodotBridge: Running game" + (p_scene.is_empty() ? "" : " with scene: " + p_scene));
	
#ifdef TOOLS_ENABLED
	EditorInterface *editor = EditorInterface::get_singleton();
	if (!editor) {
		result["error"] = "EditorInterface not available";
		result["success"] = false;
		return result;
	}
	
	if (p_scene.is_empty()) {
		editor->play_main_scene();
	} else {
		editor->play_custom_scene(p_scene);
	}
	
	result["success"] = true;
	result["scene"] = p_scene.is_empty() ? "main" : p_scene;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	
	return result;
}

Dictionary GodotBridge::stop_game() {
	Dictionary result;
	print_line("GodotBridge: Stopping game");
	
#ifdef TOOLS_ENABLED
	EditorInterface *editor = EditorInterface::get_singleton();
	if (!editor) {
		result["error"] = "EditorInterface not available";
		result["success"] = false;
		return result;
	}
	
	editor->stop_playing_scene();
	result["success"] = true;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	
	return result;
}

// ============ Extended Scene Commands ============

Dictionary GodotBridge::list_scenes() {
	Dictionary result;
	Array scenes;
	
	// List all .tscn files in res://
	Ref<DirAccess> dir = DirAccess::open("res://");
	if (dir.is_valid()) {
		dir->list_dir_begin();
		String file_name = dir->get_next();
		while (!file_name.is_empty()) {
			if (file_name.ends_with(".tscn")) {
				scenes.push_back("res://" + file_name);
			}
			file_name = dir->get_next();
		}
		dir->list_dir_end();
	}
	
	result["scenes"] = scenes;
	result["count"] = scenes.size();
	result["success"] = true;
	return result;
}

Dictionary GodotBridge::get_node_info(const String &p_path) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_path);
	if (!node) {
		result["error"] = "Node not found: " + p_path;
		result["success"] = false;
		return result;
	}
	
	result["name"] = node->get_name();
	result["type"] = node->get_class();
	result["path"] = String(node->get_path());
	result["child_count"] = node->get_child_count();
	
	// Get properties
	Array properties;
	List<PropertyInfo> prop_list;
	node->get_property_list(&prop_list);
	for (const PropertyInfo &prop : prop_list) {
		if (prop.usage & PROPERTY_USAGE_EDITOR) {
			Dictionary prop_info;
			prop_info["name"] = prop.name;
			prop_info["type"] = Variant::get_type_name(prop.type);
			prop_info["value"] = node->get(prop.name);
			properties.push_back(prop_info);
		}
	}
	result["properties"] = properties;
	result["success"] = true;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::copy_node(const String &p_from, const String &p_to_scene) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_from);
	if (!node) {
		result["error"] = "Node not found: " + p_from;
		result["success"] = false;
		return result;
	}
	
	Node *duplicate = node->duplicate();
	result["name"] = duplicate->get_name();
	result["type"] = duplicate->get_class();
	result["success"] = true;
	result["note"] = "Node copied - use add_node to place it";
	
	// For now, just create a copy in memory
	// Full implementation would add to target scene
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::get_open_scenes() {
	Dictionary result;
#ifdef TOOLS_ENABLED
	EditorInterface *editor = EditorInterface::get_singleton();
	if (!editor) {
		result["error"] = "EditorInterface not available";
		result["success"] = false;
		return result;
	}
	
	Array open_scenes;
	PackedStringArray scenes = editor->get_open_scenes();
	
	for (int i = 0; i < scenes.size(); i++) {
		Dictionary scene_info;
		scene_info["path"] = scenes[i];
		scene_info["index"] = i;
		open_scenes.push_back(scene_info);
	}
	
	result["scenes"] = open_scenes;
	result["count"] = open_scenes.size();
	result["success"] = true;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

// ============ Scene Persistence Commands ============

Dictionary GodotBridge::set_owner_recursive(const String &p_node) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_node);
	if (!node) {
		result["error"] = "Node not found: " + p_node;
		result["success"] = false;
		return result;
	}
	
	Node *root = EditorInterface::get_singleton()->get_edited_scene_root();
	if (!root) {
		result["error"] = "No scene root";
		result["success"] = false;
		return result;
	}
	
	// Recursively set owner
	int count = 0;
	Vector<Node *> nodes_to_process;
	nodes_to_process.push_back(node);
	
	while (nodes_to_process.size() > 0) {
		Node *current = nodes_to_process[0];
		nodes_to_process.remove_at(0);
		
		if (current != root) {
			current->set_owner(root);
			count++;
		}
		
		for (int i = 0; i < current->get_child_count(); i++) {
			nodes_to_process.push_back(current->get_child(i));
		}
	}
	
	result["node"] = p_node;
	result["nodes_updated"] = count;
	result["success"] = true;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::scene_pack(const String &p_node, const String &p_output_path) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_node);
	if (!node) {
		result["error"] = "Node not found: " + p_node;
		result["success"] = false;
		return result;
	}
	
	// Set owner recursively to the node being packed
	Vector<Node *> nodes_to_process;
	nodes_to_process.push_back(node);
	
	while (nodes_to_process.size() > 0) {
		Node *current = nodes_to_process[0];
		nodes_to_process.remove_at(0);
		
		// Set owner to the node being packed (for it to be saved properly)
		if (current != node) {
			current->set_owner(node);
		}
		
		for (int i = 0; i < current->get_child_count(); i++) {
			nodes_to_process.push_back(current->get_child(i));
		}
	}
	
	// Pack the scene
	Ref<PackedScene> packed;
	packed.instantiate();
	Error pack_err = packed->pack(node);
	
	if (pack_err != OK) {
		result["error"] = "Failed to pack node";
		result["success"] = false;
		return result;
	}
	
	// Save to file
	Error save_err = ResourceSaver::save(packed, p_output_path);
	if (save_err == OK) {
		result["node"] = p_node;
		result["output_path"] = p_output_path;
		result["success"] = true;
	} else {
		result["error"] = "Failed to save packed scene";
		result["success"] = false;
	}
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::scene_instantiate(const String &p_scene_path, const String &p_parent) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	// Load the scene
	Ref<PackedScene> scene = ResourceLoader::load(p_scene_path);
	if (!scene.is_valid()) {
		result["error"] = "Failed to load scene: " + p_scene_path;
		result["success"] = false;
		return result;
	}
	
	// Get parent
	Node *parent;
	if (p_parent.is_empty()) {
		parent = EditorInterface::get_singleton()->get_edited_scene_root();
	} else {
		parent = _get_node_by_path(p_parent);
	}
	
	if (!parent) {
		result["error"] = "Parent not found: " + p_parent;
		result["success"] = false;
		return result;
	}
	
	// Instantiate
	Node *instance = scene->instantiate();
	if (!instance) {
		result["error"] = "Failed to instantiate scene";
		result["success"] = false;
		return result;
	}
	
	parent->add_child(instance);
	instance->set_owner(EditorInterface::get_singleton()->get_edited_scene_root());
	
	result["scene_path"] = p_scene_path;
	result["parent"] = String(parent->get_path());
	result["instance_name"] = instance->get_name();
	result["instance_path"] = String(instance->get_path());
	result["success"] = true;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::reparent_node(const String &p_node, const String &p_new_parent) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_node);
	if (!node) {
		result["error"] = "Node not found: " + p_node;
		result["success"] = false;
		return result;
	}
	
	Node *new_parent;
	if (p_new_parent.is_empty()) {
		new_parent = EditorInterface::get_singleton()->get_edited_scene_root();
	} else {
		new_parent = _get_node_by_path(p_new_parent);
	}
	
	if (!new_parent) {
		result["error"] = "New parent not found: " + p_new_parent;
		result["success"] = false;
		return result;
	}
	
	if (node == new_parent) {
		result["error"] = "Cannot reparent node to itself";
		result["success"] = false;
		return result;
	}
	
	// Store global transform for 2D/3D nodes to maintain world position
	Node *old_parent = node->get_parent();
	String old_path = String(node->get_path());
	
	// Reparent with keep_global_transform = true (Godot 4.x)
	node->reparent(new_parent, true);
	
	result["node"] = old_path;
	result["old_parent"] = String(old_parent->get_path());
	result["new_parent"] = String(new_parent->get_path());
	result["new_path"] = String(node->get_path());
	result["success"] = true;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

// ============ Phase 17: Critical Tool Gap Fixes ============

Dictionary GodotBridge::set_collision_shape(const String &p_node, const String &p_shape_type, const Dictionary &p_size) {
	Dictionary result;
	print_line("GodotBridge: Setting collision shape on " + p_node + " type: " + p_shape_type);
	
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_node);
	if (!node) {
		result["error"] = "Node not found: " + p_node;
		result["success"] = false;
		return result;
	}
	
	// Check if it's a CollisionShape2D or CollisionShape3D
	CollisionShape2D *shape_2d = Object::cast_to<CollisionShape2D>(node);
	CollisionShape3D *shape_3d = Object::cast_to<CollisionShape3D>(node);
	
	if (!shape_2d && !shape_3d) {
		result["error"] = "Node is not a CollisionShape2D or CollisionShape3D: " + p_node;
		result["success"] = false;
		return result;
	}
	
	if (shape_2d) {
		// Create 2D shape
		Ref<Shape2D> shape;
		
		if (p_shape_type == "rectangle") {
			Ref<RectangleShape2D> rect;
			rect.instantiate();
			float width = p_size.get("width", 32.0);
			float height = p_size.get("height", 32.0);
			print_line("GodotBridge: Rectangle collision - width=" + String::num(width) + " height=" + String::num(height));
			rect->set_size(Vector2(width, height));
			shape = rect;
		} else if (p_shape_type == "circle") {
			Ref<CircleShape2D> circle;
			circle.instantiate();
			float radius = p_size.get("radius", 16.0);
			circle->set_radius(radius);
			shape = circle;
		} else if (p_shape_type == "capsule") {
			Ref<CapsuleShape2D> capsule;
			capsule.instantiate();
			float radius = p_size.get("radius", 16.0);
			float height = p_size.get("height", 32.0);
			capsule->set_radius(radius);
			capsule->set_height(height);
			shape = capsule;
		} else if (p_shape_type == "segment") {
			Ref<SegmentShape2D> segment;
			segment.instantiate();
			segment->set_a(Vector2(0, 0));
			float length = p_size.get("length", 100.0);
			segment->set_b(Vector2(length, 0));
			shape = segment;
		} else {
			result["error"] = "Unknown 2D shape type: " + p_shape_type;
			result["success"] = false;
			return result;
		}
		
		shape_2d->set_shape(shape);
		result["node"] = p_node;
		result["shape_type"] = p_shape_type;
		result["success"] = true;
		print_line("GodotBridge: Set 2D collision shape: " + p_shape_type);
	} else if (shape_3d) {
		// Create 3D shape
		Ref<Shape3D> shape;
		
		if (p_shape_type == "box" || p_shape_type == "rectangle") {
			Ref<BoxShape3D> box;
			box.instantiate();
			float width = p_size.get("width", 1.0);
			float height = p_size.get("height", 1.0);
			float depth = p_size.get("depth", 1.0);
			box->set_size(Vector3(width, height, depth));
			shape = box;
		} else if (p_shape_type == "sphere" || p_shape_type == "circle") {
			Ref<SphereShape3D> sphere;
			sphere.instantiate();
			float radius = p_size.get("radius", 0.5);
			sphere->set_radius(radius);
			shape = sphere;
		} else if (p_shape_type == "capsule") {
			Ref<CapsuleShape3D> capsule;
			capsule.instantiate();
			float radius = p_size.get("radius", 0.5);
			float height = p_size.get("height", 1.0);
			capsule->set_radius(radius);
			capsule->set_height(height);
			shape = capsule;
		} else {
			result["error"] = "Unknown 3D shape type: " + p_shape_type;
			result["success"] = false;
			return result;
		}
		
		shape_3d->set_shape(shape);
		result["node"] = p_node;
		result["shape_type"] = p_shape_type;
		result["success"] = true;
		print_line("GodotBridge: Set 3D collision shape: " + p_shape_type);
	}
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::attach_script(const String &p_node, const String &p_script_path) {
	Dictionary result;
	print_line("GodotBridge: Attaching script " + p_script_path + " to " + p_node);
	
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_node);
	if (!node) {
		result["error"] = "Node not found: " + p_node;
		result["success"] = false;
		return result;
	}
	
	// Load the script
	Ref<Script> script = ResourceLoader::load(p_script_path);
	if (!script.is_valid()) {
		result["error"] = "Failed to load script: " + p_script_path;
		result["success"] = false;
		return result;
	}
	
	// Attach the script
	node->set_script(script);
	
	result["node"] = p_node;
	result["script_path"] = p_script_path;
	result["success"] = true;
	print_line("GodotBridge: Script attached successfully");
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::get_sprite_dimensions(const String &p_node) {
	Dictionary result;
	print_line("GodotBridge: Getting sprite dimensions for " + p_node);
	
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_node);
	if (!node) {
		result["error"] = "Node not found: " + p_node;
		result["success"] = false;
		return result;
	}
	
	// Check for AnimatedSprite2D
	if (node->get_class() == "AnimatedSprite2D") {
		// Get sprite_frames property
		Ref<Resource> sprite_frames = node->get("sprite_frames");
		if (sprite_frames.is_valid()) {
			String animation = node->get("animation");
			// Try to get frame texture
			if (sprite_frames->has_method("get_frame_texture")) {
				Ref<Texture2D> tex = sprite_frames->call("get_frame_texture", animation, 0);
				if (tex.is_valid()) {
					result["frame_width"] = tex->get_width();
					result["frame_height"] = tex->get_height();
					result["animation"] = animation;
					result["success"] = true;
					print_line("GodotBridge: AnimatedSprite2D dimensions: " + itos(tex->get_width()) + "x" + itos(tex->get_height()));
					return result;
				}
			}
		}
		result["error"] = "Could not get frame texture from AnimatedSprite2D";
		result["success"] = false;
		return result;
	}
	
	// Check for Sprite2D
	if (node->get_class() == "Sprite2D") {
		Ref<Texture2D> tex = node->get("texture");
		if (tex.is_valid()) {
			result["frame_width"] = tex->get_width();
			result["frame_height"] = tex->get_height();
			result["success"] = true;
			print_line("GodotBridge: Sprite2D dimensions: " + itos(tex->get_width()) + "x" + itos(tex->get_height()));
			return result;
		}
		result["error"] = "Sprite2D has no texture";
		result["success"] = false;
		return result;
	}
	
	result["error"] = "Node is not a Sprite2D or AnimatedSprite2D: " + node->get_class();
	result["success"] = false;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}
