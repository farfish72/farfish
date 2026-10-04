# FarFISH Android APK - Quick Start Checklist

Follow this checklist to build your Android APK step by step.

## ✅ Phase 1: Web App Setup (30-45 minutes)

### Step 1: Get WalletConnect Project ID
- [ ] Go to https://cloud.walletconnect.com/
- [ ] Sign up or log in
- [ ] Create new project named "FarFISH"
- [ ] Copy your Project ID

### Step 2: Configure Environment
- [ ] Open `.env.local` file in project root
- [ ] Paste your WalletConnect Project ID:
  ```bash
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
  ```
- [ ] Verify other environment variables are set (contract addresses, Redis)

### Step 3: Install Dependencies
- [ ] Open terminal in project root
- [ ] Run: `npm install`
- [ ] If timeout, try: `npm install --legacy-peer-deps`
- [ ] Wait for installation to complete

### Step 4: Test Build Locally
- [ ] Run: `npm run build`
- [ ] Verify build succeeds (look for "✓ Compiled successfully")
- [ ] Run: `npm start`
- [ ] Open http://localhost:3000 in browser
- [ ] Test wallet connection works

### Step 5: Deploy to Vercel
- [ ] Create new GitHub repository (recommended: "farfish-android")
- [ ] Push code to GitHub:
  ```bash
  git init
  git add .
  git commit -m "Android version with WalletConnect"
  git remote add origin https://github.com/yourusername/farfish-android.git
  git push -u origin main
  ```
