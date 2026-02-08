def can_build(env, platform):
    return True  # WebSocket works on all platforms


def configure(env):
    pass


def get_doc_classes():
    return [
        "GodotBridge",
    ]


def get_doc_path():
    return "doc_classes"
