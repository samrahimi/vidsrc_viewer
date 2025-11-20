# Vidsrc Viewer

**A complete movie browsing and streaming application.** Discover and watch popular movies and TV shows in a beautiful, popup-free, ad-free environment. This Electron-based app combines content discovery with distraction-free viewing.

## ✨ Features

*   **🎬 Integrated Movie Browser**: Browse 10 popular movies and TV shows right from the app
*   **🚫 Popup Blocking**: Automatically blocks all popup windows and tabs
*   **🎯 Smart Protocol Switching**: Uses `vidsrc://` in the app for seamless streaming, `https://` in browsers
*   **🎨 Premium UI**: Beautiful dark theme with glassmorphism effects
*   **⚡ Ad-Free Experience**: No interruptions when using the desktop app
*   **🔗 Custom Protocol**: Handles `vidsrc://` links directly from your browser

## 🎮 Usage

### Launch the App

Simply open **Vidsrc Viewer** from Applications or Spotlight. You'll see a beautiful movie browser with curated content. Click any movie or show to start streaming instantly!

### From the Browser

When you encounter a `vidsrc://` link on the web, it will automatically open in the Vidsrc Viewer app if installed.

### Command Line (Optional)

If you've set up the symlink (see developer instructions), you can also launch URLs directly:

```bash
vidsrc https://vidsrc.xyz/embed/movie/tt0133093
vidsrc vidsrc://vidsrc.xyz/embed/tv/tt1190634
```

## 📥 Installation

### For End Users (Recommended)

**The easiest way to install** - no terminal required!

1.  **Download** the latest `VidsrcViewer-Installer.dmg` from the releases page
2.  **Open** the DMG file  
3.  **Drag** VidsrcViewer to your Applications folder
4.  **Launch** the app from Applications or Spotlight

That's it! The `vidsrc://` protocol handler and movie browser are ready to use.

### For Developers

#### Prerequisites

*   **Node.js**: You need to have Node.js installed. [Download it here](https://nodejs.org/).
*   **macOS**: This guide is currently tailored for macOS users.

#### macOS Users (Automated Installation)

**macOS developers** can use the automated installation script:

1.  **Clone the repository**
    ```bash
    git clone https://github.com/samrahimi/vidsrc_viewer.git
    cd vidsrc_viewer
    ```

2.  **Run the installation script**
    ```bash
    ./install_macos.sh
    ```

That's it! The script will automatically install dependencies, package the application, and register the `vidsrc` command and protocol handler.

#### Manual Installation (All Platforms)

**Windows and Linux developers** should follow these manual steps. Platform-specific packaging configurations will be added in the next release.

1.  **Clone the repository**
    ```bash
    git clone https://github.com/samrahimi/vidsrc_viewer.git
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

#### Building the DMG Installer (For Distribution)

To create a DMG installer for end users:

```bash
npm run build-dmg
```

This will:
1. Package the application
2. Create a DMG file at `dist/VidsrcViewer-Installer.dmg`
3. Include the classic "drag to Applications" interface

The DMG file can be distributed to users who want the GUI installation experience.

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
