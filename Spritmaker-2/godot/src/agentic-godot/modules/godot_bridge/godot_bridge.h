#ifndef GODOT_BRIDGE_H
#define GODOT_BRIDGE_H

#include "scene/main/node.h"
#include "core/io/tcp_server.h"
#include "core/io/stream_peer_tcp.h"
#include "core/io/json.h"
#include "core/error/error_macros.h"
#include "bridge_command_registry.h"

class GodotBridge : public Node {
	GDCLASS(GodotBridge, Node);

private:
	Ref<TCPServer> server;
	Vector<Ref<StreamPeerTCP>> clients;
	CommandRegistry command_registry;
	int port = 9876;
	bool running = false;
	bool editor_hooks_connected = false;
	
	// Action history for undo support
	Vector<Dictionary> action_history;
	Dictionary current_plan;
	
	// Runtime error capture
	ErrorHandlerList error_handler;
	static void _error_handler_callback(void *p_self, const char *p_func, const char *p_file, int p_line, const char *p_error, const char *p_errorexp, bool p_editor_notify, ErrorHandlerType p_type);
	Vector<Dictionary> captured_errors;
	static const int MAX_CAPTURED_ERRORS = 50;

	void _process_client(int index);
	void _handle_message(const String &p_message, int p_client_index);
	
	// Helper to get node from scene tree
	Node *_get_node_by_path(const String &p_path);
	
	// Helper for deep scene tree serialization (Phase 0)
	Dictionary _serialize_node_recursive(Node *p_node, int p_current_depth, int p_max_depth);
	
	// Command registry initialization
	void _init_command_registry();
	
	// Editor event hooks
	void _connect_editor_signals();
	void _on_selection_changed();
	void _on_scene_changed();
	void _on_script_opened(const Ref<Script> &p_script);
	
	// Helper to collect node configuration warnings
	void _collect_node_warnings(Node *p_node, Array &r_warnings);

protected:
	static void _bind_methods();
	void _notification(int p_what);

public:
	Error start(int p_port = 9876);
	void stop();
	bool is_running() const;

	void send_response(int p_client, const String &p_id, const Variant &p_result);
	void broadcast_event(const String &p_event, const Variant &p_data);
	
	// Plan accessor for AI Panel
	Dictionary get_current_plan() const { return current_plan; }

	// Real Godot API implementations
	Dictionary get_scene_tree(int p_max_depth = 5);
	Dictionary create_scene(const String &p_path, const String &p_root_type);
	Dictionary add_node(const String &p_parent, const String &p_type, const String &p_name);
	Dictionary remove_node(const String &p_path);
	Dictionary create_script(const String &p_path, const String &p_content);
	Dictionary set_property(const String &p_node, const String &p_property, const Variant &p_value);
	Dictionary run_game(const String &p_scene);
	Dictionary stop_game();
	
	// Phase 4: Core Editor Commands
	Dictionary rename_node(const String &p_path, const String &p_new_name);
	Dictionary duplicate_node(const String &p_path);
	Dictionary move_node(const String &p_path, const String &p_new_parent);
	Dictionary get_property(const String &p_node, const String &p_property);
	Dictionary save_scene(const String &p_path);
	Dictionary open_scene(const String &p_path);
	
	// Phase 5: Advanced AI
	Dictionary read_script(const String &p_path);
	Dictionary edit_script(const String &p_path, const String &p_content);
	Dictionary get_errors();
	Dictionary get_runtime_errors();
	Dictionary clear_runtime_errors();
	
	// Phase 6: Extended Commands
	// Scene Management
	Dictionary list_scenes();
	Dictionary get_node_info(const String &p_path);
	Dictionary copy_node(const String &p_from, const String &p_to_scene);
	// File System
	Dictionary list_files(const String &p_path, bool p_recursive = false);
	void _list_files_internal(const String &p_path, bool p_recursive, Array &r_files, Array &r_folders);
	Dictionary read_file(const String &p_path);
	Dictionary create_folder(const String &p_path);
	Dictionary delete_file(const String &p_path);
	// Signals & Connections
	Dictionary connect_signal(const String &p_source, const String &p_signal, const String &p_target, const String &p_method);
	Dictionary list_signals(const String &p_node);
	
