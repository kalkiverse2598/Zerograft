#ifndef AI_PANEL_H
#define AI_PANEL_H

#include "scene/gui/box_container.h"
#include "scene/gui/text_edit.h"
#include "scene/gui/button.h"
#include "scene/gui/rich_text_label.h"
#include "scene/gui/scroll_container.h"
#include "scene/gui/line_edit.h"
#include "scene/gui/option_button.h"
#include "scene/gui/panel_container.h"
#include "scene/gui/margin_container.h"
#include "scene/gui/tab_bar.h"
#include "scene/gui/popup_menu.h"
#include "scene/main/http_request.h"
#include "modules/websocket/websocket_peer.h"
#include "scene/main/timer.h"
#include "scene/main/window.h"
#include "scene/gui/texture_rect.h"
#include "core/input/input_event.h"
#include "core/os/os.h"
#include "servers/display_server.h"
#include "godot_bridge.h"
#include "editor/editor_interface.h"
#include "core/io/resource_loader.h"

class AIPanel : public VBoxContainer {
	GDCLASS(AIPanel, VBoxContainer);

private:
	// Tab system
	TabBar *tab_bar = nullptr;
	VBoxContainer *scene_tab = nullptr;      // Chat (current messages)
	VBoxContainer *blueprint_tab = nullptr;  // Task tracking
	VBoxContainer *diff_tab = nullptr;       // File changes
	VBoxContainer *agents_tab = nullptr;     // Multi-agent status
	int current_tab = 0;
	
	// Header elements
	Button *history_btn = nullptr;
	PopupMenu *history_popup = nullptr;
	LineEdit *session_name = nullptr;
	Button *new_session_btn = nullptr;
	int session_counter = 1;
	int current_session_id = 0;
	
	// Session storage
	struct ChatSession {
		int id;
		String name;
		Vector<Dictionary> messages;  // {sender, text, is_user}
	};
	Vector<ChatSession> saved_sessions;
	Vector<Dictionary> current_messages;  // Live message log for current session
	
	// Disk persistence
	void _save_sessions_to_disk();
	void _load_sessions_from_disk();
	String _get_sessions_path() const;
	
	// Blueprint tab elements
	VBoxContainer *blueprint_content = nullptr;
	
	// Diff tab elements
	VBoxContainer *diff_content = nullptr;
	
	// Agents tab elements
	VBoxContainer *agents_content = nullptr;
	Button *multi_agent_toggle_btn = nullptr;
	bool multi_agent_enabled = false;
	struct AgentStatus {
		String name;
		String role;
		String state;    // "idle", "working", "complete", "error"
		float progress;  // 0.0 - 1.0
	};
	Vector<AgentStatus> agent_statuses;
	
	// Scene tab (chat) elements
	VBoxContainer *messages_container = nullptr;
	ScrollContainer *chat_scroll = nullptr;
	PanelContainer *welcome_bubble = nullptr;  // Removed on first user message
	LineEdit *input_field = nullptr;
	Button *send_button = nullptr;
	OptionButton *model_picker = nullptr;
	HTTPRequest *http_request = nullptr;
	GodotBridge *bridge = nullptr;
	
	// WebSocket for streaming
	Ref<WebSocketPeer> ws_peer;
	Timer *ws_poll_timer = nullptr;
	bool ws_connected = false;
	
	// WebSocket reconnect backoff (prevents spam on server crash)
	uint64_t ws_last_reconnect_time = 0;       // Last reconnect attempt (msec)
	int ws_reconnect_attempts = 0;             // Consecutive failed attempts
	static const int WS_RECONNECT_BASE_MS = 1000;   // 1s base delay
	static const int WS_RECONNECT_MAX_MS = 30000;   // 30s max delay
	static const int WS_RECONNECT_MAX_ATTEMPTS = 50; // Stop logging after this
	
