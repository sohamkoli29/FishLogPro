import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { eq, sql, desc } from 'drizzle-orm';

import { RootStackParamList } from '../../types';
import { Colors, Spacing } from '../../utils/theme';
import { db } from '../../db/client';
import { useAppStore } from '../../stores/appStore';
import {
  fishermen,
  buyers,
  purchaseEntries,
  purchaseItems,
  salesOrders,
  salesItems,
  payments,
} from '../../db/schema';
import {
  generateAndShareBill,
  printBill,
  BillData,
  PurchaseBillData,
  SalesBillData,
  BillItem,
} from '../../utils/pdfGenerator';

type RouteT = RouteProp<RootStackParamList, 'StatementScreen'>;

// ── Helpers ────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [yyyy, mm, dd] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${dd} ${months[parseInt(mm) - 1]} ${yyyy}`;
}

// ── Entry/Order row for list ───────────────────────────────────
function BillRow({
  id,
  date,
  amount,
  balance,
  label,
  selected,
  onSelect,
}: {
  id:       number;
  date:     string;
  amount:   number;
  balance:  number;
  label:    string;
  selected: boolean;
  onSelect: () => void;
}) {
  const isCleared = balance <= 0;

  return (
    <TouchableOpacity
      onPress={onSelect}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        padding: Spacing.md,
        backgroundColor: selected
          ? Colors.primaryFixed
          : Colors.surfaceContainerLowest,
        borderRadius: 12,
        marginBottom: Spacing.sm,
        borderWidth: 1.5,
        borderColor: selected ? Colors.primary : Colors.outlineVariant,
      }}
    >
      {/* Checkbox */}
      <View style={{
        width: 22, height: 22, borderRadius: 11,
        borderWidth: 2,
        borderColor: selected ? Colors.primary : Colors.outlineVariant,
        backgroundColor: selected ? Colors.primary : 'transparent',
        justifyContent: 'center', alignItems: 'center',
        flexShrink: 0,
      }}>
        {selected && (
          <Text style={{ color: Colors.onPrimary, fontSize: 12, fontWeight: '700' }}>
            ✓
          </Text>
        )}
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={{
          fontSize: 14, fontWeight: '600',
          color: Colors.onSurface,
        }}>
          {label} #{id}
        </Text>
        <Text style={{ fontSize: 12, color: Colors.onSurfaceVariant }}>
          {formatDate(date)}
        </Text>
      </View>

      {/* Amount */}
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.onSurface }}>
          ₹{amount.toLocaleString('en-IN')}
        </Text>
        <Text style={{
          fontSize: 11, fontWeight: '600',
          color: isCleared ? Colors.primary : Colors.error,
        }}>
          {isCleared ? '✓ Cleared' : `₹${balance.toLocaleString('en-IN')} due`}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Main screen ────────────────────────────────────────────────
