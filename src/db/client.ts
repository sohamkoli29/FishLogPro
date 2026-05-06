import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

// Open (or create) the SQLite database file
const sqlite = openDatabaseSync('fishlog.db', {
  enableChangeListener: true,
});

// Drizzle client with full schema awareness
export const db = drizzle(sqlite, { schema });

// Raw sqlite handle — used for migrations
export const sqliteDb = sqlite;