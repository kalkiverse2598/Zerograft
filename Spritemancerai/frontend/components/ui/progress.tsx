"use client";

interface ProgressProps {
    value: number;
    max?: number;
    label?: string;
    showValue?: boolean;
    variant?: "default" | "pipeline";
    className?: string;
}

export function Progress({
    value,
    max = 100,
    label,
    showValue = false,
    variant = "default",
    className = "",
}: ProgressProps) {
    const percentage = Math.min((value / max) * 100, 100);

    const barStyles = variant === "pipeline"
        ? "pipeline-progress"
        : "bg-violet-600";

    return (
        <div className={`w-full ${className}`}>
            {(label || showValue) && (
                <div className="flex justify-between mb-1 text-sm">
                    {label && <span className="text-zinc-400">{label}</span>}
                    {showValue && <span className="text-zinc-300">{Math.round(percentage)}%</span>}
                </div>
            )}
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ease-out ${barStyles}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}

