"use client";

interface Stage {
    stage: number;
    stage_name: string;
    status: "start" | "progress" | "complete" | "error";
}

interface PipelineProgressProps {
    stages: Stage[];
    currentStage: Stage | null;
    isComplete: boolean;
    error: string | null;
}

const STAGE_ORDER = [
    { num: 1, name: "DNA Extraction" },
    { num: 2, name: "DNA Verification" },
    { num: 3, name: "Action Validation" },
    { num: 4, name: "Intent Mirroring" },
    { num: 5, name: "Script Generation" },
    { num: 6, name: "Image Generation" },
    { num: 7, name: "Post-Processing" },
];

export function PipelineProgress({ stages, currentStage, isComplete, error }: PipelineProgressProps) {
    const getStageStatus = (stageNum: number) => {
        const completed = stages.find((s) => s.stage === stageNum && s.status === "complete");
        const inProgress = currentStage?.stage === stageNum && currentStage.status !== "complete";
        const hasError = error && currentStage?.stage === stageNum;

        if (hasError) return "error";
        if (completed) return "complete";
        if (inProgress) return "active";
        return "pending";
    };

    return (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Pipeline Progress</h3>

            <div className="space-y-2">
                {STAGE_ORDER.map(({ num, name }) => {
                    const status = getStageStatus(num);

                    return (
                        <div
                            key={num}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${status === "active"
                                    ? "bg-violet-500/20 border border-violet-500/50"
                                    : status === "complete"
                                        ? "bg-green-500/10 border border-green-500/30"
                                        : status === "error"
                                            ? "bg-red-500/20 border border-red-500/50"
                                            : "bg-zinc-800/50 border border-transparent"
                                }`}
                        >
                            {/* Status Icon */}
                            <div className="w-6 h-6 flex items-center justify-center">
                                {status === "complete" ? (
                                    <span className="text-green-400">✓</span>
                                ) : status === "active" ? (
                                    <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                                ) : status === "error" ? (
                                    <span className="text-red-400">✗</span>
                                ) : (
                                    <span className="text-zinc-600">{num}</span>
                                )}
                            </div>

                            {/* Stage Info */}
                            <div className="flex-1">
                                <span
                                    className={`text-sm ${status === "active"
                                            ? "text-violet-300"
                                            : status === "complete"
                                                ? "text-green-300"
                                                : status === "error"
                                                    ? "text-red-300"
                                                    : "text-zinc-500"
                                        }`}
                                >
                                    {name}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Completion Status */}
            {isComplete && (
                <div className="mt-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-center">
                    <span className="text-green-300">✨ Pipeline Complete!</span>
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                    <span className="text-red-300 text-sm">{error}</span>
                </div>
            )}
        </div>
    );
}
