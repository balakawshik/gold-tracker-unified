import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';

const OUNCE_TO_GRAM = 31.1035;

export default function LiveRatesScreen() {
  const [activeTab, setActiveTab] = useState('goldprice'); // 'goldprice' or 'goodreturn'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [rates, setRates] = useState(null);
  const [goodReturnRates, setGoodReturnRates] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [lastGoodReturnUpdate, setLastGoodReturnUpdate] = useState(null);
  const [isLiveData, setIsLiveData] = useState(true);

  const fetchRates = async () => {
    try {
      const response = await fetch('https://data-asg.goldprice.org/dbXRates/INR');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Convert ounce prices to grams
      const goldPerGram = data.items[0].xauPrice / OUNCE_TO_GRAM;
      const silverPerGram = data.items[0].xagPrice / OUNCE_TO_GRAM;
      
      // Calculate changes
      const goldChange = ((data.items[0].xauPrice - data.items[0].xauClose) / data.items[0].xauClose) * 100;
      const silverChange = ((data.items[0].xagPrice - data.items[0].xagClose) / data.items[0].xagClose) * 100;
      
      setRates({
        gold: {
          perGram: goldPerGram,
          perOunce: data.items[0].xauPrice,
          change: goldChange,
          changeValue: data.items[0].xauPrice - data.items[0].xauClose,
        },
        silver: {
          perGram: silverPerGram,
          perOunce: data.items[0].xagPrice,
          change: silverChange,
          changeValue: data.items[0].xagPrice - data.items[0].xagClose,
        }
      });
      
      setLastUpdate(new Date());
      setIsLiveData(true);
      setLoading(false);
      setRefreshing(false);
      setError(null);
    } catch (err) {
      console.error('Error fetching rates:', err);
      setError(err.message);
      setIsLiveData(false);
      setLoading(false);
      setRefreshing(false);
      // Don't clear rates - keep old data
    }
  };

  const extractValueFromHtml = (html, id) => {
    try {
      // First, let's find the element with this id and log what we see
      const elementRegex = new RegExp(`id=["']${id}["'][^>]*>([\\s\\S]{0,300}?)(?:<\\/(?:span|div|p|td))`, 'i');
      const elementMatch = html.match(elementRegex);
      
      if (elementMatch) {
        console.log(`\n=== Found element with id="${id}" ===`);
        console.log('Raw content:', elementMatch[1].substring(0, 200));
        
        // Decode HTML entities
        let content = elementMatch[1];
        content = content.replace(/&#x20b9;/gi, '₹'); // Rupee symbol
        content = content.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
        content = content.replace(/&nbsp;/gi, ' ');
        content = content.replace(/&amp;/gi, '&');
        content = content.replace(/&lt;/gi, '<');
        content = content.replace(/&gt;/gi, '>');
        
        console.log('Decoded content:', content.substring(0, 200));
        
        // Extract numeric value - look for pattern like ₹14,155 or 14,155
        const numPattern = /₹?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?)/;
        const numMatch = content.match(numPattern);
        
        if (numMatch && numMatch[1]) {
          // Remove commas and parse
          const numString = numMatch[1].replace(/,/g, '');
          const value = parseFloat(numString);
          
          if (!isNaN(value) && value > 0) {
            console.log(`✓ Extracted ${id}: ₹${value} (parsed from "${numMatch[1]}")`);
            console.log('================\n');
            return value;
          }
        }
        
        console.warn(`✗ Found element but couldn't extract number from: "${content.substring(0, 100)}"`);
        console.log('================\n');
      } else {
        console.warn(`❌ Element with id="${id}" not found in HTML`);
        
        // Try to find similar IDs
        const idPattern = new RegExp(`id=["']([^"']*${id.split('-')[0]}[^"']*)["']`, 'gi');
        const similarIds = [];
        let match;
        while ((match = idPattern.exec(html)) !== null && similarIds.length < 5) {
          if (!similarIds.includes(match[1])) {
            similarIds.push(match[1]);
          }
        }
        if (similarIds.length > 0) {
          console.log(`Similar IDs found: ${similarIds.join(', ')}`);
        }
      }
      
      return null;
    } catch (err) {
      console.error(`Error extracting ${id}:`, err);
      return null;
    }
  };

  const fetchGoodReturnRates = async () => {
    try {
      setError(null);
      
      console.log('Fetching rates from Good Return...');
      
      // Try multiple CORS proxies as fallback
      const corsProxies = [
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?',
        'https://api.codetabs.com/v1/proxy?quest=',
      ];
      
      let lastError = null;
      
      for (let proxyIndex = 0; proxyIndex < corsProxies.length; proxyIndex++) {
        const corsProxy = corsProxies[proxyIndex];
        console.log(`Trying proxy ${proxyIndex + 1}/${corsProxies.length}: ${corsProxy}`);
        
        try {
          // Fetch all three pages with timeout
          const fetchWithTimeout = (url, timeout = 15000) => {
            return Promise.race([
              fetch(url),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout')), timeout)
              )
            ]);
          };
          
          const goldUrl = corsProxy + encodeURIComponent('https://www.goodreturns.in/gold-rates/');
          const silverUrl = corsProxy + encodeURIComponent('https://www.goodreturns.in/silver-rates/');
          const platinumUrl = corsProxy + encodeURIComponent('https://www.goodreturns.in/platinum-price.html');
          
          console.log('Fetching gold rates...');
          const goldResponse = await fetchWithTimeout(goldUrl);
          console.log('Gold response status:', goldResponse.status);
          
          console.log('Fetching silver rates...');
          const silverResponse = await fetchWithTimeout(silverUrl);
          console.log('Silver response status:', silverResponse.status);
          
          console.log('Fetching platinum rates...');
          const platinumResponse = await fetchWithTimeout(platinumUrl);
          console.log('Platinum response status:', platinumResponse.status);
          
          if (!goldResponse.ok) {
            throw new Error(`Gold request failed: ${goldResponse.status}`);
          }
          if (!silverResponse.ok) {
            throw new Error(`Silver request failed: ${silverResponse.status}`);
          }
          if (!platinumResponse.ok) {
            throw new Error(`Platinum request failed: ${platinumResponse.status}`);
          }
          
          console.log('All responses OK, parsing HTML...');
          
          const [goldHtml, silverHtml, platinumHtml] = await Promise.all([
            goldResponse.text(),
            silverResponse.text(),
            platinumResponse.text(),
          ]);
          
          console.log('HTML fetched:', {
            goldLength: goldHtml.length,
            silverLength: silverHtml.length,
            platinumLength: platinumHtml.length,
          });
          
          // Log sections of HTML that contain our target IDs
          console.log('\n===== GOLD HTML ANALYSIS =====');
          const goldSearchIds = ['24K-price', '22K-price', '24k', '22k'];
          goldSearchIds.forEach(searchId => {
            const idRegex = new RegExp(`id=["']([^"']*${searchId}[^"']*)["'][^>]*>([\\s\\S]{0,200})`, 'gi');
            let match;
            let count = 0;
            while ((match = idRegex.exec(goldHtml)) !== null && count < 3) {
              console.log(`Found: id="${match[1]}"`);
              console.log(`Content: "${match[2].substring(0, 150)}"`);
              count++;
            }
          });
          
          // Also search for context around prices to understand units
          const priceContextRegex = /₹\s*([0-9,]+(?:\.[0-9]+)?)[^₹]{0,50}(gram|gm|g|10\s*g|1\s*g)/gi;
          let contextMatch;
          let contextCount = 0;
          console.log('\n--- Price Context Analysis ---');
          while ((contextMatch = priceContextRegex.exec(goldHtml)) !== null && contextCount < 5) {
            console.log(`Found price: ₹${contextMatch[1]} for unit: ${contextMatch[2]}`);
            contextCount++;
          }
          console.log('==============================\n');
          
          // Extract values
          const gold24K = extractValueFromHtml(goldHtml, '24K-price');
          const gold22K = extractValueFromHtml(goldHtml, '22K-price');
          const silver1g = extractValueFromHtml(silverHtml, 'silver-1g-price');
          const platinum1g = extractValueFromHtml(platinumHtml, 'platinum-1g-price');
          
          console.log('\n===== FINAL EXTRACTED VALUES =====');
          console.log('Gold 24K:', gold24K ? `₹${gold24K.toFixed(2)}` : 'NULL');
          console.log('Gold 22K:', gold22K ? `₹${gold22K.toFixed(2)}` : 'NULL');
          console.log('Silver 1g:', silver1g ? `₹${silver1g.toFixed(2)}` : 'NULL');
          console.log('Platinum 1g:', platinum1g ? `₹${platinum1g.toFixed(2)}` : 'NULL');
          console.log('==================================\n');
          
          // Only update values that were successfully extracted, preserve old ones
          setGoodReturnRates(prevRates => ({
            gold24K: gold24K ?? prevRates?.gold24K,
            gold22K: gold22K ?? prevRates?.gold22K,
            silver1g: silver1g ?? prevRates?.silver1g,
            platinum1g: platinum1g ?? prevRates?.platinum1g,
          }));
          
          setLastGoodReturnUpdate(new Date());
          setIsLiveData(true);
          setLoading(false);
          setRefreshing(false);
          setError(null);
          console.log('✓ Successfully loaded Good Return rates');
          return; // Success, exit function
          
        } catch (proxyError) {
          console.warn(`Proxy ${proxyIndex + 1} failed:`, proxyError.message);
          lastError = proxyError;
          // Continue to next proxy
        }
      }
      
      // If we get here, all proxies failed
      throw new Error(`All proxies failed. Last error: ${lastError?.message || 'Unknown'}`);
      
    } catch (err) {
      console.error('Error fetching Good Return rates:', err);
      setError(err.message);
      setIsLiveData(false);
      setLoading(false);
      setRefreshing(false);
      // Don't clear goodReturnRates - keep old data
    }
  };

  useEffect(() => {
    // Fetch data based on active tab
    if (activeTab === 'goldprice') {
      fetchRates();
    } else {
      fetchGoodReturnRates();
    }
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      if (activeTab === 'goldprice') {
        fetchRates();
      } else {
        fetchGoodReturnRates();
      }
    }, 60000);
    
    return () => clearInterval(interval);
  }, [activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'goldprice') {
      fetchRates();
    } else {
      fetchGoodReturnRates();
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Loading live rates...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>Error loading rates</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={activeTab === 'goldprice' ? fetchRates : fetchGoodReturnRates}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
        <Text style={styles.errorHint}>
          Check console logs for details
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Live Metal Rates</Text>
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, isLiveData ? styles.statusLive : styles.statusOld]} />
            <Text style={styles.statusText}>{isLiveData ? 'Live' : 'Stale'}</Text>
          </View>
        </View>
        {(activeTab === 'goldprice' ? lastUpdate : lastGoodReturnUpdate) && (
          <Text style={styles.updateTime}>
            Updated: {(activeTab === 'goldprice' ? lastUpdate : lastGoodReturnUpdate).toLocaleTimeString()}
          </Text>
        )}
      </View>

      {/* Tab Buttons */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'goldprice' && styles.tabButtonActive]}
          onPress={() => setActiveTab('goldprice')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'goldprice' && styles.tabButtonTextActive]}>
            Gold Price
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'goodreturn' && styles.tabButtonActive]}
          onPress={() => setActiveTab('goodreturn')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'goodreturn' && styles.tabButtonTextActive]}>
            Good Return
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content based on active tab */}
      {activeTab === 'goldprice' ? (
        <GoldPriceTab rates={rates} refreshing={refreshing} onRefresh={onRefresh} />
      ) : (
        <GoodReturnTab rates={goodReturnRates} refreshing={refreshing} onRefresh={onRefresh} isLiveData={isLiveData} />
      )}
    </View>
  );
}

