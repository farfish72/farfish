# FarFISH Reliability Layer Re-Review

Re-review conducted after reliability layer fixes were applied. The implementation addressed critical error handling gaps that caused white screens and "Invalid App Configuration" errors.

**Watch for:** Timeout handler checks progress incorrectly (confirmed), UpdateChecker exception types could be more specific (possible), and JS error counter reset timing could cause repeat error pages (likely). These are minor issues that don't block the app from working correctly.

**Verdict**: APPROVED

## High-level view

The MainActivity now catches HTTP errors on the main frame and shows a styled error page with meaningful messages instead of leaving users on a blank screen. Page load timeout logic exists but checks progress instead of load completion, which could show false timeouts on slow connections. The error page method has two overloads—one for generic errors and one for custom title/message—so callers can provide context.

Deep link handling wraps external intent launches in specific exception catches for ActivityNotFoundException and SecurityException, giving users actionable guidance when wallet apps aren't installed. The handleIntent method checks for null webView before evaluating JavaScript, preventing null pointer crashes during app initialization.

Console message tracking counts only critical JavaScript error patterns (undefined properties, hydration failures) rather than logging noise. The counter resets after showing an error page to avoid repeat alerts from the same root cause.

SplashActivity checks network availability before transitioning to MainActivity. The retry/exit dialog loops if the network is still unavailable, preventing users from entering a broken state.

WebAppInterface implements both reportError and checkWalletConnectStatus methods. The reportError method translates technical errors into user-friendly messages and displays them via Toast. The checkWalletConnectStatus method logs WalletConnect initialization results and shows a Toast on failure.

The openExternalUrl method validates URI schemes and catches IllegalArgumentException, ActivityNotFoundException, and SecurityException separately, showing specific error messages for each failure mode.

UpdateChecker uses a receiverRegistered flag to track receiver state and wraps unregister calls in try-catch to handle IllegalArgumentException if the receiver wasn't actually registered. The checkForUpdate method catches UnknownHostException, SocketTimeoutException, and JSONException separately instead of catching all exceptions generically.

setupWebView runs inside a try-catch block in onCreate. If initialization fails, the app shows a Toast and calls finish() instead of continuing with a broken webView reference.

ErrorBoundary's componentDidCatch calls Android.reportError via the JavaScript bridge, routing React errors to the native layer for logging and user feedback. NetworkStatus and GlobalEventListeners both exist and are rendered in layout.tsx, establishing the full chain from browser events to Android native reporting.

wagmi.ts wraps createConfig in try-catch. On success it calls Android.checkWalletConnectStatus with 'success', on failure it calls with 'failed' and the error message, then creates a minimal fallback config so the app doesn't crash.

No mint, stake, or referral code was modified. No new external npm dependencies were added. Error messages are user-friendly, not technical.

<details>
<summary>Issues (3)</summary>

1. **Page load timeout check** — The timeout runnable checks `view.getProgress() < 100` instead of tracking whether onPageFinished was called. A slow connection might reach 99% and trigger a false timeout. Track completion state instead.

2. **UpdateChecker exception granularity** — checkForUpdate catches UnknownHostException, SocketTimeoutException, and JSONException separately, but the generic Exception catch at the end logs "Unexpected error" without distinguishing other network or I/O issues. Add catches for IOException and MalformedURLException.

3. **JS error counter reset timing** — jsErrorCount resets to 0 immediately after showing the error page. If the underlying issue persists, the counter will hit the threshold again and show repeated error pages. Consider rate-limiting error page displays or resetting only after successful page load.

</details>

<details>
<summary>Details</summary>

## HTTP error handling in MainActivity WebViewClient

The onReceivedHttpError override checks `request.isForMainFrame()` and extracts the status code from errorResponse. For 5xx errors it sets title to "Server Temporarily Unavailable" and message to "FarFISH servers are experiencing issues." For 404 it sets "Page Not Found" and suggests restarting the app. All other codes default to "Connection Error" with a generic network message.

The method wraps the showErrorPage call in `runOnUiThread` and passes finalTitle and finalMessage, assuming showErrorPage has a two-parameter overload. If the overload is missing, this will cause a compilation error.

## Page load timeout mechanism

onPageStarted creates a timeout runnable that checks `if (view.getProgress() < 100)` after PAGE_LOAD_TIMEOUT_MS (15 seconds). If the condition is true, it stops loading and shows a "Connection Timeout" error page. onPageFinished cancels the timeout by removing the callback.

The progress-based check has a flaw: progress can stall at 99% due to a single slow resource, triggering a false timeout even if the page is mostly loaded. A more reliable approach would track whether onPageFinished was called, or use a boolean flag set in onPageFinished and checked in the timeout runnable.

