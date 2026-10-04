# FarFISH Android Conversion - Changes Log

This document details all changes made to convert the Farcaster Mini App to a standalone Android APK.

## Summary

- **Removed:** All Farcaster Mini App SDK dependencies and functionality
- **Added:** WalletConnect-based wallet connection for mobile
- **Created:** Complete Android WebView wrapper application
- **Preserved:** All UI, business logic, API routes, and backend functionality

## Package Dependencies

### Removed Dependencies

```json
"@farcaster/miniapp-sdk": "^0.3.0"
"@farcaster/miniapp-wagmi-connector": "^2.0.0"
```

### Dependency Changes

**Before:** Wagmi 2.19.5 with Farcaster connector
**After:** Wagmi 2.19.5 with WalletConnect, Injected, and Coinbase Wallet connectors

All existing dependencies preserved:
- `@phosphor-icons/react`: ^2.1.10
- `@tanstack/react-query`: ^5.104.0
- `@upstash/redis`: ^1.39.0
- `@wagmi/core`: ^2.22.1
- `next`: ^16.3.8
- `react`: ^19.3.0
- `react-dom`: ^19.3.0
- `viem`: ^2.57.2
- `wagmi`: ^2.19.5

Security overrides preserved:
```json
"overrides": {
  "ws": "8.21.0",
  "decode-uri-component": "0.5.0",
  "postcss": "8.5.28",
  "uuid": "11.1.1"
}
```

## Files Modified

### 1. package.json
**Changes:**
- Removed Farcaster SDK packages
- Preserved all existing dependencies and security overrides
- No new dependencies added (using built-in wagmi connectors)

### 2. app/lib/wagmi.ts
**Before:**
- Single chain: Base
- Single connector: `farcasterMiniApp()`

**After:**
- Two chains: Base (8453) + Ethereum mainnet (1)
- Three connectors:
  - `walletConnect()` - Primary for mobile
  - `injected()` - Browser extension wallets
  - `coinbaseWallet()` - Coinbase Wallet
- Added project ID from environment: `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- Configured WalletConnect metadata (name, description, icons)

### 3. app/components/FarcasterMiniAppReady.tsx
**Before:**
- Called `sdk.actions.ready()` on mount
- Imported from `@farcaster/miniapp-sdk`

**After:**
- Renders `null` immediately
- No SDK imports or calls
- File preserved for compatibility with layout

### 4. app/components/WalletConnect.tsx
**Before:**
- Checked `isFarcaster` environment
- Returned `null` if not in Farcaster
- Used first connector (farcasterMiniApp)

**After:**
- Always renders (no environment check)
- Finds and uses WalletConnect connector by ID
- Added disconnect functionality
- Removed Farcaster environment detection

**Key changes:**
```typescript
// Removed
const isFarcaster = useMemo(() => detectFarcasterEnvironment(), []);
if (!isFarcaster) return null;

// Added
const walletConnectConnector = connectors.find(c => c.id === "walletConnect");
```

### 5. app/providers/FarcasterWalletProvider.tsx
**Changes:**
- File renamed conceptually to `WalletProvider` (export name changed)
- Removed Web3Modal provider wrapper
- Simplified to standard WagmiProvider + QueryClientProvider
- No Farcaster-specific configuration

### 6. app/layout.tsx
**Changes:**
- Import changed: `FarcasterWalletProvider` → `WalletProvider`
- Usage updated throughout
- `FarcasterMiniAppReady` component remains (renders null)

### 7. app/HomeClient.tsx
**Removed:**
- `import { sdk } from "@farcaster/miniapp-sdk"`
- `import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector"`
- `import useFarcasterEnvironment from "./hooks/useFarcasterEnvironment"`
- `const isFarcasterEnv = useFarcasterEnvironment("Home page")`

**Modified:**
- Connect button now uses WalletConnect connector from connectors array
- Removed `sdk.actions.ready()` calls
- Changed from: `connect({ connector: farcasterMiniApp() })`
- Changed to:
  ```typescript
  const walletConnectConnector = connectors.find(c => c.id === "walletConnect");
  if (walletConnectConnector) {
    connect({ connector: walletConnectConnector });
  }
  ```

### 8. app/profile/page.tsx
**Removed:**
- `import { sdk } from "@farcaster/miniapp-sdk"`
- `loadFarcasterContext()` async function
- `sdk.actions.ready()` call
- `await sdk.context` call

**Modified:**
- `farcasterContext` always set to `null`
- `loadingFarcasterContext` set to `false` immediately
- Profile displays "No social profile linked" message
- All wallet-based stats remain fully functional

**Preserved functionality:**
- NFT holdings display
- Staking statistics
- Chest streak tracking
- Leaderboard ranking
- FAQ section

