/**
 * Gold Tracker Unified App
 * Combines PDF processing with transaction tracking
 * Uses native Android modules for PDF extraction
 */

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Services
import DataStorage from './src/services/DataStorage';

// Screens
import UploadScreen from './src/screens/UploadScreen';
import DataLoadScreen from './src/screens/DataLoadScreen';
import InsightsScreen from './src/screens/InsightsScreen';
import ChartsScreen from './src/screens/ChartsScreen';
import LiveRatesScreen from './src/screens/LiveRatesScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Initialize database and load data on app start
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log('🚀 Initializing Gold Tracker Unified...');
      
      // Initialize database
      await DataStorage.initDatabase();
      console.log('✅ Database initialized');

      // Load existing transactions
      const transactions = await DataStorage.getAllTransactions();
      console.log(`✅ Loaded ${transactions.length} transactions`);
      
      setData(transactions);
      setInitialized(true);
      setLoading(false);
    } catch (error) {
      console.error('❌ Initialization error:', error);
      Alert.alert(
        'Initialization Error',
        `Failed to initialize app: ${error.message}`,
        [{ text: 'OK' }]
      );
      setLoading(false);
    }
  };

  const handleDataLoaded = (transactions) => {
    console.log(`📊 Data updated: ${transactions.length} transactions`);
    setData(transactions);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>🪙 Loading Gold Tracker...</Text>
      </View>
    );
  }

  if (!initialized) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>❌ Failed to initialize app</Text>
        <Text style={styles.errorSubtext}>Please restart the application</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerTextContainer}>
              <View style={styles.titleRow}>
                <View style={styles.iconContainer}>
                  <Text style={styles.icon}>🪙</Text>
                </View>
                <View>
                  <Text style={styles.titleLine}>Gold Tracker Unified</Text>
                  <Text style={styles.subtitleLine}>
                    {data.length} Transactions • PDF Processing
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Navigation Tabs */}
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#966B9D',
            tabBarInactiveTintColor: '#999',
            tabBarStyle: {
              backgroundColor: '#FFFFFF',
              borderTopWidth: 1,
              borderTopColor: '#E0E0E0',
              paddingBottom: 12,
              paddingTop: 12,
              height: 75,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '600',
              marginTop: 4,
            },
          }}
        >
          <Tab.Screen
            name="Upload"
            options={{
              tabBarIcon: ({ color, focused }) => (
                <Ionicons 
                  name={focused ? "cloud-upload" : "cloud-upload-outline"} 
                  size={24} 
                  color={color} 
                />
              ),
            }}
          >
            {(props) => (
              <UploadScreen
                {...props}
                onDataLoaded={handleDataLoaded}
              />
            )}
          </Tab.Screen>

          <Tab.Screen
            name="Data"
            options={{
              tabBarIcon: ({ color, focused }) => (
                <Ionicons 
                  name={focused ? "list" : "list-outline"} 
                  size={24} 
                  color={color} 
                />
              ),
            }}
          >
            {(props) => (
              <DataLoadScreen
                {...props}
                onDataLoaded={handleDataLoaded}
                initialData={data}
              />
            )}
          </Tab.Screen>

          <Tab.Screen
            name="Insights"
            options={{
              tabBarIcon: ({ color, focused }) => (
                <Ionicons 
                  name={focused ? "bulb" : "bulb-outline"} 
                  size={24} 
                  color={color} 
                />
              ),
            }}
          >
            {(props) => <InsightsScreen {...props} data={data} />}
          </Tab.Screen>

          <Tab.Screen
            name="Charts"
            options={{
              tabBarIcon: ({ color, focused }) => (
                <Ionicons 
                  name={focused ? "bar-chart" : "bar-chart-outline"} 
                  size={24} 
                  color={color} 
                />
              ),
            }}
          >
            {(props) => <ChartsScreen {...props} data={data} />}
          </Tab.Screen>

          <Tab.Screen
            name="Live Rates"
            options={{
              tabBarIcon: ({ color, focused }) => (
                <Ionicons 
                  name={focused ? "pulse" : "pulse-outline"} 
                  size={24} 
                  color={color} 
                />
              ),
            }}
          >
            {(props) => <LiveRatesScreen {...props} data={data} />}
          </Tab.Screen>
        </Tab.Navigator>
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  errorText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#F44336',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
  },
  header: {
    backgroundColor: '#966B9D',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  icon: {
    fontSize: 28,
  },
  titleLine: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subtitleLine: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
    fontWeight: '500',
  },
});
