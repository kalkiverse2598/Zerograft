//*****************************************************************************
// GDBrowserView - Godot interface layer
// This file only contains Godot code - CEF is in gdbrowser_impl.cpp
//
// IMPORTANT: Do NOT include gdbrowser_impl.h here - it contains CEF headers
//*****************************************************************************

#include "gdbrowser.h"

#include "core/string/print_string.h"

// Callback wrappers called from gdbrowser_impl.cpp
extern "C" void gdbrowser_owner_on_paint(GDBrowserView* owner, const void* buffer, int width, int height) {
    if (owner) owner->on_paint(buffer, width, height);
}

extern "C" void gdbrowser_owner_on_load(GDBrowserView* owner, bool success, const char* url) {
    if (owner) owner->on_load_complete(success, url);
}

extern "C" void gdbrowser_owner_on_title(GDBrowserView* owner, const char* title) {
    if (owner) owner->on_title_change(title);
}

// Forward declaration - do not include impl headers
class GDBrowserImpl;
class GDCefImpl;

// External functions defined in gdbrowser_impl.cpp
extern "C" {
    GDBrowserImpl* gdbrowser_impl_create(GDBrowserView* owner);
    void gdbrowser_impl_destroy(GDBrowserImpl* impl);
    bool gdbrowser_impl_init(GDBrowserImpl* impl, GDCefImpl* cef_impl,
                             const char* url, int width, int height, int frame_rate);
    void gdbrowser_impl_close(GDBrowserImpl* impl);
    int gdbrowser_impl_id(GDBrowserImpl* impl);
    bool gdbrowser_impl_is_valid(GDBrowserImpl* impl);
    void gdbrowser_impl_load_url(GDBrowserImpl* impl, const char* url);
    const char* gdbrowser_impl_get_url(GDBrowserImpl* impl);
    void gdbrowser_impl_reload(GDBrowserImpl* impl);
    void gdbrowser_impl_reload_ignore_cache(GDBrowserImpl* impl);
    void gdbrowser_impl_stop_loading(GDBrowserImpl* impl);
    bool gdbrowser_impl_can_go_back(GDBrowserImpl* impl);
    bool gdbrowser_impl_can_go_forward(GDBrowserImpl* impl);
    void gdbrowser_impl_go_back(GDBrowserImpl* impl);
    void gdbrowser_impl_go_forward(GDBrowserImpl* impl);
    void gdbrowser_impl_send_mouse_move(GDBrowserImpl* impl, int x, int y);
    void gdbrowser_impl_send_mouse_click(GDBrowserImpl* impl, int x, int y, int button, bool pressed, int click_count);
    void gdbrowser_impl_send_mouse_wheel(GDBrowserImpl* impl, int x, int y, int delta_x, int delta_y);
    void gdbrowser_impl_send_key_event(GDBrowserImpl* impl, int key_code, int native_key_code, bool pressed, bool shift, bool ctrl, bool alt);
    void gdbrowser_impl_send_char(GDBrowserImpl* impl, char c);
    void gdbrowser_impl_set_focus(GDBrowserImpl* impl, bool focused);
    void gdbrowser_impl_execute_javascript(GDBrowserImpl* impl, const char* js);
    void gdbrowser_impl_set_muted(GDBrowserImpl* impl, bool muted);
    void gdbrowser_impl_set_hidden(GDBrowserImpl* impl, bool hidden);
    void gdbrowser_impl_was_resized(GDBrowserImpl* impl, int width, int height);
    void gdbrowser_impl_set_frame_rate(GDBrowserImpl* impl, int fps);
}

