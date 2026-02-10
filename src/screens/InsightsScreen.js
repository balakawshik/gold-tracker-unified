import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  Platform,
} from 'react-native';

export default function InsightsScreen({ data }) {
  const [filterType, setFilterType] = useState('all'); // 'all', 'year', 'month', 'date'
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showYearModal, setShowYearModal] = useState(false);
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [insights, setInsights] = useState(null);

  // Parse date from transaction
  const parseTransactionDate = (dateStr) => {
    if (!dateStr) return null;
    
    // Handle format like "Feb 01, 2026" or "Feb 1, 2026"
    const cleanStr = dateStr.replace(/"/g, '').trim();
    const parts = cleanStr.split(',');
    
    if (parts.length >= 2) {
      const monthDay = parts[0].trim();
      const year = parts[1].trim();
      
      // Parse month name and day
      const monthDayParts = monthDay.split(' ').filter(p => p.length > 0);
      if (monthDayParts.length === 2) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthName = monthDayParts[0];
        const day = parseInt(monthDayParts[1]);
        const monthIndex = monthNames.indexOf(monthName);
        
        if (monthIndex !== -1 && !isNaN(day)) {
          const date = new Date(parseInt(year), monthIndex, day);
          if (date && !isNaN(date.getTime())) {
            return date;
          }
        }
      }
    }
    
    return null;
  };

  // Get available years
  const getAvailableYears = () => {
    if (!data || data.length === 0) {
      console.log('No data available');
      return [];
    }
    console.log('Total data records:', data.length);
    console.log('First record:', JSON.stringify(data[0], null, 2));
    
    const years = new Set();
    data.forEach(t => {
      const dateStr = t['Transaction Date'];
      const date = parseTransactionDate(dateStr);
      if (!date) {
        console.log('Failed to parse date:', dateStr);
      } else if (isNaN(date.getFullYear())) {
        console.log('Invalid year from date:', dateStr, date);
      } else {
        years.add(date.getFullYear());
      }
    });
    const yearsArray = Array.from(years).sort((a, b) => b - a);
    console.log('Available years:', yearsArray);
    return yearsArray;
  };

  // Get available months for selected year
  const getAvailableMonths = (year) => {
    if (!year || !data || data.length === 0) return [];
    const months = new Set();
    data.forEach(t => {
      const date = parseTransactionDate(t['Transaction Date']);
      if (date && !isNaN(date.getFullYear()) && date.getFullYear() === year) {
        months.add(date.getMonth());
      }
    });
    return Array.from(months).sort((a, b) => a - b);
  };

  // Get available dates for selected year and month
  const getAvailableDates = (year, month) => {
    if (!year || month === null || month === undefined || !data || data.length === 0) return [];
    const dates = new Set();
    data.forEach(t => {
      const date = parseTransactionDate(t['Transaction Date']);
      if (date && !isNaN(date.getFullYear()) && date.getFullYear() === year && date.getMonth() === month) {
        dates.add(date.getDate());
      }
    });
    return Array.from(dates).sort((a, b) => a - b);
  };

  // Generate full calendar grid with disabled dates
  const getCalendarGrid = (year, month) => {
    if (!year || month === null || month === undefined) return [];
    
    const availableDates = new Set(getAvailableDates(year, month));
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday
    
    const calendar = [];
    
    // Add empty cells for days before the 1st
    for (let i = 0; i < startingDayOfWeek; i++) {
      calendar.push({ date: null, hasData: false });
    }
    
    // Add all dates in the month
    for (let date = 1; date <= daysInMonth; date++) {
      calendar.push({
        date: date,
        hasData: availableDates.has(date)
      });
    }
    
    return calendar;
  };

  // Filter data based on selection
  const getFilteredData = () => {
    if (filterType === 'all') return data;

    return data.filter(t => {
      const date = parseTransactionDate(t['Transaction Date']);
      if (!date || isNaN(date.getTime())) return false;

      if (filterType === 'year') {
        return date.getFullYear() === selectedYear;
      } else if (filterType === 'month') {
        return date.getFullYear() === selectedYear && date.getMonth() === selectedMonth;
      } else if (filterType === 'date') {
        return date.getFullYear() === selectedYear && 
               date.getMonth() === selectedMonth && 
               date.getDate() === selectedDate;
      }
      return true;
    });
  };

  // Calculate weighted average buy/sell prices and P&L
  const calculateInsights = () => {
    const filteredData = getFilteredData();
    
    let totalBuyAmount = 0;
    let totalBuyGrams = 0;
    let totalSellAmount = 0;
    let totalSellGrams = 0;
    let netGrams = 0;
    let latestSellRate = 0;

    filteredData.forEach(t => {
      const weight = parseFloat(t['Weight of Gold']) || 0;
      const amount = parseFloat(t['Amount']) || 0;
      const type = t['Type']?.toLowerCase();

      if (type === 'debit') {
        // Buy transaction
        totalBuyAmount += amount;
        totalBuyGrams += weight;
        netGrams += weight;
      } else if (type === 'credit') {
        // Sell transaction
        totalSellAmount += amount;
        totalSellGrams += weight;
        netGrams -= weight;
        if (weight > 0) {
          latestSellRate = amount / weight; // Rate per gram
        }
      }
    });

    // Weighted average buy rate per gram
    // Formula: Total amount paid / Total grams bought
    // This equals: Σ(rate_i × weight_i) / Σ(weight_i) where rate_i = amount_i/weight_i
    const avgBuyRate = totalBuyGrams > 0 ? totalBuyAmount / totalBuyGrams : 0;
    
    // Weighted average sell rate per gram  
    // Formula: Total amount received / Total grams sold
    // This equals: Σ(rate_i × weight_i) / Σ(weight_i) where rate_i = amount_i/weight_i
    const avgSellRate = totalSellGrams > 0 ? totalSellAmount / totalSellGrams : 0;

    // Realized P&L (on sold gold)
    // = Total received from sales - (Grams sold × Avg buy rate)
    const realizedPL = totalSellGrams > 0 
      ? (totalSellAmount - (totalSellGrams * avgBuyRate))
      : 0;

    // Unrealized P&L (on remaining gold at latest sell rate)
    const unrealizedPL = netGrams > 0 && latestSellRate > 0
      ? (netGrams * latestSellRate) - (netGrams * avgBuyRate)
      : 0;

    return {
      avgBuyRate: avgBuyRate.toFixed(2),
      avgSellRate: avgSellRate.toFixed(2),
      totalBuyGrams: totalBuyGrams.toFixed(4),
      totalSellGrams: totalSellGrams.toFixed(4),
      netGrams: netGrams.toFixed(4),
      totalBuyAmount: totalBuyAmount.toFixed(2),
      totalSellAmount: totalSellAmount.toFixed(2),
      realizedPL: realizedPL.toFixed(2),
      unrealizedPL: unrealizedPL.toFixed(2),
      latestSellRate: latestSellRate.toFixed(2),
    };
  };

  useEffect(() => {
    setInsights(calculateInsights());
  }, [data, filterType, selectedYear, selectedMonth, selectedDate]);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const getFilterLabel = () => {
    if (filterType === 'all') return 'All Time';
    if (filterType === 'year') return `${selectedYear}`;
    if (filterType === 'month') return `${monthNames[selectedMonth]} ${selectedYear}`;
    if (filterType === 'date') return `${selectedDate} ${monthNames[selectedMonth]} ${selectedYear}`;
    return 'Select Filter';
  };

  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No data available</Text>
        <Text style={styles.emptySubtext}>Load data from Data Load tab</Text>
      </View>
    );
  }

  if (!insights) return null;

  const availableYears = getAvailableYears();

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Debug Section - shows if no years but data exists */}
        {data.length > 0 && availableYears.length === 0 && (
          <View style={styles.debugSection}>
            <Text style={styles.debugTitle}>⚠️ Debug Info</Text>
            <Text style={styles.debugText}>Data records: {data.length}</Text>
            <Text style={styles.debugText}>First date field: "{data[0]['Transaction Date']}"</Text>
            <Text style={styles.debugText}>Parsed: {parseTransactionDate(data[0]['Transaction Date'])?.toString() || 'null'}</Text>
            <Text style={styles.debugText}>Keys: {Object.keys(data[0]).join(', ')}</Text>
          </View>
        )}

        {/* Filter Section */}
        <View style={styles.filterSection}>
          <Text style={styles.sectionTitle}>📅 Time Period</Text>
          <View style={styles.filterButtons}>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'all' && styles.filterButtonActive]}
              onPress={() => {
                setFilterType('all');
                setSelectedYear(null);
                setSelectedMonth(null);
                setSelectedDate(null);
              }}
            >
              <Text style={[styles.filterButtonText, filterType === 'all' && styles.filterButtonTextActive]}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'year' && styles.filterButtonActive]}
              onPress={() => setShowYearModal(true)}
            >
              <Text style={[styles.filterButtonText, filterType === 'year' && styles.filterButtonTextActive]}>Year</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'month' && styles.filterButtonActive]}
              onPress={() => {
                if (!selectedYear) {
                  setShowYearModal(true);
                } else {
                  setShowMonthModal(true);
                }
              }}
            >
              <Text style={[styles.filterButtonText, filterType === 'month' && styles.filterButtonTextActive]}>Month</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'date' && styles.filterButtonActive]}
              onPress={() => {
                if (!selectedYear) {
                  setShowYearModal(true);
                } else if (selectedMonth === null) {
                  setShowMonthModal(true);
                } else {
                  setShowDateModal(true);
                }
              }}
            >
              <Text style={[styles.filterButtonText, filterType === 'date' && styles.filterButtonTextActive]}>Date</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.selectedFilter}>
            <Text style={styles.selectedFilterText}>{getFilterLabel()}</Text>
          </View>
        </View>

        {/* Weighted Average Rates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Weighted Average Rates</Text>
          <View style={styles.ratesContainer}>
            <View style={styles.rateCard}>
              <Text style={styles.rateLabel}>Avg Buy Rate</Text>
              <Text style={styles.rateValue}>₹{insights.avgBuyRate}/g</Text>
              <Text style={styles.rateSubtext}>{insights.totalBuyGrams}g bought</Text>
              <Text style={styles.rateAmount}>₹{insights.totalBuyAmount}</Text>
            </View>
            <View style={[styles.rateCard, styles.rateCardAlt]}>
              <Text style={styles.rateLabel}>Avg Sell Rate</Text>
              <Text style={styles.rateValue}>₹{insights.avgSellRate}/g</Text>
              <Text style={styles.rateSubtext}>{insights.totalSellGrams}g sold</Text>
              <Text style={styles.rateAmount}>₹{insights.totalSellAmount}</Text>
            </View>
          </View>
        </View>

        {/* Holdings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🪙 Current Holdings</Text>
          <View style={styles.holdingCard}>
            <Text style={styles.holdingLabel}>Gold Available</Text>
            <Text style={styles.holdingValue}>{insights.netGrams} grams</Text>
            <View style={styles.holdingDetails}>
              <View style={styles.holdingDetailRow}>
                <Text style={styles.holdingDetailText}>Bought: {insights.totalBuyGrams}g</Text>
                <Text style={styles.holdingDetailAmount}>₹{insights.totalBuyAmount}</Text>
              </View>
              <View style={styles.holdingDetailRow}>
                <Text style={styles.holdingDetailText}>Sold: {insights.totalSellGrams}g</Text>
                <Text style={styles.holdingDetailAmount}>₹{insights.totalSellAmount}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* P&L Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Profit & Loss</Text>
          
          <View style={styles.plCard}>
            <Text style={styles.plLabel}>Realized P&L</Text>
            <Text style={[
              styles.plValue,
              parseFloat(insights.realizedPL) >= 0 ? styles.profit : styles.loss
            ]}>
              {parseFloat(insights.realizedPL) >= 0 ? '+' : ''}₹{insights.realizedPL}
            </Text>
            <Text style={styles.plSubtext}>From {insights.totalSellGrams}g sold</Text>
          </View>

          <View style={[styles.plCard, styles.plCardAlt]}>
            <Text style={styles.plLabel}>Unrealized P&L</Text>
            <Text style={[
              styles.plValue,
              parseFloat(insights.unrealizedPL) >= 0 ? styles.profit : styles.loss
            ]}>
              {parseFloat(insights.unrealizedPL) >= 0 ? '+' : ''}₹{insights.unrealizedPL}
            </Text>
            <Text style={styles.plSubtext}>
              On {insights.netGrams}g @ ₹{insights.latestSellRate}/g
            </Text>
          </View>

          <View style={styles.totalPlCard}>
            <Text style={styles.totalPlLabel}>Total P&L</Text>
            <Text style={[
              styles.totalPlValue,
              (parseFloat(insights.realizedPL) + parseFloat(insights.unrealizedPL)) >= 0 ? styles.profit : styles.loss
            ]}>
              {(parseFloat(insights.realizedPL) + parseFloat(insights.unrealizedPL)) >= 0 ? '+' : ''}
              ₹{(parseFloat(insights.realizedPL) + parseFloat(insights.unrealizedPL)).toFixed(2)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Year Selection Modal */}
      <Modal
        visible={showYearModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowYearModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Year</Text>
            <FlatList
              data={getAvailableYears()}
              keyExtractor={(item) => item.toString()}
              ListEmptyComponent={() => (
                <View style={styles.emptyListContainer}>
                  <Text style={styles.emptyListText}>No years found</Text>
                  <Text style={styles.emptyListSubtext}>Check if CSV has valid dates</Text>
                </View>
              )}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedYear(item);
                    setFilterType('year');
                    setSelectedMonth(null);
                    setSelectedDate(null);
                    setShowYearModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowYearModal(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Month Selection Modal */}
      <Modal
        visible={showMonthModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMonthModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Month ({selectedYear})</Text>
            <FlatList
              data={getAvailableMonths(selectedYear)}
              keyExtractor={(item) => item.toString()}
              ListEmptyComponent={() => (
                <View style={styles.emptyListContainer}>
                  <Text style={styles.emptyListText}>No months found</Text>
                  <Text style={styles.emptyListSubtext}>No data for {selectedYear}</Text>
                </View>
              )}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedMonth(item);
                    setFilterType('month');
                    setSelectedDate(null);
                    setShowMonthModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{monthNames[item]}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowMonthModal(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Date Selection Modal */}
      <Modal
        visible={showDateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Select Date ({monthNames[selectedMonth]} {selectedYear})
            </Text>
            <View style={styles.calendarContainer}>
              {/* Week day headers */}
              <View style={styles.weekDaysRow}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <View key={day} style={styles.weekDayHeader}>
                    <Text style={styles.weekDayText}>{day}</Text>
                  </View>
                ))}
              </View>
              
              {/* Calendar grid */}
              <FlatList
                data={getCalendarGrid(selectedYear, selectedMonth)}
                keyExtractor={(item, index) => index.toString()}
                numColumns={7}
                columnWrapperStyle={styles.dateRow}
                ListEmptyComponent={() => (
                  <View style={styles.emptyListContainer}>
                    <Text style={styles.emptyListText}>No dates available</Text>
                  </View>
                )}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.dateItem,
                      !item.hasData && styles.dateItemDisabled
                    ]}
                    onPress={() => {
                      if (item.hasData) {
                        setSelectedDate(item.date);
                        setFilterType('date');
                        setShowDateModal(false);
                      }
                    }}
                    disabled={!item.hasData}
                  >
                    {item.date && (
                      <Text style={[
                        styles.dateItemText,
                        !item.hasData && styles.dateItemTextDisabled
                      ]}>
                        {item.date}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowDateModal(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF4EC',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#FFF4EC',
    justifyContent: 'center',
    alignItems: 'center',
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
  filterSection: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  section: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 15,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#966B9D',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  selectedFilter: {
    padding: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    alignItems: 'center',
  },
  selectedFilterText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#966B9D',
  },
  ratesContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  rateCard: {
    flex: 1,
    padding: 15,
    backgroundColor: '#E8DEF8',
    borderRadius: 12,
    alignItems: 'center',
  },
  rateCardAlt: {
    backgroundColor: '#D0E8FF',
  },
  rateLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  rateValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  rateSubtext: {
    fontSize: 10,
    color: '#888',
    marginBottom: 4,
  },
  rateAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  holdingCard: {
    padding: 20,
    backgroundColor: '#FFE9B5',
    borderRadius: 12,
    alignItems: 'center',
  },
  holdingLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  holdingValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#D4AF37',
    marginBottom: 10,
  },
  holdingDetails: {
    width: '100%',
    gap: 12,
  },
  holdingDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  holdingDetailText: {
    fontSize: 12,
    color: '#888',
  },
  holdingDetailAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  plCard: {
    padding: 15,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    marginBottom: 10,
  },
  plCardAlt: {
    backgroundColor: '#F0F0F0',
  },
  plLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  plValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  plSubtext: {
    fontSize: 11,
    color: '#888',
  },
  totalPlCard: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#966B9D',
    alignItems: 'center',
  },
  totalPlLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  totalPlValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  profit: {
    color: '#16A34A',
  },
  loss: {
    color: '#DC2626',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '75%',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalItemText: {
    fontSize: 16,
    color: '#333',
  },
  calendarContainer: {
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  weekDayHeader: {
    width: 36,
    alignItems: 'center',
  },
  weekDayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
  },
  dateRow: {
    justifyContent: 'space-around',
    marginBottom: 6,
  },
  dateItem: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#966B9D',
    borderRadius: 6,
    marginHorizontal: 1,
  },
  dateItemDisabled: {
    backgroundColor: '#F5F5F5',
  },
  dateItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dateItemTextDisabled: {
    color: '#CCCCCC',
  },
  modalCloseButton: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#966B9D',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyListContainer: {
    padding: 30,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 5,
  },
  emptyListSubtext: {
    fontSize: 14,
    color: '#999',
  },
  debugSection: {
    margin: 15,
    padding: 15,
    backgroundColor: '#FFF3CD',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#856404',
    marginBottom: 10,
  },
  debugText: {
    fontSize: 12,
    color: '#856404',
    marginBottom: 5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
