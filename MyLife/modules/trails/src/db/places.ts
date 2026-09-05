/**
 * Cross-module place readers for @mylife/trails.
 *
 * Phase 1c Wave A shipped a shadow-write path from tr_trails to hub_places
 * (storing the canonical place id on tr_trails.hub_place_id). These helpers
 * expose the read side so other modules can:
 *
 *   - Reverse-resolve a hub_place id back to its owning trail
 *   - Find every trail near a given geohash prefix using the shared
 *     hub_places spatial index
 *
 * Reads only. No schema changes. No mutation of the shadow-write path.
 */

import { findNearbyPlaces, type DatabaseAdapter } from '@mylife/db';
import type { Trail } from '../types';

// ---------------------------------------------------------------------------
// Internal row -> Trail mapper (mirrors crud.rowToTrail; kept private here so
// the cross-module reader does not import from crud's internals).
// ---------------------------------------------------------------------------

function rowToTrail(row: Record<string, unknown>): Trail {
  return {
    id: row.id as string,
    name: row.name as string,
    difficulty: row.difficulty as Trail['difficulty'],
    distanceMeters: row.distance_meters as number,
    elevationGainMeters: row.elevation_gain_meters as number,
    estimatedMinutes: (row.estimated_minutes as number) ?? null,
    lat: row.lat as number,
    lng: row.lng as number,
    region: (row.region as string) ?? null,
    description: (row.description as string) ?? null,
    isSaved: (row.is_saved as number) === 1,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// Public readers
// ---------------------------------------------------------------------------

/**
 * Reverse lookup: find the tr_trails row whose hub_place_id matches
 * `placeId`. Returns null when no trail is bound to that place. Useful
 * for cross-module navigation (e.g. a hub_place tile resolving back to
 * the owning trail screen).
 */
export function getTrailByHubPlaceId(
  db: DatabaseAdapter,
  placeId: string,
): Trail | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_trails WHERE hub_place_id = ? LIMIT 1`,
    [placeId],
  );
  return rows.length > 0 ? rowToTrail(rows[0]!) : null;
}

/**
 * Find trails whose shadow-written hub_places row has a geohash starting
 * with `geohashPrefix`. Walks the shared hub_places index via
 * findNearbyPlaces (which uses hub_places_geo_idx), then joins back to
 * tr_trails via hub_place_id.
 *
 * Default limit is 10. The hub-side prefix scan uses up to limit*2 to
 * give the trails join headroom in case the prefix matches non-trail
 * places (other modules may also write into hub_places).
 */
export function getTrailsNearGeohash(
  db: DatabaseAdapter,
  geohashPrefix: string,
  limit: number = 10,
): Trail[] {
  if (geohashPrefix.length === 0) return [];

  const places = findNearbyPlaces(db, {
    geohash: geohashPrefix,
    prefixLength: geohashPrefix.length,
    limit: limit * 2,
  });
  if (places.length === 0) return [];

  const placeIds = places.map((p) => p.id);
  const placeholders = placeIds.map(() => '?').join(',');
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM tr_trails
     WHERE hub_place_id IN (${placeholders})
     ORDER BY created_at DESC
     LIMIT ?`,
    [...placeIds, limit],
  );
  return rows.map(rowToTrail);
}
