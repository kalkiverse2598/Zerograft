#!/usr/bin/env npx ts-node
/**
 * Phase 4 Plan Step Verification Tests
 * Tests the verifyStepCompletion logic in TaskExecutor
 */

// Mock the verification logic for testing
function verifyStepCompletion(
    toolName: string,
    params: Record<string, unknown>,
    stepDescription: string,
    toolSuccess: boolean
): { matches: boolean; confidence: number; reason: string } {
    const stepDescLower = stepDescription.toLowerCase();
    const toolNameLower = toolName.toLowerCase();

    // Tool-to-action keyword mapping (same as in taskExecutor.ts)
    const toolActionMap: Record<string, string[]> = {
        'create_scene': ['create scene', 'new scene', 'create a scene', 'make scene'],
        'open_scene': ['open scene', 'open the scene', 'load scene'],
        'save_scene': ['save scene', 'save the scene'],
        'add_node': ['add node', 'add a node', 'create node', 'insert node'],
        'set_property': ['set property', 'configure property', 'change property'],
        'create_script': ['create script', 'add script', 'new script', 'make script'],
        'attach_script': ['attach script', 'add script to', 'assign script'],
        'run_game': ['run game', 'play game', 'test game', 'start game', 'execute game'],
        'set_collision_shape': ['collision shape', 'set collision', 'add collision'],
        'spritemancer_generate_character': ['generate character', 'create character', 'character generation'],
        'spritemancer_generate_animations': ['generate animation', 'create animation', 'animation generation'],
        'spritemancer_approve_animation': ['approve animation', 'confirm animation', 'accept animation'],
        'setup_player_with_sprites': ['setup player', 'create player', 'player scene', 'player with sprites'],
        'set_main_scene': ['main scene', 'set main', 'configure main scene'],
    };

    const actionKeywords = toolActionMap[toolName] || [toolNameLower.replace(/_/g, ' ')];
    let matchCount = 0;

    for (const keyword of actionKeywords) {
        const regex = new RegExp(keyword, 'i');
        if (regex.test(stepDescLower)) {
            matchCount++;
        }
    }

    let paramMatches = 0;
    if (params) {
        for (const [, value] of Object.entries(params)) {
            if (typeof value === 'string' && value.length > 2) {
                if (stepDescLower.includes(value.toLowerCase())) {
                    paramMatches++;
                }
            }
        }
    }

    const hasKeywordMatch = matchCount > 0;
    const hasParamMatch = paramMatches > 0;

    let confidence = 0;
    let reason = '';

    if (hasKeywordMatch && hasParamMatch) {
        confidence = 0.9;
        reason = `Tool '${toolName}' matches step keywords and parameters`;
    } else if (hasKeywordMatch) {
        confidence = 0.7;
        reason = `Tool '${toolName}' matches step action keywords`;
    } else if (hasParamMatch) {
        confidence = 0.5;
        reason = `Tool parameters appear in step description`;
    } else {
        const genericMatches = [
            { pattern: /create|generate|add|new|make/i, tools: ['create_scene', 'create_script', 'add_node', 'spritemancer_generate_character'] },
            { pattern: /configure|set|assign|attach/i, tools: ['set_property', 'attach_script', 'set_collision_shape', 'set_main_scene'] },
            { pattern: /run|test|play|execute/i, tools: ['run_game'] },
            { pattern: /save|store/i, tools: ['save_scene'] },
        ];

        for (const { pattern, tools } of genericMatches) {
            if (pattern.test(stepDescLower) && tools.includes(toolName)) {
                confidence = 0.4;
                reason = `Generic action match for '${toolName}'`;
                break;
            }
        }

        if (confidence === 0) {
            reason = `No clear match between '${toolName}' and step description`;
        }
    }

    const matches = toolSuccess && confidence >= 0.4;
    return { matches, confidence, reason };
}

// Test runner
let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean): void {
    try {
        if (fn()) {
            console.log(`✅ ${name}`);
            passed++;
        } else {
            console.log(`❌ ${name}`);
            failed++;
        }
    } catch (e) {
        console.log(`❌ ${name} - Error: ${e}`);
        failed++;
    }
}

console.log('\n============================================================');
console.log('📊 PHASE 4 PLAN STEP VERIFICATION TESTS');
console.log('============================================================\n');

// Keyword matching tests
console.log('📋 Testing keyword matching...\n');

test('create_scene matches "Create scene for player"', () => {
    const result = verifyStepCompletion('create_scene', { path: 'player.tscn' }, 'Create scene for player', true);
    return result.matches && result.confidence >= 0.7;
});

test('add_node matches "Add node for collision"', () => {
    const result = verifyStepCompletion('add_node', { name: 'Collision' }, 'Add node for collision', true);
    return result.matches && result.confidence >= 0.7;
});

