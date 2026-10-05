# WalletConnect Investigation Report

## Executive Summary

**Finding:** WalletConnect is properly configured in the FarFISH codebase with a valid project ID, but there are several architectural issues and potential points of failure that could cause connection problems, particularly in the Android WebView environment.

**Root Cause Analysis:** The implementation uses **deprecated WalletConnect v2 packages** (v2.21.0) indirectly through @reown/appkit dependencies, despite not actually using the @reown/appkit SDK in the application code. The app uses wagmi v2.19.5 with WalletConnect connector, but the connection flow may fail in Android WebView due to deep link handling limitations and storage issues.

---

## Current WalletConnect Setup

### Configuration Files

**Location:** `c:\Users\PC\Desktop\farfish\app\lib\wagmi.ts`

```typescript
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "6829b9ad661ef487af4d0c1bb5aa4a9e";

export const wagmiConfig = createConfig({
  chains: [base, mainnet],
  transports: { /* RPC endpoints configured */ },
  connectors: [
    injected({ shimDisconnect: true }),
    walletConnect({
      projectId,
      metadata: {
        name: "FarFISH",
        description: "Daily habit-building app on Base",
        url: "https://farfish.vercel.app",
        icons: ["https://farfish.vercel.app/farfish-logo.png"],
      },
      showQrModal: true,
    }),
    coinbaseWallet({
      appName: "FarFISH",
      appLogoUrl: "https://farfish.vercel.app/farfish-logo.png",
    }),
  ],
  ssr: true,
});
```

**Environment Variable:** `.env.local`
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=d2d0e8f1d9349cfea38d869452230fe0
```

✅ **Valid project ID is present** (migrated to Reown/WalletConnect Cloud)

---

## Identified Issues

### 1. **Deprecated WalletConnect Packages** ⚠️ CRITICAL

**Evidence from package-lock.json:**
```json
"@walletconnect/sign-client": "2.21.0",
"deprecated": "Reliability and performance improvements. See: https://github.com/WalletConnect/walletconnect-monorepo/releases"

