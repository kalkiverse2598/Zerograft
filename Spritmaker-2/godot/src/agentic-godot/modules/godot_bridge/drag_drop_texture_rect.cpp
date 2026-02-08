#include "drag_drop_texture_rect.h"
#include "core/io/marshalls.h"
#include "core/core_bind.h"

void DragDropTextureRect::_bind_methods() {
	ClassDB::bind_method(D_METHOD("set_cef_browser", "browser"), &DragDropTextureRect::set_cef_browser);
	ClassDB::bind_method(D_METHOD("get_cef_browser"), &DragDropTextureRect::get_cef_browser);
	ClassDB::bind_method(D_METHOD("send_file_to_web_app", "file_path"), &DragDropTextureRect::send_file_to_web_app);
}

bool DragDropTextureRect::can_drop_data(const Point2 &p_point, const Variant &p_data) const {
	print_line("[DragDropTextureRect] can_drop_data called, data type: " + itos(p_data.get_type()));
	
	if (p_data.get_type() != Variant::DICTIONARY) {
		print_line("[DragDropTextureRect] Not a dictionary, rejecting");
		return false;
	}
	
	Dictionary data = p_data;
	print_line("[DragDropTextureRect] Dictionary with " + itos(data.size()) + " keys");
	
	// Check for file drops from FileSystem dock
	if (data.has("files") || data.has("resource") || data.has("paths")) {
		print_line("[DragDropTextureRect] Has files/resource/paths - accepting drop!");
		return true;
	}
	
	print_line("[DragDropTextureRect] No file keys found, rejecting");
	return false;
}

void DragDropTextureRect::drop_data(const Point2 &p_point, const Variant &p_data) {
	print_line("[DragDropTextureRect] drop_data called!");
	
	if (p_data.get_type() != Variant::DICTIONARY) {
		return;
	}
	
	Dictionary data = p_data;
	PackedStringArray files;
	
	// Extract file paths
	if (data.has("files")) {
		Array file_array = data["files"];
		for (int i = 0; i < file_array.size(); i++) {
			files.push_back(file_array[i]);
		}
	} else if (data.has("paths")) {
		Array path_array = data["paths"];
		for (int i = 0; i < path_array.size(); i++) {
			files.push_back(path_array[i]);
		}
	} else if (data.has("resource")) {
		Object *res_obj = data["resource"];
		if (res_obj) {
			Resource *res = Object::cast_to<Resource>(res_obj);
			if (res && !res->get_path().is_empty()) {
				files.push_back(res->get_path());
			}
		}
	}
	
	print_line("[DragDropTextureRect] Dropped " + itos(files.size()) + " files");
	
	// Send each file to the web app
	for (int i = 0; i < files.size(); i++) {
		send_file_to_web_app(files[i]);
	}
}

void DragDropTextureRect::send_file_to_web_app(const String &p_file_path) {
	if (!cef_browser) {
		print_line("[DragDropTextureRect] No CEF browser available");
		return;
	}
	
	print_line("[DragDropTextureRect] Sending file to web app: " + p_file_path);
	
	// Convert res:// to absolute path if needed
	String abs_path = p_file_path;
	if (p_file_path.begins_with("res://")) {
		abs_path = ProjectSettings::get_singleton()->globalize_path(p_file_path);
	}
	
	// Check file extension
	String ext = abs_path.get_extension().to_lower();
	if (ext != "png" && ext != "jpg" && ext != "jpeg" && ext != "webp") {
		print_line("[DragDropTextureRect] Not an image file: " + ext);
		return;
	}
	
	// Read file
	Ref<FileAccess> file = FileAccess::open(p_file_path, FileAccess::READ);
	if (!file.is_valid()) {
		print_line("[DragDropTextureRect] Failed to open file: " + p_file_path);
		return;
	}
	
	PackedByteArray content = file->get_buffer(file->get_length());
	file->close();
	
	// Convert to base64 using Marshalls
	String base64_data = core_bind::Marshalls::get_singleton()->raw_to_base64(content);
	String filename = p_file_path.get_file();
	
	// Determine MIME type
	String mime_type = "image/png";
	if (ext == "jpg" || ext == "jpeg") {
		mime_type = "image/jpeg";
	} else if (ext == "webp") {
		mime_type = "image/webp";
	}
	
	// Send to web app via JavaScript
	String js_code = vformat(R"(
		if (window.GodotBridge && window.GodotBridge.onFileDropped) {
			window.GodotBridge.onFileDropped({
				filename: '%s',
				path: '%s',
				base64: '%s',
				mimeType: '%s'
			});
		} else if (window.onGodotFileDrop) {
			window.onGodotFileDrop({
				filename: '%s',
				path: '%s', 
				base64: '%s',
				mimeType: '%s'
			});
		} else {
			console.log('[Godot] No file drop handler registered');
		}
	)", filename, p_file_path, base64_data, mime_type, filename, p_file_path, base64_data, mime_type);
	
	cef_browser->call("execute_javascript", js_code);
	print_line("[DragDropTextureRect] Sent file to web app: " + filename);
}
