import { sqliteDb } from './client';

// ── Create settings table if not exists ──
export function initSettings(): void {
  sqliteDb.execSync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

// ── Get a setting value ──
export function getSetting(key: string, fallback = ''): string {
  const row = sqliteDb.getFirstSync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [key]
  );
  return row?.value ?? fallback;
}

// ── Set a setting value ──
export function setSetting(key: string, value: string): void {
  sqliteDb.runSync(
    `INSERT INTO app_settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}