import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

import { RootStackParamList } from '../../types';
import { Colors, Spacing } from '../../utils/theme';
import { useSales, SalesItemInput, OrderStatus } from '../../hooks/useSales';
import { db } from '../../db/client';
import { buyers, fishNames } from '../../db/schema';

type RouteT = RouteProp<RootStackParamList, 'NewSalesOrder'>;
type BuyerType = { id: number; name: string; type: string };

// ── Helpers ────────────────────────────────────────────────────
function todayString(): string {
  const d    = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const [yyyy, mm, dd] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${dd} ${months[parseInt(mm) - 1]} ${yyyy}`;
}

const UNITS = ['kg', 'lbs', 'pcs', 'crate'] as const;
type Unit   = typeof UNITS[number];

const STATUS_OPTIONS: {
  key:   OrderStatus;
  label: string;
  icon:  string;
  bg:    string;
  color: string;
}[] = [
  { key: 'pending',  label: 'Pending',  icon: '⏳', bg: Colors.primaryFixed,     color: Colors.onPrimaryFixed     },
  { key: 'partial',  label: 'Partial',  icon: '🔄', bg: Colors.secondaryContainer, color: Colors.onSecondaryContainer },
  { key: 'complete', label: 'Complete', icon: '✅', bg: Colors.tertiaryFixed,     color: Colors.onTertiaryFixedVariant },
];

// ── Empty row ──────────────────────────────────────────────────
function emptyRow(): SalesItemInput & { id: string } {
  return {
    id:           Math.random().toString(36).slice(2),
    fishName:     '',
    quantity:     0,
    unit:         'kg',
    pricePerUnit: 0,
  };
}

type Row = SalesItemInput & { id: string };

// ── Buyer Search Picker ────────────────────────────────────────
function BuyerSearchPicker({
  buyerList,
  selectedId,
  onSelect,
}: {
  buyerList: BuyerType[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const selected = buyerList.find(b => b.id === selectedId);

  const filtered = query.trim().length > 0
    ? buyerList.filter(b =>
        b.name.toLowerCase().includes(query.toLowerCase()) ||
        b.type.toLowerCase().includes(query.toLowerCase())
      )
    : buyerList;

  const handleSelect = (b: BuyerType) => {
    onSelect(b.id);
    setQuery(b.name);
    setShowDropdown(false);
  };

  const handleFocus = () => {
    setQuery('');
    setShowDropdown(true);
  };

  const handleBlur = () => {
    setTimeout(() => {
      setShowDropdown(false);
      if (selected) setQuery(selected.name);
      else setQuery('');
    }, 180);
  };

  const inputBorderColor = selectedId
    ? Colors.secondary
    : showDropdown ? Colors.secondary : Colors.outlineVariant;

  return (
    <View style={{ position: 'relative', zIndex: 100 }}>
      {/* Search input */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surfaceContainerLowest,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: inputBorderColor,
        paddingHorizontal: Spacing.md,
        paddingVertical: 12,
        gap: 8,
        marginBottom: 4,
      }}>
        <Text style={{ fontSize: 16 }}>🔍</Text>
        <TextInput
          style={{ flex: 1, fontSize: 15, color: Colors.onSurface, padding: 0 }}
          placeholder="Search buyer by name or type…"
          placeholderTextColor={Colors.outline}
          value={query}
          onChangeText={(text) => { setQuery(text); setShowDropdown(true); }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoCapitalize="words"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setShowDropdown(true); }}>
            <Text style={{ fontSize: 15, color: Colors.outline }}>✕</Text>
          </TouchableOpacity>
        )}
        {!showDropdown && (
          <Text style={{ fontSize: 13, color: Colors.outline }}>{showDropdown ? '▲' : '▼'}</Text>
        )}
      </View>

      {/* Selected badge — shown when not in dropdown mode */}
      {selectedId && !showDropdown && selected && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: Colors.secondaryContainer,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 8,
          marginBottom: Spacing.md,
          marginTop: 4,
        }}>
          <Text style={{ fontSize: 18 }}>🤝</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.onSecondaryContainer }}>
              {selected.name}
            </Text>
            <Text style={{ fontSize: 12, color: Colors.onSecondaryContainer }}>
              {selected.type.charAt(0).toUpperCase() + selected.type.slice(1)}
            </Text>
          </View>
          <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.secondary }}>✓ Selected</Text>
        </View>
      )}

      {/* Spacer when no selection and no dropdown */}
      {!selectedId && !showDropdown && (
        <View style={{ marginBottom: Spacing.md }} />
      )}

      {/* Dropdown results */}
      {showDropdown && (
        <View style={{
          backgroundColor: Colors.surfaceContainerLowest,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: Colors.outlineVariant,
          marginBottom: Spacing.md,
          marginTop: 2,
          overflow: 'hidden',
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12,
          shadowRadius: 6,
          maxHeight: 240,
        }}>
          {buyerList.length === 0 ? (
            <View style={{ padding: Spacing.md }}>
              <Text style={{ fontSize: 14, color: Colors.outline }}>
                No buyers found. Add one first.
              </Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={{ padding: Spacing.md }}>
              <Text style={{ fontSize: 14, color: Colors.outline }}>
                No match for "{query}"
              </Text>
            </View>
          ) : (
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {filtered.map((b, idx) => {
                const isSelected = selectedId === b.id;
                return (
                  <TouchableOpacity
                    key={b.id}
                    onPress={() => handleSelect(b)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      padding: Spacing.md,
                      borderBottomWidth: idx < filtered.length - 1 ? 1 : 0,
                      borderBottomColor: Colors.outlineVariant,
                      backgroundColor: isSelected ? Colors.secondaryContainer : Colors.surfaceContainerLowest,
                    }}
                  >
                    {/* Avatar initials */}
                    <View style={{
                      width: 38, height: 38, borderRadius: 19,
                      backgroundColor: isSelected ? Colors.secondary : Colors.surfaceContainerHigh,
                      justifyContent: 'center', alignItems: 'center', flexShrink: 0,
                    }}>
                      <Text style={{
                        fontSize: 13, fontWeight: '700',
                        color: isSelected ? Colors.onSecondary : Colors.onSurfaceVariant,
                      }}>
                        {b.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: 15, fontWeight: '600',
                        color: isSelected ? Colors.onSecondaryContainer : Colors.onSurface,
                      }}>
                        {b.name}
                      </Text>
                      <Text style={{
                        fontSize: 12,
                        color: isSelected ? Colors.onSecondaryContainer : Colors.onSurfaceVariant,
                      }}>
                        {b.type.charAt(0).toUpperCase() + b.type.slice(1)}
                      </Text>
                    </View>
                    {isSelected && (
                      <Text style={{ fontSize: 16, color: Colors.secondary }}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

// ── Sales item row ─────────────────────────────────────────────
function SalesRow({
  row,
  index,
  suggestions,
  onChange,
  onRemove,
  canRemove,
}: {
  row:         Row;
  index:       number;
  suggestions: string[];
  onChange:    (id: string, field: keyof SalesItemInput, value: any) => void;
  onRemove:    (id: string) => void;
  canRemove:   boolean;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filtered = suggestions.filter(
    (s) =>
      row.fishName.length > 0 &&
      s.toLowerCase().includes(row.fishName.toLowerCase()) &&
      s.toLowerCase() !== row.fishName.toLowerCase()
  );

  const total = row.quantity * row.pricePerUnit;

  const inputStyle = {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.onSurface,
  };

  return (
    <View style={{
      backgroundColor: Colors.surfaceContainerLowest,
      borderRadius: 14,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: Colors.outlineVariant,
    }}>
      {/* Row header */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
      }}>
        <Text style={{
          fontSize: 11, fontWeight: '700',
          color: Colors.onSurfaceVariant, letterSpacing: 0.5,
        }}>
          ITEM {index + 1}
        </Text>
        {canRemove && (
          <TouchableOpacity onPress={() => onRemove(row.id)}>
            <Text style={{ fontSize: 18, color: Colors.error }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Fish name */}
      <Text style={{
        fontSize: 11, color: Colors.onSurfaceVariant,
        marginBottom: 4, fontWeight: '600',
      }}>
        FISH NAME
      </Text>
      <View style={{ position: 'relative', marginBottom: Spacing.sm }}>
        <TextInput
          style={inputStyle}
          placeholder="e.g. Rohu, Surmai..."
          placeholderTextColor={Colors.outline}
          value={row.fishName}
          onChangeText={(v) => {
            onChange(row.id, 'fishName', v);
            setShowSuggestions(true);
          }}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          autoCapitalize="words"
        />
        {/* Autocomplete */}
        {showSuggestions && filtered.length > 0 && (
          <View style={{
            position: 'absolute',
            top: '100%', left: 0, right: 0,
            backgroundColor: Colors.surfaceContainerLowest,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: Colors.outlineVariant,
            zIndex: 999,
            maxHeight: 140,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
          }}>
            {filtered.slice(0, 5).map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => {
                  onChange(row.id, 'fishName', s);
                  setShowSuggestions(false);
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: Colors.outlineVariant,
                }}
              >
                <Text style={{ fontSize: 14, color: Colors.onSurface }}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Quantity + Unit */}
      <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 11, color: Colors.onSurfaceVariant,
            marginBottom: 4, fontWeight: '600',
          }}>
            QUANTITY
          </Text>
          <TextInput
            style={inputStyle}
            placeholder="0"
            placeholderTextColor={Colors.outline}
            value={row.quantity === 0 ? '' : String(row.quantity)}
            onChangeText={(v) => onChange(row.id, 'quantity', parseFloat(v) || 0)}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 11, color: Colors.onSurfaceVariant,
            marginBottom: 4, fontWeight: '600',
          }}>
            UNIT
          </Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {UNITS.map((u) => (
              <TouchableOpacity
                key={u}
                onPress={() => onChange(row.id, 'unit', u)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: row.unit === u ? Colors.secondary : Colors.outlineVariant,
                  backgroundColor: row.unit === u
                    ? Colors.secondaryContainer
                    : Colors.surfaceContainerLowest,
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  fontSize: 11, fontWeight: '600',
                  color: row.unit === u
                    ? Colors.onSecondaryContainer
                    : Colors.outline,
                }}>
                  {u}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Price + Total */}
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 11, color: Colors.onSurfaceVariant,
            marginBottom: 4, fontWeight: '600',
          }}>
            PRICE / {row.unit.toUpperCase()}
          </Text>
          <TextInput
            style={inputStyle}
            placeholder="0.00"
            placeholderTextColor={Colors.outline}
            value={row.pricePerUnit === 0 ? '' : String(row.pricePerUnit)}
            onChangeText={(v) => onChange(row.id, 'pricePerUnit', parseFloat(v) || 0)}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 11, color: Colors.onSurfaceVariant,
            marginBottom: 4, fontWeight: '600',
          }}>
            TOTAL
          </Text>
          <View style={{
            backgroundColor: total > 0 ? Colors.secondaryContainer : Colors.surfaceContainer,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 11,
            justifyContent: 'center',
          }}>
            <Text style={{
              fontSize: 14, fontWeight: '700',
              color: total > 0 ? Colors.onSecondaryContainer : Colors.outline,
            }}>
              {total > 0 ? `₹${total.toLocaleString('en-IN')}` : '—'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────
export default function NewSalesOrderScreen() {
  const navigation    = useNavigation();
  const route         = useRoute<RouteT>();
  const { createOrder } = useSales();

  const [buyerList, setBuyerList] = useState<BuyerType[]>([]);
  const [fishSuggestions, setFishSuggestions] = useState<string[]>([]);

  const [selectedBuyerId, setSelectedBuyerId] = useState<number | null>(
    route.params?.buyerId ?? null
  );
  const [date,   setDate]   = useState(todayString());
  const [status, setStatus] = useState<OrderStatus>('pending');
  const [rows,   setRows]   = useState<Row[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);

  // Load buyers + fish suggestions
  useEffect(() => {
    db.select({ id: buyers.id, name: buyers.name, type: buyers.type })
      .from(buyers)
      .then(setBuyerList)
      .catch(console.error);

    db.select({ name: fishNames.name })
      .from(fishNames)
      .then((rows: { name: string }[]) =>
        setFishSuggestions(rows.map((r) => r.name))
      )
      .catch(console.error);
  }, []);

  // ── Row operations ──
  const updateRow = useCallback(
    (id: string, field: keyof SalesItemInput, value: any) => {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
      );
    },
    []
  );

  const addRow    = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (id: string) =>
    setRows((prev) => prev.filter((r) => r.id !== id));

  // ── Grand total ──
  const grandTotal = rows.reduce(
    (sum, r) => sum + r.quantity * r.pricePerUnit,
    0
  );

  // ── Validation ──
  const validate = (): string | null => {
    if (!selectedBuyerId)      return 'Please select a buyer.';
    if (!date)                 return 'Please enter a date.';
    if (rows.length === 0)     return 'Add at least one item.';
    for (const r of rows) {
      if (!r.fishName.trim())  return 'Fish name cannot be empty.';
      if (r.quantity <= 0)     return `Quantity must be > 0 for ${r.fishName || 'item'}.`;
      if (r.pricePerUnit <= 0) return `Price must be > 0 for ${r.fishName || 'item'}.`;
    }
    return null;
  };

  // ── Submit ──
  const handleSave = async () => {
    const err = validate();
    if (err) { Alert.alert('Validation Error', err); return; }

    try {
      setSaving(true);
      const orderId = await createOrder(
        selectedBuyerId!,
        date,
        status,
        rows.map(({ id, ...rest }) => rest)
      );
      console.log('✅ Sales order created:', orderId);
      await new Promise((r) => setTimeout(r, 100));
      (navigation as any).replace('OrderDetail', { orderId });
    } catch (err) {
      console.error('❌ Create order error:', err);
      Alert.alert('Error', String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface }} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: Spacing.gutter, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {/* ── Header ── */}
          <View style={{ marginBottom: Spacing.xl }}>
            <Text style={{
              fontSize: 28, fontWeight: '700',
              color: Colors.secondary, letterSpacing: -0.5,
            }}>
              New Sales Order
            </Text>
            <Text style={{ fontSize: 14, color: Colors.onSurfaceVariant, marginTop: 4 }}>
              Record a sale to one of your buyers.
            </Text>
          </View>

          {/* ── Buyer + Date ── */}
          <View style={{
            backgroundColor: Colors.surfaceContainerLow,
            borderRadius: 16,
            padding: Spacing.md,
            marginBottom: Spacing.md,
          }}>
            {/* Buyer search picker */}
            <Text style={{
              fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
              color: Colors.onSurfaceVariant, marginBottom: Spacing.sm,
              textTransform: 'uppercase',
            }}>
              Buyer
            </Text>

            <BuyerSearchPicker
              buyerList={buyerList}
              selectedId={selectedBuyerId}
              onSelect={setSelectedBuyerId}
            />

            {/* Date */}
            <Text style={{
              fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
              color: Colors.onSurfaceVariant, marginBottom: Spacing.sm,
              textTransform: 'uppercase',
            }}>
              Date
            </Text>
            <View style={{
              backgroundColor: Colors.surfaceContainerLowest,
              borderRadius: 10, borderWidth: 1, borderColor: Colors.outlineVariant, overflow: 'hidden',
            }}>
              <TextInput
                style={{ paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 15, color: Colors.onSurface }}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.outline}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
            <Text style={{ fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 4 }}>
              📅 {formatDisplay(date)}
            </Text>
          </View>

          {/* ── Order status ── */}
          <View style={{
            backgroundColor: Colors.surfaceContainerLow,
            borderRadius: 16,
            padding: Spacing.md,
            marginBottom: Spacing.md,
          }}>
            <Text style={{
              fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
              color: Colors.onSurfaceVariant, marginBottom: Spacing.sm,
              textTransform: 'uppercase',
            }}>
              Order Status
            </Text>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              {STATUS_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => setStatus(s.key)}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: status === s.key ? Colors.secondary : Colors.outlineVariant,
                    backgroundColor: status === s.key ? s.bg : Colors.surfaceContainerLowest,
                    gap: 4,
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{s.icon}</Text>
                  <Text style={{
                    fontSize: 11, fontWeight: '700',
                    color: status === s.key ? s.color : Colors.outline,
                  }}>
                    {s.label.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Items ── */}
          <View style={{
            backgroundColor: Colors.surfaceContainerLow,
            borderRadius: 16,
            padding: Spacing.md,
            marginBottom: Spacing.md,
          }}>
            <Text style={{
              fontSize: 15, fontWeight: '700',
              color: Colors.onSurface, marginBottom: Spacing.md,
            }}>
              Inventory Items
            </Text>

            {rows.map((row, index) => (
              <SalesRow
                key={row.id}
                row={row}
                index={index}
                suggestions={fishSuggestions}
                onChange={updateRow}
                onRemove={removeRow}
                canRemove={rows.length > 1}
              />
            ))}

            <TouchableOpacity
              onPress={addRow}
              style={{
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: Colors.outlineVariant,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
                marginTop: Spacing.sm,
              }}
            >
              <Text style={{ fontSize: 14, color: Colors.secondary, fontWeight: '600' }}>
                + Add Item
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Total bar ── */}
          <View style={{
            backgroundColor: Colors.secondary,
            borderRadius: 16,
            padding: Spacing.lg,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: Spacing.lg,
          }}>
            <View>
              <Text style={{
                fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
                color: `${Colors.onSecondary}99`,
              }}>
                ORDER TOTAL • {rows.length} ITEM{rows.length !== 1 ? 'S' : ''}
              </Text>
              <Text style={{
                fontSize: 28, fontWeight: '700',
                color: Colors.onSecondary, marginTop: 4,
              }}>
                ₹{grandTotal.toLocaleString('en-IN')}
              </Text>
            </View>
            <Text style={{ fontSize: 40 }}>🤝</Text>
          </View>

          {/* ── Save ── */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={{
              backgroundColor: saving ? Colors.outlineVariant : Colors.secondary,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {saving && <ActivityIndicator size="small" color={Colors.onSecondary} />}
            <Text style={{ color: Colors.onSecondary, fontSize: 16, fontWeight: '700' }}>
              {saving ? 'Saving Order…' : 'Save Sales Order'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}