import Database from 'better-sqlite3';
import type { Database as RawSqliteDatabase } from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  initializeHubDatabase,
  runModuleMigrations,
  type DatabaseAdapter,
} from '@mylife/db';
import { SLEEP_MIGRATIONS } from '../db';

function createAdapter(db: RawSqliteDatabase): DatabaseAdapter {
  return {
    execute(sql: string, params?: unknown[]): void {
      db.prepare(sql).run(...(params ?? []));
    },
    query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
      return db.prepare(sql).all(...(params ?? [])) as T[];
    },
    transaction(fn: () => void): void {
      db.transaction(fn)();
    },
  };
}

describe('sleep schema', () => {
  it('creates all v4 tables, triggers, and records schema version', () => {
    const sqlite = new Database(':memory:');
    const adapter = createAdapter(sqlite);

    initializeHubDatabase(adapter);
    const applied = runModuleMigrations(adapter, 'sleep', SLEEP_MIGRATIONS);

    expect(applied).toBe(4);

    const tables = adapter
      .query<{ name: string }>(
        `SELECT name
         FROM sqlite_master
         WHERE type = 'table'
           AND name LIKE 'sl_%'
           AND name NOT LIKE 'sl_dreams_fts_%'
         ORDER BY name`,
      )
      .map((row) => row.name);

    expect(tables).toEqual([
      'sl_dreams',
      'sl_dreams_fts',
      'sl_factors',
      'sl_goals',
      'sl_hygiene_checks',
      'sl_naps',
      'sl_settings',
      'sl_sleep_entries',
      'sl_streak_history',
      'sl_streaks',
    ]);

    const triggers = adapter
      .query<{ name: string }>(
        `SELECT name
         FROM sqlite_master
         WHERE type = 'trigger'
           AND name LIKE 'sl_dreams_fts_%'
         ORDER BY name`,
      )
      .map((row) => row.name);
    expect(triggers).toEqual([
      'sl_dreams_fts_delete',
      'sl_dreams_fts_insert',
      'sl_dreams_fts_update',
    ]);

    const settings = adapter.query<{ key: string; value: string }>(
      'SELECT key, value FROM sl_settings ORDER BY key',
    );
    expect(settings).toEqual([
      { key: 'bridge.habits.enabled', value: 'false' },
      { key: 'bridge.health.enabled', value: 'false' },
      { key: 'bridge.mood.enabled', value: 'false' },
      {
        key: 'sleep.hygiene.enabledPractices',
        value:
          '["no_caffeine_after_2pm","no_screens_1h","consistent_bedtime_30m","cool_dark_room","no_alcohol_3h","exercise_timing","relaxation_routine","no_heavy_meals_2h"]',
      },
      { key: 'sleep.targetHours', value: '8' },
    ]);

    const versions = adapter.query<{ module_id: string; version: number }>(
      `SELECT module_id, version
       FROM hub_schema_versions
       WHERE module_id = ?
       ORDER BY version ASC`,
      ['sleep'],
    );
    expect(versions).toEqual([
      { module_id: 'sleep', version: 1 },
      { module_id: 'sleep', version: 2 },
      { module_id: 'sleep', version: 3 },
      { module_id: 'sleep', version: 4 },
    ]);

    sqlite.close();
  });
});
