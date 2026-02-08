#!/bin/bash
# Zerograft Installer for macOS
# Usage: curl -fsSL https://raw.githubusercontent.com/kalkiverse2598/Zerograft/main/install.sh | bash

set -e

RELEASE_URL="https://github.com/kalkiverse2598/Zerograft/releases/download/v1.0.0-alpha/Zerograft-macOS-arm64.zip"
INSTALL_DIR="/Applications"
TMP_DIR=$(mktemp -d)

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║       Zerograft Installer            ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# Check architecture
ARCH=$(uname -m)
if [ "$ARCH" != "arm64" ]; then
    echo "  ⚠️  Warning: This build is for Apple Silicon (arm64)."
    echo "  Your architecture is: $ARCH"
    echo "  The app may not work correctly."
    echo ""
fi

# Download
echo "  → Downloading Zerograft..."
curl -fSL "$RELEASE_URL" -o "$TMP_DIR/zerograft.zip" --progress-bar

# Extract
echo "  → Extracting..."
cd "$TMP_DIR"
ditto -xk zerograft.zip extracted 2>/dev/null || unzip -qo zerograft.zip -d extracted

# Find the .app bundle
APP_PATH=$(find extracted -maxdepth 3 -name "Zerograft.app" -type d | head -1)

if [ -z "$APP_PATH" ]; then
    echo "  ❌ Error: Zerograft.app not found in archive"
    rm -rf "$TMP_DIR"
    exit 1
fi

# Remove quarantine
xattr -cr "$APP_PATH" 2>/dev/null || true

# Remove old install if exists
if [ -d "$INSTALL_DIR/Zerograft.app" ]; then
    echo "  → Removing previous installation..."
    rm -rf "$INSTALL_DIR/Zerograft.app"
fi

# Copy to Applications
echo "  → Installing to $INSTALL_DIR..."
cp -R "$APP_PATH" "$INSTALL_DIR/"
xattr -cr "$INSTALL_DIR/Zerograft.app" 2>/dev/null || true

# Cleanup
rm -rf "$TMP_DIR"

echo ""
echo "  ✅ Zerograft installed to /Applications/Zerograft.app"
echo "  → Launching..."
echo ""

open "$INSTALL_DIR/Zerograft.app"
