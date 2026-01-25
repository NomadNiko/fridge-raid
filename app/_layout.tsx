import { Tabs } from 'expo-router';
import { Appearance } from 'react-native';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { initializeDatabase } from '../lib/storage';

export default function TabLayout() {
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme());

  useEffect(() => {
    // console.log('_layout.tsx initializing database');
    initializeDatabase().then(() => {});
    
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  const isDark = colorScheme === 'dark';

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
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
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="fridge" options={{ title: 'Fridge' }} />
        <Tabs.Screen name="collection" options={{ title: 'Collection' }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      </Tabs>
    </>
  );
}
