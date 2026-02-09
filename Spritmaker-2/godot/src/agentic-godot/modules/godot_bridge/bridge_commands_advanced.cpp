// bridge_commands_advanced.cpp
// Advanced commands: Agent capabilities, TileMap, Navigation, Build Pipeline, Agentic AI

#include "godot_bridge.h"
#include "core/os/time.h"
#include "core/io/resource_saver.h"
#include "core/io/resource_loader.h"
#include "core/io/marshalls.h"
#include "core/crypto/crypto_core.h"
#include "scene/resources/2d/tile_set.h"
#include "scene/2d/tile_map.h"
#include "scene/2d/tile_map_layer.h"
#include "scene/2d/navigation_region_2d.h"
#include "scene/3d/navigation_region_3d.h"
#include "scene/resources/sprite_frames.h"
#include "scene/resources/atlas_texture.h"

#include "scene/gui/code_edit.h"

#ifdef TOOLS_ENABLED
#include "editor/editor_interface.h"
#include "editor/editor_data.h"
#include "editor/editor_node.h"
#include "editor/export/editor_export.h"
#include "editor/plugins/script_editor_plugin.h"
#include "editor/filesystem_dock.h"
#endif

// ============ Phase 10: Enhanced Agent Capabilities ============

Dictionary GodotBridge::undo_last_action() {
	Dictionary result;
	
	if (action_history.size() == 0) {
		result["error"] = "No actions to undo";
		result["success"] = false;
		return result;
	}
	
	Dictionary last_action = action_history[action_history.size() - 1];
	action_history.remove_at(action_history.size() - 1);
	
	result["undone_action"] = last_action;
	result["remaining_history"] = action_history.size();
	result["success"] = true;
	result["message"] = "Action history tracking enabled. Full undo implementation pending.";
	
	return result;
}

Dictionary GodotBridge::get_selected_nodes() {
	Dictionary result;
	
#ifdef TOOLS_ENABLED
	EditorInterface *editor = EditorInterface::get_singleton();
	if (!editor) {
		result["error"] = "EditorInterface not available";
		result["success"] = false;
		return result;
	}
	
	EditorSelection *selection = editor->get_selection();
	if (!selection) {
		result["error"] = "EditorSelection not available";
		result["success"] = false;
		return result;
	}
	
	Array selected_nodes;
	TypedArray<Node> nodes = selection->get_selected_nodes();
	
	for (int i = 0; i < nodes.size(); i++) {
		Node *node = Object::cast_to<Node>(nodes[i]);
		if (node) {
			Dictionary node_info;
			node_info["name"] = node->get_name();
			node_info["type"] = node->get_class();
			node_info["path"] = String(node->get_path());
			selected_nodes.push_back(node_info);
		}
	}
	
	result["nodes"] = selected_nodes;
	result["count"] = selected_nodes.size();
	result["success"] = true;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	
	return result;
}

Dictionary GodotBridge::get_selected_text() {
	Dictionary result;
	
#ifdef TOOLS_ENABLED
	ScriptEditor *script_editor = ScriptEditor::get_singleton();
	if (!script_editor) {
		result["error"] = "ScriptEditor not available";
		result["success"] = false;
		return result;
	}
	
	ScriptEditorBase *current = script_editor->_get_current_editor();
	if (!current) {
		result["error"] = "No script currently open";
		result["success"] = false;
		return result;
	}
	
	// Get the current script path
	Ref<Script> script = script_editor->_get_current_script();
	if (script.is_valid()) {
		result["script_path"] = script->get_path();
	}
	
	// Get text selection via the CodeTextEditor
	Control *base = current->get_base_editor();
	CodeEdit *code_edit = Object::cast_to<CodeEdit>(base);
	
	if (code_edit) {
		if (code_edit->has_selection()) {
			result["has_selection"] = true;
			result["selected_text"] = code_edit->get_selected_text();
			result["selection_from_line"] = code_edit->get_selection_from_line();
			result["selection_to_line"] = code_edit->get_selection_to_line();
			result["selection_from_column"] = code_edit->get_selection_from_column();
			result["selection_to_column"] = code_edit->get_selection_to_column();
		} else {
			result["has_selection"] = false;
			result["cursor_line"] = code_edit->get_caret_line();
			result["cursor_column"] = code_edit->get_caret_column();
			// Return the current line content
			int line = code_edit->get_caret_line();
			result["current_line"] = code_edit->get_line(line);
		}
		result["success"] = true;
	} else {
		result["error"] = "Could not access code editor";
		result["success"] = false;
	}
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	
	return result;
}

