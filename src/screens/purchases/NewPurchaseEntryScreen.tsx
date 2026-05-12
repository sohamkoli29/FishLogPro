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
import {
  MagnifyingGlass,
  X,
  PencilSimple,
  Trash,
  Boat,
  Phone,
  FileText,
  Plus,
  CheckCircle,
  WarningCircle,
  Eye,
  EyeSlash,
  Fish,
  CalendarBlank,
  BoatIcon,
} from "phosphor-react-native";

import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { eq } from 'drizzle-orm';

import { RootStackParamList } from '../../types';
import { Colors, Spacing } from '../../utils/theme';
import { usePurchases, PurchaseItemInput } from '../../hooks/usePurchases';
import { db } from '../../db/client';
import { fishermen, fishNames } from '../../db/schema';

type RouteT = RouteProp<RootStackParamList, 'NewPurchaseEntry'>;

// ── Helpers ────────────────────────────────────────────────────
function todayString(): string {
  const d = new Date();
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
type Unit = typeof UNITS[number];

// ── Empty fish row ─────────────────────────────────────────────
function emptyRow(): PurchaseItemInput & { id: string } {
  return {
    id:           Math.random().toString(36).slice(2),
    fishName:     '',
    quantity:     0,
    unit:         'kg',
    pricePerUnit: 0,
  };
}

type Row = PurchaseItemInput & { id: string };

// ── Fisherman Search Picker ────────────────────────────────────
function FishermanSearchPicker({
  fishermenList,
  selectedId,
  onSelect,
}: {
  fishermenList: { id: number; name: string; boatName: string }[];
  selectedId:    number | null;
  onSelect:      (id: number) => void;
}) {
  const [query,        setQuery]        = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const selected = fishermenList.find(f => f.id === selectedId);

  const filtered = query.trim().length > 0
    ? fishermenList.filter(f =>
        f.name.toLowerCase().includes(query.toLowerCase()) ||
        f.boatName.toLowerCase().includes(query.toLowerCase())
      )
    : fishermenList;

  const handleSelect = (f: { id: number; name: string; boatName: string }) => {
    onSelect(f.id);
    setQuery(f.name);
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
    ? Colors.primary
    : showDropdown ? Colors.primary : Colors.outlineVariant;

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
        <MagnifyingGlass
  size={18}
  color={Colors.onSurfaceVariant}
  weight="bold"
/>
        <TextInput
          style={{ flex: 1, fontSize: 15, color: Colors.onSurface, padding: 0 }}
          placeholder="Search fisherman by name or boat…"
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
            <X
  size={16}
  color={Colors.outline}
  weight="bold"
/>
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
          backgroundColor: Colors.primaryFixed,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 8,
          marginBottom: Spacing.md,
          marginTop: 4,
        }}>
          <BoatIcon
  size={16}
  color={Colors.outline}
  weight="bold"
/>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.onPrimaryFixed }}>
              {selected.name}
            </Text>
            <Text style={{ fontSize: 12, color: Colors.onPrimaryFixedVariant }}>
              {selected.boatName}
            </Text>
          </View>
          <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.primary }}>✓ Selected</Text>
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
          {fishermenList.length === 0 ? (
            <View style={{ padding: Spacing.md }}>
              <Text style={{ fontSize: 14, color: Colors.outline }}>
                No fishermen found. Add one first.
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
              {filtered.map((f, idx) => {
                const isSelected = selectedId === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    onPress={() => handleSelect(f)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      padding: Spacing.md,
                      borderBottomWidth: idx < filtered.length - 1 ? 1 : 0,
                      borderBottomColor: Colors.outlineVariant,
                      backgroundColor: isSelected ? Colors.primaryFixed : Colors.surfaceContainerLowest,
                    }}
                  >
                    {/* Avatar initials */}
                    <View style={{
                      width: 38, height: 38, borderRadius: 19,
                      backgroundColor: isSelected ? Colors.primary : Colors.surfaceContainerHigh,
                      justifyContent: 'center', alignItems: 'center', flexShrink: 0,
                    }}>
                      <Text style={{
                        fontSize: 13, fontWeight: '700',
                        color: isSelected ? Colors.onPrimary : Colors.onSurfaceVariant,
                      }}>
                        {f.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: 15, fontWeight: '600',
                        color: isSelected ? Colors.onPrimaryFixed : Colors.onSurface,
                      }}>
                        {f.name}
                      </Text>
                      <Text style={{
                        fontSize: 12,
                        color: isSelected ? Colors.onPrimaryFixedVariant : Colors.onSurfaceVariant,
                      }}>
                        <Boat
  size={16}
  color={Colors.outline}
  weight="bold"
/> {f.boatName}
                      </Text>
                    </View>
                    {isSelected && (
                      <Text style={{ fontSize: 16, color: Colors.primary }}>✓</Text>
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

// ── Fish row component ─────────────────────────────────────────
function FishRow({
  row,
  index,
  suggestions,
  pricesVisible,
  onChange,
  onRemove,
  canRemove,
}: {
  row:           Row;
  index:         number;
  suggestions:   string[];
  pricesVisible: boolean;
  onChange:      (id: string, field: keyof PurchaseItemInput, value: any) => void;
  onRemove:      (id: string) => void;
  canRemove:     boolean;
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
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
      }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.onSurfaceVariant, letterSpacing: 0.5 }}>
          ITEM {index + 1}
        </Text>
        {canRemove && (
          <TouchableOpacity onPress={() => onRemove(row.id)}>
            <X
  size={16}
  color={Colors.outline}
  weight="bold"
/>
          </TouchableOpacity>
        )}
      </View>

      <Text style={{ fontSize: 11, color: Colors.onSurfaceVariant, marginBottom: 4, fontWeight: '600' }}>
        FISH NAME
      </Text>
      <View style={{ position: 'relative', marginBottom: Spacing.sm }}>
        <TextInput
          style={inputStyle}
          placeholder="e.g. Rohu, Surmai..."
          placeholderTextColor={Colors.outline}
          value={row.fishName}
          onChangeText={(v) => { onChange(row.id, 'fishName', v); setShowSuggestions(true); }}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          autoCapitalize="words"
        />
        {showSuggestions && filtered.length > 0 && (
          <View style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            backgroundColor: Colors.surfaceContainerLowest,
            borderRadius: 8, borderWidth: 1, borderColor: Colors.outlineVariant,
            zIndex: 999, maxHeight: 140, elevation: 8,
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1, shadowRadius: 4,
          }}>
            {filtered.slice(0, 5).map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => { onChange(row.id, 'fishName', s); setShowSuggestions(false); }}
                style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant }}
              >
                <Text style={{ fontSize: 14, color: Colors.onSurface }}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: Colors.onSurfaceVariant, marginBottom: 4, fontWeight: '600' }}>QUANTITY</Text>
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
          <Text style={{ fontSize: 11, color: Colors.onSurfaceVariant, marginBottom: 4, fontWeight: '600' }}>UNIT</Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {UNITS.map((u) => (
              <TouchableOpacity
                key={u}
                onPress={() => onChange(row.id, 'unit', u)}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1,
                  borderColor: row.unit === u ? Colors.primary : Colors.outlineVariant,
                  backgroundColor: row.unit === u ? Colors.primaryFixed : Colors.surfaceContainerLowest,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '600', color: row.unit === u ? Colors.onPrimaryFixed : Colors.outline }}>
                  {u}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: Colors.onSurfaceVariant, marginBottom: 4, fontWeight: '600' }}>
            PRICE / {row.unit.toUpperCase()}
          </Text>
          <View style={{ position: 'relative' }}>
            <TextInput
              style={[inputStyle, !pricesVisible && { color: 'transparent', backgroundColor: Colors.surfaceContainerHigh }]}
              placeholder="0.00"
              placeholderTextColor={Colors.outline}
              value={row.pricePerUnit === 0 ? '' : String(row.pricePerUnit)}
              onChangeText={(v) => onChange(row.id, 'pricePerUnit', parseFloat(v) || 0)}
              keyboardType="decimal-pad"
              secureTextEntry={!pricesVisible}
            />
            {!pricesVisible && (
              <View style={{ position: 'absolute', inset: 0, justifyContent: 'center', paddingHorizontal: 10 }}>
                <Text style={{ fontSize: 14, color: Colors.outline, letterSpacing: 4 }}>••••</Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: Colors.onSurfaceVariant, marginBottom: 4, fontWeight: '600' }}>TOTAL</Text>
          <View style={{
            backgroundColor: total > 0 ? Colors.primaryFixed : Colors.surfaceContainer,
            borderRadius: 8, paddingHorizontal: 10, paddingVertical: 11, justifyContent: 'center',
          }}>
            {pricesVisible ? (
              <Text style={{ fontSize: 14, fontWeight: '700', color: total > 0 ? Colors.onPrimaryFixed : Colors.outline }}>
                ₹{total.toLocaleString('en-IN')}
              </Text>
            ) : (
              <Text style={{ fontSize: 14, color: Colors.outline, letterSpacing: 4 }}>••••</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────
export default function NewPurchaseEntryScreen() {
  const navigation  = useNavigation();
  const route       = useRoute<RouteT>();
  const { createEntry } = usePurchases();

  const [fishermenList,       setFishermenList]       = useState<{ id: number; name: string; boatName: string }[]>([]);
  const [fishSuggestions,     setFishSuggestions]     = useState<string[]>([]);
  const [selectedFishermenId, setSelectedFishermenId] = useState<number | null>(
    route.params?.fishermenId ?? null
  );
  const [date,          setDate]          = useState(todayString());
  const [rows,          setRows]          = useState<Row[]>([emptyRow()]);
  const [notes,         setNotes]         = useState('');
  const [pricesVisible, setPricesVisible] = useState(false);
  const [saving,        setSaving]        = useState(false);

  useEffect(() => {
    db.select({ id: fishermen.id, name: fishermen.name, boatName: fishermen.boatName })
      .from(fishermen)
      .then(setFishermenList)
      .catch(console.error);

    db.select({ name: fishNames.name })
      .from(fishNames)
      .then((rows: { name: string }[]) => setFishSuggestions(rows.map((r) => r.name)))
      .catch(console.error);
  }, []);

  const updateRow = useCallback(
    (id: string, field: keyof PurchaseItemInput, value: any) => {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    },
    []
  );

  const addRow    = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const grandTotal = rows.reduce((sum, r) => sum + r.quantity * r.pricePerUnit, 0);

  const validate = (): string | null => {
    if (!selectedFishermenId)  return 'Please select a fisherman.';
    if (!date)                 return 'Please select a date.';
    if (rows.length === 0)     return 'Add at least one fish item.';
    for (const r of rows) {
      if (!r.fishName.trim())  return 'Fish name cannot be empty.';
      if (r.quantity <= 0)     return `Quantity must be > 0 for ${r.fishName || 'item'}.`;
      if (r.pricePerUnit <= 0) return `Price must be > 0 for ${r.fishName || 'item'}.`;
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { Alert.alert('Validation Error', err); return; }
    try {
      setSaving(true);
      const entryId = await createEntry(
        selectedFishermenId!,
        date,
        rows.map(({ id, ...rest }) => rest),
        notes.trim() || undefined
      );
      console.log('✅ Purchase entry created:', entryId);
      await new Promise((r) => setTimeout(r, 100));
      navigation.goBack();
    } catch (err) {
      console.error('❌ Create entry error:', err);
      Alert.alert('Error', String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface }} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: Spacing.gutter, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {/* ── Page header ── */}
          <View style={{ marginBottom: Spacing.xl }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.primary, letterSpacing: -0.5 }}>
              New Purchase Entry
            </Text>
            <Text style={{ fontSize: 14, color: Colors.onSurfaceVariant, marginTop: 4 }}>
              Document the day's catch with precision.
            </Text>
          </View>

          {/* ── Fisherman + Date ── */}
          <View style={{
            backgroundColor: Colors.surfaceContainerLow,
            borderRadius: 16, padding: Spacing.md, marginBottom: Spacing.md,
          }}>
            <Text style={{
              fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
              color: Colors.onSurfaceVariant, marginBottom: Spacing.sm,
              textTransform: 'uppercase',
            }}>
              Fisherman
            </Text>

            <FishermanSearchPicker
              fishermenList={fishermenList}
              selectedId={selectedFishermenId}
              onSelect={setSelectedFishermenId}
            />

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
            <View
  style={{
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  }}
>
  <CalendarBlank
    size={14}
    color={Colors.onSurfaceVariant}
    weight="bold"
  />

  <Text
    style={{
      fontSize: 12,
      color: Colors.onSurfaceVariant,
    }}
  >
    {formatDisplay(date)}
  </Text>
</View>
          </View>

          {/* ── Fish items ── */}
          <View style={{
            backgroundColor: Colors.surfaceContainerLow,
            borderRadius: 16, padding: Spacing.md, marginBottom: Spacing.md,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.onSurface }}>
                Catch Inventory
              </Text>
             <TouchableOpacity
  onPress={() => setPricesVisible(!pricesVisible)}
  style={{
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: pricesVisible
      ? Colors.primaryFixed
      : Colors.surfaceContainer,
    borderRadius: 8,
  }}
>
  {pricesVisible ? (
    <EyeSlash
      size={16}
      color={
        pricesVisible
          ? Colors.onPrimaryFixed
          : Colors.outline
      }
      weight="bold"
    />
  ) : (
    <Eye
      size={16}
      color={
        pricesVisible
          ? Colors.onPrimaryFixed
          : Colors.outline
      }
      weight="bold"
    />
  )}

  <Text
    style={{
      fontSize: 13,
      fontWeight: '600',
      color: pricesVisible
        ? Colors.onPrimaryFixed
        : Colors.outline,
    }}
  >
    {pricesVisible ? 'Hide Prices' : 'Show Prices'}
  </Text>
</TouchableOpacity>
            </View>

            {rows.map((row, index) => (
              <FishRow
                key={row.id}
                row={row}
                index={index}
                suggestions={fishSuggestions}
                pricesVisible={pricesVisible}
                onChange={updateRow}
                onRemove={removeRow}
                canRemove={rows.length > 1}
              />
            ))}

            <TouchableOpacity
              onPress={addRow}
              style={{
                borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.outlineVariant,
                borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.sm,
              }}
            >
              <Text style={{ fontSize: 14, color: Colors.primary, fontWeight: '600' }}>+ Add Fish Item</Text>
            </TouchableOpacity>
          </View>

          {/* ── Notes ── */}
          <View style={{
            backgroundColor: Colors.surfaceContainerLow,
            borderRadius: 16, padding: Spacing.md, marginBottom: Spacing.md,
          }}>
            <Text style={{
              fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
              color: Colors.onSurfaceVariant, marginBottom: Spacing.sm, textTransform: 'uppercase',
            }}>
              Notes (Optional)
            </Text>
            <TextInput
              style={{
                backgroundColor: Colors.surfaceContainerLowest,
                borderRadius: 10, borderWidth: 1, borderColor: Colors.outlineVariant,
                paddingHorizontal: Spacing.md, paddingVertical: 12,
                fontSize: 14, color: Colors.onSurface, minHeight: 80, textAlignVertical: 'top',
              }}
              placeholder="Any special notes about this catch..."
              placeholderTextColor={Colors.outline}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>

          {/* ── Total bar ── */}
          <View style={{
            backgroundColor: Colors.primary, borderRadius: 16, padding: Spacing.lg,
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg,
          }}>
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: `${Colors.onPrimary}99` }}>
                SUBTOTAL • {rows.length} ITEM{rows.length !== 1 ? 'S' : ''}
              </Text>
              {pricesVisible ? (
                <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.onPrimary, marginTop: 4 }}>
                  ₹{grandTotal.toLocaleString('en-IN')}
                </Text>
              ) : (
                <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.onPrimary, marginTop: 4, letterSpacing: 6 }}>
                  ••••••
                </Text>
              )}
            </View>
          <Fish
  size={40}
  color={Colors.onPrimary}
  weight="fill"
/>
          </View>

          {/* ── Save button ── */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={{
              backgroundColor: saving ? Colors.outlineVariant : Colors.primary,
              borderRadius: 14, paddingVertical: 16,
              alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
            }}
          >
            {saving && <ActivityIndicator size="small" color={Colors.onPrimary} />}
            <Text style={{ color: Colors.onPrimary, fontSize: 16, fontWeight: '700' }}>
              {saving ? 'Saving Entry…' : 'Save Purchase Entry'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}