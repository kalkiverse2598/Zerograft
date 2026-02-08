//*****************************************************************************
// GDBrowserView - Browser instance for Godot
// Wraps CefBrowser with off-screen rendering to ImageTexture
//
// Uses pimpl pattern to isolate CEF from Godot headers
//*****************************************************************************

#ifndef GDBROWSER_H
#define GDBROWSER_H

// Only Godot headers in public interface
#include "scene/main/node.h"
#include "scene/gui/texture_rect.h"
#include "scene/resources/image_texture.h"
#include "core/variant/dictionary.h"
#include "core/variant/callable.h"
#include "core/io/image.h"

// Forward declaration for pimpl
class GDBrowserImpl;
class GDCefImpl;

//*****************************************************************************
// GDBrowserView - A single browser instance
// Renders web content to a Godot ImageTexture via off-screen rendering
//*****************************************************************************
class GDBrowserView : public Node {
    GDCLASS(GDBrowserView, Node);

protected:
    static void _bind_methods();

public:
    GDBrowserView();
    ~GDBrowserView();

    // -------------------------------------------------------------------------
    // Initialization (called by GDCef::create_browser)
    // -------------------------------------------------------------------------
    bool init(const String &url, TextureRect *texture_rect, GDCefImpl *cef_impl, Dictionary config);

    // -------------------------------------------------------------------------
    // Properties
    // -------------------------------------------------------------------------
    int id() const;
    String get_error() const;
    bool is_valid() const;
    
    // -------------------------------------------------------------------------
    // Navigation
    // -------------------------------------------------------------------------
    void load_url(const String &url);
    String get_url() const;
    String get_title() const;
    bool is_loaded() const;
    void reload();
    void reload_ignore_cache();
    void stop_loading();
    
    // -------------------------------------------------------------------------
    // History
    // -------------------------------------------------------------------------
    bool has_previous_page() const;
    bool has_next_page() const;
    void previous_page();
    void next_page();
    
    // -------------------------------------------------------------------------
    // Rendering
    // -------------------------------------------------------------------------
    Ref<ImageTexture> get_texture() const;
    void resize(Vector2 size);
    
    // -------------------------------------------------------------------------
    // Input handling
    // -------------------------------------------------------------------------
    void set_mouse_position(int x, int y);
    void send_mouse_click(int x, int y, int button, bool pressed, int click_count);
    void send_mouse_wheel(int x, int y, int delta_x, int delta_y);
    void send_key_event(int key_code, int native_key_code, bool pressed, 
                        bool shift, bool ctrl, bool alt);
    void send_text(const String &text);
    void set_focus(bool focused);
    
    // -------------------------------------------------------------------------
    // JavaScript
    // -------------------------------------------------------------------------
    void execute_javascript(const String &javascript);
    
    // -------------------------------------------------------------------------
    // Audio
    // -------------------------------------------------------------------------
    void set_muted(bool muted);
    bool is_muted() const;
    
    // -------------------------------------------------------------------------
    // Optimization
    // -------------------------------------------------------------------------
    void set_hidden(bool hidden);
    bool is_hidden() const;
    void set_frame_rate(int fps);
    int get_frame_rate() const;
    
    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------
    void close();

    // -------------------------------------------------------------------------
    // Callbacks from impl (called from CEF thread)
    // -------------------------------------------------------------------------
    void on_paint(const void* buffer, int width, int height);
    void on_load_complete(bool success, const char* url);
    void on_title_change(const char* title);

private:
    GDBrowserImpl* m_impl = nullptr;
    
    // Godot objects
    TextureRect* m_texture_rect = nullptr;
    Ref<ImageTexture> m_texture;
    Ref<Image> m_image;
    
    // State
    String m_error;
    String m_url;
    String m_title;
    bool m_loaded = false;
    bool m_hidden = false;
    int m_width = 800;
    int m_height = 600;
    int m_frame_rate = 30;
    bool m_muted = false;
};

#endif // GDBROWSER_H
