/**
 * DataStorage Module
 * Manages persistent storage of gold transactions using SQLite
 * Ensures data integrity and provides CRUD operations
 */

import * as SQLite from 'expo-sqlite';

class DataStorageService {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  /**
   * Initialize database and create schema
   */
  async initDatabase() {
    if (this.initialized) return;

    try {
      this.db = await SQLite.openDatabaseAsync('goldtracker.db');
      
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          transaction_id TEXT UNIQUE NOT NULL,
          transaction_date TEXT NOT NULL,
          time TEXT,
          weight REAL NOT NULL,
          type TEXT NOT NULL,
          amount REAL NOT NULL,
          utr_no TEXT,
          account TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_transaction_date 
        ON transactions(transaction_date DESC);
        
        CREATE INDEX IF NOT EXISTS idx_transaction_id 
        ON transactions(transaction_id);
      `);

      this.initialized = true;
      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw new Error(`Database initialization failed: ${error.message}`);
    }
  }

  /**
   * Save transactions to database (insert or ignore duplicates)
   * @param {Array} transactions - Array of transaction objects
   * @returns {Promise<{inserted: number, duplicates: number}>}
   */
  async saveTransactions(transactions) {
    if (!this.initialized) {
      await this.initDatabase();
    }

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return { inserted: 0, duplicates: 0 };
    }

    let inserted = 0;
    let duplicates = 0;

    try {
      await this.db.withTransactionAsync(async () => {
        for (const t of transactions) {
          try {
            // Validate required fields - Use simplified column names
            if (!t['Transaction ID'] || !t['Weight'] || !t['Amount']) {
              console.warn('Skipping invalid transaction:', t);
              continue;
            }

            const statement = await this.db.prepareAsync(
              `INSERT OR IGNORE INTO transactions 
               (transaction_id, transaction_date, time, weight, type, amount, utr_no, account) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            );

            const result = await statement.executeAsync([
              String(t['Transaction ID']),
              String(t['Date'] || ''),
              String(t['Time'] || ''),
              parseFloat(t['Weight']),
              String(t['Type'] || ''),
              parseFloat(t['Amount']),
              String(t['UTR Number'] || ''),
              String(t['Account'] || '')
            ]);

            await statement.finalizeAsync();

            if (result.changes > 0) {
              inserted++;
            } else {
              duplicates++;
            }
          } catch (error) {
            console.error('Error inserting transaction:', error, t);
          }
        }
      });

      console.log(`✅ Saved ${inserted} new transactions (${duplicates} duplicates)`);
      return { inserted, duplicates };
    } catch (error) {
      console.error('❌ Save transactions failed:', error);
      throw new Error(`Failed to save transactions: ${error.message}`);
    }
  }

  /**
   * Get all transactions ordered by date
   * @returns {Promise<Array>}
   */
  async getAllTransactions() {
    if (!this.initialized) {
      await this.initDatabase();
    }

    try {
      const rows = await this.db.getAllAsync(
        'SELECT * FROM transactions ORDER BY transaction_date DESC, time DESC'
      );

      // Transform to expected format - must match what InsightsScreen/ChartsScreen expect
      return rows.map(row => ({
        'Transaction Date': row.transaction_date,
        'Time': row.time,
        'Transaction ID': row.transaction_id,
        'Weight of Gold': row.weight,
        'Type': row.type,
        'Amount': row.amount,
        'UTR No': row.utr_no,
        'Account': row.account || ''
      }));
    } catch (error) {
      console.error('❌ Get transactions failed:', error);
      throw new Error(`Failed to retrieve transactions: ${error.message}`);
    }
  }

  /**
   * Get transaction statistics
   * @returns {Promise<Object>}
   */
  async getStatistics() {
    if (!this.initialized) {
      await this.initDatabase();
    }

    try {
      const stats = await this.db.getFirstAsync(`
        SELECT 
          COUNT(*) as total_count,
          SUM(CASE WHEN type = 'DEBIT' THEN 1 ELSE 0 END) as purchases,
          SUM(CASE WHEN type = 'CREDIT' THEN 1 ELSE 0 END) as sales,
          SUM(weight) as total_weight,
          SUM(amount) as total_amount,
          AVG(amount) as avg_amount,
          MIN(transaction_date) as earliest_date,
          MAX(transaction_date) as latest_date
        FROM transactions
      `);

      return {
        totalCount: stats.total_count || 0,
        purchases: stats.purchases || 0,
        sales: stats.sales || 0,
        totalWeight: stats.total_weight || 0,
        totalAmount: stats.total_amount || 0,
        avgAmount: stats.avg_amount || 0,
        earliestDate: stats.earliest_date,
        latestDate: stats.latest_date
      };
    } catch (error) {
      console.error('❌ Get statistics failed:', error);
      throw new Error(`Failed to get statistics: ${error.message}`);
    }
  }

  /**
   * Search transactions by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Array>}
   */
  async searchTransactions(criteria = {}) {
    if (!this.initialized) {
      await this.initDatabase();
    }

    try {
      let query = 'SELECT * FROM transactions WHERE 1=1';
      const params = [];

      if (criteria.startDate) {
        query += ' AND transaction_date >= ?';
        params.push(criteria.startDate);
      }

      if (criteria.endDate) {
        query += ' AND transaction_date <= ?';
        params.push(criteria.endDate);
      }

      if (criteria.type) {
        query += ' AND type = ?';
        params.push(criteria.type);
      }

      if (criteria.minAmount) {
        query += ' AND amount >= ?';
        params.push(criteria.minAmount);
      }

      query += ' ORDER BY transaction_date DESC, time DESC';

      const statement = await this.db.prepareAsync(query);
      const result = await statement.executeAsync(params);
      const rows = await result.getAllAsync();
      await statement.finalizeAsync();

      return rows.map(row => ({
        'Transaction ID': row.transaction_id,
        'Transaction Date': row.transaction_date,
        'Time': row.time,
        'Weight of Gold': row.weight,
        'Type': row.type,
        'Amount': row.amount,
        'UTR No': row.utr_no,
        'Account': row.account
      }));
    } catch (error) {
      console.error('❌ Search transactions failed:', error);
      throw new Error(`Failed to search transactions: ${error.message}`);
    }
  }

  /**
   * Clear all transactions from database
   * @returns {Promise<number>} Number of deleted rows
   */
  async clearAllData() {
    if (!this.initialized) {
      await this.initDatabase();
    }

    try {
      const result = await this.db.runAsync('DELETE FROM transactions');
      console.log(`✅ Cleared ${result.changes} transactions`);
      return result.changes;
    } catch (error) {
      console.error('❌ Clear data failed:', error);
      throw new Error(`Failed to clear data: ${error.message}`);
    }
  }

  /**
   * Export transactions as CSV string
   * @returns {Promise<string>}
   */
  async exportToCSV() {
    const transactions = await this.getAllTransactions();
    
    if (transactions.length === 0) {
      return '';
    }

    const headers = Object.keys(transactions[0]);
    const csvRows = [headers.join(',')];

    for (const transaction of transactions) {
      const values = headers.map(header => {
        const value = transaction[header];
        // Escape values containing commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Close database connection
   */
  async closeDatabase() {
    if (this.db) {
      await this.db.closeAsync();
      this.initialized = false;
      console.log('✅ Database connection closed');
    }
  }
}

// Export singleton instance
const dataStorage = new DataStorageService();
export default dataStorage;
