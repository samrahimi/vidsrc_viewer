#!/bin/bash
# Wrapper to run vidsrc viewer
# We now use the packaged app to ensure protocol handling works correctly on macOS.

APP_PATH="/Users/imac/Desktop/agtest/vidsrc_viewer/dist/VidsrcViewer-darwin-x64/VidsrcViewer.app/Contents/MacOS/VidsrcViewer"

exec "$APP_PATH" "$@"
