package com.wavebox.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.view.animation.AlphaAnimation;
import android.view.animation.Animation;
import android.view.animation.AnimationUtils;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.RelativeLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private SwipeRefreshLayout swipeRefreshLayout;
    private RelativeLayout errorLayout;
    private TextView errorText;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private FrameLayout fullscreenContainer;
    private LinearLayout loadingOverlay;
    private boolean firstLoad = true;

    private static final String APP_URL = "https://internetfm.netlify.app";

    @SuppressLint({"SetJavaScriptEnabled","AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        getWindow().setStatusBarColor(Color.parseColor("#0D0E17"));
        setContentView(R.layout.activity_main);

        webView            = findViewById(R.id.webview);
        swipeRefreshLayout = findViewById(R.id.swipe_refresh);
        errorLayout        = findViewById(R.id.error_layout);
        errorText          = findViewById(R.id.error_text);
        fullscreenContainer= findViewById(R.id.fullscreen_container);
        loadingOverlay     = findViewById(R.id.loading_overlay);

        setupWebView();
        setupSwipeRefresh();

        // Start background service
        Intent serviceIntent = new Intent(this, RadioService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            startForegroundService(serviceIntent);
        else
            startService(serviceIntent);

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
            hideLoadingOverlay();
        } else {
            webView.loadUrl(APP_URL);
        }
    }

    private void showLoadingOverlay() {
        if (loadingOverlay != null) loadingOverlay.setVisibility(View.VISIBLE);
    }

    private void hideLoadingOverlay() {
        if (loadingOverlay == null) return;
        AlphaAnimation fade = new AlphaAnimation(1f, 0f);
        fade.setDuration(500);
        fade.setAnimationListener(new Animation.AnimationListener() {
            public void onAnimationStart(Animation a) {}
            public void onAnimationRepeat(Animation a) {}
            public void onAnimationEnd(Animation a) {
                loadingOverlay.setVisibility(View.GONE);
            }
        });
        loadingOverlay.startAnimation(fade);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setUserAgentString(s.getUserAgentString() + " WaveboxApp/1.0 Android");
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setBackgroundColor(Color.parseColor("#0D0E17"));
        webView.addJavascriptInterface(new WaveboxBridge(this), "WaveboxBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView v, String url, android.graphics.Bitmap f) {
                super.onPageStarted(v, url, f);
                if (firstLoad) showLoadingOverlay();
                errorLayout.setVisibility(View.GONE);
            }
            @Override
            public void onPageFinished(WebView v, String url) {
                super.onPageFinished(v, url);
                swipeRefreshLayout.setRefreshing(false);
                if (firstLoad) { firstLoad = false; hideLoadingOverlay(); }
                injectMobileCSS(v);
            }
            @Override
            public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) {
                    swipeRefreshLayout.setRefreshing(false);
                    hideLoadingOverlay();
                    errorLayout.setVisibility(View.VISIBLE);
                    errorText.setText("No internet connection.\nPull down to retry.");
                }
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                String url = req.getUrl().toString();
                if (url.startsWith("https://internetfm.netlify.app") ||
                    url.startsWith("http://internetfm.netlify.app")) return false;
                if (url.startsWith("http") || url.startsWith("https")) {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    return true;
                }
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback cb) {
                if (customView != null) { cb.onCustomViewHidden(); return; }
                customView = view; customViewCallback = cb;
                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
                getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
                    View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
                    View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
                fullscreenContainer.addView(view);
                fullscreenContainer.setVisibility(View.VISIBLE);
                swipeRefreshLayout.setVisibility(View.GONE);
            }
            @Override
            public void onHideCustomView() {
                if (customView == null) return;
                fullscreenContainer.removeView(customView);
                fullscreenContainer.setVisibility(View.GONE);
                swipeRefreshLayout.setVisibility(View.VISIBLE);
                customView = null; customViewCallback.onCustomViewHidden();
                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
                getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
                getWindow().setStatusBarColor(Color.parseColor("#0D0E17"));
            }
            @Override
            public void onPermissionRequest(PermissionRequest r) { r.grant(r.getResources()); }
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) { return true; }
            @Override
            public void onProgressChanged(WebView v, int p) {}
        });
    }

    private void injectMobileCSS(WebView view) {
        view.loadUrl("javascript:(function(){" +
            "var s=document.createElement('style');" +
            "s.textContent='*{-webkit-tap-highlight-color:transparent;}'" +
            "+'html,body{padding-top:0!important;margin-top:0!important;}'" +
            "+'body>div:first-child{padding-bottom:90px!important;}'" +
            "+'::-webkit-scrollbar{display:none;}';" +
            "document.head.appendChild(s);" +
            "})();");
    }

    private void setupSwipeRefresh() {
        swipeRefreshLayout.setColorSchemeColors(
            Color.parseColor("#F97316"), Color.parseColor("#C084FC"));
        swipeRefreshLayout.setProgressBackgroundColorSchemeColor(Color.parseColor("#16171F"));
        swipeRefreshLayout.setOnRefreshListener(() -> {
            errorLayout.setVisibility(View.GONE);
            webView.reload();
        });
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent e) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (customView != null) { webView.getWebChromeClient().onHideCustomView(); return true; }
            if (webView.canGoBack()) { webView.goBack(); return true; }
        }
        return super.onKeyDown(keyCode, e);
    }

    @Override protected void onSaveInstanceState(Bundle o) { super.onSaveInstanceState(o); webView.saveState(o); }
    @Override protected void onResume()  { super.onResume();  webView.onResume();  webView.resumeTimers(); }
    @Override protected void onPause()   { super.onPause();   webView.onPause();   webView.pauseTimers(); }
    @Override protected void onDestroy() { if (webView!=null){webView.stopLoading();webView.destroy();} super.onDestroy(); }

    public static class WaveboxBridge {
        private final Activity a;
        WaveboxBridge(Activity a){this.a=a;}
        @JavascriptInterface public String getAppVersion(){return "1.0.0";}
        @JavascriptInterface public boolean isAndroidApp(){return true;}
    }
}
