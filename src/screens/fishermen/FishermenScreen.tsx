import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { eq, sql, desc } from 'drizzle-orm';

import { RootStackParamList } from '../../types';
import { Colors, Spacing } from '../../utils/theme';
import { db } from '../../db/client';
import {
  fishermen,
  purchaseEntries,
  payments,
  type Fisherman,
} from '../../db/schema';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ── Types ──────────────────────────────────────────────────────
interface FishermanWithBalance extends Fisherman {
  totalPurchases: number;
  totalPaid:      number;
  balance:        number;
}

// ── Balance badge ──────────────────────────────────────────────
function BalanceBadge({ balance }: { balance: number }) {
  const isCleared = balance === 0;
  const isOwed    = balance > 0;

  const bg    = isCleared ? Colors.primaryFixed
              : isOwed    ? Colors.errorContainer
              :             Colors.secondaryContainer;

  const color = isCleared ? Colors.onPrimaryFixed
              : isOwed    ? Colors.onErrorContainer
              :             Colors.onSecondaryContainer;

  const label = isCleared ? 'Cleared'
              : isOwed    ? 'Owes'
              :             'Advance';

  return (
    <View style={{
      backgroundColor: bg,
      borderRadius: 99,
      paddingHorizontal: 10,
      paddingVertical: 3,
    }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color }}>{label}</Text>
    </View>
  );
}