	// Phase 7: Input & Project Config
	Dictionary add_input_action(const String &p_action, const String &p_key);
	Dictionary list_input_actions();
	Dictionary set_project_setting(const String &p_setting, const Variant &p_value);
	Dictionary get_project_setting(const String &p_setting);
	
	// Phase 8: Groups
	Dictionary add_to_group(const String &p_node, const String &p_group);
	Dictionary list_groups(const String &p_node);
	
	// Phase 9: Remaining Gaps
	Dictionary remove_input_action(const String &p_action);
	Dictionary remove_from_group(const String &p_node, const String &p_group);
	Dictionary create_resource(const String &p_type, const String &p_path);
	Dictionary load_resource(const String &p_path);
	Dictionary set_audio_stream(const String &p_node, const String &p_audio_path);
	Dictionary play_audio(const String &p_node);
	
	// Phase 10: Enhanced Agent Capabilities
	Dictionary undo_last_action();
	Dictionary search_in_scripts(const String &p_pattern, bool p_is_regex);
	Dictionary get_selected_nodes();
	Dictionary get_selected_text();
	Dictionary get_selected_files();
	Dictionary start_plan(const String &p_name, const Array &p_steps);
	Dictionary update_plan(int p_step_index, const String &p_status);
	
	// Phase 11: Context & Asset Pipeline
	Dictionary get_open_scenes();
	Dictionary assets_scan();
	Dictionary assets_update_file(const String &p_path);
	Dictionary assets_update_files(const Array &p_paths);
	Dictionary assets_reimport(const String &p_path);
	Dictionary assets_move_and_rename(const String &p_from, const String &p_to);
	
	// Phase 12: Scene Persistence
	Dictionary set_owner_recursive(const String &p_node);
	Dictionary scene_pack(const String &p_node, const String &p_output_path);
	Dictionary scene_instantiate(const String &p_scene_path, const String &p_parent);
	Dictionary reparent_node(const String &p_node, const String &p_new_parent);
	
	// Phase 17: Critical Tool Gap Fixes
	Dictionary set_collision_shape(const String &p_node, const String &p_shape_type, const Dictionary &p_size);
	Dictionary attach_script(const String &p_node, const String &p_script_path);
	Dictionary get_sprite_dimensions(const String &p_node);
	
	// Phase 13: TileMap & Navigation
	Dictionary tileset_create_atlas(const String &p_tileset_path, const String &p_texture_path, int p_tile_size);
	Dictionary map_set_cells_batch(const String &p_tilemap, const Array &p_cells);
	Dictionary map_clear_layer(const String &p_tilemap);
	Dictionary map_fill_rect(const String &p_tilemap, int p_start_x, int p_start_y, int p_width, int p_height, int p_source, int p_atlas_x, int p_atlas_y);
	Dictionary navmesh_bake(const String &p_region);
	
	// Phase 14: Build Pipeline
	Dictionary build_execute(const String &p_preset, const String &p_output_path);
	Dictionary build_verify();
	
	// Phase 15: Agentic AI Commands
	Dictionary set_current_plan(const String &p_name, const Array &p_steps);
	Dictionary add_diff_entry(const String &p_file, const String &p_status);
	Dictionary clear_diff_entries();
	Dictionary capture_viewport(const String &p_save_path, const String &p_viewport);
	Dictionary get_runtime_state(const String &p_node_path, const Array &p_properties);
	Dictionary create_sprite_frames(const String &p_path, const String &p_sprite_sheet, int p_frame_width, int p_frame_height, int p_columns, const Array &p_animations);
	
	// Phase 16: Individual Frame Animation & SpriteMancer UI Control
	Dictionary create_sprite_frames_from_images(const String &p_path, const Array &p_animations);
	Dictionary spritemancer_open_project(const String &p_project_id);
	Dictionary spritemancer_execute_js(const String &p_code);
	Dictionary spritemancer_retry_postprocess(const String &p_project_id, const String &p_animation);
	Dictionary spritemancer_navigate(const String &p_view);

	GodotBridge();
	~GodotBridge();
};

#endif // GODOT_BRIDGE_H
