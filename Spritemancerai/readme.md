# SpriteMancer AI

AI-powered 2D game asset generation pipeline. Part of the [ZeroGraft / Agentic Godot](../README.md) project.

**Live Demo:** [spritemancer.zerograft.online](https://spritemancer.zerograft.online)

## Components

- **`backend/`** — FastAPI Python server (Gemini 3 Pro/Flash, Supabase, Redis)
- **`frontend/`** — Next.js React web app (TailwindCSS, shadcn/ui)
- **`docs/`** — Dual character animation system documentation

## Quick Start

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env and set GEMINI_API_KEY, SUPABASE_URL, SUPABASE_KEY
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Pipeline Stages

| Stage | Name | Model |
|-------|------|-------|
| 1 | Character DNA Extraction | Gemini 3 Pro |
| 2 | DNA Verification | Gemini 3 Pro |
| 3 | Action Definition + Frame Budget | Gemini 3 Pro |
| 4 | Intent Mirroring | Gemini 3 Pro |
| 5 | Biomechanical Scripting | Gemini 3 Pro |
| 6 | Image Generation | Gemini 3 Pro (image) |
| 7 | Post-Processing (OpenCV) | Local |
| 8 | Repair Loop | Gemini 3 Pro (image) |