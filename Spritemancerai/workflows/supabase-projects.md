---
description: Supabase project IDs and configuration for MCP interactions
---

# Supabase Project Reference

When interacting with Supabase MCP tools, use the following project IDs:

## SpriteMancer Project

| Property | Value |
|----------|-------|
| **Project ID** | `txaarzirhpvxvliaywcv` |
| **Database Host** | `db.txaarzirhpvxvliaywcv.supabase.co` |
| **Organization ID** | `ibdnvlqvilgxwufqzjng` |
| **Region** | `ap-southeast-1` |
| **Status** | `ACTIVE_HEALTHY` |

## Usage

When using any Supabase MCP tool that requires `project_id`, use:

```
project_id: txaarzirhpvxvliaywcv
```

## Key Tables

| Table | Description |
|-------|-------------|
| `projects` | Main projects table with character DNA, animation scripts, and frame URLs |
| `generation_logs` | Logs for pipeline generation runs |

## Important Columns in `projects`

### Core Fields
- `id` (uuid) - Primary key
- `user_id` (uuid) - Owner user ID
- `name` (text) - Project name
- `description` (text) - Optional description
- `status` (text) - Status: created, dna_extracted, generating, completed, failed

### Single Character Mode
- `reference_image_url` (text) - Main character reference image
- `character_dna` (JSONB) - Main character DNA
- `animation_script` (JSONB) - Generated animation script
- `frame_urls` (JSONB) - Generated frame URLs
- `spritesheet_url` (text) - Final spritesheet URL

### Dual Character Mode
- `generation_mode` (text) - Mode: 'single' or 'dual' (default: 'single')
- `responder_reference_url` (text) - Responder image URL
- `responder_dna` (JSONB) - Responder character DNA
- `responder_animation_script` (JSONB) - Responder animation script
- `responder_action_type` (text) - Selected responder action
- `responder_spritesheet_url` (text) - Responder spritesheet URL
- `responder_frame_urls` (JSONB) - Responder frame URLs
- `interaction_constraints` (JSONB) - Character interaction constraints
- `suggested_responder_actions` (JSONB) - AI-suggested responder actions

### Pipeline Configuration
- `action_type` (text) - Animation action type
- `difficulty_tier` (text) - LIGHT, HEAVY, or BOSS
- `perspective` (text) - side, front, isometric, top_down (default: side)
- `custom_pivots` (JSONB) - Custom pivot points for frames

### Metadata
- `latest_spritesheet_url` (text) - Legacy field
- `generation_count` (integer) - Number of generations performed
- `created_at` (timestamptz) - Creation timestamp
- `updated_at` (timestamptz) - Last update timestamp
