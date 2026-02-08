#include "spritemancer_dock.h"
#include "scene/gui/separator.h"
#include "scene/resources/style_box_flat.h"
#include "core/io/json.h"
#include "core/io/dir_access.h"
#include "core/io/file_access.h"
#include "editor/editor_file_system.h"

void SpriteMancerDock::_bind_methods() {
	ClassDB::bind_method(D_METHOD("_on_type_selected", "index"), &SpriteMancerDock::_on_type_selected);
	ClassDB::bind_method(D_METHOD("_on_preset_selected", "index"), &SpriteMancerDock::_on_preset_selected);
	ClassDB::bind_method(D_METHOD("_on_generate_pressed"), &SpriteMancerDock::_on_generate_pressed);
	ClassDB::bind_method(D_METHOD("_on_approve_pressed"), &SpriteMancerDock::_on_approve_pressed);
	ClassDB::bind_method(D_METHOD("_on_regenerate_pressed"), &SpriteMancerDock::_on_regenerate_pressed);
	ClassDB::bind_method(D_METHOD("_on_save_pressed"), &SpriteMancerDock::_on_save_pressed);
	ClassDB::bind_method(D_METHOD("_on_edit_pressed"), &SpriteMancerDock::_on_edit_pressed);
	ClassDB::bind_method(D_METHOD("_on_tab_changed", "tab"), &SpriteMancerDock::_on_tab_changed);
	ClassDB::bind_method(D_METHOD("_on_prev_frame"), &SpriteMancerDock::_on_prev_frame);
	ClassDB::bind_method(D_METHOD("_on_next_frame"), &SpriteMancerDock::_on_next_frame);
	ClassDB::bind_method(D_METHOD("_on_play_pressed"), &SpriteMancerDock::_on_play_pressed);
	ClassDB::bind_method(D_METHOD("_on_animation_tick"), &SpriteMancerDock::_on_animation_tick);
	ClassDB::bind_method(D_METHOD("_on_http_completed", "result", "code", "headers", "body"), &SpriteMancerDock::_on_http_completed);
	ClassDB::bind_method(D_METHOD("_on_settings_pressed"), &SpriteMancerDock::_on_settings_pressed);
	ClassDB::bind_method(D_METHOD("_on_path_browse"), &SpriteMancerDock::_on_path_browse);
	ClassDB::bind_method(D_METHOD("_on_path_selected", "path"), &SpriteMancerDock::_on_path_selected);
	ClassDB::bind_method(D_METHOD("_on_generate_animation_pressed"), &SpriteMancerDock::_on_generate_animation_pressed);
	ClassDB::bind_method(D_METHOD("_on_gallery_item_clicked", "path"), &SpriteMancerDock::_on_gallery_item_clicked);
	ClassDB::bind_method(D_METHOD("_on_gallery_context_action", "id", "path"), &SpriteMancerDock::_on_gallery_context_action);
	
	// Signal when project is loaded (for main screen sync)
	ADD_SIGNAL(MethodInfo("project_loaded", PropertyInfo(Variant::STRING, "project_id"), PropertyInfo(Variant::OBJECT, "texture")));
}

void SpriteMancerDock::set_bridge(GodotBridge *p_bridge) {
	bridge = p_bridge;
}