Dictionary GodotBridge::get_selected_files() {
	Dictionary result;
	
#ifdef TOOLS_ENABLED
	FileSystemDock *fs_dock = FileSystemDock::get_singleton();
	if (!fs_dock) {
		result["error"] = "FileSystemDock not available";
		result["success"] = false;
		return result;
	}
	
	Vector<String> selected = fs_dock->get_selected_paths();
	
	Array files;
	Array folders;
	
	for (int i = 0; i < selected.size(); i++) {
		String path = selected[i];
		if (path.ends_with("/")) {
			folders.push_back(path);
		} else {
			files.push_back(path);
		}
	}
	
	result["files"] = files;
	result["folders"] = folders;
	result["total_count"] = selected.size();
	result["success"] = true;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	
	return result;
}

Dictionary GodotBridge::start_plan(const String &p_name, const Array &p_steps) {
	Dictionary result;
	
	current_plan = Dictionary();
	current_plan["name"] = p_name;
	current_plan["created_at"] = Time::get_singleton()->get_datetime_string_from_system();
	
	Array steps;
	for (int i = 0; i < p_steps.size(); i++) {
		Dictionary step;
		step["index"] = i;
		step["status"] = "pending";

		Variant raw_step = p_steps[i];
		if (raw_step.get_type() == Variant::DICTIONARY) {
			Dictionary incoming = raw_step;
			String description = String(incoming.get("description", ""));
			if (description.is_empty()) {
				description = String(incoming.get("type", incoming.get("name", "Step " + itos(i + 1))));
			}

			step["description"] = description;
			step["status"] = String(incoming.get("status", "pending"));

			if (incoming.has("name")) {
				step["name"] = incoming["name"];
			}
			if (incoming.has("type")) {
				step["type"] = incoming["type"];
			}
			if (incoming.has("agent")) {
				step["agent"] = incoming["agent"];
			}
		} else {
			step["description"] = raw_step;
		}

		steps.push_back(step);
	}
	current_plan["steps"] = steps;
	current_plan["current_step"] = 0;
	
	result["plan"] = current_plan;
	result["success"] = true;
	
	return result;
}

Dictionary GodotBridge::update_plan(int p_step_index, const String &p_status) {
	Dictionary result;
	
	if (!current_plan.has("steps")) {
		result["error"] = "No active plan. Call start_plan first.";
		result["success"] = false;
		return result;
	}
	
	Array steps = current_plan["steps"];
	if (p_step_index < 0 || p_step_index >= steps.size()) {
		result["error"] = "Invalid step index: " + itos(p_step_index);
		result["success"] = false;
		return result;
	}
	
	Dictionary step = steps[p_step_index];
	step["status"] = p_status;
	steps[p_step_index] = step;
	current_plan["steps"] = steps;
	
	if (p_status == "completed" && p_step_index == (int)current_plan["current_step"]) {
		current_plan["current_step"] = p_step_index + 1;
	}
	
	result["updated_step"] = step;
	result["plan"] = current_plan;
	result["success"] = true;

	// Broadcast event for UI update when step state changes.
	broadcast_event("plan_updated", current_plan);
	
	return result;
}

// ============ Phase 13: TileMap & Navigation ============

