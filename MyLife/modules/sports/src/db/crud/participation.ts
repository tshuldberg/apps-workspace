import type { DatabaseAdapter } from '@mylife/db';
import {
  SessionStatsSchema,
  type ActivityType,
  type Mood,
  type ParticipationSession,
  type SessionStats,
} from '../../types';

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

interface ParticipationSessionRow {
  id: string;
  sport: string;
  activity: ActivityType;
  started_at: number;
  duration_minutes: number | null;
  location: string | null;
  teammates_json: string;
  stats_json: string;
  personal_best: number;
  mood_before: number | null;
  mood_after: number | null;
  injury_notes: string | null;
  notes_md: string | null;
  photo_ids_json: string;
  created_at: number;
}

function parseStringArray(json: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((v): v is string => typeof v === 'string');
}

function parseStats(json: string): SessionStats {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {};
  }
  const result = SessionStatsSchema.safeParse(parsed);
  return result.success ? result.data : {};
}

function rowToSession(row: ParticipationSessionRow): ParticipationSession {
  return {
    id: row.id,
    sport: row.sport,
    activity: row.activity,
    started_at: row.started_at,
    duration_minutes: row.duration_minutes ?? null,
    location: row.location ?? null,
    teammates: parseStringArray(row.teammates_json),
    stats: parseStats(row.stats_json),
    personal_best: row.personal_best === 1,
    mood_before: (row.mood_before as Mood | null) ?? null,
    mood_after: (row.mood_after as Mood | null) ?? null,
    injury_notes: row.injury_notes ?? null,
    notes_md: row.notes_md ?? null,
    photo_ids: parseStringArray(row.photo_ids_json),
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
// Writes
// ---------------------------------------------------------------------------

export interface LogSessionInput {
  id?: string;
  sport: string;
  activity: ActivityType;
  started_at?: number;
  duration_minutes?: number | null;
  location?: string | null;
  teammates?: readonly string[];
  stats?: SessionStats;
  personal_best?: boolean;
  mood_before?: Mood | null;
  mood_after?: Mood | null;
  injury_notes?: string | null;
  notes_md?: string | null;
  photo_ids?: readonly string[];
}

/**
 * Insert a new participation session. Returns the freshly-inserted row.
 * `started_at` defaults to now. `personal_best` defaults to false -- the
 * caller (UI / service layer) is responsible for composing
 * `detectPersonalBest` from the engine with `getPersonalBests` or
 * `listSessions` and passing the result here.
 */
export function logSession(
  db: DatabaseAdapter,
  input: LogSessionInput,
): ParticipationSession {
  const ts = now();
  const id = input.id ?? makeId('ps');
  const started = input.started_at ?? ts;
  const teammates = input.teammates ?? [];
  const stats = input.stats ?? {};
  const photoIds = input.photo_ids ?? [];

  const row: ParticipationSession = {
    id,
    sport: input.sport,
    activity: input.activity,
    started_at: started,
    duration_minutes: input.duration_minutes ?? null,
    location: input.location ?? null,
    teammates: [...teammates],
    stats: { ...stats },
    personal_best: input.personal_best ?? false,
    mood_before: input.mood_before ?? null,
    mood_after: input.mood_after ?? null,
    injury_notes: input.injury_notes ?? null,
    notes_md: input.notes_md ?? null,
    photo_ids: [...photoIds],
    created_at: ts,
  };

  db.execute(
    `INSERT INTO sp_participation_sessions (
      id, sport, activity, started_at, duration_minutes, location,
      teammates_json, stats_json, personal_best,
      mood_before, mood_after, injury_notes, notes_md,
      photo_ids_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.sport,
      row.activity,
      row.started_at,
      row.duration_minutes,
      row.location,
      JSON.stringify(row.teammates),
      JSON.stringify(row.stats),
      row.personal_best ? 1 : 0,
      row.mood_before,
      row.mood_after,
      row.injury_notes,
      row.notes_md,
      JSON.stringify(row.photo_ids),
      row.created_at,
    ],
  );

  return row;
}

export interface UpdateSessionInput {
  sport?: string;
  activity?: ActivityType;
  started_at?: number;
  duration_minutes?: number | null;
  location?: string | null;
  teammates?: readonly string[];
  stats?: SessionStats;
  personal_best?: boolean;
  mood_before?: Mood | null;
  mood_after?: Mood | null;
  injury_notes?: string | null;
  notes_md?: string | null;
  photo_ids?: readonly string[];
}

/**
 * Partial update to a session. `created_at` is never bumped -- the
 * row's identity timestamp stays pinned to first insert. Returns the
 * refreshed row, or null if the id doesn't exist.
 */
export function updateSession(
  db: DatabaseAdapter,
  id: string,
  patch: UpdateSessionInput,
): ParticipationSession | null {
  const existing = getSession(db, id);
  if (!existing) return null;

  const sets: string[] = [];
  const params: unknown[] = [];

  if (patch.sport !== undefined) {
    sets.push('sport = ?');
    params.push(patch.sport);
  }
  if (patch.activity !== undefined) {
    sets.push('activity = ?');
    params.push(patch.activity);
  }
  if (patch.started_at !== undefined) {
    sets.push('started_at = ?');
    params.push(patch.started_at);
  }
  if (patch.duration_minutes !== undefined) {
    sets.push('duration_minutes = ?');
    params.push(patch.duration_minutes);
  }
  if (patch.location !== undefined) {
    sets.push('location = ?');
    params.push(patch.location);
  }
  if (patch.teammates !== undefined) {
    sets.push('teammates_json = ?');
    params.push(JSON.stringify(patch.teammates));
  }
  if (patch.stats !== undefined) {
    sets.push('stats_json = ?');
    params.push(JSON.stringify(patch.stats));
  }
  if (patch.personal_best !== undefined) {
    sets.push('personal_best = ?');
    params.push(patch.personal_best ? 1 : 0);
  }
  if (patch.mood_before !== undefined) {
    sets.push('mood_before = ?');
    params.push(patch.mood_before);
  }
  if (patch.mood_after !== undefined) {
    sets.push('mood_after = ?');
    params.push(patch.mood_after);
  }
  if (patch.injury_notes !== undefined) {
    sets.push('injury_notes = ?');
    params.push(patch.injury_notes);
  }
  if (patch.notes_md !== undefined) {
    sets.push('notes_md = ?');
    params.push(patch.notes_md);
  }
  if (patch.photo_ids !== undefined) {
    sets.push('photo_ids_json = ?');
    params.push(JSON.stringify(patch.photo_ids));
  }

  if (sets.length === 0) return existing;

  params.push(id);
  db.execute(
    `UPDATE sp_participation_sessions SET ${sets.join(', ')} WHERE id = ?`,
    params,
  );

  return getSession(db, id);
}

/**
 * Delete a session. Returns true iff a row was removed.
 */
export function deleteSession(db: DatabaseAdapter, id: string): boolean {
  const existing = getSession(db, id);
  if (!existing) return false;
  db.execute('DELETE FROM sp_participation_sessions WHERE id = ?', [id]);
  return true;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function getSession(
  db: DatabaseAdapter,
  id: string,
): ParticipationSession | null {
  const rows = db.query<ParticipationSessionRow>(
    'SELECT * FROM sp_participation_sessions WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToSession(rows[0]) : null;
}

export interface ListSessionsFilters {
  sport?: string;
  activity?: ActivityType;
  /** Epoch ms. Only sessions with started_at >= since are returned. */
  since?: number;
  /** Epoch ms. Only sessions with started_at <= until are returned. */
  until?: number;
  limit?: number;
  offset?: number;
}

/**
 * List sessions ordered by `started_at DESC`. All filters are optional
 * and compose with AND semantics.
 */
export function listSessions(
  db: DatabaseAdapter,
  filters: ListSessionsFilters = {},
): ParticipationSession[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.sport !== undefined) {
    where.push('sport = ?');
    params.push(filters.sport);
  }
  if (filters.activity !== undefined) {
    where.push('activity = ?');
    params.push(filters.activity);
  }
  if (filters.since !== undefined) {
    where.push('started_at >= ?');
    params.push(filters.since);
  }
  if (filters.until !== undefined) {
    where.push('started_at <= ?');
    params.push(filters.until);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  let limitClause = '';
  if (filters.limit !== undefined) {
    limitClause = ` LIMIT ${Math.max(0, Math.floor(filters.limit))}`;
    if (filters.offset !== undefined) {
      limitClause += ` OFFSET ${Math.max(0, Math.floor(filters.offset))}`;
    }
  }
  return db
    .query<ParticipationSessionRow>(
      `SELECT * FROM sp_participation_sessions
       ${whereClause}
       ORDER BY started_at DESC${limitClause}`,
      params,
    )
    .map(rowToSession);
}

/**
 * Personal-best rows for a sport, newest first. Backed by the partial
 * index on `personal_best = 1` so this stays cheap even when the
 * session journal grows large.
 */
export function getPersonalBests(
  db: DatabaseAdapter,
  sport: string,
): ParticipationSession[] {
  return db
    .query<ParticipationSessionRow>(
      `SELECT * FROM sp_participation_sessions
       WHERE sport = ? AND personal_best = 1
       ORDER BY started_at DESC`,
      [sport],
    )
    .map(rowToSession);
}
