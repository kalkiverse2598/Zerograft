#ifndef AGENTIC_GODOT_PLUGIN_H
#define AGENTIC_GODOT_PLUGIN_H

#include "editor/plugins/editor_plugin.h"
#include "godot_bridge.h"
#include "ai_panel.h"
#include "spritemancer_dock.h"
#include "spritemancer_main_screen.h"

class AgenticGodotPlugin : public EditorPlugin {
	GDCLASS(AgenticGodotPlugin, EditorPlugin);

private:
	GodotBridge *bridge = nullptr;
	AIPanel *ai_panel = nullptr;
	SpriteMancerDock *spritemancer_dock = nullptr;
	SpriteMancerMainScreen *spritemancer_main_screen = nullptr;
	int bridge_port = 9876;

protected:
	static void _bind_methods();
	void _notification(int p_what);

public:
	virtual String get_name() const override { return "Agentic Godot"; }
	virtual bool has_main_screen() const override { return true; }
	virtual void make_visible(bool p_visible) override;

	void start_bridge();
	void stop_bridge();
	bool is_bridge_running() const;

	AgenticGodotPlugin();
	~AgenticGodotPlugin();
};

#endif // AGENTIC_GODOT_PLUGIN_H
