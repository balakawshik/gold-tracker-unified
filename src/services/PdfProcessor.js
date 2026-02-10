/**
 * PdfProcessor Service
 * Handles PDF file processing and transaction extraction
 * Uses ONLY native Android PDF processing (Apache PDFBox)
 * 
 * NO JAVASCRIPT FALLBACKS - All PDF parsing requires native module
 */

import { Platform, Alert } from 'react-native';

class PdfProcessorService {
  constructor() {
    this.nativeModule = null;
    
    // Try to import native module - REQUIRED for PDF processing
    if (Platform.OS === 'android') {
      try {
        const { NativeModules } = require('react-native');
        this.nativeModule = NativeModules.PdfProcessor;
        if (!this.nativeModule) {
          console.error('❌ PdfProcessor native module not found!');
          Alert.alert(
            'Native Module Missing',
            'PdfProcessor module not available. PDF processing will fail.\n\nPlease rebuild the app.',
            [{ text: 'OK' }]
          );
        }
      } catch (error) {
        console.error('❌ Failed to load PdfProcessor module:', error);
        Alert.alert(
          'Module Load Error',
          `Failed to load PDF processor:\n${error.message}`,
          [{ text: 'OK' }]
        );
      }
    }
  }

  // REMOVED: processUploadedPdf with FileSystem dependencies
  // Use extractTransactionsFromPath for direct file path processing