//------------------------------------------------------------------------------
void GDBrowserView::_bind_methods() {
    ClassDB::bind_method(D_METHOD("load_url", "url"), &GDBrowserView::load_url);
    ClassDB::bind_method(D_METHOD("get_url"), &GDBrowserView::get_url);
    ClassDB::bind_method(D_METHOD("get_title"), &GDBrowserView::get_title);
    ClassDB::bind_method(D_METHOD("is_loaded"), &GDBrowserView::is_loaded);
    ClassDB::bind_method(D_METHOD("reload"), &GDBrowserView::reload);
    ClassDB::bind_method(D_METHOD("reload_ignore_cache"), &GDBrowserView::reload_ignore_cache);
    ClassDB::bind_method(D_METHOD("stop_loading"), &GDBrowserView::stop_loading);
    ClassDB::bind_method(D_METHOD("has_previous_page"), &GDBrowserView::has_previous_page);
    ClassDB::bind_method(D_METHOD("has_next_page"), &GDBrowserView::has_next_page);
    ClassDB::bind_method(D_METHOD("previous_page"), &GDBrowserView::previous_page);
    ClassDB::bind_method(D_METHOD("next_page"), &GDBrowserView::next_page);
    ClassDB::bind_method(D_METHOD("get_texture"), &GDBrowserView::get_texture);
    ClassDB::bind_method(D_METHOD("resize", "size"), &GDBrowserView::resize);
    ClassDB::bind_method(D_METHOD("set_mouse_position", "x", "y"), &GDBrowserView::set_mouse_position);
    ClassDB::bind_method(D_METHOD("send_mouse_click", "x", "y", "button", "pressed", "click_count"), &GDBrowserView::send_mouse_click);
    ClassDB::bind_method(D_METHOD("send_mouse_wheel", "x", "y", "delta_x", "delta_y"), &GDBrowserView::send_mouse_wheel);
    ClassDB::bind_method(D_METHOD("send_key_event", "key_code", "native_key_code", "pressed", "shift", "ctrl", "alt"), &GDBrowserView::send_key_event);
    ClassDB::bind_method(D_METHOD("send_text", "text"), &GDBrowserView::send_text);
    ClassDB::bind_method(D_METHOD("set_focus", "focused"), &GDBrowserView::set_focus);
    ClassDB::bind_method(D_METHOD("execute_javascript", "javascript"), &GDBrowserView::execute_javascript);
    ClassDB::bind_method(D_METHOD("set_muted", "muted"), &GDBrowserView::set_muted);
    ClassDB::bind_method(D_METHOD("is_muted"), &GDBrowserView::is_muted);
    ClassDB::bind_method(D_METHOD("set_hidden", "hidden"), &GDBrowserView::set_hidden);
    ClassDB::bind_method(D_METHOD("is_hidden"), &GDBrowserView::is_hidden);
    ClassDB::bind_method(D_METHOD("set_frame_rate", "fps"), &GDBrowserView::set_frame_rate);
    ClassDB::bind_method(D_METHOD("get_frame_rate"), &GDBrowserView::get_frame_rate);
    ClassDB::bind_method(D_METHOD("id"), &GDBrowserView::id);
    ClassDB::bind_method(D_METHOD("is_valid"), &GDBrowserView::is_valid);
    ClassDB::bind_method(D_METHOD("get_error"), &GDBrowserView::get_error);
    ClassDB::bind_method(D_METHOD("close"), &GDBrowserView::close);
    
    ADD_SIGNAL(MethodInfo("page_loaded", PropertyInfo(Variant::STRING, "url")));
    ADD_SIGNAL(MethodInfo("page_failed", PropertyInfo(Variant::STRING, "url"), PropertyInfo(Variant::STRING, "error")));
    ADD_SIGNAL(MethodInfo("title_changed", PropertyInfo(Variant::STRING, "title")));
}

//------------------------------------------------------------------------------
GDBrowserView::GDBrowserView() {
    print_line("[gdCEF] GDBrowserView created");
    m_texture.instantiate();
    m_image.instantiate();
}

//------------------------------------------------------------------------------
GDBrowserView::~GDBrowserView() {
    close();
    print_line("[gdCEF] GDBrowserView destroyed");
}

