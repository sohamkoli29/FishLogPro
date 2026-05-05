import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { Colors, Spacing } from '../../utils/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ITEMS = [
  { label: 'Business Profile', sub: 'Business name for bills',    icon: '🏪', screen: null },
  { label: 'Fish Names',        sub: 'Manage autocomplete list',   icon: '🐟', screen: null },
  { label: 'Backup & Restore',  sub: 'Export or import your data', icon: '☁️', screen: 'BackupRestore' as const },
];

export default function SettingsScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.gutter, paddingBottom: 120 }}>
        <View style={{ marginBottom: Spacing.xxl }}>
          <Text style={{ fontSize: 40, fontWeight: '700', color: Colors.onSurface, letterSpacing: -0.8 }}>
            Settings
          </Text>
          <Text style={{ fontSize: 16, color: Colors.onSurfaceVariant, marginTop: 4 }}>
            Manage your profile and preferences.
          </Text>
        </View>

        <View style={{ gap: Spacing.sm }}>
          {ITEMS.map((item, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => item.screen && navigation.navigate(item.screen)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: Spacing.md,
                padding: Spacing.md,
                backgroundColor: Colors.surfaceContainerLow,
                borderRadius: 12,
              }}
            >
              <View style={{
                width: 44, height: 44, borderRadius: 12,
                backgroundColor: Colors.primaryFixed,
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ fontSize: 22 }}>{item.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '500', color: Colors.onSurface }}>
                  {item.label}
                </Text>
                <Text style={{ fontSize: 12, color: Colors.onSurfaceVariant }}>
                  {item.sub}
                </Text>
              </View>
              <Text style={{ fontSize: 20, color: Colors.outline }}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ marginTop: Spacing.xxl, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: Colors.onSurfaceVariant }}>FishLog Pro</Text>
          <Text style={{ fontSize: 10, color: Colors.outline, marginTop: 4, letterSpacing: 2 }}>
            VERSION 1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}