#include "spritemancer_main_screen.h"
#include "drag_drop_texture_rect.h"
#include "scene/gui/separator.h"
#include "scene/resources/style_box_flat.h"
#include "scene/resources/packed_scene.h"
#include "core/os/os.h"
#include "core/io/json.h"
#include "core/io/resource_loader.h"
#include "core/io/dir_access.h"
#include "core/config/project_settings.h"

void SpriteMancerMainScreen::_bind_methods() {
	ClassDB::bind_method(D_METHOD("_on_open_browser"), &SpriteMancerMainScreen::_on_open_browser);
	ClassDB::bind_method(D_METHOD("_on_refresh"), &SpriteMancerMainScreen::_on_refresh);
	ClassDB::bind_method(D_METHOD("_on_prev_frame"), &SpriteMancerMainScreen::_on_prev_frame);
	ClassDB::bind_method(D_METHOD("_on_next_frame"), &SpriteMancerMainScreen::_on_next_frame);
	ClassDB::bind_method(D_METHOD("_on_play"), &SpriteMancerMainScreen::_on_play);
	ClassDB::bind_method(D_METHOD("_on_toggle_embedded"), &SpriteMancerMainScreen::_on_toggle_embedded);
	ClassDB::bind_method(D_METHOD("toggle_embedded_mode", "enabled"), &SpriteMancerMainScreen::toggle_embedded_mode);
	ClassDB::bind_method(D_METHOD("load_project", "project_id"), &SpriteMancerMainScreen::load_project);
	ClassDB::bind_method(D_METHOD("_on_browser_input", "event"), &SpriteMancerMainScreen::_on_browser_input);
	ClassDB::bind_method(D_METHOD("_on_browser_resized"), &SpriteMancerMainScreen::_on_browser_resized);
}

void SpriteMancerMainScreen::set_bridge(GodotBridge *p_bridge) {
	bridge = p_bridge;
}

SpriteMancerMainScreen::SpriteMancerMainScreen() {
	set_v_size_flags(SIZE_EXPAND_FILL);
	set_h_size_flags(SIZE_EXPAND_FILL);

	// === Header ===
	header = memnew(HBoxContainer);
	add_child(header);

	title_label = memnew(Label);
	title_label->set_text("SpriteMancer");
	title_label->add_theme_font_size_override("font_size", 18);
	header->add_child(title_label);

	// Spacer
	Control *spacer = memnew(Control);
	spacer->set_h_size_flags(SIZE_EXPAND_FILL);
	header->add_child(spacer);

	refresh_btn = memnew(Button);
	refresh_btn->set_text("↻ Refresh");
	refresh_btn->connect("pressed", callable_mp(this, &SpriteMancerMainScreen::_on_refresh));
	header->add_child(refresh_btn);

	embed_toggle_btn = memnew(Button);
	embed_toggle_btn->set_text("📺 Embedded Editor");
	embed_toggle_btn->set_tooltip_text("Toggle embedded pixel editor view");
	embed_toggle_btn->connect("pressed", callable_mp(this, &SpriteMancerMainScreen::_on_toggle_embedded));
	header->add_child(embed_toggle_btn);

	open_browser_btn = memnew(Button);
	open_browser_btn->set_text("🌐 External Browser");
	open_browser_btn->set_tooltip_text("Opens SpriteMancer at " + frontend_url);
	open_browser_btn->connect("pressed", callable_mp(this, &SpriteMancerMainScreen::_on_open_browser));
	header->add_child(open_browser_btn);

	add_child(memnew(HSeparator));

	// === Content Panel ===
	content_panel = memnew(PanelContainer);
	content_panel->set_v_size_flags(SIZE_EXPAND_FILL);
	content_panel->set_h_size_flags(SIZE_EXPAND_FILL);
	add_child(content_panel);

	// Style for content panel
	Ref<StyleBoxFlat> panel_style;
	panel_style.instantiate();
	panel_style->set_bg_color(Color(0.12, 0.12, 0.15, 1));
	panel_style->set_corner_radius_all(8);
	panel_style->set_content_margin_all(20);
	content_panel->add_theme_style_override("panel", panel_style);

	content = memnew(VBoxContainer);
	content->set_alignment(BoxContainer::ALIGNMENT_CENTER);
	content_panel->add_child(content);

	// Preview image
	preview_image = memnew(TextureRect);
	preview_image->set_stretch_mode(TextureRect::STRETCH_KEEP_ASPECT_CENTERED);
	preview_image->set_expand_mode(TextureRect::EXPAND_FIT_WIDTH_PROPORTIONAL);
	preview_image->set_custom_minimum_size(Size2(400, 400));
	preview_image->set_h_size_flags(SIZE_SHRINK_CENTER);
	content->add_child(preview_image);

	// Status label
	status_label = memnew(Label);
	status_label->set_text("No project loaded\n\nGenerate assets from the SpriteMancer dock\nor click 'Open Full Editor' for advanced editing");
	status_label->set_horizontal_alignment(HORIZONTAL_ALIGNMENT_CENTER);
	status_label->set_vertical_alignment(VERTICAL_ALIGNMENT_CENTER);
	status_label->add_theme_color_override("font_color", Color(0.6, 0.6, 0.7));
	content->add_child(status_label);

	add_child(memnew(HSeparator));

	// === Frame Controls ===
	controls = memnew(HBoxContainer);
	controls->set_alignment(BoxContainer::ALIGNMENT_CENTER);
	add_child(controls);

	prev_btn = memnew(Button);
	prev_btn->set_text("◀");
	prev_btn->connect("pressed", callable_mp(this, &SpriteMancerMainScreen::_on_prev_frame));
	controls->add_child(prev_btn);

	play_btn = memnew(Button);
	play_btn->set_text("▶");
	play_btn->connect("pressed", callable_mp(this, &SpriteMancerMainScreen::_on_play));
	controls->add_child(play_btn);

	next_btn = memnew(Button);
	next_btn->set_text("▶");
	next_btn->connect("pressed", callable_mp(this, &SpriteMancerMainScreen::_on_next_frame));
	controls->add_child(next_btn);

	frame_label = memnew(Label);
	frame_label->set_text("Frame 1/1");
	controls->add_child(frame_label);

	// HTTP Request
	http_request = memnew(HTTPRequest);
	add_child(http_request);
}

