/**
 * ProcessingLogModal Component
 * 
 * Full-screen modal that displays live processing logs
 * Shows progress, success/error messages, and final summary
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { height } = Dimensions.get('window');

const ProcessingLogModal = ({ visible, onClose, logs, progress, isComplete, summary }) => {
  const getLogIcon = (type) => {
    switch (type) {
      case 'processing':
        return <ActivityIndicator size="small" color="#FFA500" />;
      case 'success':
        return <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />;
      case 'skipped':
        return <Ionicons name="arrow-forward-circle" size={20} color="#2196F3" />;
      case 'error':
        return <Ionicons name="close-circle" size={20} color="#F44336" />;
      case 'info':
        return <Ionicons name="information-circle" size={20} color="#9C27B0" />;
      default:
        return <View style={{width: 20}} />;
    }
  };

  const getLogColor = (type) => {
    switch (type) {
      case 'processing':
        return '#FFA500';
      case 'success':
        return '#4CAF50';
      case 'skipped':
        return '#2196F3';
      case 'error':
        return '#F44336';
      case 'info':
        return '#9C27B0';
      default:
        return '#666';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={isComplete ? onClose : undefined}
      presentationStyle="fullScreen"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Processing Files</Text>
          {isComplete && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Progress Bar */}
        {progress && !isComplete && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${(progress.current / progress.total) * 100}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              Processing file {progress.current} of {progress.total}...
            </Text>
          </View>
        )}

        {/* Logs */}
        <ScrollView 
          style={styles.logsContainer}
          contentContainerStyle={styles.logsContent}
        >
          {logs && logs.map((log, index) => (
            <View key={index} style={styles.logEntry}>
              <View style={styles.logIcon}>
                {getLogIcon(log.type)}
              </View>
              <View style={styles.logTextContainer}>
                <Text style={[styles.logMessage, { color: getLogColor(log.type) }]}>
                  {log.message}
                </Text>
                {log.details && (
                  <Text style={styles.logDetails}>{log.details}</Text>
                )}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Summary (shown when complete) */}
        {isComplete && summary && (
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryTitle}>📊 Processing Complete</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>• Processed:</Text>
              <Text style={styles.summaryValue}>{summary.processedCount} files</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>• Skipped:</Text>
              <Text style={styles.summaryValue}>
                {summary.skippedCount} files {summary.skippedReason}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>• New transactions:</Text>
              <Text style={[styles.summaryValue, styles.summaryHighlight]}>
                {summary.newTransactions}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>• Duplicates prevented:</Text>
              <Text style={styles.summaryValue}>{summary.duplicates}</Text>
            </View>
            {summary.errors > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, styles.errorText]}>• Errors:</Text>
                <Text style={[styles.summaryValue, styles.errorText]}>
                  {summary.errors}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Action Buttons */}
        {isComplete && (
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.button, styles.primaryButton]}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#9C27B0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 5,
  },
  progressContainer: {
    padding: 20,
    backgroundColor: '#252525',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#444',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#9C27B0',
  },
  progressText: {
    marginTop: 10,
    color: '#bbb',
    fontSize: 14,
  },
  logsContainer: {
    flex: 1,
  },
  logsContent: {
    padding: 15,
  },
  logEntry: {
    flexDirection: 'row',
    marginBottom: 15,
    backgroundColor: '#252525',
    padding: 12,
    borderRadius: 8,
  },
  logIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  logTextContainer: {
    flex: 1,
  },
  logMessage: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  logDetails: {
    fontSize: 12,
    color: '#888',
    lineHeight: 18,
  },
  summaryContainer: {
    backgroundColor: '#252525',
    padding: 20,
    margin: 15,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#9C27B0',
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#bbb',
  },
  summaryValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  summaryHighlight: {
    color: '#4CAF50',
    fontSize: 16,
  },
  errorText: {
    color: '#F44336',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 20,
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#9C27B0',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ProcessingLogModal;
