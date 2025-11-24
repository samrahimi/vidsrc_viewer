const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let startupUrl;

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        icon: path.join(__dirname, 'icon.png'),
    });

    // CRITICAL: Block ALL new windows/tabs
    win.webContents.setWindowOpenHandler(({ url }) => {
        console.log(`Blocked popup: ${url}`);
        return { action: 'deny' };
    });

    // Optional: Prevent the main window from navigating to unwanted URLs if needed.
    // For now, we'll trust the user's initial URL and just block popups.

    // Get URL from command line args
    // args[0] is the executable, args[1] is the script, args[2] is the URL (usually)
    // In production/packaged apps it might be different, but for 'electron .' it's usually index 2.
    // Let's look for the first argument that starts with http OR vidsrc://
    const targetArg = process.argv.find(arg => arg.startsWith('http') || arg.startsWith('vidsrc://'));

    const urlToLoad = startupUrl || targetArg;

    if (urlToLoad) {
        if (urlToLoad.startsWith('vidsrc://')) {
            win.loadURL(urlToLoad.replace('vidsrc://', 'https://'));
        } else {
            win.loadURL(urlToLoad);
        }
    } else {
        // Load the movie browser UI by default
        const browserPath = path.join(__dirname, 'browser', 'index.html');
        win.loadFile(browserPath);
    }
}

// Single instance lock for deep linking
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
            if (win.isMinimized()) win.restore();
            win.focus();

            // Handle protocol url if present in args
            const url = commandLine.find(arg => arg.startsWith('vidsrc://'));
            if (url) {
                handleOpenUrl(url);
            }
        }
    });

    app.whenReady().then(() => {
        createWindow();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    });

    // Handle deep links on macOS
    app.on('open-url', (event, url) => {
        event.preventDefault();
        startupUrl = url;
        handleOpenUrl(url);
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

function handleOpenUrl(url) {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
        // Convert vidsrc:// to https://
        const httpsUrl = url.replace('vidsrc://', 'https://');
        win.loadURL(httpsUrl);
    }
}

// Set as default protocol client
// For packaged apps, use the app's own executable path
// For development, this will use the electron executable
if (app.isPackaged) {
    // In a packaged app, use the app's executable directly
    app.setAsDefaultProtocolClient('vidsrc');
} else {
    // In development mode
    app.setAsDefaultProtocolClient('vidsrc');
}

// Handle navigation home from preload script
ipcMain.on('navigate-home', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        const browserPath = path.join(__dirname, 'browser', 'index.html');
        win.loadFile(browserPath);
    }
});

// --- Custom Menu ---
const { Menu } = require('electron');

function createMenu(win) {
    const isMac = process.platform === 'darwin';

    const template = [
        // File Menu
        {
            label: 'File',
            submenu: [
                {
                    label: 'Clear History',
                    click: () => win.webContents.send('menu-action', 'clear-history')
                },
                {
                    label: 'Clear Favorites',
                    click: () => win.webContents.send('menu-action', 'clear-favorites')
                },
                isMac ? { role: 'close' } : { role: 'quit' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        // Edit Menu (Standard)
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'delete' },
                { type: 'separator' },
                { role: 'selectAll' }
            ]
        },
        // View Menu
        {
            label: 'View',
            submenu: [
                { role: 'togglefullscreen' }
            ]
        },
        // Help Menu
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Frequently Asked Questions',
                    click: () => win.webContents.send('menu-action', 'show-faq')
                },
                {
                    label: 'Support Our Work',
                    click: () => win.webContents.send('menu-action', 'show-support')
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// Update createWindow to set the menu
const originalCreateWindow = createWindow;
createWindow = function () {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        icon: path.join(__dirname, 'icon.png'),
    });

    // Create menu
    createMenu(win);

    // Toggle menu visibility on fullscreen
    win.on('enter-full-screen', () => {
        win.setMenuBarVisibility(false);
    });

    win.on('leave-full-screen', () => {
        win.setMenuBarVisibility(true);
    });

    // CRITICAL: Block ALL new windows/tabs
    win.webContents.setWindowOpenHandler(({ url }) => {
        console.log(`Blocked popup: ${url}`);
        return { action: 'deny' };
    });

    // Get URL from command line args
    const targetArg = process.argv.find(arg => arg.startsWith('http') || arg.startsWith('vidsrc://'));
    const urlToLoad = startupUrl || targetArg;

    if (urlToLoad) {
        if (urlToLoad.startsWith('vidsrc://')) {
            win.loadURL(urlToLoad.replace('vidsrc://', 'https://'));
        } else {
            win.loadURL(urlToLoad);
        }
    } else {
        const browserPath = path.join(__dirname, 'browser', 'index.html');
        win.loadFile(browserPath);
    }
};
