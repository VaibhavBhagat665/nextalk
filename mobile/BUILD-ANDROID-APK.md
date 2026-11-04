# NexTalk Mobile - Android APK Build Guide

## Prerequisites

### 1. Install EAS CLI
```bash
npm install -g eas-cli
```

### 2. Login to Expo
```bash
eas login
```

**Note**: Use the account associated with this project:
- Owner: `bosswire`
- Project ID: `fbc33a7b-aace-4b05-876d-7ac992217ec8`

### 3. Verify Configuration
Check that you're logged in:
```bash
eas whoami
```

Should show: `bosswire` (or your Expo account)

---

## Quick Build (Recommended)

### Build APK for Testing
```bash
cd mobile
eas build --platform android --profile preview
```

This will:
- Build a release APK (not app bundle)
- Use the `preview` profile configuration
- Include environment variables from `eas.json`
- Take ~10-15 minutes

### Build for Production (Google Play)
```bash
cd mobile
eas build --platform android --profile production
```

This builds an AAB (Android App Bundle) for Play Store submission.

---

## Build Profiles Explained

### Preview Profile
```json
{
  "distribution": "internal",
  "android": {
    "buildType": "apk",
    "gradleCommand": ":app:assembleRelease"
  }
}
```

**Use Case**: Testing, sharing with testers, direct installation  
**Output**: `.apk` file (can install directly on devices)  
**Distribution**: Internal only (not for Play Store)

### Production Profile
```json
{
  "android": {
    "buildType": "app-bundle"
  }
}
```

**Use Case**: Google Play Store submission  
**Output**: `.aab` file (Android App Bundle)  
**Distribution**: Google Play Store

---

## Local Build (Alternative - Requires Android Studio)

If you want to build locally instead of using EAS:

### 1. Prebuild Native Code
```bash
cd mobile
npx expo prebuild --platform android
```

This generates the `android/` directory with native code.

### 2. Build APK Locally
```bash
cd android
./gradlew assembleRelease
```

**Output Location**: `android/app/build/outputs/apk/release/app-release.apk`

### 3. Clean Local Build
```bash
cd android
./gradlew clean
```

---

## Environment Variables

The APK includes these environment variables from `eas.json`:

```json
{
  "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY": "pk_test_...",
  "EXPO_PUBLIC_API_URL": "https://nextalk-website.vercel.app",
  "EXPO_PUBLIC_SOCKET_URL": "https://nextalk-yuxo.onrender.com"
}
```

### Update for Production
Before building production APK, update these in `eas.json`:
1. Use production Clerk key (not test key)
2. Verify API URL points to production Vercel deployment
3. Verify Socket URL points to production socket server

---

## Build Status & Download

### Check Build Status
```bash
eas build:list --platform android
```

### View Specific Build
```bash
eas build:view <build-id>
```

### Download APK
After build completes, EAS provides a download link. You can also:

```bash
eas build:download <build-id>
```

Or download from: https://expo.dev/accounts/bosswire/projects/nextalk-mobile/builds

---

## Installing APK on Device

### Method 1: Direct Link
1. EAS provides a QR code and link after build
2. Open link on Android device
3. Download and install APK

### Method 2: ADB Install
```bash
adb install path/to/app.apk
```

### Method 3: File Transfer
1. Download APK to computer
2. Transfer to device via USB/email/cloud
3. Enable "Install from Unknown Sources" in device settings
4. Tap APK file to install

---

## Signing Configuration

### Current Setup
The app is configured with:
- **Package**: `com.nextalk.mobile`
- **Bundle Identifier (iOS)**: `com.nextalk.mobile`

### For Production (Google Play)
You'll need to set up app signing:

1. **Create Keystore** (if not exists)
```bash
eas credentials
```

2. **Select Android → Production → Set up credentials**

EAS will generate and manage signing keys for you.

---

## Google Services (Push Notifications)

The app references `google-services.json` for Firebase push notifications:
```json
"googleServicesFile": "./google-services.json"
```

### Setup Firebase
1. Go to https://console.firebase.google.com
2. Create project or use existing
3. Add Android app with package `com.nextalk.mobile`
4. Download `google-services.json`
5. Place in `mobile/` directory

**Without this file**: Push notifications won't work on Android.

---

## Build Troubleshooting

### Error: "No credentials found"
**Solution**: Run `eas credentials` to set up app signing

### Error: "google-services.json not found"
**Solution**: 
- Option 1: Add the file (recommended for push notifications)
- Option 2: Remove the reference from `app.json` temporarily

### Error: "Build timed out"
**Solution**: EAS free tier has time limits. Try again or upgrade.

### Error: "Out of build credits"
**Solution**: Check your Expo account - free tier has monthly limits.

---

## Testing the APK

### Test Checklist
- [ ] App launches successfully
- [ ] Authentication with Clerk works
- [ ] Can connect to socket server
- [ ] Can send/receive messages
- [ ] Image upload works
- [ ] Camera access works
- [ ] Push notifications work (if configured)
- [ ] Offline queue works
- [ ] Voice/video calls work

### Debug Build Issues
If the APK doesn't work:

1. **Check Logs**
```bash
adb logcat | grep -i nextalk
```

2. **Verify Environment Variables**
Check that API/Socket URLs are reachable from device

3. **Check Permissions**
Ensure all permissions are granted in device settings

---

## Build Artifacts

### APK Structure
```
app-release.apk
├── AndroidManifest.xml
├── classes.dex (app code)
├── resources.arsc
├── res/ (images, layouts)
├── lib/ (native libraries)
│   ├── arm64-v8a/
│   ├── armeabi-v7a/
│   └── x86_64/
└── META-INF/ (signatures)
```

### APK Size
Expected size: **50-70 MB** (includes React Native + Expo + native libraries)

To reduce size:
- Enable Hermes in `app.json`
- Use ProGuard/R8 minification
- Remove unused assets

---

## Continuous Deployment

### GitHub Actions (Future)
Create `.github/workflows/build-android.yml`:

```yaml
name: Build Android APK

on:
  push:
    branches: [main]
    paths:
      - 'mobile/**'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install EAS CLI
        run: npm install -g eas-cli
      
      - name: Build APK
        run: |
          cd mobile
          eas build --platform android --profile preview --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

---

## Quick Reference

### Common Commands
```bash
# Build preview APK
eas build -p android --profile preview

# Build production AAB
eas build -p android --profile production

# List builds
eas build:list

# View build logs
eas build:view <build-id>

# Download APK
eas build:download <build-id>

# Check credentials
eas credentials

# Cancel build
eas build:cancel <build-id>
```

---

## Support

### EAS Build Documentation
- https://docs.expo.dev/build/introduction/
- https://docs.expo.dev/build-reference/apk/

### Expo Forums
- https://forums.expo.dev/

### GitHub Issues
- Report issues in this repository

---

## Summary

**To build APK right now:**

```bash
cd mobile
eas login
eas build --platform android --profile preview
```

Wait 10-15 minutes, then download and install the APK!

**Current Configuration:**
- ✅ EAS Build configured
- ✅ Preview profile ready
- ✅ Environment variables set
- ⚠️ Google Services (optional, for push)
- ✅ Permissions configured
- ✅ Expo SDK 56
- ✅ React Native 0.85.3

---

**Build Status**: Ready to build  
**Last Updated**: 2024  
**Expo Project ID**: `fbc33a7b-aace-4b05-876d-7ac992217ec8`
