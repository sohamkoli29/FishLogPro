import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { eq, asc } from 'drizzle-orm';

import { RootStackParamList } from '../../types';
import { Colors, Spacing } from '../../utils/theme';
import { useAppStore } from '../../stores/appStore';
import { getSetting, setSetting } from '../../db/settings';
import { db } from '../../db/client';
import { fishNames } from '../../db/schema';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ── Section wrapper ────────────────────────────────────────────
function Section({
  title,
  sub,
  children,
}: {
  title:    string;
  sub?:     string;
  children: React.ReactNode;
}) {
  return (
    <View style={{
      backgroundColor: Colors.surfaceContainerLow,
      borderRadius: 20,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    }}>
      <View style={{ marginBottom: Spacing.md }}>
        <Text style={{
          fontSize: 16, fontWeight: '700', color: Colors.onSurface,
        }}>
          {title}
        </Text>
        {sub && (
          <Text style={{ fontSize: 13, color: Colors.onSurfaceVariant, marginTop: 2 }}>
            {sub}
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────
export default function SettingsScreen() {
  const navigation     = useNavigation<Nav>();
  const businessName   = useAppStore((s) => s.businessName);
  const setBusinessName = useAppStore((s) => s.setBusinessName);
  const pricesVisible  = useAppStore((s) => s.pricesVisible);
  const togglePrices   = useAppStore((s) => s.togglePricesVisible);

  // ── Business name ──
  const [nameInput,  setNameInput]  = useState(businessName);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved,  setNameSaved]  = useState(false);

  // ── Fish names ──
  const [fishList,    setFishList]    = useState<{ id: number; name: string }[]>([]);
  const [newFishName, setNewFishName] = useState('');
  const [fishLoading, setFishLoading] = useState(false);
  const [fishAdding,  setFishAdding]  = useState(false);

  // Load fish names
  const loadFishNames = useCallback(async () => {
    try {
      setFishLoading(true);
      const rows = await db
        .select({ id: fishNames.id, name: fishNames.name })
        .from(fishNames)
        .orderBy(asc(fishNames.name));
      setFishList(rows);
    } catch (err) {
      console.error('[Settings] load fish error:', err);
    } finally {
      setFishLoading(false);
    }
  }, []);

  useEffect(() => {
    setNameInput(businessName);
    loadFishNames();
  }, [businessName, loadFishNames]);

  // ── Save business name ──
  const saveBusinessName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Business name cannot be empty.');
      return;
    }
    try {
      setNameSaving(true);
      setSetting('businessName', trimmed);
      setBusinessName(trimmed);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setNameSaving(false);
    }
  };

  // ── Add fish name ──
  const addFishName = async () => {
    const trimmed = newFishName.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Fish name cannot be empty.');
      return;
    }

    // Check duplicate
    const exists = fishList.some(
      (f) => f.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      Alert.alert('Already exists', `"${trimmed}" is already in the list.`);
      return;
    }

    try {
      setFishAdding(true);
      await db.insert(fishNames).values({ name: trimmed });
      setNewFishName('');
      await loadFishNames();
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setFishAdding(false);
    }
  };

  // ── Delete fish name ──
  const deleteFishName = (id: number, name: string) => {
    Alert.alert(
      'Remove Fish',
      `Remove "${name}" from the autocomplete list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await db.delete(fishNames).where(eq(fishNames.id, id));
            await loadFishNames();
          },
        },
      ]
    );
  };

  const inputStyle = {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    fontSize: 16,
    color: Colors.onSurface,
    flex: 1,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: Spacing.gutter, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={{ marginBottom: Spacing.xl }}>
            <Text style={{
              fontSize: 36, fontWeight: '700',
              color: Colors.onSurface, letterSpacing: -0.8,
            }}>
              Settings
            </Text>
            <Text style={{ fontSize: 15, color: Colors.onSurfaceVariant, marginTop: 4 }}>
              Manage your profile and preferences.
            </Text>
          </View>

          {/* ── Business Profile ── */}
          <Section
            title="Business Profile"
            sub="Your name appears on generated bills"
          >
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <TextInput
                style={inputStyle}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="e.g. Coastal Prime Seafoods"
                placeholderTextColor={Colors.outline}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={saveBusinessName}
              />
              <TouchableOpacity
                onPress={saveBusinessName}
                disabled={nameSaving}
                style={{
                  backgroundColor: nameSaved
                    ? Colors.primaryFixed
                    : Colors.primary,
                  borderRadius: 10,
                  paddingHorizontal: 16,
                  justifyContent: 'center',
                  alignItems: 'center',
                  minWidth: 70,
                }}
              >
                {nameSaving ? (
                  <ActivityIndicator size="small" color={Colors.onPrimary} />
                ) : (
                  <Text style={{
                    color: nameSaved ? Colors.onPrimaryFixed : Colors.onPrimary,
                    fontSize: 14,
                    fontWeight: '700',
                  }}>
                    {nameSaved ? '✓ Saved' : 'Save'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Section>

          {/* ── Privacy ── */}
          <Section
            title="Privacy"
            sub="Control financial data visibility"
          >
            <TouchableOpacity
              onPress={togglePrices}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: Colors.surfaceContainerLowest,
                borderRadius: 12,
                padding: Spacing.md,
                borderWidth: 1,
                borderColor: Colors.outlineVariant,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                <Text style={{ fontSize: 24 }}>
                  {pricesVisible ? '👁' : '🙈'}
                </Text>
                <View>
                  <Text style={{
                    fontSize: 15, fontWeight: '600', color: Colors.onSurface,
                  }}>
                    Show Prices
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.onSurfaceVariant }}>
                    {pricesVisible
                      ? 'Prices visible — tap to hide'
                      : 'Prices hidden — tap to reveal'}
                  </Text>
                </View>
              </View>

              {/* Toggle pill */}
              <View style={{
                width: 50, height: 28,
                borderRadius: 99,
                backgroundColor: pricesVisible ? Colors.primary : Colors.outlineVariant,
                justifyContent: 'center',
                paddingHorizontal: 3,
              }}>
                <View style={{
                  width: 22, height: 22,
                  borderRadius: 11,
                  backgroundColor: Colors.onPrimary,
                  alignSelf: pricesVisible ? 'flex-end' : 'flex-start',
                }} />
              </View>
            </TouchableOpacity>
          </Section>

          {/* ── Fish Names ── */}
          <Section
            title="Fish Names"
            sub={`${fishList.length} species in autocomplete list`}
          >
            {/* Add new fish */}
            <View style={{
              flexDirection: 'row',
              gap: Spacing.sm,
              marginBottom: Spacing.md,
            }}>
              <TextInput
                style={inputStyle}
                value={newFishName}
                onChangeText={setNewFishName}
                placeholder="Add fish species..."
                placeholderTextColor={Colors.outline}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={addFishName}
              />
              <TouchableOpacity
                onPress={addFishName}
                disabled={fishAdding}
                style={{
                  backgroundColor: Colors.primary,
                  borderRadius: 10,
                  paddingHorizontal: 16,
                  justifyContent: 'center',
                  alignItems: 'center',
                  minWidth: 56,
                }}
              >
                {fishAdding ? (
                  <ActivityIndicator size="small" color={Colors.onPrimary} />
                ) : (
                  <Text style={{
                    color: Colors.onPrimary,
                    fontSize: 22, lineHeight: 26,
                    fontWeight: '700',
                  }}>
                    +
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Fish list */}
            {fishLoading ? (
              <ActivityIndicator
                size="small"
                color={Colors.primary}
                style={{ marginVertical: 20 }}
              />
            ) : (
              <View style={{
                backgroundColor: Colors.surfaceContainerLowest,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: Colors.outlineVariant,
                overflow: 'hidden',
              }}>
                {fishList.length === 0 ? (
                  <View style={{
                    alignItems: 'center', padding: Spacing.xl,
                  }}>
                    <Text style={{
                      fontSize: 14, color: Colors.onSurfaceVariant,
                    }}>
                      No fish names yet. Add one above.
                    </Text>
                  </View>
                ) : (
                  fishList.map((fish, i) => (
                    <View
                      key={fish.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: Spacing.md,
                        paddingVertical: 12,
                        borderBottomWidth: i < fishList.length - 1 ? 1 : 0,
                        borderBottomColor: Colors.outlineVariant,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={{ fontSize: 14 }}>🐟</Text>
                        <Text style={{
                          fontSize: 15, color: Colors.onSurface, fontWeight: '500',
                        }}>
                          {fish.name}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => deleteFishName(fish.id, fish.name)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 8,
                          backgroundColor: `${Colors.error}0a`,
                          borderWidth: 1,
                          borderColor: `${Colors.error}25`,
                        }}
                      >
                        <Text style={{ fontSize: 12, color: Colors.error, fontWeight: '600' }}>
                          Remove
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}
          </Section>

          {/* ── App info ── */}
          <Section title="About">
            {[
              { label: 'App Name',  value: 'FishLog Pro'   },
              { label: 'Version',   value: '1.0.0'         },
              { label: 'Database',  value: 'SQLite (Local)' },
              { label: 'Storage',   value: 'On-Device Only' },
            ].map((item, i, arr) => (
              <View
                key={item.label}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 10,
                  borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                  borderBottomColor: Colors.outlineVariant,
                }}
              >
                <Text style={{ fontSize: 14, color: Colors.onSurfaceVariant }}>
                  {item.label}
                </Text>
                <Text style={{
                  fontSize: 14, fontWeight: '600', color: Colors.onSurface,
                }}>
                  {item.value}
                </Text>
              </View>
            ))}
          </Section>

          {/* ── Backup & Restore link ── */}
          <TouchableOpacity
            onPress={() => navigation.navigate('BackupRestore')}
            style={{
              backgroundColor: Colors.surfaceContainerLow,
              borderRadius: 20,
              padding: Spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: Spacing.lg,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
              <View style={{
                width: 44, height: 44, borderRadius: 12,
                backgroundColor: Colors.primaryFixed,
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ fontSize: 22 }}>☁️</Text>
              </View>
              <View>
                <Text style={{
                  fontSize: 15, fontWeight: '600', color: Colors.onSurface,
                }}>
                  Backup & Restore
                </Text>
                <Text style={{ fontSize: 12, color: Colors.onSurfaceVariant }}>
                  Export or import your data
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 20, color: Colors.outline }}>›</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}