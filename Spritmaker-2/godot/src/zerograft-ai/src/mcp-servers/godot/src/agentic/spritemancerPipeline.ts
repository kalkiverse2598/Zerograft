/**
 * SpriteMancer Pipeline - Automated sprite import to Godot
 * 
 * Handles the full pipeline from SpriteMancer output to 
 * ready-to-use AnimatedSprite2D nodes.
 */

import { ToolCall, createSuccessResult, createErrorResult, ErrorCode, ToolResult } from './types.js';

// ============================================
// Import Settings for Pixel Art
// ============================================

export interface PixelArtImportSettings {
    /** Disable texture filtering for crisp pixels */
    filter: boolean;
    /** Disable mipmaps for 2D pixel art */
    mipmaps: boolean;
    /** Use lossless compression */
    compress_mode: 'lossless' | 'lossy' | 'vram';
    /** Detect 3x3 slices for nine-patch */
    detect_3d: boolean;
}

export const DEFAULT_PIXEL_ART_SETTINGS: PixelArtImportSettings = {
    filter: false,
    mipmaps: false,
    compress_mode: 'lossless',
    detect_3d: false
};

// ============================================
// Animation Metadata
// ============================================

export interface AnimationMeta {
    name: string;
    fps: number;
    loop: boolean;
    frameCount: number;
    startFrame?: number;  // For sprite sheet slicing
}

export interface SpriteSheetMeta {
    /** Path to the sprite sheet image */
    imagePath: string;
    /** Frame dimensions */
    frameWidth: number;
    frameHeight: number;
    /** Animations within the sheet */
    animations: AnimationMeta[];
    /** Total columns in sprite sheet */
    columns: number;
    /** Total rows in sprite sheet */
    rows: number;
}

// ============================================
// Create Animated Sprite Tool Schema
// ============================================

export interface CreateAnimatedSpriteParams {
    /** SpriteMancer project ID to fetch sprites from */
    project_id: string;
    /** Parent node path (e.g., "/root/Player") */
    parent_node: string;
    /** Name for the new AnimatedSprite2D node */
    node_name: string;
    /** Animation definitions */
    animations: {
        name: string;
        fps: number;
        loop: boolean;
    }[];
    /** Import settings for pixel art */
    import_settings?: Partial<PixelArtImportSettings>;
    /** Output path for sprites (default: res://sprites/{name}/) */
    output_path?: string;
}

// ============================================
// Pipeline Steps
// ============================================

export interface PipelineStep {
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    message?: string;
}

export class SpriteMancerPipeline {
    private steps: PipelineStep[] = [];
    private onProgress?: (step: string, percent: number) => void;

    constructor(onProgress?: (step: string, percent: number) => void) {
        this.onProgress = onProgress;
    }

    /**
     * Execute full pipeline: Download → Import → SpriteFrames → AnimatedSprite2D
     */
    async execute(
        params: CreateAnimatedSpriteParams,
        fetchSprites: (projectId: string) => Promise<SpriteSheetMeta>,
        executeGodot: (name: string, params: Record<string, unknown>) => Promise<unknown>
    ): Promise<ToolResult> {
        this.steps = [
            { name: 'Fetching sprites', status: 'pending' },
            { name: 'Downloading images', status: 'pending' },
            { name: 'Applying import settings', status: 'pending' },
            { name: 'Creating SpriteFrames', status: 'pending' },
            { name: 'Creating AnimatedSprite2D', status: 'pending' }
        ];

        try {
            // Step 1: Fetch sprite metadata from SpriteMancer
            this.updateStep(0, 'running');
            this.onProgress?.('Fetching sprites from SpriteMancer...', 10);

            const spriteMeta = await fetchSprites(params.project_id);
            this.updateStep(0, 'completed');

            // Step 2: Download and save images to Godot project
            this.updateStep(1, 'running');
            this.onProgress?.('Downloading sprite sheet...', 30);

            const outputPath = params.output_path || `res://sprites/${params.node_name}/`;
            const savedPath = await this.downloadSprites(spriteMeta, outputPath, executeGodot);
            this.updateStep(1, 'completed');

            // Step 3: Apply pixel art import settings
            this.updateStep(2, 'running');
            this.onProgress?.('Applying pixel art import preset...', 50);

            const importSettings = { ...DEFAULT_PIXEL_ART_SETTINGS, ...params.import_settings };
            await this.applyImportSettings(savedPath, importSettings, executeGodot);
            this.updateStep(2, 'completed');

            // Step 4: Create SpriteFrames resource
            this.updateStep(3, 'running');
            this.onProgress?.('Creating SpriteFrames resource...', 70);

            const framesPaths = await this.createSpriteFrames(
                spriteMeta,
                params.animations,
                savedPath,
                params.node_name,
                executeGodot
            );
            this.updateStep(3, 'completed');

            // Step 5: Create AnimatedSprite2D node
            this.updateStep(4, 'running');
            this.onProgress?.('Creating AnimatedSprite2D node...', 90);

            await this.createAnimatedSprite(
                params.parent_node,
                params.node_name,
                framesPaths.resourcePath,
                params.animations[0]?.name || 'default',
                executeGodot
            );
            this.updateStep(4, 'completed');

            this.onProgress?.('Pipeline complete!', 100);

            return createSuccessResult({
                node_path: `${params.parent_node}/${params.node_name}`,
                sprite_frames: framesPaths.resourcePath,
                animations: params.animations.map(a => a.name),
                output_folder: outputPath
            }, `Created AnimatedSprite2D '${params.node_name}' with ${params.animations.length} animations`);

        } catch (error) {
            const failedStep = this.steps.find(s => s.status === 'running');
            if (failedStep) {
                failedStep.status = 'failed';
                failedStep.message = String(error);
            }

            return createErrorResult(
                ErrorCode.TOOL_FAILURE,
                `Pipeline failed at '${failedStep?.name}': ${error}`,
                true
            );
        }
    }

