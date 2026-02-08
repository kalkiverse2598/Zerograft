// Dithering patterns for pixel art drawing
// Used by PixelEditor to apply different dithering effects

export type DitherPattern = "none" | "checker" | "vertical" | "horizontal" | "diagonal" | "25percent" | "75percent";

// Check if a pixel should be drawn based on dithering pattern
export const shouldDrawPixel = (x: number, y: number, pattern: DitherPattern): boolean => {
    switch (pattern) {
        case "none":
            return true;
        case "checker":
            // Checkerboard pattern - alternating pixels
            return (x + y) % 2 === 0;
        case "vertical":
            // Vertical lines
            return x % 2 === 0;
        case "horizontal":
            // Horizontal lines
            return y % 2 === 0;
        case "diagonal":
            // Diagonal lines
            return (x + y) % 2 === 0 && x % 2 === 0;
        case "25percent":
            // 25% fill - every 4th pixel
            return x % 2 === 0 && y % 2 === 0;
        case "75percent":
            // 75% fill - 3 out of 4 pixels
            return !((x % 2 === 0) && (y % 2 === 0));
        default:
            return true;
    }
};

// Get display name for pattern
export const getDitherPatternName = (pattern: DitherPattern): string => {
    const names: Record<DitherPattern, string> = {
        none: "Solid",
        checker: "Checker 50%",
        vertical: "Vertical",
        horizontal: "Horizontal",
        diagonal: "Diagonal",
        "25percent": "25%",
        "75percent": "75%",
    };
    return names[pattern];
};

// Get emoji for pattern button
export const getDitherPatternIcon = (pattern: DitherPattern): string => {
    const icons: Record<DitherPattern, string> = {
        none: "▓",
        checker: "░",
        vertical: "║",
        horizontal: "═",
        diagonal: "╲",
        "25percent": "▒",
        "75percent": "▓",
    };
    return icons[pattern];
};

// All available patterns
export const DITHER_PATTERNS: DitherPattern[] = [
    "none",
    "checker",
    "vertical",
    "horizontal",
    "diagonal",
    "25percent",
    "75percent",
];
