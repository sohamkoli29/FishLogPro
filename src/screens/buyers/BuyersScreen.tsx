import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { Colors, Spacing } from '../../utils/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function BuyersScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.gutter, paddingBottom: 120 }}>
        <View style={{ marginBottom: Spacing.xl }}>
          <Text style={{ fontSize: 40, fontWeight: '700', color: Colors.onSurface, letterSpacing: -0.8 }}>
            Buyers Registry
          </Text>
          <Text style={{ fontSize: 16, color: Colors.onSurfaceVariant, marginTop: 4 }}>
            Track commercial relationships and outstanding balances.
          </Text>
        </View>

        <View style={{
          backgroundColor: Colors.surfaceContainerLow,
          borderRadius: 20,
          padding: Spacing.xxl,
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🤝</Text>
          <Text style={{ fontSize: 18, fontWeight: '600', color: Colors.onSurface, marginBottom: 6 }}>
            No Buyers Yet
          </Text>
          <Text style={{ fontSize: 14, color: Colors.onSurfaceVariant, textAlign: 'center' }}>
            Tap + to add your first buyer and start tracking sales.
          </Text>
        </View>
      </ScrollView>

      <TouchableOpacity
        onPress={() => navigation.navigate('AddBuyer', {})}
        style={{
          position: 'absolute', bottom: 100, right: 24,
          width: 56, height: 56, borderRadius: 16,
          backgroundColor: Colors.primary,
          justifyContent: 'center', alignItems: 'center',
          elevation: 8,
          shadowColor: Colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3, shadowRadius: 8,
        }}
      >
        <Text style={{ color: Colors.onPrimary, fontSize: 28, lineHeight: 32 }}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}