/**
 * Godot MCP Server
 * 
 * Provides MCP tools for controlling Godot engine:
 * - Scene operations (create, add nodes, etc.)
 * - Script operations (create, edit GDScript)
 * - Property operations (get/set node properties)
 * - Game control (run, stop)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { GodotBridge } from "./godotBridge.js";

const server = new Server(
  {
    name: "godot-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const bridge = new GodotBridge();

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "godot_create_scene",
        description: "Create a new Godot scene file",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Scene file path (e.g., res://scenes/Player.tscn)" },
            rootType: { type: "string", description: "Root node type (e.g., Node2D, CharacterBody2D)" },
          },
          required: ["path", "rootType"],
        },
      },
      {
        name: "godot_add_node",
        description: "Add a node to the current scene",
        inputSchema: {
          type: "object",
          properties: {
            parent: { type: "string", description: "Parent node path" },
            type: { type: "string", description: "Node type to add" },
            name: { type: "string", description: "Name for the new node" },
          },
          required: ["parent", "type", "name"],
        },
      },
      {
        name: "godot_create_script",
        description: "Create a new GDScript file",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Script file path" },
            content: { type: "string", description: "GDScript content" },
          },
          required: ["path", "content"],
        },
      },
      {
        name: "godot_set_property",
        description: "Set a property on a node",
        inputSchema: {
          type: "object",
          properties: {
            node: { type: "string", description: "Node path" },
            property: { type: "string", description: "Property name" },
            value: { description: "Property value" },
          },
          required: ["node", "property", "value"],
        },
      },
      {
        name: "godot_run_game",
        description: "Run the game in Godot",
        inputSchema: {
          type: "object",
          properties: {
            scene: { type: "string", description: "Optional scene to run" },
          },
        },
      },
      {
        name: "godot_stop_game",
        description: "Stop the running game",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "godot_get_scene_tree",
        description: "Get the current scene tree structure",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const typedArgs = (args ?? {}) as Record<string, unknown>;

  try {
    switch (name) {
      case "godot_create_scene":
        await bridge.createScene(typedArgs.path as string, typedArgs.rootType as string);
        return { content: [{ type: "text", text: `Created scene: ${typedArgs.path}` }] };

      case "godot_add_node":
        await bridge.addNode(typedArgs.parent as string, typedArgs.type as string, typedArgs.name as string);
        return { content: [{ type: "text", text: `Added ${typedArgs.type} node: ${typedArgs.name}` }] };

      case "godot_create_script":
        await bridge.createScript(typedArgs.path as string, typedArgs.content as string);
        return { content: [{ type: "text", text: `Created script: ${typedArgs.path}` }] };

      case "godot_set_property":
        await bridge.setProperty(typedArgs.node as string, typedArgs.property as string, typedArgs.value);
        return { content: [{ type: "text", text: `Set ${typedArgs.property} on ${typedArgs.node}` }] };

      case "godot_run_game":
        await bridge.runGame(typedArgs.scene as string | undefined);
        return { content: [{ type: "text", text: "Game started" }] };

      case "godot_stop_game":
        await bridge.stopGame();
        return { content: [{ type: "text", text: "Game stopped" }] };

      case "godot_get_scene_tree":
        const tree = await bridge.getSceneTree();
        return { content: [{ type: "text", text: JSON.stringify(tree, null, 2) }] };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  await bridge.connect();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Godot MCP Server running");
}

main().catch(console.error);