SpriteMancerDock::SpriteMancerDock() {
	set_name("SpriteMancer");
	set_v_size_flags(SIZE_EXPAND_FILL);

	// === Tab Bar ===
	tab_bar = memnew(TabBar);
	tab_bar->add_tab("Generate");
	tab_bar->add_tab("Gallery");
	tab_bar->connect("tab_changed", callable_mp(this, &SpriteMancerDock::_on_tab_changed));
	add_child(tab_bar);

	// === Generate Tab ===
	generate_tab = memnew(VBoxContainer);
	generate_tab->set_v_size_flags(SIZE_EXPAND_FILL);
	add_child(generate_tab);

	// Type picker row
	HBoxContainer *type_row = memnew(HBoxContainer);
	generate_tab->add_child(type_row);

	Label *type_label = memnew(Label);
	type_label->set_text("Type:");
	type_row->add_child(type_label);

	type_picker = memnew(OptionButton);
	type_picker->add_item("Character", ASSET_CHARACTER);
	type_picker->add_item("Effect", ASSET_EFFECT);
	type_picker->add_item("Tile", ASSET_TILE);
	type_picker->add_item("UI Element", ASSET_UI);
	type_picker->set_h_size_flags(SIZE_EXPAND_FILL);
	type_picker->connect("item_selected", callable_mp(this, &SpriteMancerDock::_on_type_selected));
	type_row->add_child(type_picker);

	// Preset picker row
	HBoxContainer *preset_row = memnew(HBoxContainer);
	generate_tab->add_child(preset_row);

	Label *preset_label = memnew(Label);
	preset_label->set_text("Preset:");
	preset_row->add_child(preset_label);

	preset_picker = memnew(OptionButton);
	preset_picker->add_item("Custom...");
	preset_picker->set_h_size_flags(SIZE_EXPAND_FILL);
	preset_picker->connect("item_selected", callable_mp(this, &SpriteMancerDock::_on_preset_selected));
	preset_row->add_child(preset_picker);

	// Prompt input
	prompt_input = memnew(LineEdit);
	prompt_input->set_placeholder("Describe what to generate...");
	prompt_input->set_h_size_flags(SIZE_EXPAND_FILL);
	generate_tab->add_child(prompt_input);

	// Size picker row
	HBoxContainer *size_row = memnew(HBoxContainer);
	generate_tab->add_child(size_row);

	Label *size_label = memnew(Label);
	size_label->set_text("Size:");
	size_row->add_child(size_label);

	size_picker = memnew(OptionButton);
	size_picker->add_item("16x16");
	size_picker->add_item("32x32");
	size_picker->add_item("64x64");
	size_picker->add_item("128x128");
	size_picker->select(1); // Default 32x32
	size_picker->set_h_size_flags(SIZE_EXPAND_FILL);
	size_row->add_child(size_picker);

	// Generate button
	generate_btn = memnew(Button);
	generate_btn->set_text("🎨 Generate");
	generate_btn->connect("pressed", callable_mp(this, &SpriteMancerDock::_on_generate_pressed));
	generate_tab->add_child(generate_btn);

	// Separator
	generate_tab->add_child(memnew(HSeparator));

	// Preview panel
	preview_panel = memnew(PanelContainer);
	preview_panel->set_v_size_flags(SIZE_EXPAND_FILL);
	preview_panel->set_custom_minimum_size(Size2(200, 200));
	generate_tab->add_child(preview_panel);

	VBoxContainer *preview_content = memnew(VBoxContainer);
	preview_panel->add_child(preview_content);

	preview_image = memnew(TextureRect);
	preview_image->set_stretch_mode(TextureRect::STRETCH_KEEP_ASPECT_CENTERED);
	preview_image->set_expand_mode(TextureRect::EXPAND_FIT_WIDTH_PROPORTIONAL);
	preview_image->set_v_size_flags(SIZE_EXPAND_FILL);
	preview_content->add_child(preview_image);

	// Frame controls
	frame_controls = memnew(HBoxContainer);
	frame_controls->set_alignment(BoxContainer::ALIGNMENT_CENTER);
	frame_controls->set_visible(false);
	preview_content->add_child(frame_controls);

	prev_frame_btn = memnew(Button);
	prev_frame_btn->set_text("◀");
	prev_frame_btn->connect("pressed", callable_mp(this, &SpriteMancerDock::_on_prev_frame));
	frame_controls->add_child(prev_frame_btn);

	play_btn = memnew(Button);
	play_btn->set_text("▶");
	play_btn->connect("pressed", callable_mp(this, &SpriteMancerDock::_on_play_pressed));
	frame_controls->add_child(play_btn);

	next_frame_btn = memnew(Button);
	next_frame_btn->set_text("▶");
	next_frame_btn->connect("pressed", callable_mp(this, &SpriteMancerDock::_on_next_frame));
	frame_controls->add_child(next_frame_btn);

	frame_label = memnew(Label);
	frame_label->set_text("1/1");
	frame_controls->add_child(frame_label);

	// Animation timer
	animation_timer = memnew(Timer);
	animation_timer->set_wait_time(0.1);
	animation_timer->connect("timeout", callable_mp(this, &SpriteMancerDock::_on_animation_tick));
	add_child(animation_timer);

	// Status label
	status_label = memnew(Label);
	status_label->set_text("Ready");
	status_label->set_horizontal_alignment(HORIZONTAL_ALIGNMENT_CENTER);
	generate_tab->add_child(status_label);

	// Action buttons row
	HBoxContainer *action_row = memnew(HBoxContainer);
	generate_tab->add_child(action_row);

	approve_btn = memnew(Button);
	approve_btn->set_text("✓ Approve");
	approve_btn->connect("pressed", callable_mp(this, &SpriteMancerDock::_on_approve_pressed));
	approve_btn->set_visible(false);
	action_row->add_child(approve_btn);

	regenerate_btn = memnew(Button);
	regenerate_btn->set_text("↻ Redo");
	regenerate_btn->connect("pressed", callable_mp(this, &SpriteMancerDock::_on_regenerate_pressed));
	regenerate_btn->set_visible(false);
	action_row->add_child(regenerate_btn);

	// Save/Edit buttons
	HBoxContainer *save_row = memnew(HBoxContainer);
	generate_tab->add_child(save_row);

	save_btn = memnew(Button);
	save_btn->set_text("💾 Save to Project");
	save_btn->set_h_size_flags(SIZE_EXPAND_FILL);
	save_btn->connect("pressed", callable_mp(this, &SpriteMancerDock::_on_save_pressed));
	save_btn->set_visible(false);
	save_row->add_child(save_btn);

	edit_btn = memnew(Button);
	edit_btn->set_text("🔧 Edit");
	edit_btn->connect("pressed", callable_mp(this, &SpriteMancerDock::_on_edit_pressed));
	edit_btn->set_visible(false);
	save_row->add_child(edit_btn);

	// Settings button
	settings_btn = memnew(Button);
	settings_btn->set_text("⚙");
	settings_btn->set_tooltip_text("Settings");
	settings_btn->connect("pressed", callable_mp(this, &SpriteMancerDock::_on_settings_pressed));
	save_row->add_child(settings_btn);

	// Animation row (for approved characters)
	animation_row = memnew(HBoxContainer);
	animation_row->set_visible(false);
	generate_tab->add_child(animation_row);

	Label *action_label = memnew(Label);
	action_label->set_text("Action:");
	animation_row->add_child(action_label);

	action_picker = memnew(OptionButton);
	action_picker->add_item("Idle");
	action_picker->add_item("Walk");
	action_picker->add_item("Run");
	action_picker->add_item("Attack");
	action_picker->add_item("Jump");
	action_picker->add_item("Death");
	action_picker->set_h_size_flags(SIZE_EXPAND_FILL);
	animation_row->add_child(action_picker);

	difficulty_picker = memnew(OptionButton);
	difficulty_picker->add_item("LIGHT");
	difficulty_picker->add_item("HEAVY");
	difficulty_picker->add_item("BOSS");
	animation_row->add_child(difficulty_picker);

	generate_anim_btn = memnew(Button);
	generate_anim_btn->set_text("🎬 Animate");
	generate_anim_btn->connect("pressed", callable_mp(this, &SpriteMancerDock::_on_generate_animation_pressed));
	animation_row->add_child(generate_anim_btn);

	// === Settings Popup ===
	settings_popup = memnew(PopupPanel);
	settings_popup->set_title("SpriteMancer Settings");
	add_child(settings_popup);

	VBoxContainer *settings_content = memnew(VBoxContainer);
	settings_content->set_custom_minimum_size(Size2(300, 200));
	settings_popup->add_child(settings_content);

	// Save path setting
	HBoxContainer *path_row = memnew(HBoxContainer);
	settings_content->add_child(path_row);

	Label *path_label = memnew(Label);
	path_label->set_text("Save Path:");
	path_row->add_child(path_label);

	save_path_input = memnew(LineEdit);
	save_path_input->set_text(save_path);
	save_path_input->set_h_size_flags(SIZE_EXPAND_FILL);
	path_row->add_child(save_path_input);

	browse_path_btn = memnew(Button);
	browse_path_btn->set_text("...");
	browse_path_btn->connect("pressed", callable_mp(this, &SpriteMancerDock::_on_path_browse));
	path_row->add_child(browse_path_btn);

	// Auto-approve settings
	Label *auto_label = memnew(Label);
	auto_label->set_text("Auto-Approve:");
	settings_content->add_child(auto_label);

	auto_approve_effects = memnew(CheckBox);
	auto_approve_effects->set_text("Effects");
	auto_approve_effects->set_pressed(auto_approve_effects_enabled);
	settings_content->add_child(auto_approve_effects);

	auto_approve_tiles = memnew(CheckBox);
	auto_approve_tiles->set_text("Tiles");
	auto_approve_tiles->set_pressed(auto_approve_tiles_enabled);
	settings_content->add_child(auto_approve_tiles);

	auto_approve_ui = memnew(CheckBox);
	auto_approve_ui->set_text("UI Elements");
	auto_approve_ui->set_pressed(auto_approve_ui_enabled);
	settings_content->add_child(auto_approve_ui);

	// Path dialog
	path_dialog = memnew(FileDialog);
	path_dialog->set_file_mode(FileDialog::FILE_MODE_OPEN_DIR);
	path_dialog->set_access(FileDialog::ACCESS_RESOURCES);
	path_dialog->connect("dir_selected", callable_mp(this, &SpriteMancerDock::_on_path_selected));
	add_child(path_dialog);

	// === Gallery Tab (hidden by default) ===
	gallery_scroll = memnew(ScrollContainer);
	gallery_scroll->set_v_size_flags(SIZE_EXPAND_FILL);
	gallery_scroll->set_visible(false);
	add_child(gallery_scroll);

	gallery_grid = memnew(GridContainer);
	gallery_grid->set_columns(3);
	gallery_scroll->add_child(gallery_grid);

	// HTTP Request node
	http_request = memnew(HTTPRequest);
	http_request->connect("request_completed", callable_mp(this, &SpriteMancerDock::_on_http_completed));
	add_child(http_request);

	_set_state(STATE_IDLE);
}

