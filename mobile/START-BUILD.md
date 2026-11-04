# Start Mobile APK Build

## Quick Start

**The dependency installation had issues. To fix and build:**

```powershell
cd mobile

# Clean and fresh install
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install --legacy-peer-deps

# Then build
eas build --platform android --profile preview
```

## Build Status

- **Project**: `nextalk-mobile` (ID: `fbc33a7b-aace-4b05-876d-7ac992217ec8`)
- **Account**: `bosswire`
- **Profile**: `preview` (APK build)

## What Was Fixed

1. ✅ Embedded `packages/crypto` locally (`./packages/crypto`)
2. ✅ Fixed `react-native-reanimated` version to `~4.0.0`
3. ✅ Added `.easignore` to optimize upload
4. ⚠️ Node modules installation needs completion

## Monitor Build

Once started, monitor at:
```
https://expo.dev/accounts/bosswire/projects/nextalk-mobile/builds
```

Or watch in terminal - build takes ~15 minutes.

## Download APK

After build completes, get the APK from the Expo dashboard or the download link provided in terminal.

## Troubleshooting

If `expo-router` errors persist:
```powershell
npm install @expo/schema-utils --save-dev --legacy-peer-deps
```