### 9. app/chest/page.tsx
**Removed:**
- `import { sdk } from "@farcaster/miniapp-sdk"`

**Modified:**
- `handleShareProgress()` function:
  - Before: Called `sdk.actions.composeCast()`
  - After: Logs "Share feature not available in standalone app"

**Preserved functionality:**
- Daily Bronze chest claiming
- Silver chest claiming (on-chain)
- Streak tracking
- Reward totals
- All blockchain interactions

### 10. app/steam/page.tsx
**Removed:**
- `import { sdk } from "@farcaster/miniapp-sdk"`
- All `sdk.actions.ready()` calls
- All `await sdk.context` calls
- Farcaster FID verification logic

**Modified Functions:**

**`VerifyModal` useEffect:**
- Removed SDK initialization
- Set state to `no_fid` immediately
- Message: "Social verification not available in standalone app"

**`handleAddMiniApp()`:**
- Removed `sdk.actions.addFrame()` call
- Added console log
- Still marks task as complete via API

**`handleReferralShare()`:**
- Removed `sdk.actions.composeCast()` call
- Fetches referral link
- Shows alert with link (user can copy manually)

**Preserved functionality:**
- Daily fishing task
- NFT ownership tasks
- Referral tracking
- On-chain task verification
- Task completion API calls

**Tasks affected (marked unavailable):**
- `fc_follow` - Farcaster follow task
- `fc_like_recast` - Farcaster engagement task
- `fc_comment` - Farcaster comment task
- `add_miniapp` - Add to Farcaster Mini App

### 11. app/farcaster/verify/page.tsx
**Complete rewrite:**
- Removed entire Farcaster verification flow
- Removed `sdk` import and calls
- Replaced with static message component
- Displays: "Social verification not available in standalone Android app"
- Route still exists but non-functional

### 12. app/hooks/useFarcasterEnvironment.ts
**Not modified** (no longer imported anywhere)
- Hook still exists but unused
- Will detect `false` in Android WebView

### 13. app/utils/farcaster.ts
**Not modified** (no longer imported anywhere)
- Detection functions still exist but unused
- Would detect non-Farcaster environment

## Files Added

### 1. .env.local
**New environment variables:**
```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=YOUR_PROJECT_ID_HERE
```

**Preserved variables:**
```bash
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=...
NEXT_PUBLIC_CLAIM_CONTROLLER_ADDRESS=...
NEXT_PUBLIC_ERC20_TOKEN_ADDRESS=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

### 2. .env.example
Template file documenting all required environment variables with descriptions.

### 3. android-app/ (Complete Android Project)

**Directory structure:**
```
android-app/
├── app/
│   ├── src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── java/com/farfish/app/
│   │   │   ├── MainActivity.java
│   │   │   ├── WebAppInterface.java
│   │   │   └── SplashActivity.java
│   │   └── res/
│   │       ├── drawable/
│   │       ├── layout/
│   │       ├── values/
│   │       └── xml/
│   ├── build.gradle
│   └── proguard-rules.pro
├── gradle/wrapper/
├── build.gradle
├── settings.gradle
├── gradle.properties
└── .gitignore
```

**Key files:**
- `MainActivity.java` - Main WebView activity with WalletConnect deep link handling
- `WebAppInterface.java` - JavaScript bridge for native functionality
- `SplashActivity.java` - Splash screen on app launch
- `AndroidManifest.xml` - App configuration, permissions, intent filters
- Layout XMLs - UI for main, splash, and error screens
- Resource files - Strings, colors, styles, network security config
- Gradle files - Build configuration, dependencies, ProGuard rules

## API Routes

**No changes required.** All API routes already use wallet address as the primary identifier, not Farcaster FID.

**Functional routes:**
- `/api/profile/streak` - Wallet-based
- `/api/leaderboard/user` - Wallet-based
- `/api/steam/task-status` - Wallet-based
- `/api/steam/task/complete` - Wallet-based
- `/api/referral/link` - Wallet-based

**Disabled routes:**
- `/api/farcaster/verify` - Still exists but will return errors for Farcaster tasks

## Behavioral Changes

### Wallet Connection

**Before (Farcaster):**
1. User opens app in Farcaster client
2. Automatically connects via Farcaster's embedded wallet
3. One-click connection, no external app needed

**After (Android):**
1. User opens Android app
2. Clicks "Connect Wallet" button
3. WalletConnect modal shows QR code or deep link
4. User selects wallet app (MetaMask, Rainbow, etc.)
5. Wallet app opens, user approves connection
6. Returns to FarFISH app, connected

### Social Features

**Removed (not available in Android app):**
- Farcaster profile display
- Cast composer (share to Farcaster)
- Follow task verification
- Like/recast task verification
- Comment task verification
- Add Mini App to Farcaster

**Preserved (fully functional):**
- All blockchain interactions
- NFT minting
- Chest claiming
- Staking
- Referral system
- Leaderboard
- Task completion (non-Farcaster tasks)

### User Experience

**Profile Page:**
- No longer shows Farcaster username/avatar/FID
- Displays "No social profile linked" message
- All wallet stats remain visible

**Steam (Tasks) Page:**
- Farcaster tasks show as unavailable or removed
- Daily tasks fully functional
- NFT tasks fully functional
- Referral tasks fully functional

**Chest Page:**
- Share streak button disabled or shows "not available"
- All claiming functionality preserved

## Environment Variables Required

### Web App (.env.local)

```bash
# New for Android
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Existing (preserved)
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_CLAIM_CONTROLLER_ADDRESS=0x...
NEXT_PUBLIC_ERC20_TOKEN_ADDRESS=0x...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

