import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import DataStorage from '../services/DataStorage';

// Helper function to properly parse CSV lines with quoted fields
const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
};

// Standardize old CSV headers to new property names
const standardizeHeader = (header) => {
  const headerMap = {
    'Date': 'Transaction Date',
    'Weight (g)': 'Weight of Gold',
    'Amount (₹)': 'Amount',
    'UTR Number': 'UTR No'
  };
  
  return headerMap[header] || header;
};

const parseCSV = (csvText) => {
  const lines = csvText.split('\n');
  const rawHeaders = parseCSVLine(lines[0]);
  const headers = rawHeaders.map(h => standardizeHeader(h.trim()));
  
  console.log('CSV Headers (raw):', rawHeaders);
  console.log('CSV Headers (standardized):', headers);
  
  const transactions = [];

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const values = parseCSVLine(lines[i]);
      if (values.length > 0) {
        const transaction = {};
        headers.forEach((header, index) => {
          transaction[header] = values[index] || '';
        });
        if (transaction['Transaction ID']) {
          transactions.push(transaction);
        }
      }
    }
  }
  
  if (transactions.length > 0) {
    console.log('Sample parsed transaction:', transactions[0]);
  }

  return transactions;
};

const calculateStats = (transactions) => {
  let purchases = 0;
  let sales = 0;
  let totalWeight = 0;
  let totalAmount = 0;

  transactions.forEach(t => {
    const weight = parseFloat(t['Weight of Gold']) || 0;
    const amount = parseFloat(t['Amount']) || 0;
    
    if (t['Type']?.toLowerCase() === 'debit') {
      purchases++;
      totalWeight += weight;
      totalAmount += amount;
    } else if (t['Type']?.toLowerCase() === 'credit') {
      sales++;
      totalWeight -= weight;
      totalAmount -= amount;
    }
  });

  return {
    totalTransactions: transactions.length,
    purchases,
    sales,
    totalWeight: totalWeight.toFixed(6),
    totalAmount: totalAmount.toFixed(2)
  };
};

