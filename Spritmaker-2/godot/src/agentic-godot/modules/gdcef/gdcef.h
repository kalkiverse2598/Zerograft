//*****************************************************************************
// GDCef - Chromium Embedded Framework for Godot
// Main controller class for browser management
//
// Uses pimpl pattern to isolate CEF from Godot headers and avoid
// enum conflicts (ERR_OUT_OF_MEMORY, ERR_FILE_NOT_FOUND, etc.)
//*****************************************************************************

#ifndef GDCEF_H
#define GDCEF_H

// Only Godot headers in the public interface
#include "scene/main/node.h"
#include "scene/gui/texture_rect.h"
#include "core/variant/dictionary.h"

class GDBrowserView;

// Forward declaration for pimpl
class GDCefImpl;

//*****************************************************************************
// GDCef - Main CEF controller node
// Creates and manages browser instances, handles CEF lifecycle
//*****************************************************************************
class GDCef : public Node {
    GDCLASS(GDCef, Node);

protected:
    static void _bind_methods();

public:
    GDCef();
    ~GDCef();

    // -------------------------------------------------------------------------
    // GDScript API
    // -------------------------------------------------------------------------
    
    // Initialize CEF with configuration dictionary
    bool initialize(Dictionary config);
    
    // Check if CEF is running
    bool is_alive();
    
    // Get last error message
    String get_error();
    
    // Get CEF version string
    String version();
    
    // Create a new browser view
    GDBrowserView* create_browser(const String &url, TextureRect *texture_rect, Dictionary config);
    
    // Shutdown CEF (call before exit)
    void shutdown();

    // -------------------------------------------------------------------------
    // Godot lifecycle
    // -------------------------------------------------------------------------
    void _process(double delta);
    void _exit_tree();
    void _notification(int p_what);

    // -------------------------------------------------------------------------
    // Internal API (for GDBrowserView)
    // -------------------------------------------------------------------------
    GDCefImpl* get_impl() { return m_impl; }

private:
    GDCefImpl* m_impl = nullptr;
    bool m_initialized = false;
    String m_error;
    String m_artifacts_path;
    int m_default_frame_rate = 30;
    
    bool verify_artifacts();
};

#endif // GDCEF_H