Dictionary GodotBridge::tileset_create_atlas(const String &p_tileset_path, const String &p_texture_path, int p_tile_size) {
	Dictionary result;
	
	Ref<TileSet> tileset;
	if (ResourceLoader::exists(p_tileset_path)) {
		tileset = ResourceLoader::load(p_tileset_path);
	} else {
		tileset.instantiate();
	}
	
	if (!tileset.is_valid()) {
		result["error"] = "Failed to create TileSet";
		result["success"] = false;
		return result;
	}
	
	Ref<Texture2D> texture = ResourceLoader::load(p_texture_path);
	if (!texture.is_valid()) {
		result["error"] = "Failed to load texture: " + p_texture_path;
		result["success"] = false;
		return result;
	}
	
	Ref<TileSetAtlasSource> atlas;
	atlas.instantiate();
	atlas->set_texture(texture);
	atlas->set_texture_region_size(Vector2i(p_tile_size, p_tile_size));
	
	Vector2i tex_size = texture->get_size();
	int cols = tex_size.x / p_tile_size;
	int rows = tex_size.y / p_tile_size;
	int tile_count = 0;
	
	for (int y = 0; y < rows; y++) {
		for (int x = 0; x < cols; x++) {
			atlas->create_tile(Vector2i(x, y));
			tile_count++;
		}
	}
	
	int source_id = tileset->add_source(atlas);
	
	Error err = ResourceSaver::save(tileset, p_tileset_path);
	if (err == OK) {
		result["tileset_path"] = p_tileset_path;
		result["texture_path"] = p_texture_path;
		result["tile_size"] = p_tile_size;
		result["source_id"] = source_id;
		result["tile_count"] = tile_count;
		result["cols"] = cols;
		result["rows"] = rows;
		result["success"] = true;
	} else {
		result["error"] = "Failed to save TileSet";
		result["success"] = false;
	}
	
	return result;
}

