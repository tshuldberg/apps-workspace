import type { DatabaseAdapter } from '@mylife/db';
import type { ActiveFast, Fast } from '../types';

/** Row shape from the ft_fasts table */
interface FastRow {
  id: string;
  protocol: string;
  target_hours: number;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  hit_target: number | null;
  notes: string | null;
  created_at: string;
}

/** Row shape from the ft_active_fast table */
interface ActiveFastRow {
  id: string;
  fast_id: string;
  protocol: string;
  target_hours: number;
  started_at: string;
}

function rowToFast(row: FastRow): Fast {
  return {
    id: row.id,
    protocol: row.protocol,
    targetHours: row.target_hours,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    hitTarget: row.hit_target === null ? null : row.hit_target === 1,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function rowToActiveFast(row: ActiveFastRow): ActiveFast {
  return {
    id: row.id,
    fastId: row.fast_id,
    protocol: row.protocol,
    targetHours: row.target_hours,
    startedAt: row.started_at,
  };
}

/**
 * Start a new fast. Creates a row in `ft_fasts` and a singleton row in `ft_active_fast`.
 * Throws if a fast is already active.
 */
export function startFast(
  db: DatabaseAdapter,
  id: string,
  protocol: string,
  targetHours: number,
  startedAt?: Date,
): Fast {
  const existing = getActiveFast(db);
  if (existing) {
    throw new Error('A fast is already active. End the current fast before starting a new one.');
  }

  const started = (startedAt ?? new Date()).toISOString();

  db.transaction(() => {
    db.execute(
      `INSERT INTO ft_fasts (id, protocol, target_hours, started_at) VALUES (?, ?, ?, ?)`,
      [id, protocol, targetHours, started],
    );
    db.execute(
      `INSERT INTO ft_active_fast (id, fast_id, protocol, target_hours, started_at) VALUES ('current', ?, ?, ?, ?)`,
      [id, protocol, targetHours, started],
    );
  });

  return {
    id,
    protocol,
    targetHours,
    startedAt: started,
    endedAt: null,
    durationSeconds: null,
    hitTarget: null,
    notes: null,
    createdAt: started,
  };
}

/**
 * End the currently active fast.
 * Computes duration and hit_target, removes the ft_active_fast row.
 * Returns the completed fast, or null if no fast is active.
 */
export function endFast(
  db: DatabaseAdapter,
  endedAt?: Date,
  notes?: string,
): Fast | null {
  const active = getActiveFast(db);
  if (!active) {
    return null;
  }

  const ended = (endedAt ?? new Date()).toISOString();
  const startMs = new Date(active.startedAt).getTime();
  const endMs = new Date(ended).getTime();
  const durationSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
  const hitTarget = durationSeconds >= active.targetHours * 3600 ? 1 : 0;

  db.transaction(() => {
    db.execute(
      `UPDATE ft_fasts SET ended_at = ?, duration_seconds = ?, hit_target = ?, notes = ? WHERE id = ?`,
      [ended, durationSeconds, hitTarget, notes ?? null, active.fastId],
    );
    db.execute(`DELETE FROM ft_active_fast WHERE id = 'current'`);
  });

  const rows = db.query<FastRow>(`SELECT * FROM ft_fasts WHERE id = ?`, [active.fastId]);
  return rows[0] ? rowToFast(rows[0]) : null;
}

/** Get the currently active fast, or null if none */
export function getActiveFast(db: DatabaseAdapter): ActiveFast | null {
  const rows = db.query<ActiveFastRow>(
    `SELECT * FROM ft_active_fast WHERE id = 'current'`,
  );
  return rows[0] ? rowToActiveFast(rows[0]) : null;
}

/** Get a single fast by ID */
export function getFast(db: DatabaseAdapter, id: string): Fast | null {
  const rows = db.query<FastRow>(`SELECT * FROM ft_fasts WHERE id = ?`, [id]);
  return rows[0] ? rowToFast(rows[0]) : null;
}

/** Options for listing fasts */
export interface ListFastsOptions {
  limit?: number;
  offset?: number;
}

/** List completed fasts, newest first. Paginated. */
export function listFasts(
  db: DatabaseAdapter,
  options: ListFastsOptions = {},
): Fast[] {
  const { limit = 50, offset = 0 } = options;
  const rows = db.query<FastRow>(
    `SELECT * FROM ft_fasts WHERE ended_at IS NOT NULL ORDER BY started_at DESC LIMIT ? OFFSET ?`,
    [limit, offset],
  );
  return rows.map(rowToFast);
}

/** Count total completed fasts */
export function countFasts(db: DatabaseAdapter): number {
  const rows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM ft_fasts WHERE ended_at IS NOT NULL`,
  );
  return rows[0]?.count ?? 0;
}

/** Delete a fast by ID. Also removes ft_active_fast if it was the active one. */
export function deleteFast(db: DatabaseAdapter, id: string): boolean {
  db.transaction(() => {
    db.execute(`DELETE FROM ft_active_fast WHERE fast_id = ?`, [id]);
    db.execute(`DELETE FROM ft_fasts WHERE id = ?`, [id]);
  });

  const rows = db.query<FastRow>(`SELECT * FROM ft_fasts WHERE id = ?`, [id]);
  return rows.length === 0;
}

/** Get a protocol by ID from the ft_protocols table */
export function getProtocol(db: DatabaseAdapter, id: string): { id: string; name: string; fasting_hours: number; eating_hours: number; description: string | null } | null {
  const rows = db.query<{ id: string; name: string; fasting_hours: number; eating_hours: number; description: string | null }>(
    `SELECT id, name, fasting_hours, eating_hours, description FROM ft_protocols WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

/** Get all protocols, ordered by sort_order */
export function getProtocols(db: DatabaseAdapter) {
  return db.query<{ id: string; name: string; fasting_hours: number; eating_hours: number; description: string | null; is_custom: number; is_default: number; sort_order: number }>(
    `SELECT * FROM ft_protocols ORDER BY sort_order`,
  );
}

/** Get a setting value by key */
export function getSetting(db: DatabaseAdapter, key: string): string | null {
  const rows = db.query<{ value: string }>(
    `SELECT value FROM ft_settings WHERE key = ?`,
    [key],
  );
  return rows[0]?.value ?? null;
}

/** Set a setting value */
export function setSetting(db: DatabaseAdapter, key: string, value: string): void {
  db.execute(
    `INSERT OR REPLACE INTO ft_settings (key, value) VALUES (?, ?)`,
    [key, value],
  );
}
