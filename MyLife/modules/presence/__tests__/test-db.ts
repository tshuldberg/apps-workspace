import Database from 'better-sqlite3';
import type { DatabaseAdapter } from '@mylife/db';
import { ALL_TABLES, CREATE_INDEXES, SEED_SETTINGS, V2_INDEXES, V2_TABLES } from '../src/db/schema';

export function createTestAdapter(): DatabaseAdapter {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const adapter: DatabaseAdapter = {
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

  for (const sql of ALL_TABLES) adapter.execute(sql);
  for (const sql of CREATE_INDEXES) adapter.execute(sql);
  for (const sql of SEED_SETTINGS) adapter.execute(sql);
  for (const sql of V2_TABLES) adapter.execute(sql);
  for (const sql of V2_INDEXES) adapter.execute(sql);

  return adapter;
}