  /**
   * Extract transactions using native Android module
   * @param {string} filePath - Local file path
   * @returns {Promise<Array>}
   */
  async extractWithNativeModule(filePath) {
    if (!this.nativeModule) {
      const errorMsg = 'Native PDF processor module not available. Cannot process PDFs.';
      console.error('❌', errorMsg);
      Alert.alert(
        '❌ Critical Error - Module Not Available',
        `${errorMsg}\n\nModule: PdfProcessor\nPlatform: ${Platform.OS}\n\nThe native Android module is required for PDF processing.\n\nPlease rebuild the app to enable PDF processing.`,
        [{ text: 'OK' }]
      );
      throw new Error(errorMsg);
    }

    try {
      // Remove file:// prefix if present (Java File class doesn't accept it)
      const cleanPath = filePath.replace(/^file:\/\//, '');
      console.log(`🔧 [PdfProcessor] Processing: ${cleanPath}`);
      console.log(`🔧 [PdfProcessor] Module available: ${!!this.nativeModule}`);
      console.log(`🔧 [PdfProcessor] Calling extractGoldTransactions...`);
      
      const result = await this.nativeModule.extractGoldTransactions(cleanPath);
      console.log(`✅ [PdfProcessor] Extracted ${result?.length || 0} transactions`);
      return result;
    } catch (error) {
      const errorDetails = `File: ${filePath.split('/').pop()}\n\nError Message: ${error.message}\n\nError Type: ${error.name || 'Unknown'}\n\nModule: ${this.nativeModule ? 'Available' : 'Not Available'}\n\nPlatform: ${Platform.OS}\n\nFunction: extractGoldTransactions\n\nStack:\n${error.stack?.substring(0, 300) || 'N/A'}`;
      console.error('❌ [PdfProcessor] Native extraction failed:', error);
      Alert.alert(
        '❌ PDF Extraction Failed',
        errorDetails,
        [{ text: 'OK' }]
      );
      throw error;
    }
  }

  // REMOVED: JavaScript fallback - Native module is REQUIRED for PDF processing
  // REMOVED: parseTransactionsFromText - not needed without JS fallback

  /**
   * Validate and normalize transaction data
   * @param {Array} rawTransactions - Raw transaction data
   * @returns {Array} Validated transactions
   */
  validateTransactions(rawTransactions) {
    if (!Array.isArray(rawTransactions)) {
      return [];
    }

    return rawTransactions
      .filter(t => {
        // Required fields validation
        if (!t.weight || !t.amount || !t.type) {
          console.warn('Skipping invalid transaction:', t);
          return false;
        }
        
        const weight = parseFloat(t.weight);
        const amount = parseFloat(t.amount);
        
        if (isNaN(weight) || isNaN(amount) || weight <= 0 || amount <= 0) {
          console.warn('Skipping transaction with invalid numbers:', t);
          return false;
        }
        
        return true;
      })
      .map(t => ({
        'Transaction Date': t.date || '',
        'Time': t.time || '',
        'Transaction ID': t.transactionId || this.generateTempId(t),
        'Weight of Gold': parseFloat(t.weight),
        'Type': (t.type || '').toUpperCase(),
        'Amount': parseFloat(t.amount),
        'UTR No': t.utrNumber || t.utr || '',
        'Account': t.account || ''
      }));
  }

  /**
   * Generate temporary transaction ID if not available
   * @param {Object} transaction - Transaction object
   * @returns {string}
   */
  generateTempId(transaction) {
    const date = transaction.date || new Date().toISOString();
    const weight = transaction.weight || '0';
    const amount = transaction.amount || '0';
    const hash = `${date}_${weight}_${amount}`.replace(/[^a-zA-Z0-9]/g, '');
    return `TEMP_${hash}`;
  }

  // REMOVED: extractRawText and extractRawTextWithJS - no non-native fallbacks
  // Use extractRawTextFromPath instead for direct file path access

  /**
   * Filter transactions to only include those not in existing set
   * @param {Array} transactions - Array of transactions
   * @param {Set<string>} existingTransactionIds - Set of existing transaction IDs
   * @returns {Array} - Filtered array of new transactions only
   */
  filterNewTransactions(transactions, existingTransactionIds) {
    if (!existingTransactionIds || existingTransactionIds.size === 0) {
      return transactions;
    }

    const newTransactions = transactions.filter(txn => {
      if (!txn.transactionId) {
        console.warn('⚠️ Transaction missing ID, skipping:', txn);
        return false;
      }
      return !existingTransactionIds.has(txn.transactionId);
    });

    const skippedCount = transactions.length - newTransactions.length;
    if (skippedCount > 0) {
      console.log(`⏭️ Filtered out ${skippedCount} duplicate transactions`);
    }

    return newTransactions;
  }

  /**
   * Extract transactions from a file path (for batch processing)
   * @param {string} filePath - File path (can be direct path, not requiring copy)
   * @returns {Promise<Array>} - Array of transactions
   */
  async extractTransactionsFromPath(filePath) {
    const fileName = filePath.split('/').pop();
    
    try {
      console.log(`🔍 Extracting from: ${fileName}`);
      
      if (!this.nativeModule) {
        const errorMsg = 'Native PDF processor not available';
        console.error('❌', errorMsg);
        Alert.alert(
          '❌ Native Module Missing',
          `${errorMsg}\n\nFile: ${fileName}\n\nCannot process PDFs without native module.`,
          [{ text: 'OK' }]
        );
        throw new Error(errorMsg);
      }

      const cleanPath = filePath.replace(/^file:\/\//, '');
      const transactions = await this.nativeModule.extractGoldTransactions(cleanPath);
      const validated = this.validateTransactions(transactions);
      
      console.log(`✅ ${fileName}: ${validated.length} transactions`);
      return validated;
    } catch (error) {
      const errorMsg = `Failed to extract from ${fileName}: ${error.message}`;
      console.error('❌', errorMsg);
      Alert.alert(
        '❌ Extraction Failed',
        `${errorMsg}\n\nError Type: ${error.name}\nStack: ${error.stack?.substring(0, 200) || 'N/A'}`,
        [{ text: 'OK' }]
      );
      throw error;
    }
  }

  /**
   * Extract raw text from file path
   * @param {string} filePath - File path
   * @returns {Promise<string>} - Extracted text
   */
  async extractRawTextFromPath(filePath) {
    try {
      if (!this.nativeModule) {
        throw new Error('Native PDF processor not available');
      }
      const cleanPath = filePath.replace(/^file:\/\//, '');
      return await this.nativeModule.extractRawText(cleanPath);
    } catch (error) {
      const errorMsg = `Failed to extract text: ${error.message}`;
      console.error('❌', errorMsg);
      Alert.alert(
        '❌ Text Extraction Failed',
        `${errorMsg}\n\nFile: ${filePath.split('/').pop()}`,
        [{ text: 'OK' }]
      );
      return `Error: ${error.message}`;
    }
  }

  /**
   * Check if native module is available
   * @returns {boolean}
   */
  isNativeModuleAvailable() {
    return this.nativeModule !== null;
  }
}

// Export singleton instance
const pdfProcessor = new PdfProcessorService();
export default pdfProcessor;
