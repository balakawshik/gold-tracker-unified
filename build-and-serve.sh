#!/bin/bash

# Build APK and serve via Codespace with QR code
# No ADB connection needed - just scan and download!

set -e

# Set Java 17 for Android build compatibility
export JAVA_HOME=/usr/local/sdkman/candidates/java/17.0.18-amzn
export PATH=$JAVA_HOME/bin:$PATH

echo "=========================================="
echo "🚀 Build APK & Serve via Codespace"
echo "=========================================="
echo ""
echo "Using Java: $(java -version 2>&1 | head -1)"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in Codespace
if [ -z "$CODESPACE_NAME" ]; then
    echo -e "${YELLOW}⚠️  Warning: Not running in GitHub Codespace${NC}"
    echo "This script is optimized for Codespaces but will work locally too."
    echo ""
fi

# Step 1: Pre-build validation
echo -e "${BLUE}Step 1: Pre-build Validation${NC}"
if [ -f "./pre-build-check.sh" ]; then
    chmod +x ./pre-build-check.sh
    if ! ./pre-build-check.sh; then
        echo -e "${RED}❌ Pre-build checks failed!${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  pre-build-check.sh not found, skipping validation${NC}"
fi
echo ""

# Step 2: Run tests (already validated in pre-build)
echo -e "${BLUE}Step 2: Running Tests${NC}"
npm test -- --passWithNoTests || {
    echo -e "${RED}❌ Tests failed!${NC}"
    exit 1
}
echo ""

# Step 3: Generate native code (if needed)
echo -e "${BLUE}Step 3: Generate Native Code${NC}"
if [ ! -d "android/app/src/main/java/com/goldtracker/unified" ]; then
    echo "Running prebuild..."
    npx expo prebuild --platform android --clean
else
    echo "Native code already exists, skipping prebuild."
fi
echo ""

# Step 4: Build release APK
echo -e "${BLUE}Step 4: Building Release APK${NC}"
echo "This will take 5-10 minutes..."
cd android
./gradlew assembleRelease || {
    echo -e "${RED}❌ Build failed!${NC}"
    cd ..
    exit 1
}
cd ..
echo -e "${GREEN}✅ APK built successfully!${NC}"
echo ""

# Step 5: Copy APK to serve directory
echo -e "${BLUE}Step 5: Preparing APK for Download${NC}"
APK_SOURCE="android/app/build/outputs/apk/release/app-release.apk"
SERVE_DIR="./apk-download"
mkdir -p "$SERVE_DIR"

if [ -f "$APK_SOURCE" ]; then
    cp "$APK_SOURCE" "$SERVE_DIR/gold-tracker.apk"
    APK_SIZE=$(du -h "$APK_SOURCE" | cut -f1)
    echo -e "${GREEN}✅ APK ready: $APK_SIZE${NC}"
else
    echo -e "${RED}❌ APK not found at $APK_SOURCE${NC}"
    exit 1
fi
echo ""

