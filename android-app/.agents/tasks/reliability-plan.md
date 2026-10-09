# FarFISH APK Reliability & Error Handling - Implementation Plan

**Task:** Fix "Invalid App Configuration" errors, white screen issues, and implement comprehensive error handling across Android native layer, Next.js web app, and WalletConnect integration.

**Context:** Root cause analysis completed at `android-app/.agents/error-handling-root-cause-analysis.md`. All issues verified by reading actual source files.

**Colors:** Primary #14F195, Error #FF6B6B, Background dark #0a0a0a / #1A1A2E

**Constraints:**
- DO NOT modify mint/stake/referral logic
- DO NOT change existing UI designs beyond error states
- NO new external dependencies
- All error messages in plain user language (English/Bengali where user expects it)
- Must preserve existing functionality while adding recovery mechanisms

---

## Implementation Steps

### Phase 1: Critical Android Native Fixes (White Screen Prevention)

- [ ] 1. Add HTTP error handler to MainActivity WebViewClient to prevent white screen on server errors (4xx/5xx responses).
      
      **What:** Implement missing `onReceivedHttpError` handler in MainActivity.java's WebViewClient. This catches HTTP 404, 500, 502, 503 errors that currently show blank white screen forever.
      
      **Files:** 
      - `android-app/app/src/main/java/com/farfish/app/MainActivity.java`
      
      **Changes:**
      - Add `onReceivedHttpError` method after `onReceivedError` (around line 232)
      - Modify `showErrorPage()` to accept title and message parameters (currently takes no params at line 406)
      - Add error categorization: 5xx → "Server Temporarily Unavailable", 404 → "Page Not Found", 4xx → "Connection Error"
      - Use `runOnUiThread()` to show error page safely from WebView callback
      
      **Code pattern:**
      ```java
      @Override
      public void onReceivedHttpError(WebView view, WebResourceRequest request, 
                                     android.webkit.WebResourceResponse errorResponse) {
          super.onReceivedHttpError(view, request, errorResponse);
          
          if (request.isForMainFrame()) {
              int statusCode = errorResponse.getStatusCode();
              android.util.Log.e("WebView", "HTTP Error: " + statusCode + " for " + request.getUrl());
              
              String title = "Connection Error";
              String message = "Unable to load FarFISH. Please check your connection.";
              
              if (statusCode >= 500) {
                  title = "Server Temporarily Unavailable";
                  message = "FarFISH servers are experiencing issues. Please try again in a few minutes.";
              } else if (statusCode == 404) {
                  title = "Page Not Found";
                  message = "The requested page could not be found.";
              }
              
              final String finalTitle = title;
              final String finalMessage = message;
              runOnUiThread(() -> showErrorPage(finalTitle, finalMessage));
          }
      }
      
      // Update showErrorPage signature
      private void showErrorPage(String title, String message) {
          webView.loadData(
              "<html><body style='margin:0;padding:20px;font-family:sans-serif;text-align:center;background:#1A1A2E;color:white;'>" +
              "<h2 style='color:#FF6B6B;'>" + title + "</h2>" +
              "<p>" + message + "</p>" +
              "<button onclick='window.location.reload()' style='padding:10px 20px;background:#14F195;border:none;border-radius:8px;font-size:16px;cursor:pointer;color:#0a0a0a;font-weight:bold;'>Retry</button>" +
              "</body></html>",
              "text/html",
              "UTF-8"
          );
      }
      
      // Keep old signature for backward compatibility with existing call at line 228
      private void showErrorPage() {
          showErrorPage("Connection Error", "Unable to load FarFISH. Please check your connection.");
      }
      ```
      
      **Verify:** Build APK with `gradlew.bat assembleDebug`, test by:
      1. Temporarily changing APP_URL to a non-existent page (404)
      2. Temporarily changing APP_URL to httpstat.us/500 (500 error simulator)
      3. Confirm error page shows with correct title/message, not white screen
      4. Confirm Retry button reloads the page

---

