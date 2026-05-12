import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator, TextInput,
} from 'react-native';

import {
  MagnifyingGlass,
  X,
  Phone,
  PencilSimple,
  Trash,
  FileText,
  Handshake ,
  Factory,
  Buildings,
  User,
} from "phosphor-react-native";


import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { eq, desc, sql } from 'drizzle-orm';

import { RootStackParamList } from '../../types';
import { Colors, Spacing } from '../../utils/theme';
import { db } from '../../db/client';
import { buyers, salesOrders, payments, type Buyer } from '../../db/schema';
import { useBuyers } from '../../hooks/useBuyers';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface BuyerWithBalance extends Buyer {
  totalSales: number;
  totalPaid:  number;
  balance:    number;
}


const TYPE_CONFIG = {
  supplier: {
    icon: Factory,
    label: 'Supplier',
    bg: Colors.tertiaryFixed,
    color: Colors.onTertiaryFixedVariant,
  },

  company: {
    icon: Buildings,
    label: 'Company',
    bg: Colors.secondaryContainer,
    color: Colors.onSecondaryContainer,
  },

  other: {
    icon: User,
    label: 'Other',
    bg: Colors.surfaceVariant,
    color: Colors.onSurfaceVariant,
  },
};

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceContainerLow,
      borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: Spacing.md,
      gap: 8, borderWidth: 1, borderColor: value ? Colors.secondary : Colors.outlineVariant,
    }}>
      <MagnifyingGlass
  size={18}
  color={Colors.onSurfaceVariant}
  weight="bold"
/>
      <TextInput
        style={{ flex: 1, fontSize: 15, color: Colors.onSurface, padding: 0 }}
        placeholder={placeholder} placeholderTextColor={Colors.outline}
        value={value} onChangeText={onChange} autoCapitalize="words" returnKeyType="search"
      />
      {value.length > 0 && <TouchableOpacity onPress={() => onChange('')}><X
  size={18}
  color={Colors.outline}
  weight="bold"
/></TouchableOpacity>}
    </View>
  );
}

function BalanceBadge({ balance }: { balance: number }) {
  const isCleared = balance <= 0;
  return (
    <View style={{ backgroundColor: isCleared ? Colors.primaryFixed : Colors.errorContainer, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: isCleared ? Colors.onPrimaryFixed : Colors.onErrorContainer }}>{isCleared ? 'Cleared' : 'Owes'}</Text>
    </View>
  );
}

function BuyerCard({ item, onPress, onEdit, onDelete }: { item: BuyerWithBalance; onPress: () => void; onEdit: () => void; onDelete: () => void }) {
   const cfg =
    TYPE_CONFIG[item.type as keyof typeof TYPE_CONFIG] ??
    TYPE_CONFIG.other;

  const IconComponent = cfg.icon;
  const handleDelete = () => Alert.alert('Delete Buyer', `Remove ${item.name} and all their sales records? This cannot be undone.`,
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: onDelete }]);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{ backgroundColor: Colors.surfaceContainerLowest, borderRadius: 16, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.outlineVariant }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
       <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            backgroundColor: cfg.bg,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <IconComponent
            size={24}
            color={cfg.color}
            weight="fill"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.onSurface }}>{item.name}</Text>
          <View style={{ alignSelf: 'flex-start', backgroundColor: cfg.bg, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2, marginBottom: 2 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: cfg.color }}>{cfg.label.toUpperCase()}</Text>
          </View>
          {item.phone ? <Text style={{ fontSize: 12, color: Colors.outline }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
  <Phone
    size={12}
    color={Colors.outline}
    weight="fill"
  />
  <Text style={{ fontSize: 12, color: Colors.outline }}>
    {item.phone}
  </Text>
</View></Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <BalanceBadge balance={item.balance} />
          {item.balance > 0 && <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.error }}>₹{item.balance.toLocaleString('en-IN')}</Text>}
          {item.totalSales > 0 && <Text style={{ fontSize: 11, color: Colors.outline }}>₹{item.totalSales.toLocaleString('en-IN')} total</Text>}
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.outlineVariant }}>
        <TouchableOpacity onPress={onEdit} style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.outlineVariant, backgroundColor: Colors.surfaceContainer }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
  <PencilSimple
    size={14}
    color={Colors.onSurface}
    weight="fill"
  />
  <Text style={{ fontSize: 13, color: Colors.onSurface, fontWeight: '500' }}>
    Edit
  </Text>
