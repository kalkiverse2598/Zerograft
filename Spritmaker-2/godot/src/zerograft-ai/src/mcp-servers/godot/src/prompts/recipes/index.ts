/**
 * Godot Game Development Recipes Index
 * Central export and recipe lookup by keyword
 */

// Phase 1: Game creation meta-recipe (highest priority)
import { SIMPLE_GAME_WORKFLOW_RECIPE, SIMPLE_GAME_KEYWORDS, isGameCreationRequest } from './simple_game_workflow.js';

// Individual topic recipes
import { VISUAL_LAYERS_RECIPE, VISUAL_LAYERS_KEYWORDS } from './visual_layers.js';
import { PARALLAX_BACKGROUND_RECIPE, PARALLAX_KEYWORDS } from './parallax_background.js';
import { PLATFORMER_PLAYER_RECIPE, PLATFORMER_PLAYER_KEYWORDS } from './platformer_player.js';
import { PLATFORMER_LEVEL_RECIPE, PLATFORMER_LEVEL_KEYWORDS } from './platformer_level.js';
import { ANIMATIONS_RECIPE, ANIMATIONS_KEYWORDS } from './animations.js';
import { COLLISION_DETECTION_RECIPE, COLLISION_KEYWORDS } from './collision_detection.js';
import { CAMERA_SETUP_RECIPE, CAMERA_KEYWORDS } from './camera_setup.js';
import { AUDIO_SYSTEM_RECIPE, AUDIO_KEYWORDS } from './audio_system.js';
import { SCENE_TRANSITIONS_RECIPE, SCENE_TRANSITIONS_KEYWORDS } from './scene_transitions.js';
import { INPUT_MAPPING_RECIPE, INPUT_KEYWORDS } from './input_mapping.js';
import { UI_HUD_RECIPE, UI_HUD_KEYWORDS } from './ui_hud.js';
import { COMMON_SCRIPTS_RECIPE, COMMON_SCRIPTS_KEYWORDS } from './common_scripts.js';
import { PROJECT_ORGANIZATION_RECIPE, PROJECT_ORGANIZATION_KEYWORDS } from './project_organization.js';
import { CUSTOM_RESOURCES_RECIPE, CUSTOM_RESOURCES_KEYWORDS } from './custom_resources.js';
import { PROPERTY_LOCATION_RECIPE, PROPERTY_LOCATION_KEYWORDS } from './property_location.js';
import { TILESET_SETUP_RECIPE, TILESET_KEYWORDS } from './tileset_setup.js';
import { TILEMAP_PLACEMENT_RECIPE, TILEMAP_PLACEMENT_KEYWORDS } from './tilemap_placement.js';
import { VFX_EFFECTS_RECIPE, VFX_KEYWORDS } from './vfx_effects.js';
import { POSITIONING_RECIPE, POSITIONING_KEYWORDS } from './gamePositioning.js';
import { PIXEL_ART_SETUP_RECIPE, PIXEL_ART_SETUP_KEYWORDS } from './pixel_art_setup.js';


/**
 * Recipe definition with content and keywords
 */
export interface Recipe {
    name: string;
    content: string;
    keywords: string[];
    priority?: number;  // Higher = matched first when scores are equal
}

/**
 * All available recipes
 * IMPORTANT: simple_game_workflow is FIRST for priority on game creation requests
 */
