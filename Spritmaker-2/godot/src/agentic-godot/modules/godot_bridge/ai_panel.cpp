#include "ai_panel.h"
#include "scene/gui/separator.h"
#include "scene/gui/label.h"
#include "scene/gui/texture_rect.h"
#include "scene/gui/color_rect.h"
#include "scene/gui/progress_bar.h"
#include "scene/resources/style_box_flat.h"
#include "scene/resources/image_texture.h"
#include "core/io/json.h"
#include "core/io/file_access.h"
#include "core/io/dir_access.h"
#include "core/os/time.h"
#include "core/config/project_settings.h"
#include "core/crypto/crypto_core.h"
#include "core/object/message_queue.h"
#ifdef TOOLS_ENABLED
#include "editor/editor_node.h"
#if __has_include("editor/themes/editor_scale.h")
#include "editor/themes/editor_scale.h"
#elif __has_include("editor/editor_scale.h")
#include "editor/editor_scale.h"
#endif
#ifndef EDSCALE
#define EDSCALE (1.0f)
#endif
#endif

// ═══════════════════════════════════════════════════════════════════════════
// Premium Chat UI Color Palette - Clean, Warm, Professional
// ═══════════════════════════════════════════════════════════════════════════

// Soft dark backgrounds (warm grays)
static const Color COLOR_BG_DEEPEST = Color(0.102, 0.102, 0.102, 1.0);    // #1a1a1a - Panel bg
static const Color COLOR_BG_DEEP = Color(0.125, 0.125, 0.125, 1.0);       // #202020 - Section bg
static const Color COLOR_BG_SURFACE = Color(0.149, 0.149, 0.149, 1.0);    // #262626 - Bubbles
static const Color COLOR_BG_ELEVATED = Color(0.176, 0.176, 0.176, 1.0);   // #2d2d2d - Cards

// AI Accent colors (soft blue)
static const Color COLOR_AI_CYAN = Color(0.478, 0.635, 0.969, 1.0);       // #7aa2f7 - Primary
static const Color COLOR_AI_PURPLE = Color(0.616, 0.486, 0.847, 1.0);     // #9d7cd8 - Secondary
static const Color COLOR_AI_MAGENTA = Color(0.733, 0.604, 0.969, 1.0);    // #bb9af7 - Tertiary

// User accent colors (warm blue-gray)
static const Color COLOR_USER_BLUE = Color(0.451, 0.655, 0.851, 1.0);     // #73a7d9
static const Color COLOR_USER_VIOLET = Color(0.537, 0.706, 0.863, 1.0);   // #89b4dc

// Status colors (softer tones)
static const Color COLOR_SUCCESS = Color(0.451, 0.788, 0.569, 1.0);       // #73c991
static const Color COLOR_WARNING = Color(0.898, 0.663, 0.333, 1.0);       // #e5a955
static const Color COLOR_ERROR = Color(0.957, 0.529, 0.443, 1.0);         // #f48771

// AI Message bubble - darker card with left accent
static const Color COLOR_AI_BUBBLE_BG = Color(0.10, 0.10, 0.12, 0.98);
static const Color COLOR_AI_BUBBLE_BORDER = Color(0.22, 0.22, 0.26, 0.5);

// User Message bubble - slightly lighter to distinguish
static const Color COLOR_USER_BUBBLE_BG = Color(0.14, 0.14, 0.17, 0.98);
static const Color COLOR_USER_BUBBLE_BORDER = Color(0.28, 0.28, 0.32, 0.4);

// Thinking bubble
static const Color COLOR_THINKING_BG = Color(0.09, 0.09, 0.11, 0.98);
static const Color COLOR_THINKING_BORDER = Color(0.40, 0.40, 0.48, 0.4);

// Input area
static const Color COLOR_INPUT_BG = Color(0.10, 0.10, 0.12, 0.95);
static const Color COLOR_INPUT_BORDER = Color(0.22, 0.22, 0.26, 1.0);
static const Color COLOR_INPUT_FOCUS = Color(0.45, 0.45, 0.55, 0.5);

// Text colors - high readability on dark bg
static const Color COLOR_TEXT_AI_SENDER = Color(0.62, 0.62, 0.68, 1.0);    // Silver
static const Color COLOR_TEXT_USER_SENDER = Color(0.55, 0.55, 0.60, 1.0);   // Dimmer silver
static const Color COLOR_TEXT_BODY = Color(0.80, 0.80, 0.84, 1.0);         // Light silver
static const Color COLOR_TEXT_MUTED = Color(0.50, 0.50, 0.55, 1.0);        // Muted gray

namespace {
int _scaled_ui_size(int p_size) {
#ifdef TOOLS_ENABLED
	return MAX(1, int(Math::round(float(p_size) * EDSCALE)));
#else
	return p_size;
#endif
}

int _theme_font_size(const Control *p_control, const StringName &p_theme_type = "Label", int p_fallback = 14) {
	if (p_control) {
		int themed_size = p_control->get_theme_font_size("font_size", p_theme_type);
		if (themed_size > 0) {
			return themed_size;
		}
	}
	return _scaled_ui_size(p_fallback);
}

int _theme_font_with_delta(const Control *p_control, int p_delta, int p_min = 10, const StringName &p_theme_type = "Label", int p_fallback = 14) {
	return MAX(p_min, _theme_font_size(p_control, p_theme_type, p_fallback) + p_delta);
}

String _humanize_step_text(const String &p_text) {
	String cleaned = p_text.replace("_", " ").strip_edges();
	if (cleaned.is_empty()) {
		return cleaned;
	}

	PackedStringArray words = cleaned.split(" ", false);
	for (int i = 0; i < words.size(); i++) {
		String w = words[i];
		if (!w.is_empty()) {
			words.set(i, w.substr(0, 1).to_upper() + w.substr(1));
		}
	}

	return String(" ").join(words);
}

String _normalize_step_status(const Dictionary &p_step) {
	String status = String(p_step.get("status", "pending")).to_lower();
	if (status == "completed" || status == "in_progress" || status == "pending" || status == "failed" || status == "error") {
		return status;
	}
	return "pending";
}

String _extract_step_description(const Dictionary &p_step, int p_index) {
	Variant raw_description = p_step.get("description", Variant());
	String fallback_type = String(p_step.get("type", p_step.get("name", ""))).strip_edges();

	if (raw_description.get_type() == Variant::STRING) {
		String desc = String(raw_description).strip_edges();
		if (!desc.is_empty() && !(desc.begins_with("{") && desc.contains("\"name\""))) {
			// Compact legacy planner strings like "Add nodes to scene for: \"...full prompt...\"".
			int split_idx = -1;
			static const char *long_prompt_markers[] = {
				" for: ",
				" after: ",
				" based on: ",
				" from prompt: ",
				" using prompt: "
			};
			for (int i = 0; i < 5; i++) {
				int idx = desc.find(long_prompt_markers[i]);
				if (idx >= 0 && (split_idx == -1 || idx < split_idx)) {
					split_idx = idx;
				}
			}
			if (split_idx > 0) {
				desc = desc.substr(0, split_idx).strip_edges();
			}

			if (desc.length() > 110 && !fallback_type.is_empty()) {
				desc = _humanize_step_text(fallback_type);
			}

			const int compact_max = 110;
			if (desc.length() > compact_max) {
				desc = desc.substr(0, compact_max - 3).strip_edges() + "...";
			}
			return desc;
		}
	}

	Dictionary desc_dict;
	if (raw_description.get_type() == Variant::DICTIONARY) {
		desc_dict = raw_description;
	} else if (raw_description.get_type() == Variant::STRING) {
		String json_like = String(raw_description).strip_edges();
		if (json_like.begins_with("{")) {
			JSON json;
			if (json.parse(json_like) == OK) {
				Variant parsed = json.get_data();
				if (parsed.get_type() == Variant::DICTIONARY) {
					desc_dict = parsed;
				}
			}
		}
	}

	String description = String(desc_dict.get("description", p_step.get("description", ""))).strip_edges();
	String type_or_name = String(desc_dict.get("type", desc_dict.get("name", fallback_type))).strip_edges();

	if (description.is_empty()) {
		description = _humanize_step_text(type_or_name);
	}

	if (description.is_empty()) {
		description = "Step " + itos(p_index + 1);
	}

	String agent = String(desc_dict.get("agent", p_step.get("agent", ""))).strip_edges();
	if (!agent.is_empty()) {
		description += " [" + _humanize_step_text(agent) + "]";
	}

	const int max_desc_len = 110;
	if (description.length() > max_desc_len) {
		description = description.substr(0, max_desc_len - 3).strip_edges() + "...";
	}

	return description;
}
} // namespace

void AIPanel::_bind_methods() {
	ClassDB::bind_method(D_METHOD("_on_send_pressed"), &AIPanel::_on_send_pressed);
	ClassDB::bind_method(D_METHOD("_on_input_submitted", "text"), &AIPanel::_on_input_submitted);
	ClassDB::bind_method(D_METHOD("_on_model_selected", "index"), &AIPanel::_on_model_selected);
	ClassDB::bind_method(D_METHOD("_on_http_request_completed", "result", "code", "headers", "body"), &AIPanel::_on_http_request_completed);
	ClassDB::bind_method(D_METHOD("_poll_websocket"), &AIPanel::_poll_websocket);
	ClassDB::bind_method(D_METHOD("_scroll_to_bottom"), &AIPanel::_scroll_to_bottom);
	ClassDB::bind_method(D_METHOD("_on_tab_changed", "tab"), &AIPanel::_on_tab_changed);
	ClassDB::bind_method(D_METHOD("_on_new_session"), &AIPanel::_on_new_session);
	ClassDB::bind_method(D_METHOD("_on_history_pressed"), &AIPanel::_on_history_pressed);
	ClassDB::bind_method(D_METHOD("_on_history_selected", "id"), &AIPanel::_on_history_selected);
	ClassDB::bind_method(D_METHOD("_on_thinking_toggle"), &AIPanel::_on_thinking_toggle);
	ClassDB::bind_method(D_METHOD("_on_thought_toggle", "header", "scroll", "duration"), &AIPanel::_on_thought_toggle);
	ClassDB::bind_method(D_METHOD("_add_image_bubble", "path", "caption"), &AIPanel::_add_image_bubble);
	
	// Image input handlers
	ClassDB::bind_method(D_METHOD("_on_input_gui_input", "event"), &AIPanel::_on_input_gui_input);
	ClassDB::bind_method(D_METHOD("_on_thumbnail_clicked"), &AIPanel::_on_thumbnail_clicked);
	ClassDB::bind_method(D_METHOD("_on_popup_close"), &AIPanel::_on_popup_close);
	ClassDB::bind_method(D_METHOD("_clear_image_attachment"), &AIPanel::_clear_image_attachment);
	
	// Animation system
	ClassDB::bind_method(D_METHOD("_on_ui_anim_tick"), &AIPanel::_on_ui_anim_tick);
}

void AIPanel::set_bridge(GodotBridge *p_bridge) {
	bridge = p_bridge;
}

void AIPanel::_on_model_selected(int p_index) {
	current_model = model_picker->get_item_text(p_index);
}

void AIPanel::_on_send_pressed() {
	// If AI is processing, act as Stop button
	if (waiting_for_response) {
		// Send cancel message via WebSocket
		if (ws_peer.is_valid() && ws_peer->get_ready_state() == WebSocketPeer::STATE_OPEN) {
			Dictionary msg;
			msg["type"] = "cancel";
			ws_peer->send_text(JSON::stringify(msg));
		}
		
		// Stop locally
		_hide_thinking();
		_add_message_bubble("AI", "⏹️ Task cancelled by user.", false);
		
		// Clear pending question if any
		pending_question_id = "";
		pending_question_default = "";
		if (input_field) {
			input_field->set_placeholder("Type a message...");
		}
		return;
	}
	
	String text = input_field->get_text().strip_edges();
	if (!text.is_empty()) {
		// Remove welcome message on first real user input
		if (welcome_bubble && welcome_bubble->get_parent() == messages_container) {
			messages_container->remove_child(welcome_bubble);
			memdelete(welcome_bubble);
			welcome_bubble = nullptr;
		}

		_add_message_bubble("You", text, true);
		
		// Show attached images in chat as a horizontal row (all images together)
		if (!pending_images.is_empty()) {
			_add_user_images_row(pending_images);
		}
		
		input_field->clear();
		_show_thinking();
		
		// Check if this is answering a pending question
		if (!pending_question_id.is_empty()) {
			// Send answer_response via WebSocket
			String answer = text.is_empty() ? pending_question_default : text;
			Dictionary msg;
			msg["type"] = "answer_response";
			msg["question_id"] = pending_question_id;
			msg["answer"] = answer;
			
			if (ws_peer.is_valid() && ws_peer->get_ready_state() == WebSocketPeer::STATE_OPEN) {
				ws_peer->send_text(JSON::stringify(msg));
			}
			
			// Reset placeholder and clear pending question
			if (input_field) {
				input_field->set_placeholder("Type a message...");
			}
			pending_question_id = "";
			pending_question_default = "";
			return;
		}
		
		// Use WebSocket streaming if connected, else HTTP  
		if (use_streaming && ws_connected) {
			_send_via_websocket(text);
		} else {
			_send_to_ai_router(text);
		}
	}
}

void AIPanel::_on_input_submitted(const String &p_text) {
	_on_send_pressed();
}

void AIPanel::_scroll_to_bottom() {
	if (!chat_scroll) return;

	// Only auto-scroll if user is already near the bottom (within 150px).
	// This prevents fighting with manual user scrolling.
	float current = chat_scroll->get_v_scroll();
	float max_scroll = chat_scroll->get_v_scroll_bar()->get_max();
	float visible = chat_scroll->get_size().y;
	float distance_from_bottom = max_scroll - visible - current;

	if (distance_from_bottom < _scaled_ui_size(150)) {
		// Near bottom — snap instantly (no smooth animation to avoid shaking)
		chat_scroll->set_v_scroll((int)max_scroll);
	}
	// If user scrolled up, don't force them back down
}

void AIPanel::_add_message_bubble(const String &p_sender, const String &p_message, bool p_is_user) {
	// Cascade-style: minimal chrome, just content with subtle separation
	PanelContainer *bubble = memnew(PanelContainer);
	bubble->set_h_size_flags(SIZE_EXPAND_FILL);

	Ref<StyleBoxFlat> style;
	style.instantiate();
	style->set_corner_radius_all(0); // No rounding — flat Cascade style

	if (p_is_user) {
		// User: very subtle bg bump, no border
		style->set_bg_color(Color(0.14, 0.14, 0.16, 0.6));
		style->set_border_width_all(0);
	} else {
		// AI: transparent — just text on the background
		style->set_bg_color(Color(0, 0, 0, 0));
		style->set_border_width_all(0);
	}
	style->set_content_margin(SIDE_LEFT, _scaled_ui_size(10));
	style->set_content_margin(SIDE_RIGHT, _scaled_ui_size(10));
	style->set_content_margin(SIDE_TOP, _scaled_ui_size(6));
	style->set_content_margin(SIDE_BOTTOM, _scaled_ui_size(6));

	bubble->add_theme_style_override("panel", style);

	VBoxContainer *content = memnew(VBoxContainer);
	content->add_theme_constant_override("separation", _scaled_ui_size(2));
	bubble->add_child(content);

	// Message text — clean, readable
	int base_ui_font_size = _theme_font_size(this);
	RichTextLabel *msg = memnew(RichTextLabel);
	msg->set_use_bbcode(false);
	msg->set_fit_content(true);
	msg->set_scroll_active(false);
	msg->set_selection_enabled(true);
	msg->set_h_size_flags(SIZE_EXPAND_FILL);
	msg->set_autowrap_mode(TextServer::AUTOWRAP_WORD_SMART);
	int chat_font_size = MAX(base_ui_font_size, _scaled_ui_size(13));
	msg->add_theme_font_size_override("normal_font_size", chat_font_size);
	msg->add_theme_constant_override("line_separation", _scaled_ui_size(3));

	if (p_is_user) {
		msg->add_theme_color_override("default_color", Color(0.85, 0.85, 0.90));
	} else {
		msg->add_theme_color_override("default_color", Color(0.78, 0.78, 0.82));
	}
	msg->add_text(p_message);
	content->add_child(msg);

	messages_container->add_child(bubble);

	// Track message for session persistence
	Dictionary msg_entry;
	msg_entry["sender"] = p_sender;
	msg_entry["text"] = p_message;
	msg_entry["is_user"] = p_is_user;
	current_messages.push_back(msg_entry);

	// Move thinking indicator to end
	if (thinking_bubble && thinking_bubble->get_parent() == messages_container) {
		messages_container->move_child(thinking_bubble, -1);
	}

	call_deferred("_scroll_to_bottom");
}

