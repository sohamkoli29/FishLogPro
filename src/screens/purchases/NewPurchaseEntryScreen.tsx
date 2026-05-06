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
      <Text style={{ fontSize: 11, color: Colors.onSurfaceVariant, marginBottom: 4, fontWeight: '600' }}>
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
        {/* Autocomplete dropdown */}
        {showSuggestions && filtered.length > 0 && (
          <View style={{
            position: 'absolute',
            top: '100%',
            left: 0, right: 0,
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
          <Text style={{ fontSize: 11, color: Colors.onSurfaceVariant, marginBottom: 4, fontWeight: '600' }}>
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
          <Text style={{ fontSize: 11, color: Colors.onSurfaceVariant, marginBottom: 4, fontWeight: '600' }}>
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
                  borderColor: row.unit === u ? Colors.primary : Colors.outlineVariant,
                  backgroundColor: row.unit === u ? Colors.primaryFixed : Colors.surfaceContainerLowest,
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: row.unit === u ? Colors.onPrimaryFixed : Colors.outline,
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
          <Text style={{ fontSize: 11, color: Colors.onSurfaceVariant, marginBottom: 4, fontWeight: '600' }}>
            PRICE / {row.unit.toUpperCase()}
          </Text>
          <View style={{ position: 'relative' }}>
            <TextInput
              style={[
                inputStyle,
                !pricesVisible && {
                  color: 'transparent',
                  backgroundColor: Colors.surfaceContainerHigh,
                },
              ]}
              placeholder="0.00"
              placeholderTextColor={Colors.outline}
              value={row.pricePerUnit === 0 ? '' : String(row.pricePerUnit)}
              onChangeText={(v) => onChange(row.id, 'pricePerUnit', parseFloat(v) || 0)}
              keyboardType="decimal-pad"
              secureTextEntry={!pricesVisible}
            />
            {!pricesVisible && (
              <View style={{
                position: 'absolute', inset: 0,
                justifyContent: 'center', paddingHorizontal: 10,
              }}>
                <Text style={{ fontSize: 14, color: Colors.outline, letterSpacing: 4 }}>••••</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: Colors.onSurfaceVariant, marginBottom: 4, fontWeight: '600' }}>
            TOTAL
          </Text>
          <View style={{
            backgroundColor: total > 0 ? Colors.primaryFixed : Colors.surfaceContainer,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 11,
            justifyContent: 'center',
          }}>
            {pricesVisible ? (
              <Text style={{
                fontSize: 14, fontWeight: '700',
                color: total > 0 ? Colors.onPrimaryFixed : Colors.outline,
              }}>
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

const [fishermenList, setFishermenList] = useState<{ id: number; name: string; boatName: string }[]>([]);
  const [fishSuggestions, setFishSuggestions] = useState<string[]>([]);
  const [selectedFishermenId, setSelectedFishermenId] = useState<number | null>(
    route.params?.fishermenId ?? null
  );
  const [date,          setDate]          = useState(todayString());
  const [rows,          setRows]          = useState<Row[]>([emptyRow()]);
  const [notes,         setNotes]         = useState('');
  const [pricesVisible, setPricesVisible] = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [showFishPicker, setShowFishPicker] = useState(false);

  // Load fishermen + fish name suggestions
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

  // ── Row operations ──
  const updateRow = useCallback(
    (id: string, field: keyof PurchaseItemInput, value: any) => {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
      );
    },
    []
  );

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const removeRow = (id: string) =>
    setRows((prev) => prev.filter((r) => r.id !== id));

  // ── Grand total ──
  const grandTotal = rows.reduce(
    (sum, r) => sum + r.quantity * r.pricePerUnit,
    0
  );

  // ── Validation ──
  const validate = (): string | null => {
    if (!selectedFishermenId)        return 'Please select a fisherman.';
    if (!date)                       return 'Please select a date.';
    if (rows.length === 0)           return 'Add at least one fish item.';
    for (const r of rows) {
      if (!r.fishName.trim())        return 'Fish name cannot be empty.';
      if (r.quantity <= 0)           return `Quantity must be > 0 for ${r.fishName || 'item'}.`;
      if (r.pricePerUnit <= 0)       return `Price must be > 0 for ${r.fishName || 'item'}.`;
    }
    return null;
  };

  // ── Submit ──
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

  const selectedFisherman = fishermenList.find(
  (f: { id: number; name: string; boatName: string }) => f.id === selectedFishermenId
);

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
          {/* ── Page header ── */}
          <View style={{ marginBottom: Spacing.xl }}>
            <Text style={{
              fontSize: 28, fontWeight: '700',
              color: Colors.primary, letterSpacing: -0.5,
            }}>
              New Purchase Entry
            </Text>
            <Text style={{ fontSize: 14, color: Colors.onSurfaceVariant, marginTop: 4 }}>
              Document the day's catch with precision.
            </Text>
          </View>

          {/* ── Section: Fisherman + Date ── */}
          <View style={{
            backgroundColor: Colors.surfaceContainerLow,
            borderRadius: 16,
            padding: Spacing.md,
            marginBottom: Spacing.md,
          }}>
            <Text style={{
              fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
              color: Colors.onSurfaceVariant, marginBottom: Spacing.sm,
            }}>
              FISHERMAN
            </Text>

            {/* Fisherman picker */}
            <TouchableOpacity
              onPress={() => setShowFishPicker(!showFishPicker)}
              style={{
                backgroundColor: Colors.surfaceContainerLowest,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: selectedFishermenId ? Colors.primary : Colors.outlineVariant,
                padding: Spacing.md,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: showFishPicker ? 0 : Spacing.md,
              }}
            >
              <Text style={{
                fontSize: 15,
                color: selectedFishermenId ? Colors.onSurface : Colors.outline,
                fontWeight: selectedFishermenId ? '500' : '400',
              }}>
                {selectedFisherman
                  ? `${selectedFisherman.name} — ⛵ ${selectedFisherman.boatName}`
                  : 'Select fisherman...'}
              </Text>
              <Text style={{ color: Colors.outline }}>
                {showFishPicker ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {/* Dropdown list */}
            {showFishPicker && (
              <View style={{
                backgroundColor: Colors.surfaceContainerLowest,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: Colors.outlineVariant,
                marginBottom: Spacing.md,
                overflow: 'hidden',
              }}>
                {fishermenList.length === 0 ? (
                  <View style={{ padding: Spacing.md }}>
                    <Text style={{ fontSize: 14, color: Colors.outline }}>
                      No fishermen found. Add one first.
                    </Text>
                  </View>
                ) : (
                  fishermenList.map((f) => (
                    <TouchableOpacity
                      key={f.id}
                      onPress={() => {
                        setSelectedFishermenId(f.id);
                        setShowFishPicker(false);
                      }}
                      style={{
                        padding: Spacing.md,
                        borderBottomWidth: 1,
                        borderBottomColor: Colors.outlineVariant,
                        backgroundColor:
                          selectedFishermenId === f.id
                            ? Colors.primaryFixed
                            : Colors.surfaceContainerLowest,
                      }}
                    >
                      <Text style={{
                        fontSize: 15, fontWeight: '500',
                        color: Colors.onSurface,
                      }}>
                        {f.name}
                      </Text>
                      <Text style={{ fontSize: 12, color: Colors.onSurfaceVariant }}>
                        ⛵ {f.boatName}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {/* Date */}
            <Text style={{
              fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
              color: Colors.onSurfaceVariant, marginBottom: Spacing.sm,
            }}>
              DATE
            </Text>
            <View style={{
              backgroundColor: Colors.surfaceContainerLowest,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: Colors.outlineVariant,
              overflow: 'hidden',
            }}>
              <TextInput
                style={{
                  paddingHorizontal: Spacing.md,
                  paddingVertical: 12,
                  fontSize: 15,
                  color: Colors.onSurface,
                }}
                value={date}
                onChangeText={(v) => setDate(v)}
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

          {/* ── Section: Fish items ── */}
          <View style={{
            backgroundColor: Colors.surfaceContainerLow,
            borderRadius: 16,
            padding: Spacing.md,
            marginBottom: Spacing.md,
          }}>
            {/* Header */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: Spacing.md,
            }}>
              <Text style={{
                fontSize: 15, fontWeight: '700', color: Colors.onSurface,
              }}>
                Catch Inventory
              </Text>
              <TouchableOpacity
                onPress={() => setPricesVisible(!pricesVisible)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  backgroundColor: pricesVisible ? Colors.primaryFixed : Colors.surfaceContainer,
                  borderRadius: 8,
                }}
              >
                <Text style={{ fontSize: 13, color: pricesVisible ? Colors.onPrimaryFixed : Colors.outline }}>
                  {pricesVisible ? '🙈 Hide' : '👁 Show'} Prices
                </Text>
              </TouchableOpacity>
            </View>

            {/* Fish rows */}
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

            {/* Add item button */}
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
              <Text style={{ fontSize: 14, color: Colors.primary, fontWeight: '600' }}>
                + Add Fish Item
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Notes ── */}
          <View style={{
            backgroundColor: Colors.surfaceContainerLow,
            borderRadius: 16,
            padding: Spacing.md,
            marginBottom: Spacing.md,
          }}>
            <Text style={{
              fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
              color: Colors.onSurfaceVariant, marginBottom: Spacing.sm,
            }}>
              NOTES (OPTIONAL)
            </Text>
            <TextInput
              style={{
                backgroundColor: Colors.surfaceContainerLowest,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: Colors.outlineVariant,
                paddingHorizontal: Spacing.md,
                paddingVertical: 12,
                fontSize: 14,
                color: Colors.onSurface,
                minHeight: 80,
                textAlignVertical: 'top',
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
            backgroundColor: Colors.primary,
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
                color: `${Colors.onPrimary}99`,
              }}>
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
            <Text style={{ fontSize: 40 }}>🐟</Text>
          </View>

          {/* ── Save button ── */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={{
              backgroundColor: saving ? Colors.outlineVariant : Colors.primary,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
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