export const RECIPES: Recipe[] = [
    // Meta-recipe for complete game creation (highest priority)
    { name: 'simple_game_workflow', content: SIMPLE_GAME_WORKFLOW_RECIPE, keywords: SIMPLE_GAME_KEYWORDS, priority: 100 },

    // Individual topic recipes
    { name: 'visual_layers', content: VISUAL_LAYERS_RECIPE, keywords: VISUAL_LAYERS_KEYWORDS },
    { name: 'parallax_background', content: PARALLAX_BACKGROUND_RECIPE, keywords: PARALLAX_KEYWORDS },
    { name: 'platformer_player', content: PLATFORMER_PLAYER_RECIPE, keywords: PLATFORMER_PLAYER_KEYWORDS },
    { name: 'platformer_level', content: PLATFORMER_LEVEL_RECIPE, keywords: PLATFORMER_LEVEL_KEYWORDS },
    { name: 'animations', content: ANIMATIONS_RECIPE, keywords: ANIMATIONS_KEYWORDS },
    { name: 'collision_detection', content: COLLISION_DETECTION_RECIPE, keywords: COLLISION_KEYWORDS },
    { name: 'camera_setup', content: CAMERA_SETUP_RECIPE, keywords: CAMERA_KEYWORDS },
    { name: 'audio_system', content: AUDIO_SYSTEM_RECIPE, keywords: AUDIO_KEYWORDS },
    { name: 'scene_transitions', content: SCENE_TRANSITIONS_RECIPE, keywords: SCENE_TRANSITIONS_KEYWORDS },
    { name: 'input_mapping', content: INPUT_MAPPING_RECIPE, keywords: INPUT_KEYWORDS },
    { name: 'ui_hud', content: UI_HUD_RECIPE, keywords: UI_HUD_KEYWORDS },
    { name: 'common_scripts', content: COMMON_SCRIPTS_RECIPE, keywords: COMMON_SCRIPTS_KEYWORDS },
    { name: 'project_organization', content: PROJECT_ORGANIZATION_RECIPE, keywords: PROJECT_ORGANIZATION_KEYWORDS },
    { name: 'custom_resources', content: CUSTOM_RESOURCES_RECIPE, keywords: CUSTOM_RESOURCES_KEYWORDS },
    { name: 'property_location', content: PROPERTY_LOCATION_RECIPE, keywords: PROPERTY_LOCATION_KEYWORDS },
    { name: 'tileset_setup', content: TILESET_SETUP_RECIPE, keywords: TILESET_KEYWORDS },
    { name: 'tilemap_placement', content: TILEMAP_PLACEMENT_RECIPE, keywords: TILEMAP_PLACEMENT_KEYWORDS, priority: 50 },
    { name: 'vfx_effects', content: VFX_EFFECTS_RECIPE, keywords: VFX_KEYWORDS },
    { name: 'positioning', content: POSITIONING_RECIPE, keywords: POSITIONING_KEYWORDS, priority: 80 },
    { name: 'pixel_art_setup', content: PIXEL_ART_SETUP_RECIPE, keywords: PIXEL_ART_SETUP_KEYWORDS, priority: 90 },
];

/**
 * Find recipes matching a query string
 * @param query Search query (topic name or keywords)
 * @returns Array of matching recipes ordered by relevance (priority + keyword score)
 */
export function findRecipes(query: string): Recipe[] {
    const lowerQuery = query.toLowerCase();
    const words = lowerQuery.split(/\s+/);

    // Score each recipe based on keyword matches
    const scored = RECIPES.map(recipe => {
        let score = 0;

        // Add priority bonus if defined
        score += recipe.priority || 0;

        // Check recipe name (exact match bonus)
        if (lowerQuery.includes(recipe.name.replace(/_/g, ' '))) {
            score += 20;  // Higher bonus for exact name match
        } else if (recipe.name.includes(lowerQuery)) {
            score += 10;
        }

        // Check each keyword (supports multi-word keywords)
        for (const keyword of recipe.keywords) {
            const lowerKeyword = keyword.toLowerCase();

            // Exact phrase match (highest value)
            if (lowerQuery.includes(lowerKeyword)) {
                score += 15;
            }

            // Individual word matches - REQUIRE WHOLE WORD MATCH
            // This prevents "ground" from matching "background"
            for (const word of words) {
                // Exact word match (query word = keyword)
                if (word === lowerKeyword) {
                    score += 10;  // Higher score for exact match
                }
                // Keyword is a multi-word phrase containing this word as whole word
                else if (new RegExp(`\\b${word}\\b`).test(lowerKeyword)) {
                    score += 7;  // Medium score for keyword containing query word
                }
                // Query word starts with or ends with keyword (for plural/singular)
                else if (word.startsWith(lowerKeyword) || lowerKeyword.startsWith(word)) {
                    // Only match if they share 80%+ characters to avoid false positives
                    const shorter = word.length < lowerKeyword.length ? word : lowerKeyword;
                    const longer = word.length < lowerKeyword.length ? lowerKeyword : word;
                    if (shorter.length >= longer.length * 0.8) {
                        score += 5;  // Lower score for prefix match
                    }
                }
            }
        }

        return { recipe, score };
    });

    // Get recipes with score > 0 (excluding priority-only matches)
    // Sorted by score descending
    let results = scored
        .filter(s => s.score > (s.recipe.priority || 0))  // Must have actual keyword match
        .sort((a, b) => b.score - a.score)
        .map(s => s.recipe);

    // CRITICAL: For game creation, ALWAYS include essential recipes
    // These contain formulas and fundamentals for correct game setup
    if (isGameCreationRequest(query)) {
        const essentialRecipes = ['positioning', 'camera_setup', 'pixel_art_setup', 'platformer_player'];

        for (const recipeName of essentialRecipes) {
            const recipe = getRecipe(recipeName);
            if (recipe && !results.some(r => r.name === recipeName)) {
                results.push(recipe);
            }
        }
    }

    return results;
}

