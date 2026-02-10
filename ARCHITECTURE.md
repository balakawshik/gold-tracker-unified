# Architecture Documentation

Technical architecture and implementation details for Gold Tracker Unified.

## 📐 System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     React Native App                         │
│                    (JavaScript Layer)                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Screens    │  │  Components  │  │   Services   │      │
│  │   (5 tabs)   │  │   (Modal)    │  │  (Business)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
├─────────────────────────────────────────────────────────────┤
│            React Native Bridge (NativeModules)               │
├─────────────────────────────────────────────────────────────┤
│                   Native Android Layer                       │
│  ┌──────────────────┐          ┌────────────────────┐      │
│  │ PdfProcessor     │          │ FileSystemModule   │      │
│  │ (Apache PDFBox)  │          │ (File Operations)  │      │
│  └──────────────────┘          └────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
              │                            │
              ▼                            ▼
    ┌──────────────────┐        ┌──────────────────┐
    │  PhonePe PDFs    │        │  SQLite Database │
    │  (Binary Files)  │        │  (Transactions)  │
    └──────────────────┘        └──────────────────┘
```

## 🎭 Application Layers

### 1. Presentation Layer (Screens)

**Location:** `src/screens/`

#### UploadScreen.js
- **Purpose**: Batch PDF processing and file management
- **Key Features**:
  - Folder selection and PDF scanning
  - File status tracking (new, modified, processed)
  - Batch processing with real-time logs
  - Duplicate detection by Transaction ID
- **State Management**:
  - Files list with metadata (name, size, hash, status)
  - Selected files for batch processing
  - Processing logs and progress
- **Dependencies**: PdfProcessor, FileTracker, CsvManager, DataStorage

#### DataLoadScreen.js
- **Purpose**: Display all transactions and CSV import
- **Key Features**:
  - Transaction list with filtering
  - CSV import with duplicate detection
  - Quick statistics display
  - Pull-to-refresh functionality
- **State Management**:
  - Transaction data array
  - Statistics (buys, sells, total)
  - Selected CSV file
- **Dependencies**: DataStorage, FileSystem, DocumentPicker

#### InsightsScreen.js
- **Purpose**: Analytics and profit/loss calculations
- **Key Features**:
  - Average buy/sell rates
  - Realized and unrealized P&L
  - Net gold holdings
  - Time-based filtering (year, month, date)
- **Calculations**:
  - Avg Buy Rate = Total Buy Amount / Total Buy Grams
  - Avg Sell Rate = Total Sell Amount / Total Sell Grams
  - Realized P/L = Sell Amount - (Sell Grams × Avg Buy Rate)
  - Unrealized P/L = (Net Grams × Latest Sell Rate) - (Net Grams × Avg Buy Rate)
- **State Management**:
  - Filter type and selected time period
  - Calculated insights object
  - Available years/months/dates

#### ChartsScreen.js
- **Purpose**: Visual data representation with charts
- **Key Features**:
  - Line charts for gold volume (grams)
  - Line charts for transaction amount (₹)
  - Time-based aggregation (daily/monthly)
  - Interactive filtering
- **Chart Types**: react-native-chart-kit Line Charts
- **State Management**:
  - Aggregated chart data
  - Filter type (all, week, month, year)
- **Dependencies**: react-native-chart-kit, react-native-svg

#### LiveRatesScreen.js
- **Purpose**: Current gold rate display
- **Key Features**:
  - Real-time rate display
  - Market trends
  - Rate comparisons
- **Note**: Placeholder for future API integration

### 2. Business Logic Layer (Services)

**Location:** `src/services/`

#### PdfProcessor.js
- **Type**: JavaScript Bridge to Native Module
- **Purpose**: Coordinates PDF text extraction and transaction parsing
- **Key Methods**:
  - `processPDF(fileUri)` - Extracts transactions from PDF
  - `validateTransactions(transactions)` - Validates extracted data
- **Data Flow**:
  1. Receives file URI from screen
  2. Calls native PdfProcessor module
  3. Receives raw transaction data
  4. Validates and transforms data
  5. Returns standardized transaction objects
- **Error Handling**: Catches native module errors, validates numbers and dates

#### DataStorage.js
- **Type**: Database Abstraction Layer
- **Purpose**: SQLite database operations
- **Key Methods**:
  - `initDatabase()` - Creates tables if not exist
  - `saveTransactions(transactions)` - Batch insert with duplicate check
  - `getAllTransactions()` - Retrieves all records
  - `deleteAllTransactions()` - Clears database
- **Schema**:
```sql
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_date TEXT NOT NULL,
  time TEXT,
  transaction_id TEXT UNIQUE NOT NULL,
  weight REAL NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  utr_no TEXT,
  account TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```
- **Unique Constraint**: `transaction_id` prevents duplicates

#### CsvManager.js
- **Type**: CSV File Handler
- **Purpose**: CSV import/export with backward compatibility
- **Key Methods**:
  - `initializeCSV(path)` - Creates CSV with headers
  - `readCSV(path)` - Reads and parses CSV (supports old & new format)
  - `appendTransactions(path, transactions)` - Appends new rows
  - `extractTransactionIds(transactions)` - Gets ID set for duplicate check
- **CSV Format (New)**:
```csv
Transaction Date,Time,Transaction ID,Weight of Gold,Type,Amount,UTR No,Account
```
- **CSV Format (Old - Supported)**:
```csv
Date,Time,Transaction ID,UTR Number,Weight (g),Amount (₹),Type
```
- **Header Standardization**: Automatically converts old headers to new property names

#### FileTracker.js
- **Type**: File Manifest Manager
- **Purpose**: Tracks processed files and detects changes
- **Key Methods**:
  - `calculateFileHash(fileUri)` - SHA-256 hash via native module
  - `loadManifest(path)` - Reads JSON manifest
  - `saveManifest(path, manifest)` - Writes JSON manifest
  - `getFileStatus(fileName, hash, existingIds, transactions)` - Determines status
  - `filterNewTransactions(transactions, existingIds)` - Removes duplicates
- **Manifest Structure**:
```json
{
  "files": [
    {
      "name": "PhonePe_Statement.pdf",
      "hash": "sha256...",
      "processedAt": "2026-02-10T05:00:00Z",
      "transactionCount": 42
    }
  ]
}
```
- **File Status Logic**:
  - `new`: Hash not in manifest
  - `modified`: Hash changed from manifest
  - `processed`: All transactions exist in database
  - `partial`: Some transactions are new

#### FolderManager.js
- **Type**: Android File System Handler
- **Purpose**: Manages Gold Tracker folder in Downloads
- **Key Methods**:
  - `ensureGoldTrackerFolder(parentUri)` - Creates folder if missing
  - `copyToGoldTracker(sourceUri, destUri, fileName)` - Copies PDF
  - `listPDFFiles(folderUri)` - Scans for PDF files
- **Folder Structure**:
```
/storage/emulated/0/Download/Gold Tracker/
├── processed_files.json          # Manifest
├── PYO Gold Statement.csv         # Transaction export
├── PhonePe_Statement_Jan2026.pdf  # Copied PDFs
└── ...
```

### 3. Native Module Layer

**Location:** `android/app/src/main/java/com/goldtracker/unified/`

#### PdfProcessorModule.java
- **Type**: React Native Native Module
- **Purpose**: PDF text extraction and transaction parsing
- **Dependencies**: Apache PDFBox 2.0.27
- **Key Methods**:
  - `extractTransactions(String filePath)` - Main entry point
  - `extractTextFromPDF(String filePath)` - Loads PDF with PDFBox
  - `parseTransactions(String text)` - Regex-based parsing
- **Parsing Logic**:
```java
// Date pattern: "Jan 29, 2026"
Pattern datePattern = Pattern.compile("(Jan|Feb|Mar|...) \\d{1,2}, \\d{4}");

