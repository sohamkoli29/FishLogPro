import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing } from '../../utils/theme';

export default function RegisterScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.gutter, paddingBottom: 120 }}>
        <View style={{ marginBottom: Spacing.xl }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.primary, letterSpacing: 1, marginBottom: 6 }}>
            NET PERFORMANCE
          </Text>
          <Text style={{ fontSize: 40, fontWeight: '700', color: Colors.onSurface, letterSpacing: -0.8 }}>
            Master Profit Ledger
          </Text>
        </View>

        {/* Hero card */}
        <View style={{
          backgroundColor: Colors.surfaceContainer,
          borderRadius: 24,
          padding: Spacing.xl,
          marginBottom: Spacing.xl,
          borderWidth: 1,
          borderColor: Colors.outlineVariant,
        }}>
          <Text style={{ fontSize: 13, color: Colors.onSurfaceVariant, marginBottom: 4 }}>All-time Net Profit</Text>
          <Text style={{ fontSize: 48, fontWeight: '700', color: Colors.primary }}>***</Text>
          <View style={{ flexDirection: 'row', gap: Spacing.xl, marginTop: Spacing.lg }}>
            {[
              { label: 'Active Fishermen', value: '—' },
              { label: 'Pending Shipments', value: '—' },
            ].map((s, i) => (
              <View key={i}>
                <Text style={{ fontSize: 12, color: Colors.onSurfaceVariant }}>{s.label}</Text>
                <Text style={{ fontSize: 22, fontWeight: '600', color: Colors.onSurface }}>{s.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Fishermen Dues */}
        <Text style={{ fontSize: 20, fontWeight: '600', color: Colors.onSurface, marginBottom: Spacing.md }}>
          Fishermen Dues
        </Text>
        <View style={{
          backgroundColor: Colors.surfaceContainerLow,
          borderRadius: 16, padding: Spacing.xl,
          alignItems: 'center', marginBottom: Spacing.xl,
        }}>
          <Text style={{ fontSize: 14, color: Colors.onSurfaceVariant }}>No dues recorded yet.</Text>
        </View>

        {/* Buyer Debts */}
        <Text style={{ fontSize: 20, fontWeight: '600', color: Colors.onSurface, marginBottom: Spacing.md }}>
          Buyer Debts
        </Text>
        <View style={{
          backgroundColor: Colors.surfaceContainerHigh,
          borderRadius: 16, padding: Spacing.xl,
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: 14, color: Colors.onSurfaceVariant }}>No buyer debts recorded yet.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}