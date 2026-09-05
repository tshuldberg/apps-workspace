/**
 * PostgreSQL-backed pin-reconcile cursor (Plan 43 WP-43B follow-up, migration 14).
 *
 * The always-on archive seeder resumes its fenced pin reconciliation from this durable
 * cursor: a crash mid-scan, or a host with more pins than one tick's bound, continues in
 * place instead of restarting from the first page every tick. Only the fenced
 * ops.job_leases lease authorizes writing; this table just remembers WHERE the current
 * winner got to. The cursor is the reconciler's structured {pinCursor, servingCursor}
 * pair stored as jsonb; a malformed persisted value reads as null (restart from the top,
 * fail-safe for a resumable scan) rather than crashing the drain loop.
 *
 * A database fault throws PostgresStoreUnavailableError, never a fabricated result.
 */

import type { QueryResult, QueryResultRow } from 'pg';
import type { PostgresStoreContext } from '../store-context';
import { toPostgresStoreUnavailableError } from '../store-context';
import type { PinReconcileCursor, PinReconcileCursorStore } from '../../archive-pin-reconciler';

const SCAN_ID = /^[A-Za-z0-9_.:-]{1,128}$/u;
const SAFE_CURSOR_ID = /^[A-Za-z0-9_.:@/-]{1,512}$/u;

interface PinCursorRow extends QueryResultRow {
  cursor: unknown;
}

/** True when `value` is a well-formed persisted PinReconcileCursor. */
function isPinReconcileCursor(value: unknown): value is PinReconcileCursor {
  if (typeof value !== 'object' || value === null) return false;
  const cursor = value as Partial<PinReconcileCursor>;
  const pinOk = cursor.pinCursor === null
    || (typeof cursor.pinCursor === 'object' && cursor.pinCursor !== null
      && typeof cursor.pinCursor.publicationId === 'string'
      && SAFE_CURSOR_ID.test(cursor.pinCursor.publicationId));
  const servingOk = cursor.servingCursor === null
    || (typeof cursor.servingCursor === 'string' && SAFE_CURSOR_ID.test(cursor.servingCursor));
  return pinOk && servingOk
    && 'pinCursor' in cursor && 'servingCursor' in cursor;
}

export class PostgresPinReconcileCursorStore implements PinReconcileCursorStore {
  constructor(private readonly database: PostgresStoreContext) {}

  private async query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    try {
      return await this.database.query<Row>(text, values);
    } catch (error) {
      throw toPostgresStoreUnavailableError('archive pin cursor store query', error);
    }
  }

  async loadCursor(scanId: string): Promise<PinReconcileCursor | null> {
    if (!SCAN_ID.test(scanId)) throw new TypeError('archive pin reconcile scan id is invalid');
    const result = await this.query<PinCursorRow>(`
      SELECT cursor FROM ops.archive_pin_reconcile_runs WHERE scan_id = $1
    `, [scanId]);
    const row = result.rows[0];
    if (!row || row.cursor === null || row.cursor === undefined) return null;
    return isPinReconcileCursor(row.cursor) ? row.cursor : null;
  }

  async saveCursor(scanId: string, cursor: PinReconcileCursor): Promise<void> {
    if (!SCAN_ID.test(scanId)) throw new TypeError('archive pin reconcile scan id is invalid');
    if (!isPinReconcileCursor(cursor)) {
      throw new TypeError('archive pin reconcile cursor is malformed');
    }
    await this.query(`
      INSERT INTO ops.archive_pin_reconcile_runs (scan_id, cursor, updated_at)
      VALUES ($1, $2::jsonb, clock_timestamp())
      ON CONFLICT (scan_id) DO UPDATE
      SET cursor = EXCLUDED.cursor,
          updated_at = clock_timestamp()
    `, [scanId, JSON.stringify(cursor)]);
  }
}