// Transaction ID: 20+ alphanumeric characters
Pattern idPattern = Pattern.compile("Transaction\\s+ID\\s+([A-Z0-9]{15,})", CASE_INSENSITIVE);

// Weight: "0.0005g"
Pattern weightPattern = Pattern.compile("([0-9.]+)g");

// Amount: "₹9.11"
Pattern amountPattern = Pattern.compile("₹([0-9,]+\\.?[0-9]*)");

// Type detection:
- "Gold Purchased" / "DEBIT" → DEBIT (Buy)
- "Gold Sold" / "CREDIT" → CREDIT (Sell)
```
- **Transaction Validation**:
  - Date required
  - Transaction ID required (15+ chars)
  - Type required (DEBIT or CREDIT)
  - Weight > 0
  - Amount > 0
- **Output Format**: JSON array via React Native Promise

#### FileSystemModule.java
- **Type**: React Native Native Module
- **Purpose**: Android file operations and hashing
- **Key Methods**:
  - `calculateSHA256(String filePath)` - File hash for change detection
  - `readTextFile(String filePath)` - Read CSV/JSON files
  - `writeTextFile(String filePath, String content)` - Write CSV/JSON
  - `fileExists(String filePath)` - Check file existence
  - `checkManageStoragePermission()` - Android 11+ permission check
  - `requestManageStoragePermission()` - Opens settings for permission

### 4. Data Layer

#### SQLite Database (expo-sqlite)
- **Type**: Local persistent storage
- **Purpose**: Transaction data storage
- **Features**:
  - ACID compliant
  - Supports concurrent reads
  - Automatic indexing on primary key
  - Unique constraint on transaction_id
- **Performance**:
  - Batch inserts for efficiency
  - Indexed queries on transaction_id
  - No foreign keys (single table design)

#### CSV Files
- **Type**: Export/backup format
- **Purpose**: Data portability and backup
- **Features**:
  - Backward compatible header parsing
  - Duplicate detection on import
  - Proper escaping of commas and quotes

#### JSON Manifest
- **Type**: Processing state tracker
- **Purpose**: Track processed files and prevent rescanning
- **Features**:
  - SHA-256 hashes for change detection
  - Timestamp for audit trail
  - Transaction count for verification

## 🔄 Data Flow

### PDF Upload Flow

```
1. User selects folder (UploadScreen)
   ↓
