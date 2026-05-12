import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator, TextInput,
} from 'react-native';

import {
  MagnifyingGlass,
  X,
  Sailboat,
  Phone,
  PencilSimple,
  Trash,
  FileText,
} from "phosphor-react-native";


import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { eq, desc, sql } from 'drizzle-orm';

import { RootStackParamList } from '../../types';
import { Colors, Spacing } from '../../utils/theme';
import { db } from '../../db/client';
import { fishermen, purchaseEntries, payments, type Fisherman } from '../../db/schema';
import { useFishermen } from '../../hooks/useFishermen';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface FishermanWithBalance extends Fisherman {
  totalPurchases: number;
  totalPaid:      number;
  balance:        number;
}

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceContainerLow,
      borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: Spacing.md,
      gap: 8, borderWidth: 1, borderColor: value ? Colors.primary : Colors.outlineVariant,
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
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChange('')}>
          <X
  size={18}
  color={Colors.outline}
  weight="bold"
/>
        </TouchableOpacity>
      )}
    </View>
  );
}

function BalanceBadge({ balance }: { balance: number }) {
  const isCleared = balance === 0;
  const isOwed    = balance > 0;
  const bg    = isCleared ? Colors.primaryFixed   : isOwed ? Colors.errorContainer   : Colors.secondaryContainer;
  const color = isCleared ? Colors.onPrimaryFixed : isOwed ? Colors.onErrorContainer : Colors.onSecondaryContainer;
  const label = isCleared ? 'Cleared'             : isOwed ? 'Owes'                  : 'Advance';
  return (
    <View style={{ backgroundColor: bg, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color }}>{label}</Text>
    </View>
  );
}

