//*****************************************************************************
// gdCEF Module Registration
//*****************************************************************************

#include "register_types.h"
#include "gdcef.h"
#include "gdbrowser.h"

#include "core/object/class_db.h"
#include "core/os/os.h"
#include "core/string/print_string.h"

// CEF library loader for macOS - declared in gdcef_impl.cpp
extern "C" bool gdcef_load_framework(const char* framework_path);
extern "C" void gdcef_unload_framework();

static bool cef_framework_loaded = false;

void initialize_gdcef_module(ModuleInitializationLevel p_level) {
    if (p_level != MODULE_INITIALIZATION_LEVEL_SCENE) {
        return;
    }

    // Register classes
    GDREGISTER_CLASS(GDCef);
    GDREGISTER_CLASS(GDBrowserView);
    
#ifdef __APPLE__
    // On macOS, we need to load the CEF framework dynamically
    // This must happen BEFORE any CEF functions are called
    String exe_path = OS::get_singleton()->get_executable_path();
    String exe_dir = exe_path.get_base_dir();
    String framework_path = exe_dir.path_join(
        "cefsimple.app/Contents/Frameworks/Chromium Embedded Framework.framework/Chromium Embedded Framework"
    );
    
    print_line("[gdCEF] Loading CEF framework: " + framework_path);
    
    CharString path_utf8 = framework_path.utf8();
    if (gdcef_load_framework(path_utf8.get_data())) {
        cef_framework_loaded = true;
        print_line("[gdCEF] CEF framework loaded successfully");
    } else {
        print_line("[gdCEF] ERROR: Failed to load CEF framework");
    }
#endif
    
    print_line("[gdCEF] Module registered");
}

void uninitialize_gdcef_module(ModuleInitializationLevel p_level) {
    if (p_level != MODULE_INITIALIZATION_LEVEL_SCENE) {
        return;
    }
    
#ifdef __APPLE__
    if (cef_framework_loaded) {
        print_line("[gdCEF] Unloading CEF framework");
        gdcef_unload_framework();
        cef_framework_loaded = false;
    }
#endif
    
    print_line("[gdCEF] Module uninitialized");
}