// Gold Price Tab Component
function GoldPriceTab({ rates, refreshing, onRefresh }) {
  if (!rates) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Cards Container - 2 per row */}
      <View style={styles.cardsContainer}>
        {/* Gold 24K Card */}
        <View style={[styles.card, styles.goldCard, styles.cardHalf]}>
          <View style={styles.cardHeader}>
            <Text style={styles.metalName}>GOLD</Text>
            <View style={[styles.changeContainer, rates.gold.change >= 0 ? styles.changePositive : styles.changeNegative]}>
              <Text style={styles.changeText}>
                {rates.gold.change >= 0 ? '▲' : '▼'} {Math.abs(rates.gold.change).toFixed(2)}%
              </Text>
            </View>
          </View>
          
          <View style={styles.rateRow}>
            <Text style={styles.rateLabel}>Per 1 Gram</Text>
            <Text style={styles.rateValue}>₹{rates.gold.perGram.toFixed(2)}</Text>
          </View>
        </View>

        {/* Silver Card */}
        <View style={[styles.card, styles.silverCard, styles.cardHalf]}>
          <View style={styles.cardHeader}>
            <Text style={styles.metalName}>SILVER</Text>
            <View style={[styles.changeContainer, rates.silver.change >= 0 ? styles.changePositive : styles.changeNegative]}>
              <Text style={styles.changeText}>
                {rates.silver.change >= 0 ? '▲' : '▼'} {Math.abs(rates.silver.change).toFixed(2)}%
              </Text>
            </View>
          </View>
          
          <View style={styles.rateRow}>
            <Text style={styles.rateLabel}>Per 1 Gram</Text>
            <Text style={styles.rateValue}>₹{rates.silver.perGram.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Info Box */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>ℹ️ About Live Rates</Text>
        <Text style={styles.infoText}>• Rates update automatically every 60 seconds</Text>
        <Text style={styles.infoText}>• Pull down to refresh manually</Text>
        <Text style={styles.infoText}>• Prices shown in Indian Rupees (INR)</Text>
        <Text style={styles.infoText}>• 1 Troy Ounce = 31.1035 grams</Text>
      </View>

      <Text style={styles.disclaimer}>
        * Rates are for reference only. Actual prices may vary by dealer and location.
      </Text>
    </ScrollView>
  );
}

