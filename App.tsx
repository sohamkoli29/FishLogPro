import './global.css';
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { initializeDatabase } from './src/db';
import { getSetting, initSettings } from './src/db/settings';
import { useAppStore } from './src/stores/appStore';
import { Colors } from './src/utils/theme';

export default function App() {
  const setDbReady       = useAppStore((s) => s.setDbReady);
  const setBusinessName  = useAppStore((s) => s.setBusinessName);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initializeDatabase();
        initSettings();

        // Load persisted business name
        const saved = getSetting('businessName', '');
        if (saved) setBusinessName(saved);

        setDbReady(true);
        setLoading(false);
      } catch (err) {
        setError(String(err));
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={{
        flex: 1, backgroundColor: Colors.surface,
        justifyContent: 'center', alignItems: 'center', gap: 16,
      }}>
        <Text style={{
          fontSize: 14, fontWeight: '700',
          color: Colors.primary, letterSpacing: 1,
        }}>
          FISHLOG PRO
        </Text>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ fontSize: 13, color: Colors.onSurfaceVariant }}>
          Setting up database…
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{
        flex: 1, backgroundColor: Colors.surface,
        justifyContent: 'center', alignItems: 'center', padding: 32,
      }}>
        <Text style={{
          fontSize: 16, fontWeight: '600',
          color: Colors.error, marginBottom: 8,
        }}>
          Database Error
        </Text>
        <Text style={{
          fontSize: 13, color: Colors.onSurfaceVariant, textAlign: 'center',
        }}>
          {error}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor="#fbf9f4" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}