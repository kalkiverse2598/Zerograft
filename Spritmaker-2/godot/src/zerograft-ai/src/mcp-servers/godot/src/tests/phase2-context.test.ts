/**
 * Phase 2 Test Cases - Auto-Context Enhancement
 * 
 * These tests verify:
 * 1. getRelevantRecipeContext injects recipes correctly
 * 2. gatherProjectContext gathers project state
 * 3. startTask injects context into conversation history
 * 4. buildContextString includes plan status
 * 
 * Run with: npx tsx src/tests/phase2-context.test.ts
 */

import { TaskExecutor, TaskCallbacks, LLMResponse } from '../agentic/taskExecutor.js';
import {
    TaskState,
    ErrorCode,
    ToolCall,
    AttemptCompletionParams,
    AskFollowupParams,
} from '../agentic/types.js';

// ============================================
// Test Utilities
// ============================================

interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
}

const testResults: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<boolean>): Promise<void> {
    try {
        const passed = await fn();
        testResults.push({ name, passed });
    } catch (err) {
        testResults.push({ name, passed: false, error: String(err) });
    }
}

function assertTrue(condition: boolean, label: string = ''): boolean {
    if (!condition) {
        console.error(`  ❌ ${label}: Expected true, got false`);
    }
    return condition;
}

function assertContains(haystack: string, needle: string, label: string = ''): boolean {
    const passed = haystack.includes(needle);
    if (!passed) {
        console.error(`  ❌ ${label}: Expected to contain "${needle}"`);
    }
    return passed;
}

// ============================================
// Mock Callbacks Factory
// ============================================

interface MockState {
    toolExecutions: Array<{ name: string; params: Record<string, unknown>; result: unknown }>;
    llmCalls: string[];
    progress: string[];
    completions: AttemptCompletionParams[];
    hasOpenScene: boolean;
    existingScenes: string[];
    mainScene: string;
    spritemancerRunning: boolean;
}

function createMockCallbacks(state: MockState): TaskCallbacks {
    return {
        executeTool: async (name: string, params: Record<string, unknown>) => {
            // Simulate get_scene_tree response
            if (name === 'get_scene_tree') {
                if (state.hasOpenScene) {
                    const result = {
                        success: true,
                        name: 'TestScene',
                        type: 'Node2D',
                        path: '/root/TestScene',
                        children: [
                            { name: 'Player', type: 'CharacterBody2D' },
                            { name: 'Camera2D', type: 'Camera2D' },
                        ],
                    };
                    state.toolExecutions.push({ name, params, result });
                    return result;
                } else {
                    const result = { success: false, error: 'No scene currently open' };
                    state.toolExecutions.push({ name, params, result });
                    return result;
                }
            }

            // Simulate list_scenes response
            if (name === 'list_scenes') {
                const result = { scenes: state.existingScenes };
                state.toolExecutions.push({ name, params, result });
                return result;
            }

            // Simulate get_project_setting response
            if (name === 'get_project_setting') {
                const result = { value: state.mainScene || '' };
                state.toolExecutions.push({ name, params, result });
                return result;
            }

            // Simulate spritemancer_status response
            if (name === 'spritemancer_status') {
                const result = { running: state.spritemancerRunning };
                state.toolExecutions.push({ name, params, result });
                return result;
            }

            // Default response
            const result = { success: true, message: `${name} executed` };
            state.toolExecutions.push({ name, params, result });
            return result;
        },

        sendToLLM: async (context: string, _imageData?: string[]) => {
            state.llmCalls.push(context);
            // Return completion immediately
            return {
                text: 'Task completed',
                toolCalls: [{
                    id: 'completion-1',
                    name: 'attempt_completion',
                    params: { result: 'Done' },
                    timestamp: Date.now(),
                }],
            };
        },

        requestApproval: async (_tool: ToolCall) => true,
        showDiff: async (_tool: ToolCall, _before: string, _after: string) => { },
        askUser: async (_params: AskFollowupParams) => null,
        onProgress: (message: string) => { state.progress.push(message); },
        onStateChange: (_state: TaskState) => { },
        onComplete: (result: AttemptCompletionParams) => { state.completions.push(result); },
        onError: (_error: string) => { },
        getTokenCount: (context: string) => context.length / 4,
        summarizeContext: async (context: string) => `Summary: ${context.substring(0, 100)}...`,
    };
}

