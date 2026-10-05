# WalletConnect Deep Link Fix

## Problem Summary

The Android app was showing `net::ERR_UNKNOWN_URL_SCHEME` errors when users tried to connect wallets through WalletConnect. The WebView was attempting to load wallet-specific deep links (like `metamask://wc?uri=...`, `trust://wc?uri=...`, `bitkeep://wc?uri=...`) as web pages instead of opening them as external intents to launch the wallet apps.

### Screenshots Evidence
The error appeared for multiple wallets:
- **BiKeep**: `bitkeep://wc?uri=wc%3A2baa4abdd...`
- **Trust Wallet**: `trust://wc?uri=wc%3A7ab583e834...`
- **MetaMask**: `metamask://wc?uri=wc%3Aebc8e811...`

All showing: `net::ERR_UNKNOWN_URL_SCHEME`

## Root Cause

The `shouldOverrideUrlLoading` method in MainActivity.java was only handling `wc:` and `ethereum:` URL schemes. It did NOT handle wallet-specific schemes like:
- `metamask://`
- `trust://`
- `bitkeep://`
- `rainbow://`
- `argent://`
- And dozens of other wallet-specific schemes

When WalletConnect tried to redirect to these wallet apps, the WebView attempted to load them as web pages, resulting in the error.

## Solution

Modified the `shouldOverrideUrlLoading` method to intercept **ALL non-HTTP(S) schemes** and open them as external intents. This is the standard Android WebView pattern for handling deep links.

### Code Changes

**File**: `c:\Users\PC\Desktop\farfish\android-app\app\src\main\java\com\farfish\app\MainActivity.java`

**Before**:
```java
@Override
public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
    String url = request.getUrl().toString();
    
    // Handle WalletConnect deep links
    if (url.startsWith("wc:") || url.startsWith("ethereum:")) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(MainActivity.this, 
                "No wallet app found. Please install a Web3 wallet.", 
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
```

**After**:
```java
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
```

### Key Changes:
1. **Universal scheme handling**: Changed from checking specific schemes to checking if URL is NOT http(s)
2. **Comprehensive coverage**: Now handles ALL wallet-specific deep link schemes automatically
3. **Better logging**: Added debug and error logging for troubleshooting
4. **Better error message**: More specific message when wallet app is not installed

## Why This Works

According to [WalletConnect official documentation](https://docs.walletconnect.com/wallets/ios/mobile-linking) and Android WebView best practices:

1. **Deep links are the standard**: Wallet apps register custom URL schemes (e.g., `metamask://`) to handle WalletConnect connections
2. **WebView cannot load custom schemes**: By design, WebView only loads http(s) URLs
3. **Intent system is the bridge**: Android's Intent system allows apps to handle custom schemes via `ACTION_VIEW` intents
4. **Generic approach is best**: Instead of maintaining a whitelist of wallet schemes, we check if the scheme is NOT http(s) and delegate to the system

This pattern is recommended in multiple Stack Overflow answers and is the standard approach for handling deep links in Android WebViews.

## Testing

Build succeeded:
```
BUILD SUCCESSFUL in 16s
35 actionable tasks: 15 executed, 20 from cache
```

APK location: `c:\Users\PC\Desktop\farfish\android-app\app\build\outputs\apk\debug\app-debug.apk`

## Expected Behavior After Fix

1. User clicks "Connect Wallet" in the FarFISH web app
2. User selects a wallet (MetaMask, Trust Wallet, BiKeep, etc.)
3. WalletConnect generates the connection URI
4. Web app redirects to wallet-specific deep link (e.g., `metamask://wc?uri=...`)
5. **MainActivity intercepts the deep link** (NEW)
6. **Android opens the wallet app via Intent** (NEW)
7. User approves connection in their wallet app
8. Wallet app returns to FarFISH app via the registered deep link handlers
9. Connection established successfully

## Installation Instructions

1. Transfer the APK to your Android device:
   - `c:\Users\PC\Desktop\farfish\android-app\app\build\outputs\apk\debug\app-debug.apk`

2. Install the APK (allow installation from unknown sources if prompted)

3. Open the app and try connecting any WalletConnect-compatible wallet

4. The wallet app should now open correctly instead of showing the error

## Related Files

- **MainActivity.java**: Contains the fixed deep link handling
- **AndroidManifest.xml**: Already properly configured to receive WalletConnect callbacks
- **Build file**: `app/build.gradle` (no changes needed)

## References

- [WalletConnect Mobile Linking Documentation](https://docs.walletconnect.com/wallets/ios/mobile-linking)
- [Android WebView ERR_UNKNOWN_URL_SCHEME Solutions](https://stackoverflow.com/questions/41693263/android-webview-err-unknown-url-scheme)
- Content was rephrased for compliance with licensing restrictions
