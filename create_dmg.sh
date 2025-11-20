#!/bin/bash

# Vidsrc Viewer - DMG Creation Script
# Creates a beautiful DMG installer with drag-to-install interface

set -e  # Exit on any error

echo "======================================"
echo "Creating DMG Installer"
echo "======================================"
echo ""

APP_NAME="VidsrcViewer"
APP_PATH="dist/VidsrcViewer-darwin-x64/VidsrcViewer.app"
DMG_NAME="VidsrcViewer-Installer"
OUTPUT_DIR="dist"

# Check if the app exists
if [ ! -d "$APP_PATH" ]; then
    echo "Error: App not found at $APP_PATH"
    echo "Please run 'npm run package' first"
    exit 1
fi

echo "Creating DMG installer..."
echo ""

# Remove old DMG if it exists
if [ -f "$OUTPUT_DIR/$DMG_NAME.dmg" ]; then
    echo "Removing old DMG..."
    rm "$OUTPUT_DIR/$DMG_NAME.dmg"
fi

# Create the DMG using npx create-dmg
npx create-dmg "$APP_PATH" "$OUTPUT_DIR" \
    --overwrite \
    --volicon="icon.icns" \
    --dmg-title="Vidsrc Viewer" || true

# create-dmg generates a file with the app name, let's rename it
GENERATED_DMG=$(find "$OUTPUT_DIR" -maxdepth 1 -name "VidsrcViewer*.dmg" -type f | head -n 1)

if [ -n "$GENERATED_DMG" ]; then
    mv "$GENERATED_DMG" "$OUTPUT_DIR/$DMG_NAME.dmg"
    echo ""
    echo "======================================"
    echo "DMG Created Successfully!"
    echo "======================================"
    echo ""
    echo "Location: $OUTPUT_DIR/$DMG_NAME.dmg"
    echo ""
    echo "Users can now:"
    echo "  1. Download the DMG file"
    echo "  2. Open it"
    echo "  3. Drag VidsrcViewer to Applications"
    echo "  4. Launch from Applications or Spotlight"
    echo ""
    echo "Note: The vidsrc:// protocol will be registered"
    echo "automatically when the app is first launched."
    echo ""
else
    echo "Error: DMG creation failed"
    exit 1
fi