	// Thinking indicator (collapsible)
	PanelContainer *thinking_bubble = nullptr;
	Button *thinking_header = nullptr;       // Clickable header "Thought for Xs"
	VBoxContainer *thinking_content = nullptr;  // Collapsible content
	RichTextLabel *thinking_text = nullptr;  // Actual thought text
	bool thinking_expanded = false;
	uint64_t thinking_start_time = 0;
	float thinking_duration = 0.0;
	String streaming_text = "";
	String current_thought_text = "";
	
	// ═══════════════════════════════════════════════════════════════════════
	// 🌌 ANIMATION SYSTEM - Phase 2: Breathing Life
	// ═══════════════════════════════════════════════════════════════════════
	Timer *ui_anim_timer = nullptr;       // 30fps animation updates
	float anim_time = 0.0f;               // Continuous animation time
	float aurora_phase = 0.0f;            // 0-1 cycling for aurora gradient
	float thinking_pulse = 0.0f;          // Breathing effect intensity
	int orbiting_dot = 0;                 // Current dot in 0-2 rotation
	float dot_phase = 0.0f;               // Smooth dot animation phase
	float scroll_target = -1.0f;          // Target scroll position (-1 = no animation)
	float current_scroll = 0.0f;          // Current scroll for easing
	
	// Animation methods
	void _on_ui_anim_tick();              // Called every 33ms (30fps)
	void _update_aurora_border();         // Update thinking bubble border color
	void _update_orbiting_dots();         // Update orbiting header text
	void _update_smooth_scroll();         // Eased scroll animation
	Color _get_aurora_color(float phase); // Get color from aurora gradient
	
	// ═══════════════════════════════════════════════════════════════════════
	// ✨ PHASE 3+4: Connection Status, Typing Reveal, Neural Activity
	// ═══════════════════════════════════════════════════════════════════════
	Label *connection_indicator = nullptr;  // ◉ breathing status dot
	float connection_breathe = 0.0f;        // Breathing phase for indicator
	
	// Typing reveal for AI responses
	RichTextLabel *current_typing_label = nullptr;  // Currently revealing text
	String typing_full_text = "";                   // Full text to reveal
	int typing_char_index = 0;                      // Current character index
	float typing_phase = 0.0f;                      // Character reveal timing
	
	// Neural activity bar
	Label *neural_activity_bar = nullptr;          // Activity visualization
	float neural_activity = 0.0f;                  // Current activity level (0-1)
	
	// Ambient pulse
	float ambient_pulse = 0.0f;                    // Panel-wide ambient pulse
	bool receiving_data = false;                   // Currently receiving from WebSocket
	
	// Phase 3+4 methods
	void _update_connection_indicator();           // Breathing green/red dot
	void _update_typing_reveal();                  // Character-by-character reveal
	void _update_neural_activity();                // Activity bar animation
	void _start_typing_reveal(RichTextLabel *label, const String &text);
	
	// Files changed section
	VBoxContainer *files_section = nullptr;
	
	String current_model = "gemini-3-flash-preview";
	String ai_router_url = "http://localhost:9877/chat";
	String ws_url = "ws://localhost:9878";
	bool waiting_for_response = false;
	bool use_streaming = true;
	
	// AI Router process management
	OS::ProcessID ai_router_pid = 0;
	
	// Question handling
	String pending_question_id = "";
	String pending_question_default = "";
	
	// Approval handling
	String pending_approval_id = "";
	void _on_approval_response(bool p_approved);
	void _show_approval_ui(const String &p_tool_id, const String &p_tool_name, const String &p_question, const Dictionary &p_params);
	
	// Image attachment (clipboard paste support) - MULTI-IMAGE
	static const int MAX_PENDING_IMAGES = 5;            // Maximum images allowed
	HBoxContainer *image_preview_container = nullptr;   // Container for thumbnails
	Vector<Ref<Image>> pending_images;                  // Multiple images support
	Vector<Control*> thumbnail_containers;              // Containers with thumbnail + X button
	Window *image_popup = nullptr;                      // Fullscreen popup on click
	TextureRect *popup_image = nullptr;                 // Full-size image in popup
	Label *image_count_label = nullptr;                 // Shows "N images attached"
	