- [ ] 2. Add network check to SplashActivity to prevent launching MainActivity when offline.
      
      **What:** SplashActivity currently blindly launches MainActivity after 1.5s delay with no network awareness. If device is offline at launch, user sees white screen. Add network check with retry dialog.
      
      **Files:**
      - `android-app/app/src/main/java/com/farfish/app/SplashActivity.java`
      
      **Changes:**
      - Add imports: `android.app.AlertDialog`, `android.net.ConnectivityManager`, `android.net.NetworkInfo`
      - Add `isNetworkAvailable()` method using ConnectivityManager
      - Add `showNoNetworkDialog()` showing AlertDialog with Retry/Exit buttons
      - Add `startMainActivity()` helper to DRY up Intent code
      - Modify Handler callback in `onCreate()` to check network before launching MainActivity
      
      **Code pattern:**
      ```java
      @Override
      protected void onCreate(Bundle savedInstanceState) {
          super.onCreate(savedInstanceState);
          setContentView(R.layout.activity_splash);
      
          new Handler().postDelayed(() -> {
              if (isNetworkAvailable()) {
                  startMainActivity();
              } else {
                  showNoNetworkDialog();
              }
          }, SPLASH_DURATION);
      }
      
      private void startMainActivity() {
          Intent intent = new Intent(SplashActivity.this, MainActivity.class);
          startActivity(intent);
          finish();
      }
      
      private boolean isNetworkAvailable() {
          ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
          NetworkInfo networkInfo = cm.getActiveNetworkInfo();
          return networkInfo != null && networkInfo.isConnected();
      }
      
      private void showNoNetworkDialog() {
          new AlertDialog.Builder(this)
              .setTitle("No Internet Connection")
              .setMessage("FarFISH requires an internet connection to function. Please enable WiFi or mobile data.")
              .setPositiveButton("Retry", (dialog, which) -> {
                  if (isNetworkAvailable()) {
                      startMainActivity();
                  } else {
                      showNoNetworkDialog(); // Show again if still offline
                  }
              })
              .setNegativeButton("Exit", (dialog, which) -> finish())
              .setCancelable(false)
              .show();
      }
      ```
      
      **Verify:** Build APK, test by:
      1. Turn off WiFi and mobile data
      2. Launch app
      3. Confirm dialog appears after splash screen (not white screen)
      4. Confirm Exit button closes app
      5. Turn on network, tap Retry, confirm MainActivity loads

---

- [ ] 3. Add page load timeout handler to prevent infinite loading spinner.
      
      **What:** WebView has no timeout configured. If DNS hangs or server is slow, loading spinner shows forever. Add 15-second timeout that shows error page if page doesn't finish loading.
      
      **Files:**
      - `android-app/app/src/main/java/com/farfish/app/MainActivity.java`
      
      **Changes:**
      - Add field: `private static final int PAGE_LOAD_TIMEOUT_MS = 15000;`
      - Add field: `private Handler timeoutHandler = new Handler();`
      - Add field: `private Runnable timeoutRunnable;`
      - In `onPageStarted` (line 216): start timeout timer
      - In `onPageFinished` (line 222): cancel timeout timer
      - In `onDestroy`: clean up handler callbacks
      
      **Code pattern:**
      ```java
      private static final int PAGE_LOAD_TIMEOUT_MS = 15000; // 15 seconds
      private Handler timeoutHandler = new Handler();
      private Runnable timeoutRunnable;
      
      @Override
      public void onPageStarted(WebView view, String url, Bitmap favicon) {
          super.onPageStarted(view, url, favicon);
          progressBar.setVisibility(View.VISIBLE);
          
          // Start timeout timer
          timeoutRunnable = () -> {
              if (view.getProgress() < 100) {
                  android.util.Log.e("WebView", "Page load timeout for: " + url);
                  view.stopLoading();
                  showErrorPage("Connection Timeout", 
                      "FarFISH is taking too long to load. Please check your connection and try again.");
              }
          };
          timeoutHandler.postDelayed(timeoutRunnable, PAGE_LOAD_TIMEOUT_MS);
      }
      
      @Override
      public void onPageFinished(WebView view, String url) {
          super.onPageFinished(view, url);
          progressBar.setVisibility(View.GONE);
          
          // Cancel timeout
          if (timeoutRunnable != null) {
              timeoutHandler.removeCallbacks(timeoutRunnable);
          }
      }
      
      // In onDestroy method (line 434), add before webView.destroy():
      timeoutHandler.removeCallbacksAndMessages(null);
      ```
      
      **Verify:** Build APK, test by:
      1. Use Chrome DevTools to throttle network to "Slow 3G"
      2. Launch app and observe loading
      3. Confirm timeout triggers at 15 seconds if page doesn't load
      4. Confirm no timeout if page loads normally within 15 seconds

---

