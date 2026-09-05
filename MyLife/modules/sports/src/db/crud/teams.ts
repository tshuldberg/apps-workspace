import type { DatabaseAdapter } from '@mylife/db';
import type {
  CreateTeamInput,
  FollowTier,
  Team,
  UpdateTeamInput,
  UpdateTeamNotificationsInput,
} from '../../types';

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToTeam(row: Record<string, unknown>): Team {
  return {
    id: row.id as string,
    name: row.name as string,
    league: row.league as string,
    sport: row.sport as string,
    conference: (row.conference as string | null) ?? null,
    division: (row.division as string | null) ?? null,
    logo_url: (row.logo_url as string | null) ?? null,
    primary_color: (row.primary_color as string | null) ?? null,
    secondary_color: (row.secondary_color as string | null) ?? null,
    follow_tier: row.follow_tier as FollowTier,
    notify_start: (row.notify_start as 0 | 1),
    notify_end: (row.notify_end as 0 | 1),
    notify_close: (row.notify_close as 0 | 1),
    notify_trades: (row.notify_trades as 0 | 1),
    is_rival: (row.is_rival as 0 | 1),
    notes_md: (row.notes_md as string | null) ?? null,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  };
}

function now(): number {
  return Date.now();
}

// ---------------------------------------------------------------------------
// Tier ordering helper -- keeps diehard on top, casual next, then occasional.
// Encoded into SQL via a CASE expression so we don't need another column.
// ---------------------------------------------------------------------------

const TIER_ORDER_SQL = `CASE follow_tier
  WHEN 'diehard' THEN 0
  WHEN 'casual' THEN 1
  WHEN 'occasional' THEN 2
  ELSE 3
END`;

// ---------------------------------------------------------------------------
// Follow / unfollow
// ---------------------------------------------------------------------------

/**
 * Persist a new followed team. If the team already exists (stable id),
 * this is a no-op -- callers should use `updateTeamTier` etc. to change
 * its follow state.
 */
export function followTeam(db: DatabaseAdapter, input: CreateTeamInput): Team {
  const ts = now();
  db.execute(
    `INSERT OR IGNORE INTO sp_teams (
      id, name, league, sport, conference, division, logo_url,
      primary_color, secondary_color, follow_tier,
      notify_start, notify_end, notify_close, notify_trades,
      is_rival, notes_md, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.name,
      input.league,
      input.sport,
      input.conference ?? null,
      input.division ?? null,
      input.logo_url ?? null,
      input.primary_color ?? null,
      input.secondary_color ?? null,
      input.follow_tier ?? 'casual',
      input.notify_start ?? 1,
      input.notify_end ?? 1,
      input.notify_close ?? 0,
      input.notify_trades ?? 0,
      input.is_rival ?? 0,
      input.notes_md ?? null,
      ts,
      ts,
    ],
  );
  const team = getTeamById(db, input.id);
  if (!team) {
    throw new Error(`followTeam failed: team ${input.id} not inserted`);
  }
  return team;
}

/** Stop following a team by removing its row entirely. */
export function unfollowTeam(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM sp_teams WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Profile updates
// ---------------------------------------------------------------------------

export function updateTeamTier(
  db: DatabaseAdapter,
  id: string,
  tier: FollowTier,
): void {
  db.execute(
    'UPDATE sp_teams SET follow_tier = ?, updated_at = ? WHERE id = ?',
    [tier, now(), id],
  );
}

/**
 * Mark or unmark a team as a rival. P1-A stores the flag; rival-tuned
 * notifications and UI accents land in P2.
 */
export function setTeamRival(
  db: DatabaseAdapter,
  id: string,
  isRival: boolean,
): void {
  db.execute(
    'UPDATE sp_teams SET is_rival = ?, updated_at = ? WHERE id = ?',
    [isRival ? 1 : 0, now(), id],
  );
}

/**
 * Apply a partial profile update. Accepts any subset of the
 * `UpdateTeamInputSchema` fields and skips untouched ones.
 */
export function updateTeam(
  db: DatabaseAdapter,
  id: string,
  input: UpdateTeamInput,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (input.follow_tier !== undefined) {
    sets.push('follow_tier = ?');
    params.push(input.follow_tier);
  }
  if (input.is_rival !== undefined) {
    sets.push('is_rival = ?');
    params.push(input.is_rival);
  }
  if (input.notes_md !== undefined) {
    sets.push('notes_md = ?');
    params.push(input.notes_md);
  }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  params.push(now(), id);
  db.execute(`UPDATE sp_teams SET ${sets.join(', ')} WHERE id = ?`, params);
}

// ---------------------------------------------------------------------------
// Notification prefs
// ---------------------------------------------------------------------------

/**
 * Persist notification preferences. P1-A only stores them -- P2 will
 * consume these flags in the dispatch layer.
 */
export function updateTeamNotifications(
  db: DatabaseAdapter,
  id: string,
  input: UpdateTeamNotificationsInput,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (input.notify_start !== undefined) {
    sets.push('notify_start = ?');
    params.push(input.notify_start);
  }
  if (input.notify_end !== undefined) {
    sets.push('notify_end = ?');
    params.push(input.notify_end);
  }
  if (input.notify_close !== undefined) {
    sets.push('notify_close = ?');
    params.push(input.notify_close);
  }
  if (input.notify_trades !== undefined) {
    sets.push('notify_trades = ?');
    params.push(input.notify_trades);
  }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  params.push(now(), id);
  db.execute(`UPDATE sp_teams SET ${sets.join(', ')} WHERE id = ?`, params);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** List followed teams grouped by tier then alphabetical by name. */
export function listFollowedTeams(
  db: DatabaseAdapter,
  options?: { league?: string; limit?: number },
): Team[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (options?.league) {
    where.push('league = ?');
    params.push(options.league);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const limit = options?.limit ?? 500;
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM sp_teams
       ${whereClause}
       ORDER BY ${TIER_ORDER_SQL} ASC, name ASC
       LIMIT ?`,
      [...params, limit],
    )
    .map(rowToTeam);
}

export function getTeamById(db: DatabaseAdapter, id: string): Team | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM sp_teams WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToTeam(rows[0]) : null;
}

export function countFollowedTeams(db: DatabaseAdapter): number {
  const row = db.query<{ c: number }>(
    'SELECT COUNT(*) as c FROM sp_teams',
  )[0];
  return row?.c ?? 0;
}
