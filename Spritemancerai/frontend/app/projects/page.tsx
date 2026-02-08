"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Project } from "@/lib/types";

export default function ProjectsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newProjectName, setNewProjectName] = useState("");

    // Fetch projects on mount
    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const api = (await import("@/lib/api")).api;
                const data = await api.listProjects();
                setProjects(data.projects);
            } catch (error) {
                console.error("Failed to fetch projects:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchProjects();
    }, []);

    const handleCreateProject = async () => {
        if (!newProjectName.trim()) return;
        setIsCreating(true);
        try {
            const api = (await import("@/lib/api")).api;
            const project = await api.createProject(newProjectName);
            window.location.href = `/projects/${project.id}`;
        } catch (error) {
            console.error("Failed to create project:", error);
            alert(`Failed to create project: ${error instanceof Error ? error.message : "Unknown error"}`);
            setIsCreating(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            created: "bg-zinc-700 text-zinc-300",
            dna_extracted: "bg-violet-600/20 text-violet-400",
            generating: "bg-yellow-600/20 text-yellow-400",
            script_generated: "bg-blue-600/20 text-blue-400",
            completed: "bg-green-600/20 text-green-400",
            failed: "bg-red-600/20 text-red-400",
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.created}`}>
                {status.replace("_", " ")}
            </span>
        );
    };

    const getModeBadge = (mode?: "single" | "dual") => {
        if (!mode) return null;
        const isDual = mode === "dual";
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                isDual ? "bg-orange-600/20 text-orange-400" : "bg-cyan-600/20 text-cyan-400"
            }`}>
                {isDual ? (
                    <>
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="8" cy="12" r="4" />
                            <circle cx="16" cy="12" r="4" />
                        </svg>
                        Dual
                    </>
                ) : (
                    <>
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="12" r="5" />
                        </svg>
                        Single
                    </>
                )}
            </span>
        );
    };

    return (
        <div className="min-h-screen bg-zinc-950">
            <header className="border-b border-zinc-800">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="text-xl font-bold gradient-text">
                        SpriteMancer AI
                    </Link>
                    <Button onClick={() => setIsCreating(true)}>
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        New Project
                    </Button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-12">
                <h1 className="text-3xl font-bold mb-8">Your Projects</h1>

                {/* Create Project Modal */}
                {isCreating && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                        <Card className="w-full max-w-md">
                            <CardHeader>
                                <CardTitle>Create New Project</CardTitle>
                                <CardDescription>Start generating sprites for a new character</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-2">Project Name</label>
                                    <input
                                        type="text"
                                        value={newProjectName}
                                        onChange={(e) => setNewProjectName(e.target.value)}
                                        placeholder="e.g., Warrior Character"
                                        className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-3 justify-end">
                                    <Button variant="ghost" onClick={() => setIsCreating(false)}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleCreateProject}>
                                        Create Project
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Project Grid */}
                {isLoading ? (
                    <div className="col-span-3 flex justify-center py-12">
                        <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {projects.map((project: Project) => (
                            <Link key={project.id} href={`/projects/${project.id}`}>
                                <Card className="hover:border-violet-500/50 transition-all cursor-pointer group overflow-hidden hover:shadow-lg hover:shadow-violet-500/10">
                                    {/* Row 1: Images side by side with status badge */}
                                    <div className="relative">
                                        <div className="flex h-[140px]">
                                            {/* Left: Reference Image */}
                                            <div className="w-1/2 h-full bg-zinc-900 overflow-hidden">
                                                {project.reference_image_url ? (
                                                    <img
                                                        src={project.reference_image_url}
                                                        alt="Reference"
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                                                        <svg className="w-8 h-8 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>
                                            {/* Right: Animated GIF */}
                                            <div className="w-1/2 h-full bg-zinc-950 flex items-center justify-center overflow-hidden border-l border-zinc-800">
                                                {project.preview_gif_url ? (
                                                    <img
                                                        src={project.preview_gif_url}
                                                        alt="Animation"
                                                        className="w-full h-full object-contain"
                                                        style={{ imageRendering: "pixelated" }}
                                                    />
                                                ) : project.spritesheet_url ? (
                                                    <img
                                                        src={project.spritesheet_url}
                                                        alt="Spritesheet"
                                                        className="w-full h-full object-contain opacity-50"
                                                        style={{ imageRendering: "pixelated" }}
                                                    />
                                                ) : (
                                                    <div className="text-center">
                                                        <svg className="w-5 h-5 text-zinc-700 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {/* Status Badge - Top Right Corner */}
                                        <div className="absolute top-2 right-2">
                                            {getStatusBadge(project.status)}
                                        </div>
                                        {/* Mode Badge - Top Left Corner */}
                                        {project.generation_mode && (
                                            <div className="absolute top-2 left-2">
                                                {getModeBadge(project.generation_mode)}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Row 2: Project Info */}
                                    <div className="px-3 py-2 border-t border-zinc-800">
                                        <div className="flex items-center justify-between gap-2">
                                            <h3 className="font-medium text-zinc-100 text-sm truncate" title={project.name}>
                                                {project.name}
                                            </h3>
                                            <span className="text-xs text-zinc-500 whitespace-nowrap">
                                                {new Date(project.created_at).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </Card>
                            </Link>
                        ))}

                        {/* Empty state / Create new */}
                        <button
                            onClick={() => setIsCreating(true)}
                            className="min-h-[184px] border-2 border-dashed border-zinc-700 rounded-lg flex flex-col items-center justify-center gap-2 text-zinc-500 hover:border-violet-500/50 hover:text-violet-400 transition-colors"
                        >
                            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="font-medium text-sm">New Project</span>
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
