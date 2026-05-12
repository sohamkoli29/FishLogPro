import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';

import {
  Trash,
  FilePdf ,
  ClipboardText,
} from "phosphor-react-native";


import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { eq, sql, desc } from 'drizzle-orm';

import { RootStackParamList } from '../../types';
import { Colors, Spacing } from '../../utils/theme';
import { db } from '../../db/client';
import {
  purchaseEntries,
  purchaseItems,
  payments,
} from '../../db/schema';
import { usePurchases } from '../../hooks/usePurchases';

type Nav    = NativeStackNavigationProp<RootStackParamList>;
type RouteT = RouteProp<RootStackParamList, 'FishermanDetail'>;

// ── Types ──────────────────────────────────────────────────────
interface EntryRow {
  id:          number;
  date:        string;
  totalAmount: number;
  totalPaid:   number;
  balance:     number;
  itemCount:   number;
}

// ── Helpers ────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [yyyy, mm, dd] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${dd} ${months[parseInt(mm) - 1]} ${yyyy}`;
}

// ── Entry card ─────────────────────────────────────────────────
function EntryCard({
  entry,
  onPress,
  onDelete,
}: {
  entry:    EntryRow;
  onPress:  () => void;
  onDelete: () => void;
}) {
  const isCleared = entry.balance <= 0;

  const handleDelete = () => {
    Alert.alert(
      'Delete Entry',
      'Delete this purchase entry and all its payments?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: Colors.surfaceContainerLowest,
        borderRadius: 14,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.outlineVariant,
        borderLeftWidth: 4,
        borderLeftColor: isCleared ? Colors.primary : Colors.error,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* Left */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.onSurface }}>
            {formatDate(entry.date)}
          </Text>
          <Text style={{ fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 2 }}>
            {entry.itemCount} item{entry.itemCount !== 1 ? 's' : ''}
            {' • '}
            Entry #{entry.id}
          </Text>
        </View>

        {/* Right */}
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={{
            backgroundColor: isCleared ? Colors.primaryFixed : Colors.errorContainer,
            borderRadius: 99,
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}>
            <Text style={{
              fontSize: 10, fontWeight: '700',
              color: isCleared ? Colors.onPrimaryFixed : Colors.onErrorContainer,
            }}>
              {isCleared ? 'CLEARED' : 'PENDING'}
            </Text>
          </View>
          <Text style={{
            fontSize: 16, fontWeight: '700',
            color: Colors.onSurface,
          }}>
            ₹{entry.totalAmount.toLocaleString('en-IN')}
          </Text>
          {!isCleared && (
            <Text style={{ fontSize: 12, color: Colors.error }}>
              ₹{entry.balance.toLocaleString('en-IN')} due
            </Text>
          )}
        </View>
      </View>

      {/* Progress bar */}
      {entry.totalAmount > 0 && (
        <View style={{
          height: 4,
          backgroundColor: Colors.outlineVariant,
          borderRadius: 99,
          marginTop: Spacing.sm,
          overflow: 'hidden',
        }}>
          <View style={{
            height: '100%',
            width: `${Math.min((entry.totalPaid / entry.totalAmount) * 100, 100)}%`,
            backgroundColor: isCleared ? Colors.primary : Colors.tertiary,
            borderRadius: 99,
          }} />
        </View>
      )}

      {/* Delete */}
      <TouchableOpacity
        onPress={handleDelete}
        style={{
          alignSelf: 'flex-end',
          marginTop: Spacing.sm,
          paddingHorizontal: 12,
          paddingVertical: 4,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: `${Colors.error}30`,
          backgroundColor: `${Colors.error}0a`,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
  <Trash
    size={12}
    color={Colors.error}
    weight="fill"
  />
  <Text style={{ fontSize: 12, color: Colors.error, fontWeight: '500' }}>
    Delete
  </Text>
</View>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ── Main screen ────────────────────────────────────────────────
export default function FishermanDetailScreen() {
  const navigation  = useNavigation<Nav>();
  const route       = useRoute<RouteT>();
  const { fishermenId, name } = route.params;
  const { deleteEntry }       = usePurchases();

  const [entries,  setEntries]  = React.useState<EntryRow[]>([]);
  const [summary,  setSummary]  = React.useState({ totalPurchases: 0, totalPaid: 0, balance: 0 });
  const [loading,  setLoading]  = React.useState(true);
  const isMounted               = useRef(true);

  React.useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);

      // All entries for this fisherman
      const rows = await db
        .select()
        .from(purchaseEntries)
        .where(eq(purchaseEntries.fishermenId, fishermenId))
        .orderBy(desc(purchaseEntries.date));

      const entryRows: EntryRow[] = await Promise.all(
        rows.map(async (e) => {
          // Item count
          const items = await db
            .select({ id: purchaseItems.id })
            .from(purchaseItems)
            .where(eq(purchaseItems.entryId, e.id));

          // Total paid for this entry
          const [pmtRes] = await db
            .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
            .from(payments)
            .where(
              sql`${payments.referenceType} = 'purchase'
                  AND ${payments.referenceId} = ${e.id}`
            );

          const totalPaid = Number(pmtRes?.total ?? 0);

          return {
            id:          e.id,
            date:        e.date,
            totalAmount: e.totalAmount,
            totalPaid,
            balance:     e.totalAmount - totalPaid,
            itemCount:   items.length,
          };
        })
      );

      // Summary
      const totalPurchases = entryRows.reduce((s, e) => s + e.totalAmount, 0);
      const totalPaid      = entryRows.reduce((s, e) => s + e.totalPaid,   0);

      if (isMounted.current) {
        setEntries(entryRows);
        setSummary({ totalPurchases, totalPaid, balance: totalPurchases - totalPaid });
      }
    } catch (err) {
      console.error('[FishermanDetail] error:', err);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [fishermenId]);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  const handleDelete = async (entryId: number) => {
    await deleteEntry(entryId);
    await fetchAll();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface }} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.gutter, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchAll}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* ── Summary card ── */}
        <View style={{
          backgroundColor: Colors.primary,
          borderRadius: 20,
          padding: Spacing.lg,
          marginBottom: Spacing.xl,
        }}>
          <Text style={{
            fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
            color: `${Colors.onPrimary}80`, marginBottom: 4,
          }}>
            TOTAL PURCHASES
          </Text>
          <Text style={{
            fontSize: 36, fontWeight: '700',
            color: Colors.onPrimary, letterSpacing: -0.5,
          }}>
            ₹{summary.totalPurchases.toLocaleString('en-IN')}
          </Text>

          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: Spacing.md,
            paddingTop: Spacing.md,
            borderTopWidth: 1,
            borderTopColor: `${Colors.onPrimary}20`,
          }}>
            <View>
              <Text style={{ fontSize: 10, color: `${Colors.onPrimary}60`, fontWeight: '700' }}>
                PAID
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#4ade80' }}>
                ₹{summary.totalPaid.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 10, color: `${Colors.onPrimary}60`, fontWeight: '700' }}>
                BALANCE DUE
              </Text>
              <Text style={{
                fontSize: 16, fontWeight: '700',
                color: summary.balance > 0 ? Colors.errorContainer : '#4ade80',
              }}>
                {summary.balance > 0
                  ? `₹${summary.balance.toLocaleString('en-IN')}`
                  : 'Cleared'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Entries header ── */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: Spacing.md,
          flexWrap: 'wrap',
          gap: Spacing.sm,
        }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.onSurface }}>
            Purchase Entries
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('NewPurchaseEntry', { fishermenId })}
            style={{
              backgroundColor: Colors.primary,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Text style={{ color: Colors.onPrimary, fontSize: 16, lineHeight: 20 }}>+</Text>
            <Text style={{ color: Colors.onPrimary, fontSize: 13, fontWeight: '600' }}>
              New Entry
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
  onPress={() => navigation.navigate('StatementScreen', {
    type: 'fisherman',
    id:   fishermenId,
    name,
  })}
  style={{
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  }}
>
  <FilePdf 
  size={14}
  color={Colors.onSurface}
  weight="regular"
/>
  <Text style={{ color: Colors.onSurface, fontSize: 13, fontWeight: '600' }}>
    Bill
  </Text>
</TouchableOpacity>
        </View>

        {/* ── Loading ── */}
        {loading && entries.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}

        {/* ── Empty state ── */}
        {!loading && entries.length === 0 && (
          <View style={{
            backgroundColor: Colors.surfaceContainerLow,
            borderRadius: 16,
            padding: Spacing.xxl,
            alignItems: 'center',
          }}>
            <ClipboardText
  size={40}
  color={Colors.primary}
  weight="duotone"
  style={{ marginBottom: 12 }}
/>
            <Text style={{
              fontSize: 16, fontWeight: '600',
              color: Colors.onSurface, marginBottom: 6,
            }}>
              No Entries Yet
            </Text>
            <Text style={{
              fontSize: 14, color: Colors.onSurfaceVariant,
              textAlign: 'center', lineHeight: 20,
            }}>
              Tap New Entry to log the first purchase from {name}.
            </Text>
          </View>
        )}

        {/* ── Entry list ── */}
        {entries.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            onPress={() => navigation.navigate('EntryDetail', { entryId: entry.id })}
            onDelete={() => handleDelete(entry.id)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}