// godot_bridge.cpp - Core bridge server with command registry pattern
// Command implementations are split into domain-specific files:
// - bridge_commands_scene.cpp
// - bridge_commands_script.cpp
// - bridge_commands_filesystem.cpp
// - bridge_commands_input.cpp
// - bridge_commands_advanced.cpp

#include "godot_bridge.h"
#include "bridge_command_registry.h"
#include "core/io/file_access.h"
#include "core/io/dir_access.h"
#include "core/io/json.h"
#include "core/config/project_settings.h"
#include "core/os/os.h"
#include "core/os/thread.h"

#ifdef TOOLS_ENABLED
#include "editor/editor_node.h"
#include "editor/editor_interface.h"
#include "editor/plugins/script_editor_plugin.h"
#endif

// ============ Command Registry Initialization ============

void GodotBridge::_init_command_registry() {
	// Scene/Node commands
	REGISTER_COMMAND_1(command_registry, "get_scene_tree", get_scene_tree, "max_depth", int, 5);
	REGISTER_COMMAND_2(command_registry, "create_scene", create_scene, "path", String, "", "root_type", String, "Node2D");
	REGISTER_COMMAND_3(command_registry, "add_node", add_node, "parent", String, "", "type", String, "Node", "name", String, "NewNode");
	REGISTER_COMMAND_1(command_registry, "remove_node", remove_node, "path", String, "");
	REGISTER_COMMAND_2(command_registry, "rename_node", rename_node, "path", String, "", "new_name", String, "");
	REGISTER_COMMAND_1(command_registry, "duplicate_node", duplicate_node, "path", String, "");
	REGISTER_COMMAND_2(command_registry, "move_node", move_node, "path", String, "", "new_parent", String, "");
	REGISTER_COMMAND_2(command_registry, "reparent_node", reparent_node, "node", String, "", "new_parent", String, "");
	REGISTER_COMMAND_1(command_registry, "get_node_info", get_node_info, "path", String, "");
	REGISTER_COMMAND_2(command_registry, "copy_node", copy_node, "from", String, "", "to_scene", String, "");
	REGISTER_COMMAND_1(command_registry, "save_scene", save_scene, "path", String, "");
	REGISTER_COMMAND_1(command_registry, "open_scene", open_scene, "path", String, "");
	REGISTER_COMMAND_0(command_registry, "list_scenes", list_scenes);
	REGISTER_COMMAND_0(command_registry, "get_open_scenes", get_open_scenes);
	REGISTER_COMMAND_1(command_registry, "set_owner_recursive", set_owner_recursive, "node", String, "");
	REGISTER_COMMAND_2(command_registry, "scene_pack", scene_pack, "node", String, "", "output_path", String, "");
	REGISTER_COMMAND_2(command_registry, "scene_instantiate", scene_instantiate, "scene_path", String, "", "parent", String, "");
	
	// Property commands
	REGISTER_COMMAND_2(command_registry, "get_property", get_property, "node", String, "", "property", String, "");
	command_registry["set_property"] = [](GodotBridge* bridge, const Dictionary& params) -> Dictionary {
		String node = params.get("node", "");
		String property = params.get("property", "");
		Variant value = params.get("value", Variant());
		return bridge->set_property(node, property, value);
	};

	// Game control
	REGISTER_COMMAND_1(command_registry, "run_game", run_game, "scene", String, "");
	REGISTER_COMMAND_0(command_registry, "stop_game", stop_game);
	
	// Script commands
	REGISTER_COMMAND_2(command_registry, "create_script", create_script, "path", String, "", "content", String, "");
	REGISTER_COMMAND_1(command_registry, "read_script", read_script, "path", String, "");
	REGISTER_COMMAND_2(command_registry, "edit_script", edit_script, "path", String, "", "content", String, "");
	REGISTER_COMMAND_0(command_registry, "get_errors", get_errors);
	REGISTER_COMMAND_0(command_registry, "get_runtime_errors", get_runtime_errors);
	REGISTER_COMMAND_0(command_registry, "clear_runtime_errors", clear_runtime_errors);
	REGISTER_COMMAND_2(command_registry, "search_in_scripts", search_in_scripts, "pattern", String, "", "is_regex", bool, false);
	
	// File system commands
	REGISTER_COMMAND_2(command_registry, "list_files", list_files, "path", String, "res://", "recursive", bool, false);
	REGISTER_COMMAND_1(command_registry, "read_file", read_file, "path", String, "");
	REGISTER_COMMAND_1(command_registry, "create_folder", create_folder, "path", String, "");
	REGISTER_COMMAND_1(command_registry, "delete_file", delete_file, "path", String, "");
	REGISTER_COMMAND_2(command_registry, "create_resource", create_resource, "type", String, "", "path", String, "");
	REGISTER_COMMAND_1(command_registry, "load_resource", load_resource, "path", String, "");
	REGISTER_COMMAND_0(command_registry, "assets_scan", assets_scan);
	REGISTER_COMMAND_1(command_registry, "assets_update_file", assets_update_file, "path", String, "");
	REGISTER_COMMAND_1(command_registry, "assets_update_files", assets_update_files, "paths", Array, Array());
	REGISTER_COMMAND_1(command_registry, "assets_reimport", assets_reimport, "path", String, "");
	REGISTER_COMMAND_2(command_registry, "assets_move_and_rename", assets_move_and_rename, "from", String, "", "to", String, "");
	
	// Input/Settings commands
	REGISTER_COMMAND_2(command_registry, "add_input_action", add_input_action, "action", String, "", "key", String, "");
	REGISTER_COMMAND_1(command_registry, "remove_input_action", remove_input_action, "action", String, "");
	REGISTER_COMMAND_0(command_registry, "list_input_actions", list_input_actions);
	command_registry["set_project_setting"] = [](GodotBridge* bridge, const Dictionary& params) -> Dictionary {
		String setting = params.get("setting", "");
		Variant value = params.get("value", Variant());
		return bridge->set_project_setting(setting, value);
	};
	REGISTER_COMMAND_1(command_registry, "get_project_setting", get_project_setting, "setting", String, "");
	
	// Group commands
	REGISTER_COMMAND_2(command_registry, "add_to_group", add_to_group, "node", String, "", "group", String, "");
	REGISTER_COMMAND_2(command_registry, "remove_from_group", remove_from_group, "node", String, "", "group", String, "");
	REGISTER_COMMAND_1(command_registry, "list_groups", list_groups, "node", String, "");
	
	// Signal commands
	REGISTER_COMMAND_4(command_registry, "connect_signal", connect_signal, "source", String, "", "signal", String, "", "target", String, "", "method", String, "");
	REGISTER_COMMAND_1(command_registry, "list_signals", list_signals, "node", String, "");
	
	// Audio commands
	REGISTER_COMMAND_2(command_registry, "set_audio_stream", set_audio_stream, "node", String, "", "audio_path", String, "");
	REGISTER_COMMAND_1(command_registry, "play_audio", play_audio, "node", String, "");
	
	// Agent capability commands
	REGISTER_COMMAND_0(command_registry, "undo_last_action", undo_last_action);
	REGISTER_COMMAND_0(command_registry, "get_selected_nodes", get_selected_nodes);
	REGISTER_COMMAND_0(command_registry, "get_selected_text", get_selected_text);
	REGISTER_COMMAND_0(command_registry, "get_selected_files", get_selected_files);
	command_registry["start_plan"] = [](GodotBridge* bridge, const Dictionary& params) -> Dictionary {
		String name = params.get("name", "");
		Array steps = params.get("steps", Array());
		return bridge->start_plan(name, steps);
	};
	REGISTER_COMMAND_2(command_registry, "update_plan", update_plan, "step_index", int, 0, "status", String, "");
	
	// TileMap & Navigation commands
	REGISTER_COMMAND_3(command_registry, "tileset_create_atlas", tileset_create_atlas, "tileset_path", String, "", "texture_path", String, "", "tile_size", int, 16);
	command_registry["map_set_cells_batch"] = [](GodotBridge* bridge, const Dictionary& params) -> Dictionary {
		String tilemap = params.get("tilemap_path", "");
		Array cells = params.get("cells", Array());
		return bridge->map_set_cells_batch(tilemap, cells);
	};
	command_registry["map_clear_layer"] = [](GodotBridge* bridge, const Dictionary& params) -> Dictionary {
		String tilemap = params.get("tilemap_path", "");
		return bridge->map_clear_layer(tilemap);
	};
	command_registry["map_fill_rect"] = [](GodotBridge* bridge, const Dictionary& params) -> Dictionary {
		String tilemap = params.get("tilemap_path", "");
		int start_x = params.get("start_x", 0);
		int start_y = params.get("start_y", 0);
		int width = params.get("width", 1);
		int height = params.get("height", 1);
		int source = params.get("source", 0);
		int atlas_x = params.get("atlas_x", 0);
		int atlas_y = params.get("atlas_y", 0);
		return bridge->map_fill_rect(tilemap, start_x, start_y, width, height, source, atlas_x, atlas_y);
	};
	REGISTER_COMMAND_1(command_registry, "navmesh_bake", navmesh_bake, "region", String, "");
	
	// Phase 17: Critical Tool Gap Fixes
	REGISTER_COMMAND_2(command_registry, "scene_instantiate", scene_instantiate, "scene_path", String, "", "parent", String, "");
	command_registry["set_collision_shape"] = [](GodotBridge* bridge, const Dictionary& params) -> Dictionary {
		String node = params.get("node", "");
		String shape_type = params.get("shape_type", "rectangle");
		
		// Support both nested {size: {width, height}} and top-level {width, height}
		Dictionary size;
		if (params.has("size")) {
			size = params.get("size", Dictionary());
		} else {
			// Fallback: check for top-level width/height
			if (params.has("width") || params.has("height")) {
				size["width"] = params.get("width", 32.0);
				size["height"] = params.get("height", 32.0);
				size["radius"] = params.get("radius", 16.0);
			}
		}
		
		print_line("GodotBridge: set_collision_shape - size dict: width=" + String::num(float(size.get("width", 32.0))) + " height=" + String::num(float(size.get("height", 32.0))));
		return bridge->set_collision_shape(node, shape_type, size);
	};
	REGISTER_COMMAND_2(command_registry, "attach_script", attach_script, "node", String, "", "script_path", String, "");
	REGISTER_COMMAND_1(command_registry, "get_sprite_dimensions", get_sprite_dimensions, "node", String, "");
	
	// Build pipeline commands
	REGISTER_COMMAND_2(command_registry, "build_execute", build_execute, "preset", String, "", "output_path", String, "");
	REGISTER_COMMAND_0(command_registry, "build_verify", build_verify);
	
	// Agentic AI commands (Blueprint/Diff tabs)
	command_registry["set_current_plan"] = [](GodotBridge* bridge, const Dictionary& params) -> Dictionary {
		String name = params.get("name", "");
		Array steps = params.get("steps", Array());
		return bridge->set_current_plan(name, steps);
	};
	command_registry["add_diff_entry"] = [](GodotBridge* bridge, const Dictionary& params) -> Dictionary {
		String file = params.get("file", "");
		String status = params.get("status", "modified");
		return bridge->add_diff_entry(file, status);
	};
	command_registry["clear_diff_entries"] = [](GodotBridge* bridge, const Dictionary& params) -> Dictionary {
		return bridge->clear_diff_entries();
	};
	
	// Viewport/Runtime commands
	REGISTER_COMMAND_2(command_registry, "capture_viewport", capture_viewport, "save_path", String, "", "viewport", String, "editor");
	command_registry["get_runtime_state"] = [](GodotBridge* bridge, const Dictionary& params) -> Dictionary {
		String node_path = params.get("node_path", "");
		Array properties = params.get("properties", Array());
		return bridge->get_runtime_state(node_path, properties);
	};
	
	// SpriteFrames resource creation
	command_registry["create_sprite_frames"] = [](GodotBridge* bridge, const Dictionary& params) -> Dictionary {
		String path = params.get("path", "");
		String sprite_sheet = params.get("sprite_sheet", "");
		int frame_width = params.get("frame_width", 32);
		int frame_height = params.get("frame_height", 32);
		int columns = params.get("columns", 4);
		Array animations = params.get("animations", Array());
		return bridge->create_sprite_frames(path, sprite_sheet, frame_width, frame_height, columns, animations);
	};
	
	// SpriteFrames from individual images (preserves transparency)
	command_registry["create_sprite_frames_from_images"] = [](GodotBridge* bridge, const Dictionary& params) -> Dictionary {
		String path = params.get("path", "");
		Array animations = params.get("animations", Array());
		return bridge->create_sprite_frames_from_images(path, animations);
	};
	
	// SpriteMancer UI control commands
	command_registry["spritemancer_open_project"] = [](GodotBridge* bridge, const Dictionary& params) -> Dictionary {
		String project_id = params.get("project_id", "");
		return bridge->spritemancer_open_project(project_id);
	};
	command_registry["spritemancer_execute_js"] = [](GodotBridge* bridge, const Dictionary& params) -> Dictionary {
		String code = params.get("code", "");
		return bridge->spritemancer_execute_js(code);
	};
	command_registry["spritemancer_retry_postprocess"] = [](GodotBridge* bridge, const Dictionary& params) -> Dictionary {
		String project_id = params.get("project_id", "");
		String animation = params.get("animation", "");
		return bridge->spritemancer_retry_postprocess(project_id, animation);
	};
	command_registry["spritemancer_navigate"] = [](GodotBridge* bridge, const Dictionary& params) -> Dictionary {
		String view = params.get("view", "");
		return bridge->spritemancer_navigate(view);
	};
	
	// Get current project path (for automatic sprite saving)
	command_registry["get_project_path"] = [](GodotBridge* bridge, const Dictionary& params) -> Dictionary {
		Dictionary result;
		result["path"] = ProjectSettings::get_singleton()->globalize_path("res://");
		result["success"] = true;
		return result;
	};
}

