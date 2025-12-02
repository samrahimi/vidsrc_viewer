# Vlix - Advanced Streaming Client

Vlix is a next-generation streaming client built with Electron (Desktop) and Capacitor (Android). It features a premium, Netflix-style interface, an integrated AI concierge, and a robust update system that allows for over-the-air updates without re-downloading the application.

## 🚀 Getting Started

### Prerequisites
- Node.js (v20 recommended)
- Java JDK 17+ (for Android builds)
- Android Studio (for Android emulation/building)

### Local Development (Electron)
To run the desktop application locally:

```bash
# Install dependencies
npm install

# Start the Electron development server
npm start
```

### Android Development
To sync changes to the Android project:

```bash
# Sync web assets to the native Android project
npm run build:android

# Open in Android Studio to run on emulator/device
npx cap open android
```

---

## 🏗️ Architecture & Features

### 🛡️ "Sketchy" Stream Handling & Popup Suppression
Vlix aggregates streams from various third-party providers (like vidsrc). These sources often contain aggressive popups and blind redirects. We handle this natively to ensure a clean user experience:

*   **Electron (`main.js`)**: We use `win.webContents.setWindowOpenHandler` to intercept all new window creation attempts. We return `{ action: 'deny' }` for everything, effectively killing all popups before they open.
*   **Android (`MainActivity.java`)**: We override `WebChromeClient` and `BridgeWebViewClient`.
    *   `onCreateWindow`: Returns `false` to block new windows.
    *   `shouldOverrideUrlLoading`: Intercepts navigation. We allow navigation within `iframes` (so the video player works) and local app assets, but block all top-level navigations to external URLs, preventing "frame-busting" ads.

### 🤖 AI Chat Agent & Memory System
The integrated chatbot (`browser/chat.js`) is context-aware and maintains long-term memory of user interactions.

1.  **Context Injection**: The main app (`browser/app.js`) monitors user activity (what they are watching, browsing, etc.) and injects this context into the chat iframe via `postMessage`.
2.  **Context Compression**: To keep token usage low and performance high, conversation history is periodically sent to an LLM to be summarized into a concise narrative.
3.  **Long-Term Memory**: These summaries are stored in `localStorage` (`browser/longTermMemory.js`). On app launch, these memories are retrieved and injected into the agent's system prompt, giving it "memory" of past conversations and user preferences.

### 🌊 User Onboarding Flow
When a user first launches Vlix, they are guided through a 5-step personalization flow (`browser/onboarding.html`):
1.  **Welcome**
2.  **Genre Selection**
3.  **Actor Selection**
4.  **Movie Selection**
5.  **TV Show Selection**

**Data Generation**:
Once completed, the app uses an LLM to generate a "User Story" based on these selections, and then hallucinates a list of 49 recommended titles. These titles are then "enriched" by verifying them against the TMDB API to get real metadata (posters, IDs) before being saved to the user's profile.

**Critique & Improvements**:
*   **Current Weakness**: The flow relies on client-side API keys and performs heavy LLM/API operations on the client, which can be slow or fail if the user closes the app too quickly.
*   **Inefficiency**: The "enrichment" process fetches data sequentially, which is slow.
*   **Improvement**: Move the recommendation generation to a serverless function. Cache the "User Story" generation. Use `Promise.all` with rate limiting for enrichment to speed up the process.

---

## 🔄 Build & Update Workflow

Vlix uses a dual-update strategy: **Native Installers** for binary changes and **Hot Updates** for UI/Logic changes.

### 1. GitHub Build Workflow
The CI/CD pipeline is defined in `.github/workflows/build.yml`.
*   **Triggers**: Push to `main` or `master`.
*   **Jobs**: Builds for macOS (Intel & Apple Silicon), Ubuntu, Windows, and Android.
*   **Artifacts**: Uploads installers (DMG, EXE, AppImage, APK) as GitHub Actions artifacts.

### 2. Updating the Public Website (`vlix_website`)
To update the download links on the public website with the latest build artifacts:

```bash
# Downloads artifacts from the latest GitHub Action run, renames them with the build number,
# moves them to vlix_website/installers, and updates version.json.
python3 scripts/download_artifacts.py
```

### 3. Deploying the Website
The website is hosted on Netlify. To deploy the updated website (after running the script above):

```bash
# Deploy to production
netlify deploy --prod --dir=vlix_website
```

### 4. Publishing Hot Updates
For changes to the web app (HTML/JS/CSS) that *don't* require native code changes, we can push an update directly to clients without them needing to re-download the installer.

```bash
# 1. Updates APP_VERSION in browser/app.js
# 2. Zips the 'browser/' directory
# 3. Creates vlix_website/updates/update.zip and version.json
node scripts/publish_update.js

# Then deploy the website again to make the update live
netlify deploy --prod --dir=vlix_website
```
**Note**: This is not currently working in the Android client. It works reasonably well in Electron.


**Client Handling**:
*   **Electron**: Checks `version.json` on startup. If a new version is found, it downloads the zip, extracts it to `userData/updates`, and loads that version instead of the bundled one.
*   **Android**: Uses the Capacitor Updater plugin to perform the same check and update process, swapping the web assets on the fly.


### 5. Remote Config Endpoint
Default settings are loaded from `browser/settings.json` in the client. Current settings are loaded from `https://vlixy.netlify.app/config/settings.json` and take precedence over the default settings, if different. 

When you add a new setting, PLEASE update settings.json in both locations. Note: to update the remote settings, edit settings.json in the vlix_website/config directory and then run `netlify deploy --prod .` from vlix_website
