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
import { eq, desc, sql } from 'drizzle-orm';

import { RootStackParamList } from '../../types';
import { Colors, Spacing } from '../../utils/theme';
import { db } from '../../db/client';
import {
  buyers,
  salesOrders,
  payments,
  type Buyer,
} from '../../db/schema';
import { useBuyers } from '../../hooks/useBuyers';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ── Types ──────────────────────────────────────────────────────
interface BuyerWithBalance extends Buyer {
  totalSales: number;
  totalPaid:  number;
  balance:    number;
}

// ── Type config ────────────────────────────────────────────────
const TYPE_CONFIG = {
  supplier: { icon: '🏭', label: 'Supplier', bg: Colors.tertiaryFixed,      color: Colors.onTertiaryFixedVariant },
  company:  { icon: '🏢', label: 'Company',  bg: Colors.secondaryContainer, color: Colors.onSecondaryContainer  },
  other:    { icon: '👤', label: 'Other',    bg: Colors.surfaceVariant,     color: Colors.onSurfaceVariant      },
};

// ── Balance badge ──────────────────────────────────────────────
function BalanceBadge({ balance }: { balance: number }) {
  const isCleared = balance <= 0;

  return (
    <View style={{
      backgroundColor: isCleared ? Colors.primaryFixed : Colors.errorContainer,
      borderRadius: 99,
      paddingHorizontal: 10,
      paddingVertical: 3,
    }}>
      <Text style={{
        fontSize: 11, fontWeight: '700',
        color: isCleared ? Colors.onPrimaryFixed : Colors.onErrorContainer,
      }}>
        {isCleared ? 'Cleared' : 'Owes'}
      </Text>
    </View>
  );
}