// ============================================================================
// Tab handling
// ============================================================================

void SpriteMancerDock::_on_tab_changed(int p_tab) {
	current_tab = p_tab;
	generate_tab->set_visible(p_tab == 0);
	gallery_scroll->set_visible(p_tab == 1);

	if (p_tab == 1) {
		_refresh_gallery();
	}
}

// ============================================================================
// State management
// ============================================================================

void SpriteMancerDock::_set_state(DockState p_state) {
	current_state = p_state;
	_update_ui();
}

void SpriteMancerDock::_update_ui() {
	// Hide animation row by default
	if (animation_row) {
		animation_row->set_visible(false);
	}

	switch (current_state) {
		case STATE_IDLE:
			status_label->set_text("Ready");
			generate_btn->set_disabled(false);
			approve_btn->set_visible(false);
			regenerate_btn->set_visible(false);
			save_btn->set_visible(false);
			edit_btn->set_visible(false);
			break;

		case STATE_GENERATING:
			status_label->set_text("Generating...");
			generate_btn->set_disabled(true);
			approve_btn->set_visible(false);
			regenerate_btn->set_visible(false);
			save_btn->set_visible(false);
			edit_btn->set_visible(false);
			break;

		case STATE_PREVIEW:
			status_label->set_text("Review generated asset");
			generate_btn->set_disabled(false);
			approve_btn->set_visible(true);
			regenerate_btn->set_visible(true);
			save_btn->set_visible(false);
			edit_btn->set_visible(true);
			break;

		case STATE_APPROVED:
			status_label->set_text("Ready to save");
			generate_btn->set_disabled(false);
			approve_btn->set_visible(false);
			regenerate_btn->set_visible(true);
			save_btn->set_visible(true);
			edit_btn->set_visible(true);
			// Show animation row for characters
			if (current_type == ASSET_CHARACTER && animation_row) {
				animation_row->set_visible(true);
				status_label->set_text("Ready to save or animate");
			}
			break;
	}
}