</View>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: `${Colors.error}30`, backgroundColor: `${Colors.error}0a` }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
  <Trash
    size={14}
    color={Colors.error}
    weight="fill"
  />
  <Text style={{ fontSize: 13, color: Colors.error, fontWeight: '500' }}>
    Delete
  </Text>
</View>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function BuyersScreen() {
  const navigation      = useNavigation<Nav>();
  const { deleteBuyer } = useBuyers();

  const [list,    setList]    = React.useState<BuyerWithBalance[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [query,   setQuery]   = useState('');
  const isMounted             = useRef(true);

  React.useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await db.select().from(buyers).orderBy(desc(buyers.createdAt));
      const withBalances: BuyerWithBalance[] = await Promise.all(rows.map(async b => {
        const [salesRes]   = await db.select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` }).from(salesOrders).where(eq(salesOrders.buyerId, b.id));
        const [paymentRes] = await db.select({ total: sql<number>`COALESCE(SUM(${payments.amount}), 0)` }).from(payments)
          .innerJoin(salesOrders, eq(salesOrders.id, payments.referenceId))
          .where(sql`${payments.referenceType} = 'sale' AND ${salesOrders.buyerId} = ${b.id}`);
        const totalSales = Number(salesRes?.total  ?? 0);
        const totalPaid  = Number(paymentRes?.total ?? 0);
        return { ...b, totalSales, totalPaid, balance: totalSales - totalPaid };
      }));
      if (isMounted.current) setList(withBalances);
    } catch (err) { console.error('[BuyersScreen] fetch error:', err); }
    finally { if (isMounted.current) setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  const handleDelete = useCallback(async (id: number) => {
    try { await deleteBuyer(id); await fetchAll(); }
    catch (err) { Alert.alert('Error', String(err)); }
  }, [fetchAll]);

  const filtered         = query.trim() ? list.filter(b => b.name.toLowerCase().includes(query.toLowerCase()) || b.type.toLowerCase().includes(query.toLowerCase()) || (b.phone ?? '').includes(query)) : list;
  const totalOutstanding = list.reduce((sum, b) => sum + Math.max(b.balance, 0), 0);

  // IDs of buyers with balance > 0 — pre-checked in bill generator
  const outstandingIds   = list.filter(b => b.balance > 0).map(b => b.id);
  const outstandingCount = outstandingIds.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.gutter, paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchAll} tintColor={Colors.primary} colors={[Colors.primary]} />}>

        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg }}>
          <View>
            <Text style={{ fontSize: 36, fontWeight: '700', color: Colors.onSurface, letterSpacing: -0.8 }}>Buyers</Text>
            <Text style={{ fontSize: 15, color: Colors.onSurfaceVariant, marginTop: 4 }}>{list.length === 0 ? 'No buyers registered yet' : `${list.length} registered`}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('AddBuyer', {})} style={{ backgroundColor: Colors.secondary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: Colors.onSecondary, fontSize: 20, lineHeight: 24 }}>+</Text>
            <Text style={{ color: Colors.onSecondary, fontSize: 14, fontWeight: '600' }}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Summary card */}
        {list.length > 0 && (
          <View style={{ backgroundColor: Colors.secondary, borderRadius: 20, padding: Spacing.lg, marginBottom: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: `${Colors.onSecondary}99` }}>TOTAL RECEIVABLE</Text>
              <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.onSecondary, marginTop: 4 }}>₹{totalOutstanding.toLocaleString('en-IN')}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: `${Colors.onSecondary}99` }}>BUYERS</Text>
              <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.onSecondary, marginTop: 4 }}>{list.length}</Text>
            </View>
          </View>
        )}

        {/* ── Generate Invoices button ── */}
        {list.length > 0 && (
          <TouchableOpacity
            onPress={() => navigation.navigate('MultiStatementScreen', {
              type:           'buyer',
              title:          'Sales Invoices',
              preSelectedIds: outstandingIds,
            })}
            style={{
              backgroundColor: Colors.surfaceContainerLow, borderRadius: 14,
              paddingVertical: 13, marginBottom: Spacing.lg,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 10, borderWidth: 1, borderColor: Colors.outlineVariant,
            }}
          >
           <FileText
  size={20}
  color={Colors.onSurface}
  weight="fill"
/>
            <View>
              <Text style={{ color: Colors.onSurface, fontSize: 14, fontWeight: '600' }}>
                Generate Invoices — All Buyers
              </Text>
              <Text style={{
                fontSize: 12, marginTop: 1,
                color: outstandingCount > 0 ? Colors.error : Colors.secondary,
              }}>
                {outstandingCount > 0
                  ? `${outstandingCount} with outstanding balance pre-selected`
                  : 'All balances cleared ✓'}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Search */}
        {list.length > 0 && <SearchBar value={query} onChange={setQuery} placeholder="Search by name, type or phone…" />}

        {/* Loading */}
        {loading && list.length === 0 && <View style={{ alignItems: 'center', paddingTop: 60 }}><ActivityIndicator size="large" color={Colors.secondary} /></View>}

        {/* Empty state */}
        {!loading && list.length === 0 && (
          <View style={{ backgroundColor: Colors.surfaceContainerLow, borderRadius: 20, padding: Spacing.xxl, alignItems: 'center' }}>
            <Handshake
  size={56}
  color={Colors.primary}
  weight="fill"
  style={{ marginBottom: 16 }}
/>
            <Text style={{ fontSize: 18, fontWeight: '600', color: Colors.onSurface, marginBottom: 6 }}>No Buyers Yet</Text>
            <Text style={{ fontSize: 14, color: Colors.onSurfaceVariant, textAlign: 'center', lineHeight: 20 }}>Tap the Add button to register your first buyer.</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AddBuyer', {})} style={{ marginTop: Spacing.xl, backgroundColor: Colors.secondary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ color: Colors.onSecondary, fontSize: 15, fontWeight: '600' }}>+ Add First Buyer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* No search results */}
        {!loading && list.length > 0 && filtered.length === 0 && (
          <View style={{ backgroundColor: Colors.surfaceContainerLow, borderRadius: 16, padding: Spacing.xl, alignItems: 'center' }}>
            <MagnifyingGlass
  size={36}
  color={Colors.primary}
  weight="duotone"
  style={{ marginBottom: 12 }}
/>
            <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.onSurface, marginBottom: 6 }}>No Results</Text>
            <Text style={{ fontSize: 14, color: Colors.onSurfaceVariant, textAlign: 'center' }}>No buyer matches "{query}"</Text>
          </View>
        )}

        {/* List */}
        {filtered.map(item => (
          <BuyerCard key={item.id} item={item}
            onPress={() => navigation.navigate('BuyerDetail', { buyerId: item.id, name: item.name })}
            onEdit={() => navigation.navigate('AddBuyer', { buyerId: item.id })}
            onDelete={() => handleDelete(item.id)}
          />
        ))}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity onPress={() => navigation.navigate('AddBuyer', {})} style={{ position: 'absolute', bottom: 100, right: 24, width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: Colors.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 }}>
        <Text style={{ color: Colors.onSecondary, fontSize: 28, lineHeight: 32 }}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}