Dictionary GodotBridge::map_set_cells_batch(const String &p_tilemap, const Array &p_cells) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_tilemap);
	if (!node) {
		result["error"] = "TileMap not found: " + p_tilemap;
		result["success"] = false;
		return result;
	}
	
	TileMapLayer *tilemap_layer = Object::cast_to<TileMapLayer>(node);
	TileMap *tilemap = Object::cast_to<TileMap>(node);
	
	int cells_set = 0;
	
	if (tilemap_layer) {
		for (int i = 0; i < p_cells.size(); i++) {
			Dictionary cell = p_cells[i];
			Vector2i coords = cell.get("coords", Vector2i());
			int source_id = cell.get("source_id", 0);
			Vector2i atlas_coords = cell.get("atlas_coords", Vector2i());
			int alternative = cell.get("alternative", 0);
			
			tilemap_layer->set_cell(coords, source_id, atlas_coords, alternative);
			cells_set++;
		}
	} else if (tilemap) {
		int layer = 0;
		for (int i = 0; i < p_cells.size(); i++) {
			Dictionary cell = p_cells[i];
			Vector2i coords = cell.get("coords", Vector2i());
			int source_id = cell.get("source_id", 0);
			Vector2i atlas_coords = cell.get("atlas_coords", Vector2i());
			int alternative = cell.get("alternative", 0);
			
			tilemap->set_cell(layer, coords, source_id, atlas_coords, alternative);
			cells_set++;
		}
	} else {
		result["error"] = "Node is not a TileMap or TileMapLayer";
		result["success"] = false;
		return result;
	}
	
	result["tilemap"] = p_tilemap;
	result["cells_set"] = cells_set;
	result["success"] = true;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::navmesh_bake(const String &p_region) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_region);
	if (!node) {
		result["error"] = "NavigationRegion not found: " + p_region;
		result["success"] = false;
		return result;
	}
	
	NavigationRegion3D *region_3d = Object::cast_to<NavigationRegion3D>(node);
	NavigationRegion2D *region_2d = Object::cast_to<NavigationRegion2D>(node);
	
	if (region_3d) {
		region_3d->bake_navigation_mesh(true);
		result["region"] = p_region;
		result["type"] = "3D";
		result["success"] = true;
		result["message"] = "Bake initiated. Connect to 'bake_finished' signal for completion.";
	} else if (region_2d) {
		region_2d->bake_navigation_polygon(true);
		result["region"] = p_region;
		result["type"] = "2D";
		result["success"] = true;
		result["message"] = "Bake initiated for 2D navigation.";
	} else {
		result["error"] = "Node is not a NavigationRegion2D or NavigationRegion3D";
		result["success"] = false;
	}
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::map_clear_layer(const String &p_tilemap) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_tilemap);
	if (!node) {
		result["error"] = "TileMapLayer not found: " + p_tilemap;
		result["success"] = false;
		return result;
	}
	
	TileMapLayer *tilemap_layer = Object::cast_to<TileMapLayer>(node);
	TileMap *tilemap = Object::cast_to<TileMap>(node);
	
	if (tilemap_layer) {
		tilemap_layer->clear();
		result["tilemap"] = p_tilemap;
		result["success"] = true;
		result["message"] = "TileMapLayer cleared";
	} else if (tilemap) {
		tilemap->clear();
		result["tilemap"] = p_tilemap;
		result["success"] = true;
		result["message"] = "TileMap cleared (all layers)";
	} else {
		result["error"] = "Node is not a TileMap or TileMapLayer";
		result["success"] = false;
	}
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::map_fill_rect(const String &p_tilemap, int p_start_x, int p_start_y, int p_width, int p_height, int p_source, int p_atlas_x, int p_atlas_y) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_tilemap);
	if (!node) {
		result["error"] = "TileMapLayer not found: " + p_tilemap;
		result["success"] = false;
		return result;
	}
	
	TileMapLayer *tilemap_layer = Object::cast_to<TileMapLayer>(node);
	TileMap *tilemap = Object::cast_to<TileMap>(node);
	
	int cells_set = 0;
	Vector2i atlas_coords(p_atlas_x, p_atlas_y);
	
	if (tilemap_layer) {
		for (int y = p_start_y; y < p_start_y + p_height; y++) {
			for (int x = p_start_x; x < p_start_x + p_width; x++) {
				tilemap_layer->set_cell(Vector2i(x, y), p_source, atlas_coords, 0);
				cells_set++;
			}
		}
		result["tilemap"] = p_tilemap;
		result["cells_set"] = cells_set;
		result["rect"] = Rect2i(p_start_x, p_start_y, p_width, p_height);
		result["success"] = true;
	} else if (tilemap) {
		int layer = 0;
		for (int y = p_start_y; y < p_start_y + p_height; y++) {
			for (int x = p_start_x; x < p_start_x + p_width; x++) {
				tilemap->set_cell(layer, Vector2i(x, y), p_source, atlas_coords, 0);
				cells_set++;
			}
		}
		result["tilemap"] = p_tilemap;
		result["cells_set"] = cells_set;
		result["rect"] = Rect2i(p_start_x, p_start_y, p_width, p_height);
		result["success"] = true;
	} else {
		result["error"] = "Node is not a TileMap or TileMapLayer";
		result["success"] = false;
	}
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}


// ============ Phase 14: Build Pipeline ============