- [ ] 4. Add critical JavaScript error detection and recovery in WebChromeClient.
      
      **What:** JavaScript errors (React hydration failures, WalletConnect init errors) are logged to console but never shown to user. Add error tracking that shows recovery UI after multiple critical errors.
      
      **Files:**
      - `android-app/app/src/main/java/com/farfish/app/MainActivity.java`
      
      **Changes:**
      - Add fields: `private int jsErrorCount = 0;` and `private static final int MAX_JS_ERRORS = 5;`
      - Modify `onConsoleMessage` (line 240) to detect critical error patterns
      - Add `incrementJsErrorCount()` method that shows error page after threshold
      - Detect patterns: "Cannot read property", "undefined is not", "null is not", "hydration", "React"
      
      **Code pattern:**
      ```java
      private int jsErrorCount = 0;
      private static final int MAX_JS_ERRORS = 5;
      
      @Override
      public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
          String message = consoleMessage.message();
          android.util.Log.d("WebView", 
              message + " -- From line " + 
              consoleMessage.lineNumber() + " of " + 
              consoleMessage.sourceId());
          
          // Detect critical errors
          if (consoleMessage.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
              if (message.contains("Cannot read property") || 
                  message.contains("undefined is not") ||
                  message.contains("null is not") ||
                  message.contains("hydration") ||
                  message.contains("React")) {
                  
                  android.util.Log.e("WebView", "Critical JS error detected: " + message);
                  incrementJsErrorCount();
              }
          }
          
          return true;
      }
      
      private void incrementJsErrorCount() {
          jsErrorCount++;
          if (jsErrorCount >= MAX_JS_ERRORS) {
              runOnUiThread(() -> {
                  showErrorPage("App Error", 
                      "FarFISH encountered an error. Please restart the app or contact support if this persists.");
              });
              jsErrorCount = 0; // Reset counter
          }
      }
      ```
      
      **Verify:** Build APK, test by:
      1. Inject JavaScript error via Chrome DevTools: `throw new Error("Cannot read property 'x' of undefined")`
      2. Repeat 5 times quickly
      3. Confirm error page shows after 5th error
      4. Test with normal app usage - confirm no false positives

---

- [ ] 5. Add null safety checks and try-catch to prevent crashes in MainActivity.
      
      **What:** Several methods lack null checks that could cause crashes: webView might be null when handleIntent calls evaluateJavascript (line 357), webView from findViewById could be null (line 53), setupWebView could throw exception (line 56).
      
      **Files:**
      - `android-app/app/src/main/java/com/farfish/app/MainActivity.java`
      
      **Changes:**
      - After `webView = findViewById(R.id.webView);` at line 53: add null check, show toast, finish() if null
      - Wrap `setupWebView();` call at line 56 in try-catch, show toast + finish() on exception
      - In `handleIntent()` at line 357: add webView null check before `evaluateJavascript` call
      
      **Code pattern:**
      ```java
      // After line 53
      webView = findViewById(R.id.webView);
      if (webView == null) {
          android.util.Log.e("MainActivity", "WebView not found in layout");
          Toast.makeText(this, "App initialization failed. Please reinstall.", Toast.LENGTH_LONG).show();
          finish();
          return;
      }
      
      swipeRefreshLayout = findViewById(R.id.swipeRefreshLayout);
      progressBar = findViewById(R.id.progressBar);
      
      // Wrap setupWebView at line 56
      try {
          setupWebView();
      } catch (Exception e) {
          android.util.Log.e("MainActivity", "Failed to setup WebView", e);
          Toast.makeText(this, "Failed to initialize app. Please reinstall.", Toast.LENGTH_LONG).show();
          finish();
          return;
      }
      
      // In handleIntent() before evaluateJavascript (line 357)
      if (webView == null) {
          android.util.Log.w("WalletConnect", "WebView not ready for deep link");
          return;
      }
      webView.evaluateJavascript(/* ... */);
      ```
      
      **Verify:** Build APK, run through Android Lint:
      ```
      gradlew.bat lint
      ```
      Confirm no new warnings about NullPointerException. Manual testing: normal app launch and deep link handling work correctly.

---

### Phase 2: Android-Web Bridge Enhancements

- [ ] 6. Add JavaScript error reporting bridge from web app to Android.
      
      **What:** Web app has no way to report JavaScript errors (like WalletConnect init failures) to Android. Add `reportError()` JavascriptInterface method that can show user-friendly native toasts/dialogs.
      
      **Files:**
      - `android-app/app/src/main/java/com/farfish/app/WebAppInterface.java`
      
      **Changes:**
      - Add `reportError(String errorType, String errorMessage, String errorStack)` method with `@JavascriptInterface` annotation
      - Log error details with Log.e
      - Show user-friendly Toast based on error type (special handling for WalletConnect errors)
      
      **Code pattern:**
      ```java
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
          if (errorMessage != null && (errorMessage.contains("Invalid app configuration") || 
              errorMessage.contains("WalletConnect"))) {
              userMessage = "Wallet connection unavailable. Please check your network connection.";
          }
          
          final String finalMessage = userMessage;
          ((android.app.Activity) context).runOnUiThread(() -> 
              Toast.makeText(context, finalMessage, Toast.LENGTH_LONG).show()
          );
      }
      ```
      
      **Verify:** Build APK, test by:
      1. Open Chrome DevTools connected to WebView
      2. Execute in console: `window.Android.reportError('TestError', 'Test message', 'stack trace')`
      3. Confirm toast appears
      4. Confirm error logged in Logcat with tag "WebApp"

