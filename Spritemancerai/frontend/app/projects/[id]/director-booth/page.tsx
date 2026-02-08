"use client";

import { useState, useEffect, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePipelineWebSocket } from "@/hooks/usePipelineWebSocket";
import type { DifficultyTier, Perspective, FrameBudget, GenerationMode } from "@/lib/types";

interface DirectorBoothPageProps {
    params: Promise<{ id: string }>;
}

type ActionCategory = "movement" | "combat" | "reactions" | "utility" | "states";

interface ActionItem {
    name: string;
    icon: string;
    tiers: DifficultyTier[];
}

const ACTION_CATEGORIES: { id: ActionCategory; name: string; icon: string }[] = [
    { id: "movement", name: "Basic Movement", icon: "🏃" },
    { id: "combat", name: "Combat", icon: "⚔️" },
    { id: "reactions", name: "Reactions", icon: "😵" },
    { id: "utility", name: "Utility", icon: "🤚" },
    { id: "states", name: "States", icon: "😴" },
];

const ACTIONS_BY_CATEGORY: Record<ActionCategory, ActionItem[]> = {
    movement: [
        { name: "Idle", icon: "🧍", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
        { name: "Walk", icon: "🚶", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
        { name: "Run", icon: "🏃", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
        { name: "Jump", icon: "🦘", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
        { name: "Dash", icon: "💨", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
        { name: "Crouch", icon: "🦆", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
        { name: "Climb", icon: "🧗", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
        { name: "Fall", icon: "📉", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
        { name: "Swim", icon: "🏊", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
    ],
    combat: [
        { name: "Light Attack", icon: "⚔️", tiers: ["LIGHT", "HEAVY"] as DifficultyTier[] },
        { name: "Heavy Attack", icon: "🗡️", tiers: ["HEAVY", "BOSS"] as DifficultyTier[] },
        { name: "Combo Attack", icon: "💥", tiers: ["HEAVY", "BOSS"] as DifficultyTier[] },
        { name: "Ranged Attack", icon: "🏹", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
        { name: "Special Attack", icon: "🌟", tiers: ["HEAVY", "BOSS"] as DifficultyTier[] },
        { name: "Block", icon: "🛡️", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
        { name: "Dodge", icon: "🔄", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
        { name: "Cast", icon: "✨", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
    ],
    reactions: [
        { name: "Hurt", icon: "😵", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
        { name: "Stun", icon: "💫", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
        { name: "Death", icon: "💀", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
        { name: "Get Up", icon: "⬆️", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
    ],
    utility: [
        { name: "Taunt", icon: "😤", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
        { name: "Interact", icon: "🤚", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
        { name: "Pick Up", icon: "🫳", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
        { name: "Throw", icon: "🤾", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
    ],
    states: [
        { name: "Sleep", icon: "😴", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
        { name: "Sit", icon: "🪑", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
        { name: "Victory", icon: "🏆", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
        { name: "Spawn", icon: "🌀", tiers: ["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[] },
    ],
};

const PERSPECTIVES: { value: Perspective; label: string }[] = [
    { value: "side", label: "Side View" },
    { value: "front", label: "Front View" },
    { value: "isometric", label: "Isometric" },
    { value: "top_down", label: "Top Down" },
];

interface ResponderSuggestion {
    action: string;
    reason: string;
    recommended: boolean;
}

export default function DirectorBoothPage({ params }: DirectorBoothPageProps) {
    const { id } = use(params);
    const searchParams = useSearchParams();
    const modeFromUrl = searchParams.get("mode") as GenerationMode | null;

    // WebSocket connection for real-time stage updates and auto-navigation
    const { connect, isConnected } = usePipelineWebSocket(id);

    // Connect to WebSocket on mount
    useEffect(() => {
        connect();
    }, [connect]);

    // Mode selection - auto-detect from URL or project data
    const [generationMode, setGenerationMode] = useState<GenerationMode>(modeFromUrl || "single");
    const [modeDetected, setModeDetected] = useState(!!modeFromUrl);

    // Action selection
    const [selectedCategory, setSelectedCategory] = useState<ActionCategory>("movement");
    const [selectedAction, setSelectedAction] = useState<string | null>(null);
    const [selectedTier, setSelectedTier] = useState<DifficultyTier>("LIGHT");
    const [selectedPerspective, setSelectedPerspective] = useState<Perspective>("side");

    // Frame budget & intent
    const [frameBudget, setFrameBudget] = useState<FrameBudget | null>(null);
    const [intentSummary, setIntentSummary] = useState<string | null>(null);
    const [isComputing, setIsComputing] = useState(false);

    // Dual mode specific
    const [responderSuggestions, setResponderSuggestions] = useState<ResponderSuggestion[]>([]);
    const [selectedResponderAction, setSelectedResponderAction] = useState<string | null>(null);
    const [isDualReady, setIsDualReady] = useState(false);

    // Auto-detect generation mode from project data
    useEffect(() => {
        const fetchProjectMode = async () => {
            try {
                const { api } = await import("@/lib/api");
                const project = await api.getProject(id);
                // Check if project has responder data (indicating dual mode)
                const projectData = project as {
                    generation_mode?: GenerationMode;
                    responder_reference_url?: string;
                    responder_dna?: unknown;
                };
                if (projectData.generation_mode === "dual" || projectData.responder_reference_url || projectData.responder_dna) {
                    setGenerationMode("dual");
                    setModeDetected(true);
                }
            } catch (error) {
                console.error("Failed to fetch project mode:", error);
            }
        };

        // Only fetch if mode wasn't provided in URL
        if (!modeFromUrl) {
            fetchProjectMode();
        }
    }, [id, modeFromUrl]);

    const handleComputeBudget = async () => {
        if (!selectedAction) return;

        setIsComputing(true);
        try {
            const { api } = await import("@/lib/api");

            if (generationMode === "single") {
                // Single mode - existing flow
                const result = await api.computeFrameBudget(
                    id,
                    selectedAction,
                    selectedTier,
                    selectedPerspective
                );
                setFrameBudget(result.frame_budget);
                setIntentSummary(result.intent_summary);
            } else {
                // Dual mode - generate script and get responder suggestions
                const result = await api.generateDualScript(
                    id,
                    selectedAction,
                    selectedTier,
                    selectedPerspective
                );
                setFrameBudget(result.frame_budget);
                setResponderSuggestions(result.suggested_responder_actions.suggested_actions);
                setIntentSummary(`Dual animation: ${selectedAction} → Awaiting responder selection`);

                // Auto-select recommended action
                const recommended = result.suggested_responder_actions.suggested_actions.find(s => s.recommended);
                if (recommended) {
                    setSelectedResponderAction(recommended.action);
                }
            }
        } catch (error) {
            console.error("Failed to compute budget:", error);
            alert(`Failed to compute budget: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setIsComputing(false);
        }
    };

    const handleConfirmResponder = async () => {
        if (!selectedResponderAction) return;

        setIsComputing(true);
        try {
            const { api } = await import("@/lib/api");
            const result = await api.confirmResponderAction(id, selectedResponderAction);

            setIntentSummary(
                `Dual ${selectedAction} → ${selectedResponderAction} (${result.frame_count} frames each)`
            );
            setIsDualReady(true);
        } catch (error) {
            console.error("Failed to confirm responder:", error);
            alert(`Failed to confirm responder: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setIsComputing(false);
        }
    };

    const handleConfirm = () => {
        // Pass action config via URL params for storyboard to use
        const params = new URLSearchParams({
            action: selectedAction || "",
            tier: selectedTier,
            perspective: selectedPerspective,
            mode: generationMode,
            ...(generationMode === "dual" && selectedResponderAction
                ? { responder_action: selectedResponderAction }
                : {}),
        });
        window.location.href = `/projects/${id}/storyboard?${params.toString()}`;
    };

    const getAvailableTiers = (): DifficultyTier[] => {
        const actions = ACTIONS_BY_CATEGORY[selectedCategory];
        const action = actions.find((a: ActionItem) => a.name === selectedAction);
        return action?.tiers || [];
    };

    const resetState = () => {
        setFrameBudget(null);
        setIntentSummary(null);
        setResponderSuggestions([]);
        setSelectedResponderAction(null);
        setIsDualReady(false);
    };

    return (
        <div className="min-h-screen bg-zinc-950">
            <header className="border-b border-zinc-800">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={`/projects/${id}`} className="text-zinc-400 hover:text-zinc-300">
                            ← Back
                        </Link>
                        <h1 className="text-xl font-semibold">🎬 Director Booth</h1>
                    </div>
                    {((generationMode === "single" && intentSummary) ||
                        (generationMode === "dual" && isDualReady)) && (
                            <Button onClick={handleConfirm}>
                                Confirm Intent →
                            </Button>
                        )}
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-12">
                {/* Mode Selector - only show if mode not already detected from project */}
                {!modeDetected ? (
                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle>Generation Mode</CardTitle>
                            <CardDescription>Choose single character or dual-character relational animation</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => {
                                        setGenerationMode("single");
                                        resetState();
                                    }}
                                    className={`p-6 rounded-xl border text-left transition-all ${generationMode === "single"
                                        ? "border-violet-500 bg-violet-500/10"
                                        : "border-zinc-700 hover:border-zinc-600 bg-zinc-900"
                                        }`}
                                >
                                    <div className="text-3xl mb-2">🧍</div>
                                    <div className="font-semibold mb-1">Single Character</div>
                                    <div className="text-xs text-zinc-400">
                                        Generate animation for one character
                                    </div>
                                </button>
                                <button
                                    onClick={() => {
                                        setGenerationMode("dual");
                                        resetState();
                                    }}
                                    className={`p-6 rounded-xl border text-left transition-all ${generationMode === "dual"
                                        ? "border-amber-500 bg-amber-500/10"
                                        : "border-zinc-700 hover:border-zinc-600 bg-zinc-900"
                                        }`}
                                >
                                    <div className="text-3xl mb-2">⚔️</div>
                                    <div className="font-semibold mb-1">Dual Combat</div>
                                    <div className="text-xs text-zinc-400">
                                        Instigator → Responder relational animation
                                    </div>
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="mb-8 p-4 bg-zinc-900 rounded-lg border border-zinc-800 flex items-center gap-3">
                        <span className="text-2xl">{generationMode === "dual" ? "⚔️" : "🧍"}</span>
                        <div>
                            <div className="font-medium">
                                {generationMode === "dual" ? "Dual Combat Mode" : "Single Character Mode"}
                            </div>
                            <div className="text-xs text-zinc-400">
                                Mode set from DNA Lab
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Action Selection */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    {generationMode === "dual" ? "Instigator Action" : "Select Action"}
                                </CardTitle>
                                <CardDescription>
                                    {generationMode === "dual"
                                        ? "The attacking character's action"
                                        : "Choose the animation type to generate"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Category Row */}
                                <div className="flex gap-2 flex-wrap">
                                    {ACTION_CATEGORIES.map((category) => (
                                        <button
                                            key={category.id}
                                            onClick={() => {
                                                setSelectedCategory(category.id);
                                                setSelectedAction(null);
                                                resetState();
                                            }}
                                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all flex items-center gap-2 ${selectedCategory === category.id
                                                ? "border-violet-500 bg-violet-500/20 text-violet-300"
                                                : "border-zinc-700 hover:border-zinc-600 bg-zinc-900 text-zinc-400"
                                                }`}
                                        >
                                            <span>{category.icon}</span>
                                            <span>{category.name}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Actions Row for Selected Category */}
                                <div className="grid grid-cols-4 gap-3 pt-2">
                                    {ACTIONS_BY_CATEGORY[selectedCategory].map((action: ActionItem) => (
                                        <button
                                            key={action.name}
                                            onClick={() => {
                                                setSelectedAction(action.name);
                                                if (!action.tiers.includes(selectedTier)) {
                                                    setSelectedTier(action.tiers[0]);
                                                }
                                                resetState();
                                            }}
                                            className={`p-4 rounded-xl border text-center transition-all ${selectedAction === action.name
                                                ? "border-violet-500 bg-violet-500/10"
                                                : "border-zinc-700 hover:border-zinc-600 bg-zinc-900"
                                                }`}
                                        >
                                            <div className="text-3xl mb-2">{action.icon}</div>
                                            <div className="text-sm font-medium">{action.name}</div>
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>


                        {/* Difficulty Tier */}
                        {selectedAction && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Difficulty Tier</CardTitle>
                                    <CardDescription>Affects animation timing and exaggeration</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-3 gap-4">
                                        {(["LIGHT", "HEAVY", "BOSS"] as DifficultyTier[]).map((tier) => {
                                            const available = getAvailableTiers().includes(tier);
                                            const descriptions = {
                                                LIGHT: "Fast, efficient, minimal commitment",
                                                HEAVY: "Weighty, deliberate, high impact",
                                                BOSS: "Telegraphed, exaggerated, dominant",
                                            };
                                            return (
                                                <button
                                                    key={tier}
                                                    onClick={() => {
                                                        if (available) {
                                                            setSelectedTier(tier);
                                                            resetState();
                                                        }
                                                    }}
                                                    disabled={!available}
                                                    className={`p-4 rounded-xl border text-left transition-all ${!available
                                                        ? "opacity-40 cursor-not-allowed border-zinc-800 bg-zinc-900"
                                                        : selectedTier === tier
                                                            ? "border-violet-500 bg-violet-500/10"
                                                            : "border-zinc-700 hover:border-zinc-600 bg-zinc-900"
                                                        }`}
                                                >
                                                    <div className="font-semibold mb-1">{tier}</div>
                                                    <div className="text-xs text-zinc-400">{descriptions[tier]}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Perspective */}
                        {selectedAction && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Perspective</CardTitle>
                                    <CardDescription>Camera angle for the animation</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-4 gap-3">
                                        {PERSPECTIVES.map((persp) => (
                                            <button
                                                key={persp.value}
                                                onClick={() => {
                                                    setSelectedPerspective(persp.value);
                                                    resetState();
                                                }}
                                                className={`p-3 rounded-xl border text-center transition-all ${selectedPerspective === persp.value
                                                    ? "border-violet-500 bg-violet-500/10"
                                                    : "border-zinc-700 hover:border-zinc-600 bg-zinc-900"
                                                    }`}
                                            >
                                                <div className="text-sm font-medium">{persp.label}</div>
                                            </button>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Responder Action Selection (Dual Mode Only) */}
                        {generationMode === "dual" && responderSuggestions.length > 0 && (
                            <Card className="border-amber-500/50">
                                <CardHeader>
                                    <CardTitle className="text-amber-400">⚡ Select Responder Reaction</CardTitle>
                                    <CardDescription>
                                        Choose how the responder character reacts to the attack
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {responderSuggestions.map((suggestion) => (
                                        <button
                                            key={suggestion.action}
                                            onClick={() => setSelectedResponderAction(suggestion.action)}
                                            className={`w-full p-4 rounded-xl border text-left transition-all ${selectedResponderAction === suggestion.action
                                                ? "border-amber-500 bg-amber-500/10"
                                                : "border-zinc-700 hover:border-zinc-600 bg-zinc-900"
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="font-semibold">{suggestion.action}</div>
                                                {suggestion.recommended && (
                                                    <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded">
                                                        Recommended
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-zinc-400">{suggestion.reason}</div>
                                        </button>
                                    ))}

                                    {selectedResponderAction && !isDualReady && (
                                        <Button
                                            onClick={handleConfirmResponder}
                                            isLoading={isComputing}
                                            className="w-full mt-4"
                                        >
                                            Confirm Responder: {selectedResponderAction}
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Frame Budget & Intent */}
                    <div className="space-y-6">
                        {selectedAction && !frameBudget && (
                            <Button
                                onClick={handleComputeBudget}
                                isLoading={isComputing}
                                className="w-full"
                                size="lg"
                            >
                                {generationMode === "dual"
                                    ? "Analyze Dual Interaction"
                                    : "Compute Frame Budget"}
                            </Button>
                        )}

                        {frameBudget && (
                            <Card variant="glass">
                                <CardHeader>
                                    <CardTitle>Frame Budget</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="text-center py-6">
                                        <div className="text-5xl font-bold gradient-text">
                                            {frameBudget.final_frame_count}
                                        </div>
                                        <div className="text-zinc-400 mt-1">
                                            {generationMode === "dual" ? "frames × 2 chars" : "frames"}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div className="text-center p-3 bg-zinc-800 rounded-lg">
                                            <div className="text-zinc-400">Grid</div>
                                            <div className="font-semibold">{frameBudget.grid_dim}×{frameBudget.grid_dim}</div>
                                        </div>
                                        <div className="text-center p-3 bg-zinc-800 rounded-lg">
                                            <div className="text-zinc-400">Multiplier</div>
                                            <div className="font-semibold">×{frameBudget.multiplier_applied.toFixed(2)}</div>
                                        </div>
                                    </div>

                                    <p className="text-xs text-zinc-500 mt-4">
                                        {frameBudget.justification}
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        {intentSummary && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Intent Summary</CardTitle>
                                    <CardDescription>
                                        {generationMode === "dual" && !isDualReady
                                            ? "Select responder action to continue"
                                            : "Confirm this is what you want to generate"}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-zinc-300 leading-relaxed">
                                        {intentSummary}
                                    </p>
                                    {((generationMode === "single") ||
                                        (generationMode === "dual" && isDualReady)) && (
                                            <div className="mt-4 pt-4 border-t border-zinc-800">
                                                <Button onClick={handleConfirm} className="w-full">
                                                    ✓ Confirm & Continue
                                                </Button>
                                            </div>
                                        )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

