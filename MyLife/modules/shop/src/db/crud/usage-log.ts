import type { DatabaseAdapter } from '@mylife/db';
import {
  UsageLogEntrySchema,
  UsageLogInputSchema,
  type UsageLogEntry,
  type UsageLogInput,
} from '../../models/schemas';

function randomId(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

function rowToEntry(row: Record<string, unknown>): UsageLogEntry {
  return UsageLogEntrySchema.parse({
    id: row.id,
    purchaseId: row.purchase_id,
    usedAt: Number(row.used_at),
    notes: row.notes ?? null,
    createdAt: Number(row.created_at),
  });
}

/**
 * Log a single use of a purchase. Defaults `usedAt` to now (ms epoch) when not
 * provided. Returns the persisted entry.
 */
export function logUse(
  db: DatabaseAdapter,
  rawInput: UsageLogInput,
): UsageLogEntry {
  const input = UsageLogInputSchema.parse(rawInput);
  const id = randomId();
  const now = Date.now();
  const usedAt = input.usedAt ?? now;

  db.execute(
    `INSERT INTO sh_usage_log (id, purchase_id, used_at, notes, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, input.purchaseId, usedAt, input.notes ?? null, now],
  );

  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sh_usage_log WHERE id = ?`,
    [id],
  );
  return rowToEntry(rows[0]!);
}

/**
 * Count all usage entries for a purchase.
 */
export function getUsageCount(
  db: DatabaseAdapter,
  purchaseId: string,
): number {
  const rows = db.query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM sh_usage_log WHERE purchase_id = ?`,
    [purchaseId],
  );
  return Number(rows[0]?.count ?? 0);
}

/**
 * Usage history ordered by usedAt desc (most recent first). Optional `limit`
 * defaults to 500.
 */
export function getUsageHistory(
  db: DatabaseAdapter,
  purchaseId: string,
  opts: { limit?: number } = {},
): UsageLogEntry[] {
  const limit = opts.limit ?? 500;
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sh_usage_log
         WHERE purchase_id = ?
         ORDER BY used_at DESC, created_at DESC
         LIMIT ?`,
      [purchaseId, limit],
    )
    .map(rowToEntry);
}

/**
 * Delete a single usage entry by id. Returns true if a row was removed.
 */
export function deleteUsageEntry(db: DatabaseAdapter, id: string): boolean {
  const rows = db.query<Record<string, unknown>>(
    `SELECT id FROM sh_usage_log WHERE id = ?`,
    [id],
  );
  if (!rows[0]) return false;
  db.execute(`DELETE FROM sh_usage_log WHERE id = ?`, [id]);
  return true;
}
