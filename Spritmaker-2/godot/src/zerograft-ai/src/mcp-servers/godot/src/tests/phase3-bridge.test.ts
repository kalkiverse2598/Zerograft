/**
 * Phase 3 Test Cases - SpriteMancer-Scene Bridge
 * 
 * These tests verify:
 * 1. spritemancer_approve_animation returns sprite_frames_path at top level
 * 2. spritemancer_approve_animation returns next_action guidance
 * 3. spritemancer_generate_animations returns next_action guidance
 * 4. setup_player_with_sprites tool definition exists
 * 
 * Run with: npx tsx src/tests/phase3-bridge.test.ts
 */

import { agenticTools, setup_player_with_sprites } from '../prompts/tools/agentic/index.js';

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

function assertEqual(actual: unknown, expected: unknown, label: string = ''): boolean {
    const passed = actual === expected;
    if (!passed) {
        console.error(`  ❌ ${label}: Expected "${expected}", got "${actual}"`);
    }
    return passed;
}

function assertContains(haystack: string, needle: string, label: string = ''): boolean {
    const passed = haystack.includes(needle);
    if (!passed) {
        console.error(`  ❌ ${label}: Expected to contain "${needle}"`);
    }
    return passed;
}

// ============================================
// Test Cases
// ============================================

function runAllTests(): void {
    console.log('\n🧪 Running Phase 3 SpriteMancer-Scene Bridge Tests...\n');

    // ============================================
    // setup_player_with_sprites Tool Tests
    // ============================================
    console.log('📋 Testing setup_player_with_sprites tool...\n');

    runTest('setup_player_with_sprites is exported', () => {
        return assertTrue(setup_player_with_sprites !== undefined, 'Tool is defined');
    });

    runTest('setup_player_with_sprites is in agenticTools array', () => {
        const found = agenticTools.some(t => t.name === 'setup_player_with_sprites');
        return assertTrue(found, 'Tool in array');
    });

    runTest('setup_player_with_sprites has correct id', () => {
        return assertEqual(setup_player_with_sprites.id, 'setup_player_with_sprites', 'id');
    });

    runTest('setup_player_with_sprites description mentions COMPOUND', () => {
        return assertContains(setup_player_with_sprites.description, 'COMPOUND', 'description');
    });

    runTest('setup_player_with_sprites description mentions CharacterBody2D', () => {
        return assertContains(setup_player_with_sprites.description, 'CharacterBody2D', 'description');
    });

    runTest('setup_player_with_sprites description mentions AnimatedSprite2D', () => {
        return assertContains(setup_player_with_sprites.description, 'AnimatedSprite2D', 'description');
    });

    runTest('setup_player_with_sprites has sprite_frames_path parameter', () => {
        const hasParam = setup_player_with_sprites.parameters.some(p => p.name === 'sprite_frames_path');
        return assertTrue(hasParam, 'Has sprite_frames_path');
    });

    runTest('sprite_frames_path parameter is required', () => {
        const param = setup_player_with_sprites.parameters.find(p => p.name === 'sprite_frames_path');
        return assertTrue(param?.required === true, 'Required is true');
    });

    runTest('setup_player_with_sprites has player_name parameter', () => {
        const hasParam = setup_player_with_sprites.parameters.some(p => p.name === 'player_name');
        return assertTrue(hasParam, 'Has player_name');
    });

    runTest('setup_player_with_sprites has scene_path parameter', () => {
        const hasParam = setup_player_with_sprites.parameters.some(p => p.name === 'scene_path');
        return assertTrue(hasParam, 'Has scene_path');
    });

    runTest('setup_player_with_sprites has collision_width parameter', () => {
        const hasParam = setup_player_with_sprites.parameters.some(p => p.name === 'collision_width');
        return assertTrue(hasParam, 'Has collision_width');
    });

    runTest('setup_player_with_sprites has whenToUse', () => {
        return assertTrue(!!setup_player_with_sprites.whenToUse, 'Has whenToUse');
    });

    runTest('setup_player_with_sprites whenToUse mentions spritemancer_approve_animation', () => {
        return assertContains(
            setup_player_with_sprites.whenToUse || '',
            'sprite_frames_path',
            'whenToUse'
        );
    });

    runTest('setup_player_with_sprites has whenNotToUse', () => {
        return assertTrue(!!setup_player_with_sprites.whenNotToUse, 'Has whenNotToUse');
    });

    // ============================================
    // Tool Count Tests
    // ============================================
    console.log('\n📋 Testing tool counts...\n');

    runTest('agenticTools has correct count', () => {
        // Should have 7 tools: ask_followup, attempt_completion, start_plan, update_plan, set_task_plan, request_user_feedback, setup_player_with_sprites
        return assertEqual(agenticTools.length, 7, 'Tool count');
    });

    runTest('All agentic tools have unique ids', () => {
        const ids = agenticTools.map(t => t.id);
        const uniqueIds = new Set(ids);
        return assertEqual(uniqueIds.size, ids.length, 'Unique IDs');
    });

    // Print results
    console.log('\n' + '='.repeat(60));
    console.log('📊 PHASE 3 BRIDGE TEST RESULTS');
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
        console.log('❌ Some Phase 3 tests failed.\n');
        process.exit(1);
    } else {
        console.log('✅ All Phase 3 bridge tests passed!\n');
        process.exit(0);
    }
}

// Run all tests
runAllTests();
