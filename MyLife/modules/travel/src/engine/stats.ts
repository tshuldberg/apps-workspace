/**
 * MyTravel stats engine.
 *
 * Pure aggregations over existing tables (`tv_destinations`, `tv_trips`,
 * `tv_bookings`). No migrations, no writes, no network.
 *
 * Intent: power the dashboard "Passport" view -- countries, states,
 * continents, region progress, total trip days, distance, per-year trip
 * counts, top destinations by visit_count, upcoming trips, and per-trip
 * booking spend grouped by currency.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { DestinationRow, TripRow } from '../models/schemas';
import {
  COUNTRIES,
  REGION_DEFINITIONS,
  US_STATES,
  type ContinentCode,
} from './geo-data';

// ── Continent map (ISO country code -> continent name) ─────────────

const CONTINENT_NAME: Record<ContinentCode, string> = {
  AF: 'Africa',
  AN: 'Antarctica',
  AS: 'Asia',
  EU: 'Europe',
  NA: 'North America',
  OC: 'Oceania',
  SA: 'South America',
};

const COUNTRY_CODE_TO_CONTINENT: Map<string, string> = new Map(
  COUNTRIES.map((c) => [c.code, CONTINENT_NAME[c.continent]]),
);

const US_STATE_CODES: Set<string> = new Set(US_STATES.map((s) => s.code));

// ── Countries / states / continents ────────────────────────────────

export function countriesVisited(db: DatabaseAdapter): number {
  const rows = db.query<{ n: number }>(
    `SELECT COUNT(DISTINCT country_code) AS n
       FROM tv_destinations
      WHERE visit_count > 0 AND country_code IS NOT NULL`,
  );
  return rows[0]?.n ?? 0;
}

/**
 * US states with at least one visited destination. A destination is counted
 * when country_code='US' and `region` matches a 2-letter US state code.
 */
export function statesVisited(db: DatabaseAdapter): number {
  const rows = db.query<{ region: string | null }>(
    `SELECT DISTINCT region
       FROM tv_destinations
      WHERE visit_count > 0
        AND country_code = 'US'
        AND region IS NOT NULL`,
  );
  const states = new Set<string>();
  for (const r of rows) {
    if (!r.region) continue;
    const code = r.region.toUpperCase();
    if (US_STATE_CODES.has(code)) states.add(code);
  }
  return states.size;
}

export function continentsVisited(db: DatabaseAdapter): string[] {
  const rows = db.query<{ code: string }>(
    `SELECT DISTINCT country_code AS code
       FROM tv_destinations
      WHERE visit_count > 0 AND country_code IS NOT NULL`,
  );
  const continents = new Set<string>();
  for (const r of rows) {
    const c = COUNTRY_CODE_TO_CONTINENT.get(r.code.toUpperCase());
    if (c) continents.add(c);
  }
  return Array.from(continents).sort();
}

// ── Region coverage ────────────────────────────────────────────────

export type RegionKey =
  | 'us_states'
  | 'eu_countries'
  | 'schengen'
  | 'g7'
  | 'g20'
  | 'nordic'
  | 'asean'
  | 'caribbean';

export interface RegionCoverage {
  visited: number;
  total: number;
  pct: number;
}

export function regionCoverage(
  db: DatabaseAdapter,
  region: RegionKey,
): RegionCoverage {
  const def = REGION_DEFINITIONS[region];
  if (!def || def.countryCodes.length === 0) {
    return { visited: 0, total: 0, pct: 0 };
  }
  const total = def.countryCodes.length;
  const codes = def.countryCodes.map((c) => c.toUpperCase());

  let visited = 0;
  if (region === 'us_states') {
    // us_states entries are state codes; match against tv_destinations.region
    // for US destinations only.
    const placeholders = codes.map(() => '?').join(',');
    const rows = db.query<{ region: string }>(
      `SELECT DISTINCT UPPER(region) AS region
         FROM tv_destinations
        WHERE visit_count > 0
          AND country_code = 'US'
          AND region IS NOT NULL
          AND UPPER(region) IN (${placeholders})`,
      codes,
    );
    visited = rows.length;
  } else {
    const placeholders = codes.map(() => '?').join(',');
    const rows = db.query<{ code: string }>(
      `SELECT DISTINCT country_code AS code
         FROM tv_destinations
        WHERE visit_count > 0
          AND country_code IN (${placeholders})`,
      codes,
    );
    visited = rows.length;
  }

  const pct = total === 0 ? 0 : Math.round((visited / total) * 100);
  return { visited, total, pct };
}

// ── Trip aggregates ────────────────────────────────────────────────

