import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
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
  salesOrders,
  buyers,
  payments,
} from '../../db/schema';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface FishermanDue {
  id:             number;
  name:           string;
  boatName:       string;
  totalPurchases: number;
  totalPaid:      number;
  balance:        number;
  lastEntry:      string | null;
}

interface BuyerDebt {
  id:         number;
  name:       string;
  type:       string;
  totalSales: number;
  totalPaid:  number;
  balance:    number;
  lastOrder:  string | null;
}

interface LedgerData {
  totalPurchases:   number;
  totalSaleRevenue: number;
  totalPaidOut:     number;
  totalReceived:    number;
  netProfit:        number;
  fishermenDues:    FishermanDue[];
  buyerDebts:       BuyerDebt[];
}

// ── Search bar ─────────────────────────────────────────────────
function SearchBar({
  value,
  onChange,
}: {
  value:    string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.surfaceContainerLow,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: Spacing.lg,
      gap: 8,
      borderWidth: 1,
      borderColor: value ? Colors.primary : Colors.outlineVariant,
    }}>
      <Text style={{ fontSize: 16 }}>🔍</Text>
      <TextInput
        style={{ flex: 1, fontSize: 15, color: Colors.onSurface, padding: 0 }}
        placeholder="Search fishermen or buyers…"
        placeholderTextColor={Colors.outline}
        value={value}
        onChangeText={onChange}
        autoCapitalize="words"
        returnKeyType="search"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChange('')}>
          <Text style={{ fontSize: 16, color: Colors.outline }}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Stat card ──────────────────────────────────────────────────
function StatCard({
  label, value, sub, bg, valueColor,
}: {
  label: string; value: string; sub?: string; bg: string; valueColor?: string;
}) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: bg,
      borderRadius: 16,
      padding: Spacing.md,
      minHeight: 90,
      justifyContent: 'space-between',
    }}>
      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: Colors.onSurfaceVariant }}>
        {label}
      </Text>
      <View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: valueColor ?? Colors.onSurface, letterSpacing: -0.3 }}>
          {value}
        </Text>
        {sub && (
          <Text style={{ fontSize: 11, color: Colors.outline, marginTop: 2 }}>{sub}</Text>
        )}
      </View>
    </View>
  );
}

