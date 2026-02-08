"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function RemoveBackgroundPage() {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [result, setResult] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [method, setMethod] = useState("checkered");
    const [threshold, setThreshold] = useState(240);
    const [dragOver, setDragOver] = useState(false);

    const handleFile = useCallback((selectedFile: File) => {
        if (!selectedFile.type.startsWith("image/")) {
            alert("Please upload an image file (PNG, JPG, WebP)");
            return;
        }
        setFile(selectedFile);
        setResult(null);

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(selectedFile);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) handleFile(droppedFile);
    }, [handleFile]);

    const handleRemoveBackground = async () => {
        if (!file) return;

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("method", method);
            formData.append("threshold", threshold.toString());

            const response = await fetch(`${API_URL}/api/ai/remove-background`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Failed: ${response.statusText}`);
            }

            const data = await response.json();
            setResult(data.data_url);
        } catch (error) {
            console.error("Background removal failed:", error);
            alert("Failed to remove background. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = () => {
        if (!result) return;
        const link = document.createElement("a");
        link.href = result;
        link.download = `${file?.name.replace(/\.[^/.]+$/, "")}_nobg.png`;
        link.click();
    };

    return (
        <div className="min-h-screen bg-zinc-950 py-12 px-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <Link href="/" className="text-zinc-400 hover:text-zinc-200 text-sm mb-4 inline-block">
                        ← Back to Home
                    </Link>
                    <h1 className="text-4xl font-bold gradient-text mb-3">Background Remover</h1>
                    <p className="text-zinc-400">
                        Upload an image and remove its background instantly
                    </p>
                </div>

                {/* Upload Zone */}
                <Card variant="glass" className="mb-8">
                    <CardContent className="p-8">
                        <div
                            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${dragOver
                                ? "border-violet-500 bg-violet-500/10"
                                : "border-zinc-700 hover:border-zinc-500"
                                }`}
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                        >
                            {!preview ? (
                                <div>
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
                                        <svg className="w-8 h-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <p className="text-zinc-300 mb-2">Drop your image here</p>
                                    <p className="text-zinc-500 text-sm mb-4">or</p>
                                    <input
                                        type="file"
                                        id="file-upload"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                                    />
                                    <label htmlFor="file-upload" className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 transition-colors">
                                        Browse Files
                                    </label>
                                </div>
                            ) : (
                                <div className="flex gap-8 items-start">
                                    {/* Original */}
                                    <div className="flex-1">
                                        <p className="text-zinc-400 text-sm mb-2">Original</p>
                                        <div className="bg-zinc-900 rounded-lg p-2 border border-zinc-800">
                                            <img src={preview} alt="Original" className="max-w-full max-h-64 mx-auto rounded" />
                                        </div>
                                    </div>

                                    {/* Result */}
                                    <div className="flex-1">
                                        <p className="text-zinc-400 text-sm mb-2">Result</p>
                                        <div
                                            className="rounded-lg p-2 border border-zinc-800 min-h-[200px] flex items-center justify-center"
                                            style={{
                                                background: result
                                                    ? "repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 50% / 20px 20px"
                                                    : "#18181b"
                                            }}
                                        >
                                            {result ? (
                                                <img src={result} alt="Result" className="max-w-full max-h-64 mx-auto rounded" />
                                            ) : (
                                                <span className="text-zinc-500">Result will appear here</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Options */}
                {preview && (
                    <Card variant="glass" className="mb-8">
                        <CardHeader>
                            <CardTitle className="text-lg">Options</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-6">
                                {/* Method */}
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-2">Removal Method</label>
                                    <select
                                        value={method}
                                        onChange={(e) => setMethod(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100"
                                    >
                                        <option value="checkered">🔲 AI Checkered Pattern</option>
                                        <option value="white">White Background</option>
                                        <option value="adaptive">Auto-detect</option>
                                        <option value="green">Green Screen</option>
                                    </select>
                                </div>

                                {/* Threshold */}
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-2">
                                        Threshold: {threshold}
                                    </label>
                                    <input
                                        type="range"
                                        min="150"
                                        max="255"
                                        value={threshold}
                                        onChange={(e) => setThreshold(parseInt(e.target.value))}
                                        className="w-full"
                                    />
                                    <div className="flex justify-between text-xs text-zinc-500 mt-1">
                                        <span>Aggressive</span>
                                        <span>Precise</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Actions */}
                {preview && (
                    <div className="flex gap-4 justify-center">
                        <Button
                            onClick={handleRemoveBackground}
                            disabled={loading}
                            className="px-8"
                        >
                            {loading ? (
                                <>
                                    <span className="animate-spin mr-2">⏳</span>
                                    Processing...
                                </>
                            ) : (
                                <>✨ Remove Background</>
                            )}
                        </Button>

                        {result && (
                            <Button variant="secondary" onClick={handleDownload}>
                                📥 Download PNG
                            </Button>
                        )}

                        <Button
                            variant="ghost"
                            onClick={() => { setFile(null); setPreview(null); setResult(null); }}
                        >
                            Clear
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