export default function StatementScreen() {
  const navigation   = useNavigation();
  const route        = useRoute<RouteT>();
  const { type, id, name } = route.params;
  const businessName = useAppStore((s) => s.businessName);

  const isPurchase = type === 'fisherman';

  // List of all entries/orders for this party
  const [billList, setBillList] = useState<{
    id: number; date: string; amount: number; balance: number;
  }[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading,     setLoading]     = useState(true);
  const [generating,  setGenerating]  = useState(false);
  const [printing,    setPrinting]    = useState(false);

  // Party details
  const [partyDetails, setPartyDetails] = useState<{
    name: string;
    boatName?: string;
    phone?: string;
    type?: string;
  }>({ name });

  // ── Load data ──
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      if (isPurchase) {
        // Load fisherman details
        const [fish] = await db
          .select()
          .from(fishermen)
          .where(eq(fishermen.id, id))
          .limit(1);

        if (fish) {
          setPartyDetails({
            name:     fish.name,
            boatName: fish.boatName,
            phone:    fish.phone ?? undefined,
          });
        }

        // Load purchase entries with balance
        const entries = await db
          .select()
          .from(purchaseEntries)
          .where(eq(purchaseEntries.fishermenId, id))
          .orderBy(desc(purchaseEntries.date));

        const withBalance = await Promise.all(
          entries.map(async (e) => {
            const [pmtRes] = await db
              .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
              .from(payments)
              .where(
                sql`${payments.referenceType} = 'purchase'
                    AND ${payments.referenceId} = ${e.id}`
              );
            const totalPaid = Number(pmtRes?.total ?? 0);
            return {
              id:      e.id,
              date:    e.date,
              amount:  e.totalAmount,
              balance: e.totalAmount - totalPaid,
            };
          })
        );

        setBillList(withBalance);
        // Select all by default
        setSelectedIds(new Set(withBalance.map((e) => e.id)));

      } else {
        // Load buyer details
        const [buyer] = await db
          .select()
          .from(buyers)
          .where(eq(buyers.id, id))
          .limit(1);

        if (buyer) {
          setPartyDetails({
            name:  buyer.name,
            type:  buyer.type,
            phone: buyer.phone ?? undefined,
          });
        }

        // Load sales orders with balance
        const orders = await db
          .select()
          .from(salesOrders)
          .where(eq(salesOrders.buyerId, id))
          .orderBy(desc(salesOrders.date));

        const withBalance = await Promise.all(
          orders.map(async (o) => {
            const [pmtRes] = await db
              .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
              .from(payments)
              .where(
                sql`${payments.referenceType} = 'sale'
                    AND ${payments.referenceId} = ${o.id}`
              );
            const totalPaid = Number(pmtRes?.total ?? 0);
            return {
              id:      o.id,
              date:    o.date,
              amount:  o.totalAmount,
              balance: o.totalAmount - totalPaid,
            };
          })
        );

        setBillList(withBalance);
        setSelectedIds(new Set(withBalance.map((o) => o.id)));
      }
    } catch (err) {
      console.error('[Statement] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [id, type]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Toggle selection ──
  const toggleSelect = (entryId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  const selectAll   = () => setSelectedIds(new Set(billList.map((b) => b.id)));
  const deselectAll = () => setSelectedIds(new Set());

  // ── Build bill data for selected entries ──
  const buildBillData = useCallback(async (): Promise<BillData> => {
    const selected = billList.filter((b) => selectedIds.has(b.id));
    const billNumber = `${id}-${Date.now().toString().slice(-6)}`;

    if (isPurchase) {
      // Fetch all items for selected entries
      const allItems: BillItem[] = [];
      const allPayments: { date: string; amount: number; mode: string }[] = [];

      for (const entry of selected) {
        const items = await db
          .select()
          .from(purchaseItems)
          .where(eq(purchaseItems.entryId, entry.id));

        allItems.push(...items.map((item) => ({
          fishName:     item.fishName,
          quantity:     item.quantity,
          unit:         item.unit,
          pricePerUnit: item.pricePerUnit,
          totalPrice:   item.totalPrice,
        })));

        const pmts = await db
          .select()
          .from(payments)
          .where(
            sql`${payments.referenceType} = 'purchase'
                AND ${payments.referenceId} = ${entry.id}`
          );

        allPayments.push(...pmts.map((p) => ({
          date:   p.paymentDate,
          amount: p.amount,
          mode:   p.mode,
        })));
      }

      const totalAmount = selected.reduce((s, e) => s + e.amount,  0);
      const totalPaid   = selected.reduce((s, e) => s + (e.amount - e.balance), 0);

      return {
        type:          'purchase',
        billNumber,
        date:          selected[0]?.date ?? '',
        businessName,
        fishermanName: partyDetails.name,
        boatName:      partyDetails.boatName ?? '',
        phone:         partyDetails.phone,
        items:         allItems,
        totalAmount,
        totalPaid,
        balance:       totalAmount - totalPaid,
        payments:      allPayments,
      } as PurchaseBillData;

    } else {
      // Sales
      const allItems: BillItem[] = [];
      const allPayments: { date: string; amount: number; mode: string }[] = [];

      for (const order of selected) {
        const items = await db
          .select()
          .from(salesItems)
          .where(eq(salesItems.orderId, order.id));

        allItems.push(...items.map((item) => ({
          fishName:     item.fishName,
          quantity:     item.quantity,
          unit:         item.unit,
          pricePerUnit: item.pricePerUnit,
          totalPrice:   item.totalPrice,
        })));

        const pmts = await db
          .select()
          .from(payments)
          .where(
            sql`${payments.referenceType} = 'sale'
                AND ${payments.referenceId} = ${order.id}`
          );

        allPayments.push(...pmts.map((p) => ({
          date:   p.paymentDate,
          amount: p.amount,
          mode:   p.mode,
        })));
      }

      const totalAmount = selected.reduce((s, o) => s + o.amount,  0);
      const totalPaid   = selected.reduce((s, o) => s + (o.amount - o.balance), 0);

      const [firstOrder] = await db
        .select({ status: salesOrders.status })
        .from(salesOrders)
        .where(eq(salesOrders.id, selected[0]?.id ?? 0))
        .limit(1);

      return {
        type:         'sales',
        billNumber,
        date:         selected[0]?.date ?? '',
        businessName,
        buyerName:    partyDetails.name,
        buyerType:    partyDetails.type ?? 'other',
        phone:        partyDetails.phone,
        status:       firstOrder?.status ?? 'pending',
        items:        allItems,
        totalAmount,
        totalPaid,
        balance:      totalAmount - totalPaid,
        payments:     allPayments,
      } as SalesBillData;
    }
  }, [billList, selectedIds, id, isPurchase, businessName, partyDetails]);

  // ── Generate PDF ──
  const handleGenerate = async () => {
    if (selectedIds.size === 0) {
      Alert.alert('No selection', 'Please select at least one entry to generate a bill.');
      return;
    }
    try {
      setGenerating(true);
      const data = await buildBillData();
      await generateAndShareBill(data);
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setGenerating(false);
    }
  };

  // ── Print ──
  const handlePrint = async () => {
    if (selectedIds.size === 0) {
      Alert.alert('No selection', 'Please select at least one entry.');
      return;
    }
    try {
      setPrinting(true);
      const data = await buildBillData();
      await printBill(data);
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setPrinting(false);
    }
  };

  // ── Summary of selected ──
  const selectedEntries  = billList.filter((b) => selectedIds.has(b.id));
  const selectedTotal    = selectedEntries.reduce((s, b) => s + b.amount,  0);
  const selectedBalance  = selectedEntries.reduce((s, b) => s + b.balance, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface }} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.gutter, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={{ marginBottom: Spacing.xl }}>
          <Text style={{
            fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
            color: Colors.onSurfaceVariant, marginBottom: 4,
          }}>
            {isPurchase ? 'PURCHASE BILL' : 'SALES INVOICE'}
          </Text>
          <Text style={{
            fontSize: 26, fontWeight: '700',
            color: Colors.onSurface, letterSpacing: -0.3,
          }}>
            {name}
          </Text>
          <Text style={{ fontSize: 14, color: Colors.onSurfaceVariant, marginTop: 2 }}>
            {partyDetails.boatName
              ? `⛵ ${partyDetails.boatName}`
              : partyDetails.type
                ? `${partyDetails.type.charAt(0).toUpperCase() + partyDetails.type.slice(1)}`
                : ''}
          </Text>
        </View>

        {/* ── Loading ── */}
        {loading && (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}

        {!loading && (
          <>
            {/* ── Select all / none ── */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: Spacing.md,
            }}>
              <Text style={{
                fontSize: 14, fontWeight: '700', color: Colors.onSurface,
              }}>
                {isPurchase ? 'Purchase Entries' : 'Sales Orders'}
                {' '}
                <Text style={{ color: Colors.onSurfaceVariant, fontWeight: '400' }}>
                  ({selectedIds.size}/{billList.length} selected)
                </Text>
              </Text>
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <TouchableOpacity onPress={selectAll}>
                  <Text style={{ fontSize: 13, color: Colors.primary, fontWeight: '600' }}>
                    All
                  </Text>
                </TouchableOpacity>
                <Text style={{ color: Colors.outline }}>|</Text>
                <TouchableOpacity onPress={deselectAll}>
                  <Text style={{ fontSize: 13, color: Colors.outline, fontWeight: '600' }}>
                    None
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Empty state ── */}
            {billList.length === 0 && (
              <View style={{
                backgroundColor: Colors.surfaceContainerLow,
                borderRadius: 16,
                padding: Spacing.xxl,
                alignItems: 'center',
              }}>
                <Text style={{ fontSize: 36, marginBottom: 12 }}>📄</Text>
                <Text style={{
                  fontSize: 16, fontWeight: '600',
                  color: Colors.onSurface, marginBottom: 6,
                }}>
                  No Records Found
                </Text>
                <Text style={{
                  fontSize: 14, color: Colors.onSurfaceVariant,
                  textAlign: 'center',
                }}>
                  No {isPurchase ? 'purchase entries' : 'sales orders'} found for {name}.
                </Text>
              </View>
            )}

            {/* ── Bill list ── */}
            {billList.map((bill) => (
              <BillRow
                key={bill.id}
                id={bill.id}
                date={bill.date}
                amount={bill.amount}
                balance={bill.balance}
                label={isPurchase ? 'Entry' : 'Order'}
                selected={selectedIds.has(bill.id)}
                onSelect={() => toggleSelect(bill.id)}
              />
            ))}

            {/* ── Selection summary ── */}
            {selectedIds.size > 0 && (
              <View style={{
                backgroundColor: Colors.primary,
                borderRadius: 16,
                padding: Spacing.lg,
                marginTop: Spacing.md,
                marginBottom: Spacing.lg,
              }}>
                <Text style={{
                  fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
                  color: `${Colors.onPrimary}80`, marginBottom: 8,
                }}>
                  BILL SUMMARY — {selectedIds.size} {isPurchase ? 'ENTR' : 'ORDER'}{selectedIds.size !== 1 ? 'IES' : 'Y'}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{
                      fontSize: 11, color: `${Colors.onPrimary}70`, fontWeight: '600',
                    }}>
                      TOTAL AMOUNT
                    </Text>
                    <Text style={{
                      fontSize: 22, fontWeight: '700',
                      color: Colors.onPrimary, marginTop: 2,
                    }}>
                      ₹{selectedTotal.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{
                      fontSize: 11, color: `${Colors.onPrimary}70`, fontWeight: '600',
                    }}>
                      BALANCE DUE
                    </Text>
                    <Text style={{
                      fontSize: 22, fontWeight: '700',
                      color: selectedBalance > 0 ? Colors.errorContainer : '#4ade80',
                      marginTop: 2,
                    }}>
                      {selectedBalance > 0
                        ? `₹${selectedBalance.toLocaleString('en-IN')}`
                        : '✓ Cleared'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Sticky bottom action bar ── */}
      {!loading && billList.length > 0 && (
        <View style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.outlineVariant,
          padding: Spacing.md,
          paddingBottom: 28,
          gap: Spacing.sm,
        }}>
          {/* Share PDF */}
          <TouchableOpacity
            onPress={handleGenerate}
            disabled={generating || selectedIds.size === 0}
            style={{
              backgroundColor: selectedIds.size === 0
                ? Colors.outlineVariant
                : Colors.primary,
              borderRadius: 14,
              paddingVertical: 15,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {generating ? (
              <>
                <ActivityIndicator size="small" color={Colors.onPrimary} />
                <Text style={{
                  color: Colors.onPrimary, fontSize: 15, fontWeight: '700',
                }}>
                  Generating PDF…
                </Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 18 }}>📤</Text>
                <Text style={{
                  color: Colors.onPrimary, fontSize: 15, fontWeight: '700',
                }}>
                  Share PDF Bill
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Print */}
          <TouchableOpacity
            onPress={handlePrint}
            disabled={printing || selectedIds.size === 0}
            style={{
              backgroundColor: Colors.surfaceContainerLow,
              borderRadius: 14,
              paddingVertical: 13,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              borderWidth: 1,
              borderColor: Colors.outlineVariant,
            }}
          >
            {printing ? (
              <>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={{
                  color: Colors.onSurface, fontSize: 14, fontWeight: '600',
                }}>
                  Opening Print…
                </Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 16 }}>🖨️</Text>
                <Text style={{
                  color: Colors.onSurface, fontSize: 14, fontWeight: '600',
                }}>
                  Print Bill
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}