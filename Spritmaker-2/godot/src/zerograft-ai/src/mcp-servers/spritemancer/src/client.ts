/**
 * SpriteMancer Client - HTTP client for local SpriteMancer backend
 */

const SPRITEMANCER_URL = "http://localhost:8000";

interface GenerateResult {
    id: string;
    previewUrl: string;
}

interface AnimationResult {
    id: string;
    frameCount: number;
    frames: string[];
}

interface DNA {
    pose: string;
    colors: string[];
    style: string;
}

interface ExportResult {
    path: string;
}

export class SpriteMancerClient {
    private baseUrl: string;

    constructor(baseUrl: string = SPRITEMANCER_URL) {
        this.baseUrl = baseUrl;
    }

    async generateCharacter(prompt: string, style?: string, perspective?: string): Promise<GenerateResult> {
        const response = await fetch(`${this.baseUrl}/api/generate/character`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, style: style || "32x32", perspective: perspective || "side" }),
        });

        if (!response.ok) {
            throw new Error(`SpriteMancer error: ${response.statusText}`);
        }

        return response.json();
    }

    async generateAnimation(characterId: string, animation: string, frameCount?: number): Promise<AnimationResult> {
        const response = await fetch(`${this.baseUrl}/api/generate/animation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ characterId, animation, frameCount: frameCount || 8 }),
        });

        if (!response.ok) {
            throw new Error(`SpriteMancer error: ${response.statusText}`);
        }

        return response.json();
    }

    async extractDNA(characterId: string): Promise<DNA> {
        const response = await fetch(`${this.baseUrl}/api/dna/extract`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ characterId }),
        });

        if (!response.ok) {
            throw new Error(`SpriteMancer error: ${response.statusText}`);
        }

        return response.json();
    }

    async generateNormalMap(spriteId: string): Promise<ExportResult> {
        const response = await fetch(`${this.baseUrl}/api/generate/normal-map`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ spriteId }),
        });

        if (!response.ok) {
            throw new Error(`SpriteMancer error: ${response.statusText}`);
        }

        return response.json();
    }

    async exportSpritesheet(characterId: string, animations?: string[], outputPath?: string): Promise<ExportResult> {
        const response = await fetch(`${this.baseUrl}/api/export/spritesheet`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ characterId, animations, outputPath }),
        });

        if (!response.ok) {
            throw new Error(`SpriteMancer error: ${response.statusText}`);
        }

        return response.json();
    }
}