---

- [ ] 7. Add WalletConnect status check bridge method.
      
      **What:** Web app needs to report WalletConnect initialization success/failure to Android so native layer knows if wallet features will work.
      
      **Files:**
      - `android-app/app/src/main/java/com/farfish/app/WebAppInterface.java`
      
      **Changes:**
      - Add `checkWalletConnectStatus(String status, String errorDetails)` method with `@JavascriptInterface`
      - On "failed" status, log error and show toast to user
      
      **Code pattern:**
      ```java
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
      ```
      
      **Verify:** Build APK, test by:
      1. Execute in DevTools: `window.Android.checkWalletConnectStatus('failed', 'Network timeout')`
      2. Confirm toast shows
      3. Execute: `window.Android.checkWalletConnectStatus('success', '')`
      4. Confirm only log message, no toast

---

- [ ] 8. Improve deep link error handling with specific wallet detection.
      
      **What:** Deep link exception handling in MainActivity line 167-178 uses generic catch(Exception) and shows same toast for all errors. User doesn't know which wallet app to install. Add specific exception handling with wallet name detection and Play Store redirect option.
      
      **Files:**
      - `android-app/app/src/main/java/com/farfish/app/MainActivity.java`
      
      **Changes:**
      - Replace catch block at line 167-178 with multiple catch blocks: ActivityNotFoundException, SecurityException, Exception
      - Extract wallet name from URL scheme (metamask, trust, coinbase)
      - For ActivityNotFoundException: show AlertDialog with Install/Cancel buttons, Install redirects to Play Store
      - For SecurityException: show permission denied message
      - For generic Exception: show error with exception message
      
      **Code pattern:**
      ```java
      try {
          startActivity(intent);
          android.util.Log.d("WalletConnect", "Opened deep link: " + url);
      } catch (android.content.ActivityNotFoundException e) {
          android.util.Log.e("WalletConnect", "No app to handle: " + url, e);
          
          // Detect wallet type from URL scheme
          String walletName = "wallet app";
          if (url.contains("metamask")) walletName = "MetaMask";
          else if (url.contains("trust")) walletName = "Trust Wallet";
          else if (url.contains("coinbase")) walletName = "Coinbase Wallet";
          else if (url.contains("rainbow")) walletName = "Rainbow";
          
          final String finalWalletName = walletName;
          new AlertDialog.Builder(MainActivity.this)
              .setTitle("Wallet App Required")
              .setMessage("Please install " + finalWalletName + " to continue.\n\nWould you like to visit the app store?")
              .setPositiveButton("Install", (dialog, which) -> {
                  Intent playStoreIntent = new Intent(Intent.ACTION_VIEW, 
                      Uri.parse("https://play.google.com/store/search?q=" + finalWalletName + "&c=apps"));
                  startActivity(playStoreIntent);
              })
              .setNegativeButton("Cancel", null)
              .show();
      } catch (SecurityException e) {
          android.util.Log.e("WalletConnect", "Permission denied: " + url, e);
          Toast.makeText(MainActivity.this, 
              "Permission denied. Please check app permissions in Settings.", 
              Toast.LENGTH_LONG).show();
      } catch (Exception e) {
          android.util.Log.e("WalletConnect", "Failed to open deep link: " + url, e);
          Toast.makeText(MainActivity.this, 
              "Failed to open wallet app. Error: " + e.getMessage(), 
              Toast.LENGTH_LONG).show();
      }
      ```
      
      **Verify:** Build APK, test by:
      1. Ensure MetaMask NOT installed
      2. Tap "Connect Wallet" and select MetaMask from WalletConnect modal
      3. Confirm AlertDialog appears with "Install MetaMask" option
      4. Tap Install, confirm Play Store opens
      5. Repeat with installed wallet to confirm normal flow works

---

