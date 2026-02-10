/**
 * CsvManager Service
 * 
 * Handles CSV file operations for gold transaction data.
 * Reads existing CSV to prevent duplicates and appends new transactions.
 */

import { NativeModules } from 'react-native';

const { FileSystemModule } = NativeModules;

const CSV_FILE = 'PYO Gold Statement.csv';
const CSV_HEADERS = 'Transaction Date,Time,Transaction ID,Weight of Gold,Type,Amount,UTR No,Account\n';

/**
 * Initialize CSV file with headers if it doesn't exist
 * @param {string} goldTrackerPath - Gold Tracker folder path
 */
export async function initializeCSV(goldTrackerPath) {
  try {
    if (!FileSystemModule) {
      throw new Error('FileSystemModule not available - native module required');
    }
    
    const csvPath = `${goldTrackerPath}/${CSV_FILE}`;
    console.log(`📄 [CsvManager] Checking CSV at: ${csvPath}`);
    
    // Check if file exists using native module
    const exists = await FileSystemModule.fileExists(csvPath);
    console.log(`📄 [CsvManager] CSV exists: ${exists}`);
    
    if (!exists) {
      console.log(`📄 [CsvManager] Creating new CSV with headers`);
      await FileSystemModule.writeTextFile(csvPath, CSV_HEADERS);
      console.log('✅ [CsvManager] CSV file initialized');
    } else {
      console.log('✅ [CsvManager] CSV file already exists');
    }
  } catch (error) {
    console.error('❌ [CsvManager] Error initializing CSV:', error);
    throw new Error(`Cannot initialize CSV file: ${error.message}`);
  }
}

/**
 * Read and parse CSV file
 * @param {string} goldTrackerPath - Gold Tracker folder path
 * @returns {Promise<Array>} - Array of transaction objects
 */
export async function readCSV(goldTrackerPath) {
  try {
    if (!FileSystemModule) {
      throw new Error('FileSystemModule not available - native module required');
    }
    
    const csvPath = `${goldTrackerPath}/${CSV_FILE}`;
    console.log(`📖 [CsvManager] Reading CSV from: ${csvPath}`);
    
    // Use native module to read file
    const content = await FileSystemModule.readTextFile(csvPath);
    console.log(`📖 [CsvManager] CSV content length: ${content.length} bytes`);
    
    const lines = content.split('\n');
    console.log(`📖 [CsvManager] Total lines: ${lines.length}`);
    
    if (lines.length < 2) {
      console.log(`⚠️ [CsvManager] CSV has no data rows`);
      return [];
    }
    
    // Read header to detect format
    const header = lines[0].trim();
    console.log(`📖 [CsvManager] CSV Header: ${header}`);
    
    // Detect old vs new format
    const isOldFormat = header.includes('Date,Time,Transaction ID,UTR Number,Weight') || 
                        header.includes('Weight (g)') || 
                        header.includes('Amount (₹)');
    
    console.log(`📖 [CsvManager] CSV Format: ${isOldFormat ? 'OLD' : 'NEW'}`);
    
    // Skip header row and empty lines
    const dataLines = lines.slice(1).filter(line => line.trim().length > 0);
    console.log(`📖 [CsvManager] Data lines: ${dataLines.length}`);
    
    const transactions = dataLines.map(line => {
      const parts = line.split(',');
      
      if (isOldFormat) {
        // Old format: Date,Time,Transaction ID,UTR Number,Weight (g),Amount (₹),Type
        if (parts.length < 7) return null;
        
        return {
          'Transaction Date': parts[0]?.trim() || '',
          'Time': parts[1]?.trim() || '',
          'Transaction ID': parts[2]?.trim() || '',
          'UTR No': parts[3]?.trim() || '',
          'Weight of Gold': parts[4]?.trim() || '',
          'Amount': parts[5]?.trim() || '',
          'Type': parts[6]?.trim() || '',
          'Account': ''
        };
      } else {
        // New format: Transaction Date,Time,Transaction ID,Weight of Gold,Type,Amount,UTR No,Account
        if (parts.length < 8) return null;
        
        return {
          'Transaction Date': parts[0]?.trim() || '',
          'Time': parts[1]?.trim() || '',
          'Transaction ID': parts[2]?.trim() || '',
          'Weight of Gold': parts[3]?.trim() || '',
          'Type': parts[4]?.trim() || '',
          'Amount': parts[5]?.trim() || '',
          'UTR No': parts[6]?.trim() || '',
          'Account': parts[7]?.trim() || ''
        };
      }
    }).filter(txn => txn !== null);

    console.log(`✅ [CsvManager] Read ${transactions.length} transactions from CSV`);
    console.log(`📊 [CsvManager] Sample transaction:`, transactions[0]);
    return transactions;

  } catch (error) {
    // File doesn't exist or read error - return empty array
    if (error.message?.includes('not found') || error.message?.includes('FILE_NOT_FOUND')) {
      console.log(`⚠️ [CsvManager] CSV file not found, returning empty array`);
      return [];
    }
    console.error('❌ [CsvManager] Error reading CSV:', error);
    throw new Error(`Cannot read CSV file: ${error.message}`);
  }
}