### Android App

```java
// MainActivity.java
private static final String APP_URL = "https://farfish-android.vercel.app";

// Or in app/build.gradle
buildConfigField "String", "APP_URL", "\"https://farfish-android.vercel.app\""
```

## Testing Checklist

### Web App Changes
- [ ] App builds successfully (`npm run build`)
- [ ] No TypeScript errors
- [ ] All pages load without errors
- [ ] Wallet connection works via WalletConnect
- [ ] Can connect MetaMask, Rainbow, Coinbase Wallet
- [ ] NFT minting works
- [ ] Chest claiming works
- [ ] Profile displays wallet stats correctly
- [ ] No console errors related to Farcaster

### Android App
- [ ] APK builds successfully
- [ ] App launches without crashes
- [ ] WebView loads Vercel deployment
- [ ] All pages navigate correctly
- [ ] Wallet connection via WalletConnect works
- [ ] Deep links to wallet apps work
- [ ] Can return to app after wallet approval
- [ ] NFT minting works from Android
- [ ] Chest claiming works from Android
- [ ] Back button navigation works
- [ ] Pull-to-refresh works
- [ ] No ANR (Application Not Responding) errors

## Rollback Plan

If issues arise:

1. **Web App:** Revert to commit before Farcaster removal
2. **Keep separate deployments:** 
   - Original: `farfish-miniapp5.vercel.app` (with Farcaster)
   - Android: `farfish-android.vercel.app` (without Farcaster)

## Migration Notes for Users

### From Farcaster Mini App to Android APK

**What's the same:**
- ✅ All core features (minting, claiming, staking, referrals)
- ✅ Your wallet address and progress
- ✅ Your NFTs and tokens
- ✅ Leaderboard rankings
- ✅ Streak tracking

**What's different:**
- ⚠️ Must connect wallet manually via WalletConnect
- ⚠️ No Farcaster profile display
- ⚠️ Cannot share to Farcaster
- ⚠️ Farcaster social tasks not available

**Recommendation:** Use both!
- Farcaster Mini App for social features
- Android APK for on-the-go access
- Same wallet works in both

## Security Considerations

1. **No cleartext traffic:** HTTPS only (except localhost for dev)
2. **SSL errors blocked:** Never proceed with invalid certificates
3. **Safe Browsing enabled:** Google Safe Browsing API integrated
4. **No file access:** WebView file access disabled
5. **Camera permission:** Only granted for QR scanning (WalletConnect)
6. **ProGuard enabled:** Code obfuscation in release builds
7. **Signed APK:** Release builds must be signed with keystore

## Performance Impact

- **Bundle size:** No change (Farcaster SDK removed, no replacements added)
- **Load time:** Slightly faster (fewer SDK initializations)
- **Memory:** Comparable (WebView overhead in Android)
- **Network:** WalletConnect adds WebSocket connection

## Future Enhancements

Potential improvements for future versions:

1. **Custom wallet integration:** Native WalletConnect implementation
2. **Push notifications:** For transaction confirmations
3. **Biometric auth:** Fingerprint/Face unlock
4. **Offline mode:** Cache web app for offline viewing
5. **Deep linking:** Custom URL scheme for sharing
6. **App shortcuts:** Quick actions on home screen icon

## Support & Debugging

**Web app console:**
- Open dev tools in browser: F12
- Filter by "FarFISH" or "wagmi"
- Check Network tab for failed requests

**Android Logcat:**
- In Android Studio: View → Tool Windows → Logcat
- Filter by "com.farfish.app"
- Filter by "WebView" for JavaScript errors

**Common issues:**
- WalletConnect not working: Check PROJECT_ID in .env.local
- SSL errors: Verify HTTPS on Vercel deployment
- Deep links not working: Check AndroidManifest.xml intent filters
- Wallet connection fails: Ensure wallet app is installed on device