// ============================================================================
// Type selection
// ============================================================================

void SpriteMancerDock::_on_type_selected(int p_index) {
	current_type = (AssetType)p_index;

	// Update preset list based on type
	preset_picker->clear();
	preset_picker->add_item("Custom...");

	// TODO: Load presets from backend
	// For now, add some hardcoded examples
	switch (current_type) {
		case ASSET_CHARACTER:
			preset_picker->add_item("Knight");
			preset_picker->add_item("Wizard");
			preset_picker->add_item("Archer");
			break;
		case ASSET_EFFECT:
			preset_picker->add_item("Fire Explosion");
			preset_picker->add_item("Ice Shatter");
			preset_picker->add_item("Lightning Bolt");
			preset_picker->add_item("Smoke Puff");
			break;
		case ASSET_TILE:
			preset_picker->add_item("Water");
			preset_picker->add_item("Lava");
			preset_picker->add_item("Grass");
			break;
		case ASSET_UI:
			preset_picker->add_item("Gold Coin");
			preset_picker->add_item("Red Heart");
			preset_picker->add_item("Blue Gem");
			break;
	}
}

void SpriteMancerDock::_on_preset_selected(int p_index) {
	if (p_index > 0) {
		prompt_input->set_text(preset_picker->get_item_text(p_index));
	}
}

