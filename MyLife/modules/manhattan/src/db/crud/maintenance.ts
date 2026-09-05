import type { DatabaseAdapter } from '@mylife/db';

// Soft-deleted rows previously lived forever (2026-06-09 production eval,
// F14). Hard-delete them once they age past the retention window; foreign
// keys cascade facets and plan members when PRAGMA foreign_keys is on.
//
// Mesh-sync caveat: deleted_at doubles as the LWW tombstone. The 30-day
// window must stay comfortably longer than worst-case peer sync lag once
// Manhattan joins mesh sync, or purged tombstones could resurrect rows.
export const DEFAULT_PURGE_AFTER_DAYS = 30;

export interface PurgeResult {
  events: number;
  pins: number;
  plans: number;
}

const PURGE_TABLES = ['mh_events', 'mh_pins', 'mh_plans'] as const;

export function purgeSoftDeleted(
  db: DatabaseAdapter,
  days: number = DEFAULT_PURGE_AFTER_DAYS,
): PurgeResult {
  const modifier = `-${Math.max(1, Math.floor(days))} days`;
  const counts: number[] = [];

  for (const table of PURGE_TABLES) {
    const rows = db.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${table}
       WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', ?)`,
      [modifier],
    );
    counts.push(rows[0]?.n ?? 0);
    db.execute(
      `DELETE FROM ${table}
       WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', ?)`,
      [modifier],
    );
  }

  return { events: counts[0], pins: counts[1], plans: counts[2] };
}
