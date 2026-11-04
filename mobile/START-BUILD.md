# 🚀 Start Your Android APK Build NOW

## Current Status
✅ EAS CLI installed (version 20.2.0 available)  
❌ Not logged in to Expo  

---

## Step 1: Login to Expo (Required - One Time)

Open PowerShell in the `mobile` directory and run:

```powershell
cd "C:\Users\DELL\Desktop\projects\nextalk\mobile"
eas login
```

**You'll be prompted for:**
- Email/Username
- Password

**Don't have an Expo account?** 
- Option 1: Create one at https://expo.dev/signup
- Option 2: Login with GitHub: `eas login --github`

---

## Step 2: Start the Build

After logging in, run:

```powershell
eas build --platform android --profile preview
```

**What happens:**
1. ✅ Validates your configuration
2. ✅ Uploads your code to EAS servers
3. ⏳ Builds APK (10-15 minutes)
4. 📥 Provides download link

---

## Alternative: Quick One-Liner

```powershell
cd "C:\Users\DELL\Desktop\projects\nextalk\mobile" ; eas login ; eas build --platform android --profile preview
```

This will:
1. Navigate to mobile directory
2. Login (if needed)
3. Start build immediately

---

## Expected Output

### During Login:
```
? Email or username: your-email@example.com
? Password: ********
✔ Logged in
```

### During Build:
```
✔ Build type: apk
✔ Using profile: preview
✔ Uploading...
✔ Queued

Build Details:
https://expo.dev/accounts/bosswire/projects/nextalk-mobile/builds/xxxxxx

⏳ Waiting for build to complete...
```

### After Build:
```
✔ Build finished

Install URL: https://expo.dev/artifacts/eas/xxxxx.apk
QR Code: [Scan with device]

Download: eas build:download <build-id>
```

---

## Option: Use GitHub Login (Easier)

```powershell
eas login --github
```

This opens GitHub OAuth - no need to create separate Expo account!

---

## Troubleshooting

### "Command not found: eas"
Install EAS CLI:
```powershell
npm install -g eas-cli
```

### "Not enough build credits"
- Free tier: 30 builds/month
- Check: https://expo.dev/accounts/settings/billing

### "Project not configured"
Already configured! Project ID: `fbc33a7b-aace-4b05-876d-7ac992217ec8`

---

## After Build Completes

### Download APK
Three ways:
1. **Click the link** in terminal output
2. **Scan QR code** with Android device
3. **Download later**: `eas build:list` then `eas build:download <id>`

### Install on Device
1. Enable "Install from Unknown Sources" (Android settings)
2. Transfer APK to device
3. Tap to install
4. Grant permissions when prompted

---

## Ready to Build?

### Quick Copy-Paste:
```powershell
cd "C:\Users\DELL\Desktop\projects\nextalk\mobile"
eas login
eas build --platform android --profile preview
```

**That's it!** 🎉

Your APK will be ready in ~15 minutes!

---

**Current Time**: Ready to start  
**Build Duration**: 10-15 minutes  
**Cost**: Free (uses Expo free tier credits)  
**Output**: `.apk` file ready to install
