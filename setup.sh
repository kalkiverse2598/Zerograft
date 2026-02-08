#!/bin/bash
# setup.sh - One-command setup for ZeroGraft (Agentic Godot)
# Usage: git clone --recurse-submodules https://github.com/kalkiverse2598/Zerograft.git && cd Zerograft && ./setup.sh

set -e

echo "=== ZeroGraft Setup ==="
echo ""

# ── 1. Init submodules if not already done ──
echo "[1/5] Initializing submodules (Godot 4.3 + gdCEF)..."
git submodule update --init --recursive --depth 1
echo "      ✓ Submodules ready"

# ── 2. Build Godot with AI modules ──
echo ""
echo "[2/5] Building Godot with Agentic modules..."
cd Spritmaker-2/godot/src/agentic-godot

# Check for scons
if ! command -v scons &> /dev/null; then
    echo "      ⚠ scons not found. Installing via pip..."
    pip3 install scons
fi

./build_godot.sh
echo "      ✓ Godot built"

# ── 3. Install AI Router dependencies ──
cd ../../..
echo ""
echo "[3/5] Installing AI Router (ZeroGraft AI) dependencies..."
cd src/zerograft-ai/src/mcp-servers/godot
npm install
echo "      ✓ AI Router dependencies installed"

# ── 4. Setup .env from example ──
if [ ! -f .env ]; then
    cp .env.example .env
    echo ""
    echo "[4/5] Created .env from .env.example"
    echo "      ⚠ IMPORTANT: Edit .env and set your GEMINI_API_KEY"
    echo "        vi $(pwd)/.env"
else
    echo ""
    echo "[4/5] .env already exists, skipping"
fi

# ── 5. Install SpriteMancer backend dependencies ──
cd ../../../../..
echo ""
echo "[5/5] Installing SpriteMancer backend dependencies..."
if [ -d "Spritemancerai/backend" ]; then
    cd Spritemancerai/backend
    if [ -f requirements.txt ]; then
        pip3 install -r requirements.txt 2>/dev/null || echo "      ⚠ pip install failed - install manually: pip3 install -r Spritemancerai/backend/requirements.txt"
    fi
    cd ../..
fi
echo "      ✓ SpriteMancer dependencies installed"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To run ZeroGraft:"
echo ""
echo "  1. Start Godot Editor:"
echo "     cd Spritmaker-2/godot/src/agentic-godot/godot-engine"
echo "     ./bin/godot.macos.editor.arm64 --editor --path ../project"
echo ""
echo "  2. Start AI Router (in another terminal):"
echo "     cd Spritmaker-2/godot/src/zerograft-ai/src/mcp-servers/godot"
echo "     npm run dev"
echo ""
echo "  3. Start SpriteMancer backend (in another terminal):"
echo "     cd Spritemancerai/backend"
echo "     uvicorn main:app --reload --port 8000"
echo ""
echo "  4. Start SpriteMancer frontend (in another terminal):"
echo "     cd Spritemancerai/frontend"
echo "     npm run dev"
echo ""
echo "Live demo available at: https://spritemancer.zerograft.online"
