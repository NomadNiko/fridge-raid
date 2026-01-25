import './global.css';
import { Slot } from 'expo-router';
import { useEffect, useState } from 'react';
import { initializeDatabase } from './lib/storage';
import { View, ActivityIndicator } from 'react-native';

export default function Root() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    console.log('App.tsx useEffect running');
    initializeDatabase()
      .then(() => {
        console.log('Database initialized in App.tsx');
        setReady(true);
      })
      .catch((e) => {
        console.error('Database init error:', e);
        setReady(true);
      });
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Slot />;
}
