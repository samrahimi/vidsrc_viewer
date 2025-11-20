# Vidsrc Viewer

A popup-free, distraction-free viewer for `vidsrc.xyz` streams. This Electron-based application allows you to watch content without the annoyance of browser popups and ads. It also handles `vidsrc://` links directly, allowing for seamless integration with other tools.

## Features

*   **Popup Blocking**: Automatically blocks all popup windows and tabs.
*   **Custom Protocol**: Registers `vidsrc://` to open links directly in the viewer.
*   **Clean Interface**: Just the video, no browser chrome.

## Installation

### Prerequisites

*   **Node.js**: You need to have Node.js installed. [Download it here](https://nodejs.org/).
*   **macOS**: This guide is currently tailored for macOS users.

### Setup Guide

1.  **Clone the repository**
    ```bash
    git clone https://github.com/YOUR_USERNAME/vidsrc_viewer.git
    cd vidsrc_viewer
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Package the Application**
    This command builds the app and creates a standalone executable in the `dist` folder.
    ```bash
    npm run package
    ```

4.  **Register the Command (The "Magic" Step)**
    Run this command to allow you to type `vidsrc` in your terminal and to make `vidsrc://` links work.
    
    *Note: This assumes you are still in the `vidsrc_viewer` directory.*

    ```bash
    # Create a symlink to the executable in your path
    ln -sf "$(pwd)/dist/VidsrcViewer-darwin-x64/VidsrcViewer.app/Contents/MacOS/VidsrcViewer" /usr/local/bin/vidsrc
    
    # Open the app once to register the protocol with macOS
    open dist/VidsrcViewer-darwin-x64/VidsrcViewer.app
    ```

## Usage

### From the Command Line
You can open any URL (http or vidsrc scheme) directly:

```bash
vidsrc https://vidsrc.xyz/embed/movie/tt1234567
# OR
vidsrc vidsrc://vidsrc.xyz/embed/movie/tt1234567
```

### From the Browser
Simply click on any `vidsrc://` link, and it will open automatically in the Vidsrc Viewer.

## Development

If you want to modify the code:

1.  **Run in Development Mode**
    ```bash
    npm start
    ```
    This will launch the app using the source files directly.

2.  **Re-packaging**
    After making changes, run `npm run package` again to update the standalone app.

## Troubleshooting

*   **"App is damaged"**: If macOS complains the app is damaged, you may need to remove the quarantine attribute:
    ```bash
    xattr -cr dist/VidsrcViewer-darwin-x64/VidsrcViewer.app
    ```