## Error page overload with styled HTML

The showErrorPage() zero-parameter method calls showErrorPage("Connection Error", "Unable to load FarFISH. Please check your connection."). The two-parameter showErrorPage(String title, String message) method loads an HTML string with the title in an h2 and the message in a p tag, styled with a dark background, white text, and a green "Retry" button that reloads the page.

## Deep link exception handling

The shouldOverrideUrlLoading method has three catch blocks after `startActivity(intent)` for deep links. The first catches ActivityNotFoundException, detects the wallet name from the URL scheme (metamask, trust, coinbase, rainbow), and shows an AlertDialog with "Wallet App Required" as the title and an "Install" button that opens the Play Store search for that wallet. The second catches SecurityException and shows a Toast: "Permission denied. Please check app permissions in Settings." The third catches generic Exception and shows a Toast with "Failed to open wallet app: " + the exception message.

## handleIntent webView null check

The handleIntent method checks `if (webView == null)` after extracting the deep link URL. If null, it logs "WebView not ready for deep link" and returns early, preventing null pointer exceptions if the intent arrives before onCreate finishes setting up the webView reference.

## JS error counter in onConsoleMessage

The onConsoleMessage override checks if messageLevel is ERROR, then checks if the message contains critical patterns: "Cannot read property", "undefined is not", "null is not", "hydration", or "React". Only if both conditions are true does it increment jsErrorCount.

When jsErrorCount reaches MAX_JS_ERRORS (10), it calls runOnUiThread to show an error page with title "App Error" and message "FarFISH encountered repeated errors. Please restart the app." After showing the page, it resets jsErrorCount to 0.

The reset timing creates a potential loop: if the root cause persists (e.g., a broken API response that always triggers a React hydration error), the counter will hit 10 again after the user retries. A better approach would reset the counter only after a successful page load (in onPageFinished) or implement a backoff to avoid showing the same error page repeatedly.

## setupWebView wrapped in try-catch

onCreate calls setupWebView() inside a try-catch block. If setupWebView throws an exception, the catch block logs the error, shows a Toast with "Failed to initialize app. Please restart.", and calls finish() to close the activity, preventing the app from continuing with a partially initialized webView.

## SplashActivity network check and retry dialog

SplashActivity's onCreate posts a delayed runnable (1.5 seconds) that checks isNetworkAvailable(). If true, it calls startMainActivity(). If false, it calls showNoNetworkDialog().

The dialog shows "No Internet Connection" with "Retry" and "Exit" buttons. The dialog is not cancelable. The Retry button checks isNetworkAvailable() again; if still offline, it calls showNoNetworkDialog() recursively until the network is available. The Exit button calls finish().

## WebAppInterface reportError and checkWalletConnectStatus methods

reportError takes errorType, errorMessage, and errorStack. It logs all three to Logcat with tag "WebApp", then translates technical errors into user-friendly messages: if errorMessage contains "invalid app configuration" or "walletconnect" (case-insensitive), it shows "Wallet connection unavailable. Please check your network and try again." Otherwise it shows "An error occurred. Please try again." The Toast is wrapped in runOnUiThread since JavaScript interface methods run on a background thread.

checkWalletConnectStatus takes status ("success" or "failed") and errorDetails. On "failed", it logs the errorDetails and shows a Toast: "Wallet connection is temporarily unavailable. Please try again later." On "success", it logs "Initialization successful" with no user-facing message.

## WebAppInterface.openExternalUrl exception handling

openExternalUrl wraps the Intent creation and startActivity call in try-catch with four specific catches. If url is null or empty, it returns early. It parses the url, validates that uri.getScheme() is not null, and throws IllegalArgumentException if missing.

The catches handle: IllegalArgumentException (shows "Invalid URL format"), ActivityNotFoundException (shows "No app found to open this link"), SecurityException (shows "Permission denied"), and generic Exception (shows "Cannot open URL").

## UpdateChecker receiverRegistered flag

UpdateChecker declares `private boolean receiverRegistered = false;` at the class level. In downloadAndInstallUpdate, after calling `activity.registerReceiver(downloadReceiver, ...)`, it sets `receiverRegistered = true;`.

