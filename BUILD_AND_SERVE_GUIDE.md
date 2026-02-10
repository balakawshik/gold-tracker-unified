# Build & Serve Workflow - QR Code APK Distribution

## 🎯 Problem Solved

**Before**: Connect device via ADB → Install APK → Disconnect → Test  
**Now**: Build → Scan QR Code → Download → Install → Test

**No ADB connection needed!** Apps installs via browser download.

## 🚀 How It Works

### 1. Build & Serve Command

```bash
./build-and-serve.sh
```

**What happens:**

1. **Validates Everything**
   - Runs all unit tests (must pass 80%+ coverage)
   - Runs pre-build checks (expo-doctor, etc.)
   - Ensures build requirements met

2. **Builds Release APK**
   - Generates native Android code
   - Compiles with Apache PDFBox included
   - Creates optimized release APK (~10 minutes)

3. **Starts File Server**
   - Creates `apk-download/` directory
   - Copies APK as `gold-tracker.apk`
   - Generates beautiful download page
   - Starts Python HTTP server on port 8000
   - Codespace auto-forwards port publicly

4. **Displays QR Code**
   - Generates QR code in terminal
   - Shows Codespace public URL
   - Provides download instructions

### 2. Install on Phone

```
1. Scan QR code (displayed in terminal)
2. Opens browser on phone
3. See beautiful download page
4. Tap "Download APK" button
5. Wait for download to complete
6. Tap downloaded file
7. Enable "Unknown Sources" if prompted
8. Tap "Install"
9. Open "Gold Tracker" app
10. Upload PDF and test!
```

**No USB cable needed!**  
**No ADB needed!**  
**Works from anywhere!**

## 📋 Technical Details

### File Server

- **Technology**: Python `http.server` (built-in)
- **Port**: 8000
- **Directory**: `./apk-download/`
- **Files Served**:
  - `index.html` - Beautiful download page
  - `gold-tracker.apk` - The actual APK file

### Codespace Port Forwarding

GitHub Codespaces automatically forwards ports and provides public URLs:

```
Local: http://localhost:8000
Public: https://{codespace-name}-8000.app.github.dev
```

The script detects Codespace environment (`$CODESPACE_NAME`) and uses the public URL.

### QR Code Generation

**Priority order:**
1. `qrencode` (if installed) - Best quality
2. `npx qrcode-terminal` - Node.js based
3. URL display only (fallback)

Install QR code generator:
```bash
# Option 1: System package
sudo apt-get install qrencode

# Option 2: Node.js package (already handled by npx)
npm install -g qrcode-terminal
```

### Download Page Features

- 📱 Mobile-optimized responsive design
- 🎨 Beautiful gradient background
- 📦 Shows APK file size
- ✅ Lists app features
- ⚠️ Installation instructions
- 🔒 HTTPS via Codespace

## 🔄 Full Workflow

### Development Phase (All Day)
```bash
# Start Expo with tunnel
npm run start:tunnel

# Develop with live reload
# NO device connection needed
# NO builds needed
```

### Deployment Phase (Once Per Day)
```bash
# Build and serve
./build-and-serve.sh

# Output shows:
# ✅ Tests passed
# ✅ APK built
# ✅ Server started
# 📱 QR code displayed
# 🔗 URL shown

# On phone:
# 1. Scan QR code
# 2. Download APK
# 3. Install
# 4. Test PDF processing

# When done testing:
./stop-server.sh
```

## 📊 Comparison: Old vs New

| Aspect | Old Way (ADB) | New Way (QR Code) |
|--------|--------------|-------------------|
| **Connection** | USB cable required | Wireless |
| **Setup** | Enable USB debugging | None |
| **Install** | `adb install` command | Tap and install |
| **Location** | Phone must be near computer | Works anywhere |
| **Network** | Same network or USB | Any network |
| **Steps** | 5+ commands | Scan → Download → Install |
| **Complexity** | Medium | Easy |
| **User Friendly** | Tech-savvy only | Anyone can do it |

## 🎯 Benefits