void AIPanel::_add_image_bubble(const String &p_path, const String &p_caption) {
	// Create bubble panel for image display
	PanelContainer *bubble = memnew(PanelContainer);
	bubble->set_h_size_flags(SIZE_EXPAND_FILL);
	
	// Dark style for image container
	Ref<StyleBoxFlat> style;
	style.instantiate();
	style->set_corner_radius_all(8);
	style->set_content_margin_all(8);
	style->set_bg_color(Color(0.12, 0.15, 0.2, 0.9));
	bubble->add_theme_style_override("panel", style);
	
	VBoxContainer *content = memnew(VBoxContainer);
	content->set_alignment(BoxContainer::ALIGNMENT_CENTER);
	bubble->add_child(content);
	
	// Load and display image
	Ref<Image> img;
	img.instantiate();
	
	String file_path = p_path;
	if (p_path.begins_with("res://")) {
		file_path = ProjectSettings::get_singleton()->globalize_path(p_path);
	}
	
	Error err = img->load(file_path);
	if (err == OK) {
		// Create texture and display
		Ref<ImageTexture> tex = ImageTexture::create_from_image(img);
		
		TextureRect *img_display = memnew(TextureRect);
		img_display->set_texture(tex);
		img_display->set_expand_mode(TextureRect::EXPAND_FIT_WIDTH_PROPORTIONAL);
		img_display->set_stretch_mode(TextureRect::STRETCH_KEEP_ASPECT_CENTERED);
		img_display->set_custom_minimum_size(Size2(_scaled_ui_size(200), _scaled_ui_size(200)));
		img_display->set_h_size_flags(SIZE_SHRINK_CENTER);
		content->add_child(img_display);
		
		// Caption
		Label *caption = memnew(Label);
		caption->set_text("🎨 " + p_caption);
		caption->set_horizontal_alignment(HORIZONTAL_ALIGNMENT_CENTER);
		caption->add_theme_font_size_override("font_size", _theme_font_with_delta(this, -1, _scaled_ui_size(11)));
		caption->add_theme_color_override("font_color", Color(0.6, 0.8, 0.6));
		content->add_child(caption);
	} else {
		// Could not load - show error
		Label *err_label = memnew(Label);
		err_label->set_text("⚠️ Could not load: " + p_path);
		err_label->add_theme_color_override("font_color", Color(1, 0.6, 0.4));
		content->add_child(err_label);
	}
	
	messages_container->add_child(bubble);
	
	// Move thinking indicator to end
	if (thinking_bubble && thinking_bubble->get_parent() == messages_container) {
		messages_container->move_child(thinking_bubble, -1);
	}
	
	call_deferred("_scroll_to_bottom");
}

void AIPanel::_add_user_image_bubble(const Ref<Image> &p_image) {
	if (!p_image.is_valid() || p_image->is_empty()) return;
	
	// Create bubble panel with user styling (right-aligned, blue tint)
	PanelContainer *bubble = memnew(PanelContainer);
	bubble->set_h_size_flags(SIZE_EXPAND_FILL);
	
	Ref<StyleBoxFlat> style;
	style.instantiate();
	style->set_corner_radius_all(8);
	style->set_content_margin_all(8);
	style->set_bg_color(Color(0.15, 0.2, 0.3, 0.9));  // User blue tint
	style->set_border_width_all(1);
	style->set_border_color(Color(0.3, 0.4, 0.5));
	bubble->add_theme_style_override("panel", style);
	
	VBoxContainer *content = memnew(VBoxContainer);
	content->set_alignment(BoxContainer::ALIGNMENT_CENTER);
	bubble->add_child(content);
	
	// Create texture from image
	Ref<Image> display_img = p_image->duplicate();
	// Resize if too large (max 300px wide)
	if (display_img->get_width() > 300) {
		float scale = 300.0f / display_img->get_width();
		display_img->resize(300, int(display_img->get_height() * scale), Image::INTERPOLATE_LANCZOS);
	}
	
	Ref<ImageTexture> tex = ImageTexture::create_from_image(display_img);
	
	TextureRect *img_display = memnew(TextureRect);
	img_display->set_texture(tex);
	img_display->set_expand_mode(TextureRect::EXPAND_FIT_WIDTH_PROPORTIONAL);
	img_display->set_stretch_mode(TextureRect::STRETCH_KEEP_ASPECT_CENTERED);
	img_display->set_custom_minimum_size(Size2(_scaled_ui_size(150), _scaled_ui_size(100)));
	img_display->set_h_size_flags(SIZE_SHRINK_CENTER);
	content->add_child(img_display);
	
	// Caption
	Label *caption = memnew(Label);
	caption->set_text("[Image attached]");
	caption->set_horizontal_alignment(HORIZONTAL_ALIGNMENT_CENTER);
	caption->add_theme_font_size_override("font_size", _theme_font_with_delta(this, -2, _scaled_ui_size(10)));
	caption->add_theme_color_override("font_color", Color(0.6, 0.7, 0.8));
	content->add_child(caption);
	
	messages_container->add_child(bubble);
	
	// Move thinking indicator to end
	if (thinking_bubble && thinking_bubble->get_parent() == messages_container) {
		messages_container->move_child(thinking_bubble, -1);
	}
	
	call_deferred("_scroll_to_bottom");
}

// Display multiple images in a single horizontal row (side-by-side)
void AIPanel::_add_user_images_row(const Vector<Ref<Image>> &p_images) {
	if (p_images.is_empty()) return;
	
	// Create bubble panel with user styling
	PanelContainer *bubble = memnew(PanelContainer);
	bubble->set_h_size_flags(SIZE_EXPAND_FILL);
	
	Ref<StyleBoxFlat> style;
	style.instantiate();
	style->set_corner_radius_all(8);
	style->set_content_margin_all(8);
	style->set_bg_color(Color(0.15, 0.2, 0.3, 0.9));  // User blue tint
	style->set_border_width_all(1);
	style->set_border_color(Color(0.3, 0.4, 0.5));
	bubble->add_theme_style_override("panel", style);
	
	// Create horizontal container for images side-by-side
	HBoxContainer *row = memnew(HBoxContainer);
	row->set_alignment(BoxContainer::ALIGNMENT_CENTER);
	row->add_theme_constant_override("separation", _scaled_ui_size(8));
	bubble->add_child(row);
	
	// Add each image as a thumbnail in the row
	const int THUMB_SIZE = _scaled_ui_size(80);  // Size per thumbnail in row
	for (int i = 0; i < p_images.size(); i++) {
		Ref<Image> img = p_images[i];
		if (!img.is_valid() || img->is_empty()) continue;
		
		// Create scaled thumbnail
		Ref<Image> thumb_img = img->duplicate();
		int orig_w = thumb_img->get_width();
		int orig_h = thumb_img->get_height();
		float scale = MIN((float)THUMB_SIZE / orig_w, (float)THUMB_SIZE / orig_h);
		int new_w = MAX(1, (int)(orig_w * scale));
		int new_h = MAX(1, (int)(orig_h * scale));
		thumb_img->resize(new_w, new_h);
		
		Ref<ImageTexture> tex = ImageTexture::create_from_image(thumb_img);
		
		TextureRect *img_display = memnew(TextureRect);
		img_display->set_texture(tex);
		img_display->set_expand_mode(TextureRect::EXPAND_FIT_WIDTH_PROPORTIONAL);
		img_display->set_stretch_mode(TextureRect::STRETCH_KEEP_ASPECT_CENTERED);
		img_display->set_custom_minimum_size(Size2(THUMB_SIZE, THUMB_SIZE));
		row->add_child(img_display);
	}
	
	messages_container->add_child(bubble);
	
	// Move thinking indicator to end
	if (thinking_bubble && thinking_bubble->get_parent() == messages_container) {
		messages_container->move_child(thinking_bubble, -1);
	}
	
	call_deferred("_scroll_to_bottom");
}


void AIPanel::_show_thinking() {
	if (thinking_bubble) {
		// Move to end of messages
		messages_container->move_child(thinking_bubble, -1);
		thinking_bubble->set_visible(true);
		
		// Reset state
		thinking_expanded = true;
		thinking_start_time = Time::get_singleton()->get_ticks_msec();
		if (thinking_header) {
			thinking_header->set_text("Thinking...");
		}
		if (thinking_content) {
			thinking_content->set_visible(true);
		}
		if (thinking_text) {
			thinking_text->clear();
		}
	}
	waiting_for_response = true;
	streaming_text = "";
	current_thought_text = "";
	
	// Transform button to Stop mode with cosmic styling
	if (send_button) {
		send_button->set_text("X");  // Stop icon
		send_button->add_theme_color_override("font_color", COLOR_ERROR);
	}
	
	call_deferred("_scroll_to_bottom");
}

void AIPanel::_hide_thinking() {
	waiting_for_response = false;
	
	// Transform button back to Send mode with cosmic styling
	if (send_button) {
		send_button->set_text(">");  // Play icon
		send_button->add_theme_color_override("font_color", COLOR_AI_CYAN);
	}
	
	// Calculate duration and finalize
	if (thinking_start_time > 0) {
		thinking_duration = (Time::get_singleton()->get_ticks_msec() - thinking_start_time) / 1000.0;
		_finalize_thinking();
	}
}

void AIPanel::_finalize_thinking() {
	// Only create a thought bubble if there was real thinking content
	// from "thought" chunks (NOT streaming_text which is the response).
	if (thinking_bubble && !current_thought_text.is_empty() && thinking_duration > 0.5f) {
		_add_thought_bubble(thinking_duration, current_thought_text);
	}

	// Hide the streaming indicator
	if (thinking_bubble) {
		thinking_bubble->set_visible(false);
	}
}

void AIPanel::_on_thinking_toggle() {
	thinking_expanded = !thinking_expanded;
	
	if (thinking_content) {
		thinking_content->set_visible(thinking_expanded);
	}
	
	if (thinking_header) {
		String duration_str = String::num(thinking_duration, 1);
		if (thinking_expanded) {
			thinking_header->set_text("Thought for " + duration_str + "s");
		} else {
			thinking_header->set_text("Thought for " + duration_str + "s  >");
		}
	}
	
	call_deferred("_scroll_to_bottom");
}

void AIPanel::_add_thought_bubble(float p_duration, const String &p_content) {
	// Cascade-style: minimal "Thought for Xs >" collapsible line
	PanelContainer *bubble = memnew(PanelContainer);
	bubble->set_h_size_flags(SIZE_EXPAND_FILL);

	Ref<StyleBoxFlat> style;
	style.instantiate();
	style->set_bg_color(Color(0, 0, 0, 0)); // Transparent
	style->set_border_width_all(0);
	style->set_content_margin(SIDE_LEFT, _scaled_ui_size(10));
	style->set_content_margin(SIDE_RIGHT, _scaled_ui_size(10));
	style->set_content_margin(SIDE_TOP, _scaled_ui_size(2));
	style->set_content_margin(SIDE_BOTTOM, _scaled_ui_size(2));
	bubble->add_theme_style_override("panel", style);

	VBoxContainer *container = memnew(VBoxContainer);
	container->add_theme_constant_override("separation", _scaled_ui_size(2));
	bubble->add_child(container);

	// Clickable header: "Thought for Xs >"
	String duration_str = String::num(p_duration, 1);
	Button *header = memnew(Button);
	header->set_text("Thought for " + duration_str + "s  >");
	header->set_flat(true);
	header->set_text_alignment(HORIZONTAL_ALIGNMENT_LEFT);
	header->add_theme_color_override("font_color", Color(0.50, 0.50, 0.55));
	header->add_theme_color_override("font_hover_color", Color(0.70, 0.70, 0.75));
	header->add_theme_font_size_override("font_size", _theme_font_with_delta(this, -2, _scaled_ui_size(11), "Button"));
	container->add_child(header);

	// Collapsible content (hidden by default)
	ScrollContainer *scroll = memnew(ScrollContainer);
	scroll->set_custom_minimum_size(Size2(0, 0));
	scroll->set_v_size_flags(SIZE_EXPAND_FILL);
	scroll->set_visible(false);
	container->add_child(scroll);

	VBoxContainer *content_box = memnew(VBoxContainer);
	content_box->set_h_size_flags(SIZE_EXPAND_FILL);
	scroll->add_child(content_box);

	RichTextLabel *text_label = memnew(RichTextLabel);
	text_label->set_use_bbcode(false);
	text_label->set_fit_content(true);
	text_label->set_scroll_active(true);
	text_label->set_selection_enabled(true);
	text_label->set_h_size_flags(SIZE_EXPAND_FILL);
	text_label->add_theme_color_override("default_color", Color(0.55, 0.55, 0.60));
	text_label->add_theme_font_size_override("normal_font_size", _theme_font_with_delta(this, -2, _scaled_ui_size(11)));
	text_label->add_text(p_content);
	content_box->add_child(text_label);

	header->connect("pressed", callable_mp(this, &AIPanel::_on_thought_toggle).bind(header, scroll, duration_str));

	messages_container->add_child(bubble);
}

void AIPanel::_on_thought_toggle(Button *p_header, ScrollContainer *p_scroll, const String &p_duration) {
	bool expanded = p_scroll->is_visible();
	p_scroll->set_visible(!expanded);
	// Dynamic height: MIN 150px visible, MAX 350px (~35% screen)
	if (!expanded) {
		float content_height = p_scroll->get_combined_minimum_size().y;
		float min_height = _scaled_ui_size(250);  // At least this much visible
		float max_height = _scaled_ui_size(600);  // Cap at ~50% screen height
		float height = MAX(content_height, min_height);
		height = MIN(height, max_height);
		p_scroll->set_custom_minimum_size(Size2(0, height));
	}
	String prefix = expanded ? ">" : "v";
	p_header->set_text(prefix + " Thought for " + p_duration + "s");
}

// ═══════════════════════════════════════════════════════════════════════════
// 🌌 ANIMATION SYSTEM - Phase 2: Breathing Life Implementation
// ═══════════════════════════════════════════════════════════════════════════

Color AIPanel::_get_aurora_color(float phase) {
	// Aurora gradient: Cyan → Purple → Magenta → Cyan
	// phase is 0.0 to 1.0
	if (phase < 0.33f) {
		// Cyan to Purple
		float t = phase / 0.33f;
		return COLOR_AI_CYAN.lerp(COLOR_AI_PURPLE, t);
	} else if (phase < 0.66f) {
		// Purple to Magenta
		float t = (phase - 0.33f) / 0.33f;
		return COLOR_AI_PURPLE.lerp(COLOR_AI_MAGENTA, t);
	} else {
		// Magenta back to Cyan
		float t = (phase - 0.66f) / 0.34f;
		return COLOR_AI_MAGENTA.lerp(COLOR_AI_CYAN, t);
	}
}

void AIPanel::_update_aurora_border() {
	if (!thinking_bubble || !thinking_bubble->is_visible()) return;
	
	// Update aurora phase (complete cycle in ~3 seconds)
	aurora_phase += 0.011f;  // ~30fps * 3 seconds = ~90 frames per cycle
	if (aurora_phase > 1.0f) aurora_phase -= 1.0f;
	
	// Calculate pulsing intensity (breathing effect)
	thinking_pulse = 0.5f + 0.5f * sin(anim_time * 2.0f);
	
	// Get aurora color and apply to border
	Color aurora = _get_aurora_color(aurora_phase);
	aurora.a = 0.4f + 0.3f * thinking_pulse;  // Pulsing alpha
	
	// Update the thinking bubble's border color
	Ref<StyleBoxFlat> style = thinking_bubble->get_theme_stylebox("panel");
	if (style.is_valid()) {
		// Clone the style to avoid modifying shared resources
		Ref<StyleBoxFlat> new_style = style->duplicate();
		new_style->set_border_color(aurora);
		// Pulse the shadow too
		Color shadow = aurora;
		shadow.a = 0.15f + 0.1f * thinking_pulse;
		new_style->set_shadow_color(shadow);
		new_style->set_shadow_size(14 + int(4 * thinking_pulse));
		thinking_bubble->add_theme_style_override("panel", new_style);
	}
}

void AIPanel::_update_orbiting_dots() {
	if (!thinking_header || !waiting_for_response) return;
	
	// Update dot phase
	dot_phase += 0.05f;  // Speed of dot animation
	if (dot_phase > 1.0f) {
		dot_phase -= 1.0f;
		orbiting_dot = (orbiting_dot + 1) % 3;
	}
	
	// Calculate elapsed time
	float elapsed = (Time::get_singleton()->get_ticks_msec() - thinking_start_time) / 1000.0f;
	String elapsed_str = String::num(elapsed, 1);

	// Clean Cascade-style: "Thinking... [3.7s]"
	thinking_header->set_text("Thinking... [" + elapsed_str + "s]");
}

void AIPanel::_update_smooth_scroll() {
	// Disabled: smooth scroll was causing shaking when user manually scrolls.
	// _scroll_to_bottom now uses instant snap with near-bottom detection.
}

