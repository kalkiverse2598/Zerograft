#ifndef SPRITEMANCER_MAIN_SCREEN_H
#define SPRITEMANCER_MAIN_SCREEN_H

#include "scene/gui/box_container.h"
#include "scene/gui/label.h"
#include "scene/gui/button.h"
#include "scene/gui/panel_container.h"
#include "scene/gui/texture_rect.h"
#include "scene/main/http_request.h"
#include "scene/resources/image_texture.h"
#include "core/input/input_event.h"
#include "godot_bridge.h"

class DragDropTextureRect;  // Forward declaration

// SpriteMancer main screen - displays in central viewport
// This provides a native preview panel, but the full pixel editor
// can be accessed via browser at spritemancer.zerograft.online

class SpriteMancerMainScreen : public VBoxContainer {
	GDCLASS(SpriteMancerMainScreen, VBoxContainer);

private:
	// Header bar
	HBoxContainer *header = nullptr;
	Label *title_label = nullptr;
	Button *open_browser_btn = nullptr;
	Button *refresh_btn = nullptr;
	Button *embed_toggle_btn = nullptr;

	// Main content area
	PanelContainer *content_panel = nullptr;
	VBoxContainer *content = nullptr;

	// Preview
	TextureRect *preview_image = nullptr;
	Label *status_label = nullptr;

	// Controls
	HBoxContainer *controls = nullptr;
	Button *prev_btn = nullptr;
	Button *play_btn = nullptr;
	Button *next_btn = nullptr;
	Label *frame_label = nullptr;

	// HTTP
	HTTPRequest *http_request = nullptr;
	GodotBridge *bridge = nullptr;

	// State
	String current_project_url = "";
	String frontend_url = "https://spritemancer.zerograft.online";
	String current_project_id = "";
	bool embedded_mode = false;
	
	// Embedded editor (loaded dynamically via GDScript)
	Control *embedded_editor = nullptr;
	TextureRect *browser_texture_rect = nullptr;
	Object *cef_browser = nullptr;  // GDBrowserView*

	void _on_open_browser();
	void _on_refresh();
	void _on_prev_frame();
	void _on_next_frame();
	void _on_play();
	void _on_toggle_embedded();
	void _load_embedded_editor();
	void _unload_embedded_editor();
	void _on_browser_input(const Ref<InputEvent> &p_event);
	void _on_browser_resized();
	void _notification(int p_what);

protected:
	static void _bind_methods();

public:
	void set_bridge(GodotBridge *p_bridge);
	void load_project(const String &p_project_id);
	void set_frontend_url(const String &p_url) { frontend_url = p_url; }
	void on_project_loaded(const String &p_project_id, Ref<ImageTexture> p_texture);
	void toggle_embedded_mode(bool p_enabled);
	Control *get_embedded_editor() { return embedded_editor; }
	String get_current_project_id() { return current_project_id; }

	SpriteMancerMainScreen();
};

#endif // SPRITEMANCER_MAIN_SCREEN_H