2. FolderManager.listPDFFiles() scans folder
   ↓
3. For each PDF:
   - FileTracker.calculateFileHash() → SHA-256
   - Compare with manifest
   ↓
4. PdfProcessor.processPDF() → Native extraction
   ↓
5. Native PdfProcessorModule:
   - Apache PDFBox loads PDF
   - Extract text content
   - Regex patterns find transactions
   - Validate each transaction
   ↓
6. Return transactions to JavaScript
   ↓
7. FileTracker.filterNewTransactions() → Remove duplicates
   ↓
8. CsvManager.appendTransactions() → Write to CSV
   ↓
9. DataStorage.saveTransactions() → Insert into SQLite
   ↓
10. FileTracker.updateManifest() → Mark as processed
   ↓
11. UI updates with results
```

### CSV Import Flow

```
1. User picks CSV file (DataLoadScreen)
   ↓
2. File read via expo-file-system
   ↓
3. parseCSV() function:
   - Detect old vs new format from headers
   - Standardize property names
   ↓
4. DataStorage.getAllTransactions() → Get existing IDs
   ↓
5. Filter out duplicates by transaction_id
   ↓
6. DataStorage.saveTransactions() → Insert new only
   ↓
7. Reload all transactions → Update UI
```

### Chart Data Flow

```
1. ChartsScreen receives transactions from parent
   ↓
2. Apply time filter (all/week/month/year)
   ↓
3. Filter by date range
   ↓
4. Group by date or month:
   - Sum buy grams, sell grams
   - Sum buy amount, sell amount
   ↓
5. Transform to chart format:
   - Labels: ["Jan", "Feb", "Mar"]
   - Datasets: [{data: [1.5, 2.3, 1.8]}]
   ↓