// ============================================
// Test Cases
// ============================================

async function runAllTests(): Promise<void> {
    console.log('\n🧪 Running Phase 2 Auto-Context Enhancement Tests...\n');

    // Test 1: Context gathering is called at task start
    await runTest('startTask calls gatherProjectContext', async () => {
        const state: MockState = {
            toolExecutions: [],
            llmCalls: [],
            progress: [],
            completions: [],
            hasOpenScene: true,
            existingScenes: ['res://scenes/Level.tscn', 'res://scenes/Player.tscn'],
            mainScene: 'res://scenes/Level.tscn',
            spritemancerRunning: true,
        };

        const callbacks = createMockCallbacks(state);
        const executor = new TaskExecutor(callbacks);

        await executor.startTask('Create a simple game');

        // Should show "Analyzing project state..." progress
        const hasAnalyzing = state.progress.some(p => p.includes('Analyzing project state'));

        // Should have called context-gathering tools
        const toolNames = state.toolExecutions.map(e => e.name);
        const hasSceneTree = toolNames.includes('get_scene_tree');
        const hasListScenes = toolNames.includes('list_scenes');
        const hasSpritemancer = toolNames.includes('spritemancer_status');

        return assertTrue(hasAnalyzing, 'Shows analyzing progress') &&
            assertTrue(hasSceneTree, 'Calls get_scene_tree') &&
            assertTrue(hasListScenes, 'Calls list_scenes') &&
            assertTrue(hasSpritemancer, 'Calls spritemancer_status');
    });

    // Test 2: Project context is injected into LLM context
    await runTest('Project context appears in LLM context', async () => {
        const state: MockState = {
            toolExecutions: [],
            llmCalls: [],
            progress: [],
            completions: [],
            hasOpenScene: true,
            existingScenes: ['res://scenes/Level.tscn'],
            mainScene: 'res://scenes/Level.tscn',
            spritemancerRunning: true,
        };

        const callbacks = createMockCallbacks(state);
        const executor = new TaskExecutor(callbacks);

        await executor.startTask('Create a game');

        // Check the LLM received context
        const context = state.llmCalls[0] || '';

        return assertContains(context, 'PROJECT STATE', 'Contains PROJECT STATE header') &&
            assertContains(context, 'TestScene', 'Contains current scene name') &&
            assertContains(context, 'SpriteMancer', 'Contains SpriteMancer status');
    });

    // Test 3: Recipe context is injected for game creation
    await runTest('Game creation request gets simple_game_workflow recipe', async () => {
        const state: MockState = {
            toolExecutions: [],
            llmCalls: [],
            progress: [],
            completions: [],
            hasOpenScene: false,
            existingScenes: [],
            mainScene: '',
            spritemancerRunning: false,
        };

        const callbacks = createMockCallbacks(state);
        const executor = new TaskExecutor(callbacks);

        await executor.startTask('Create a simple platformer game');

        // Check the LLM received the game workflow recipe
        const context = state.llmCalls[0] || '';

        return assertContains(context, 'RELEVANT GUIDE', 'Contains RELEVANT GUIDE header') &&
            assertContains(context, 'simple_game_workflow', 'Contains recipe name') &&
            (assertContains(context, 'PHASE A', 'Contains Phase A') ||
                assertContains(context, 'SpriteMancer', 'Contains SpriteMancer mention'));
    });

    // Test 4: Non-game requests get appropriate guidance (recipe or small task skip)
    await runTest('Camera setup request gets appropriate guidance', async () => {
        const state: MockState = {
            toolExecutions: [],
            llmCalls: [],
            progress: [],
            completions: [],
            hasOpenScene: true,
            existingScenes: ['res://scenes/Level.tscn'],
            mainScene: 'res://scenes/Level.tscn',
            spritemancerRunning: false,
        };

        const callbacks = createMockCallbacks(state);
        const executor = new TaskExecutor(callbacks);

        await executor.startTask('How do I set up a camera?');

        const context = state.llmCalls[0] || '';

        // Should contain either:
        // 1. TASK GUIDANCE for small task (Phase 4 behavior)
        // 2. OR camera-related recipe (original behavior)
        const hasSkipPlanGuidance = context.includes('TASK GUIDANCE') || context.includes('SMALL TASK');
        const hasCameraRecipe = context.includes('RELEVANT GUIDE') && context.includes('camera');

        return assertTrue(hasSkipPlanGuidance || hasCameraRecipe, 'Has skip-plan guidance OR camera recipe');
    });

    // Test 5: No scene shows appropriate message
    await runTest('No scene open is reflected in context', async () => {
        const state: MockState = {
            toolExecutions: [],
            llmCalls: [],
            progress: [],
            completions: [],
            hasOpenScene: false,
            existingScenes: [],
            mainScene: '',
            spritemancerRunning: false,
        };

        const callbacks = createMockCallbacks(state);
        const executor = new TaskExecutor(callbacks);

        await executor.startTask('Add a player node');

        const context = state.llmCalls[0] || '';

        return assertContains(context, 'No scene currently open', 'Mentions no scene open') ||
            assertContains(context, 'no scene', 'Mentions no scene in lowercase');
    });

    // Test 6: SpriteMancer status is checked
    await runTest('SpriteMancer status appears in context', async () => {
        const state: MockState = {
            toolExecutions: [],
            llmCalls: [],
            progress: [],
            completions: [],
            hasOpenScene: true,
            existingScenes: [],
            mainScene: '',
            spritemancerRunning: true,
        };

        const callbacks = createMockCallbacks(state);
        const executor = new TaskExecutor(callbacks);

        await executor.startTask('Create a character');

        const context = state.llmCalls[0] || '';

        // Should mention SpriteMancer availability
        return assertContains(context, 'SpriteMancer', 'Mentions SpriteMancer') &&
            (assertContains(context, 'Available', 'Shows SpriteMancer available') ||
                assertContains(context, '✅', 'Has checkmark'));
    });

    // Test 7: Existing scenes are listed
    await runTest('Existing project scenes are listed', async () => {
        const state: MockState = {
            toolExecutions: [],
            llmCalls: [],
            progress: [],
            completions: [],
            hasOpenScene: false,
            existingScenes: ['res://scenes/Player.tscn', 'res://scenes/Level.tscn', 'res://scenes/Enemy.tscn'],
            mainScene: 'res://scenes/Level.tscn',
            spritemancerRunning: false,
        };

        const callbacks = createMockCallbacks(state);
        const executor = new TaskExecutor(callbacks);

        await executor.startTask('What scenes do I have?');

        const context = state.llmCalls[0] || '';

        return assertContains(context, 'Player.tscn', 'Lists Player scene') &&
            assertContains(context, 'Level.tscn', 'Lists Level scene');
    });

    // Test 8: Main scene setting is shown
    await runTest('Main scene setting appears in context', async () => {
        const state: MockState = {
            toolExecutions: [],
            llmCalls: [],
            progress: [],
            completions: [],
            hasOpenScene: true,
            existingScenes: ['res://scenes/Level.tscn'],
            mainScene: 'res://scenes/Level.tscn',
            spritemancerRunning: false,
        };

        const callbacks = createMockCallbacks(state);
        const executor = new TaskExecutor(callbacks);

        await executor.startTask('Run my game');

        const context = state.llmCalls[0] || '';

        return assertContains(context, 'Main scene', 'Mentions main scene') &&
            assertContains(context, 'Level.tscn', 'Shows main scene path');
    });

    // Print results
    console.log('\n' + '='.repeat(60));
    console.log('📊 PHASE 2 AUTO-CONTEXT TEST RESULTS');
    console.log('='.repeat(60) + '\n');

    const passed = testResults.filter(r => r.passed).length;
    const failed = testResults.filter(r => !r.passed).length;

    for (const result of testResults) {
        const icon = result.passed ? '✅' : '❌';
        console.log(`${icon} ${result.name}`);
        if (result.error) {
            console.log(`   Error: ${result.error}`);
        }
    }

    console.log('\n' + '-'.repeat(60));
    console.log(`Total: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`);
    console.log('-'.repeat(60) + '\n');

    if (failed > 0) {
        console.log('❌ Some Phase 2 tests failed.\n');
        process.exit(1);
    } else {
        console.log('✅ All Phase 2 auto-context tests passed!\n');
        process.exit(0);
    }
}

// Run all tests
runAllTests().catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
});