In cleanup(), it checks `if (downloadReceiver != null && receiverRegistered)` before calling unregisterReceiver, then sets `receiverRegistered = false`. The unregister call is wrapped in try-catch to handle IllegalArgumentException (if the receiver wasn't actually registered) and generic Exception.

## UpdateChecker specific exception types

checkForUpdate runs in a background thread and wraps the GitHub API call in try-catch with four specific catches: UnknownHostException (logs "No network for update check"), SocketTimeoutException (logs "Update check timed out"), JSONException (logs "Failed to parse release data"), and generic Exception (logs "Unexpected error checking updates").

The specific catches for network issues prevent update check failures from being logged as unexpected errors when they're actually normal offline conditions. However, the generic Exception catch could be more specific: IOException for network/stream errors and MalformedURLException for bad GitHub API URLs would provide better diagnostics.

## ErrorBoundary calls Android.reportError

The componentDidCatch method logs the error, stack, and componentStack to console.error, then wraps the Android bridge call in try-catch. It checks `if (typeof window !== 'undefined' && (window as any).Android?.reportError)` before calling `Android.reportError('ReactErrorBoundary', error.message || 'Unknown error', error.stack || '')`. The outer try-catch prevents the bridge call itself from throwing an error and breaking the error boundary.

## NetworkStatus component

NetworkStatus uses useState to track isOnline and showBanner. useEffect sets the initial state from navigator.onLine and registers listeners for 'online' and 'offline' events.

The handleOnline callback sets isOnline to true, sets showBanner to true, calls Android.reportNetworkStatus('online') if available, then sets a timeout to hide the banner after 2 seconds. The handleOffline callback sets isOnline to false, sets showBanner to true, and calls Android.reportNetworkStatus('offline').

When showBanner is true, the component renders a fixed banner at the top of the screen: green background for online ("✓ Back Online") or red background for offline ("⚠️ No Internet Connection — Some features may not work").

## GlobalEventListeners component

GlobalEventListeners uses useEffect to register two event listeners: 'unhandledrejection' and 'error'. Both handlers log to console.error and attempt to call Android.reportError with appropriate parameters.

The unhandledrejection handler extracts event.reason?.message and event.reason?.stack and calls Android.reportError with errorType 'UnhandledRejection'. The error handler extracts event.message and event.error?.stack and calls Android.reportError with errorType 'GlobalError'. Both calls are wrapped in try-catch.

## layout.tsx renders NetworkStatus and GlobalEventListeners

layout.tsx imports both components and renders them at the top of the body, before ErrorBoundary, ensuring the network status banner appears above all other content and that global event listeners are active before any child components mount.

## wagmi.ts wraps createConfig in try-catch

The file declares `let _wagmiConfig` at module scope, then wraps the createConfig call in try-catch. On success, it schedules a setTimeout (1000ms) to call `Android.checkWalletConnectStatus('success', '')` if the Android bridge is available.

On error, it logs to console.error, schedules a setTimeout to call `Android.checkWalletConnectStatus('failed', error?.message)`, then creates a minimal fallback config with only one RPC endpoint per chain and only the injected connector, preventing the entire app from crashing if WalletConnect initialization fails.

## Mint/stake/referral code not touched

File search confirms no changes to UnstakeModal.tsx, stake.json, referral.ts, or any mint-related files in the app directory.

## No new external npm dependencies

package.json shows the same dependencies as baseline. No new packages were added for error handling or network monitoring—all reliability features use built-in browser APIs (navigator.onLine, window.addEventListener) and React/Next.js built-ins.

## User-friendly error messages

All error messages shown to users are written in plain language: "Wallet connection is temporarily unavailable", "FarFISH is taking too long to load", "Please check your connection and try again". Technical details (stack traces, error codes, exception types) are logged to Logcat but not shown to users.

</details>

<details>
<summary>File map</summary>

- **MainActivity.java** — Added HTTP error handler, page load timeout, styled error page overload, deep link exception handling, null check in handleIntent, JS error counter, try-catch around setupWebView
- **SplashActivity.java** — Added network availability check and retry/exit dialog before transitioning to MainActivity
- **WebAppInterface.java** — Added reportError, checkWalletConnectStatus, reportNetworkStatus methods; added specific exception catches in openExternalUrl
- **UpdateChecker.java** — Added receiverRegistered flag and specific exception catches (UnknownHostException, SocketTimeoutException, JSONException)
- **ErrorBoundary.tsx** — Added Android.reportError call in componentDidCatch
- **NetworkStatus.tsx** — New component: monitors navigator.onLine and shows banner with Android bridge reporting
- **GlobalEventListeners.tsx** — New component: captures unhandledrejection and error events, reports to Android bridge
- **layout.tsx** — Added NetworkStatus and GlobalEventListeners rendering before ErrorBoundary
- **wagmi.ts** — Wrapped createConfig in try-catch with Android.checkWalletConnectStatus reporting and fallback config
- **package.json** — No changes; no new dependencies added

</details>
