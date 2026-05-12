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
import { useFishermen } from '../../hooks/useFishermen';

// ── Validation schema ──
const schema = z.object({
  name:     z.string().min(2, 'Name must be at least 2 characters'),
  boatName: z.string().min(1, 'Boat name is required'),
  phone:    z.string().optional(),
});

type FormData = z.infer<typeof schema>;
type RouteT   = RouteProp<RootStackParamList, 'AddFisherman'>;

// ── Reusable input component ──
function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={{
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.8,
        color: Colors.onSurfaceVariant,
        marginBottom: 6,
        textTransform: 'uppercase',
      }}>
        {label}{required && <Text style={{ color: Colors.error }}> *</Text>}
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

export default function AddFishermanScreen() {
  const navigation = useNavigation();
  const route      = useRoute<RouteT>();
  const fishermenId = route.params?.fishermenId;
  const isEdit      = !!fishermenId;

  const { addFisherman, updateFisherman, getFisherman } = useFishermen();
  const [saving, setSaving] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', boatName: '', phone: '' },
  });

  // Load existing data if editing
  useEffect(() => {
    if (isEdit && fishermenId) {
      getFisherman(fishermenId).then((f) => {
        if (f) {
          reset({
            name:     f.name,
            boatName: f.boatName,
            phone:    f.phone ?? '',
          });
        }
      });
    }
  }, [isEdit, fishermenId]);

const onSubmit = async (data: FormData) => {
  try {
    setSaving(true);
    console.log('📝 Submitting:', data);
    
    if (isEdit && fishermenId) {
      await updateFisherman(fishermenId, {
        name:     data.name,
        boatName: data.boatName,
        phone:    data.phone || undefined,
      });
    } else {
      await addFisherman({
        name:     data.name,
        boatName: data.boatName,
        phone:    data.phone || undefined,
      });
    }
    
    console.log('✅ Saved successfully');
    await new Promise((resolve) => setTimeout(resolve, 150));
    console.log('🔙 Going back now');
    navigation.goBack();
  } catch (err) {
    console.error('❌ Save error:', err);
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
          {/* ── Page header ── */}
          <View style={{ marginBottom: Spacing.xl }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.onSurface, letterSpacing: -0.5 }}>
              {isEdit ? 'Edit Fisherman' : 'Add Fisherman'}
            </Text>
            <Text style={{ fontSize: 15, color: Colors.onSurfaceVariant, marginTop: 4 }}>
              {isEdit ? 'Update fisherman details.' : 'Register a new fisherman to your fleet.'}
            </Text>
          </View>

          {/* ── Form card ── */}
          <View style={{
            backgroundColor: Colors.surfaceContainerLow,
            borderRadius: 20,
            padding: Spacing.lg,
            marginBottom: Spacing.xl,
          }}>

            {/* Name */}
            <Field label="Fisherman Name" error={errors.name?.message} required>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={inputStyle}
                    placeholder="e.g. Marco Rossi"
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

            {/* Boat Name */}
            <Field label="Boat Name" error={errors.boatName?.message} required>
              <Controller
                control={control}
                name="boatName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={inputStyle}
                    placeholder="e.g. The Sea Whisperer"
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

          {/* ── Submit button ── */}
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
              {saving ? 'Saving…' : isEdit ? 'Update Fisherman' : 'Add Fisherman'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}