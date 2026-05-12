import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';

import {
  MagnifyingGlass,
  X,
  Printer,
  PaperPlaneTilt,
  Boat   
} from "phosphor-react-native";

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
  MultiPurchaseBillData,
  MultiSalesBillData,
  RegisterReportData,
  RegisterReportParty,
  SingleBillPage,
  PurchaseBillData,
  SalesBillData,
} from '../../utils/pdfGenerator';

type RouteT = RouteProp<RootStackParamList, 'MultiStatementScreen'>;

type FilterMode  = 'all' | 'single' | 'range';
type ReportType  = 'purchase' | 'sales' | 'both';

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatDate(s: string): string {
  if (!s) return '';
  const [y,m,d] = s.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[parseInt(m)-1]} ${y}`;
}
function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

interface EntityRow {
  id:       number;
  name:     string;
  subLabel: string;
  phone?:   string;
  type?:    string; // for buyers
  entryCount: number;
  totalAmount: number;
  balance:     number;
}

function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, borderWidth: 1.5,
      borderColor: active ? Colors.primary : Colors.outlineVariant,
      backgroundColor: active ? Colors.primaryFixed : Colors.surfaceContainerLowest,
    }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: active ? Colors.onPrimaryFixed : Colors.onSurfaceVariant }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const isValid = value === '' || isValidDate(value);
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: Colors.onSurfaceVariant, marginBottom: 4, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <TextInput
        style={{
          backgroundColor: Colors.surfaceContainerLowest, borderRadius: 10, borderWidth: 1.5,
          borderColor: isValid ? Colors.outlineVariant : Colors.error,
          paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.onSurface,
        }}
        placeholder="YYYY-MM-DD" placeholderTextColor={Colors.outline}
        value={value} onChangeText={onChange} keyboardType="numeric" maxLength={10}
      />
    </View>
  );
}

export default function MultiStatementScreen() {
  const navigation  = useNavigation();
  const route       = useRoute<RouteT>();

  // ── CHANGE 1: preSelectedIds destructured from route.params ──
  const { type, ids, title, reportType: initialReportType, preSelectedIds } = route.params;

  const businessName = useAppStore(s => s.businessName);

  const isRegister  = type === 'both';
  const isFisherman = type === 'fisherman';

  // ── Filter state ──
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [singleDate, setSingleDate] = useState(todayString());
  const [fromDate,   setFromDate]   = useState('');
  const [tillDate,   setTillDate]   = useState(todayString());
  const [reportType, setReportType] = useState<ReportType>(initialReportType ?? 'both');

  // ── Entities ──
  const [allEntities,      setAllEntities]      = useState<EntityRow[]>([]);
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<number>>(new Set());
  const [loading,          setLoading]          = useState(true);
  const [generating,       setGenerating]       = useState(false);
  const [printing,         setPrinting]         = useState(false);
  const [search,           setSearch]           = useState('');

  // ── CHANGE 2: loadEntities uses preSelectedIds for initial selection ──
  const loadEntities = useCallback(async () => {
    try {
      setLoading(true);

      if (isFisherman || isRegister) {
        // Load fishermen
        const rows = await db.select().from(fishermen).orderBy(desc(fishermen.createdAt));
        const fishEntities: EntityRow[] = await Promise.all(
          rows.map(async f => {
            const entries = await db.select().from(purchaseEntries).where(eq(purchaseEntries.fishermenId, f.id));
            const [pmtRes] = await db
              .select({ total: sql<number>`COALESCE(SUM(amount),0)` })
              .from(payments)
              .innerJoin(purchaseEntries, eq(purchaseEntries.id, payments.referenceId))
              .where(sql`${payments.referenceType} = 'purchase' AND ${purchaseEntries.fishermenId} = ${f.id}`);
            const totalPurchases = entries.reduce((s,e) => s + e.totalAmount, 0);
            const totalPaid      = Number(pmtRes?.total ?? 0);
            return { id: f.id, name: f.name, subLabel: f.boatName, phone: f.phone ?? undefined, entryCount: entries.length, totalAmount: totalPurchases, balance: totalPurchases - totalPaid };
          })
        );

        if (isFisherman) {
          const filtered = ids && ids.length > 0 ? fishEntities.filter(e => ids.includes(e.id)) : fishEntities;
          setAllEntities(filtered);
          // If preSelectedIds provided, only pre-check those; otherwise check all
          const initialSelection = preSelectedIds && preSelectedIds.length > 0
            ? new Set(filtered.map(e => e.id).filter(id => preSelectedIds.includes(id)))
            : new Set(filtered.map(e => e.id));
          setSelectedEntityIds(initialSelection);

        } else {
          // register — merge fishermen + buyers
          const buyerRows = await db.select().from(buyers).orderBy(desc(buyers.createdAt));
          const buyerEntities: EntityRow[] = await Promise.all(
            buyerRows.map(async b => {
              const orders = await db.select().from(salesOrders).where(eq(salesOrders.buyerId, b.id));
              const [pmtRes] = await db
                .select({ total: sql<number>`COALESCE(SUM(amount),0)` })
                .from(payments)
                .innerJoin(salesOrders, eq(salesOrders.id, payments.referenceId))
                .where(sql`${payments.referenceType} = 'sale' AND ${salesOrders.buyerId} = ${b.id}`);
              const totalSales = orders.reduce((s,o) => s + o.totalAmount, 0);
              const totalPaid  = Number(pmtRes?.total ?? 0);
              return { id: b.id * -1, name: b.name, subLabel: b.type, phone: b.phone ?? undefined, type: b.type, entryCount: orders.length, totalAmount: totalSales, balance: totalSales - totalPaid };
            })
          );
          // store fishermen as positive ids, buyers as negative ids to distinguish
          const combined: EntityRow[] = [
            ...fishEntities.map(e => ({ ...e, type: 'fisherman' })),
            ...buyerEntities,
          ];
          setAllEntities(combined);
          // For register, preSelectedIds are real positive IDs from either side;
          // buyer IDs are stored as negative, so compare using Math.abs
          const initialSelection = preSelectedIds && preSelectedIds.length > 0
            ? new Set(combined.map(e => e.id).filter(id => preSelectedIds.includes(Math.abs(id))))
            : new Set(combined.map(e => e.id));
          setSelectedEntityIds(initialSelection);
        }

      } else {
        // buyers only
        const rows = await db.select().from(buyers).orderBy(desc(buyers.createdAt));
        const buyerEntities: EntityRow[] = await Promise.all(
          rows.map(async b => {
            const orders = await db.select().from(salesOrders).where(eq(salesOrders.buyerId, b.id));
            const [pmtRes] = await db
              .select({ total: sql<number>`COALESCE(SUM(amount),0)` })
              .from(payments)
              .innerJoin(salesOrders, eq(salesOrders.id, payments.referenceId))
              .where(sql`${payments.referenceType} = 'sale' AND ${salesOrders.buyerId} = ${b.id}`);
            const totalSales = orders.reduce((s,o) => s + o.totalAmount, 0);
            const totalPaid  = Number(pmtRes?.total ?? 0);
            return { id: b.id, name: b.name, subLabel: b.type, phone: b.phone ?? undefined, type: b.type, entryCount: orders.length, totalAmount: totalSales, balance: totalSales - totalPaid };
          })
        );
        const filtered = ids && ids.length > 0 ? buyerEntities.filter(e => ids.includes(e.id)) : buyerEntities;
        setAllEntities(filtered);
        // If preSelectedIds provided, only pre-check those; otherwise check all
        const initialSelection = preSelectedIds && preSelectedIds.length > 0
          ? new Set(filtered.map(e => e.id).filter(id => preSelectedIds.includes(id)))
          : new Set(filtered.map(e => e.id));
        setSelectedEntityIds(initialSelection);
      }
    } catch (err) {
      console.error('[MultiStatement] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [isFisherman, isRegister, ids, preSelectedIds]); // ← preSelectedIds added to deps

  useEffect(() => { loadEntities(); }, [loadEntities]);

  // ── Build pages for a purchase entity ──
  const buildPurchasePages = useCallback(async (fishermenId: number): Promise<SingleBillPage[]> => {
    let entries;
    if (filterMode === 'single' && isValidDate(singleDate)) {
      entries = await db.select().from(purchaseEntries)
        .where(sql`${purchaseEntries.fishermenId} = ${fishermenId} AND ${purchaseEntries.date} = ${singleDate}`)
        .orderBy(desc(purchaseEntries.date));
    } else if (filterMode === 'range' && isValidDate(fromDate) && isValidDate(tillDate) && fromDate <= tillDate) {
      entries = await db.select().from(purchaseEntries)
        .where(sql`${purchaseEntries.fishermenId} = ${fishermenId} AND ${purchaseEntries.date} >= ${fromDate} AND ${purchaseEntries.date} <= ${tillDate}`)
        .orderBy(desc(purchaseEntries.date));
    } else {
      entries = await db.select().from(purchaseEntries).where(eq(purchaseEntries.fishermenId, fishermenId)).orderBy(desc(purchaseEntries.date));
    }

    return Promise.all(entries.map(async e => {
      const items = await db.select().from(purchaseItems).where(eq(purchaseItems.entryId, e.id));
      const pmts  = await db.select().from(payments).where(sql`${payments.referenceType} = 'purchase' AND ${payments.referenceId} = ${e.id}`);
      const totalPaid = pmts.reduce((s,p) => s + p.amount, 0);
      return {
        billNumber: `P${e.id}`, date: e.date,
        items: items.map(i => ({ fishName: i.fishName, quantity: i.quantity, unit: i.unit, pricePerUnit: i.pricePerUnit, totalPrice: i.totalPrice })),
        totalAmount: e.totalAmount, totalPaid, balance: e.totalAmount - totalPaid,
        payments: pmts.map(p => ({ date: p.paymentDate, amount: p.amount, mode: p.mode })),
      };
    }));
  }, [filterMode, singleDate, fromDate, tillDate]);

  // ── Build pages for a sales entity ──
  const buildSalesPages = useCallback(async (buyerId: number): Promise<SingleBillPage[]> => {
    let orders;
    if (filterMode === 'single' && isValidDate(singleDate)) {
      orders = await db.select().from(salesOrders)
        .where(sql`${salesOrders.buyerId} = ${buyerId} AND ${salesOrders.date} = ${singleDate}`)
        .orderBy(desc(salesOrders.date));
    } else if (filterMode === 'range' && isValidDate(fromDate) && isValidDate(tillDate) && fromDate <= tillDate) {
      orders = await db.select().from(salesOrders)
        .where(sql`${salesOrders.buyerId} = ${buyerId} AND ${salesOrders.date} >= ${fromDate} AND ${salesOrders.date} <= ${tillDate}`)
        .orderBy(desc(salesOrders.date));
    } else {
      orders = await db.select().from(salesOrders).where(eq(salesOrders.buyerId, buyerId)).orderBy(desc(salesOrders.date));
    }

    return Promise.all(orders.map(async o => {
      const items = await db.select().from(salesItems).where(eq(salesItems.orderId, o.id));
      const pmts  = await db.select().from(payments).where(sql`${payments.referenceType} = 'sale' AND ${payments.referenceId} = ${o.id}`);
      const totalPaid = pmts.reduce((s,p) => s + p.amount, 0);
      return {
        billNumber: `S${o.id}`, date: o.date,
        items: items.map(i => ({ fishName: i.fishName, quantity: i.quantity, unit: i.unit, pricePerUnit: i.pricePerUnit, totalPrice: i.totalPrice })),
        totalAmount: o.totalAmount, totalPaid, balance: o.totalAmount - totalPaid,
        payments: pmts.map(p => ({ date: p.paymentDate, amount: p.amount, mode: p.mode })),
      };
    }));
  }, [filterMode, singleDate, fromDate, tillDate]);

  // ── Build bill data ──
  const buildBillData = useCallback(async () => {
    const selected = allEntities.filter(e => selectedEntityIds.has(e.id));

    if (isRegister) {
      // Register report
      const parties: RegisterReportParty[] = [];
      for (const entity of selected) {
        const isFish = entity.id > 0; // fishermen positive, buyers negative
        const realId = entity.id > 0 ? entity.id : entity.id * -1;
        const party: RegisterReportParty = {
          entityType: isFish ? 'fisherman' : 'buyer',
          name: entity.name,
          subLabel: entity.subLabel,
          phone: entity.phone,
        };
        if (isFish && (reportType === 'purchase' || reportType === 'both')) {
          party.purchasePages = await buildPurchasePages(realId);
        }
        if (!isFish && (reportType === 'sales' || reportType === 'both')) {
          party.salesPages = await buildSalesPages(realId);
        }
        // skip entities with no data for the selected report type
        if ((party.purchasePages?.length ?? 0) + (party.salesPages?.length ?? 0) > 0) {
          parties.push(party);
        }
      }
      const result: RegisterReportData = { type: 'register', businessName, reportType, parties };
      return result;

    } else if (isFisherman) {
      const partiesData: PurchaseBillData[] = [];
      for (const entity of selected) {
        const pages = await buildPurchasePages(entity.id);
        if (pages.length > 0) {
          partiesData.push({ type: 'purchase', businessName, fishermanName: entity.name, boatName: entity.subLabel, phone: entity.phone, pages });
        }
      }
      const result: MultiPurchaseBillData = { type: 'multi-purchase', businessName, parties: partiesData };
      return result;

    } else {
      const partiesData: SalesBillData[] = [];
      for (const entity of selected) {
        const pages = await buildSalesPages(entity.id);
        if (pages.length > 0) {
          partiesData.push({ type: 'sales', businessName, buyerName: entity.name, buyerType: entity.subLabel, phone: entity.phone, pages });
        }
      }
      const result: MultiSalesBillData = { type: 'multi-sales', businessName, parties: partiesData };
      return result;
    }
  }, [allEntities, selectedEntityIds, isRegister, isFisherman, reportType, buildPurchasePages, buildSalesPages, businessName]);

  const handleGenerate = async () => {
    if (selectedEntityIds.size === 0) { Alert.alert('No selection', 'Select at least one entry.'); return; }
    try {
      setGenerating(true);
      const data = await buildBillData();
      await generateAndShareBill(data);
    } catch (err) { Alert.alert('Error', String(err)); }
    finally { setGenerating(false); }
  };

  const handlePrint = async () => {
    if (selectedEntityIds.size === 0) { Alert.alert('No selection', 'Select at least one entry.'); return; }
    try {
      setPrinting(true);
      const data = await buildBillData();
      await printBill(data);
    } catch (err) { Alert.alert('Error', String(err)); }
    finally { setPrinting(false); }
  };

  const toggleEntity = (id: number) => {
    setSelectedEntityIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const rangeError = filterMode === 'range' && fromDate && tillDate
    && isValidDate(fromDate) && isValidDate(tillDate) && fromDate > tillDate
    ? '"From" must be before "Till"' : null;

  const q = search.trim().toLowerCase();
  const filteredEntities = q ? allEntities.filter(e =>
    e.name.toLowerCase().includes(q) || e.subLabel.toLowerCase().includes(q)
  ) : allEntities;

  const screenTitle = title ?? (isFisherman ? 'Purchase Bills' : isRegister ? 'Register Report' : 'Sales Invoices');
  const accentColor = isFisherman ? Colors.primary : Colors.secondary;
  const accentFixed = isFisherman ? Colors.primaryFixed : Colors.secondaryContainer;
  const onAccent    = isFisherman ? Colors.onPrimary : Colors.onSecondary;
  const onFixed     = isFisherman ? Colors.onPrimaryFixed : Colors.onSecondaryContainer;

  const selectedTotalAmount = allEntities
    .filter(e => selectedEntityIds.has(e.id))
    .reduce((s, e) => s + e.totalAmount, 0);
  const selectedTotalBalance = allEntities
    .filter(e => selectedEntityIds.has(e.id))
    .reduce((s, e) => s + e.balance, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface }} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.gutter, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={{ marginBottom: Spacing.lg }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.onSurface, letterSpacing: -0.5 }}>
            {screenTitle}
          </Text>
          <Text style={{ fontSize: 14, color: Colors.onSurfaceVariant, marginTop: 4 }}>
            Select entries, apply filters, then generate PDF.
          </Text>
        </View>

        {/* ── Report type selector (register only) ── */}
        {isRegister && (
          <View style={{
            backgroundColor: Colors.surfaceContainerLow,
            borderRadius: 16, padding: Spacing.md, marginBottom: Spacing.md,
          }}>
            <Text style={{
              fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
              color: Colors.onSurfaceVariant, marginBottom: Spacing.sm, textTransform: 'uppercase',
            }}>
              Report Type
            </Text>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              {([
                { key: 'purchase', label: '🐟 Purchases', color: Colors.primary, fixed: Colors.primaryFixed, onFixed: Colors.onPrimaryFixed },
                { key: 'sales',    label: '🤝 Sales',     color: Colors.secondary, fixed: Colors.secondaryContainer, onFixed: Colors.onSecondaryContainer },
                { key: 'both',     label: '📊 Both',      color: Colors.tertiary, fixed: Colors.tertiaryFixed, onFixed: Colors.onTertiaryFixedVariant },
              ] as const).map(opt => {
                const active = reportType === opt.key;
                return (
                  <TouchableOpacity key={opt.key} onPress={() => setReportType(opt.key)} style={{
                    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: active ? opt.color : Colors.outlineVariant,
                    backgroundColor: active ? opt.fixed : Colors.surfaceContainerLowest,
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: active ? opt.onFixed : Colors.outline }}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Date filter ── */}
        <View style={{
          backgroundColor: Colors.surfaceContainerLow,
          borderRadius: 16, padding: Spacing.md, marginBottom: Spacing.md,
        }}>
          <Text style={{
            fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
            color: Colors.onSurfaceVariant, marginBottom: Spacing.sm, textTransform: 'uppercase',
          }}>
            Date Filter
          </Text>
          <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: filterMode === 'all' ? 0 : Spacing.md, flexWrap: 'wrap' }}>
            <FilterPill label="All Time"    active={filterMode === 'all'}    onPress={() => setFilterMode('all')} />
            <FilterPill label="Single Date" active={filterMode === 'single'} onPress={() => setFilterMode('single')} />
            <FilterPill label="Date Range"  active={filterMode === 'range'}  onPress={() => setFilterMode('range')} />
          </View>
          {filterMode === 'single' && (
            <DateInput label="Date" value={singleDate} onChange={setSingleDate} />
          )}
          {filterMode === 'range' && (
            <>
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <DateInput label="From" value={fromDate} onChange={setFromDate} />
                <DateInput label="Till" value={tillDate} onChange={setTillDate} />
              </View>
              {rangeError && <Text style={{ fontSize: 12, color: Colors.error, marginTop: 6 }}>⚠ {rangeError}</Text>}
            </>
          )}
        </View>

        {/* ── Search ── */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: Colors.surfaceContainerLow, borderRadius: 12,
          paddingHorizontal: 12, paddingVertical: 10, marginBottom: Spacing.md,
          gap: 8, borderWidth: 1,
          borderColor: search ? accentColor : Colors.outlineVariant,
        }}>
          <MagnifyingGlass
  size={18}
  color={Colors.onSurfaceVariant}
  weight="bold"
/>
          <TextInput
            style={{ flex: 1, fontSize: 15, color: Colors.onSurface, padding: 0 }}
            placeholder={isFisherman ? "Search fishermen…" : isRegister ? "Search…" : "Search buyers…"}
            placeholderTextColor={Colors.outline}
            value={search} onChangeText={setSearch}
            autoCapitalize="words"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X
  size={18}
  color={Colors.outline}
  weight="bold"
/>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Select all / none ── */}
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: Spacing.md,
        }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.onSurface }}>
            {isRegister ? 'All Entities' : isFisherman ? 'Fishermen' : 'Buyers'}
            {' '}
            <Text style={{ color: Colors.onSurfaceVariant, fontWeight: '400' }}>
              ({selectedEntityIds.size}/{allEntities.length} selected)
            </Text>
          </Text>
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <TouchableOpacity onPress={() => setSelectedEntityIds(new Set(allEntities.map(e => e.id)))}>
              <Text style={{ fontSize: 13, color: accentColor, fontWeight: '600' }}>All</Text>
            </TouchableOpacity>
            <Text style={{ color: Colors.outline }}>|</Text>
            <TouchableOpacity onPress={() => setSelectedEntityIds(new Set())}>
              <Text style={{ fontSize: 13, color: Colors.outline, fontWeight: '600' }}>None</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Loading ── */}
        {loading && (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <ActivityIndicator size="large" color={accentColor} />
          </View>
        )}

        {/* ── Entity list ── */}
        {!loading && filteredEntities.map(entity => {
          const isBuyer   = isRegister && entity.id < 0;
          const isFish    = isRegister && entity.id > 0;
          const selected  = selectedEntityIds.has(entity.id);
          const isCleared = entity.balance <= 0;

          return (
            <TouchableOpacity
              key={entity.id}
              onPress={() => toggleEntity(entity.id)}
              activeOpacity={0.85}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
                padding: Spacing.md, marginBottom: Spacing.sm,
                backgroundColor: selected ? accentFixed : Colors.surfaceContainerLowest,
                borderRadius: 14, borderWidth: 1.5,
                borderColor: selected ? accentColor : Colors.outlineVariant,
              }}
            >
              {/* Checkbox */}
              <View style={{
                width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                borderColor: selected ? accentColor : Colors.outlineVariant,
                backgroundColor: selected ? accentColor : 'transparent',
                justifyContent: 'center', alignItems: 'center', flexShrink: 0,
              }}>
                {selected && <Text style={{ color: onAccent, fontSize: 12, fontWeight: '700' }}>✓</Text>}
              </View>

              {/* Avatar */}
              <View style={{
                width: 44, height: 44, borderRadius: isBuyer ? 12 : 22,
                backgroundColor: isBuyer ? Colors.secondaryContainer : Colors.primaryFixed,
                justifyContent: 'center', alignItems: 'center', flexShrink: 0,
              }}>
                {isBuyer ? (
                  <Text style={{ fontSize: 20 }}>
                    {entity.subLabel === 'supplier' ? '🏭' : entity.subLabel === 'company' ? '🏢' : '👤'}
                  </Text>
                ) : (
                  <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.onPrimaryFixed }}>
                    {entity.name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()}
                  </Text>
                )}
              </View>

              {/* Info */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.onSurface }}>
                  {entity.name}
                </Text>
                <Text style={{ fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 1 }}>
                  {isBuyer ? entity.subLabel.charAt(0).toUpperCase() + entity.subLabel.slice(1)
                           : `${entity.subLabel}`}
                  {' · '}
                  {entity.entryCount} {isBuyer ? 'order' : 'entr'}{entity.entryCount !== 1 ? (isBuyer ? 's' : 'ies') : 'y'}
                </Text>
              </View>

              {/* Balance */}
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.onSurface }}>
                  ₹{entity.totalAmount.toLocaleString('en-IN')}
                </Text>
                <Text style={{ fontSize: 11, color: isCleared ? Colors.primary : Colors.error, fontWeight: '600' }}>
                  {isCleared ? 'Cleared' : `₹${entity.balance.toLocaleString('en-IN')} due`}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* ── Empty state ── */}
        {!loading && allEntities.length === 0 && (
          <View style={{
            backgroundColor: Colors.surfaceContainerLow,
            borderRadius: 16, padding: Spacing.xxl, alignItems: 'center',
          }}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>📋</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.onSurface }}>
              No {isFisherman ? 'fishermen' : 'buyers'} found
            </Text>
          </View>
        )}

        {/* ── Summary bar ── */}
        {selectedEntityIds.size > 0 && (
          <View style={{
            backgroundColor: accentColor, borderRadius: 16,
            padding: Spacing.lg, marginTop: Spacing.md,
          }}>
            <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: `${onAccent}80`, marginBottom: 8 }}>
              SELECTED SUMMARY — {selectedEntityIds.size} {isFisherman ? 'FISHERMAN' : isRegister ? 'ENTIT' : 'BUYER'}{selectedEntityIds.size !== 1 ? (isRegister ? 'IES' : 'S') : (isRegister ? 'Y' : '')}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 11, color: `${onAccent}70`, fontWeight: '600' }}>TOTAL AMOUNT</Text>
                <Text style={{ fontSize: 22, fontWeight: '700', color: onAccent, marginTop: 2 }}>
                  ₹{selectedTotalAmount.toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 11, color: `${onAccent}70`, fontWeight: '600' }}>BALANCE DUE</Text>
                <Text style={{
                  fontSize: 22, fontWeight: '700',
                  color: selectedTotalBalance > 0 ? Colors.errorContainer : '#4ade80',
                  marginTop: 2,
                }}>
                  {selectedTotalBalance > 0
                    ? `₹${selectedTotalBalance.toLocaleString('en-IN')}`
                    : 'Cleared'}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Sticky action bar ── */}
      {!loading && allEntities.length > 0 && (
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: Colors.surface,
          borderTopWidth: 1, borderTopColor: Colors.outlineVariant,
          padding: Spacing.md, paddingBottom: 28, gap: Spacing.sm,
        }}>
          <TouchableOpacity
            onPress={handleGenerate}
            disabled={generating || selectedEntityIds.size === 0}
            style={{
              backgroundColor: selectedEntityIds.size === 0 ? Colors.outlineVariant : accentColor,
              borderRadius: 14, paddingVertical: 15,
              alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
            }}
          >
            {
  generating ? (
    <>
      <ActivityIndicator size="small" color={onAccent} />
      <Text style={{
        color: onAccent,
        fontSize: 15,
        fontWeight: '700'
      }}>
        Generating PDF…
      </Text>
    </>
  ) : (
    <>
      <PaperPlaneTilt
        size={18}
        color={onAccent}
        weight="fill"
      />
      <Text style={{
        color: onAccent,
        fontSize: 15,
        fontWeight: '700'
      }}>
        Share PDF — {selectedEntityIds.size} selected
      </Text>
    </>
  )
}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handlePrint}
            disabled={printing || selectedEntityIds.size === 0}
            style={{
              backgroundColor: Colors.surfaceContainerLow, borderRadius: 14,
              paddingVertical: 13, alignItems: 'center', flexDirection: 'row',
              justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: Colors.outlineVariant,
            }}
          >
            {
  printing ? (
    <>
      <ActivityIndicator size="small" color={accentColor} />
      <Text style={{
        color: Colors.onSurface,
        fontSize: 14,
        fontWeight: '600'
      }}>
        Opening Print…
      </Text>
    </>
  ) : (
    <>
      <Printer
        size={18}
        color={Colors.onSurface}
        weight="fill"
      />
      <Text style={{
        color: Colors.onSurface,
        fontSize: 14,
        fontWeight: '600'
      }}>
        Print
      </Text>
    </>
  )
}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}