import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { initializeDatabase } from '../lib/storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { RevenueCatProvider } from '../lib/revenueCat';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingModal from '../components/OnboardingModal';

export default function TabLayout() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    initializeDatabase().then(() => {});

    AsyncStorage.getItem('walkthroughSeen').then((val) => {
      if (val !== 'true') setShowOnboarding(true);
      setOnboardingChecked(true);
    });
  }, []);

  const handleOnboardingComplete = async () => {
    await AsyncStorage.setItem('walkthroughSeen', 'true');
    setShowOnboarding(false);
  };

  const isDark = true;

  return (
    <RevenueCatProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {onboardingChecked && (
        <OnboardingModal visible={showOnboarding} onComplete={handleOnboardingComplete} />
      )}
      <Tabs
        screenOptions={{
          headerShown: true,
          tabBarStyle: {
            backgroundColor: isDark ? '#000000' : '#ffffff',
            borderTopColor: isDark ? '#1f1f1f' : '#e5e5e5',
          },
          tabBarActiveTintColor: isDark ? '#ffffff' : '#000000',
          tabBarInactiveTintColor: isDark ? '#8e8e93' : '#8e8e93',
          headerStyle: {
            backgroundColor: isDark ? '#000000' : '#ffffff',
          },
          headerTintColor: isDark ? '#ffffff' : '#000000',
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Search',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="search" size={size - 3} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="fridge"
          options={{
            title: 'Fridge',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="fridge-variant-outline" size={size - 3} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="collection"
          options={{
            title: 'Shopping',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cart-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="cookbook"
          options={{
            title: 'Cookbook',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="book-outline" size={size - 3} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings-outline" size={size - 3} color={color} />
            ),
          }}
        />
      </Tabs>
    </RevenueCatProvider>
  );
}
