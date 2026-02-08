//*****************************************************************************
// GDBrowser Implementation - CEF-specific code
// Exports C-style functions for GDBrowserView
//*****************************************************************************

// CEF headers - ONLY in this file
#include "include/cef_browser.h"
#include "include/cef_client.h"
#include "include/cef_life_span_handler.h"
#include "include/cef_render_handler.h"
#include "include/cef_load_handler.h"
#include "include/cef_display_handler.h"

#include <string>
#include <iostream>
#include <functional>

// Forward declarations from gdcef_impl.cpp
class GDCefImpl;
extern "C" CefWindowInfo* gdcef_impl_get_window_info(GDCefImpl* impl);
extern "C" CefBrowserSettings* gdcef_impl_get_browser_settings(GDCefImpl* impl);

// Forward declaration for callback owner
class GDBrowserView;

//*****************************************************************************
// BrowserHandler - Combined CEF handler
//*****************************************************************************
class BrowserHandler : public CefClient,
                       public CefLifeSpanHandler,
                       public CefRenderHandler,
                       public CefLoadHandler,
                       public CefDisplayHandler {
public:
    using PaintCallback = std::function<void(const void*, int, int)>;
    using LoadCallback = std::function<void(bool, const char*)>;
    using TitleCallback = std::function<void(const char*)>;

    BrowserHandler() {}
    virtual ~BrowserHandler() {}

    void set_paint_callback(PaintCallback cb) { m_paint_cb = cb; }
    void set_load_callback(LoadCallback cb) { m_load_cb = cb; }
    void set_title_callback(TitleCallback cb) { m_title_cb = cb; }
    void set_viewport_size(int w, int h) { m_width = w; m_height = h; if (m_browser) m_browser->GetHost()->WasResized(); }
    void set_hidden(bool h) { m_hidden = h; }
    CefRefPtr<CefBrowser> browser() { return m_browser; }

    // CefClient
    CefRefPtr<CefLifeSpanHandler> GetLifeSpanHandler() override { return this; }
    CefRefPtr<CefRenderHandler> GetRenderHandler() override { return this; }
    CefRefPtr<CefLoadHandler> GetLoadHandler() override { return this; }
    CefRefPtr<CefDisplayHandler> GetDisplayHandler() override { return this; }

    // CefLifeSpanHandler
    void OnAfterCreated(CefRefPtr<CefBrowser> browser) override {
        m_browser = browser;
        std::cout << "[gdCEF] Browser created, ID: " << browser->GetIdentifier() << std::endl;
    }
    bool DoClose(CefRefPtr<CefBrowser> browser) override { return false; }
    void OnBeforeClose(CefRefPtr<CefBrowser> browser) override {
        if (m_browser && m_browser->GetIdentifier() == browser->GetIdentifier()) m_browser = nullptr;
    }

    // CefRenderHandler
    void GetViewRect(CefRefPtr<CefBrowser> browser, CefRect& rect) override {
        rect.Set(0, 0, m_width, m_height);
    }
    void OnPaint(CefRefPtr<CefBrowser> browser, PaintElementType type,
                 const RectList& dirtyRects, const void* buffer,
                 int width, int height) override {
        if (m_hidden || type != PET_VIEW) return;
        if (m_paint_cb) m_paint_cb(buffer, width, height);
    }

    // CefLoadHandler
    void OnLoadEnd(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame, int httpStatusCode) override {
        if (frame->IsMain() && m_load_cb) {
            std::string url = frame->GetURL().ToString();
            m_load_cb(true, url.c_str());
        }
    }
    void OnLoadError(CefRefPtr<CefBrowser> browser, CefRefPtr<CefFrame> frame,
                     ErrorCode errorCode, const CefString& errorText, const CefString& failedUrl) override {
        if (errorCode == ERR_ABORTED) return;
        if (frame->IsMain() && m_load_cb) {
            std::string url = failedUrl.ToString();
            m_load_cb(false, url.c_str());
        }
    }

    // CefDisplayHandler
    void OnTitleChange(CefRefPtr<CefBrowser> browser, const CefString& title) override {
        if (m_title_cb) {
            std::string t = title.ToString();
            m_title_cb(t.c_str());
        }
    }

private:
    CefRefPtr<CefBrowser> m_browser;
    int m_width = 800, m_height = 600;
    bool m_hidden = false;
    PaintCallback m_paint_cb;
    LoadCallback m_load_cb;
    TitleCallback m_title_cb;
    IMPLEMENT_REFCOUNTING(BrowserHandler);
};

//*****************************************************************************
// GDBrowserImpl
//*****************************************************************************
class GDBrowserImpl {
public:
    CefRefPtr<BrowserHandler> handler;
    GDBrowserView* owner = nullptr;
    std::string cached_url;
};

