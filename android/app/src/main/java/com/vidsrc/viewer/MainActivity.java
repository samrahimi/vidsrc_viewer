package com.vidsrc.viewer;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        webView.setWebViewClient(new CustomWebViewClient(getBridge()));
        webView.setWebChromeClient(new CustomWebChromeClient());
        
        // Hide system bars (Immersive Mode)
        getWindow().getDecorView().setSystemUiVisibility(
            android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
            | android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
            
        handleIntent(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        Uri data = intent.getData();
        
        if (data != null && "vidsrc".equals(data.getScheme())) {
            String url = data.toString();
            String newUrl = url.replace("vidsrc://", "https://");
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.loadUrl(newUrl);
            }
        }
    }

    private class CustomWebViewClient extends BridgeWebViewClient {
        public CustomWebViewClient(Bridge bridge) {
            super(bridge);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            String url = request.getUrl().toString();

            /*
            if (url.startsWith("vidsrc://")) {
                view.loadUrl(url.replace("vidsrc://", "https://"));
                return true;
            }
            */
            if (url.contains("watch.html") || 
            url.contains("vidsrc.cc") || 
            url.contains("vidsrc.xyz") || 
            url.contains("vidsrc-embed.ru")) {
                view.loadUrl(url);
                return true;
            } else {
                return false
            }

            return super.shouldOverrideUrlLoading(view, request);
        }
    }

    private class CustomWebChromeClient extends android.webkit.WebChromeClient {
        private android.view.View mCustomView;
        private android.webkit.WebChromeClient.CustomViewCallback mCustomViewCallback;
        private int mOriginalOrientation;
        private int mOriginalSystemUiVisibility;

        @Override
        public void onShowCustomView(android.view.View view, android.webkit.WebChromeClient.CustomViewCallback callback) {
            if (mCustomView != null) {
                onHideCustomView();
                return;
            }

            mCustomView = view;
            mOriginalSystemUiVisibility = getWindow().getDecorView().getSystemUiVisibility();
            mOriginalOrientation = getRequestedOrientation();

            mCustomViewCallback = callback;

            android.widget.FrameLayout decor = (android.widget.FrameLayout) getWindow().getDecorView();
            decor.addView(mCustomView, new android.widget.FrameLayout.LayoutParams(
                    android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                    android.view.ViewGroup.LayoutParams.MATCH_PARENT));

            getWindow().getDecorView().setSystemUiVisibility(
                    android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
                            android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
                            android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
                            android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                            android.view.View.SYSTEM_UI_FLAG_FULLSCREEN |
                            android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }

        @Override
        public void onHideCustomView() {
            android.widget.FrameLayout decor = (android.widget.FrameLayout) getWindow().getDecorView();
            decor.removeView(mCustomView);
            mCustomView = null;

            getWindow().getDecorView().setSystemUiVisibility(mOriginalSystemUiVisibility);
            setRequestedOrientation(mOriginalOrientation);

            mCustomViewCallback.onCustomViewHidden();
            mCustomViewCallback = null;
        }
    }
}