//------------------------------------------------------------------------------
bool GDBrowserView::init(const String &url, TextureRect *texture_rect, 
                         GDCefImpl *cef_impl, Dictionary config) {
    m_texture_rect = texture_rect;
    m_url = url;
    
    Vector2 size = texture_rect->get_size();
    m_width = (int)size.x;
    m_height = (int)size.y;
    if (m_width <= 0) m_width = 800;
    if (m_height <= 0) m_height = 600;
    
    if (config.has("frame_rate")) {
        m_frame_rate = config["frame_rate"];
    }
    
    // Create impl
    m_impl = gdbrowser_impl_create(this);
    
    // Initialize image
    m_image->initialize_data(m_width, m_height, false, Image::FORMAT_RGBA8);
    m_texture->set_image(m_image);
    m_texture_rect->set_texture(m_texture);
    
    // Create browser
    if (!gdbrowser_impl_init(m_impl, cef_impl, url.utf8().get_data(), m_width, m_height, m_frame_rate)) {
        gdbrowser_impl_destroy(m_impl);
        m_impl = nullptr;
        return false;
    }
    
    return true;
}

//------------------------------------------------------------------------------
int GDBrowserView::id() const { return m_impl ? gdbrowser_impl_id(m_impl) : -1; }
String GDBrowserView::get_error() const { return m_error; }
bool GDBrowserView::is_valid() const { return m_impl && gdbrowser_impl_is_valid(m_impl); }

//------------------------------------------------------------------------------
void GDBrowserView::load_url(const String &url) {
    if (m_impl) {
        m_url = url;
        m_loaded = false;
        gdbrowser_impl_load_url(m_impl, url.utf8().get_data());
    }
}

String GDBrowserView::get_url() const {
    if (m_impl) return String(gdbrowser_impl_get_url(m_impl));
    return m_url;
}

String GDBrowserView::get_title() const { return m_title; }
bool GDBrowserView::is_loaded() const { return m_loaded; }

void GDBrowserView::reload() { if (m_impl) gdbrowser_impl_reload(m_impl); }
void GDBrowserView::reload_ignore_cache() { if (m_impl) gdbrowser_impl_reload_ignore_cache(m_impl); }
void GDBrowserView::stop_loading() { if (m_impl) gdbrowser_impl_stop_loading(m_impl); }

bool GDBrowserView::has_previous_page() const { return m_impl ? gdbrowser_impl_can_go_back(m_impl) : false; }
bool GDBrowserView::has_next_page() const { return m_impl ? gdbrowser_impl_can_go_forward(m_impl) : false; }
void GDBrowserView::previous_page() { if (m_impl) gdbrowser_impl_go_back(m_impl); }
void GDBrowserView::next_page() { if (m_impl) gdbrowser_impl_go_forward(m_impl); }

Ref<ImageTexture> GDBrowserView::get_texture() const { return m_texture; }

void GDBrowserView::resize(Vector2 size) {
    m_width = (int)size.x;
    m_height = (int)size.y;
    if (m_width <= 0) m_width = 800;
    if (m_height <= 0) m_height = 600;
    
    m_image->initialize_data(m_width, m_height, false, Image::FORMAT_RGBA8);
    m_texture->set_image(m_image);
    
    if (m_impl) gdbrowser_impl_was_resized(m_impl, m_width, m_height);
}

void GDBrowserView::set_mouse_position(int x, int y) {
    if (m_impl) gdbrowser_impl_send_mouse_move(m_impl, x, y);
}

void GDBrowserView::send_mouse_click(int x, int y, int button, bool pressed, int click_count) {
    if (m_impl) gdbrowser_impl_send_mouse_click(m_impl, x, y, button, pressed, click_count);
}

void GDBrowserView::send_mouse_wheel(int x, int y, int delta_x, int delta_y) {
    if (m_impl) gdbrowser_impl_send_mouse_wheel(m_impl, x, y, delta_x, delta_y);
}

