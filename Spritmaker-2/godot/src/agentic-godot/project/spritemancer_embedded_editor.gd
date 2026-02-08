@tool
extends Control
## SpriteMancer Embedded Editor using gdCEF
## This loads the SpriteMancer pixel editor in an embedded browser
## and provides JavaScript ↔ Godot IPC for save/export operations
##
## OPTIMIZATION: Uses 30fps default (vs 60) to reduce CPU when drawing
## Browser rendering pauses when editor tab is hidden

signal page_loaded(url: String)
signal page_failed(url: String)
signal sprite_saved(path: String)
signal export_requested(data: Dictionary)

@onready var texture_rect: TextureRect = $TextureRect

var cef_node = null
var browser = null
var mouse_pressed: bool = false
var editor_url: String = "http://localhost:3000"
var current_project_id: String = ""
var sprites_folder: String = "res://sprites/"

# Frame rate optimization
const FRAME_RATE_ACTIVE: int = 30  # Reduced from 60 for pixel art (less motion blur needed)
const FRAME_RATE_BACKGROUND: int = 5  # Very low when not visible
var is_editor_visible: bool = true

func _ready():
	print("[SpriteMancer] GDScript _ready() STARTING")
	set_anchors_preset(Control.PRESET_FULL_RECT)
	
	# Check if GDCef class exists
	print("[SpriteMancer] Checking if GDCef class exists...")
	var class_exists = ClassDB.class_exists("GDCef")
	print("[SpriteMancer] ClassDB.class_exists('GDCef') = ", class_exists)
	
	if class_exists:
		print("[SpriteMancer] Attempting to instantiate GDCef...")
		cef_node = ClassDB.instantiate("GDCef")
		print("[SpriteMancer] Instantiate result: ", cef_node)
		if cef_node:
			cef_node.name = "CEF"
			add_child(cef_node)
			print("[SpriteMancer] GDCef node created and added as child")
		else:
			push_error("[SpriteMancer] Failed to instantiate GDCef")
			return
	else:
		push_error("[SpriteMancer] GDCef class not found!")
		return
	
	# Initialize CEF
	print("[SpriteMancer] Initializing CEF...")
	var init_result = cef_node.initialize({"incognito": true, "locale": "en-US"})
	print("[SpriteMancer] CEF initialize result: ", init_result)
	if !init_result:
		push_error("[SpriteMancer] Failed to initialize CEF")
		return
	
	print("[SpriteMancer] CEF version: " + cef_node.get_full_version())
	
	# Ensure sprites folder exists
	_ensure_sprites_folder()
	
	# Wait for layout
	await get_tree().process_frame
	
	# Create browser
	print("[SpriteMancer] Creating browser...")
	_create_browser()

func _ensure_sprites_folder():
	var dir = DirAccess.open("res://")
	if dir:
		if !dir.dir_exists("sprites"):
			dir.make_dir("sprites")
			print("[SpriteMancer] Created sprites folder")

func _create_browser():
	if browser != null:
		return
	
	var url = editor_url
	if !current_project_id.is_empty():
		url = editor_url + "/editor/" + current_project_id
	
	print("[SpriteMancer] Browser URL: ", url)
	browser = cef_node.create_browser(url, texture_rect, {
		"javascript": true,
		"webgl": true,
		"frame_rate": FRAME_RATE_ACTIVE  # Optimized: 30fps vs default 60fps
	})
	
	if browser:
		browser.name = "editor"
		browser.connect("on_page_loaded", _on_page_loaded)
		browser.connect("on_page_failed_loading", _on_page_failed)
		
		# Register Godot methods for JavaScript IPC
		_register_js_callbacks()
		
		print("[SpriteMancer] Browser created successfully!")
	else:
		push_error("[SpriteMancer] Failed to create browser")

func _register_js_callbacks():
	if browser == null:
		return
	
	# Register callbacks that JavaScript can invoke
	# Usage in JS: window.godot.saveSprite("base64data", "filename.png")
	browser.register_method(self, "js_save_sprite")
	browser.register_method(self, "js_export_spritesheet")
	browser.register_method(self, "js_notify_ready")
	browser.register_method(self, "js_request_refresh")
	
	print("[SpriteMancer] JS callbacks registered: js_save_sprite, js_export_spritesheet, js_notify_ready, js_request_refresh")

