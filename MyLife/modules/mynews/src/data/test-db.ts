import Database from 'better-sqlite3';
import type { DatabaseAdapter } from '@mylife/db';
import { ALL_TABLES, CREATE_INDEXES } from '../db/schema';

/** better-sqlite3-backed DatabaseAdapter for module tests. */
export function createTestDb(): DatabaseAdapter {
  const db = new Database(':memory:');
  for (const ddl of ALL_TABLES) db.exec(ddl);
  for (const idx of CREATE_INDEXES) db.exec(idx);
  return {
    execute(sql, params = []) {
      db.prepare(sql).run(...(params as []));
    },
    query(sql, params = []) {
      return db.prepare(sql).all(...(params as [])) as never;
    },
    transaction(fn) {
      db.transaction(fn)();
    },
  };
}