void GDBrowserView::send_key_event(int key_code, int native_key_code, bool pressed,
                                    bool shift, bool ctrl, bool alt) {
    if (m_impl) gdbrowser_impl_send_key_event(m_impl, key_code, native_key_code, pressed, shift, ctrl, alt);
}

void GDBrowserView::send_text(const String &text) {
    if (m_impl) {
        CharString utf8 = text.utf8();
        for (int i = 0; i < utf8.length(); i++) {
            gdbrowser_impl_send_char(m_impl, utf8[i]);
        }
    }
}

void GDBrowserView::set_focus(bool focused) {
    if (m_impl) gdbrowser_impl_set_focus(m_impl, focused);
}

void GDBrowserView::execute_javascript(const String &javascript) {
    if (m_impl) gdbrowser_impl_execute_javascript(m_impl, javascript.utf8().get_data());
}

void GDBrowserView::set_muted(bool muted) {
    if (m_impl) {
        gdbrowser_impl_set_muted(m_impl, muted);
        m_muted = muted;
    }
}

bool GDBrowserView::is_muted() const { return m_muted; }

void GDBrowserView::set_hidden(bool hidden) {
    m_hidden = hidden;
    if (m_impl) gdbrowser_impl_set_hidden(m_impl, hidden);
}

bool GDBrowserView::is_hidden() const { return m_hidden; }

void GDBrowserView::set_frame_rate(int fps) {
    m_frame_rate = fps;
    if (fps < 1) m_frame_rate = 1;
    if (fps > 60) m_frame_rate = 60;
    if (m_impl) gdbrowser_impl_set_frame_rate(m_impl, m_frame_rate);
}

int GDBrowserView::get_frame_rate() const { return m_frame_rate; }

void GDBrowserView::close() {
    if (m_impl) {
        gdbrowser_impl_close(m_impl);
        gdbrowser_impl_destroy(m_impl);
        m_impl = nullptr;
    }
}

//------------------------------------------------------------------------------
// Callbacks from impl - these are called from gdbrowser_impl.cpp
//------------------------------------------------------------------------------
void GDBrowserView::on_paint(const void* buffer, int width, int height) {
    static int paint_count = 0;
    if (paint_count++ % 30 == 0) {  // Log every 30 frames to avoid spam
        print_line(String("[gdCEF] on_paint: ") + itos(width) + "x" + itos(height) + 
                   " texture_rect=" + (m_texture_rect ? "valid" : "null"));
    }
    
    if (!m_image.is_valid() || !m_texture.is_valid() || !m_texture_rect) return;
    
    // BGRA -> RGBA conversion
    PackedByteArray data;
    data.resize(width * height * 4);
    
    const uint8_t* src = static_cast<const uint8_t*>(buffer);
    uint8_t* dst = data.ptrw();
    
    for (int i = 0; i < width * height; i++) {
        dst[i * 4 + 0] = src[i * 4 + 2];  // R <- B
        dst[i * 4 + 1] = src[i * 4 + 1];  // G <- G
        dst[i * 4 + 2] = src[i * 4 + 0];  // B <- R
        dst[i * 4 + 3] = src[i * 4 + 3];  // A <- A
    }
    
    // Use set_data to update existing image (not create_from_data which makes new ref)
    m_image->set_data(width, height, false, Image::FORMAT_RGBA8, data);
    m_texture->set_image(m_image);
    m_texture_rect->set_texture(m_texture);
}

void GDBrowserView::on_load_complete(bool success, const char* url) {
    m_loaded = success;
    m_url = String(url);
    
    if (success) {
        emit_signal("page_loaded", m_url);
    } else {
        emit_signal("page_failed", m_url, m_error);
    }
}

void GDBrowserView::on_title_change(const char* title) {
    m_title = String(title);
    emit_signal("title_changed", m_title);
}
