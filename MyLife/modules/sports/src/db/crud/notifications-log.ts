import type { DatabaseAdapter } from '@mylife/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Local-notification event kinds. Mirrors the CHECK constraint in V3. */
export type NotificationEventType =
  | 'start'
  | 'final'
  | 'close'
  | 'overtime'
  | 'rival_loss'
  | 'trade';

/** One row in sp_notifications_log. */
export interface NotificationLogEntry {
  id: string;
  team_id: string;
  game_id: string | null;
  event_type: NotificationEventType;
  fired_at: number;
  title: string;
  body: string | null;
  payload_json: string | null;
}

interface NotificationLogRow {
  id: string;
  team_id: string;
  game_id: string | null;
  event_type: NotificationEventType;
  fired_at: number;
  title: string;
  body: string | null;
  payload_json: string | null;
}

function rowToEntry(row: NotificationLogRow): NotificationLogEntry {
  return {
    id: row.id,
    team_id: row.team_id,
    game_id: row.game_id ?? null,
    event_type: row.event_type,
    fired_at: row.fired_at,
    title: row.title,
    body: row.body ?? null,
    payload_json: row.payload_json ?? null,
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Record that a notification has been (or is about to be) dispatched.
 *
 * Uses `INSERT OR IGNORE` against the composite unique index
 * `(team_id, game_id, event_type)`. Returns `inserted: false` when the
 * same triple has already been recorded, so the caller can skip a
 * duplicate dispatch cheaply without a pre-SELECT.
 */
export function recordNotification(
  db: DatabaseAdapter,
  entry: NotificationLogEntry,
): { inserted: boolean } {
  const before = db.query<{ c: number }>(
    `SELECT COUNT(*) as c FROM sp_notifications_log
     WHERE team_id = ? AND ${entry.game_id === null ? 'game_id IS NULL' : 'game_id = ?'} AND event_type = ?`,
    entry.game_id === null
      ? [entry.team_id, entry.event_type]
      : [entry.team_id, entry.game_id, entry.event_type],
  );
  const existed = (before[0]?.c ?? 0) > 0;
  if (existed) return { inserted: false };

  db.execute(
    `INSERT OR IGNORE INTO sp_notifications_log (
      id, team_id, game_id, event_type, fired_at, title, body, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.team_id,
      entry.game_id,
      entry.event_type,
      entry.fired_at,
      entry.title,
      entry.body,
      entry.payload_json,
    ],
  );

  const after = db.query<{ c: number }>(
    `SELECT COUNT(*) as c FROM sp_notifications_log
     WHERE team_id = ? AND ${entry.game_id === null ? 'game_id IS NULL' : 'game_id = ?'} AND event_type = ?`,
    entry.game_id === null
      ? [entry.team_id, entry.event_type]
      : [entry.team_id, entry.game_id, entry.event_type],
  );
  return { inserted: (after[0]?.c ?? 0) > 0 };
}

/** Delete log rows older than the given cutoff. Returns number removed. */
export function pruneOlderThan(db: DatabaseAdapter, cutoffMs: number): number {
  const before = db.query<{ c: number }>(
    'SELECT COUNT(*) as c FROM sp_notifications_log WHERE fired_at < ?',
    [cutoffMs],
  );
  const count = before[0]?.c ?? 0;
  db.execute('DELETE FROM sp_notifications_log WHERE fired_at < ?', [cutoffMs]);
  return count;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface ListRecentNotificationsOptions {
  teamId?: string;
  limit?: number;
}

/**
 * List recent notification log entries, most recent first.
 * Defaults to the 100 most recent rows; pass `teamId` to filter.
 */
export function listRecentNotifications(
  db: DatabaseAdapter,
  opts: ListRecentNotificationsOptions = {},
): NotificationLogEntry[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.teamId) {
    where.push('team_id = ?');
    params.push(opts.teamId);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const limit = opts.limit ?? 100;
  return db
    .query<NotificationLogRow>(
      `SELECT * FROM sp_notifications_log
       ${whereClause}
       ORDER BY fired_at DESC
       LIMIT ?`,
      [...params, limit],
    )
    .map(rowToEntry);
}
