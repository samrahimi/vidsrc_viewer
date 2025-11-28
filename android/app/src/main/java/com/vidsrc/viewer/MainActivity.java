package com.vidsrc.viewer;

import android.os.Bundle;
import android.os.Message;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient; // Imported for reference, but we use BridgeWebViewClient

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient; // REQUIRED for Capacitor

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        configureWebView(webView);

        // Hide system bars (Immersive Mode)
        // This keeps the app full screen without navigation buttons
        getWindow().getDecorView().setSystemUiVisibility(
                android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
                        | android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    public void configureWebView(WebView webView) {
        WebSettings settings = webView.getSettings();

        // --- 1. Basic Setup ---
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        
        // Critical for video players that might mix HTTP and HTTPS resources
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        // --- 2. Popup & Window Blocking Setup ---
        // We must enable these support flags so the WebView *detects* a popup attempt,
        // which allows our WebChromeClient (below) to intercept and kill it.
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);

        // --- 3. Navigation Security (The Sandbox) ---
        // We MUST extend BridgeWebViewClient. If we use a standard WebViewClient,
        // Capacitor plugins will break.
        webView.setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                boolean isTopFrame = request.isForMainFrame();

                // RULE A: IFRAMES (Video Embeds)
                // If the request is happening inside an iframe, ALLOW IT.
                // This ensures your streaming providers work.
                if (!isTopFrame) {
                    return false; // false = allow WebView to load it
                }

                // RULE B: TOP LEVEL NAVIGATION (The App Itself)
                // If the Main Window is trying to navigate, ONLY allow it if 
                // it is part of your local Capacitor app.
                if (isLocalAsset(url)) {
                    return false; // Allow local app navigation
                }

                // RULE C: EXTERNAL REDIRECTS (Ad Block)
                // If we are here, the Top Frame is trying to go to an external website 
                // (e.g., an ad redirect trying to escape the iframe). BLOCK IT.
                return true; // true = block the request
            }
        });

        // --- 4. Window/Popup Killer ---
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                // This catches window.open() and target="_blank"
                // We return false to tell Android "we handled this (by doing nothing)"
                // effectively blocking the new window.
                return false;
            }
        });
    }

    /**
     * Checks if the URL belongs to the local Capacitor app.
     */
    private boolean isLocalAsset(String url) {
        if (url == null) return false;
        
        // Capacitor standard local servers
        if (url.startsWith("https://localhost") || url.startsWith("http://localhost")) return true;
        
        // Standard Android file assets
        if (url.startsWith("file:///android_asset/")) return true;
        
        // Whitelist your specific app pages just to be safe
        if (url.contains("index.html") || 
            url.contains("watch.html") || 
            url.contains("search.html") || 
            url.contains("home.html")) {
            return true;
        }

        return false;
    }
}
