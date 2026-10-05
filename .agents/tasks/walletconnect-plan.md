# WalletConnect Implementation Plan

## Context

This plan addresses the WalletConnect connection issues in the FarFISH Android app. The investigation revealed that the app uses wagmi v2.19.5 with WalletConnect connector, but the connection flow fails in Android WebView due to:

1. Lack of mobile-optimized configuration (QR modal shows on mobile instead of deep links)
2. Incomplete deep link callback handling (wallet apps cannot properly return to FarFISH)
3. Missing connector selection UI (users cannot choose between injected/WalletConnect/Coinbase)
4. Insufficient debug logging
5. Deprecated WebView storage APIs without proper persistence configuration

**Key Findings from Investigation:**
- Package.json does NOT have @reown/appkit in direct dependencies (only transitive)
- wagmi provides WalletConnect connector via wagmi/connectors (already imported)
- AndroidManifest.xml has `<data android:scheme='wc' />` but missing host attribute
- MainActivity.java uses deprecated `loadUrl('javascript:...')` and dispatches 'deeplink' event instead of 'walletconnect'
- wagmi.ts has 'use client' directive — device utils must be client-safe

---

## Implementation Steps

### 1. Package verification and dependency hygiene

**Action:** Verify that wagmi already provides WalletConnect connector functionality. Do NOT add @reown/appkit to package.json. Note that running `npm install` after other changes will naturally resolve the lockfile.

**Rationale:** The investigation confirmed that package.json has no @reown/appkit in direct dependencies—it only exists as a transitive dependency. wagmi v2.19.5 already imports and uses `walletConnect` from `wagmi/connectors`, so no package changes are needed. This step is verification only.

**Files to verify:**
- `c:\Users\PC\Desktop\farfish/package.json` (confirm no @reown/appkit in dependencies)
- `c:\Users\PC\Desktop\farfish/app/lib/wagmi.ts` (confirm walletConnect is imported from wagmi/connectors)

**Verify:**
```powershell
# Verify wagmi connector imports
grep "from 'wagmi/connectors'" c:\Users\PC\Desktop\farfish/app/lib/wagmi.ts

# After all other changes are complete, run npm install to clean up lockfile
npm install
```

**Expected outcome:** grep confirms `walletConnect` is imported from `wagmi/connectors`. Running `npm install` completes without errors and may update package-lock.json but will not modify package.json.

---

### 2. Create mobile device detection utilities

**Action:** Create `c:\Users\PC\Desktop\farfish/app/utils/device.ts` with three functions: `isMobile()`, `isAndroidWebView()`, and `hasInjectedProvider()`. These functions must be safe to call in client context (wagmi.ts has 'use client' directive).

**Rationale:** The current code checks for `window.ethereum` but does not detect mobile devices or Android WebView context. This leads to inappropriate UI behavior (showing QR codes on mobile). The utilities need `typeof window !== 'undefined'` guards because they'll be imported by client components.

**File to create:**
- `c:\Users\PC\Desktop\farfish/app/utils/device.ts`

**Implementation details:**
```typescript
/**
 * Device detection utilities for wallet connection optimization.
 * Safe to use in client components ('use client' context).
 */

export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isAndroidWebView(): boolean {
  if (typeof window === 'undefined') return false;
  return /FarfishAndroid/i.test(navigator.userAgent);
}

export function hasInjectedProvider(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).ethereum);
}
```

**Verify:**
```powershell
# Check the file was created correctly
cat c:\Users\PC\Desktop\farfish/app/utils/device.ts

# Build the Next.js app to verify no syntax errors
npm run build
```

**Expected outcome:** File is created with proper TypeScript types. Build completes successfully without errors.

---

### 3. Update wagmi config with mobile-optimized WalletConnect settings

**Action:** Modify `c:\Users\PC\Desktop\farfish/app/lib/wagmi.ts` to import the device utilities and configure the WalletConnect connector to hide QR modal on mobile devices and specify mobile wallet deep links.

**Rationale:** The current config has `showQrModal: true` which displays a QR code even on mobile devices where users cannot scan from the same device. Setting `showQrModal: !isMobile()` will show QR codes only on desktop and use deep links on mobile. The `qrModalOptions.mobileLinks` array specifies which wallet apps to offer as deep link options.

**File to modify:**
- `c:\Users\PC\Desktop\farfish/app/lib/wagmi.ts`

**Changes:**

1. Add import at the top (after existing imports):
```typescript
import { isMobile } from "@/app/utils/device";
```