void AIPanel::_on_ui_anim_tick() {
	// Update animation time
	anim_time += 0.033f;  // ~30fps
	
	// Only animate when thinking
	if (waiting_for_response && thinking_bubble && thinking_bubble->is_visible()) {
		_update_aurora_border();
		_update_orbiting_dots();
		_update_neural_activity();
	}
	
	// Always update these
	_update_connection_indicator();
	_update_typing_reveal();
	_update_smooth_scroll();
	
	// Ambient pulse decay
	if (ambient_pulse > 0) {
		ambient_pulse -= 0.02f;
		if (ambient_pulse < 0) ambient_pulse = 0;
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// ✨ PHASE 3+4: Connection Status, Typing Reveal, Neural Activity
// ═══════════════════════════════════════════════════════════════════════════

void AIPanel::_update_connection_indicator() {
	if (!connection_indicator) return;
	
	// Update breathing phase
	connection_breathe += 0.05f;
	if (connection_breathe > 6.28f) connection_breathe -= 6.28f;  // 2*PI
	
	// Calculate breathing alpha (0.5 to 1.0)
	float breathe = 0.75f + 0.25f * sin(connection_breathe);
	
	// Set color based on connection status
	Color status_color;
	String status_text;
	if (ws_connected) {
		status_color = COLOR_SUCCESS;
		status_text = "*";  // Solid for connected
	} else {
		status_color = COLOR_ERROR;
		status_text = "o";  // Hollow for disconnected
	}
	status_color.a = breathe;
	
	connection_indicator->set_text(status_text);
	connection_indicator->add_theme_color_override("font_color", status_color);
}

void AIPanel::_update_typing_reveal() {
	if (!current_typing_label || typing_full_text.is_empty()) return;
	
	// Advance typing phase
	typing_phase += 0.15f;  // Characters per frame
	
	if (typing_phase >= 1.0f) {
		typing_phase -= 1.0f;
		typing_char_index++;
		
		// Reveal next character
		if (typing_char_index <= typing_full_text.length()) {
			current_typing_label->clear();
			current_typing_label->add_text(typing_full_text.substr(0, typing_char_index));
			
			// Add blinking cursor if not done
			if (typing_char_index < typing_full_text.length()) {
				// Blinking cursor effect
				float blink = sin(anim_time * 8.0f);
				if (blink > 0) {
					current_typing_label->add_text("|");  // Cursor
				}
			}
		} else {
			// Done typing
			current_typing_label->clear();
			current_typing_label->add_text(typing_full_text);
			current_typing_label = nullptr;
			typing_full_text = "";
			typing_char_index = 0;
		}
	}
}

void AIPanel::_start_typing_reveal(RichTextLabel *label, const String &text) {
	current_typing_label = label;
	typing_full_text = text;
	typing_char_index = 0;
	typing_phase = 0.0f;
	
	// Start with empty text
	if (label) {
		label->clear();
	}
}

void AIPanel::_update_neural_activity() {
	if (!neural_activity_bar || !waiting_for_response) return;
	
	// Simulate neural activity with random fluctuations
	float target = 0.5f + 0.3f * sin(anim_time * 3.0f) + 0.2f * sin(anim_time * 7.0f);
	neural_activity = neural_activity * 0.9f + target * 0.1f;  // Smooth
	
	// Build activity bar visualization
	int bar_width = 20;
	int filled = int(neural_activity * bar_width);
	String bar = "";
	for (int i = 0; i < bar_width; i++) {
		if (i < filled) {
			bar += "#";
		} else {
			bar += "-";
		}
	}
	
	neural_activity_bar->set_text(bar);
	
	// Color based on activity level
	Color bar_color = COLOR_AI_CYAN.lerp(COLOR_AI_PURPLE, neural_activity);
	bar_color.a = 0.6f + 0.3f * neural_activity;
	neural_activity_bar->add_theme_color_override("font_color", bar_color);
}


void AIPanel::_clear_files_section() {
	// Remove existing file items
	for (int i = files_section->get_child_count() - 1; i >= 1; i--) {
		files_section->get_child(i)->queue_free();
	}
}

void AIPanel::_update_files_changed(const Array &p_results) {
	_clear_files_section();
	
	// Filter to only file-modifying results
	int file_change_count = 0;
	
	for (int i = 0; i < p_results.size(); i++) {
		Dictionary result = p_results[i];
		
		// Only show results marked as file changes
		bool is_file_change = result.get("isFileChange", false);
		if (!is_file_change) {
			continue;
		}
		
		String method = result.get("method", "");
		bool success = result.get("success", false);
		Dictionary inner = result.get("result", Dictionary());
		String path = inner.get("path", "");
		String name = inner.get("name", method);
		
		// For SpriteMancer, check saved_to_godot path
		if (path.is_empty() && inner.has("saved_to_godot")) {
			path = inner.get("saved_to_godot", "");
		}
		
		// Only show if we have a path or it's clearly a file operation
		String display = path.is_empty() ? name : path.get_file();
		if (display.is_empty()) {
			continue;
		}
		
		Label *item = memnew(Label);
		String icon = success ? "✅" : "❌";
		item->set_text("  " + icon + " " + display);
		item->add_theme_font_size_override("font_size", _theme_font_with_delta(this, 0, _scaled_ui_size(12)));
		item->add_theme_color_override("font_color", 
			success ? Color(0.6, 0.9, 0.6) : Color(0.9, 0.5, 0.5));
		files_section->add_child(item);
		file_change_count++;
	}
	
	// Hide section if no file changes
	files_section->set_visible(file_change_count > 0);
}

void AIPanel::_send_to_ai_router(const String &p_message) {
	Dictionary body;
	body["message"] = p_message;
	body["model"] = current_model;
	
	String json_body = JSON::stringify(body);
	
	Vector<String> headers;
	headers.push_back("Content-Type: application/json");
	
	Error err = http_request->request(ai_router_url, headers, HTTPClient::METHOD_POST, json_body);
	
	if (err != OK) {
		_hide_thinking();
		_add_message_bubble("AI", "⚠️ AI Router not running. Using local mode.", false);
		_process_local_command(p_message);
	}
}

void AIPanel::_on_http_request_completed(int p_result, int p_code, const PackedStringArray &p_headers, const PackedByteArray &p_body) {
	_hide_thinking();
	
	if (p_result != HTTPRequest::RESULT_SUCCESS || p_code != 200) {
		_add_message_bubble("AI", "⚠️ Connection error. Check if AI Router is running.", false);
		return;
	}
	
	String response_str = String::utf8((const char *)p_body.ptr(), p_body.size());
	
	JSON json;
	Error err = json.parse(response_str);
	if (err != OK) {
		_add_message_bubble("AI", "Error parsing response", false);
		return;
	}
	
	Dictionary response = json.get_data();
	String ai_response = response.get("response", "No response");
	Array results = response.get("results", Array());
	
	_add_message_bubble("AI", ai_response, false);
	_update_files_changed(results);
}

void AIPanel::_process_local_command(const String &p_command) {
	String cmd_lower = p_command.to_lower();
	
	if (cmd_lower.contains("create") && cmd_lower.contains("scene")) {
		String scene_name = cmd_lower.contains("player") ? "Player" : "NewScene";
		String root_type = cmd_lower.contains("player") ? "CharacterBody2D" : "Node2D";
		
		if (bridge) {
			Dictionary result = bridge->create_scene("res://" + scene_name + ".tscn", root_type);
			if (result.get("success", false)) {
				_add_message_bubble("AI", "Created " + scene_name + ".tscn ✅", false);
			}
		}
	} else if (cmd_lower.contains("add") && cmd_lower.contains("sprite")) {
		if (bridge) {
			bridge->add_node("", "Sprite2D", "Sprite");
			_add_message_bubble("AI", "Added Sprite2D ✅", false);
		}
	} else if (cmd_lower.contains("run") || cmd_lower.contains("play")) {
		if (bridge) {
			bridge->run_game("");
			_add_message_bubble("AI", "Running game... 🎮", false);
		}
	} else if (cmd_lower.contains("stop")) {
		if (bridge) {
			bridge->stop_game();
			_add_message_bubble("AI", "Game stopped ⏹️", false);
		}
	} else {
		_add_message_bubble("AI", "Start AI Router for full AI:\n   npx tsx src/aiRouter.ts", false);
	}
}

// WebSocket methods for streaming
void AIPanel::_connect_websocket() {
	if (ws_peer.is_null()) {
		ws_peer = Ref<WebSocketPeer>(WebSocketPeer::create());
		// Increase buffer size for large image data (8MB - base64 images can be several MB)
		if (ws_peer.is_valid()) {
			ws_peer->set_outbound_buffer_size((1 << 23) - 1);  // ~8MB buffer
			ws_peer->set_inbound_buffer_size((1 << 23) - 1);   // Also for large responses
		}
	}
	
	if (ws_peer.is_null()) {
		// WebSocket not available - will use HTTP fallback
		print_line("AIPanel: WebSocket not available, using HTTP fallback");
		return;
	}
	
	print_line("AIPanel: Connecting to WebSocket " + ws_url);
	Error err = ws_peer->connect_to_url(ws_url);
	if (err == OK) {
		ws_connected = false; // Will be true after handshake
	} else {
		print_line("AIPanel: WebSocket connect failed with error " + itos(err));
	}
}

void AIPanel::_poll_websocket() {
	if (ws_peer.is_null()) {
		return;
	}
	
	ws_peer->poll();
	WebSocketPeer::State state = ws_peer->get_ready_state();
	
	if (state == WebSocketPeer::STATE_OPEN) {
		if (!ws_connected) {
			ws_connected = true;
			ws_reconnect_attempts = 0; // Reset backoff on successful connection
			print_line("AIPanel: WebSocket connected!");
		}
		
		// Process incoming packets
		while (ws_peer->get_available_packet_count() > 0) {
			const uint8_t *buffer;
			int buffer_size;
			Error err = ws_peer->get_packet(&buffer, buffer_size);
			if (err == OK && buffer_size > 0) {
				String msg = String::utf8((const char *)buffer, buffer_size);
				_on_ws_message(msg);
			}
		}
	} else if (state == WebSocketPeer::STATE_CLOSED) {
		if (ws_connected) {
			print_line("AIPanel: WebSocket disconnected, will retry...");
		}
		ws_connected = false;
		
		// Exponential backoff: don't spam reconnect attempts
		uint64_t now = Time::get_singleton()->get_ticks_msec();
		int delay_ms = MIN(WS_RECONNECT_BASE_MS * (1 << MIN(ws_reconnect_attempts, 5)), WS_RECONNECT_MAX_MS);
		
		if (now - ws_last_reconnect_time >= (uint64_t)delay_ms) {
			ws_last_reconnect_time = now;
			ws_reconnect_attempts++;
			if (ws_reconnect_attempts <= WS_RECONNECT_MAX_ATTEMPTS) {
				print_line("AIPanel: Reconnecting to WebSocket (attempt " + itos(ws_reconnect_attempts) + ", next retry in " + itos(delay_ms / 1000) + "s)...");
			}
			_connect_websocket();
		}
		// Otherwise: wait for backoff timer to elapse
	} else if (state == WebSocketPeer::STATE_CONNECTING) {
		// Still connecting, wait
	}
}

void AIPanel::_on_ws_message(const String &p_message) {
	JSON json;
	Error err = json.parse(p_message);
	if (err != OK) return;
	
	Dictionary data = json.get_data();
	String type = data.get("type", "");
	
	if (type == "thinking") {
		_show_thinking();
		streaming_text = "";
	} else if (type == "thought") {
		String chunk = data.get("chunk", "");
		String elapsed = data.get("elapsed", "0");
		current_thought_text += chunk;
		_update_thinking_text("[Thinking " + elapsed + "s...]\n" + current_thought_text);
	} else if (type == "status") {
		String text = data.get("text", "");
		_update_thinking_text(text);
		if (current_tab == 1) {
			_update_blueprint_tab();
		}
	} else if (type == "state") {
		String state = data.get("state", "");
		if (state == "waiting_user") {
			_update_thinking_text("Waiting for user input...");
		}
	} else if (type == "question") {
		// Display question and prompt user to answer
		String question_id = data.get("question_id", "");
		String question = data.get("question", "");
		String default_answer = data.get("default", "");
		
		_hide_thinking();
		_add_message_bubble("AI", "❓ " + question, false);
		
		// Store question context for when user responds
		pending_question_id = question_id;
		pending_question_default = default_answer;
		
		// Show hint in input placeholder
		if (input_field) {
			input_field->set_placeholder("Type your answer (default: " + default_answer + ")");
		}
	} else if (type == "text") {
		String chunk = data.get("chunk", "");
		String elapsed = data.get("elapsed", "0");
		streaming_text += chunk;
		_update_thinking_text("[Thinking " + elapsed + "s...]");
	} else if (type == "done") {
		String response = data.get("response", "");
		Array results = data.get("results", Array());
		String elapsed = data.get("elapsed", "0");
		
		// First, finalize and hide the thinking indicator
		_hide_thinking();

		// Clear agent statuses so they reset to idle defaults
		// (prevents stale "Done" badges from lingering forever)
		_clear_agent_statuses();
		
		// Build result summary for important queries
		String result_summary = "";
		for (int i = 0; i < results.size(); i++) {
			Dictionary result = results[i];
			String method = result.get("method", "");
			bool success = result.get("success", false);
			Dictionary inner = result.get("result", Dictionary());
			
			if (success && method == "get_selected_text") {
				if (inner.get("has_selection", false)) {
					String selected = inner.get("selected_text", "");
					String script_path = inner.get("script_path", "");
					if (selected.length() > 200) {
						selected = selected.substr(0, 200) + "...";
					}
					result_summary += "\n\n📝 Selected in " + script_path.get_file() + ":\n```\n" + selected + "\n```";
				} else {
					int line = inner.get("cursor_line", 0);
					String current_line = inner.get("current_line", "");
					result_summary += "\n\n📍 Cursor at line " + itos(line + 1) + ": " + current_line.strip_edges();
				}
			} else if (success && method == "get_selected_files") {
				Array files = inner.get("files", Array());
				Array folders = inner.get("folders", Array());
				if (files.size() > 0 || folders.size() > 0) {
					result_summary += "\n\n📁 Selected files:\n";
					for (int j = 0; j < files.size(); j++) {
						result_summary += "  • " + String(files[j]).get_file() + "\n";
					}
					for (int j = 0; j < folders.size(); j++) {
						result_summary += "  📂 " + String(folders[j]) + "\n";
					}
				}
			} else if (success && method == "get_selected_nodes") {
				Array nodes = inner.get("nodes", Array());
				if (nodes.size() > 0) {
					result_summary += "\n\n🎬 Selected nodes:\n";
					for (int j = 0; j < nodes.size(); j++) {
						Dictionary node = nodes[j];
						result_summary += "  • " + String(node.get("name", "")) + " (" + String(node.get("type", "")) + ")\n";
					}
				}
			} else if (success && method == "spritemancer_create_character") {
				// Show the generated sprite inline!
				String saved_path = inner.get("saved_to_godot", "");
				String description = inner.get("description", "Generated sprite");
				if (!saved_path.is_empty()) {
					// Will add image bubble after the message
					call_deferred("_add_image_bubble", saved_path, description);
					result_summary += "\n\n✨ Sprite generated: " + saved_path.get_file();
				}
			}
		}
		
			_add_message_bubble("AI", response + result_summary + "\n[" + elapsed + "s]", false);
			_update_files_changed(results);
			if (current_tab == 1) {
				_update_blueprint_tab();
			}
		} else if (type == "error") {
		_hide_thinking();
		String message = data.get("message", "Error");
		_add_message_bubble("AI", "Error: " + message, false);
	} else if (type == "approval_request") {
		// Show approval UI with approve/reject buttons
		String tool_id = data.get("tool_id", "");
		String tool_name = data.get("tool", "");
		String question = data.get("question", "");  // Friendly question text
		Dictionary params = data.get("params", Dictionary());
		_show_approval_ui(tool_id, tool_name, question, params);
	} else if (type == "approval_acknowledged") {
		// Server acknowledged our approval (or auto-approved after timeout).
		// Dismiss the approval dialog if it's still showing.
		String tool_id = data.get("tool_id", "");
		if (!tool_id.is_empty() && pending_approval_id == tool_id) {
			// Already handled by _on_approval_response, just clear state
			pending_approval_id = "";
		} else if (!tool_id.is_empty()) {
			// Late acknowledgment — dismiss the UI bubble for this tool_id
			for (int i = messages_container->get_child_count() - 1; i >= 0; i--) {
				Control *bubble = Object::cast_to<Control>(messages_container->get_child(i));
				if (!bubble || !bubble->has_meta("approval_id")) {
					continue;
				}
				if (String(bubble->get_meta("approval_id")) == tool_id) {
					Control *actions = Object::cast_to<Control>(bubble->find_child("ApprovalActions", true, false));
					if (actions) {
						actions->set_visible(false);
					}
					Label *decision_label = Object::cast_to<Label>(bubble->find_child("ApprovalDecision", true, false));
					if (decision_label) {
						bool was_approved = data.get("approved", true);
						decision_label->set_text(was_approved ? "Status: auto-approved" : "Status: dismissed");
						decision_label->add_theme_color_override("font_color", Color(0.72, 0.75, 0.82));
						decision_label->set_visible(true);
					}
					break;
				}
			}
			if (pending_approval_id == tool_id) {
				pending_approval_id = "";
			}
		}
	} else if (type == "file_change") {
		// Track file changes for Files Changed panel
		String tool_name = data.get("tool", "");
		bool success = data.get("success", false);
		String path = data.get("path", "");
		if (!path.is_empty()) {
			_add_diff_entry(path, success ? "edited" : "error");
		}
	} else if (type == "diff") {
		// Rich diff preview with before/after content
		String tool_name = data.get("tool", "");
		String path = data.get("path", "");
		String before = data.get("before", "");
		String after = data.get("after", "");
		
		// Add to diff tab
		_add_rich_diff_entry(path, tool_name, before, after);
	} else if (type == "agent_status") {
		// Multi-agent status update
		String name = data.get("name", "");
		String role = data.get("role", "");
		String state = data.get("state", "");
		float progress = data.get("progress", 0.0f);
		
		update_agent_status(name, role, state, progress);
	} else if (type == "multi_agent_enabled") {
		// Multi-agent mode toggle
		bool enabled = data.get("enabled", false);
		set_multi_agent_enabled(enabled);
	} else if (type == "clear_agents") {
		// Clear all agent statuses
		clear_all_agent_statuses();
	} else if (type == "plan_created") {
		// Multi-agent plan created - store and update UI
		String plan_id = data.get("plan_id", "");
		Array tasks = data.get("tasks", Array());
		
		// Build steps array for bridge storage
		Array steps;
			for (int i = 0; i < tasks.size(); i++) {
				Dictionary task = tasks[i];
				Dictionary step;
				step["name"] = task.get("type", "");
				step["type"] = task.get("type", "");
				step["agent"] = task.get("assignedAgent", task.get("agent", ""));
				step["description"] = task.get("description", "");
				step["status"] = task.get("status", "pending");
				steps.push_back(step);
			}
		
		// Store plan on bridge using correct signature
		if (bridge) {
			bridge->set_current_plan("Execution Plan", steps);
		}
		
		// Refresh blueprint tab
		_update_blueprint_tab();
	}
}

String AIPanel::_find_res_path_by_basename(const String &p_basename, const String &p_dir) const {
	if (p_basename.is_empty()) {
		return "";
	}

	Ref<DirAccess> dir = DirAccess::open(p_dir);
	if (!dir.is_valid()) {
		return "";
	}

	dir->list_dir_begin();
	String item = dir->get_next();
	while (!item.is_empty()) {
		if (item != "." && item != "..") {
			String full_path = (p_dir == "res://") ? "res://" + item : p_dir.path_join(item);
			if (dir->current_is_dir()) {
				String nested = _find_res_path_by_basename(p_basename, full_path);
				if (!nested.is_empty()) {
					dir->list_dir_end();
					return nested;
				}
			} else if (item == p_basename) {
				dir->list_dir_end();
				return full_path;
			}
		}
		item = dir->get_next();
	}
	dir->list_dir_end();
	return "";
}

String AIPanel::_normalize_project_path(const String &p_path) const {
	String normalized = p_path.strip_edges();
	if (normalized.is_empty()) {
		return normalized;
	}

	if ((normalized.begins_with("\"") && normalized.ends_with("\"")) ||
		(normalized.begins_with("'") && normalized.ends_with("'"))) {
		normalized = normalized.substr(1, normalized.length() - 2);
	}

	if (normalized.begins_with("res://") || normalized.begins_with("user://")) {
		return normalized;
	}

	if (normalized.is_absolute_path()) {
		ProjectSettings *settings = ProjectSettings::get_singleton();
		if (settings) {
			String localized = settings->localize_path(normalized);
			if (localized.begins_with("res://") || localized.begins_with("user://")) {
				return localized;
			}
		}
		return normalized;
	}

	while (normalized.begins_with("./")) {
		normalized = normalized.substr(2);
	}
	while (normalized.begins_with("/")) {
		normalized = normalized.substr(1);
	}

	String candidate = "res://" + normalized;
	if (FileAccess::exists(candidate)) {
		return candidate;
	}

	if (normalized.find("/") == -1) {
		static const char *common_dirs[] = { "res://scenes/", "res://scripts/", "res://assets/", "res://sprites/" };
		for (int i = 0; i < 4; i++) {
			String common_candidate = String(common_dirs[i]) + normalized;
			if (FileAccess::exists(common_candidate)) {
				return common_candidate;
			}
		}

		String found = _find_res_path_by_basename(normalized, "res://");
		if (!found.is_empty()) {
			return found;
		}
	}

	return candidate;
}

String AIPanel::_build_line_change_preview(const String &p_before, const String &p_after, int p_max_change_lines, int &r_added, int &r_removed) const {
	r_added = 0;
	r_removed = 0;

	PackedStringArray before_lines = p_before.split("\n");
	PackedStringArray after_lines = p_after.split("\n");

	int i = 0;
	int j = 0;
	int emitted_lines = 0;
	String preview;

	while (i < before_lines.size() || j < after_lines.size()) {
		if (i < before_lines.size() && j < after_lines.size() && before_lines[i] == after_lines[j]) {
			i++;
			j++;
			continue;
		}

		if (emitted_lines >= p_max_change_lines) {
			preview += "... (diff truncated)\n";
			break;
		}

		bool deletion = i < before_lines.size() &&
			(j >= after_lines.size() || (i + 1 < before_lines.size() && j < after_lines.size() && before_lines[i + 1] == after_lines[j]));
		bool addition = j < after_lines.size() &&
			(i >= before_lines.size() || (j + 1 < after_lines.size() && i < before_lines.size() && before_lines[i] == after_lines[j + 1]));

		if (deletion) {
			preview += "- " + itos(i + 1) + ": " + before_lines[i] + "\n";
			r_removed++;
			i++;
			emitted_lines++;
			continue;
		}

		if (addition) {
			preview += "+ " + itos(j + 1) + ": " + after_lines[j] + "\n";
			r_added++;
			j++;
			emitted_lines++;
			continue;
		}

		if (i < before_lines.size()) {
			preview += "- " + itos(i + 1) + ": " + before_lines[i] + "\n";
			r_removed++;
			i++;
			emitted_lines++;
		}
		if (j < after_lines.size() && emitted_lines < p_max_change_lines) {
			preview += "+ " + itos(j + 1) + ": " + after_lines[j] + "\n";
			r_added++;
			j++;
			emitted_lines++;
		}
	}

	if (preview.is_empty()) {
		preview = "No line-level differences detected.";
	}

	return preview;
}

void AIPanel::_show_approval_ui(const String &p_tool_id, const String &p_tool_name, const String &p_question, const Dictionary &p_params) {
	pending_approval_id = p_tool_id;
	
	// Hide thinking indicator during approval
	_hide_thinking();
	
	// Create approval bubble
	PanelContainer *bubble = memnew(PanelContainer);
	bubble->set_h_size_flags(SIZE_EXPAND_FILL);
	bubble->set_meta("approval_id", p_tool_id);
	
	Ref<StyleBoxFlat> style;
	style.instantiate();
	style->set_bg_color(Color(0.12, 0.14, 0.18, 0.98));
	style->set_corner_radius_all(10);
	style->set_content_margin_all(14);
	style->set_border_width_all(1);
	style->set_border_color(Color(0.76, 0.57, 0.24));
	bubble->add_theme_style_override("panel", style);
	
	VBoxContainer *vbox = memnew(VBoxContainer);
	vbox->add_theme_constant_override("separation", 10);
	bubble->add_child(vbox);
	
	// Title
	Label *title = memnew(Label);
	title->set_text("APPROVAL REQUIRED");
	title->add_theme_color_override("font_color", Color(0.98, 0.86, 0.46));
	title->add_theme_font_size_override("font_size", _theme_font_with_delta(this, 1, _scaled_ui_size(13)));
	vbox->add_child(title);
	
	// Question/Info text - display friendly question if provided, otherwise tool name
	Label *info = memnew(Label);
	String question_text = p_question.strip_edges();
	if (question_text.is_empty()) {
		question_text = "Confirm action for tool: " + p_tool_name;
	}
	info->set_text(question_text);
	info->set_autowrap_mode(TextServer::AUTOWRAP_WORD_SMART);
	info->add_theme_color_override("font_color", Color(0.92, 0.94, 0.98));
	info->add_theme_font_size_override("font_size", _theme_font_with_delta(this, 0, _scaled_ui_size(14)));
	vbox->add_child(info);
	
	// Show some params
	if (p_params.has("node") || p_params.has("path") || p_params.has("name")) {
		Label *params_label = memnew(Label);
		String param_text = "Context:\n";
		if (p_params.has("node")) param_text += "Node: " + String(p_params["node"]) + "\n";
		if (p_params.has("path")) param_text += "Path: " + String(p_params["path"]) + "\n";
		if (p_params.has("name")) param_text += "Name: " + String(p_params["name"]);
		params_label->set_text(param_text.strip_edges());
		params_label->add_theme_color_override("font_color", Color(0.72, 0.75, 0.82));
		params_label->add_theme_font_size_override("font_size", _theme_font_with_delta(this, -1, _scaled_ui_size(12)));
		params_label->set_autowrap_mode(TextServer::AUTOWRAP_WORD_SMART);
		vbox->add_child(params_label);
	}
	
	// Buttons
	HBoxContainer *buttons = memnew(HBoxContainer);
	buttons->set_name("ApprovalActions");
	buttons->set_alignment(BoxContainer::ALIGNMENT_CENTER);
	buttons->add_theme_constant_override("separation", 12);
	vbox->add_child(buttons);
	
	Button *approve_btn = memnew(Button);
	approve_btn->set_text("Approve");
	approve_btn->set_custom_minimum_size(Size2(_scaled_ui_size(136), _scaled_ui_size(44)));
	approve_btn->add_theme_color_override("font_color", Color(0.82, 0.97, 0.85));
	Ref<StyleBoxFlat> approve_normal;
	approve_normal.instantiate();
	approve_normal->set_bg_color(Color(0.14, 0.24, 0.17));
	approve_normal->set_corner_radius_all(8);
	approve_normal->set_content_margin_all(10);
	approve_normal->set_border_width_all(1);
	approve_normal->set_border_color(Color(0.32, 0.73, 0.41));
	approve_btn->add_theme_style_override("normal", approve_normal);
	Ref<StyleBoxFlat> approve_hover;
	approve_hover.instantiate();
	approve_hover->set_corner_radius_all(8);
	approve_hover->set_content_margin_all(10);
	approve_hover->set_border_width_all(1);
	approve_hover->set_border_color(Color(0.32, 0.73, 0.41));
	approve_hover->set_bg_color(Color(0.18, 0.30, 0.22));
	approve_btn->add_theme_style_override("hover", approve_hover);
	Ref<StyleBoxFlat> approve_pressed;
	approve_pressed.instantiate();
	approve_pressed->set_corner_radius_all(8);
	approve_pressed->set_content_margin_all(10);
	approve_pressed->set_border_width_all(1);
	approve_pressed->set_border_color(Color(0.32, 0.73, 0.41));
	approve_pressed->set_bg_color(Color(0.12, 0.20, 0.14));
	approve_btn->add_theme_style_override("pressed", approve_pressed);
	approve_btn->connect("pressed", callable_mp(this, &AIPanel::_on_approval_response).bind(true));
	buttons->add_child(approve_btn);
	
	Button *reject_btn = memnew(Button);
	reject_btn->set_text("Reject");
	reject_btn->set_custom_minimum_size(Size2(_scaled_ui_size(136), _scaled_ui_size(44)));
	reject_btn->add_theme_color_override("font_color", Color(0.98, 0.74, 0.74));
	Ref<StyleBoxFlat> reject_normal;
	reject_normal.instantiate();
	reject_normal->set_bg_color(Color(0.24, 0.14, 0.15));
	reject_normal->set_corner_radius_all(8);
	reject_normal->set_content_margin_all(10);
	reject_normal->set_border_width_all(1);
	reject_normal->set_border_color(Color(0.79, 0.34, 0.37));
	reject_btn->add_theme_style_override("normal", reject_normal);
	Ref<StyleBoxFlat> reject_hover;
	reject_hover.instantiate();
	reject_hover->set_corner_radius_all(8);
	reject_hover->set_content_margin_all(10);
	reject_hover->set_border_width_all(1);
	reject_hover->set_border_color(Color(0.79, 0.34, 0.37));
	reject_hover->set_bg_color(Color(0.30, 0.17, 0.19));
	reject_btn->add_theme_style_override("hover", reject_hover);
	Ref<StyleBoxFlat> reject_pressed;
	reject_pressed.instantiate();
	reject_pressed->set_corner_radius_all(8);
	reject_pressed->set_content_margin_all(10);
	reject_pressed->set_border_width_all(1);
	reject_pressed->set_border_color(Color(0.79, 0.34, 0.37));
	reject_pressed->set_bg_color(Color(0.20, 0.12, 0.13));
	reject_btn->add_theme_style_override("pressed", reject_pressed);
	reject_btn->connect("pressed", callable_mp(this, &AIPanel::_on_approval_response).bind(false));
	buttons->add_child(reject_btn);

	// Status line shown after a decision, replacing button row
	Label *decision_label = memnew(Label);
	decision_label->set_name("ApprovalDecision");
	decision_label->set_visible(false);
	decision_label->add_theme_font_size_override("font_size", _theme_font_with_delta(this, -1, _scaled_ui_size(12)));
	decision_label->add_theme_color_override("font_color", Color(0.72, 0.75, 0.82));
	vbox->add_child(decision_label);
	
	messages_container->add_child(bubble);
	call_deferred("_scroll_to_bottom");
}

void AIPanel::_on_approval_response(bool p_approved) {
	if (pending_approval_id.is_empty()) {
		return;
	}
	
	String approval_id = pending_approval_id;
	
	// Send approval response back via WebSocket
	Dictionary response;
	response["type"] = "approval_response";
	response["tool_id"] = approval_id;
	response["approved"] = p_approved;
	
	String json_str = JSON::stringify(response);
	if (ws_peer.is_valid() && ws_peer->get_ready_state() == WebSocketPeer::STATE_OPEN) {
		print_line("AIPanel: approval_response tool_id=" + approval_id + " approved=" + String(p_approved ? "true" : "false"));
		ws_peer->send_text(json_str);
	}

	// Hide action buttons on the matching approval bubble and show final state.
	for (int i = messages_container->get_child_count() - 1; i >= 0; i--) {
		Control *bubble = Object::cast_to<Control>(messages_container->get_child(i));
		if (!bubble || !bubble->has_meta("approval_id")) {
			continue;
		}
		String bubble_approval_id = String(bubble->get_meta("approval_id"));
		if (bubble_approval_id != approval_id) {
			continue;
		}

		Control *actions = Object::cast_to<Control>(bubble->find_child("ApprovalActions", true, false));
		if (actions) {
			actions->set_visible(false);
		}

		Label *decision_label = Object::cast_to<Label>(bubble->find_child("ApprovalDecision", true, false));
		if (decision_label) {
			if (p_approved) {
				decision_label->set_text("Status: approved");
				decision_label->add_theme_color_override("font_color", Color(0.62, 0.90, 0.67));
			} else {
				decision_label->set_text("Status: rejected");
				decision_label->add_theme_color_override("font_color", Color(0.93, 0.58, 0.58));
			}
			decision_label->set_visible(true);
		}
		break;
	}
	
	// Add confirmation message
	String msg = p_approved ? "Approved" : "Rejected";
	_add_message_bubble("You", msg, true);
	
	pending_approval_id = "";
	
	// Show thinking again if approved
	if (p_approved) {
		_show_thinking();
	}

	call_deferred("_scroll_to_bottom");
}

// ============ Image Input Methods ============

void AIPanel::_on_input_gui_input(const Ref<InputEvent> &p_event) {
	Ref<InputEventKey> key = p_event;
	if (key.is_valid() && key->is_pressed()) {
		// Check for Ctrl+V / Cmd+V (paste)
		if (key->get_keycode() == Key::V && key->is_command_or_control_pressed()) {
			// Get clipboard image
			Ref<Image> clip_img = DisplayServer::get_singleton()->clipboard_get_image();
			if (clip_img.is_valid() && !clip_img->is_empty()) {
				_add_pending_image(clip_img);
				print_line("AIPanel: Image pasted from clipboard (" + itos(clip_img->get_width()) + "x" + itos(clip_img->get_height()) + "), total: " + itos(pending_images.size()));
			}
		}
	}
}

void AIPanel::_add_pending_image(const Ref<Image> &p_image) {
	if (!p_image.is_valid() || p_image->is_empty()) return;
	
	// Add to vector, respecting max limit
	pending_images.push_back(p_image);
	if (pending_images.size() > MAX_PENDING_IMAGES) {
		pending_images.remove_at(0);  // Remove oldest
		print_line("AIPanel: Max images reached, removed oldest");
	}
	
	_update_image_thumbnails();
}

void AIPanel::_update_image_thumbnails() {
	if (!image_preview_container) return;
	
	int count = pending_images.size();
	if (count == 0) {
		image_preview_container->set_visible(false);
		// Clear existing thumbnail containers
		for (Control* container : thumbnail_containers) {
			if (container && container->get_parent()) {
				container->get_parent()->remove_child(container);
				memdelete(container);
			}
		}
		thumbnail_containers.clear();
		if (image_count_label) {
			image_count_label->set_text("");
		}
		return;
	}
	
	image_preview_container->set_visible(true);
	
	// Clear all existing containers and rebuild (simpler than managing indices with lambdas)
	for (Control* container : thumbnail_containers) {
		if (container && container->get_parent()) {
			container->get_parent()->remove_child(container);
			memdelete(container);
		}
	}
	thumbnail_containers.clear();
	
	// Create thumbnail containers for each pending image
	const int THUMB_SIZE = _scaled_ui_size(48);
	for (int i = 0; i < count; i++) {
		Ref<Image> img = pending_images[i];
		if (!img.is_valid() || img->is_empty()) continue;
		
		// Create container that holds thumbnail and X button
		Control* container = memnew(Control);
		container->set_custom_minimum_size(Size2(THUMB_SIZE + _scaled_ui_size(8), THUMB_SIZE + _scaled_ui_size(8)));
		
		// Create thumbnail TextureRect
		TextureRect* thumb = memnew(TextureRect);
		thumb->set_custom_minimum_size(Size2(THUMB_SIZE, THUMB_SIZE));
		thumb->set_stretch_mode(TextureRect::STRETCH_KEEP_ASPECT_CENTERED);
		thumb->set_expand_mode(TextureRect::EXPAND_FIT_WIDTH_PROPORTIONAL);
		thumb->set_position(Vector2(_scaled_ui_size(4), _scaled_ui_size(4)));
		thumb->set_size(Size2(THUMB_SIZE, THUMB_SIZE));
		
		// Create scaled-down texture
		Ref<Image> thumb_img = img->duplicate();
		int orig_w = thumb_img->get_width();
		int orig_h = thumb_img->get_height();
		float scale = MIN((float)THUMB_SIZE / orig_w, (float)THUMB_SIZE / orig_h);
		int new_w = MAX(1, (int)(orig_w * scale));
		int new_h = MAX(1, (int)(orig_h * scale));
		thumb_img->resize(new_w, new_h);
		Ref<ImageTexture> tex = ImageTexture::create_from_image(thumb_img);
		thumb->set_texture(tex);
		
		// Make thumbnail clickable to expand - using meta to store index
		thumb->set_mouse_filter(Control::MOUSE_FILTER_STOP);
		thumb->set_meta("image_index", i);
		thumb->connect("gui_input", callable_mp(this, &AIPanel::_on_thumb_gui_input).bind(i));
		
		container->add_child(thumb);
		
		// Create X button in top-right corner (like SS2 reference)
		Button* x_btn = memnew(Button);
		x_btn->set_text(String::utf8("×"));  // Unicode multiplication sign
		x_btn->set_flat(true);
		x_btn->add_theme_font_size_override("font_size", _theme_font_with_delta(this, 1, _scaled_ui_size(14), "Button"));
		x_btn->add_theme_color_override("font_color", Color(0.9, 0.9, 0.9));
		x_btn->add_theme_color_override("font_hover_color", Color(1, 0.4, 0.4));
		x_btn->add_theme_color_override("font_pressed_color", Color(1, 0.2, 0.2));
		x_btn->set_custom_minimum_size(Size2(_scaled_ui_size(20), _scaled_ui_size(20)));
		x_btn->set_size(Size2(_scaled_ui_size(20), _scaled_ui_size(20)));
		x_btn->set_position(Vector2(THUMB_SIZE - _scaled_ui_size(12), -_scaled_ui_size(2)));  // Top-right corner
		x_btn->set_tooltip_text("Remove this image");
		x_btn->set_meta("image_index", i);
		x_btn->connect("pressed", callable_mp(this, &AIPanel::_on_remove_image_pressed).bind(i));
		
		container->add_child(x_btn);
		
		image_preview_container->add_child(container);
		thumbnail_containers.push_back(container);
	}
	
	// Update or create count label (after thumbnails)
	if (!image_count_label) {
		image_count_label = memnew(Label);
		image_count_label->add_theme_font_size_override("font_size", _theme_font_with_delta(this, -2, _scaled_ui_size(11)));
		image_count_label->add_theme_color_override("font_color", Color(0.6, 0.8, 0.9));
		image_preview_container->add_child(image_count_label);
	} else {
		// Move to end
		image_preview_container->move_child(image_count_label, -1);
	}
	
	image_count_label->set_text(itos(count) + (count > 1 ? " images" : " image"));
}

void AIPanel::_on_thumbnail_clicked() {
	if (pending_images.is_empty()) return;
	
	// Show first image in popup (could be improved to show gallery)
	Ref<Image> first_img = pending_images[0];
	if (!first_img.is_valid() || first_img->is_empty()) return;
	
	// Show full-size image in popup
	if (image_popup && popup_image) {
		Ref<ImageTexture> tex = ImageTexture::create_from_image(first_img);
		popup_image->set_texture(tex);
		
		// Calculate popup size - max 80% of screen, maintain aspect ratio
		Size2 img_size = Size2(first_img->get_width(), first_img->get_height());
		Size2 max_size = Size2(800, 600);
		float scale = MIN(max_size.x / img_size.x, max_size.y / img_size.y);
		scale = MIN(scale, 1.0);  // Don't upscale
		Size2 popup_size = img_size * scale + Size2(20, 60);  // Padding + title bar
		
		image_popup->set_size(popup_size);
		image_popup->popup_centered();
	}
}

void AIPanel::_on_popup_close() {
	if (image_popup) {
		image_popup->hide();
	}
}

void AIPanel::_on_thumb_gui_input(const Ref<InputEvent> &p_event, int p_index) {
	Ref<InputEventMouseButton> mb = p_event;
	if (mb.is_valid() && mb->is_pressed() && mb->get_button_index() == MouseButton::LEFT) {
		_show_image_popup(p_index);
	}
}

void AIPanel::_on_remove_image_pressed(int p_index) {
	_remove_pending_image(p_index);
}

void AIPanel::_remove_pending_image(int p_index) {
	if (p_index < 0 || p_index >= pending_images.size()) return;
	
	pending_images.remove_at(p_index);
	
	// Use MessageQueue to defer the update safely
	MessageQueue::get_singleton()->push_callable(callable_mp(this, &AIPanel::_update_image_thumbnails));
}

void AIPanel::_show_image_popup(int p_index) {
	if (p_index < 0 || p_index >= pending_images.size()) return;
	
	Ref<Image> img = pending_images[p_index];
	if (!img.is_valid() || img->is_empty()) return;
	
	if (image_popup && popup_image) {
		Ref<ImageTexture> tex = ImageTexture::create_from_image(img);
		popup_image->set_texture(tex);
		
		// Calculate popup size - max 80% of screen, maintain aspect ratio
		Size2 img_size = Size2(img->get_width(), img->get_height());
		Size2 max_size = Size2(800, 600);
		float scale = MIN(max_size.x / img_size.x, max_size.y / img_size.y);
		scale = MIN(scale, 1.0);  // Don't upscale
		Size2 popup_size = img_size * scale + Size2(20, 60);  // Padding + title bar
		
		image_popup->set_size(popup_size);
		image_popup->popup_centered();
	}
}

void AIPanel::_clear_image_attachment() {
	pending_images.clear();
	
	// Clear thumbnail containers
	for (Control* container : thumbnail_containers) {
		if (container && container->get_parent()) {
			container->get_parent()->remove_child(container);
			memdelete(container);
		}
	}
	thumbnail_containers.clear();
	
	if (image_preview_container) {
		image_preview_container->set_visible(false);
	}
	if (image_count_label) {
		image_count_label->set_text("");
	}
}

String AIPanel::_encode_image_base64(const Ref<Image> &p_image) {
	if (!p_image.is_valid() || p_image->is_empty()) {
		return "";
	}
	
	// Convert image to PNG bytes
	PackedByteArray png_data = p_image->save_png_to_buffer();
	
	// Base64 encode using CryptoCore
	return CryptoCore::b64_encode_str(png_data.ptr(), png_data.size());
}

void AIPanel::_update_thinking_text(const String &p_text) {
	if (thinking_text) {
		thinking_text->clear();
		thinking_text->add_text(p_text);
	}
	// DON'T overwrite current_thought_text here - it's accumulated from "thought" chunks
	call_deferred("_scroll_to_bottom");
}

void AIPanel::_send_via_websocket(const String &p_message) {
	if (ws_peer.is_null() || ws_peer->get_ready_state() != WebSocketPeer::STATE_OPEN) {
		// Fall back to HTTP
		_send_to_ai_router(p_message);
		return;
	}
	
	Dictionary body;
	body["message"] = p_message;
	body["model"] = current_model;
	
	// Include image data as array if images are attached
	if (!pending_images.is_empty()) {
		Array image_array;
		for (int i = 0; i < pending_images.size(); i++) {
			image_array.push_back(_encode_image_base64(pending_images[i]));
		}
		body["image_data"] = image_array;
		_clear_image_attachment();
	}
	
	String json_str = JSON::stringify(body);
	ws_peer->send_text(json_str);
}

// ============ Tab Methods ============

void AIPanel::_on_tab_changed(int p_tab) {
	current_tab = p_tab;
	
	// Switch tab visibility
	if (scene_tab) scene_tab->set_visible(p_tab == 0);
	if (blueprint_tab) blueprint_tab->set_visible(p_tab == 1);
	if (diff_tab) diff_tab->set_visible(p_tab == 2);
	if (agents_tab) agents_tab->set_visible(p_tab == 3);
	
	// Update content when switching to tabs
	if (p_tab == 1) {
		_update_blueprint_tab();
	} else if (p_tab == 3) {
		_update_agents_tab();
	}
}

void AIPanel::_update_blueprint_tab() {
	if (!bridge || !blueprint_content) return;
	
	// Clear existing content
	while (blueprint_content->get_child_count() > 0) {
		Node *child = blueprint_content->get_child(0);
		blueprint_content->remove_child(child);
		memdelete(child);
	}
	
	// Get current plan from bridge
	Dictionary plan = bridge->get_current_plan();
	if (!plan.has("steps")) {
		Label *no_plan = memnew(Label);
		no_plan->set_text("No active plan. Ask the AI to create one!");
		no_plan->add_theme_color_override("font_color", Color(0.5, 0.5, 0.6));
		blueprint_content->add_child(no_plan);
		return;
	}
	
	// Display plan name
	Label *plan_name = memnew(Label);
	plan_name->set_text(String(plan.get("name", "Unnamed Plan")));
	plan_name->add_theme_font_size_override("font_size", _theme_font_with_delta(this, 1, _scaled_ui_size(14)));
	plan_name->add_theme_color_override("font_color", Color(0.8, 0.9, 1.0));
	blueprint_content->add_child(plan_name);
	
	Array steps = plan["steps"];
	int current_step_index = int(plan.get("current_step", -1));
	int completed_count = 0;
	int in_progress_count = 0;
	for (int i = 0; i < steps.size(); i++) {
		Dictionary step_dict = steps[i];
		String status = _normalize_step_status(step_dict);
		if (status == "pending" && i == current_step_index && current_step_index < steps.size()) {
			status = "in_progress";
		}
		if (status == "completed") {
			completed_count++;
		} else if (status == "in_progress") {
			in_progress_count++;
		}
	}

	Label *progress_label = memnew(Label);
	progress_label->set_text("Completed " + itos(completed_count) + "/" + itos(steps.size()) +
		(in_progress_count > 0 ? (" | In Progress " + itos(in_progress_count)) : ""));
	progress_label->add_theme_font_size_override("font_size", _theme_font_with_delta(this, -2, _scaled_ui_size(11)));
	progress_label->add_theme_color_override("font_color", Color(0.62, 0.68, 0.78));
	blueprint_content->add_child(progress_label);

	// Display steps
	for (int i = 0; i < steps.size(); i++) {
		Dictionary step = steps[i];
		String status = _normalize_step_status(step);
		if (status == "pending" && i == current_step_index && current_step_index < steps.size()) {
			status = "in_progress";
		}
		String description = _extract_step_description(step, i);
		String step_type = String(step.get("type", step.get("name", ""))).strip_edges();

		PanelContainer *step_card = memnew(PanelContainer);
		step_card->set_h_size_flags(SIZE_EXPAND_FILL);
		Ref<StyleBoxFlat> card_style;
		card_style.instantiate();
		card_style->set_bg_color(Color(0.13, 0.15, 0.19, 0.6));
		card_style->set_corner_radius_all(6);
		card_style->set_border_width_all(1);
		card_style->set_border_color(Color(0.24, 0.28, 0.35, 0.8));
		card_style->set_content_margin_all(8);
		step_card->add_theme_style_override("panel", card_style);

		HBoxContainer *step_row = memnew(HBoxContainer);
		step_row->set_h_size_flags(SIZE_EXPAND_FILL);
		step_row->add_theme_constant_override("separation", 8);
		step_card->add_child(step_row);

		Label *status_icon = memnew(Label);
		if (status == "completed") {
			status_icon->set_text("[x]");
			status_icon->add_theme_color_override("font_color", Color(0.4, 0.9, 0.4));
		} else if (status == "in_progress") {
			status_icon->set_text("[~]");
			status_icon->add_theme_color_override("font_color", Color(0.95, 0.75, 0.35));
		} else if (status == "failed" || status == "error") {
			status_icon->set_text("[!]");
			status_icon->add_theme_color_override("font_color", Color(0.9, 0.45, 0.45));
		} else {
			status_icon->set_text("[ ]");
			status_icon->add_theme_color_override("font_color", Color(0.58, 0.62, 0.72));
		}
		status_icon->add_theme_font_size_override("font_size", _theme_font_with_delta(this, 1, _scaled_ui_size(14)));
		step_row->add_child(status_icon);

		VBoxContainer *text_col = memnew(VBoxContainer);
		text_col->set_h_size_flags(SIZE_EXPAND_FILL);
		text_col->add_theme_constant_override("separation", 2);
		step_row->add_child(text_col);

		Label *desc = memnew(Label);
		desc->set_text(description);
		desc->set_h_size_flags(SIZE_EXPAND_FILL);
		desc->set_autowrap_mode(TextServer::AUTOWRAP_WORD_SMART);
		desc->add_theme_color_override("font_color", Color(0.85, 0.88, 0.93));
		desc->add_theme_font_size_override("font_size", _theme_font_with_delta(this, -1, _scaled_ui_size(12)));
		text_col->add_child(desc);

		if (!step_type.is_empty()) {
			Label *meta = memnew(Label);
			meta->set_text("Type: " + _humanize_step_text(step_type) + " | Status: " + status);
			meta->set_autowrap_mode(TextServer::AUTOWRAP_WORD_SMART);
			meta->add_theme_color_override("font_color", Color(0.58, 0.64, 0.74));
			meta->add_theme_font_size_override("font_size", _theme_font_with_delta(this, -3, _scaled_ui_size(10)));
			text_col->add_child(meta);
		}

		blueprint_content->add_child(step_card);
	}
}

void AIPanel::_add_diff_entry(const String &p_path, const String &p_status) {
	if (!diff_content) return;

	const String normalized_path = _normalize_project_path(p_path);
	
	HBoxContainer *entry = memnew(HBoxContainer);
	
	Label *status_icon = memnew(Label);
	if (p_status == "created") {
		status_icon->set_text("[+]");
		status_icon->add_theme_color_override("font_color", Color(0.4, 0.9, 0.4));
	} else if (p_status == "edited") {
		status_icon->set_text("[M]");
		status_icon->add_theme_color_override("font_color", Color(0.9, 0.7, 0.3));
	} else if (p_status == "deleted") {
		status_icon->set_text("[-]");
		status_icon->add_theme_color_override("font_color", Color(0.9, 0.4, 0.4));
	} else {
		status_icon->set_text("[?]");
		status_icon->add_theme_color_override("font_color", Color(0.6, 0.6, 0.6));
	}
	entry->add_child(status_icon);
	
	// Clickable button instead of static label
	Button *file_btn = memnew(Button);
	file_btn->set_text(" " + normalized_path.get_file());
	file_btn->set_flat(true);
	file_btn->set_text_alignment(HORIZONTAL_ALIGNMENT_LEFT);
	file_btn->set_h_size_flags(SIZE_EXPAND_FILL);
	file_btn->add_theme_color_override("font_color", Color(0.7, 0.85, 1.0));
	file_btn->add_theme_color_override("font_hover_color", Color(0.9, 0.95, 1.0));
	file_btn->add_theme_color_override("font_pressed_color", Color(1.0, 1.0, 1.0));
	file_btn->set_tooltip_text("Click to open: " + normalized_path);
	file_btn->set_meta("file_path", normalized_path);
	file_btn->connect("pressed", callable_mp(this, &AIPanel::_on_diff_file_clicked).bind(normalized_path));
	entry->add_child(file_btn);
	
	diff_content->add_child(entry);
}

void AIPanel::_clear_diff_entries() {
	if (!diff_content) return;
	while (diff_content->get_child_count() > 0) {
		Node *child = diff_content->get_child(0);
		diff_content->remove_child(child);
		memdelete(child);
	}
}

void AIPanel::_on_diff_file_clicked(const String &p_path) {
	EditorInterface *editor = EditorInterface::get_singleton();
	if (!editor) return;

	String resolved_path = _normalize_project_path(p_path);
	String ext = resolved_path.get_extension().to_lower();
	
	if (ext == "gd" || ext == "gdscript") {
		// Open script in script editor
		Ref<Script> script = ResourceLoader::load(resolved_path);
		if (script.is_valid()) {
			editor->edit_script(script);
			editor->set_main_screen_editor("Script");
		}
	} else if (ext == "tscn" || ext == "scn") {
		// Open scene
		editor->open_scene_from_path(resolved_path);
	} else if (ext == "png" || ext == "jpg" || ext == "webp" || ext == "svg") {
		// Select image in FileSystem dock
		editor->select_file(resolved_path);
	} else {
		// Try to open as generic resource
		Ref<Resource> res = ResourceLoader::load(resolved_path);
		if (res.is_valid()) {
			editor->edit_resource(res);
		} else {
			// Fall back to selecting in FileSystem dock
			editor->select_file(resolved_path);
		}
	}
}

void AIPanel::_add_rich_diff_entry(const String &p_path, const String &p_tool, const String &p_before, const String &p_after) {
	if (!diff_content) return;

	const String normalized_path = _normalize_project_path(p_path);
	
	// Create collapsible diff entry
	VBoxContainer *entry = memnew(VBoxContainer);
	entry->set_h_size_flags(SIZE_EXPAND_FILL);
	
	// Header row with file info and open button
	HBoxContainer *header_row = memnew(HBoxContainer);
	header_row->set_h_size_flags(SIZE_EXPAND_FILL);
	
	Button *header = memnew(Button);
	int added_lines = 0;
	int removed_lines = 0;
	String line_preview = _build_line_change_preview(p_before, p_after, 120, added_lines, removed_lines);

	header->set_text("[M] " + normalized_path.get_file() + " (+" + itos(added_lines) + " -" + itos(removed_lines) + ")");
	header->set_flat(true);
	header->set_text_alignment(HORIZONTAL_ALIGNMENT_LEFT);
	header->set_h_size_flags(SIZE_EXPAND_FILL);
	header->add_theme_color_override("font_color", Color(0.9, 0.7, 0.3));
	header->add_theme_font_size_override("font_size", _theme_font_with_delta(this, -1, _scaled_ui_size(12), "Button"));
	header->set_tooltip_text("Click to expand changed lines");
	header_row->add_child(header);
	
	// Open file button
	Button *open_btn = memnew(Button);
	open_btn->set_text(String::utf8("↗"));
	open_btn->set_flat(true);
	open_btn->add_theme_font_size_override("font_size", _theme_font_with_delta(this, 1, _scaled_ui_size(14), "Button"));
	open_btn->add_theme_color_override("font_color", Color(0.5, 0.8, 1.0));
	open_btn->add_theme_color_override("font_hover_color", Color(0.8, 0.95, 1.0));
	open_btn->set_tooltip_text("Open file: " + normalized_path);
	open_btn->connect("pressed", callable_mp(this, &AIPanel::_on_diff_file_clicked).bind(normalized_path));
	header_row->add_child(open_btn);
	
	entry->add_child(header_row);
	
	// Collapsible content container
	VBoxContainer *content = memnew(VBoxContainer);
	content->set_visible(false);  // Collapsed by default
	
	Label *path_label = memnew(Label);
	path_label->set_text(normalized_path + " via " + p_tool);
	path_label->add_theme_font_size_override("font_size", _theme_font_with_delta(this, -3, _scaled_ui_size(10)));
	path_label->add_theme_color_override("font_color", Color(0.6, 0.65, 0.75));
	content->add_child(path_label);

	Label *changes_label = memnew(Label);
	changes_label->set_text("Changed lines:");
	changes_label->add_theme_color_override("font_color", Color(0.8, 0.85, 0.95));
	changes_label->add_theme_font_size_override("font_size", _theme_font_with_delta(this, -2, _scaled_ui_size(11)));
	content->add_child(changes_label);

	RichTextLabel *changes_text = memnew(RichTextLabel);
	changes_text->set_use_bbcode(false);
	changes_text->set_fit_content(true);
	changes_text->set_scroll_active(false);
	changes_text->set_selection_enabled(true);
	changes_text->set_custom_minimum_size(Size2(0, _scaled_ui_size(80)));
	changes_text->add_text(line_preview);
	changes_text->add_theme_color_override("default_color", Color(0.78, 0.8, 0.86));
	changes_text->add_theme_font_size_override("normal_font_size", _theme_font_with_delta(this, -3, _scaled_ui_size(10), "RichTextLabel"));
	content->add_child(changes_text);
	
	entry->add_child(content);
	
	// Connect header to show content (starts collapsed, click shows it)
	// Using set_visible(true) directly since toggle requires lambda
	header->connect("pressed", Callable(content, "set_visible").bind(true));
	
	diff_content->add_child(entry);
	
	// Auto-switch to Diff tab when new diff arrives
	if (tab_bar && current_tab != 2) {
		tab_bar->set_current_tab(2);
		_on_tab_changed(2);
	}
}

// ============ Agents Tab Methods ============

void AIPanel::_update_agents_tab() {
	if (!agents_content) return;

	// Clear dynamic content (keep top padding at index 0)
	while (agents_content->get_child_count() > 1) {
		Node *child = agents_content->get_child(1);
		agents_content->remove_child(child);
		memdelete(child);
	}

	if (agent_statuses.is_empty()) {
		// ── Empty state: show the 5 default agents as dimmed cards ──
		struct DefaultAgent {
			const char *name;
			const char *role;
			Color accent;
		};
		DefaultAgent defaults[] = {
			{ "Orchestrator", "Plans & coordinates all agents", Color(0.55, 0.36, 0.85) },
			{ "Architecture", "Scene structure & project setup", Color(0.20, 0.60, 0.86) },
			{ "Character", "SpriteMancer sprites & animations", Color(0.18, 0.80, 0.44) },
			{ "Level", "Tilesets, terrain & level design", Color(0.90, 0.49, 0.13) },
			{ "QA", "Validation & quality checks", Color(0.91, 0.30, 0.24) }
		};

		for (int i = 0; i < 5; i++) {
			_add_agent_status_row(defaults[i].name, defaults[i].role, "idle", 0.0);
		}
	} else {
		for (int i = 0; i < agent_statuses.size(); i++) {
			_add_agent_status_row(
				agent_statuses[i].name,
				agent_statuses[i].role,
				agent_statuses[i].state,
				agent_statuses[i].progress
			);
		}
	}
}

void AIPanel::_add_agent_status_row(const String &p_name, const String &p_role, const String &p_state, float p_progress) {
	if (!agents_content) return;

	// ── Determine accent color per agent ──
	// Muted silver/gray accent palette matching SpriteMancer brand
	Color accent = Color(0.55, 0.55, 0.62); // default silver
	String name_lower = p_name.to_lower();
	if (name_lower.contains("orchestr")) {
		accent = Color(0.65, 0.60, 0.75); // soft lavender
	} else if (name_lower.contains("architect")) {
		accent = Color(0.50, 0.65, 0.78); // steel blue
	} else if (name_lower.contains("character")) {
		accent = Color(0.55, 0.75, 0.62); // sage green
	} else if (name_lower.contains("level")) {
		accent = Color(0.78, 0.65, 0.50); // warm sand
	} else if (name_lower.contains("qa")) {
		accent = Color(0.75, 0.52, 0.55); // dusty rose
	}

	// ── Determine status styling ──
	Color status_color;
	String status_text;
	String status_icon;
	if (p_state == "idle") {
		status_color = Color(0.45, 0.47, 0.55);
		status_text = "Standby";
		status_icon = "  ";
	} else if (p_state == "working") {
		status_color = Color(0.30, 0.70, 1.0);
		status_text = "Active";
		status_icon = "  ";
	} else if (p_state == "complete") {
		status_color = Color(0.30, 0.85, 0.40);
		status_text = "Done";
		status_icon = "  ";
	} else if (p_state == "error") {
		status_color = Color(0.95, 0.35, 0.35);
		status_text = "Error";
		status_icon = "  ";
	} else {
		status_color = Color(0.50, 0.50, 0.55);
		status_text = p_state;
		status_icon = "  ";
	}

	// Dim card for idle agents
	float card_alpha = (p_state == "idle") ? 0.5 : 1.0;

	// ── Outer card: PanelContainer with left accent border ──
	PanelContainer *card = memnew(PanelContainer);
	card->set_h_size_flags(SIZE_EXPAND_FILL);

	Ref<StyleBoxFlat> card_style;
	card_style.instantiate();
	card_style->set_bg_color(Color(0.11, 0.11, 0.13, card_alpha));
	card_style->set_corner_radius_all(_scaled_ui_size(6));
	card_style->set_border_width(SIDE_LEFT, _scaled_ui_size(3));
	card_style->set_border_color(Color(accent.r, accent.g, accent.b, card_alpha));
	card_style->set_content_margin(SIDE_LEFT, _scaled_ui_size(12));
	card_style->set_content_margin(SIDE_RIGHT, _scaled_ui_size(10));
	card_style->set_content_margin(SIDE_TOP, _scaled_ui_size(8));
	card_style->set_content_margin(SIDE_BOTTOM, _scaled_ui_size(8));
	// Subtle bottom shadow
	card_style->set_shadow_color(Color(0, 0, 0, 0.15));
	card_style->set_shadow_size(_scaled_ui_size(2));
	card_style->set_shadow_offset(Vector2(0, 1));
	card->add_theme_style_override("panel", card_style);

	// ── Card layout ──
	VBoxContainer *card_vbox = memnew(VBoxContainer);
	card_vbox->add_theme_constant_override("separation", _scaled_ui_size(3));
	card->add_child(card_vbox);

	// Row 1: Name + Status badge
	HBoxContainer *top_row = memnew(HBoxContainer);
	top_row->set_h_size_flags(SIZE_EXPAND_FILL);
	card_vbox->add_child(top_row);

	Label *name_label = memnew(Label);
	name_label->set_text(p_name);
	name_label->add_theme_color_override("font_color", Color(0.82, 0.82, 0.86, card_alpha));
	name_label->add_theme_font_size_override("font_size", _theme_font_with_delta(this, 0, _scaled_ui_size(13)));
	top_row->add_child(name_label);

	Control *row_spacer = memnew(Control);
	row_spacer->set_h_size_flags(SIZE_EXPAND_FILL);
	top_row->add_child(row_spacer);

	// Status badge (colored pill)
	PanelContainer *badge = memnew(PanelContainer);
	Ref<StyleBoxFlat> badge_style;
	badge_style.instantiate();
	badge_style->set_bg_color(Color(status_color.r, status_color.g, status_color.b, 0.18));
	badge_style->set_corner_radius_all(_scaled_ui_size(8));
	badge_style->set_content_margin(SIDE_LEFT, _scaled_ui_size(8));
	badge_style->set_content_margin(SIDE_RIGHT, _scaled_ui_size(8));
	badge_style->set_content_margin(SIDE_TOP, _scaled_ui_size(1));
	badge_style->set_content_margin(SIDE_BOTTOM, _scaled_ui_size(1));
	badge->add_theme_style_override("panel", badge_style);

	Label *badge_label = memnew(Label);
	badge_label->set_text(status_text);
	badge_label->add_theme_color_override("font_color", Color(status_color.r, status_color.g, status_color.b, card_alpha));
	badge_label->add_theme_font_size_override("font_size", _theme_font_with_delta(this, -3, _scaled_ui_size(10)));
	badge->add_child(badge_label);
	top_row->add_child(badge);

	// Row 2: Role description
	Label *role_label = memnew(Label);
	role_label->set_text(p_role);
	role_label->add_theme_color_override("font_color", Color(0.44, 0.44, 0.50, card_alpha));
	role_label->add_theme_font_size_override("font_size", _theme_font_with_delta(this, -2, _scaled_ui_size(11)));
	role_label->set_autowrap_mode(TextServer::AUTOWRAP_WORD_SMART);
	card_vbox->add_child(role_label);

	// Row 3: Progress bar (only when actively working)
	if (p_state == "working") {
		int pct = (int)(p_progress * 100);
		if (pct < 5) pct = 5; // always show a sliver

		// Manual progress bar using PanelContainer for full color control
		PanelContainer *bar_bg = memnew(PanelContainer);
		bar_bg->set_custom_minimum_size(Size2(0, _scaled_ui_size(4)));
		bar_bg->set_h_size_flags(SIZE_EXPAND_FILL);
		Ref<StyleBoxFlat> bar_bg_style;
		bar_bg_style.instantiate();
		bar_bg_style->set_bg_color(Color(0.16, 0.16, 0.19));
		bar_bg_style->set_corner_radius_all(_scaled_ui_size(2));
		bar_bg_style->set_content_margin_all(0);
		bar_bg->add_theme_style_override("panel", bar_bg_style);
		card_vbox->add_child(bar_bg);

		// Fill
		Control *fill = memnew(Control);
		fill->set_custom_minimum_size(Size2(0, _scaled_ui_size(4)));
		fill->set_h_size_flags(SIZE_FILL);
		fill->set_stretch_ratio((float)pct / 100.0f);

		Ref<StyleBoxFlat> fill_style;
		fill_style.instantiate();
		fill_style->set_bg_color(accent);
		fill_style->set_corner_radius_all(_scaled_ui_size(2));
		fill->add_theme_style_override("panel", fill_style);

		// We use an HBoxContainer inside bar_bg to get the fill percentage
		HBoxContainer *bar_hbox = memnew(HBoxContainer);
		bar_hbox->add_theme_constant_override("separation", 0);
		bar_bg->add_child(bar_hbox);

		PanelContainer *fill_panel = memnew(PanelContainer);
		fill_panel->set_h_size_flags(SIZE_EXPAND_FILL);
		fill_panel->set_stretch_ratio((float)pct);
		Ref<StyleBoxFlat> fp_style;
		fp_style.instantiate();
		fp_style->set_bg_color(accent);
		fp_style->set_corner_radius_all(_scaled_ui_size(2));
		fp_style->set_content_margin_all(0);
		fill_panel->add_theme_style_override("panel", fp_style);
		fill_panel->set_custom_minimum_size(Size2(0, _scaled_ui_size(4)));
		bar_hbox->add_child(fill_panel);

		Control *empty_part = memnew(Control);
		empty_part->set_h_size_flags(SIZE_EXPAND_FILL);
		empty_part->set_stretch_ratio((float)(100 - pct));
		bar_hbox->add_child(empty_part);
	}

	agents_content->add_child(card);
}

void AIPanel::_clear_agent_statuses() {
	agent_statuses.clear();
	_update_agents_tab();
}

void AIPanel::set_multi_agent_enabled(bool p_enabled) {
	multi_agent_enabled = p_enabled;
	_update_agents_tab();
	
	// NOTE: Removed auto-switch to agents tab - it was causing unwanted tab jumps
	// when backend sends multi_agent_enabled status updates during message processing.
	// Users can manually switch to Agents tab if they want to see the status.
}

void AIPanel::update_agent_status(const String &p_name, const String &p_role, const String &p_state, float p_progress) {
	// Update or add agent status
	bool found = false;
	for (int i = 0; i < agent_statuses.size(); i++) {
		if (agent_statuses[i].name == p_name) {
			agent_statuses.write[i].role = p_role;
			agent_statuses.write[i].state = p_state;
			agent_statuses.write[i].progress = p_progress;
			found = true;
			break;
		}
	}
	
	if (!found) {
		AgentStatus status;
		status.name = p_name;
		status.role = p_role;
		status.state = p_state;
		status.progress = p_progress;
		agent_statuses.push_back(status);
	}
	
	// Refresh tab if visible
	if (current_tab == 3) {
		_update_agents_tab();
	}
}

void AIPanel::clear_all_agent_statuses() {
	_clear_agent_statuses();
}

void AIPanel::_on_multi_agent_toggle() {
	// Toggle multi-agent mode
	multi_agent_enabled = !multi_agent_enabled;

	// Update button appearance with styled pills
	if (multi_agent_toggle_btn) {
		if (multi_agent_enabled) {
			multi_agent_toggle_btn->set_text("Active");

			Ref<StyleBoxFlat> active_style;
			active_style.instantiate();
			active_style->set_bg_color(Color(0.30, 0.30, 0.36, 0.9));
			active_style->set_corner_radius_all(_scaled_ui_size(12));
			active_style->set_content_margin(SIDE_LEFT, _scaled_ui_size(14));
			active_style->set_content_margin(SIDE_RIGHT, _scaled_ui_size(14));
			active_style->set_content_margin(SIDE_TOP, _scaled_ui_size(4));
			active_style->set_content_margin(SIDE_BOTTOM, _scaled_ui_size(4));
			multi_agent_toggle_btn->add_theme_style_override("normal", active_style);

			Ref<StyleBoxFlat> active_hover;
			active_hover.instantiate();
			active_hover->set_bg_color(Color(0.38, 0.38, 0.44, 1.0));
			active_hover->set_corner_radius_all(_scaled_ui_size(12));
			active_hover->set_content_margin(SIDE_LEFT, _scaled_ui_size(14));
			active_hover->set_content_margin(SIDE_RIGHT, _scaled_ui_size(14));
			active_hover->set_content_margin(SIDE_TOP, _scaled_ui_size(4));
			active_hover->set_content_margin(SIDE_BOTTOM, _scaled_ui_size(4));
			multi_agent_toggle_btn->add_theme_style_override("hover", active_hover);
			multi_agent_toggle_btn->add_theme_style_override("pressed", active_hover);
		} else {
			multi_agent_toggle_btn->set_text("Enable");

			Ref<StyleBoxFlat> enable_style;
			enable_style.instantiate();
			enable_style->set_bg_color(Color(0.24, 0.24, 0.28, 0.9));
			enable_style->set_corner_radius_all(_scaled_ui_size(12));
			enable_style->set_content_margin(SIDE_LEFT, _scaled_ui_size(14));
			enable_style->set_content_margin(SIDE_RIGHT, _scaled_ui_size(14));
			enable_style->set_content_margin(SIDE_TOP, _scaled_ui_size(4));
			enable_style->set_content_margin(SIDE_BOTTOM, _scaled_ui_size(4));
			multi_agent_toggle_btn->add_theme_style_override("normal", enable_style);

			Ref<StyleBoxFlat> enable_hover;
			enable_hover.instantiate();
			enable_hover->set_bg_color(Color(0.32, 0.32, 0.38, 1.0));
			enable_hover->set_corner_radius_all(_scaled_ui_size(12));
			enable_hover->set_content_margin(SIDE_LEFT, _scaled_ui_size(14));
			enable_hover->set_content_margin(SIDE_RIGHT, _scaled_ui_size(14));
			enable_hover->set_content_margin(SIDE_TOP, _scaled_ui_size(4));
			enable_hover->set_content_margin(SIDE_BOTTOM, _scaled_ui_size(4));
			multi_agent_toggle_btn->add_theme_style_override("hover", enable_hover);
			multi_agent_toggle_btn->add_theme_style_override("pressed", enable_hover);
		}
		multi_agent_toggle_btn->add_theme_color_override("font_color", Color(1.0, 1.0, 1.0));
	}

	// Send WebSocket message to toggle multi-agent mode in AI Router
	if (ws_peer.is_valid() && ws_peer->get_ready_state() == WebSocketPeer::STATE_OPEN) {
		Dictionary msg;
		msg["type"] = "toggle_agentic";
		msg["enable"] = multi_agent_enabled;
		String json = JSON::stringify(msg);
		ws_peer->send_text(json);
		print_line("[AIPanel] Sent multi-agent toggle: " + String(multi_agent_enabled ? "enabled" : "disabled"));
	}

	// Update the agents tab display
	_update_agents_tab();
}

void AIPanel::_on_new_session() {
	// Save current session first
	_save_current_session();
	
	session_counter++;
	current_session_id = session_counter;
	if (session_name) {
		session_name->set_text("Session " + itos(session_counter));
	}
	_clear_chat();
	_clear_diff_entries();
	_add_message_bubble("AI", "New session started. How can I help you?", false);
}

void AIPanel::_clear_chat() {
	if (!messages_container) return;
	
	// Remove all children except thinking bubble
	Vector<Node*> to_remove;
	for (int i = 0; i < messages_container->get_child_count(); i++) {
		Node *child = messages_container->get_child(i);
		if (child != thinking_bubble) {
			to_remove.push_back(child);
		}
	}
	for (Node *n : to_remove) {
		messages_container->remove_child(n);
		memdelete(n);
	}
	current_messages.clear();
}

void AIPanel::_on_history_pressed() {
	if (!history_popup) return;
	
	history_popup->clear();
	
	if (saved_sessions.is_empty()) {
		history_popup->add_item("No saved sessions", -1);
		history_popup->set_item_disabled(0, true);
	} else {
		for (int i = 0; i < saved_sessions.size(); i++) {
			history_popup->add_item(saved_sessions[i].name, saved_sessions[i].id);
		}
	}
	
	history_popup->set_position(history_btn->get_screen_position() + Vector2(0, history_btn->get_size().y));
	history_popup->popup();
}

void AIPanel::_on_history_selected(int p_id) {
	if (p_id < 0) return;
	_save_current_session();
	_load_session(p_id);
}

void AIPanel::_save_current_session() {
	if (!messages_container || !session_name) return;
	
	// Don't save empty sessions
	if (current_messages.is_empty()) return;
	
	// Check if session already exists
	int existing_idx = -1;
	for (int i = 0; i < saved_sessions.size(); i++) {
		if (saved_sessions[i].id == current_session_id) {
			existing_idx = i;
			break;
		}
	}
	
	ChatSession session;
	session.id = current_session_id;
	session.name = session_name->get_text();
	session.messages = current_messages;
	
	if (existing_idx >= 0) {
		saved_sessions.write[existing_idx] = session;
	} else {
		saved_sessions.push_back(session);
	}
	
	_save_sessions_to_disk();
}

void AIPanel::_load_session(int p_id) {
	for (int i = 0; i < saved_sessions.size(); i++) {
		if (saved_sessions[i].id == p_id) {
			current_session_id = p_id;
			if (session_name) {
				session_name->set_text(saved_sessions[i].name);
			}
			_clear_chat();
			
			// Replay all saved messages
			for (int j = 0; j < saved_sessions[i].messages.size(); j++) {
				Dictionary m = saved_sessions[i].messages[j];
				String sender = m.get("sender", "AI");
				String text = m.get("text", "");
				bool is_user = m.get("is_user", false);
				_add_message_bubble(sender, text, is_user);
			}
			
			if (saved_sessions[i].messages.is_empty()) {
				_add_message_bubble("AI", "Session '" + saved_sessions[i].name + "' restored (empty).", false);
			}
			return;
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Disk Persistence - Save/Load sessions as JSON to user://
// ═══════════════════════════════════════════════════════════════════════════

String AIPanel::_get_sessions_path() const {
	return "user://ai_chat_sessions.json";
}

void AIPanel::_save_sessions_to_disk() {
	Array sessions_arr;
	for (int i = 0; i < saved_sessions.size(); i++) {
		Dictionary s;
		s["id"] = saved_sessions[i].id;
		s["name"] = saved_sessions[i].name;
		
		Array msgs;
		for (int j = 0; j < saved_sessions[i].messages.size(); j++) {
			msgs.push_back(saved_sessions[i].messages[j]);
		}
		s["messages"] = msgs;
		sessions_arr.push_back(s);
	}
	
	Dictionary root;
	root["session_counter"] = session_counter;
	root["sessions"] = sessions_arr;
	
	String json_str = JSON::stringify(root, "\t");
	
	Ref<FileAccess> f = FileAccess::open(_get_sessions_path(), FileAccess::WRITE);
	if (f.is_valid()) {
		f->store_string(json_str);
		print_line("[AIPanel] Saved " + itos(saved_sessions.size()) + " chat sessions to disk.");
	} else {
		print_line("[AIPanel] Failed to save chat sessions.");
	}
}

void AIPanel::_load_sessions_from_disk() {
	String path = _get_sessions_path();
	if (!FileAccess::exists(path)) return;
	
	Ref<FileAccess> f = FileAccess::open(path, FileAccess::READ);
	if (!f.is_valid()) return;
	
	String json_str = f->get_as_text();
	JSON json;
	if (json.parse(json_str) != OK) {
		print_line("[AIPanel] Failed to parse chat sessions JSON.");
		return;
	}
	
	Variant data = json.get_data();
	if (data.get_type() != Variant::DICTIONARY) return;
	
	Dictionary root = data;
	session_counter = root.get("session_counter", 1);
	
	Array sessions_arr = root.get("sessions", Array());
	saved_sessions.clear();
	
	for (int i = 0; i < sessions_arr.size(); i++) {
		if (sessions_arr[i].get_type() != Variant::DICTIONARY) continue;
		Dictionary s = sessions_arr[i];
		
		ChatSession session;
		session.id = s.get("id", 0);
		session.name = s.get("name", "Unnamed");
		
		Array msgs = s.get("messages", Array());
		for (int j = 0; j < msgs.size(); j++) {
			if (msgs[j].get_type() == Variant::DICTIONARY) {
				session.messages.push_back(msgs[j]);
			}
		}
		
		saved_sessions.push_back(session);
	}
	
	print_line("[AIPanel] Loaded " + itos(saved_sessions.size()) + " chat sessions from disk.");
}

AIPanel::AIPanel() {
	set_name("AIPanel");
	set_v_size_flags(SIZE_EXPAND_FILL);

#ifdef TOOLS_ENABLED
	// Ensure this dock uses the same editor theme/scale as the rest of Godot UI.
	EditorNode *editor_node = EditorNode::get_singleton();
	if (editor_node && editor_node->get_gui_base() && editor_node->get_gui_base()->get_theme().is_valid()) {
		set_theme(editor_node->get_gui_base()->get_theme());
	}
#endif
	
	// HTTPRequest node (fallback)
	http_request = memnew(HTTPRequest);
	http_request->set_timeout(30.0);
	http_request->connect("request_completed", callable_mp(this, &AIPanel::_on_http_request_completed));
	add_child(http_request);
	
	// WebSocket peer will be created in _connect_websocket()
	
	// Timer for WebSocket polling
	ws_poll_timer = memnew(Timer);
	ws_poll_timer->set_wait_time(0.05); // 50ms polling interval
	ws_poll_timer->set_autostart(true);
	ws_poll_timer->connect("timeout", callable_mp(this, &AIPanel::_poll_websocket));
	add_child(ws_poll_timer);
	
	// 🌌 UI Animation Timer - 30fps for smooth aurora effects
	ui_anim_timer = memnew(Timer);
	ui_anim_timer->set_wait_time(0.033);  // ~30fps
	ui_anim_timer->set_autostart(true);
	ui_anim_timer->connect("timeout", callable_mp(this, &AIPanel::_on_ui_anim_tick));
	add_child(ui_anim_timer);
	
	// 🚀 Spawn bundled AI Router binary automatically
	{
		String godot_path = OS::get_singleton()->get_executable_path();
		String bin_dir = godot_path.get_base_dir();
		String ai_router_path = bin_dir.path_join("ai-router");
		
		if (FileAccess::exists(ai_router_path)) {
			List<String> args;
			Error err = OS::get_singleton()->create_process(ai_router_path, args, &ai_router_pid);
			if (err == OK && ai_router_pid > 0) {
				print_line("AIPanel: Started AI Router (PID: " + itos(ai_router_pid) + ")");
				// Give the process a moment to start up
				OS::get_singleton()->delay_usec(500000); // 500ms
			} else {
				print_line("AIPanel: Failed to start AI Router");
			}
		} else {
			print_line("AIPanel: AI Router binary not found at: " + ai_router_path);
			print_line("AIPanel: Running without bundled AI Router (use external)");
		}
	}
	
	// Connect to WebSocket server
	_connect_websocket();
	
	// Load saved chat sessions from disk
	_load_sessions_from_disk();
	
	// === HEADER ===
	HBoxContainer *header = memnew(HBoxContainer);
	add_child(header);
	
	history_btn = memnew(Button);
	history_btn->set_text("H");
	history_btn->set_tooltip_text("Chat History");
	history_btn->connect("pressed", callable_mp(this, &AIPanel::_on_history_pressed));
	header->add_child(history_btn);
	
	history_popup = memnew(PopupMenu);
	history_popup->connect("id_pressed", callable_mp(this, &AIPanel::_on_history_selected));
	add_child(history_popup);
	
	// 🌌 Connection status indicator (breathing)
	connection_indicator = memnew(Label);
	connection_indicator->set_text("*");
	connection_indicator->add_theme_font_size_override("font_size", _theme_font_with_delta(this, -2, _scaled_ui_size(12)));
	connection_indicator->add_theme_color_override("font_color", COLOR_SUCCESS);
	connection_indicator->set_tooltip_text("WebSocket Status");
	header->add_child(connection_indicator);
	
	// Agentic Godot Icon - Embedded pixelated "A" with cyan glow
	TextureRect *icon_rect = memnew(TextureRect);
	icon_rect->set_custom_minimum_size(Size2(_scaled_ui_size(22), _scaled_ui_size(22)));
	icon_rect->set_stretch_mode(TextureRect::STRETCH_KEEP_ASPECT_CENTERED);
	
	// Create 16x16 pixelated "A" icon directly in code
	const int ICON_SIZE = 16;
	Ref<Image> icon_img;
	icon_img.instantiate();
	icon_img->initialize_data(ICON_SIZE, ICON_SIZE, false, Image::FORMAT_RGBA8);
	icon_img->fill(Color(0.1, 0.1, 0.1, 1.0)); // Dark background
	
	// Pixel pattern for "A" shape (1 = white pixel, 2 = cyan glow pixel)
	// Coordinates based on the SVG design, scaled to 16x16
	Color white = Color(0.83, 0.83, 0.83, 1.0);  // #d4d4d4
	Color cyan = COLOR_AI_CYAN;
	
	// Row 0-1: Top of A
	icon_img->set_pixel(6, 2, white); icon_img->set_pixel(7, 2, white); icon_img->set_pixel(8, 2, white);
	// Row 2: Wider
	icon_img->set_pixel(5, 3, white); icon_img->set_pixel(6, 3, white); icon_img->set_pixel(8, 3, white); icon_img->set_pixel(9, 3, white);
	// Row 3: Even wider
	icon_img->set_pixel(4, 4, white); icon_img->set_pixel(5, 4, white); icon_img->set_pixel(9, 4, white); icon_img->set_pixel(10, 4, white);
	// Row 4: Crossbar
	icon_img->set_pixel(4, 5, white); icon_img->set_pixel(5, 5, white); icon_img->set_pixel(6, 5, white);
	icon_img->set_pixel(7, 5, white); icon_img->set_pixel(8, 5, white); icon_img->set_pixel(9, 5, white); icon_img->set_pixel(10, 5, white);
	// Row 5-6: Legs
	icon_img->set_pixel(4, 6, white); icon_img->set_pixel(10, 6, white);
	icon_img->set_pixel(4, 7, white); icon_img->set_pixel(10, 7, white);
	// Row 7: Bottom with cyan glow
	icon_img->set_pixel(4, 8, white);
	icon_img->set_pixel(10, 8, cyan); // Cyan accent pixel
	// Glow around cyan pixel
	icon_img->set_pixel(9, 7, Color(cyan.r, cyan.g, cyan.b, 0.3));
	icon_img->set_pixel(11, 7, Color(cyan.r, cyan.g, cyan.b, 0.3));
	icon_img->set_pixel(9, 9, Color(cyan.r, cyan.g, cyan.b, 0.3));
	icon_img->set_pixel(11, 9, Color(cyan.r, cyan.g, cyan.b, 0.3));
	icon_img->set_pixel(10, 9, Color(cyan.r, cyan.g, cyan.b, 0.2));
	
	Ref<ImageTexture> icon_tex = ImageTexture::create_from_image(icon_img);
	icon_rect->set_texture(icon_tex);
	header->add_child(icon_rect);
	
	Label *title = memnew(Label);
	title->set_text(" Agentic ");
	title->add_theme_font_size_override("font_size", _theme_font_with_delta(this, 0, _scaled_ui_size(14)));
	title->add_theme_color_override("font_color", COLOR_TEXT_BODY);
	header->add_child(title);
	
	session_name = memnew(LineEdit);
	session_name->set_text("Session 1");
	session_name->set_h_size_flags(SIZE_EXPAND_FILL);
	session_name->set_flat(true);
	session_name->add_theme_font_size_override("font_size", _theme_font_with_delta(this, 0, _scaled_ui_size(14), "LineEdit"));
	header->add_child(session_name);
	
	new_session_btn = memnew(Button);
	new_session_btn->set_text("+");
	new_session_btn->set_tooltip_text("New Session");
	new_session_btn->connect("pressed", callable_mp(this, &AIPanel::_on_new_session));
	header->add_child(new_session_btn);
	
	// === TAB BAR ===
	tab_bar = memnew(TabBar);
	tab_bar->add_tab("Chat");      // Clean labels (no emoji - render issues)
	tab_bar->add_tab("Tasks");
	tab_bar->add_tab("Changes");
	tab_bar->add_tab("Agents");    // Multi-agent status
	tab_bar->set_current_tab(0);
	tab_bar->add_theme_font_size_override("font_size", _theme_font_with_delta(this, 0, _scaled_ui_size(14), "TabBar"));
	tab_bar->connect("tab_changed", callable_mp(this, &AIPanel::_on_tab_changed));
	add_child(tab_bar);
	
	add_child(memnew(HSeparator));
	
	// === SCENE TAB (Chat) ===
	scene_tab = memnew(VBoxContainer);
	scene_tab->set_v_size_flags(SIZE_EXPAND_FILL);
	add_child(scene_tab);
	
	chat_scroll = memnew(ScrollContainer);
	chat_scroll->set_v_size_flags(SIZE_EXPAND_FILL);
	chat_scroll->set_horizontal_scroll_mode(ScrollContainer::SCROLL_MODE_DISABLED);
	scene_tab->add_child(chat_scroll);
	
	messages_container = memnew(VBoxContainer);
	messages_container->set_h_size_flags(SIZE_EXPAND_FILL);
	messages_container->add_theme_constant_override("separation", _scaled_ui_size(6));
	chat_scroll->add_child(messages_container);
	
	// Welcome message (stored so we can remove on first user input)
	_add_message_bubble("AI", "Hello! I can help you create your game.\n\nTry: \"Create a player scene\" or ask me anything!", false);
	if (messages_container->get_child_count() > 0) {
		welcome_bubble = Object::cast_to<PanelContainer>(messages_container->get_child(messages_container->get_child_count() - 1));
	}
	
	// === BLUEPRINT TAB (Tasks) ===
	blueprint_tab = memnew(VBoxContainer);
	blueprint_tab->set_v_size_flags(SIZE_EXPAND_FILL);
	blueprint_tab->set_visible(false);
	add_child(blueprint_tab);
	
	Label *blueprint_title = memnew(Label);
	blueprint_title->set_text("Task Blueprint");
	blueprint_title->add_theme_font_size_override("font_size", _theme_font_with_delta(this, 1, _scaled_ui_size(14)));
	blueprint_tab->add_child(blueprint_title);
	
	ScrollContainer *blueprint_scroll = memnew(ScrollContainer);
	blueprint_scroll->set_v_size_flags(SIZE_EXPAND_FILL);
	blueprint_scroll->set_horizontal_scroll_mode(ScrollContainer::SCROLL_MODE_DISABLED);
	blueprint_tab->add_child(blueprint_scroll);
	
	blueprint_content = memnew(VBoxContainer);
	blueprint_content->set_h_size_flags(SIZE_EXPAND_FILL);
	blueprint_content->add_theme_constant_override("separation", _scaled_ui_size(6));
	blueprint_scroll->add_child(blueprint_content);
	
	Label *blueprint_hint = memnew(Label);
	blueprint_hint->set_text("AI will create a task plan here when working on complex goals.");
	blueprint_hint->set_h_size_flags(SIZE_EXPAND_FILL);
	blueprint_hint->set_autowrap_mode(TextServer::AUTOWRAP_WORD_SMART);
	blueprint_hint->add_theme_color_override("font_color", Color(0.6, 0.6, 0.7));
	blueprint_content->add_child(blueprint_hint);
	
	// === DIFF TAB (File Changes) ===
	diff_tab = memnew(VBoxContainer);
	diff_tab->set_v_size_flags(SIZE_EXPAND_FILL);
	diff_tab->set_visible(false);
	add_child(diff_tab);
	
	Label *diff_title = memnew(Label);
	diff_title->set_text("File Changes");
	diff_title->add_theme_font_size_override("font_size", _theme_font_with_delta(this, 1, _scaled_ui_size(14)));
	diff_tab->add_child(diff_title);
	
	ScrollContainer *diff_scroll = memnew(ScrollContainer);
	diff_scroll->set_v_size_flags(SIZE_EXPAND_FILL);
	diff_scroll->set_horizontal_scroll_mode(ScrollContainer::SCROLL_MODE_DISABLED);
	diff_tab->add_child(diff_scroll);
	
	diff_content = memnew(VBoxContainer);
	diff_content->set_h_size_flags(SIZE_EXPAND_FILL);
	diff_scroll->add_child(diff_content);
	
	Label *diff_hint = memnew(Label);
	diff_hint->set_text("Track file modifications made by the AI here.");
	diff_hint->add_theme_color_override("font_color", Color(0.6, 0.6, 0.7));
	diff_content->add_child(diff_hint);
	
	// === AGENTS TAB (Multi-Agent Status) ===
	agents_tab = memnew(VBoxContainer);
	agents_tab->set_v_size_flags(SIZE_EXPAND_FILL);
	agents_tab->set_visible(false);
	agents_tab->add_theme_constant_override("separation", _scaled_ui_size(0));
	add_child(agents_tab);

	// ── Header card ──
	{
		PanelContainer *header_panel = memnew(PanelContainer);
		header_panel->set_h_size_flags(SIZE_EXPAND_FILL);
		Ref<StyleBoxFlat> header_style;
		header_style.instantiate();
		header_style->set_bg_color(Color(0.10, 0.10, 0.12));
		header_style->set_border_width_all(0);
		header_style->set_border_width(SIDE_BOTTOM, 1);
		header_style->set_border_color(Color(0.25, 0.25, 0.28, 0.6));
		header_style->set_content_margin_all(_scaled_ui_size(10));
		header_panel->add_theme_style_override("panel", header_style);
		agents_tab->add_child(header_panel);

		VBoxContainer *header_vbox = memnew(VBoxContainer);
		header_vbox->add_theme_constant_override("separation", _scaled_ui_size(6));
		header_panel->add_child(header_vbox);

		// Title row
		HBoxContainer *title_row = memnew(HBoxContainer);
		title_row->set_h_size_flags(SIZE_EXPAND_FILL);
		header_vbox->add_child(title_row);

		Label *agents_title = memnew(Label);
		agents_title->set_text("AI Agent Studio");
		agents_title->add_theme_font_size_override("font_size", _theme_font_with_delta(this, 3, _scaled_ui_size(16)));
		agents_title->add_theme_color_override("font_color", Color(0.78, 0.78, 0.82));
		title_row->add_child(agents_title);

		Control *spacer = memnew(Control);
		spacer->set_h_size_flags(SIZE_EXPAND_FILL);
		title_row->add_child(spacer);

		// Styled toggle button
		multi_agent_toggle_btn = memnew(Button);
		multi_agent_toggle_btn->set_text("Enable");
		multi_agent_toggle_btn->set_toggle_mode(true);
		multi_agent_toggle_btn->set_custom_minimum_size(Size2(_scaled_ui_size(80), _scaled_ui_size(28)));
		multi_agent_toggle_btn->set_tooltip_text("Enable/Disable Multi-Agent Mode");
		multi_agent_toggle_btn->connect("pressed", callable_mp(this, &AIPanel::_on_multi_agent_toggle));

		Ref<StyleBoxFlat> btn_style;
		btn_style.instantiate();
		btn_style->set_bg_color(Color(0.24, 0.24, 0.28, 0.9));
		btn_style->set_corner_radius_all(_scaled_ui_size(12));
		btn_style->set_content_margin(SIDE_LEFT, _scaled_ui_size(14));
		btn_style->set_content_margin(SIDE_RIGHT, _scaled_ui_size(14));
		btn_style->set_content_margin(SIDE_TOP, _scaled_ui_size(4));
		btn_style->set_content_margin(SIDE_BOTTOM, _scaled_ui_size(4));
		multi_agent_toggle_btn->add_theme_style_override("normal", btn_style);

		Ref<StyleBoxFlat> btn_hover;
		btn_hover.instantiate();
		btn_hover->set_bg_color(Color(0.32, 0.32, 0.38, 1.0));
		btn_hover->set_corner_radius_all(_scaled_ui_size(12));
		btn_hover->set_content_margin(SIDE_LEFT, _scaled_ui_size(14));
		btn_hover->set_content_margin(SIDE_RIGHT, _scaled_ui_size(14));
		btn_hover->set_content_margin(SIDE_TOP, _scaled_ui_size(4));
		btn_hover->set_content_margin(SIDE_BOTTOM, _scaled_ui_size(4));
		multi_agent_toggle_btn->add_theme_style_override("hover", btn_hover);
		multi_agent_toggle_btn->add_theme_style_override("pressed", btn_hover);

		multi_agent_toggle_btn->add_theme_color_override("font_color", Color(1.0, 1.0, 1.0));
		multi_agent_toggle_btn->add_theme_font_size_override("font_size", _theme_font_with_delta(this, -1, _scaled_ui_size(11)));
		title_row->add_child(multi_agent_toggle_btn);

		// Subtitle
		Label *subtitle = memnew(Label);
		subtitle->set_text("Coordinate specialized agents to build your game");
		subtitle->add_theme_color_override("font_color", Color(0.42, 0.42, 0.48));
		subtitle->add_theme_font_size_override("font_size", _theme_font_with_delta(this, -2, _scaled_ui_size(11)));
		header_vbox->add_child(subtitle);
	}

	// ── Scrollable agent cards area ──
	ScrollContainer *agents_scroll = memnew(ScrollContainer);
	agents_scroll->set_v_size_flags(SIZE_EXPAND_FILL);
	agents_scroll->set_horizontal_scroll_mode(ScrollContainer::SCROLL_MODE_DISABLED);
	agents_tab->add_child(agents_scroll);

	agents_content = memnew(VBoxContainer);
	agents_content->set_h_size_flags(SIZE_EXPAND_FILL);
	agents_content->add_theme_constant_override("separation", _scaled_ui_size(6));

	// Small top padding
	Control *top_pad = memnew(Control);
	top_pad->set_custom_minimum_size(Size2(0, _scaled_ui_size(6)));
	agents_content->add_child(top_pad);

	agents_scroll->add_child(agents_content);

	// Thinking indicator (collapsible) - mesmerizing neural style
	thinking_bubble = memnew(PanelContainer);
	thinking_bubble->set_h_size_flags(SIZE_EXPAND_FILL);
	thinking_bubble->set_visible(false);
	
	Ref<StyleBoxFlat> think_style;
	think_style.instantiate();
	think_style->set_bg_color(Color(0, 0, 0, 0)); // Transparent background
	think_style->set_corner_radius_all(0);
	think_style->set_content_margin_all(_scaled_ui_size(8));
	think_style->set_border_width_all(0); // No border
	thinking_bubble->add_theme_style_override("panel", think_style);
	
	VBoxContainer *think_container = memnew(VBoxContainer);
	thinking_bubble->add_child(think_container);
	
	// Clickable header with italic muted styling (Cline-style)
	thinking_header = memnew(Button);
	thinking_header->set_text("Thinking...");
	thinking_header->set_flat(true);
	thinking_header->set_text_alignment(HORIZONTAL_ALIGNMENT_LEFT);
	thinking_header->add_theme_color_override("font_color", COLOR_TEXT_MUTED);
	thinking_header->add_theme_color_override("font_hover_color", COLOR_TEXT_BODY);
	thinking_header->add_theme_font_size_override("font_size", _theme_font_with_delta(this, -1, _scaled_ui_size(13), "Button"));
	thinking_header->connect("pressed", callable_mp(this, &AIPanel::_on_thinking_toggle));
	think_container->add_child(thinking_header);
	
	// Collapsible content
	thinking_content = memnew(VBoxContainer);
	think_container->add_child(thinking_content);
	
	// Thought text (RichTextLabel for better wrapping)
	thinking_text = memnew(RichTextLabel);
	thinking_text->set_use_bbcode(true);
	thinking_text->set_fit_content(true);
	thinking_text->set_scroll_active(false);
	thinking_text->set_selection_enabled(true);
	thinking_text->set_h_size_flags(SIZE_EXPAND_FILL);
	thinking_text->add_theme_color_override("default_color", COLOR_TEXT_MUTED);
	thinking_content->add_child(thinking_text);
	
	// 🌌 Neural activity bar (Phase 4)
	neural_activity_bar = memnew(Label);
	neural_activity_bar->set_text("--------------------");
	neural_activity_bar->add_theme_font_size_override("font_size", _theme_font_with_delta(this, -3, _scaled_ui_size(10)));
	neural_activity_bar->add_theme_color_override("font_color", COLOR_AI_CYAN);
	neural_activity_bar->set_horizontal_alignment(HORIZONTAL_ALIGNMENT_CENTER);
	thinking_content->add_child(neural_activity_bar);
	
	messages_container->add_child(thinking_bubble);
	
	// === FILES CHANGED SECTION ===
	files_section = memnew(VBoxContainer);
	files_section->set_visible(false);
	add_child(files_section);
	
	Label *files_title = memnew(Label);
	files_title->set_text("📁 Files Changed");
	files_title->add_theme_font_size_override("font_size", _theme_font_with_delta(this, -1, _scaled_ui_size(12)));
	files_title->add_theme_color_override("font_color", Color(0.7, 0.7, 0.7));
	files_section->add_child(files_title);
	
	add_child(memnew(HSeparator));
	
	// === MODEL PICKER (at bottom like Antigravity) ===
	HBoxContainer *model_row = memnew(HBoxContainer);
	add_child(model_row);
	
	Label *model_label = memnew(Label);
	model_label->set_text("Model: ");
	model_label->add_theme_font_size_override("font_size", _theme_font_with_delta(this, -1, _scaled_ui_size(11)));
	model_row->add_child(model_label);
	
	model_picker = memnew(OptionButton);
	model_picker->set_h_size_flags(SIZE_EXPAND_FILL);
	model_picker->add_theme_font_size_override("font_size", _theme_font_with_delta(this, 0, _scaled_ui_size(12), "OptionButton"));
	model_picker->add_item("gemini-3-flash-preview");
	model_picker->add_item("gemini-3-pro-preview");
	model_picker->select(0);
	model_picker->connect("item_selected", callable_mp(this, &AIPanel::_on_model_selected));
	model_row->add_child(model_picker);
	
	// === IMAGE PREVIEW ROW (above input) ===
	image_preview_container = memnew(HBoxContainer);
	image_preview_container->set_visible(false);
	add_child(image_preview_container);
	
	
	// Thumbnails with X buttons are created dynamically in _update_image_thumbnails()
	
	// Image popup window for expanded view
	image_popup = memnew(Window);
	image_popup->set_title("Attached Image");
	image_popup->set_visible(false);
	image_popup->connect("close_requested", callable_mp(this, &AIPanel::_on_popup_close));
	add_child(image_popup);
	
	popup_image = memnew(TextureRect);
	popup_image->set_expand_mode(TextureRect::EXPAND_FIT_WIDTH_PROPORTIONAL);
	popup_image->set_stretch_mode(TextureRect::STRETCH_KEEP_ASPECT_CENTERED);
	popup_image->set_anchors_and_offsets_preset(Control::PRESET_FULL_RECT);
	image_popup->add_child(popup_image);
	
	// === INPUT AREA with cosmic styling ===
	PanelContainer *input_wrapper = memnew(PanelContainer);
	Ref<StyleBoxFlat> input_style;
	input_style.instantiate();
	input_style->set_bg_color(COLOR_INPUT_BG);
	input_style->set_corner_radius_all(_scaled_ui_size(10));
	input_style->set_content_margin_all(_scaled_ui_size(6));
	input_style->set_border_width_all(1);
	input_style->set_border_color(COLOR_INPUT_BORDER);
	input_wrapper->add_theme_style_override("panel", input_style);
	add_child(input_wrapper);
	
	HBoxContainer *input_area = memnew(HBoxContainer);
	input_area->add_theme_constant_override("separation", _scaled_ui_size(8));
	input_wrapper->add_child(input_area);
	
	input_field = memnew(LineEdit);
	input_field->set_h_size_flags(SIZE_EXPAND_FILL);
	input_field->set_placeholder("Ask me anything...");
	input_field->set_flat(true);  // Remove default styling
	input_field->add_theme_font_size_override("font_size", _theme_font_with_delta(this, 0, _scaled_ui_size(14), "LineEdit"));
	input_field->add_theme_color_override("font_color", COLOR_TEXT_BODY);
	input_field->add_theme_color_override("font_placeholder_color", COLOR_TEXT_MUTED);
	input_field->connect("text_submitted", callable_mp(this, &AIPanel::_on_input_submitted));
	input_field->connect("gui_input", callable_mp(this, &AIPanel::_on_input_gui_input));  // Handle paste
	input_area->add_child(input_field);
	
	// Send button with cosmic styling
	send_button = memnew(Button);
	send_button->set_text(">");  // Play icon for send
	send_button->set_custom_minimum_size(Size2(_scaled_ui_size(48), _scaled_ui_size(34)));
	send_button->add_theme_font_size_override("font_size", _theme_font_with_delta(this, 2, _scaled_ui_size(16), "Button"));
	send_button->add_theme_color_override("font_color", COLOR_AI_CYAN);
	send_button->add_theme_color_override("font_hover_color", Color(1.0, 1.0, 1.0));
	send_button->connect("pressed", callable_mp(this, &AIPanel::_on_send_pressed));
	input_area->add_child(send_button);
}

AIPanel::~AIPanel() {
	// Save current session before shutdown
	_save_current_session();
	
	// Kill AI Router process on cleanup
	if (ai_router_pid > 0) {
		print_line("AIPanel: Stopping AI Router (PID: " + itos(ai_router_pid) + ")");
		OS::get_singleton()->kill(ai_router_pid);
		ai_router_pid = 0;
	}
}
