/**
 * Changeset types for P2P sync.
 *
 * A changeset represents a batch of table row changes to send
 * between devices. Uses last-write-wins conflict resolution
 * based on updated_at timestamps.
 */

import type { DatabaseAdapter } from '@mylife/db';

/** A single row change in a changeset. */
export interface RowChange {
  /** The operation that produced this change. */
  operation: 'insert' | 'update' | 'delete';
  /** The table this row belongs to (with prefix, e.g. 'bk_books'). */
  table: string;
  /** The primary key value(s) identifying the row. */
  primaryKey: Record<string, unknown>;
  /** The full row data (null for deletes). */
  data: Record<string, unknown> | null;
  /** ISO 8601 timestamp for conflict resolution. */
  updatedAt: string;
}

/** A batch of changes to sync between devices. */
export interface Changeset {
  /** Unique ID for this changeset. */
  id: string;
  /** Device ID of the sender. */
  sourceDeviceId: string;
  /** ISO 8601 timestamp when the changeset was created. */
  createdAt: string;
  /** The individual row changes. */
  changes: RowChange[];
}

/**
 * Apply a received changeset to the local database using last-write-wins.
 *
 * For each change:
 * - INSERT: insert if row doesn't exist, or update if local updated_at is older
 * - UPDATE: update if local updated_at is older than incoming
 * - DELETE: delete if local updated_at is older than incoming
 */
export function applyChangeset(
  db: DatabaseAdapter,
  changeset: Changeset,
): { applied: number; skipped: number } {
  let applied = 0;
  let skipped = 0;

  db.transaction(() => {
    for (const change of changeset.changes) {
      const wasApplied = applySingleChange(db, change);
      if (wasApplied) {
        applied++;
      } else {
        skipped++;
      }
    }
  });

  return { applied, skipped };
}

function applySingleChange(db: DatabaseAdapter, change: RowChange): boolean {
  const pkClauses = Object.entries(change.primaryKey)
    .map(([col]) => `${col} = ?`)
    .join(' AND ');
  const pkValues = Object.values(change.primaryKey);

  // Check if row exists and get its updated_at
  const existing = db.query<{ updated_at: string }>(
    `SELECT updated_at FROM ${change.table} WHERE ${pkClauses}`,
    pkValues,
  );

  const localUpdatedAt = existing[0]?.updated_at;

  if (change.operation === 'delete') {
    if (!localUpdatedAt) return false; // Already gone
    if (localUpdatedAt > change.updatedAt) return false; // Local is newer
    db.execute(`DELETE FROM ${change.table} WHERE ${pkClauses}`, pkValues);
    return true;
  }

  if (!change.data) return false;

  if (!localUpdatedAt) {
    // Row doesn't exist locally -- insert
    const cols = Object.keys(change.data);
    const placeholders = cols.map(() => '?').join(', ');
    db.execute(
      `INSERT INTO ${change.table} (${cols.join(', ')}) VALUES (${placeholders})`,
      Object.values(change.data),
    );
    return true;
  }

  // Row exists -- last-write-wins
  if (localUpdatedAt >= change.updatedAt) return false;

  // Build SET clause and values in a single pass (avoids iterating keys twice).
  const setClauses: string[] = [];
  const setValues: unknown[] = [];
  for (const col of Object.keys(change.data)) {
    if (!Object.hasOwn(change.primaryKey, col)) {
      setClauses.push(`${col} = ?`);
      setValues.push(change.data[col]);
    }
  }

  if (setClauses.length === 0) return false;

  db.execute(
    `UPDATE ${change.table} SET ${setClauses.join(', ')} WHERE ${pkClauses}`,
    [...setValues, ...pkValues],
  );
  return true;
}