// ============ Binding ============

void GodotBridge::_bind_methods() {
	ClassDB::bind_method(D_METHOD("start", "port"), &GodotBridge::start, DEFVAL(9876));
	ClassDB::bind_method(D_METHOD("stop"), &GodotBridge::stop);
	ClassDB::bind_method(D_METHOD("is_running"), &GodotBridge::is_running);
	ClassDB::bind_method(D_METHOD("broadcast_event", "event", "data"), &GodotBridge::broadcast_event);

	ADD_SIGNAL(MethodInfo("client_connected", PropertyInfo(Variant::INT, "id")));
	ADD_SIGNAL(MethodInfo("client_disconnected", PropertyInfo(Variant::INT, "id")));
	ADD_SIGNAL(MethodInfo("message_received",
			PropertyInfo(Variant::INT, "client_id"),
			PropertyInfo(Variant::STRING, "method"),
			PropertyInfo(Variant::DICTIONARY, "params")));
}

// ============ Lifecycle ============

void GodotBridge::_notification(int p_what) {
	if (p_what == NOTIFICATION_READY) {
		_connect_editor_signals();
	}
	if (p_what == NOTIFICATION_PROCESS && running) {
		if (server.is_valid()) {
			while (server->is_connection_available()) {
				Ref<StreamPeerTCP> client = server->take_connection();
				clients.push_back(client);
				client_buffers.push_back(String());  // Initialize receive buffer for new client
				int id = clients.size() - 1;
				emit_signal("client_connected", id);
				print_line("GodotBridge: Client connected, id=" + itos(id));
			}

			for (int i = clients.size() - 1; i >= 0; i--) {
				_process_client(i);
			}
		}
	}
}

