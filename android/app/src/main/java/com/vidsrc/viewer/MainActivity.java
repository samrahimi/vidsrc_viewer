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
            if (url.startsWith("vidsrc://")) {
                view.loadUrl(url.replace("vidsrc://", "https://"));
                return true;
            }
            // Force internal loading for http/https to prevent external browser
            if (url.startsWith("http://") || url.startsWith("https://")) {
                if (url.contains("vidsrc.xyz") || url.contains("vidsrc-embed.ru"))
                    view.loadUrl(url);
                // don't load top level ad domains

                
                return true;
            }
            return super.shouldOverrideUrlLoading(view, request);
        }
    }
}
