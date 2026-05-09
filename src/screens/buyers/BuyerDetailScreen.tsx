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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { eq, sql, desc } from 'drizzle-orm';

import { RootStackParamList } from '../../types';
import { Colors, Spacing } from '../../utils/theme';
import { db } from '../../db/client';
import {
  salesOrders,
  salesItems,
  payments,
} from '../../db/schema';
import { useSales, OrderStatus } from '../../hooks/useSales';

type Nav    = NativeStackNavigationProp<RootStackParamList>;
type RouteT = RouteProp<RootStackParamList, 'BuyerDetail'>;

// ── Types ──────────────────────────────────────────────────────
interface OrderRow {
  id:          number;
  date:        string;
  status:      string;
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

const STATUS_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  pending:  { label: 'Pending',  icon: '⏳', color: Colors.onPrimaryFixed,        bg: Colors.primaryFixed      },
  partial:  { label: 'Partial',  icon: '🔄', color: Colors.onSecondaryContainer,  bg: Colors.secondaryContainer },
  complete: { label: 'Complete', icon: '✅', color: Colors.onTertiaryFixedVariant, bg: Colors.tertiaryFixed     },
};

// ── Order card ─────────────────────────────────────────────────
function OrderCard({
  order,
  onPress,
  onDelete,
}: {
  order:    OrderRow;
  onPress:  () => void;
  onDelete: () => void;
}) {
  const cfg       = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const isCleared = order.balance <= 0;

  const handleDelete = () => {
    Alert.alert(
      'Delete Order',
      'Delete this sales order and all its payments?',
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
        borderLeftColor: isCleared ? Colors.secondary : Colors.error,
      }}
    >
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        {/* Left */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.onSurface }}>
            {formatDate(order.date)}
          </Text>
          <Text style={{ fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 2 }}>
            {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}
            {' • '}
            Order #{order.id}
          </Text>
          {/* Status badge */}
          <View style={{
            alignSelf: 'flex-start',
            marginTop: 6,
            backgroundColor: cfg.bg,
            borderRadius: 99,
            paddingHorizontal: 8,
            paddingVertical: 2,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
          }}>
            <Text style={{ fontSize: 10 }}>{cfg.icon}</Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: cfg.color }}>
              {cfg.label.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Right */}
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.onSurface }}>
            ₹{order.totalAmount.toLocaleString('en-IN')}
          </Text>
          {!isCleared && (
            <Text style={{ fontSize: 12, color: Colors.error }}>
              ₹{order.balance.toLocaleString('en-IN')} due
            </Text>
          )}
          {isCleared && (
            <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: '600' }}>
              ✓ Paid
            </Text>
          )}
        </View>
      </View>

      {/* Progress bar */}
      {order.totalAmount > 0 && (
        <View style={{
          height: 4,
          backgroundColor: Colors.outlineVariant,
          borderRadius: 99,
          marginTop: Spacing.sm,
          overflow: 'hidden',
        }}>
          <View style={{
            height: '100%',
            width: `${Math.min((order.totalPaid / order.totalAmount) * 100, 100)}%`,
            backgroundColor: isCleared ? Colors.secondary : Colors.tertiary,
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
        <Text style={{ fontSize: 12, color: Colors.error, fontWeight: '500' }}>
          🗑 Delete
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ── Main screen ────────────────────────────────────────────────
export default function BuyerDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<RouteT>();
  const { buyerId, name } = route.params;
  const { deleteOrder }   = useSales();

  const [orders,  setOrders]  = React.useState<OrderRow[]>([]);
  const [summary, setSummary] = React.useState({ totalSales: 0, totalPaid: 0, balance: 0 });
  const [loading, setLoading] = React.useState(true);
  const isMounted             = useRef(true);

  React.useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);

      const rows = await db
        .select()
        .from(salesOrders)
        .where(eq(salesOrders.buyerId, buyerId))
        .orderBy(desc(salesOrders.date));

      const orderRows: OrderRow[] = await Promise.all(
        rows.map(async (o) => {
          const items = await db
            .select({ id: salesItems.id })
            .from(salesItems)
            .where(eq(salesItems.orderId, o.id));

          const [pmtRes] = await db
            .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
            .from(payments)
            .where(
              sql`${payments.referenceType} = 'sale'
                  AND ${payments.referenceId} = ${o.id}`
            );

          const totalPaid = Number(pmtRes?.total ?? 0);

          return {
            id:          o.id,
            date:        o.date,
            status:      o.status,
            totalAmount: o.totalAmount,
            totalPaid,
            balance:     o.totalAmount - totalPaid,
            itemCount:   items.length,
          };
        })
      );

      const totalSales = orderRows.reduce((s, o) => s + o.totalAmount, 0);
      const totalPaid  = orderRows.reduce((s, o) => s + o.totalPaid,   0);

      if (isMounted.current) {
        setOrders(orderRows);
        setSummary({ totalSales, totalPaid, balance: totalSales - totalPaid });
      }
    } catch (err) {
      console.error('[BuyerDetail] error:', err);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [buyerId]);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  const handleDelete = async (orderId: number) => {
    await deleteOrder(orderId);
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
            tintColor={Colors.secondary}
            colors={[Colors.secondary]}
          />
        }
      >
        {/* ── Summary card ── */}
        <View style={{
          backgroundColor: Colors.secondary,
          borderRadius: 20,
          padding: Spacing.lg,
          marginBottom: Spacing.xl,
        }}>
          <Text style={{
            fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
            color: `${Colors.onSecondary}80`, marginBottom: 4,
          }}>
            TOTAL SALES
          </Text>
          <Text style={{
            fontSize: 36, fontWeight: '700',
            color: Colors.onSecondary, letterSpacing: -0.5,
          }}>
            ₹{summary.totalSales.toLocaleString('en-IN')}
          </Text>

          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: Spacing.md,
            paddingTop: Spacing.md,
            borderTopWidth: 1,
            borderTopColor: `${Colors.onSecondary}20`,
          }}>
            <View>
              <Text style={{
                fontSize: 10, color: `${Colors.onSecondary}60`, fontWeight: '700',
              }}>
                RECEIVED
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#4ade80' }}>
                ₹{summary.totalPaid.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{
                fontSize: 10, color: `${Colors.onSecondary}60`, fontWeight: '700',
              }}>
                OUTSTANDING
              </Text>
              <Text style={{
                fontSize: 16, fontWeight: '700',
                color: summary.balance > 0 ? Colors.secondaryFixed : '#4ade80',
              }}>
                {summary.balance > 0
                  ? `₹${summary.balance.toLocaleString('en-IN')}`
                  : '✓ Cleared'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Orders header ── */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: Spacing.md,
        }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.onSurface }}>
            Sales Orders
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('NewSalesOrder', { buyerId })}
            style={{
              backgroundColor: Colors.secondary,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Text style={{ color: Colors.onSecondary, fontSize: 16, lineHeight: 20 }}>+</Text>
            <Text style={{ color: Colors.onSecondary, fontSize: 13, fontWeight: '600' }}>
              New Order
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Loading ── */}
        {loading && orders.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <ActivityIndicator size="large" color={Colors.secondary} />
          </View>
        )}

        {/* ── Empty state ── */}
        {!loading && orders.length === 0 && (
          <View style={{
            backgroundColor: Colors.surfaceContainerLow,
            borderRadius: 16,
            padding: Spacing.xxl,
            alignItems: 'center',
          }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📦</Text>
            <Text style={{
              fontSize: 16, fontWeight: '600',
              color: Colors.onSurface, marginBottom: 6,
            }}>
              No Orders Yet
            </Text>
            <Text style={{
              fontSize: 14, color: Colors.onSurfaceVariant,
              textAlign: 'center', lineHeight: 20,
            }}>
              Tap New Order to log the first sale to {name}.
            </Text>
          </View>
        )}

        {/* ── Order list ── */}
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
            onDelete={() => handleDelete(order.id)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}