### For You (Developer)
- ✅ No ADB setup needed
- ✅ No USB cable juggling
- ✅ Works in Codespace (cloud environment)
- ✅ Can send link to testers
- ✅ Multiple people can download same build
- ✅ Build once, distribute to many

### For Testers
- ✅ Simple scan and install
- ✅ Beautiful download page
- ✅ Clear instructions
- ✅ See app features before download
- ✅ Know exactly what they're installing

### For Process
- ✅ Matches "1 deploy per day" constraint
- ✅ Extensive validation before build
- ✅ Easy distribution
- ✅ Reproducible builds
- ✅ Server can run while you work on other things

## 🐛 Troubleshooting

### QR Code Not Displaying
```bash
# Install QR code generator
sudo apt-get update
sudo apt-get install qrencode

# OR use Node.js version
npx qrcode-terminal "your-url-here"
```

### Server Won't Start (Port Conflict)
```bash
# Kill existing server
./stop-server.sh

# Or manually
lsof -ti:8000 | xargs kill -9

# Then rebuild
./build-and-serve.sh
```

### Can't Download on Phone
- Check if URL is HTTPS (Codespace forwards as HTTPS)
- Try copying URL manually if QR code doesn't work
- Make sure phone has internet connection
- Check Codespace port visibility (should be Public)

### Build Fails
```bash
# Check logs
cd android
./gradlew assembleRelease --stacktrace

# Common fixes
npm test  # Ensure tests pass first
./pre-build-check.sh  # Check requirements
npm install  # Reinstall dependencies
```

### "Unknown Sources" Warning
On Android:
1. Settings → Security
2. Enable "Unknown Sources" or "Install from Unknown Sources"
3. Or allow just for your browser app

## 📝 Server Management

### Start Server Manually
```bash
cd apk-download
python3 -m http.server 8000
```

### Check Server Status
```bash
# Check if running
ps aux | grep "http.server"

# Check port
lsof -i:8000

# Test locally
curl http://localhost:8000
```

### View Server Logs
```bash
# Server logs go to console where build-and-serve.sh runs
# To see live logs:
tail -f /tmp/apk-server.log  # If you redirect output
```

### Stop Server
```bash
# Graceful stop
./stop-server.sh

# Force kill
kill $(cat .server.pid)

# Nuclear option
pkill -f "http.server"
```

## 🔐 Security Considerations

### Safe for Internal Use
- ✅ Codespace URLs are unique and hard to guess
- ✅ Server only runs when you start it
- ✅ You control when to stop server
- ✅ APK is signed with your key

### Not for Public Distribution
- ⚠️ Codespace URLs can be accessed by anyone with link
- ⚠️ No authentication on file server
- ⚠️ Server stops when Codespace stops

### Best Practices
- 🔒 Stop server after installation (./stop-server.sh)
- 🔒 Don't share QR code/URL publicly
- 🔒 Use for internal testing only
- 🔒 For production, use Google Play Store

## 🎓 Advanced Usage

### Build Without Server
```bash
# Just build APK
cd android
./gradlew assembleRelease

# APK location
ls -lh app/build/outputs/apk/release/app-release.apk
```

### Custom Port
```bash
# Edit build-and-serve.sh
PORT=9000  # Change this line
```

### Multiple Versions
```bash
# Keep multiple APKs
cd apk-download
cp gold-tracker.apk gold-tracker-v1.0.apk
cp gold-tracker.apk gold-tracker-v1.1.apk

# Update index.html to show versions
```

### Auto-Stop Server After Time
```bash
# Add to build-and-serve.sh
(sleep 3600 && ./stop-server.sh) &  # Stop after 1 hour
```

## ✅ Quick Reference

```bash
# Build and serve (ONE COMMAND!)
./build-and-serve.sh

# Stop server
./stop-server.sh

# Rebuild
./stop-server.sh && ./build-and-serve.sh

# Check server
ps aux | grep http.server

# Server URL (in Codespace)
echo "https://${CODESPACE_NAME}-8000.app.github.dev"
```

---

**Bottom Line**: Build once, scan QR code, install from browser. No ADB needed! 📱✨
