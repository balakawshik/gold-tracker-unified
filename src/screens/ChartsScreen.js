import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  Dimensions,
} from 'react-native';
import { BarChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width;

export default function ChartsScreen({ data }) {
  const [filterType, setFilterType] = useState('week'); // 'all', 'week', 'year', 'month'
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [showYearModal, setShowYearModal] = useState(false);
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [chartData, setChartData] = useState(null);

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
  const getAvailableYears = () => {    if (!data || data.length === 0) return [];    const years = new Set();
    data.forEach(t => {
      const date = parseTransactionDate(t['Transaction Date']);
      if (date && !isNaN(date.getFullYear())) {
        years.add(date.getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
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

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Get current week date range
  const getCurrentWeek = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return { startOfWeek, endOfWeek };
  };

  // Initialize with current week
  useEffect(() => {
    if (data && data.length > 0) {
      // Default to current week - no need to set year/month
      setFilterType('week');
    }
  }, [data]);

  // Prepare chart data
  useEffect(() => {
    if (!data || data.length === 0) return;

    const aggregatedData = {};

    // Get week range if needed
    const { startOfWeek, endOfWeek } = getCurrentWeek();

    // Filter and aggregate data
    data.forEach(t => {
      const date = parseTransactionDate(t['Transaction Date']);
      if (!date || isNaN(date.getTime())) return;

      // Apply filters
      if (filterType === 'week') {
        if (date < startOfWeek || date > endOfWeek) return;
      } else if (filterType === 'year') {
        if (!selectedYear || date.getFullYear() !== selectedYear) return;
      } else if (filterType === 'month') {
        if (!selectedYear || selectedMonth === null || selectedMonth === undefined ||
            date.getFullYear() !== selectedYear || date.getMonth() !== selectedMonth) return;
      }
      // 'all' - no filter

      // Determine aggregation key
      let key;
      let label;
      if (filterType === 'all') {
        // Aggregate by year
        key = date.getFullYear();
        label = key.toString();
      } else if (filterType === 'year') {
        // Aggregate by month
        key = date.getMonth();
        label = monthNames[key];
      } else {
        // Aggregate by day (week and month)
        key = date.getDate();
        label = key.toString();
      }

      if (!aggregatedData[key]) {
        aggregatedData[key] = {
          key: key,
          label: label,
          buyGrams: 0,
          sellGrams: 0,
          buyAmount: 0,
          sellAmount: 0,
        };
      }

      const weight = parseFloat(t['Weight of Gold']) || 0;
      const amount = parseFloat(t['Amount']) || 0;
      const type = t['Type']?.toLowerCase();

      if (type === 'debit') {
        aggregatedData[key].buyGrams += weight;
        aggregatedData[key].buyAmount += amount;
      } else if (type === 'credit') {
        aggregatedData[key].sellGrams += weight;
        aggregatedData[key].sellAmount += amount;
      }
    });

    // Convert to array and sort
    const sortedData = Object.values(aggregatedData).sort((a, b) => a.key - b.key);

    setChartData(sortedData);
  }, [data, filterType, selectedYear, selectedMonth]);

  const getFilterLabel = () => {
    if (filterType === 'all') return 'All Time';
    if (filterType === 'week') {
      const { startOfWeek, endOfWeek } = getCurrentWeek();
      return `${startOfWeek.getDate()} ${monthNames[startOfWeek.getMonth()]} - ${endOfWeek.getDate()} ${monthNames[endOfWeek.getMonth()]}`;
    }
    if (filterType === 'year') return `${selectedYear}`;
    if (filterType === 'month') return `${monthNames[selectedMonth]} ${selectedYear}`;
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

  if (!chartData || chartData.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No data for selected period</Text>
        <Text style={styles.emptySubtext}>Try selecting a different time period</Text>
      </View>
    );
  }

  // Prepare data for charts
  const labels = chartData.map(d => d.label);
  const buyGramsData = chartData.map(d => parseFloat(d.buyGrams.toFixed(4)));
  const sellGramsData = chartData.map(d => parseFloat(d.sellGrams.toFixed(4)));
  const buyAmountData = chartData.map(d => Math.round(d.buyAmount));
  const sellAmountData = chartData.map(d => Math.round(d.sellAmount));

  const gramsChartDataBuy = {
    labels: labels,
    datasets: [
      {
        data: buyGramsData.length > 0 ? buyGramsData : [0],
      },
    ],
  };

  const gramsChartDataSell = {
    labels: labels,
    datasets: [
      {
        data: sellGramsData.length > 0 ? sellGramsData : [0],
      },
    ],
  };

  const amountChartDataBuy = {
    labels: labels,
    datasets: [
      {
        data: buyAmountData.length > 0 ? buyAmountData : [0],
      },
    ],
  };

  const amountChartDataSell = {
    labels: labels,
    datasets: [
      {
        data: sellAmountData.length > 0 ? sellAmountData : [0],
      },
    ],
  };

  const chartConfigGrams = {
    backgroundColor: '#FFFFFF',
    backgroundGradientFrom: '#FFFFFF',
    backgroundGradientTo: '#FFFFFF',
    decimalPlaces: 4,
    color: (opacity = 1) => `rgba(150, 107, 157, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForLabels: {
      fontSize: 10,
    },
    propsForBackgroundLines: {
      strokeWidth: 1,
      stroke: '#e3e3e3',
    },
    barPercentage: 0.7,
  };

  const chartConfigGramsSell = {
    ...chartConfigGrams,
    color: (opacity = 1) => `rgba(107, 157, 150, ${opacity})`,
  };

  const chartConfigAmount = {
    backgroundColor: '#FFFFFF',
    backgroundGradientFrom: '#FFFFFF',
    backgroundGradientTo: '#FFFFFF',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(150, 107, 157, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForLabels: {
      fontSize: 10,
    },
    propsForBackgroundLines: {
      strokeWidth: 1,
      stroke: '#e3e3e3',
    },
    barPercentage: 0.7,
  };

  const chartConfigAmountSell = {
    ...chartConfigAmount,
    color: (opacity = 1) => `rgba(107, 157, 150, ${opacity})`,
  };

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Filter Section */}
        <View style={styles.filterSection}>
          <Text style={styles.sectionTitle}>📅 Time Period</Text>
          <View style={styles.filterButtonsGrid}>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'all' && styles.filterButtonActive]}
              onPress={() => {
                setFilterType('all');
                setSelectedYear(null);
                setSelectedMonth(null);
              }}
            >
              <Text style={[styles.filterButtonText, filterType === 'all' && styles.filterButtonTextActive]}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'week' && styles.filterButtonActive]}
              onPress={() => {
                setFilterType('week');
                setSelectedYear(null);
                setSelectedMonth(null);
              }}
            >
              <Text style={[styles.filterButtonText, filterType === 'week' && styles.filterButtonTextActive]}>Week</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filterType === 'year' && styles.filterButtonActive]}
              onPress={() => {
                setShowYearModal(true);
              }}
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
          </View>
          <View style={styles.selectedFilter}>
            <Text style={styles.selectedFilterText}>{getFilterLabel()}</Text>
          </View>
        </View>

        {/* Buy/Sell Grams Chart */}
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>
            📊 {filterType === 'year' ? 'Monthly' : 'Daily'} Buy/Sell (Grams)
          </Text>
          
          {/* Buy Chart */}
          <View style={styles.subChartContainer}>
            <Text style={styles.subChartTitle}>Buy (Grams)</Text>
            <View style={styles.chartWrapper}>
              <View style={styles.yAxisContainer}>
                <BarChart
                  data={gramsChartDataBuy}
                  width={60}
                  height={220}
                  chartConfig={{...chartConfigGrams, fillShadowGradient: 'transparent', fillShadowGradientOpacity: 0}}
                  withInnerLines={true}
                  withHorizontalLabels={true}
                  withVerticalLabels={false}
                  fromZero={true}
                  yAxisSuffix="g"
                  segments={4}
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.chartScrollArea}>
                <BarChart
                  data={gramsChartDataBuy}
                  width={Math.max(screenWidth - 110, chartData.length * 40)}
                  height={220}
                  chartConfig={chartConfigGrams}
                  style={styles.chart}
                  withInnerLines={false}
                  fromZero={true}
                  showValuesOnTopOfBars={true}
                  withHorizontalLabels={false}
                  withVerticalLabels={true}
                  yAxisSuffix="g"
                />
              </ScrollView>
            </View>
          </View>

          {/* Sell Chart */}
          <View style={styles.subChartContainer}>
            <Text style={styles.subChartTitle}>Sell (Grams)</Text>
            <View style={styles.chartWrapper}>
              <View style={styles.yAxisContainer}>
                <BarChart
                  data={gramsChartDataSell}
                  width={60}
                  height={220}
                  chartConfig={{...chartConfigGramsSell, fillShadowGradient: 'transparent', fillShadowGradientOpacity: 0}}
                  withInnerLines={true}
                  withHorizontalLabels={true}
                  withVerticalLabels={false}
                  fromZero={true}
                  yAxisSuffix="g"
                  segments={4}
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.chartScrollArea}>
                <BarChart
                  data={gramsChartDataSell}
                  width={Math.max(screenWidth - 110, chartData.length * 40)}
                  height={220}
                  chartConfig={chartConfigGramsSell}
                  style={styles.chart}
                  withInnerLines={false}
                  fromZero={true}
                  showValuesOnTopOfBars={true}
                  withHorizontalLabels={false}
                  withVerticalLabels={true}
                  yAxisSuffix="g"
                />
              </ScrollView>
            </View>
          </View>
        </View>

        {/* Buy/Sell Amount Chart */}
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>
            💰 {filterType === 'year' ? 'Monthly' : 'Daily'} Buy/Sell (Amount)
          </Text>
          
          {/* Buy Chart */}
          <View style={styles.subChartContainer}>
            <Text style={styles.subChartTitle}>Buy (Amount)</Text>
            <View style={styles.chartWrapper}>
              <View style={styles.yAxisContainer}>
                <BarChart
                  data={amountChartDataBuy}
                  width={60}
                  height={220}
                  chartConfig={{...chartConfigAmount, fillShadowGradient: 'transparent', fillShadowGradientOpacity: 0}}
                  withInnerLines={true}
                  withHorizontalLabels={true}
                  withVerticalLabels={false}
                  fromZero={true}
                  yAxisSuffix="₹"
                  segments={4}
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.chartScrollArea}>
                <BarChart
                  data={amountChartDataBuy}
                  width={Math.max(screenWidth - 110, chartData.length * 40)}
                  height={220}
                  chartConfig={chartConfigAmount}
                  style={styles.chart}
                  withInnerLines={false}
                  fromZero={true}
                  showValuesOnTopOfBars={true}
                  withHorizontalLabels={false}
                  withVerticalLabels={true}
                  yAxisSuffix="₹"
                />
              </ScrollView>
            </View>
          </View>

          {/* Sell Chart */}
          <View style={styles.subChartContainer}>
            <Text style={styles.subChartTitle}>Sell (Amount)</Text>
            <View style={styles.chartWrapper}>
              <View style={styles.yAxisContainer}>
                <BarChart
                  data={amountChartDataSell}
                  width={60}
                  height={220}
                  chartConfig={{...chartConfigAmountSell, fillShadowGradient: 'transparent', fillShadowGradientOpacity: 0}}
                  withInnerLines={true}
                  withHorizontalLabels={true}
                  withVerticalLabels={false}
                  fromZero={true}
                  yAxisSuffix="₹"
                  segments={4}
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.chartScrollArea}>
                <BarChart
                  data={amountChartDataSell}
                  width={Math.max(screenWidth - 110, chartData.length * 40)}
                  height={220}
                  chartConfig={chartConfigAmountSell}
                  style={styles.chart}
                  withInnerLines={false}
                  fromZero={true}
                  showValuesOnTopOfBars={true}
                  withHorizontalLabels={false}
                  withVerticalLabels={true}
                  yAxisSuffix="₹"
                />
              </ScrollView>
            </View>
          </View>
        </View>

        {/* Summary Stats */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>📈 Period Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Buy</Text>
              <Text style={styles.summaryValue}>
                {buyGramsData.reduce((a, b) => a + b, 0).toFixed(4)}g
              </Text>
              <Text style={styles.summaryAmount}>
                ₹{buyAmountData.reduce((a, b) => a + b, 0).toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Sell</Text>
              <Text style={styles.summaryValue}>
                {sellGramsData.reduce((a, b) => a + b, 0).toFixed(4)}g
              </Text>
              <Text style={styles.summaryAmount}>
                ₹{sellAmountData.reduce((a, b) => a + b, 0).toFixed(2)}
              </Text>
            </View>
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
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedYear(item);
                    setFilterType('year');
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
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedMonth(item);
                    setFilterType('month');
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 15,
  },
  filterButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  filterButton: {
    flex: 1,
    minWidth: '45%',
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
  chartSection: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 15,
  },
  subChartContainer: {
    marginBottom: 20,
  },
  subChartTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
    paddingLeft: 5,
  },
  chart: {
    borderRadius: 16,
    marginVertical: 8,
  },
  chartWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  yAxisContainer: {
    width: 60,
    overflow: 'hidden',
  },
  chartScrollArea: {
    flex: 1,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendColor: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 14,
    color: '#666',
  },
  summarySection: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    padding: 15,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#D4AF37',
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 14,
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    maxHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
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
});
