/**
 * mk_pinned context migration + refcount schema (Plan 38 D.4).
 *
 * ensureMeerkatPinnedTables owns the mk_pinned (content_id, pin_context) PK
 * shape + the mk_pinned_blocks sealed-block refcount table, shared by the mobile
 * and web surfaces so they cannot drift. This proves an install whose mk_pinned
 * predates pin_context is rebuilt in place (rows preserved as pin_context
 * 'default' / pin_class 'explicit', junction backfilled), that it is idempotent,
 * and that a fresh install lands the new shape directly.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  ensureMeerkatPinnedTables,
  migrateMeerkatPinnedContext,
} from '../pinned-store-schema';

const OLD_MK_PINNED = `
CREATE TABLE mk_pinned (
  content_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  scope TEXT NOT NULL,
  author_public_key TEXT NOT NULL,
  manifest_signature TEXT NOT NULL,
  sealed_chunk_ids TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  total_bytes INTEGER NOT NULL DEFAULT 0,
  pinned_at TEXT NOT NULL
)`;

function insertLegacyPin(db: InMemoryTestDatabase, contentId: string, chunkIds: string[]): void {
  db.adapter.execute(
    `INSERT INTO mk_pinned
       (content_id, name, size, scope, author_public_key, manifest_signature,
        sealed_chunk_ids, manifest_json, total_bytes, pinned_at)
     VALUES (?, 'doc', 3, 'device_local', 'pub', 'sig', ?, '{}', 30, '2026-07-01T00:00:00.000Z')`,
    [contentId, JSON.stringify(chunkIds)],
  );
}

function columnNames(db: InMemoryTestDatabase, table: string): string[] {
  return db.adapter
    .query<{ name: string }>(`PRAGMA table_info(${table})`)
    .map((c) => c.name);
}

describe('ensureMeerkatPinnedTables: pin-context migration (Plan 38 D.4)', () => {
  let db: InMemoryTestDatabase;
  afterEach(() => { db.close(); });

  it('rebuilds a pre-pin_context mk_pinned, preserving rows as default/explicit', () => {
    db = createInMemoryTestDatabase();
    db.adapter.execute(OLD_MK_PINNED);
    insertLegacyPin(db, 'cid-1', ['blk-a', 'blk-b']);

    // Before: the old shape cannot express two contexts (content_id is the PK).
    expect(columnNames(db, 'mk_pinned')).not.toContain('pin_context');

    ensureMeerkatPinnedTables(db.adapter);

    // The row survived with the default context + explicit class.
    const rows = db.adapter.query<{ content_id: string; pin_context: string; pin_class: string; total_bytes: number }>(
      `SELECT content_id, pin_context, pin_class, total_bytes FROM mk_pinned`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      content_id: 'cid-1',
      pin_context: 'default',
      pin_class: 'explicit',
      total_bytes: 30,
    });

    // The refcount junction was backfilled for each sealed chunk.
    const junction = db.adapter.query<{ sealed_id: string; pin_context: string }>(
      `SELECT sealed_id, pin_context FROM mk_pinned_blocks ORDER BY sealed_id`,
    );
    expect(junction).toEqual([
      { sealed_id: 'blk-a', pin_context: 'default' },
      { sealed_id: 'blk-b', pin_context: 'default' },
    ]);

    // The new PK admits the SAME contentId under a second context.
    expect(() =>
      db.adapter.execute(
        `INSERT INTO mk_pinned
           (content_id, pin_context, pin_class, name, size, scope, author_public_key,
            manifest_signature, sealed_chunk_ids, manifest_json, total_bytes, pinned_at)
         VALUES ('cid-1', 'ws-b', 'explicit', 'doc', 3, 'device_local', 'pub', 'sig', '[]', '{}', 30, '2026-07-02T00:00:00.000Z')`,
      ),
    ).not.toThrow();
  });

  it('is idempotent: a second ensure/migrate does not drop rows or duplicate junction', () => {
    db = createInMemoryTestDatabase();
    db.adapter.execute(OLD_MK_PINNED);
    insertLegacyPin(db, 'cid-1', ['blk-a', 'blk-b']);

    ensureMeerkatPinnedTables(db.adapter);
    ensureMeerkatPinnedTables(db.adapter);
    migrateMeerkatPinnedContext(db.adapter);

    expect(db.adapter.query<{ c: number }>(`SELECT COUNT(*) AS c FROM mk_pinned`)[0]!.c).toBe(1);
    expect(db.adapter.query<{ c: number }>(`SELECT COUNT(*) AS c FROM mk_pinned_blocks`)[0]!.c).toBe(2);
  });

  it('creates the new shape directly on a fresh install (no rebuild needed)', () => {
    db = createInMemoryTestDatabase();
    ensureMeerkatPinnedTables(db.adapter);
    expect(columnNames(db, 'mk_pinned')).toContain('pin_context');
    expect(columnNames(db, 'mk_pinned')).toContain('pin_class');
    expect(columnNames(db, 'mk_pinned_blocks')).toEqual(['sealed_id', 'content_id', 'pin_context']);
    // No rows to migrate.
    expect(db.adapter.query<{ c: number }>(`SELECT COUNT(*) AS c FROM mk_pinned`)[0]!.c).toBe(0);
  });

  it('no-ops when mk_pinned does not exist yet', () => {
    db = createInMemoryTestDatabase();
    // migrate before any create: must not throw (table not created yet).
    expect(() => migrateMeerkatPinnedContext(db.adapter)).not.toThrow();
  });
});
