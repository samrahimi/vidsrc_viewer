document.addEventListener('DOMContentLoaded', () => {
    const contentArea = document.getElementById('content-area');
    const loadingState = document.getElementById('loading-state');

    // Simulate a brief loading state for smoother UX
    setTimeout(() => {
        detectAndServe();
    }, 800);

    function detectAndServe() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        let os = "unknown";

        // Simple detection logic
        if (/android/i.test(userAgent)) {
            os = "android";
        } else if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
            os = "ios";
        } else if (/Win/.test(userAgent)) {
            os = "windows";
        } else if (/Mac/.test(userAgent)) {
            os = "mac";
        } else if (/Linux/.test(userAgent)) {
            os = "linux"; // Assuming Linux desktop, but could be Android if not caught above
        }

        renderContent(os);
    }

    function renderContent(os) {
        loadingState.classList.add('hidden');
        contentArea.classList.remove('hidden');
        contentArea.classList.add('fade-in');

        let html = '';

        switch (os) {
            case 'android':
                html = `
                    <h2>Download for Android</h2>
                    <p style="margin-bottom: 2rem; color: #9ca3af;">Version 1.0.0 Beta • 23 MB</p>
                    <a href="vlix-beta.apk" class="btn" download>Download APK</a>
                    
                    <div class="instructions">
                        <h3>How to Install</h3>
                        <ol>
                            <li>Download the <strong>vlix-beta.apk</strong> file.</li>
                            <li>Open the file. You may see a security warning.</li>
                            <li>Tap <strong>Settings</strong> and enable <strong>"Allow from this source"</strong>.</li>
                            <li>Go back and tap <strong>Install</strong>.</li>
                        </ol>
                        <div class="warning-box">
                            <span>⚠️</span>
                            <div>
                                <strong>Unknown Developer Warning:</strong><br>
                                Since we are in beta and not on the Play Store yet, your phone might flag this. This is normal for direct downloads.
                            </div>
                        </div>
                    </div>
                `;
                break;

            case 'windows':
                html = `
                    <h2>Download for Windows</h2>
                    <p style="margin-bottom: 2rem; color: #9ca3af;">Version 1.0.0 Beta • ZIP Archive</p>
                    <a href="vlix-beta-windows.zip" class="btn" download>Download for Windows</a>
                    
                    <div class="instructions">
                        <h3>How to Install</h3>
                        <ol>
                            <li>Download and extract the <strong>ZIP file</strong>.</li>
                            <li>Run the <strong>Vlix.exe</strong> installer.</li>
                            <li>If Windows SmartScreen appears, click <strong>"More info"</strong>.</li>
                            <li>Click <strong>"Run anyway"</strong> to start the installation.</li>
                        </ol>
                         <div class="warning-box">
                            <span>ℹ️</span>
                            <div>
                                <strong>Why the warning?</strong><br>
                                We haven't purchased a Microsoft code signing certificate yet. The app is safe and clean.
                            </div>
                        </div>
                    </div>
                `;
                break;

            case 'mac':
                html = `
                    <h2>Download for Mac</h2>
                    <p style="margin-bottom: 2rem; color: #9ca3af;">Version 1.0.0 Beta • Apple Silicon (M1/M2/M3)</p>
                    <a href="vlix-beta-macos-arm64.dmg" class="btn" download>Download for Mac</a>
                    
                    <div class="instructions">
                        <h3>How to Install</h3>
                        <ol>
                            <li>Download the <strong>.dmg file</strong> and open it.</li>
                            <li>Drag the Vlix app to your <strong>Applications</strong> folder.</li>
                            <li><strong>Right-click</strong> (or Control-click) the app and select <strong>Open</strong>.</li>
                            <li>Click <strong>Open</strong> in the dialog box.</li>
                        </ol>
                        <div class="warning-box">
                            <span>🍎</span>
                            <div>
                                <strong>"Unidentified Developer" Error:</strong><br>
                                If you can't open it, go to <strong>System Settings > Privacy & Security</strong> and scroll down to allow Vlix.
                            </div>
                        </div>
                    </div>
                `;
                break;

            case 'ios':
                html = `
                    <h2>iOS Support Coming Soon</h2>
                    <p style="margin-bottom: 2rem; color: #9ca3af;">We are working hard on an iOS version.</p>
                    <div class="btn" style="background-color: #374151; cursor: default; box-shadow: none;">Not Available Yet</div>
                    
                    <div class="instructions">
                        <p>Due to Apple's strict App Store policies, we are currently exploring alternative distribution methods (TestFlight or AltStore) for iOS.</p>
                        <p style="margin-top: 1rem;">Check back soon!</p>
                    </div>
                `;
                break;

            default:
                // Fallback for Linux or unknown
                html = `
                    <h2>Select Your Platform</h2>
                    <p style="margin-bottom: 2rem; color: #9ca3af;">We couldn't detect your device automatically.</p>
                    
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        <a href="vlix-beta.apk" class="btn" style="margin-bottom: 0;">Android (APK)</a>
                        <a href="vlix-beta-windows.zip" class="btn" style="margin-bottom: 0;">Windows (ZIP)</a>
                        <a href="vlix-beta-macos-arm64.dmg" class="btn" style="margin-bottom: 0;">Mac (Apple Silicon)</a>
                    </div>
                `;
                break;
        }

        contentArea.innerHTML = html;
    }
});
