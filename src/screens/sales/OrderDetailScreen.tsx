import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../types';
import { Colors, Spacing } from '../../utils/theme';
import { useSales, SalesOrderWithItems, OrderStatus } from '../../hooks/useSales';
import { usePayments } from '../../hooks/usePayments';

import { ArrowsClockwise, ClockCountdown,CurrencyCircleDollar ,CheckCircle ,Trash  } from 'phosphor-react-native';

type RouteT = RouteProp<RootStackParamList, 'OrderDetail'>;
type Nav    = NativeStackNavigationProp<RootStackParamList>;

// ── Helpers ────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [yyyy, mm, dd] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${dd} ${months[parseInt(mm) - 1]} ${yyyy}`;
}

type StatusConfigEntry = {
  label: string;
  icon:  string;
  bg:    string;
  color: string;
};

const STATUS_OPTIONS: {
  key: OrderStatus;
  label: string;
  icon: any;
  bg: string;
  color: string;
}[] = [
  {
    key: 'pending',
    label: 'Pending',
    icon: ClockCountdown,
    bg: Colors.primaryFixed,
    color: Colors.onPrimaryFixed,
  },
  {
    key: 'partial',
    label: 'Partial',
    icon: ArrowsClockwise,
    bg: Colors.secondaryContainer,
    color: Colors.onSecondaryContainer,
  },
  {
    key: 'complete',
    label: 'Complete',
    icon: CheckCircle,
    bg: Colors.tertiaryFixed,
    color: Colors.onTertiaryFixedVariant,
  },
];

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

// ── Main screen ────────────────────────────────────────────────
export default function OrderDetailScreen() {
  const navigation                          = useNavigation<Nav>();
  const route                               = useRoute<RouteT>();
  const { orderId }                         = route.params;
  const { getOrder, deleteOrder, updateOrderStatus } = useSales();
  const { getTotalPaid }                    = usePayments();

  const [order,   setOrder]   = useState<SalesOrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Load data ──
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const o = await getOrder(orderId);
      setOrder(o);
    } catch (err) {
      console.error('[OrderDetail] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { loadData(); }, [loadData]);

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

  const balance   = order.totalAmount - order.totalPaid;
  const statusCfg =
  STATUS_OPTIONS.find((s) => s.key === order.status) ?? STATUS_OPTIONS[0];
  const StatusIcon = statusCfg.icon;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface }} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.gutter, paddingBottom: 40 }}
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
            <StatusIcon
  size={14}
  color={statusCfg.color}
/>
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
          {/* Payments button */}
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('PaymentsScreen', {
                referenceType: 'sale',
                referenceId:   order.id,
                name:          `${order.buyerName} — Order #${order.id}`,
              })
            }
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
            <CurrencyCircleDollar
  size={18}
  color={Colors.onSecondary}
  weight="fill"
/>
            <Text style={{ color: Colors.onSecondary, fontSize: 14, fontWeight: '700' }}>
              {balance > 0
                ? `Payments — ₹${balance.toLocaleString('en-IN')} due`
                : 'Payments — Cleared'}
            </Text>
          </TouchableOpacity>

          {/* Delete */}
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
           <Trash
  size={16}
  color={Colors.error}
  weight="fill"
/>
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
            {STATUS_OPTIONS.map((cfg) => {
  const isActive = order.status === cfg.key;
  const IconComponent = cfg.icon;
              return (
                <TouchableOpacity
                  key={cfg.key}
                  onPress={() => handleStatusChange(cfg.key)}
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
                  <IconComponent
  size={18}
  color={isActive ? cfg.color : Colors.outline}
/>
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
      </ScrollView>
    </SafeAreaView>
  );
}