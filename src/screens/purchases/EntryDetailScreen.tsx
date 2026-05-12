import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../types';
import { Colors, Spacing } from '../../utils/theme';
import { usePurchases, PurchaseEntryWithItems } from '../../hooks/usePurchases';
import { usePayments } from '../../hooks/usePayments';
import { Boat,CurrencyCircleDollar,EyeSlash,Eye ,Trash  } from 'phosphor-react-native';

type RouteT = RouteProp<RootStackParamList, 'EntryDetail'>;
type Nav    = NativeStackNavigationProp<RootStackParamList>;

// ── Helpers ────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [yyyy, mm, dd] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${dd} ${months[parseInt(mm) - 1]} ${yyyy}`;
}

// ── Progress bar card ──────────────────────────────────────────
function PaymentProgress({
  totalAmount,
  totalPaid,
}: {
  totalAmount: number;
  totalPaid:   number;
}) {
  const pct      = totalAmount > 0 ? Math.min(totalPaid / totalAmount, 1) : 0;
  const balance  = totalAmount - totalPaid;
  const isCleared = balance <= 0;

  return (
    <View style={{
      backgroundColor: Colors.onSurface,
      borderRadius: 20,
      padding: Spacing.lg,
    }}>
      <Text style={{
        fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
        color: `${Colors.onPrimary}80`, marginBottom: 4,
      }}>
        PAYMENT SUMMARY
      </Text>

      <Text style={{
        fontSize: 36, fontWeight: '700',
        color: Colors.onPrimary, letterSpacing: -0.5,
      }}>
        ₹{totalAmount.toLocaleString('en-IN')}
      </Text>

      {/* Progress bar */}
      <View style={{
        height: 6,
        backgroundColor: `${Colors.onPrimary}20`,
        borderRadius: 99,
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
        overflow: 'hidden',
      }}>
        <View style={{
          height: '100%',
          width: `${pct * 100}%`,
          backgroundColor: isCleared ? '#4ade80' : Colors.primaryFixed,
          borderRadius: 99,
        }} />
      </View>

      {/* Paid / Outstanding */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 11, color: `${Colors.onPrimary}60`, fontWeight: '600' }}>
            PAID
          </Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#4ade80' }}>
            ₹{totalPaid.toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 11, color: `${Colors.onPrimary}60`, fontWeight: '600' }}>
            {isCleared ? 'CLEARED' : 'BALANCE'}
          </Text>
          <Text style={{
            fontSize: 16, fontWeight: '700',
            color: isCleared ? '#4ade80' : Colors.errorContainer,
          }}>
            {isCleared ? '✓ Fully Paid' : `₹${balance.toLocaleString('en-IN')}`}
          </Text>
        </View>
      </View>

      <Text style={{
        fontSize: 11, color: `${Colors.onPrimary}50`,
        textAlign: 'center', marginTop: Spacing.sm,
      }}>
        {Math.round(pct * 100)}% of balance cleared
      </Text>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────
export default function EntryDetailScreen() {
  const navigation                = useNavigation<Nav>();
  const route                     = useRoute<RouteT>();
  const { entryId }               = route.params;
  const { getEntry, deleteEntry } = usePurchases();
  const { getTotalPaid }          = usePayments();

  const [entry,   setEntry]   = useState<PurchaseEntryWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [pricesVisible, setPricesVisible] = useState(false);

  // ── Load data ──
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const e = await getEntry(entryId);
      setEntry(e);
    } catch (err) {
      console.error('[EntryDetail] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Delete entry ──
  const handleDeleteEntry = () => {
    Alert.alert(
      'Delete Entry',
      'Delete this purchase entry and all its payments? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteEntry(entryId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  // ── Loading ──
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  // ── Not found ──
  if (!entry) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 16, color: Colors.onSurfaceVariant }}>Entry not found.</Text>
      </SafeAreaView>
    );
  }

  const balance = entry.totalAmount - entry.totalPaid;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface }} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.gutter, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadData}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* ── Entry header ── */}
        <View style={{ marginBottom: Spacing.lg }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
            marginBottom: 4,
          }}>
            <View style={{
              backgroundColor: Colors.primaryFixed,
              borderRadius: 99,
              paddingHorizontal: 10,
              paddingVertical: 3,
            }}>
              <Text style={{
                fontSize: 11, fontWeight: '700',
                color: Colors.onPrimaryFixed, letterSpacing: 0.5,
              }}>
                ENTRY #{entry.id}
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: Colors.onSurfaceVariant }}>
              {formatDate(entry.date)}
            </Text>
          </View>

          <Text style={{
            fontSize: 26, fontWeight: '700',
            color: Colors.onSurface, letterSpacing: -0.3,
          }}>
            {entry.fishermanName}
          </Text>
        <View
  style={{
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  }}
>
  <Boat
    size={15}
    color={Colors.onSurfaceVariant}
    weight="fill"
  />

  <Text
    style={{
      fontSize: 15,
      color: Colors.onSurfaceVariant,
    }}
  >
    {entry.fishermanBoat}
  </Text>
</View>
        </View>

        {/* ── Payment summary ── */}
        <View style={{ marginBottom: Spacing.lg }}>
          <PaymentProgress
            totalAmount={entry.totalAmount}
            totalPaid={entry.totalPaid}
          />
        </View>

        {/* ── Action buttons ── */}
        <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg }}>
          {/* Payments button */}
         <TouchableOpacity
  onPress={() =>
    navigation.navigate('PaymentsScreen', {
      referenceType: 'purchase',
      referenceId:   entry.id,
      name:          `${entry.fishermanName} — Entry #${entry.id}`,
    })
  }
  style={{
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  }}
>
 <View
  style={{
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  }}
>
  <CurrencyCircleDollar
    size={14}
    color={`${Colors.onPrimary}90`}
    weight="fill"
  />

  <Text
    style={{
      color: `${Colors.onPrimary}90`,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
    }}
  >
    PAYMENTS
  </Text>
