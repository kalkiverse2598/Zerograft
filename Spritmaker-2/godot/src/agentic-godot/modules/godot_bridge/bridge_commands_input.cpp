// bridge_commands_input.cpp
// Input, project settings, groups, and signals for GodotBridge

#include "godot_bridge.h"
#include "core/input/input_map.h"
#include "core/input/input_event.h"
#include "core/config/project_settings.h"
#include "core/io/resource_loader.h"

#ifdef TOOLS_ENABLED
#include "editor/editor_interface.h"
#endif

// ============ Input Action Commands ============

Dictionary GodotBridge::add_input_action(const String &p_action, const String &p_key) {
	Dictionary result;
	
	// Add to runtime InputMap
	if (!InputMap::get_singleton()->has_action(p_action)) {
		InputMap::get_singleton()->add_action(p_action);
	}
	
	Ref<InputEventKey> key_event;
	key_event.instantiate();
	
	String key_upper = p_key.to_upper();
	::Key keycode = ::Key::NONE;
	
	if (key_upper == "W" || key_upper == "KEY_W") keycode = ::Key::W;
	else if (key_upper == "A" || key_upper == "KEY_A") keycode = ::Key::A;
	else if (key_upper == "S" || key_upper == "KEY_S") keycode = ::Key::S;
	else if (key_upper == "D" || key_upper == "KEY_D") keycode = ::Key::D;
	else if (key_upper == "SPACE" || key_upper == "KEY_SPACE") keycode = ::Key::SPACE;
	else if (key_upper == "ENTER" || key_upper == "KEY_ENTER") keycode = ::Key::ENTER;
	else if (key_upper == "ESCAPE" || key_upper == "KEY_ESCAPE") keycode = ::Key::ESCAPE;
	else if (key_upper == "UP" || key_upper == "KEY_UP") keycode = ::Key::UP;
	else if (key_upper == "DOWN" || key_upper == "KEY_DOWN") keycode = ::Key::DOWN;
	else if (key_upper == "LEFT" || key_upper == "KEY_LEFT") keycode = ::Key::LEFT;
	else if (key_upper == "RIGHT" || key_upper == "KEY_RIGHT") keycode = ::Key::RIGHT;
	else if (key_upper == "SHIFT" || key_upper == "KEY_SHIFT") keycode = ::Key::SHIFT;
	else if (key_upper == "CTRL" || key_upper == "KEY_CTRL") keycode = ::Key::CTRL;
	else if (key_upper.length() == 1) {
		char32_t c = key_upper[0];
		if (c >= 'A' && c <= 'Z') {
			keycode = (::Key)c;
		}
	}
	
	if (keycode != ::Key::NONE) {
		key_event->set_keycode(keycode);
		InputMap::get_singleton()->action_add_event(p_action, key_event);
		
		// PERSIST: Save to project settings so it works when game runs
		String setting_key = "input/" + p_action;
		Dictionary action_dict;
		Array events;
		
		// Get existing events if any
		if (ProjectSettings::get_singleton()->has_setting(setting_key)) {
			action_dict = ProjectSettings::get_singleton()->get_setting(setting_key);
			if (action_dict.has("events")) {
				events = action_dict["events"];
			}
		} else {
			action_dict["deadzone"] = 0.5;
		}
		
		// Add the new key event
		events.push_back(key_event);
		action_dict["events"] = events;
		
		ProjectSettings::get_singleton()->set_setting(setting_key, action_dict);
		Error save_err = ProjectSettings::get_singleton()->save();
		
		if (save_err != OK) {
			result["warning"] = "Action added to runtime but failed to persist to project.godot";
		}
		
		result["action"] = p_action;
		result["key"] = p_key;
		result["success"] = true;
		result["persisted"] = (save_err == OK);
	} else {
		result["error"] = "Unknown key: " + p_key;
		result["success"] = false;
	}
	
	return result;
}

Dictionary GodotBridge::remove_input_action(const String &p_action) {
	Dictionary result;
	
	if (InputMap::get_singleton()->has_action(p_action)) {
		InputMap::get_singleton()->erase_action(p_action);
		result["action"] = p_action;
		result["success"] = true;
	} else {
		result["error"] = "Action not found: " + p_action;
		result["success"] = false;
	}
	
	return result;
}

Dictionary GodotBridge::list_input_actions() {
	Dictionary result;
	Array actions;
	
	List<StringName> action_list = InputMap::get_singleton()->get_actions();
	
	for (const StringName &action : action_list) {
		if (!String(action).begins_with("ui_")) {
			Dictionary action_info;
			action_info["name"] = String(action);
			
			Array events;
			const List<Ref<InputEvent>> *event_list = InputMap::get_singleton()->action_get_events(action);
			if (event_list) {
				for (const Ref<InputEvent> &event : *event_list) {
					events.push_back(event->as_text());
				}
			}
			action_info["events"] = events;
			actions.push_back(action_info);
		}
	}
	
	result["actions"] = actions;
	result["count"] = actions.size();
	result["success"] = true;
	return result;
}

// ============ Project Settings Commands ============