Error GodotBridge::start(int p_port) {
	port = p_port;
	server.instantiate();
	Error err = server->listen(port);
	if (err == OK) {
		running = true;
		set_process(true);
		_init_command_registry();
		print_line("GodotBridge: Listening on port " + itos(port));
	}
	return err;
}

void GodotBridge::stop() {
	if (server.is_valid()) {
		server->stop();
	}
	clients.clear();
	running = false;
	set_process(false);
	print_line("GodotBridge: Stopped");
}

bool GodotBridge::is_running() const {
	return running;
}

// ============ Client Handling ============

void GodotBridge::_process_client(int index) {
	Ref<StreamPeerTCP> client = clients[index];

	StreamPeerTCP::Status status = client->get_status();
	if (status == StreamPeerTCP::STATUS_ERROR || status == StreamPeerTCP::STATUS_NONE) {
		emit_signal("client_disconnected", index);
		clients.remove_at(index);
		if (index < client_buffers.size()) {
			client_buffers.remove_at(index);
		}
		return;
	}

	int available = client->get_available_bytes();
	if (available > 0) {
		PackedByteArray data;
		data.resize(available);
		client->get_data(data.ptrw(), available);
		String chunk = String::utf8((const char *)data.ptr(), available);

		// Append to per-client buffer
		if (index < client_buffers.size()) {
			client_buffers.write[index] += chunk;
		} else {
			// Safety: buffer not yet allocated
			while (client_buffers.size() <= index) {
				client_buffers.push_back(String());
			}
			client_buffers.write[index] = chunk;
		}

		// Extract complete newline-delimited messages from buffer
		String &buf = client_buffers.write[index];
		int newline_pos;
		while ((newline_pos = buf.find("\n")) != -1) {
			String message = buf.substr(0, newline_pos).strip_edges();
			buf = buf.substr(newline_pos + 1);
			if (!message.is_empty()) {
				_handle_message(message, index);
			}
		}

		// Fallback: if buffer has no newline but looks like complete JSON,
		// try to parse it directly (backward compat with non-delimited senders)
		if (!buf.is_empty() && buf.begins_with("{") && buf.ends_with("}")) {
			String message = buf.strip_edges();
			buf = String();
			_handle_message(message, index);
		}
	}
}