</View>
  <Text style={{ color: Colors.onPrimary, fontSize: 14, fontWeight: '700' }}>
    {balance > 0
      ? `₹${balance.toLocaleString('en-IN')} due`
      : 'Cleared'}
  </Text>
</TouchableOpacity>

          {/* Show/hide prices */}
          <TouchableOpacity
  onPress={() => setPricesVisible(!pricesVisible)}
  style={{
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: pricesVisible
      ? Colors.primaryFixed
      : Colors.surfaceContainer,
    borderRadius: 8,
  }}
>
  {pricesVisible ? (
    <EyeSlash
      size={16}
      color={
        pricesVisible
          ? Colors.onPrimaryFixed
          : Colors.outline
      }
      weight="bold"
    />
  ) : (
    <Eye
      size={16}
      color={
        pricesVisible
          ? Colors.onPrimaryFixed
          : Colors.outline
      }
      weight="bold"
    />
  )}

  <Text
    style={{
      fontSize: 13,
      fontWeight: '600',
      color: pricesVisible
        ? Colors.onPrimaryFixed
        : Colors.outline,
    }}
  >
    {pricesVisible ? 'Hide Prices' : 'Show Prices'}
  </Text>
</TouchableOpacity>

          {/* Delete */}
          <TouchableOpacity
            onPress={handleDeleteEntry}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: `${Colors.error}0a`,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: `${Colors.error}30`,
            }}
          >
           <Trash
  size={14}
  color={Colors.error}
  weight="bold"
/>
          </TouchableOpacity>
        </View>

        {/* ── Catch inventory ── */}
        <View style={{
          backgroundColor: Colors.surfaceContainerLow,
          borderRadius: 16,
          padding: Spacing.md,
          marginBottom: Spacing.lg,
        }}>
          <Text style={{
            fontSize: 15, fontWeight: '700',
            color: Colors.onSurface, marginBottom: Spacing.md,
          }}>
            Catch Inventory
          </Text>

          {/* Table header */}
          <View style={{
            flexDirection: 'row',
            paddingBottom: 8,
            borderBottomWidth: 1,
            borderBottomColor: Colors.outlineVariant,
            marginBottom: 8,
          }}>
            <Text style={{ flex: 2, fontSize: 11, fontWeight: '700', color: Colors.outline, letterSpacing: 0.5 }}>
              SPECIES
            </Text>
            <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: Colors.outline, letterSpacing: 0.5, textAlign: 'center' }}>
              QTY
            </Text>
            <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: Colors.outline, letterSpacing: 0.5, textAlign: 'right' }}>
              RATE
            </Text>
            <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: Colors.outline, letterSpacing: 0.5, textAlign: 'right' }}>
              TOTAL
            </Text>
          </View>

          {/* Table rows */}
          {entry.items.map((item, i) => (
            <View
              key={item.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 10,
                borderBottomWidth: i < entry.items.length - 1 ? 1 : 0,
                borderBottomColor: Colors.outlineVariant,
              }}
            >
              <View style={{ flex: 2 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.onSurface }}>
                  {item.fishName}
                </Text>
                <Text style={{ fontSize: 11, color: Colors.outline }}>
                  {item.unit}
                </Text>
              </View>
              <Text style={{ flex: 1, fontSize: 14, color: Colors.onSurface, textAlign: 'center' }}>
                {item.quantity}
              </Text>
              <Text style={{
                flex: 1, fontSize: 14,
                color: pricesVisible ? Colors.onSurface : Colors.outline,
                textAlign: 'right',
                letterSpacing: pricesVisible ? 0 : 2,
              }}>
                {pricesVisible ? `₹${item.pricePerUnit}` : '••••'}
              </Text>
              <Text style={{
                flex: 1, fontSize: 14, fontWeight: '700',
                color: pricesVisible ? Colors.tertiary : Colors.outline,
                textAlign: 'right',
                letterSpacing: pricesVisible ? 0 : 2,
              }}>
                {pricesVisible ? `₹${item.totalPrice.toLocaleString('en-IN')}` : '••••'}
              </Text>
            </View>
          ))}

          {/* Total row */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingTop: Spacing.sm,
            marginTop: Spacing.sm,
            borderTopWidth: 2,
            borderTopColor: Colors.outlineVariant,
          }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.onSurface }}>
              Total
            </Text>
            <Text style={{
              fontSize: 16, fontWeight: '700',
              color: pricesVisible ? Colors.primary : Colors.outline,
              letterSpacing: pricesVisible ? 0 : 2,
            }}>
              {pricesVisible
                ? `₹${entry.totalAmount.toLocaleString('en-IN')}`
                : '••••••'}
            </Text>
          </View>
        </View>

        {/* ── Notes ── */}
        {entry.notes && (
          <View style={{
            backgroundColor: Colors.surfaceContainerLow,
            borderRadius: 16,
            padding: Spacing.md,
            marginBottom: Spacing.lg,
          }}>
            <Text style={{
              fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
              color: Colors.onSurfaceVariant, marginBottom: 6,
            }}>
              NOTES
            </Text>
            <Text style={{ fontSize: 14, color: Colors.onSurface, lineHeight: 20 }}>
              {entry.notes}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}