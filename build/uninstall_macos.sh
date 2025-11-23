#!/bin/bash

# Vidsrc Viewer - macOS Uninstallation Script
# This script removes all traces of the application from your system

echo "======================================"
echo "Vidsrc Viewer - Uninstallation"
echo "======================================"
echo ""

# Remove the symlink
if [ -L "/usr/local/bin/vidsrc" ]; then
    echo "Removing vidsrc command symlink..."
    rm /usr/local/bin/vidsrc
    echo "✓ Symlink removed"
else
    echo "⊘ Symlink not found (already removed or never installed)"
fi
echo ""

# Remove the packaged app
if [ -d "dist/VidsrcViewer-darwin-x64" ]; then
    echo "Removing packaged application..."
    rm -rf dist/VidsrcViewer-darwin-x64
    echo "✓ Packaged app removed"
else
    echo "⊘ Packaged app not found (already removed or never built)"
fi
echo ""

# Remove node_modules (optional, but good for a truly clean reinstall)
if [ -d "node_modules" ]; then
    echo "Removing node_modules..."
    rm -rf node_modules
    echo "✓ node_modules removed"
else
    echo "⊘ node_modules not found"
fi
echo ""

# Remove package-lock.json (optional)
if [ -f "package-lock.json" ]; then
    echo "Removing package-lock.json..."
    rm package-lock.json
    echo "✓ package-lock.json removed"
else
    echo "⊘ package-lock.json not found"
fi
echo ""

echo "======================================"
echo "Uninstallation Complete!"
echo "======================================"
echo ""
echo "The following have been removed:"
echo "  • /usr/local/bin/vidsrc symlink"
echo "  • dist/VidsrcViewer-darwin-x64 (packaged app)"
echo "  • node_modules directory"
echo "  • package-lock.json"
echo ""
echo "To reinstall, run: ./install_macos.sh"
echo ""
echo "Note: The vidsrc:// protocol handler registration"
echo "persists in macOS Launch Services. To fully reset it:"
echo "  /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -kill -r -domain local -domain system -domain user"
echo ""
