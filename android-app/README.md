# FarFISH Android APK

Standalone Android application for FarFISH - Daily habit-building on Base.

## Overview

This is a WebView wrapper that loads the FarFISH Next.js web app and provides native Android functionality including:

- WalletConnect deep link handling
- Network connectivity detection
- Splash screen
- Pull-to-refresh
- Hardware back button navigation
- JavaScript bridge for native features
- Secure HTTPS-only configuration

## Quick Start

### Prerequisites

- Android Studio (Electric Eel or later)
- JDK 17+
- Android SDK (API 24+)

### Setup

1. **Open project in Android Studio:**
   ```
   File → Open → Select android-app folder
   ```

2. **Create local.properties:**
   ```properties
   sdk.dir=C\:\\Users\\YourUsername\\AppData\\Local\\Android\\Sdk
   ```

3. **Sync Gradle:**
   ```
   File → Sync Project with Gradle Files
   ```

4. **Update web app URL in MainActivity.java:**
   ```java
   private static final String APP_URL = "https://your-deployment.vercel.app";
   ```

### Build

**Debug APK (for testing):**
```bash
./gradlew assembleDebug
```
Output: `app/build/outputs/apk/debug/app-debug.apk`

**Release APK (for distribution):**
```bash
./gradlew assembleRelease
```
Output: `app/build/outputs/apk/release/app-release.apk`

### Install

**Via ADB:**
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

**Via Android Studio:**
- Run → Run 'app'
- Select device
- Click OK

## Project Structure

```
android-app/
├── app/
│   ├── src/main/
│   │   ├── AndroidManifest.xml          # App configuration
│   │   ├── java/com/farfish/app/
│   │   │   ├── MainActivity.java        # Main WebView activity
│   │   │   ├── WebAppInterface.java     # JS bridge
│   │   │   └── SplashActivity.java      # Splash screen
│   │   └── res/
│   │       ├── drawable/                # Graphics
│   │       ├── layout/                  # UI layouts
│   │       ├── values/                  # Strings, colors, styles
│   │       └── xml/                     # Network security config
│   ├── build.gradle                     # App-level build config
│   └── proguard-rules.pro              # Code obfuscation rules
├── gradle/wrapper/                      # Gradle wrapper
├── build.gradle                         # Project-level build config
├── settings.gradle                      # Project settings
└── gradle.properties                    # Gradle properties
```

## Configuration

### Web App URL

**Method 1: Direct in MainActivity.java**
```java
private static final String APP_URL = "https://farfish-android.vercel.app";
```

**Method 2: BuildConfig (app/build.gradle)**
```gradle
buildConfigField "String", "APP_URL", "\"https://farfish-android.vercel.app\""
```
Then in MainActivity.java:
```java
private static final String APP_URL = BuildConfig.APP_URL;
```

### App Name & Branding

**App name:** `app/src/main/res/values/strings.xml`
```xml
<string name="app_name">FarFISH</string>
```

**Colors:** `app/src/main/res/values/colors.xml`
```xml
<color name="colorPrimary">#14F195</color>
<color name="backgroundColor">#1A1A2E</color>
```

**Icon:** Replace files in `app/src/main/res/mipmap-*/`
- ic_launcher.png (various sizes)

### Version

**app/build.gradle:**
```gradle
versionCode 1        // Increment for each release
versionName "1.0.0"  // User-facing version string
```

## Features

### WebView Configuration

- **JavaScript:** Enabled
- **DOM Storage:** Enabled
- **File Access:** Disabled (security)
- **Mixed Content:** Never allow (HTTPS only)
- **User Agent:** Appends "FarfishAndroid/1.0"
- **Zoom Controls:** Disabled

### Deep Link Handling

Handles WalletConnect URIs:
- `wc://` - WalletConnect v2
- `ethereum://` - Ethereum deep links
- `farfish://` - Custom app scheme

### JavaScript Bridge

Exposed as `window.Android`:

```javascript
// Check if running in Android app
if (window.Android && window.Android.isAndroidApp()) {
  // Get device info
  const info = JSON.parse(window.Android.getDeviceInfo());
  console.log(info); // { platform: "android", appVersion: "1.0.0" }
  
  // Open URL in external browser
  window.Android.openExternalUrl("https://example.com");
  
  // Show toast message
  window.Android.showToast("Hello from Android!");
}
```

### Network Security

**network_security_config.xml:**
- HTTPS required for all domains
- Cleartext allowed only for localhost (dev testing)
- System certificate authorities trusted

### Error Handling

- **No internet:** Shows error screen with retry button
- **SSL error:** Blocks connection, shows warning
- **Page load error:** Shows inline error with reload option
- **WebView crash:** Activity restarts

## Permissions

**Required:**
- `INTERNET` - Load web app
- `ACCESS_NETWORK_STATE` - Check connectivity
- `CAMERA` - QR scanning for WalletConnect

