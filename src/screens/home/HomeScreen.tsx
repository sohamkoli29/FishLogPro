import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { desc, eq, sql } from 'drizzle-orm';

import { RootStackParamList } from '../../types';
import { Colors, Spacing } from '../../utils/theme';
import { db } from '../../db/client';
import {
  purchaseEntries,
  salesOrders,
  payments,
  fishermen,
  buyers,
  purchaseItems,
  salesItems,
} from '../../db/schema';
import { useAppStore } from '../../stores/appStore';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ── Types ──────────────────────────────────────────────────────
interface DashboardData {
  todayPurchases:    number;
  todaySales:        number;
  pendingBills:      number;
  totalOutstanding:  number;
  recentActivity:    ActivityItem[];
}

interface ActivityItem {
  id:          string;
  type:        'purchase' | 'sale' | 'payment';
  title:       string;
  sub:         string;
  amount:      number;
  status:      string;
  statusColor: string;
  entryId?:    number;
  orderId?:    number;
}

// ── Helpers ────────────────────────────────────────────────────
function todayString(): string {
  const d    = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function timeAgo(isoString: string): string {
  const now   = Date.now();
  const then  = new Date(isoString).getTime();
  const diff  = Math.floor((now - then) / 1000);

  if (diff < 60)                    return 'just now';
  if (diff < 3600)                  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)                 return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7)             return `${Math.floor(diff / 86400)}d ago`;
  return new Date(isoString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function greetingText(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// ── Stat card ──────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon,
  color,
  masked,
}: {
  label:   string;
  value:   string;
  icon:    string;
  color:   string;
  masked?: boolean;
}) {
  return (
    <View style={{
      width: '47%',
      backgroundColor: Colors.surfaceContainerLow,
      borderRadius: 16,
      padding: Spacing.md,
      minHeight: 110,
      justifyContent: 'space-between',
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{
          fontSize: 11, color: Colors.onSurfaceVariant,
          fontWeight: '600', flex: 1,
        }}>
          {label}
        </Text>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
      {masked ? (
        <Text style={{
          fontSize: 24, fontWeight: '700',
          color: Colors.outline, letterSpacing: 4,
        }}>
          ••••
        </Text>
      ) : (
        <Text style={{
          fontSize: 22, fontWeight: '700',
          color, letterSpacing: -0.3,
        }}>
          {value}
        </Text>
      )}
    </View>
  );
}

// ── Activity item ──────────────────────────────────────────────
function ActivityRow({
  item,
  onPress,
  pricesVisible,
}: {
  item:          ActivityItem;
  onPress:       () => void;
  pricesVisible: boolean;
}) {
  const icon = item.type === 'purchase' ? '🐟'
             : item.type === 'sale'     ? '🤝'
             :                            '💰';

  const iconBg = item.type === 'purchase' ? Colors.primaryFixed
               : item.type === 'sale'     ? Colors.secondaryContainer
               :                            Colors.tertiaryFixed;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        padding: Spacing.md,
        backgroundColor: Colors.surfaceContainerLowest,
        borderRadius: 12,
      }}
    >
      {/* Icon */}
      <View style={{
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: iconBg,
        justifyContent: 'center', alignItems: 'center',
        flexShrink: 0,
      }}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={{
          fontSize: 14, fontWeight: '500', color: Colors.onSurface,
        }} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={{ fontSize: 12, color: Colors.onSurfaceVariant }}>
          {item.sub}
        </Text>
      </View>

      {/* Amount + status */}
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        {pricesVisible ? (
          <Text style={{
            fontSize: 14, fontWeight: '700', color: Colors.onSurface,
          }}>
            ₹{item.amount.toLocaleString('en-IN')}
          </Text>
        ) : (
          <Text style={{ fontSize: 13, color: Colors.outline, letterSpacing: 3 }}>
            ••••
          </Text>
        )}
        <View style={{
          paddingHorizontal: 8, paddingVertical: 2,
          backgroundColor: `${item.statusColor}18`,
          borderRadius: 99,
        }}>
          <Text style={{
            fontSize: 10, fontWeight: '700',
            color: item.statusColor,
          }}>
            {item.status}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Main screen ────────────────────────────────────────────────
