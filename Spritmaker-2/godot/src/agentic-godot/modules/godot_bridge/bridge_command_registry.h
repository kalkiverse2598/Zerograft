#ifndef BRIDGE_COMMAND_REGISTRY_H
#define BRIDGE_COMMAND_REGISTRY_H

#include "core/variant/dictionary.h"
#include "core/templates/hash_map.h"
#include "core/string/ustring.h"
#include <functional>

class GodotBridge;

// Command handler function type - takes bridge instance and params, returns result
using BridgeCommandHandler = std::function<Dictionary(GodotBridge*, const Dictionary&)>;

// Registry map type using Godot's HashMap
using CommandRegistry = HashMap<String, BridgeCommandHandler>;

// Helper macro for registering commands - pass just method name, not method()
#define REGISTER_COMMAND_0(registry, name, method_name) \
	registry[name] = [](GodotBridge* bridge, const Dictionary& params) -> Dictionary { \
		return bridge->method_name(); \
	}

#define REGISTER_COMMAND_1(registry, name, method_name, p1_name, p1_type, p1_default) \
	registry[name] = [](GodotBridge* bridge, const Dictionary& params) -> Dictionary { \
		p1_type p1 = params.get(p1_name, p1_default); \
		return bridge->method_name(p1); \
	}

#define REGISTER_COMMAND_2(registry, name, method_name, p1_name, p1_type, p1_default, p2_name, p2_type, p2_default) \
	registry[name] = [](GodotBridge* bridge, const Dictionary& params) -> Dictionary { \
		p1_type p1 = params.get(p1_name, p1_default); \
		p2_type p2 = params.get(p2_name, p2_default); \
		return bridge->method_name(p1, p2); \
	}

#define REGISTER_COMMAND_3(registry, name, method_name, p1_name, p1_type, p1_default, p2_name, p2_type, p2_default, p3_name, p3_type, p3_default) \
	registry[name] = [](GodotBridge* bridge, const Dictionary& params) -> Dictionary { \
		p1_type p1 = params.get(p1_name, p1_default); \
		p2_type p2 = params.get(p2_name, p2_default); \
		p3_type p3 = params.get(p3_name, p3_default); \
		return bridge->method_name(p1, p2, p3); \
	}

#define REGISTER_COMMAND_4(registry, name, method_name, p1_name, p1_type, p1_default, p2_name, p2_type, p2_default, p3_name, p3_type, p3_default, p4_name, p4_type, p4_default) \
	registry[name] = [](GodotBridge* bridge, const Dictionary& params) -> Dictionary { \
		p1_type p1 = params.get(p1_name, p1_default); \
		p2_type p2 = params.get(p2_name, p2_default); \
		p3_type p3 = params.get(p3_name, p3_default); \
		p4_type p4 = params.get(p4_name, p4_default); \
		return bridge->method_name(p1, p2, p3, p4); \
	}

#endif // BRIDGE_COMMAND_REGISTRY_H