2. Replace the `walletConnect` connector configuration (around lines 29-38) with:
```typescript
walletConnect({
  projectId,
  metadata: {
    name: "FarFISH",
    description: "Daily habit-building app on Base",
    url: "https://farfish.vercel.app",
    icons: ["https://farfish.vercel.app/farfish-logo.png"],
  },
  showQrModal: !isMobile(),
  qrModalOptions: {
    mobileLinks: [
      'metamask',
      'trust',
      'rainbow',
      'coinbase',
      'zerion',
    ],
  },
}),
```

**Verify:**
```powershell
# Build the Next.js app to verify syntax
npm run build

# Check that isMobile is properly imported
grep "isMobile" c:\Users\PC\Desktop\farfish/app/lib/wagmi.ts
```

**Expected outcome:** Build completes successfully. grep shows the isMobile import and usage in showQrModal configuration.

---

### 4. Fix Android deep link handling for wallet callbacks

**Action:** Update Android configuration to properly receive wallet app callbacks and dispatch them to the WebView JavaScript context using the correct event name and modern API.

**Rationale:** The investigation found two issues:
1. AndroidManifest.xml has `<data android:scheme='wc' />` but Android requires a host attribute for proper intent matching
2. MainActivity.java uses deprecated `loadUrl('javascript:...')` instead of `evaluateJavascript()`, and dispatches 'deeplink' event instead of 'walletconnect' event that the web app expects

**Files to modify:**
- `c:\Users\PC\Desktop\farfish/android-app/app/src/main/AndroidManifest.xml`
- `c:\Users\PC\Desktop\farfish/android-app/app/src/main/java/com/farfish/app/MainActivity.java`

**Changes to AndroidManifest.xml:**

Replace the WalletConnect intent-filter (around lines 47-52) with:
```xml
<!-- Deep link for WalletConnect -->
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="wc" android:host="wc" />
</intent-filter>
```

**Changes to MainActivity.java:**

Replace the `handleIntent()` method (around lines 315-327) with:
```java
private void handleIntent(Intent intent) {
    if (intent != null && Intent.ACTION_VIEW.equals(intent.getAction())) {
        Uri uri = intent.getData();
        if (uri != null) {
            String url = uri.toString();
            android.util.Log.d("WalletConnect", "Deep link received: " + url);
            
            if (url.startsWith("wc:") || url.startsWith("farfish:")) {
                // Use modern evaluateJavascript instead of loadUrl
                // Dispatch 'walletconnect' event (not 'deeplink') with URL as detail
                String jsCode = "window.dispatchEvent(new CustomEvent('walletconnect', {detail: '" + url + "'}));";
                webView.evaluateJavascript(jsCode, null);
            }
        }
    }
}
```

**Verify:**
```powershell
# Build the Android APK
cd c:\Users\PC\Desktop\farfish/android-app
./gradlew assembleDebug

# Check that the build succeeded
ls app/build/outputs/apk/debug/
```

**Expected outcome:** Android build completes successfully and produces `app-debug.apk`. The APK can receive `wc:` deep links with proper host matching and dispatch them to WebView as 'walletconnect' events.

---

### 5. Add connector selection UI to WalletConnect component

**Action:** Update `c:\Users\PC\Desktop\farfish/app/components/WalletConnect.tsx` to add a connector selection menu that shows users the available wallet connection options (Injected/Browser Wallet, WalletConnect, Coinbase Wallet) with device-aware recommendations.

**Rationale:** The current implementation auto-selects a connector based on `window.ethereum` detection, giving users no choice. This is problematic because:
- Android WebView users cannot override the auto-selection
- Users in wallet browsers (MetaMask Mobile, Coinbase Wallet) may want to use WalletConnect instead
- Error messages are generic because we don't know which connector the user intended to use

**File to modify:**
- `c:\Users\PC\Desktop\farfish/app/components/WalletConnect.tsx`

**Changes:**

1. Add state for connector menu (after existing useState declarations around line 10):
```typescript
const [showConnectorMenu, setShowConnectorMenu] = useState(false);
```

2. Replace the `handleConnect` function (lines 15-61) with:
```typescript
const handleConnectorSelect = async (connectorId: string) => {
  const connector = connectors.find((c) => c.id === connectorId);
  if (!connector) return;

  setShowConnectorMenu(false);
  setErrorMsg(null);
  setConnecting(true);

  const timer = setTimeout(() => {
    setConnecting(false);
  }, 45000);

  try {
    await connectAsync({ connector });
  } catch (err: any) {
    console.warn("Wallet connection error/cancelled:", err);
    const msg = err?.message || String(err);
    if (
      msg.includes("rejected") ||
      msg.includes("User rejected") ||
      err?.name === "UserRejectedRequestError"
    ) {
      setErrorMsg("Connection rejected");
    } else if (
      msg.includes("closed") ||
      msg.includes("cancelled") ||
      msg.includes("Connection request reset")
    ) {
      setErrorMsg("Connection cancelled");
    } else {
      setErrorMsg("Connection failed");
    }
    setTimeout(() => setErrorMsg(null), 4000);
  } finally {
    clearTimeout(timer);
    setConnecting(false);
  }
};

const handleConnect = () => {
  setShowConnectorMenu(true);
};
```