//*****************************************************************************
// External callback registration (called by gdbrowser.cpp via on_paint etc)
//*****************************************************************************
// Note: GDBrowserView::on_paint etc are called directly via function pointer

//*****************************************************************************
// Exported C-style functions
//*****************************************************************************
extern "C" {

GDBrowserImpl* gdbrowser_impl_create(GDBrowserView* owner) {
    GDBrowserImpl* impl = new GDBrowserImpl();
    impl->owner = owner;
    impl->handler = new BrowserHandler();
    return impl;
}

void gdbrowser_impl_destroy(GDBrowserImpl* impl) {
    delete impl;
}

// Forward declaration for callback - defined in gdbrowser.cpp
void gdbrowser_owner_on_paint(GDBrowserView* owner, const void* buffer, int width, int height);
void gdbrowser_owner_on_load(GDBrowserView* owner, bool success, const char* url);
void gdbrowser_owner_on_title(GDBrowserView* owner, const char* title);

bool gdbrowser_impl_init(GDBrowserImpl* impl, GDCefImpl* cef_impl,
                          const char* url, int width, int height, int frame_rate)
{
    if (!impl || !cef_impl) return false;
    
    impl->handler->set_viewport_size(width, height);
    
    // Set callbacks that forward to GDBrowserView
    impl->handler->set_paint_callback([impl](const void* buf, int w, int h) {
        gdbrowser_owner_on_paint(impl->owner, buf, w, h);
    });
    impl->handler->set_load_callback([impl](bool success, const char* url) {
        gdbrowser_owner_on_load(impl->owner, success, url);
    });
    impl->handler->set_title_callback([impl](const char* title) {
        gdbrowser_owner_on_title(impl->owner, title);
    });

    CefWindowInfo* win_info = gdcef_impl_get_window_info(cef_impl);
    CefBrowserSettings* settings = gdcef_impl_get_browser_settings(cef_impl);
    if (!win_info || !settings) return false;
    
    settings->windowless_frame_rate = frame_rate;

    std::cout << "[gdCEF] Creating browser: " << url << std::endl;
    CefRefPtr<CefBrowser> browser = CefBrowserHost::CreateBrowserSync(
        *win_info, impl->handler, CefString(url), *settings, nullptr, nullptr);
    
    return browser != nullptr;
}

void gdbrowser_impl_close(GDBrowserImpl* impl) {
    if (impl && impl->handler && impl->handler->browser()) {
        impl->handler->browser()->GetHost()->CloseBrowser(true);
    }
}

int gdbrowser_impl_id(GDBrowserImpl* impl) {
    if (impl && impl->handler && impl->handler->browser()) 
        return impl->handler->browser()->GetIdentifier();
    return -1;
}

bool gdbrowser_impl_is_valid(GDBrowserImpl* impl) {
    return impl && impl->handler && impl->handler->browser();
}

void gdbrowser_impl_load_url(GDBrowserImpl* impl, const char* url) {
    if (impl && impl->handler && impl->handler->browser()) {
        impl->handler->browser()->GetMainFrame()->LoadURL(CefString(url));
    }
}

const char* gdbrowser_impl_get_url(GDBrowserImpl* impl) {
    if (impl && impl->handler && impl->handler->browser()) {
        impl->cached_url = impl->handler->browser()->GetMainFrame()->GetURL().ToString();
        return impl->cached_url.c_str();
    }
    return "";
}

void gdbrowser_impl_reload(GDBrowserImpl* impl) {
    if (impl && impl->handler && impl->handler->browser()) impl->handler->browser()->Reload();
}

void gdbrowser_impl_reload_ignore_cache(GDBrowserImpl* impl) {
    if (impl && impl->handler && impl->handler->browser()) impl->handler->browser()->ReloadIgnoreCache();
}

void gdbrowser_impl_stop_loading(GDBrowserImpl* impl) {
    if (impl && impl->handler && impl->handler->browser()) impl->handler->browser()->StopLoad();
}

bool gdbrowser_impl_can_go_back(GDBrowserImpl* impl) {
    return impl && impl->handler && impl->handler->browser() && impl->handler->browser()->CanGoBack();
}

bool gdbrowser_impl_can_go_forward(GDBrowserImpl* impl) {
    return impl && impl->handler && impl->handler->browser() && impl->handler->browser()->CanGoForward();
}

void gdbrowser_impl_go_back(GDBrowserImpl* impl) {
    if (impl && impl->handler && impl->handler->browser()) impl->handler->browser()->GoBack();
}

void gdbrowser_impl_go_forward(GDBrowserImpl* impl) {
    if (impl && impl->handler && impl->handler->browser()) impl->handler->browser()->GoForward();
}

void gdbrowser_impl_send_mouse_move(GDBrowserImpl* impl, int x, int y) {
    if (!impl || !impl->handler || !impl->handler->browser()) return;
    CefMouseEvent ev; ev.x = x; ev.y = y; ev.modifiers = 0;
    impl->handler->browser()->GetHost()->SendMouseMoveEvent(ev, false);
}

void gdbrowser_impl_send_mouse_click(GDBrowserImpl* impl, int x, int y, int button, bool pressed, int click_count) {
    if (!impl || !impl->handler || !impl->handler->browser()) return;
    CefMouseEvent ev; ev.x = x; ev.y = y; ev.modifiers = 0;
    CefBrowserHost::MouseButtonType btn = (button == 2) ? MBT_RIGHT : (button == 3) ? MBT_MIDDLE : MBT_LEFT;
    impl->handler->browser()->GetHost()->SendMouseClickEvent(ev, btn, !pressed, click_count);
}

void gdbrowser_impl_send_mouse_wheel(GDBrowserImpl* impl, int x, int y, int delta_x, int delta_y) {
    if (!impl || !impl->handler || !impl->handler->browser()) return;
    CefMouseEvent ev; ev.x = x; ev.y = y; ev.modifiers = 0;
    impl->handler->browser()->GetHost()->SendMouseWheelEvent(ev, delta_x, delta_y);
}

void gdbrowser_impl_send_key_event(GDBrowserImpl* impl, int key_code, int native_key_code, bool pressed, bool shift, bool ctrl, bool alt) {
    if (!impl || !impl->handler || !impl->handler->browser()) return;
    CefKeyEvent ev;
    ev.windows_key_code = key_code;
    ev.native_key_code = native_key_code;
    ev.type = pressed ? KEYEVENT_KEYDOWN : KEYEVENT_KEYUP;
    ev.modifiers = 0;
    if (shift) ev.modifiers |= EVENTFLAG_SHIFT_DOWN;
    if (ctrl) ev.modifiers |= EVENTFLAG_CONTROL_DOWN;
    if (alt) ev.modifiers |= EVENTFLAG_ALT_DOWN;
    impl->handler->browser()->GetHost()->SendKeyEvent(ev);
}

void gdbrowser_impl_send_char(GDBrowserImpl* impl, char c) {
    if (!impl || !impl->handler || !impl->handler->browser()) return;
    CefKeyEvent ev;
    ev.type = KEYEVENT_CHAR;
    ev.character = c;
    ev.unmodified_character = c;
    ev.windows_key_code = c;
    ev.modifiers = 0;
    impl->handler->browser()->GetHost()->SendKeyEvent(ev);
}

void gdbrowser_impl_set_focus(GDBrowserImpl* impl, bool focused) {
    if (impl && impl->handler && impl->handler->browser())
        impl->handler->browser()->GetHost()->SetFocus(focused);
}

void gdbrowser_impl_execute_javascript(GDBrowserImpl* impl, const char* js) {
    if (impl && impl->handler && impl->handler->browser()) {
        CefRefPtr<CefFrame> frame = impl->handler->browser()->GetMainFrame();
        if (frame) frame->ExecuteJavaScript(CefString(js), frame->GetURL(), 0);
    }
}

void gdbrowser_impl_set_muted(GDBrowserImpl* impl, bool muted) {
    if (impl && impl->handler && impl->handler->browser())
        impl->handler->browser()->GetHost()->SetAudioMuted(muted);
}

void gdbrowser_impl_set_hidden(GDBrowserImpl* impl, bool hidden) {
    if (!impl || !impl->handler) return;
    impl->handler->set_hidden(hidden);
    if (impl->handler->browser()) impl->handler->browser()->GetHost()->WasHidden(hidden);
}

void gdbrowser_impl_was_resized(GDBrowserImpl* impl, int width, int height) {
    if (impl && impl->handler) impl->handler->set_viewport_size(width, height);
}

void gdbrowser_impl_set_frame_rate(GDBrowserImpl* impl, int fps) {
    if (impl && impl->handler && impl->handler->browser())
        impl->handler->browser()->GetHost()->SetWindowlessFrameRate(fps);
}

} // extern "C"

//*****************************************************************************
// Callback wrappers that call into GDBrowserView (in gdbrowser.cpp)
// These need to be declared here so they link properly
//*****************************************************************************
// Note: These are defined in gdbrowser.cpp but need forward declaration
extern "C" void gdbrowser_owner_on_paint(GDBrowserView* owner, const void* buffer, int width, int height);
extern "C" void gdbrowser_owner_on_load(GDBrowserView* owner, bool success, const char* url);
extern "C" void gdbrowser_owner_on_title(GDBrowserView* owner, const char* title);
