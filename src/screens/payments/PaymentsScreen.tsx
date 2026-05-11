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
import { eq, sql, desc } from 'drizzle-orm';

import { RootStackParamList } from '../../types';
import { Colors, Spacing } from '../../utils/theme';
import { db } from '../../db/client';
import {
  payments,
  purchaseEntries,
  salesOrders,
  type Payment,
} from '../../db/schema';
import { usePayments, PaymentMode, PaymentInput } from '../../hooks/usePayments';

type RouteT = RouteProp<RootStackParamList, 'PaymentsScreen'>;

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

function modeLabel(mode: string): string {
  return MODES.find((m) => m.key === mode)?.label ?? mode;
}

function modeIcon(mode: string): string {
  return MODES.find((m) => m.key === mode)?.icon ?? '💳';
}

// ── Summary card ───────────────────────────────────────────────
function SummaryCard({
  totalAmount,
  totalPaid,
  referenceType,
}: {
  totalAmount:   number;
  totalPaid:     number;
  referenceType: 'purchase' | 'sale';
}) {
  const balance   = totalAmount - totalPaid;
  const isCleared = balance <= 0;
  const pct       = totalAmount > 0 ? Math.min(totalPaid / totalAmount, 1) : 0;

  const accentColor = referenceType === 'purchase' ? Colors.primary : Colors.secondary;
  const onAccent    = Colors.onPrimary;

  return (
    <View style={{
      backgroundColor: accentColor,
      borderRadius: 20,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    }}>
      <Text style={{
        fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
        color: `${onAccent}80`, marginBottom: 4,
      }}>
        PAYMENT SUMMARY
      </Text>

      <Text style={{
        fontSize: 36, fontWeight: '700',
        color: onAccent, letterSpacing: -0.5,
      }}>
        ₹{totalAmount.toLocaleString('en-IN')}
      </Text>

      {/* Progress bar */}
      <View style={{
        height: 6,
        backgroundColor: `${onAccent}20`,
        borderRadius: 99,
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
        overflow: 'hidden',
      }}>
        <View style={{
          height: '100%',
          width: `${pct * 100}%`,
          backgroundColor: isCleared ? '#4ade80' : `${onAccent}60`,
          borderRadius: 99,
        }} />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View>
          <Text style={{
            fontSize: 11, fontWeight: '700',
            color: `${onAccent}60`,
          }}>
            {referenceType === 'purchase' ? 'PAID OUT' : 'RECEIVED'}
          </Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#4ade80' }}>
            ₹{totalPaid.toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{
            fontSize: 11, fontWeight: '700',
            color: `${onAccent}60`,
          }}>
            {isCleared ? 'CLEARED' : 'BALANCE DUE'}
          </Text>
          <Text style={{
            fontSize: 16, fontWeight: '700',
            color: isCleared ? '#4ade80' : `${onAccent}90`,
          }}>
            {isCleared
              ? '✓ Fully Paid'
              : `₹${balance.toLocaleString('en-IN')}`}
          </Text>
        </View>
      </View>

      <Text style={{
        fontSize: 11, color: `${onAccent}50`,
        textAlign: 'center', marginTop: Spacing.sm,
      }}>
        {Math.round(pct * 100)}% cleared
      </Text>
    </View>
  );
}

