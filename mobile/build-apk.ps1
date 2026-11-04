# NexTalk Mobile - Android APK Build Script (PowerShell)
# Usage: .\build-apk.ps1 [preview|production]

param(
    [string]$Profile = "preview"
)

Write-Host "🚀 NexTalk Mobile - Android APK Builder" -ForegroundColor Green
Write-Host ""

# Check if EAS CLI is installed
$easInstalled = Get-Command eas -ErrorAction SilentlyContinue
if (-not $easInstalled) {
    Write-Host "❌ EAS CLI not found" -ForegroundColor Red
    Write-Host "Installing EAS CLI..."
    npm install -g eas-cli
}

# Check if logged in
$whoami = eas whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Not logged in to Expo" -ForegroundColor Yellow
    Write-Host "Please login:"
    eas login
    $whoami = eas whoami
}

Write-Host "✅ Logged in as: $whoami" -ForegroundColor Green
Write-Host ""

# Validate profile
if ($Profile -ne "preview" -and $Profile -ne "production") {
    Write-Host "❌ Invalid profile: $Profile" -ForegroundColor Red
    Write-Host "Usage: .\build-apk.ps1 [preview|production]"
    exit 1
}

Write-Host "📦 Building Android $Profile..." -ForegroundColor Green
Write-Host ""

# Navigate to mobile directory if not already there
if (-not (Test-Path "app.json")) {
    if (Test-Path "mobile") {
        Set-Location mobile
    } else {
        Write-Host "❌ Cannot find mobile directory" -ForegroundColor Red
        exit 1
    }
}

# Run the build
Write-Host "⏳ Starting EAS Build (this will take 10-15 minutes)..." -ForegroundColor Yellow
Write-Host ""

eas build --platform android --profile $Profile

# Check exit code
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Build completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📥 Download your APK:"
    Write-Host "   1. Check the link above"
    Write-Host "   2. Or run: eas build:list"
    Write-Host "   3. Or visit: https://expo.dev/accounts/bosswire/projects/nextalk-mobile/builds"
    Write-Host ""
    Write-Host "📱 Install on device:"
    Write-Host "   - Scan QR code from build output"
    Write-Host "   - Or download APK and transfer to device"
    Write-Host "   - Enable 'Install from Unknown Sources' in settings"
} else {
    Write-Host ""
    Write-Host "❌ Build failed" -ForegroundColor Red
    Write-Host "Check the error messages above"
    exit 1
}
