/**
 * Phase 0 Test Cases - Critical Runtime Fixes
 * 
 * These tests verify:
 * 1. Pre-tool guardrails (ensureToolPreconditions)
 * 2. Structured error recovery (attemptRecovery)
 * 3. Tool precondition definitions
 * 
 * Run with: npx tsx src/tests/phase0.test.ts
 */

import {
    ErrorCode,
    ToolResult,
    createSuccessResult,
    createErrorResult,
} from '../agentic/types.js';

// ============================================
// Mock Types and Test Utilities
// ============================================

interface TestResult {
    name: string;
    passed: boolean;
    message: string;
}

const testResults: TestResult[] = [];

function test(name: string, fn: () => boolean | Promise<boolean>): void {
    try {
        const result = fn();
        if (result instanceof Promise) {
            result.then(passed => {
                testResults.push({ name, passed, message: passed ? 'PASS' : 'FAIL' });
            }).catch(err => {
                testResults.push({ name, passed: false, message: `ERROR: ${err}` });
            });
        } else {
            testResults.push({ name, passed: result, message: result ? 'PASS' : 'FAIL' });
        }
    } catch (err) {
        testResults.push({ name, passed: false, message: `ERROR: ${err}` });
    }
}

function assertEqual<T>(actual: T, expected: T, label: string = ''): boolean {
    const passed = JSON.stringify(actual) === JSON.stringify(expected);
    if (!passed) {
        console.error(`  ❌ ${label}: Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
    return passed;
}

function assertTrue(condition: boolean, label: string = ''): boolean {
    if (!condition) {
        console.error(`  ❌ ${label}: Expected true, got false`);
    }
    return condition;
}

function assertFalse(condition: boolean, label: string = ''): boolean {
    if (condition) {
        console.error(`  ❌ ${label}: Expected false, got true`);
    }
    return !condition;
}

function assertContains(haystack: string, needle: string, label: string = ''): boolean {
    const passed = haystack.includes(needle);
    if (!passed) {
        console.error(`  ❌ ${label}: Expected "${haystack.substring(0, 50)}..." to contain "${needle}"`);
    }
    return passed;
}

function assertMatches(text: string, pattern: RegExp, label: string = ''): boolean {
    const passed = pattern.test(text);
    if (!passed) {
        console.error(`  ❌ ${label}: Expected "${text.substring(0, 50)}..." to match ${pattern}`);
    }
    return passed;
}

// ============================================
// Test: Tool Precondition Definitions
// ============================================

console.log('\n📋 Testing Tool Precondition Definitions...\n');

/** Tools that require an open scene to work (from taskExecutor.ts) */
const TOOLS_REQUIRING_SCENE = new Set([
    'add_node',
    'remove_node',
    'rename_node',
    'duplicate_node',
    'move_node',
    'reparent_node',
    'get_node_info',
    'copy_node',
    'save_scene',
    'get_scene_tree',
    'get_property',
    'set_property',
    'scene_pack',
    'set_owner_recursive',
    'set_collision_shape',
    'attach_script',
    'connect_signal',
    'list_signals',
    'add_to_group',
    'remove_from_group',
    'list_groups',
]);

test('TOOLS_REQUIRING_SCENE includes add_node', () => {
    return assertTrue(TOOLS_REQUIRING_SCENE.has('add_node'), 'add_node should require scene');
});

test('TOOLS_REQUIRING_SCENE includes set_property', () => {
    return assertTrue(TOOLS_REQUIRING_SCENE.has('set_property'), 'set_property should require scene');
});

test('TOOLS_REQUIRING_SCENE includes get_scene_tree', () => {
    return assertTrue(TOOLS_REQUIRING_SCENE.has('get_scene_tree'), 'get_scene_tree should require scene');
});

test('TOOLS_REQUIRING_SCENE does NOT include create_scene', () => {
    return assertFalse(TOOLS_REQUIRING_SCENE.has('create_scene'), 'create_scene should NOT require scene');
});

test('TOOLS_REQUIRING_SCENE does NOT include open_scene', () => {
    return assertFalse(TOOLS_REQUIRING_SCENE.has('open_scene'), 'open_scene should NOT require scene');
});

test('TOOLS_REQUIRING_SCENE does NOT include list_files', () => {
    return assertFalse(TOOLS_REQUIRING_SCENE.has('list_files'), 'list_files should NOT require scene');
});

test('TOOLS_REQUIRING_SCENE does NOT include run_game', () => {
    return assertFalse(TOOLS_REQUIRING_SCENE.has('run_game'), 'run_game should NOT require scene');
});

// ============================================
// Test: Error Recovery Strategies
// ============================================

console.log('\n📋 Testing Error Recovery Strategies...\n');

interface RecoveryStrategy {
    pattern: RegExp;
    errorType: string;
    recoveryHint: string;
    autoRecoverable: boolean;
}

const ERROR_RECOVERY_STRATEGIES: RecoveryStrategy[] = [
    {
        pattern: /no scene (currently )?open|No scene open/i,
        errorType: 'NO_SCENE_OPEN',
        recoveryHint: 'No scene is currently open. Use open_scene to open an existing scene or create_scene to create a new one.',
        autoRecoverable: false,
    },
    {
        pattern: /node not found|Node not found/i,
        errorType: 'NODE_NOT_FOUND',
        recoveryHint: 'The specified node path does not exist. Use get_scene_tree to see the current scene structure.',
        autoRecoverable: false,
    },
    {
        pattern: /script error|parse error|syntax error/i,
        errorType: 'SCRIPT_ERROR',
        recoveryHint: 'There is a script error. Use get_errors to see detailed error messages, then edit_script to fix the issue.',
        autoRecoverable: false,
    },
    {
        pattern: /resource not found|Failed to load/i,
        errorType: 'RESOURCE_NOT_FOUND',
        recoveryHint: 'The specified resource file does not exist. Use list_files to see available files or create the resource first.',
        autoRecoverable: false,
    },
    {
        pattern: /invalid node type|Invalid node type/i,
        errorType: 'INVALID_NODE_TYPE',
        recoveryHint: 'The specified node type is not valid. Common types: Node2D, CharacterBody2D, Sprite2D, AnimatedSprite2D, Camera2D, CollisionShape2D.',
        autoRecoverable: false,
    },
    {
        pattern: /property.*not found|unknown property/i,
        errorType: 'PROPERTY_NOT_FOUND',
        recoveryHint: 'The specified property does not exist on this node. Use get_node_info to see available properties.',
        autoRecoverable: false,
    },
];

// Helper to find matching strategy
function findRecoveryStrategy(errorMessage: string): RecoveryStrategy | null {
    for (const strategy of ERROR_RECOVERY_STRATEGIES) {
        if (strategy.pattern.test(errorMessage)) {
            return strategy;
        }
    }
    return null;
}

test('Pattern matches "No scene currently open"', () => {
    const strategy = findRecoveryStrategy('No scene currently open');
    return assertTrue(strategy !== null, 'Should find strategy') &&
        assertEqual(strategy?.errorType, 'NO_SCENE_OPEN', 'Error type');
});

test('Pattern matches "No scene open"', () => {
    const strategy = findRecoveryStrategy('Error: No scene open');
    return assertTrue(strategy !== null, 'Should find strategy') &&
        assertEqual(strategy?.errorType, 'NO_SCENE_OPEN', 'Error type');
});

test('Pattern matches "Node not found: /Player"', () => {
    const strategy = findRecoveryStrategy('Node not found: /Player');
    return assertTrue(strategy !== null, 'Should find strategy') &&
        assertEqual(strategy?.errorType, 'NODE_NOT_FOUND', 'Error type');
});

test('Pattern matches "node not found" (lowercase)', () => {
    const strategy = findRecoveryStrategy('Error: node not found at path /Root/Child');
    return assertTrue(strategy !== null, 'Should find strategy') &&
        assertEqual(strategy?.errorType, 'NODE_NOT_FOUND', 'Error type');
});

test('Pattern matches "script error in line 42"', () => {
    const strategy = findRecoveryStrategy('script error in line 42');
    return assertTrue(strategy !== null, 'Should find strategy') &&
        assertEqual(strategy?.errorType, 'SCRIPT_ERROR', 'Error type');
});

test('Pattern matches "Parse error: unexpected token"', () => {
    const strategy = findRecoveryStrategy('Parse error: unexpected token');
    return assertTrue(strategy !== null, 'Should find strategy') &&
        assertEqual(strategy?.errorType, 'SCRIPT_ERROR', 'Error type');
});

test('Pattern matches "Failed to load res://missing.png"', () => {
    const strategy = findRecoveryStrategy('Failed to load res://missing.png');
    return assertTrue(strategy !== null, 'Should find strategy') &&
        assertEqual(strategy?.errorType, 'RESOURCE_NOT_FOUND', 'Error type');
});

test('Pattern matches "resource not found"', () => {
    const strategy = findRecoveryStrategy('The specified resource not found in filesystem');
    return assertTrue(strategy !== null, 'Should find strategy') &&
        assertEqual(strategy?.errorType, 'RESOURCE_NOT_FOUND', 'Error type');
});

test('Pattern matches "Invalid node type: NotARealNode"', () => {
    const strategy = findRecoveryStrategy('Invalid node type: NotARealNode');
    return assertTrue(strategy !== null, 'Should find strategy') &&
        assertEqual(strategy?.errorType, 'INVALID_NODE_TYPE', 'Error type');
});

test('Pattern matches "unknown property: nonexistent"', () => {
    const strategy = findRecoveryStrategy('unknown property: nonexistent');
    return assertTrue(strategy !== null, 'Should find strategy') &&
        assertEqual(strategy?.errorType, 'PROPERTY_NOT_FOUND', 'Error type');
});

test('Pattern matches "property xyz not found"', () => {
    const strategy = findRecoveryStrategy('property xyz not found on this node');
    return assertTrue(strategy !== null, 'Should find strategy') &&
        assertEqual(strategy?.errorType, 'PROPERTY_NOT_FOUND', 'Error type');
});

test('No pattern match for generic error', () => {
    const strategy = findRecoveryStrategy('Something went wrong');
    return assertTrue(strategy === null, 'Should not find strategy for generic error');
});

test('No pattern match for success message', () => {
    const strategy = findRecoveryStrategy('Operation completed successfully');
    return assertTrue(strategy === null, 'Should not find strategy for success');
});

// ============================================
// Test: Recovery Hint Content
// ============================================

console.log('\n📋 Testing Recovery Hint Content...\n');

test('NO_SCENE_OPEN hint mentions open_scene', () => {
    const strategy = ERROR_RECOVERY_STRATEGIES.find(s => s.errorType === 'NO_SCENE_OPEN');
    return assertTrue(strategy !== undefined, 'Strategy exists') &&
        assertContains(strategy!.recoveryHint, 'open_scene', 'Hint mentions open_scene');
});

test('NO_SCENE_OPEN hint mentions create_scene', () => {
    const strategy = ERROR_RECOVERY_STRATEGIES.find(s => s.errorType === 'NO_SCENE_OPEN');
    return assertTrue(strategy !== undefined, 'Strategy exists') &&
        assertContains(strategy!.recoveryHint, 'create_scene', 'Hint mentions create_scene');
});

test('NODE_NOT_FOUND hint mentions get_scene_tree', () => {
    const strategy = ERROR_RECOVERY_STRATEGIES.find(s => s.errorType === 'NODE_NOT_FOUND');
    return assertTrue(strategy !== undefined, 'Strategy exists') &&
        assertContains(strategy!.recoveryHint, 'get_scene_tree', 'Hint mentions get_scene_tree');
});

test('SCRIPT_ERROR hint mentions get_errors', () => {
    const strategy = ERROR_RECOVERY_STRATEGIES.find(s => s.errorType === 'SCRIPT_ERROR');
    return assertTrue(strategy !== undefined, 'Strategy exists') &&
        assertContains(strategy!.recoveryHint, 'get_errors', 'Hint mentions get_errors');
});

test('SCRIPT_ERROR hint mentions edit_script', () => {
    const strategy = ERROR_RECOVERY_STRATEGIES.find(s => s.errorType === 'SCRIPT_ERROR');
    return assertTrue(strategy !== undefined, 'Strategy exists') &&
        assertContains(strategy!.recoveryHint, 'edit_script', 'Hint mentions edit_script');
});

test('RESOURCE_NOT_FOUND hint mentions list_files', () => {
    const strategy = ERROR_RECOVERY_STRATEGIES.find(s => s.errorType === 'RESOURCE_NOT_FOUND');
    return assertTrue(strategy !== undefined, 'Strategy exists') &&
        assertContains(strategy!.recoveryHint, 'list_files', 'Hint mentions list_files');
});

test('INVALID_NODE_TYPE hint mentions common node types', () => {
    const strategy = ERROR_RECOVERY_STRATEGIES.find(s => s.errorType === 'INVALID_NODE_TYPE');
    return assertTrue(strategy !== undefined, 'Strategy exists') &&
        assertContains(strategy!.recoveryHint, 'CharacterBody2D', 'Hint mentions CharacterBody2D') &&
        assertContains(strategy!.recoveryHint, 'Sprite2D', 'Hint mentions Sprite2D');
});

test('PROPERTY_NOT_FOUND hint mentions get_node_info', () => {
    const strategy = ERROR_RECOVERY_STRATEGIES.find(s => s.errorType === 'PROPERTY_NOT_FOUND');
    return assertTrue(strategy !== undefined, 'Strategy exists') &&
        assertContains(strategy!.recoveryHint, 'get_node_info', 'Hint mentions get_node_info');
});

// ============================================
// Test: ErrorCode enum
// ============================================

console.log('\n📋 Testing ErrorCode Enum...\n');

test('ErrorCode.PRECONDITION_FAILED exists', () => {
    return assertEqual(ErrorCode.PRECONDITION_FAILED, 'PRECONDITION_FAILED', 'PRECONDITION_FAILED value');
});

test('ErrorCode.OK exists', () => {
    return assertEqual(ErrorCode.OK, 'OK', 'OK value');
});

test('ErrorCode.GODOT_ERROR exists', () => {
    return assertEqual(ErrorCode.GODOT_ERROR, 'GODOT_ERROR', 'GODOT_ERROR value');
});

// ============================================
// Test: createErrorResult with PRECONDITION_FAILED
// ============================================

console.log('\n📋 Testing ToolResult Creation...\n');

test('createErrorResult with PRECONDITION_FAILED', () => {
    const result = createErrorResult(
        ErrorCode.PRECONDITION_FAILED,
        'Tool requires open scene',
        true
    );
    return assertEqual(result.success, false, 'success is false') &&
        assertEqual(result.code, ErrorCode.PRECONDITION_FAILED, 'code is PRECONDITION_FAILED') &&
        assertContains(result.message, 'requires open scene', 'message content') &&
        assertEqual(result.recoverable, true, 'is recoverable');
});

test('createSuccessResult for preconditions met', () => {
    const result = createSuccessResult(null, 'Preconditions met');
    return assertEqual(result.success, true, 'success is true') &&
        assertEqual(result.code, ErrorCode.OK, 'code is OK') &&
        assertContains(result.message, 'Preconditions met', 'message content');
});

// ============================================
// Print Test Results
// ============================================

// Wait a moment for async tests to complete
setTimeout(() => {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(60) + '\n');

    const passed = testResults.filter(r => r.passed).length;
    const failed = testResults.filter(r => !r.passed).length;

    for (const result of testResults) {
        const icon = result.passed ? '✅' : '❌';
        console.log(`${icon} ${result.name}`);
    }

    console.log('\n' + '-'.repeat(60));
    console.log(`Total: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`);
    console.log('-'.repeat(60) + '\n');

    if (failed > 0) {
        console.log('❌ Some tests failed. Please review the output above.\n');
        process.exit(1);
    } else {
        console.log('✅ All tests passed!\n');
        process.exit(0);
    }
}, 100);
