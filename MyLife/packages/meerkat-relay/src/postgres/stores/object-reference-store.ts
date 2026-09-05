/**
 * PostgreSQL-owned ObjectReferenceLedger (Plan 44 WP-2C, migration 8).
 *
 * Two tables model the register: ops.object_reference_edges holds one row per
 * (object_key, referrer) edge; ops.object_reference_keys holds the per-key rollup
 * (reference_count + the instant it last dropped to zero). Every mutation runs in a
 * transaction that keeps the rollup coherent with the edge set, and the rollup's
 * CHECK constraint (reference_count = 0 XOR unreferenced_at IS NULL) is the durable
 * guarantee that the count and the zero-marker never disagree.
 *
 * The invariants mirror the memory adapter: add/remove are idempotent per edge, a key
 * is removable only at zero references, and listUnreferenced pages the zero set by the
 * instant it went to zero. A database fault throws PostgresStoreUnavailableError via
 * toPostgresStoreUnavailableError, never a fabricated empty count.
 */

import type { QueryResult, QueryResultRow } from 'pg';
import type { PostgresStoreContext } from '../store-context';
import { toPostgresStoreUnavailableError } from '../store-context';
import {
  assertReferenceKey,
  assertReferrerId,
  assertUnreferencedLimit,
  type AddReferenceResult,
  type ObjectReference,
  type ObjectReferenceLedger,
  type RemoveReferenceResult,
  type UnreferencedCursor,
  type UnreferencedObject,
  type UnreferencedPage,
} from '../../object-reference-ledger';

interface CountRow extends QueryResultRow {
  reference_count: string | number;
}

interface ReferrerRow extends QueryResultRow {
  referrer: string;
}

interface UnreferencedRow extends QueryResultRow {
  object_key: string;
  unreferenced_at: Date | string;
}

function timestamp(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error('Invalid PostgreSQL timestamp');
  return parsed.toISOString();
}

function count(value: string | number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error('Invalid PostgreSQL reference count');
  return parsed;
}

export class PostgresObjectReferenceLedger implements ObjectReferenceLedger {
  constructor(private readonly database: PostgresStoreContext) {}

  private async query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    try {
      return await this.database.query<Row>(text, values);
    } catch (error) {
      throw toPostgresStoreUnavailableError('object reference ledger query', error);
    }
  }

  private async transaction<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await this.database.transaction(operation);
    } catch (error) {
      throw toPostgresStoreUnavailableError('object reference ledger transaction', error);
    }
  }

  async addReference(reference: ObjectReference): Promise<AddReferenceResult> {
    assertReferenceKey('object key', reference.objectKey);
    assertReferrerId('referrer', reference.referrer);
    return this.transaction(async () => {
      // Ensure a rollup row exists and lock it so concurrent edge writers serialize on it.
      await this.query(`
        INSERT INTO ops.object_reference_keys (object_key, reference_count, unreferenced_at)
        VALUES ($1, 0, clock_timestamp())
        ON CONFLICT (object_key) DO NOTHING
      `, [reference.objectKey]);
      await this.query(`
        SELECT object_key FROM ops.object_reference_keys WHERE object_key = $1 FOR UPDATE
      `, [reference.objectKey]);
      const inserted = await this.query(`
        INSERT INTO ops.object_reference_edges (object_key, referrer)
        VALUES ($1, $2)
        ON CONFLICT (object_key, referrer) DO NOTHING
      `, [reference.objectKey, reference.referrer]);
      if (inserted.rowCount === 0) {
        const current = await this.query<CountRow>(`
          SELECT reference_count FROM ops.object_reference_keys WHERE object_key = $1
        `, [reference.objectKey]);
        return { status: 'already_referenced', referenceCount: count(current.rows[0]!.reference_count) };
      }
      const updated = await this.query<CountRow>(`
        UPDATE ops.object_reference_keys
        SET reference_count = reference_count + 1,
            unreferenced_at = NULL,
            updated_at = clock_timestamp()
        WHERE object_key = $1
        RETURNING reference_count
      `, [reference.objectKey]);
      return { status: 'added', referenceCount: count(updated.rows[0]!.reference_count) };
    });
  }

  async removeReference(reference: ObjectReference): Promise<RemoveReferenceResult> {
    assertReferenceKey('object key', reference.objectKey);
    assertReferrerId('referrer', reference.referrer);
    return this.transaction(async () => {
      const locked = await this.query<CountRow>(`
        SELECT reference_count FROM ops.object_reference_keys WHERE object_key = $1 FOR UPDATE
      `, [reference.objectKey]);
      if (locked.rowCount === 0) return { status: 'not_referenced', referenceCount: 0 };
      const deleted = await this.query(`
        DELETE FROM ops.object_reference_edges WHERE object_key = $1 AND referrer = $2
      `, [reference.objectKey, reference.referrer]);
      if (deleted.rowCount === 0) {
        return { status: 'not_referenced', referenceCount: count(locked.rows[0]!.reference_count) };
      }
      const updated = await this.query<CountRow>(`
        UPDATE ops.object_reference_keys
        SET reference_count = reference_count - 1,
            unreferenced_at = CASE WHEN reference_count - 1 = 0 THEN clock_timestamp() ELSE NULL END,
            updated_at = clock_timestamp()
        WHERE object_key = $1
        RETURNING reference_count
      `, [reference.objectKey]);
      return { status: 'removed', referenceCount: count(updated.rows[0]!.reference_count) };
    });
  }

  async isReferenced(objectKey: string): Promise<boolean> {
    return (await this.referenceCount(objectKey)) > 0;
  }

  async referenceCount(objectKey: string): Promise<number> {
    assertReferenceKey('object key', objectKey);
    const result = await this.query<CountRow>(`
      SELECT reference_count FROM ops.object_reference_keys WHERE object_key = $1
    `, [objectKey]);
    return result.rows[0] ? count(result.rows[0].reference_count) : 0;
  }

  async listReferrers(objectKey: string): Promise<string[]> {
    assertReferenceKey('object key', objectKey);
    const result = await this.query<ReferrerRow>(`
      SELECT referrer FROM ops.object_reference_edges
      WHERE object_key = $1
      ORDER BY referrer ASC
    `, [objectKey]);
    return result.rows.map((row) => row.referrer);
  }

  async listUnreferenced(input: {
    after?: UnreferencedCursor;
    limit: number;
  }): Promise<UnreferencedPage> {
    assertUnreferencedLimit(input.limit);
    if (input.after) assertReferenceKey('unreferenced cursor key', input.after.objectKey);
    const result = await this.query<UnreferencedRow>(`
      SELECT object_key, unreferenced_at
      FROM ops.object_reference_keys
      WHERE reference_count = 0
        AND unreferenced_at IS NOT NULL
        AND (
          $1::timestamptz IS NULL
          OR (unreferenced_at, object_key) > ($1::timestamptz, $2::text)
        )
      ORDER BY unreferenced_at ASC, object_key ASC
      LIMIT $3
    `, [
      input.after ? timestamp(input.after.unreferencedAt) : null,
      input.after ? input.after.objectKey : null,
      input.limit + 1,
    ]);
    const rows: UnreferencedObject[] = result.rows.slice(0, input.limit).map((row) => ({
      objectKey: row.object_key,
      unreferencedAt: timestamp(row.unreferenced_at),
    }));
    const hasMore = result.rows.length > input.limit;
    const last = rows.at(-1);
    return {
      entries: rows,
      nextCursor: hasMore && last
        ? { unreferencedAt: last.unreferencedAt, objectKey: last.objectKey }
        : null,
    };
  }
}
