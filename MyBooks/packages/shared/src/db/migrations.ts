/**
 * Migration runner for MyBooks SQLite database.
 *
 * Uses a version-based approach:
 * - Stores current schema version in `settings` table (key: 'schema_version')
 * - Runs migrations sequentially from current version to latest
 * - Each migration is a list of SQL statements executed in a transaction
 *
 * The database adapter interface is minimal so both expo-sqlite (mobile)
 * and better-sqlite3 (web) can implement it.
 */

import {
  ALL_TABLES,
  CREATE_BOOKS_FTS,
  CREATE_FTS_TRIGGERS,
  CREATE_INDEXES,
  SEED_SYSTEM_SHELVES,
  SCHEMA_VERSION,
} from './schema';

/**
 * Minimal database adapter interface.
 * Implementations wrap expo-sqlite or better-sqlite3.
 */
export interface DatabaseAdapter {
  /** Execute a single SQL statement with optional parameters. */
  execute(sql: string, params?: unknown[]): void;
  /** Execute a SQL query and return all rows. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  /** Run a function inside a transaction. Rolls back on error. */
  transaction(fn: () => void): void;
}

export interface Migration {
  version: number;
  description: string;
  statements: string[];
}

/**
 * Migration 1: Initial schema — all tables, FTS5, triggers, indexes, and seed data.
 */
const migration001: Migration = {
  version: 1,
  description: 'Initial schema — 12 tables, FTS5, triggers, indexes, system shelves',
  statements: [
    ...ALL_TABLES,
    CREATE_BOOKS_FTS,
    ...CREATE_FTS_TRIGGERS,
    ...CREATE_INDEXES,
    ...SEED_SYSTEM_SHELVES,
  ],
};

/**
 * All migrations in order. Add new migrations here.
 */
export const MIGRATIONS: Migration[] = [migration001];

/**
 * The settings key used to track schema version.
 */
const VERSION_KEY = 'schema_version';

/**
 * Ensure the settings table exists (bootstrap step).
 * Called before reading version so migration 1 can work.
 */
function ensureSettingsTable(db: DatabaseAdapter): void {
  db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
}

/**
 * Get the current schema version from the database.
 * Returns 0 if no version is set (fresh database).
 */
function getSchemaVersion(db: DatabaseAdapter): number {
  const rows = db.query<{ value: string }>(
    `SELECT value FROM settings WHERE key = ?`,
    [VERSION_KEY],
  );
  if (rows.length === 0) return 0;
  return parseInt(rows[0].value, 10) || 0;
}

/**
 * Set the schema version in settings.
 */
function setSchemaVersion(db: DatabaseAdapter, version: number): void {
  db.execute(
    `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
    [VERSION_KEY, String(version)],
  );
}

/**
 * Run all pending migrations to bring the database up to date.
 *
 * @returns The number of migrations that were applied.
 */
export function runMigrations(db: DatabaseAdapter): number {
  ensureSettingsTable(db);

  const currentVersion = getSchemaVersion(db);
  const pendingMigrations = MIGRATIONS.filter((m) => m.version > currentVersion);

  if (pendingMigrations.length === 0) return 0;

  // Enable foreign keys
  db.execute('PRAGMA foreign_keys = ON;');

  let applied = 0;
  for (const migration of pendingMigrations) {
    db.transaction(() => {
      for (const sql of migration.statements) {
        db.execute(sql);
      }
      setSchemaVersion(db, migration.version);
    });
    applied++;
  }

  return applied;
}

/**
 * Initialize the database: run all pending migrations.
 * Safe to call multiple times — idempotent.
 *
 * @returns Object with the final schema version and number of migrations applied.
 */
export function initializeDatabase(db: DatabaseAdapter): {
  version: number;
  migrationsApplied: number;
} {
  const migrationsApplied = runMigrations(db);
  return {
    version: SCHEMA_VERSION,
    migrationsApplied,
  };
}
