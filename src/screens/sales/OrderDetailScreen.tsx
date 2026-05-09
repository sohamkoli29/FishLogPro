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
import { useSales, SalesOrderWithItems, OrderStatus } from '../../hooks/useSales';
import { usePayments, PaymentMode, PaymentInput } from '../../hooks/usePayments';
import { type Payment } from '../../db/schema';

type RouteT = RouteProp<RootStackParamList, 'OrderDetail'>;

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

const PAYMENT_MODES: { key: PaymentMode; label: string; icon: string }[] = [
  { key: 'cash',   label: 'Cash',   icon: '💵' },
  { key: 'bank',   label: 'Bank',   icon: '🏦' },
  { key: 'upi',    label: 'UPI',    icon: '📱' },
  { key: 'cheque', label: 'Cheque', icon: '📝' },
  { key: 'other',  label: 'Other',  icon: '💳' },
];
type StatusConfigEntry = {
  label: string;
  icon:  string;
  bg:    string;
  color: string;
};

const STATUS_CONFIG: { [K in OrderStatus]: StatusConfigEntry } = {
  pending: {
    label: 'Pending',
    icon:  '⏳',
    bg:    Colors.primaryFixed,
    color: Colors.onPrimaryFixed,
  },
  partial: {
    label: 'Partial',
    icon:  '🔄',
    bg:    Colors.secondaryContainer,
    color: Colors.onSecondaryContainer,
  },
  complete: {
    label: 'Complete',
    icon:  '✅',
    bg:    Colors.tertiaryFixed,
    color: Colors.onTertiaryFixedVariant,
  },
};

