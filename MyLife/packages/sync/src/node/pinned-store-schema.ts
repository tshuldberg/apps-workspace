/**
 * Meerkat pinned-manifest schema (mk_pinned + mk_pinned_blocks), owned here so
 * the mobile and web surfaces cannot drift (the ensureShareIntakeTables model).
 *
 * mk_pinned is the manifest index for the on-device seeding store. Plan 38 D.4
 * makes it CONTEXT-AWARE: the primary key is (content_id, pin_context) so the
 * SAME contentId pinned via two communities (or the personal hub) coexists.
 * pin_context is a workspaceId, or the literal 'default' for a context-less pin.
 *
 * mk_pinned_blocks is the sealed-BLOCK refcount: one row per
 * (sealed_id, content_id, pin_context) pin that references a block. A block's
 * refcount is COUNT(*) over its sealed_id, so unpinning one context deletes only
 * the blocks no other context still references. DIFFERENT contexts sealing the
 * same plaintext produce DIFFERENT sealed blocks (different DEKs), so a block is
 * only shared when the SAME sealed object is pinned into two contexts.
 *
 * Both tables are DEVICE-LOCAL (mk_ prefix, outside MEERKAT_SYNC_PREFIXES) and
 * never replicate. pin_class (Plan 38 C.7) is taxonomy groundwork only: the
 * column and a typed reader exist; class-driven eviction is a later phase.
 */

import type { DatabaseAdapter } from '@mylife/db';

/** Canonical mk_pinned DDL (new, context-aware shape). Source of truth for both surfaces. */
export const CREATE_MK_PINNED = `
CREATE TABLE IF NOT EXISTS mk_pinned (
  content_id TEXT NOT NULL,
  pin_context TEXT NOT NULL DEFAULT 'default',
  pin_class TEXT NOT NULL DEFAULT 'explicit',
  name TEXT NOT NULL,
  size INTEGER NOT NULL,
  scope TEXT NOT NULL,
  author_public_key TEXT NOT NULL,
  manifest_signature TEXT NOT NULL,
  sealed_chunk_ids TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  total_bytes INTEGER NOT NULL DEFAULT 0,
  pinned_at TEXT NOT NULL,
  PRIMARY KEY (content_id, pin_context)
)`;

/** Canonical mk_pinned_blocks DDL (sealed-block refcount). Source of truth for both surfaces. */
export const CREATE_MK_PINNED_BLOCKS = `
CREATE TABLE IF NOT EXISTS mk_pinned_blocks (
  sealed_id TEXT NOT NULL,
  content_id TEXT NOT NULL,
  pin_context TEXT NOT NULL DEFAULT 'default',
  PRIMARY KEY (sealed_id, content_id, pin_context)
)`;

const MK_PINNED_MIGRATION_TABLE = 'mk_pinned__mig_pin_context';

interface LegacyPinnedRow {
  content_id: string;
  sealed_chunk_ids: string;
}

/**
 * Backfill mk_pinned_blocks for any pin that has no block rows yet (covers a
 * just-rebuilt table AND any pin created before the refcount table existed).
 * Idempotent: INSERT OR IGNORE on the composite PK, and each pin is skipped once
 * it already has rows.
 */
function backfillPinnedBlocks(db: DatabaseAdapter): void {
  const rows = db.query<{ content_id: string; pin_context: string; sealed_chunk_ids: string }>(
    `SELECT content_id, pin_context, sealed_chunk_ids FROM mk_pinned`,
  );
  for (const row of rows) {
    const existing = db.query<{ c: number }>(
      `SELECT COUNT(*) AS c FROM mk_pinned_blocks WHERE content_id = ? AND pin_context = ?`,
      [row.content_id, row.pin_context],
    );
    if ((existing[0]?.c ?? 0) > 0) continue;
    let sealedIds: string[];
    try {
      sealedIds = JSON.parse(row.sealed_chunk_ids) as string[];
    } catch {
      continue; // a malformed row is skipped rather than aborting the backfill
    }
    for (const sealedId of sealedIds) {
      db.execute(
        `INSERT OR IGNORE INTO mk_pinned_blocks (sealed_id, content_id, pin_context)
         VALUES (?, ?, ?)`,
        [sealedId, row.content_id, row.pin_context],
      );
    }
  }
}

/**
 * Upgrade an install whose mk_pinned predates the (content_id, pin_context) PK
 * (Plan 38 D.4). SQLite cannot ALTER a primary key, so rebuild via the proven
 * create-new / INSERT SELECT / drop / rename pattern, mapping every legacy row
 * to pin_context 'default' and pin_class 'explicit'. Idempotent: skips the
 * rebuild when pin_context already exists (fresh installs + already migrated),
 * then always ensures the refcount table + backfills any pin missing block rows.
 */
export function migrateMeerkatPinnedContext(db: DatabaseAdapter): void {
  const cols = db.query<{ name: string }>(`PRAGMA table_info(mk_pinned)`);
  if (cols.length === 0) return; // table not created yet (ensure DDL runs first)

  if (!cols.some((c) => c.name === 'pin_context')) {
    const rebuildDdl = CREATE_MK_PINNED.replace('mk_pinned', MK_PINNED_MIGRATION_TABLE).trim();
    db.transaction(() => {
      db.execute(`DROP TABLE IF EXISTS ${MK_PINNED_MIGRATION_TABLE}`);
      db.execute(rebuildDdl);
      db.execute(
        `INSERT INTO ${MK_PINNED_MIGRATION_TABLE}
           (content_id, pin_context, pin_class, name, size, scope, author_public_key,
            manifest_signature, sealed_chunk_ids, manifest_json, total_bytes, pinned_at)
         SELECT content_id, 'default', 'explicit', name, size, scope, author_public_key,
            manifest_signature, sealed_chunk_ids, manifest_json, total_bytes, pinned_at
         FROM mk_pinned`,
      );
      db.execute('DROP TABLE mk_pinned');
      db.execute(`ALTER TABLE ${MK_PINNED_MIGRATION_TABLE} RENAME TO mk_pinned`);
    });
  }

  db.execute(CREATE_MK_PINNED_BLOCKS);
  backfillPinnedBlocks(db);
}

/**
 * Create the pinned-manifest tables (new shape) and run the D.4 upgrade. Both
 * the mobile (ensureMeerkatTables) and web (ensureMeerkatTables) paths call this
 * so the schema is a single source of truth. Idempotent.
 */
export function ensureMeerkatPinnedTables(db: DatabaseAdapter): void {
  db.execute(CREATE_MK_PINNED);
  db.execute(CREATE_MK_PINNED_BLOCKS);
  migrateMeerkatPinnedContext(db);
}

// LegacyPinnedRow documents the pre-migration row shape the rebuild reads from.
export type { LegacyPinnedRow };