// ── Record Payment Modal ───────────────────────────────────────
function RecordPaymentModal({
  visible,
  balance,
  referenceType,
  onClose,
  onSave,
}: {
  visible:       boolean;
  balance:       number;
  referenceType: 'purchase' | 'sale';
  onClose:       () => void;
  onSave:        (input: PaymentInput) => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [mode,   setMode]   = useState<PaymentMode>('cash');
  const [date,   setDate]   = useState(todayString());
  const [notes,  setNotes]  = useState('');
  const [saving, setSaving] = useState(false);

  const accentColor     = referenceType === 'purchase' ? Colors.primary : Colors.secondary;
  const accentContainer = referenceType === 'purchase'
    ? Colors.primaryFixed
    : Colors.secondaryContainer;
  const onAccentContainer = referenceType === 'purchase'
    ? Colors.onPrimaryFixed
    : Colors.onSecondaryContainer;

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
          <Text style={{
            fontSize: 14, color: Colors.onSurfaceVariant, marginBottom: Spacing.lg,
          }}>
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
                  borderColor: mode === m.key ? accentColor : Colors.outlineVariant,
                  backgroundColor: mode === m.key ? accentContainer : Colors.surface,
                }}
              >
                <Text style={{ fontSize: 14 }}>{m.icon}</Text>
                <Text style={{
                  fontSize: 13, fontWeight: '600',
                  color: mode === m.key ? onAccentContainer : Colors.onSurfaceVariant,
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
              backgroundColor: saving ? Colors.outlineVariant : accentColor,
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

// ── Payment row ────────────────────────────────────────────────
function PaymentRow({
  payment,
  index,
  total,
  accentContainer,
  onDelete,
}: {
  payment:        Payment;
  index:          number;
  total:          number;
  accentContainer: string;
  onDelete:       () => void;
}) {
  return (
    <TouchableOpacity
      onLongPress={onDelete}
      activeOpacity={0.85}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: index < total - 1 ? 1 : 0,
        borderBottomColor: Colors.outlineVariant,
        gap: Spacing.md,
      }}
    >
      {/* Mode icon */}
      <View style={{
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: accentContainer,
        justifyContent: 'center', alignItems: 'center',
        flexShrink: 0,
      }}>
        <Text style={{ fontSize: 20 }}>{modeIcon(payment.mode)}</Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.onSurface }}>
          {modeLabel(payment.mode)}
        </Text>
        <Text style={{ fontSize: 12, color: Colors.onSurfaceVariant }}>
          {formatDate(payment.paymentDate)}
          {payment.notes ? ` • ${payment.notes}` : ''}
        </Text>
      </View>

      {/* Amount */}
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#16a34a' }}>
        +₹{payment.amount.toLocaleString('en-IN')}
      </Text>
    </TouchableOpacity>
  );
}

