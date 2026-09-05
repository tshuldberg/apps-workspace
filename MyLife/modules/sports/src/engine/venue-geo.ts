import type { Venue } from '../types';

/**
 * Venue geo helpers for MySports (P8-D).
 *
 * Pure TypeScript. No DB access, no fetch, no React imports, no
 * `Date.now()`, no persistence. Callers are responsible for driving
 * map overlays (mobile Mapbox, web Leaflet, etc.) with the output.
 */

export interface VenueGeoPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  visited: boolean;
  bucketList: boolean;
}

/**
 * Narrow a `Venue` row to a `VenueGeoPoint` if and only if both `lat`
 * and `lng` are non-null finite numbers. Rows with missing or non-finite
 * coordinates are dropped. The return value is sorted by `name` ascending
 * using default locale comparison so callers get a deterministic list.
 *
 * `visited` and `bucket_list` on the live `Venue` type are SqliteBool
 * (0 or 1); they are projected to `boolean` here for consumers.
 */
export function extractVenueGeoPoints(
  venues: readonly Venue[],
): readonly VenueGeoPoint[] {
  const out: VenueGeoPoint[] = [];
  for (const venue of venues) {
    const { lat, lng } = venue;
    if (lat === null || lng === null) continue;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({
      id: venue.id,
      name: venue.name,
      lat,
      lng,
      visited: venue.visited === 1,
      bucketList: venue.bucket_list === 1,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
