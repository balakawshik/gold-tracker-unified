# Testing Guide - Gold Tracker Unified

Complete guide for testing the application before deployment.

## 🎯 Testing Philosophy

**Goal**: Catch ALL errors before building APK, since you can only deploy once per day.

**Strategy**:
1. Comprehensive unit tests (80%+ coverage)
2. Live testing with Expo Go (instant feedback)
3. Manual validation checklist
4. Pre-build automated checks

## 🧪 Unit Testing

### Running Tests

```bash
# Run all tests
npm test

# Watch mode (auto-rerun on changes)
npm run test:watch

# Coverage report
npm run test:coverage

# Specific test file
npm test DataStorage.test.js
```

### Coverage Requirements

Minimum 80% coverage on:
- Branches
- Functions  
- Lines
- Statements

Coverage is enforced on:
- All files in `src/`
- Excluding `__tests__` directories
- Excluding `*.test.js` files

### Writing New Tests

Create tests in `__tests__` directory next to source:

```javascript
// src/services/__tests__/MyService.test.js

import MyService from '../MyService';

describe('MyService', () => {
  describe('myFunction', () => {
    it('should handle valid input', () => {
      const result = MyService.myFunction('valid');
      expect(result).toBe('expected');
    });

    it('should handle invalid input', () => {
      expect(() => {
        MyService.myFunction(null);
      }).toThrow('Invalid input');
    });

    it('should handle edge cases', () => {
      // Test edge cases...
    });
  });
});
```

### Test Best Practices

✅ **DO:**
- Test both success and failure paths
- Test edge cases (null, undefined, empty, very large)
- Mock external dependencies
- Use descriptive test names
- Keep tests fast (<100ms each)
- Test behavior, not implementation

❌ **DON'T:**
- Test implementation details
- Write tests that depend on other tests
- Use real database/network in unit tests
- Hardcode timeouts
- Skip error cases

## 📱 Live Testing with Expo Go

### Setup

1. **Install Expo Go** on Android device from Play Store

2. **Start dev server**:
```bash
npm start
```

3. **Connect device**:
   - Same WiFi: Scan QR code
   - Different network: Use tunnel mode
     ```bash
     npx expo start --tunnel
     ```

### What to Test

#### 1. PDF Upload Flow

- [ ] Tap "Select PDF File"
- [ ] Document picker opens correctly
- [ ] Select a PhonePe PDF statement
- [ ] Processing spinner appears
- [ ] Status updates during processing
- [ ] Success message shows extracted count
- [ ] Navigate to "Data" tab - transactions appear
- [ ] Upload same file again - duplicates correctly ignored

**Expected behavior**:
- Processing takes 2-10 seconds depending on PDF size
- All transactions extracted completely
- No crashes or freezes

#### 2. Data Persistence

- [ ] Upload transactions
- [ ] Force close app (swipe away)
- [ ] Reopen app
- [ ] Data still present

**Expected behavior**:
- All uploaded data persists
- Statistics remain accurate
- No data loss

#### 3. Data View Screen

- [ ] Transactions list displays
- [ ] Scroll performance is smooth
- [ ] Transaction details accurate
- [ ] Pull to refresh works
- [ ] Filter/search works (if implemented)

#### 4. Insights Screen

- [ ] Statistics calculate correctly
- [ ] Total purchases/sales accurate
- [ ] Total weight calculation correct
- [ ] Date range filtering works
- [ ] No crashes with large datasets

#### 5. Charts Screen

- [ ] Charts render without errors
- [ ] Data points accurate
- [ ] Touch interactions work
- [ ] Different time ranges work
- [ ] No performance issues

#### 6. Live Rates Screen

- [ ] Displays gold rates
- [ ] Updates periodically (if live)
- [ ] Calculations accurate

#### 7. Error Handling

Test these error scenarios:

- [ ] Upload non-PDF file → Clear error message
- [ ] Upload corrupted PDF → Graceful failure
- [ ] Upload PDF without gold transactions → Appropriate message
- [ ] Network disconnected (if applicable) → Works offline
- [ ] Low storage → Appropriate warning

### Performance Testing

Monitor these metrics during testing:

1. **App Launch Time**: Should be <3 seconds
2. **PDF Processing**: <10 seconds for 100-page PDF
3. **List Scrolling**: Smooth 60 FPS
4. **Navigation**: Instant tab switching

Use React DevTools to monitor:
```bash
npm install -g react-devtools
react-devtools
```

## 🔍 Manual Validation Checklist

Before building APK, manually verify:

### Functionality
- [ ] All tabs accessible
- [ ] PDF upload works with multiple files
- [ ] Data persists across app restarts
- [ ] All calculations accurate
- [ ] Charts render correctly
- [ ] Error messages clear and helpful

### UI/UX
- [ ] No UI glitches or overlaps
- [ ] Text readable on all screens
- [ ] Buttons have proper touch targets
- [ ] Loading states visible
- [ ] Success/error feedback clear
- [ ] Navigation intuitive