    private updateStep(index: number, status: PipelineStep['status'], message?: string): void {
        if (this.steps[index]) {
            this.steps[index].status = status;
            if (message) this.steps[index].message = message;
        }
    }

    private async downloadSprites(
        meta: SpriteSheetMeta,
        outputPath: string,
        executeGodot: (name: string, params: Record<string, unknown>) => Promise<unknown>
    ): Promise<string> {
        // Create output directory (Godot uses create_folder)
        await executeGodot('create_folder', { path: outputPath });

        // For now, assume the sprite sheet is already accessible
        // In real implementation, this would download from SpriteMancer API
        const savedPath = `${outputPath}${meta.imagePath.split('/').pop()}`;

        return savedPath;
    }

    private async applyImportSettings(
        imagePath: string,
        settings: PixelArtImportSettings,
        executeGodot: (name: string, params: Record<string, unknown>) => Promise<unknown>
    ): Promise<void> {
        // Note: Godot's import settings are handled via .import files
        // For pixel art, we set filter=false, mipmaps=false
        // This would be done via editor settings or resource import config

        // Update specific file in Godot filesystem (synchronous, more reliable)
        try {
            await executeGodot('assets_update_file', { path: imagePath });
            console.log(`[Pipeline] File updated in Godot: ${imagePath}`);
        } catch (e) {
            // Fallback to scan if update_file not available
            try {
                await executeGodot('assets_scan', {});
                console.log(`[Pipeline] Filesystem scan triggered for: ${imagePath}`);
            } catch (e2) {
                console.log(`[Pipeline] assets_scan failed, continuing: ${e2}`);
            }
        }
    }

    private async createSpriteFrames(
        meta: SpriteSheetMeta,
        animations: { name: string; fps: number; loop: boolean }[],
        spritePath: string,
        baseName: string,
        executeGodot: (name: string, params: Record<string, unknown>) => Promise<unknown>
    ): Promise<{ resourcePath: string }> {
        const resourcePath = spritePath.replace(/\/[^/]+$/, `/${baseName}.tres`);

        // Create SpriteFrames resource
        await executeGodot('create_sprite_frames', {
            path: resourcePath,
            sprite_sheet: spritePath,
            frame_width: meta.frameWidth,
            frame_height: meta.frameHeight,
            columns: meta.columns,
            animations: animations.map((anim, i) => ({
                name: anim.name,
                fps: anim.fps,
                loop: anim.loop,
                frames: this.getFrameIndices(i, meta)
            }))
        });

        return { resourcePath };
    }

    private getFrameIndices(animIndex: number, meta: SpriteSheetMeta): number[] {
        // Get frame indices for this animation
        const anim = meta.animations[animIndex];
        if (!anim) return [0];

        const startFrame = anim.startFrame ?? (animIndex * meta.columns);
        return Array.from(
            { length: anim.frameCount },
            (_, i) => startFrame + i
        );
    }

    private async createAnimatedSprite(
        parentPath: string,
        nodeName: string,
        spriteFramesPath: string,
        defaultAnimation: string,
        executeGodot: (name: string, params: Record<string, unknown>) => Promise<unknown>
    ): Promise<void> {
        // Add AnimatedSprite2D node (Godot uses parent/type/name)
        await executeGodot('add_node', {
            parent: parentPath,
            type: 'AnimatedSprite2D',
            name: nodeName
        });

        // Set the sprite frames (Godot uses node/property/value)
        await executeGodot('set_property', {
            node: `${parentPath}/${nodeName}`,
            property: 'sprite_frames',
            value: `load("${spriteFramesPath}")`
        });

        // Set default animation
        await executeGodot('set_property', {
            node: `${parentPath}/${nodeName}`,
            property: 'animation',
            value: defaultAnimation
        });

        // Enable autoplay
        await executeGodot('set_property', {
            node: `${parentPath}/${nodeName}`,
            property: 'autoplay',
            value: defaultAnimation
        });
    }

    getSteps(): PipelineStep[] {
        return [...this.steps];
    }
}

// ============================================
// Naming Convention Helpers
// ============================================

export function getSpritePath(characterName: string, animationName?: string): string {
    const baseName = characterName.toLowerCase().replace(/\s+/g, '_');
    if (animationName) {
        return `res://sprites/${baseName}/${baseName}_${animationName.toLowerCase()}.png`;
    }
    return `res://sprites/${baseName}/`;
}

export function getSpriteFramesPath(characterName: string): string {
    const baseName = characterName.toLowerCase().replace(/\s+/g, '_');
    return `res://sprites/${baseName}/${baseName}.tres`;
}