void GodotBridge::_handle_message(const String &p_message, int p_client_index) {
	JSON json;
	Error err = json.parse(p_message);
	if (err != OK) {
		return;
	}

	Dictionary msg = json.get_data();
	String id = msg.get("id", "");
	String method = msg.get("method", "");
	Dictionary params = msg.get("params", Dictionary());

	emit_signal("message_received", p_client_index, method, params);
	print_line("GodotBridge: Received method=" + method);

	Dictionary result;
	
	// Command registry dispatch
	if (command_registry.has(method)) {
		result = command_registry[method](this, params);
	} else {
		print_line("GodotBridge: Unknown method: " + method);
		result["error"] = "Unknown method: " + method;
	}

	if (!id.is_empty()) {
		send_response(p_client_index, id, result);
		print_line("GodotBridge: Sent response for id=" + id);
	}
}

// ============ Communication ============

void GodotBridge::send_response(int p_client, const String &p_id, const Variant &p_result) {
	if (p_client < 0 || p_client >= clients.size()) {
		return;
	}

	Dictionary response;
	response["id"] = p_id;
	response["type"] = "response";
	response["result"] = p_result;

	String json_str = JSON::stringify(response) + "\n";
	clients[p_client]->put_data((const uint8_t *)json_str.utf8().get_data(), json_str.utf8().length());
}

