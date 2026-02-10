#!/bin/bash

# Quick test of build-and-serve script without actually building
# Use this to verify the script structure is correct

echo "🧪 Testing build-and-serve.sh script..."
echo ""

# Test 1: Check if scripts exist
echo "Test 1: Script files exist"
if [ -f "./build-and-serve.sh" ]; then
    echo "  ✅ build-and-serve.sh found"
else
    echo "  ❌ build-and-serve.sh NOT found"
    exit 1
fi

if [ -f "./stop-server.sh" ]; then
    echo "  ✅ stop-server.sh found"
else
    echo "  ❌ stop-server.sh NOT found"
    exit 1
fi

# Test 2: Check if scripts are executable
echo ""
echo "Test 2: Scripts are executable"
if [ -x "./build-and-serve.sh" ]; then
    echo "  ✅ build-and-serve.sh is executable"
else
    echo "  ❌ build-and-serve.sh is NOT executable"
    echo "  Run: chmod +x build-and-serve.sh"
    exit 1
fi

if [ -x "./stop-server.sh" ]; then
    echo "  ✅ stop-server.sh is executable"
else
    echo "  ❌ stop-server.sh is NOT executable"
    echo "  Run: chmod +x stop-server.sh"
    exit 1
fi

# Test 3: Check if pre-build-check exists
echo ""
echo "Test 3: Pre-build validation script"
if [ -f "./pre-build-check.sh" ]; then
    echo "  ✅ pre-build-check.sh found"
else
    echo "  ⚠️  pre-build-check.sh NOT found (optional)"
fi

# Test 4: Check Python HTTP server
echo ""
echo "Test 4: Python HTTP server available"
if command -v python3 &> /dev/null; then
    echo "  ✅ python3 found: $(python3 --version)"
else
    echo "  ❌ python3 NOT found (required for file server)"
    exit 1
fi

# Test 5: Check QR code generator
echo ""
echo "Test 5: QR code generators"
HAS_QR=false

if command -v qrencode &> /dev/null; then
    echo "  ✅ qrencode found (best option)"
    HAS_QR=true
fi

if command -v npx &> /dev/null; then
    echo "  ✅ npx found (can use qrcode-terminal)"
    HAS_QR=true
fi

if [ "$HAS_QR" = false ]; then
    echo "  ⚠️  No QR code generator found"
    echo "  Install: sudo apt-get install qrencode"
    echo "  Or: npm install -g qrcode-terminal"
    echo "  Script will still work but won't show QR code"
fi

# Test 6: Check Codespace environment
echo ""
echo "Test 6: Environment detection"
if [ -n "$CODESPACE_NAME" ]; then
    echo "  ✅ Running in GitHub Codespace"
    echo "  Codespace: $CODESPACE_NAME"
    echo "  URL will be: https://${CODESPACE_NAME}-8000.app.github.dev"
else
    echo "  ℹ️  Not in Codespace (local development)"
    echo "  URL will be: http://localhost:8000"
fi

# Test 7: Check port 8000 availability
echo ""
echo "Test 7: Port 8000 availability"
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "  ⚠️  Port 8000 is already in use"
    echo "  Run: ./stop-server.sh or kill the process"
else
    echo "  ✅ Port 8000 is available"
fi

# Test 8: Check Android build directory
echo ""
echo "Test 8: Android project structure"
if [ -d "./android" ]; then
    echo "  ✅ android/ directory found"
    if [ -f "./android/gradlew" ]; then
        echo "  ✅ gradlew found"
    else
        echo "  ⚠️  gradlew not found (run: npm run prebuild)"
    fi
else
    echo "  ⚠️  android/ directory not found"
    echo "  Run: npm run prebuild"
fi

# Summary
echo ""
echo "=========================================="
echo "✅ All critical tests passed!"
echo "=========================================="
echo ""
echo "Ready to build and serve!"
echo ""
echo "Next steps:"
echo "  1. Ensure all tests pass: npm test"
echo "  2. Run build and serve: ./build-and-serve.sh"
echo "  3. Scan QR code on phone"
echo "  4. Download and install APK"
echo "  5. Test PDF processing"
echo "  6. Stop server: ./stop-server.sh"
echo ""
