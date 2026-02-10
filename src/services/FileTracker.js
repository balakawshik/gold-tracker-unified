/**
 * FileTracker Service
 * 
 * Manages file hashing and processing manifest to track which PDFs have been processed.
 * Uses SHA-256 hashing to detect file changes and prevent duplicate processing.
 */

import { NativeModules } from 'react-native';

const { FileSystemModule } = NativeModules;

const MANIFEST_FILE = 'processed_files.json';

/**
 * Calculate SHA-256 hash of a file
 * @param {string} fileUri - File path
 * @returns {Promise<string>} - Hash string
 */
export async function calculateFileHash(fileUri) {
  try {
    if (!FileSystemModule) {
      throw new Error('FileSystemModule not available - native module required');
    }
    const cleanPath = fileUri.startsWith('file://') ? fileUri.substring(7) : fileUri;
    console.log(`🔐 [FileTracker] Calculating hash for: ${cleanPath}`);
    const hash = await FileSystemModule.calculateSHA256(cleanPath);
    console.log(`✅ [FileTracker] Hash: ${hash.substring(0, 16)}...`);
    return hash;
  } catch (error) {
    console.error('❌ [FileTracker] Error calculating file hash:', error);
    throw new Error(`Cannot calculate file hash: ${error.message}`);
  }
}

/**
 * Load processing manifest from Gold Tracker folder
 * @param {string} goldTrackerPath - Gold Tracker folder path
 * @returns {Promise<Object>} - Manifest object with files array
 */
export async function loadManifest(goldTrackerPath) {
  try {
    if (!FileSystemModule) {
      throw new Error('FileSystemModule not available - native module required');
    }
    
    const manifestPath = `${goldTrackerPath}/${MANIFEST_FILE}`;
    console.log(`📋 [FileTracker] Loading manifest from: ${manifestPath}`);
    
    // Use native module to read file
    const content = await FileSystemModule.readTextFile(manifestPath);
    const manifest = JSON.parse(content);
    console.log(`✅ [FileTracker] Loaded manifest with ${manifest.files?.length || 0} entries`);
    return manifest;
  } catch (error) {
    // File doesn't exist or read error - return empty manifest
    if (error.message?.includes('not found') || error.message?.includes('FILE_NOT_FOUND')) {
      console.log(`⚠️ [FileTracker] Manifest not found, creating empty manifest`);
      return { files: [] };
    }
    console.error('❌ [FileTracker] Error loading manifest:', error);
    console.log(`⚠️ [FileTracker] Returning empty manifest due to error`);
    return { files: [] };
  }
}

/**
 * Save processing manifest to Gold Tracker folder
 * @param {string} goldTrackerPath - Gold Tracker folder path
 * @param {Object} manifest - Manifest object
 */
export async function saveManifest(goldTrackerPath, manifest) {
  try {
    if (!FileSystemModule) {
      throw new Error('FileSystemModule not available - native module required');
    }
    
    const manifestPath = `${goldTrackerPath}/${MANIFEST_FILE}`;
    console.log(`💾 [FileTracker] Saving manifest to: ${manifestPath}`);
    console.log(`💾 [FileTracker] Manifest has ${manifest.files?.length || 0} entries`);
    
    const content = JSON.stringify(manifest, null, 2);
    await FileSystemModule.writeTextFile(manifestPath, content);
    console.log('✅ [FileTracker] Manifest saved successfully');
  } catch (error) {
    console.error('❌ [FileTracker] Error saving manifest:', error);
    throw new Error(`Cannot save manifest: ${error.message}`);
  }
}

/**
 * Get file processing status
 * @param {string} fileName - File name
 * @param {string} hash - File hash
 * @param {Set<string>} existingTransactionIds - Set of existing transaction IDs
 * @param {Array} extractedTransactions - Transactions extracted from PDF
 * @param {Object} manifest - Current manifest
 * @returns {Object} - Status object
 */