void GodotBridge::broadcast_event(const String &p_event, const Variant &p_data) {
	Dictionary event_msg;
	event_msg["type"] = "event";
	event_msg["event"] = p_event;
	event_msg["data"] = p_data;

	String json_str = JSON::stringify(event_msg) + "\n";
	PackedByteArray bytes;
	bytes.resize(json_str.utf8().length());
	memcpy(bytes.ptrw(), json_str.utf8().get_data(), json_str.utf8().length());

	for (int i = 0; i < clients.size(); i++) {
		clients[i]->put_data(bytes.ptr(), bytes.size());
	}
}

// ============ Helper ============

Node *GodotBridge::_get_node_by_path(const String &p_path) {
#ifdef TOOLS_ENABLED
	EditorInterface *editor = EditorInterface::get_singleton();
	if (!editor) {
		return nullptr;
	}
	Node *edited_root = editor->get_edited_scene_root();
	if (!edited_root) {
		return nullptr;
	}
	if (p_path.is_empty() || p_path == "/" || p_path == ".") {
		return edited_root;
	}
	return edited_root->get_node_or_null(NodePath(p_path));
#else
	return nullptr;
#endif
}

// ============ Constructor/Destructor ============

GodotBridge::GodotBridge() {
	// Set up error handler to capture runtime errors
	error_handler.errfunc = _error_handler_callback;
	error_handler.userdata = this;
	add_error_handler(&error_handler);
	print_line("GodotBridge: Runtime error handler registered");
}

GodotBridge::~GodotBridge() {
	remove_error_handler(&error_handler);
	stop();
}

// ============ Runtime Error Handler ============

void GodotBridge::_error_handler_callback(void *p_self, const char *p_func, const char *p_file, int p_line, const char *p_error, const char *p_errorexp, bool p_editor_notify, ErrorHandlerType p_type) {
	GodotBridge *self = static_cast<GodotBridge *>(p_self);
	if (!self) return;
	
	// Build error message
	String err_str;
	if (p_errorexp && p_errorexp[0]) {
		err_str = String::utf8(p_errorexp);
	} else {
		err_str = String::utf8(p_file) + ":" + itos(p_line) + " - " + String::utf8(p_error);
	}
	
	// Create error dictionary
	Dictionary error;
	error["type"] = (p_type == ERR_HANDLER_WARNING) ? "warning" : "error";
	error["message"] = err_str;
	error["file"] = String::utf8(p_file);
	error["line"] = p_line;
	error["function"] = String::utf8(p_func);
	error["error"] = String::utf8(p_error);
	error["timestamp"] = OS::get_singleton()->get_ticks_msec();
	
	// Thread-safe storage (errors can come from any thread)
	if (Thread::is_main_thread()) {
		// Limit the number of stored errors
		if (self->captured_errors.size() >= MAX_CAPTURED_ERRORS) {
			self->captured_errors.remove_at(0);
		}
		self->captured_errors.push_back(error);
		
		// Broadcast error event to connected clients
		if (self->is_running()) {
			self->broadcast_event("runtime_error", error);
		}
	}
}

