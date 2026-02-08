//*****************************************************************************
// GDCef Implementation - CEF-specific code isolated here
// This file contains ALL CEF includes and exports C-style functions
//*****************************************************************************

// CEF headers - ONLY in this file
#include "include/cef_app.h"
#include "include/cef_browser.h"
#include "include/cef_version.h"
#include "include/wrapper/cef_helpers.h"

#ifdef __APPLE__
#include "include/wrapper/cef_library_loader.h"
#endif

#include <string>
#include <iostream>

//*****************************************************************************
// CEF Framework Loading for macOS
//*****************************************************************************
extern "C" {

bool gdcef_load_framework(const char* framework_path) {
#ifdef __APPLE__
    std::cout << "[gdCEF] cef_load_library: " << framework_path << std::endl;
    return cef_load_library(framework_path);
#else
    return true;
#endif
}

void gdcef_unload_framework() {
#ifdef __APPLE__
    cef_unload_library();
#endif
}

} // extern "C"

//*****************************************************************************
// CefAppHandler
//*****************************************************************************
class CefAppHandler : public CefApp, public CefBrowserProcessHandler {
public:
    CefAppHandler() {}
    virtual ~CefAppHandler() {}

    virtual CefRefPtr<CefBrowserProcessHandler> GetBrowserProcessHandler() override {
        return this;
    }

    virtual void OnBeforeCommandLineProcessing(
        const CefString& process_type,
        CefRefPtr<CefCommandLine> command_line) override
    {
        if (!command_line) return;
        command_line->AppendSwitchWithValue("use-angle", "swiftshader");
        command_line->AppendSwitchWithValue("use-gl", "angle");
        if (m_enable_media_stream) command_line->AppendSwitch("enable-media-stream");
        if (!m_user_agent.empty()) command_line->AppendSwitchWithValue("user-agent", m_user_agent);
        command_line->AppendSwitchWithValue("autoplay-policy", "user-gesture-required");
        command_line->AppendSwitch("disable-gpu");
        command_line->AppendSwitch("disable-gpu-compositing");
        
        // macOS-specific: Prevent keychain access prompts by using a mock keychain
        command_line->AppendSwitch("use-mock-keychain");
    }

    virtual void OnContextInitialized() override {}

    void set_enable_media_stream(bool v) { m_enable_media_stream = v; }
    void set_user_agent(const std::string& ua) { m_user_agent = ua; }

private:
    bool m_enable_media_stream = false;
    std::string m_user_agent;
    IMPLEMENT_REFCOUNTING(CefAppHandler);
};

//*****************************************************************************
// GDCefImpl
//*****************************************************************************
class GDCefImpl {
public:
    CefRefPtr<CefAppHandler> app;
    CefSettings settings;
    CefWindowInfo window_info;
    CefBrowserSettings browser_settings;
    bool initialized = false;
    std::string error;
};

//*****************************************************************************
// Exported C-style functions for GDCef
//*****************************************************************************
extern "C" {

GDCefImpl* gdcef_impl_create() {
    return new GDCefImpl();
}

void gdcef_impl_destroy(GDCefImpl* impl) {
    delete impl;
}

bool gdcef_impl_initialize(GDCefImpl* impl, const char* artifacts_path,
                            int remote_debugging_port, int frame_rate,
                            bool enable_media_stream, const char* user_agent)
{
    if (!impl || impl->initialized) {
        if (impl) impl->error = "Already initialized";
        return false;
    }

    std::cout << "[gdCEF] Initializing CEF..." << std::endl;

    std::string path(artifacts_path);
    
    // Match original gdCEF exactly - only set main_bundle_path and browser_subprocess_path
    std::string main_bundle = path + "/cefsimple.app";
    std::string subprocess = main_bundle + "/Contents/Frameworks/cefsimple Helper.app/Contents/MacOS/cefsimple Helper";
    
    std::cout << "[gdCEF] Main bundle: " << main_bundle << std::endl;
    std::cout << "[gdCEF] Subprocess: " << subprocess << std::endl;
    
    // Only these two paths matter on macOS - CEF finds everything else relative to main_bundle
    CefString(&impl->settings.main_bundle_path).FromString(main_bundle);
    CefString(&impl->settings.browser_subprocess_path).FromString(subprocess);
    
    // Cache path
    std::string cache_path = path + "/cache";
    std::cout << "[gdCEF] Cache path: " << cache_path << std::endl;
    CefString(&impl->settings.root_cache_path).FromString(cache_path);
    CefString(&impl->settings.cache_path).FromString(cache_path);
    
    // Log file
    CefString(&impl->settings.log_file).FromString(path + "/cef_debug.log");
    impl->settings.log_severity = LOGSEVERITY_INFO;
    
    // Basic settings
    impl->settings.remote_debugging_port = remote_debugging_port;
    impl->settings.windowless_rendering_enabled = true;
    impl->settings.no_sandbox = true;
    impl->settings.multi_threaded_message_loop = false;
    impl->settings.external_message_pump = false;
    
    impl->window_info.SetAsWindowless(0);
    impl->window_info.shared_texture_enabled = false;
    impl->browser_settings.windowless_frame_rate = frame_rate;

    impl->app = new CefAppHandler();
    impl->app->set_enable_media_stream(enable_media_stream);
    if (user_agent && user_agent[0]) impl->app->set_user_agent(user_agent);

    std::cout << "[gdCEF] Calling CefInitialize..." << std::endl;

    CefMainArgs args;
    if (!CefInitialize(args, impl->settings, impl->app, nullptr)) {
        impl->error = "CefInitialize failed";
        std::cout << "[gdCEF] ERROR: " << impl->error << std::endl;
        impl->app = nullptr;
        return false;
    }

    impl->initialized = true;
    std::cout << "[gdCEF] CEF initialized successfully!" << std::endl;
    return true;
}

void gdcef_impl_shutdown(GDCefImpl* impl) {
    if (!impl || !impl->initialized) return;
    
    // Mark as not initialized first to prevent re-entrancy
    impl->initialized = false;
    
    // Pump message loop a few times to allow browsers to close properly
    // CEF browser close is asynchronous and needs message loop iterations
    for (int i = 0; i < 10; i++) {
        CefDoMessageLoopWork();
    }
    
    // Shutdown CEF
    CefShutdown();
    impl->app = nullptr;
    std::cout << "[gdCEF] CEF shutdown complete" << std::endl;
}

void gdcef_impl_do_message_loop_work(GDCefImpl* impl) {
    if (impl && impl->initialized) {
        CefDoMessageLoopWork();
    }
}

const char* gdcef_impl_get_version(GDCefImpl* impl) {
    static std::string version = CEF_VERSION;
    return version.c_str();
}

const char* gdcef_impl_get_error(GDCefImpl* impl) {
    return impl ? impl->error.c_str() : "null impl";
}

bool gdcef_impl_is_initialized(GDCefImpl* impl) {
    return impl && impl->initialized;
}

// Get pointers for browser creation (used by gdbrowser_impl)
CefWindowInfo* gdcef_impl_get_window_info(GDCefImpl* impl) {
    return impl ? &impl->window_info : nullptr;
}

CefBrowserSettings* gdcef_impl_get_browser_settings(GDCefImpl* impl) {
    return impl ? &impl->browser_settings : nullptr;
}

} // extern "C"