// ============================================================================
// Generation
// ============================================================================

void SpriteMancerDock::_on_generate_pressed() {
	String prompt = prompt_input->get_text().strip_edges();
	if (prompt.is_empty()) {
		status_label->set_text("Please enter a description");
		return;
	}

	_generate_asset();
}

void SpriteMancerDock::_generate_asset() {
	_set_state(STATE_GENERATING);

	String prompt = prompt_input->get_text().strip_edges();
	String size = size_picker->get_item_text(size_picker->get_selected());

	// Build request body
	Dictionary body;
	body["prompt"] = prompt;
	body["size"] = size;
	body["remove_background"] = true;

	String asset_type_str;
	switch (current_type) {
		case ASSET_CHARACTER:
			asset_type_str = "character";
			body["perspective"] = "side";
			body["style"] = "modern_pixel";
			break;
		case ASSET_EFFECT:
			asset_type_str = "effect";
			body["frame_count"] = 6;
			break;
		case ASSET_TILE:
			asset_type_str = "tile";
			body["frame_count"] = 4;
			body["seamless"] = true;
			break;
		case ASSET_UI:
			asset_type_str = "ui";
			body["frame_count"] = 6;
			break;
	}

	body["asset_type"] = asset_type_str;

	String json_body = JSON::stringify(body);

	PackedStringArray headers;
	headers.push_back("Content-Type: application/json");

	String url = "https://api.zerograft.online/api/ai/generate-asset";
	Error err = http_request->request(url, headers, HTTPClient::METHOD_POST, json_body);

	if (err != OK) {
		status_label->set_text("Request failed");
		_set_state(STATE_IDLE);
	}
}

void SpriteMancerDock::_on_http_completed(int p_result, int p_code, const PackedStringArray &p_headers, const PackedByteArray &p_body) {
	if (p_code != 200) {
		status_label->set_text("Generation failed: " + String::num(p_code));
		_set_state(STATE_IDLE);
		return;
	}

	String response_text;
	response_text.parse_utf8((const char *)p_body.ptr(), p_body.size());

	JSON json;
	Error err = json.parse(response_text);
	if (err != OK) {
		status_label->set_text("Invalid response");
		_set_state(STATE_IDLE);
		return;
	}

	Dictionary response = json.get_data();

	// Handle animation pipeline responses separately
	if (pending_animation_request) {
		pending_animation_request = false;

		String status = response.get("status", "");
		if (status == "error" || status == "failed") {
			String msg = response.get("error", "Animation generation failed");
			status_label->set_text(msg);
			_set_state(STATE_IDLE);
			return;
		}

		// Pipeline completed — extract frame info
		Array frame_urls;
		if (response.has("frame_urls")) {
			frame_urls = response["frame_urls"];
		}

		int frame_count = frame_urls.size();
		if (frame_count > 0) {
			total_frames = frame_count;
			current_frame = 0;
			status_label->set_text(current_animation_type + " animation ready (" + String::num(frame_count) + " frames)");
			_set_state(STATE_APPROVED);

			// Navigate browser to the project's preview page
			emit_signal("project_loaded", current_project_id, Ref<ImageTexture>());
		} else {
			status_label->set_text(current_animation_type + " animation generated (check preview)");
			_set_state(STATE_APPROVED);
			emit_signal("project_loaded", current_project_id, Ref<ImageTexture>());
		}
		return;
	}

	// Extract base64 image (asset generation response)
	String base64_key = "";
	if (response.has("reference_image_base64")) {
		base64_key = "reference_image_base64";
	} else if (response.has("spritesheet_base64")) {
		base64_key = "spritesheet_base64";
	}

	if (!base64_key.is_empty()) {
		current_image_base64 = response[base64_key];
		current_project_id = response.get("project_id", "");

		_load_preview_image(current_image_base64);
		_set_state(STATE_PREVIEW);
	} else {
		status_label->set_text("No image in response");
		_set_state(STATE_IDLE);
	}
}

