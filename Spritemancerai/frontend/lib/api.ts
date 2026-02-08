/**
 * SpriteMancer AI - API Client
 * Handles all backend API communication
 */

import type {
    Project,
    CharacterDNA,
    FrameBudget,
    IntentMirror,
    AnimationScript,
    DifficultyTier,
    Perspective,
    ActionSuggestion,
    DualPipelineStatus,
} from "./types";


const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

// User-friendly error messages
const ERROR_MESSAGES: Record<number, string> = {
    400: "Invalid request. Please check your input.",
    401: "Authentication required. Please log in.",
    403: "You don't have permission to do this.",
    404: "The requested resource was not found.",
    429: "Too many requests. Please wait a moment.",
    500: "Server error. Please try again.",
    502: "Server is temporarily unavailable.",
    503: "AI service is overloaded. Retrying...",
    504: "Request timed out. Please try again.",
};

class APIClient {
    private baseUrl: string;

    constructor(baseUrl: string = API_BASE) {
        this.baseUrl = baseUrl;
    }

    private async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {},
        retryCount: number = 0
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    "Content-Type": "application/json",
                    ...options.headers,
                },
            });

            if (!response.ok) {
                const status = response.status;

                // Check if we should retry
                if (RETRYABLE_STATUS_CODES.includes(status) && retryCount < MAX_RETRIES) {
                    const backoff = INITIAL_BACKOFF_MS * Math.pow(2, retryCount);
                    console.log(`⚠️ Request failed with ${status}, retrying in ${backoff}ms...`);
                    await this.sleep(backoff);
                    return this.request<T>(endpoint, options, retryCount + 1);
                }

                // Parse error detail from response
                const error = await response.json().catch(() => ({ detail: null }));
                const message = error.detail || ERROR_MESSAGES[status] || `Request failed (${status})`;
                throw new Error(message);
            }

            return response.json();
        } catch (err) {
            // Network errors (server not running, connection refused, etc.)
            if (err instanceof TypeError && err.message === "Failed to fetch") {
                if (retryCount < MAX_RETRIES) {
                    const backoff = INITIAL_BACKOFF_MS * Math.pow(2, retryCount);
                    console.log(`⚠️ Network error, retrying in ${backoff}ms...`);
                    await this.sleep(backoff);
                    return this.request<T>(endpoint, options, retryCount + 1);
                }
                throw new Error("Cannot connect to server. Please check if the backend is running.");
            }
            throw err;
        }
    }

    // --- Projects ---

    async createProject(name: string, description?: string): Promise<Project> {
        return this.request("/api/projects/", {
            method: "POST",
            body: JSON.stringify({ name, description }),
        });
    }

    async getProject(projectId: string): Promise<Project> {
        return this.request(`/api/projects/${projectId}`);
    }

    async listProjects(): Promise<{ projects: Project[] }> {
        return this.request("/api/projects/");
    }

    async uploadReferenceImage(projectId: string, file: File): Promise<{
        project_id: string;
        filename: string;
        status: string;
        url: string;
        dna: CharacterDNA;
    }> {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(
            `${this.baseUrl}/api/projects/${projectId}/reference-image`,
            {
                method: "POST",
                body: formData,
            }
        );

        if (!response.ok) {
            throw new Error("Failed to upload image");
        }

        return response.json();
    }

    // --- Pipeline ---

    async startPipeline(
        projectId: string,
        actionType: string,
        difficultyTier: DifficultyTier,
        perspective: Perspective = "side"
    ): Promise<{ pipeline_id: string; status: string }> {
        return this.request("/api/pipeline/start", {
            method: "POST",
            body: JSON.stringify({
                project_id: projectId,
                action_type: actionType,
                difficulty_tier: difficultyTier,
                perspective,
            }),
        });
    }

    async computeFrameBudget(
        projectId: string,
        actionType: string,
        difficultyTier: DifficultyTier,
        perspective: Perspective = "side"
    ): Promise<{
        frame_budget: FrameBudget;
        intent_summary: string;
    }> {
        return this.request("/api/pipeline/compute-budget", {
            method: "POST",
            body: JSON.stringify({
                project_id: projectId,
                action_type: actionType,
                difficulty_tier: difficultyTier,
                perspective,
            }),
        });
    }

    async editDNA(projectId: string, edits: Partial<CharacterDNA>): Promise<{ status: string }> {
        return this.request("/api/pipeline/dna/edit", {
            method: "POST",
            body: JSON.stringify({
                project_id: projectId,
                edits,
            }),
        });
    }

    async confirmIntent(projectId: string, confirmed: boolean, feedback?: string): Promise<{ status: string }> {
        return this.request("/api/pipeline/intent/confirm", {
            method: "POST",
            body: JSON.stringify({
                project_id: projectId,
                confirmed,
                feedback,
            }),
        });
    }

    async getPipelineStatus(projectId: string): Promise<{
        status: string;
        has_dna: boolean;
        has_script: boolean;
        has_frames: boolean;
    }> {
        return this.request(`/api/pipeline/${projectId}/status`);
    }

    async generateScript(
        projectId: string,
        actionType: string,
        difficultyTier: DifficultyTier,
        perspective: Perspective = "side"
    ): Promise<{
        project_id: string;
        status: string;
        animation_script: AnimationScript;
        frame_budget: FrameBudget | null;
        intent_summary: string;
    }> {
        return this.request("/api/pipeline/generate-script", {
            method: "POST",
            body: JSON.stringify({
                project_id: projectId,
                action_type: actionType,
                difficulty_tier: difficultyTier,
                perspective,
            }),
        });
    }

    async generateSprites(
        projectId: string,
        actionType: string,
        difficultyTier: DifficultyTier,
        perspective: Perspective = "side"
    ): Promise<{
        project_id: string;
        status: string;
        frame_urls: string[];
        spritesheet_url: string;
        frame_count: number;
    }> {
        return this.request("/api/pipeline/generate-sprites", {
            method: "POST",
            body: JSON.stringify({
                project_id: projectId,
                action_type: actionType,
                difficulty_tier: difficultyTier,
                perspective,
            }),
        });
    }

    async runPipeline(
        projectId: string,
        actionType: string,
        difficultyTier: DifficultyTier,
        perspective: Perspective = "side"
    ): Promise<{
        project_id: string;
        status: string;
        animation_script: AnimationScript | null;
        frame_urls: string[];
        spritesheet_url: string;
    }> {
        return this.request("/api/pipeline/run", {
            method: "POST",
            body: JSON.stringify({
                project_id: projectId,
                action_type: actionType,
                difficulty_tier: difficultyTier,
                perspective,
            }),
        });
    }

    async getAnimationScript(projectId: string): Promise<AnimationScript> {
        return this.request(`/api/pipeline/${projectId}/animation-script`);
    }

    async getFrames(projectId: string): Promise<{
        frame_urls: string[];
        spritesheet_url: string | null;
    }> {
        return this.request(`/api/pipeline/${projectId}/frames`);
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
        return this.request(`/api/pipeline/${projectId}/animations`);
    }

    /**
     * Get frames for a specific animation type
     */
    async getAnimationFrames(projectId: string, animationType: string): Promise<{
        animation_type: string;
        frame_urls: string[];
        spritesheet_url: string | null;
        status?: string;
    }> {
        // Add cache-busting timestamp to ensure fresh data
        const timestamp = Date.now();
        return this.request(`/api/pipeline/${projectId}/animations/${animationType}?t=${timestamp}`);
    }

    async repairFrame(
        projectId: string,
        frameIndex: number,
        instruction: string,
        maskData?: string, // Base64 encoded mask image
        character?: "instigator" | "responder" // Which character to repair (for dual mode)
    ): Promise<{ status: string; new_url: string }> {
        return this.request("/api/pipeline/repair", {
            method: "POST",
            body: JSON.stringify({
                project_id: projectId,
                frame_index: frameIndex,
                instruction,
                mask_data: maskData, // Optional: if provided, only repair masked area
                character: character || "instigator", // Default to instigator for single mode
            }),
        });
    }

    // --- Export methods moved to end of class ---


    // --- New: Pivot Override ---

    async updatePivots(projectId: string, pivots: Array<{ x: number; y: number }>): Promise<{ status: string }> {
        return this.request("/api/pipeline/update-pivots", {
            method: "POST",
            body: JSON.stringify({
                project_id: projectId,
                pivots,
            }),
        });
    }

    // --- New: Animation Script Update ---

    async updateScript(projectId: string, script: {
        frames: Array<{
            frame_index: number;
            phase: string;
            pose_description: string;
            visual_focus: string;
        }>;
    }): Promise<{ status: string }> {
        return this.request("/api/pipeline/update-script", {
            method: "POST",
            body: JSON.stringify({
                project_id: projectId,
                script,
            }),
        });
    }

    // --- New: Action Suggestions ---

    async suggestActions(projectId: string): Promise<{ suggestions: ActionSuggestion[] }> {
        return this.request(`/api/pipeline/${projectId}/suggest-actions`);
    }

    // --- Enhanced Export Methods ---

    async exportSpritesheet(
        projectId: string,
        format: "png" | "webp" | "gif" | "json",
        options: {
            includeMetadata?: boolean;
            transparent?: boolean;
        } = {}
    ): Promise<{ download_url: string; transparent: boolean }> {
        const { includeMetadata = true, transparent = true } = options;
        return this.request("/api/export/spritesheet", {
            method: "POST",
            body: JSON.stringify({
                project_id: projectId,
                format,
                include_metadata: includeMetadata,
                transparent,
            }),
        });
    }

    async exportFrames(
        projectId: string,
        format: "png" | "webp" | "gif" | "json",
        options: {
            includeMetadata?: boolean;
            transparent?: boolean;
            fps?: number;
        } = {}
    ): Promise<{ download_url: string; frame_count: number; type: string }> {
        const { includeMetadata = true, transparent = true, fps = 12 } = options;
        return this.request("/api/export/individual-frames", {
            method: "POST",
            body: JSON.stringify({
                project_id: projectId,
                format,
                include_metadata: includeMetadata,
                transparent,
                fps,
            }),
        });
    }

    async savePreviewGif(
        projectId: string,
        fps: number = 12
    ): Promise<{ status: string; preview_gif_url: string }> {
        return this.request("/api/export/save-preview-gif", {
            method: "POST",
            body: JSON.stringify({
                project_id: projectId,
                fps,
            }),
        });
    }

    // --- Manual Frame Editing ---

    async saveEditedFrame(
        projectId: string,
        frameIndex: number,
        imageBlob: Blob,
        character?: "instigator" | "responder" // Which character's frame (for dual mode)
    ): Promise<{ status: string; new_url: string; frame_index: number }> {
        const formData = new FormData();
        formData.append("project_id", projectId);
        formData.append("frame_index", frameIndex.toString());
        formData.append("image", imageBlob, `frame_${frameIndex}.png`);
        formData.append("character", character || "instigator");

        const url = `${this.baseUrl}/api/pipeline/save-edited-frame`;
        const response = await fetch(url, {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: null }));
            throw new Error(error.detail || "Failed to save edited frame");
        }

        return response.json();
    }

    // =======================================================
    // DUAL-CHARACTER ANIMATION API
    // =======================================================

    async uploadResponderImage(projectId: string, file: File): Promise<{
        project_id: string;
        filename: string;
        status: string;
        url: string;
    }> {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(
            `${this.baseUrl}/api/projects/${projectId}/responder-image`,
            {
                method: "POST",
                body: formData,
            }
        );

        if (!response.ok) {
            throw new Error("Failed to upload responder image");
        }

        return response.json();
    }

    async extractResponderDNA(projectId: string): Promise<{
        project_id: string;
        status: string;
        responder_dna: CharacterDNA;
    }> {
        return this.request(`/api/projects/${projectId}/responder-image/extract-dna`, {
            method: "POST",
        });
    }

    /**
     * Extract DNA for both instigator and responder in parallel.
     * For dual mode: uploads should already be complete before calling this.
     */
    async extractDualDNA(
        projectId: string,
        instigatorFile: File,
        responderFile: File
    ): Promise<{
        instigator_dna: CharacterDNA;
        responder_dna: CharacterDNA;
    }> {
        // Run both extractions in parallel
        const [instigatorResult, responderResult] = await Promise.all([
            this.uploadReferenceImage(projectId, instigatorFile),
            this.uploadResponderImage(projectId, responderFile).then(async () => {
                return this.extractResponderDNA(projectId);
            }),
        ]);

        return {
            instigator_dna: instigatorResult.dna,
            responder_dna: responderResult.responder_dna,
        };
    }

    async generateDualScript(
        projectId: string,
        actionType: string,
        difficultyTier: DifficultyTier,
        perspective: Perspective = "side"
    ): Promise<{
        project_id: string;
        status: string;
        instigator_dna: CharacterDNA;
        responder_dna: CharacterDNA;
        interaction: {
            reach_advantage: "A" | "B" | "equal";
            speed_advantage: "A" | "B" | "equal";
            mass_ratio: number;
            likely_responses: string[];
        };
        frame_budget: FrameBudget;
        suggested_responder_actions: {
            instigator_action: string;
            suggested_actions: Array<{
                action: string;
                reason: string;
                recommended: boolean;
            }>;
            requires_user_confirmation: boolean;
        };
    }> {
        return this.request("/api/pipeline/dual/generate-script", {
            method: "POST",
            body: JSON.stringify({
                project_id: projectId,
                action_type: actionType,
                difficulty_tier: difficultyTier,
                perspective,
            }),
        });
    }

    async confirmResponderAction(
        projectId: string,
        responderAction: string
    ): Promise<{
        project_id: string;
        status: string;
        instigator_script: AnimationScript;
        responder_script: AnimationScript;
        frame_count: number;
    }> {
        return this.request("/api/pipeline/dual/confirm-responder", {
            method: "POST",
            body: JSON.stringify({
                project_id: projectId,
                responder_action: responderAction,
            }),
        });
    }

    async generateDualSprites(
        projectId: string,
        actionType: string,
        difficultyTier: DifficultyTier,
        perspective: Perspective = "side"
    ): Promise<{
        project_id: string;
        status: string;
        instigator: {
            spritesheet_url: string;
            frame_urls: string[];
            frame_count: number;
        };
        responder: {
            spritesheet_url: string;
            frame_urls: string[];
            frame_count: number;
        };
    }> {
        return this.request("/api/pipeline/dual/generate-sprites", {
            method: "POST",
            body: JSON.stringify({
                project_id: projectId,
                action_type: actionType,
                difficulty_tier: difficultyTier,
                perspective,
            }),
        });
    }

    async getDualPipelineStatus(projectId: string): Promise<DualPipelineStatus> {
        return this.request(`/api/pipeline/dual/${projectId}/status`);
    }

    /**
     * Reprocess spritesheet with manual grid parameters.
     * Use when automatic extraction produces wrong results.
     */
    async reprocessSpritesheet(
        projectId: string,
        gridRows: number,
        gridCols: number,
        frameCount: number,
        character: "instigator" | "responder" = "instigator",
        animationType?: string  // NEW: specify which animation to reprocess
    ): Promise<{
        status: string;
        frame_count: number;
        frame_urls: string[];
        character: string;
        grid: string;
        animation_type?: string;
    }> {
        return this.request("/api/pipeline/reprocess", {
            method: "POST",
            body: JSON.stringify({
                project_id: projectId,
                grid_rows: gridRows,
                grid_cols: gridCols,
                frame_count: frameCount,
                character,
                animation_type: animationType,
            }),
        });
    }

    // =======================================================
    // LIGHTING MAPS API (Stage 7b)
    // =======================================================

    /**
     * Generate Normal Maps and Specular Maps for all frames.
     * Creates lighting textures from sprite luminance for dynamic lighting in game engines.
     */
    async generateLightingMaps(projectId: string): Promise<{
        project_id: string;
        status: string;
        frame_count: number;
        normal_map_url: string;
        specular_map_url: string;
    }> {
        return this.request(`/api/pipeline/${projectId}/generate-lighting-maps`, {
            method: "POST",
        });
    }

    /**
     * Get existing lighting maps for a project.
     * Returns URLs to Normal Map and Specular Map spritesheets.
     */
    async getLightingMaps(projectId: string): Promise<{
        project_id: string;
        has_lighting_maps: boolean;
        normal_map_url: string | null;
        specular_map_url: string | null;
    }> {
        return this.request(`/api/pipeline/${projectId}/lighting-maps`);
    }

    // =======================================================
    // VFX API - Particle & Smear Generation
    // =======================================================

    /**
     * Get available particle effect types.
     */
    async getParticleTypes(): Promise<{
        types: string[];
        descriptions: Record<string, string>;
    }> {
        return this.request("/api/vfx/particle-types");
    }

    /**
     * Generate particle sprites using Gemini AI.
     * Returns a horizontal spritesheet with animated frames.
     */
    async generateParticles(
        particleType: string,
        options: {
            palette?: string[];  // Hex colors from DNA
            size?: number;       // Particle size (16, 32, 64)
            frameCount?: number; // Animation frames (default 4)
        } = {}
    ): Promise<{
        image_base64: string;
        width: number;
        height: number;
        frame_count: number;
    }> {
        return this.request("/api/vfx/generate-particles", {
            method: "POST",
            body: JSON.stringify({
                particle_type: particleType,
                palette: options.palette,
                size: options.size || 32,
                frame_count: options.frameCount || 4,
            }),
        });
    }

    /**
     * Generate motion smear frame between two animation frames.
     */
    async generateSmear(
        frameBeforeBase64: string,
        frameAfterBase64: string,
        intensity: number = 0.5
    ): Promise<{
        smear_frame_base64: string;
    }> {
        return this.request("/api/vfx/generate-smear", {
            method: "POST",
            body: JSON.stringify({
                frame_before_base64: frameBeforeBase64,
                frame_after_base64: frameAfterBase64,
                intensity,
            }),
        });
    }

}

// Singleton instance
export const api = new APIClient();
export default api;


