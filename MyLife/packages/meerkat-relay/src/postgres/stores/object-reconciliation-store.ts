/**
 * PostgreSQL-owned reconciliation bookkeeping (Plan 44 WP-2C, migration 8).
 *
 * Two small durable stores the leased reconciler needs beyond the object store and
 * reference ledger:
 *  - PostgresOrphanFirstSeenStore records, in ops.object_orphan_sightings, the instant a
 *    never-referenced store object was first observed, so the grace window is measured
 *    from a durable first sighting that survives a crash mid-scan (a fresh run must not
 *    reset the clock and re-grace an object forever). first_seen is a record-if-absent
 *    upsert returning the persisted instant.
 *  - PostgresReconcileCursorStore persists the resumable inventory cursor per scan id in
 *    ops.object_reconciliation_runs, written under the reconciler's live lease.
 *
 * A database fault throws PostgresStoreUnavailableError, never a fabricated result.
 */

import type { QueryResult, QueryResultRow } from 'pg';
import type { PostgresStoreContext } from '../store-context';
import { toPostgresStoreUnavailableError } from '../store-context';
import { assertReferenceKey } from '../../object-reference-ledger';
import type { OrphanFirstSeenStore } from '../../object-reconciler';
import type { ReconcileCursorStore } from '../../object-reconciler-leased';
import type { ObjectInventoryCursor } from '../../object-store';

const SCAN_ID = /^[A-Za-z0-9_.:-]{1,128}$/u;

interface FirstSeenRow extends QueryResultRow {
  first_seen_at: Date | string;
}

interface CursorRow extends QueryResultRow {
  cursor_key: string | null;
}

function instant(value: Date | string): number {
  const parsed = value instanceof Date ? value : new Date(value);
  const ms = parsed.getTime();
  if (!Number.isFinite(ms)) throw new Error('Invalid PostgreSQL timestamp');
  return ms;
}

export class PostgresOrphanFirstSeenStore implements OrphanFirstSeenStore {
  constructor(private readonly database: PostgresStoreContext) {}

  private async query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    try {
      return await this.database.query<Row>(text, values);
    } catch (error) {
      throw toPostgresStoreUnavailableError('orphan first-seen store query', error);
    }
  }

  async firstSeen(objectKey: string, _nowMs: number): Promise<number> {
    assertReferenceKey('object key', objectKey);
    // Record-if-absent, then return the persisted instant. clock_timestamp() is the
    // durable authority; the caller's nowMs is ignored so two runs agree on the age.
    const result = await this.query<FirstSeenRow>(`
      INSERT INTO ops.object_orphan_sightings (object_key)
      VALUES ($1)
      ON CONFLICT (object_key) DO UPDATE SET object_key = EXCLUDED.object_key
      RETURNING first_seen_at
    `, [objectKey]);
    return instant(result.rows[0]!.first_seen_at);
  }

  async clear(objectKey: string): Promise<void> {
    assertReferenceKey('object key', objectKey);
    await this.query(`DELETE FROM ops.object_orphan_sightings WHERE object_key = $1`, [objectKey]);
  }
}

export class PostgresReconcileCursorStore implements ReconcileCursorStore {
  constructor(private readonly database: PostgresStoreContext) {}

  private async query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    try {
      return await this.database.query<Row>(text, values);
    } catch (error) {
      throw toPostgresStoreUnavailableError('reconcile cursor store query', error);
    }
  }

  async loadCursor(scanId: string): Promise<ObjectInventoryCursor | null> {
    if (!SCAN_ID.test(scanId)) throw new TypeError('reconcile scan id is invalid');
    const result = await this.query<CursorRow>(`
      SELECT cursor_key FROM ops.object_reconciliation_runs WHERE scan_id = $1
    `, [scanId]);
    const row = result.rows[0];
    return row && row.cursor_key !== null ? { key: row.cursor_key } : null;
  }

  async saveCursor(
    scanId: string,
    cursor: ObjectInventoryCursor | null,
    entriesScanned: number,
  ): Promise<void> {
    if (!SCAN_ID.test(scanId)) throw new TypeError('reconcile scan id is invalid');
    if (cursor) assertReferenceKey('reconcile cursor key', cursor.key);
    if (!Number.isSafeInteger(entriesScanned) || entriesScanned < 0) {
      throw new TypeError('reconcile entriesScanned must be a non-negative integer');
    }
    await this.query(`
      INSERT INTO ops.object_reconciliation_runs (scan_id, cursor_key, entries_scanned, updated_at)
      VALUES ($1, $2, $3, clock_timestamp())
      ON CONFLICT (scan_id) DO UPDATE
      SET cursor_key = EXCLUDED.cursor_key,
          entries_scanned = ops.object_reconciliation_runs.entries_scanned + EXCLUDED.entries_scanned,
          updated_at = clock_timestamp()
    `, [scanId, cursor ? cursor.key : null, entriesScanned]);
  }
}