// ── Fisherman card ─────────────────────────────────────────────
function FishermanCard({
  item,
  onPress,
  onEdit,
  onDelete,
}: {
  item: FishermanWithBalance;
  onPress:  () => void;
  onEdit:   () => void;
  onDelete: () => void;
}) {
  const initials = item.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleDelete = () => {
    Alert.alert(
      'Delete Fisherman',
      `Remove ${item.name} and all their records? This cannot be undone.`,
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
        borderRadius: 16,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.outlineVariant,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>

        {/* Avatar */}
        <View style={{
          width: 52, height: 52, borderRadius: 26,
          backgroundColor: Colors.primaryFixed,
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.onPrimaryFixed }}>
            {initials}
          </Text>
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.onSurface }}>
            {item.name}
          </Text>
          <Text style={{ fontSize: 13, color: Colors.onSurfaceVariant, marginTop: 1 }}>
            ⛵ {item.boatName}
          </Text>
          {item.phone ? (
            <Text style={{ fontSize: 12, color: Colors.outline, marginTop: 1 }}>
              📞 {item.phone}
            </Text>
          ) : null}
        </View>

        {/* Balance */}
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <BalanceBadge balance={item.balance} />
          {item.balance !== 0 && (
            <Text style={{
              fontSize: 15,
              fontWeight: '700',
              color: item.balance > 0 ? Colors.error : Colors.secondary,
            }}>
              ₹{Math.abs(item.balance).toLocaleString('en-IN')}
            </Text>
          )}
        </View>
      </View>

      {/* Action row */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: Spacing.sm,
        marginTop: Spacing.sm,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.outlineVariant,
      }}>
        <TouchableOpacity
          onPress={onEdit}
          style={{
            paddingHorizontal: 16, paddingVertical: 6,
            borderRadius: 8, borderWidth: 1,
            borderColor: Colors.outlineVariant,
            backgroundColor: Colors.surfaceContainer,
          }}
        >
          <Text style={{ fontSize: 13, color: Colors.onSurface, fontWeight: '500' }}>
            ✏️  Edit
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleDelete}
          style={{
            paddingHorizontal: 16, paddingVertical: 6,
            borderRadius: 8, borderWidth: 1,
            borderColor: `${Colors.error}30`,
            backgroundColor: `${Colors.error}0a`,
          }}
        >
          <Text style={{ fontSize: 13, color: Colors.error, fontWeight: '500' }}>
            🗑  Delete
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ── Main screen ────────────────────────────────────────────────
export default function FishermenScreen() {
  const navigation = useNavigation<Nav>();

  const [list, setList]       = React.useState<FishermanWithBalance[]>([]);
  const [loading, setLoading] = React.useState(false);
  const isMounted             = useRef(true);

  React.useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ── Fetch directly — no hook dependency issues ──
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);

      const rows = await db
        .select()
        .from(fishermen)
        .orderBy(desc(fishermen.createdAt));

      const withBalances: FishermanWithBalance[] = await Promise.all(
        rows.map(async (f) => {
          const [purchaseRes] = await db
            .select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` })
            .from(purchaseEntries)
            .where(eq(purchaseEntries.fishermenId, f.id));

          const [paymentRes] = await db
            .select({ total: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
            .from(payments)
            .innerJoin(purchaseEntries, eq(purchaseEntries.id, payments.referenceId))
            .where(
              sql`${payments.referenceType} = 'purchase'
                  AND ${purchaseEntries.fishermenId} = ${f.id}`
            );

          const totalPurchases = Number(purchaseRes?.total ?? 0);
          const totalPaid      = Number(paymentRes?.total  ?? 0);

          return {
            ...f,
            totalPurchases,
            totalPaid,
            balance: totalPurchases - totalPaid,
          };
        })
      );

      if (isMounted.current) {
        setList(withBalances);
      }
    } catch (err) {
      console.error('[FishermenScreen] fetch error:', err);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  // ── Refetch every time screen comes into focus ──
  useFocusEffect(
    useCallback(() => {
      console.log('🎯 FishermenScreen focused — fetching...');
      fetchAll();
    }, [fetchAll])
  );

  // ── Delete ──
  const handleDelete = useCallback(async (id: number) => {
    try {
      await db.delete(fishermen).where(eq(fishermen.id, id));
      await fetchAll();
    } catch (err) {
      Alert.alert('Error', String(err));
    }
  }, [fetchAll]);

  const totalBalance = list.reduce((sum, f) => sum + f.balance, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface }}>
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
        {/* ── Header ── */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: Spacing.xl,
        }}>
          <View>
            <Text style={{
              fontSize: 36, fontWeight: '700',
              color: Colors.onSurface, letterSpacing: -0.8,
            }}>
              Fishermen
            </Text>
            <Text style={{ fontSize: 15, color: Colors.onSurfaceVariant, marginTop: 4 }}>
              {list.length === 0
                ? 'No fishermen registered yet'
                : `${list.length} registered`}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate('AddFisherman', {})}
            style={{
              backgroundColor: Colors.primary,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Text style={{ color: Colors.onPrimary, fontSize: 20, lineHeight: 24 }}>+</Text>
            <Text style={{ color: Colors.onPrimary, fontSize: 14, fontWeight: '600' }}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* ── Summary card ── */}
        {list.length > 0 && (
          <View style={{
            backgroundColor: Colors.primary,
            borderRadius: 20,
            padding: Spacing.lg,
            marginBottom: Spacing.xl,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <View>
              <Text style={{
                fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
                color: `${Colors.onPrimary}99`,
              }}>
                TOTAL OUTSTANDING
              </Text>
              <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.onPrimary, marginTop: 4 }}>
                ₹{totalBalance.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{
                fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
                color: `${Colors.onPrimary}99`,
              }}>
                FLEET SIZE
              </Text>
              <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.onPrimary, marginTop: 4 }}>
                {list.length}
              </Text>
            </View>
          </View>
        )}

        {/* ── Loading ── */}
        {loading && list.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}

        {/* ── Empty state ── */}
        {!loading && list.length === 0 && (
          <View style={{
            backgroundColor: Colors.surfaceContainerLow,
            borderRadius: 20,
            padding: Spacing.xxl,
            alignItems: 'center',
          }}>
            <Text style={{ fontSize: 56, marginBottom: 16 }}>⛵</Text>
            <Text style={{ fontSize: 18, fontWeight: '600', color: Colors.onSurface, marginBottom: 6 }}>
              No Fishermen Yet
            </Text>
            <Text style={{
              fontSize: 14, color: Colors.onSurfaceVariant,
              textAlign: 'center', lineHeight: 20,
            }}>
              Tap the Add button to register your first fisherman.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('AddFisherman', {})}
              style={{
                marginTop: Spacing.xl,
                backgroundColor: Colors.primary,
                borderRadius: 12,
                paddingHorizontal: 24,
                paddingVertical: 12,
              }}
            >
              <Text style={{ color: Colors.onPrimary, fontSize: 15, fontWeight: '600' }}>
                + Add First Fisherman
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── List ── */}
        {list.map((item) => (
          <FishermanCard
            key={item.id}
            item={item}
            onPress={() => navigation.navigate('FishermanDetail', { fishermenId: item.id, name: item.name })}
            onEdit={() => navigation.navigate('AddFisherman', { fishermenId: item.id })}
            onDelete={() => handleDelete(item.id)}
          />
        ))}
      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity
        onPress={() => navigation.navigate('AddFisherman', {})}
        style={{
          position: 'absolute', bottom: 100, right: 24,
          width: 56, height: 56, borderRadius: 16,
          backgroundColor: Colors.primary,
          justifyContent: 'center', alignItems: 'center',
          elevation: 8,
          shadowColor: Colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35, shadowRadius: 10,
        }}
      >
        <Text style={{ color: Colors.onPrimary, fontSize: 28, lineHeight: 32 }}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}