## Called from JavaScript to save a sprite image
## Usage: window.godot.js_save_sprite(base64_data, filename)
func js_save_sprite(base64_data: String, filename: String) -> bool:
	print("[SpriteMancer] js_save_sprite called: ", filename)
	
	if base64_data.is_empty():
		push_error("[SpriteMancer] No image data provided")
		return false
	
	# Remove data URL prefix if present
	var data = base64_data
	if data.begins_with("data:image"):
		var comma_pos = data.find(",")
		if comma_pos > 0:
			data = data.substr(comma_pos + 1)
	
	# Decode base64 to bytes
	var bytes = Marshalls.base64_to_raw(data)
	if bytes.is_empty():
		push_error("[SpriteMancer] Failed to decode base64 data")
		return false
	
	# Create image from PNG data
	var image = Image.new()
	var err = image.load_png_from_buffer(bytes)
	if err != OK:
		push_error("[SpriteMancer] Failed to load PNG from buffer: ", err)
		return false
	
	# Save to sprites folder
	var save_path = sprites_folder + filename
	err = image.save_png(save_path)
	if err != OK:
		push_error("[SpriteMancer] Failed to save PNG: ", save_path, " error: ", err)
		return false
	
	print("[SpriteMancer] Sprite saved: ", save_path)
	emit_signal("sprite_saved", save_path)
	
	# Refresh filesystem
	_refresh_filesystem()
	
	return true

## Called from JavaScript to export spritesheet
## Usage: window.godot.js_export_spritesheet(json_data)
func js_export_spritesheet(json_data: String) -> bool:
	print("[SpriteMancer] js_export_spritesheet called")
	
	var json = JSON.new()
	var parse_result = json.parse(json_data)
	if parse_result != OK:
		push_error("[SpriteMancer] Failed to parse spritesheet JSON")
		return false
	
	var data = json.data
	if data is Dictionary:
		emit_signal("export_requested", data)
		print("[SpriteMancer] Export requested: ", data.get("filename", "unknown"))
		return true
	
	return false

## Called from JavaScript when the editor is ready
func js_notify_ready():
	print("[SpriteMancer] JS editor ready!")
	
	# Inject helper functions into the page
	_inject_godot_bridge()

## Called from JavaScript to refresh the Godot filesystem
func js_request_refresh():
	print("[SpriteMancer] JS requested filesystem refresh")
	_refresh_filesystem()

func _inject_godot_bridge():
	if browser == null:
		return
	
	# Inject a helper object into the page
	var js_code = """
	window.GodotBridge = {
		saveSprite: function(base64Data, filename) {
			if (window.godot && window.godot.js_save_sprite) {
				return window.godot.js_save_sprite(base64Data, filename);
			}
			console.error('GodotBridge: js_save_sprite not available');
			return false;
		},
		exportSpritesheet: function(data) {
			if (window.godot && window.godot.js_export_spritesheet) {
				return window.godot.js_export_spritesheet(JSON.stringify(data));
			}
			console.error('GodotBridge: js_export_spritesheet not available');
			return false;
		},
		notifyReady: function() {
			if (window.godot && window.godot.js_notify_ready) {
				window.godot.js_notify_ready();
			}
		},
		refreshFilesystem: function() {
			if (window.godot && window.godot.js_request_refresh) {
				window.godot.js_request_refresh();
			}
		},
		isAvailable: function() {
			return window.godot != null;
		}
	};
	
	// Auto-notify when bridge is ready
	if (window.godot) {
		console.log('[GodotBridge] Ready - Godot IPC available');
		if (window.onGodotBridgeReady) {
			window.onGodotBridgeReady();
		}
	} else {
		console.warn('[GodotBridge] Godot object not found - IPC unavailable');
	}
	"""
	
	browser.execute_javascript(js_code)
	print("[SpriteMancer] Godot bridge injected")

func _refresh_filesystem():
	# Refresh the Godot editor's filesystem
	if Engine.is_editor_hint():
		var editor_interface = Engine.get_singleton("EditorInterface")
		if editor_interface:
			editor_interface.get_resource_filesystem().scan()
			print("[SpriteMancer] Godot filesystem refreshed")

func _on_page_loaded(node):
	var url = node.get_url()
	print("[SpriteMancer] Page loaded: ", url)
	
	# Wait a moment for the page to fully initialize, then inject bridge
	await get_tree().create_timer(0.5).timeout
	_inject_godot_bridge()
	
	emit_signal("page_loaded", url)

func _on_page_failed(aborted, msg, node):
	var url = node.get_url()
	push_error("[SpriteMancer] Page failed: " + url + " - " + msg)
	emit_signal("page_failed", url)

func load_project(project_id: String):
	current_project_id = project_id
	var url = editor_url + "/editor/" + project_id
	if browser:
		browser.load_url(url)
	else:
		_create_browser()

func navigate_to(url: String):
	if browser:
		browser.load_url(url)

func set_editor_url(url: String):
	editor_url = url

## Execute arbitrary JavaScript
func execute_js(code: String):
	if browser:
		browser.execute_javascript(code)

func _on_texture_rect_gui_input(event):
	if browser == null:
		return
	
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			browser.set_mouse_wheel_vertical(2)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			browser.set_mouse_wheel_vertical(-2)
		elif event.button_index == MOUSE_BUTTON_LEFT:
			mouse_pressed = event.pressed
			if mouse_pressed:
				browser.set_mouse_left_down()
			else:
				browser.set_mouse_left_up()
		elif event.button_index == MOUSE_BUTTON_RIGHT:
			mouse_pressed = event.pressed
			if mouse_pressed:
				browser.set_mouse_right_down()
			else:
				browser.set_mouse_right_up()
	elif event is InputEventMouseMotion:
		if mouse_pressed:
			browser.set_mouse_left_down()
		browser.set_mouse_moved(event.position.x, event.position.y)

