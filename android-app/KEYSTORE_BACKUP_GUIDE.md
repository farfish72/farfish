# 🔐 Keystore Backup Guide

## ⚠️ CRITICAL: Backup Your Keystore!

**Without your keystore, you CANNOT update your app on Google Play Store!**

This is the most important file in your Android project. Loss means:
- ❌ Cannot publish updates to existing app
- ❌ Must create NEW app with different package name
- ❌ Lose ALL users, downloads, and reviews

---

## 📁 Files to Backup

You need to backup these files (located in `android-app/`):

1. **`farfish-release-key.keystore`** - Your signing key
2. **`keystore.properties`** - Contains passwords and configuration

**NEVER commit these files to Git!** (They're in `.gitignore`)

---

## 🚀 Quick Backup Command

```powershell
# Create encrypted ZIP backup
cd android-app
Compress-Archive -Path farfish-release-key.keystore,keystore.properties -DestinationPath "$env:USERPROFILE\Desktop\keystore-backup-$(Get-Date -Format 'yyyy-MM-dd').zip"
```

---

## 💾 Backup Locations (Do at least 3!)

### Recommended:
- ☁️ **Cloud Storage** (Google Drive, Dropbox) - in password-protected ZIP
- 🔐 **Password Manager** (1Password, Bitwarden) - as secure note with attachment
- 💾 **External Drive** (USB, external HDD) - keep in safe place
- 📧 **Email** - send encrypted ZIP to yourself
- 💻 **Another Computer** - copy to backup machine
- 🏦 **Physical Storage** - print passwords, store in safe

---

## 📝 Backup Checklist

- [ ] Backup to cloud storage (encrypted)
- [ ] Save in password manager
- [ ] Copy to external drive
- [ ] Email to yourself (encrypted)
- [ ] Test restoring from backup
- [ ] Verify backups are accessible

---

## 🔒 Security Best Practices

### ✅ DO:
- ✅ Use password-protected ZIP files
- ✅ Store passwords separately from keystore
- ✅ Keep multiple backups in different locations
- ✅ Test backups periodically
- ✅ Use encrypted storage

### ❌ DON'T:
- ❌ Commit keystore to Git/GitHub
- ❌ Share keystore publicly
- ❌ Store unencrypted in public cloud
- ❌ Keep only one backup
- ❌ Store passwords with keystore file

---

## 🆘 If You Lost Your Keystore

**Unfortunately:**
- Cannot be recovered (no way exists)
- Cannot update existing app
- Must publish NEW app with different package name

**Prevention is the ONLY solution. Backup NOW!**

---

## 📱 Google Play App Signing

Consider enrolling in **Google Play App Signing**:
- Google stores backup of your key
- Additional layer of protection
- Can request key reset in emergencies (complex process)

More info: https://support.google.com/googleplay/android-developer/answer/9842756

---

## 📅 When to Backup

- ✅ Immediately after creating keystore (NOW!)
- ✅ Before any major release
- ✅ After any keystore changes
- ✅ Every 6 months (verify backups still work)
- ✅ Before formatting drives

---

## 🔗 Related Files

- `SIGNING_SETUP.md` - How to set up signing
- `keystore.properties.example` - Template file

---

**Remember: 5 minutes backing up now saves months of work later!**

🔐 **BACKUP NOW. DON'T DELAY!** 🔐