export default function HomeScreen() {
  const navigation      = useNavigation<Nav>();
  const pricesVisible   = useAppStore((s) => s.pricesVisible);
  const togglePrices    = useAppStore((s) => s.togglePricesVisible);
  const businessName    = useAppStore((s) => s.businessName);

  const [data,    setData]    = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const isMounted             = useRef(true);

  React.useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ── Fetch dashboard data ──
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const today = todayString();

      // ── Today's purchases total ──
      const [todayPurchaseRes] = await db
        .select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` })
        .from(purchaseEntries)
        .where(sql`${purchaseEntries.date} = ${today}`);

      // ── Today's sales total ──
      const [todaySalesRes] = await db
        .select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` })
        .from(salesOrders)
        .where(sql`${salesOrders.date} = ${today}`);

      // ── Pending bills (purchase entries with balance > 0) ──
      const allEntries = await db
        .select({ id: purchaseEntries.id, totalAmount: purchaseEntries.totalAmount })
        .from(purchaseEntries);

      let pendingBills = 0;
      for (const e of allEntries) {
        const [pmtRes] = await db
          .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
          .from(payments)
          .where(
            sql`${payments.referenceType} = 'purchase'
                AND ${payments.referenceId} = ${e.id}`
          );
        const paid = Number(pmtRes?.total ?? 0);
        if (e.totalAmount - paid > 0.01) pendingBills++;
      }

      // ── Total outstanding from fishermen ──
      const [totalPurchaseRes] = await db
        .select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` })
        .from(purchaseEntries);

      const [totalPaidFishRes] = await db
        .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(payments)
        .where(sql`${payments.referenceType} = 'purchase'`);

      const totalOutstanding =
        Number(totalPurchaseRes?.total ?? 0) -
        Number(totalPaidFishRes?.total ?? 0);

      // ── Recent purchases (last 5) ──
      const recentPurchases = await db
        .select({
          id:            purchaseEntries.id,
          date:          purchaseEntries.date,
          totalAmount:   purchaseEntries.totalAmount,
          createdAt:     purchaseEntries.createdAt,
          fishermenId:   purchaseEntries.fishermenId,
          fishermanName: fishermen.name,
          boatName:      fishermen.boatName,
        })
        .from(purchaseEntries)
        .innerJoin(fishermen, eq(fishermen.id, purchaseEntries.fishermenId))
        .orderBy(desc(purchaseEntries.createdAt))
        .limit(5);

      // ── Recent sales (last 5) ──
      const recentSales = await db
        .select({
          id:          salesOrders.id,
          date:        salesOrders.date,
          status:      salesOrders.status,
          totalAmount: salesOrders.totalAmount,
          createdAt:   salesOrders.createdAt,
          buyerId:     salesOrders.buyerId,
          buyerName:   buyers.name,
        })
        .from(salesOrders)
        .innerJoin(buyers, eq(buyers.id, salesOrders.buyerId))
        .orderBy(desc(salesOrders.createdAt))
        .limit(5);

      // ── Recent payments (last 3) ──
      const recentPayments = await db
        .select()
        .from(payments)
        .orderBy(desc(payments.paymentDate))
        .limit(3);

      // ── Build activity feed ──
      const purchaseItems_list: ActivityItem[] = recentPurchases.map((p) => ({
        id:          `purchase-${p.id}`,
        type:        'purchase' as const,
        title:       `Purchased from ${p.fishermanName}`,
        sub:         `⛵ ${p.boatName} • ${timeAgo(p.createdAt)}`,
        amount:      p.totalAmount,
        status:      'Purchase',
        statusColor: Colors.primary,
        entryId:     p.id,
      }));

      const salesItems_list: ActivityItem[] = recentSales.map((s) => ({
        id:          `sale-${s.id}`,
        type:        'sale' as const,
        title:       `Sale to ${s.buyerName}`,
        sub:         `Order #${s.id} • ${timeAgo(s.createdAt)}`,
        amount:      s.totalAmount,
        status:      s.status.charAt(0).toUpperCase() + s.status.slice(1),
        statusColor: s.status === 'complete' ? Colors.primary
                   : s.status === 'partial'  ? Colors.secondary
                   :                           Colors.tertiary,
        orderId:     s.id,
      }));

      const paymentItems_list: ActivityItem[] = recentPayments.map((p) => ({
        id:          `payment-${p.id}`,
        type:        'payment' as const,
        title:       `Payment — ${p.mode.charAt(0).toUpperCase() + p.mode.slice(1)}`,
        sub:         `${p.referenceType === 'purchase' ? 'To fisherman' : 'From buyer'} • ${timeAgo(p.paymentDate)}`,
        amount:      p.amount,
        status:      'Paid',
        statusColor: '#16a34a',
      }));

      // Merge + sort by recency (use createdAt index)
      const allActivity: ActivityItem[] = [
        ...purchaseItems_list,
        ...salesItems_list,
        ...paymentItems_list,
      ].slice(0, 8);

      if (isMounted.current) {
        setData({
          todayPurchases:   Number(todayPurchaseRes?.total   ?? 0),
          todaySales:       Number(todaySalesRes?.total      ?? 0),
          pendingBills,
          totalOutstanding: Math.max(totalOutstanding, 0),
          recentActivity:   allActivity,
        });
      }
    } catch (err) {
      console.error('[Home] fetch error:', err);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => { fetchData(); }, [fetchData])
  );

  const handleActivityPress = (item: ActivityItem) => {
    if (item.entryId) {
      navigation.navigate('EntryDetail', { entryId: item.entryId });
    } else if (item.orderId) {
      navigation.navigate('OrderDetail', { orderId: item.orderId });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface }}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.gutter, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchData}
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
          <View style={{ flex: 1 }}>
            <Text style={{
              fontSize: 13, fontWeight: '700',
              color: Colors.primary, letterSpacing: 1,
            }}>
              {businessName.toUpperCase()}
            </Text>
            <Text style={{
              fontSize: 28, fontWeight: '700',
              color: Colors.onSurface, letterSpacing: -0.3, marginTop: 2,
            }}>
              {greetingText()}, Skipper 👋
            </Text>
            <Text style={{ fontSize: 14, color: Colors.onSurfaceVariant, marginTop: 4 }}>
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </Text>
          </View>

          {/* Price toggle */}
          <TouchableOpacity
            onPress={togglePrices}
            style={{
              backgroundColor: pricesVisible ? Colors.primaryFixed : Colors.surfaceContainerHigh,
              borderRadius: 12,
              padding: 10,
              marginTop: 4,
            }}
          >
            <Text style={{ fontSize: 20 }}>
              {pricesVisible ? '🙈' : '👁'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Quick Actions ── */}
        <View style={{
          flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl,
        }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('NewPurchaseEntry', {})}
            style={{
              flex: 1,
              backgroundColor: Colors.primary,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Text style={{ fontSize: 18 }}>🐟</Text>
            <Text style={{
              color: Colors.onPrimary, fontWeight: '700', fontSize: 14,
            }}>
              New Purchase
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('NewSalesOrder', {})}
            style={{
              flex: 1,
              backgroundColor: Colors.secondary,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Text style={{ fontSize: 18 }}>🤝</Text>
            <Text style={{
              color: Colors.onSecondary, fontWeight: '700', fontSize: 14,
            }}>
              New Sale
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Stats grid ── */}
        {loading && !data ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <>
            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: Spacing.md,
              marginBottom: Spacing.xl,
            }}>
              <StatCard
                label="Today's Purchases"
                value={`₹${(data?.todayPurchases ?? 0).toLocaleString('en-IN')}`}
                icon="📦"
                color={Colors.primary}
                masked={!pricesVisible}
              />
              <StatCard
                label="Pending Bills"
                value={String(data?.pendingBills ?? 0)}
                icon="⏳"
                color={Colors.tertiary}
              />
              <StatCard
                label="Total Outstanding"
                value={`₹${(data?.totalOutstanding ?? 0).toLocaleString('en-IN')}`}
                icon="🏦"
                color={Colors.error}
                masked={!pricesVisible}
              />
              <StatCard
                label="Today's Sales"
                value={`₹${(data?.todaySales ?? 0).toLocaleString('en-IN')}`}
                icon="📈"
                color={Colors.secondary}
                masked={!pricesVisible}
              />
            </View>

            {/* ── Recent activity ── */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: Spacing.md,
            }}>
              <Text style={{
                fontSize: 18, fontWeight: '700', color: Colors.onSurface,
              }}>
                Recent Activity
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Register' as any)}
              >
                <Text style={{ fontSize: 14, color: Colors.primary }}>
                  View All
                </Text>
              </TouchableOpacity>
            </View>

            {/* Activity list */}
            {data?.recentActivity.length === 0 ? (
              <View style={{
                backgroundColor: Colors.surfaceContainerLow,
                borderRadius: 16,
                padding: Spacing.xxl,
                alignItems: 'center',
              }}>
                <Text style={{ fontSize: 36, marginBottom: 12 }}>🌊</Text>
                <Text style={{
                  fontSize: 16, fontWeight: '600',
                  color: Colors.onSurface, marginBottom: 4,
                }}>
                  No Activity Yet
                </Text>
                <Text style={{
                  fontSize: 14, color: Colors.onSurfaceVariant,
                  textAlign: 'center',
                }}>
                  Start by adding a fisherman or buyer, then log your first purchase or sale.
                </Text>
              </View>
            ) : (
              <View style={{ gap: Spacing.sm }}>
                {data?.recentActivity.map((item) => (
                  <ActivityRow
                    key={item.id}
                    item={item}
                    onPress={() => handleActivityPress(item)}
                    pricesVisible={pricesVisible}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}