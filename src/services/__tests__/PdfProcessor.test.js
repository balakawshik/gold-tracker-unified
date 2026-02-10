/**
 * Unit Tests for PdfProcessor Service
 * Tests PDF extraction and transaction validation
 */

import PdfProcessor from '../PdfProcessor';

// Mock file system
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: true })),
  copyAsync: jest.fn(() => Promise.resolve()),
  documentDirectory: '/mock/directory/',
  readAsStringAsync: jest.fn(),
}));

describe('PdfProcessor Service', () => {
  describe('validateTransactions', () => {
    it('should validate and normalize valid transactions', () => {
      const rawTransactions = [
        {
          date: 'Jan 25, 2026',
          weight: '0.0007',
          amount: '11.82',
          type: 'DEBIT',
          transactionId: 'TX123',
        },
      ];

      const result = PdfProcessor.validateTransactions(rawTransactions);

      expect(result).toHaveLength(1);
      expect(result[0]['Transaction Date']).toBe('Jan 25, 2026');
      expect(result[0]['Weight of Gold']).toBe(0.0007);
      expect(result[0]['Amount']).toBe(11.82);
      expect(result[0]['Type']).toBe('DEBIT');
    });

    it('should filter out transactions with missing required fields', () => {
      const rawTransactions = [
        {
          date: 'Jan 25, 2026',
          // Missing weight
          amount: '11.82',
          type: 'DEBIT',
        },
        {
          date: 'Jan 25, 2026',
          weight: '0.0007',
          // Missing amount
          type: 'DEBIT',
        },
      ];

      const result = PdfProcessor.validateTransactions(rawTransactions);
      expect(result).toHaveLength(0);
    });

    it('should filter out transactions with invalid numbers', () => {
      const rawTransactions = [
        {
          date: 'Jan 25, 2026',
          weight: 'invalid',
          amount: '11.82',
          type: 'DEBIT',
        },
        {
          date: 'Jan 25, 2026',
          weight: '0.0007',
          amount: 'invalid',
          type: 'DEBIT',
        },
        {
          date: 'Jan 25, 2026',
          weight: '-1',
          amount: '11.82',
          type: 'DEBIT',
        },
      ];

      const result = PdfProcessor.validateTransactions(rawTransactions);
      expect(result).toHaveLength(0);
    });

    it('should normalize transaction type to uppercase', () => {
      const rawTransactions = [
        {
          date: 'Jan 25, 2026',
          weight: '0.5',
          amount: '1000',
          type: 'debit',
          transactionId: 'TX123',
        },
      ];

      const result = PdfProcessor.validateTransactions(rawTransactions);
      expect(result[0]['Type']).toBe('DEBIT');
    });

    it('should generate temp ID if transaction ID is missing', () => {
      const rawTransactions = [
        {
          date: 'Jan 25, 2026',
          weight: '0.5',
          amount: '1000',
          type: 'DEBIT',
          // No transactionId
        },
      ];

      const result = PdfProcessor.validateTransactions(rawTransactions);
      expect(result[0]['Transaction ID']).toMatch(/^TEMP_/);
    });

    it('should handle empty array', () => {
      const result = PdfProcessor.validateTransactions([]);
      expect(result).toHaveLength(0);
    });

    it('should handle null input', () => {
      const result = PdfProcessor.validateTransactions(null);
      expect(result).toHaveLength(0);
    });
  });

  // NOTE: parseTransactionsFromText removed - only native module processing supported
  // JavaScript fallbacks have been intentionally removed per requirements

  describe('generateTempId', () => {
    it('should generate unique temp IDs', () => {
      const t1 = { date: 'Jan 25, 2026', weight: '0.5', amount: '1000' };
      const t2 = { date: 'Jan 26, 2026', weight: '0.5', amount: '1000' };

      const id1 = PdfProcessor.generateTempId(t1);
      const id2 = PdfProcessor.generateTempId(t2);

      expect(id1).toMatch(/^TEMP_/);
      expect(id2).toMatch(/^TEMP_/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('isNativeModuleAvailable', () => {
    it('should return false in test environment', () => {
      expect(PdfProcessor.isNativeModuleAvailable()).toBe(false);
    });
  });
});
