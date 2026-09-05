import type { DatabaseAdapter } from '@mylife/db';
import type { Game, GameStatus, LeagueId } from '../../types';

// ---------------------------------------------------------------------------
// Row shape + mapping
// ---------------------------------------------------------------------------

interface GameRow {
  id: string;
  league: string;
  sport: string;
  home_team_id: string | null;
  home_team_name: string;
  home_score: number | null;
  away_team_id: string | null;
  away_team_name: string;
  away_score: number | null;
  start_at: number;
  status: GameStatus;
  period: string | null;
  clock: string | null;
  venue: string | null;
  broadcast: string | null;
  updated_at: number;
}

function rowToGame(row: GameRow): Game {
  return {
    id: row.id,
    league: row.league as LeagueId,
    sport: row.sport,
    home: {
      id: row.home_team_id,
      name: row.home_team_name,
      abbreviation: null,
      score: row.home_score,
    },
    away: {
      id: row.away_team_id,
      name: row.away_team_name,
      abbreviation: null,
      score: row.away_score,
    },
    status: row.status,
    period: row.period,
    clock: row.clock,
    startAt: row.start_at,
    venue: row.venue,
    broadcast: row.broadcast,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Upsert a batch of games. Idempotent: if `id` already exists, all mutable
 * fields (scores, status, period, clock, broadcast, venue, updated_at) are
 * refreshed from the incoming row. Wrapped in a single transaction so a
 * partial-batch failure doesn't leave the cache in a split state.
 */
export function upsertGames(db: DatabaseAdapter, games: readonly Game[]): void {
  if (games.length === 0) return;
  db.transaction(() => {
    for (const g of games) {
      db.execute(
        `INSERT OR REPLACE INTO sp_games (
          id, league, sport,
          home_team_id, home_team_name, home_score,
          away_team_id, away_team_name, away_score,
          start_at, status, period, clock, venue, broadcast, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          g.id,
          g.league,
          g.sport,
          g.home.id ?? null,
          g.home.name,
          g.home.score ?? null,
          g.away.id ?? null,
          g.away.name,
          g.away.score ?? null,
          g.startAt,
          g.status,
          g.period ?? null,
          g.clock ?? null,
          g.venue ?? null,
          g.broadcast ?? null,
          g.updatedAt,
        ],
      );
    }
  });
}

/** Remove cached games whose `start_at` is older than `cutoffMs`. */
export function pruneGamesOlderThan(
  db: DatabaseAdapter,
  cutoffMs: number,
): void {
  db.execute('DELETE FROM sp_games WHERE start_at < ?', [cutoffMs]);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function getGameById(db: DatabaseAdapter, id: string): Game | null {
  const rows = db.query<GameRow>('SELECT * FROM sp_games WHERE id = ?', [id]);
  return rows.length > 0 ? rowToGame(rows[0]) : null;
}

/**
 * List all games whose `start_at` falls inside the UTC day of `isoDate`
 * (YYYY-MM-DD). Ordered by start time ascending.
 */
export function listGamesForDate(db: DatabaseAdapter, isoDate: string): Game[] {
  const start = Date.parse(`${isoDate}T00:00:00.000Z`);
  if (!Number.isFinite(start)) return [];
  const end = start + 24 * 60 * 60 * 1000;
  return db
    .query<GameRow>(
      `SELECT * FROM sp_games
       WHERE start_at >= ? AND start_at < ?
       ORDER BY start_at ASC`,
      [start, end],
    )
    .map(rowToGame);
}

export interface ListGamesForTeamsOptions {
  /** Only return games with `start_at >= since`. */
  since?: number;
  /** Only return games with `start_at < until`. */
  until?: number;
  limit?: number;
}

export interface ListByDateRangeOptions {
  /** Lower bound, inclusive. Filter: `start_at >= since`. */
  since: number;
  /** Upper bound, inclusive. Filter: `start_at <= until`. */
  until: number;
  /**
   * Restrict to rows with one of these statuses. Defaults to `['final']`.
   * The `GameStatus` enum today is `scheduled | live | final`; history
   * surfaces care about final (+ future PPD/CXL once the enum grows).
   */
  statuses?: GameStatus[];
  /** Optional hard cap. Defaults to 1000. */
  limit?: number;
}

/**
 * List games where either the home or away team id matches one of the
 * supplied team ids. Sorted by `start_at` ascending so Live / Upcoming /
 * Final can be filtered downstream without a second query.
 */
export function listGamesForTeams(
  db: DatabaseAdapter,
  teamIds: readonly string[],
  opts: ListGamesForTeamsOptions = {},
): Game[] {
  if (teamIds.length === 0) return [];
  const placeholders = teamIds.map(() => '?').join(', ');
  const params: unknown[] = [...teamIds, ...teamIds];
  const where: string[] = [
    `(home_team_id IN (${placeholders}) OR away_team_id IN (${placeholders}))`,
  ];
  if (opts.since !== undefined) {
    where.push('start_at >= ?');
    params.push(opts.since);
  }
  if (opts.until !== undefined) {
    where.push('start_at < ?');
    params.push(opts.until);
  }
  const limit = opts.limit ?? 500;
  return db
    .query<GameRow>(
      `SELECT * FROM sp_games
       WHERE ${where.join(' AND ')}
       ORDER BY start_at ASC
       LIMIT ?`,
      [...params, limit],
    )
    .map(rowToGame);
}

/**
 * P2-C: list games whose `start_at` falls inside an arbitrary [since, until]
 * window and whose home or away team id matches one of the supplied team ids.
 *
 * Sibling of `listGamesForTeams` -- that helper is the +/- 1 day scoreboard
 * window, this one is the generic range read used by the history surface.
 * Defaults the status filter to `['final']` so history never surfaces stale
 * scheduled rows. ORDER BY start_at DESC so the history list renders
 * newest-first.
 *
 * Returns `[]` when `teamIds` is empty (consistent with `listGamesForTeams`).
 */
export function listByDateRange(
  db: DatabaseAdapter,
  teamIds: readonly string[],
  opts: ListByDateRangeOptions,
): Game[] {
  if (teamIds.length === 0) return [];
  const statuses = opts.statuses ?? (['final'] as GameStatus[]);
  if (statuses.length === 0) return [];
  const teamPlaceholders = teamIds.map(() => '?').join(', ');
  const statusPlaceholders = statuses.map(() => '?').join(', ');
  const limit = opts.limit ?? 1000;
  const sql = `SELECT * FROM sp_games
       WHERE (home_team_id IN (${teamPlaceholders}) OR away_team_id IN (${teamPlaceholders}))
         AND start_at >= ? AND start_at <= ?
         AND status IN (${statusPlaceholders})
       ORDER BY start_at DESC
       LIMIT ?`;
  const params: unknown[] = [
    ...teamIds,
    ...teamIds,
    opts.since,
    opts.until,
    ...statuses,
    limit,
  ];
  return db.query<GameRow>(sql, params).map(rowToGame);
}
