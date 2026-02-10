# Gold Tracker Unified

A production-ready React Native mobile app for tracking gold transactions from PhonePe PDF statements. Features native Android PDF processing with Apache PDFBox for reliable extraction of transaction data.

## 🎯 Key Features

- 📄 **Native PDF Processing** - Apache PDFBox handles compressed PhonePe PDFs
- 💾 **Offline-First** - SQLite database for persistent local storage  
- 📊 **Analytics & Charts** - Visualize gold purchases, sales, and profit/loss
- 🔄 **Duplicate Detection** - Handles overlapping reports (30/60/90/365 days)
- 📱 **No Device Connection Required** - QR code download for easy deployment
- 🧪 **80%+ Test Coverage** - Comprehensive unit tests before every build

## 📋 Tech Stack

- **Frontend**: React Native 0.81.5 with Expo SDK 54
- **Navigation**: React Navigation (Bottom Tabs)
- **Storage**: expo-sqlite (SQLite database)
- **Charts**: react-native-chart-kit with react-native-svg
- **Native Modules**: 
  - PdfProcessor (Apache PDFBox 2.0.27)
  - FileSystemModule (Android file operations)
- **Testing**: Jest with React Native Testing Library
- **Build**: Gradle 8.14.3, Java 17, Android SDK 36

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Java 17+ (for Android builds)
- Android SDK (automatically managed by Expo)
- Phone with Expo Go app installed

### Installation

```bash
# Clone and setup
cd gold-tracker-unified
chmod +x setup.sh
./setup.sh
```

This installs all dependencies and prepares the development environment.

## 💻 Development Workflow

### Daily Development (No Device Connection Needed!)

```bash
# Start Expo with tunnel for remote access
npm run start:tunnel
```

**Then:**
1. Open Expo Go app on your phone
2. Scan the QR code displayed in terminal
3. App loads with live reload enabled
4. Make changes → Save → See updates instantly!

**What works in Expo Go:**
- ✅ All UI/UX testing
- ✅ Navigation between screens
- ✅ Data display and charts
- ✅ SQLite database operations
- ✅ All app functionality except PDF upload

**What requires native build:**
- ❌ PDF processing (native module required)

**Development is 99% done in Expo Go** - Only build when ready to test PDF processing!

### Run Tests

```bash
# Run all tests
npm test

# Watch mode (auto-rerun on changes)
npm run test:watch

# Coverage report
npm run test:coverage
```

All tests must pass before building APK.

## 📦 Building & Deployment

### One-Command Build & Serve

```bash
# Build APK and start download server
chmod +x build-and-serve.sh
./build-and-serve.sh
```

**What this does:**
1. ✅ Runs all unit tests (must pass)
2. ✅ Validates build requirements  
3. ✅ Builds release APK with native modules (~10 minutes)
4. ✅ Starts HTTP server on port 8000
5. ✅ Generates QR code in terminal
6. ✅ Displays download URL

**Install on Phone (NO USB CABLE NEEDED!):**
1. Scan QR code with phone camera
2. Opens download page in browser
3. Tap "Download APK" button
4. Install when download completes
5. Open app and test PDF upload!

**APK Location:** `android/app/build/outputs/apk/release/app-release.apk` (~85MB)

### Stop Server When Done

```bash
./stop-server.sh
```

### Alternative: ADB Installation

If you prefer USB connection:

```bash
# Connect device via USB
adb devices

# Install APK
adb install android/app/build/outputs/apk/release/app-release.apk
```

## 📱 Using the App

### 1. Upload Screen
- Select folder containing PhonePe PDF statements
- Scans for PDF files
- Shows file status (new, modified, processed)
- Select files to process
- Batch processes selected PDFs

**Key Features:**
- Detects duplicates by Transaction ID
- Handles overlapping reports (30/60/90/365 days)
- Tracks processed files to avoid rescanning
- Shows processing logs in real-time

### 2. Data Load Screen
- View all transactions from database
- Import CSV files (with duplicate detection)
- Quick statistics (buys, sells, total gold, amount)
- Search and filter transactions

### 3. Insights Screen
- Average buy/sell rates
- Total gold holdings
- Realized and unrealized profit/loss
- Filter by year, month, or date
- Calendar view for date selection

### 4. Charts Screen
- Daily/monthly buy/sell volume (grams)
- Daily/monthly buy/sell amount (₹)
- Visual trends over time
- Filter by all time, week, month, year

### 5. Live Rates Screen
- Current gold rates
- Market trends
- Real-time updates

## 🏗️ Project Structure

