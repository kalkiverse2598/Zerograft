/**
 * SpriteMancer Client
 * 
 * Connects to SpriteMancer backend (https://api.zerograft.online)
 * for AI sprite generation.
 */

export interface SpriteProject {
    project_id: string;
    description?: string;
    reference_image_url?: string;
    character_dna?: CharacterDNA;
}

export interface CharacterDNA {
    archetype: string;
    color_palette: string[];
    weapon_mass?: string;
    perspective?: string;
}

export interface AnimationResult {
    project_id: string;
    status: string;
    frame_urls?: string[];
    spritesheet_url?: string;
    frame_count?: number;
}

export interface SpriteMancerConfig {
    baseUrl: string;
    timeout?: number;
}

export class SpriteMancerClient {
    private baseUrl: string;
    private timeout: number;

    constructor(config?: Partial<SpriteMancerConfig>) {
        this.baseUrl = config?.baseUrl || 'https://api.zerograft.online';
        this.timeout = config?.timeout || 120000; // 2 minutes for generation
    }

    /**
     * Check if SpriteMancer backend is running
     */
    async checkHealth(): Promise<{ healthy: boolean; error?: string }> {
        try {
            const response = await fetch(`${this.baseUrl}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000),
            });

            if (response.ok) {
                return { healthy: true };
            }
            return { healthy: false, error: `Status ${response.status}` };
        } catch (error) {
            return { healthy: false, error: String(error) };
        }
    }

    /**
     * Create a new project
     */
    async createProject(description: string): Promise<SpriteProject> {
        const response = await fetch(`${this.baseUrl}/api/projects/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: description.substring(0, 50), // name is required
                description: description
            }),
            signal: AbortSignal.timeout(this.timeout),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to create project: ${errorText}`);
        }

        const data = await response.json();
        return {
            project_id: data.id,
            description: data.description,
            reference_image_url: data.reference_image_url,
            character_dna: data.character_dna,
        };
    }

    /**
     * Generate a character from text description (fully autonomous)
     * This creates project + generates reference image + extracts DNA
     */
    async generateCharacter(
        description: string,
        size: string = "32x32",
        perspective: string = "side"
    ): Promise<{
        project_id: string;
        description: string;
        reference_image_url: string;
        reference_image_base64?: string;  // Full base64 image data
        dna_extracted: boolean;
        status: string;
    }> {
        const response = await fetch(`${this.baseUrl}/api/ai/generate-character`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                description,
                size,
                perspective,
                style: "pixel art"
            }),
            signal: AbortSignal.timeout(this.timeout * 2), // Longer timeout for image generation
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to generate character: ${errorText}`);
        }

        return response.json();
    }

    /**
     * Sync reference image (base64) to Supabase for an existing project.
     * Used when generateCharacter's db_sync failed but local file exists.
     */
    async syncReference(
        projectId: string,
        imageBase64: string,
        description?: string,
        characterDna?: CharacterDNA | Record<string, unknown>
    ): Promise<{
        success: boolean;
        project_id: string;
        reference_image_url: string;
        dna?: CharacterDNA;
        message: string;
    }> {
        const response = await fetch(`${this.baseUrl}/api/projects/${projectId}/sync-reference`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_base64: imageBase64,
                description: description,
                character_dna: characterDna
            }),
            signal: AbortSignal.timeout(this.timeout * 2), // Longer timeout for sync
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to sync reference: ${errorText}`);
        }

        return response.json();
    }

    /**
     * Extract DNA from uploaded reference image
     */
    async extractDNA(projectId: string): Promise<CharacterDNA> {
        const response = await fetch(`${this.baseUrl}/api/pipeline/dna/extract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: projectId }),
            signal: AbortSignal.timeout(this.timeout),
        });

        if (!response.ok) {
            throw new Error(`Failed to extract DNA: ${response.statusText}`);
        }

        const data = await response.json();
        return data.dna;
    }

    /**
     * Generate animation script (Stage 1-5)
     */
    async generateScript(
        projectId: string,
        actionType: string = 'idle',
        difficultyTier: string = 'standard',
        perspective: string = 'side'
    ): Promise<{ animation_script: unknown; frame_budget: unknown }> {
        const response = await fetch(`${this.baseUrl}/api/pipeline/generate-script`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                project_id: projectId,
                action_type: actionType,
                difficulty_tier: difficultyTier,
                perspective: perspective,
            }),
            signal: AbortSignal.timeout(this.timeout),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to generate script: ${error}`);
        }

        return response.json();
    }

    /**
     * Generate sprite images (Stage 6-7)
     */
    async generateSprites(
        projectId: string,
        actionType: string = 'idle',
        difficultyTier: string = 'standard',
        perspective: string = 'side'
    ): Promise<AnimationResult> {
        const response = await fetch(`${this.baseUrl}/api/pipeline/generate-sprites`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                project_id: projectId,
                action_type: actionType,
                difficulty_tier: difficultyTier,
                perspective: perspective,
            }),
            signal: AbortSignal.timeout(this.timeout),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to generate sprites: ${error}`);
        }

        return response.json();
    }

    /**
     * Run full pipeline (Stage 1-7) in one call
     * @param animationType - Optional. If provided, saves to animations[animationType] instead of project.frame_urls
     */
    async runFullPipeline(
        projectId: string,
        actionType: string = 'idle',
        difficultyTier: string = 'LIGHT',
        perspective: string = 'side',
        animationType?: string  // NEW: for per-animation storage
    ): Promise<AnimationResult> {
        const response = await fetch(`${this.baseUrl}/api/pipeline/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                project_id: projectId,
                action_type: actionType,
                difficulty_tier: difficultyTier,
                perspective: perspective,
                animation_type: animationType,  // NEW: pass animation type
            }),
            signal: AbortSignal.timeout(this.timeout * 2), // Longer timeout for full pipeline
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Pipeline failed: ${error}`);
        }

        return response.json();
    }

    /**
     * Export spritesheet
     */
    async exportSpritesheet(projectId: string): Promise<{ spritesheet_url: string }> {
        const response = await fetch(`${this.baseUrl}/api/export/spritesheet/${projectId}`, {
            method: 'GET',
            signal: AbortSignal.timeout(this.timeout),
        });

        if (!response.ok) {
            throw new Error(`Failed to export: ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Get project details
     */
    async getProject(projectId: string): Promise<SpriteProject> {
        const response = await fetch(`${this.baseUrl}/api/projects/${projectId}`, {
            method: 'GET',
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            throw new Error(`Project not found: ${projectId}`);
        }

        return response.json();
    }

    /**
     * List all animations for a project
     */
    async listAnimations(projectId: string): Promise<{
        animations: Array<{
            type: string;
            status: string;
            frame_count: number;
            spritesheet_url?: string;
        }>;
    }> {
        const response = await fetch(`${this.baseUrl}/api/pipeline/${projectId}/animations`, {
            method: 'GET',
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            throw new Error(`Failed to list animations: ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Get frames for a specific animation type
     */
    async getAnimationFrames(projectId: string, animationType: string): Promise<AnimationResult> {
        const response = await fetch(`${this.baseUrl}/api/pipeline/${projectId}/animations/${animationType}`, {
            method: 'GET',
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            return {
                project_id: projectId,
                status: 'not_found',
                frame_urls: [],
                frame_count: 0
            };
        }

        const data = await response.json();
        return {
            project_id: projectId,
            status: data.status || 'generated',
            frame_urls: data.frame_urls || [],
            spritesheet_url: data.spritesheet_url,
            frame_count: data.frame_urls?.length || 0
        };
    }

    /**
     * Get saved/edited frames for a project
     * Now uses animation-specific storage
     */
    async getProjectSprites(projectId: string, animationType: string = 'idle'): Promise<AnimationResult> {
        // First try animation-specific endpoint
        try {
            const result = await this.getAnimationFrames(projectId, animationType);
            if (result.status !== 'not_found' && result.frame_urls && result.frame_urls.length > 0) {
                return result;
            }
        } catch (e) {
            console.log(`[SpriteMancer] Animation-specific fetch failed, trying legacy:`, e);
        }

        // Fallback to legacy project-level frames endpoint
        try {
            const response = await fetch(`${this.baseUrl}/api/pipeline/${projectId}/frames`, {
                method: 'GET',
                signal: AbortSignal.timeout(15000),
            });

            if (response.ok) {
                const data = await response.json();
                return {
                    project_id: projectId,
                    status: 'saved',
                    frame_urls: data.frame_urls || [],
                    spritesheet_url: data.spritesheet_url,
                    frame_count: data.frame_urls?.length || 0
                };
            }
        } catch (e) {
            console.log(`[SpriteMancer] Failed to get saved frames:`, e);
        }

        // Fallback: return empty - caller should handle
        return {
            project_id: projectId,
            status: 'not_found',
            frame_urls: [],
            spritesheet_url: undefined,
            frame_count: 0
        };
    }

    // ============================================
    // PARALLAX BACKGROUND GENERATION
    // ============================================

    /**
     * Generate parallax background layers with true alpha transparency.
     * Uses difference matting for perfect transparency.
     */
    async generateParallaxBackground(
        prompt: string,
        options: {
            parallaxLayer?: 'far' | 'mid' | 'near' | 'full' | 'pack';
            timeOfDay?: 'day' | 'night' | 'sunset' | 'sunrise' | 'twilight';
            size?: string;
            useDifferenceMatte?: boolean;
        } = {}
    ): Promise<{
        asset_type: string;
        background_type: string;
        layers?: Array<{
            layer: string;
            image_base64: string;
            local_path: string;
            method: string;
        }>;
        image_base64?: string;
        local_path?: string;
        project_id: string;
    }> {
        const response = await fetch(`${this.baseUrl}/api/ai/generate-background`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                parallax_layer: options.parallaxLayer || 'pack',
                time_of_day: options.timeOfDay || 'day',
                size: options.size || '480x270',
                use_difference_matte: options.useDifferenceMatte ?? true,
            }),
        });

        if (!response.ok) {
            throw new Error(`Parallax generation failed: ${response.statusText}`);
        }

        return response.json();
    }

    // ============================================
    // TILE GENERATION
    // ============================================

    /**
     * Generate tileset for 2D games.
     */
    async generateTileset(
        prompt: string,
        options: {
            preset?: string;
            tileSize?: string;
            gridSize?: string;
            seamless?: boolean;
        } = {}
    ): Promise<{
        asset_type: string;
        tile_type: string;
        image_base64: string;
        local_path: string;
        project_id: string;
        dna?: Record<string, unknown>;
    }> {
        const response = await fetch(`${this.baseUrl}/api/ai/generate-tile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                preset: options.preset,
                tile_size: options.tileSize || '16x16',
                grid_size: options.gridSize || '4x4',
                seamless: options.seamless ?? true,
            }),
        });

        if (!response.ok) {
            throw new Error(`Tile generation failed: ${response.statusText}`);
        }

        return response.json();
    }

    // ============================================
    // EFFECT GENERATION
    // ============================================

    /**
     * Generate VFX effect sprites (explosions, fire, magic, etc.)
     */
    async generateEffect(
        prompt: string,
        options: {
            preset?: string;
            frameCount?: number;
            size?: string;
            looping?: boolean;
        } = {}
    ): Promise<{
        asset_type: string;
        effect_type: string;
        frame_count: number;
        frame_urls?: string[];
        spritesheet_url?: string;
        image_base64?: string;
        local_path: string;
        project_id: string;
        dna?: Record<string, unknown>;
    }> {
        const response = await fetch(`${this.baseUrl}/api/ai/generate-effect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                preset: options.preset,
                frame_count: options.frameCount || 8,
                size: options.size || '64x64',
                looping: options.looping ?? true,
            }),
        });

        if (!response.ok) {
            throw new Error(`Effect generation failed: ${response.statusText}`);
        }

        return response.json();
    }

    // ============================================
    // TILESET EXPORT (.tres)
    // ============================================

    /**
     * Export tileset as Godot 4.x .tres TileSet resource
     */
    async exportTilesetResource(params: {
        tileset_image_base64: string;
        tile_size?: number;
        tileset_type?: string;
        texture_path?: string;
        terrain_name?: string;
        terrain_color?: string;
        include_terrain?: boolean;
        include_physics?: boolean;
    }): Promise<{
        success: boolean;
        tres_base64?: string;
        image_base64?: string;
        tile_count?: number;
        terrain_configured?: boolean;
        texture_path?: string;
        message?: string;
        error?: string;
    }> {
        try {
            const response = await fetch(`${this.baseUrl}/api/tilesets/export-tileset-resource`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params),
                signal: AbortSignal.timeout(this.timeout),
            });

            if (!response.ok) {
                return { success: false, error: `Export failed: ${response.statusText}` };
            }

            return await response.json();
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Generate terrain tileset AND export as Godot .tres in one call
     */
    async generateAndExportTerrain(params: {
        preset?: string;
        terrain_type?: string;
        tile_size?: number;
        use_difference_matte?: boolean;
        include_physics?: boolean;
    }): Promise<{
        success: boolean;
        terrain_type?: string;
        tile_size?: number;
        tile_count?: number;
        image_base64?: string;
        tres_base64?: string;
        texture_path?: string;
        tres_path?: string;
        message?: string;
        error?: string;
    }> {
        try {
            const response = await fetch(`${this.baseUrl}/api/tilesets/generate-and-export-terrain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params),
                signal: AbortSignal.timeout(this.timeout * 2), // Longer timeout for generation
            });

            if (!response.ok) {
                return { success: false, error: `Generation failed: ${response.statusText}` };
            }

            return await response.json();
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }
}