// Good Return Tab Component
function GoodReturnTab({ rates, refreshing, onRefresh, isLiveData }) {
  if (!rates) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Fetching rates from Good Return...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Cards Container - 2 per row */}
      <View style={styles.cardsContainer}>
        {/* Gold 24K Card */}
        <View style={[styles.card, styles.goldCard, styles.cardHalf]}>
          <View style={styles.cardHeader}>
            <Text style={styles.metalName}>GOLD 24K</Text>
            <View style={[styles.statusDotSmall, isLiveData ? styles.statusLive : styles.statusOld]} />
          </View>
          
          <View style={styles.rateRow}>
            <Text style={styles.rateLabel}>Per 1 Gram</Text>
            {rates.gold24K && (
              <Text style={styles.rateValue}>
                ₹{rates.gold24K.toFixed(2)}
              </Text>
            )}
          </View>
        </View>

        {/* Gold 22K Card */}
        <View style={[styles.card, styles.goldCard, styles.cardHalf]}>
          <View style={styles.cardHeader}>
            <Text style={styles.metalName}>GOLD 22K</Text>
            <View style={[styles.statusDotSmall, isLiveData ? styles.statusLive : styles.statusOld]} />
          </View>
          
          <View style={styles.rateRow}>
            <Text style={styles.rateLabel}>Per 1 Gram</Text>
            {rates.gold22K && (
              <Text style={styles.rateValue}>
                ₹{rates.gold22K.toFixed(2)}
              </Text>
            )}
          </View>
        </View>

        {/* Silver Card */}
        <View style={[styles.card, styles.silverCard, styles.cardHalf]}>
          <View style={styles.cardHeader}>
            <Text style={styles.metalName}>SILVER</Text>
            <View style={[styles.statusDotSmall, isLiveData ? styles.statusLive : styles.statusOld]} />
          </View>
          
          <View style={styles.rateRow}>
            <Text style={styles.rateLabel}>Per 1 Gram</Text>
            {rates.silver1g && (
              <Text style={styles.rateValue}>
                ₹{rates.silver1g.toFixed(2)}
              </Text>
            )}
          </View>
        </View>

        {/* Platinum Card */}
        <View style={[styles.card, styles.platinumCard, styles.cardHalf]}>
          <View style={styles.cardHeader}>
            <Text style={styles.metalName}>PLATINUM</Text>
            <View style={[styles.statusDotSmall, isLiveData ? styles.statusLive : styles.statusOld]} />
          </View>
          
          <View style={styles.rateRow}>
            <Text style={styles.rateLabel}>Per 1 Gram</Text>
            {rates.platinum1g && (
              <Text style={styles.rateValue}>
                ₹{rates.platinum1g.toFixed(2)}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Info Box */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>ℹ️ About Good Return Rates</Text>
        <Text style={styles.infoText}>• Rates from goodreturns.in</Text>
        <Text style={styles.infoText}>• Updates automatically every 60 seconds</Text>
        <Text style={styles.infoText}>• Pull down to refresh manually</Text>
        <Text style={styles.infoText}>• Prices shown in Indian Rupees (INR)</Text>
        <Text style={styles.infoText}>• Uses CORS proxy to fetch data</Text>
        <Text style={styles.infoTextSmall}>⚡ Automatically tries 3 different proxies for reliability</Text>
      </View>

      <Text style={styles.disclaimer}>
        * Rates are for reference only. Actual prices may vary by dealer and location.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 15,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  errorHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 15,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  retryButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  updateTime: {
    fontSize: 14,
    color: '#666',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 5,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#FFD700',
  },
  tabButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  tabButtonTextActive: {
    color: '#333',
  },
  cardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    justifyContent: 'space-between',
  },
  card: {
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHalf: {
    width: '48%',
    marginBottom: 10,
    padding: 15,
  },
  goldCard: {
    backgroundColor: '#FFF9E6',
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700',
  },
  silverCard: {
    backgroundColor: '#F5F5F5',
    borderLeftWidth: 4,
    borderLeftColor: '#C0C0C0',
  },
  platinumCard: {
    backgroundColor: '#F0F8FF',
    borderLeftWidth: 4,
    borderLeftColor: '#B0C4DE',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metalName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  changeContainer: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  changePositive: {
    backgroundColor: '#e8f5e9',
  },
  changeNegative: {
    backgroundColor: '#ffebee',
  },
  changeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 8,
  },
  rateLabel: {
    fontSize: 12,
    color: '#666',
  },
  rateValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 15,
  },
  calculationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calcLabel: {
    fontSize: 14,
    color: '#666',
  },
  calcValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  infoBox: {
    margin: 15,
    padding: 15,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  infoTextSmall: {
    fontSize: 12,
    color: '#888',
    marginTop: 5,
    fontStyle: 'italic',
  },
  debugBox: {
    margin: 15,
    padding: 15,
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  debugText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    fontFamily: 'monospace',
  },
  debugTextSmall: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
    fontStyle: 'italic',
  },
  disclaimer: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    padding: 15,
    fontStyle: 'italic',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  statusDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 6,
  },
  statusLive: {
    backgroundColor: '#4CAF50',
  },
  statusOld: {
    backgroundColor: '#9E9E9E',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  updateTimeText: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
});