- [ ] 9. Fix UpdateChecker exception handling and unregister receiver safety.
      
      **What:** UpdateChecker uses generic catch(Exception) hiding error types (line 109), and unregisterReceiver can throw IllegalArgumentException if receiver was never registered (line 230).
      
      **Files:**
      - `android-app/app/src/main/java/com/farfish/app/UpdateChecker.java`
      
      **Changes:**
      - Replace generic catch at line 109 with specific catches: UnknownHostException, SocketTimeoutException, JSONException, Exception
      - Add boolean field `receiverRegistered` to track if BroadcastReceiver was registered
      - Set `receiverRegistered = true` after successful `registerReceiver()` call (line 180)
      - In `cleanup()` method (line 227): check `receiverRegistered` before unregistering
      - Add IllegalArgumentException catch in cleanup for defensive handling
      
      **Code pattern:**
      ```java
      // Add field
      private boolean receiverRegistered = false;
      
      // In checkForUpdate() catch blocks (replace line 109)
      } catch (java.net.UnknownHostException e) {
          Log.e(TAG, "No network connection for update check", e);
          // Don't show error - update check is optional
      } catch (java.net.SocketTimeoutException e) {
          Log.e(TAG, "Update check timed out", e);
      } catch (org.json.JSONException e) {
          Log.e(TAG, "Failed to parse GitHub release data", e);
      } catch (Exception e) {
          Log.e(TAG, "Unexpected error checking for updates", e);
      }
      
      // In downloadAndInstallUpdate(), after registerReceiver (line 180)
      activity.registerReceiver(downloadReceiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
      receiverRegistered = true;
      
      // In cleanup() method (replace line 227-236)
      public void cleanup() {
          try {
              if (downloadReceiver != null && receiverRegistered) {
                  activity.unregisterReceiver(downloadReceiver);
                  downloadReceiver = null;
                  receiverRegistered = false;
              }
          } catch (IllegalArgumentException e) {
              Log.w(TAG, "Receiver was not registered", e);
          } catch (Exception e) {
              Log.e(TAG, "Error during cleanup", e);
          }
      }
      ```
      
      **Verify:** Build APK with `gradlew.bat assembleDebug`, run through Android Lint:
      ```
      gradlew.bat lint
      ```
      Confirm no new warnings. Test app launch and exit multiple times to verify cleanup doesn't crash.

---

### Phase 3: Next.js Web App Error Handling

- [ ] 10. Connect ErrorBoundary to Android bridge for error reporting.
      
      **What:** ErrorBoundary component exists at `app/components/ErrorBoundary.tsx` but its `componentDidCatch` method only logs to console. It doesn't call the Android bridge to report errors to native layer.
      
      **Files:**
      - `app/components/ErrorBoundary.tsx`
      
      **Changes:**
      - In `componentDidCatch` method after console.error (around line 27), add check for `window.Android` and call `reportError()`
      - Pass error type, message, and stack to Android bridge
      
      **Code pattern:**
      ```typescript
      componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log full error details for developers
        console.error('Global Error Boundary caught an error:', {
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
        });
        
        // Report to Android native layer if available
        if (typeof window !== 'undefined' && (window as any).Android?.reportError) {
          try {
            (window as any).Android.reportError(
              'React Error Boundary',
              error.message || 'Unknown error',
              error.stack || ''
            );
          } catch (e) {
            console.error('Failed to report error to Android:', e);
          }
        }
      }
      ```
      
      **Verify:** Run Next.js dev server:
      ```
      npm run dev
      ```
      Test by temporarily adding a component that throws error in render. Confirm:
      1. Error boundary UI shows
      2. Error logged to console
      3. When testing in APK with DevTools: confirm `window.Android.reportError` called (visible in Logcat)

---

- [ ] 11. Add global unhandledrejection listener to app layout.
      
      **What:** Unhandled promise rejections (like WalletConnect init failures) aren't caught by ErrorBoundary. Add global listener in root layout that reports to Android bridge.
      
      **Files:**
      - `app/layout.tsx`
      
      **Changes:**
      - Add client component wrapper or use `useEffect` to register window listener
      - Since layout is server component, create new client component `app/components/UnhandledErrorReporter.tsx`
      - Import and include in layout
      
      **First, create new file `app/components/UnhandledErrorReporter.tsx`:**
      ```typescript
      'use client';
      
      import { useEffect } from 'react';
      
      export default function UnhandledErrorReporter() {
        useEffect(() => {
          const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            console.error('Unhandled promise rejection:', {
              reason: event.reason,
              promise: event.promise,
              timestamp: new Date().toISOString(),
            });
            
            // Report to Android native layer if available
            if (typeof window !== 'undefined' && (window as any).Android?.reportError) {
              try {
                const message = event.reason?.message || String(event.reason) || 'Unknown error';
                const stack = event.reason?.stack || '';
                (window as any).Android.reportError('UnhandledRejection', message, stack);
              } catch (e) {
                console.error('Failed to report unhandled rejection to Android:', e);
              }
            }
          };
          
          window.addEventListener('unhandledrejection', handleUnhandledRejection);
          
          return () => {
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
          };
        }, []);
        
        return null;
      }
      ```
      
      **Then modify `app/layout.tsx`:**
      - Add import: `import UnhandledErrorReporter from "./components/UnhandledErrorReporter";`
      - Add `<UnhandledErrorReporter />` inside `<ErrorBoundary>` tag, before `<WalletProvider>`
      
      **Files:**
      - Create: `app/components/UnhandledErrorReporter.tsx`
      - Modify: `app/layout.tsx`
      
      **Verify:** Run dev server, test by executing in browser console:
      ```javascript
      Promise.reject(new Error('Test unhandled rejection'))
      ```
      Confirm error logged to console. In APK: confirm reported to Android (visible in Logcat).

