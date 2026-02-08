#ifndef SPRITEMANCER_DOCK_H
#define SPRITEMANCER_DOCK_H

#include "scene/gui/box_container.h"
#include "scene/gui/button.h"
#include "scene/gui/line_edit.h"
#include "scene/gui/option_button.h"
#include "scene/gui/panel_container.h"
#include "scene/gui/texture_rect.h"
#include "scene/gui/scroll_container.h"
#include "scene/gui/label.h"
#include "scene/gui/grid_container.h"
#include "scene/gui/tab_bar.h"
#include "scene/gui/check_box.h"
#include "scene/gui/popup.h"
#include "scene/gui/popup_menu.h"
#include "scene/gui/file_dialog.h"
#include "scene/main/http_request.h"
#include "scene/main/timer.h"
#include "scene/resources/image_texture.h"
#include "core/input/input_event.h"
#include "core/io/marshalls.h"
#include "godot_bridge.h"

class SpriteMancerDock : public VBoxContainer {
	GDCLASS(SpriteMancerDock, VBoxContainer);

public:
	enum AssetType {
		ASSET_CHARACTER,
		ASSET_EFFECT,
		ASSET_TILE,
		ASSET_UI
	};

	enum DockState {
		STATE_IDLE,
		STATE_GENERATING,
		STATE_PREVIEW,
		STATE_APPROVED
	};

private:
	// Tab system
	TabBar *tab_bar = nullptr;
	VBoxContainer *generate_tab = nullptr;
	ScrollContainer *gallery_scroll = nullptr;
	GridContainer *gallery_grid = nullptr;
	int current_tab = 0;

	// Generate tab elements
	OptionButton *type_picker = nullptr;
	OptionButton *preset_picker = nullptr;
	LineEdit *prompt_input = nullptr;
	OptionButton *size_picker = nullptr;
	Button *generate_btn = nullptr;

	// Preview elements
	PanelContainer *preview_panel = nullptr;
	TextureRect *preview_image = nullptr;
	HBoxContainer *frame_controls = nullptr;
	Button *prev_frame_btn = nullptr;
	Button *next_frame_btn = nullptr;
	Button *play_btn = nullptr;
	Label *frame_label = nullptr;
	Timer *animation_timer = nullptr;

	// Action buttons
	Button *approve_btn = nullptr;
	Button *regenerate_btn = nullptr;
	Button *save_btn = nullptr;
	Button *edit_btn = nullptr;
	Button *settings_btn = nullptr;

	// Animation action picker (for approved characters)
	HBoxContainer *animation_row = nullptr;
	OptionButton *action_picker = nullptr;
	OptionButton *difficulty_picker = nullptr;
	Button *generate_anim_btn = nullptr;

	// Settings popup
	PopupPanel *settings_popup = nullptr;
	LineEdit *save_path_input = nullptr;
	Button *browse_path_btn = nullptr;
	CheckBox *auto_approve_effects = nullptr;
	CheckBox *auto_approve_tiles = nullptr;
	CheckBox *auto_approve_ui = nullptr;
	FileDialog *path_dialog = nullptr;

	// Status
	Label *status_label = nullptr;

	// HTTP client
	HTTPRequest *http_request = nullptr;
	GodotBridge *bridge = nullptr;

	// State
	DockState current_state = STATE_IDLE;
	AssetType current_type = ASSET_CHARACTER;
	String current_project_id = "";
	String current_image_base64 = "";
	int current_frame = 0;
	int total_frames = 1;
	bool is_playing = false;
	String save_path = "res://sprites/generated/";
	bool pending_animation_request = false;
	String current_animation_type = "";
	bool auto_approve_effects_enabled = true;
	bool auto_approve_tiles_enabled = true;
	bool auto_approve_ui_enabled = true;

	// Presets cache
	Dictionary presets_cache;

	// Methods
	void _on_type_selected(int p_index);
	void _on_preset_selected(int p_index);
	void _on_generate_pressed();
	void _on_approve_pressed();
	void _on_regenerate_pressed();
	void _on_save_pressed();
	void _on_edit_pressed();
	void _on_tab_changed(int p_tab);
	void _on_settings_pressed();
	void _on_path_browse();
	void _on_path_selected(const String &p_path);
	void _on_generate_animation_pressed();

	// Frame controls
	void _on_prev_frame();
	void _on_next_frame();
	void _on_play_pressed();
	void _on_animation_tick();

	// HTTP handling
	void _on_http_completed(int p_result, int p_code, const PackedStringArray &p_headers, const PackedByteArray &p_body);
	void _request_presets();
	void _generate_asset();

	// Gallery
	void _refresh_gallery();
	void _on_gallery_item_clicked(const String &p_path);
	void _on_gallery_item_input(const Ref<InputEvent> &p_event, const String &p_path);
	void _show_gallery_context_menu(const String &p_path, const Vector2 &p_pos);
	void _on_gallery_context_action(int p_id, const String &p_path);

	// State management
	void _set_state(DockState p_state);
	void _update_ui();
	void _load_preview_image(const String &p_base64);
	void _clear_preview();

protected:
	static void _bind_methods();

public:
	void set_bridge(GodotBridge *p_bridge);
	void set_save_path(const String &p_path) { save_path = p_path; }
	String get_save_path() const { return save_path; }

	// External control (for AI)
	void generate_from_prompt(const String &p_prompt, AssetType p_type);
	void approve_current();
	void open_editor();
	String get_current_project_id() const { return current_project_id; }
	Ref<ImageTexture> get_current_texture() const { return preview_image ? Object::cast_to<ImageTexture>(preview_image->get_texture().ptr()) : nullptr; }

	SpriteMancerDock();
};

VARIANT_ENUM_CAST(SpriteMancerDock::AssetType);
VARIANT_ENUM_CAST(SpriteMancerDock::DockState);

#endif // SPRITEMANCER_DOCK_H
