/**
 * SpriteMancer MCP Server
 * 
 * Provides MCP tools for AI sprite generation:
 * - Generate characters
 * - Generate animations
 * - Extract DNA
 * - Generate normal maps
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { SpriteMancerClient } from "./client.js";

const server = new Server(
    {
        name: "spritemancer-mcp-server",
        version: "0.1.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

const client = new SpriteMancerClient();

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "spritemancer_generate_character",
                description: "Generate a pixel art character sprite using AI",
                inputSchema: {
                    type: "object",
                    properties: {
                        prompt: { type: "string", description: "Character description (e.g., 'knight with sword and shield')" },
                        style: { type: "string", enum: ["16x16", "32x32", "64x64"], description: "Sprite size" },
                        perspective: { type: "string", enum: ["side", "top-down", "isometric"], description: "View perspective" },
                    },
                    required: ["prompt"],
                },
            },
            {
                name: "spritemancer_generate_animation",
                description: "Generate animation frames for a character",
                inputSchema: {
                    type: "object",
                    properties: {
                        characterId: { type: "string", description: "ID of the generated character" },
                        animation: { type: "string", description: "Animation type (e.g., 'walk', 'attack', 'idle')" },
                        frameCount: { type: "number", description: "Number of frames" },
                    },
                    required: ["characterId", "animation"],
                },
            },
            {
                name: "spritemancer_extract_dna",
                description: "Extract DNA (pose, colors, style) from a generated character for consistency",
                inputSchema: {
                    type: "object",
                    properties: {
                        characterId: { type: "string", description: "ID of the character" },
                    },
                    required: ["characterId"],
                },
            },
            {
                name: "spritemancer_generate_normal_map",
                description: "Generate normal map for a sprite for 2D lighting effects",
                inputSchema: {
                    type: "object",
                    properties: {
                        spriteId: { type: "string", description: "ID of the sprite" },
                    },
                    required: ["spriteId"],
                },
            },
            {
                name: "spritemancer_export_spritesheet",
                description: "Export animation frames as a spritesheet",
                inputSchema: {
                    type: "object",
                    properties: {
                        characterId: { type: "string", description: "Character ID" },
                        animations: { type: "array", items: { type: "string" }, description: "Animation names to include" },
                        outputPath: { type: "string", description: "Output path in Godot project (res://...)" },
                    },
                    required: ["characterId", "outputPath"],
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
            case "spritemancer_generate_character": {
                const result = await client.generateCharacter(
                    typedArgs.prompt as string,
                    typedArgs.style as string | undefined,
                    typedArgs.perspective as string | undefined
                );
                return { content: [{ type: "text", text: `Generated character: ${result.id}\nPreview: ${result.previewUrl}` }] };
            }

            case "spritemancer_generate_animation": {
                const result = await client.generateAnimation(
                    typedArgs.characterId as string,
                    typedArgs.animation as string,
                    typedArgs.frameCount as number | undefined
                );
                return { content: [{ type: "text", text: `Generated ${result.frameCount} frames for ${typedArgs.animation}` }] };
            }

            case "spritemancer_extract_dna": {
                const dna = await client.extractDNA(typedArgs.characterId as string);
                return { content: [{ type: "text", text: `DNA extracted:\n${JSON.stringify(dna, null, 2)}` }] };
            }

            case "spritemancer_generate_normal_map": {
                const result = await client.generateNormalMap(typedArgs.spriteId as string);
                return { content: [{ type: "text", text: `Normal map generated: ${result.path}` }] };
            }

            case "spritemancer_export_spritesheet": {
                const result = await client.exportSpritesheet(
                    typedArgs.characterId as string,
                    typedArgs.animations as string[] | undefined,
                    typedArgs.outputPath as string
                );
                return { content: [{ type: "text", text: `Spritesheet exported to: ${result.path}` }] };
            }

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
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("SpriteMancer MCP Server running");
}

main().catch(console.error);
