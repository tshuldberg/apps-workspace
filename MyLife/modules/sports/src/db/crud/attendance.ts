import type { DatabaseAdapter } from '@mylife/db';
import type { Attendance, StarRating } from '../../types';

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

interface AttendanceRow {
  id: string;
  game_id: string | null;
  venue_id: string | null;
  venue_name: string;
  section: string | null;
  row_label: string | null;
  seat: string | null;
  companions_json: string;
  cost_cents: number;
  tailgate_notes_md: string | null;
  parking_notes_md: string | null;
  rating: number | null;
  notes_md: string | null;
  photo_ids_json: string;
  attended_at: number;
  created_at: number;
  updated_at: number;
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

function rowToAttendance(row: AttendanceRow): Attendance {
  return {
    id: row.id,
    game_id: row.game_id ?? null,
    venue_id: row.venue_id ?? null,
    venue_name: row.venue_name,
    section: row.section ?? null,
    row_label: row.row_label ?? null,
    seat: row.seat ?? null,
    companions: parseStringArray(row.companions_json),
    cost_cents: row.cost_cents,
    tailgate_notes_md: row.tailgate_notes_md ?? null,
    parking_notes_md: row.parking_notes_md ?? null,
    rating: (row.rating as StarRating | null) ?? null,
    notes_md: row.notes_md ?? null,
    photo_ids: parseStringArray(row.photo_ids_json),
    attended_at: row.attended_at,
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

export interface LogAttendanceInput {
  id?: string;
  game_id?: string | null;
  venue_id?: string | null;
  venue_name: string;
  section?: string | null;
  row_label?: string | null;
  seat?: string | null;
  companions?: readonly string[];
  cost_cents?: number;
  tailgate_notes_md?: string | null;
  parking_notes_md?: string | null;
  rating?: StarRating | null;
  notes_md?: string | null;
  photo_ids?: readonly string[];
  attended_at?: number;
}

/**
 * Insert a new attendance record. `attended_at` defaults to now.
 * `venue_id` is a soft ref -- not validated against sp_venues.
 */
export function logAttendance(
  db: DatabaseAdapter,
  input: LogAttendanceInput,
): Attendance {
  const ts = now();
  const id = input.id ?? makeId('atn');
  const attendedAt = input.attended_at ?? ts;

  const row: Attendance = {
    id,
    game_id: input.game_id ?? null,
    venue_id: input.venue_id ?? null,
    venue_name: input.venue_name,
    section: input.section ?? null,
    row_label: input.row_label ?? null,
    seat: input.seat ?? null,
    companions: [...(input.companions ?? [])],
    cost_cents: input.cost_cents ?? 0,
    tailgate_notes_md: input.tailgate_notes_md ?? null,
    parking_notes_md: input.parking_notes_md ?? null,
    rating: input.rating ?? null,
    notes_md: input.notes_md ?? null,
    photo_ids: [...(input.photo_ids ?? [])],
    attended_at: attendedAt,
    created_at: ts,
    updated_at: ts,
  };

  db.execute(
    `INSERT INTO sp_attendance (
      id, game_id, venue_id, venue_name, section, row_label, seat,
      companions_json, cost_cents, tailgate_notes_md, parking_notes_md,
      rating, notes_md, photo_ids_json, attended_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.game_id,
      row.venue_id,
      row.venue_name,
      row.section,
      row.row_label,
      row.seat,
      JSON.stringify(row.companions),
      row.cost_cents,
      row.tailgate_notes_md,
      row.parking_notes_md,
      row.rating,
      row.notes_md,
      JSON.stringify(row.photo_ids),
      row.attended_at,
      row.created_at,
      row.updated_at,
    ],
  );

  return row;
}

export interface UpdateAttendanceInput {
  game_id?: string | null;
  venue_id?: string | null;
  venue_name?: string;
  section?: string | null;
  row_label?: string | null;
  seat?: string | null;
  companions?: readonly string[];
  cost_cents?: number;
  tailgate_notes_md?: string | null;
  parking_notes_md?: string | null;
  rating?: StarRating | null;
  notes_md?: string | null;
  photo_ids?: readonly string[];
  attended_at?: number;
}

/**
 * Partial update to an attendance row. Bumps `updated_at`. Returns the
 * refreshed row, or null if the id doesn't exist.
 */
export function updateAttendance(
  db: DatabaseAdapter,
  id: string,
  patch: UpdateAttendanceInput,
): Attendance | null {
  const existing = getAttendance(db, id);
  if (!existing) return null;

  const sets: string[] = [];
  const params: unknown[] = [];

  if (patch.game_id !== undefined) {
    sets.push('game_id = ?');
    params.push(patch.game_id);
  }
  if (patch.venue_id !== undefined) {
    sets.push('venue_id = ?');
    params.push(patch.venue_id);
  }
  if (patch.venue_name !== undefined) {
    sets.push('venue_name = ?');
    params.push(patch.venue_name);
  }
  if (patch.section !== undefined) {
    sets.push('section = ?');
    params.push(patch.section);
  }
  if (patch.row_label !== undefined) {
    sets.push('row_label = ?');
    params.push(patch.row_label);
  }
  if (patch.seat !== undefined) {
    sets.push('seat = ?');
    params.push(patch.seat);
  }
  if (patch.companions !== undefined) {
    sets.push('companions_json = ?');
    params.push(JSON.stringify(patch.companions));
  }
  if (patch.cost_cents !== undefined) {
    sets.push('cost_cents = ?');
    params.push(patch.cost_cents);
  }
  if (patch.tailgate_notes_md !== undefined) {
    sets.push('tailgate_notes_md = ?');
    params.push(patch.tailgate_notes_md);
  }
  if (patch.parking_notes_md !== undefined) {
    sets.push('parking_notes_md = ?');
    params.push(patch.parking_notes_md);
  }
  if (patch.rating !== undefined) {
    sets.push('rating = ?');
    params.push(patch.rating);
  }
  if (patch.notes_md !== undefined) {
    sets.push('notes_md = ?');
    params.push(patch.notes_md);
  }
  if (patch.photo_ids !== undefined) {
    sets.push('photo_ids_json = ?');
    params.push(JSON.stringify(patch.photo_ids));
  }
  if (patch.attended_at !== undefined) {
    sets.push('attended_at = ?');
    params.push(patch.attended_at);
  }

  sets.push('updated_at = ?');
  params.push(now());
  params.push(id);

  db.execute(
    `UPDATE sp_attendance SET ${sets.join(', ')} WHERE id = ?`,
    params,
  );
  return getAttendance(db, id);
}

/**
 * Delete an attendance row. Returns true iff a row was removed.
 */
export function deleteAttendance(db: DatabaseAdapter, id: string): boolean {
  const existing = getAttendance(db, id);
  if (!existing) return false;
  db.execute('DELETE FROM sp_attendance WHERE id = ?', [id]);
  return true;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function getAttendance(
  db: DatabaseAdapter,
  id: string,
): Attendance | null {
  const rows = db.query<AttendanceRow>(
    'SELECT * FROM sp_attendance WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToAttendance(rows[0]) : null;
}

export interface ListAttendanceFilters {
  limit?: number;
  /** Epoch ms. Only rows with attended_at >= sinceMs are returned. */
  sinceMs?: number;
  /** Soft ref -- filters by a specific followed team id against game_id lookup. */
  teamId?: string;
  venueId?: string;
}

/**
 * List attendance rows ordered by `attended_at DESC`. All filters are
 * optional and compose with AND semantics. `teamId` matches attendance
 * rows whose linked game has the team on either side -- resolved by
 * joining sp_games. Attendance without a game_id is excluded when
 * `teamId` is set.
 */
export function listAttendance(
  db: DatabaseAdapter,
  filters: ListAttendanceFilters = {},
): Attendance[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.sinceMs !== undefined) {
    where.push('a.attended_at >= ?');
    params.push(filters.sinceMs);
  }
  if (filters.venueId !== undefined) {
    where.push('a.venue_id = ?');
    params.push(filters.venueId);
  }

  let sql = '';
  if (filters.teamId !== undefined) {
    where.push('a.game_id IS NOT NULL');
    where.push('(g.home_team_id = ? OR g.away_team_id = ?)');
    params.push(filters.teamId, filters.teamId);
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    sql = `SELECT a.* FROM sp_attendance a
           LEFT JOIN sp_games g ON g.id = a.game_id
           ${whereClause}
           ORDER BY a.attended_at DESC`;
  } else {
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    sql = `SELECT a.* FROM sp_attendance a
           ${whereClause}
           ORDER BY a.attended_at DESC`;
  }

  if (filters.limit !== undefined) {
    sql += ` LIMIT ${Math.max(0, Math.floor(filters.limit))}`;
  }

  return db.query<AttendanceRow>(sql, params).map(rowToAttendance);
}

export interface AttendanceStats {
  gamesAttended: number;
  totalSpentCents: number;
  avgRating: number | null;
  uniqueVenues: number;
}

/**
 * Aggregate stats for the attendance journal. When `year` is provided,
 * only rows with attended_at inside that calendar year (UTC) are counted.
 * `avgRating` is null if no rated rows match.
 */
export function getAttendanceStats(
  db: DatabaseAdapter,
  filters: { year?: number } = {},
): AttendanceStats {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.year !== undefined) {
    const start = Date.UTC(filters.year, 0, 1);
    const end = Date.UTC(filters.year + 1, 0, 1);
    where.push('attended_at >= ? AND attended_at < ?');
    params.push(start, end);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const rows = db.query<{
    games_attended: number;
    total_spent_cents: number;
    avg_rating: number | null;
    unique_venues: number;
  }>(
    `SELECT
       COUNT(*) AS games_attended,
       COALESCE(SUM(cost_cents), 0) AS total_spent_cents,
       AVG(rating) AS avg_rating,
       COUNT(DISTINCT COALESCE(venue_id, venue_name)) AS unique_venues
     FROM sp_attendance
     ${whereClause}`,
    params,
  );

  const row = rows[0];
  return {
    gamesAttended: Number(row?.games_attended ?? 0),
    totalSpentCents: Number(row?.total_spent_cents ?? 0),
    avgRating:
      row?.avg_rating === null || row?.avg_rating === undefined
        ? null
        : Number(row.avg_rating),
    uniqueVenues: Number(row?.unique_venues ?? 0),
  };
}
