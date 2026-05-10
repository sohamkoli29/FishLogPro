import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { Colors, Spacing } from '../../utils/theme';
import { exportBackup, importBackup, getDbStats } from '../../utils/backup';

// ── Helpers ────────────────────────────────────────────────────
function formatDateDisplay(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day:    'numeric',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

const TABLE_LABELS: Record<string, string> = {
  fishermen:        'Fishermen',
  purchase_entries: 'Purchase Entries',
  purchase_items:   'Purchase Items',
  buyers:           'Buyers',
  sales_orders:     'Sales Orders',
  sales_items:      'Sales Items',
  payments:         'Payments',
  fish_names:       'Fish Names',
};

// ── Stat row ───────────────────────────────────────────────────
function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: Colors.outlineVariant,
    }}>
      <Text style={{ fontSize: 14, color: Colors.onSurfaceVariant }}>
        {label}
      </Text>
      <View style={{
        backgroundColor: value > 0 ? Colors.primaryFixed : Colors.surfaceContainerHigh,
        borderRadius: 99,
        paddingHorizontal: 10,
        paddingVertical: 3,
        minWidth: 36,
        alignItems: 'center',
      }}>
        <Text style={{
          fontSize: 13, fontWeight: '700',
          color: value > 0 ? Colors.onPrimaryFixed : Colors.outline,
        }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────
export default function BackupRestoreScreen() {
  const [stats,       setStats]       = useState<Record<string, number>>({});
  const [exporting,   setExporting]   = useState(false);
  const [importing,   setImporting]   = useState(false);
  const [lastExport,  setLastExport]  = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<{
    success: boolean;
    message: string;
    counts?: Record<string, number>;
  } | null>(null);

  // Load stats
  const loadStats = useCallback(() => {
    try {
      const s = getDbStats();
      setStats(s);
    } catch (err) {
      console.error('[Backup] stats error:', err);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadStats(); }, [loadStats]));

  // ── Export ──
  const handleExport = async () => {
    try {
      setExporting(true);
      setRestoreResult(null);
      await exportBackup();
      const now = new Date().toISOString();
      setLastExport(now);
    } catch (err) {
      Alert.alert('Export Failed', String(err));
    } finally {
      setExporting(false);
    }
  };

  // ── Import ──
  const handleImport = () => {
    Alert.alert(
      'Restore Data',
      'This will permanently overwrite ALL current data with the backup file. This cannot be undone.\n\nMake sure you have exported a backup of your current data first.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Restore',
          style: 'destructive',
          onPress: doImport,
        },
      ]
    );
  };

  const doImport = async () => {
    try {
      setImporting(true);
      setRestoreResult(null);
      const result = await importBackup();
      setRestoreResult(result);
      if (result.success) {
        loadStats();
      }
    } catch (err) {
      setRestoreResult({
        success: false,
        message: String(err),
      });
    } finally {
      setImporting(false);
    }
  };

  const totalRecords = Object.values(stats).reduce((s, v) => s + v, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.surface }} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.gutter, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={{ marginBottom: Spacing.xl }}>
          <Text style={{
            fontSize: 28, fontWeight: '700',
            color: Colors.onSurface, letterSpacing: -0.5,
          }}>
            Backup & Restore
          </Text>
          <Text style={{ fontSize: 15, color: Colors.onSurfaceVariant, marginTop: 4 }}>
            Export your data to a file or restore from a previous backup.
          </Text>
        </View>

        {/* ── DB overview card ── */}
        <View style={{
          backgroundColor: Colors.primary,
          borderRadius: 20,
          padding: Spacing.lg,
          marginBottom: Spacing.lg,
        }}>
          <Text style={{
            fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
            color: `${Colors.onPrimary}80`, marginBottom: 4,
          }}>
            DATABASE OVERVIEW
          </Text>
          <Text style={{
            fontSize: 36, fontWeight: '700',
            color: Colors.onPrimary, letterSpacing: -0.5,
          }}>
            {totalRecords.toLocaleString('en-IN')}
          </Text>
          <Text style={{ fontSize: 14, color: `${Colors.onPrimary}80`, marginTop: 2 }}>
            total records across all tables
          </Text>

          {lastExport && (
            <View style={{
              marginTop: Spacing.md,
              paddingTop: Spacing.md,
              borderTopWidth: 1,
              borderTopColor: `${Colors.onPrimary}20`,
            }}>
              <Text style={{
                fontSize: 12, color: `${Colors.onPrimary}70`,
              }}>
                Last export: {formatDateDisplay(lastExport)}
              </Text>
            </View>
          )}
        </View>

        {/* ── Export card ── */}
        <View style={{
          backgroundColor: Colors.surfaceContainerLow,
          borderRadius: 20,
          padding: Spacing.lg,
          marginBottom: Spacing.lg,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.md }}>
            <View style={{
              width: 48, height: 48, borderRadius: 14,
              backgroundColor: Colors.primaryFixed,
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ fontSize: 24 }}>📤</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 16, fontWeight: '700', color: Colors.onSurface,
              }}>
                Export Backup
              </Text>
              <Text style={{ fontSize: 13, color: Colors.onSurfaceVariant }}>
                Save all your data as a JSON file
              </Text>
            </View>
          </View>

          <Text style={{
            fontSize: 13, color: Colors.onSurfaceVariant,
            lineHeight: 20, marginBottom: Spacing.lg,
          }}>
            Creates a complete snapshot of all fishermen, buyers, purchases, sales, and payments. Share it to Google Drive, WhatsApp, email, or any app on your device.
          </Text>

          <TouchableOpacity
            onPress={handleExport}
            disabled={exporting}
            style={{
              backgroundColor: exporting ? Colors.outlineVariant : Colors.primary,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {exporting ? (
              <>
                <ActivityIndicator size="small" color={Colors.onPrimary} />
                <Text style={{
                  color: Colors.onPrimary, fontSize: 15, fontWeight: '700',
                }}>
                  Preparing Export…
                </Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 18 }}>📤</Text>
                <Text style={{
                  color: Colors.onPrimary, fontSize: 15, fontWeight: '700',
                }}>
                  Export & Share Backup
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Restore card ── */}
        <View style={{
          backgroundColor: Colors.surfaceContainerHighest,
          borderRadius: 20,
          padding: Spacing.lg,
          marginBottom: Spacing.lg,
          borderWidth: 1,
          borderColor: Colors.outlineVariant,
        }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            gap: 12, marginBottom: Spacing.md,
          }}>
            <View style={{
              width: 48, height: 48, borderRadius: 14,
              backgroundColor: Colors.tertiaryFixed,
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ fontSize: 24 }}>📥</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 16, fontWeight: '700', color: Colors.onSurface,
              }}>
                Restore Backup
              </Text>
              <Text style={{ fontSize: 13, color: Colors.onSurfaceVariant }}>
                Import data from a backup file
              </Text>
            </View>
          </View>

          {/* Warning */}
          <View style={{
            backgroundColor: `${Colors.error}10`,
            borderRadius: 12,
            padding: Spacing.md,
            marginBottom: Spacing.lg,
            borderWidth: 1,
            borderColor: `${Colors.error}25`,
            flexDirection: 'row',
            gap: 10,
          }}>
            <Text style={{ fontSize: 18, flexShrink: 0 }}>⚠️</Text>
            <Text style={{
              fontSize: 13, color: Colors.onSurface, lineHeight: 20, flex: 1,
            }}>
              Restoring will permanently overwrite ALL current data. Export a backup first to avoid losing data.
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleImport}
            disabled={importing}
            style={{
              backgroundColor: Colors.surfaceContainerLowest,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              borderWidth: 1.5,
              borderColor: importing ? Colors.outlineVariant : Colors.outline,
            }}
          >
            {importing ? (
              <>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={{
                  color: Colors.onSurface, fontSize: 15, fontWeight: '700',
                }}>
                  Restoring…
                </Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 18 }}>📥</Text>
                <Text style={{
                  color: Colors.onSurface, fontSize: 15, fontWeight: '700',
                }}>
                  Select Backup File
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Restore result ── */}
        {restoreResult && (
          <View style={{
            backgroundColor: restoreResult.success
              ? Colors.primaryFixed
              : Colors.errorContainer,
            borderRadius: 16,
            padding: Spacing.lg,
            marginBottom: Spacing.lg,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Text style={{ fontSize: 20 }}>
                {restoreResult.success ? '✅' : '❌'}
              </Text>
              <Text style={{
                fontSize: 15, fontWeight: '700',
                color: restoreResult.success
                  ? Colors.onPrimaryFixed
                  : Colors.onErrorContainer,
              }}>
                {restoreResult.success ? 'Restore Successful' : 'Restore Failed'}
              </Text>
            </View>
            <Text style={{
              fontSize: 13,
              color: restoreResult.success
                ? Colors.onPrimaryFixedVariant
                : Colors.onErrorContainer,
              lineHeight: 20,
            }}>
              {restoreResult.message}
            </Text>

            {restoreResult.success && restoreResult.counts && (
              <View style={{ marginTop: Spacing.sm }}>
                {Object.entries(restoreResult.counts).map(([key, val]) => (
                  <Text key={key} style={{
                    fontSize: 12,
                    color: Colors.onPrimaryFixedVariant,
                    marginTop: 2,
                  }}>
                    • {TABLE_LABELS[key] ?? key}: {val} records
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── DB stats table ── */}
        <View style={{
          backgroundColor: Colors.surfaceContainerLow,
          borderRadius: 20,
          padding: Spacing.lg,
        }}>
          <Text style={{
            fontSize: 15, fontWeight: '700',
            color: Colors.onSurface, marginBottom: Spacing.md,
          }}>
            Current Database
          </Text>

          {Object.entries(TABLE_LABELS).map(([key, label], i, arr) => (
            <View
              key={key}
              style={{
                borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                borderBottomColor: Colors.outlineVariant,
              }}
            >
              <StatRow label={label} value={stats[key] ?? 0} />
            </View>
          ))}

          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: Spacing.sm,
            paddingTop: Spacing.sm,
            borderTopWidth: 2,
            borderTopColor: Colors.outlineVariant,
          }}>
            <Text style={{
              fontSize: 13, fontWeight: '700', color: Colors.onSurface,
            }}>
              TOTAL RECORDS
            </Text>
            <Text style={{
              fontSize: 18, fontWeight: '700', color: Colors.primary,
            }}>
              {totalRecords.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}