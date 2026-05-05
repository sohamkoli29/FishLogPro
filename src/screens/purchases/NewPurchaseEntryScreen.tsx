import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing } from '../../utils/theme';

export default function NewPurchaseEntryScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface }}>
      <View style={{ padding: Spacing.gutter }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.primary }}>
          New Purchase Entry
        </Text>
        <Text style={{ fontSize: 15, color: Colors.onSurfaceVariant, marginTop: 8 }}>
          Coming on Day 4 →
        </Text>
      </View>
    </SafeAreaView>
  );
}