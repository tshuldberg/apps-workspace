/**
 * Destination CRUD for MyTravel.
 *
 * Pure functions of (DatabaseAdapter, input). No network, no side effects
 * outside the DB. `bucket_list` is stored as 0/1 in SQLite and surfaced as
 * a boolean on the DestinationRecord.
 */

import type { DatabaseAdapter } from '@mylife/db';
import {
  DestinationInputSchema,
  DestinationUpdateSchema,
  type DestinationInput,
  type DestinationUpdate,
  type DestinationFilter,
  type DestinationRow,
  type DestinationRecord,
} from '../../models/schemas';
import { REGION_DEFINITIONS } from '../../engine/geo-data';

// ── Helpers ─────────────────────────────────────────────────────────

function deserialize(row: DestinationRow): DestinationRecord {
  return {
    ...row,
    bucket_list: row.bucket_list === 1,
  };
}

const UPDATE_COLUMNS = new Set([
  'name',
  'country',
  'country_code',
  'region',
  'lat',
  'lng',
  'rating',
  'priority',
  'notes_md',
  'best_season',
  'photo_id',
]);

// ── Create ──────────────────────────────────────────────────────────

export function createDestination(
  db: DatabaseAdapter,
  input: DestinationInput,
): DestinationRecord {
  const parsed = DestinationInputSchema.parse(input);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.execute(
    `INSERT INTO tv_destinations
       (id, name, country, country_code, region, lat, lng,
        first_visited, last_visited, visit_count,
        rating, bucket_list, priority, notes_md, best_season, photo_id,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      parsed.name,
      parsed.country ?? null,
      parsed.country_code ? parsed.country_code.toUpperCase() : null,
      parsed.region ?? null,
      parsed.lat ?? null,
      parsed.lng ?? null,
      parsed.rating ?? null,
      parsed.bucket_list ? 1 : 0,
      parsed.priority ?? null,
      parsed.notes_md ?? null,
      parsed.best_season ?? null,
      parsed.photo_id ?? null,
      now,
      now,
    ],
  );

  return {
    id,
    name: parsed.name,
    country: parsed.country ?? null,
    country_code: parsed.country_code ? parsed.country_code.toUpperCase() : null,
    region: parsed.region ?? null,
    lat: parsed.lat ?? null,
    lng: parsed.lng ?? null,
    first_visited: null,
    last_visited: null,
    visit_count: 0,
    rating: parsed.rating ?? null,
    bucket_list: parsed.bucket_list,
    priority: parsed.priority ?? null,
    notes_md: parsed.notes_md ?? null,
    best_season: parsed.best_season ?? null,
    photo_id: parsed.photo_id ?? null,
    created_at: now,
    updated_at: now,
  };
}

// ── Read ────────────────────────────────────────────────────────────

export function getDestination(
  db: DatabaseAdapter,
  id: string,
): DestinationRecord | null {
  const rows = db.query<DestinationRow>(
    `SELECT * FROM tv_destinations WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? deserialize(rows[0]) : null;
}

// ── Update ──────────────────────────────────────────────────────────

export function updateDestination(
  db: DatabaseAdapter,
  id: string,
  patch: DestinationUpdate,
): void {
  const parsed = DestinationUpdateSchema.parse(patch);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined) continue;

    if (key === 'bucket_list') {
      fields.push('bucket_list = ?');
      values.push(value ? 1 : 0);
    } else if (key === 'country_code') {
      fields.push('country_code = ?');
      values.push(typeof value === 'string' ? value.toUpperCase() : null);
    } else if (UPDATE_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE tv_destinations SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

// ── Delete ──────────────────────────────────────────────────────────

export function deleteDestination(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM tv_destinations WHERE id = ?`, [id]);
}

// ── List + filters ──────────────────────────────────────────────────

export function listDestinations(
  db: DatabaseAdapter,
  opts?: DestinationFilter,
): DestinationRecord[] {
  let sql = 'SELECT * FROM tv_destinations';
  const params: unknown[] = [];
  const where: string[] = [];

  if (opts?.country) {
    where.push('country = ?');
    params.push(opts.country);
  }

  if (opts?.country_code) {
    where.push('country_code = ?');
    params.push(opts.country_code.toUpperCase());
  }

  if (opts?.region) {
    where.push('region = ?');
    params.push(opts.region);
  }

  if (opts?.bucketList !== undefined) {
    where.push('bucket_list = ?');
    params.push(opts.bucketList ? 1 : 0);
  }

  if (opts?.visited !== undefined) {
    where.push(opts.visited ? 'visit_count > 0' : 'visit_count = 0');
  }

  if (where.length > 0) {
    sql += ' WHERE ' + where.join(' AND ');
  }

  sql += ' ORDER BY name ASC';

  const rows = db.query<DestinationRow>(sql, params);
  return rows.map(deserialize);
}

// ── Search (name + country, case-insensitive) ───────────────────────

export function searchDestinations(
  db: DatabaseAdapter,
  query: string,
): DestinationRecord[] {
  const like = `%${query.toLowerCase()}%`;
  const rows = db.query<DestinationRow>(
    `SELECT * FROM tv_destinations
      WHERE LOWER(name) LIKE ? OR LOWER(COALESCE(country, '')) LIKE ?
      ORDER BY name ASC`,
    [like, like],
  );
  return rows.map(deserialize);
}

// ── Mark visited ────────────────────────────────────────────────────

/**
 * Records a visit. On first call, sets first_visited. Always updates
 * last_visited and increments visit_count. No-op if the destination
 * does not exist.
 */
export function markVisited(
  db: DatabaseAdapter,
  id: string,
  visitedDate: string,
): void {
  const rows = db.query<DestinationRow>(
    `SELECT first_visited FROM tv_destinations WHERE id = ?`,
    [id],
  );
  if (rows.length === 0) return;

  const existing = rows[0].first_visited;
  const now = new Date().toISOString();

  if (existing == null) {
    db.execute(
      `UPDATE tv_destinations
          SET first_visited = ?, last_visited = ?, visit_count = visit_count + 1,
              updated_at = ?
        WHERE id = ?`,
      [visitedDate, visitedDate, now, id],
    );
  } else {
    db.execute(
      `UPDATE tv_destinations
          SET last_visited = ?, visit_count = visit_count + 1, updated_at = ?
        WHERE id = ?`,
      [visitedDate, now, id],
    );
  }
}

// ── Bucket list ─────────────────────────────────────────────────────

/**
 * Bucket list ordered by priority ASC. NULL priorities sort last to keep the
 * most-ranked items at the top of the list.
 */
export function getBucketList(db: DatabaseAdapter): DestinationRecord[] {
  const rows = db.query<DestinationRow>(
    `SELECT * FROM tv_destinations
      WHERE bucket_list = 1
      ORDER BY CASE WHEN priority IS NULL THEN 1 ELSE 0 END ASC,
               priority ASC,
               name ASC`,
  );
  return rows.map(deserialize);
}

// ── Region progress ─────────────────────────────────────────────────

export interface RegionProgress {
  visited: number;
  total: number;
  percent: number;
}

/**
 * Returns visited-vs-total stats for a named region from REGION_DEFINITIONS.
 * "Visited" = distinct country_codes in the region with at least one visited
 * destination (visit_count > 0).
 */
export function getRegionProgress(
  db: DatabaseAdapter,
  regionKey: string,
): RegionProgress {
  const region = REGION_DEFINITIONS[regionKey];
  if (!region || region.countryCodes.length === 0) {
    return { visited: 0, total: 0, percent: 0 };
  }

  const total = region.countryCodes.length;
  const placeholders = region.countryCodes.map(() => '?').join(',');
  const rows = db.query<{ code: string }>(
    `SELECT DISTINCT country_code AS code
       FROM tv_destinations
      WHERE visit_count > 0
        AND country_code IN (${placeholders})`,
    region.countryCodes.map((c) => c.toUpperCase()),
  );
  const visited = rows.length;
  const percent = total === 0 ? 0 : Math.round((visited / total) * 100);
  return { visited, total, percent };
}

// ── Country / city stats ───────────────────────────────────────────

export interface CountryStats {
  countriesVisited: number;
  citiesVisited: number;
}

/**
 * Aggregate counters for the Destinations dashboard.
 * countriesVisited = distinct non-null country_code with at least one visit.
 * citiesVisited    = destinations with visit_count > 0 (each row is a place).
 */
export function getCountryStats(db: DatabaseAdapter): CountryStats {
  const countryRows = db.query<{ n: number }>(
    `SELECT COUNT(DISTINCT country_code) AS n
       FROM tv_destinations
      WHERE visit_count > 0 AND country_code IS NOT NULL`,
  );
  const cityRows = db.query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM tv_destinations WHERE visit_count > 0`,
  );
  return {
    countriesVisited: countryRows[0]?.n ?? 0,
    citiesVisited: cityRows[0]?.n ?? 0,
  };
}

// ── Decade view ─────────────────────────────────────────────────────

export interface DecadeBucket {
  decade: number;
  destinations: DestinationRecord[];
}

/**
 * Groups visited destinations by decade of `first_visited` year.
 * Destinations without first_visited are omitted. Decades are sorted ascending.
 */
export function getDecadeView(db: DatabaseAdapter): DecadeBucket[] {
  const rows = db.query<DestinationRow>(
    `SELECT * FROM tv_destinations
      WHERE first_visited IS NOT NULL
      ORDER BY first_visited ASC`,
  );

  const buckets = new Map<number, DestinationRecord[]>();
  for (const row of rows) {
    if (!row.first_visited) continue;
    const year = parseInt(row.first_visited.slice(0, 4), 10);
    if (!Number.isFinite(year)) continue;
    const decade = Math.floor(year / 10) * 10;
    if (!buckets.has(decade)) buckets.set(decade, []);
    buckets.get(decade)!.push(deserialize(row));
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([decade, destinations]) => ({ decade, destinations }));
}