3. Add connector menu UI before the closing `</div>` tag (around line 100):
```typescript
{showConnectorMenu && (
  <div className="app-panel mt-2">
    <p className="text-sm font-semibold mb-2">Select Connection Method</p>
    <div className="flex flex-col gap-2">
      {connectors.map((connector) => {
        const hasInjected = typeof window !== "undefined" && Boolean((window as any).ethereum);
        const isMobileDevice = typeof window !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        
        let label = connector.name;
        let recommended = false;
        
        if (connector.id === "injected" && hasInjected) {
          label = "Browser Wallet";
          recommended = true;
        } else if (connector.id === "walletConnect") {
          label = "WalletConnect";
          if (!hasInjected || isMobileDevice) {
            recommended = true;
          }
        } else if (connector.id === "coinbaseWallet") {
          label = "Coinbase Wallet";
        }
        
        return (
          <button
            key={connector.id}
            type="button"
            onClick={() => handleConnectorSelect(connector.id)}
            className={`px-3 py-2 rounded-md text-sm font-semibold text-left transition ${
              recommended
                ? "bg-gradient-to-r from-teal to-mint text-ink hover:opacity-90"
                : "bg-white/10 text-white/80 hover:bg-white/20"
            }`}
          >
            {label}
            {recommended && (
              <span className="text-xs ml-2 opacity-75">(Recommended)</span>
            )}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => setShowConnectorMenu(false)}
        className="px-3 py-2 rounded-md text-sm font-semibold text-white/60 hover:text-white/80 transition"
      >
        Cancel
      </button>
    </div>
  </div>
)}
```

**Verify:**
```powershell
# Build the Next.js app
npm run build

# Start dev server to test UI manually
npm run dev
```

**Expected outcome:** Build succeeds. When visiting the app and clicking "Connect Wallet", a menu appears showing Injected, WalletConnect, and Coinbase Wallet options with recommendations based on device context. Clicking a connector initiates connection with that specific connector. All existing error handling and timeout logic continues to work.

---

### 6. Create wallet connection debug logging utilities

**Action:** Create `c:\Users\PC\Desktop\farfish/app/utils/walletDebug.ts` with two functions: `logWalletConnectionAttempt()` and `logWalletConnectionError()`. Update WalletConnect.tsx to import and use these functions.

**Rationale:** The investigation noted that generic error messages make debugging impossible. Structured debug logging will capture connector type, device context, user agent, and detailed error information to help diagnose connection failures.

**File to create:**
- `c:\Users\PC\Desktop\farfish/app/utils/walletDebug.ts`

**File to modify:**
- `c:\Users\PC\Desktop\farfish/app/components/WalletConnect.tsx`

**Implementation for walletDebug.ts:**
```typescript
/**
 * Debug logging utilities for wallet connection diagnostics.
 */

interface ConnectionAttemptDetails {
  connectorId: string;
  connectorType: string;
  hasInjected: boolean;
  isMobile: boolean;
  isWebView: boolean;
  userAgent: string;
}

export function logWalletConnectionAttempt(details: ConnectionAttemptDetails): void {
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  console.log('[WalletConnect Debug]', {
    timestamp: new Date().toISOString(),
    ...details,
    walletConnectProjectId: projectId ? `${projectId.slice(0, 8)}...` : 'not set',
  });
}

export function logWalletConnectionError(error: any, context: string): void {
  console.error('[WalletConnect Error]', {
    context,
    timestamp: new Date().toISOString(),
    errorMessage: error?.message,
    errorCode: error?.code,
    errorName: error?.name,
    errorDetails: error?.details,
    stack: error?.stack,
  });
}
```

**Changes to WalletConnect.tsx:**

1. Add import at the top:
```typescript
import { logWalletConnectionAttempt, logWalletConnectionError } from "@/app/utils/walletDebug";
```

