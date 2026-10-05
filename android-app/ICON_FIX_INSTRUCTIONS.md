# Android Launcher Icon Fix Instructions

## Problem
The FarFISH app icon was not rendering correctly on some Android devices due to missing density-specific icon assets and incomplete adaptive icon configuration.

## Solution Overview
Fixed the icon configuration to work properly across Android 9 (API 28) to Android 16 (latest) by:
1. Generating proper density-specific PNG assets for all mipmap folders
2. Configuring adaptive icons for Android 8.0+ (API 26+)
3. Adding monochrome layer support for Android 13+ (API 33+) themed icons
4. Ensuring legacy fallback icons exist for older devices

## What Was Fixed

### 1. XML Configuration Files ✓
- `drawable/ic_launcher_foreground.xml` - References `@mipmap/ic_launcher_foreground`
- `mipmap-anydpi-v26/ic_launcher.xml` - Adaptive icon for Android 8.0+
- `mipmap-anydpi-v26/ic_launcher_round.xml` - Round adaptive icon for Android 8.0+
- `mipmap-anydpi-v33/ic_launcher.xml` - NEW: Adaptive icon with monochrome layer for Android 13+
- `mipmap-anydpi-v33/ic_launcher_round.xml` - NEW: Round adaptive icon with monochrome for Android 13+

### 2. Icon Generation Script ✓
Created `generate_icons.py` to generate all required PNG assets

## Steps to Complete the Fix

### Step 1: Install Pillow (if not already installed)
```powershell
pip install Pillow
```

### Step 2: Run the Icon Generator
```powershell
cd android-app
python generate_icons.py
```

This script will generate:
- **Legacy launcher icons** (for Android 9-10):
  - `mipmap-mdpi/ic_launcher.png` (48x48)
  - `mipmap-hdpi/ic_launcher.png` (72x72)
  - `mipmap-xhdpi/ic_launcher.png` (96x96)
  - `mipmap-xxhdpi/ic_launcher.png` (144x144)
  - `mipmap-xxxhdpi/ic_launcher.png` (192x192)
  - Same sizes for `ic_launcher_round.png`

- **Adaptive icon foreground layers** (for Android 8.0+):
  - `mipmap-mdpi/ic_launcher_foreground.png` (108x108)
  - `mipmap-hdpi/ic_launcher_foreground.png` (162x162)
  - `mipmap-xhdpi/ic_launcher_foreground.png` (216x216)
  - `mipmap-xxhdpi/ic_launcher_foreground.png` (324x324)
  - `mipmap-xxxhdpi/ic_launcher_foreground.png` (432x432)

- **Monochrome layers** (for Android 13+ themed icons):
  - `mipmap-mdpi/ic_launcher_monochrome.png` (108x108)
  - `mipmap-hdpi/ic_launcher_monochrome.png` (162x162)
  - `mipmap-xhdpi/ic_launcher_monochrome.png` (216x216)
  - `mipmap-xxhdpi/ic_launcher_monochrome.png` (324x324)
  - `mipmap-xxxhdpi/ic_launcher_monochrome.png` (432x432)

### Step 3: Build and Test
```powershell
# Clean previous build
./gradlew clean

# Build debug APK
./gradlew assembleDebug

# Or build release APK (if signing is configured)
./gradlew assembleRelease
```

### Step 4: Install and Verify
Install the APK on test devices running different Android versions:
- Android 9 (API 28) - Should show legacy PNG icon
- Android 10-12 (API 29-32) - Should show adaptive icon with foreground + background
- Android 13+ (API 33+) - Should show adaptive icon, supports themed icons in supported launchers

## Technical Details

### Adaptive Icon Safe Zones
- **Total canvas**: 108dp x 108dp
- **Safe zone**: 66dp circle in center (for icon content)
- **Padding**: 21dp on all sides (66dp + 42dp padding = 108dp)
- **Maskable area**: Varies by launcher (circle, rounded square, squircle, etc.)

### Icon Sizes by Density
| Density | Launcher | Adaptive Foreground | Scale |
|---------|----------|---------------------|-------|
| mdpi    | 48x48    | 108x108            | 1x    |
| hdpi    | 72x72    | 162x162            | 1.5x  |
| xhdpi   | 96x96    | 216x216            | 2x    |
| xxhdpi  | 144x144  | 324x324            | 3x    |
| xxxhdpi | 192x192  | 432x432            | 4x    |

### Background Color
The icon background uses the existing brand color:
- Color: `#270366` (purple)
- Defined in: `res/values/colors.xml` as `ic_launcher_background`

### Monochrome Layer (Android 13+)
The monochrome layer is a white silhouette of the logo used for:
- Themed icons (user can apply system color theme)
- Better integration with system UI
- Accessibility (high contrast modes)

## Verification Checklist

After running the script and building:

- [ ] Script runs without errors
- [ ] All mipmap-* folders contain ic_launcher.png files
- [ ] All mipmap-* folders contain ic_launcher_round.png files
- [ ] All mipmap-* folders contain ic_launcher_foreground.png files
- [ ] All mipmap-* folders contain ic_launcher_monochrome.png files
- [ ] APK builds successfully without resource errors
- [ ] Icon displays correctly on Android 9 device/emulator
- [ ] Icon displays correctly on Android 12 device/emulator
- [ ] Icon displays correctly on Android 13+ device/emulator
- [ ] Themed icon works on Android 13+ (check in supported launchers)

## Troubleshooting

### "Module not found: PIL"
Install Pillow: `pip install Pillow`

### "Source icon not found"
Make sure `app/src/main/res/drawable/app_icon.png` exists

### Build fails with "resource not found"
- Verify all XML files reference `@mipmap/` instead of `@drawable/`
- Run `./gradlew clean` then rebuild

### Icon still not displaying correctly
- Uninstall the old app completely
- Clear launcher cache (Settings > Apps > Launcher > Storage > Clear cache)
- Reinstall the new APK
- Restart the device if needed

## Files Modified/Created

### Modified:
- `app/src/main/res/drawable/ic_launcher_foreground.xml`
- `app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`
- `app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml`

### Created:
- `generate_icons.py`
- `app/src/main/res/mipmap-anydpi-v33/` (folder)
- `app/src/main/res/mipmap-anydpi-v33/ic_launcher.xml`
- `app/src/main/res/mipmap-anydpi-v33/ic_launcher_round.xml`
- All PNG assets in mipmap-* folders (generated by script)

## References
- [Android Adaptive Icons Guide](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive)
- [Android App Icons](https://developer.android.com/studio/write/create-app-icons)
- [Material Design: Product Icons](https://m3.material.io/styles/icons/designing-icons)
