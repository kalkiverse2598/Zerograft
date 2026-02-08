# godot_bridge Module

WebSocket IPC bridge for communication between Godot and Cline.

## Protocol
- Port: 9876 (localhost)
- Format: JSON messages
- Types: request, response, event

## Files
- `SCsub` - Build script
- `config.py` - Module config
- `godot_bridge.cpp/h` - WebSocket server
- `ipc_message.cpp/h` - Message serialization
