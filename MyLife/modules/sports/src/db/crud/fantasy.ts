import type { DatabaseAdapter } from '@mylife/db';
import {
  FantasyPlayerSchema,
  type FantasyFormat,
  type FantasyLeague,
  type FantasyPlatform,
  type FantasyPlayer,
  type FantasyTransaction,
  type FantasyTransactionType,
} from '../../types';

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

interface FantasyLeagueRow {
  id: string;
  platform: FantasyPlatform;
  sport: string;
  league_name: string;
  season: string;
  format: FantasyFormat;
  team_name: string;
  roster_json: string;
  record_wins: number;
  record_losses: number;
  record_ties: number;
  points_for: number;
  points_against: number;
  standings_position: number | null;
  buy_in_cents: number | null;
  prize_cents: number | null;
  notes_md: string | null;
  created_at: number;
  updated_at: number;
}

interface FantasyTransactionRow {
  id: string;
  league_id: string;
  type: FantasyTransactionType;
  players_in_json: string;
  players_out_json: string;
  description: string;
  reasoning_md: string | null;
  happened_at: number;
  created_at: number;
}

function parsePlayers(json: string): FantasyPlayer[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return FantasyPlayerSchema.array().parse(parsed);
}

function rowToLeague(row: FantasyLeagueRow): FantasyLeague {
  return {
    id: row.id,
    platform: row.platform,
    sport: row.sport,
    league_name: row.league_name,
    season: row.season,
    format: row.format,
    team_name: row.team_name,
    roster: parsePlayers(row.roster_json),
    record_wins: row.record_wins,
    record_losses: row.record_losses,
    record_ties: row.record_ties,
    points_for: row.points_for,
    points_against: row.points_against,
    standings_position: row.standings_position ?? null,
    buy_in_cents: row.buy_in_cents ?? null,
    prize_cents: row.prize_cents ?? null,
    notes_md: row.notes_md ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToTransaction(row: FantasyTransactionRow): FantasyTransaction {
  return {
    id: row.id,
    league_id: row.league_id,
    type: row.type,
    players_in: parsePlayers(row.players_in_json),
    players_out: parsePlayers(row.players_out_json),
    description: row.description,
    reasoning_md: row.reasoning_md ?? null,
    happened_at: row.happened_at,
    created_at: row.created_at,
  };
}

function now(): number {
  return Date.now();
}

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// League writes
// ---------------------------------------------------------------------------

export interface CreateFantasyLeagueInput {
  id?: string;
  platform: FantasyPlatform;
  sport: string;
  league_name: string;
  season: string;
  format: FantasyFormat;
  team_name: string;
  roster?: readonly FantasyPlayer[];
  record_wins?: number;
  record_losses?: number;
  record_ties?: number;
  points_for?: number;
  points_against?: number;
  standings_position?: number | null;
  buy_in_cents?: number | null;
  prize_cents?: number | null;
  notes_md?: string | null;
}

/**
 * Insert a new fantasy league row. Roster defaults to empty array;
 * record + points default to 0. Returns the freshly-inserted row.
 */
export function createFantasyLeague(
  db: DatabaseAdapter,
  input: CreateFantasyLeagueInput,
): FantasyLeague {
  const ts = now();
  const id = input.id ?? makeId('fly');
  const roster = input.roster ?? [];
  const row: FantasyLeague = {
    id,
    platform: input.platform,
    sport: input.sport,
    league_name: input.league_name,
    season: input.season,
    format: input.format,
    team_name: input.team_name,
    roster: [...roster],
    record_wins: input.record_wins ?? 0,
    record_losses: input.record_losses ?? 0,
    record_ties: input.record_ties ?? 0,
    points_for: input.points_for ?? 0,
    points_against: input.points_against ?? 0,
    standings_position: input.standings_position ?? null,
    buy_in_cents: input.buy_in_cents ?? null,
    prize_cents: input.prize_cents ?? null,
    notes_md: input.notes_md ?? null,
    created_at: ts,
    updated_at: ts,
  };

  db.execute(
    `INSERT INTO sp_fantasy_leagues (
      id, platform, sport, league_name, season, format, team_name,
      roster_json, record_wins, record_losses, record_ties,
      points_for, points_against, standings_position,
      buy_in_cents, prize_cents, notes_md, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.platform,
      row.sport,
      row.league_name,
      row.season,
      row.format,
      row.team_name,
      JSON.stringify(row.roster),
      row.record_wins,
      row.record_losses,
      row.record_ties,
      row.points_for,
      row.points_against,
      row.standings_position,
      row.buy_in_cents,
      row.prize_cents,
      row.notes_md,
      row.created_at,
      row.updated_at,
    ],
  );

  return row;
}

export interface UpdateFantasyLeagueInput {
  platform?: FantasyPlatform;
  sport?: string;
  league_name?: string;
  season?: string;
  format?: FantasyFormat;
  team_name?: string;
  roster?: readonly FantasyPlayer[];
  record_wins?: number;
  record_losses?: number;
  record_ties?: number;
  points_for?: number;
  points_against?: number;
  standings_position?: number | null;
  buy_in_cents?: number | null;
  prize_cents?: number | null;
  notes_md?: string | null;
}

/**
 * Partial update to a fantasy league row. Any omitted field is left
 * untouched. `updated_at` is always bumped.
 *
 * Returns the refreshed row, or null if the id doesn't exist.
 */
export function updateFantasyLeague(
  db: DatabaseAdapter,
  id: string,
  patch: UpdateFantasyLeagueInput,
): FantasyLeague | null {
  const existing = getFantasyLeague(db, id);
  if (!existing) return null;

  const sets: string[] = [];
  const params: unknown[] = [];

  if (patch.platform !== undefined) {
    sets.push('platform = ?');
    params.push(patch.platform);
  }
  if (patch.sport !== undefined) {
    sets.push('sport = ?');
    params.push(patch.sport);
  }
  if (patch.league_name !== undefined) {
    sets.push('league_name = ?');
    params.push(patch.league_name);
  }
  if (patch.season !== undefined) {
    sets.push('season = ?');
    params.push(patch.season);
  }
  if (patch.format !== undefined) {
    sets.push('format = ?');
    params.push(patch.format);
  }
  if (patch.team_name !== undefined) {
    sets.push('team_name = ?');
    params.push(patch.team_name);
  }
  if (patch.roster !== undefined) {
    sets.push('roster_json = ?');
    params.push(JSON.stringify(patch.roster));
  }
  if (patch.record_wins !== undefined) {
    sets.push('record_wins = ?');
    params.push(patch.record_wins);
  }
  if (patch.record_losses !== undefined) {
    sets.push('record_losses = ?');
    params.push(patch.record_losses);
  }
  if (patch.record_ties !== undefined) {
    sets.push('record_ties = ?');
    params.push(patch.record_ties);
  }
  if (patch.points_for !== undefined) {
    sets.push('points_for = ?');
    params.push(patch.points_for);
  }
  if (patch.points_against !== undefined) {
    sets.push('points_against = ?');
    params.push(patch.points_against);
  }
  if (patch.standings_position !== undefined) {
    sets.push('standings_position = ?');
    params.push(patch.standings_position);
  }
  if (patch.buy_in_cents !== undefined) {
    sets.push('buy_in_cents = ?');
    params.push(patch.buy_in_cents);
  }
  if (patch.prize_cents !== undefined) {
    sets.push('prize_cents = ?');
    params.push(patch.prize_cents);
  }
  if (patch.notes_md !== undefined) {
    sets.push('notes_md = ?');
    params.push(patch.notes_md);
  }

  sets.push('updated_at = ?');
  params.push(now());
  params.push(id);

  db.execute(
    `UPDATE sp_fantasy_leagues SET ${sets.join(', ')} WHERE id = ?`,
    params,
  );

  return getFantasyLeague(db, id);
}

export interface UpdateFantasyLeagueRecordInput {
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  standingsPosition?: number | null;
}

/**
 * Narrow update for weekly record + points. Keeps the matchup loop
 * code focused on standings without having to pass every league field
 * back through `updateFantasyLeague`.
 */
export function updateFantasyLeagueRecord(
  db: DatabaseAdapter,
  id: string,
  input: UpdateFantasyLeagueRecordInput,
): FantasyLeague | null {
  return updateFantasyLeague(db, id, {
    record_wins: input.wins,
    record_losses: input.losses,
    record_ties: input.ties,
    points_for: input.pointsFor,
    points_against: input.pointsAgainst,
    standings_position:
      input.standingsPosition === undefined ? null : input.standingsPosition,
  });
}

/**
 * Delete a league. sp_fantasy_transactions rows cascade via FK ON DELETE CASCADE.
 */
export function deleteFantasyLeague(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM sp_fantasy_leagues WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// League reads
// ---------------------------------------------------------------------------

export function getFantasyLeague(
  db: DatabaseAdapter,
  id: string,
): FantasyLeague | null {
  const rows = db.query<FantasyLeagueRow>(
    'SELECT * FROM sp_fantasy_leagues WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToLeague(rows[0]) : null;
}

export interface ListFantasyLeaguesFilters {
  platform?: FantasyPlatform;
  sport?: string;
  season?: string;
}

/**
 * List fantasy leagues with optional filters. Ordered by `created_at DESC`
 * so the newest league surfaces first.
 */
export function listFantasyLeagues(
  db: DatabaseAdapter,
  filters: ListFantasyLeaguesFilters = {},
): FantasyLeague[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.platform !== undefined) {
    where.push('platform = ?');
    params.push(filters.platform);
  }
  if (filters.sport !== undefined) {
    where.push('sport = ?');
    params.push(filters.sport);
  }
  if (filters.season !== undefined) {
    where.push('season = ?');
    params.push(filters.season);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  return db
    .query<FantasyLeagueRow>(
      `SELECT * FROM sp_fantasy_leagues
       ${whereClause}
       ORDER BY created_at DESC`,
      params,
    )
    .map(rowToLeague);
}

// ---------------------------------------------------------------------------
// Transaction writes
// ---------------------------------------------------------------------------

export interface LogFantasyTransactionInput {
  id?: string;
  league_id: string;
  type: FantasyTransactionType;
  players_in?: readonly FantasyPlayer[];
  players_out?: readonly FantasyPlayer[];
  description: string;
  reasoning_md?: string | null;
  happened_at?: number;
}

/**
 * Insert a new transaction row against an existing league. Returns the
 * freshly-inserted row. Does not enforce league existence at the SQL
 * layer beyond the FK (which rejects orphan inserts).
 */
export function logFantasyTransaction(
  db: DatabaseAdapter,
  input: LogFantasyTransactionInput,
): FantasyTransaction {
  const ts = now();
  const id = input.id ?? makeId('ftx');
  const playersIn = input.players_in ?? [];
  const playersOut = input.players_out ?? [];
  const row: FantasyTransaction = {
    id,
    league_id: input.league_id,
    type: input.type,
    players_in: [...playersIn],
    players_out: [...playersOut],
    description: input.description,
    reasoning_md: input.reasoning_md ?? null,
    happened_at: input.happened_at ?? ts,
    created_at: ts,
  };

  db.execute(
    `INSERT INTO sp_fantasy_transactions (
      id, league_id, type, players_in_json, players_out_json,
      description, reasoning_md, happened_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.league_id,
      row.type,
      JSON.stringify(row.players_in),
      JSON.stringify(row.players_out),
      row.description,
      row.reasoning_md,
      row.happened_at,
      row.created_at,
    ],
  );

  return row;
}

export function deleteFantasyTransaction(
  db: DatabaseAdapter,
  id: string,
): void {
  db.execute('DELETE FROM sp_fantasy_transactions WHERE id = ?', [id]);
}

// ---------------------------------------------------------------------------
// Transaction reads
// ---------------------------------------------------------------------------

export interface ListFantasyTransactionsFilters {
  type?: FantasyTransactionType;
}

/**
 * List transactions for a league, newest first. Optional `type` filter
 * scopes to a single transaction kind.
 */
export function listFantasyTransactions(
  db: DatabaseAdapter,
  leagueId: string,
  filters: ListFantasyTransactionsFilters = {},
): FantasyTransaction[] {
  const where: string[] = ['league_id = ?'];
  const params: unknown[] = [leagueId];
  if (filters.type !== undefined) {
    where.push('type = ?');
    params.push(filters.type);
  }
  return db
    .query<FantasyTransactionRow>(
      `SELECT * FROM sp_fantasy_transactions
       WHERE ${where.join(' AND ')}
       ORDER BY happened_at DESC`,
      params,
    )
    .map(rowToTransaction);
}

/**
 * Draft log for a league: type='draft', ordered by happened_at ASC so
 * pick 1 lands at index 0.
 */
export function getFantasyDraftLog(
  db: DatabaseAdapter,
  leagueId: string,
): FantasyTransaction[] {
  return db
    .query<FantasyTransactionRow>(
      `SELECT * FROM sp_fantasy_transactions
       WHERE league_id = ? AND type = 'draft'
       ORDER BY happened_at ASC`,
      [leagueId],
    )
    .map(rowToTransaction);
}

/**
 * Trade history for a league: type='trade', newest first. Useful for
 * the "decisions I'd change" review journal.
 */
export function getFantasyTradeHistory(
  db: DatabaseAdapter,
  leagueId: string,
): FantasyTransaction[] {
  return db
    .query<FantasyTransactionRow>(
      `SELECT * FROM sp_fantasy_transactions
       WHERE league_id = ? AND type = 'trade'
       ORDER BY happened_at DESC`,
      [leagueId],
    )
    .map(rowToTransaction);
}
