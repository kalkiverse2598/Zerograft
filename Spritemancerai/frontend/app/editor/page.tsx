"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { PixelEditor } from "@/components/PixelEditor";
import { api } from "@/lib/api";
import type { Project } from "@/lib/types";

interface ProjectWithFrames extends Project {
    frame_urls?: string[];
}

// Helper to extract images from a ZIP file
async function extractImagesFromZip(file: File): Promise<string[]> {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(file);

    const imageUrls: { name: string; url: string }[] = [];
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.bmp'];

    // Get all image files from the ZIP
    const entries = Object.entries(zip.files);
    for (const [filename, zipEntry] of entries) {
        if (zipEntry.dir) continue;

        const lowerName = filename.toLowerCase();
        const isImage = imageExtensions.some(ext => lowerName.endsWith(ext));
        if (!isImage) continue;

        // Extract the file as a blob
        const blob = await zipEntry.async('blob');
        const url = URL.createObjectURL(blob);
        imageUrls.push({ name: filename, url });
    }

    // Sort by filename to maintain order (frame_001, frame_002, etc.)
    imageUrls.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    return imageUrls.map(item => item.url);
}

// Helper to load multiple image files
function loadMultipleImages(files: File[]): Promise<string[]> {
    return new Promise((resolve) => {
        const imageFiles = files.filter(f => f.type.startsWith('image/'));
        // Sort by name to maintain order
        imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        const urls = imageFiles.map(f => URL.createObjectURL(f));
        resolve(urls);
    });
}

function EditorContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State
    const [imageUrl, setImageUrl] = useState<string | null>(searchParams.get("image"));
    const [projects, setProjects] = useState<ProjectWithFrames[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [projectFrames, setProjectFrames] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessingUpload, setIsProcessingUpload] = useState(false);

    // Import mode: 'single' (click to edit), 'multi' (checkbox select), 'all' (import all)
    const [importMode, setImportMode] = useState<'single' | 'multi' | 'all'>('single');
    const [selectedFrameIndices, setSelectedFrameIndices] = useState<Set<number>>(new Set());

    // Query params
    const projectId = searchParams.get("projectId");
    const frameIndex = searchParams.get("frameIndex");
    const prevFrameUrl = searchParams.get("prevFrame");
    const nextFrameUrl = searchParams.get("nextFrame");

    // Load projects on mount
    useEffect(() => {
        async function loadProjects() {
            try {
                const result = await api.listProjects();
                setProjects(result.projects || []);
            } catch (err) {
                console.error("Failed to load projects:", err);
            } finally {
                setLoadingProjects(false);
            }
        }
        loadProjects();
    }, []);

    // Load frames when project is selected
    useEffect(() => {
        if (!selectedProject) {
            setProjectFrames([]);
            return;
        }

        async function loadFrames() {
            try {
                const result = await api.getFrames(selectedProject!);
                setProjectFrames(result.frame_urls || []);
            } catch (err) {
                console.error("Failed to load frames:", err);
                setProjectFrames([]);
            }
        }
        loadFrames();
    }, [selectedProject]);

    // Handle multiple files upload (including ZIP)
    const handleMultipleFilesUpload = useCallback(async (files: FileList | File[]) => {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        setIsProcessingUpload(true);

        try {
            // Check if first file is a ZIP
            const firstFile = fileArray[0];
            if (firstFile.type === 'application/zip' ||
                firstFile.type === 'application/x-zip-compressed' ||
                firstFile.name.toLowerCase().endsWith('.zip')) {

                console.log('📦 Processing ZIP file...');
                const extractedUrls = await extractImagesFromZip(firstFile);

                if (extractedUrls.length === 0) {
                    alert('No images found in the ZIP file');
                    return;
                }

                console.log(`✅ Extracted ${extractedUrls.length} images from ZIP`);

                if (extractedUrls.length === 1) {
                    // Single image, just open it
                    setImageUrl(extractedUrls[0]);
                } else {
                    // Multiple images - store for multi-frame import
                    sessionStorage.setItem('pendingFrameImport', JSON.stringify({
                        projectId: null,
                        frameUrls: extractedUrls,
                    }));
                    setImageUrl(extractedUrls[0]);
                }
            } else if (fileArray.length === 1) {
                // Single image file
                if (!firstFile.type.startsWith('image/')) {
                    alert('Please upload an image file or ZIP archive');
                    return;
                }
                const url = URL.createObjectURL(firstFile);
                setImageUrl(url);
            } else {
                // Multiple image files
                console.log(`📁 Processing ${fileArray.length} files...`);
                const urls = await loadMultipleImages(fileArray);

                if (urls.length === 0) {
                    alert('No valid image files found');
                    return;
                }

                console.log(`✅ Loaded ${urls.length} images`);

                if (urls.length === 1) {
                    setImageUrl(urls[0]);
                } else {
                    // Store for multi-frame import
                    sessionStorage.setItem('pendingFrameImport', JSON.stringify({
                        projectId: null,
                        frameUrls: urls,
                    }));
                    setImageUrl(urls[0]);
                }
            }
        } catch (err) {
            console.error('Failed to process files:', err);
            alert('Failed to process uploaded files');
        } finally {
            setIsProcessingUpload(false);
        }
    }, []);

    // Legacy single file handler (for backwards compatibility)
    const handleFileUpload = useCallback((file: File) => {
        handleMultipleFilesUpload([file]);
    }, [handleMultipleFilesUpload]);

    // Handle drag and drop
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleMultipleFilesUpload(files);
        }
    }, [handleMultipleFilesUpload]);

    // Handle file input change (supports multiple files)
    const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleMultipleFilesUpload(files);
        }
    }, [handleMultipleFilesUpload]);

    // Handle save - download locally
    const handleSave = useCallback(async (imageBlob: Blob) => {
        const url = URL.createObjectURL(imageBlob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `edited-sprite-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // If from project, save back
        if (projectId && frameIndex) {
            try {
                await api.saveEditedFrame(projectId, parseInt(frameIndex), imageBlob);
                console.log("✅ Frame saved to project");
            } catch (err) {
                console.error("Failed to save to project:", err);
            }
        }
    }, [projectId, frameIndex]);

    // Handle close
    const handleClose = useCallback(() => {
        if (imageUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(imageUrl);
        }
        setImageUrl(null);
        setSelectedProject(null);
        setProjectFrames([]);
        setSelectedFrameIndices(new Set());
        setImportMode('single');
    }, [imageUrl]);

    // Toggle frame selection in multi-select mode
    const toggleFrameSelection = useCallback((index: number) => {
        setSelectedFrameIndices(prev => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    }, []);

    // Select all frames
    const selectAllFrames = useCallback(() => {
        setSelectedFrameIndices(new Set(projectFrames.map((_, i) => i)));
    }, [projectFrames]);

    // Clear selection
    const clearSelection = useCallback(() => {
        setSelectedFrameIndices(new Set());
    }, []);

    // Import selected frames into editor (stores URLs in state for PixelEditor to load)
    const handleImportFrames = useCallback((indices: number[]) => {
        if (indices.length === 0) return;

        // For now, store the first frame URL to open editor
        // We'll pass all frame URLs to PixelEditor via a new prop in Phase 2
        const frameUrls = indices.map(i => projectFrames[i]);

        // Store frames in sessionStorage for the editor to pick up
        sessionStorage.setItem('pendingFrameImport', JSON.stringify({
            projectId: selectedProject,
            frameUrls,
        }));

        // Open editor with first frame (editor will load others from sessionStorage)
        setImageUrl(frameUrls[0]);
    }, [projectFrames, selectedProject]);

    // If we have an image, show the editor
    if (imageUrl) {
        return (
            <PixelEditor
                imageUrl={imageUrl}
                onSave={handleSave}
                onClose={handleClose}
                prevFrameUrl={prevFrameUrl || undefined}
                nextFrameUrl={nextFrameUrl || undefined}
            />
        );
    }

    // Landing page with options
    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
            <div className="max-w-4xl w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">🎨 Pixel Editor</h1>
                    <p className="text-zinc-400">Upload an image or select from your projects</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Upload Section */}
                    <div
                        className={`bg-zinc-900 rounded-xl p-6 border-2 border-dashed transition-colors cursor-pointer ${isDragging ? "border-violet-500 bg-violet-500/10" : "border-zinc-700 hover:border-zinc-600"
                            }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,.zip,application/zip"
                            multiple
                            onChange={handleFileInputChange}
                            className="hidden"
                        />
                        <div className="text-center py-8">
                            {isProcessingUpload ? (
                                <>
                                    <div className="text-5xl mb-4 animate-pulse">⏳</div>
                                    <h3 className="text-xl font-semibold text-white mb-2">Processing...</h3>
                                    <p className="text-zinc-400 text-sm">Extracting frames</p>
                                </>
                            ) : (
                                <>
                                    <div className="text-5xl mb-4">📁</div>
                                    <h3 className="text-xl font-semibold text-white mb-2">Upload Images</h3>
                                    <p className="text-zinc-400 text-sm mb-4">
                                        Drag & drop or click to browse
                                    </p>
                                    <p className="text-zinc-500 text-xs">
                                        Supports PNG, JPG, WEBP • Multiple files • ZIP archives
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Projects Section */}
                    <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                        <h3 className="text-xl font-semibold text-white mb-4">📂 Your Projects</h3>

                        {loadingProjects ? (
                            <div className="text-zinc-500 text-center py-8">Loading projects...</div>
                        ) : projects.length === 0 ? (
                            <div className="text-zinc-500 text-center py-8">
                                No projects yet.
                                <button
                                    onClick={() => router.push("/projects")}
                                    className="block mx-auto mt-4 text-violet-400 hover:text-violet-300"
                                >
                                    Create one →
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {projects.map((project) => (
                                    <button
                                        key={project.id}
                                        onClick={() => setSelectedProject(
                                            selectedProject === project.id ? null : project.id
                                        )}
                                        className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${selectedProject === project.id
                                            ? "bg-violet-600 text-white"
                                            : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                                            }`}
                                    >
                                        <div className="font-medium">{project.name}</div>
                                        <div className="text-xs opacity-70">
                                            {new Date(project.created_at).toLocaleDateString()}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Project Frames */}
                {selectedProject && projectFrames.length > 0 && (
                    <div className="mt-6 bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                        {/* Header with mode toggle */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                            <h4 className="text-lg font-semibold text-white">Select Frames to Edit</h4>

                            {/* Import mode toggle */}
                            <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
                                <button
                                    onClick={() => { setImportMode('single'); clearSelection(); }}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${importMode === 'single'
                                        ? 'bg-violet-600 text-white'
                                        : 'text-zinc-400 hover:text-white'
                                        }`}
                                >
                                    Single
                                </button>
                                <button
                                    onClick={() => setImportMode('multi')}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${importMode === 'multi'
                                        ? 'bg-violet-600 text-white'
                                        : 'text-zinc-400 hover:text-white'
                                        }`}
                                >
                                    Select Multiple
                                </button>
                            </div>
                        </div>

                        {/* Multi-select controls */}
                        {importMode === 'multi' && (
                            <div className="flex items-center gap-3 mb-4">
                                <button
                                    onClick={selectAllFrames}
                                    className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
                                >
                                    Select All
                                </button>
                                <span className="text-zinc-600">|</span>
                                <button
                                    onClick={clearSelection}
                                    className="text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
                                >
                                    Clear Selection
                                </button>
                                {selectedFrameIndices.size > 0 && (
                                    <span className="text-sm text-zinc-500 ml-auto">
                                        {selectedFrameIndices.size} of {projectFrames.length} selected
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Frame grid */}
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                            {projectFrames.map((frameUrl, index) => (
                                <button
                                    key={index}
                                    onClick={() => {
                                        if (importMode === 'single') {
                                            setImageUrl(frameUrl);
                                        } else {
                                            toggleFrameSelection(index);
                                        }
                                    }}
                                    className={`relative aspect-square bg-zinc-800 rounded-lg overflow-hidden border-2 transition-colors group ${importMode === 'multi' && selectedFrameIndices.has(index)
                                        ? 'border-violet-500 ring-2 ring-violet-500/30'
                                        : 'border-transparent hover:border-violet-500'
                                        }`}
                                >
                                    <img
                                        src={frameUrl}
                                        alt={`Frame ${index + 1}`}
                                        className="w-full h-full object-contain"
                                        style={{ imageRendering: "pixelated" }}
                                    />

                                    {/* Checkbox overlay for multi-select */}
                                    {importMode === 'multi' && (
                                        <div className="absolute top-1 right-1">
                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${selectedFrameIndices.has(index)
                                                ? 'bg-violet-600 border-violet-600'
                                                : 'bg-zinc-900/80 border-zinc-500'
                                                }`}>
                                                {selectedFrameIndices.has(index) && (
                                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Frame number overlay */}
                                    <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity pointer-events-none ${importMode === 'single' ? 'opacity-0 group-hover:opacity-100' : 'opacity-0'
                                        }`}>
                                        <span className="text-white text-xs font-medium">Frame {index + 1}</span>
                                    </div>

                                    {/* Frame number badge (always visible in multi mode) */}
                                    {importMode === 'multi' && (
                                        <div className="absolute bottom-1 left-1 bg-black/70 px-1.5 py-0.5 rounded text-[10px] text-white font-medium">
                                            {index + 1}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Import action buttons */}
                        {importMode === 'multi' && (
                            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-zinc-800">
                                <button
                                    onClick={() => handleImportFrames(Array.from(selectedFrameIndices).sort((a, b) => a - b))}
                                    disabled={selectedFrameIndices.size === 0}
                                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors"
                                >
                                    Import Selected ({selectedFrameIndices.size})
                                </button>
                                <button
                                    onClick={() => handleImportFrames(projectFrames.map((_, i) => i))}
                                    className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-lg transition-colors"
                                >
                                    Import All ({projectFrames.length})
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {selectedProject && projectFrames.length === 0 && (
                    <div className="mt-6 bg-zinc-900 rounded-xl p-6 border border-zinc-800 text-center text-zinc-500">
                        No frames generated yet for this project.
                        <button
                            onClick={() => router.push(`/projects/${selectedProject}/storyboard`)}
                            className="block mx-auto mt-4 text-violet-400 hover:text-violet-300"
                        >
                            Generate sprites →
                        </button>
                    </div>
                )}

                {/* Features */}
                <div className="mt-8 bg-zinc-900/50 rounded-xl p-6 border border-zinc-800/50">
                    <h4 className="text-lg font-semibold text-white mb-3 text-center">Features</h4>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 text-center text-xs text-zinc-400">
                        <div className="bg-zinc-800/50 rounded-lg p-2">✏️ Draw</div>
                        <div className="bg-zinc-800/50 rounded-lg p-2">🪣 Fill</div>
                        <div className="bg-zinc-800/50 rounded-lg p-2">➖ Line</div>
                        <div className="bg-zinc-800/50 rounded-lg p-2">⬜ Rect</div>
                        <div className="bg-zinc-800/50 rounded-lg p-2">◯ Circle</div>
                        <div className="bg-zinc-800/50 rounded-lg p-2">✂️ Select</div>
                        <div className="bg-zinc-800/50 rounded-lg p-2">📋 Copy</div>
                        <div className="bg-zinc-800/50 rounded-lg p-2">🪞 Mirror</div>
                        <div className="bg-zinc-800/50 rounded-lg p-2">░ Dither</div>
                        <div className="bg-zinc-800/50 rounded-lg p-2">📐 Resize</div>
                        <div className="bg-zinc-800/50 rounded-lg p-2">↺ Rotate</div>
                        <div className="bg-zinc-800/50 rounded-lg p-2">🔄 Swap</div>
                    </div>
                </div>

                {/* Back button */}
                <div className="mt-8 text-center">
                    <button
                        onClick={() => router.push("/")}
                        className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                        ← Back to Home
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function EditorPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="text-white">Loading editor...</div>
            </div>
        }>
            <EditorContent />
        </Suspense>
    );
}