2. In the `handleConnectorSelect` function, add logging after `setConnecting(true)` and before the try block:
```typescript
// Log connection attempt for debugging
const hasInjected = typeof window !== "undefined" && Boolean((window as any).ethereum);
const isMobileDevice = typeof window !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const isWebView = typeof window !== "undefined" && /FarfishAndroid/i.test(navigator.userAgent);

logWalletConnectionAttempt({
  connectorId: connector.id,
  connectorType: connector.name,
  hasInjected,
  isMobile: isMobileDevice,
  isWebView,
  userAgent: typeof window !== "undefined" ? navigator.userAgent : "unknown",
});
```

3. In the catch block, replace `console.warn("Wallet connection error/cancelled:", err);` with:
```typescript
logWalletConnectionError(err, `Connector: ${connector.name} (${connector.id})`);
```

**Verify:**
```powershell
# Build the Next.js app
npm run build

# Start dev server and test connection attempts
npm run dev
# Open browser console and attempt wallet connection
# Verify that debug logs appear with structured data
```

**Expected outcome:** Build succeeds. When attempting wallet connections, structured debug logs appear in browser console showing connector details, device context, and detailed error information. Error logs include context about which connector was used.

---

### 7. Configure WebView storage persistence for WalletConnect sessions

**Action:** Update `setupWebView()` method in `c:\Users\PC\Desktop\farfish/android-app/app/src/main/java/com/farfish/app/MainActivity.java` to set explicit database and cache paths using application context methods.

**Rationale:** WalletConnect relies on localStorage and IndexedDB for session persistence. The current WebView storage configuration uses defaults which can be cleared by Android under memory pressure. Setting explicit paths using `getApplicationContext()` ensures storage persists across app restarts.

**Note:** `setAppCacheEnabled()` and `setAppCachePath()` are deprecated in API 33+ but remain functional. Include them for maximum compatibility across Android versions (minSdk is 28).

**File to modify:**
- `c:\Users\PC\Desktop\farfish/android-app/app/src/main/java/com/farfish/app/MainActivity.java`

**Changes:**

In the `setupWebView()` method, replace the storage configuration section (lines 120-121) with:
```java
// Storage - with explicit persistence paths
webSettings.setDomStorageEnabled(true);
webSettings.setDatabaseEnabled(true);

// Set explicit database path for persistence
String databasePath = getApplicationContext().getDir("database", MODE_PRIVATE).getPath();
webSettings.setDatabasePath(databasePath);

// Set explicit cache path for persistence
// Note: setAppCacheEnabled and setAppCachePath are deprecated in API 33+
// but still functional. Included for compatibility with minSdk 28.
webSettings.setAppCacheEnabled(true);
webSettings.setAppCachePath(getApplicationContext().getCacheDir().getPath());
```

**Verify:**
```powershell
# Build the Android APK
cd c:\Users\PC\Desktop\farfish/android-app
./gradlew assembleDebug

# Check that the build succeeded
ls app/build/outputs/apk/debug/
```

**Expected outcome:** Android build completes successfully. The APK uses explicit storage paths for WebView data persistence. WalletConnect sessions stored in localStorage/IndexedDB will persist across app restarts.

---

## Testing Checklist

After implementing all steps, verify the following in order:

### Desktop Browser Testing
- [ ] Open https://farfish.vercel.app in Chrome/Firefox
- [ ] Click "Connect Wallet"
- [ ] Verify connector selection menu appears with options: Browser Wallet, WalletConnect, Coinbase Wallet
- [ ] Select WalletConnect
- [ ] Verify QR code modal appears (showQrModal should be true on desktop)
- [ ] Scan QR with mobile wallet and approve connection
- [ ] Verify connection succeeds and wallet address displays
- [ ] Check browser console for debug logs showing connection attempt details

### Mobile Browser Testing (iOS Safari)
- [ ] Open https://farfish.vercel.app in Safari on iPhone
- [ ] Click "Connect Wallet"
- [ ] Verify connector selection menu appears
- [ ] Select WalletConnect (should show "Recommended")
- [ ] Verify NO QR code appears (showQrModal should be false on mobile)
- [ ] Verify deep link options or redirect to wallet app
- [ ] Approve connection in wallet app
- [ ] Verify app returns to Safari and connection succeeds
- [ ] Check console logs (if accessible via Safari Web Inspector)

### Mobile Browser Testing (Android Chrome)
- [ ] Open https://farfish.vercel.app in Chrome on Android
- [ ] Click "Connect Wallet"
- [ ] Verify connector selection menu appears
- [ ] Select WalletConnect (should show "Recommended")
- [ ] Verify NO QR code appears
- [ ] Verify deep link launches external wallet app
- [ ] Approve connection in wallet app
- [ ] Verify Chrome resumes and connection succeeds

