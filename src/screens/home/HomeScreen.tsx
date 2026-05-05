import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { Colors, Spacing } from '../../utils/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STATS = [
  { label: "Today's Purchases", icon: '📦', color: Colors.primary },
  { label: 'Pending Bills',     icon: '⏳', color: Colors.tertiary },
  { label: 'Total Outstanding', icon: '🏦', color: Colors.secondary },
  { label: "Today's Sales",     icon: '📈', color: Colors.primaryContainer },
];

const ACTIVITY = [
  {
    title: 'Purchased 120kg Yellowfin Tuna',
    sub: "From 'North Star Vessel' • 14 mins ago",
    status: 'Completed',
    color: Colors.primary,
  },
  {
    title: 'Sale Confirmed: Waterfront Grill',
    sub: 'Bulk Order #4299 • 2 hours ago',
    status: 'Pending',
    color: Colors.tertiary,
  },
  {
    title: 'Bill Payment Issued',
    sub: 'Fuel & Maintenance Supply • 5 hours ago',
    status: 'Processed',
    color: Colors.secondary,
  },
];

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface }}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.gutter, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={{ marginBottom: Spacing.xl }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.primary, letterSpacing: 1, marginBottom: 4 }}>
            FISHLOG PRO
          </Text>
          <Text style={{ fontSize: 32, fontWeight: '700', color: Colors.onSurface, letterSpacing: -0.5 }}>
            Good Morning, Skipper
          </Text>
          <Text style={{ fontSize: 16, color: Colors.onSurfaceVariant, marginTop: 4 }}>
            Here's what's happening at the docks today.
          </Text>
        </View>

        {/* ── Quick Actions ── */}
        <View style={{ flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('NewPurchaseEntry', {})}
            style={{
              flex: 1,
              backgroundColor: Colors.primary,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: Colors.onPrimary, fontWeight: '600', fontSize: 14 }}>
              + New Purchase
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('NewSalesOrder', {})}
            style={{
              flex: 1,
              backgroundColor: Colors.secondaryContainer,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: Colors.outlineVariant,
            }}
          >
            <Text style={{ color: Colors.onSecondaryContainer, fontWeight: '600', fontSize: 14 }}>
              + New Sale
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Stats Grid ── */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xl }}>
          {STATS.map((stat, i) => (
            <View
              key={i}
              style={{
                width: '47%',
                backgroundColor: Colors.surfaceContainerLow,
                borderRadius: 16,
                padding: Spacing.lg,
                minHeight: 120,
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: Colors.onSurfaceVariant, flex: 1 }}>
                  {stat.label}
                </Text>
                <Text style={{ fontSize: 18 }}>{stat.icon}</Text>
              </View>
              <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.onSurface }}>
                ***
              </Text>
            </View>
          ))}
        </View>

        {/* ── Recent Activity ── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
          <Text style={{ fontSize: 20, fontWeight: '600', color: Colors.onSurface }}>
            Recent Activity
          </Text>
          <TouchableOpacity>
            <Text style={{ fontSize: 14, color: Colors.primary }}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={{ gap: Spacing.sm }}>
          {ACTIVITY.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: Spacing.md,
                padding: Spacing.md,
                backgroundColor: Colors.surfaceContainerLowest,
                borderRadius: 12,
              }}
            >
              <View style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: Colors.primaryFixed,
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ fontSize: 18 }}>🐟</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: Colors.onSurface }}>
                  {item.title}
                </Text>
                <Text style={{ fontSize: 12, color: Colors.onSurfaceVariant }}>
                  {item.sub}
                </Text>
              </View>
              <View style={{
                paddingHorizontal: 8, paddingVertical: 3,
                backgroundColor: `${item.color}18`,
                borderRadius: 99,
              }}>
                <Text style={{ fontSize: 11, color: item.color, fontWeight: '600' }}>
                  {item.status}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}