void SpriteMancerDock::_load_preview_image(const String &p_base64) {
	// Decode base64 to image
	PackedByteArray data = p_base64.to_utf8_buffer();
	data = core_bind::Marshalls::get_singleton()->base64_to_raw(p_base64);

	Ref<Image> img;
	img.instantiate();
	Error err = img->load_png_from_buffer(data);

	if (err == OK) {
		Ref<ImageTexture> tex = ImageTexture::create_from_image(img);
		preview_image->set_texture(tex);
		
		// Emit signal for main screen sync
		emit_signal("project_loaded", current_project_id, tex);
	} else {
		status_label->set_text("Failed to load image");
	}
}

void SpriteMancerDock::_clear_preview() {
	preview_image->set_texture(nullptr);
	current_image_base64 = "";
	current_project_id = "";
}

// ============================================================================
// Action buttons
// ============================================================================

void SpriteMancerDock::_on_approve_pressed() {
	_set_state(STATE_APPROVED);
}

void SpriteMancerDock::_on_regenerate_pressed() {
	_generate_asset();
}

void SpriteMancerDock::_on_save_pressed() {
	if (current_image_base64.is_empty()) {
		status_label->set_text("No image to save");
		return;
	}

	// Ensure save directory exists
	Ref<DirAccess> dir = DirAccess::open("res://");
	if (dir.is_valid()) {
		dir->make_dir_recursive(save_path.replace("res://", ""));
	}

	// Generate filename
	String filename = prompt_input->get_text().strip_edges();
	filename = filename.replace(" ", "_").to_lower();
	filename = filename.substr(0, 20);
	if (filename.is_empty()) {
		filename = "sprite";
	}
	filename += "_" + current_project_id.substr(0, 8) + ".png";

	String full_path = save_path + filename;

	// Decode and save
	PackedByteArray data = core_bind::Marshalls::get_singleton()->base64_to_raw(current_image_base64);

	Ref<FileAccess> file = FileAccess::open(full_path, FileAccess::WRITE);
	if (file.is_valid()) {
		file->store_buffer(data);
		file->close();

		// Refresh Godot filesystem
		EditorFileSystem::get_singleton()->scan();

		status_label->set_text("Saved: " + full_path);
	} else {
		status_label->set_text("Failed to save file");
	}
}

void SpriteMancerDock::_on_edit_pressed() {
	// Open SpriteMancer main screen
	// TODO: Implement main screen switching
	status_label->set_text("Opening editor...");
}

// ============================================================================
// Frame controls
// ============================================================================

void SpriteMancerDock::_on_prev_frame() {
	if (current_frame > 0) {
		current_frame--;
		frame_label->set_text(String::num(current_frame + 1) + "/" + String::num(total_frames));
		// TODO: Update preview to show specific frame
	}
}

void SpriteMancerDock::_on_next_frame() {
	if (current_frame < total_frames - 1) {
		current_frame++;
		frame_label->set_text(String::num(current_frame + 1) + "/" + String::num(total_frames));
		// TODO: Update preview to show specific frame
	}
}

void SpriteMancerDock::_on_play_pressed() {
	is_playing = !is_playing;
	if (is_playing) {
		play_btn->set_text("⏸");
		animation_timer->start();
	} else {
		play_btn->set_text("▶");
		animation_timer->stop();
	}
}

