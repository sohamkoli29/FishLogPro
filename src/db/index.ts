export { db, sqliteDb } from './client';
export * from './schema';
export { runMigrations } from './migrations';
export { runSeeds } from './seeds';

// ── DB Initializer — call once at app startup ──────────────────
export async function initializeDatabase(): Promise<void> {
  try {
    const { runMigrations: migrate } = await import('./migrations');
    const { runSeeds: seed } = await import('./seeds');
    migrate();
    seed();
  } catch (err) {
    console.error('[DB] Init failed:', err);
    throw err;
  }
}