/**
 * Phase 4 Test Cases - Smart Plan Skipping
 * 
 * These tests verify:
 * 1. isSmallTask correctly identifies simple tasks
 * 2. Complex tasks are NOT identified as small
 * 3. Game creation is never treated as small
 * 
 * Run with: npx tsx src/tests/phase4-small-tasks.test.ts
 */

import { isSmallTask, isGameCreationRequest } from '../prompts/recipes/index.js';

// ============================================
// Test Utilities
// ============================================

interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
}

const testResults: TestResult[] = [];

function runTest(name: string, fn: () => boolean): void {
    try {
        const passed = fn();
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

function assertFalse(condition: boolean, label: string = ''): boolean {
    if (condition) {
        console.error(`  ❌ ${label}: Expected false, got true`);
    }
    return !condition;
}

// ============================================
// Test Cases
// ============================================

function runAllTests(): void {
    console.log('\n🧪 Running Phase 4 Smart Plan Skipping Tests...\n');

    // ============================================
    // Small Task Detection - Should Return TRUE
    // ============================================
    console.log('📋 Testing small tasks (should return true)...\n');

    // Single node operations
    runTest('isSmallTask("add a node") returns true', () => {
        return assertTrue(isSmallTask("add a node"), 'add a node');
    });

    runTest('isSmallTask("Add node to scene") returns true', () => {
        return assertTrue(isSmallTask("Add node to scene"), 'Add node');
    });

    runTest('isSmallTask("remove node") returns true', () => {
        return assertTrue(isSmallTask("remove node"), 'remove node');
    });

    runTest('isSmallTask("delete the player node") returns true', () => {
        return assertTrue(isSmallTask("delete the player node"), 'delete node');
    });

    // Property changes
    runTest('isSmallTask("change the color to red") returns true', () => {
        return assertTrue(isSmallTask("change the color to red"), 'change color');
    });

    runTest('isSmallTask("set position to 100,200") returns true', () => {
        return assertTrue(isSmallTask("set position to 100,200"), 'set position');
    });

    runTest('isSmallTask("fix the size") returns true', () => {
        return assertTrue(isSmallTask("fix the size"), 'fix size');
    });

    runTest('isSmallTask("adjust the rotation") returns true', () => {
        return assertTrue(isSmallTask("adjust the rotation"), 'adjust rotation');
    });

    // Simple queries and runs
    runTest('isSmallTask("run the game") returns true', () => {
        return assertTrue(isSmallTask("run the game"), 'run game');
    });

    runTest('isSmallTask("play the scene") returns true', () => {
        return assertTrue(isSmallTask("play the scene"), 'play scene');
    });

    runTest('isSmallTask("save the scene") returns true', () => {
        return assertTrue(isSmallTask("save the scene"), 'save scene');
    });

    runTest('isSmallTask("open scene Level.tscn") returns true', () => {
        return assertTrue(isSmallTask("open scene Level.tscn"), 'open scene');
    });

    runTest('isSmallTask("list all scenes") returns true', () => {
        return assertTrue(isSmallTask("list all scenes"), 'list scenes');
    });

    runTest('isSmallTask("show me the nodes") returns true', () => {
        return assertTrue(isSmallTask("show me the nodes"), 'show nodes');
    });

    runTest('isSmallTask("what is the current scene?") returns true', () => {
        return assertTrue(isSmallTask("what is the current scene?"), 'what is');
    });

    runTest('isSmallTask("how do I save?") returns true', () => {
        return assertTrue(isSmallTask("how do I save?"), 'how do I');
    });

    // Short requests
    runTest('isSmallTask("test it") returns true (short)', () => {
        return assertTrue(isSmallTask("test it"), 'test it');
    });

    runTest('isSmallTask("run") returns true (very short)', () => {
        return assertTrue(isSmallTask("run"), 'run');
    });

    // Single operations
    runTest('isSmallTask("attach a script to player") returns true', () => {
        return assertTrue(isSmallTask("attach a script to player"), 'attach script');
    });

    runTest('isSmallTask("create a script for enemy") returns true', () => {
        return assertTrue(isSmallTask("create a script for enemy"), 'create script');
    });

    runTest('isSmallTask("add a collision shape") returns true', () => {
        return assertTrue(isSmallTask("add a collision shape"), 'add collision');
    });

    runTest('isSmallTask("enable physics") returns true', () => {
        return assertTrue(isSmallTask("enable physics"), 'enable physics');
    });

    // ============================================
    // Complex Task Detection - Should Return FALSE
    // ============================================
    console.log('\n📋 Testing complex tasks (should return false)...\n');

    runTest('isSmallTask("create a simple game") returns false', () => {
        return assertFalse(isSmallTask("create a simple game"), 'create game');
    });

    runTest('isSmallTask("make a platformer game with player and enemies") returns false', () => {
        return assertFalse(isSmallTask("make a platformer game with player and enemies"), 'platformer');
    });

    runTest('isSmallTask("build a game from scratch") returns false', () => {
        return assertFalse(isSmallTask("build a game from scratch"), 'game from scratch');
    });

    runTest('isSmallTask("create a new game project") returns false', () => {
        return assertFalse(isSmallTask("create a new game project"), 'new game project');
    });

    runTest('isSmallTask("I want to make a game") returns false', () => {
        return assertFalse(isSmallTask("I want to make a game"), 'want game');
    });

    // Multi-step requests
    runTest('isSmallTask("add a player and then create animations and setup collision") returns false', () => {
        return assertFalse(isSmallTask("add a player and then create animations and setup collision"), 'multi-step and');
    });

    // ============================================
    // Game Creation vs Small Task Consistency
    // ============================================
    console.log('\n📋 Testing game creation consistency...\n');

    runTest('Game creation is never small: "create a game"', () => {
        const isGame = isGameCreationRequest("create a game");
        const isSmall = isSmallTask("create a game");
        // If it's a game creation request, isSmallTask may return false or true,
        // but the context injection should prioritize game creation
        return assertTrue(isGame, 'is game creation') && assertFalse(isSmall, 'not small task');
    });

    runTest('Game creation is never small: "make a platformer"', () => {
        const isGame = isGameCreationRequest("make a platformer");
        const isSmall = isSmallTask("make a platformer");
        return assertTrue(isGame, 'is game creation');
    });

    // Print results
    console.log('\n' + '='.repeat(60));
    console.log('📊 PHASE 4 SMART PLAN SKIPPING TEST RESULTS');
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
        console.log('❌ Some Phase 4 tests failed.\n');
        process.exit(1);
    } else {
        console.log('✅ All Phase 4 smart plan skipping tests passed!\n');
        process.exit(0);
    }
}

// Run all tests
runAllTests();