void SpriteMancerDock::_on_animation_tick() {
	current_frame = (current_frame + 1) % total_frames;
	frame_label->set_text(String::num(current_frame + 1) + "/" + String::num(total_frames));
	// TODO: Update preview to show specific frame
}

// ============================================================================
// Gallery
// ============================================================================

void SpriteMancerDock::_refresh_gallery() {
	// Clear existing items
	while (gallery_grid->get_child_count() > 0) {
		Node *child = gallery_grid->get_child(0);
		gallery_grid->remove_child(child);
		child->queue_free();
	}

	// Load images from save_path
	Ref<DirAccess> dir = DirAccess::open(save_path);
	if (!dir.is_valid()) {
		// Show empty state
		Label *empty = memnew(Label);
		empty->set_text("No generated assets yet");
		empty->set_horizontal_alignment(HORIZONTAL_ALIGNMENT_CENTER);
		gallery_grid->add_child(empty);
		return;
	}

	dir->list_dir_begin();
	String filename = dir->get_next();
	int count = 0;

	while (!filename.is_empty()) {
		if (!dir->current_is_dir() && filename.ends_with(".png")) {
			String full_path = save_path + filename;

			// Create thumbnail container
			VBoxContainer *item = memnew(VBoxContainer);
			item->set_custom_minimum_size(Size2(72, 80));
			item->set_meta("path", full_path);

			// Load image as texture
			Ref<Image> img;
			img.instantiate();
			Error err = img->load(full_path);

			Button *thumb = memnew(Button);
			thumb->set_custom_minimum_size(Size2(64, 64));
			thumb->set_meta("path", full_path);
			thumb->set_tooltip_text(filename);

			if (err == OK) {
				// Resize for thumbnail
				img->resize(64, 64, Image::INTERPOLATE_NEAREST);
				Ref<ImageTexture> tex = ImageTexture::create_from_image(img);
				thumb->set_icon(tex);
				thumb->set_icon_alignment(HORIZONTAL_ALIGNMENT_CENTER);
			} else {
				thumb->set_text(filename.get_basename().substr(0, 6));
			}

			// Connect click handlers
			thumb->connect("pressed", callable_mp(this, &SpriteMancerDock::_on_gallery_item_clicked).bind(full_path));
			thumb->connect("gui_input", callable_mp(this, &SpriteMancerDock::_on_gallery_item_input).bind(full_path));

			item->add_child(thumb);

			// Label below thumbnail
			Label *name_label = memnew(Label);
			name_label->set_text(filename.get_basename().substr(0, 8));
			name_label->set_horizontal_alignment(HORIZONTAL_ALIGNMENT_CENTER);
			name_label->add_theme_font_size_override("font_size", 10);
			item->add_child(name_label);

			gallery_grid->add_child(item);
			count++;
		}
		filename = dir->get_next();
	}

	if (count == 0) {
		Label *empty = memnew(Label);
		empty->set_text("No generated assets yet");
		empty->set_horizontal_alignment(HORIZONTAL_ALIGNMENT_CENTER);
		gallery_grid->add_child(empty);
	}
}

void SpriteMancerDock::_on_gallery_item_clicked(const String &p_path) {
	// Load selected asset into preview
	Ref<Image> img;
	img.instantiate();
	Error err = img->load(p_path);

	if (err == OK) {
		Ref<ImageTexture> tex = ImageTexture::create_from_image(img);
		preview_image->set_texture(tex);

		// Switch to generate tab to show preview
		tab_bar->set_current_tab(0);
		_on_tab_changed(0);

		status_label->set_text("Loaded: " + p_path.get_file());
	}
}

void SpriteMancerDock::_on_gallery_item_input(const Ref<InputEvent> &p_event, const String &p_path) {
	Ref<InputEventMouseButton> mb = p_event;
	if (mb.is_valid() && mb->is_pressed() && mb->get_button_index() == MouseButton::RIGHT) {
		// Show context menu
		_show_gallery_context_menu(p_path, mb->get_global_position());
	}
}

