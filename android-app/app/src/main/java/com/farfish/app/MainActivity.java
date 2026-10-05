package com.farfish.app;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.SslErrorHandler;
import android.net.http.SslError;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends AppCompatActivity {

    // Vercel deployment URL for FarFISH web app
    private static final String APP_URL = "https://farfish.vercel.app";
    private static final int FILE_CHOOSER_REQUEST_CODE = 1;

    private WebView webView;
    private SwipeRefreshLayout swipeRefreshLayout;
    private ProgressBar progressBar;
    private ValueCallback<Uri[]> filePathCallback;
    private UpdateChecker updateChecker;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Check network connectivity
        if (!isNetworkAvailable()) {
            showNetworkError();
            return;
        }

        // Initialize views
        webView = findViewById(R.id.webView);
        swipeRefreshLayout = findViewById(R.id.swipeRefreshLayout);
        progressBar = findViewById(R.id.progressBar);

        // Setup WebView
        setupWebView();

        // Setup pull-to-refresh
        swipeRefreshLayout.setOnRefreshListener(() -> {
            webView.reload();
            swipeRefreshLayout.setRefreshing(false);
        });

        // Initialize Safe Browsing
        WebView.startSafeBrowsing(this, success -> {
            if (!success) {
                Toast.makeText(this, "Safe Browsing initialization failed", Toast.LENGTH_SHORT).show();
            }
        });

        // Load the web app
        webView.loadUrl(APP_URL);

        // Show first-launch disclaimer (Play Store 2026 compliance)
        showFirstLaunchDisclaimer();

        // Check for app updates from GitHub Releases
        updateChecker = new UpdateChecker(this);
        updateChecker.checkForUpdate();

        // Handle deep links
        handleIntent(getIntent());
    }

    private void showFirstLaunchDisclaimer() {
        android.content.SharedPreferences prefs = getSharedPreferences("FarFISH", MODE_PRIVATE);
        boolean hasSeenDisclaimer = prefs.getBoolean("seen_disclaimer", false);

        if (!hasSeenDisclaimer) {
            new AlertDialog.Builder(this)
                .setTitle("Welcome to FarFISH")
                .setMessage("Before you continue:\n\n" +
                        "• You must be 18 or older to use this app\n\n" +
                        "• Connect your own non-custodial wallet (we never access your private keys)\n\n" +
                        "• Understand cryptocurrency risks before transacting\n\n" +
                        "• Staking and blockchain transactions involve financial risk\n\n" +
                        "• This app does not store or have access to your private keys")
                .setPositiveButton("I Understand & I'm 18+", (dialog, which) -> {
                    prefs.edit().putBoolean("seen_disclaimer", true).apply();
                })
                .setCancelable(false)
                .show();
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings webSettings = webView.getSettings();
        
        // JavaScript
        webSettings.setJavaScriptEnabled(true);
        
        // Storage
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        
        // Set explicit database path for persistence
        String databasePath = getApplicationContext().getDir("database", MODE_PRIVATE).getPath();
        webSettings.setDatabasePath(databasePath);
        
        // Security
        webSettings.setAllowFileAccess(false);
        webSettings.setAllowContentAccess(true);
        webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        
        // Cache
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
        
        // Zoom
        webSettings.setBuiltInZoomControls(false);
        webSettings.setDisplayZoomControls(false);
        webSettings.setSupportZoom(false);
        
        // User Agent - append identifier for Android
        String userAgent = webSettings.getUserAgentString();
        webSettings.setUserAgentString(userAgent + " FarfishAndroid/1.0");
        
        // Media
        webSettings.setMediaPlaybackRequiresUserGesture(false);
        
        // JavaScript Interface
        webView.addJavascriptInterface(new WebAppInterface(this), "Android");
        
        // WebViewClient
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                
                // Handle all non-http(s) schemes as external intents
                // This includes: wc:, ethereum:, metamask://, trust://, bitkeep://, etc.
                if (!url.startsWith("http://") && !url.startsWith("https://")) {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    try {
                        startActivity(intent);
                        android.util.Log.d("WalletConnect", "Opened deep link: " + url);
                    } catch (Exception e) {
                        android.util.Log.e("WalletConnect", "Failed to open deep link: " + url, e);
                        Toast.makeText(MainActivity.this, 
                            "No app found to handle this link. Please install the required wallet app.", 
                            Toast.LENGTH_LONG).show();
                    }
                    return true;
                }
                
                // Handle external links (open in browser)
                if (!url.startsWith(APP_URL) && 
                    (url.startsWith("http://") || url.startsWith("https://"))) {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                    return true;
                }
                
                // Load in WebView
                return false;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                progressBar.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                progressBar.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, 
                                       WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    showErrorPage();
                }
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, 
                                          SslError error) {
                // Never proceed with SSL errors - security first
                handler.cancel();
                Toast.makeText(MainActivity.this, 
                    "SSL Error: Connection not secure", 
                    Toast.LENGTH_LONG).show();
            }
        });
        
        // WebChromeClient
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                // Log console messages for debugging
                android.util.Log.d("WebView", 
                    consoleMessage.message() + " -- From line " + 
                    consoleMessage.lineNumber() + " of " + 
                    consoleMessage.sourceId());
                return true;
            }

            @Override
            public boolean onJsAlert(WebView view, String url, String message, 
                                    JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                    .setTitle("Alert")
                    .setMessage(message)
                    .setPositiveButton("OK", (dialog, which) -> result.confirm())
                    .setOnCancelListener(dialog -> result.cancel())
                    .create()
                    .show();
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, 
                                      JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                    .setTitle("Confirm")
                    .setMessage(message)
                    .setPositiveButton("OK", (dialog, which) -> result.confirm())
                    .setNegativeButton("Cancel", (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel())
                    .create()
                    .show();
                return true;
            }

            @Override
            public boolean onJsPrompt(WebView view, String url, String message, 
                                     String defaultValue, JsPromptResult result) {
                final android.widget.EditText input = new android.widget.EditText(MainActivity.this);
                input.setText(defaultValue);
                
                new AlertDialog.Builder(MainActivity.this)
                    .setTitle("Prompt")
                    .setMessage(message)
                    .setView(input)
                    .setPositiveButton("OK", (dialog, which) -> 
                        result.confirm(input.getText().toString()))
                    .setNegativeButton("Cancel", (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel())
                    .create()
                    .show();
                return true;
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                // Grant camera permission for QR scanning (WalletConnect)
                if (request.getResources().length > 0) {
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                            request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                            return;
                        }
                    }
                }
                request.deny();
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                                           FileChooserParams fileChooserParams) {
                // Handle file upload dialogs
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;

                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE);
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    Toast.makeText(MainActivity.this, 
                        "Cannot open file chooser", 
                        Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }

            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
            }
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent != null && Intent.ACTION_VIEW.equals(intent.getAction())) {
            Uri uri = intent.getData();
            if (uri != null) {
                String url = uri.toString();
                android.util.Log.d("WalletConnect", "Deep link received: " + url);
                if (url.startsWith("wc:") || url.startsWith("farfish://wc")) {
                    final String jsUrl = url.replace("'", "\\'");
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('walletconnect', {detail: '" + jsUrl + "'}));",
                        null
                    );
                }
            }
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        // Handle back button
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        
        // Show exit confirmation
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            new AlertDialog.Builder(this)
                .setTitle("Exit")
                .setMessage("Are you sure you want to exit FarFISH?")
                .setPositiveButton("Yes", (dialog, which) -> finish())
                .setNegativeButton("No", null)
                .show();
            return true;
        }
        
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (filePathCallback == null) return;
            
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                String dataString = data.getDataString();
                if (dataString != null) {
                    results = new Uri[]{Uri.parse(dataString)};
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        }
    }

    private boolean isNetworkAvailable() {
        ConnectivityManager connectivityManager = 
            (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        NetworkInfo networkInfo = connectivityManager.getActiveNetworkInfo();
        return networkInfo != null && networkInfo.isConnected();
    }

    private void showNetworkError() {
        setContentView(R.layout.activity_error);
        findViewById(R.id.retryButton).setOnClickListener(v -> {
            recreate();
        });
    }

    private void showErrorPage() {
        webView.loadData(
            "<html><body style='margin:0;padding:20px;font-family:sans-serif;text-align:center;'>" +
            "<h2 style='color:#FF6B6B;'>Connection Error</h2>" +
            "<p>Unable to load FarFISH. Please check your connection.</p>" +
            "<button onclick='window.location.reload()' style='padding:10px 20px;background:#14F195;border:none;border-radius:8px;font-size:16px;cursor:pointer;'>Retry</button>" +
            "</body></html>",
            "text/html",
            "UTF-8"
        );
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        if (updateChecker != null) {
            updateChecker.cleanup();
        }
        super.onDestroy();
    }
}