---

- [ ] 12. Create NetworkStatus component to show offline banner.
      
      **What:** No UI indication when user goes offline. Create component that listens to `navigator.onLine` events and shows banner at top of screen when offline.
      
      **Files:**
      - Create: `app/components/NetworkStatus.tsx`
      - Modify: `app/layout.tsx`
      
      **Create `app/components/NetworkStatus.tsx`:**
      ```typescript
      'use client';
      
      import { useState, useEffect } from 'react';
      import { WifiSlash } from '@phosphor-icons/react';
      
      export default function NetworkStatus() {
        const [isOnline, setIsOnline] = useState(true);
        
        useEffect(() => {
          // Set initial state
          setIsOnline(navigator.onLine);
          
          const handleOnline = () => setIsOnline(true);
          const handleOffline = () => setIsOnline(false);
          
          window.addEventListener('online', handleOnline);
          window.addEventListener('offline', handleOffline);
          
          return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
          };
        }, []);
        
        if (isOnline) return null;
        
        return (
          <div 
            className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-3 shadow-lg"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
            }}
          >
            <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
              <WifiSlash size={20} weight="bold" />
              <span className="text-sm font-semibold">No Internet Connection</span>
            </div>
          </div>
        );
      }
      ```
      
      **Modify `app/layout.tsx`:**
      - Add import: `import NetworkStatus from "./components/NetworkStatus";`
      - Add `<NetworkStatus />` inside `<body>` tag, right after `<ErrorBoundary>` and before `<WalletProvider>`
      
      **Verify:** Run dev server, test by:
      1. Opening Chrome DevTools
      2. Network tab → Throttling → Offline
      3. Confirm red banner appears at top
      4. Switch back to Online
      5. Confirm banner disappears

---

- [ ] 13. Add error handling to WalletConnect initialization in wagmi.ts.
      
      **What:** WalletConnect configuration in `app/lib/wagmi.ts` has no try-catch. If projectId is invalid or network fails, initialization silently fails. Wrap in try-catch and report to Android bridge.
      
      **Files:**
      - `app/lib/wagmi.ts`
      
      **Changes:**
      - This file exports config, not a function, so runtime errors won't be caught here
      - Instead, add initialization check in WalletProvider where config is used
      - Move to next step (WalletProvider error boundary)
      
      **Actually, better approach:** Add status reporter in WalletProvider after Wagmi mounts.
      
      **Skip this step - covered in next step.**

---

- [ ] 14. Add error boundary around WagmiProvider initialization.
      
      **What:** WalletProvider wraps WagmiProvider with no error handling. If wagmi config fails to initialize or WalletConnect fails, entire app could break. Add try-catch error boundary specific to wallet initialization.
      
      **Files:**
      - `app/providers/WalletProvider.tsx`
      
      **Changes:**
      - Add useEffect to check WalletConnect initialization after mount
      - Report status to Android bridge
      - Add error state and fallback UI if wallet initialization fails (app still works, just wallet features unavailable)
      
      **Code pattern:**
      ```typescript
      "use client";
      
      import { PropsWithChildren, useState, useEffect } from "react";
      import { WagmiProvider } from "wagmi";
      import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
      import { wagmiConfig } from "../lib/wagmi";
      
      const WalletProvider = ({ children }: PropsWithChildren) => {
        const [queryClient] = useState(() => new QueryClient());
        const [walletError, setWalletError] = useState<string | null>(null);
      
        useEffect(() => {
          // Check WalletConnect initialization after mount
          const checkWalletConnect = async () => {
            try {
              // WalletConnect initialization happens when connectors are accessed
              // We can check if projectId is present
              const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
              if (!projectId) {
                throw new Error('WalletConnect project ID not configured');
              }
              
              // Report success to Android
              if (typeof window !== 'undefined' && (window as any).Android?.checkWalletConnectStatus) {
                (window as any).Android.checkWalletConnectStatus('success', '');
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              console.error('WalletConnect initialization failed:', errorMessage);
              setWalletError(errorMessage);
              
              // Report failure to Android
              if (typeof window !== 'undefined' && (window as any).Android?.checkWalletConnectStatus) {
                (window as any).Android.checkWalletConnectStatus('failed', errorMessage);
              }
            }
          };
          
          checkWalletConnect();
        }, []);
      
        if (walletError) {
          console.warn('Wallet features may be unavailable:', walletError);
          // Don't block the app - just log the error
          // Wallet features will gracefully fail when user tries to connect
        }
      
        return (
          <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
              {children}
            </QueryClientProvider>
          </WagmiProvider>
        );
      };
      
      export default WalletProvider;
      ```
      
      **Verify:** Run dev server:
      ```
      npm run dev
      ```
      Check browser console - should see no errors. In APK: check Logcat for "WalletConnect successful" log from Android bridge. Temporarily break WALLETCONNECT_PROJECT_ID in .env.local to test error path.