// ── Due badge ──────────────────────────────────────────────────
function DueBadge({ balance, type }: { balance: number; type: 'fisherman' | 'buyer' }) {
  const isCleared = balance <= 0;
  const bg    = isCleared ? Colors.primaryFixed   : Colors.errorContainer;
  const color = isCleared ? Colors.onPrimaryFixed : Colors.onErrorContainer;
  const label = isCleared ? 'Cleared' : type === 'fisherman' ? 'Owes' : 'Receivable';
  return (
    <View style={{ backgroundColor: bg, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color }}>{label}</Text>
    </View>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'No activity';
  const [yyyy, mm, dd] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${dd} ${months[parseInt(mm) - 1]} ${yyyy}`;
}

// ── Main screen ────────────────────────────────────────────────
export default function RegisterScreen() {
  const navigation            = useNavigation<Nav>();
  const [data,    setData]    = React.useState<LedgerData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [query,   setQuery]   = useState('');
  const isMounted             = useRef(true);

  React.useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const [purchaseRes] = await db
        .select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` })
        .from(purchaseEntries);

      const [paidFishRes] = await db
        .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(payments)
        .where(sql`${payments.referenceType} = 'purchase'`);

      const [salesRes] = await db
        .select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` })
        .from(salesOrders);

      const [receivedRes] = await db
        .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(payments)
        .where(sql`${payments.referenceType} = 'sale'`);

      const totalPurchases   = Number(purchaseRes?.total  ?? 0);
      const totalPaidOut     = Number(paidFishRes?.total  ?? 0);
      const totalSaleRevenue = Number(salesRes?.total     ?? 0);
      const totalReceived    = Number(receivedRes?.total  ?? 0);
      const netProfit        = totalSaleRevenue - totalPurchases;

      // Fishermen
      const fishRows = await db.select().from(fishermen).orderBy(desc(fishermen.createdAt));
      const fishermenDues: FishermanDue[] = await Promise.all(
        fishRows.map(async (f) => {
          const [pRes] = await db
            .select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` })
            .from(purchaseEntries)
            .where(eq(purchaseEntries.fishermenId, f.id));

          const [pmtRes] = await db
            .select({ total: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
            .from(payments)
            .innerJoin(purchaseEntries, eq(purchaseEntries.id, payments.referenceId))
            .where(
              sql`${payments.referenceType} = 'purchase'
                  AND ${purchaseEntries.fishermenId} = ${f.id}`
            );

          const [lastRes] = await db
            .select({ date: purchaseEntries.date })
            .from(purchaseEntries)
            .where(eq(purchaseEntries.fishermenId, f.id))
            .orderBy(desc(purchaseEntries.date))
            .limit(1);

          const totalPurchases = Number(pRes?.total   ?? 0);
          const totalPaid      = Number(pmtRes?.total ?? 0);

          return {
            id: f.id, name: f.name, boatName: f.boatName,
            totalPurchases, totalPaid,
            balance:   totalPurchases - totalPaid,
            lastEntry: lastRes?.date ?? null,
          };
        })
      );

      // Buyers
      const buyerRows = await db.select().from(buyers).orderBy(desc(buyers.createdAt));
      const buyerDebts: BuyerDebt[] = await Promise.all(
        buyerRows.map(async (b) => {
          const [sRes] = await db
            .select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` })
            .from(salesOrders)
            .where(eq(salesOrders.buyerId, b.id));

          const [pmtRes] = await db
            .select({ total: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
            .from(payments)
            .innerJoin(salesOrders, eq(salesOrders.id, payments.referenceId))
            .where(
              sql`${payments.referenceType} = 'sale'
                  AND ${salesOrders.buyerId} = ${b.id}`
            );

          const [lastRes] = await db
            .select({ date: salesOrders.date })
            .from(salesOrders)
            .where(eq(salesOrders.buyerId, b.id))
            .orderBy(desc(salesOrders.date))
            .limit(1);

          const totalSales = Number(sRes?.total   ?? 0);
          const totalPaid  = Number(pmtRes?.total ?? 0);

          return {
            id: b.id, name: b.name, type: b.type,
            totalSales, totalPaid,
            balance:   totalSales - totalPaid,
            lastOrder: lastRes?.date ?? null,
          };
        })
      );

      if (isMounted.current) {
        setData({
          totalPurchases, totalSaleRevenue, totalPaidOut,
          totalReceived, netProfit, fishermenDues, buyerDebts,
        });
      }
    } catch (err) {
      console.error('[Register] fetch error:', err);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  // ── Client-side filter — applies to both sections ──
  const q = query.trim().toLowerCase();
  const filteredFishermen = q && data
    ? data.fishermenDues.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.boatName.toLowerCase().includes(q)
      )
    : data?.fishermenDues ?? [];

  const filteredBuyers = q && data
    ? data.buyerDebts.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.type.toLowerCase().includes(q)
      )
    : data?.buyerDebts ?? [];

  const hasResults = filteredFishermen.length > 0 || filteredBuyers.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface }}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.gutter, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
        <View style={{ marginBottom: Spacing.lg }}>
          <Text style={{
            fontSize: 12, fontWeight: '700', color: Colors.primary,
            letterSpacing: 1, marginBottom: 4,
          }}>
            NET PERFORMANCE
          </Text>
          <Text style={{
            fontSize: 36, fontWeight: '700',
            color: Colors.onSurface, letterSpacing: -0.8,
          }}>
            Master Ledger
          </Text>
          <Text style={{ fontSize: 15, color: Colors.onSurfaceVariant, marginTop: 4 }}>
            Consolidated view of all purchases, sales and payments.
          </Text>
        </View>

        {/* ── Loading ── */}
        {loading && !data && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={{ fontSize: 14, color: Colors.onSurfaceVariant, marginTop: 12 }}>
              Calculating ledger…
            </Text>
          </View>
        )}

        {data && (
          <>
            {/* ── Hero profit card ── */}
            <View style={{
              backgroundColor: Colors.onSurface,
              borderRadius: 24,
              padding: Spacing.xl,
              marginBottom: Spacing.lg,
              overflow: 'hidden',
            }}>
              <Text style={{
                fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
                color: `${Colors.onPrimary}60`, marginBottom: 8,
              }}>
                ALL-TIME NET PROFIT
              </Text>
              <Text style={{
                fontSize: 44, fontWeight: '700',
                color: data.netProfit >= 0 ? '#4ade80' : Colors.errorContainer,
                letterSpacing: -1,
              }}>
                ₹{Math.abs(data.netProfit).toLocaleString('en-IN')}
              </Text>
              {data.netProfit < 0 && (
                <Text style={{ fontSize: 13, color: Colors.errorContainer, marginTop: 4 }}>
                  ⚠️ Loss — purchases exceed sales
                </Text>
              )}

              <View style={{
                flexDirection: 'row',
                marginTop: Spacing.lg,
                paddingTop: Spacing.md,
                borderTopWidth: 1,
                borderTopColor: `${Colors.onPrimary}15`,
                gap: Spacing.xl,
              }}>
                <View>
                  <Text style={{
                    fontSize: 10, fontWeight: '700', letterSpacing: 0.8,
                    color: `${Colors.onPrimary}50`,
                  }}>
                    TOTAL SALES
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.onPrimary, marginTop: 2 }}>
                    ₹{data.totalSaleRevenue.toLocaleString('en-IN')}
                  </Text>
                </View>
                <View>
                  <Text style={{
                    fontSize: 10, fontWeight: '700', letterSpacing: 0.8,
                    color: `${Colors.onPrimary}50`,
                  }}>
                    TOTAL PURCHASES
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.onPrimary, marginTop: 2 }}>
                    ₹{data.totalPurchases.toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Stats grid ── */}
            <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg }}>
              <StatCard
                label="PAID TO FISHERMEN"
                value={`₹${data.totalPaidOut.toLocaleString('en-IN')}`}
                sub={`₹${(data.totalPurchases - data.totalPaidOut).toLocaleString('en-IN')} pending`}
                bg={Colors.surfaceContainerLow}
                valueColor={Colors.primary}
              />
              <StatCard
                label="RECEIVED FROM BUYERS"
                value={`₹${data.totalReceived.toLocaleString('en-IN')}`}
                sub={`₹${(data.totalSaleRevenue - data.totalReceived).toLocaleString('en-IN')} pending`}
                bg={Colors.surfaceContainerLow}
                valueColor={Colors.secondary}
              />
            </View>

            {/* ── Search bar ── */}
            <SearchBar value={query} onChange={setQuery} />

            {/* ── No search results ── */}
            {q && !hasResults && (
              <View style={{
                backgroundColor: Colors.surfaceContainerLow,
                borderRadius: 16,
                padding: Spacing.xl,
                alignItems: 'center',
                marginBottom: Spacing.lg,
              }}>
                <Text style={{ fontSize: 36, marginBottom: 12 }}>🔍</Text>
                <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.onSurface, marginBottom: 6 }}>
                  No Results
                </Text>
                <Text style={{ fontSize: 14, color: Colors.onSurfaceVariant, textAlign: 'center' }}>
                  No fisherman or buyer matches "{query}"
                </Text>
              </View>
            )}

            {/* ── Fishermen Dues ── */}
            {filteredFishermen.length > 0 && (
              <View style={{
                backgroundColor: Colors.surface,
                borderRadius: 20,
                padding: Spacing.lg,
                borderWidth: 1,
                borderColor: Colors.outlineVariant,
                marginBottom: Spacing.lg,
              }}>
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: Spacing.lg,
                }}>
                  <View>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.onSurface }}>
                      Fishermen Dues
                    </Text>
                    <Text style={{ fontSize: 13, color: Colors.onSurfaceVariant }}>
                      Outstanding payments for catch deliveries
                    </Text>
                  </View>
                  <Text style={{ fontSize: 24 }}>⛵</Text>
                </View>

                {filteredFishermen.map((f, i) => (
                  <TouchableOpacity
                    key={f.id}
                    onPress={() => navigation.navigate('FishermanDetail', { fishermenId: f.id, name: f.name })}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: Spacing.md,
                      borderBottomWidth: i < filteredFishermen.length - 1 ? 1 : 0,
                      borderBottomColor: Colors.outlineVariant,
                      gap: Spacing.md,
                    }}
                  >
                    <View style={{
                      width: 44, height: 44, borderRadius: 22,
                      backgroundColor: Colors.primaryFixed,
                      justifyContent: 'center', alignItems: 'center',
                      flexShrink: 0,
                    }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.onPrimaryFixed }}>
                        {f.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.onSurface }}>
                        {f.name}
                      </Text>
                      <Text style={{ fontSize: 12, color: Colors.onSurfaceVariant }}>
                        ⛵ {f.boatName} • {formatDate(f.lastEntry)}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end', gap: 3 }}>
                      <DueBadge balance={f.balance} type="fisherman" />
                      {f.balance > 0 && (
                        <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.error }}>
                          ₹{f.balance.toLocaleString('en-IN')}
                        </Text>
                      )}
                      {f.balance === 0 && f.totalPurchases > 0 && (
                        <Text style={{ fontSize: 12, color: Colors.outline }}>
                          ₹{f.totalPurchases.toLocaleString('en-IN')} total
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}

                {/* Total outstanding — only show when not filtered */}
                {!q && (
                  <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: Spacing.md,
                    paddingTop: Spacing.md,
                    borderTopWidth: 2,
                    borderTopColor: Colors.outlineVariant,
                  }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.onSurfaceVariant }}>
                      TOTAL OUTSTANDING
                    </Text>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.primary }}>
                      ₹{data.fishermenDues
                          .reduce((s, f) => s + Math.max(f.balance, 0), 0)
                          .toLocaleString('en-IN')}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Buyer Debts ── */}
            {filteredBuyers.length > 0 && (
              <View style={{
                backgroundColor: Colors.surfaceContainerHigh,
                borderRadius: 20,
                padding: Spacing.lg,
                borderWidth: 1,
                borderColor: Colors.outlineVariant,
              }}>
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: Spacing.lg,
                }}>
                  <View>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.onSurface }}>
                      Buyer Debts
                    </Text>
                    <Text style={{ fontSize: 13, color: Colors.onSurfaceVariant }}>
                      Uncollected revenue from sales
                    </Text>
                  </View>
                  <Text style={{ fontSize: 24 }}>🤝</Text>
                </View>

                {filteredBuyers.map((b, i) => (
                  <TouchableOpacity
                    key={b.id}
                    onPress={() => navigation.navigate('BuyerDetail', { buyerId: b.id, name: b.name })}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: Spacing.md,
                      borderBottomWidth: i < filteredBuyers.length - 1 ? 1 : 0,
                      borderBottomColor: Colors.outlineVariant,
                      gap: Spacing.md,
                    }}
                  >
                    <View style={{
                      width: 44, height: 44, borderRadius: 12,
                      backgroundColor: Colors.secondaryContainer,
                      justifyContent: 'center', alignItems: 'center',
                      flexShrink: 0,
                    }}>
                      <Text style={{ fontSize: 20 }}>
                        {b.type === 'supplier' ? '🏭' : b.type === 'company' ? '🏢' : '👤'}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.onSurface }}>
                        {b.name}
                      </Text>
                      <Text style={{ fontSize: 12, color: Colors.onSurfaceVariant }}>
                        {b.type.charAt(0).toUpperCase() + b.type.slice(1)}
                        {' • '}
                        {formatDate(b.lastOrder)}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end', gap: 3 }}>
                      <DueBadge balance={b.balance} type="buyer" />
                      {b.balance > 0 && (
                        <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.error }}>
                          ₹{b.balance.toLocaleString('en-IN')}
                        </Text>
                      )}
                      {b.totalSales > 0 && (
                        <Text style={{ fontSize: 11, color: Colors.outline }}>
                          ₹{b.totalSales.toLocaleString('en-IN')} total
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}

                {/* Total receivable — only show when not filtered */}
                {!q && (
                  <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: Spacing.md,
                    paddingTop: Spacing.md,
                    borderTopWidth: 2,
                    borderTopColor: Colors.outlineVariant,
                  }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.onSurfaceVariant }}>
                      TOTAL RECEIVABLE
                    </Text>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.secondary }}>
                      ₹{data.buyerDebts
                          .reduce((s, b) => s + Math.max(b.balance, 0), 0)
                          .toLocaleString('en-IN')}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}