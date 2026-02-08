#include "register_types.h"

#include "godot_bridge.h"
#include "ai_panel.h"
#include "spritemancer_dock.h"
#include "spritemancer_main_screen.h"
#include "drag_drop_texture_rect.h"
#include "core/object/class_db.h"

#ifdef TOOLS_ENABLED
#include "agentic_godot_plugin.h"
#include "editor/plugins/editor_plugin.h"
#endif

void initialize_godot_bridge_module(ModuleInitializationLevel p_level) {
	if (p_level == MODULE_INITIALIZATION_LEVEL_SCENE) {
		GDREGISTER_CLASS(GodotBridge);
		GDREGISTER_CLASS(AIPanel);
		GDREGISTER_CLASS(SpriteMancerDock);
		GDREGISTER_CLASS(SpriteMancerMainScreen);
		GDREGISTER_CLASS(DragDropTextureRect);
	}

#ifdef TOOLS_ENABLED
	if (p_level == MODULE_INITIALIZATION_LEVEL_EDITOR) {
		GDREGISTER_CLASS(AgenticGodotPlugin);
		EditorPlugins::add_by_type<AgenticGodotPlugin>();
	}
#endif
}

void uninitialize_godot_bridge_module(ModuleInitializationLevel p_level) {
	if (p_level != MODULE_INITIALIZATION_LEVEL_SCENE) {
		return;
	}
}
