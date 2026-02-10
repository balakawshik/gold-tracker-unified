#!/bin/bash

###############################################################################
# Gold Tracker Unified - Setup Script
# Installs dependencies and prepares the development environment
###############################################################################

set -e  # Exit on error

echo "======================================================================"
echo "Gold Tracker Unified - Setup Script"
echo "======================================================================"
echo ""

# Check Node.js installation
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js version: $NODE_VERSION"

# Check npm installation
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

NPM_VERSION=$(npm -v)
echo "✅ npm version: $NPM_VERSION"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Check for Expo CLI
if ! command -v expo &> /dev/null; then
    echo ""
    echo "📱 Installing Expo CLI globally..."
    npm install -g expo-cli
fi

echo ""
echo "✅ Expo CLI installed"

# Check for EAS CLI (for builds)
if ! command -v eas &> /dev/null; then
    echo ""
    echo "🏗️  Installing EAS CLI for building..."
    npm install -g eas-cli
fi

echo ""
echo "✅ EAS CLI installed"

# Create test data directory
echo ""
echo "📁 Creating test data directory..."
mkdir -p test-data

echo ""
echo "======================================================================"
echo "✅ Setup Complete!"
echo "======================================================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Testing with Expo Go (Live Preview):"
echo "   npm start"
echo "   Then scan the QR code with Expo Go app on your Android device"
echo ""
echo "2. Run Unit Tests:"
echo "   npm test"
echo ""
echo "3. Build for Device (Development Build):"
echo "   npm run prebuild"
echo "   npm run android"
echo ""
echo "4. Build APK (Once per day):"
echo "   npm run build:local"
echo ""
echo "📖 See README.md for detailed usage instructions"
echo ""
