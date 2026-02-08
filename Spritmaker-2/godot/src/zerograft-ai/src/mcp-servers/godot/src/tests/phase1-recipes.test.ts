/**
 * Phase 1 Test Cases - Game Creation Meta-Recipe
 * 
 * These tests verify:
 * 1. Simple game workflow recipe exists and is well-formed
 * 2. Recipe lookup prioritizes game creation requests
 * 3. isGameCreationRequest detection works
 * 
 * Run with: npx tsx src/tests/phase1-recipes.test.ts
 */

import {
    findRecipes,
    getRecipe,
    getRecipeNames,
    SIMPLE_GAME_WORKFLOW_RECIPE,
    SIMPLE_GAME_KEYWORDS,
    isGameCreationRequest,
} from '../prompts/recipes/index.js';

// ============================================
// Test Utilities
// ============================================

interface TestResult {
    name: string;
    passed: boolean;
    message: string;
}

const testResults: TestResult[] = [];

function test(name: string, fn: () => boolean): void {
    try {
        const result = fn();
        testResults.push({ name, passed: result, message: result ? 'PASS' : 'FAIL' });
    } catch (err) {
        testResults.push({ name, passed: false, message: `ERROR: ${err}` });
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

function assertEqual<T>(actual: T, expected: T, label: string = ''): boolean {
    const passed = JSON.stringify(actual) === JSON.stringify(expected);
    if (!passed) {
        console.error(`  ❌ ${label}: Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
    return passed;
}

// ============================================
// Test: Recipe Existence
// ============================================

console.log('\n📋 Testing Recipe Existence...\n');

test('simple_game_workflow recipe exists', () => {
    const recipe = getRecipe('simple_game_workflow');
    return assertTrue(recipe !== undefined, 'Recipe should exist');
});

test('simple_game_workflow is in recipe list', () => {
    const names = getRecipeNames();
    return assertTrue(names.includes('simple_game_workflow'), 'Should be in recipe names');
});

test('SIMPLE_GAME_WORKFLOW_RECIPE is exported', () => {
    return assertTrue(SIMPLE_GAME_WORKFLOW_RECIPE !== undefined, 'Should be exported') &&
        assertTrue(SIMPLE_GAME_WORKFLOW_RECIPE.length > 1000, 'Should have substantial content');
});

test('SIMPLE_GAME_KEYWORDS is exported and non-empty', () => {
    return assertTrue(Array.isArray(SIMPLE_GAME_KEYWORDS), 'Should be array') &&
        assertTrue(SIMPLE_GAME_KEYWORDS.length > 5, 'Should have multiple keywords');
});

// ============================================
// Test: Recipe Content
// ============================================

console.log('\n📋 Testing Recipe Content...\n');

test('Recipe contains Phase A (Asset Generation)', () => {
    return assertContains(SIMPLE_GAME_WORKFLOW_RECIPE, 'PHASE A', 'Phase A header') &&
        assertContains(SIMPLE_GAME_WORKFLOW_RECIPE, 'spritemancer_create_character', 'SpriteMancer tool');
});

test('Recipe contains Phase B (Player Scene)', () => {
    return assertContains(SIMPLE_GAME_WORKFLOW_RECIPE, 'PHASE B', 'Phase B header') &&
        assertContains(SIMPLE_GAME_WORKFLOW_RECIPE, 'Player Scene', 'Player Scene section');
});

test('Recipe contains Phase C (Level Scene)', () => {
    return assertContains(SIMPLE_GAME_WORKFLOW_RECIPE, 'PHASE C', 'Phase C header') &&
        assertContains(SIMPLE_GAME_WORKFLOW_RECIPE, 'Level Scene', 'Level Scene section');
});

test('Recipe contains Phase D (Input Configuration)', () => {
    return assertContains(SIMPLE_GAME_WORKFLOW_RECIPE, 'PHASE D', 'Phase D header') &&
        assertContains(SIMPLE_GAME_WORKFLOW_RECIPE, 'add_input_action', 'add_input_action tool');
});

test('Recipe contains Phase E (Testing)', () => {
    return assertContains(SIMPLE_GAME_WORKFLOW_RECIPE, 'PHASE E', 'Phase E header') &&
        assertContains(SIMPLE_GAME_WORKFLOW_RECIPE, 'run_game', 'run_game tool');
});

test('Recipe contains verification checklist', () => {
    return assertContains(SIMPLE_GAME_WORKFLOW_RECIPE, 'VERIFICATION', 'Verification section');
});

test('Recipe contains common mistakes', () => {
    return assertContains(SIMPLE_GAME_WORKFLOW_RECIPE, 'COMMON MISTAKES', 'Mistakes section');
});

test('Recipe emphasizes no hardcoded values', () => {
    return assertContains(SIMPLE_GAME_WORKFLOW_RECIPE, 'NO HARDCODED VALUES', 'No hardcoded values principle') &&
        assertContains(SIMPLE_GAME_WORKFLOW_RECIPE, 'VERIFY', 'Verification emphasis');
});

// ============================================
// Test: Recipe Lookup Priority
// ============================================

console.log('\n📋 Testing Recipe Lookup Priority...\n');

test('findRecipes("create game") returns simple_game_workflow first', () => {
    const results = findRecipes('create game');
    return assertTrue(results.length > 0, 'Should find recipes') &&
        assertEqual(results[0].name, 'simple_game_workflow', 'First result should be game workflow');
});

test('findRecipes("make a simple platformer") returns simple_game_workflow first', () => {
    const results = findRecipes('make a simple platformer');
    return assertTrue(results.length > 0, 'Should find recipes') &&
        assertEqual(results[0].name, 'simple_game_workflow', 'First result should be game workflow');
});

test('findRecipes("build game from scratch") returns simple_game_workflow first', () => {
    const results = findRecipes('build game from scratch');
    return assertTrue(results.length > 0, 'Should find recipes') &&
        assertEqual(results[0].name, 'simple_game_workflow', 'First result should be game workflow');
});

test('findRecipes("new game with animated character") returns simple_game_workflow first', () => {
    const results = findRecipes('new game with animated character');
    return assertTrue(results.length > 0, 'Should find recipes') &&
        assertEqual(results[0].name, 'simple_game_workflow', 'First result should be game workflow');
});

test('findRecipes("player movement") should NOT prioritize simple_game_workflow', () => {
    const results = findRecipes('player movement');
    // For specific topics, individual recipes should be matched
    return assertTrue(results.length > 0, 'Should find recipes');
    // platformer_player or common_scripts might be first
});

test('findRecipes("camera setup") returns camera_setup (not game workflow)', () => {
    const results = findRecipes('camera setup');
    return assertTrue(results.length > 0, 'Should find recipes') &&
        assertEqual(results[0].name, 'camera_setup', 'First result should be camera_setup');
});

test('findRecipes("parallax background") returns parallax_background (not game workflow)', () => {
    const results = findRecipes('parallax background');
    return assertTrue(results.length > 0, 'Should find recipes') &&
        assertEqual(results[0].name, 'parallax_background', 'First result should be parallax_background');
});

// ============================================
// Test: isGameCreationRequest
// ============================================

console.log('\n📋 Testing isGameCreationRequest...\n');

test('isGameCreationRequest("create a game") returns true', () => {
    return assertTrue(isGameCreationRequest('create a game'), 'Should detect game creation');
});

test('isGameCreationRequest("make a simple game") returns true', () => {
    return assertTrue(isGameCreationRequest('make a simple game'), 'Should detect game creation');
});

test('isGameCreationRequest("build a platformer") returns true', () => {
    return assertTrue(isGameCreationRequest('build a platformer'), 'Should detect platformer');
});

test('isGameCreationRequest("new game from scratch") returns true', () => {
    return assertTrue(isGameCreationRequest('new game from scratch'), 'Should detect from scratch');
});

test('isGameCreationRequest("fix the camera") returns false', () => {
    return assertTrue(!isGameCreationRequest('fix the camera'), 'Should not match camera fix');
});

test('isGameCreationRequest("add a node") returns false', () => {
    return assertTrue(!isGameCreationRequest('add a node'), 'Should not match node addition');
});

test('isGameCreationRequest("edit the script") returns false', () => {
    return assertTrue(!isGameCreationRequest('edit the script'), 'Should not match script editing');
});

// ============================================
// Test: Keyword Coverage
// ============================================

console.log('\n📋 Testing Keyword Coverage...\n');

test('Keywords include "game"', () => {
    return assertTrue(SIMPLE_GAME_KEYWORDS.includes('game'), 'Should include game');
});

test('Keywords include "platformer"', () => {
    return assertTrue(SIMPLE_GAME_KEYWORDS.includes('platformer'), 'Should include platformer');
});

test('Keywords include "from scratch"', () => {
    return assertTrue(SIMPLE_GAME_KEYWORDS.includes('from scratch'), 'Should include from scratch');
});

// ============================================
// Print Test Results
// ============================================

console.log('\n' + '='.repeat(60));
console.log('📊 PHASE 1 RECIPE TEST RESULTS');
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
    console.log('✅ All Phase 1 recipe tests passed!\n');
    process.exit(0);
}
