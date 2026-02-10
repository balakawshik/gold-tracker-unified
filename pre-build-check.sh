#!/bin/bash

###############################################################################
# Pre-Build Validation Script
# Run this before building APK to catch errors early
###############################################################################

set -e

echo "======================================================================"
echo "Pre-Build Validation Checklist"
echo "======================================================================"
echo ""

ERRORS=0

# 1. Run unit tests
echo "1️⃣  Running unit tests..."
if npm test -- --coverage --passWithNoTests 2>&1 | tee test-output.log; then
    echo "   ✅ All tests passed"
else
    echo "   ❌ Tests failed"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 2. Run linter
echo "2️⃣  Running linter..."
if npm run lint 2>&1 | grep -q "error"; then
    echo "   ❌ Linting errors found"
    ERRORS=$((ERRORS + 1))
else
    echo "   ✅ No linting errors"
fi
echo ""

# 3. Check for console.log in production code
echo "3️⃣  Checking for debug statements..."
DEBUG_COUNT=$(grep -r "console.log" src --exclude-dir=__tests__ --exclude="*.test.js" | wc -l)
if [ "$DEBUG_COUNT" -gt 5 ]; then
    echo "   ⚠️  Found $DEBUG_COUNT console.log statements (consider removing for production)"
else
    echo "   ✅ Minimal debug statements"
fi
echo ""

# 4. Verify package.json dependencies
echo "4️⃣  Verifying dependencies..."
if npm list --depth=0 &> /dev/null; then
    echo "   ✅ All dependencies installed"
else
    echo "   ❌ Missing dependencies"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 5. Check for required files
echo "5️⃣  Checking required files..."
REQUIRED_FILES=(
    "App.js"
    "src/services/DataStorage.js"
    "src/services/PdfProcessor.js"
    "src/screens/UploadScreen.js"
    "android/app/build.gradle"
    "android/app/src/main/java/com/goldtracker/unified/PdfProcessorModule.java"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ Missing: $file"
        ERRORS=$((ERRORS + 1))
    fi
done
echo ""

# 6. Check Android configuration
echo "6️⃣  Checking Android configuration..."
if grep -q "pdfbox-android" android/app/build.gradle; then
    echo "   ✅ PdfBox-Android dependency configured"
else
    echo "   ❌ PdfBox-Android dependency missing"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Summary
echo "======================================================================"
if [ $ERRORS -eq 0 ]; then
    echo "✅ PRE-BUILD VALIDATION PASSED"
    echo "======================================================================"
    echo ""
    echo "Ready to build! Run:"
    echo "  npm run build:local"
    echo ""
    exit 0
else
    echo "❌ PRE-BUILD VALIDATION FAILED - $ERRORS ERRORS"
    echo "======================================================================"
    echo ""
    echo "Please fix the above errors before building."
    echo ""
    exit 1
fi
