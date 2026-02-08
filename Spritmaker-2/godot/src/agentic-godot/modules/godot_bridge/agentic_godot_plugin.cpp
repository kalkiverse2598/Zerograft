#include "agentic_godot_plugin.h"
#include "editor/editor_node.h"

void AgenticGodotPlugin::_bind_methods() {
	ClassDB::bind_method(D_METHOD("start_bridge"), &AgenticGodotPlugin::start_bridge);
	ClassDB::bind_method(D_METHOD("stop_bridge"), &AgenticGodotPlugin::stop_bridge);
	ClassDB::bind_method(D_METHOD("is_bridge_running"), &AgenticGodotPlugin::is_bridge_running);
}

void AgenticGodotPlugin::_notification(int p_what) {
	switch (p_what) {
		case NOTIFICATION_ENTER_TREE: {
			// Create and add AI panel dock
			ai_panel = memnew(AIPanel);
			add_control_to_dock(DOCK_SLOT_RIGHT_UL, ai_panel);
			
			// Create and add SpriteMancer dock
			spritemancer_dock = memnew(SpriteMancerDock);
			add_control_to_dock(DOCK_SLOT_LEFT_BR, spritemancer_dock);
			
			// Create SpriteMancer main screen
			spritemancer_main_screen = memnew(SpriteMancerMainScreen);
			EditorNode::get_singleton()->get_main_screen_control()->add_child(spritemancer_main_screen);
			spritemancer_main_screen->set_visible(false);
			
			// Auto-start bridge when plugin loads
			start_bridge();
			
			// Connect panels to bridge
			if (ai_panel && bridge) {
				ai_panel->set_bridge(bridge);
			}
			if (spritemancer_dock && bridge) {
				spritemancer_dock->set_bridge(bridge);
			}
			if (spritemancer_main_screen && bridge) {
				spritemancer_main_screen->set_bridge(bridge);
			}
			
			// Connect dock to main screen for preview sync
			if (spritemancer_dock && spritemancer_main_screen) {
				spritemancer_dock->connect("project_loaded", callable_mp(spritemancer_main_screen, &SpriteMancerMainScreen::on_project_loaded));
			}
		} break;
		case NOTIFICATION_EXIT_TREE: {
			// Stop bridge when plugin unloads
			stop_bridge();
			
			// Remove AI panel dock
			if (ai_panel) {
				remove_control_from_docks(ai_panel);
				memdelete(ai_panel);
				ai_panel = nullptr;
			}
			
			// Remove SpriteMancer dock
			if (spritemancer_dock) {
				remove_control_from_docks(spritemancer_dock);
				memdelete(spritemancer_dock);
				spritemancer_dock = nullptr;
			}
			
			// Remove SpriteMancer main screen
			if (spritemancer_main_screen) {
				EditorNode::get_singleton()->get_main_screen_control()->remove_child(spritemancer_main_screen);
				memdelete(spritemancer_main_screen);
				spritemancer_main_screen = nullptr;
			}
		} break;
	}
}

void AgenticGodotPlugin::make_visible(bool p_visible) {
	if (spritemancer_main_screen) {
		spritemancer_main_screen->set_visible(p_visible);
	}
}

void AgenticGodotPlugin::start_bridge() {
	if (bridge && bridge->is_running()) {
		return;  // Already running
	}

	if (!bridge) {
		bridge = memnew(GodotBridge);
		EditorNode::get_singleton()->get_gui_base()->add_child(bridge);
	}

	Error err = bridge->start(bridge_port);
	if (err == OK) {
		print_line("AgenticGodot: Bridge started on port " + itos(bridge_port));
		
		// Update panel with bridge reference
		if (ai_panel) {
			ai_panel->set_bridge(bridge);
		}
	} else {
		print_line("AgenticGodot: Failed to start bridge");
	}
}

void AgenticGodotPlugin::stop_bridge() {
	if (bridge) {
		bridge->stop();
		print_line("AgenticGodot: Bridge stopped");
	}
}

bool AgenticGodotPlugin::is_bridge_running() const {
	return bridge && bridge->is_running();
}

AgenticGodotPlugin::AgenticGodotPlugin() {
	print_line("AgenticGodot: Plugin initialized with SpriteMancer");
}

AgenticGodotPlugin::~AgenticGodotPlugin() {
	if (bridge) {
		bridge->queue_free();
		bridge = nullptr;
	}
}

