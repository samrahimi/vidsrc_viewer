const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const activateDebuggerer = require('./net/debuggerer');

let startupUrl;

const LOG_ALL_REQUESTS = false
const DEBUGGERER_ENABLED = false

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
        // 1. Super adblocker: only works with vidsrc-embed.ru player, not .cc
        if (DEBUGGERER_ENABLED) activateDebuggerer();

        // 2. Log all network requests if enabled
        if (LOG_ALL_REQUESTS) {
            session.defaultSession.webRequest.onResponseStarted((details) => {
                const { url, method, responseHeaders } = details;
                // Content-Type header keys can be case-insensitive, but Electron usually normalizes them or provides them as is.
                // Let's try to find it case-insensitively just in case.
                const contentTypeKey = Object.keys(responseHeaders).find(key => key.toLowerCase() === 'content-type');
                const contentType = contentTypeKey ? responseHeaders[contentTypeKey][0] : 'unknown';

                console.log(`[Network] ${method} ${url} (${contentType})`);
            });
        }

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
                isMac ? { role: 'close' } : { role: 'quit' },
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
        // Check for updates
        const userDataPath = app.getPath('userData');
        const updatesDir = path.join(userDataPath, 'updates');
        const currentUpdateDir = path.join(updatesDir, 'current');
        const updateIndex = path.join(currentUpdateDir, 'index.html');

        if (fs.existsSync(updateIndex)) {
            console.log('Loading updated version from:', updateIndex);
            win.loadFile(updateIndex);
        } else {
            const browserPath = path.join(__dirname, 'browser', 'index.html');
            win.loadFile(browserPath);
        }

        // Check for new updates in background
        checkForUpdates(win);
    }
};

const fs = require('fs');
const https = require('https');
const AdmZip = require('adm-zip');

function checkForUpdates(win) {
    const versionUrl = 'https://vlixy.netlify.app/updates/version.json';

    https.get(versionUrl, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            try {
                const remoteVersion = JSON.parse(data);
                const packageJson = require('./package.json');
                const currentVersion = packageJson.version; // This might need to be stored/updated in userData to track applied updates

                // Simple version comparison (assuming semver)
                if (compareVersions(remoteVersion.version, currentVersion) > 0) {
                    console.log(`New version available: ${remoteVersion.version}`);
                    downloadUpdate(remoteVersion.url, win);
                }
            } catch (e) {
                console.error('Error checking for updates:', e);
            }
        });
    }).on('error', (e) => {
        console.error('Error checking for updates:', e);
    });
}

function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if (parts1[i] > parts2[i]) return 1;
        if (parts1[i] < parts2[i]) return -1;
    }
    return 0;
}

function downloadUpdate(url, win) {
    const userDataPath = app.getPath('userData');
    const updatesDir = path.join(userDataPath, 'updates');
    if (!fs.existsSync(updatesDir)) fs.mkdirSync(updatesDir, { recursive: true });

    const zipPath = path.join(updatesDir, 'update.zip');
    const file = fs.createWriteStream(zipPath);

    https.get(url, (response) => {
        response.pipe(file);
        file.on('finish', () => {
            file.close(() => {
                console.log('Update downloaded');
                installUpdate(zipPath, updatesDir, win);
            });
        });
    }).on('error', (err) => {
        fs.unlink(zipPath, () => { });
        console.error('Error downloading update:', err);
    });
}

function installUpdate(zipPath, updatesDir, win) {
    try {
        const zip = new AdmZip(zipPath);
        const extractPath = path.join(updatesDir, 'current');

        // Clean old update
        if (fs.existsSync(extractPath)) {
            fs.rmSync(extractPath, { recursive: true, force: true });
        }

        zip.extractAllTo(extractPath, true);
        console.log('Update installed to:', extractPath);

    } catch (e) {
        console.error('Error installing update:', e);
    }
}