Dictionary GodotBridge::build_execute(const String &p_preset, const String &p_output_path) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	Ref<EditorExportPreset> preset;
	
	for (int i = 0; i < EditorExport::get_singleton()->get_export_preset_count(); i++) {
		Ref<EditorExportPreset> p = EditorExport::get_singleton()->get_export_preset(i);
		if (p->get_name() == p_preset) {
			preset = p;
			break;
		}
	}
	
	if (!preset.is_valid()) {
		result["error"] = "Export preset not found: " + p_preset;
		Array available;
		for (int i = 0; i < EditorExport::get_singleton()->get_export_preset_count(); i++) {
			available.push_back(EditorExport::get_singleton()->get_export_preset(i)->get_name());
		}
		result["available_presets"] = available;
		result["success"] = false;
		return result;
	}
	
	result["preset"] = p_preset;
	result["output_path"] = p_output_path;
	result["platform"] = preset->get_platform()->get_name();
	result["export_command"] = "godot --headless --export-release \"" + p_preset + "\" " + p_output_path;
	result["success"] = true;
	result["note"] = "Use the export_command in terminal to build.";
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::build_verify() {
	Dictionary result;
#ifdef TOOLS_ENABLED
	Array presets;
	
	for (int i = 0; i < EditorExport::get_singleton()->get_export_preset_count(); i++) {
		Ref<EditorExportPreset> preset = EditorExport::get_singleton()->get_export_preset(i);
		Dictionary preset_info;
		preset_info["name"] = preset->get_name();
		preset_info["platform"] = preset->get_platform()->get_name();
		preset_info["runnable"] = preset->is_runnable();
		preset_info["export_path"] = preset->get_export_path();
		presets.push_back(preset_info);
	}
	
	result["presets"] = presets;
	result["preset_count"] = presets.size();
	result["success"] = true;
	
	if (presets.size() == 0) {
		result["warning"] = "No export presets configured.";
	}
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

// ============ Phase 15: Agentic AI Commands ============

Dictionary GodotBridge::set_current_plan(const String &p_name, const Array &p_steps) {
	Dictionary result;
	
	current_plan = Dictionary();
	current_plan["name"] = p_name;
	current_plan["created_at"] = Time::get_singleton()->get_datetime_string_from_system();
	
	Array steps;
	for (int i = 0; i < p_steps.size(); i++) {
		Dictionary step;
		step["index"] = i;
		step["status"] = "pending";

		Variant raw_step = p_steps[i];
		if (raw_step.get_type() == Variant::DICTIONARY) {
			Dictionary incoming = raw_step;
			String description = String(incoming.get("description", ""));
			if (description.is_empty()) {
				description = String(incoming.get("type", incoming.get("name", "Step " + itos(i + 1))));
			}
			step["description"] = description;
			step["status"] = String(incoming.get("status", "pending"));
			if (incoming.has("name")) step["name"] = incoming["name"];
			if (incoming.has("type")) step["type"] = incoming["type"];
			if (incoming.has("agent")) step["agent"] = incoming["agent"];
		} else {
			step["description"] = raw_step;
		}

		steps.push_back(step);
	}
	current_plan["steps"] = steps;
	current_plan["current_step"] = 0;
	
	result["plan"] = current_plan;
	result["success"] = true;
	result["message"] = "Task plan set: " + p_name;
	
	// Broadcast event for UI update
	broadcast_event("plan_updated", current_plan);
	
	return result;
}

Dictionary GodotBridge::add_diff_entry(const String &p_file, const String &p_status) {
	Dictionary result;
	
	Dictionary entry;
	entry["file"] = p_file;
	entry["status"] = p_status;
	entry["timestamp"] = Time::get_singleton()->get_datetime_string_from_system();
	
	result["entry"] = entry;
	result["success"] = true;
	
	// Broadcast for UI update
	broadcast_event("diff_entry_added", entry);
	
	return result;
}

Dictionary GodotBridge::clear_diff_entries() {
	Dictionary result;
	result["success"] = true;
	result["message"] = "Diff entries cleared";
	
	broadcast_event("diff_entries_cleared", Dictionary());
	
	return result;
}

Dictionary GodotBridge::capture_viewport(const String &p_save_path, const String &p_viewport) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	EditorInterface *editor = EditorInterface::get_singleton();
	if (!editor) {
		result["error"] = "EditorInterface not available";
		result["success"] = false;
		return result;
	}
	
	// Get the appropriate viewport
	Viewport *viewport = nullptr;
	if (p_viewport == "editor") {
		viewport = editor->get_editor_viewport_2d();
	} else if (p_viewport == "game") {
		// Get the game preview viewport if available
		viewport = editor->get_edited_scene_root() ? editor->get_edited_scene_root()->get_viewport() : nullptr;
	}
	
	if (!viewport) {
		result["error"] = "Could not get viewport: " + p_viewport;
		result["success"] = false;
		return result;
	}
	
	// Capture the viewport texture
	Ref<Image> img = viewport->get_texture()->get_image();
	if (!img.is_valid()) {
		result["error"] = "Failed to capture viewport image";
		result["success"] = false;
		return result;
	}
	
	// Check if we should return base64 or save to file
	if (p_save_path.is_empty() || p_save_path == "base64") {
		// Return base64-encoded PNG data for AI vision
		Vector<uint8_t> png_data = img->save_png_to_buffer();
		if (png_data.size() > 0) {
			result["image_base64"] = CryptoCore::b64_encode_str(png_data.ptr(), png_data.size());
			result["viewport"] = p_viewport;
			result["width"] = img->get_width();
			result["height"] = img->get_height();
			result["success"] = true;
			print_line("[GodotBridge] Captured viewport as base64 (" + itos(png_data.size()) + " bytes)");
		} else {
			result["error"] = "Failed to encode image to PNG";
			result["success"] = false;
		}
	} else {
		// Save the image to file (original behavior)
		Error err = img->save_png(p_save_path);
		if (err == OK) {
			result["save_path"] = p_save_path;
			result["viewport"] = p_viewport;
			result["width"] = img->get_width();
			result["height"] = img->get_height();
			result["success"] = true;
		} else {
			result["error"] = "Failed to save image: " + itos(err);
			result["success"] = false;
		}
	}
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::get_runtime_state(const String &p_node_path, const Array &p_properties) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_node_path);
	if (!node) {
		result["error"] = "Node not found: " + p_node_path;
		result["success"] = false;
		return result;
	}
	
	Dictionary properties;
	for (int i = 0; i < p_properties.size(); i++) {
		String prop_name = p_properties[i];
		if (node->has_method("get_" + prop_name)) {
			properties[prop_name] = node->call("get_" + prop_name);
		} else {
			Variant value = node->get(prop_name);
			properties[prop_name] = value;
		}
	}
	
	result["node_path"] = p_node_path;
	result["properties"] = properties;
	result["success"] = true;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::create_sprite_frames(const String &p_path, const String &p_sprite_sheet, int p_frame_width, int p_frame_height, int p_columns, const Array &p_animations) {
	Dictionary result;
	
	Ref<SpriteFrames> sprite_frames;
	sprite_frames.instantiate();
	
	// Load the sprite sheet texture
	Ref<Texture2D> texture = ResourceLoader::load(p_sprite_sheet);
	if (!texture.is_valid()) {
		result["error"] = "Failed to load sprite sheet: " + p_sprite_sheet;
		result["success"] = false;
		return result;
	}
	
	// Create animations from the sprite sheet
	for (int a = 0; a < p_animations.size(); a++) {
		Dictionary anim = p_animations[a];
		String anim_name = anim.get("name", "default");
		int fps = anim.get("fps", 12);
		bool loop = anim.get("loop", true);
		Array frame_indices = anim.get("frames", Array());
		
		// Add the animation
		if (anim_name != "default") {
			sprite_frames->add_animation(anim_name);
		}
		sprite_frames->set_animation_speed(anim_name, fps);
		sprite_frames->set_animation_loop(anim_name, loop);
		
		// Add frames from AtlasTexture regions
		for (int f = 0; f < frame_indices.size(); f++) {
			int frame_idx = frame_indices[f];
			int col = frame_idx % p_columns;
			int row = frame_idx / p_columns;
			
			Ref<AtlasTexture> atlas;
			atlas.instantiate();
			atlas->set_atlas(texture);
			atlas->set_region(Rect2(col * p_frame_width, row * p_frame_height, p_frame_width, p_frame_height));
			
			sprite_frames->add_frame(anim_name, atlas);
		}
	}
	
	// Save the SpriteFrames resource
	Error err = ResourceSaver::save(sprite_frames, p_path);
	if (err == OK) {
		result["path"] = p_path;
		result["sprite_sheet"] = p_sprite_sheet;
		result["animation_count"] = p_animations.size();
		result["success"] = true;
	} else {
		result["error"] = "Failed to save SpriteFrames: " + itos(err);
		result["success"] = false;
	}
	
	return result;
}