export function getFileStatus(fileName, hash, existingTransactionIds, extractedTransactions, manifest) {
  // Find file in manifest
  const manifestEntry = manifest.files.find(f => f.name === fileName);
  
  // Check if hash matches
  const hashMatch = manifestEntry && manifestEntry.hash === hash;
  
  // Count how many transactions already exist
  let existingTxnCount = 0;
  if (extractedTransactions && extractedTransactions.length > 0) {
    existingTxnCount = extractedTransactions.filter(txn => {
      const id = txn['Transaction ID'];
      return id && existingTransactionIds.has(id);
    }).length;
  }
  
  const totalTxnCount = extractedTransactions ? extractedTransactions.length : 0;
  const allExist = totalTxnCount > 0 && existingTxnCount === totalTxnCount;
  
  // Determine status
  let status, reason;
  
  if (!manifestEntry) {
    status = 'new';
    reason = 'Hash not found in manifest';
  } else if (!hashMatch) {
    status = 'modified';
    reason = `Hash changed (was: ${manifestEntry.hash.substring(0, 8)}...)`;
  } else if (allExist) {
    status = 'processed';
    reason = `All ${totalTxnCount} transactions already exist in CSV`;
  } else if (existingTxnCount > 0) {
    status = 'partial';
    reason = `${existingTxnCount} of ${totalTxnCount} transactions already exist`;
  } else {
    status = 'new';
    reason = 'Ready to process';
  }
  
  return {
    status,
    hashMatch,
    existingTxnCount,
    totalTxnCount,
    newTxnCount: totalTxnCount - existingTxnCount,
    reason
  };
}

/**
 * Update manifest with processed file info
 * @param {Object} manifest - Current manifest
 * @param {string} fileName - File name
 * @param {string} hash - File hash
 * @param {number} newTransactionCount - Number of new transactions added
 * @returns {Object} - Updated manifest
 */
export function updateManifest(manifest, fileName, hash, newTransactionCount) {
  // Always update manifest when function is called - tracks that file was processed
  // even if it contained 0 new transactions (all duplicates)
  const now = new Date().toISOString();
  const existingIndex = manifest.files.findIndex(f => f.name === fileName);
  
  const entry = {
    name: fileName,
    hash: hash,
    processedAt: now,
    transactionCount: newTransactionCount
  };
  
  if (existingIndex >= 0) {
    // Update existing entry
    manifest.files[existingIndex] = entry;
    console.log(`✅ Updated manifest entry for ${fileName} (${newTransactionCount} new transactions)`);
  } else {
    // Add new entry
    manifest.files.push(entry);
    console.log(`✅ Added manifest entry for ${fileName} (${newTransactionCount} new transactions)`);
  }
  
  return manifest;
}

/**
 * Check if a file has been processed (hash exists in manifest)
 * @param {string} fileName - File name
 * @param {string} hash - File hash
 * @param {Object} manifest - Current manifest
 * @returns {boolean} - True if file processed with same hash
 */
export function isFileProcessed(fileName, hash, manifest) {
  const entry = manifest.files.find(f => f.name === fileName);
  return entry && entry.hash === hash;
}

/**
 * Filter transactions to only include new ones (not already in CSV)
 * @param {Array} transactions - Array of transactions from PDF
 * @param {Set<string>} existingTransactionIds - Set of existing transaction IDs
 * @returns {Array} - Array of new transactions only
 */
export function filterNewTransactions(transactions, existingTransactionIds) {
  console.log(`🔍 [FileTracker] Filtering transactions...`);
  console.log(`🔍 [FileTracker] Input: ${transactions?.length || 0} transactions`);
  console.log(`🔍 [FileTracker] Existing IDs: ${existingTransactionIds?.size || 0}`);
  
  if (!transactions || transactions.length === 0) {
    console.log(`⚠️ [FileTracker] No transactions to filter`);
    return [];
  }
  
  if (!existingTransactionIds) {
    console.log(`⚠️ [FileTracker] No existing IDs provided, returning all transactions`);
    return transactions;
  }
  
  const newTransactions = transactions.filter(txn => {
    const id = txn['Transaction ID'];
    if (!id) {
      console.warn('⚠️ [FileTracker] Transaction missing ID:', txn);
      return false;
    }
    return !existingTransactionIds.has(id);
  });
  
  console.log(`✅ [FileTracker] Filtered: ${transactions.length} total -> ${newTransactions.length} new`);
  return newTransactions;
}

export default {
  calculateFileHash,
  loadManifest,
  saveManifest,
  getFileStatus,
  updateManifest,
  isFileProcessed,
  filterNewTransactions
};
