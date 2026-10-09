package com.farfish.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * JavaScript interface for communication between WebView and native Android.
 * Exposed to JavaScript as window.Android
 */
public class WebAppInterface {
    private Context context;

    public WebAppInterface(Context context) {
        this.context = context;
    }

    /**
     * Get device information
     * @return JSON string with platform info
     */
    @JavascriptInterface
    public String getDeviceInfo() {
        JSONObject deviceInfo = new JSONObject();
        try {
            deviceInfo.put("platform", "android");
            deviceInfo.put("appVersion", "1.0.0");
            deviceInfo.put("userAgent", "FarfishAndroid/1.0");
        } catch (JSONException e) {
            e.printStackTrace();
        }
        return deviceInfo.toString();
    }

    /**
     * Open URL in external browser
     * @param url URL to open
     */
    @JavascriptInterface
    public void openExternalUrl(String url) {
        if (url == null || url.isEmpty()) {
            return;
        }

        try {
            Uri uri = Uri.parse(url);
            
            // Validate URI scheme
            if (uri.getScheme() == null) {
                throw new IllegalArgumentException("Invalid URL format: missing scheme");
            }
            
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        } catch (IllegalArgumentException e) {
            Toast.makeText(context, "Invalid URL format", Toast.LENGTH_SHORT).show();
        } catch (android.content.ActivityNotFoundException e) {
            Toast.makeText(context, "No app found to open this link", Toast.LENGTH_SHORT).show();
        } catch (SecurityException e) {
            Toast.makeText(context, "Permission denied", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Toast.makeText(context, "Cannot open URL", Toast.LENGTH_SHORT).show();
        }
    }

    /**
     * Show native toast message
     * @param message Message to display
     */
    @JavascriptInterface
    public void showToast(String message) {
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show();
    }

    /**
     * Check if running in Android app
     * @return true always (since this is Android)
     */
    @JavascriptInterface
    public boolean isAndroidApp() {
        return true;
    }

    /**
     * Report JavaScript errors from web app to native Android
     * @param errorType Type of error (e.g., "UnhandledRejection", "WalletConnect")
     * @param errorMessage Error message
     * @param errorStack Stack trace (optional)
     */
    @JavascriptInterface
    public void reportError(String errorType, String errorMessage, String errorStack) {
        android.util.Log.e("WebApp", String.format("JS Error: %s - %s\n%s", 
            errorType, errorMessage, errorStack != null ? errorStack : ""));
        
        // Show user-friendly error based on type
        String userMessage = "An error occurred. Please try again.";
        if (errorMessage != null && (errorMessage.toLowerCase().contains("invalid app configuration") || 
            errorMessage.toLowerCase().contains("walletconnect"))) {
            userMessage = "Wallet connection unavailable. Please check your network and try again.";
        }
        
        final String finalMessage = userMessage;
        ((android.app.Activity) context).runOnUiThread(() -> 
            Toast.makeText(context, finalMessage, Toast.LENGTH_LONG).show()
        );
    }

    /**
     * Report WalletConnect initialization status
     * @param status "success" or "failed"
     * @param errorDetails Error details if failed (empty string if success)
     */
    @JavascriptInterface
    public void checkWalletConnectStatus(String status, String errorDetails) {
        if ("failed".equals(status)) {
            android.util.Log.e("WalletConnect", "Initialization failed: " + errorDetails);
            ((android.app.Activity) context).runOnUiThread(() -> 
                Toast.makeText(context, 
                    "Wallet connection is temporarily unavailable. Please try again later.", 
                    Toast.LENGTH_LONG).show()
            );
        } else if ("success".equals(status)) {
            android.util.Log.d("WalletConnect", "Initialization successful");
        }
    }

    /**
     * Report network connectivity status from web app
     * @param status "online" or "offline"
     */
    @JavascriptInterface
    public void reportNetworkStatus(String status) {
        android.util.Log.d("NetworkStatus", "Network status changed: " + status);
    }
}