"@walletconnect/universal-provider": "2.21.0",
"deprecated": "Reliability and performance improvements. See: https://github.com/WalletConnect/walletconnect-monorepo/releases"
```

**Problem:** The app is using WalletConnect v2.21.0 packages that have been deprecated. These packages are pulled in as transitive dependencies from @reown/appkit packages (v1.7.8), which are installed but **never imported or used** in the codebase.

**Impact:** 
- Known reliability issues in deprecated versions
- Potential connection failures
- Missing bug fixes and security patches
- Incompatibility with newer wallet apps

---

### 2. **Android WebView Deep Link Handling Issues** ⚠️ HIGH

**Location:** `android-app/app/src/main/java/com/farfish/app/MainActivity.java`

**Current Implementation:**
```java
// Lines 153-167
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
```

**AndroidManifest.xml Deep Link Configuration:**
```xml
<!-- Deep link for WalletConnect -->
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="wc" />
</intent-filter>
```

**Problems:**

1. **One-way deep link flow:** The app can send `wc:` URIs to external wallets but may not properly receive the callback after wallet approval
2. **Missing return URL handling:** No explicit handling for wallet apps to return control to FarFISH after connection approval
3. **WebView-to-Native bridge gap:** The JavaScript WalletConnect code generates `wc:` URIs that must cross the WebView boundary, get handled by native Android, launch external wallet, then return—this multi-hop flow is fragile
4. **Session storage issues:** WalletConnect sessions rely on localStorage/IndexedDB persistence, but WebView storage can be cleared unexpectedly

---

### 3. **Connection Logic Issues in React Components** ⚠️ MEDIUM

**Location:** `app/components/WalletConnect.tsx`

**Current Implementation:**
```typescript
const handleConnect = async () => {
  const hasInjected = typeof window !== "undefined" && Boolean((window as any).ethereum);
  const injectedConn = connectors.find((c) => c.id === "injected");
  const walletConnectConn = connectors.find((c) => c.id === "walletConnect");

  // In a Web3 browser, prefer injected for instant connection; otherwise use WalletConnect modal
  const connectorToUse = hasInjected && injectedConn
    ? injectedConn
    : walletConnectConn || connectors[0];

  await connectAsync({ connector: connectorToUse });
}
```

**Problems:**

1. **Android WebView detection failure:** The code checks for `window.ethereum` to detect injected providers, but Android WebViews don't have this—the app will always fall back to WalletConnect modal even when running in a wallet browser like MetaMask Mobile
2. **No user choice:** Users cannot manually select which connector to use (injected, WalletConnect, Coinbase Wallet)
3. **Timeout handling is cosmetic:** The 45-second timeout clears the UI loading state but doesn't actually abort the connection attempt
4. **Error handling is too generic:** All connection failures show the same vague error messages, making debugging impossible

---

### 4. **Missing Mobile-Specific Optimizations** ⚠️ MEDIUM

**Evidence:** No mobile/device detection anywhere in codebase

**Search Results:**
```
isMobile|isAndroid|userAgent|navigator.userAgent
No matches found.
```

**Problems:**

1. **No mobile wallet detection:** The app doesn't detect if it's running on Android/iOS to optimize the connection flow
2. **QR modal on mobile:** `showQrModal: true` will show a QR code even on mobile devices where users should use deep links instead
3. **User Agent enhancement underutilized:** The Android WebView adds `FarfishAndroid/1.0` to the User-Agent, but the web app doesn't check for this to enable mobile-optimized flows

---

### 5. **Storage Configuration Risks** ⚠️ LOW-MEDIUM

**WebView Storage Settings:** `MainActivity.java` lines 120-121
```java
webSettings.setDomStorageEnabled(true);
webSettings.setDatabaseEnabled(true);
```

**localStorage Usage:** Extensive use of localStorage for app state (profile, referrals, chest claims)

**WalletConnect Dependency:** WalletConnect v2 relies on:
- localStorage for session persistence
- IndexedDB for relay message storage
- WebSocket connections for relay communication

**Problems:**

1. **Storage can be cleared:** Android can clear WebView storage under memory pressure
2. **No persistence guarantees:** WalletConnect sessions stored in localStorage may be lost on app restart
3. **Mixed content mode:** `MIXED_CONTENT_NEVER_ALLOW` is secure but could block some wallet connection flows if any HTTP resources are involved
4. **Cache mode default:** Using `LOAD_DEFAULT` cache mode could cause stale session data issues

---

## Dependency Analysis

### Installed Packages

```
wagmi@2.19.5
  └─ wagmi/connectors (walletConnect, injected, coinbaseWallet)

@wagmi/core@2.22.1
viem@2.57.3

@reown/appkit@1.7.8 (NOT IMPORTED IN CODE)
  ├─ @reown/appkit-controllers@1.7.8
  │   └─ @walletconnect/universal-provider@2.21.0 (DEPRECATED)
  │       └─ @walletconnect/sign-client@2.21.0 (DEPRECATED)
  └─ @walletconnect/types@2.21.0
