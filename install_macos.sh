#!/bin/bash

# Vidsrc Viewer - macOS Installation Script
# This script automates steps 2, 3, and 4 of the setup process

set -e  # Exit on any error

echo "======================================"
echo "Vidsrc Viewer - macOS Installation"
echo "======================================"
echo ""

# Step 2: Install Dependencies
echo "Step 1/3: Installing Node.js dependencies..."
npm install
echo "✓ Dependencies installed successfully"
echo ""

# Step 3: Package the Application
echo "Step 2/3: Packaging the application..."
npm run package
echo "✓ Application packaged successfully"
echo ""

# Step 4: Register the Command
echo "Step 3/3: Registering the 'vidsrc' command and protocol handler..."

# Create symlink to the executable
ln -sf "$(pwd)/dist/VidsrcViewer-darwin-x64/VidsrcViewer.app/Contents/MacOS/VidsrcViewer" /usr/local/bin/vidsrc
echo "✓ Command 'vidsrc' registered in /usr/local/bin"

# Open the app once to register the protocol with macOS
open dist/VidsrcViewer-darwin-x64/VidsrcViewer.app
echo "✓ Opening app to register vidsrc:// protocol handler"
echo ""

echo "======================================"
echo "Installation Complete!"
echo "======================================"
echo ""
echo "You can now:"
echo "  • Type 'vidsrc <url>' in your terminal"
echo "  • Click vidsrc:// links in your browser"
echo ""
echo "Example usage:"
echo "  vidsrc https://vidsrc.xyz/embed/movie/tt1234567"
echo ""
