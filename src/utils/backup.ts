import * as FileSystem from 'expo-file-system';
import * as Sharing    from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { sqliteDb } from '../db/client';
import { runMigrations } from '../db/migrations';

// ── Types ──────────────────────────────────────────────────────
export interface BackupData {
  version:     number;
  exportedAt:  string;
  fishermen:   any[];
  purchaseEntries: any[];
  purchaseItems:   any[];
  buyers:          any[];
  salesOrders:     any[];
  salesItems:      any[];
  payments:        any[];
  fishNames:       any[];
  appSettings:     any[];
}

// ── Export ─────────────────────────────────────────────────────
export async function exportBackup(): Promise<void> {
  // Read all tables
  const fishermen      = sqliteDb.getAllSync('SELECT * FROM fishermen');
  const purchaseEntries = sqliteDb.getAllSync('SELECT * FROM purchase_entries');
  const purchaseItems  = sqliteDb.getAllSync('SELECT * FROM purchase_items');
  const buyers         = sqliteDb.getAllSync('SELECT * FROM buyers');
  const salesOrders    = sqliteDb.getAllSync('SELECT * FROM sales_orders');
  const salesItems     = sqliteDb.getAllSync('SELECT * FROM sales_items');
  const payments       = sqliteDb.getAllSync('SELECT * FROM payments');
  const fishNames      = sqliteDb.getAllSync('SELECT * FROM fish_names');
  const appSettings    = sqliteDb.getAllSync('SELECT * FROM app_settings');

  const backup: BackupData = {
    version:     1,
    exportedAt:  new Date().toISOString(),
    fishermen,
    purchaseEntries,
    purchaseItems,
    buyers,
    salesOrders,
    salesItems,
    payments,
    fishNames,
    appSettings,
  };

  const json     = JSON.stringify(backup, null, 2);
  const fileName = `fishlog-backup-${formatDateForFile(new Date())}.json`;
  const filePath = `${FileSystem.documentDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(filePath, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(filePath, {
    mimeType:    'application/json',
    dialogTitle: 'Save FishLog Backup',
    UTI:         'public.json',
  });
}

// ── Import ─────────────────────────────────────────────────────
export async function importBackup(): Promise<{
  success: boolean;
  message: string;
  counts?: Record<string, number>;
}> {
  // Pick JSON file
  const result = await DocumentPicker.getDocumentAsync({
    type:      'application/json',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { success: false, message: 'No file selected.' };
  }

  const fileUri = result.assets[0].uri;

  // Read file
  const json = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  let backup: BackupData;
  try {
    backup = JSON.parse(json);
  } catch {
    return { success: false, message: 'Invalid backup file — could not parse JSON.' };
  }

  // Validate structure
  if (!backup.version || !backup.exportedAt) {
    return { success: false, message: 'Invalid backup file — missing version or export date.' };
  }

  if (backup.version !== 1) {
    return {
      success: false,
      message: `Unsupported backup version: ${backup.version}. Expected version 1.`,
    };
  }

  // ── Restore — wipe and re-insert ──
  try {
    // Disable FK constraints during restore
    sqliteDb.execSync('PRAGMA foreign_keys = OFF;');

    // Clear all tables
    sqliteDb.execSync(`
      DELETE FROM payments;
      DELETE FROM sales_items;
      DELETE FROM sales_orders;
      DELETE FROM purchase_items;
      DELETE FROM purchase_entries;
      DELETE FROM buyers;
      DELETE FROM fishermen;
      DELETE FROM fish_names;
      DELETE FROM app_settings;
    `);

    // Re-insert fishermen
    for (const row of backup.fishermen ?? []) {
      sqliteDb.runSync(
        'INSERT INTO fishermen (id, name, boat_name, phone, created_at) VALUES (?, ?, ?, ?, ?)',
        [row.id, row.name, row.boat_name, row.phone ?? null, row.created_at]
      );
    }

    // Re-insert purchase entries
    for (const row of backup.purchaseEntries ?? []) {
      sqliteDb.runSync(
        `INSERT INTO purchase_entries
         (id, fishermen_id, date, notes, total_amount, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [row.id, row.fishermen_id, row.date, row.notes ?? null,
         row.total_amount, row.created_at]
      );
    }

    // Re-insert purchase items
    for (const row of backup.purchaseItems ?? []) {
      sqliteDb.runSync(
        `INSERT INTO purchase_items
         (id, entry_id, fish_name, quantity, unit, price_per_unit, total_price)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.entry_id, row.fish_name, row.quantity,
         row.unit, row.price_per_unit, row.total_price]
      );
    }

    // Re-insert buyers
    for (const row of backup.buyers ?? []) {
      sqliteDb.runSync(
        'INSERT INTO buyers (id, name, type, phone, created_at) VALUES (?, ?, ?, ?, ?)',
        [row.id, row.name, row.type, row.phone ?? null, row.created_at]
      );
    }

    // Re-insert sales orders
    for (const row of backup.salesOrders ?? []) {
      sqliteDb.runSync(
        `INSERT INTO sales_orders
         (id, buyer_id, date, status, total_amount, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [row.id, row.buyer_id, row.date, row.status,
         row.total_amount, row.created_at]
      );
    }

    // Re-insert sales items
    for (const row of backup.salesItems ?? []) {
      sqliteDb.runSync(
        `INSERT INTO sales_items
         (id, order_id, fish_name, quantity, unit, price_per_unit, total_price, source_entry_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.order_id, row.fish_name, row.quantity,
         row.unit, row.price_per_unit, row.total_price,
         row.source_entry_id ?? null]
      );
    }

    // Re-insert payments
    for (const row of backup.payments ?? []) {
      sqliteDb.runSync(
        `INSERT INTO payments
         (id, reference_type, reference_id, amount, mode, payment_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.reference_type, row.reference_id,
         row.amount, row.mode, row.payment_date, row.notes ?? null]
      );
    }

    // Re-insert fish names
    for (const row of backup.fishNames ?? []) {
      sqliteDb.runSync(
        'INSERT OR IGNORE INTO fish_names (id, name) VALUES (?, ?)',
        [row.id, row.name]
      );
    }

    // Re-insert app settings
    for (const row of backup.appSettings ?? []) {
      sqliteDb.runSync(
        `INSERT INTO app_settings (key, value)
         VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [row.key, row.value]
      );
    }

    // Re-enable FK constraints
    sqliteDb.execSync('PRAGMA foreign_keys = ON;');

    return {
      success: true,
      message: 'Restore complete.',
      counts: {
        fishermen:       backup.fishermen?.length       ?? 0,
        purchaseEntries: backup.purchaseEntries?.length ?? 0,
        purchaseItems:   backup.purchaseItems?.length   ?? 0,
        buyers:          backup.buyers?.length          ?? 0,
        salesOrders:     backup.salesOrders?.length     ?? 0,
        salesItems:      backup.salesItems?.length      ?? 0,
        payments:        backup.payments?.length        ?? 0,
        fishNames:       backup.fishNames?.length       ?? 0,
      },
    };
  } catch (err) {
    // Re-enable FK even on error
    sqliteDb.execSync('PRAGMA foreign_keys = ON;');
    throw err;
  }
}

// ── Helpers ────────────────────────────────────────────────────
function formatDateForFile(d: Date): string {
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  const hh   = String(d.getHours()).padStart(2, '0');
  const min  = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${min}`;
}

// ── Get backup stats (for display) ────────────────────────────
export function getDbStats(): Record<string, number> {
  const tables = [
    'fishermen', 'purchase_entries', 'purchase_items',
    'buyers', 'sales_orders', 'sales_items',
    'payments', 'fish_names',
  ];

  const stats: Record<string, number> = {};
  for (const table of tables) {
    const row = sqliteDb.getFirstSync<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${table}`
    );
    stats[table] = row?.count ?? 0;
  }
  return stats;
}