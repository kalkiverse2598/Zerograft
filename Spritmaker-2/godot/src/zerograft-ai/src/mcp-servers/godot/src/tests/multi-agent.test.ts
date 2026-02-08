/**
 * Multi-Agent System Integration Test
 * 
 * Tests the multi-agent routing and execution flow.
 */

import {
    MultiAgentSystem,
    MultiAgentCallbacks,
    MultiAgentConfig
} from '../agentic/multiAgentSystem.js';
import { ToolResult, createSuccessResult, ErrorCode } from '../agentic/types.js';

// Mock callbacks for testing
const createMockCallbacks = (): MultiAgentCallbacks => {
    const logs: string[] = [];

    return {
        executeTool: async (name: string, params: Record<string, unknown>): Promise<ToolResult> => {
            logs.push(`[TOOL] ${name}: ${JSON.stringify(params)}`);
            console.log(`[TOOL] ${name}`, params);

            // Simulate tool responses
            if (name === 'create_scene') {
                return createSuccessResult({ path: 'res://Game.tscn' }, 'Scene created');
            }
            if (name === 'add_node') {
                return createSuccessResult({ node_path: '/root/Player' }, 'Node added');
            }
            if (name.includes('spritemancer')) {
                return createSuccessResult({
                    character_id: 'knight-123',
                    frames: ['frame1.png', 'frame2.png']
                }, 'Character created');
            }

            return createSuccessResult({}, `${name} executed`);
        },

        sendToLLM: async (context: string, imageData?: string[]): Promise<string> => {
            logs.push(`[LLM] Context length: ${context.length}`);
            console.log(`[LLM] Received context of ${context.length} chars`);

            // Simulate orchestrator planning response
            return `Based on the request, I will:
1. Create the main game scene
2. Generate the knight character with SpriteMancer
3. Add the character to the scene
4. Verify the setup

Let me start by creating the scene structure.`;
        },

        onProgress: (message: string) => {
            logs.push(`[PROGRESS] ${message}`);
            console.log(`[PROGRESS] ${message}`);
        },

        requestApproval: async (operation: string, details: string): Promise<boolean> => {
            logs.push(`[APPROVAL] ${operation}: ${details}`);
            console.log(`[APPROVAL] ${operation}: ${details}`);
            return true; // Auto-approve in test
        }
    };
};

// Test the multi-agent system
async function runTest() {
    console.log('='.repeat(60));
    console.log('Multi-Agent System Integration Test');
    console.log('='.repeat(60));

    // Create the system
    const callbacks = createMockCallbacks();
    const config: Partial<MultiAgentConfig> = {
        enabled: true,
        maxParallelAgents: 4
    };

    console.log('\n1. Creating MultiAgentSystem...');
    const system = new MultiAgentSystem(callbacks, config);
    console.log('   ✓ System created');

    // Check agents are registered
    console.log('\n2. Checking registered agents...');
    const agents = system.getAllAgents();
    console.log(`   ✓ ${agents.length} agents registered:`);
    for (const agent of agents) {
        console.log(`     - ${agent.name} (${agent.role})`);
    }

    // Test a complex request
    console.log('\n3. Testing complex request...');
    const userRequest = 'Create a platformer with a knight character';
    console.log(`   Request: "${userRequest}"`);

    try {
        const result = await system.processRequest(userRequest);

        if (result.success) {
            console.log('\n   ✓ Request completed successfully!');
            console.log(`   Artifacts: ${result.artifacts.join(', ') || 'none'}`);
            console.log(`   Execution time: ${result.executionTime}ms`);
        } else {
            console.log('\n   ✗ Request failed');
            console.log(`   Error: ${result.error?.message}`);
        }
    } catch (error) {
        console.log('\n   ✗ Exception occurred');
        console.log(`   Error: ${error}`);
    }

    // Get orchestrator state
    console.log('\n4. Final orchestrator state:');
    console.log(`   FSM State: ${system.getOrchestratorState()}`);

    // Shutdown
    console.log('\n5. Shutting down...');
    system.shutdown();
    console.log('   ✓ System shutdown complete');

    console.log('\n' + '='.repeat(60));
    console.log('Test completed');
    console.log('='.repeat(60));
}

// Run test
runTest().catch(console.error);