/** Sum of (end_date - start_date + 1) days across trips with both dates set. */
export function totalTripDays(db: DatabaseAdapter): number {
  const rows = db.query<{ start_date: string | null; end_date: string | null }>(
    `SELECT start_date, end_date FROM tv_trips
      WHERE start_date IS NOT NULL AND end_date IS NOT NULL`,
  );
  let total = 0;
  for (const r of rows) {
    const days = inclusiveDayCount(r.start_date!, r.end_date!);
    if (days > 0) total += days;
  }
  return total;
}

/**
 * Returns a record keyed by 4-digit year, valued by count of trips whose
 * `start_date` falls in that year. Trips with no start_date are skipped.
 */
export function tripsByYear(db: DatabaseAdapter): Record<string, number> {
  const rows = db.query<{ start_date: string | null }>(
    `SELECT start_date FROM tv_trips WHERE start_date IS NOT NULL`,
  );
  const out: Record<string, number> = {};
  for (const r of rows) {
    const year = (r.start_date ?? '').slice(0, 4);
    if (!/^\d{4}$/.test(year)) continue;
    out[year] = (out[year] ?? 0) + 1;
  }
  return out;
}

/** Count of trips whose status is 'upcoming' or 'planning'. */
export function upcomingTripsCount(db: DatabaseAdapter): number {
  const rows = db.query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM tv_trips
      WHERE status IN ('upcoming','planning')`,
  );
  return rows[0]?.n ?? 0;
}

// ── Distance ───────────────────────────────────────────────────────

/**
 * Total geodesic distance across visited destinations that have both
 * lat and lng. Interpreted as the path length connecting destinations in
 * `first_visited` order (chronological traversal). With fewer than 2 such
 * destinations, returns 0.
 */
export function totalDistanceKm(db: DatabaseAdapter): number {
  const rows = db.query<DestinationRow>(
    `SELECT * FROM tv_destinations
      WHERE visit_count > 0
        AND lat IS NOT NULL
        AND lng IS NOT NULL
      ORDER BY COALESCE(first_visited, created_at) ASC, id ASC`,
  );
  if (rows.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < rows.length; i += 1) {
    const a = rows[i - 1];
    const b = rows[i];
    if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) {
      continue;
    }
    total += haversineKm(a.lat, a.lng, b.lat, b.lng);
  }
  return total;
}

// ── Top destinations ───────────────────────────────────────────────

/**
 * Destinations ordered by visit_count DESC (ties broken by last_visited DESC
 * then name ASC). Defaults to 10. Only visited destinations are returned.
 */
export function topDestinations(
  db: DatabaseAdapter,
  limit = 10,
): DestinationRow[] {
  const safeLimit = Math.max(0, Math.floor(limit));
  if (safeLimit === 0) return [];
  return db.query<DestinationRow>(
    `SELECT * FROM tv_destinations
      WHERE visit_count > 0
      ORDER BY visit_count DESC,
               COALESCE(last_visited, '') DESC,
               name ASC
      LIMIT ?`,
    [safeLimit],
  );
}

// ── Booking spend ──────────────────────────────────────────────────

/**
 * Per-trip booking spend grouped by 3-letter ISO currency code.
 * Returns cents totals. Bookings with NULL currency are grouped under
 * an empty string key. Returns `{}` if the bookings table is unavailable
 * (e.g. migrations not yet applied during concurrent scaffolding).
 */
export function bookingSpendByTripCurrency(
  db: DatabaseAdapter,
  tripId: string,
): Record<string, number> {
  try {
    const rows = db.query<{ currency: string | null; total: number | null }>(
      `SELECT currency, COALESCE(SUM(cost_cents), 0) AS total
         FROM tv_bookings
        WHERE trip_id = ? AND cost_cents IS NOT NULL
        GROUP BY currency`,
      [tripId],
    );
    const out: Record<string, number> = {};
    for (const r of rows) {
      const key = r.currency ?? '';
      out[key] = (out[key] ?? 0) + (r.total ?? 0);
    }
    return out;
  } catch {
    return {};
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function inclusiveDayCount(startIso: string, endIso: string): number {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (!start || !end) return 0;
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return 0;
  return Math.round(ms / (24 * 60 * 60 * 1000)) + 1;
}

function parseIsoDate(iso: string): Date | null {
  const hasTime = iso.includes('T');
  const base = hasTime ? iso : `${iso}T00:00:00.000Z`;
  const d = new Date(base);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

const EARTH_RADIUS_KM = 6371;

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

// Re-export helpers for tests / downstream consumers that need them.
export { CONTINENT_NAME };