// ── Buyer card ─────────────────────────────────────────────────
function BuyerCard({
  item,
  onPress,
  onEdit,
  onDelete,
}: {
  item:     BuyerWithBalance;
  onPress:  () => void;
  onEdit:   () => void;
  onDelete: () => void;
}) {
  const cfg      = TYPE_CONFIG[item.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.other;
  const initials = item.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleDelete = () => {
    Alert.alert(
      'Delete Buyer',
      `Remove ${item.name} and all their sales records? This cannot be undone.`,
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
          width: 52, height: 52, borderRadius: 16,
          backgroundColor: cfg.bg,
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{ fontSize: 22 }}>{cfg.icon}</Text>
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.onSurface }}>
              {item.name}
            </Text>
          </View>
          <View style={{
            alignSelf: 'flex-start',
            backgroundColor: cfg.bg,
            borderRadius: 99,
            paddingHorizontal: 8,
            paddingVertical: 2,
            marginBottom: 2,
          }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: cfg.color }}>
              {cfg.label.toUpperCase()}
            </Text>
          </View>
          {item.phone ? (
            <Text style={{ fontSize: 12, color: Colors.outline }}>
              📞 {item.phone}
            </Text>
          ) : null}
        </View>

        {/* Balance */}
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <BalanceBadge balance={item.balance} />
          {item.balance > 0 && (
            <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.error }}>
              ₹{item.balance.toLocaleString('en-IN')}
            </Text>
          )}
          {item.totalSales > 0 && (
            <Text style={{ fontSize: 11, color: Colors.outline }}>
              ₹{item.totalSales.toLocaleString('en-IN')} total
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
export default function BuyersScreen() {
  const navigation            = useNavigation<Nav>();
  const { deleteBuyer }       = useBuyers();
  const [list, setList]       = React.useState<BuyerWithBalance[]>([]);
  const [loading, setLoading] = React.useState(false);
  const isMounted             = useRef(true);

  React.useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ── Fetch all buyers with balances ──
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);

      const rows = await db
        .select()
        .from(buyers)
        .orderBy(desc(buyers.createdAt));

      const withBalances: BuyerWithBalance[] = await Promise.all(
        rows.map(async (b) => {
          // Sum all sales order totals for this buyer
          const [salesRes] = await db
            .select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` })
            .from(salesOrders)
            .where(eq(salesOrders.buyerId, b.id));

          // Sum all payments received from this buyer
          const [paymentRes] = await db
            .select({ total: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
            .from(payments)
            .innerJoin(salesOrders, eq(salesOrders.id, payments.referenceId))
            .where(
              sql`${payments.referenceType} = 'sale'
                  AND ${salesOrders.buyerId} = ${b.id}`
            );

          const totalSales = Number(salesRes?.total  ?? 0);
          const totalPaid  = Number(paymentRes?.total ?? 0);

          return {
            ...b,
            totalSales,
            totalPaid,
            balance: totalSales - totalPaid,
          };
        })
      );

      if (isMounted.current) setList(withBalances);
    } catch (err) {
      console.error('[BuyersScreen] fetch error:', err);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  // ── Refetch on focus ──
  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  // ── Delete ──
  const handleDelete = useCallback(async (id: number) => {
    try {
      await deleteBuyer(id);
      await fetchAll();
    } catch (err) {
      Alert.alert('Error', String(err));
    }
  }, [fetchAll]);

  const totalOutstanding = list.reduce((sum, b) => sum + Math.max(b.balance, 0), 0);

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
              Buyers
            </Text>
            <Text style={{ fontSize: 15, color: Colors.onSurfaceVariant, marginTop: 4 }}>
              {list.length === 0
                ? 'No buyers registered yet'
                : `${list.length} registered`}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate('AddBuyer', {})}
            style={{
              backgroundColor: Colors.secondary,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Text style={{ color: Colors.onSecondary, fontSize: 20, lineHeight: 24 }}>+</Text>
            <Text style={{ color: Colors.onSecondary, fontSize: 14, fontWeight: '600' }}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* ── Summary card ── */}
        {list.length > 0 && (
          <View style={{
            backgroundColor: Colors.secondary,
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
                color: `${Colors.onSecondary}99`,
              }}>
                TOTAL RECEIVABLE
              </Text>
              <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.onSecondary, marginTop: 4 }}>
                ₹{totalOutstanding.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{
                fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
                color: `${Colors.onSecondary}99`,
              }}>
                BUYERS
              </Text>
              <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.onSecondary, marginTop: 4 }}>
                {list.length}
              </Text>
            </View>
          </View>
        )}

        {/* ── Loading ── */}
        {loading && list.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <ActivityIndicator size="large" color={Colors.secondary} />
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
            <Text style={{ fontSize: 56, marginBottom: 16 }}>🤝</Text>
            <Text style={{ fontSize: 18, fontWeight: '600', color: Colors.onSurface, marginBottom: 6 }}>
              No Buyers Yet
            </Text>
            <Text style={{
              fontSize: 14, color: Colors.onSurfaceVariant,
              textAlign: 'center', lineHeight: 20,
            }}>
              Tap the Add button to register your first buyer.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('AddBuyer', {})}
              style={{
                marginTop: Spacing.xl,
                backgroundColor: Colors.secondary,
                borderRadius: 12,
                paddingHorizontal: 24,
                paddingVertical: 12,
              }}
            >
              <Text style={{ color: Colors.onSecondary, fontSize: 15, fontWeight: '600' }}>
                + Add First Buyer
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── List ── */}
        {list.map((item) => (
          <BuyerCard
            key={item.id}
            item={item}
            onPress={() => navigation.navigate('BuyerDetail', { buyerId: item.id, name: item.name })}
            onEdit={() => navigation.navigate('AddBuyer', { buyerId: item.id })}
            onDelete={() => handleDelete(item.id)}
          />
        ))}
      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity
        onPress={() => navigation.navigate('AddBuyer', {})}
        style={{
          position: 'absolute', bottom: 100, right: 24,
          width: 56, height: 56, borderRadius: 16,
          backgroundColor: Colors.secondary,
          justifyContent: 'center', alignItems: 'center',
          elevation: 8,
          shadowColor: Colors.secondary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35, shadowRadius: 10,
        }}
      >
        <Text style={{ color: Colors.onSecondary, fontSize: 28, lineHeight: 32 }}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}