# Create a simple HTML page for download
cat > "$SERVE_DIR/index.html" <<EOF
<!DOCTYPE html>
<html>
<head>
    <title>Gold Tracker APK Download</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            text-align: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            background: rgba(255,255,255,0.1);
            border-radius: 20px;
            padding: 40px;
            backdrop-filter: blur(10px);
        }
        h1 { margin-bottom: 10px; }
        .version { opacity: 0.8; margin-bottom: 30px; }
        .download-btn {
            display: inline-block;
            background: white;
            color: #667eea;
            padding: 15px 40px;
            border-radius: 50px;
            text-decoration: none;
            font-weight: bold;
            font-size: 18px;
            margin: 20px 0;
            transition: transform 0.2s;
        }
        .download-btn:hover {
            transform: scale(1.05);
        }
        .info {
            margin-top: 30px;
            font-size: 14px;
            opacity: 0.9;
        }
        .size {
            background: rgba(255,255,255,0.2);
            padding: 10px 20px;
            border-radius: 10px;
            display: inline-block;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📱 Gold Tracker</h1>
        <p class="version">Unified App v1.0</p>
        <div class="size">📦 Size: $APK_SIZE</div>
        <br>
        <a href="gold-tracker.apk" class="download-btn" download>
            ⬇️ Download APK
        </a>
        <div class="info">
            <p>✅ Native PDF Processing</p>
            <p>✅ Offline SQLite Database</p>
            <p>✅ Live Gold Rates</p>
            <p>✅ Charts & Analytics</p>
        </div>
        <div class="info" style="margin-top: 40px; opacity: 0.7;">
            <small>After download, you may need to enable "Install from Unknown Sources" in Android settings.</small>
        </div>
    </div>
</body>
</html>
EOF

echo -e "${GREEN}✅ Download page created${NC}"
echo ""

# Step 6: Start file server
echo -e "${BLUE}Step 6: Starting File Server${NC}"
PORT=8000

# Kill any existing server on this port
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true

# Start Python HTTP server in background
cd "$SERVE_DIR"
python3 -m http.server $PORT > /dev/null 2>&1 &
SERVER_PID=$!
cd ..

# Wait for server to start
sleep 2

if ! ps -p $SERVER_PID > /dev/null; then
    echo -e "${RED}❌ Failed to start server${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Server running on port $PORT (PID: $SERVER_PID)${NC}"
echo ""

# Step 7: Get Codespace URL and generate QR code
echo "=========================================="
echo -e "${GREEN}✅ BUILD COMPLETE!${NC}"
echo "=========================================="
echo ""

# Forward port 8000 as public
if [ -n "$CODESPACE_NAME" ]; then
    echo "Making port 8000 public..."
    gh codespace ports visibility 8000:public -c "$CODESPACE_NAME" >/dev/null 2>&1 || true
fi

if [ -n "$CODESPACE_NAME" ]; then
    # In Codespace - use the forwarded URL
    DOWNLOAD_URL="https://${CODESPACE_NAME}-${PORT}.app.github.dev/"
    echo -e "${BLUE}📱 Download URL:${NC}"
    echo -e "${YELLOW}$DOWNLOAD_URL${NC}"
else
    # Local - use localhost
    DOWNLOAD_URL="http://localhost:${PORT}/"
    echo -e "${BLUE}📱 Local URL:${NC}"
    echo -e "${YELLOW}$DOWNLOAD_URL${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}📱 SCAN THIS QR CODE ON YOUR PHONE${NC}"
echo "=========================================="
echo ""
echo "Or manually open this URL on your phone:"
echo ""
echo "  $DOWNLOAD_URL"
echo ""

# Generate simple ASCII QR with Python (no npm install needed)
python3 -c "
import sys
try:
    import qrcode
    qr = qrcode.QRCode(border=1)
    qr.add_data('$DOWNLOAD_URL')
    qr.print_ascii(invert=True)
except ImportError:
    print('QR code not available. Please install: pip3 install qrcode')
    print('Or just open the URL above on your phone browser.')
" 2>/dev/null || echo ""

echo ""
echo "=========================================="
echo -e "${BLUE}📋 INSTALLATION INSTRUCTIONS${NC}"
echo "=========================================="
echo ""
echo "1. Scan QR code above with your phone camera"
echo "2. Open the link in your browser"
echo "3. Tap '⬇️ Download APK' button"
echo "4. Wait for download to complete"
echo "5. Open the downloaded file"
echo "6. Tap 'Install' (may need to enable 'Unknown Sources')"
echo "7. Open 'Gold Tracker' app"
echo "8. Upload PDF → Process → Done! 🎉"
echo ""
echo "=========================================="
echo -e "${YELLOW}⚡ SERVER RUNNING${NC}"
echo "=========================================="
echo ""
echo "Server PID: $SERVER_PID"
echo "Port: $PORT"
echo "Directory: $SERVE_DIR"
echo ""
echo -e "${YELLOW}To stop server:${NC}"
echo "  kill $SERVER_PID"
echo ""
echo -e "${YELLOW}To rebuild and serve again:${NC}"
echo "  ./build-and-serve.sh"
echo ""
echo "Press Ctrl+C to stop server and exit"
echo ""

# Save PID for easy cleanup
echo $SERVER_PID > .server.pid

# Keep script running
wait $SERVER_PID
