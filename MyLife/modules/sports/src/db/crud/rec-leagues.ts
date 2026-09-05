import type { DatabaseAdapter } from '@mylife/db';
import {
  ScheduleEntrySchema,
  type RecLeague,
  type ScheduleEntry,
} from '../../types';

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

interface RecLeagueRow {
  id: string;
  sport: string;
  league_name: string;
  team_name: string;
  season: string;
  schedule_json: string;
  roster_json: string;
  record_wins: number;
  record_losses: number;
  record_ties: number;
  notes_md: string | null;
  created_at: number;
  updated_at: number;
}

function parseSchedule(json: string): ScheduleEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return ScheduleEntrySchema.array().parse(parsed);
}

function parseRoster(json: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((v): v is string => typeof v === 'string');
}

function rowToLeague(row: RecLeagueRow): RecLeague {
  return {
    id: row.id,
    sport: row.sport,
    league_name: row.league_name,
    team_name: row.team_name,
    season: row.season,
    schedule: parseSchedule(row.schedule_json),
    roster: parseRoster(row.roster_json),
    record_wins: row.record_wins,
    record_losses: row.record_losses,
    record_ties: row.record_ties,
    notes_md: row.notes_md ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function now(): number {
  return Date.now();
}

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface CreateRecLeagueInput {
  id?: string;
  sport: string;
  league_name: string;
  team_name: string;
  season: string;
  schedule?: readonly ScheduleEntry[];
  roster?: readonly string[];
  record_wins?: number;
  record_losses?: number;
  record_ties?: number;
  notes_md?: string | null;
}

/**
 * Insert a new rec league. Returns the freshly-inserted row.
 */
export function createRecLeague(
  db: DatabaseAdapter,
  input: CreateRecLeagueInput,
): RecLeague {
  const ts = now();
  const id = input.id ?? makeId('rcl');
  const row: RecLeague = {
    id,
    sport: input.sport,
    league_name: input.league_name,
    team_name: input.team_name,
    season: input.season,
    schedule: [...(input.schedule ?? [])],
    roster: [...(input.roster ?? [])],
    record_wins: input.record_wins ?? 0,
    record_losses: input.record_losses ?? 0,
    record_ties: input.record_ties ?? 0,
    notes_md: input.notes_md ?? null,
    created_at: ts,
    updated_at: ts,
  };

  db.execute(
    `INSERT INTO sp_rec_leagues (
      id, sport, league_name, team_name, season,
      schedule_json, roster_json,
      record_wins, record_losses, record_ties,
      notes_md, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.sport,
      row.league_name,
      row.team_name,
      row.season,
      JSON.stringify(row.schedule),
      JSON.stringify(row.roster),
      row.record_wins,
      row.record_losses,
      row.record_ties,
      row.notes_md,
      row.created_at,
      row.updated_at,
    ],
  );

  return row;
}

export interface UpdateRecLeagueInput {
  sport?: string;
  league_name?: string;
  team_name?: string;
  season?: string;
  schedule?: readonly ScheduleEntry[];
  roster?: readonly string[];
  record_wins?: number;
  record_losses?: number;
  record_ties?: number;
  notes_md?: string | null;
}

/**
 * Partial update to a rec league row. Bumps `updated_at`. Returns the
 * refreshed row, or null if the id doesn't exist.
 */
export function updateRecLeague(
  db: DatabaseAdapter,
  id: string,
  patch: UpdateRecLeagueInput,
): RecLeague | null {
  const existing = getRecLeague(db, id);
  if (!existing) return null;

  const sets: string[] = [];
  const params: unknown[] = [];

  if (patch.sport !== undefined) {
    sets.push('sport = ?');
    params.push(patch.sport);
  }
  if (patch.league_name !== undefined) {
    sets.push('league_name = ?');
    params.push(patch.league_name);
  }
  if (patch.team_name !== undefined) {
    sets.push('team_name = ?');
    params.push(patch.team_name);
  }
  if (patch.season !== undefined) {
    sets.push('season = ?');
    params.push(patch.season);
  }
  if (patch.schedule !== undefined) {
    sets.push('schedule_json = ?');
    params.push(JSON.stringify(patch.schedule));
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
  if (patch.notes_md !== undefined) {
    sets.push('notes_md = ?');
    params.push(patch.notes_md);
  }

  sets.push('updated_at = ?');
  params.push(now());
  params.push(id);

  db.execute(
    `UPDATE sp_rec_leagues SET ${sets.join(', ')} WHERE id = ?`,
    params,
  );
  return getRecLeague(db, id);
}

export interface UpdateRecLeagueRecordInput {
  wins: number;
  losses: number;
  ties: number;
}

/**
 * Narrow update for the weekly record. Keeps the UI from having to
 * round-trip the full league row when the only change is the box score.
 */
export function updateRecLeagueRecord(
  db: DatabaseAdapter,
  id: string,
  input: UpdateRecLeagueRecordInput,
): RecLeague | null {
  return updateRecLeague(db, id, {
    record_wins: input.wins,
    record_losses: input.losses,
    record_ties: input.ties,
  });
}

/**
 * Append one entry to a league's schedule. Read-modify-write of the
 * JSON column -- cheap and race-acceptable for a single-user personal
 * module, and avoids a dedicated sp_rec_league_schedule child table.
 */
export function addScheduleEntry(
  db: DatabaseAdapter,
  id: string,
  entry: ScheduleEntry,
): RecLeague | null {
  const existing = getRecLeague(db, id);
  if (!existing) return null;
  const next = [...existing.schedule, entry];
  return updateRecLeague(db, id, { schedule: next });
}

/**
 * Delete a league. Returns true iff a row was removed.
 */
export function deleteRecLeague(db: DatabaseAdapter, id: string): boolean {
  const existing = getRecLeague(db, id);
  if (!existing) return false;
  db.execute('DELETE FROM sp_rec_leagues WHERE id = ?', [id]);
  return true;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function getRecLeague(
  db: DatabaseAdapter,
  id: string,
): RecLeague | null {
  const rows = db.query<RecLeagueRow>(
    'SELECT * FROM sp_rec_leagues WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToLeague(rows[0]) : null;
}

export interface ListRecLeaguesFilters {
  sport?: string;
  season?: string;
}

/**
 * List rec leagues newest first. Optional sport + season filters
 * compose with AND semantics.
 */
export function listRecLeagues(
  db: DatabaseAdapter,
  filters: ListRecLeaguesFilters = {},
): RecLeague[] {
  const where: string[] = [];
  const params: unknown[] = [];
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
    .query<RecLeagueRow>(
      `SELECT * FROM sp_rec_leagues ${whereClause} ORDER BY created_at DESC`,
      params,
    )
    .map(rowToLeague);
}

/**
 * Return schedule entries for the league that start after `now`, sorted
 * ASC by `starts_at`. Returns an empty array if the league doesn't exist.
 */
export function getUpcomingGames(
  db: DatabaseAdapter,
  leagueId: string,
  nowMs: number,
): ScheduleEntry[] {
  const league = getRecLeague(db, leagueId);
  if (!league) return [];
  return league.schedule
    .filter((entry) => entry.starts_at > nowMs)
    .slice()
    .sort((a, b) => a.starts_at - b.starts_at);
}
