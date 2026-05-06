import { sqliteDb } from './client';

const DEFAULT_FISH = [
  'Rohu', 'Katla', 'Hilsa', 'Surmai', 'Pomfret',
  'Rawas', 'Bangda', 'Bombay Duck', 'Tiger Prawn', 'Vannamei Prawn',
  'Crab', 'Squid', 'Tuna', 'Salmon', 'Mackerel',
  'Red Snapper', 'Sea Bass', 'Grouper', 'Kingfish', 'Anchovy',
];

export function runSeeds(): void {
  // Only seed if fish_names table is empty
  const row = sqliteDb.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM fish_names'
  );

  if (row && row.count > 0) {
    console.log('[DB] Seeds already applied, skipping');
    return;
  }

  const stmt = sqliteDb.prepareSync(
    'INSERT OR IGNORE INTO fish_names (name) VALUES (?)'
  );

  try {
    for (const name of DEFAULT_FISH) {
      stmt.executeSync([name]);
    }
    console.log(`[DB] Seeded ${DEFAULT_FISH.length} fish names`);
  } finally {
    stmt.finalizeSync();
  }
}