```
gold-tracker-unified/
├── App.js                          # Main app with navigation
├── src/
│   ├── components/
│   │   └── ProcessingLogModal.js  # Real-time processing logs
│   ├── screens/                    # 5 main screens
│   │   ├── UploadScreen.js        # PDF upload & batch processing
│   │   ├── DataLoadScreen.js      # View all transactions
│   │   ├── InsightsScreen.js      # Analytics & P/L
│   │   ├── ChartsScreen.js        # Visualizations
│   │   └── LiveRatesScreen.js     # Current gold rates
│   └── services/                   # Business logic layer
│       ├── PdfProcessor.js         # JavaScript bridge to native
│       ├── DataStorage.js          # SQLite operations
│       ├── CsvManager.js           # CSV import/export
│       ├── FileTracker.js          # Manifest & deduplication
│       ├── FolderManager.js        # Android file system
│       └── __tests__/              # Unit tests
├── android/
│   └── app/src/main/java/com/goldtracker/unified/
│       ├── PdfProcessorModule.java # Native PDF extraction
│       └── FileSystemModule.java   # Native file operations
├── build-and-serve.sh              # Build & deploy script
├── stop-server.sh                  # Stop server script
├── setup.sh                        # Initial setup script
└── pre-build-check.sh              # Pre-build validation
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed technical documentation.

## 🧪 Testing

### Unit Tests
- All services have comprehensive test coverage
- Tests run automatically before builds
- Minimum 80% coverage enforced

### Manual Testing Checklist

Before building APK, verify:
- [ ] All unit tests pass (`npm test`)
- [ ] Tested with Expo Go on real device
- [ ] All 5 screens navigate correctly
- [ ] Data persists after app restart
- [ ] Charts render without errors
- [ ] No console errors in development

After building APK, test:
- [ ] Upload PhonePe PDF successfully
- [ ] Transactions extracted correctly (Buy=DEBIT, Sell=CREDIT)
- [ ] Duplicate PDFs don't create duplicate transactions
- [ ] CSV import works with duplicate detection
- [ ] All analytics calculate correctly

## 🐛 Troubleshooting

### "Native module not found" in Expo Go
**Expected!** Native modules only work in built APK. For PDF processing, run `./build-and-serve.sh`.

### Tests failing
```bash
npm test -- --clearCache
npm test
```

### PDF processing failed in APK
Check:
1. Is it a valid PhonePe gold statement PDF?
2. Check logcat for specific errors: `adb logcat | grep PdfProcessor`
3. Ensure PDF is not password-protected

### Build fails
```bash
# Clean and rebuild
cd android
./gradlew clean
cd ..
npm run android
```

### QR code not displaying
Install QR code generator:
```bash
sudo apt-get install qrencode
# OR
npm install -g qrcode-terminal
```

## 📚 Additional Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical architecture and data flow
- [BUILD_AND_SERVE_GUIDE.md](BUILD_AND_SERVE_GUIDE.md) - Detailed build process
- [NO_DEVICE_WORKFLOW.md](NO_DEVICE_WORKFLOW.md) - Development without device connection
- [TESTING_GUIDE.md](TESTING_GUIDE.md) - Comprehensive testing guide
- [PDF_PROCESSING.md](PDF_PROCESSING.md) - How PDF extraction works

## 🔧 Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo dev server (local network) |
| `npm run start:tunnel` | Start with tunnel (remote access) |
| `npm test` | Run all unit tests |
| `npm run test:watch` | Auto-run tests on changes |
| `npm run test:coverage` | Generate coverage report |
| `npm run android` | Build and run on connected device |
| `npm run prebuild` | Generate native Android project |
| `./build-and-serve.sh` | Build APK + start download server |
| `./stop-server.sh` | Stop download server |
| `./setup.sh` | Initial project setup |

## 🎯 Development Tips

1. **Use Expo Go for 99% of development** - It's instant and doesn't require builds
2. **Build once per day** - Only when you need to test PDF processing
3. **Run tests continuously** - Use `npm run test:watch` during development
4. **Test before building** - Ensure everything works in Expo Go first
5. **Use QR code deployment** - No ADB connection needed!

## 📄 License

Private project for Deloitte US Consulting.

## 🤝 Contributing

Follow the org-wide instructions in `.vscode/github/deloitte-us-consulting/instructions/default.instructions.md`:
- TDD approach (write tests first)
- 80%+ coverage required
- DRY principles
- Comprehensive error handling
- Update documentation with changes

---

**Built with ❤️ using React Native + Expo + Apache PDFBox**