void SpriteMancerDock::_show_gallery_context_menu(const String &p_path, const Vector2 &p_pos) {
	// Create popup menu if not exists
	PopupMenu *menu = memnew(PopupMenu);
	menu->add_item("Use as Reference", 0);
	menu->add_item("Generate Animation", 1);
	menu->add_separator();
	menu->add_item("Delete", 2);
	menu->set_meta("path", p_path);
	menu->connect("id_pressed", callable_mp(this, &SpriteMancerDock::_on_gallery_context_action).bind(p_path));

	add_child(menu);
	menu->set_position(p_pos);
	menu->popup();
}

void SpriteMancerDock::_on_gallery_context_action(int p_id, const String &p_path) {
	switch (p_id) {
		case 0: // Use as Reference
			_on_gallery_item_clicked(p_path);
			status_label->set_text("Reference loaded: " + p_path.get_file());
			break;
		case 1: // Generate Animation
			_on_gallery_item_clicked(p_path);
			// TODO: Trigger animation workflow
			status_label->set_text("Ready to animate");
			break;
		case 2: // Delete
			{
				Ref<DirAccess> dir = DirAccess::open(save_path);
				if (dir.is_valid()) {
					dir->remove(p_path.get_file());
					_refresh_gallery();
					status_label->set_text("Deleted: " + p_path.get_file());
				}
			}
			break;
	}
}

// ============================================================================
// External control (for AI)
// ============================================================================

void SpriteMancerDock::generate_from_prompt(const String &p_prompt, AssetType p_type) {
	type_picker->select((int)p_type);
	_on_type_selected((int)p_type);
	prompt_input->set_text(p_prompt);
	_generate_asset();
}

void SpriteMancerDock::approve_current() {
	if (current_state == STATE_PREVIEW) {
		_on_approve_pressed();
	}
}

void SpriteMancerDock::open_editor() {
	_on_edit_pressed();
}

// ============================================================================
// Settings
// ============================================================================

void SpriteMancerDock::_on_settings_pressed() {
	// Update settings from state
	if (save_path_input) {
		save_path_input->set_text(save_path);
	}
	if (auto_approve_effects) {
		auto_approve_effects->set_pressed(auto_approve_effects_enabled);
	}
	if (auto_approve_tiles) {
		auto_approve_tiles->set_pressed(auto_approve_tiles_enabled);
	}
	if (auto_approve_ui) {
		auto_approve_ui->set_pressed(auto_approve_ui_enabled);
	}

	// Show popup near settings button
	if (settings_popup && settings_btn) {
		settings_popup->popup_centered();
	}
}

void SpriteMancerDock::_on_path_browse() {
	if (path_dialog) {
		path_dialog->popup_centered_ratio(0.7);
	}
}

void SpriteMancerDock::_on_path_selected(const String &p_path) {
	save_path = p_path;
	if (!save_path.ends_with("/")) {
		save_path += "/";
	}
	if (save_path_input) {
		save_path_input->set_text(save_path);
	}
	status_label->set_text("Save path: " + save_path);
}

// ============================================================================
// Animation Generation
// ============================================================================

void SpriteMancerDock::_on_generate_animation_pressed() {
	if (current_project_id.is_empty()) {
		status_label->set_text("No character to animate");
		return;
	}

	String action = action_picker->get_item_text(action_picker->get_selected()).to_lower();
	String difficulty = difficulty_picker->get_item_text(difficulty_picker->get_selected());

	status_label->set_text("Generating " + action + " animation (this may take a minute)...");
	current_animation_type = action;
	pending_animation_request = true;

	// Build request for full pipeline (Stage 1-7)
	Dictionary body;
	body["project_id"] = current_project_id;
	body["action_type"] = action;
	body["difficulty_tier"] = difficulty;
	body["perspective"] = "side";
	body["animation_type"] = action;

	String json_body = JSON::stringify(body);

	PackedStringArray headers;
	headers.push_back("Content-Type: application/json");

	String url = "https://api.zerograft.online/api/pipeline/run";
	Error err = http_request->request(url, headers, HTTPClient::METHOD_POST, json_body);

	if (err != OK) {
		status_label->set_text("Animation request failed");
		pending_animation_request = false;
	}
}