// ============ Phase 16: Individual Frame Animation & SpriteMancer UI Control ============

// Create SpriteFrames from individual frame images (preserves transparency)
Dictionary GodotBridge::create_sprite_frames_from_images(const String &p_path, const Array &p_animations) {
	Dictionary result;
	
	if (p_path.is_empty()) {
		result["error"] = "Path is required";
		result["success"] = false;
		return result;
	}
	
	Ref<SpriteFrames> sprite_frames;
	sprite_frames.instantiate();
	
	int total_frames = 0;
	int loaded_frames = 0;
	
	for (int a = 0; a < p_animations.size(); a++) {
		Dictionary anim = p_animations[a];
		String anim_name = anim.get("name", "default");
		int fps = anim.get("fps", 12);
		bool loop = anim.get("loop", true);
		Array frame_paths = anim.get("frames", Array());  // Array of individual image paths
		
		// Add animation
		if (anim_name != "default") {
			sprite_frames->add_animation(anim_name);
		}
		sprite_frames->set_animation_speed(anim_name, fps);
		sprite_frames->set_animation_loop(anim_name, loop);
		
		// Add each frame as individual texture
		for (int f = 0; f < frame_paths.size(); f++) {
			String frame_path = frame_paths[f];
			total_frames++;
			
			Ref<Texture2D> texture = ResourceLoader::load(frame_path);
			
			if (texture.is_valid()) {
				sprite_frames->add_frame(anim_name, texture);
				loaded_frames++;
			} else {
				print_line("Warning: Could not load frame: " + frame_path);
			}
		}
	}
	
	// Save the SpriteFrames resource
	Error err = ResourceSaver::save(sprite_frames, p_path);
	if (err == OK) {
		result["path"] = p_path;
		result["animation_count"] = p_animations.size();
		result["total_frames"] = total_frames;
		result["loaded_frames"] = loaded_frames;
		result["success"] = true;
		print_line("[GodotBridge] Created SpriteFrames with " + itos(loaded_frames) + " frames at: " + p_path);
	} else {
		result["error"] = "Failed to save SpriteFrames: " + itos(err);
		result["success"] = false;
	}
	
	return result;
}

