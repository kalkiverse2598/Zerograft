/**
 * Phase 5 Test Cases - Dynamic Tool Selection
 * 
 * These tests verify:
 * 1. Request analysis correctly identifies tool categories
 * 2. Tool filtering works based on categories  
 * 3. Complex/game creation requests get ALL tools
 * 
 * Run with: npx tsx src/tests/phase5-tool-selection.test.ts
 */

import {
    ToolCategory,
    analyzeRequestForCategoriesSync,
    isToolInCategories,
    getToolCategoryForTool
} from '../prompts/toolSelector.js';

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
        if (!passed) {
            console.log(`  ❌ ${name}`);
        }
    } catch (err) {
        testResults.push({ name, passed: false, error: String(err) });
        console.log(`  ❌ ${name}: ${err}`);
    }
}

function assertIncludes(arr: string[], item: string, label: string = ''): boolean {
    if (!arr.includes(item)) {
        console.error(`  Expected ${label} to include "${item}", got [${arr.join(', ')}]`);
        return false;
    }
    return true;
}

function assertNotIncludes(arr: string[], item: string, label: string = ''): boolean {
    if (arr.includes(item)) {
        console.error(`  Expected ${label} NOT to include "${item}"`);
        return false;
    }
    return true;
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
    console.log('\n🧪 Running Phase 5 Dynamic Tool Selection Tests...\n');

    // ============================================
    // Request Analysis Tests
    // ============================================
    console.log('📋 Testing request analysis...\n');

    // Inspection queries
    runTest('Inspection: "show me the game state"', () => {
        const cats = analyzeRequestForCategoriesSync("show me the game state");
        return assertIncludes(cats, ToolCategory.INSPECTION, 'categories') &&
            assertIncludes(cats, ToolCategory.AGENTIC, 'categories');
    });

    runTest('Inspection: "what is the current scene"', () => {
        const cats = analyzeRequestForCategoriesSync("what is the current scene");
        return assertIncludes(cats, ToolCategory.INSPECTION, 'categories');
    });

    runTest('Inspection: "list all scenes"', () => {
        const cats = analyzeRequestForCategoriesSync("list all scenes");
        return assertIncludes(cats, ToolCategory.INSPECTION, 'categories');
    });

    // Creation requests
    runTest('Creation: "create a player node"', () => {
        const cats = analyzeRequestForCategoriesSync("create a player node");
        return assertIncludes(cats, ToolCategory.CREATION, 'categories') &&
            assertIncludes(cats, ToolCategory.INSPECTION, 'categories');
    });

    runTest('Creation: "add a collision shape"', () => {
        const cats = analyzeRequestForCategoriesSync("add a collision shape");
        return assertIncludes(cats, ToolCategory.CREATION, 'categories');
    });

    runTest('Creation: "set the player speed to 200"', () => {
        const cats = analyzeRequestForCategoriesSync("set the player speed to 200");
        return assertIncludes(cats, ToolCategory.CREATION, 'categories');
    });

    // SpriteMancer requests
    runTest('SpriteMancer: "generate a sprite for the player"', () => {
        const cats = analyzeRequestForCategoriesSync("generate a sprite for the player");
        return assertIncludes(cats, ToolCategory.SPRITEMANCER, 'categories');
    });

    runTest('SpriteMancer: "create a character animation"', () => {
        const cats = analyzeRequestForCategoriesSync("create a character animation");
        return assertIncludes(cats, ToolCategory.SPRITEMANCER, 'categories');
    });

    // Execution requests
    runTest('Execution: "run the game"', () => {
        const cats = analyzeRequestForCategoriesSync("run the game");
        return assertIncludes(cats, ToolCategory.EXECUTION, 'categories');
    });

    runTest('Execution: "test the scene"', () => {
        const cats = analyzeRequestForCategoriesSync("test the scene");
        return assertIncludes(cats, ToolCategory.EXECUTION, 'categories');
    });

    runTest('Execution: "save and run"', () => {
        const cats = analyzeRequestForCategoriesSync("save and run");
        return assertIncludes(cats, ToolCategory.EXECUTION, 'categories');
    });

    // Game creation → ALL
    runTest('Game creation: "create a platformer game"', () => {
        const cats = analyzeRequestForCategoriesSync("create a platformer game");
        return assertIncludes(cats, ToolCategory.ALL, 'categories');
    });

    runTest('Game creation: "make a new game from scratch"', () => {
        const cats = analyzeRequestForCategoriesSync("make a new game from scratch");
        return assertIncludes(cats, ToolCategory.ALL, 'categories');
    });

    // Complex multi-action → ALL  
    runTest('Complex: should detect multi-verb patterns', () => {
        const cats = analyzeRequestForCategoriesSync("create a node, add a script, set properties, connect signals, and run");
        return assertIncludes(cats, ToolCategory.ALL, 'categories');
    });

    // ============================================
    // Tool Category Mapping Tests
    // ============================================
    console.log('\n📋 Testing tool category mapping...\n');

    runTest('get_scene_tree is INSPECTION', () => {
        return assertTrue(getToolCategoryForTool('get_scene_tree') === ToolCategory.INSPECTION, 'category');
    });

    runTest('create_scene is CREATION', () => {
        return assertTrue(getToolCategoryForTool('create_scene') === ToolCategory.CREATION, 'category');
    });

    runTest('spritemancer_generate is SPRITEMANCER', () => {
        return assertTrue(getToolCategoryForTool('spritemancer_generate') === ToolCategory.SPRITEMANCER, 'category');
    });

    runTest('run_game is EXECUTION', () => {
        return assertTrue(getToolCategoryForTool('run_game') === ToolCategory.EXECUTION, 'category');
    });

    runTest('ask_followup_question is AGENTIC', () => {
        return assertTrue(getToolCategoryForTool('ask_followup_question') === ToolCategory.AGENTIC, 'category');
    });

    // ============================================
    // isToolInCategories Tests
    // ============================================
    console.log('\n📋 Testing tool filtering...\n');

    runTest('get_scene_tree is in INSPECTION category', () => {
        return assertTrue(isToolInCategories('get_scene_tree', [ToolCategory.INSPECTION]), 'in category');
    });

    runTest('get_scene_tree is NOT in CREATION category alone', () => {
        return assertFalse(isToolInCategories('get_scene_tree', [ToolCategory.CREATION]), 'not in category');
    });

    runTest('create_scene is in CREATION category', () => {
        return assertTrue(isToolInCategories('create_scene', [ToolCategory.CREATION]), 'in category');
    });

    runTest('ALL category includes everything', () => {
        return assertTrue(isToolInCategories('any_tool', [ToolCategory.ALL]), 'ALL includes');
    });

    runTest('ask_followup_question is always in AGENTIC', () => {
        return assertTrue(isToolInCategories('ask_followup_question', [ToolCategory.AGENTIC]), 'AGENTIC');
    });

    // ============================================
    // AGENTIC Always Included
    // ============================================
    console.log('\n📋 Testing AGENTIC always included...\n');

    runTest('Inspection request includes AGENTIC', () => {
        const cats = analyzeRequestForCategoriesSync("show game state");
        return assertIncludes(cats, ToolCategory.AGENTIC, 'AGENTIC included');
    });

    runTest('Creation request includes AGENTIC', () => {
        const cats = analyzeRequestForCategoriesSync("add a node");
        return assertIncludes(cats, ToolCategory.AGENTIC, 'AGENTIC included');
    });

    runTest('Execution request includes AGENTIC', () => {
        const cats = analyzeRequestForCategoriesSync("run game");
        return assertIncludes(cats, ToolCategory.AGENTIC, 'AGENTIC included');
    });

    // Print results
    console.log('\n' + '='.repeat(60));
    console.log('📊 PHASE 5 DYNAMIC TOOL SELECTION TEST RESULTS');
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
        console.log('❌ Some Phase 5 tests failed.\n');
        process.exit(1);
    } else {
        console.log('✅ All Phase 5 dynamic tool selection tests passed!\n');
        process.exit(0);
    }
}

// Run all tests
runAllTests();