test('run_game matches "Run the game to test"', () => {
    const result = verifyStepCompletion('run_game', {}, 'Run the game to test', true);
    // run_game matches via generic "test" pattern, so confidence is 0.4-0.7
    return result.matches && result.confidence >= 0.4;
});

test('save_scene matches "Save the scene"', () => {
    const result = verifyStepCompletion('save_scene', {}, 'Save the scene', true);
    return result.matches && result.confidence >= 0.7;
});

test('spritemancer_generate_character matches "Generate character for player"', () => {
    const result = verifyStepCompletion('spritemancer_generate_character', { prompt: 'knight' }, 'Generate character for player', true);
    return result.matches && result.confidence >= 0.7;
});

test('setup_player_with_sprites matches "Create player scene with sprites"', () => {
    const result = verifyStepCompletion('setup_player_with_sprites', {}, 'Create player scene with sprites', true);
    return result.matches && result.confidence >= 0.7;
});

// Parameter matching tests
console.log('\n📋 Testing parameter matching...\n');

test('add_node with matching node name gets higher confidence', () => {
    // "add" matches generic pattern for add_node, but "Player" param doesn't match step desc exactly
    // Step: "Add node called Player to scene" - contains both "add" + "node" (generic) + "Player"
    const result = verifyStepCompletion('add_node', { name: 'Player' }, 'Add node called Player to scene', true);
    return result.matches && result.confidence >= 0.7;
});

test('create_scene with path matching step gets higher confidence', () => {
    const result = verifyStepCompletion('create_scene', { path: 'Level1' }, 'Create scene for Level1', true);
    return result.matches && result.confidence >= 0.9;
});

// Generic matching tests
console.log('\n📋 Testing generic action matching...\n');

test('create_scene matches generic "Create a new level"', () => {
    const result = verifyStepCompletion('create_scene', {}, 'Create a new level', true);
    return result.matches && result.confidence >= 0.4;
});

test('run_game matches generic "Test the gameplay"', () => {
    const result = verifyStepCompletion('run_game', {}, 'Test the gameplay', true);
    return result.matches && result.confidence >= 0.4;
});

test('set_property matches "Configure the player speed"', () => {
    const result = verifyStepCompletion('set_property', {}, 'Configure the player speed', true);
    return result.matches && result.confidence >= 0.4;
});

// No-match tests
console.log('\n📋 Testing non-matching scenarios...\n');

test('run_game does NOT match "Create a new scene"', () => {
    const result = verifyStepCompletion('run_game', {}, 'Create a new scene', true);
    return !result.matches;
});

test('add_node does NOT match "Save the project"', () => {
    const result = verifyStepCompletion('add_node', {}, 'Save the project', true);
    return !result.matches;
});

test('create_script does NOT match "Run game"', () => {
    const result = verifyStepCompletion('create_script', {}, 'Run game', true);
    return !result.matches;
});

// Failed tool tests
console.log('\n📋 Testing failed tool scenarios...\n');

test('Failed tool does NOT complete step even with keyword match', () => {
    const result = verifyStepCompletion('create_scene', {}, 'Create scene for player', false);
    return !result.matches;
});

test('Failed run_game does NOT complete "Run the game" step', () => {
    const result = verifyStepCompletion('run_game', {}, 'Run the game to test', false);
    return !result.matches;
});

// Confidence level tests
console.log('\n📋 Testing confidence levels...\n');

test('Keyword + param match gives high confidence', () => {
    // Step desc contains "add node" (keyword) + "Collision" (param)
    const result = verifyStepCompletion('add_node', { name: 'Collision' }, 'Add node named Collision', true);
    return result.confidence >= 0.7;
});

test('Keyword only match gives 0.7 confidence', () => {
    const result = verifyStepCompletion('add_node', { name: 'Enemy' }, 'Add node to scene', true);
    return result.confidence === 0.7;
});

test('Param only match gives 0.5 confidence', () => {
    const result = verifyStepCompletion('add_node', { name: 'SpecialItem' }, 'Configure SpecialItem settings', true);
    return result.confidence === 0.5;
});

test('Generic match gives 0.4 confidence', () => {
    const result = verifyStepCompletion('create_scene', {}, 'Make a new environment', true);
    return result.confidence === 0.4;
});

test('No match gives low confidence', () => {
    // run_game keywords are: run, play, test, start, execute
    // "Open a file" contains none of these, and no params match
    const result = verifyStepCompletion('run_game', {}, 'Open a file', true);
    return result.confidence < 0.4;
});

// Summary
console.log('\n------------------------------------------------------------');
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log('------------------------------------------------------------\n');

if (failed === 0) {
    console.log('✅ All Phase 4 plan step verification tests passed!\n');
    process.exit(0);
} else {
    console.log(`❌ ${failed} test(s) failed\n`);
    process.exit(1);
}
