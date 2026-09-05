import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  createInMemoryTestDatabase,
  initializeHubDatabase,
  runModuleMigrations,
} from '@mylife/db';
import { HABITS_MODULE } from '../definition';

/**
 * Phase 0 Fix 1 regression coverage.
 *
 * V8 dropped the deprecated cycle-tracking tables (hb_periods,
 * hb_period_symptoms, hb_predictions, hb_cycle_settings). Cycle tracking now
 * lives in @mylife/cycle with cy_* tables. These tests lock in:
 *
 *   1. A fresh install running V1 through V8 creates the expected habits
 *      tables and does NOT materialize any deprecated cycle tables, even
 *      though earlier migrations referenced them historically.
 *   2. Upgrading an existing user (who already has hb_periods /
 *      hb_period_symptoms from a pre-V8 install) to V8 drops those tables
 *      while preserving non-cycle habit data.
 */

const habitsMigrations = HABITS_MODULE.migrations!;

type SqliteMasterRow = { name: string };

function tableExists(adapter: DatabaseAdapter, tableName: string): boolean {
  const rows = adapter.query<SqliteMasterRow>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [tableName],
  );
  return rows.length > 0;
}

function getSchemaVersion(adapter: DatabaseAdapter, moduleId: string): number {
  const rows = adapter.query<{ version: number | null }>(
    `SELECT MAX(version) as version FROM hub_schema_versions WHERE module_id = ?`,
    [moduleId],
  );
  return rows[0]?.version ?? 0;
}

describe('@mylife/habits migrations (Phase 0 Fix 1)', () => {
  let adapter: DatabaseAdapter;
  let close: () => void;

  beforeEach(() => {
    const db = createInMemoryTestDatabase();
    adapter = db.adapter;
    close = db.close;
    initializeHubDatabase(adapter);
  });

  afterEach(() => {
    close();
  });

  it('fresh install V1 through V8 creates expected tables and skips deprecated cycle tables', () => {
    const applied = runModuleMigrations(adapter, 'habits', habitsMigrations);
    expect(applied).toBe(8);

    // Required habits tables.
    const expectedTables = [
      'hb_habits',
      'hb_completions',
      'hb_settings',
      'hb_timed_sessions',
      'hb_measurements',
      'hb_sobriety_profiles',
      'hb_areas',
      'hb_reminders',
    ];
    for (const table of expectedTables) {
      expect(tableExists(adapter, table)).toBe(true);
    }

    // Deprecated cycle tracking tables must NOT exist on fresh install.
    const deprecatedTables = [
      'hb_periods',
      'hb_period_symptoms',
      'hb_predictions',
      'hb_cycle_settings',
    ];
    for (const table of deprecatedTables) {
      expect(tableExists(adapter, table)).toBe(false);
    }

    // Final recorded schema version is 8.
    expect(getSchemaVersion(adapter, 'habits')).toBe(8);
  });

  it('V7 to V8 upgrade drops deprecated cycle tables and preserves habits data', () => {
    // Simulate an existing user who ran V1 through V7 before the cleanup.
    const v1ThroughV7 = habitsMigrations.filter((m) => m.version <= 7);
    const appliedInitial = runModuleMigrations(adapter, 'habits', v1ThroughV7);
    expect(appliedInitial).toBe(7);
    expect(getSchemaVersion(adapter, 'habits')).toBe(7);

    // Re-create the cycle tables manually to simulate a pre-Fix-1 install
    // where V2 historically created them.
    adapter.execute(
      `CREATE TABLE hb_periods (id TEXT PRIMARY KEY, start_date TEXT)`,
    );
    adapter.execute(
      `CREATE TABLE hb_period_symptoms (id TEXT PRIMARY KEY, period_id TEXT, date TEXT)`,
    );

    // Seed one habit and one legacy period row.
    adapter.execute(
      `INSERT INTO hb_habits (id, name) VALUES (?, ?)`,
      ['h1', 'Meditate'],
    );
    adapter.execute(
      `INSERT INTO hb_periods (id, start_date) VALUES (?, ?)`,
      ['p1', '2026-01-01'],
    );

    // Sanity: both pre-upgrade rows exist.
    expect(tableExists(adapter, 'hb_periods')).toBe(true);
    expect(tableExists(adapter, 'hb_period_symptoms')).toBe(true);
    const preHabitRows = adapter.query<{ name: string }>(
      `SELECT name FROM hb_habits WHERE id = ?`,
      ['h1'],
    );
    expect(preHabitRows).toHaveLength(1);
    expect(preHabitRows[0].name).toBe('Meditate');

    // Run the V8 migration.
    const appliedV8 = runModuleMigrations(adapter, 'habits', habitsMigrations);
    expect(appliedV8).toBe(1);
    expect(getSchemaVersion(adapter, 'habits')).toBe(8);

    // Habit data survives the upgrade.
    const postHabitRows = adapter.query<{ name: string }>(
      `SELECT name FROM hb_habits WHERE id = ?`,
      ['h1'],
    );
    expect(postHabitRows).toHaveLength(1);
    expect(postHabitRows[0].name).toBe('Meditate');

    // Deprecated cycle tables are gone.
    expect(tableExists(adapter, 'hb_periods')).toBe(false);
    expect(tableExists(adapter, 'hb_period_symptoms')).toBe(false);
    expect(tableExists(adapter, 'hb_predictions')).toBe(false);
    expect(tableExists(adapter, 'hb_cycle_settings')).toBe(false);
  });
});