// Open SpriteMancer project in embedded editor
Dictionary GodotBridge::spritemancer_open_project(const String &p_project_id) {
	Dictionary result;
	
#ifdef TOOLS_ENABLED
	print_line("[SpriteMancer Bridge] Looking for SpriteMancerMainScreen...");
	
	// SpriteMancerMainScreen is added to EditorNode's main_screen_control
	// We need to access it through EditorNode, not EditorInterface
	EditorNode *editor_node = EditorNode::get_singleton();
	if (!editor_node) {
		result["error"] = "EditorNode not available";
		result["success"] = false;
		print_line("[SpriteMancer Bridge] EditorNode is null!");
		return result;
	}
	
	Control *main_screen = editor_node->get_main_screen_control();
	if (!main_screen) {
		result["error"] = "Main screen control not available";
		result["success"] = false;
		print_line("[SpriteMancer Bridge] main_screen_control is null!");
		return result;
	}
	
	print_line("[SpriteMancer Bridge] main_screen_control found, searching " + itos(main_screen->get_child_count()) + " children...");
	
	// Find SpriteMancerMainScreen by class type
	Node *spritemancer = nullptr;
	for (int i = 0; i < main_screen->get_child_count(); i++) {
		Node *child = main_screen->get_child(i);
		if (child && child->get_class() == "SpriteMancerMainScreen") {
			spritemancer = child;
			print_line("[SpriteMancer Bridge] Found SpriteMancerMainScreen at child index " + itos(i));
			break;
		}
	}
	
	if (spritemancer) {
		print_line("[SpriteMancer Bridge] SpriteMancerMainScreen found! Calling toggle_embedded_mode...");
		// Enable embedded mode FIRST so browser is ready
		spritemancer->call("toggle_embedded_mode", true);
		print_line("[SpriteMancer Bridge] Calling load_project with: " + p_project_id);
		// Then load the project (this will navigate the browser)
		spritemancer->call("load_project", p_project_id);

		// Auto-switch to SpriteMancer main screen tab so user can see the preview
		EditorInterface *ei = EditorInterface::get_singleton();
		if (ei) {
			ei->set_main_screen_editor("Agentic Godot");
			print_line("[SpriteMancer Bridge] Switched to Agentic Godot main screen");
		}

		result["project_id"] = p_project_id;
		result["url"] = "https://spritemancer.zerograft.online/projects/" + p_project_id;
		result["success"] = true;
		print_line("[SpriteMancer Bridge] spritemancer_open_project completed successfully!");
		return result;
	} else {
		print_line("[SpriteMancer Bridge] SpriteMancerMainScreen NOT found in main_screen_control children!");
		// List all children for debugging
		for (int i = 0; i < main_screen->get_child_count(); i++) {
			Node *child = main_screen->get_child(i);
			if (child) {
				print_line("[SpriteMancer Bridge]   Child " + itos(i) + ": " + child->get_name() + " (" + child->get_class() + ")");
			}
		}
	}
	
	result["error"] = "SpriteMancer main screen not found";
	result["success"] = false;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	
	return result;
}

