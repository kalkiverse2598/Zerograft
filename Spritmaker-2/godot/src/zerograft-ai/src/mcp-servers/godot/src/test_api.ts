/**
 * Test script for GodotBridge real API commands
 */

import * as net from "net";

const HOST = "localhost";
const PORT = 9876;

let requestId = 0;

function sendRequest(socket: net.Socket, method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const id = `req_${++requestId}`;
        const message = JSON.stringify({ id, type: "request", method, params });

        const onData = (data: Buffer) => {
            try {
                const response = JSON.parse(data.toString());
                if (response.id === id) {
                    socket.off("data", onData);
                    resolve(response.result);
                }
            } catch {
                // Not complete JSON yet
            }
        };

        socket.on("data", onData);
        socket.write(message);

        setTimeout(() => {
            socket.off("data", onData);
            reject(new Error(`Timeout: ${method}`));
        }, 10000);
    });
}

async function runTests() {
    const socket = new net.Socket();

    await new Promise<void>((resolve, reject) => {
        socket.on("connect", () => {
            console.log("✅ Connected to Godot");
            resolve();
        });
        socket.on("error", reject);
        socket.connect(PORT, HOST);
    });

    console.log("\n--- Testing Real Godot API Commands ---\n");

    // Test 1: Get Scene Tree
    console.log("1️⃣ Testing get_scene_tree...");
    const sceneTree = await sendRequest(socket, "get_scene_tree");
    console.log("   Result:", JSON.stringify(sceneTree, null, 2));

    // Test 2: Create Scene
    console.log("\n2️⃣ Testing create_scene...");
    const createResult = await sendRequest(socket, "create_scene", {
        path: "res://test_player.tscn",
        root_type: "CharacterBody2D"
    });
    console.log("   Result:", JSON.stringify(createResult, null, 2));

    // Test 3: Create Script
    console.log("\n3️⃣ Testing create_script...");
    const scriptContent = `extends CharacterBody2D

const SPEED = 300.0

func _physics_process(delta):
    var velocity = Vector2.ZERO
    if Input.is_action_pressed("ui_right"):
        velocity.x += 1
    if Input.is_action_pressed("ui_left"):
        velocity.x -= 1
    if Input.is_action_pressed("ui_down"):
        velocity.y += 1
    if Input.is_action_pressed("ui_up"):
        velocity.y -= 1
    
    velocity = velocity.normalized() * SPEED
    self.velocity = velocity
    move_and_slide()
`;
    const scriptResult = await sendRequest(socket, "create_script", {
        path: "res://test_player.gd",
        content: scriptContent
    });
    console.log("   Result:", JSON.stringify(scriptResult, null, 2));

    // Test 4: Add Node
    console.log("\n4️⃣ Testing add_node (to current scene)...");
    const addResult = await sendRequest(socket, "add_node", {
        parent: "",
        type: "Sprite2D",
        name: "TestSprite"
    });
    console.log("   Result:", JSON.stringify(addResult, null, 2));

    // Test 5: Get Scene Tree again (see the new node)
    console.log("\n5️⃣ Getting scene tree after add_node...");
    const sceneTree2 = await sendRequest(socket, "get_scene_tree");
    console.log("   Result:", JSON.stringify(sceneTree2, null, 2));

    console.log("\n✅ All tests completed!");
    socket.destroy();
}

runTests().catch(console.error);