### Android WebView App Testing
- [ ] Install the FarFISH APK on Android device
- [ ] Open the FarFISH app
- [ ] Click "Connect Wallet"
- [ ] Verify connector selection menu appears
- [ ] Select WalletConnect
- [ ] Verify deep link launches external wallet app (MetaMask, Trust Wallet, etc.)
- [ ] Approve connection in wallet app
- [ ] Verify FarFISH app resumes and connection succeeds
- [ ] Check Logcat for "WalletConnect" debug messages: `adb logcat | grep WalletConnect`
- [ ] Close and reopen FarFISH app
- [ ] Verify wallet connection persists (session stored in localStorage)

### MetaMask Mobile In-App Browser Testing
- [ ] Open MetaMask mobile app
- [ ] Navigate to Browser tab
- [ ] Visit https://farfish.vercel.app
- [ ] Click "Connect Wallet"
- [ ] Verify "Browser Wallet" shows "(Recommended)" in connector menu
- [ ] Select "Browser Wallet" (injected connector)
- [ ] Verify MetaMask prompt appears immediately (no QR, no deep link)
- [ ] Approve connection
- [ ] Verify connection succeeds instantly

### Error Handling Testing
- [ ] Attempt connection and reject in wallet
- [ ] Verify error message shows "Connection rejected"
- [ ] Attempt connection and close wallet without approving
- [ ] Verify error message shows "Connection cancelled"
- [ ] Disconnect wallet and reconnect
- [ ] Verify reconnection works without errors

### Session Persistence Testing
- [ ] Connect wallet in Android app
- [ ] Use the app for a few minutes
- [ ] Force close the app
- [ ] Reopen the app
- [ ] Verify wallet remains connected (address still displays)
- [ ] Verify no reconnection prompt appears

---

## Build and Deployment Commands

### Web App (Next.js)
```powershell
# Install dependencies (after file changes)
npm install

# Development server
npm run dev

# Production build
npm run build

# Start production server (after build)
npm start

# Lint check
npm run lint
```

### Android App
```powershell
# Navigate to android directory
cd c:\Users\PC\Desktop\farfish/android-app

# Debug build
./gradlew assembleDebug

# Release build (requires signing config)
./gradlew assembleRelease

# Install debug APK on connected device
./gradlew installDebug

# View Android logs filtered for WalletConnect
adb logcat | grep WalletConnect
```

---

## Rollback Plan

If any step causes issues, rollback in reverse order:

1. **Step 7 (WebView storage):** Revert MainActivity.java storage config changes. The app will work but sessions may not persist.
2. **Step 6 (Debug logging):** Remove walletDebug.ts and revert WalletConnect.tsx logging calls. Connection will work but debugging will be harder.
3. **Step 5 (Connector UI):** Revert WalletConnect.tsx to auto-selection logic. Connection will work but users cannot choose connectors.
4. **Step 4 (Deep links):** Revert AndroidManifest.xml and MainActivity.java handleIntent. Web browser connections work; Android WebView connections fail.
5. **Step 3 (wagmi config):** Revert wagmi.ts to `showQrModal: true`. Desktop works; mobile shows unusable QR codes.
6. **Step 2 (Device utils):** Delete device.ts and revert wagmi.ts imports. No mobile detection.
7. **Step 1 (Packages):** No rollback needed (verification only).

---

## Success Criteria

The implementation is successful when:

1. ✅ Desktop users can connect via WalletConnect QR code
2. ✅ Mobile browser users can connect via deep links (no QR code shown)
3. ✅ Android WebView users can connect via deep links and return to app
4. ✅ Wallet browser users (MetaMask Mobile, Coinbase Wallet) can use injected providers
5. ✅ Users can manually select their preferred connector
6. ✅ WalletConnect sessions persist across app restarts
7. ✅ All connection attempts and errors are logged with structured data
8. ✅ No new dependencies added to package.json
9. ✅ All existing app functionality remains intact

---

## Notes

- **No package.json changes:** Step 1 is verification only. Do not add any packages.
- **Client context safety:** device.ts utilities use `typeof window !== 'undefined'` guards because wagmi.ts has 'use client' directive.
- **Event name matters:** MainActivity.java must dispatch 'walletconnect' event (not 'deeplink') to match web app expectations.
- **Deprecated APIs acceptable:** Using `setAppCachePath()` even though deprecated in API 33+ ensures compatibility with minSdk 28.
- **No test suite:** This project has no test scripts in package.json. Verification relies on build success and manual testing.
- **Build commands from package.json:** `npm run dev`, `npm run build`, `npm start`, `npm run lint`
- **Android commands from gradle:** `./gradlew assembleDebug`, `./gradlew installDebug`
