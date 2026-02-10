package com.goldtracker.unified;

import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;

public class FileSystemModule extends ReactContextBaseJavaModule {
    private static final String TAG = "FileSystemModule";
    private final ReactApplicationContext reactContext;

    public FileSystemModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "FileSystemModule";
    }

    @ReactMethod
    public void calculateSHA256(String filePath, Promise promise) {
        try {
            Log.d(TAG, "Calculating SHA256 for: " + filePath);
            
            File file = new File(filePath);
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "File not found: " + filePath);
                return;
            }

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            FileInputStream fis = new FileInputStream(file);
            byte[] buffer = new byte[8192];
            int bytesRead;

            while ((bytesRead = fis.read(buffer)) != -1) {
                digest.update(buffer, 0, bytesRead);
            }
            fis.close();

            byte[] hashBytes = digest.digest();
            StringBuilder hexString = new StringBuilder();
            for (byte b : hashBytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }

            String hash = hexString.toString();
            Log.d(TAG, "Hash calculated: " + hash);
            promise.resolve(hash);

        } catch (Exception e) {
            Log.e(TAG, "Error calculating hash: " + e.getMessage(), e);
            promise.reject("HASH_ERROR", "Failed to calculate hash: " + e.getMessage(), e);
        }
    }

    @ReactMethod
    public void checkManageStoragePermission(Promise promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // Android 11+ (API 30+)
                boolean hasPermission = Environment.isExternalStorageManager();
                Log.d(TAG, "MANAGE_EXTERNAL_STORAGE permission: " + hasPermission);
                promise.resolve(hasPermission);
            } else {
                // Android 10 and below - always return true (uses legacy permissions)
                promise.resolve(true);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error checking manage storage permission: " + e.getMessage(), e);
            promise.reject("PERMISSION_CHECK_ERROR", "Failed to check permission: " + e.getMessage(), e);
        }
    }

    @ReactMethod
    public void getDownloadsPath(Promise promise) {
        try {
            File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            String path = downloadsDir.getAbsolutePath();
            Log.d(TAG, "Downloads path: " + path);
            promise.resolve(path);
        } catch (Exception e) {
            Log.e(TAG, "Error getting downloads path: " + e.getMessage(), e);
            promise.reject("PATH_ERROR", "Failed to get downloads path: " + e.getMessage(), e);
        }
    }

    @ReactMethod
    public void listPdfFiles(String folderPath, Promise promise) {
        try {
            Log.d(TAG, "Listing PDF files in: " + folderPath);
            
            File folder = new File(folderPath);
            if (!folder.exists()) {
                promise.reject("FOLDER_NOT_FOUND", "Folder does not exist: " + folderPath);
                return;
            }
            
            if (!folder.isDirectory()) {
                promise.reject("NOT_A_FOLDER", "Path is not a directory: " + folderPath);
                return;
            }
            
            if (!folder.canRead()) {
                promise.reject("NO_READ_PERMISSION", "Cannot read folder (permission denied): " + folderPath);
                return;
            }

            File[] files = folder.listFiles();
            if (files == null) {
                promise.reject("LIST_FAILED", "Failed to list files (null result) - check permissions");
                return;
            }

            Log.d(TAG, "Total files in folder: " + files.length);
            
            WritableArray result = Arguments.createArray();
            int totalPdfs = 0;
            for (File file : files) {
                if (file.isFile() && file.getName().toLowerCase().endsWith(".pdf")) {
                    totalPdfs++;
                    Log.d(TAG, "Found PDF: " + file.getName());
                    // Check if filename starts with "PhonePe_Statement"
                    if (file.getName().startsWith("PhonePe_Statement")) {
                        result.pushString(file.getAbsolutePath());
                        Log.d(TAG, "  ✅ Matches PhonePe pattern");
                    } else {
                        Log.d(TAG, "  ❌ Does not match PhonePe_Statement* pattern");
                    }
                }
            }

            Log.d(TAG, "Total PDFs: " + totalPdfs + ", PhonePe PDFs: " + result.size());
            promise.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "Error listing files: " + e.getMessage(), e);
            promise.reject("LIST_ERROR", "Failed to list files: " + e.getMessage(), e);
        }
    }

    @ReactMethod
    public void listAllFiles(String folderPath, Promise promise) {
        try {
            Log.d(TAG, "Listing all files in: " + folderPath);
            
            File folder = new File(folderPath);
            if (!folder.exists() || !folder.isDirectory()) {
                promise.reject("INVALID_FOLDER", "Folder does not exist or is not a directory: " + folderPath);
                return;
            }

            File[] files = folder.listFiles();
            if (files == null) {
                promise.resolve(Arguments.createArray());
                return;
            }

            WritableArray result = Arguments.createArray();
            for (File file : files) {
                if (file.isFile()) {
                    WritableMap fileInfo = Arguments.createMap();
                    fileInfo.putString("name", file.getName());
                    fileInfo.putString("path", file.getAbsolutePath());
                    fileInfo.putDouble("size", file.length());
                    fileInfo.putBoolean("isPdf", file.getName().toLowerCase().endsWith(".pdf"));
                    result.pushMap(fileInfo);
                }
            }

            Log.d(TAG, "Found " + result.size() + " total files");
            promise.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "Error listing files: " + e.getMessage(), e);
            promise.reject("LIST_ERROR", "Failed to list files: " + e.getMessage(), e);
        }
    }

    @ReactMethod
    public void copyToGoldTracker(String sourceFilePath, String goldTrackerPath, String fileName, Promise promise) {
        try {
            Log.d(TAG, "Copying file to Gold Tracker: " + sourceFilePath);
            
            File sourceFile = new File(sourceFilePath);
            if (!sourceFile.exists()) {
                promise.reject("FILE_NOT_FOUND", "Source file not found: " + sourceFilePath);
                return;
            }

            // Create Gold Tracker folder if it doesn't exist
            File goldTrackerFolder = new File(goldTrackerPath);
            if (!goldTrackerFolder.exists()) {
                if (!goldTrackerFolder.mkdirs()) {
                    promise.reject("FOLDER_CREATE_ERROR", "Failed to create Gold Tracker folder");
                    return;
                }
            }

            File destFile = new File(goldTrackerFolder, fileName);
            
            // Copy file
            InputStream in = new FileInputStream(sourceFile);
            OutputStream out = new FileOutputStream(destFile);
            byte[] buffer = new byte[8192];
            int bytesRead;
            
            while ((bytesRead = in.read(buffer)) != -1) {
                out.write(buffer, 0, bytesRead);
            }
            
            in.close();
            out.close();

            Log.d(TAG, "File copied successfully to: " + destFile.getAbsolutePath());
            promise.resolve(destFile.getAbsolutePath());

        } catch (Exception e) {
            Log.e(TAG, "Error copying file: " + e.getMessage(), e);
            promise.reject("COPY_ERROR", "Failed to copy file: " + e.getMessage(), e);
        }
    }

    @ReactMethod
    public void ensureGoldTrackerFolder(String basePath, Promise promise) {
        try {
            Log.d(TAG, "Ensuring Gold Tracker folder in: " + basePath);
            
            File baseFolder = new File(basePath);
            if (!baseFolder.exists()) {
                promise.reject("BASE_FOLDER_NOT_FOUND", "Base folder does not exist: " + basePath);
                return;
            }
            
            if (!baseFolder.canWrite()) {
                promise.reject("NO_WRITE_PERMISSION", "Cannot write to base folder (permission denied): " + basePath);
                return;
            }
            
            File goldTrackerFolder = new File(basePath, "Gold Tracker");
            
            if (!goldTrackerFolder.exists()) {
                boolean created = goldTrackerFolder.mkdirs();
                if (created) {
                    Log.d(TAG, "✅ Gold Tracker folder created: " + goldTrackerFolder.getAbsolutePath());
                } else {
                    String error = "Failed to create Gold Tracker folder at: " + goldTrackerFolder.getAbsolutePath() + 
                                   "\nBase folder writable: " + baseFolder.canWrite() +
                                   "\nBase folder exists: " + baseFolder.exists();
                    Log.e(TAG, error);
                    promise.reject("FOLDER_CREATE_ERROR", error);
                    return;
                }
            } else {
                Log.d(TAG, "✅ Gold Tracker folder already exists: " + goldTrackerFolder.getAbsolutePath());
            }

            promise.resolve(goldTrackerFolder.getAbsolutePath());

        } catch (Exception e) {
            Log.e(TAG, "Error ensuring Gold Tracker folder: " + e.getMessage(), e);
            promise.reject("FOLDER_ERROR", "Failed to ensure Gold Tracker folder: " + e.getMessage(), e);
        }
    }

    @ReactMethod
    public void fileExists(String filePath, Promise promise) {
        try {
            File file = new File(filePath);
            promise.resolve(file.exists());
        } catch (Exception e) {
            promise.reject("FILE_CHECK_ERROR", "Failed to check file: " + e.getMessage(), e);
        }
    }

    @ReactMethod
    public void readTextFile(String filePath, Promise promise) {
        try {
            File file = new File(filePath);
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "File not found: " + filePath);
                return;
            }

            FileInputStream fis = new FileInputStream(file);
            byte[] data = new byte[(int) file.length()];
            fis.read(data);
            fis.close();

            String content = new String(data, "UTF-8");
            promise.resolve(content);
        } catch (Exception e) {
            Log.e(TAG, "Error reading file: " + e.getMessage(), e);
            promise.reject("READ_ERROR", "Failed to read file: " + e.getMessage(), e);
        }
    }

    @ReactMethod
    public void writeTextFile(String filePath, String content, Promise promise) {
        try {
            File file = new File(filePath);
            
            // Create parent directories if they don't exist
            File parentDir = file.getParentFile();
            if (parentDir != null && !parentDir.exists()) {
                parentDir.mkdirs();
            }

            FileOutputStream fos = new FileOutputStream(file);
            fos.write(content.getBytes("UTF-8"));
            fos.close();

            Log.d(TAG, "File written successfully: " + filePath);
            promise.resolve(null);
        } catch (Exception e) {
            Log.e(TAG, "Error writing file: " + e.getMessage(), e);
            promise.reject("WRITE_ERROR", "Failed to write file: " + e.getMessage(), e);
        }
    }

    @ReactMethod
    public void createDirectory(String dirPath, Promise promise) {
        try {
            File dir = new File(dirPath);
            if (!dir.exists()) {
                boolean created = dir.mkdirs();
                if (created) {
                    Log.d(TAG, "Directory created: " + dirPath);
                    promise.resolve(true);
                } else {
                    promise.reject("CREATE_ERROR", "Failed to create directory: " + dirPath);
                }
            } else {
                Log.d(TAG, "Directory already exists: " + dirPath);
                promise.resolve(true);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error creating directory: " + e.getMessage(), e);
            promise.reject("CREATE_ERROR", "Failed to create directory: " + e.getMessage(), e);
        }
    }
}
