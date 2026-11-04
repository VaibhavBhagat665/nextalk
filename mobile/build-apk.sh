#!/bin/bash
# NexTalk Mobile - Android APK Build Script
# Usage: ./build-apk.sh [preview|production]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 NexTalk Mobile - Android APK Builder${NC}"
echo ""

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo -e "${RED}❌ EAS CLI not found${NC}"
    echo "Installing EAS CLI..."
    npm install -g eas-cli
fi

# Check if logged in
if ! eas whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Expo${NC}"
    echo "Please login:"
    eas login
fi

echo -e "${GREEN}✅ Logged in as:${NC} $(eas whoami)"
echo ""

# Get build profile (default to preview)
PROFILE=${1:-preview}

if [ "$PROFILE" != "preview" ] && [ "$PROFILE" != "production" ]; then
    echo -e "${RED}❌ Invalid profile: $PROFILE${NC}"
    echo "Usage: ./build-apk.sh [preview|production]"
    exit 1
fi

echo -e "${GREEN}📦 Building Android $PROFILE...${NC}"
echo ""

# Navigate to mobile directory if not already there
if [ ! -f "app.json" ]; then
    if [ -d "mobile" ]; then
        cd mobile
    else
        echo -e "${RED}❌ Cannot find mobile directory${NC}"
        exit 1
    fi
fi

# Run the build
echo -e "${YELLOW}⏳ Starting EAS Build (this will take 10-15 minutes)...${NC}"
echo ""

eas build --platform android --profile "$PROFILE"

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Build completed successfully!${NC}"
    echo ""
    echo "📥 Download your APK:"
    echo "   1. Check the link above"
    echo "   2. Or run: eas build:list"
    echo "   3. Or visit: https://expo.dev/accounts/bosswire/projects/nextalk-mobile/builds"
    echo ""
    echo "📱 Install on device:"
    echo "   - Scan QR code from build output"
    echo "   - Or download APK and transfer to device"
    echo "   - Enable 'Install from Unknown Sources' in settings"
else
    echo ""
    echo -e "${RED}❌ Build failed${NC}"
    echo "Check the error messages above"
    exit 1
fi
