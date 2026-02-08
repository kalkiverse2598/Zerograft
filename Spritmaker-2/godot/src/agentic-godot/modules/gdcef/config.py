def can_build(env, platform):
    # gdCEF module - only enabled on macOS for now
    return platform == "macos"

def configure(env):
    pass

def get_doc_classes():
    return [
        "GDCef",
        "GDBrowserView",
    ]

def get_doc_path():
    return "doc_classes"
