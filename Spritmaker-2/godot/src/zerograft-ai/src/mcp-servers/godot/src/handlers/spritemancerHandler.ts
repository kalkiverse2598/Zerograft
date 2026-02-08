/**
 * SpriteMancer Handler - All SpriteMancer-related command processing
 * Extracted from aiRouter.ts handleSpriteMancerCommand method
 */

import * as fs from "fs/promises";
import * as path from "path";
import { SpriteMancerClient } from "../spritemancerClient.js";

export interface SpriteMancerContext {
    client: SpriteMancerClient;
    getProjectPath: () => string;
    isProjectPathDetected: () => boolean;
    sendToGodot: (method: string, params: Record<string, unknown>) => Promise<unknown>;
}

export class SpriteMancerHandler {
    constructor(private ctx: SpriteMancerContext) { }

    /**
     * Route SpriteMancer command to appropriate handler
     */
    async handle(method: string, params: Record<string, unknown>): Promise<unknown> {
        console.log(`[SpriteMancer] Handling: ${method}`);

        switch (method) {
            case "spritemancer_status":
                return this.status();

            case "spritemancer_create_character":
                return this.createCharacter(params);

            case "spritemancer_use_existing":
                return this.useExistingReference(params);

            case "spritemancer_animate":
                return this.animate(params);

            case "spritemancer_generate_animations":
                return this.generateAnimations(params);

            case "spritemancer_download_sprites":
                return this.downloadSprites(params);

            case "spritemancer_import":
                return this.importSprites(params);

            case "spritemancer_generate_asset":
                return this.generateAsset(params);

            case "spritemancer_open_panel":
                return this.openPanel(params);

            case "spritemancer_list_presets":
                return this.listPresets(params);

            case "spritemancer_open_in_editor":
                return this.openInEditor(params);

            case "spritemancer_approve_animation":
                return this.approveAnimation(params);

            case "spritemancer_retry_dna":
                return this.retryDnaExtraction(params);

            case "spritemancer_generate_parallax":
                return this.generateParallax(params);

            // TILE GENERATION TOOLS
            // ============================================
            case "spritemancer_create_tileset": // Alias for backward compatibility
            case "spritemancer_generate_terrain_tileset":
                return this.generateTerrainTileset(params);

            case "spritemancer_generate_platform_tiles":
                return this.generatePlatformTiles(params);

            case "spritemancer_generate_wall_tileset":
                return this.generateWallTileset(params);

            case "spritemancer_generate_decoration":
                return this.generateDecoration(params);

            case "spritemancer_generate_transition_tiles":
                return this.generateTransitionTiles(params);

            case "spritemancer_generate_animated_tile":
                return this.generateAnimatedTile(params);

            case "spritemancer_list_tileset_presets":
                return this.listTilesetPresets();

            case "spritemancer_export_tileset_resource":
                return this.exportTilesetResource(params);

            case "spritemancer_generate_and_export_terrain":
                return this.generateAndExportTerrain(params);

            default:
                throw new Error(`Unknown SpriteMancer command: ${method}`);
        }
    }

    // ============================================
    // Individual Command Handlers
    // ============================================

    private async status(): Promise<unknown> {
        const health = await this.ctx.client.checkHealth();
        return {
            running: health.healthy,
            error: health.error,
            backend_url: "https://api.zerograft.online"
        };
    }

    private async createCharacter(params: Record<string, unknown>): Promise<unknown> {
        // PHASE 1: Generate reference image only + open UI for user confirmation
        const description = params.description as string;
        const size = (params.size as string) || "32x32";
        const perspective = (params.perspective as string) || "side";

        console.log(`[SpriteMancer] ✨ Phase 1: Creating character reference: ${description}`);

        // Step 1: Check backend
        const health = await this.ctx.client.checkHealth();
        if (!health.healthy) {
            return {
                success: false,
                error: "SpriteMancer backend is unreachable at https://api.zerograft.online"
            };
        }

        // Step 2: Generate character
        console.log(`[SpriteMancer] 🎨 Generating reference image...`);
        const character = await this.ctx.client.generateCharacter(description, size, perspective);
        console.log(`[SpriteMancer] ✅ Character created: ${character.project_id}`);

        // Check db_synced from response (new field)
        const dbSynced = (character as { db_synced?: boolean }).db_synced ?? false;
        if (!dbSynced) {
            console.log(`[SpriteMancer] ⚠️ Backend db_sync failed, will attempt fallback sync`);
        }

        // Step 3: Save reference image to Godot project
        let savedPath = "";
        if (character.reference_image_base64) {
            if (!this.ctx.isProjectPathDetected() || !this.ctx.getProjectPath()) {
                console.error(`[SpriteMancer] ❌ Cannot save sprite: Project path not detected!`);
                return {
                    success: true,
                    phase: 1,
                    project_id: character.project_id,
                    description,
                    warning: "Character generated but could not save to Godot - project path not detected.",
                    reference_image_url: character.reference_image_url,
                    dna_ready: character.dna_extracted,
                    db_synced: dbSynced
                };
            }

            try {
                const projectPath = this.ctx.getProjectPath();
                const safeName = description.toLowerCase().replace(/[^a-z0-9]/g, "_").substring(0, 20);
                const shortId = character.project_id.substring(0, 8);
                const characterDir = path.join(projectPath, "sprites", `${safeName}_${shortId}`);
                await fs.mkdir(characterDir, { recursive: true });

                const filename = `reference.png`;
                const fullPath = path.join(characterDir, filename);
                const imageBuffer = Buffer.from(character.reference_image_base64, 'base64');
                await fs.writeFile(fullPath, imageBuffer);

                savedPath = `res://sprites/${safeName}_${shortId}/${filename}`;
                console.log(`[SpriteMancer] 💾 Reference saved: ${savedPath}`);

                try {
                    await this.ctx.sendToGodot("assets_update_file", { path: savedPath });
                } catch {
                    console.log(`[SpriteMancer] ⚠️ Could not update Godot filesystem`);
                }
            } catch (saveError) {
                console.error(`[SpriteMancer] ❌ Failed to save reference:`, saveError);
            }
        }

        // Step 3.5: Fallback sync if db_synced was false
        let syncSucceeded = dbSynced;
        let syncedUrl = character.reference_image_url;
        if (!dbSynced && character.reference_image_base64) {
            console.log(`[SpriteMancer] 🔄 Attempting fallback sync to Supabase...`);
            try {
                const syncResult = await this.ctx.client.syncReference(
                    character.project_id,
                    character.reference_image_base64,
                    description,
                    (character as { dna?: Record<string, unknown> }).dna
                );
                syncSucceeded = syncResult.success;
                syncedUrl = syncResult.reference_image_url;
                console.log(`[SpriteMancer] ✅ Fallback sync succeeded: ${syncedUrl}`);
            } catch (syncError) {
                console.error(`[SpriteMancer] ❌ Fallback sync failed:`, syncError);
                // Continue anyway - user can still drag-drop in embedded editor
            }
        }

        // Step 4: Open embedded SpriteMancer editor
        try {
            await this.ctx.sendToGodot("spritemancer_open_project", { project_id: character.project_id });
            console.log(`[SpriteMancer] 👁️ Opened embedded editor for user preview`);
        } catch (e) {
            console.log(`[SpriteMancer] ⚠️ Could not open embedded editor: ${e}`);
        }

        // Build response with sync status
        const response: Record<string, unknown> = {
            success: true,
            phase: 1,
            project_id: character.project_id,
            description,
            size,
            perspective,
            reference_image_url: syncedUrl,
            saved_to_godot: savedPath,
            dna_ready: character.dna_extracted,
            db_synced: syncSucceeded,
            editor_url: `https://spritemancer.zerograft.online/editor/${character.project_id}`,
            embedded_editor_opened: true,
            next_step: "ASK_USER_CONFIRMATION",
            message: `Character reference created! Ask the user if this looks good. If approved, call spritemancer_generate_animations with project_id="${character.project_id}".`
        };

        // Add drag-drop hint if sync failed
        if (!syncSucceeded) {
            response.sync_hint = `Database sync failed. User can drag ${savedPath} into the SpriteMancer DNA Lab to manually sync.`;
        }

        return response;
    }