6. LineChart component renders
```

## 🔐 Security & Privacy

### Data Storage
- **Local Only**: All data stored on device
- **No Cloud**: No data transmitted to external servers
- **SQLite Encryption**: Not currently implemented (can be added with SQLCipher)

### File Permissions
- **Android 11+**: Requires MANAGE_EXTERNAL_STORAGE permission
- **Scoped Storage**: Uses SAF (Storage Access Framework)
- **Minimal Permissions**: Only requests what's needed

### PDF Processing
- **Native Execution**: PDFs processed locally on device
- **No Network**: No PDF content sent to external services
- **Memory Management**: Large PDFs chunked to prevent OOM

## 🎯 Design Patterns

### Service Layer Pattern
- Business logic separated from UI
- Reusable across screens
- Easier to test and mock

### Repository Pattern
- DataStorage acts as repository
- Abstracts database operations
- Single source of truth

### Bridge Pattern
- Native modules bridged via clean JavaScript interface
- Platform-specific code isolated
- Consistent API regardless of platform

### Factory Pattern
- Transaction objects created consistently
- Validation centralized
- Easy to extend with new transaction types

## 🧪 Testing Strategy

### Unit Tests
- **Coverage**: 80%+ required
- **Location**: `src/services/__tests__/`
- **Tested Services**:
  - PdfProcessor: validation logic
  - DataStorage: database operations (mocked)
- **Mocking**: React Native modules mocked in Jest setup

### Integration Tests
- Manual testing with real PhonePe PDFs
- End-to-end flow validation
- Device testing with Expo Go + APK

### Test Data
- **Location**: `test-data/`
- Sample PDFs for testing
- Known good/bad transaction formats

## 📊 Performance Considerations

### PDF Processing
- **Optimization**: Native Java execution (faster than JS)
- **Memory**: PDFBox streams large files
- **Threading**: Processed on native thread (non-blocking)

### Database Operations
- **Batch Inserts**: Multiple transactions in single transaction
- **Indexed Queries**: Primary key and unique constraint indexed
- **Connection Pooling**: expo-sqlite manages connections

### UI Rendering
- **FlatList**: Virtualized lists for large datasets
- **Memoization**: React.memo on expensive components
- **Chart Optimization**: Data aggregated before rendering

### File Operations
- **Streaming**: Large files read in chunks
- **Caching**: Manifest cached in memory during processing
- **Async**: All file I/O non-blocking

## 🚀 Build & Deployment

### Development Build (Expo Go)
```bash
npm start
```
- JavaScript bundle served via Metro
- No native code compilation
- Instant reload via websocket
- Limited to Expo SDK features

### Production Build (Standalone APK)
```bash
npm run android
```
1. **Prebuild**: `expo prebuild` generates android/ folder
2. **Gradle**: Compiles Java code and native libraries
3. **Metro**: Bundles JavaScript into index.android.bundle
4. **APK Assembly**: Packages everything into APK
5. **Signing**: Release builds signed with keystore

### Build Artifacts
- **Debug APK**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Release APK**: `android/app/build/outputs/apk/release/app-release.apk`
- **Bundle**: `android/app/build/generated/assets/`
- **Size**: ~85MB (contains React Native + PDFBox)

## 🔧 Configuration Files

### package.json
- Dependencies and versions
- NPM scripts
- Jest configuration
- Coverage thresholds

### app.json / app.config.js
- Expo configuration
- App name, version, icon
- Android package name
- Permissions required

### android/app/build.gradle
- Android SDK versions
- Native dependencies (PDFBox)
- Build types (debug/release)
- ProGuard rules

### babel.config.js
- Babel preset for Expo
- Transforms JSX and modern JS

## 📝 Future Enhancements

### Planned Features
- [ ] Cloud backup (optional)
- [ ] Multiple accounts support
- [ ] Gold rate API integration
- [ ] Export to Excel
- [ ] Advanced analytics (moving averages, trends)
- [ ] Push notifications for rate changes
- [ ] Widget support

### Technical Improvements
- [ ] SQLite encryption (SQLCipher)
- [ ] Background PDF processing
- [ ] Offline-first sync architecture
- [ ] Performance monitoring
- [ ] Crash reporting
- [ ] Progressive enhancement

---

**Last Updated**: February 10, 2026
