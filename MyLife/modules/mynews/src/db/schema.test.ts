import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { ALL_TABLES, CREATE_INDEXES, MYNEWS_TABLE_NAMES } from './schema';

function freshDb() {
  const db = new Database(':memory:');
  for (const ddl of ALL_TABLES) db.exec(ddl);
  for (const idx of CREATE_INDEXES) db.exec(idx);
  return db;
}

describe('mynews local schema', () => {
  it('creates all nw_ tables', () => {
    const db = freshDb();
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'nw_%'")
      .all() as Array<{ name: string }>;
    expect(rows.map((r) => r.name).sort()).toEqual([...MYNEWS_TABLE_NAMES].sort());
  });

  it('enforces unique follow per journalist key', () => {
    const db = freshDb();
    const ins = db.prepare(
      'INSERT INTO nw_follows (id, journalist_key, handle, created_at) VALUES (?, ?, ?, ?)',
    );
    ins.run('f1', 'k1', 'rosa', '2026-07-03T00:00:00Z');
    expect(() => ins.run('f2', 'k1', 'rosa', '2026-07-03T00:00:01Z')).toThrow();
  });

  it('is idempotent (IF NOT EXISTS)', () => {
    const db = freshDb();
    for (const ddl of ALL_TABLES) db.exec(ddl);
    expect(true).toBe(true);
  });
});
