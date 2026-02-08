"use client";

import { useCallback, useState } from "react";

interface FileUploadProps {
    onFileSelect: (file: File) => void;
    accept?: string;
    maxSize?: number; // in MB
    label?: string;
}

export function FileUpload({
    onFileSelect,
    accept = "image/*",
    maxSize = 10,
    label = "Drop your reference image here, or click to browse",
}: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFile = useCallback(
        (file: File) => {
            setError(null);

            // Validate file type
            if (!file.type.startsWith("image/")) {
                setError("Please upload an image file");
                return;
            }

            // Validate file size
            if (file.size > maxSize * 1024 * 1024) {
                setError(`File size must be less than ${maxSize}MB`);
                return;
            }

            // Create preview
            const reader = new FileReader();
            reader.onload = (e) => {
                setPreview(e.target?.result as string);
            };
            reader.readAsDataURL(file);

            onFileSelect(file);
        },
        [maxSize, onFileSelect]
    );

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);

            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
        },
        [handleFile]
    );

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
        },
        [handleFile]
    );

    return (
        <div
            onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`
        relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
        transition-all duration-200
        ${isDragging
                    ? "border-violet-500 bg-violet-500/10"
                    : "border-zinc-700 hover:border-zinc-600 bg-zinc-900/50"
                }
      `}
        >
            <input
                type="file"
                accept={accept}
                onChange={handleChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            {preview ? (
                <div className="space-y-4">
                    <img
                        src={preview}
                        alt="Preview"
                        className="max-h-48 mx-auto rounded-lg border border-zinc-700"
                    />
                    <p className="text-sm text-zinc-400">Click or drop to replace</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-full bg-zinc-800 flex items-center justify-center">
                        <svg className="w-8 h-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-zinc-300">{label}</p>
                        <p className="text-sm text-zinc-500 mt-1">PNG, JPG up to {maxSize}MB</p>
                    </div>
                </div>
            )}

            {error && (
                <p className="mt-4 text-sm text-red-400">{error}</p>
            )}
        </div>
    );
}
