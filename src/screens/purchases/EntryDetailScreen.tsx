import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

import { RootStackParamList } from '../../types';
import { Colors, Spacing } from '../../utils/theme';
import { usePurchases, PurchaseEntryWithItems } from '../../hooks/usePurchases';
import { usePayments, PaymentMode, PaymentInput } from '../../hooks/usePayments';
import { type Payment } from '../../db/schema';

type RouteT = RouteProp<RootStackParamList, 'EntryDetail'>;

// ── Helpers ────────────────────────────────────────────────────
function todayString(): string {
  const d    = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [yyyy, mm, dd] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${dd} ${months[parseInt(mm) - 1]} ${yyyy}`;
}

const MODES: { key: PaymentMode; label: string; icon: string }[] = [
  { key: 'cash',   label: 'Cash',   icon: '💵' },
  { key: 'bank',   label: 'Bank',   icon: '🏦' },
  { key: 'upi',    label: 'UPI',    icon: '📱' },
  { key: 'cheque', label: 'Cheque', icon: '📝' },
  { key: 'other',  label: 'Other',  icon: '💳' },
];

// ── Payment mode label ─────────────────────────────────────────
function modeLabel(mode: PaymentMode): string {
  return MODES.find((m) => m.key === mode)?.label ?? mode;
}

// ── Progress bar ───────────────────────────────────────────────
function PaymentProgress({
  totalAmount,
  totalPaid,
}: {
  totalAmount: number;
  totalPaid:   number;
}) {
  const pct      = totalAmount > 0 ? Math.min(totalPaid / totalAmount, 1) : 0;
  const balance  = totalAmount - totalPaid;
  const isCleared = balance <= 0;

  return (
    <View style={{
      backgroundColor: Colors.onSurface,
      borderRadius: 20,
      padding: Spacing.lg,
    }}>
      <Text style={{
        fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
        color: `${Colors.onPrimary}80`, marginBottom: 4,
      }}>
        PAYMENT SUMMARY
      </Text>

      {/* Total */}
      <Text style={{
        fontSize: 36, fontWeight: '700',
        color: Colors.onPrimary, letterSpacing: -0.5,
      }}>
        ₹{totalAmount.toLocaleString('en-IN')}
      </Text>

      {/* Progress bar */}
      <View style={{
        height: 6,
        backgroundColor: `${Colors.onPrimary}20`,
        borderRadius: 99,
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
        overflow: 'hidden',
      }}>
        <View style={{
          height: '100%',
          width: `${pct * 100}%`,
          backgroundColor: isCleared ? '#4ade80' : Colors.primaryFixed,
          borderRadius: 99,
        }} />
      </View>

      {/* Paid / Outstanding */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 11, color: `${Colors.onPrimary}60`, fontWeight: '600' }}>
            PAID
          </Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#4ade80' }}>
            ₹{totalPaid.toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 11, color: `${Colors.onPrimary}60`, fontWeight: '600' }}>
            {isCleared ? 'CLEARED' : 'BALANCE'}
          </Text>
          <Text style={{
            fontSize: 16, fontWeight: '700',
            color: isCleared ? '#4ade80' : Colors.errorContainer,
          }}>
            {isCleared ? '✓ Fully Paid' : `₹${balance.toLocaleString('en-IN')}`}
          </Text>
        </View>
      </View>

      <Text style={{
        fontSize: 11, color: `${Colors.onPrimary}50`,
        textAlign: 'center', marginTop: Spacing.sm,
      }}>
        {Math.round(pct * 100)}% of balance cleared
      </Text>
    </View>
  );
}

// ── Record Payment Modal ───────────────────────────────────────
function RecordPaymentModal({
  visible,
  balance,
  onClose,
  onSave,
}: {
  visible:  boolean;
  balance:  number;
  onClose:  () => void;
  onSave:   (input: PaymentInput) => Promise<void>;
}) {
  const [amount,  setAmount]  = useState('');
  const [mode,    setMode]    = useState<PaymentMode>('cash');
  const [date,    setDate]    = useState(todayString());
  const [notes,   setNotes]   = useState('');
  const [saving,  setSaving]  = useState(false);

  // Pre-fill with balance when opened
  useEffect(() => {
    if (visible) {
      setAmount(balance > 0 ? String(balance) : '');
      setMode('cash');
      setDate(todayString());
      setNotes('');
    }
  }, [visible, balance]);

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }
    if (amt > balance + 0.01) {
      Alert.alert('Error', `Amount cannot exceed balance of ₹${balance.toLocaleString('en-IN')}`);
      return;
    }
    try {
      setSaving(true);
      await onSave({ amount: amt, mode, paymentDate: date, notes: notes.trim() || undefined });
      onClose();
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.onSurface,
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={{
          backgroundColor: Colors.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: Spacing.lg,
          paddingBottom: 40,
        }}>
          {/* Handle */}
          <View style={{
            width: 40, height: 4, borderRadius: 99,
            backgroundColor: Colors.outlineVariant,
            alignSelf: 'center', marginBottom: Spacing.lg,
          }} />

          <Text style={{
            fontSize: 22, fontWeight: '700',
            color: Colors.onSurface, marginBottom: 4,
          }}>
            Record Payment
          </Text>
          <Text style={{ fontSize: 14, color: Colors.onSurfaceVariant, marginBottom: Spacing.lg }}>
            Outstanding balance: ₹{balance.toLocaleString('en-IN')}
          </Text>

          {/* Amount */}
          <Text style={{
            fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
            color: Colors.onSurfaceVariant, marginBottom: 6,
          }}>
            AMOUNT (₹)
          </Text>
          <TextInput
            style={[inputStyle, { fontSize: 24, fontWeight: '700', marginBottom: Spacing.md }]}
            placeholder="0"
            placeholderTextColor={Colors.outline}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            autoFocus
          />

          {/* Mode */}
          <Text style={{
            fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
            color: Colors.onSurfaceVariant, marginBottom: 8,
          }}>
            PAYMENT MODE
          </Text>
          <View style={{
            flexDirection: 'row', gap: Spacing.sm,
            marginBottom: Spacing.md, flexWrap: 'wrap',
          }}>
            {MODES.map((m) => (
              <TouchableOpacity
                key={m.key}
                onPress={() => setMode(m.key)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 99,
                  borderWidth: 1.5,
                  borderColor: mode === m.key ? Colors.primary : Colors.outlineVariant,
                  backgroundColor: mode === m.key ? Colors.primaryFixed : Colors.surface,
                }}
              >
                <Text style={{ fontSize: 14 }}>{m.icon}</Text>
                <Text style={{
                  fontSize: 13, fontWeight: '600',
                  color: mode === m.key ? Colors.onPrimaryFixed : Colors.onSurfaceVariant,
                }}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Date */}
          <Text style={{
            fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
            color: Colors.onSurfaceVariant, marginBottom: 6,
          }}>
            DATE
          </Text>
          <TextInput
            style={[inputStyle, { marginBottom: Spacing.md }]}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.outline}
            keyboardType="numeric"
            maxLength={10}
          />

          {/* Notes */}
          <Text style={{
            fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
            color: Colors.onSurfaceVariant, marginBottom: 6,
          }}>
            NOTES (OPTIONAL)
          </Text>
          <TextInput
            style={[inputStyle, { marginBottom: Spacing.lg }]}
            placeholder="e.g. Cash paid at dock"
            placeholderTextColor={Colors.outline}
            value={notes}
            onChangeText={setNotes}
          />

          {/* Save */}
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
              {saving ? 'Recording…' : 'Record Payment'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main screen ────────────────────────────────────────────────
export default function EntryDetailScreen() {
  const navigation                      = useNavigation();
  const route                           = useRoute<RouteT>();
  const { entryId }                     = route.params;
  const { getEntry, deleteEntry }       = usePurchases();
  const { getPaymentsForPurchase, recordPayment, deletePayment } = usePayments();

  const [entry,           setEntry]           = useState<PurchaseEntryWithItems | null>(null);
  const [paymentHistory,  setPaymentHistory]  = useState<Payment[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [showModal,       setShowModal]       = useState(false);
  const [pricesVisible,   setPricesVisible]   = useState(false);

  // ── Load data ──
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [e, p] = await Promise.all([
        getEntry(entryId),
        getPaymentsForPurchase(entryId),
      ]);
      setEntry(e);
      setPaymentHistory(p);
    } catch (err) {
      console.error('[EntryDetail] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Record payment ──
  const handleRecordPayment = async (input: PaymentInput) => {
    await recordPayment('purchase', entryId, input);
    await loadData();
  };

  // ── Delete payment ──
  const handleDeletePayment = (paymentId: number) => {
    Alert.alert(
      'Delete Payment',
      'Remove this payment record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deletePayment(paymentId);
            await loadData();
          },
        },
      ]
    );
  };

  // ── Delete entry ──
  const handleDeleteEntry = () => {
    Alert.alert(
      'Delete Entry',
      'Delete this purchase entry and all its payments? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteEntry(entryId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  // ── Loading ──
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  // ── Not found ──
  if (!entry) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 16, color: Colors.onSurfaceVariant }}>Entry not found.</Text>
      </SafeAreaView>
    );
  }

  const balance = entry.totalAmount - entry.totalPaid;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface }} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.gutter, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadData}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* ── Entry header ── */}
        <View style={{ marginBottom: Spacing.lg }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
            marginBottom: 4,
          }}>
            <View style={{
              backgroundColor: Colors.primaryFixed,
              borderRadius: 99,
              paddingHorizontal: 10,
              paddingVertical: 3,
            }}>
              <Text style={{
                fontSize: 11, fontWeight: '700',
                color: Colors.onPrimaryFixed, letterSpacing: 0.5,
              }}>
                ENTRY #{entry.id}
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: Colors.onSurfaceVariant }}>
              {formatDate(entry.date)}
            </Text>
          </View>

          <Text style={{
            fontSize: 26, fontWeight: '700',
            color: Colors.onSurface, letterSpacing: -0.3,
          }}>
            {entry.fishermanName}
          </Text>
          <Text style={{ fontSize: 15, color: Colors.onSurfaceVariant, marginTop: 2 }}>
            ⛵ {entry.fishermanBoat}
          </Text>
        </View>

        {/* ── Payment summary ── */}
        <View style={{ marginBottom: Spacing.lg }}>
          <PaymentProgress
            totalAmount={entry.totalAmount}
            totalPaid={entry.totalPaid}
          />
        </View>

        {/* ── Action buttons ── */}
        <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg }}>
          {balance > 0 && (
            <TouchableOpacity
              onPress={() => setShowModal(true)}
              style={{
                flex: 1,
                backgroundColor: Colors.primary,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 16 }}>💰</Text>
              <Text style={{ color: Colors.onPrimary, fontSize: 14, fontWeight: '700' }}>
                Record Payment
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => setPricesVisible(!pricesVisible)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: pricesVisible ? Colors.primaryFixed : Colors.surfaceContainerLow,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 14, color: pricesVisible ? Colors.onPrimaryFixed : Colors.outline }}>
              {pricesVisible ? '🙈 Hide' : '👁 Show'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDeleteEntry}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: `${Colors.error}0a`,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: `${Colors.error}30`,
            }}
          >
            <Text style={{ fontSize: 14, color: Colors.error }}>🗑</Text>
          </TouchableOpacity>
        </View>

        {/* ── Catch inventory ── */}
        <View style={{
          backgroundColor: Colors.surfaceContainerLow,
          borderRadius: 16,
          padding: Spacing.md,
          marginBottom: Spacing.lg,
        }}>
          <Text style={{
            fontSize: 15, fontWeight: '700',
            color: Colors.onSurface, marginBottom: Spacing.md,
          }}>
            Catch Inventory
          </Text>

          {/* Table header */}
          <View style={{
            flexDirection: 'row',
            paddingBottom: 8,
            borderBottomWidth: 1,
            borderBottomColor: Colors.outlineVariant,
            marginBottom: 8,
          }}>
            <Text style={{ flex: 2, fontSize: 11, fontWeight: '700', color: Colors.outline, letterSpacing: 0.5 }}>
              SPECIES
            </Text>
            <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: Colors.outline, letterSpacing: 0.5, textAlign: 'center' }}>
              QTY
            </Text>
            <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: Colors.outline, letterSpacing: 0.5, textAlign: 'right' }}>
              RATE
            </Text>
            <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: Colors.outline, letterSpacing: 0.5, textAlign: 'right' }}>
              TOTAL
            </Text>
          </View>

          {/* Table rows */}
          {entry.items.map((item, i) => (
            <View
              key={item.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 10,
                borderBottomWidth: i < entry.items.length - 1 ? 1 : 0,
                borderBottomColor: Colors.outlineVariant,
              }}
            >
              <View style={{ flex: 2 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.onSurface }}>
                  {item.fishName}
                </Text>
                <Text style={{ fontSize: 11, color: Colors.outline }}>
                  {item.unit}
                </Text>
              </View>
              <Text style={{ flex: 1, fontSize: 14, color: Colors.onSurface, textAlign: 'center' }}>
                {item.quantity}
              </Text>
              <Text style={{
                flex: 1, fontSize: 14,
                color: pricesVisible ? Colors.onSurface : Colors.outline,
                textAlign: 'right',
                letterSpacing: pricesVisible ? 0 : 2,
              }}>
                {pricesVisible ? `₹${item.pricePerUnit}` : '••••'}
              </Text>
              <Text style={{
                flex: 1, fontSize: 14, fontWeight: '700',
                color: pricesVisible ? Colors.tertiary : Colors.outline,
                textAlign: 'right',
                letterSpacing: pricesVisible ? 0 : 2,
              }}>
                {pricesVisible ? `₹${item.totalPrice.toLocaleString('en-IN')}` : '••••'}
              </Text>
            </View>
          ))}

          {/* Total row */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingTop: Spacing.sm,
            marginTop: Spacing.sm,
            borderTopWidth: 2,
            borderTopColor: Colors.outlineVariant,
          }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.onSurface }}>
              Total
            </Text>
            <Text style={{
              fontSize: 16, fontWeight: '700',
              color: pricesVisible ? Colors.primary : Colors.outline,
              letterSpacing: pricesVisible ? 0 : 2,
            }}>
              {pricesVisible
                ? `₹${entry.totalAmount.toLocaleString('en-IN')}`
                : '••••••'}
            </Text>
          </View>
        </View>

        {/* ── Notes ── */}
        {entry.notes && (
          <View style={{
            backgroundColor: Colors.surfaceContainerLow,
            borderRadius: 16,
            padding: Spacing.md,
            marginBottom: Spacing.lg,
          }}>
            <Text style={{
              fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
              color: Colors.onSurfaceVariant, marginBottom: 6,
            }}>
              NOTES
            </Text>
            <Text style={{ fontSize: 14, color: Colors.onSurface, lineHeight: 20 }}>
              {entry.notes}
            </Text>
          </View>
        )}

        {/* ── Payment history ── */}
        <View style={{
          backgroundColor: Colors.surfaceContainerLow,
          borderRadius: 16,
          padding: Spacing.md,
        }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: Spacing.md,
          }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.onSurface }}>
              Payment History
            </Text>
            <Text style={{
              fontSize: 11, fontWeight: '700', letterSpacing: 0.5,
              color: Colors.onSurfaceVariant,
            }}>
              {paymentHistory.length} TRANSACTION{paymentHistory.length !== 1 ? 'S' : ''}
            </Text>
          </View>

          {paymentHistory.length === 0 ? (
            <View style={{
              alignItems: 'center',
              paddingVertical: Spacing.xl,
            }}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>💳</Text>
              <Text style={{ fontSize: 14, color: Colors.onSurfaceVariant }}>
                No payments recorded yet.
              </Text>
            </View>
          ) : (
            paymentHistory.map((p, i) => (
              <TouchableOpacity
                key={p.id}
                onLongPress={() => handleDeletePayment(p.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderBottomWidth: i < paymentHistory.length - 1 ? 1 : 0,
                  borderBottomColor: Colors.outlineVariant,
                  gap: Spacing.md,
                }}
              >
                {/* Mode icon */}
                <View style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: Colors.primaryFixed,
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  <Text style={{ fontSize: 18 }}>
                    {MODES.find((m) => m.key === p.mode)?.icon ?? '💳'}
                  </Text>
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.onSurface }}>
                    {modeLabel(p.mode as PaymentMode)}
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.onSurfaceVariant }}>
                    {formatDate(p.paymentDate)}
                    {p.notes ? ` • ${p.notes}` : ''}
                  </Text>
                </View>

                {/* Amount */}
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#16a34a' }}>
                  +₹{p.amount.toLocaleString('en-IN')}
                </Text>
              </TouchableOpacity>
            ))
          )}

          {paymentHistory.length > 0 && (
            <Text style={{
              fontSize: 11, color: Colors.outline,
              textAlign: 'center', marginTop: 8,
            }}>
              Long-press a payment to delete it
            </Text>
          )}
        </View>
      </ScrollView>

      {/* ── Record Payment Modal ── */}
      <RecordPaymentModal
        visible={showModal}
        balance={balance}
        onClose={() => setShowModal(false)}
        onSave={handleRecordPayment}
      />

      {/* ── Sticky bottom bar (only if balance > 0) ── */}
      {balance > 0 && !showModal && (
        <View style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.outlineVariant,
          padding: Spacing.md,
          paddingBottom: 24,
        }}>
          <TouchableOpacity
            onPress={() => setShowModal(true)}
            style={{
              backgroundColor: Colors.primary,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 16 }}>💰</Text>
            <Text style={{ color: Colors.onPrimary, fontSize: 16, fontWeight: '700' }}>
              Record Payment — ₹{balance.toLocaleString('en-IN')} due
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}