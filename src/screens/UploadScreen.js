/**
 * Upload & Process Screen - Batch PDF Processing
 * Allows users to select folder, scan for PhonePe PDFs, and batch process them
 * Shows file status, processing logs, and handles deduplication
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  PermissionsAndroid,
  Linking,
  NativeModules,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

const { FileSystemModule } = NativeModules;

// Services
import PdfProcessor from '../services/PdfProcessor';
import DataStorage from '../services/DataStorage';
import FolderManager from '../services/FolderManager';
import FileTracker from '../services/FileTracker';
import CsvManager from '../services/CsvManager';

// Components
import ProcessingLogModal from '../components/ProcessingLogModal';

export default function UploadScreen({ onDataLoaded }) {
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [hasPermissions, setHasPermissions] = useState(false);
  const [hasAllFilesAccess, setHasAllFilesAccess] = useState(false);
  
  // Processing state
  const [processing, setProcessing] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [processingLogs, setProcessingLogs] = useState([]);
  const [progress, setProgress] = useState(null);
  const [processingComplete, setProcessingComplete] = useState(false);
  
  // View state
  const [viewingFile, setViewingFile] = useState(null);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);

  const addLog = (type, message, details = null) => {
    const log = {
      type, // success, error, skip, processing, info
      message,
      details,
      timestamp: Date.now()
    };
    setProcessingLogs(prev => [...prev, log]);
  };

  /**
   * Check if app has All Files Access permission (Android 11+)
   */
  const checkAllFilesAccess = async () => {
    if (Platform.OS !== 'android') {
      setHasAllFilesAccess(true);
      return true;
    }

    try {
      // Check if MANAGE_EXTERNAL_STORAGE is available (Android 11+)
      if (Platform.Version >= 30) {
        const hasAccess = await FileSystemModule.checkManageStoragePermission();
        console.log('📋 All Files Access:', hasAccess);
        setHasAllFilesAccess(hasAccess);
        return hasAccess;
      } else {
        // For Android 10 and below, check regular storage permissions
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
        );
        setHasAllFilesAccess(granted);
        return granted;
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      setHasAllFilesAccess(false);
      return false;
    }
  };

  /**
   * Request All Files Access permission
   */
  const requestAllFilesAccess = async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      if (Platform.Version >= 30) {
        // Android 11+ requires special All Files Access
        Alert.alert(
          '📁 Storage Permission Required',
          'Gold Tracker needs "All Files Access" to scan your Downloads folder.\n\nThis will open a Settings page where you enable "Allow access to manage all files".',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Grant Permission',
              onPress: async () => {
                try {
                  // Open MANAGE_ALL_FILES_ACCESS_PERMISSION settings (Android 11+)
                  const packageName = 'com.goldtracker.unified';
                  const url = `android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION?package=${packageName}`;
                  
                  const canOpen = await Linking.canOpenURL(url);
                  if (canOpen) {
                    await Linking.openURL(url);
                  } else {
                    // Fallback to general settings
                    await Linking.openSettings();
                  }
                  
                  // Check permission after user returns (2 seconds)
                  setTimeout(async () => {
                    const hasAccess = await checkAllFilesAccess();
                    if (hasAccess) {
                      Alert.alert('✅ Permission Granted!', 'You can now scan your Downloads folder for PhonePe PDFs.');
                      setHasAllFilesAccess(true);
                      setHasPermissions(true);
                    } else {
                      Alert.alert('⚠️ Permission Not Granted', 'Please enable "All files access" in Settings to use folder scanning.\n\nGo to: Settings > Apps > Gold Tracker > Permissions > Files and media > Allow access to manage all files');
                    }
                  }, 2000);
                } catch (err) {
                  console.error('Error opening settings:', err);
                  Alert.alert('Error', 'Could not open settings.\n\nPlease go to:\nSettings > Apps > Gold Tracker > Permissions > Files and media > Allow access to manage all files');
                }
              }
            }
          ]
        );
        return false;
      } else {
        // Android 10 and below - request regular storage permission
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
        );
        const hasAccess = granted === PermissionsAndroid.RESULTS.GRANTED;
        setHasAllFilesAccess(hasAccess);
        return hasAccess;
      }
    } catch (err) {
      console.error('Error requesting permission:', err);
      return false;
    }
  };

  /**
   * Check permissions on mount
   */
  useEffect(() => {
    checkAllFilesAccess();
  }, []);

  /**
   * Request storage permissions for Android 13+
   */
  const requestStoragePermissions = async () => {
    if (Platform.OS !== 'android') {
      setHasPermissions(true);
      return true;
    }

    try {
      const androidVersion = Platform.Version;
      console.log('📱 Android Version:', androidVersion);

      if (androidVersion >= 30) {
        // Android 11+ (API 30+) - Need MANAGE_EXTERNAL_STORAGE
        console.log('📋 Requesting MANAGE_EXTERNAL_STORAGE permission...');
        
        Alert.alert(
          'Storage Permission Required',
          'This app needs "All files access" permission to scan your Downloads folder for PhonePe PDFs.\n\nYou will be taken to Settings to grant this permission.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setHasPermissions(false) },
            {
              text: 'Open Settings',
              onPress: async () => {
                try {
                  // Open app settings
                  await Linking.openSettings();
                  
                  // Show instruction
                  setTimeout(() => {
                    Alert.alert(
                      'Grant Permission',
                      '1. Tap "Permissions"\n2. Enable "Files and media" or "All files access"\n3. Return to the app',
                      [{ text: 'Done', onPress: () => setHasPermissions(true) }]
                    );
                  }, 500);
                } catch (err) {
                  console.error('Failed to open settings:', err);
                  Alert.alert('Error', 'Please manually enable storage permissions in Settings > Apps > Gold Tracker > Permissions');
                }
              }
            }
          ]
        );
        return false; // User needs to grant manually
      } else {
        // Android 10 and below
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        ]);
        
        const allGranted = Object.values(granted).every(
          status => status === PermissionsAndroid.RESULTS.GRANTED
        );
        
        setHasPermissions(allGranted);
        return allGranted;
      }
    } catch (err) {
      console.error('❌ Error requesting permissions:', err);
      Alert.alert('Error', `Failed to request permissions: ${err.message}`);
      return false;
    }
  };

  /**
   * Check permissions on mount and request if needed
   */
  useEffect(() => {
    const checkAndRequestPermissions = async () => {
      if (Platform.OS !== 'android') {
        setHasPermissions(true);
        setHasAllFilesAccess(true);
        return;
      }

      const androidVersion = Platform.Version;
      console.log('📱 Android Version:', androidVersion);
      
      if (androidVersion >= 30) {
        // Android 11+ - Check MANAGE_EXTERNAL_STORAGE
        const hasAccess = await checkAllFilesAccess();
        
        if (!hasAccess) {
          // Show permission request on app launch
          setTimeout(() => {
            Alert.alert(
              '📁 Storage Access Required',
              'Gold Tracker needs access to your files to scan for PhonePe PDF statements.\n\nPlease grant "All files access" permission in the next screen.',
              [
                { 
                  text: 'Not Now', 
                  style: 'cancel',
                  onPress: () => {
                    setHasAllFilesAccess(false);
                    setHasPermissions(false);
                  }
                },
                {
                  text: 'Grant Access',
                  onPress: async () => {
                    await requestAllFilesAccess();
                  }
                }
              ]
            );
          }, 1000);
        } else {
          setHasPermissions(true);
          setHasAllFilesAccess(true);
        }
      } else {
        // Android 10 and below - Request basic storage permissions
        try {
          const readGranted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
          );
          const writeGranted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
          );
          
          setHasPermissions(readGranted && writeGranted);
          setHasAllFilesAccess(readGranted && writeGranted);
          
          if (!readGranted || !writeGranted) {
            // Auto-request on mount
            setTimeout(() => requestStoragePermissions(), 500);
          }
        } catch (err) {
          console.warn('Error checking permissions:', err);
        }
      }
    };

    checkAndRequestPermissions();
  }, []);

  /**
   * Convert content URI to file path and extract folder
   */
  const getFilePathFromUri = async (uri) => {
    try {
      console.log('📄 Processing URI:', uri);
      
      // Handle content:// URIs
      if (uri.startsWith('content://')) {
        // For content URIs, we can't get the real path directly
        // Use Downloads as fallback
        const downloadsPath = await FolderManager.getDefaultDownloadsPath();
        console.log('📂 Using Downloads folder for content URI:', downloadsPath);
        return downloadsPath;
      }
      
      // Handle file:// URIs
      let filePath = uri;
      if (filePath.startsWith('file://')) {
        filePath = filePath.substring(7);
      }
      
      // Extract parent folder
      const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
      console.log('📂 Extracted folder:', folderPath);
      return folderPath;
    } catch (error) {
      console.error('❌ Error processing URI:', error);
      // Fallback to Downloads
      const downloadsPath = await FolderManager.getDefaultDownloadsPath();
      console.log('📂 Fallback to Downloads:', downloadsPath);
      return downloadsPath;
    }
  };

  /**
   * Handle folder selection - use Downloads by default
   */
  const handleUseDownloadsFolder = async () => {
    //Check and request All Files Access first
    const hasAccess = await checkAllFilesAccess();
    if (!hasAccess) {
      await requestAllFilesAccess();
      return;
    }

    try {
      setLoading(true);
      setSelectedFolder(null);
      setFiles([]);
      
      // Get Downloads folder path directly
      const downloadsPath = await FolderManager.getDefaultDownloadsPath();
      console.log('📂 Downloads folder:', downloadsPath);
      
      setSelectedFolder(downloadsPath);
      await scanFolder(downloadsPath);
    } catch (error) {
      console.error('❌ Error accessing Downloads:', error);
      Alert.alert('Error', `Cannot access Downloads folder:\n\n${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle custom folder picker
   * Workaround: Pick any file in the folder, extract folder path
   */
  const handlePickFolder = async () => {
    // Check and request permissions first
    if (!hasPermissions) {
      const granted = await requestStoragePermissions();
      if (!granted) {
        return;
      }
    }
    
    Alert.alert(
      'Select Folder',
      'Please select ANY file in the folder containing your PhonePe PDFs.\n\nThe app will scan that folder for all PhonePe_Statement*.pdf files.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pick File',
          onPress: async () => {
            try {
              setLoading(true);
              setSelectedFolder(null);
              setFiles([]);
              
              // Use document picker to select a file
              const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: false,
              });

              if (result.canceled) {
                setLoading(false);
                return;
              }

              // Get folder path from file URI
              const fileUri = result.assets[0].uri;
              const folderPath = await getFilePathFromUri(fileUri);
              
              console.log('📌 Final folder path:', folderPath);
              
              setSelectedFolder(folderPath);
              await scanFolder(folderPath);
            } catch (error) {
              console.error('❌ Error processing file selection:', error);
              Alert.alert('Error', `Cannot select folder:\n\n${error.message}`);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  /**
   * Scan folder for PhonePe Statement PDFs and check their status
   */
  const scanFolder = async (folderUri) => {
    try {
      setScanning(true);
      
      console.log('📁 Scanning folder:', folderUri);
      
      // FIRST: List ALL files in folder for debugging (do this before anything else)
      let allFiles = [];
      try {
        allFiles = await FolderManager.listAllFiles(folderUri);
        console.log(`📋 Total files in folder: ${allFiles.length}`);
        allFiles.forEach(file => {
          console.log(`  ${file.isPdf ? '📄' : '📎'} ${file.name}`);
        });
      } catch (listError) {
        console.error('❌ Failed to list all files:', listError);
        Alert.alert(
          'Cannot Access Folder',
          `Failed to read folder contents:\n\n${listError.message}\n\nFolder: ${folderUri}\n\nPlease check:\n1. Storage permissions granted\n2. Folder path is correct\n3. App has access to this location`
        );
        return;
      }
      
      // Show files in popup for debugging
      const pdfCount = allFiles.filter(f => f.isPdf).length;
      let fileList = '';
      if (allFiles.length === 0) {
        fileList = '(Folder is empty or inaccessible)';
      } else {
        allFiles.slice(0, 20).forEach(file => {
          fileList += `${file.isPdf ? '📄' : '📎'} ${file.name}\n`;
        });
        if (allFiles.length > 20) {
          fileList += `\n... and ${allFiles.length - 20} more files`;
        }
      }
      
      // Show what we found
      Alert.alert(
        'Folder Contents',
        `Scanned: ${folderUri}\n\nTotal files: ${allFiles.length}\nPDF files: ${pdfCount}\n\n${fileList}`,
        [
          { 
            text: 'Cancel', 
            style: 'cancel',
            onPress: () => {
              setFiles([]);
              setScanning(false);
            }
          },
          { 
            text: 'Continue Scanning',
            onPress: () => continueScanWithPhonePeFilter(folderUri, allFiles)
          }
        ]
      );
      
    } catch (error) {
      console.error('❌ Error in scanFolder:', error);
      Alert.alert('Error', `Scan failed:\n\n${error.message}`);
      setScanning(false);
    }
  };
  
  /**
   * Continue scanning with PhonePe filter
   */
  const continueScanWithPhonePeFilter = async (folderUri, allFiles) => {
    try {
      // List PhonePe PDF files
      let pdfFiles = [];
      try {
        pdfFiles = await FolderManager.listPhonePeStatements(folderUri);
        console.log(`✅ Found ${pdfFiles.length} PhonePe PDFs`);
      } catch (error) {
        console.error('❌ Failed to list PhonePe files:', error);
        Alert.alert(
          'Scan Error',
          `Failed to filter PhonePe files:\n\n${error.message}`
        );
        setScanning(false);
        return;
      }
      
      if (pdfFiles.length === 0) {
        Alert.alert(
          'No PhonePe Statements Found',
          `No files matching "PhonePe_Statement*.pdf" pattern found.\n\nPlease ensure your PDF filenames start with "PhonePe_Statement" (case-sensitive).`
        );
        setFiles([]);
        setScanning(false);
        return;
      }
      
      // Try to ensure Gold Tracker folder exists (non-blocking)
      let goldTrackerUri;
      try {
        goldTrackerUri = await FolderManager.ensureGoldTrackerFolder(folderUri);
        console.log('✅ Gold Tracker folder:', goldTrackerUri);
      } catch (error) {
        console.error('⚠️ Could not create Gold Tracker folder:', error);
        // Continue anyway - we can still show file list
        goldTrackerUri = FolderManager.getGoldTrackerPath(folderUri);
        Alert.alert(
          'Warning',
          `Cannot create Gold Tracker folder (write permission issue).\n\nYou can view files but processing may fail.\n\n${error.message}`,
          [{ text: 'OK' }]
        );
      }

      // Load manifest and CSV
      const manifest = await FileTracker.loadManifest(goldTrackerUri);
      const csvTransactions = await CsvManager.readCSV(goldTrackerUri);
      const existingTransactionIds = CsvManager.extractTransactionIds(csvTransactions);

      // Process each file to get status
      const filesWithStatus = await Promise.all(
        pdfFiles.map(async (filePath) => {
          const fileName = FolderManager.getFileName(filePath);
          
          try {
            // Calculate hash
            const hash = await FileTracker.calculateFileHash(filePath);
            
            // Extract transactions (quick check)
            let extractedTransactions = [];
            try {
              addLog('info', `🔍 Extracting transactions from ${fileName}...`);
              extractedTransactions = await PdfProcessor.extractTransactionsFromPath(filePath);
              addLog('success', `✅ Extracted ${extractedTransactions.length} transactions from ${fileName}`);
            } catch (error) {
              console.warn(`Could not extract transactions from ${fileName}:`, error.message);
              const extractError = `File: ${fileName}\n\nError: ${error.message}\n\nError Type: ${error.name}\n\nStack: ${error.stack?.substring(0, 200) || 'N/A'}\n\nThis file may be skipped during processing.`;
              addLog('error', `⚠️ Extraction failed for ${fileName}`, extractError);
              Alert.alert(
                '⚠️ PDF Extraction Warning',
                extractError,
                [{ text: 'OK' }]
              );
            }

            // Get file status
            const status = FileTracker.getFileStatus(
              fileName,
              hash,
              existingTransactionIds,
              extractedTransactions,
              manifest
            );

            return {
              name: fileName,
              uri: filePath,
              hash,
              status: status.status,
              statusReason: status.reason,
              existingTxnCount: status.existingTxnCount,
              totalTxnCount: status.totalTxnCount,
              newTxnCount: status.newTxnCount,
              extractedTransactions
            };
          } catch (error) {
            console.error(`❌ Error processing ${fileName}:`, error);
            Alert.alert(
              '❌ File Processing Error',
              `File: ${fileName}\n\nError: ${error.message}\n\nType: ${error.name}\n\nStack: ${error.stack?.substring(0, 200) || 'N/A'}`,
              [{ text: 'OK' }]
            );
            return {
              name: fileName,
              uri: filePath,
              hash: null,
              status: 'error',
              statusReason: `Error: ${error.message}`,
              existingTxnCount: 0,
              totalTxnCount: 0,
              newTxnCount: 0,
              extractedTransactions: []
            };
          }
        })
      );

      setFiles(filesWithStatus);
      
      // Log file count for debugging
      console.log(`📊 Scan result: ${filesWithStatus.length} files processed`);
      if (filesWithStatus.length !== pdfFiles.length) {
        console.warn(`⚠️ File count mismatch: ${pdfFiles.length} PDFs found, ${filesWithStatus.length} processed`);
      }
      
      // Check for duplicate URIs (defensive check)
      const uniqueUris = new Set(filesWithStatus.map(f => f.uri));
      if (uniqueUris.size !== filesWithStatus.length) {
        console.error(`❌ DUPLICATE URIs DETECTED: ${filesWithStatus.length} files but only ${uniqueUris.size} unique URIs`);
        // Deduplicate by URI (keep last occurrence)
        const deduped = Array.from(
          filesWithStatus.reduce((map, file) => {
            map.set(file.uri, file);
            return map;
          }, new Map()).values()
        );
        console.log(`✅ Deduplication complete: ${deduped.length} unique files`);
        setFiles(deduped);
      }
      
      // Auto-select new/modified files
      const autoSelect = new Set();
      filesWithStatus.forEach(file => {
        if (file.status === 'new' || file.status === 'modified' || file.status === 'partial') {
          autoSelect.add(file.name);
        }
      });
      setSelectedFiles(autoSelect);

      Alert.alert(
        'Scan Complete',
        `Found ${pdfFiles.length} PDF files\n` +
        `✅ New: ${filesWithStatus.filter(f => f.status === 'new').length}\n` +
        `🟡 Modified: ${filesWithStatus.filter(f => f.status === 'modified').length}\n` +
        `🔵 Partial: ${filesWithStatus.filter(f => f.status === 'partial').length}\n` +
        `⚪ Processed: ${filesWithStatus.filter(f => f.status === 'processed').length}`
      );
    } catch (error) {
      console.error('❌ Error scanning folder:', error);
      Alert.alert(
        '❌ Scan Error',
        `Failed to scan folder\n\nError: ${error.message}\n\nType: ${error.name}\n\nStack: ${error.stack?.substring(0, 200) || 'N/A'}`,
        [{ text: 'OK' }]
      );
    } finally {
      setScanning(false);
    }
  };

  /**
   * Toggle file selection
   */
  const toggleFileSelection = (fileName) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileName)) {
      newSelection.delete(fileName);
    } else {
      newSelection.add(fileName);
    }
    setSelectedFiles(newSelection);
  };

  /**
   * Select all new/modified files
   */
  const selectAllNewModified = () => {
    const newSelection = new Set();
    files.forEach(file => {
      if (file.status === 'new' || file.status === 'modified' || file.status === 'partial') {
        newSelection.add(file.name);
      }
    });
    setSelectedFiles(newSelection);
  };

  /**
   * Open PDF file in external viewer
   */
  const handleOpenPdf = async (file) => {
    try {
      const fileUri = file.uri.startsWith('file://') ? file.uri : `file://${file.uri}`;
      const canOpen = await Linking.canOpenURL(fileUri);
      
      if (canOpen) {
        await Linking.openURL(fileUri);
      } else {
        Alert.alert(
          'Cannot Open PDF',
          'No PDF viewer app found. Please install a PDF reader app.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error opening PDF:', error);
      Alert.alert('Error', `Failed to open PDF: ${error.message}`);
    }
  };

  /**
   * View extracted transactions from PDF
   */
  const handleViewTransactions = async (file) => {
    if (!file.extractedTransactions || file.extractedTransactions.length === 0) {
      Alert.alert(
        'No Transactions',
        'No gold transactions found in this PDF, or the file has not been scanned yet.',
        [{ text: 'OK' }]
      );
      return;
    }

    setViewingFile(file);
    setShowTransactionsModal(true);
  };

  /**
   * Process selected files
   */
  const handleProcessSelectedFiles = async () => {
    if (selectedFiles.size === 0) {
      Alert.alert('No Files Selected', 'Please select at least one file to process.');
      return;
    }

    try {
      setProcessing(true);
      setProcessingComplete(false);
      setProcessingLogs([]);
      setShowLogModal(true);

      addLog('info', '📂 Ensuring Gold Tracker folder exists...');
      const goldTrackerUri = await FolderManager.ensureGoldTrackerFolder(selectedFolder);
      addLog('success', `✅ Gold Tracker folder: ${goldTrackerUri}`);
      
      addLog('info', '📄 Initializing CSV file...');
      await CsvManager.initializeCSV(goldTrackerUri);
      addLog('success', '✅ CSV file ready');

      // Load current state
      addLog('info', '📋 Loading manifest and existing transactions...');
      let manifest = await FileTracker.loadManifest(goldTrackerUri);
      let csvTransactions = await CsvManager.readCSV(goldTrackerUri);
      let existingTransactionIds = CsvManager.extractTransactionIds(csvTransactions);
      addLog('success', `✅ Found ${existingTransactionIds.size} existing transaction IDs`);

      const selectedFilesList = files.filter(f => selectedFiles.has(f.name));
      let totalNew = 0;
      let totalSkipped = 0;
      let totalErrors = 0;

      for (let i = 0; i < selectedFilesList.length; i++) {
        const file = selectedFilesList[i];
        
        setProgress({ current: i + 1, total: selectedFilesList.length });
        addLog('processing', `Processing ${file.name}...`);

        try {
          // Filter for new transactions only
          addLog('info', `🔍 Filtering new transactions for ${file.name}...`);
          
          if (!FileTracker.filterNewTransactions) {
            const errorMsg = 'FileTracker.filterNewTransactions is undefined! This function is missing.';
            console.error('❌', errorMsg);
            addLog('error', `❌ ${file.name}: ${errorMsg}`);
            Alert.alert(
              '❌ Critical Error',
              `Function Error: FileTracker.filterNewTransactions is not defined\n\nFile: ${file.name}\n\nThis is a code bug that needs to be fixed.`,
              [{ text: 'OK' }]
            );
            totalErrors++;
            continue;
          }
          
          const newTransactions = FileTracker.filterNewTransactions(
            file.extractedTransactions,
            existingTransactionIds
          );
          
          addLog('info', `Found ${newTransactions.length} new transactions out of ${file.extractedTransactions?.length || 0} total`);

          if (newTransactions.length === 0) {
            // Still update manifest so file is marked as processed
            addLog('info', `📝 Updating manifest for ${file.name} (all transactions are duplicates)...`);
            manifest = FileTracker.updateManifest(manifest, file.name, file.hash, 0);
            addLog(
              'skip',
              `Skipped ${file.name}`,
              `All ${file.totalTxnCount} transactions already exist in CSV`
            );
            totalSkipped++;
            continue;
          }

          // Copy file to Gold Tracker
          addLog('info', `📋 Copying ${file.name} to Gold Tracker...`);
          await FolderManager.copyToGoldTracker(file.uri, goldTrackerUri, file.name);
          addLog('success', `✅ File copied successfully`);

          // Append new transactions to CSV
          addLog('info', `💾 Appending ${newTransactions.length} transactions to CSV...`);
          await CsvManager.appendTransactions(goldTrackerUri, newTransactions);
          addLog('success', `✅ CSV updated`);

          // Update manifest
          addLog('info', `📝 Updating manifest...`);
          manifest = FileTracker.updateManifest(manifest, file.name, file.hash, newTransactions.length);
          addLog('success', `✅ Manifest updated`);

          // Update existing IDs set
          newTransactions.forEach(txn => {
            const id = txn['Transaction ID'];
            if (id) existingTransactionIds.add(id);
          });

          // Save to database
          addLog('info', `💿 Saving ${newTransactions.length} transactions to database...`);
          await DataStorage.saveTransactions(newTransactions);
          addLog('success', `✅ Database updated`);

          totalNew += newTransactions.length;
          addLog(
            'success',
            `✅ Processed ${file.name}`,
            `Added ${newTransactions.length} new transactions` +
            (file.existingTxnCount > 0 ? ` (skipped ${file.existingTxnCount} duplicates)` : '')
          );
        } catch (error) {
          console.error(`❌ Error processing ${file.name}:`, error);
          const errorDetails = `File: ${file.name}\n\nError Message: ${error.message}\n\nError Type: ${error.name}\n\nFunction: ${error.stack?.split('\n')[1]?.trim() || 'Unknown'}\n\nFull Stack:\n${error.stack?.substring(0, 400) || 'N/A'}`;
          addLog('error', `❌ Error processing ${file.name}`, errorDetails);
          Alert.alert(
            '❌ File Processing Error',
            errorDetails,
            [{ text: 'Continue', style: 'default' }, { text: 'Stop', style: 'cancel', onPress: () => { throw error; } }]
          );
          totalErrors++;
        }
      }

      // Save updated manifest
      addLog('info', '💾 Saving final manifest...');
      await FileTracker.saveManifest(goldTrackerUri, manifest);
      addLog('success', '✅ Manifest saved');

      // Reload all data
      addLog('info', '♻️ Reloading all transactions from database...');
      const allTransactions = await DataStorage.getAllTransactions();
      onDataLoaded(allTransactions);
      addLog('success', `✅ Loaded ${allTransactions.length} total transactions`);

      addLog('info', `📊 Processing complete`, 
        `New transactions: ${totalNew} | Skipped: ${totalSkipped} | Errors: ${totalErrors}`);
      
      setProcessingComplete(true);
      setProgress(null);

      // Rescan folder to update status
      await scanFolder(selectedFolder);
    } catch (error) {
      console.error('❌ Error processing files:', error);
      const errorDetails = `Error Message: ${error.message}\n\nError Type: ${error.name}\n\nFunction: ${error.stack?.split('\n')[1]?.trim() || 'Unknown'}\n\nFull Stack:\n${error.stack?.substring(0, 400) || 'N/A'}`;
      addLog('error', '❌ Processing failed', errorDetails);
      Alert.alert(
        '❌ Processing Failed - Critical Error',
        `The batch processing stopped due to an error:\n\n${errorDetails}`,
        [{ text: 'OK' }]
      );
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Render file item
   */
  const renderFileItem = ({ item }) => {
    const isSelected = selectedFiles.has(item.name);
    
    const getStatusColor = (status) => {
      switch (status) {
        case 'new': return '#10b981';
        case 'modified': return '#f59e0b';
        case 'partial': return '#3b82f6';
        case 'processed': return '#9ca3af';
        case 'error': return '#ef4444';
        default: return '#6b7280';
      }
    };

    const getStatusIcon = (status) => {
      switch (status) {
        case 'new': return 'add-circle';
        case 'modified': return 'alert-circle';
        case 'partial': return 'information-circle';
        case 'processed': return 'checkmark-circle';
        case 'error': return 'close-circle';
        default: return 'help-circle';
      }
    };

    return (
      <View style={styles.fileItem}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => toggleFileSelection(item.name)}
        >
          <Ionicons
            name={isSelected ? 'checkbox' : 'square-outline'}
            size={24}
            color={isSelected ? '#7c3aed' : '#9ca3af'}
          />
        </TouchableOpacity>

        <View style={styles.fileInfo}>
          <Text style={styles.fileName}>{item.name}</Text>
          <View style={styles.statusRow}>
            <Ionicons
              name={getStatusIcon(item.status)}
              size={16}
              color={getStatusColor(item.status)}
            />
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status.toUpperCase()}
            </Text>
            {item.newTxnCount > 0 && (
              <Text style={styles.txnCount}>• {item.newTxnCount} new</Text>
            )}
          </View>
          <Text style={styles.statusReason}>{item.statusReason}</Text>
        </View>

        <View style={styles.fileActions}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => handleOpenPdf(item)}
          >
            <Ionicons name="eye-outline" size={20} color="#7c3aed" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => handleViewTransactions(item)}
          >
            <Ionicons name="document-text-outline" size={20} color="#7c3aed" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="folder-open-outline" size={48} color="#7c3aed" />
        <Text style={styles.title}>Batch PDF Processing</Text>
        <Text style={styles.subtitle}>
          Select folder with PhonePe statements to process multiple files at once
        </Text>
      </View>

      {/* Folder Selection Buttons */}
      {!selectedFolder && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleUseDownloadsFolder}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="download-outline" size={24} color="#fff" />
                <Text style={styles.buttonText}>Use Downloads Folder</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}  
            onPress={handlePickFolder}
            disabled={loading}
          >
            <Ionicons name="folder-outline" size={24} color="#7c3aed" />
            <Text style={[styles.buttonText, { color: '#7c3aed' }]}>Pick Custom Folder</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Folder Info & Rescan */}
      {selectedFolder && (
        <View style={styles.folderInfo}>
          <View style={styles.folderPathRow}>
            <Ionicons name="folder" size={20} color="#7c3aed" />
            <Text style={styles.folderPath} numberOfLines={1}>{selectedFolder}</Text>
          </View>
          <TouchableOpacity
            style={styles.rescanButton}
            onPress={() => scanFolder(selectedFolder)}
            disabled={scanning}
          >
            <Ionicons name="refresh" size={20} color="#7c3aed" />
            <Text style={styles.rescanText}>Rescan</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* File List */}
      {scanning ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7c3aed" />
          <Text style={styles.loadingText}>Scanning folder...</Text>
        </View>
      ) : files.length > 0 ? (
        <>
          {/* Selection Controls */}
          <View style={styles.selectionControls}>
            <Text style={styles.fileCount}>
              {files.length} files found • {selectedFiles.size} selected
            </Text>
            <TouchableOpacity onPress={selectAllNewModified}>
              <Text style={styles.selectAllText}>Select All New/Modified</Text>
            </TouchableOpacity>
          </View>

          {/* Files List */}
          <FlatList
            data={files}
            renderItem={renderFileItem}
            keyExtractor={(item) => item.uri || item.name}
            style={styles.fileList}
            contentContainerStyle={styles.fileListContent}
          />

          {/* Process Button */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[
                styles.processButton,
                (selectedFiles.size === 0 || processing) && styles.buttonDisabled
              ]}
              onPress={handleProcessSelectedFiles}
              disabled={selectedFiles.size === 0 || processing}
            >
              {processing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="play-circle" size={24} color="#fff" />
                  <Text style={styles.processButtonText}>
                    Process {selectedFiles.size} Selected Files
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      ) : selectedFolder ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-outline" size={64} color="#9ca3af" />
          <Text style={styles.emptyText}>No PhonePe Statement PDFs found</Text>
          <Text style={styles.emptySubtext}>
            Make sure your files are named starting with "PhonePe_Statement"
          </Text>
        </View>
      ) : null}

      {/* Processing Log Modal */}
      <ProcessingLogModal
        visible={showLogModal}
        logs={processingLogs}
        progress={progress}
        isComplete={processingComplete}
        onClose={() => setShowLogModal(false)}
        onViewCSV={() => {
          Alert.alert('CSV Location', `CSV saved to:\n${selectedFolder}/Gold Tracker/PYO Gold Statement.csv`);
        }}
      />

      {/* View Transactions Modal */}
      <Modal
        visible={showTransactionsModal}
        animationType="slide"
        onRequestClose={() => setShowTransactionsModal(false)}
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Extracted Transactions</Text>
            <TouchableOpacity onPress={() => setShowTransactionsModal(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          {viewingFile && (
            <>
              <View style={styles.fileInfoModal}>
                <Text style={styles.fileNameModal}>{viewingFile.name}</Text>
                <Text style={styles.fileStatsModal}>
                  {viewingFile.extractedTransactions.length} transactions found
                </Text>
              </View>

              <ScrollView style={styles.transactionsScroll}>
                {viewingFile.extractedTransactions.map((txn, index) => {
                  // Use standardized property names
                  const date = txn['Transaction Date'] || '';
                  const time = txn['Time'] || '';
                  const type = txn['Type'] || '';
                  const amount = txn['Amount'] || '';
                  const weight = txn['Weight of Gold'] || '';
                  const transactionId = txn['Transaction ID'] || '';
                  const utrNumber = txn['UTR No'] || '';
                  
                  const typeDisplay = type.toUpperCase() === 'DEBIT' 
                    ? '🛒 Buy (DEBIT)' 
                    : type.toUpperCase() === 'CREDIT' 
                      ? '💰 Sell (CREDIT)' 
                      : type.toUpperCase();
                  
                  return (
                    <View key={index} style={styles.transactionCard}>
                      <View style={styles.transactionHeader}>
                        <Text style={styles.transactionDate}>{date} {time}</Text>
                        <Text style={[
                          styles.transactionType,
                          { color: type.toUpperCase() === 'DEBIT' ? '#10b981' : '#ef4444' }
                        ]}>
                          {typeDisplay}
                        </Text>
                      </View>
                      <View style={styles.transactionRow}>
                        <Text style={styles.transactionLabel}>Amount:</Text>
                        <Text style={styles.transactionValue}>₹{amount}</Text>
                      </View>
                      <View style={styles.transactionRow}>
                        <Text style={styles.transactionLabel}>Gold:</Text>
                        <Text style={styles.transactionValue}>{weight}g</Text>
                      </View>
                      <View style={styles.transactionRow}>
                        <Text style={styles.transactionLabel}>UTR:</Text>
                        <Text style={styles.transactionValue}>{utrNumber}</Text>
                      </View>
                      <View style={styles.transactionRow}>
                        <Text style={styles.transactionLabel}>ID:</Text>
                        <Text style={styles.transactionId}>{transactionId}</Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1f2937',
  },
  header: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#374151',
    borderBottomWidth: 1,
    borderBottomColor: '#4b5563',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
  buttonContainer: {
    padding: 16,
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#7c3aed',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#7c3aed',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  folderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#374151',
    borderBottomWidth: 1,
    borderBottomColor: '#4b5563',
  },
  folderPathRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  folderPath: {
    flex: 1,
    color: '#e5e7eb',
    fontSize: 14,
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  rescanText: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9ca3af',
  },
  selectionControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#374151',
  },
  fileCount: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  selectAllText: {
    color: '#7c3aed',
    fontSize: 14,
    fontWeight: '600',
  },
  fileList: {
    flex: 1,
  },
  fileListContent: {
    padding: 16,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#7c3aed',
  },
  checkbox: {
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  txnCount: {
    fontSize: 12,
    color: '#9ca3af',
  },
  statusReason: {
    fontSize: 11,
    color: '#6b7280',
  },
  fileActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 8,
  },
  bottomBar: {
    padding: 16,
    backgroundColor: '#374151',
    borderTopWidth: 1,
    borderTopColor: '#4b5563',
  },
  processButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  processButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9ca3af',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#1f2937',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#374151',
    borderBottomWidth: 1,
    borderBottomColor: '#4b5563',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  fileInfoModal: {
    padding: 16,
    backgroundColor: '#374151',
    borderBottomWidth: 1,
    borderBottomColor: '#4b5563',
  },
  fileNameModal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  fileStatsModal: {
    fontSize: 14,
    color: '#9ca3af',
  },
  transactionsScroll: {
    flex: 1,
    padding: 16,
  },
  transactionCard: {
    backgroundColor: '#374151',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#7c3aed',
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#4b5563',
  },
  transactionDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  transactionType: {
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transactionLabel: {
    fontSize: 13,
    color: '#9ca3af',
  },
  transactionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  transactionId: {
    fontSize: 11,
    color: '#6b7280',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