function FishermanCard({
  item,
  onPress,
  onEdit,
  onDelete,
}: {
  item:     FishermanWithBalance;
  onPress:  () => void;
  onEdit:   () => void;
  onDelete: () => void;
}) {
  const initials = item.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const handleDelete = () =>
    Alert.alert(
      'Delete Fisherman',
      `Remove ${item.name} and all their records? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    );

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: Colors.surfaceContainerLowest, borderRadius: 16,
        padding: Spacing.md, marginBottom: Spacing.sm,
        borderWidth: 1, borderColor: Colors.outlineVariant,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
        <View style={{
          width: 52, height: 52, borderRadius: 26,
          backgroundColor: Colors.primaryFixed,
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.onPrimaryFixed }}>
            {initials}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.onSurface }}>
            {item.name}
          </Text>
          <Text style={{ fontSize: 13, color: Colors.onSurfaceVariant, marginTop: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
  <Sailboat
    size={13}
    color={Colors.onSurfaceVariant}
    weight="fill"
  />
  <Text style={{ fontSize: 13, color: Colors.onSurfaceVariant }}>
    {item.boatName}
  </Text>
</View>
          </Text>
          {item.phone ? (
            <Text style={{ fontSize: 12, color: Colors.outline, marginTop: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
  <Phone
    size={12}
    color={Colors.outline}
    weight="fill"
  />
  <Text style={{ fontSize: 12, color: Colors.outline }}>
    {item.phone}
  </Text>
</View>
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <BalanceBadge balance={item.balance} />
          {item.balance !== 0 && (
            <Text style={{
              fontSize: 15, fontWeight: '700',
              color: item.balance > 0 ? Colors.error : Colors.secondary,
            }}>
              ₹{Math.abs(item.balance).toLocaleString('en-IN')}
            </Text>
          )}
        </View>
      </View>
      <View style={{
        flexDirection: 'row', justifyContent: 'flex-end',
        gap: Spacing.sm, marginTop: Spacing.sm, paddingTop: Spacing.sm,
        borderTopWidth: 1, borderTopColor: Colors.outlineVariant,
      }}>
        <TouchableOpacity
          onPress={onEdit}
          style={{
            paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8,
            borderWidth: 1, borderColor: Colors.outlineVariant,
            backgroundColor: Colors.surfaceContainer,
          }}
        >
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
        <TouchableOpacity
          onPress={handleDelete}
          style={{
            paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8,
            borderWidth: 1, borderColor: `${Colors.error}30`,
            backgroundColor: `${Colors.error}0a`,
          }}
        >
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

export default function FishermenScreen() {
  const navigation                    = useNavigation<Nav>();
  const { deleteFisherman }           = useFishermen();
  const [list,    setList]            = React.useState<FishermanWithBalance[]>([]);
  const [loading, setLoading]         = React.useState(false);
  const [query,   setQuery]           = useState('');
  const isMounted                     = useRef(true);

  React.useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await db.select().from(fishermen).orderBy(desc(fishermen.createdAt));
      const withBalances: FishermanWithBalance[] = await Promise.all(
        rows.map(async f => {
          const [purchaseRes] = await db
            .select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` })
            .from(purchaseEntries)
            .where(eq(purchaseEntries.fishermenId, f.id));

          const [paymentRes] = await db
            .select({ total: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
            .from(payments)
            .innerJoin(purchaseEntries, eq(purchaseEntries.id, payments.referenceId))
            .where(
              sql`${payments.referenceType} = 'purchase' AND ${purchaseEntries.fishermenId} = ${f.id}`
            );

          const totalPurchases = Number(purchaseRes?.total ?? 0);
          const totalPaid      = Number(paymentRes?.total  ?? 0);
          return { ...f, totalPurchases, totalPaid, balance: totalPurchases - totalPaid };
        })
      );
      if (isMounted.current) setList(withBalances);
    } catch (err) {
      console.error('[FishermenScreen] fetch error:', err);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  // ── Uses hook so payments are cleaned up too ──
  const handleDelete = useCallback(async (id: number) => {
    try {
      await deleteFisherman(id);
      await fetchAll();
    } catch (err) {
      Alert.alert('Error', String(err));
    }
  }, [deleteFisherman, fetchAll]);

  const filtered         = query.trim()
    ? list.filter(f =>
        f.name.toLowerCase().includes(query.toLowerCase()) ||
        f.boatName.toLowerCase().includes(query.toLowerCase()) ||
        (f.phone ?? '').includes(query)
      )
    : list;

  const totalBalance     = list.reduce((sum, f) => sum + f.balance, 0);
  const outstandingIds   = list.filter(f => f.balance > 0).map(f => f.id);
  const outstandingCount = outstandingIds.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface }}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.gutter, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchAll}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between',
          alignItems: 'flex-start', marginBottom: Spacing.lg,
        }}>
          <View>
            <Text style={{
              fontSize: 36, fontWeight: '700',
              color: Colors.onSurface, letterSpacing: -0.8,
            }}>
              Fishermen
            </Text>
            <Text style={{ fontSize: 15, color: Colors.onSurfaceVariant, marginTop: 4 }}>
              {list.length === 0 ? 'No fishermen registered yet' : `${list.length} registered`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('AddFisherman', {})}
            style={{
              backgroundColor: Colors.primary, borderRadius: 12,
              paddingHorizontal: 16, paddingVertical: 10,
              flexDirection: 'row', alignItems: 'center', gap: 6,
            }}
          >
            <Text style={{ color: Colors.onPrimary, fontSize: 20, lineHeight: 24 }}>+</Text>
            <Text style={{ color: Colors.onPrimary, fontSize: 14, fontWeight: '600' }}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Summary card */}
        {list.length > 0 && (
          <View style={{
            backgroundColor: Colors.primary, borderRadius: 20,
            padding: Spacing.lg, marginBottom: Spacing.md,
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <View>
              <Text style={{
                fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
                color: `${Colors.onPrimary}99`,
              }}>
                TOTAL OUTSTANDING
              </Text>
              <Text style={{
                fontSize: 28, fontWeight: '700',
                color: Colors.onPrimary, marginTop: 4,
              }}>
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
              <Text style={{
                fontSize: 28, fontWeight: '700',
                color: Colors.onPrimary, marginTop: 4,
              }}>
                {list.length}
              </Text>
            </View>
          </View>
        )}

        {/* Generate Bills button */}
        {list.length > 0 && (
          <TouchableOpacity
            onPress={() => navigation.navigate('MultiStatementScreen', {
              type:           'fisherman',
              title:          'Purchase Bills',
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
                Generate Bills — All Fishermen
              </Text>
              <Text style={{
                fontSize: 12, marginTop: 1,
                color: outstandingCount > 0 ? Colors.error : Colors.primary,
              }}>
                {outstandingCount > 0
                  ? `${outstandingCount} with outstanding balance pre-selected`
                  : 'All balances cleared ✓'}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Search */}
        {list.length > 0 && (
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Search by name, boat or phone…"
          />
        )}

        {/* Loading */}
        {loading && list.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}

        {/* Empty state */}
        {!loading && list.length === 0 && (
          <View style={{
            backgroundColor: Colors.surfaceContainerLow,
            borderRadius: 20, padding: Spacing.xxl, alignItems: 'center',
          }}>
            <Sailboat
  size={56}
  color={Colors.primary}
  weight="duotone"
  style={{ marginBottom: 16 }}
/>
            <Text style={{
              fontSize: 18, fontWeight: '600',
              color: Colors.onSurface, marginBottom: 6,
            }}>
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
                marginTop: Spacing.xl, backgroundColor: Colors.primary,
                borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12,
              }}
            >
              <Text style={{ color: Colors.onPrimary, fontSize: 15, fontWeight: '600' }}>
                + Add First Fisherman
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* No search results */}
        {!loading && list.length > 0 && filtered.length === 0 && (
          <View style={{
            backgroundColor: Colors.surfaceContainerLow,
            borderRadius: 16, padding: Spacing.xl, alignItems: 'center',
          }}>
            <MagnifyingGlass
  size={36}
  color={Colors.primary}
  weight="duotone"
  style={{ marginBottom: 12 }}
/>
            <Text style={{
              fontSize: 16, fontWeight: '600',
              color: Colors.onSurface, marginBottom: 6,
            }}>
              No Results
            </Text>
            <Text style={{
              fontSize: 14, color: Colors.onSurfaceVariant, textAlign: 'center',
            }}>
              No fisherman matches "{query}"
            </Text>
          </View>
        )}

        {/* List */}
        {filtered.map(item => (
          <FishermanCard
            key={item.id}
            item={item}
            onPress={() => navigation.navigate('FishermanDetail', {
              fishermenId: item.id, name: item.name,
            })}
            onEdit={() => navigation.navigate('AddFisherman', { fishermenId: item.id })}
            onDelete={() => handleDelete(item.id)}
          />
        ))}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        onPress={() => navigation.navigate('AddFisherman', {})}
        style={{
          position: 'absolute', bottom: 100, right: 24,
          width: 56, height: 56, borderRadius: 16,
          backgroundColor: Colors.primary,
          justifyContent: 'center', alignItems: 'center',
          elevation: 8, shadowColor: Colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35, shadowRadius: 10,
        }}
      >
        <Text style={{ color: Colors.onPrimary, fontSize: 28, lineHeight: 32 }}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}