- [ ] Go to https://vercel.com/new
- [ ] Import your GitHub repository
- [ ] Add environment variables in Vercel:
  - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
  - `NEXT_PUBLIC_NFT_CONTRACT_ADDRESS`
  - `NEXT_PUBLIC_CLAIM_CONTROLLER_ADDRESS`
  - `NEXT_PUBLIC_ERC20_TOKEN_ADDRESS`
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- [ ] Click "Deploy"
- [ ] Wait for deployment to complete
- [ ] Note your deployment URL (e.g., https://farfish-android.vercel.app)
- [ ] Test in browser to confirm it works

---

## ✅ Phase 2: Android App Setup (45-60 minutes)

### Step 6: Install Android Studio
- [ ] Download from https://developer.android.com/studio
- [ ] Install with default settings
- [ ] Launch Android Studio
- [ ] Complete setup wizard
- [ ] Install Android SDK (API 24+)

### Step 7: Open Android Project
- [ ] In Android Studio: File → Open
- [ ] Navigate to: `c:\Users\PC\Desktop\farfish-miniapp\android-app`
- [ ] Click OK
- [ ] Wait for Gradle sync (first time may take 5-10 minutes)

### Step 8: Configure Local Properties
- [ ] Create file: `android-app/local.properties`
- [ ] Add (replace with your SDK path):
  ```properties
  sdk.dir=C\:\\Users\\YourUsername\\AppData\\Local\\Android\\Sdk
  ```
- [ ] To find SDK path: Tools → SDK Manager → copy "Android SDK Location"

### Step 9: Update Web App URL ⚠️ CRITICAL STEP
- [ ] Open `android-app/app/src/main/java/com/farfish/app/MainActivity.java`
- [ ] Find lines ~34-37 with the TODO comment
- [ ] Replace the placeholder URL with your Vercel deployment URL from Step 5:
  ```java
  private static final String APP_URL = "https://farfish-android.vercel.app";
  ```
- [ ] ⚠️ **DO NOT use the original Farcaster Mini App URL!** Use your NEW Android-specific deployment.
- [ ] Save file
- [ ] Verify the URL matches your Vercel deployment exactly

### Step 10: Build Debug APK
- [ ] In Android Studio: Build → Build Bundle(s) / APK(s) → Build APK(s)
- [ ] Wait for build (2-5 minutes first time)
- [ ] Click "locate" in notification when done
- [ ] Note location: `android-app/app/build/outputs/apk/debug/app-debug.apk`

---

## ✅ Phase 3: Testing (20-30 minutes)

### Step 11: Install on Device
- [ ] Enable Developer Options on Android device:
  1. Settings → About Phone
  2. Tap Build Number 7 times
  3. Go back → Developer Options
  4. Enable USB Debugging
- [ ] Connect device via USB
- [ ] Run: `adb devices` (should list your device)
- [ ] Run: `adb install android-app/app/build/outputs/apk/debug/app-debug.apk`
- [ ] Or drag APK file to device and install manually

### Step 12: Test Wallet Connection
- [ ] Install a wallet app on your device (MetaMask, Rainbow, etc.)
- [ ] Set up wallet (create new or import existing)
- [ ] Add Base network to wallet:
  - Network: Base
  - RPC: https://mainnet.base.org
  - Chain ID: 8453
  - Currency: ETH
- [ ] Open FarFISH app
- [ ] Tap "Connect Wallet"
- [ ] Select WalletConnect
- [ ] Choose your wallet
- [ ] Approve connection
- [ ] Verify "Connected" status shows

### Step 13: Test Core Features
- [ ] Test NFT minting:
  1. Ensure wallet is connected
  2. Check you're on Base network
  3. Tap "Mint Premium Pass"
  4. Approve transaction in wallet
  5. Wait for confirmation
  6. Check Profile page for NFT
- [ ] Test Chest claiming:
  1. Go to Chest page
  2. Claim Bronze chest
  3. Verify tokens added
- [ ] Test navigation:
  1. Navigate between all pages
  2. Test back button
  3. Test pull-to-refresh
- [ ] Test deep links:
  1. Initiate transaction from wallet
  2. Verify app opens
  3. Complete transaction

---

## ✅ Phase 4: Release Build (Optional, 30-45 minutes)

### Step 14: Generate Signing Key
- [ ] Open terminal in `android-app/app/`
- [ ] Run:
  ```bash
  keytool -genkey -v -keystore farfish-release.keystore -alias farfish -keyalg RSA -keysize 2048 -validity 10000
  ```
- [ ] Enter strong password (save it securely!)
- [ ] Fill in details when prompted
- [ ] Keystore file created: `farfish-release.keystore`

### Step 15: Configure Signing
- [ ] Open `android-app/app/build.gradle`
- [ ] Add signing config (see ANDROID_SETUP.md for details)
- [ ] Save file
- [ ] **Important:** Do NOT commit keystore or password to git!

### Step 16: Build Release APK
- [ ] In Android Studio: Build → Select Build Variant
- [ ] Select "release"
- [ ] Build → Build Bundle(s) / APK(s) → Build APK(s)
- [ ] Wait for build
- [ ] APK location: `android-app/app/build/outputs/apk/release/app-release.apk`

### Step 17: Test Release APK
- [ ] Uninstall debug version from device
- [ ] Install release APK
- [ ] Test all features again
- [ ] Verify performance is good

---

## ✅ Phase 5: Distribution (Varies)

### Option A: Google Play Store
- [ ] Create Google Play Developer account ($25 fee)
- [ ] Prepare store listing:
  - Screenshots (at least 2)
  - App icon (512x512)
  - Feature graphic (1024x500)
  - Description
  - Privacy policy URL
- [ ] Build AAB: `./gradlew bundleRelease`
- [ ] Upload to Play Console
- [ ] Submit for review
- [ ] Wait for approval (1-7 days)

### Option B: Direct Distribution
- [ ] Host APK on your website
- [ ] Or share via messaging/email
- [ ] Users must enable "Install from Unknown Sources"
- [ ] Users install APK manually

---

## 🎉 Completion Checklist

You're done when you can check all these:

- [ ] Web app deployed to Vercel with WalletConnect
- [ ] Can connect wallet in browser
- [ ] Android APK builds successfully
- [ ] APK installs on Android device
- [ ] Can connect wallet in Android app
- [ ] Can mint NFT from Android app
- [ ] Can claim chest from Android app
- [ ] All navigation works in Android app
- [ ] Deep links work (wallet → app)
- [ ] No crashes or major errors

---

## 📚 If You Get Stuck

### Web App Issues
→ See **ANDROID_SETUP.md** Part 1
→ Check browser console for errors
→ Verify environment variables

### Android Build Issues
→ See **ANDROID_SETUP.md** Part 2
→ Check Logcat for errors
→ Verify SDK path in local.properties

### Wallet Connection Issues
→ See **WALLET_MIGRATION.md**
→ Verify WalletConnect Project ID
→ Test in browser first

### General Questions
→ Read **CHANGES.md** for what changed
→ Read **README_ANDROID.md** for overview
→ Check android-app/README.md for Android details

---

## ⏱️ Estimated Time

- **First-time full setup:** 2-3 hours
- **Web app only:** 30-45 minutes
- **Android app only:** 1-1.5 hours
- **Just building APK (after setup):** 5-10 minutes

---

## 🚀 Quick Commands Reference

### Web App
```bash
npm install                # Install dependencies
npm run build             # Build for production
npm start                 # Run production build
npm audit                 # Check for vulnerabilities
```

### Android App
```bash
cd android-app
./gradlew assembleDebug   # Build debug APK
./gradlew assembleRelease # Build release APK
./gradlew bundleRelease   # Build AAB for Play Store
```

### ADB
```bash
adb devices               # List connected devices
adb install app-debug.apk # Install APK
adb logcat | grep FarFISH # View logs
```

---

**Good luck! 🎣 You're about to launch FarFISH on Android!**
