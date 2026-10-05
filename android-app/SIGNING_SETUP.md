# APK Signing Setup Guide

## Quick Start

Follow these steps to set up production signing for your Android app:

### 1. Generate a Keystore

Open PowerShell in the `android-app` directory and run:

```powershell
keytool -genkey -v -keystore farfish-release-key.keystore -alias farfish -keyalg RSA -keysize 2048 -validity 10000
```

You'll be prompted for:
- **Keystore password**: Choose a strong password (remember this!)
- **Key password**: Choose a strong password (remember this!)
- **Your details**: Name, organization, location, etc.

**⚠️ IMPORTANT**: Keep your keystore file and passwords secure! If you lose them, you cannot update your app on the Play Store.

### 2. Create keystore.properties

Rename `keystore.properties.example` to `keystore.properties` and fill in your values:

```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=farfish
storeFile=farfish-release-key.keystore
```

**⚠️ IMPORTANT**: This file is already in `.gitignore` - never commit it to version control!

### 3. Build Signed Release APK

Once your keystore and properties file are set up, build the release APK:

```powershell
.\gradlew assembleRelease
```

The signed APK will be at:
```
app\build\outputs\apk\release\app-release.apk
```

### 4. Verify the Signature

To verify your APK is signed correctly:

```powershell
keytool -printcert -jarfile app\build\outputs\apk\release\app-release.apk
```

## Backup Your Keystore

**CRITICAL**: Back up your keystore file and passwords to a secure location:
- Cloud storage (encrypted)
- Password manager
- Secure offline storage

Without your keystore, you cannot update your app on Google Play Store!

## Security Best Practices

1. ✅ Never commit `keystore.properties` to git
2. ✅ Never commit `*.keystore` files to git
3. ✅ Use strong passwords
4. ✅ Keep multiple secure backups
5. ✅ Store passwords in a password manager
6. ✅ Limit access to the keystore file

## For CI/CD (GitHub Actions, etc.)

Store these as encrypted secrets:
- `KEYSTORE_PASSWORD`
- `KEY_PASSWORD`
- `KEY_ALIAS`
- Base64-encoded keystore file

## Alternative: Build Signed APK with Command Line

If you want to sign an existing unsigned APK:

```powershell
# Align the APK
zipalign -v -p 4 app-release-unsigned.apk app-release-unsigned-aligned.apk

# Sign the APK
apksigner sign --ks farfish-release-key.keystore --out app-release-signed.apk app-release-unsigned-aligned.apk

# Verify
apksigner verify app-release-signed.apk
```

## Troubleshooting

### "keytool: command not found"
Make sure Java JDK is installed and added to your PATH.

### Build uses debug signature
Check that `keystore.properties` exists and has correct paths.

### Cannot find keystore file
Make sure `storeFile` path in `keystore.properties` is relative to the `android-app` directory.
