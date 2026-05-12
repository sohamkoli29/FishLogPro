import React, { useEffect, useState } from 'react';
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
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { RootStackParamList } from '../../types';
import { Colors, Spacing } from '../../utils/theme';
import { useBuyers } from '../../hooks/useBuyers';
import {
  Factory,
  Buildings,
  User,
} from 'phosphor-react-native';
// ── Types ──────────────────────────────────────────────────────
type BuyerType = 'supplier' | 'company' | 'other';
type RouteT   = RouteProp<RootStackParamList, 'AddBuyer'>;

const BUYER_TYPES = [
  {
    key: 'supplier',
    label: 'Supplier',
    icon: Factory,
    desc: 'Wholesale supplier or distributor',
  },

  {
    key: 'company',
    label: 'Company',
    icon: Buildings,
    desc: 'Registered company or business',
  },

  {
    key: 'other',
    label: 'Other',
    icon: User,
    desc: 'Individual or other buyer type',
  },
] as const;

// ── Validation ──────────────────────────────────────────────────
const schema = z.object({
  name:  z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// ── Field wrapper ───────────────────────────────────────────────
function Field({
  label,
  error,
  required,
  children,
}: {
  label:    string;
  error?:   string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={{
        fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
        color: Colors.onSurfaceVariant, marginBottom: 6,
        textTransform: 'uppercase',
      }}>
        {label}
        {required && <Text style={{ color: Colors.error }}> *</Text>}
      </Text>
      {children}
      {error && (
        <Text style={{ fontSize: 12, color: Colors.error, marginTop: 4 }}>
          {error}
        </Text>
      )}
    </View>
  );
}

// ── Main screen ─────────────────────────────────────────────────
export default function AddBuyerScreen() {
  const navigation = useNavigation();
  const route      = useRoute<RouteT>();
  const buyerId    = route.params?.buyerId;
  const isEdit     = !!buyerId;

  const { addBuyer, updateBuyer, getBuyer } = useBuyers();

  const [buyerType, setBuyerType] = useState<BuyerType>('other');
  const [saving,    setSaving]    = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', phone: '' },
  });

  // Load existing data if editing
  useEffect(() => {
    if (isEdit && buyerId) {
      getBuyer(buyerId).then((b) => {
        if (b) {
          reset({ name: b.name, phone: b.phone ?? '' });
          setBuyerType(b.type as BuyerType);
        }
      });
    }
  }, [isEdit, buyerId]);

  const onSubmit = async (data: FormData) => {
    try {
      setSaving(true);
      if (isEdit && buyerId) {
        await updateBuyer(buyerId, {
          name:  data.name,
          type:  buyerType,
          phone: data.phone || undefined,
        });
      } else {
        await addBuyer({
          name:  data.name,
          type:  buyerType,
          phone: data.phone || undefined,
        });
      }
      await new Promise((r) => setTimeout(r, 100));
      navigation.goBack();
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
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.onSurface,
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
        >
          {/* ── Header ── */}
          <View style={{ marginBottom: Spacing.xl }}>
            <Text style={{
              fontSize: 28, fontWeight: '700',
              color: Colors.onSurface, letterSpacing: -0.5,
            }}>
              {isEdit ? 'Edit Buyer' : 'Add Buyer'}
            </Text>
            <Text style={{ fontSize: 15, color: Colors.onSurfaceVariant, marginTop: 4 }}>
              {isEdit
                ? 'Update buyer details.'
                : 'Register a new buyer to your network.'}
            </Text>
          </View>

          {/* ── Buyer type selector ── */}
          <View style={{
            backgroundColor: Colors.surfaceContainerLow,
            borderRadius: 20,
            padding: Spacing.md,
            marginBottom: Spacing.md,
          }}>
            <Text style={{
              fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
              color: Colors.onSurfaceVariant, marginBottom: Spacing.sm,
              textTransform: 'uppercase',
            }}>
              Buyer Type
            </Text>

            <View style={{ gap: Spacing.sm }}>
             {BUYER_TYPES.map((t) => {
  const isSelected = buyerType === t.key;
  const IconComponent = t.icon;

  return (
                  <TouchableOpacity
                    key={t.key}
                    onPress={() => setBuyerType(t.key)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: Spacing.md,
                      padding: Spacing.md,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: isSelected ? Colors.primary : Colors.outlineVariant,
                      backgroundColor: isSelected
                        ? Colors.primaryFixed
                        : Colors.surfaceContainerLowest,
                    }}
                  >
                    <IconComponent
  size={24}
  color={
    isSelected
      ? Colors.onPrimaryFixed
      : Colors.onSurfaceVariant
  }
  weight="fill"
/>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: 15, fontWeight: '600',
                        color: isSelected ? Colors.onPrimaryFixed : Colors.onSurface,
                      }}>
                        {t.label}
                      </Text>
                      <Text style={{
                        fontSize: 12,
                        color: isSelected ? Colors.onPrimaryFixedVariant : Colors.onSurfaceVariant,
                      }}>
                        {t.desc}
                      </Text>
                    </View>
                    {/* Radio dot */}
                    <View style={{
                      width: 20, height: 20, borderRadius: 10,
                      borderWidth: 2,
                      borderColor: isSelected ? Colors.primary : Colors.outlineVariant,
                      backgroundColor: isSelected ? Colors.primary : 'transparent',
                      justifyContent: 'center', alignItems: 'center',
                    }}>
                      {isSelected && (
                        <View style={{
                          width: 8, height: 8, borderRadius: 4,
                          backgroundColor: Colors.onPrimary,
                        }} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Form fields ── */}
          <View style={{
            backgroundColor: Colors.surfaceContainerLow,
            borderRadius: 20,
            padding: Spacing.md,
            marginBottom: Spacing.xl,
          }}>
            {/* Name */}
            <Field label="Buyer Name" error={errors.name?.message} required>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={inputStyle}
                    placeholder="e.g. Oceanic Harvest Co."
                    placeholderTextColor={Colors.outline}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    value={value}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                )}
              />
            </Field>

            {/* Phone */}
            <Field label="Phone Number" error={errors.phone?.message}>
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={inputStyle}
                    placeholder="e.g. +91 98765 43210"
                    placeholderTextColor={Colors.outline}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    value={value}
                    keyboardType="phone-pad"
                    returnKeyType="done"
                  />
                )}
              />
            </Field>
          </View>

          {/* ── Submit ── */}
          <TouchableOpacity
            onPress={handleSubmit(onSubmit)}
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
              {saving ? 'Saving…' : isEdit ? 'Update Buyer' : 'Add Buyer'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}