func _input(event):
	if browser == null or !has_focus():
		return
	
	if event is InputEventKey:
		browser.set_key_pressed(
			event.unicode if event.unicode != 0 else event.keycode,
			event.pressed,
			event.shift_pressed,
			event.alt_pressed,
			event.is_command_or_control_pressed()
		)

## Called when editor visibility changes (e.g., switching tabs)
## Uses new CEF methods: set_hidden() pauses rendering, set_frame_rate() adjusts FPS
func set_editor_visible(visible: bool):
	is_editor_visible = visible
	if browser == null:
		return
	
	if visible:
		print("[SpriteMancer] Editor visible - active mode (30fps)")
		# Resume rendering and set active frame rate
		browser.set_hidden(false)
		browser.set_frame_rate(FRAME_RATE_ACTIVE)
	else:
		print("[SpriteMancer] Editor hidden - paused (5fps)")
		# Reduce frame rate drastically when hidden (nearly pause)
		browser.set_frame_rate(FRAME_RATE_BACKGROUND)
		browser.set_hidden(true)

func _notification(what):
	if what == NOTIFICATION_VISIBILITY_CHANGED:
		set_editor_visible(is_visible_in_tree())

## File Drop Support - Accept files dragged from Godot's FileSystem panel
## These methods forward file drops to the CEF browser using the new DragTarget APIs

func _can_drop_data(at_position: Vector2, data) -> bool:
	# Accept drops if:
	# 1. Browser is initialized
	# 2. Data contains "files" (from FileSystem dock) or "resource" 
	if browser == null:
		return false
	
	if data is Dictionary:
		if data.has("files") or data.has("resource") or data.has("paths"):
			# Notify CEF that files are being dragged over
			var files = _extract_files_from_drop_data(data)
			if files.size() > 0:
				var abs_files = _convert_to_absolute_paths(files)
				browser.drop_files_enter(abs_files, int(at_position.x), int(at_position.y))
				print("[SpriteMancer] File drag enter: ", files.size(), " files")
				return true
	return false

func _drop_data(at_position: Vector2, data) -> void:
	if browser == null:
		return
	
	var files = _extract_files_from_drop_data(data)
	if files.size() > 0:
		var abs_files = _convert_to_absolute_paths(files)
		
		# Complete the drop in CEF
		browser.drop_files_complete(int(at_position.x), int(at_position.y))
		print("[SpriteMancer] File dropped: ", files)
		
		# Also send via JavaScript IPC for the web app to handle
		# This is more reliable for web apps that expect file content
		for file_path in files:
			_send_file_to_web_app(file_path)

func _extract_files_from_drop_data(data: Dictionary) -> PackedStringArray:
	var files = PackedStringArray()
	
	if data.has("files"):
		for f in data["files"]:
			if f is String:
				files.append(f)
	elif data.has("paths"):
		for p in data["paths"]:
			if p is String:
				files.append(p)
	elif data.has("resource"):
		var res = data["resource"]
		if res is Resource and res.resource_path:
			files.append(res.resource_path)
	
	return files

func _convert_to_absolute_paths(files: PackedStringArray) -> PackedStringArray:
	var abs_paths = PackedStringArray()
	for f in files:
		if f.begins_with("res://"):
			abs_paths.append(ProjectSettings.globalize_path(f))
		else:
			abs_paths.append(f)
	return abs_paths

func _send_file_to_web_app(file_path: String) -> void:
	# Read the file and send it as base64 to the web app via JS
	if browser == null:
		return
	
	var path = file_path
	if path.begins_with("res://"):
		path = ProjectSettings.globalize_path(path)
	
	# Check if it's an image file
	if path.ends_with(".png") or path.ends_with(".jpg") or path.ends_with(".jpeg"):
		var file = FileAccess.open(file_path, FileAccess.READ)
		if file:
			var content = file.get_buffer(file.get_length())
			file.close()
			
			var base64_data = Marshalls.raw_to_base64(content)
			var filename = file_path.get_file()
			
			# Send to web app via JavaScript
			var js_code = """
			if (window.GodotBridge && window.GodotBridge.onFileDropped) {
				window.GodotBridge.onFileDropped({
					filename: '%s',
					path: '%s',
					base64: '%s',
					mimeType: 'image/png'
				});
			} else if (window.onGodotFileDrop) {
				window.onGodotFileDrop({
					filename: '%s',
					path: '%s', 
					base64: '%s',
					mimeType: 'image/png'
				});
			}
			""" % [filename, file_path, base64_data, filename, file_path, base64_data]
			
			browser.execute_javascript(js_code)
			print("[SpriteMancer] Sent file to web app: ", filename)