/**
 * Extract all transaction IDs from CSV data
 * @param {Array} transactions - Array of transaction objects
 * @returns {Set<string>} - Set of transaction IDs
 */
export function extractTransactionIds(transactions) {
  const ids = new Set();
  transactions.forEach(txn => {
    const id = txn['Transaction ID'];
    if (id && String(id).trim().length > 0) {
      ids.add(String(id).trim());
    }
  });
  return ids;
}

/**
 * Convert transaction object to CSV row
 * @param {Object} transaction - Transaction object (with exact CSV header names)
 * @returns {string} - CSV row string
 */
function transactionToCSVRow(transaction) {
  // Use standardized property names
  // Order: Transaction Date,Time,Transaction ID,Weight of Gold,Type,Amount,UTR No,Account
  const date = transaction['Transaction Date'] || '';
  const time = transaction['Time'] || '';
  const transactionId = transaction['Transaction ID'] || '';
  const weight = transaction['Weight of Gold'] || '';
  const type = transaction['Type'] || '';
  const amount = transaction['Amount'] || '';
  const utrNo = transaction['UTR No'] || '';
  const account = transaction['Account'] || '';
  
  // Escape commas in values if needed
  const escape = (val) => {
    const str = String(val || '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  
  return `${escape(date)},${escape(time)},${escape(transactionId)},${escape(weight)},${escape(type)},${escape(amount)},${escape(utrNo)},${escape(account)}`;
}

/**
 * Append new transactions to CSV file
 * @param {string} goldTrackerPath - Gold Tracker folder path
 * @param {Array} newTransactions - Array of transaction objects to append
 */
export async function appendTransactions(goldTrackerPath, newTransactions) {
  try {
    if (!newTransactions || newTransactions.length === 0) {
      console.log('⚠️ [CsvManager] No transactions to append');
      return;
    }
    
    if (!FileSystemModule) {
      throw new Error('FileSystemModule not available - native module required');
    }

    const csvPath = `${goldTrackerPath}/${CSV_FILE}`;
    console.log(`💾 [CsvManager] Appending ${newTransactions.length} transactions to: ${csvPath}`);
    
    // Log first transaction structure for debugging
    if (newTransactions.length > 0) {
      console.log(`💾 [CsvManager] Sample transaction structure:`, JSON.stringify(newTransactions[0], null, 2));
      console.log(`💾 [CsvManager] Transaction keys:`, Object.keys(newTransactions[0]));
    }
    
    // Ensure CSV exists
    await initializeCSV(goldTrackerPath);
    
    // Convert transactions to CSV rows
    console.log(`💾 [CsvManager] Converting transactions to CSV rows...`);
    const rows = newTransactions.map(txn => {
      const row = transactionToCSVRow(txn);
      console.log(`💾 [CsvManager] CSV Row: ${row}`);
      return row;
    });
    const content = rows.join('\n') + '\n';
    console.log(`💾 [CsvManager] Generated ${content.length} bytes of CSV data`);
    
    // Read existing content and append
    console.log(`💾 [CsvManager] Reading existing CSV content...`);
    const existingContent = await FileSystemModule.readTextFile(csvPath);
    console.log(`💾 [CsvManager] Existing content: ${existingContent.length} bytes`);
    
    const updatedContent = existingContent + content;
    console.log(`💾 [CsvManager] Writing updated content: ${updatedContent.length} bytes`);
    await FileSystemModule.writeTextFile(csvPath, updatedContent);
    
    console.log(`✅ [CsvManager] Appended ${newTransactions.length} transactions to CSV`);

  } catch (error) {
    console.error('Error appending to CSV:', error);
    throw error;
  }
}

/**
 * Load existing transaction IDs from CSV
 * @param {string} goldTrackerPath - Gold Tracker folder path
 * @returns {Promise<Set<string>>} - Set of existing transaction IDs
 */
export async function loadExistingTransactionIds(goldTrackerPath) {
  try {
    const transactions = await readCSV(goldTrackerPath);
    return extractTransactionIds(transactions);
  } catch (error) {
    console.error('Error loading transaction IDs:', error);
    return new Set();
  }
}

/**
 * Get CSV file path
 * @param {string} goldTrackerPath - Gold Tracker folder path
 * @returns {string} - Full CSV file path
 */
export function getCSVPath(goldTrackerPath) {
  return `${goldTrackerPath}/${CSV_FILE}`;
}

export default {
  initializeCSV,
  readCSV,
  extractTransactionIds,
  appendTransactions,
  loadExistingTransactionIds,
  getCSVPath
};