```

**Key Finding:** The @reown/appkit package is installed (likely as a transitive dependency or leftover from migration) but is **never imported** anywhere in the codebase. The app uses wagmi's built-in WalletConnect connector instead.

**Consequence:** The deprecated WalletConnect v2 packages are still in the dependency tree, potentially causing connection issues.

---

## Connection Flow Analysis

### Web Browser Flow (Working)

1. User clicks "Connect Wallet"
2. WalletConnect modal opens with QR code
3. User scans QR with mobile wallet
4. Wallet approves connection
5. Session established via WebSocket relay
6. App receives address and chain info

### Android WebView Flow (Likely Failing)

1. User clicks "Connect Wallet" in Android app
2. WalletConnect modal attempts to open (may render incorrectly in WebView)
3. If QR shown: User cannot scan from same device ❌
4. If deep link triggered: `wc:` URI sent to Android
5. Android launches external wallet app
6. **User approves in wallet**
7. **Wallet app tries to return to FarFISH** ⚠️ FAILURE POINT
   - No explicit return URL configured
   - WebView may not resume properly
   - Session storage may not persist
8. **Connection appears to hang or fail**

---

## Specific Code Locations Requiring Fixes

### 1. `app/lib/wagmi.ts` (lines 29-38)
**Issue:** Using deprecated WalletConnect connector configuration without mobile optimizations

### 2. `app/components/WalletConnect.tsx` (lines 23-38)
**Issue:** Connector selection logic doesn't account for mobile WebView environment

### 3. `app/providers/WalletProvider.tsx` (entire file)
**Issue:** Missing WalletConnect provider configuration for mobile deep linking

### 4. `android-app/app/src/main/java/com/farfish/app/MainActivity.java` (lines 153-167, 315-327)
**Issue:** Deep link handling is one-directional; no explicit callback URL for wallet return

### 5. `package.json` (dependencies)
**Issue:** No direct control over WalletConnect version; relying on transitive deps from @reown/appkit

---

## Recommended Solutions (Priority Order)

### Priority 1: Upgrade to Latest WalletConnect Implementation

**Action:** Remove unused @reown/appkit dependencies and ensure wagmi uses the latest stable WalletConnect connector

**Steps:**
1. Audit and remove @reown/appkit from dependencies if not explicitly needed
2. Update wagmi to latest stable version (check for v2.x updates)
3. Verify that wagmi's WalletConnect connector uses WalletConnect v2.latest or v3.x
4. Test connection flow after upgrade

**Files to modify:**
- `package.json`
- Run `npm install` and verify `package-lock.json`

---

### Priority 2: Implement Mobile-Optimized Connection Flow

**Action:** Detect mobile environment and optimize WalletConnect configuration accordingly

**Implementation in `app/lib/wagmi.ts`:**
```typescript
const isMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAndroidApp = typeof window !== 'undefined' && /FarfishAndroid/i.test(navigator.userAgent);

walletConnect({
  projectId,
  metadata: {
    name: "FarFISH",
    description: "Daily habit-building app on Base",
    url: "https://farfish.vercel.app",
    icons: ["https://farfish.vercel.app/farfish-logo.png"],
  },
  showQrModal: !isMobile, // Hide QR on mobile, use deep links instead
  qrModalOptions: {
    mobileLinks: [
      'metamask',
      'trust',
      'rainbow',
      'coinbase',
      'zerion',
    ],
  },
})
```

**Add mobile detection utility:** `app/utils/device.ts`
```typescript
export const isMobile = () => 
  typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export const isAndroidWebView = () => 
  typeof window !== 'undefined' && /FarfishAndroid/i.test(navigator.userAgent);

export const hasInjectedProvider = () => 
  typeof window !== 'undefined' && Boolean((window as any).ethereum);
```

---

### Priority 3: Fix Android Deep Link Callback Handling

**Action:** Implement proper return URL handling for wallet callbacks

**Modify AndroidManifest.xml:** Add explicit host for return URLs
```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="wc" />
    <data android:scheme="farfish" android:host="wc" />
</intent-filter>
```

**Update MainActivity.java deep link handling:**
```java
private void handleIntent(Intent intent) {
    if (intent != null && Intent.ACTION_VIEW.equals(intent.getAction())) {
        Uri uri = intent.getData();
        if (uri != null) {
            String url = uri.toString();
            Log.d("WalletConnect", "Deep link received: " + url);
            
            if (url.startsWith("wc:") || url.startsWith("farfish://wc")) {
                // Inject the deep link event into WebView JavaScript context
                webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('walletconnect', {detail: '" + url + "'}));",
                    null
                );
            }
        }
    }
}
```

---

### Priority 4: Add User Connector Selection

**Action:** Let users manually choose their preferred connection method

**Update `app/components/WalletConnect.tsx`:**
```typescript
const [showConnectorMenu, setShowConnectorMenu] = useState(false);

const handleConnectorSelect = async (connectorId: string) => {
  const connector = connectors.find(c => c.id === connectorId);
  if (!connector) return;
  
  setShowConnectorMenu(false);
  setConnecting(true);
  
  try {
    await connectAsync({ connector });
  } catch (err) {
    // error handling
  } finally {
    setConnecting(false);
  }
};