Dictionary GodotBridge::get_runtime_errors() {
	Dictionary result;
	Array errors;
	
	for (int i = 0; i < captured_errors.size(); i++) {
		errors.push_back(captured_errors[i]);
	}
	
	result["errors"] = errors;
	result["count"] = errors.size();
	result["success"] = true;
	return result;
}

Dictionary GodotBridge::clear_runtime_errors() {
	Dictionary result;
	int count = captured_errors.size();
	captured_errors.clear();
	
	result["cleared_count"] = count;
	result["success"] = true;
	return result;
}

// ============ Editor Event Hooks ============

void GodotBridge::_connect_editor_signals() {
#ifdef TOOLS_ENABLED
	if (editor_hooks_connected) {
		return;
	}
	
	EditorInterface *editor = EditorInterface::get_singleton();
	if (!editor) {
		print_line("GodotBridge: EditorInterface not available yet");
		return;
	}
	
	EditorSelection *selection = editor->get_selection();
	if (selection) {
		selection->connect("selection_changed", callable_mp(this, &GodotBridge::_on_selection_changed));
		print_line("GodotBridge: Connected to selection_changed signal");
	}
	
	EditorNode *editor_node = EditorNode::get_singleton();
	if (editor_node) {
		editor_node->connect("scene_changed", callable_mp(this, &GodotBridge::_on_scene_changed));
		print_line("GodotBridge: Connected to scene_changed signal");
	}
	
	ScriptEditor *script_editor = ScriptEditor::get_singleton();
	if (script_editor) {
		script_editor->connect("editor_script_changed", callable_mp(this, &GodotBridge::_on_script_opened));
		print_line("GodotBridge: Connected to editor_script_changed signal");
	}
	
	editor_hooks_connected = true;
	print_line("GodotBridge: Editor hooks connected!");
#endif
}

void GodotBridge::_on_selection_changed() {
#ifdef TOOLS_ENABLED
	EditorInterface *editor = EditorInterface::get_singleton();
	if (!editor) return;
	
	EditorSelection *selection = editor->get_selection();
	if (!selection) return;
	
	Array selected_nodes;
	TypedArray<Node> nodes = selection->get_selected_nodes();
	
	for (int i = 0; i < nodes.size(); i++) {
		Node *node = Object::cast_to<Node>(nodes[i]);
		if (node) {
			Dictionary node_info;
			node_info["name"] = node->get_name();
			node_info["type"] = node->get_class();
			node_info["path"] = node->get_path();
			selected_nodes.push_back(node_info);
		}
	}
	
	Dictionary event_data;
	event_data["nodes"] = selected_nodes;
	event_data["count"] = selected_nodes.size();
	
	broadcast_event("selection_changed", event_data);
	print_line("GodotBridge: Selection changed - " + itos(selected_nodes.size()) + " nodes");
#endif
}

void GodotBridge::_on_scene_changed() {
#ifdef TOOLS_ENABLED
	EditorInterface *editor = EditorInterface::get_singleton();
	if (!editor) return;
	
	Node *scene_root = editor->get_edited_scene_root();
	
	Dictionary event_data;
	if (scene_root) {
		event_data["root_name"] = scene_root->get_name();
		event_data["root_type"] = scene_root->get_class();
		event_data["path"] = scene_root->get_scene_file_path();
	} else {
		event_data["root_name"] = "";
		event_data["root_type"] = "";
		event_data["path"] = "";
	}
	
	broadcast_event("scene_changed", event_data);
	print_line("GodotBridge: Scene changed - " + String(event_data.get("path", "")));
#endif
}

void GodotBridge::_on_script_opened(const Ref<Script> &p_script) {
#ifdef TOOLS_ENABLED
	Dictionary event_data;
	
	if (p_script.is_valid()) {
		event_data["path"] = p_script->get_path();
		event_data["language"] = p_script->get_class();
		event_data["is_tool"] = p_script->is_tool();
	} else {
		event_data["path"] = "";
		event_data["language"] = "";
		event_data["is_tool"] = false;
	}
	
	broadcast_event("script_opened", event_data);
	print_line("GodotBridge: Script opened - " + String(event_data.get("path", "")));
#endif
}
