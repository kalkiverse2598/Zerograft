"use client";

import { forwardRef, type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "glass" | "outline";
}

const Card = forwardRef<HTMLDivElement, CardProps>(
    ({ className = "", variant = "default", children, ...props }, ref) => {
        const variants = {
            default: "bg-zinc-900 border border-zinc-800",
            glass: "glass",
            outline: "border border-zinc-700 bg-transparent",
        };

        return (
            <div
                ref={ref}
                className={`rounded-xl p-6 ${variants[variant]} ${className}`}
                {...props}
            >
                {children}
            </div>
        );
    }
);

Card.displayName = "Card";

const CardHeader = ({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div className={`mb-4 ${className}`} {...props} />
);

const CardTitle = ({ className = "", ...props }: HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className={`text-lg font-semibold text-zinc-100 ${className}`} {...props} />
);

const CardDescription = ({ className = "", ...props }: HTMLAttributes<HTMLParagraphElement>) => (
    <p className={`text-sm text-zinc-400 mt-1 ${className}`} {...props} />
);

const CardContent = ({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div className={className} {...props} />
);

export { Card, CardHeader, CardTitle, CardDescription, CardContent };