// ── Main screen ────────────────────────────────────────────────
export default function PaymentsScreen() {
  const navigation = useNavigation();
  const route      = useRoute<RouteT>();
  const { referenceType, referenceId, name } = route.params;

  const { recordPayment, deletePayment } = usePayments();

  const [paymentList, setPaymentList] = useState<Payment[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);

  const isPurchase    = referenceType === 'purchase';
  const accentColor   = isPurchase ? Colors.primary : Colors.secondary;
  const accentContainer = isPurchase ? Colors.primaryFixed : Colors.secondaryContainer;

  // ── Load data ──
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch payment list
      const pmts = await db
        .select()
        .from(payments)
        .where(
          sql`${payments.referenceType} = ${referenceType}
              AND ${payments.referenceId} = ${referenceId}`
        )
        .orderBy(desc(payments.paymentDate));

      setPaymentList(pmts);

      // Fetch reference total amount
      if (isPurchase) {
        const [row] = await db
          .select({ total: purchaseEntries.totalAmount })
          .from(purchaseEntries)
          .where(eq(purchaseEntries.id, referenceId))
          .limit(1);
        setTotalAmount(row?.total ?? 0);
      } else {
        const [row] = await db
          .select({ total: salesOrders.totalAmount })
          .from(salesOrders)
          .where(eq(salesOrders.id, referenceId))
          .limit(1);
        setTotalAmount(row?.total ?? 0);
      }
    } catch (err) {
      console.error('[PaymentsScreen] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [referenceType, referenceId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Record payment ──
  const handleRecord = async (input: PaymentInput) => {
    await recordPayment(referenceType, referenceId, input);
    await loadData();
  };

  // ── Delete payment ──
  const handleDelete = (paymentId: number) => {
    Alert.alert(
      'Delete Payment',
      'Remove this payment record? This cannot be undone.',
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

  const totalPaid = paymentList.reduce((s, p) => s + p.amount, 0);
  const balance   = totalAmount - totalPaid;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface }} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.gutter, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadData}
            tintColor={accentColor}
            colors={[accentColor]}
          />
        }
      >
        {/* ── Header ── */}
        <View style={{ marginBottom: Spacing.lg }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
            marginBottom: 4,
          }}>
            <View style={{
              backgroundColor: accentContainer,
              borderRadius: 99,
              paddingHorizontal: 10,
              paddingVertical: 3,
            }}>
              <Text style={{
                fontSize: 11, fontWeight: '700', letterSpacing: 0.5,
                color: isPurchase ? Colors.onPrimaryFixed : Colors.onSecondaryContainer,
              }}>
                {isPurchase ? 'PURCHASE' : 'SALE'} #{referenceId}
              </Text>
            </View>
          </View>
          <Text style={{
            fontSize: 24, fontWeight: '700',
            color: Colors.onSurface, letterSpacing: -0.3,
          }}>
            {name}
          </Text>
        </View>

        {/* ── Loading ── */}
        {loading ? (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <ActivityIndicator size="large" color={accentColor} />
          </View>
        ) : (
          <>
            {/* ── Summary card ── */}
            <SummaryCard
              totalAmount={totalAmount}
              totalPaid={totalPaid}
              referenceType={referenceType}
            />

            {/* ── Record button (when balance exists) ── */}
            {balance > 0 && (
              <TouchableOpacity
                onPress={() => setShowModal(true)}
                style={{
                  backgroundColor: accentColor,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                  marginBottom: Spacing.lg,
                }}
              >
                <Text style={{ fontSize: 18 }}>💰</Text>
                <Text style={{ color: Colors.onPrimary, fontSize: 15, fontWeight: '700' }}>
                  Record Payment — ₹{balance.toLocaleString('en-IN')} due
                </Text>
              </TouchableOpacity>
            )}

            {/* ── Fully cleared banner ── */}
            {balance <= 0 && totalAmount > 0 && (
              <View style={{
                backgroundColor: Colors.primaryFixed,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
                marginBottom: Spacing.lg,
              }}>
                <Text style={{ fontSize: 18 }}>✅</Text>
                <Text style={{
                  color: Colors.onPrimaryFixed,
                  fontSize: 15, fontWeight: '700',
                }}>
                  Fully Paid — No Balance Due
                </Text>
              </View>
            )}

            {/* ── Payment history ── */}
            <View style={{
              backgroundColor: Colors.surfaceContainerLow,
              borderRadius: 20,
              padding: Spacing.lg,
            }}>
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: Spacing.md,
              }}>
                <Text style={{
                  fontSize: 16, fontWeight: '700', color: Colors.onSurface,
                }}>
                  Payment History
                </Text>
                <View style={{
                  backgroundColor: accentContainer,
                  borderRadius: 99,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                }}>
                  <Text style={{
                    fontSize: 12, fontWeight: '700',
                    color: isPurchase ? Colors.onPrimaryFixed : Colors.onSecondaryContainer,
                  }}>
                    {paymentList.length} TRANSACTION{paymentList.length !== 1 ? 'S' : ''}
                  </Text>
                </View>
              </View>

              {paymentList.length === 0 ? (
                <View style={{
                  alignItems: 'center',
                  paddingVertical: Spacing.xl,
                }}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>💳</Text>
                  <Text style={{
                    fontSize: 16, fontWeight: '600',
                    color: Colors.onSurface, marginBottom: 6,
                  }}>
                    No Payments Yet
                  </Text>
                  <Text style={{
                    fontSize: 14, color: Colors.onSurfaceVariant,
                    textAlign: 'center', lineHeight: 20,
                  }}>
                    {balance > 0
                      ? 'Tap the button above to record the first payment.'
                      : 'No payment records for this entry.'}
                  </Text>
                </View>
              ) : (
                <>
                  {paymentList.map((p, i) => (
                    <PaymentRow
                      key={p.id}
                      payment={p}
                      index={i}
                      total={paymentList.length}
                      accentContainer={accentContainer}
                      onDelete={() => handleDelete(p.id)}
                    />
                  ))}
                  <Text style={{
                    fontSize: 11, color: Colors.outline,
                    textAlign: 'center', marginTop: Spacing.md,
                  }}>
                    Long-press a payment to delete it
                  </Text>
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Sticky bottom bar ── */}
      {!loading && balance > 0 && !showModal && (
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
              backgroundColor: accentColor,
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

      {/* ── Modal ── */}
      <RecordPaymentModal
        visible={showModal}
        balance={balance}
        referenceType={referenceType}
        onClose={() => setShowModal(false)}
        onSave={handleRecord}
      />
    </SafeAreaView>
  );
}