**Declared in:** `AndroidManifest.xml`

## Build Variants

### Debug

- Debuggable
- No obfuscation
- Logs enabled
- Faster builds

### Release

- Not debuggable
- ProGuard obfuscation enabled
- Logs stripped
- Resource shrinking
- Requires signing

## Signing (Release)

### Generate Keystore

```bash
keytool -genkey -v -keystore farfish-release.keystore \
  -alias farfish \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

### Configure Signing

**app/build.gradle:**
```gradle
android {
    signingConfigs {
        release {
            storeFile file("farfish-release.keystore")
            storePassword "YOUR_PASSWORD"
            keyAlias "farfish"
            keyPassword "YOUR_PASSWORD"
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            ...
        }
    }
}
```

**Security:** Never commit keystore or passwords to version control!

## Testing

### Manual Testing

1. Install APK on device
2. Open app
3. Wait for web app to load
4. Test wallet connection
5. Test NFT minting
6. Test navigation
7. Test back button
8. Test pull-to-refresh
9. Test deep links (WalletConnect)
10. Test offline behavior

### Logcat Debugging

**In Android Studio:**
```
View → Tool Windows → Logcat
Filter: com.farfish.app
```

**Via ADB:**
```bash
adb logcat | grep FarFISH
```

### Common Issues

**App crashes on launch:**
- Check Logcat for stack trace
- Verify APP_URL is valid HTTPS
- Ensure internet permission is granted

**WebView blank:**
- Check network connectivity
- Verify URL is accessible in browser
- Check for JavaScript errors in Logcat

**WalletConnect not working:**
- Verify intent filters in AndroidManifest.xml
- Check that wallet app is installed
- Test deep link with: `adb shell am start -a android.intent.action.VIEW -d "wc:..."`

## ProGuard

Configured in `proguard-rules.pro`:

- Keeps WebView JavaScript interface
- Keeps app classes
- Removes debug logging
- Obfuscates code
- Shrinks resources

## Dependencies

```gradle
implementation 'androidx.appcompat:appcompat:1.6.1'
implementation 'com.google.android.material:material:1.11.0'
implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
implementation 'androidx.swiperefreshlayout:swiperefreshlayout:1.1.0'
implementation 'androidx.webkit:webkit:1.9.0'
```

**AndroidX:** Modern Android support library
**Material:** Material Design components
**WebKit:** Enhanced WebView features
**SwipeRefreshLayout:** Pull-to-refresh gesture

## Minimum Requirements

- **Min SDK:** 24 (Android 7.0 Nougat)
- **Target SDK:** 34 (Android 14)
- **Compile SDK:** 34

**Coverage:** ~97% of active Android devices (as of 2024)

## Performance

### APK Size

- **Debug:** ~8-10 MB
- **Release:** ~5-7 MB (with ProGuard)

### Memory Usage

- **Base:** ~50-80 MB
- **With WebView:** ~150-250 MB
- **Peak (during minting):** ~300-400 MB

### Launch Time

- **Cold start:** 1.5s (splash) + 2-3s (web load) = ~4-5s
- **Warm start:** 1-2s

## Distribution

### Google Play Store

1. Create signed AAB (App Bundle):
   ```bash
   ./gradlew bundleRelease
   ```
2. Upload to Google Play Console
3. Fill out store listing
4. Submit for review

### Direct APK

1. Build signed release APK
2. Host on website or share directly
3. Users must enable "Unknown Sources"

## Updates

### Web App Updates

- **No Android rebuild needed**
- Simply deploy new version to Vercel
- WebView loads latest automatically

### Android App Updates

- Increment `versionCode` and `versionName`
- Build new signed APK/AAB
- Distribute via Play Store or direct download

## Troubleshooting

### Build Errors

**SDK not found:**
- Create `local.properties` with correct `sdk.dir`

**Gradle sync failed:**
- Check internet connection
- Invalidate caches: File → Invalidate Caches → Restart

**Java version mismatch:**
- Use JDK 17 (not 8 or 11)
- Set in Android Studio: File → Project Structure → SDK Location

### Runtime Errors

**WebView crashes:**
- Update Android System WebView in Play Store
- Clear app data: Settings → Apps → FarFISH → Clear Data

**Deep links not working:**
- Verify intent filters in AndroidManifest.xml
- Test with: `adb shell am start -a android.intent.action.VIEW -d "farfish://test"`

**Network errors:**
- Check device internet connection
- Verify URL is HTTPS
- Test URL in mobile browser

## Resources

- **Android Developer Docs:** https://developer.android.com/
- **WebView Guide:** https://developer.android.com/guide/webapps/webview
- **WalletConnect:** https://docs.walletconnect.com/
- **Material Design:** https://material.io/

## License

Same as parent FarFISH project.

## Support

For issues or questions:
- Check Logcat output
- Review ANDROID_SETUP.md in parent directory
- Test web app separately from Android app
- Verify all configuration is correct