void SpriteMancerMainScreen::_on_open_browser() {
	// Open SpriteMancer frontend in default browser
	String url = frontend_url;
	if (!current_project_url.is_empty()) {
		url = current_project_url;
	}
	OS::get_singleton()->shell_open(url);
}

void SpriteMancerMainScreen::_on_refresh() {
	status_label->set_text("Refreshing...");
	// If embedded editor is active, reload its page
	if (embedded_editor && embedded_mode) {
		embedded_editor->call("navigate_to", frontend_url);
	}
}

void SpriteMancerMainScreen::_on_prev_frame() {
	// TODO: Frame navigation
}

void SpriteMancerMainScreen::_on_next_frame() {
	// TODO: Frame navigation
}

void SpriteMancerMainScreen::_on_play() {
	// TODO: Animation playback
}

void SpriteMancerMainScreen::_on_toggle_embedded() {
	toggle_embedded_mode(!embedded_mode);
}

void SpriteMancerMainScreen::toggle_embedded_mode(bool p_enabled) {
	if (p_enabled == embedded_mode) {
		return;
	}
	
	embedded_mode = p_enabled;
	
	if (embedded_mode) {
		_load_embedded_editor();
		embed_toggle_btn->set_text("📺 Preview Mode");
	} else {
		_unload_embedded_editor();
		embed_toggle_btn->set_text("📺 Embedded Editor");
	}
}

