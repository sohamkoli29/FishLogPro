import { sqliteDb } from './client';

// Run once on every app start — safe (CREATE IF NOT EXISTS)
export function runMigrations(): void {
  sqliteDb.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS fishermen (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      boat_name  TEXT    NOT NULL,
      phone      TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS purchase_entries (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      fishermen_id INTEGER NOT NULL REFERENCES fishermen(id) ON DELETE CASCADE,
      date         TEXT    NOT NULL,
      notes        TEXT,
      total_amount REAL    NOT NULL DEFAULT 0,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id       INTEGER NOT NULL REFERENCES purchase_entries(id) ON DELETE CASCADE,
      fish_name      TEXT    NOT NULL,
      quantity       REAL    NOT NULL,
      unit           TEXT    NOT NULL DEFAULT 'kg',
      price_per_unit REAL    NOT NULL,
      total_price    REAL    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS buyers (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      type       TEXT    NOT NULL DEFAULT 'other',
      phone      TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS sales_orders (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      buyer_id     INTEGER NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
      date         TEXT    NOT NULL,
      status       TEXT    NOT NULL DEFAULT 'pending',
      total_amount REAL    NOT NULL DEFAULT 0,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS sales_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id        INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
      fish_name       TEXT    NOT NULL,
      quantity        REAL    NOT NULL,
      unit            TEXT    NOT NULL DEFAULT 'kg',
      price_per_unit  REAL    NOT NULL,
      total_price     REAL    NOT NULL,
      source_entry_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS payments (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_type TEXT    NOT NULL,
      reference_id   INTEGER NOT NULL,
      amount         REAL    NOT NULL,
      mode           TEXT    NOT NULL DEFAULT 'cash',
      payment_date   TEXT    NOT NULL,
      notes          TEXT
    );

    CREATE TABLE IF NOT EXISTS fish_names (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT    NOT NULL UNIQUE
    );
  `);

  console.log('[DB] Migrations complete');
}