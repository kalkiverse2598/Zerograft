#!/bin/bash
# build_godot.sh - Build Godot with Agentic modules

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GODOT_SRC="$SCRIPT_DIR/godot-engine"
MODULES_SRC="$SCRIPT_DIR/modules"
ARCHIVE_DIR="$SCRIPT_DIR/../../archives"

echo "=== Agentic Godot Build Script ==="
echo "Godot source: $GODOT_SRC"
echo "Custom modules: $MODULES_SRC"

# Check if Godot source exists
if [ ! -d "$GODOT_SRC" ]; then
    echo "Error: Godot source not found at $GODOT_SRC"
    exit 1
fi

# Symlink custom modules into Godot
echo "Linking custom modules..."
ln -sf "$MODULES_SRC/godot_bridge" "$GODOT_SRC/modules/godot_bridge"
ln -sf "$MODULES_SRC/gdcef" "$GODOT_SRC/modules/gdcef"

# Optional: legacy CEF module (archived)
if [ "${ENABLE_GODOT_CEF:-}" = "1" ]; then
    if [ -d "$ARCHIVE_DIR/godot_cef" ]; then
        ln -sf "$ARCHIVE_DIR/godot_cef" "$GODOT_SRC/modules/godot_cef"
        echo "Legacy godot_cef module enabled"
    else
        echo "Warning: godot_cef not found in $ARCHIVE_DIR"
    fi
else
    # Ensure stale symlink doesn't linger in the Godot tree
    rm -f "$GODOT_SRC/modules/godot_cef" 2>/dev/null || true
fi

echo "Modules linked to Godot:"
ls -la "$GODOT_SRC/modules" | grep -E "gdcef|godot_bridge|godot_cef"

# Detect platform
case "$(uname -s)" in
    Darwin)
        PLATFORM="macos"
        JOBS=$(sysctl -n hw.ncpu)
        ;;
    Linux)
        PLATFORM="linuxbsd"
        JOBS=$(nproc)
        ;;
    MINGW*|MSYS*|CYGWIN*)
        PLATFORM="windows"
        JOBS=$NUMBER_OF_PROCESSORS
        ;;
    *)
        echo "Unsupported platform"
        exit 1
        ;;
esac

echo "Building for: $PLATFORM (using $JOBS cores)"

cd "$GODOT_SRC"

# Build editor
echo "Starting Godot build..."
scons platform=$PLATFORM target=editor -j$JOBS

echo "=== Build Complete ==="
echo "Editor binary location:"
ls -la bin/godot* 2>/dev/null || echo "Binary not found - check build output"
