import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-transparent to-cyan-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-600/10 via-transparent to-transparent" />

        <div className="relative max-w-7xl mx-auto px-6 py-24">
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center gap-4">
              <Image src="/icon.svg" alt="SpriteMancer Logo" width={64} height={64} />
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
                <span className="gradient-text">SpriteMancer</span>
                <span className="text-zinc-100"> AI</span>
              </h1>
            </div>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
              Generate consistent, game-ready 2D animation spritesheets using AI.
              No temporal hallucination. Full control over your sprites.
            </p>
            <div className="flex gap-4 justify-center pt-4">
              <Link href="/projects">
                <Button size="lg" className="animate-pulse-glow">
                  Start Creating
                </Button>
              </Link>
              <Link href="/generate">
                <Button variant="secondary" size="lg">
                  ✨ Asset Generator
                </Button>
              </Link>
              <Link href="/tools/remove-bg">
                <Button variant="ghost" size="lg">
                  🧹 Remove Background
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-3 gap-6">
          <Card variant="glass">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-violet-600/20 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <CardTitle>8-Stage Pipeline</CardTitle>
              <CardDescription>
                Verification-first approach separates reasoning from rendering for consistent results.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card variant="glass">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-cyan-600/20 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <CardTitle>Biomechanical Scripting</CardTitle>
              <CardDescription>
                Physics-aware animation scripts ensure natural, game-ready motion.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card variant="glass">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-green-600/20 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <CardTitle>Frame-Level Repair</CardTitle>
              <CardDescription>
                Fix individual frames without regenerating the entire spritesheet.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Pipeline Steps */}
      <section className="max-w-7xl mx-auto px-6 py-24 border-t border-zinc-800">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-8">
          {[
            { step: 1, title: "Upload Reference", desc: "Drop your character reference image" },
            { step: 2, title: "Extract DNA", desc: "AI analyzes and extracts character traits" },
            { step: 3, title: "Define Action", desc: "Choose animation type and difficulty" },
            { step: 4, title: "Generate Sprites", desc: "Get game-ready spritesheet" },
          ].map(({ step, title, desc }) => (
            <div key={step} className="text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center text-lg font-bold mb-4">
                {step}
              </div>
              <h3 className="font-semibold text-zinc-100 mb-2">{title}</h3>
              <p className="text-sm text-zinc-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-12">
        <div className="max-w-7xl mx-auto px-6 text-center text-zinc-500 text-sm">
          SpriteMancer AI — Powered by Gemini 3 Pro
        </div>
      </footer>
    </div>
  );
}