// Render connector options: Injected, WalletConnect, Coinbase Wallet
```

---

### Priority 5: Improve Error Logging and Debugging

**Action:** Add detailed logging for connection failures

**Add to `app/utils/errorHandling.ts`:**
```typescript
export function logWalletConnectionAttempt(details: {
  connectorId: string;
  connectorType: string;
  hasInjected: boolean;
  isMobile: boolean;
  isWebView: boolean;
  userAgent: string;
}) {
  console.log('[WalletConnect Debug]', {
    timestamp: new Date().toISOString(),
    ...details,
    walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.slice(0, 8) + '...',
  });
}

export function logWalletConnectionError(error: any, context: string) {
  console.error('[WalletConnect Error]', {
    context,
    errorMessage: error?.message,
    errorCode: error?.code,
    errorName: error?.name,
    stack: error?.stack,
  });
}
```

---

### Priority 6: WebView Storage Persistence

**Action:** Ensure WalletConnect session storage persists across app restarts

**Add to MainActivity.java:**
```java
// In setupWebView() method
webSettings.setDatabaseEnabled(true);
webSettings.setDomStorageEnabled(true);

// Set explicit storage paths
String databasePath = getApplicationContext().getDir("database", MODE_PRIVATE).getPath();
webSettings.setDatabasePath(databasePath);

// Ensure cache persists
webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
webSettings.setAppCacheEnabled(true);
webSettings.setAppCachePath(getApplicationContext().getCacheDir().getPath());
```

---

## Testing Checklist

After implementing fixes, verify:

- [ ] **Desktop browser:** WalletConnect QR modal opens and connection succeeds
- [ ] **Mobile browser (iOS Safari):** Deep link to wallet app works, returns to browser, connection succeeds
- [ ] **Mobile browser (Android Chrome):** Deep link to wallet app works, returns to browser, connection succeeds  
- [ ] **Android WebView app:** Deep link launches external wallet, returns to app, connection persists
- [ ] **MetaMask Mobile in-app browser:** Injected provider detected and used (no WalletConnect modal)
- [ ] **Coinbase Wallet in-app browser:** Coinbase connector used
- [ ] **Session persistence:** Close and reopen app, wallet remains connected
- [ ] **Network switching:** Switch from Base to Mainnet and back
- [ ] **Disconnect and reconnect:** Works without errors

---

## Additional Observations

### Security Configuration
✅ **Good:** SSL error handling rejects invalid certificates
✅ **Good:** Mixed content mode blocks HTTP resources
✅ **Good:** File access disabled, content access controlled
✅ **Good:** Safe Browsing enabled

### RPC Configuration
✅ **Good:** Multiple RPC endpoints with fallback strategy
⚠️ **Note:** Comments indicate rate-limiting issues with public RPCs; consider adding private RPC endpoints for production

### Error Handling
✅ **Good:** Comprehensive error handling utilities in `app/utils/errorHandling.ts`
⚠️ **Needs improvement:** Error messages to users are too generic; surface more specific WalletConnect errors

---

## Conclusion

**WalletConnect is configured but likely broken in the Android WebView environment due to:**

1. **Deprecated WalletConnect v2 packages** with known reliability issues
2. **Incomplete deep link flow** for mobile wallet callbacks
3. **No mobile-specific optimizations** in the connection UI
4. **Fragile WebView-to-native bridge** for `wc:` URI handling

**Highest impact fix:** Upgrade to latest WalletConnect implementation and add mobile detection to optimize the connection flow for Android/iOS environments.

**Quick win:** Add device detection and hide QR modal on mobile devices, preferring deep links instead.

---

## References

- WalletConnect v2 Deprecation: https://github.com/WalletConnect/walletconnect-monorepo/releases
- Wagmi WalletConnect Connector Docs: https://wagmi.sh/react/connectors/walletConnect
- Reown (formerly WalletConnect Cloud): https://dashboard.reown.com
- Android Deep Linking Best Practices: https://developer.android.com/training/app-links

---

**Report Generated:** 2025-01-XX  
**Codebase Version:** FarFISH v1.0.0  
**Investigation Scope:** WalletConnect integration issues
