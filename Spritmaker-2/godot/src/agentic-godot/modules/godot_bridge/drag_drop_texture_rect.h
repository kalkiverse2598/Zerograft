#ifndef DRAG_DROP_TEXTURE_RECT_H
#define DRAG_DROP_TEXTURE_RECT_H

#include "scene/gui/texture_rect.h"
#include "core/io/file_access.h"
#include "core/io/marshalls.h"
#include "core/config/project_settings.h"

// Custom TextureRect that handles drag-drop from Godot FileSystem
// and forwards file data to the CEF browser via JavaScript

class DragDropTextureRect : public TextureRect {
	GDCLASS(DragDropTextureRect, TextureRect);

private:
	Object *cef_browser = nullptr;

protected:
	static void _bind_methods();

public:
	void set_cef_browser(Object *p_browser) { cef_browser = p_browser; }
	Object *get_cef_browser() { return cef_browser; }

	// Override drag-drop methods (no underscore, not const for drop_data)
	virtual bool can_drop_data(const Point2 &p_point, const Variant &p_data) const override;
	virtual void drop_data(const Point2 &p_point, const Variant &p_data) override;

	// Helper to send file to web app via JavaScript
	void send_file_to_web_app(const String &p_file_path);

	DragDropTextureRect() {}
};

#endif // DRAG_DROP_TEXTURE_RECT_H