export default function DataLoadScreen({ onDataLoaded, initialData }) {
  const [data, setData] = useState(initialData || []);
  const [stats, setStats] = useState(calculateStats(initialData || []));
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/comma-separated-values',
        copyToCacheDirectory: true
      });
      
      if (result.type === 'success' || !result.canceled) {
        const fileUri = result.uri || result.assets[0].uri;
        setSelectedFile(fileUri);
        
        console.log('📄 Reading CSV file...');
        const csvText = await FileSystem.readAsStringAsync(fileUri);
        const csvTransactions = parseCSV(csvText);
        console.log(`📄 Parsed ${csvTransactions.length} transactions from CSV`);
        
        // Load existing transactions from database to check for duplicates
        console.log('📊 Loading existing transactions from database...');
        const existingTransactions = await DataStorage.getAllTransactions();
        const existingIds = new Set(
          existingTransactions.map(t => t['Transaction ID']).filter(id => id)
        );
        console.log(`📊 Found ${existingIds.size} existing transaction IDs in database`);
        
        // Filter out duplicates
        const newTransactions = csvTransactions.filter(txn => {
          const id = txn['Transaction ID'];
          return id && !existingIds.has(id);
        });
        
        const duplicateCount = csvTransactions.length - newTransactions.length;
        console.log(`🔍 Filtered: ${newTransactions.length} new, ${duplicateCount} duplicates`);
        
        if (newTransactions.length === 0) {
          Alert.alert(
            'No New Transactions',
            `All ${csvTransactions.length} transactions from CSV already exist in the database.`,
            [{ text: 'OK' }]
          );
        } else {
          // Save new transactions to database
          console.log(`💾 Saving ${newTransactions.length} new transactions to database...`);
          await DataStorage.saveTransactions(newTransactions);
          console.log('✅ Transactions saved to database');
          
          // Reload all transactions
          const allTransactions = await DataStorage.getAllTransactions();
          setData(allTransactions);
          setStats(calculateStats(allTransactions));
          onDataLoaded(allTransactions);
          
          const message = duplicateCount > 0
            ? `Imported ${newTransactions.length} new transactions!\n\nSkipped ${duplicateCount} duplicates that already exist.`
            : `Imported ${newTransactions.length} transactions!`;
          
          Alert.alert('Success', message);
        }
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', `Failed to load CSV file:\n\n${error.message}`);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (selectedFile) {
        const csvText = await FileSystem.readAsStringAsync(selectedFile);
        const transactions = parseCSV(csvText);
        setData(transactions);
        setStats(calculateStats(transactions));
        onDataLoaded(transactions);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const renderTransaction = ({ item }) => (
    <View style={styles.transactionCard}>
      <View style={styles.transactionHeader}>
        <Text style={styles.transactionDate}>{item['Transaction Date']}</Text>
        <Text style={[
          styles.transactionType,
          item['Type']?.toLowerCase() === 'debit' ? styles.buyType : styles.sellType
        ]}>
          {item['Type']?.toLowerCase() === 'debit' ? '🛒 Buy' : '💰 Sell'}
        </Text>
      </View>
      <View style={styles.transactionDetails}>
        <Text style={styles.transactionWeight}>
          🪙 {item['Weight of Gold']}g
        </Text>
        <Text style={styles.transactionAmount}>
          ₹{item['Amount']}
        </Text>
      </View>
      <Text style={styles.transactionTime}>{item['Time']}</Text>
      <Text style={styles.transactionId} numberOfLines={1}>
        ID: {item['Transaction ID']}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#966B9D" />
        <Text style={styles.loadingText}>Loading Gold Transactions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statsScroll}
        contentContainerStyle={styles.statsContainer}
      >
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalTransactions}</Text>
          <Text style={styles.statLabel}>Total Transactions</Text>
        </View>
        <View style={[styles.statCard, styles.statCardPurple]}>
          <Text style={styles.statValue}>{stats.purchases}</Text>
          <Text style={styles.statLabel}>Buys</Text>
        </View>
        <View style={[styles.statCard, styles.statCardBlue]}>
          <Text style={styles.statValue}>{stats.sales}</Text>
          <Text style={styles.statLabel}>Sells</Text>
        </View>
        <View style={[styles.statCard, styles.statCardGold]}>
          <Text style={styles.statValue}>{stats.totalWeight}g</Text>
          <Text style={styles.statLabel}>Net Gold</Text>
        </View>
      </ScrollView>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.pickFileButton} onPress={pickDocument}>
          <Text style={styles.pickFileButtonText}>📁 Select CSV File</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Text style={styles.refreshButtonText}>🔄 Refresh</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        renderItem={renderTransaction}
        keyExtractor={(item) => item['Transaction ID']}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#966B9D']}
            tintColor='#966B9D'
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No transactions loaded</Text>
            <Text style={styles.emptySubtext}>Tap "Select CSV File" to load data</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF4EC',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFF4EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#966B9D',
    fontWeight: '600',
  },
  statsScroll: {
    maxHeight: 120,
    marginVertical: 10,
  },
  statsContainer: {
    paddingHorizontal: 15,
    gap: 10,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 15,
    minWidth: 140,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statCardPurple: {
    backgroundColor: '#E8DEF8',
  },
  statCardBlue: {
    backgroundColor: '#D0E8FF',
  },
  statCardGold: {
    backgroundColor: '#FFE9B5',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    gap: 10,
    marginBottom: 10,
  },
  pickFileButton: {
    flex: 1,
    backgroundColor: '#966B9D',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  pickFileButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  refreshButton: {
    backgroundColor: '#6B9D96',
    paddingHorizontal: 20,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    padding: 15,
    paddingBottom: 30,
  },
  transactionCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  transactionDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  transactionType: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  buyType: {
    backgroundColor: '#E8DEF8',
    color: '#6B4C9D',
  },
  sellType: {
    backgroundColor: '#D0E8FF',
    color: '#0066CC',
  },
  transactionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transactionWeight: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D4AF37',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  transactionTime: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  transactionId: {
    fontSize: 10,
    color: '#999',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
});
