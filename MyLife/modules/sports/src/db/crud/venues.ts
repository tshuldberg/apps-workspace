import type { DatabaseAdapter } from '@mylife/db';
import type { SqliteBool, StarRating, Venue } from '../../types';

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

interface VenueRow {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  sport: string | null;
  team: string | null;
  capacity: number | null;
  visited: number;
  first_visit_at: number | null;
  last_visit_at: number | null;
  rating: number | null;
  bucket_list: number;
  lat: number | null;
  lng: number | null;
  notes_md: string | null;
  created_at: number;
  updated_at: number;
}

function rowToVenue(row: VenueRow): Venue {
  return {
    id: row.id,
    name: row.name,
    city: row.city ?? null,
    country: row.country ?? null,
    sport: row.sport ?? null,
    team: row.team ?? null,
    capacity: row.capacity ?? null,
    visited: (row.visited === 1 ? 1 : 0) as SqliteBool,
    first_visit_at: row.first_visit_at ?? null,
    last_visit_at: row.last_visit_at ?? null,
    rating: (row.rating as StarRating | null) ?? null,
    bucket_list: (row.bucket_list === 1 ? 1 : 0) as SqliteBool,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
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

export interface CreateVenueInput {
  id?: string;
  name: string;
  city?: string | null;
  country?: string | null;
  sport?: string | null;
  team?: string | null;
  capacity?: number | null;
  visited?: SqliteBool;
  first_visit_at?: number | null;
  last_visit_at?: number | null;
  rating?: StarRating | null;
  bucket_list?: SqliteBool;
  lat?: number | null;
  lng?: number | null;
  notes_md?: string | null;
}

/**
 * Insert a new venue record. Defaults: visited=0, bucket_list=0.
 */
export function createVenue(
  db: DatabaseAdapter,
  input: CreateVenueInput,
): Venue {
  const ts = now();
  const id = input.id ?? makeId('vn');

  const row: Venue = {
    id,
    name: input.name,
    city: input.city ?? null,
    country: input.country ?? null,
    sport: input.sport ?? null,
    team: input.team ?? null,
    capacity: input.capacity ?? null,
    visited: input.visited ?? 0,
    first_visit_at: input.first_visit_at ?? null,
    last_visit_at: input.last_visit_at ?? null,
    rating: input.rating ?? null,
    bucket_list: input.bucket_list ?? 0,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    notes_md: input.notes_md ?? null,
    created_at: ts,
    updated_at: ts,
  };

  db.execute(
    `INSERT INTO sp_venues (
      id, name, city, country, sport, team, capacity,
      visited, first_visit_at, last_visit_at, rating, bucket_list,
      lat, lng, notes_md, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.name,
      row.city,
      row.country,
      row.sport,
      row.team,
      row.capacity,
      row.visited,
      row.first_visit_at,
      row.last_visit_at,
      row.rating,
      row.bucket_list,
      row.lat,
      row.lng,
      row.notes_md,
      row.created_at,
      row.updated_at,
    ],
  );

  return row;
}

export interface UpdateVenueInput {
  name?: string;
  city?: string | null;
  country?: string | null;
  sport?: string | null;
  team?: string | null;
  capacity?: number | null;
  visited?: SqliteBool;
  first_visit_at?: number | null;
  last_visit_at?: number | null;
  rating?: StarRating | null;
  bucket_list?: SqliteBool;
  lat?: number | null;
  lng?: number | null;
  notes_md?: string | null;
}

/**
 * Partial update to a venue row. Bumps `updated_at`. Returns the
 * refreshed row, or null if the id doesn't exist.
 */
export function updateVenue(
  db: DatabaseAdapter,
  id: string,
  patch: UpdateVenueInput,
): Venue | null {
  const existing = getVenue(db, id);
  if (!existing) return null;

  const sets: string[] = [];
  const params: unknown[] = [];

  if (patch.name !== undefined) {
    sets.push('name = ?');
    params.push(patch.name);
  }
  if (patch.city !== undefined) {
    sets.push('city = ?');
    params.push(patch.city);
  }
  if (patch.country !== undefined) {
    sets.push('country = ?');
    params.push(patch.country);
  }
  if (patch.sport !== undefined) {
    sets.push('sport = ?');
    params.push(patch.sport);
  }
  if (patch.team !== undefined) {
    sets.push('team = ?');
    params.push(patch.team);
  }
  if (patch.capacity !== undefined) {
    sets.push('capacity = ?');
    params.push(patch.capacity);
  }
  if (patch.visited !== undefined) {
    sets.push('visited = ?');
    params.push(patch.visited);
  }
  if (patch.first_visit_at !== undefined) {
    sets.push('first_visit_at = ?');
    params.push(patch.first_visit_at);
  }
  if (patch.last_visit_at !== undefined) {
    sets.push('last_visit_at = ?');
    params.push(patch.last_visit_at);
  }
  if (patch.rating !== undefined) {
    sets.push('rating = ?');
    params.push(patch.rating);
  }
  if (patch.bucket_list !== undefined) {
    sets.push('bucket_list = ?');
    params.push(patch.bucket_list);
  }
  if (patch.lat !== undefined) {
    sets.push('lat = ?');
    params.push(patch.lat);
  }
  if (patch.lng !== undefined) {
    sets.push('lng = ?');
    params.push(patch.lng);
  }
  if (patch.notes_md !== undefined) {
    sets.push('notes_md = ?');
    params.push(patch.notes_md);
  }

  sets.push('updated_at = ?');
  params.push(now());
  params.push(id);

  db.execute(`UPDATE sp_venues SET ${sets.join(', ')} WHERE id = ?`, params);
  return getVenue(db, id);
}

/**
 * Mark a venue as visited. Sets `visited = 1`, bumps `last_visit_at` to
 * `visitedAt` (defaults to now), and sets `first_visit_at` to the same
 * value when it was null. Idempotent on repeat calls -- first_visit_at
 * never moves once set.
 */
export function markVisited(
  db: DatabaseAdapter,
  id: string,
  visitedAt: number = now(),
): Venue | null {
  const existing = getVenue(db, id);
  if (!existing) return null;
  return updateVenue(db, id, {
    visited: 1,
    first_visit_at: existing.first_visit_at ?? visitedAt,
    last_visit_at: visitedAt,
  });
}

/**
 * Toggle or set a venue's bucket-list flag.
 */
export function setBucketList(
  db: DatabaseAdapter,
  id: string,
  onList: boolean,
): Venue | null {
  return updateVenue(db, id, { bucket_list: onList ? 1 : 0 });
}

/**
 * Delete a venue. Returns true iff a row was removed.
 */
export function deleteVenue(db: DatabaseAdapter, id: string): boolean {
  const existing = getVenue(db, id);
  if (!existing) return false;
  db.execute('DELETE FROM sp_venues WHERE id = ?', [id]);
  return true;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function getVenue(db: DatabaseAdapter, id: string): Venue | null {
  const rows = db.query<VenueRow>('SELECT * FROM sp_venues WHERE id = ?', [id]);
  return rows.length > 0 ? rowToVenue(rows[0]) : null;
}

export interface ListVenuesFilters {
  visited?: boolean;
  bucketList?: boolean;
  sport?: string;
}

/**
 * List venues ordered by name ASC. Filters compose with AND semantics.
 */
export function listVenues(
  db: DatabaseAdapter,
  filters: ListVenuesFilters = {},
): Venue[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.visited !== undefined) {
    where.push('visited = ?');
    params.push(filters.visited ? 1 : 0);
  }
  if (filters.bucketList !== undefined) {
    where.push('bucket_list = ?');
    params.push(filters.bucketList ? 1 : 0);
  }
  if (filters.sport !== undefined) {
    where.push('sport = ?');
    params.push(filters.sport);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  return db
    .query<VenueRow>(
      `SELECT * FROM sp_venues ${whereClause} ORDER BY name ASC`,
      params,
    )
    .map(rowToVenue);
}