    /**
     * Use an existing reference image from res:// folder.
     * Reads the file, uploads to backend, extracts DNA.
     */
    private async useExistingReference(params: Record<string, unknown>): Promise<unknown> {
        const resPath = params.reference_image_path as string;
        const characterName = params.character_name as string;
        const perspective = (params.perspective as string) || "side";

        console.log(`[SpriteMancer] 📁 Using existing reference: ${resPath}`);

        // Step 1: Validate project path
        if (!this.ctx.isProjectPathDetected() || !this.ctx.getProjectPath()) {
            return {
                success: false,
                error: "Project path not detected. Cannot read res:// files.",
                hint: "Ensure Godot project is open"
            };
        }

        // Step 2: Convert res:// to absolute path and read file
        const projectPath = this.ctx.getProjectPath();
        const relativePath = resPath.replace(/^res:\/\//, "");
        const absolutePath = path.join(projectPath, relativePath);

        let imageBuffer: Buffer;
        try {
            imageBuffer = await fs.readFile(absolutePath);
            console.log(`[SpriteMancer] 📖 Read ${imageBuffer.length} bytes from ${absolutePath}`);
        } catch (e) {
            console.error(`[SpriteMancer] ❌ File not found: ${absolutePath}`);
            return {
                success: false,
                error: `File not found: ${absolutePath}`,
                original_path: resPath,
                hint: "Use list_files to verify the path exists"
            };
        }

        // Step 3: Generate project_id and sync to backend
        const { randomUUID } = await import("crypto");
        const projectId = randomUUID();
        const imageBase64 = imageBuffer.toString('base64');

        console.log(`[SpriteMancer] 🔄 Syncing to backend with project_id: ${projectId}`);

        try {
            const syncResult = await this.ctx.client.syncReference(
                projectId,
                imageBase64,
                characterName
            );

            console.log(`[SpriteMancer] ✅ Synced! URL: ${syncResult.reference_image_url}`);

            // Step 4: Open in embedded editor
            try {
                await this.ctx.sendToGodot("spritemancer_open_project", { project_id: projectId });
                console.log(`[SpriteMancer] 👁️ Opened embedded editor`);
            } catch (e) {
                console.log(`[SpriteMancer] ⚠️ Could not open editor: ${e}`);
            }

            return {
                success: true,
                phase: 1,
                project_id: projectId,
                source: "existing_reference",
                reference_path: resPath,
                character_name: characterName,
                perspective,
                reference_image_url: syncResult.reference_image_url,
                dna_ready: !!syncResult.dna,
                dna: syncResult.dna,
                embedded_editor_opened: true,
                next_step: "ASK_USER_CONFIRMATION",
                message: `Using existing reference from ${resPath}. Character DNA extracted. Ask user if they want to generate animations for this character.`
            };
        } catch (syncError) {
            console.error(`[SpriteMancer] ❌ Sync failed:`, syncError);
            return {
                success: false,
                error: String(syncError),
                reference_path: resPath,
                hint: "Ensure SpriteMancer backend is running"
            };
        }
    }

    private async animate(params: Record<string, unknown>): Promise<unknown> {
        const projectId = params.project_id as string;
        const animation = params.animation as string;
        const difficulty = (params.difficulty as string)?.toUpperCase() || "LIGHT";

        const result = await this.ctx.client.runFullPipeline(
            projectId,
            animation,
            difficulty,
            "side",
            animation
        );

        return {
            success: true,
            project_id: projectId,
            animation,
            frame_count: result.frame_count,
            spritesheet_url: result.spritesheet_url
        };
    }

    private async generateAnimations(params: Record<string, unknown>): Promise<unknown> {
        // PHASE 2: Generate ONE animation for a confirmed character
        const projectId = params.project_id as string;
        const characterName = params.character_name as string || "character";
        const perspective = (params.perspective as string) || "side";

        // Accept single animation or array (legacy support)
        let animation: string;
        if (params.animation && typeof params.animation === "string") {
            animation = params.animation;
        } else if (params.animations) {
            const animations = Array.isArray(params.animations)
                ? params.animations
                : (params.animations as string).split(",").map(s => s.trim());
            animation = animations[0] || "idle";
            console.log(`[SpriteMancer] ⚠️ Multiple animations provided, only generating first: ${animation}`);
        } else {
            animation = "idle";
        }

        // DYNAMIC DIFFICULTY TIER: Determine based on character DNA
        let difficultyTier = ((params.difficulty_tier || params.difficulty) as string)?.toUpperCase();

        if (!difficultyTier) {
            // Fetch project DNA to determine appropriate tier
            try {
                console.log(`[SpriteMancer] 🔍 Fetching DNA for dynamic tier selection...`);
                const project = await this.ctx.client.getProject(projectId);
                const dna = project.character_dna;

                if (dna) {
                    // Map weapon_mass to difficulty tier
                    // Heavy/oversized weapons require HEAVY tier, others can use LIGHT
                    const weaponMass = (dna.weapon_mass || "none").toLowerCase();

                    if (weaponMass === "oversized") {
                        difficultyTier = "BOSS";
                        console.log(`[SpriteMancer] 🎯 DNA weapon_mass="${weaponMass}" → BOSS tier`);
                    } else if (weaponMass === "heavy") {
                        difficultyTier = "HEAVY";
                        console.log(`[SpriteMancer] 🎯 DNA weapon_mass="${weaponMass}" → HEAVY tier`);
                    } else if (weaponMass === "medium") {
                        difficultyTier = "HEAVY"; // Medium also benefits from HEAVY for complex animations
                        console.log(`[SpriteMancer] 🎯 DNA weapon_mass="${weaponMass}" → HEAVY tier`);
                    } else {
                        difficultyTier = "LIGHT";
                        console.log(`[SpriteMancer] 🎯 DNA weapon_mass="${weaponMass}" → LIGHT tier`);
                    }
                } else {
                    // No DNA - default to HEAVY for safety
                    difficultyTier = "HEAVY";
                    console.log(`[SpriteMancer] ⚠️ No DNA found, defaulting to HEAVY tier`);
                }
            } catch (dnaError) {
                // Failed to fetch DNA - default to HEAVY for best compatibility
                console.log(`[SpriteMancer] ⚠️ Could not fetch DNA: ${dnaError}, defaulting to HEAVY`);
                difficultyTier = "HEAVY";
            }
        }

        console.log(`[SpriteMancer] 🎬 Phase 2: Generating ${animation} for ${projectId} (difficulty: ${difficultyTier})`);

        // Try with specified difficulty tier, fallback to HEAVY if LIGHT fails
        let pipelineResult;
        try {
            pipelineResult = await this.ctx.client.runFullPipeline(
                projectId,
                animation,
                difficultyTier,
                perspective,
                animation
            );
        } catch (firstError) {
            // If LIGHT tier failed due to equipment incompatibility, retry with HEAVY
            if (difficultyTier === "LIGHT" && String(firstError).includes("difficulty tier")) {
                console.log(`[SpriteMancer] ⚠️ LIGHT tier failed, retrying with HEAVY...`);
                difficultyTier = "HEAVY";
                pipelineResult = await this.ctx.client.runFullPipeline(
                    projectId,
                    animation,
                    difficultyTier,
                    perspective,
                    animation
                );
            } else {
                throw firstError;
            }
        }

        console.log(`[SpriteMancer] ✅ ${animation} complete!`);
        const safeName = characterName.toLowerCase().replace(/[^a-z0-9]/g, "_").substring(0, 20);

        return {
            success: true,
            phase: 2,
            project_id: projectId,
            character_name: safeName,
            animation: animation,
            frame_count: pipelineResult.frame_urls?.length || 0,
            spritesheet_url: pipelineResult.spritesheet_url || "",
            message: `🎨 Generated "${animation}" animation with ${pipelineResult.frame_urls?.length || 0} frames.`,

            // Phase 3: Explicit next action guidance
            next_step: {
                description: `Ask user: "Does the ${animation} animation look good?" before proceeding.`,
                action: "ASK_USER_CONFIRMATION"
            },

            next_action: {
                if_approved: {
                    tool: "spritemancer_approve_animation",
                    description: `Call after user says yes/looks good/approved`,
                    params: {
                        project_id: projectId,
                        animation: animation,
                        character_name: safeName
                    }
                },
                if_rejected: {
                    tool: "spritemancer_generate_animations",
                    description: "Regenerate with modified parameters if user doesn't like it",
                    params: {
                        project_id: projectId,
                        animation: animation,
                        character_name: safeName
                    }
                }
            }
        };
    }

    private async downloadSprites(params: Record<string, unknown>): Promise<unknown> {
        // PHASE 3: Download and save sprites AFTER user approval
        const projectId = params.project_id as string;
        const characterName = params.character_name as string || "character";

        let animations: string[] = ["idle"];
        if (params.animations) {
            if (Array.isArray(params.animations)) {
                animations = params.animations as string[];
            } else if (typeof params.animations === "string") {
                animations = (params.animations as string).includes(",")
                    ? (params.animations as string).split(",").map(s => s.trim())
                    : [params.animations as string];
            }
        }

        console.log(`[SpriteMancer] 💾 Phase 3: Downloading ${animations.length} animation(s)`);

        if (!this.ctx.isProjectPathDetected() || !this.ctx.getProjectPath()) {
            return {
                success: false,
                error: "Cannot save - project path not detected.",
                project_id: projectId
            };
        }

        const projectPath = this.ctx.getProjectPath();
        const safeName = characterName.toLowerCase().replace(/[^a-z0-9]/g, "_").substring(0, 20);
        const shortId = projectId.substring(0, 8);
        const characterDir = path.join(projectPath, "sprites", `${safeName}_${shortId}`);
        await fs.mkdir(characterDir, { recursive: true });

        const generatedAnimations: { name: string; frames: string[] }[] = [];
        const allFramePaths: string[] = [];

        for (const anim of animations) {
            try {
                console.log(`[SpriteMancer] 📥 Fetching ${anim} frames...`);
                const pipelineResult = await this.ctx.client.getProjectSprites(projectId, anim);

                const animDir = path.join(characterDir, anim);
                await fs.mkdir(animDir, { recursive: true });

                const framePaths: string[] = [];

                if (pipelineResult.frame_urls && pipelineResult.frame_urls.length > 0) {
                    for (let i = 0; i < pipelineResult.frame_urls.length; i++) {
                        const frameUrl = pipelineResult.frame_urls[i];
                        const frameName = `${safeName}_${anim}_${String(i + 1).padStart(3, "0")}.png`;
                        const framePath = path.join(animDir, frameName);

                        try {
                            const response = await fetch(frameUrl);
                            if (response.ok) {
                                const arrayBuffer = await response.arrayBuffer();
                                await fs.writeFile(framePath, Buffer.from(arrayBuffer));
                                const resPath = `res://sprites/${safeName}_${shortId}/${anim}/${frameName}`;
                                framePaths.push(resPath);
                                allFramePaths.push(resPath);
                                console.log(`[SpriteMancer] 💾 Saved: ${frameName}`);
                            }
                        } catch (e) {
                            console.error(`[SpriteMancer] ⚠️ Failed to download frame ${i}:`, e);
                        }
                    }
                } else if (pipelineResult.spritesheet_url) {
                    console.log(`[SpriteMancer] 📥 Downloading spritesheet...`);
                    const response = await fetch(pipelineResult.spritesheet_url);
                    if (response.ok) {
                        const arrayBuffer = await response.arrayBuffer();
                        const spritesheetName = `${safeName}_${anim}_spritesheet.png`;
                        const spritesheetPath = path.join(animDir, spritesheetName);
                        await fs.writeFile(spritesheetPath, Buffer.from(arrayBuffer));

                        const resPath = `res://sprites/${safeName}_${shortId}/${anim}/${spritesheetName}`;
                        framePaths.push(resPath);
                        allFramePaths.push(resPath);
                    }
                }

                if (framePaths.length > 0) {
                    generatedAnimations.push({ name: anim, frames: framePaths });
                }
            } catch (error) {
                console.error(`[SpriteMancer] ❌ Failed to download ${anim}:`, error);
            }
        }

        // Phase 3b: Auto-create SpriteFrames resource
        let spriteFramesPath = "";
        if (generatedAnimations.length > 0) {
            try {
                console.log(`[SpriteMancer] 🎭 Creating SpriteFrames resource...`);
                await this.ctx.sendToGodot("assets_scan", {});
                await new Promise(resolve => setTimeout(resolve, 1000));

                const spriteFramesResPath = `res://sprites/${safeName}_${shortId}/${safeName}.tres`;
                const animationsData = generatedAnimations.map(anim => ({
                    name: anim.name,
                    fps: 12,
                    loop: true,
                    frames: anim.frames
                }));

                const result = await this.ctx.sendToGodot("create_sprite_frames_from_images", {
                    path: spriteFramesResPath,
                    animations: animationsData
                });

                if ((result as { success?: boolean }).success) {
                    spriteFramesPath = spriteFramesResPath;
                    console.log(`[SpriteMancer] ✅ SpriteFrames created: ${spriteFramesPath}`);
                }
            } catch (e) {
                console.error(`[SpriteMancer] ⚠️ Failed to create SpriteFrames:`, e);
            }
        }

        return {
            success: true,
            phase: 3,
            project_id: projectId,
            character_name: safeName,
            character_directory: `res://sprites/${safeName}_${shortId}/`,
            animations: generatedAnimations.map(a => a.name),
            frame_count: allFramePaths.length,
            sprite_frames_path: spriteFramesPath,
            ready_to_use: !!spriteFramesPath,
            message: spriteFramesPath
                ? `🎉 Saved ${allFramePaths.length} frames! SpriteFrames: "${spriteFramesPath}"`
                : `Saved ${allFramePaths.length} frames. SpriteFrames creation failed.`
        };
    }

    private async importSprites(params: Record<string, unknown>): Promise<unknown> {
        const projectId = params.project_id as string;
        const outputPath = params.output_path as string;

        const exportResult = await this.ctx.client.exportSpritesheet(projectId);

        try {
            await this.ctx.sendToGodot("assets_scan", {});
            console.log(`[SpriteMancer] 🔄 Filesystem rescanned`);
        } catch {
            console.log(`[SpriteMancer] ⚠️ Could not rescan filesystem`);
        }

        return {
            success: true,
            project_id: projectId,
            output_path: outputPath,
            spritesheet_url: exportResult.spritesheet_url,
            note: "Spritesheet ready. Filesystem rescanned."
        };
    }

    private async generateAsset(params: Record<string, unknown>): Promise<unknown> {
        const assetType = params.asset_type as string;
        const prompt = params.prompt as string;
        const size = (params.size as string) || "32x32";
        const frameCount = (params.frame_count as number) || 6;

        console.log(`[SpriteMancer] 🎨 Generating ${assetType}: ${prompt}`);

        const response = await fetch("https://api.zerograft.online/api/ai/generate-asset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                asset_type: assetType,
                prompt,
                size,
                frame_count: frameCount,
                remove_background: true
            })
        });

        if (!response.ok) {
            throw new Error(`Generation failed: ${response.statusText}`);
        }

        const result = await response.json();

        let savedPath = "";
        const imageBase64 = result.reference_image_base64 || result.spritesheet_base64;
        if (imageBase64 && this.ctx.getProjectPath()) {
            const filename = prompt.replace(/\s+/g, "_").toLowerCase().slice(0, 20) + ".png";
            const spritesDir = path.join(this.ctx.getProjectPath(), "sprites", "generated");
            await fs.mkdir(spritesDir, { recursive: true });
            savedPath = path.join(spritesDir, filename);
            const buffer = Buffer.from(imageBase64, "base64");
            await fs.writeFile(savedPath, buffer);
            console.log(`[SpriteMancer] 💾 Saved to ${savedPath}`);
        }

        return {
            success: true,
            asset_type: assetType,
            prompt,
            project_id: result.project_id,
            saved_to: savedPath ? `res://sprites/generated/${path.basename(savedPath)}` : null,
            message: savedPath ? `Generated ${assetType} saved to Godot project` : `Generated ${assetType}`
        };
    }

    private async openPanel(params: Record<string, unknown>): Promise<unknown> {
        const view = (params.view as string) || "dock";

        if (view === "browser") {
            const { exec } = await import("child_process");
            exec("open https://spritemancer.zerograft.online");
            return { success: true, message: "Opened SpriteMancer in browser" };
        }

        return {
            success: true,
            view,
            message: `SpriteMancer ${view} is available in Godot.`
        };
    }

    private async listPresets(params: Record<string, unknown>): Promise<unknown> {
        const assetType = params.asset_type as string;

        try {
            const response = await fetch("https://api.zerograft.online/api/ai/presets");
            if (response.ok) {
                const allPresets = await response.json();
                const presets = allPresets[assetType] || [];
                return {
                    success: true,
                    asset_type: assetType,
                    presets,
                    message: `Available ${assetType} presets: ${presets.join(", ") || "none"}`
                };
            }
        } catch {
            // Fallback to hardcoded presets
        }

        const fallbackPresets: Record<string, string[]> = {
            character: ["knight", "wizard", "archer", "slime"],
            effect: ["fire_explosion", "ice_shatter", "lightning_bolt", "smoke_puff"],
            tile: ["water", "lava", "grass"],
            ui: ["gold_coin", "red_heart", "blue_gem", "button"]
        };

        return {
            success: true,
            asset_type: assetType,
            presets: fallbackPresets[assetType] || [],
            message: `Available ${assetType} presets: ${(fallbackPresets[assetType] || []).join(", ")}`
        };
    }

    private async openInEditor(params: Record<string, unknown>): Promise<unknown> {
        const projectId = params.project_id as string;

        if (!projectId) {
            return { success: false, error: "project_id is required" };
        }

        console.log(`[SpriteMancer] 📺 Opening project in embedded editor: ${projectId}`);

        try {
            await this.ctx.sendToGodot("spritemancer_load_project", { project_id: projectId });

            return {
                success: true,
                project_id: projectId,
                editor_url: `https://spritemancer.zerograft.online/editor/${projectId}`,
                message: `Project ${projectId} opened in embedded editor`
            };
        } catch (e) {
            console.error(`[SpriteMancer] ⚠️ Could not open in embedded editor:`, e);
            return {
                success: false,
                project_id: projectId,
                editor_url: `https://spritemancer.zerograft.online/editor/${projectId}`,
                message: "Could not open in embedded editor - use external browser",
                error: String(e)
            };
        }
    }

    /**
     * Approve an animation and save to Godot project.
     * Combines: mark as approved in backend + download frames to res://
     */
    private async approveAnimation(params: Record<string, unknown>): Promise<unknown> {
        const projectId = params.project_id as string;
        const animationType = params.animation as string;
        const characterName = params.character_name as string || "character";

        if (!projectId || !animationType) {
            return {
                success: false,
                error: "project_id and animation are required"
            };
        }

        console.log(`[SpriteMancer] ✅ Approving ${animationType} animation for ${projectId}`);

        try {
            // Step 1: Mark animation as approved in backend
            const approveResponse = await fetch(
                `https://api.zerograft.online/api/pipeline/${projectId}/animations/${animationType}/approve`,
                { method: "POST" }
            );

            if (!approveResponse.ok) {
                console.error(`[SpriteMancer] ⚠️ Failed to mark ${animationType} as approved`);
            } else {
                console.log(`[SpriteMancer] ✓ ${animationType} marked as approved in database`);
            }

            // Step 1.5: Fetch ALL approved animations (including this one)
            // This ensures the SpriteFrames resource contains all animations, not just the latest
            let allApprovedAnimations: string[] = [animationType];
            try {
                const animList = await this.ctx.client.listAnimations(projectId);
                const approvedTypes: string[] = [];
                for (const anim of animList.animations) {
                    // Include animations that are approved OR is the current one we just approved
                    if (anim.status === 'approved' || anim.type === animationType) {
                        if (!approvedTypes.includes(anim.type)) {
                            approvedTypes.push(anim.type);
                        }
                    }
                }
                if (approvedTypes.length > 0) {
                    allApprovedAnimations = approvedTypes;
                    console.log(`[SpriteMancer] 📦 Including ${allApprovedAnimations.length} approved animations: ${allApprovedAnimations.join(', ')}`);
                }
            } catch (e) {
                console.log(`[SpriteMancer] ⚠️ Could not fetch animation list, using only current: ${animationType}`);
                // Fallback to just current animation
            }

            // Step 2: Download ALL approved animations to Godot (not just this one!)
            const downloadResult = await this.downloadSprites({
                project_id: projectId,
                character_name: characterName,
                animations: allApprovedAnimations
            }) as {
                sprite_frames_path?: string;
                character_directory?: string;
                success?: boolean;
            };

            // Extract sprite_frames_path for easy access
            const spriteFramesPath = downloadResult?.sprite_frames_path || "";
            const characterDir = downloadResult?.character_directory || "";

            // Step 3: Return success with explicit next action guidance
            return {
                success: true,
                phase: "approval",
                project_id: projectId,
                approved_animation: animationType,
                character_name: characterName,

                // Phase 3: Bubble up sprite_frames_path to top level for easy access
                sprite_frames_path: spriteFramesPath,
                character_directory: characterDir,

                // Include full download result for reference
                download_result: downloadResult,

                message: `✅ "${animationType}" approved and saved to Godot!`,

                // Phase 3: Explicit next action guidance
                next_action: {
                    description: spriteFramesPath
                        ? `Now create the player scene and assign the sprite frames. Use the path: "${spriteFramesPath}"`
                        : "Now create the player scene. Note: SpriteFrames creation failed, frames are saved as individual PNGs.",

                    recommended: {
                        tool: "setup_player_with_sprites",
                        description: "AUTOMATED: Creates complete player scene with CharacterBody2D, CollisionShape2D, AnimatedSprite2D, and movement script",
                        params: {
                            sprite_frames_path: spriteFramesPath,
                            player_name: characterName,
                            scene_path: `res://scenes/${characterName}.tscn`
                        }
                    },

                    alternative: {
                        description: "MANUAL: Create scene yourself with these steps",
                        steps: [
                            `1. create_scene(path="res://scenes/${characterName}.tscn", root_type="CharacterBody2D")`,
                            `2. add_node(parent=".", type="CollisionShape2D", name="CollisionShape2D")`,
                            `3. add_node(parent=".", type="AnimatedSprite2D", name="AnimatedSprite2D")`,
                            `4. set_property(node="AnimatedSprite2D", property="sprite_frames", value="${spriteFramesPath}")`
                        ]
                    }
                },

                // Reinforcement for LLM
                important_note: spriteFramesPath
                    ? `Use sprite_frames_path="${spriteFramesPath}" directly. DO NOT call list_files or assets_scan!`
                    : `SpriteFrames creation failed. Individual frame PNGs are in ${characterDir}. You may need to create SpriteFrames manually.`
            };
        } catch (error) {
            console.error(`[SpriteMancer] ❌ Approval failed:`, error);
            return {
                success: false,
                error: String(error),
                animation: animationType
            };
        }
    }

    /**
     * Retry DNA extraction for a project when it failed initially.
     */
    private async retryDnaExtraction(params: Record<string, unknown>): Promise<unknown> {
        const projectId = params.project_id as string;

        if (!projectId) {
            return {
                success: false,
                error: "project_id is required"
            };
        }

        console.log(`[SpriteMancer] 🧬 Retrying DNA extraction for ${projectId}`);

        try {
            const response = await fetch(
                `https://api.zerograft.online/api/projects/${projectId}/reference-image/extract-dna`,
                { method: "POST" }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
                return {
                    success: false,
                    error: errorData.detail || `Failed with status ${response.status}`,
                    project_id: projectId
                };
            }

            const result = await response.json();
            console.log(`[SpriteMancer] ✅ DNA re-extracted: ${result.dna?.archetype || "unknown"}`);

            return {
                success: true,
                project_id: projectId,
                dna: result.dna,
                message: `🧬 DNA extracted successfully! Archetype: ${result.dna?.archetype}. You can now generate animations.`
            };
        } catch (error) {
            console.error(`[SpriteMancer] ❌ DNA retry failed:`, error);
            return {
                success: false,
                error: String(error),
                project_id: projectId,
                message: "DNA extraction failed. This may be due to API quota limits - try again in a moment."
            };
        }
    }

    // ============================================
    // PARALLAX BACKGROUND GENERATION
    // ============================================

    private async generateParallax(params: Record<string, unknown>): Promise<unknown> {
        const prompt = params.prompt as string;
        const parallaxLayer = (params.parallax_layer as string) || "pack";
        const timeOfDay = (params.time_of_day as string) || "day";
        const size = (params.size as string) || "480x270";

        if (!prompt) {
            return {
                success: false,
                error: "prompt is required for parallax generation"
            };
        }

        console.log(`[SpriteMancer] 🌄 Generating parallax background: ${prompt}`);

        try {
            // Check backend health first
            const health = await this.ctx.client.checkHealth();
            if (!health.healthy) {
                return {
                    success: false,
                    error: "SpriteMancer backend not running. Start with: cd Spritemancerai/backend && uvicorn main:app --reload --port 8000"
                };
            }

            // Generate parallax background
            const result = await this.ctx.client.generateParallaxBackground(prompt, {
                parallaxLayer: parallaxLayer as 'far' | 'mid' | 'near' | 'full' | 'pack',
                timeOfDay: timeOfDay as 'day' | 'night' | 'sunset' | 'sunrise' | 'twilight',
                size
            });

            console.log(`[SpriteMancer] ✅ Parallax generated: ${result.project_id}`);

            // Build response based on layer type
            if (result.layers && result.layers.length > 0) {
                // Pack mode - multiple layers
                const projectPath = this.ctx.getProjectPath();
                const savedPaths: string[] = [];

                for (const layer of result.layers) {
                    const layerPath = `res://sprites/parallax/${layer.layer}_layer.png`;
                    const absolutePath = path.join(projectPath, layerPath.replace("res://", ""));

                    // Ensure directory exists
                    await fs.mkdir(path.dirname(absolutePath), { recursive: true });

                    // Save the layer image
                    const imageBuffer = Buffer.from(layer.image_base64, 'base64');
                    await fs.writeFile(absolutePath, imageBuffer);
                    savedPaths.push(layerPath);
                }

                // Trigger filesystem rescan
                await this.ctx.sendToGodot("scan_filesystem", {});

                return {
                    success: true,
                    project_id: result.project_id,
                    layer_count: result.layers.length,
                    layers: savedPaths,
                    message: `🌄 Generated ${result.layers.length} parallax layers! Use these paths with TextureRect or Sprite2D nodes in ParallaxLayer.`,
                    next_action: "Add ParallaxBackground node with ParallaxLayer children, assign textures from res://sprites/parallax/"
                };
            } else if (result.image_base64) {
                // Single layer mode
                const projectPath = this.ctx.getProjectPath();
                const layerPath = `res://sprites/parallax/background.png`;
                const absolutePath = path.join(projectPath, layerPath.replace("res://", ""));

                await fs.mkdir(path.dirname(absolutePath), { recursive: true });
                const imageBuffer = Buffer.from(result.image_base64, 'base64');
                await fs.writeFile(absolutePath, imageBuffer);

                await this.ctx.sendToGodot("scan_filesystem", {});

                return {
                    success: true,
                    project_id: result.project_id,
                    layer_path: layerPath,
                    message: `🌄 Generated parallax background! Saved to ${layerPath}`,
                    next_action: "Add ParallaxBackground with ParallaxLayer containing Sprite2D using this texture"
                };
            }

            return {
                success: false,
                error: "No image data returned from generation"
            };
        } catch (error) {
            console.error(`[SpriteMancer] ❌ Parallax generation failed:`, error);
            return {
                success: false,
                error: String(error)
            };
        }
    }

    // ============================================
    // TILE GENERATION TOOLS
    // ============================================

    private async generateTerrainTileset(params: Record<string, unknown>): Promise<unknown> {
        const preset = params.preset as string | undefined;
        const terrainType = params.terrain_type as string | undefined;
        const tileSize = (params.tile_size as number) || 32;
        const useDifferenceMatte = (params.use_difference_matte as boolean) || false;
        const colorPalette = params.color_palette as string[] | undefined;

        console.log(`[SpriteMancer] 🏔️ Generating terrain tileset...`);

        try {
            const response = await fetch("https://api.zerograft.online/api/tilesets/generate-terrain-tileset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    preset,
                    terrain_type: terrainType,
                    tile_size: tileSize,
                    use_difference_matte: useDifferenceMatte,
                    color_palette: colorPalette
                })
            });

            if (!response.ok) {
                throw new Error(`Generation failed: ${response.statusText}`);
            }

            const result = await response.json();
            return this.saveTilesetToProject(result, "terrain", result.terrain_type || "terrain");
        } catch (error) {
            console.error(`[SpriteMancer] ❌ Terrain tileset generation failed:`, error);
            return { success: false, error: String(error) };
        }
    }

    private async generatePlatformTiles(params: Record<string, unknown>): Promise<unknown> {
        const preset = params.preset as string | undefined;
        const material = params.material as string | undefined;
        const platformType = (params.platform_type as string) || "ground";
        const tileSize = (params.tile_size as number) || 32;
        const useDifferenceMatte = (params.use_difference_matte as boolean) || false;

        console.log(`[SpriteMancer] 🎮 Generating platform tiles...`);

        try {
            const response = await fetch("https://api.zerograft.online/api/tilesets/generate-platform-tiles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    preset,
                    material,
                    platform_type: platformType,
                    tile_size: tileSize,
                    use_difference_matte: useDifferenceMatte
                })
            });

            if (!response.ok) {
                throw new Error(`Generation failed: ${response.statusText}`);
            }

            const result = await response.json();
            return this.saveTilesetToProject(result, "platform", result.material || "platform");
        } catch (error) {
            console.error(`[SpriteMancer] ❌ Platform tile generation failed:`, error);
            return { success: false, error: String(error) };
        }
    }

    private async generateWallTileset(params: Record<string, unknown>): Promise<unknown> {
        const preset = params.preset as string | undefined;
        const wallType = params.wall_type as string | undefined;
        const wallStyle = (params.wall_style as string) || "weathered";
        const tileSize = (params.tile_size as number) || 32;
        const useDifferenceMatte = (params.use_difference_matte as boolean) || false;

        console.log(`[SpriteMancer] 🧱 Generating wall tileset...`);

        try {
            const response = await fetch("https://api.zerograft.online/api/tilesets/generate-wall-tileset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    preset,
                    wall_type: wallType,
                    wall_style: wallStyle,
                    tile_size: tileSize,
                    use_difference_matte: useDifferenceMatte
                })
            });

            if (!response.ok) {
                throw new Error(`Generation failed: ${response.statusText}`);
            }

            const result = await response.json();
            return this.saveTilesetToProject(result, "wall", result.wall_type || "wall");
        } catch (error) {
            console.error(`[SpriteMancer] ❌ Wall tileset generation failed:`, error);
            return { success: false, error: String(error) };
        }
    }

    private async generateDecoration(params: Record<string, unknown>): Promise<unknown> {
        const preset = params.preset as string | undefined;
        const decorationType = params.decoration_type as string | undefined;
        const size = (params.size as string) || "32x32";
        const variationCount = (params.variation_count as number) || 1;
        const useDifferenceMatte = (params.use_difference_matte as boolean) || false;

        console.log(`[SpriteMancer] 🎨 Generating decoration...`);

        try {
            const response = await fetch("https://api.zerograft.online/api/tilesets/generate-decoration", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    preset,
                    decoration_type: decorationType,
                    size,
                    variation_count: variationCount,
                    use_difference_matte: useDifferenceMatte
                })
            });

            if (!response.ok) {
                throw new Error(`Generation failed: ${response.statusText}`);
            }

            const result = await response.json();
            return this.saveTilesetToProject(result, "decoration", result.decoration_type || "decoration");
        } catch (error) {
            console.error(`[SpriteMancer] ❌ Decoration generation failed:`, error);
            return { success: false, error: String(error) };
        }
    }

    private async generateTransitionTiles(params: Record<string, unknown>): Promise<unknown> {
        const fromTerrain = params.from_terrain as string;
        const toTerrain = params.to_terrain as string;
        const tileSize = (params.tile_size as number) || 32;
        const transitionStyle = (params.transition_style as string) || "scattered";

        if (!fromTerrain || !toTerrain) {
            return { success: false, error: "from_terrain and to_terrain are required" };
        }

        console.log(`[SpriteMancer] 🔄 Generating ${fromTerrain}→${toTerrain} transition tiles...`);

        try {
            const response = await fetch("https://api.zerograft.online/api/tilesets/generate-transition-tiles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    from_terrain: fromTerrain,
                    to_terrain: toTerrain,
                    tile_size: tileSize,
                    transition_style: transitionStyle
                })
            });

            if (!response.ok) {
                throw new Error(`Generation failed: ${response.statusText}`);
            }

            const result = await response.json();
            return this.saveTilesetToProject(result, "transition", `${fromTerrain}_to_${toTerrain}`);
        } catch (error) {
            console.error(`[SpriteMancer] ❌ Transition tile generation failed:`, error);
            return { success: false, error: String(error) };
        }
    }

    private async generateAnimatedTile(params: Record<string, unknown>): Promise<unknown> {
        const preset = params.preset as string | undefined;
        const tileType = params.tile_type as string | undefined;
        const animationStyle = params.animation_style as string | undefined;
        const frameCount = (params.frame_count as number) || 4;
        const tileSize = (params.tile_size as number) || 32;

        console.log(`[SpriteMancer] 💧 Generating animated tile...`);

        try {
            const response = await fetch("https://api.zerograft.online/api/tilesets/generate-animated-tile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    preset,
                    tile_type: tileType,
                    animation_style: animationStyle,
                    frame_count: frameCount,
                    tile_size: tileSize
                })
            });

            if (!response.ok) {
                throw new Error(`Generation failed: ${response.statusText}`);
            }

            const result = await response.json();
            return this.saveTilesetToProject(result, "animated", result.tile_type || "animated");
        } catch (error) {
            console.error(`[SpriteMancer] ❌ Animated tile generation failed:`, error);
            return { success: false, error: String(error) };
        }
    }

    private async listTilesetPresets(): Promise<unknown> {
        console.log(`[SpriteMancer] 📋 Fetching tileset presets...`);

        try {
            const response = await fetch("https://api.zerograft.online/api/tilesets/tileset-presets");
            if (!response.ok) {
                throw new Error(`Failed to fetch presets: ${response.statusText}`);
            }

            const presets = await response.json();
            return {
                success: true,
                presets,
                message: "Available tileset presets for quick generation"
            };
        } catch (error) {
            console.error(`[SpriteMancer] ❌ Failed to fetch presets:`, error);
            return {
                success: false,
                error: String(error),
                presets: {
                    terrain_presets: ["grass_meadow", "dirt_path", "stone_floor"],
                    platform_presets: ["grass_platform", "stone_platform", "wooden_platform"],
                    wall_presets: ["dungeon_walls", "castle_walls", "cave_walls"],
                    decoration_presets: ["wooden_crate", "barrel", "bush", "rock"],
                    animated_presets: ["calm_water", "bubbling_lava", "torch_fire"]
                }
            };
        }
    }

    /**
     * Helper to save generated tileset to Godot project
     */
    private async saveTilesetToProject(
        result: { image_base64?: string; asset_type?: string;[key: string]: unknown },
        category: string,
        name: string
    ): Promise<unknown> {
        if (!result.image_base64) {
            return {
                success: true,
                ...result,
                message: "Tileset generated (no local save - base64 image available)"
            };
        }

        if (!this.ctx.isProjectPathDetected() || !this.ctx.getProjectPath()) {
            return {
                success: true,
                ...result,
                saved_to_godot: null,
                warning: "Generated but could not save to Godot - project path not detected"
            };
        }

        try {
            const projectPath = this.ctx.getProjectPath();
            const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, "_").substring(0, 20);
            const timestamp = Date.now().toString(36);
            const tilesDir = path.join(projectPath, "sprites", "tilesets", category);
            await fs.mkdir(tilesDir, { recursive: true });

            const filename = `${safeName}_${timestamp}.png`;
            const fullPath = path.join(tilesDir, filename);
            const imageBuffer = Buffer.from(result.image_base64, 'base64');
            await fs.writeFile(fullPath, imageBuffer);

            const savedPath = `res://sprites/tilesets/${category}/${filename}`;
            console.log(`[SpriteMancer] 💾 Tileset saved: ${savedPath}`);

            // Trigger filesystem rescan
            try {
                await this.ctx.sendToGodot("assets_scan", {});
            } catch {
                console.log(`[SpriteMancer] ⚠️ Could not rescan filesystem`);
            }

            return {
                success: true,
                ...result,
                saved_to_godot: savedPath,
                message: `✅ Tileset generated and saved to ${savedPath}`,
                next_action: `Use this tileset with TileMap or TileSet resource in Godot`
            };
        } catch (error) {
            console.error(`[SpriteMancer] ❌ Failed to save tileset:`, error);
            return {
                success: true,
                ...result,
                saved_to_godot: null,
                save_error: String(error)
            };
        }
    }

    // ============================================
    // TILESET EXPORT METHODS
    // ============================================

    private async exportTilesetResource(params: Record<string, unknown>): Promise<unknown> {
        console.log(`[SpriteMancer] 📦 Exporting tileset as Godot .tres resource`);

        const result = await this.ctx.client.exportTilesetResource({
            tileset_image_base64: params.tileset_image_base64 as string,
            tile_size: (params.tile_size as number) || 32,
            tileset_type: (params.tileset_type as string) || "terrain",
            texture_path: (params.texture_path as string) || "res://sprites/tilesets/tileset.png",
            terrain_name: (params.terrain_name as string) || "terrain_0",
            terrain_color: (params.terrain_color as string) || "4a7023",
            include_terrain: params.include_terrain !== false,
            include_physics: params.include_physics === true,
        });

        if (!result.success) {
            return {
                success: false,
                error: result.error || "Export failed",
                message: `❌ Failed to export tileset resource`
            };
        }

        // Save .tres file to Godot project
        try {
            const tresPath = (params.texture_path as string || "res://sprites/tilesets/tileset.png").replace(".png", ".tres");
            const tresContent = result.tres_base64 ? atob(result.tres_base64) : "";

            await this.ctx.sendToGodot("create_script", {
                path: tresPath,
                content: tresContent,
            });

            // Trigger filesystem rescan
            try {
                await this.ctx.sendToGodot("assets_scan", {});
            } catch {
                console.log(`[SpriteMancer] ⚠️ Could not rescan filesystem`);
            }

            return {
                tres_saved_to: tresPath,
                tile_count: result.tile_count,
                terrain_configured: result.terrain_configured,
                message: `✅ TileSet resource exported to ${tresPath}`,
                next_action: `Load the TileSet resource in a TileMapLayer node`,
                success: true,
            };
        } catch (error) {
            console.error(`[SpriteMancer] ❌ Failed to save .tres:`, error);
            return {
                tile_count: result.tile_count,
                save_error: String(error),
                message: `⚠️ Export succeeded but could not save to Godot project`,
                success: true,
            };
        }
    }

    private async generateAndExportTerrain(params: Record<string, unknown>): Promise<unknown> {
        console.log(`[SpriteMancer] 🏔️ Generating terrain tileset with Godot export`);

        const result = await this.ctx.client.generateAndExportTerrain({
            preset: params.preset as string | undefined,
            terrain_type: params.terrain_type as string | undefined,
            tile_size: (params.tile_size as number) || 32,
            use_difference_matte: params.use_difference_matte === true,
            include_physics: params.include_physics !== false,  // Default to true for terrain
        });

        if (!result.success) {
            return {
                success: false,
                error: result.error || "Generation failed",
                message: `❌ Failed to generate terrain tileset`
            };
        }

        // Save PNG and .tres to Godot project
        try {
            const terrainName = (params.preset as string) || (params.terrain_type as string) || "terrain";
            const pngPath = `res://sprites/tilesets/${terrainName}_tileset.png`;
            const tresPath = `res://sprites/tilesets/terrain/${terrainName}_tileset.tres`;

            // Step 1: Save PNG image to Godot project
            if (result.image_base64 && this.ctx.isProjectPathDetected()) {
                const projectPath = this.ctx.getProjectPath();
                const pngRelPath = pngPath.replace(/^res:\/\//, "");
                const pngFullPath = path.join(projectPath, pngRelPath);

                // Ensure directory exists
                await fs.mkdir(path.dirname(pngFullPath), { recursive: true });

                // Write PNG file
                const imageBuffer = Buffer.from(result.image_base64, 'base64');
                await fs.writeFile(pngFullPath, imageBuffer);
                console.log(`[SpriteMancer] 💾 PNG saved: ${pngPath}`);
            }

            // Step 2: Save .tres content
            const tresContent = result.tres_base64 ? Buffer.from(result.tres_base64, 'base64').toString('utf-8') : "";
            await this.ctx.sendToGodot("create_script", {
                path: tresPath,
                content: tresContent,
            });

            // Trigger filesystem rescan
            try {
                await this.ctx.sendToGodot("assets_scan", {});
            } catch {
                console.log(`[SpriteMancer] ⚠️ Could not rescan filesystem`);
            }

            return {
                success: true,
                terrain_type: result.terrain_type,
                tile_size: result.tile_size,
                tile_count: result.tile_count,
                png_path: pngPath,
                tres_path: tresPath,
                message: `✅ Terrain tileset generated and saved! PNG: ${pngPath}, TileSet: ${tresPath}`,
                next_action: `Add a TileMapLayer node and assign this TileSet resource`
            };
        } catch (error) {
            console.error(`[SpriteMancer] ❌ Failed to save terrain files:`, error);
            return {
                success: true,
                terrain_type: result.terrain_type,
                tile_size: result.tile_size,
                tile_count: result.tile_count,
                save_error: String(error),
                message: `⚠️ Generation succeeded but could not save to Godot project`
            };
        }
    }
}