Dictionary GodotBridge::set_project_setting(const String &p_setting, const Variant &p_value) {
	Dictionary result;
	
	ProjectSettings::get_singleton()->set_setting(p_setting, p_value);
	
	Error err = ProjectSettings::get_singleton()->save();
	if (err == OK) {
		result["setting"] = p_setting;
		result["value"] = p_value;
		result["success"] = true;
	} else {
		result["error"] = "Failed to save project settings";
		result["success"] = false;
	}
	
	return result;
}

Dictionary GodotBridge::get_project_setting(const String &p_setting) {
	Dictionary result;
	
	if (ProjectSettings::get_singleton()->has_setting(p_setting)) {
		result["setting"] = p_setting;
		result["value"] = ProjectSettings::get_singleton()->get_setting(p_setting);
		result["success"] = true;
	} else {
		result["error"] = "Setting not found: " + p_setting;
		result["success"] = false;
	}
	
	return result;
}

// ============ Group Commands ============

Dictionary GodotBridge::add_to_group(const String &p_node, const String &p_group) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_node);
	if (!node) {
		result["error"] = "Node not found: " + p_node;
		result["success"] = false;
		return result;
	}
	
	node->add_to_group(p_group, true);
	result["node"] = p_node;
	result["group"] = p_group;
	result["success"] = true;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::remove_from_group(const String &p_node, const String &p_group) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_node);
	if (!node) {
		result["error"] = "Node not found: " + p_node;
		result["success"] = false;
		return result;
	}
	
	if (node->is_in_group(p_group)) {
		node->remove_from_group(p_group);
		result["node"] = p_node;
		result["group"] = p_group;
		result["success"] = true;
	} else {
		result["error"] = "Node not in group: " + p_group;
		result["success"] = false;
	}
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::list_groups(const String &p_node) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_node);
	if (!node) {
		result["error"] = "Node not found: " + p_node;
		result["success"] = false;
		return result;
	}
	
	Array groups;
	List<GroupInfo> group_list;
	node->get_groups(&group_list);
	
	for (const GroupInfo &info : group_list) {
		groups.push_back(String(info.name));
	}
	
	result["node"] = p_node;
	result["groups"] = groups;
	result["count"] = groups.size();
	result["success"] = true;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

// ============ Signal Commands ============

Dictionary GodotBridge::connect_signal(const String &p_source, const String &p_signal, const String &p_target, const String &p_method) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	Node *source = _get_node_by_path(p_source);
	if (!source) {
		result["error"] = "Source node not found: " + p_source;
		result["success"] = false;
		return result;
	}
	
	Node *target = _get_node_by_path(p_target);
	if (!target) {
		result["error"] = "Target node not found: " + p_target;
		result["success"] = false;
		return result;
	}
	
	if (!source->has_signal(p_signal)) {
		result["error"] = "Signal not found: " + p_signal;
		result["success"] = false;
		return result;
	}
	
	Error err = source->connect(p_signal, Callable(target, p_method));
	if (err == OK) {
		result["source"] = p_source;
		result["signal"] = p_signal;
		result["target"] = p_target;
		result["method"] = p_method;
		result["success"] = true;
	} else {
		result["error"] = "Failed to connect signal";
		result["success"] = false;
	}
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::list_signals(const String &p_node) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_node);
	if (!node) {
		result["error"] = "Node not found: " + p_node;
		result["success"] = false;
		return result;
	}
	
	Array signals;
	List<MethodInfo> signal_list;
	node->get_signal_list(&signal_list);
	
	for (const MethodInfo &sig : signal_list) {
		Dictionary sig_info;
		sig_info["name"] = sig.name;
		Array args;
		for (const PropertyInfo &arg : sig.arguments) {
			args.push_back(arg.name);
		}
		sig_info["arguments"] = args;
		signals.push_back(sig_info);
	}
	
	result["node"] = p_node;
	result["signals"] = signals;
	result["count"] = signals.size();
	result["success"] = true;
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

// ============ Audio Commands ============

Dictionary GodotBridge::set_audio_stream(const String &p_node, const String &p_audio_path) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_node);
	if (!node) {
		result["error"] = "Node not found: " + p_node;
		result["success"] = false;
		return result;
	}
	
	Ref<Resource> audio_stream = ResourceLoader::load(p_audio_path);
	if (!audio_stream.is_valid()) {
		result["error"] = "Audio file not found: " + p_audio_path;
		result["success"] = false;
		return result;
	}
	
	if (node->has_method("set_stream")) {
		node->call("set_stream", audio_stream);
		result["node"] = p_node;
		result["audio_path"] = p_audio_path;
		result["success"] = true;
	} else {
		result["error"] = "Node is not an audio player";
		result["success"] = false;
	}
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}

Dictionary GodotBridge::play_audio(const String &p_node) {
	Dictionary result;
#ifdef TOOLS_ENABLED
	Node *node = _get_node_by_path(p_node);
	if (!node) {
		result["error"] = "Node not found: " + p_node;
		result["success"] = false;
		return result;
	}
	
	if (node->has_method("play")) {
		node->call("play");
		result["node"] = p_node;
		result["success"] = true;
	} else {
		result["error"] = "Node is not an audio player";
		result["success"] = false;
	}
#else
	result["error"] = "Editor tools not available";
	result["success"] = false;
#endif
	return result;
}