/**
 * Get a recipe by exact name
 * @param name Recipe name (e.g., 'parallax_background')
 * @returns Recipe content or undefined
 */
export function getRecipe(name: string): Recipe | undefined {
    return RECIPES.find(r => r.name === name);
}

/**
 * Get all recipe names
 */
export function getRecipeNames(): string[] {
    return RECIPES.map(r => r.name);
}

// Re-export all individual recipes
export {
    // Phase 1: Game creation workflow
    SIMPLE_GAME_WORKFLOW_RECIPE,
    SIMPLE_GAME_KEYWORDS,
    isGameCreationRequest,

    // Individual topic recipes
    VISUAL_LAYERS_RECIPE,
    PARALLAX_BACKGROUND_RECIPE,
    PLATFORMER_PLAYER_RECIPE,
    PLATFORMER_LEVEL_RECIPE,
    ANIMATIONS_RECIPE,
    COLLISION_DETECTION_RECIPE,
    CAMERA_SETUP_RECIPE,
    AUDIO_SYSTEM_RECIPE,
    SCENE_TRANSITIONS_RECIPE,
    INPUT_MAPPING_RECIPE,
    UI_HUD_RECIPE,
    COMMON_SCRIPTS_RECIPE,
    PROJECT_ORGANIZATION_RECIPE,
    CUSTOM_RESOURCES_RECIPE,
    PROPERTY_LOCATION_RECIPE,
    TILESET_SETUP_RECIPE,
    VFX_EFFECTS_RECIPE,
};

/**
 * Keywords that indicate a small/simple task that doesn't need a plan
 */
const SMALL_TASK_PATTERNS = [
    // Single node operations
    /^add\s+(a\s+)?node/i,
    /^remove\s+(a\s+)?node/i,
    /^delete\s+(a\s+)?node/i,
    /^rename\s+/i,

    // Property changes
    /^(change|set|update|modify)\s+(the\s+)?(color|size|position|scale|rotation)/i,
    /^(fix|correct|adjust)\s+(the\s+)?(color|size|position|scale|rotation)/i,
    /^set\s+\w+\s+(to|=)/i,

    // Simple queries
    /^(run|play|test)\s+(the\s+)?(game|scene|project)/i,
    /^save\s+(the\s+)?(scene|project)/i,
    /^open\s+(the\s+)?scene/i,
    /^list\s+/i,
    /^get\s+(the\s+)?/i,
    /^show\s+(me\s+)?/i,
    /^what\s+is/i,
    /^how\s+(do\s+i|to)/i,

    // Single operations
    /^attach\s+(a\s+)?script/i,
    /^create\s+(a\s+)?script/i,
    /^add\s+(a\s+)?collision/i,
    /^(enable|disable)\s+/i,
];

/**
 * Check if a request is a small/simple task that doesn't need a plan
 * Small tasks can be executed directly without formal planning
 */
export function isSmallTask(request: string): boolean {
    const trimmed = request.trim().toLowerCase();

    // FIRST: Game creation is NEVER a small task
    if (isGameCreationRequest(request)) {
        return false;
    }

    // Very short requests are usually simple (but not game creation)
    if (trimmed.split(/\s+/).length <= 4) {
        return true;
    }

    // Check against small task patterns
    for (const pattern of SMALL_TASK_PATTERNS) {
        if (pattern.test(trimmed)) {
            return true;
        }
    }

    // If it doesn't mention multiple things, it's probably small
    // Check for "and" or multiple verbs indicating multi-step
    const hasMultipleActions = /\band\b.*\b(add|create|set|change|then)\b/i.test(request);
    if (!hasMultipleActions && trimmed.length < 50) {
        return true;
    }

    return false;
}