void SpriteMancerMainScreen::_load_embedded_editor() {
	if (embedded_editor) {
		content->set_visible(false);
		embedded_editor->set_visible(true);
		if (cef_browser) {
			cef_browser->call("set_hidden", false);
		}
		String url = frontend_url;
		if (!current_project_id.is_empty()) {
			url = frontend_url + "/editor/" + current_project_id;
		}
		status_label->set_text("Embedded editor loaded: " + url);
		return;
	}
	
	// Hide the preview content
	content->set_visible(false);
	
	// Create embedded editor container programmatically (no scene file needed!)
	// This allows it to work with any user project without copying files
	embedded_editor = memnew(Control);
	embedded_editor->set_name("EmbeddedEditor");
	embedded_editor->set_anchors_preset(Control::PRESET_FULL_RECT);
	
	// Create DragDropTextureRect for browser rendering (with drag-drop support)
	DragDropTextureRect *texture_rect = memnew(DragDropTextureRect);
	texture_rect->set_name("TextureRect");
	texture_rect->set_anchors_preset(Control::PRESET_FULL_RECT);
	texture_rect->set_expand_mode(TextureRect::EXPAND_IGNORE_SIZE);
	texture_rect->set_stretch_mode(TextureRect::STRETCH_SCALE);  // Scale to fill, browser handles aspect
	texture_rect->set_mouse_filter(Control::MOUSE_FILTER_STOP);  // Capture mouse events
	embedded_editor->add_child(texture_rect);
	browser_texture_rect = texture_rect;  // Store reference
	
	// Connect resized signal to tell browser when container size changes
	texture_rect->connect("resized", callable_mp(this, &SpriteMancerMainScreen::_on_browser_resized));
	
	content_panel->add_child(embedded_editor);
	
	// Try to instantiate GDCef browser if available
	if (ClassDB::class_exists("GDCef")) {
		print_line("[SpriteMancer] GDCef class found - initializing browser...");
		
		// Create GDCef node dynamically
		Object *cef_obj = ClassDB::instantiate("GDCef");
		if (cef_obj) {
			Node *cef_node = Object::cast_to<Node>(cef_obj);
			if (cef_node) {
				cef_node->set_name("GDCef");
				embedded_editor->add_child(cef_node);
				
				// CEF is bundled with Godot - no artifacts path needed!
				// The gdcef module automatically finds cefsimple.app next to the executable
				Dictionary init_params;
				// Disable keychain access to avoid macOS password prompts
				init_params["disable_keychain"] = true;
				init_params["incognito"] = true;  // No persistent storage
				// Additional command line switches to disable cookie encryption
				Array switches;
				switches.push_back("--use-mock-keychain");  // Use mock keychain on macOS
				switches.push_back("--disable-features=PasswordManager");
				init_params["command_line_switches"] = switches;
				bool init_success = cef_node->call("initialize", init_params);
				
				if (init_success) {
					// Create browser with frontend URL
					String url = frontend_url;
					if (!current_project_id.is_empty()) {
						url = frontend_url + "/editor/" + current_project_id;
					}
					
					Dictionary config;
					config["javascript"] = true;
					config["webgl"] = true;
					config["frame_rate"] = 30;
					
					Object *browser = cef_node->call("create_browser", url, texture_rect, config);
					if (browser) {
						cef_browser = browser;  // Store browser reference
						texture_rect->set_cef_browser(browser);  // Give DragDropTextureRect access to browser
						print_line("[SpriteMancer] Browser created successfully!");
						status_label->set_text("Embedded editor loaded: " + url);
						
						// Connect gui_input signal for mouse/keyboard forwarding
						texture_rect->connect("gui_input", callable_mp(this, &SpriteMancerMainScreen::_on_browser_input));
					} else {
						print_line("[SpriteMancer] Failed to create browser");
						status_label->set_text("Failed to create browser");
					}
				} else {
					print_line("[SpriteMancer] GDCef initialization failed");
					status_label->set_text("CEF initialization failed");
				}
			}
		}
	} else {
		print_line("[SpriteMancer] GDCef not found - using placeholder");
		
		// Show placeholder text when CEF is not available
		Label *placeholder = memnew(Label);
		placeholder->set_text("SpriteMancer Web Editor\n\nGDCef not available.\nInstall gdCEF addon and copy cef_artifacts to your project.");
		placeholder->set_horizontal_alignment(HORIZONTAL_ALIGNMENT_CENTER);
		placeholder->set_vertical_alignment(VERTICAL_ALIGNMENT_CENTER);
		placeholder->set_anchors_preset(Control::PRESET_FULL_RECT);
		embedded_editor->add_child(placeholder);
		
		status_label->set_text("CEF not available - install gdCEF");
	}
	
	print_line("[SpriteMancer] Embedded editor loaded");
}

void SpriteMancerMainScreen::_unload_embedded_editor() {
	// Don't destroy the embedded editor; CEF shutdown is async and can crash if freed.
	if (embedded_editor) {
		embedded_editor->set_visible(false);
		if (cef_browser) {
			cef_browser->call("set_hidden", true);
		}
	}
	
	// Show the preview content again
	content->set_visible(true);
	status_label->set_text("Preview mode");
}