	void _on_input_gui_input(const Ref<InputEvent> &p_event);  // Handle paste
	void _add_pending_image(const Ref<Image> &p_image);        // Add image to queue
	void _update_image_thumbnails();                           // Update thumbnail display
	void _remove_pending_image(int p_index);                   // Remove specific image
	void _show_image_popup(int p_index);                       // Show image in popup
	void _on_thumb_gui_input(const Ref<InputEvent> &p_event, int p_index);  // Thumbnail clicked
	void _on_remove_image_pressed(int p_index);                // X button on thumbnail
	void _on_thumbnail_clicked();
	void _on_popup_close();
	void _clear_image_attachment();
	void _add_user_images_row(const Vector<Ref<Image>> &p_images);  // Add images as horizontal row in chat
	String _encode_image_base64(const Ref<Image> &p_image);

	void _on_send_pressed();
	void _on_input_submitted(const String &p_text);
	void _on_model_selected(int p_index);
	void _on_http_request_completed(int p_result, int p_code, const PackedStringArray &p_headers, const PackedByteArray &p_body);
	
	// WebSocket methods
	void _connect_websocket();
	void _poll_websocket();
	void _on_ws_message(const String &p_message);
	
	// Message bubble helpers
	void _add_message_bubble(const String &p_sender, const String &p_message, bool p_is_user);
	void _update_thinking_text(const String &p_text);
	void _show_thinking();
	void _hide_thinking();
	void _finalize_thinking();  // Hide streaming indicator
	void _on_thinking_toggle();
	void _add_thought_bubble(float p_duration, const String &p_content);
	void _on_thought_toggle(Button *p_header, ScrollContainer *p_scroll, const String &p_duration);
	void _update_files_changed(const Array &p_results);
	void _add_image_bubble(const String &p_path, const String &p_caption);
	void _add_user_image_bubble(const Ref<Image> &p_image);  // Display user's attached image in chat
	void _clear_files_section();
	
	void _send_to_ai_router(const String &p_message);
	void _send_via_websocket(const String &p_message);
	void _process_local_command(const String &p_command);
	void _scroll_to_bottom();
	
	// Tab methods
	void _on_tab_changed(int p_tab);
	void _update_blueprint_tab();
	void _add_diff_entry(const String &p_path, const String &p_status);
	void _on_diff_file_clicked(const String &p_path);
	void _add_rich_diff_entry(const String &p_path, const String &p_tool, const String &p_before, const String &p_after);
	void _clear_diff_entries();
	String _normalize_project_path(const String &p_path) const;
	String _find_res_path_by_basename(const String &p_basename, const String &p_dir) const;
	String _build_line_change_preview(const String &p_before, const String &p_after, int p_max_change_lines, int &r_added, int &r_removed) const;
	
	// Agents tab methods
	void _update_agents_tab();
	void _add_agent_status_row(const String &p_name, const String &p_role, const String &p_state, float p_progress);
	void _clear_agent_statuses();
	void _on_multi_agent_toggle();
	
	// Session methods
	void _on_new_session();
	void _clear_chat();
	void _on_history_pressed();
	void _on_history_selected(int p_id);
	void _save_current_session();
	void _load_session(int p_id);

protected:
	static void _bind_methods();

public:
	void set_bridge(GodotBridge *p_bridge);
	String get_current_model() const { return current_model; }
	
	// Multi-agent status methods
	void set_multi_agent_enabled(bool p_enabled);
	bool is_multi_agent_enabled() const { return multi_agent_enabled; }
	void update_agent_status(const String &p_name, const String &p_role, const String &p_state, float p_progress);
	void clear_all_agent_statuses();
	
	AIPanel();
	~AIPanel();
};

#endif // AI_PANEL_H
