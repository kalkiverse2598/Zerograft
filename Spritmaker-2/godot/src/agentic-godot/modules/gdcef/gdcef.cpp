//*****************************************************************************
// GDCef - Godot interface layer
// This file only contains Godot code - CEF is in gdcef_impl.cpp
//
// IMPORTANT: Do NOT include gdcef_impl.h here - it contains CEF headers
// that conflict with Godot. GDCefImpl is forward-declared and used via ptr.
//*****************************************************************************

#include "gdcef.h"
#include "gdbrowser.h"

#include "core/os/os.h"
#include "core/config/project_settings.h"
#include "core/io/dir_access.h"
#include "core/string/print_string.h"

// Forward declaration - do not include gdcef_impl.h
class GDCefImpl;

// External functions defined in gdcef_impl.cpp (CEF side)
extern "C" {
    GDCefImpl* gdcef_impl_create();
    void gdcef_impl_destroy(GDCefImpl* impl);
    bool gdcef_impl_initialize(GDCefImpl* impl, const char* artifacts_path,
                               int remote_debugging_port, int frame_rate,
                               bool enable_media_stream, const char* user_agent);
    void gdcef_impl_shutdown(GDCefImpl* impl);
    void gdcef_impl_do_message_loop_work(GDCefImpl* impl);
    const char* gdcef_impl_get_version(GDCefImpl* impl);
    const char* gdcef_impl_get_error(GDCefImpl* impl);
    bool gdcef_impl_is_initialized(GDCefImpl* impl);
}

#define SUBPROCESS_NAME "cefsimple.app"

//------------------------------------------------------------------------------
void GDCef::_bind_methods() {
    ClassDB::bind_method(D_METHOD("initialize", "config"), &GDCef::initialize);
    ClassDB::bind_method(D_METHOD("is_alive"), &GDCef::is_alive);
    ClassDB::bind_method(D_METHOD("get_error"), &GDCef::get_error);
    ClassDB::bind_method(D_METHOD("version"), &GDCef::version);
    ClassDB::bind_method(D_METHOD("create_browser", "url", "texture_rect", "config"), &GDCef::create_browser);
    ClassDB::bind_method(D_METHOD("shutdown"), &GDCef::shutdown);
}

//------------------------------------------------------------------------------
GDCef::GDCef() {
    print_line("[gdCEF] GDCef node created");
}

//------------------------------------------------------------------------------
GDCef::~GDCef() {
    // Don't call shutdown() here - it's already called by _exit_tree()
    // Calling it again during destruction causes crashes
    print_line("[gdCEF] GDCef node destroyed");
}

//------------------------------------------------------------------------------
bool GDCef::verify_artifacts() {
    String subprocess_path = m_artifacts_path.path_join(SUBPROCESS_NAME);
    if (!DirAccess::exists(subprocess_path)) {
        m_error = "CEF subprocess not found: " + subprocess_path;
        print_line("[gdCEF] ERROR: " + m_error);
        return false;
    }
    print_line("[gdCEF] Artifacts verified at: " + m_artifacts_path);
    return true;
}

//------------------------------------------------------------------------------
bool GDCef::initialize(Dictionary config) {
    if (m_initialized) {
        m_error = "CEF already initialized";
        print_line("[gdCEF] ERROR: " + m_error);
        return false;
    }
    
    print_line("[gdCEF] Initializing CEF...");
    
    // CEF artifacts are bundled with Godot editor, next to the executable
    // No per-project copying needed!
    String exe_path = OS::get_singleton()->get_executable_path();
    String exe_dir = exe_path.get_base_dir();
    m_artifacts_path = exe_dir;  // cefsimple.app is in same folder as godot binary
    
    print_line("[gdCEF] Looking for CEF artifacts at: " + m_artifacts_path);
    
    if (!verify_artifacts()) {
        return false;
    }
    
    // Create impl via extern function
    m_impl = gdcef_impl_create();
    
    // Get config values
    int remote_port = config.has("remote_debugging_port") ? (int)config["remote_debugging_port"] : 7777;
    int frame_rate = config.has("frame_rate") ? (int)config["frame_rate"] : 30;
    bool enable_media = config.has("enable_media_stream") ? (bool)config["enable_media_stream"] : false;
    String user_agent_str = config.has("user_agent") ? String(config["user_agent"]) : "";
    
    m_default_frame_rate = frame_rate;
    
    if (!gdcef_impl_initialize(m_impl, m_artifacts_path.utf8().get_data(), remote_port, frame_rate,
                               enable_media, user_agent_str.utf8().get_data())) {
        m_error = String(gdcef_impl_get_error(m_impl));
        gdcef_impl_destroy(m_impl);
        m_impl = nullptr;
        return false;
    }
    
    m_initialized = true;
    set_process(true);  // Enable _process() to call CefDoMessageLoopWork()
    print_line("[gdCEF] CEF initialized successfully!");
    return true;
}

//------------------------------------------------------------------------------
bool GDCef::is_alive() {
    return m_initialized;
}

//------------------------------------------------------------------------------
String GDCef::get_error() {
    return m_error;
}

//------------------------------------------------------------------------------
String GDCef::version() {
    if (m_impl) {
        return String(gdcef_impl_get_version(m_impl));
    }
    return "Unknown";
}

//------------------------------------------------------------------------------
GDBrowserView* GDCef::create_browser(const String &url, TextureRect *texture_rect, Dictionary config) {
    if (!m_initialized || !m_impl) {
        m_error = "CEF not initialized";
        print_line("[gdCEF] ERROR: " + m_error);
        return nullptr;
    }
    
    if (texture_rect == nullptr) {
        m_error = "texture_rect cannot be null";
        print_line("[gdCEF] ERROR: " + m_error);
        return nullptr;
    }
    
    print_line("[gdCEF] Creating browser for: " + url);
    
    GDBrowserView *browser = memnew(GDBrowserView);
    
    if (!browser->init(url, texture_rect, m_impl, config)) {
        memdelete(browser);
        m_error = "Failed to initialize browser";
        print_line("[gdCEF] ERROR: " + m_error);
        return nullptr;
    }
    
    add_child(browser);
    print_line("[gdCEF] Browser created successfully");
    return browser;
}

//------------------------------------------------------------------------------
void GDCef::shutdown() {
    if (!m_initialized) {
        return;
    }
    
    print_line("[gdCEF] Shutting down CEF...");
    
    // Mark as not initialized first to prevent re-entrancy
    m_initialized = false;
    set_process(false);  // Stop _process() from calling CefDoMessageLoopWork
    
    // Close all browser children (don't remove/free - parent will handle that)
    int64_t count = get_child_count();
    for (int64_t i = count - 1; i >= 0; i--) {
        Node* child = get_child(i);
        GDBrowserView* browser = Object::cast_to<GDBrowserView>(child);
        if (browser) {
            browser->close();
        }
    }
    
    if (m_impl) {
        gdcef_impl_shutdown(m_impl);
        gdcef_impl_destroy(m_impl);
        m_impl = nullptr;
    }
    
    print_line("[gdCEF] CEF shutdown complete");
}

//------------------------------------------------------------------------------
void GDCef::_process(double delta) {
    if (m_impl) {
        gdcef_impl_do_message_loop_work(m_impl);
    }
}

//------------------------------------------------------------------------------
void GDCef::_exit_tree() {
    shutdown();
}

//------------------------------------------------------------------------------
void GDCef::_notification(int p_what) {
    switch (p_what) {
        case NOTIFICATION_PROCESS:
            _process(get_process_delta_time());
            break;
        case NOTIFICATION_EXIT_TREE:
            _exit_tree();
            break;
    }
}