// Execute JavaScript in embedded SpriteMancer editor
Dictionary GodotBridge::spritemancer_execute_js(const String &p_code) {
	Dictionary result;
	
#ifdef TOOLS_ENABLED
	EditorInterface *ei = EditorInterface::get_singleton();
	if (!ei) {
		result["error"] = "Editor interface not available";
		result["success"] = false;
		return result;
	}
	
	Node *editor_main = ei->get_base_control();
	if (editor_main) {
		Node *spritemancer = editor_main->find_child("SpriteMancerMainScreen", true, false);
		if (spritemancer) {
			// Get the CEF browser from SpriteMancer and execute JS
			Object *cef_browser = spritemancer->get("cef_browser");
			if (cef_browser) {
				cef_browser->call("execute_javascript", p_code);
				result["success"] = true;
				return result;
			}
			result["error"] = "Embedded browser not available";
			result["success"] = false;
			return result;
		}
	}
	
	result["error"] = "SpriteMancer main screen not found";
	result["success"] = false;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	
	return result;
}

// Retry post-processing on an animation
Dictionary GodotBridge::spritemancer_retry_postprocess(const String &p_project_id, const String &p_animation) {
	// Execute JS to trigger retry in the React app
	String js_code = "window.dispatchEvent(new CustomEvent('godot:command', { detail: { "
		"action: 'retryPostProcess', projectId: '" + p_project_id + "', animation: '" + p_animation + "'} }))";
	
	return spritemancer_execute_js(js_code);
}

// Navigate to specific view in embedded editor
Dictionary GodotBridge::spritemancer_navigate(const String &p_view) {
	String js_code = "window.dispatchEvent(new CustomEvent('godot:command', { detail: { "
		"action: 'navigate', view: '" + p_view + "'} }))";
	
	return spritemancer_execute_js(js_code);
}