### Performance
- [ ] No lag when scrolling
- [ ] Smooth animations
- [ ] Fast tab switching
- [ ] Quick PDF processing
- [ ] No memory leaks (test by using app for 10+ minutes)

### Error Cases
- [ ] Invalid PDF handled gracefully
- [ ] Empty state displayed when no data
- [ ] Network errors handled (if applicable)
- [ ] Permission errors handled
- [ ] Storage full scenarios

## 🤖 Pre-Build Automated Checks

Run before every build:

```bash
./pre-build-check.sh
```

This validates:

1. **Unit Tests**: All pass with 80%+ coverage
2. **Linting**: No errors, minimal warnings
3. **Dependencies**: All installed correctly
4. **Required Files**: All present
5. **Android Config**: PDFBox dependency configured
6. **Native Module**: Java files present

**DO NOT BUILD** unless this script passes!

## 🔄 ADB Testing

Test with device connected via USB:

### Setup
```bash
# Check device connected
adb devices

# Should show:
# List of devices attached
# ABC123XYZ    device

# Forward ports
adb reverse tcp:8081 tcp:8081
adb reverse tcp:19000 tcp:19000
```

### Install and Test
```bash
# Start app
npm start -- --localhost

# Monitor logs
adb logcat | grep "ReactNative\|GoldTracker"

# Check app logs
adb logcat -s ReactNative:V ReactNativeJS:V

# Clear app data (for fresh test)
adb shell pm clear com.goldtracker.unified
```

### Useful ADB Commands
```bash
# Install APK
adb install android/app/build/outputs/apk/release/app-release.apk

# Uninstall app
adb uninstall com.goldtracker.unified

# Check app storage
adb shell ls -la /data/data/com.goldtracker.unified/

# Pull database for inspection
adb pull /data/data/com.goldtracker.unified/databases/goldtracker.db

# Take screenshot
adb shell screencap -p /sdcard/screenshot.png
adb pull /sdcard/screenshot.png
```

## 📊 Test Data Preparation

### Create Test PDFs

Place in `test-data/` directory:

1. **Small PDF** (1-5 pages, 1-10 transactions)
   - Tests basic functionality
   - Quick processing

2. **Medium PDF** (10-50 pages, 50-100 transactions)
   - Tests normal usage
   - Performance baseline

3. **Large PDF** (50+ pages, 100+ transactions)
   - Stress test
   - Performance limits

4. **Edge Cases**:
   - PDF with NO gold transactions → Should show appropriate message
   - PDF with malformed dates → Should skip or handle gracefully
   - Corrupted PDF → Should show error without crashing

### Sample Transaction Data

Expected format in PhonePe PDF:

```
Jan 25, 2026 Gold Purchased 0.0007g DEBIT ₹11.82
07:50 pm Transaction ID NB26012519501977015202082
Paid by XXXXXXXXXXXX8634

Feb 01, 2026 Gold Sold 0.0005g CREDIT ₹8.50
08:30 am Transaction ID NB26020119501977015202083
UTR No. 123456789012
```

## 🎯 Daily Testing Workflow

### During Development (3-4 times per day)

```bash
# Terminal 1: Dev server
npm start

# Terminal 2: Watch tests
npm run test:watch

# Make changes → Save → Tests run automatically
# Check Expo Go app → See changes immediately
```

### Before Building (Once per day)

```bash
# 1. Run full test suite
npm test

# 2. Run pre-build checks
./pre-build-check.sh

# 3. Manual checklist (15 minutes)
#    - Test PDF upload with 3 different files
#    - Verify all screens work
#    - Test error scenarios
#    - Check performance

# 4. If all pass → Build
npm run build:local
```

## 📈 Test Metrics

Track these over time:

| Metric | Target | Current |
|--------|--------|---------|
| Unit Test Coverage | ≥80% | Check with `npm run test:coverage` |
| Unit Tests Passing | 100% | Check with `npm test` |
| PDF Processing Time | <10s | Measure in app |
| App Launch Time | <3s | Measure with stopwatch |
| Crashes | 0 | Monitor during testing |

## 🐛 Debugging Failed Tests

### Test Fails: "Module not found"
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
```

### Test Fails: "Timeout"
```bash
# Increase timeout in test
jest.setTimeout(10000); // 10 seconds
```

### Test Fails: "Unexpected value"
```bash
# Add detailed logging
console.log('Actual:', actualValue);
console.log('Expected:', expectedValue);
```

### Tests Pass but App Fails
- Unit tests mock dependencies - test with real device
- Check console logs in Expo Go
- Use React DevTools to inspect state

## ✅ Release Checklist

Before releasing to users:

- [ ] All unit tests pass
- [ ] Pre-build checks pass
- [ ] Tested on minimum 2 physical devices
- [ ] Tested with minimum 5 different PDF files
- [ ] Performance acceptable on low-end device
- [ ] All error scenarios tested
- [ ] Data persistence verified
- [ ] No crashes in 30-minute usage session
- [ ] User-facing strings reviewed
- [ ] README updated with any changes
- [ ] Version number bumped in package.json

---

**Remember**: One build per day. Test thoroughly BEFORE building!
