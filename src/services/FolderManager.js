/**
 * FolderManager Service
 * 
 * Manages Gold Tracker folder creation and file operations.
 * Handles folder selection and ensures proper folder structure.
 */

import { NativeModules, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

const { FileSystemModule } = NativeModules;

const GOLD_TRACKER_FOLDER = 'Gold Tracker';

/**
 * Get default Downloads folder path
 * @returns {Promise<string>} - Downloads folder path
 */
export async function getDefaultDownloadsPath() {
  try {
    if (!FileSystemModule) {
      throw new Error('FileSystemModule not available - native module required');
    }
    const path = await FileSystemModule.getDownloadsPath();
    return path;
  } catch (error) {
    console.error('Error getting downloads path:', error);
    throw new Error(`Cannot get downloads path: ${error.message}`);
  }
}

/**
 * Ensure Gold Tracker folder exists in specified base path
 * @param {string} basePath - Base folder path
 * @returns {Promise<string>} - Gold Tracker folder path
 */
export async function ensureGoldTrackerFolder(basePath) {
  try {
    if (!FileSystemModule) {
      throw new Error('FileSystemModule not available - native module required');
    }
    const goldTrackerPath = await FileSystemModule.ensureGoldTrackerFolder(basePath);
    console.log('✅ Gold Tracker folder ready:', goldTrackerPath);
    return goldTrackerPath;
  } catch (error) {
    console.error('Error ensuring Gold Tracker folder:', error);
    throw new Error(`Cannot create Gold Tracker folder: ${error.message}`);
  }
}

/**
 * Get Gold Tracker folder path from base path
 * @param {string} basePath - Base folder path
 * @returns {string} - Gold Tracker folder path
 */
export function getGoldTrackerPath(basePath) {
  return `${basePath}/${GOLD_TRACKER_FOLDER}`;
}

/**
 * List PDF files in folder that match PhonePe_Statement pattern
 * @param {string} folderPath - Folder path to scan
 * @returns {Promise<Array>} - Array of file paths
 */
export async function listPhonePeStatements(folderPath) {
  try {
    console.log('📁 Scanning folder for PhonePe PDFs:', folderPath);
    
    if (!FileSystemModule) {
      throw new Error('FileSystemModule not available - native module required');
    }
    
    const files = await FileSystemModule.listPdfFiles(folderPath);
    console.log(`✅ Found ${files.length} PhonePe PDF files`);
    return files;
  } catch (error) {
    console.error('❌ Error listing PDF files:', error);
    throw new Error(`Cannot list PDF files: ${error.message}`);
  }
}

/**
 * List all files in folder (for debugging)
 * @param {string} folderPath - Folder path to scan
 * @returns {Promise<Array>} - Array of file info objects
 */
export async function listAllFiles(folderPath) {
  try {
    if (!FileSystemModule) {
      throw new Error('FileSystemModule not available - native module required');
    }
    const files = await FileSystemModule.listAllFiles(folderPath);
    return files;
  } catch (error) {
    console.error('Error listing all files:', error);
    throw new Error(`Cannot list files: ${error.message}`);
  }
}

/**
 * Copy file to Gold Tracker folder
 * @param {string} sourceFilePath - Source file path
 * @param {string} goldTrackerPath - Gold Tracker folder path
 * @param {string} fileName - File name
 * @returns {Promise<string>} - Destination file path
 */
export async function copyToGoldTracker(sourceFilePath, goldTrackerPath, fileName) {
  try {
    if (!FileSystemModule) {
      throw new Error('FileSystemModule not available - native module required');
    }
    
    const cleanPath = sourceFilePath.startsWith('file://') 
      ? sourceFilePath.substring(7) 
      : sourceFilePath;
    
    const destPath = await FileSystemModule.copyToGoldTracker(
      cleanPath,
      goldTrackerPath,
      fileName
    );
    
    console.log(`✅ File copied to: ${destPath}`);
    return destPath;
  } catch (error) {
    console.error('Error copying file:', error);
    throw new Error(`Cannot copy file to Gold Tracker: ${error.message}`);
  }
}

/**
 * Check if file exists
 * @param {string} filePath - File path to check
 * @returns {Promise<boolean>} - True if file exists
 */
export async function fileExists(filePath) {
  try {
    return await FileSystemModule.fileExists(filePath);
  } catch (error) {
    return false;
  }
}

/**
 * Get file name from path
 * @param {string} filePath - Full file path
 * @returns {string} - File name only
 */
export function getFileName(filePath) {
  return filePath.split('/').pop();
}

/**
 * Request folder selection from user
 * Note: This is a placeholder - actual implementation may require
 * additional permissions or documentation for Android 11+ Storage Access Framework
 * @returns {Promise<string|null>} - Selected folder path or null if cancelled
 */
export async function pickFolder() {
  try {
    // For now, we'll use Downloads as default
    // Full folder picker implementation would require SAF integration
    const downloadsPath = await getDefaultDownloadsPath();
    return downloadsPath;
  } catch (error) {
    console.error('Error picking folder:', error);
    return null;
  }
}

export default {
  getDefaultDownloadsPath,
  ensureGoldTrackerFolder,
  getGoldTrackerPath,
  listPhonePeStatements,
  listAllFiles,
  copyToGoldTracker,
  fileExists,
  getFileName,
  pickFolder
};