void SpriteMancerMainScreen::load_project(const String &p_project_id) {
	current_project_id = p_project_id;
	current_project_url = frontend_url + "/projects/" + p_project_id + "/dna-lab";
	status_label->set_text("Project loaded: " + p_project_id);
	
	print_line("[SpriteMancer] load_project called with: " + p_project_id);
	print_line("[SpriteMancer] embedded_mode=" + String(embedded_mode ? "true" : "false"));
	print_line("[SpriteMancer] cef_browser=" + String(cef_browser ? "valid" : "null"));
	
	// If embedded editor is active with a CEF browser, navigate to the project
	if (embedded_mode && cef_browser) {
		print_line("[SpriteMancer] Navigating browser to: " + current_project_url);
		cef_browser->call("load_url", current_project_url);
	} else if (embedded_editor && embedded_mode) {
		print_line("[SpriteMancer] cef_browser not ready, falling back to embedded_editor->call");
		embedded_editor->call("load_project", p_project_id);
	} else {
		print_line("[SpriteMancer] Cannot navigate - not in embedded mode or no browser");
	}
}

void SpriteMancerMainScreen::on_project_loaded(const String &p_project_id, Ref<ImageTexture> p_texture) {
	current_project_id = p_project_id;
	if (p_texture.is_valid()) {
		preview_image->set_texture(p_texture);
		status_label->set_text("Project: " + p_project_id.substr(0, 8) + "...");
		current_project_url = frontend_url + "/projects/" + p_project_id + "/dna-lab";
	}
	
	// If embedded editor is active, navigate to the project
	if (embedded_editor && embedded_mode) {
		embedded_editor->call("load_project", p_project_id);
	}
}

void SpriteMancerMainScreen::_on_browser_input(const Ref<InputEvent> &p_event) {
	if (!cef_browser) return;
	
	Ref<InputEventMouseMotion> motion = p_event;
	if (motion.is_valid()) {
		cef_browser->call("set_mouse_position", (int)motion->get_position().x, (int)motion->get_position().y);
		return;
	}
	
	Ref<InputEventMouseButton> button = p_event;
	if (button.is_valid()) {
		int btn = 1;  // Left click default
		if (button->get_button_index() == MouseButton::RIGHT) btn = 2;
		else if (button->get_button_index() == MouseButton::MIDDLE) btn = 3;
		
		cef_browser->call("send_mouse_click", 
			(int)button->get_position().x, (int)button->get_position().y,
			btn, button->is_pressed(), button->is_double_click() ? 2 : 1);
		return;
	}
	
	Ref<InputEventMouseButton> wheel = p_event;
	if (wheel.is_valid() && (wheel->get_button_index() == MouseButton::WHEEL_UP || 
	                         wheel->get_button_index() == MouseButton::WHEEL_DOWN)) {
		int delta_y = (wheel->get_button_index() == MouseButton::WHEEL_UP) ? 120 : -120;
		cef_browser->call("send_mouse_wheel", 
			(int)wheel->get_position().x, (int)wheel->get_position().y, 0, delta_y);
		return;
	}
	
	Ref<InputEventKey> key = p_event;
	if (key.is_valid()) {
		cef_browser->call("send_key_event", 
			(int)key->get_keycode(), (int)key->get_physical_keycode(),
			key->is_pressed(), key->is_shift_pressed(), key->is_ctrl_pressed(), key->is_alt_pressed());
		
		// Also send char event for text input
		if (key->is_pressed() && key->get_unicode() != 0) {
			String text = String::chr(key->get_unicode());
			cef_browser->call("send_text", text);
		}
		return;
	}
}

void SpriteMancerMainScreen::_on_browser_resized() {
	if (!cef_browser || !browser_texture_rect) return;
	
	Vector2 new_size = browser_texture_rect->get_size();
	if (new_size.x > 0 && new_size.y > 0) {
		print_line("[SpriteMancer] Browser resized to: " + String::num((int)new_size.x) + "x" + String::num((int)new_size.y));
		cef_browser->call("resize", new_size);
	}
}

void SpriteMancerMainScreen::_notification(int p_what) {
	switch (p_what) {
		case NOTIFICATION_VISIBILITY_CHANGED: {
			// Auto-pause/resume browser when tab becomes visible/hidden
			if (cef_browser && embedded_mode) {
				bool visible = is_visible_in_tree();
				if (!visible) {
					// Tab is hidden - pause browser to save CPU
					cef_browser->call("set_hidden", true);
					print_line("[SpriteMancer] Browser paused (tab hidden)");
				} else {
					// Tab is visible - resume browser
					cef_browser->call("set_hidden", false);
					print_line("[SpriteMancer] Browser resumed (tab visible)");
				}
			}
			break;
		}
	}
}