---

### Phase 4: Integration Testing & Polish

- [ ] 15. Test complete error flow end-to-end in APK.
      
      **What:** Build production APK and test all error scenarios with actual Android device to ensure error handling works correctly across Android-Web bridge.
      
      **Test Scenarios:**
      1. Launch app with no internet (airplane mode) → Should show network dialog from SplashActivity
      2. Launch app, then turn off network mid-loading → Should show timeout error page after 15s
      3. Change APP_URL to httpstat.us/500 temporarily → Should show "Server Temporarily Unavailable" error page
      4. Tap "Connect Wallet", select wallet not installed → Should show AlertDialog with Play Store option
      5. Open DevTools and inject JS error → After 5 errors should show error page
      6. Turn off network, wait for offline banner → Should show red banner at top
      7. Check Logcat for proper error logging throughout all scenarios
      
      **Build commands:**
      ```powershell
      cd android-app
      .\gradlew.bat assembleDebug
      ```
      
      **APK location:** `android-app/app/build/outputs/apk/debug/app-debug.apk`
      
      **Verify:** Execute all 7 test scenarios above. Document results. All scenarios should show user-friendly error messages (no white screens, no generic "something went wrong").

---

- [ ] 16. Update .env.local documentation and verify production URL configuration.
      
      **What:** `.env.local` has `NEXT_PUBLIC_APP_URL=http://localhost:3000` which is correct for development. Verify that production builds use `https://app.farfish.xyz`. Document environment variables.
      
      **Files:**
      - `.env.local` (add comments)
      - Create: `android-app/.agents/environment-setup.md`
      
      **In `.env.local`, add comments:**
      ```bash
      # WalletConnect Project ID (required for wallet connection)
      # Get your project ID at https://dashboard.reown.com
      NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=d2d0e8f1d9349cfea38d869452230fe0
      
      # App configuration (required for referral system)
      # NOTE: This is for local development. Production deployment uses https://app.farfish.xyz
      NEXT_PUBLIC_APP_URL=http://localhost:3000
      NEXT_PUBLIC_CHAIN_ID=8453
      
      # ... rest of file unchanged
      ```
      
      **Create `android-app/.agents/environment-setup.md`:**
      ```markdown
      # Environment Configuration
      
      ## Android APK
      
      The Android app loads the web app from the URL defined in `MainActivity.java`:
      ```java
      private static final String APP_URL = "https://app.farfish.xyz";
      ```
      
      This is hardcoded for production builds. For testing against local dev server:
      1. Change APP_URL to "http://10.0.2.2:3000" (Android emulator) or "http://YOUR_IP:3000" (physical device)
      2. Rebuild APK
      3. **Remember to change back before release build**
      
      ## Next.js Environment Variables
      
      See `.env.local` in project root. Key variables:
      - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`: Required for wallet connections
      - `NEXT_PUBLIC_APP_URL`: Used for referral links (localhost in dev, https://app.farfish.xyz in production)
      - `NEXT_PUBLIC_CHAIN_ID`: 8453 (Base mainnet)
      
      ## Testing Error Handling
      
      To test various error scenarios:
      1. **No internet**: Enable airplane mode before launching app
      2. **Slow network**: Chrome DevTools → Network → Throttling → Slow 3G
      3. **Server error**: Temporarily change APP_URL to http://httpstat.us/500
      4. **Offline detection**: DevTools → Network → Offline (while app running)
      5. **JS errors**: DevTools console → throw new Error('test')
      ```
      
      **Verify:** Read through both files to confirm documentation is clear. No runtime verification needed.

---

- [ ] 17. Final build verification and create release checklist.
      
      **What:** Create final release APK with all error handling changes, verify no regressions in core functionality (mint, stake, referral), and document the changes.
      
      **Build release APK:**
      ```powershell
      cd android-app
      .\gradlew.bat assembleRelease
      ```
      
      **Test release APK:**
      1. Install on clean device (or uninstall existing app first)
      2. Complete first-launch disclaimer
      3. Test mint functionality - should work normally
      4. Test stake functionality - should work normally
      5. Test referral link generation and binding - should work normally
      6. Test wallet connection with installed wallet (MetaMask/Coinbase) - should work
      7. Test offline scenarios - should show proper errors
      8. Check APK size hasn't increased significantly (baseline ~5-10 MB, should stay under 15 MB)
      
      **Create `android-app/.agents/tasks/reliability-verification-checklist.md`:**
      ```markdown
      # FarFISH Reliability Fixes - Verification Checklist
      
      ## Core Functionality (Must Not Break)
      - [ ] Mint NFT works
      - [ ] Stake tokens works
      - [ ] Referral link generation works
      - [ ] Referral binding works
      - [ ] Wallet connection (MetaMask) works
      - [ ] Wallet connection (Coinbase Wallet) works
      - [ ] App navigation works
      - [ ] Pull-to-refresh works
      
      ## New Error Handling (Must Work)
      - [ ] No internet at launch → Shows dialog (not white screen)
      - [ ] HTTP 500 error → Shows "Server Temporarily Unavailable" page
      - [ ] HTTP 404 error → Shows "Page Not Found" page
      - [ ] Page load timeout (15s) → Shows timeout error page
      - [ ] 5+ JavaScript errors → Shows error page
      - [ ] Network goes offline while app running → Red banner appears
      - [ ] Network comes back online → Red banner disappears
      - [ ] Deep link to missing wallet → Shows AlertDialog with Play Store option
      - [ ] JavaScript error → Reported to Android (check Logcat)
      - [ ] WalletConnect init failure → Toast shown to user
      
      ## Android Native Safety
      - [ ] WebView null check prevents crash
      - [ ] setupWebView exception handled gracefully
      - [ ] Deep link null checks prevent crashes
      - [ ] UpdateChecker cleanup doesn't throw exception
      
      ## Build & Performance
      - [ ] Debug APK builds successfully
      - [ ] Release APK builds successfully
      - [ ] APK size reasonable (<15 MB)
      - [ ] No new Android Lint warnings
      - [ ] App launch time not significantly slower
      
      ## Logs & Monitoring
      - [ ] Errors logged to Logcat with appropriate tags
      - [ ] JavaScript errors visible in Logcat
      - [ ] Network errors logged
      - [ ] WalletConnect status logged
      ```
      
      **Files:**
      - Create: `android-app/.agents/tasks/reliability-verification-checklist.md`
      
      **Verify:** Execute all checklist items manually. Check off each item. All "Core Functionality" items must pass. All "New Error Handling" items must pass. If any fails, fix before proceeding.

---

## Summary

This plan implements comprehensive error handling across three layers:

**Android Native Layer (Steps 1-9):**
- HTTP error handling (no more white screens on server errors)
- Network awareness in splash screen
- Page load timeout detection
- JavaScript error detection and recovery
- Null safety checks
- Enhanced deep link error handling with wallet detection
- Robust UpdateChecker exception handling

**Android-Web Bridge (Steps 6-8):**
- JavaScript error reporting from web to native
- WalletConnect status reporting
- User-friendly error messages via native UI

**Next.js Web App (Steps 10-14):**
- ErrorBoundary connected to Android bridge
- Global unhandled promise rejection handling
- Network status indicator (offline banner)
- WalletConnect initialization monitoring

**Testing & Documentation (Steps 15-17):**
- Comprehensive end-to-end testing
- Environment documentation
- Release verification checklist

**Verification Commands:**
```powershell
# Build debug APK
cd android-app
.\gradlew.bat assembleDebug

# Build release APK
.\gradlew.bat assembleRelease

# Run Android Lint
.\gradlew.bat lint

# Run Next.js development server
cd ..
npm run dev

# Build Next.js for production
npm run build
```

**Test Coverage:**
- No internet at launch ✓
- No internet mid-session ✓
- HTTP errors (4xx, 5xx) ✓
- Page load timeout ✓
- JavaScript runtime errors ✓
- WalletConnect failures ✓
- Missing wallet apps ✓
- Deep link errors ✓
- WebView initialization failures ✓

**Constraints Honored:**
- ✓ No changes to mint/stake/referral logic
- ✓ No changes to existing UI designs (only added error states)
- ✓ No new external dependencies
- ✓ All errors in plain user language
- ✓ FarFISH color scheme maintained (#14F195, #FF6B6B, #1A1A2E)
