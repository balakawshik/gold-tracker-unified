package com.goldtracker.unified;

import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.text.PDFTextStripper;
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class PdfProcessorModule extends ReactContextBaseJavaModule {
    private static final String TAG = "PdfProcessorModule";
    private final ReactApplicationContext reactContext;

    public PdfProcessorModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "PdfProcessor";
    }

    @ReactMethod
    public void extractGoldTransactions(String filePath, Promise promise) {
        try {
            // Initialize PDFBox Android (required for Android compatibility)
            PDFBoxResourceLoader.init(getReactApplicationContext());
            
            Log.d(TAG, "Starting PDF extraction for: " + filePath);
            
            File pdfFile = new File(filePath);
            if (!pdfFile.exists()) {
                Log.e(TAG, "File not found at: " + pdfFile.getAbsolutePath());
                Log.e(TAG, "File exists check: " + pdfFile.exists());
                Log.e(TAG, "Parent directory: " + pdfFile.getParent());
                promise.reject("FILE_NOT_FOUND", "PDF file not found: " + filePath + " (absolute: " + pdfFile.getAbsolutePath() + ")");
                return;
            }

            Log.d(TAG, "File found, size: " + pdfFile.length() + " bytes");

            // Load PDF using PdfBox-Android (Android-compatible fork)
            PDDocument document = PDDocument.load(pdfFile);
            PDFTextStripper stripper = new PDFTextStripper();
            String text = stripper.getText(document);
            document.close();

            Log.d(TAG, "PDF text extracted, length: " + text.length());
            Log.d(TAG, "═══════════════════════════════════════════");
            Log.d(TAG, "FULL PDF TEXT DUMP:");
            Log.d(TAG, text);
            Log.d(TAG, "═══════════════════════════════════════════");
            Log.d(TAG, "First 500 chars: " + (text.length() > 500 ? text.substring(0, 500) : text));

            // Parse transactions from text
            List<Transaction> transactions = parseTransactions(text);
            Log.d(TAG, "Found " + transactions.size() + " transactions");

            // Convert to React Native format
            WritableArray result = Arguments.createArray();
            for (Transaction t : transactions) {
                WritableMap map = Arguments.createMap();
                map.putString("date", t.date);
                map.putString("time", t.time);
                map.putString("transactionId", t.transactionId);
                map.putString("utrNumber", t.utrNumber);
                map.putString("weight", t.weight);
                map.putString("amount", t.amount);
                map.putString("type", t.type);
                result.pushMap(map);
            }

            promise.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "Error extracting PDF: " + e.getMessage(), e);
            promise.reject("PDF_EXTRACTION_ERROR", "Failed to extract PDF: " + e.getMessage(), e);
        }
    }

    @ReactMethod
    public void extractRawText(String filePath, Promise promise) {
        try {
            // Initialize PDFBox Android (required for Android compatibility)
            PDFBoxResourceLoader.init(getReactApplicationContext());
            
            Log.d(TAG, "Extracting raw text from: " + filePath);
            
            File pdfFile = new File(filePath);
            if (!pdfFile.exists()) {
                Log.e(TAG, "File not found at: " + pdfFile.getAbsolutePath());
                promise.reject("FILE_NOT_FOUND", "PDF file not found: " + filePath);
                return;
            }

            // Load PDF using PdfBox-Android (Android-compatible fork)
            PDDocument document = PDDocument.load(pdfFile);
            PDFTextStripper stripper = new PDFTextStripper();
            String text = stripper.getText(document);
            document.close();

            Log.d(TAG, "Raw text extracted, length: " + text.length());
            promise.resolve(text);
            
        } catch (Exception e) {
            Log.e(TAG, "Error extracting raw text: " + e.getMessage(), e);
            promise.reject("TEXT_EXTRACTION_ERROR", "Failed to extract text: " + e.getMessage(), e);
        }
    }

    private List<Transaction> parseTransactions(String text) {
        List<Transaction> transactions = new ArrayList<>();
        
        // Split by lines
        String[] lines = text.split("\\n");
        
        // Patterns for PhonePe Gold Statement format
        // Date: "Jan 29, 2026" or "Dec 30, 2025"
        Pattern datePattern = Pattern.compile("(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+(\\d{1,2}),\\s+(20\\d{2})");
        // Time: "11:02 pm" or "10:59 am"
        Pattern timePattern = Pattern.compile("(\\d{1,2}:\\d{2}\\s*(?:am|pm|AM|PM))", Pattern.CASE_INSENSITIVE);
        // Transaction ID: "NB26012519501977015202082" - More flexible pattern
        Pattern idPattern = Pattern.compile("Transaction\\s+ID\\s+([A-Z0-9]{15,})", Pattern.CASE_INSENSITIVE);
        // UTR: "326822885171"
        Pattern utrPattern = Pattern.compile("(?:UTR No\\.|UTR)\\s+([0-9]{10,})", Pattern.CASE_INSENSITIVE);
        // Weight: "0.0005g" or "0.0007g"
        Pattern weightPattern = Pattern.compile("(\\d+\\.\\d+)g");
        // Amount: "₹9.11" or "₹12.66"
        Pattern amountPattern = Pattern.compile("₹\\s*(\\d+(?:\\.\\d{2})?)\s*");
        
        Log.d(TAG, "Starting transaction parsing with " + lines.length + " lines");
        
        Transaction currentTransaction = null;
        int transactionsWithIds = 0;
        int transactionsWithoutIds = 0;
        
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i].trim();
            
            if (line.isEmpty()) continue;
            
            // Check for new transaction line with date
            Matcher dateMatcher = datePattern.matcher(line);
            if (dateMatcher.find()) {
                // Save previous transaction
                if (currentTransaction != null) {
                    if (currentTransaction.isValid()) {
                        transactions.add(currentTransaction);
                        transactionsWithIds++;
                        Log.d(TAG, "✓ Valid transaction added: " + currentTransaction.date + " ID=" + currentTransaction.transactionId);
                    } else {
                        transactionsWithoutIds++;
                        Log.w(TAG, "✗ Invalid transaction (missing ID): " + currentTransaction.date + 
                              " weight=" + currentTransaction.weight + " amount=" + currentTransaction.amount);
                    }
                }
                
                // Start new transaction
                currentTransaction = new Transaction();
                currentTransaction.date = dateMatcher.group(0);
                Log.d(TAG, "[Line " + i + "] New transaction date: " + currentTransaction.date);
                
                // Check current line for transaction type (case-insensitive)
                String lineLower = line.toLowerCase();
                if (lineLower.contains("gold purchased") || 
                    lineLower.contains("purchased") ||
                    lineLower.contains("buy") ||
                    lineLower.contains("buying")) {
                    currentTransaction.type = "DEBIT";
                    Log.d(TAG, "  ✓ Type: DEBIT (Buy/Purchase)");
                } else if (lineLower.contains("gold sold") || 
                           lineLower.contains("sold") ||
                           lineLower.contains("sell") ||
                           lineLower.contains("selling") ||
                           lineLower.contains("sale")) {
                    currentTransaction.type = "CREDIT";
                    Log.d(TAG, "  ✓ Type: CREDIT (Sell/Sale)");
                } else {
                    Log.w(TAG, "  ⚠ Type not detected on date line");
                }
                
                // Try to extract weight from same line
                Matcher weightMatcher = weightPattern.matcher(line);
                if (weightMatcher.find()) {
                    currentTransaction.weight = weightMatcher.group(1);
                    Log.d(TAG, "  Weight: " + currentTransaction.weight + "g");
                }
                
                // Try to extract amount from same line
                Matcher amountMatcher = amountPattern.matcher(line);
                if (amountMatcher.find()) {
                    currentTransaction.amount = amountMatcher.group(1);
                    Log.d(TAG, "  Amount: ₹" + currentTransaction.amount);
                }
            }
            
            if (currentTransaction != null) {
                // Extract time (usually on same line as date)
                if (currentTransaction.time == null) {
                    Matcher timeMatcher = timePattern.matcher(line);
                    if (timeMatcher.find()) {
                        currentTransaction.time = timeMatcher.group(1);
                        Log.d(TAG, "  Time: " + currentTransaction.time);
                    }
                }
                
                // Extract transaction ID
                if (currentTransaction.transactionId == null) {
                    Matcher idMatcher = idPattern.matcher(line);
                    if (idMatcher.find()) {
                        currentTransaction.transactionId = idMatcher.group(1);
                        Log.d(TAG, "  ✓ Transaction ID: " + currentTransaction.transactionId);
                    } else if (line.toLowerCase().contains("transaction") && line.toLowerCase().contains("id")) {
                        Log.w(TAG, "  ✗ Line contains 'transaction id' but pattern didn't match: " + line);
                    }
                }
                
                // Extract UTR
                Matcher utrMatcher = utrPattern.matcher(line);
                if (utrMatcher.find() && currentTransaction.utrNumber == null) {
                    currentTransaction.utrNumber = utrMatcher.group(1);
                    Log.d(TAG, "  → UTR: " + currentTransaction.utrNumber);
                }
                
                // Extract weight if not already found
                if (currentTransaction.weight == null) {
                    Matcher weightMatcher = weightPattern.matcher(line);
                    if (weightMatcher.find()) {
                        currentTransaction.weight = weightMatcher.group(1);
                    }
                }
                
                // Extract amount if not already found
                if (currentTransaction.amount == null) {
                    Matcher amountMatcher = amountPattern.matcher(line);
                    if (amountMatcher.find()) {
                        currentTransaction.amount = amountMatcher.group(1);
                    }
                }
                
                // Detect type from DEBIT/CREDIT keywords (case-insensitive)
                if (currentTransaction.type == null) {
                    String lineLower = line.toLowerCase();
                    if (lineLower.contains("debit") || 
                        lineLower.contains("debited") ||
                        lineLower.contains("dr.")) {
                        currentTransaction.type = "DEBIT";
                        Log.d(TAG, "  ✓ Type detected: DEBIT (from keyword)");
                    } else if (lineLower.contains("credit") || 
                               lineLower.contains("credited") ||
                               lineLower.contains("cr.")) {
                        currentTransaction.type = "CREDIT";
                        Log.d(TAG, "  ✓ Type detected: CREDIT (from keyword)");
                    }
                }
            }
        }
        
        // Add last transaction
        if (currentTransaction != null) {
            if (currentTransaction.isValid()) {
                transactions.add(currentTransaction);
                transactionsWithIds++;
                Log.d(TAG, "✓ Final transaction added: " + currentTransaction.toString());
            } else {
                transactionsWithoutIds++;
                String reason = "";
                if (currentTransaction.transactionId == null || currentTransaction.transactionId.isEmpty()) {
                    reason = " (missing Transaction ID)";
                } else if (currentTransaction.type == null) {
                    reason = " (missing Type - could not detect DEBIT/CREDIT)";
                } else if (currentTransaction.date == null) {
                    reason = " (missing Date)";
                } else if (currentTransaction.weight == null) {
                    reason = " (missing Weight)";
                } else if (currentTransaction.amount == null) {
                    reason = " (missing Amount)";
                }
                Log.w(TAG, "✗ Final transaction invalid" + reason + ": " + currentTransaction.toString());
            }
        }
        
        Log.d(TAG, "═══════════════════════════════════════════");
        Log.d(TAG, "Parsing complete:");
        Log.d(TAG, "  Valid transactions (with ID): " + transactionsWithIds);
        Log.d(TAG, "  Invalid transactions (no ID): " + transactionsWithoutIds);
        Log.d(TAG, "  Total in result: " + transactions.size());
        Log.d(TAG, "═══════════════════════════════════════════");
        
        return transactions;
    }

    private static class Transaction {
        String date;
        String time;
        String transactionId;
        String utrNumber;
        String weight;
        String amount;
        String type = null; // No default - must be detected from PDF
        
        boolean isValid() {
            // Transaction ID AND Type are REQUIRED for valid transactions
            // Type must be either DEBIT (Buy) or CREDIT (Sell)
            return date != null && 
                   weight != null && 
                   amount != null && 
                   transactionId != null && 
                   !transactionId.isEmpty() &&
                   type != null &&
                   (type.equals("DEBIT") || type.equals("CREDIT"));
        }
        
        @Override
        public String toString() {
            return String.format("Transaction{date=%s, time=%s, type=%s, weight=%sg, amount=₹%s, id=%s, utr=%s}",
                date, time, type, weight, amount, 
                transactionId != null ? transactionId.substring(0, Math.min(8, transactionId.length())) + "..." : "null",
                utrNumber);
        }
    }
}