// ── Payment progress card ──────────────────────────────────────
function PaymentProgress({
  totalAmount,
  totalPaid,
}: {
  totalAmount: number;
  totalPaid:   number;
}) {
  const pct       = totalAmount > 0 ? Math.min(totalPaid / totalAmount, 1) : 0;
  const balance   = totalAmount - totalPaid;
  const isCleared = balance <= 0;

  return (
    <View style={{
      backgroundColor: Colors.secondary,
      borderRadius: 20,
      padding: Spacing.lg,
    }}>
      <Text style={{
        fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
        color: `${Colors.onSecondary}80`, marginBottom: 4,
      }}>
        PAYMENT SUMMARY
      </Text>

      <Text style={{
        fontSize: 36, fontWeight: '700',
        color: Colors.onSecondary, letterSpacing: -0.5,
      }}>
        ₹{totalAmount.toLocaleString('en-IN')}
      </Text>

      {/* Progress bar */}
      <View style={{
        height: 6,
        backgroundColor: `${Colors.onSecondary}20`,
        borderRadius: 99,
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
        overflow: 'hidden',
      }}>
        <View style={{
          height: '100%',
          width: `${pct * 100}%`,
          backgroundColor: isCleared ? '#4ade80' : Colors.secondaryFixed,
          borderRadius: 99,
        }} />
      </View>

      {/* Paid / Balance */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View>
          <Text style={{
            fontSize: 11, fontWeight: '700',
            color: `${Colors.onSecondary}60`,
          }}>
            RECEIVED
          </Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#4ade80' }}>
            ₹{totalPaid.toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{
            fontSize: 11, fontWeight: '700',
            color: `${Colors.onSecondary}60`,
          }}>
            {isCleared ? 'CLEARED' : 'OUTSTANDING'}
          </Text>
          <Text style={{
            fontSize: 16, fontWeight: '700',
            color: isCleared ? '#4ade80' : Colors.secondaryFixed,
          }}>
            {isCleared
              ? '✓ Fully Paid'
              : `₹${balance.toLocaleString('en-IN')}`}
          </Text>
        </View>
      </View>

      <Text style={{
        fontSize: 11, color: `${Colors.onSecondary}50`,
        textAlign: 'center', marginTop: Spacing.sm,
      }}>
        {Math.round(pct * 100)}% of order value received
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
  const [amount, setAmount] = useState('');
  const [mode,   setMode]   = useState<PaymentMode>('cash');
  const [date,   setDate]   = useState(todayString());
  const [notes,  setNotes]  = useState('');
  const [saving, setSaving] = useState(false);

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
      Alert.alert(
        'Error',
        `Amount cannot exceed outstanding balance of ₹${balance.toLocaleString('en-IN')}`
      );
      return;
    }
    try {
      setSaving(true);
      await onSave({
        amount:      amt,
        mode,
        paymentDate: date,
        notes:       notes.trim() || undefined,
      });
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
            fontSize: 14, color: Colors.onSurfaceVariant,
            marginBottom: Spacing.lg,
          }}>
            Outstanding: ₹{balance.toLocaleString('en-IN')}
          </Text>

          {/* Amount */}
          <Text style={{
            fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
            color: Colors.onSurfaceVariant, marginBottom: 6,
          }}>
            AMOUNT (₹)
          </Text>
          <TextInput
            style={[inputStyle, {
              fontSize: 24, fontWeight: '700', marginBottom: Spacing.md,
            }]}
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
            {PAYMENT_MODES.map((m) => (
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
                  borderColor: mode === m.key ? Colors.secondary : Colors.outlineVariant,
                  backgroundColor: mode === m.key
                    ? Colors.secondaryContainer
                    : Colors.surface,
                }}
              >
                <Text style={{ fontSize: 14 }}>{m.icon}</Text>
                <Text style={{
                  fontSize: 13, fontWeight: '600',
                  color: mode === m.key
                    ? Colors.onSecondaryContainer
                    : Colors.onSurfaceVariant,
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
            placeholder="e.g. Cheque no. 123456"
            placeholderTextColor={Colors.outline}
            value={notes}
            onChangeText={setNotes}
          />

          {/* Save */}
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
            {saving && (
              <ActivityIndicator size="small" color={Colors.onSecondary} />
            )}
            <Text style={{
              color: Colors.onSecondary, fontSize: 16, fontWeight: '700',
            }}>
              {saving ? 'Recording…' : 'Record Payment'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main screen ────────────────────────────────────────────────
export default function OrderDetailScreen() {
  const navigation                            = useNavigation();
  const route                                 = useRoute<RouteT>();
  const { orderId }                           = route.params;
  const { getOrder, deleteOrder, updateOrderStatus } = useSales();
  const {
    getPaymentsForSale,
    recordPayment,
    deletePayment,
  } = usePayments();

  const [order,          setOrder]          = useState<SalesOrderWithItems | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [showModal,      setShowModal]      = useState(false);

  // ── Load data ──
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [o, p] = await Promise.all([
        getOrder(orderId),
        getPaymentsForSale(orderId),
      ]);
      setOrder(o);
      setPaymentHistory(p);
    } catch (err) {
      console.error('[OrderDetail] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Record payment ──
  const handleRecordPayment = async (input: PaymentInput) => {
    await recordPayment('sale', orderId, input);
    // Auto-update status based on payment
    if (order) {
      const newPaid   = order.totalPaid + input.amount;
      const newStatus: OrderStatus =
        newPaid >= order.totalAmount ? 'complete'
        : newPaid > 0               ? 'partial'
        :                             'pending';
      await updateOrderStatus(orderId, newStatus);
    }
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

  // ── Delete order ──
  const handleDeleteOrder = () => {
    Alert.alert(
      'Delete Order',
      'Delete this sales order and all its payments? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteOrder(orderId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  // ── Change status manually ──
  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!order) return;
    await updateOrderStatus(orderId, newStatus);
    await loadData();
  };

  // ── Loading ──
  if (loading) {
    return (
      <SafeAreaView style={{
        flex: 1, backgroundColor: Colors.surface,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <ActivityIndicator size="large" color={Colors.secondary} />
      </SafeAreaView>
    );
  }

  // ── Not found ──
  if (!order) {
    return (
      <SafeAreaView style={{
        flex: 1, backgroundColor: Colors.surface,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <Text style={{ fontSize: 16, color: Colors.onSurfaceVariant }}>
          Order not found.
        </Text>
      </SafeAreaView>
    );
  }

  const balance    = order.totalAmount - order.totalPaid;
  const statusCfg  = STATUS_CONFIG[order.status as OrderStatus] ?? STATUS_CONFIG.pending;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface }} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.gutter, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadData}
            tintColor={Colors.secondary}
            colors={[Colors.secondary]}
          />
        }
      >
        {/* ── Order header ── */}
        <View style={{ marginBottom: Spacing.lg }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
            marginBottom: 4,
          }}>
            {/* Order ID */}
            <View style={{
              backgroundColor: Colors.secondaryContainer,
              borderRadius: 99,
              paddingHorizontal: 10,
              paddingVertical: 3,
            }}>
              <Text style={{
                fontSize: 11, fontWeight: '700',
                color: Colors.onSecondaryContainer, letterSpacing: 0.5,
              }}>
                ORDER #{order.id}
              </Text>
            </View>

            {/* Date */}
            <Text style={{ fontSize: 13, color: Colors.onSurfaceVariant }}>
              {formatDate(order.date)}
            </Text>
          </View>

          <Text style={{
            fontSize: 26, fontWeight: '700',
            color: Colors.onSurface, letterSpacing: -0.3,
          }}>
            {order.buyerName}
          </Text>

          {/* Status badge */}
          <View style={{
            alignSelf: 'flex-start',
            marginTop: 6,
            backgroundColor: statusCfg.bg,
            borderRadius: 99,
            paddingHorizontal: 12,
            paddingVertical: 4,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}>
            <Text style={{ fontSize: 12 }}>{statusCfg.icon}</Text>
            <Text style={{
              fontSize: 11, fontWeight: '700',
              color: statusCfg.color, letterSpacing: 0.5,
            }}>
              {statusCfg.label.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* ── Payment summary ── */}
        <View style={{ marginBottom: Spacing.lg }}>
          <PaymentProgress
            totalAmount={order.totalAmount}
            totalPaid={order.totalPaid}
          />
        </View>

        {/* ── Action buttons ── */}
        <View style={{
          flexDirection: 'row', gap: Spacing.sm,
          marginBottom: Spacing.lg,
        }}>
          {balance > 0 && (
            <TouchableOpacity
              onPress={() => setShowModal(true)}
              style={{
                flex: 1,
                backgroundColor: Colors.secondary,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 16 }}>💰</Text>
              <Text style={{
                color: Colors.onSecondary, fontSize: 14, fontWeight: '700',
              }}>
                Record Payment
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleDeleteOrder}
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

        {/* ── Change status manually ── */}
        <View style={{
          backgroundColor: Colors.surfaceContainerLow,
          borderRadius: 16,
          padding: Spacing.md,
          marginBottom: Spacing.lg,
        }}>
          <Text style={{
            fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
            color: Colors.onSurfaceVariant, marginBottom: Spacing.sm,
          }}>
            ORDER STATUS
          </Text>
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            {(Object.keys(STATUS_CONFIG) as OrderStatus[]).map((s) => {
              const cfg       = STATUS_CONFIG[s];
              const isActive  = order.status === s;
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => handleStatusChange(s)}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 10,
                    borderRadius: 10,
                    borderWidth: 1.5,
                    borderColor: isActive ? Colors.secondary : Colors.outlineVariant,
                    backgroundColor: isActive ? cfg.bg : Colors.surfaceContainerLowest,
                    gap: 2,
                  }}
                >
                  <Text style={{ fontSize: 16 }}>{cfg.icon}</Text>
                  <Text style={{
                    fontSize: 10, fontWeight: '700',
                    color: isActive ? cfg.color : Colors.outline,
                  }}>
                    {cfg.label.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Items table ── */}
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
            Order Items
          </Text>

          {/* Header */}
          <View style={{
            flexDirection: 'row',
            paddingBottom: 8,
            borderBottomWidth: 1,
            borderBottomColor: Colors.outlineVariant,
            marginBottom: 8,
          }}>
            {['SPECIES', 'QTY', 'RATE', 'TOTAL'].map((h, i) => (
              <Text
                key={h}
                style={{
                  flex: i === 0 ? 2 : 1,
                  fontSize: 11, fontWeight: '700',
                  color: Colors.outline, letterSpacing: 0.5,
                  textAlign: i === 0 ? 'left' : 'right',
                }}
              >
                {h}
              </Text>
            ))}
          </View>

          {/* Rows */}
          {order.items.map((item, i) => (
            <View
              key={item.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 10,
                borderBottomWidth: i < order.items.length - 1 ? 1 : 0,
                borderBottomColor: Colors.outlineVariant,
              }}
            >
              <View style={{ flex: 2 }}>
                <Text style={{
                  fontSize: 14, fontWeight: '600', color: Colors.onSurface,
                }}>
                  {item.fishName}
                </Text>
                <Text style={{ fontSize: 11, color: Colors.outline }}>
                  {item.unit}
                </Text>
              </View>
              <Text style={{
                flex: 1, fontSize: 14,
                color: Colors.onSurface, textAlign: 'right',
              }}>
                {item.quantity}
              </Text>
              <Text style={{
                flex: 1, fontSize: 14,
                color: Colors.onSurface, textAlign: 'right',
              }}>
                ₹{item.pricePerUnit}
              </Text>
              <Text style={{
                flex: 1, fontSize: 14, fontWeight: '700',
                color: Colors.secondary, textAlign: 'right',
              }}>
                ₹{item.totalPrice.toLocaleString('en-IN')}
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
              fontSize: 16, fontWeight: '700', color: Colors.secondary,
            }}>
              ₹{order.totalAmount.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

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
            <Text style={{
              fontSize: 15, fontWeight: '700', color: Colors.onSurface,
            }}>
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
            <View style={{ alignItems: 'center', paddingVertical: Spacing.xl }}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>💳</Text>
              <Text style={{ fontSize: 14, color: Colors.onSurfaceVariant }}>
                No payments received yet.
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
                  backgroundColor: Colors.secondaryContainer,
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  <Text style={{ fontSize: 18 }}>
                    {PAYMENT_MODES.find((m) => m.key === p.mode)?.icon ?? '💳'}
                  </Text>
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: 14, fontWeight: '600', color: Colors.onSurface,
                  }}>
                    {PAYMENT_MODES.find((m) => m.key === p.mode)?.label ?? p.mode}
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.onSurfaceVariant }}>
                    {formatDate(p.paymentDate)}
                    {p.notes ? ` • ${p.notes}` : ''}
                  </Text>
                </View>

                {/* Amount */}
                <Text style={{
                  fontSize: 16, fontWeight: '700', color: '#16a34a',
                }}>
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

      {/* ── Sticky bottom bar ── */}
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
              backgroundColor: Colors.secondary,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 16 }}>💰</Text>
            <Text style={{
              color: Colors.onSecondary, fontSize: 16, fontWeight: '700',
            }}>
              Record Payment — ₹{balance.toLocaleString('en-IN')} due
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}