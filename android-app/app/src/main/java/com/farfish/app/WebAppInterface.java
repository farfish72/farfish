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
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
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
}
