/**
 * Shared Places — CRUD operations.
 *
 * Typed sync CRUD over hub_places + hub_gps_tracks. Geohash is computed
 * from lat/lng when not supplied by the caller, using the vendored
 * base-32 geohash encoder in ./helpers.
 */

import type { DatabaseAdapter } from '../../adapter';
import { generateId } from '../_generate-id';
import { encodeGeohash } from './helpers';
import {
  CreateGpsTrackInputSchema,
  CreatePlaceInputSchema,
  type CreateGpsTrackInput,
  type CreatePlaceInput,
  type GpsTrack,
  type Place,
  type PlaceKind,
} from './types';

// ---------------------------------------------------------------------------
// Internal row types
// ---------------------------------------------------------------------------

interface PlaceRow {
  id: string;
  name: string;
  kind: string;
  lat: number;
  lng: number;
  geohash: string | null;
  address_json: string | null;
  module_origin: string | null;
  created_at: string;
}

function rowToPlace(row: PlaceRow): Place {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as PlaceKind,
    lat: row.lat,
    lng: row.lng,
    geohash: row.geohash,
    addressJson: row.address_json,
    moduleOrigin: row.module_origin,
    createdAt: row.created_at,
  };
}

interface GpsTrackRow {
  id: string;
  module_id: string;
  entity_ref: string | null;
  started_at: string;
  ended_at: string | null;
  distance_m: number | null;
  polyline: string | null;
  created_at: string;
}

function rowToGpsTrack(row: GpsTrackRow): GpsTrack {
  return {
    id: row.id,
    moduleId: row.module_id,
    entityRef: row.entity_ref,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    distanceM: row.distance_m,
    polyline: row.polyline,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Place CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new place. If `geohash` is not provided, it is computed from
 * lat/lng at precision 9 (~4.8 m cell).
 */
export function createPlace(db: DatabaseAdapter, input: CreatePlaceInput): Place {
  const parsed = CreatePlaceInputSchema.parse(input);
  const id = generateId();
  const geohash = parsed.geohash ?? encodeGeohash(parsed.lat, parsed.lng, 9);

  db.execute(
    `INSERT INTO hub_places (
       id, name, kind, lat, lng, geohash, address_json, module_origin
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      parsed.name,
      parsed.kind,
      parsed.lat,
      parsed.lng,
      geohash,
      parsed.addressJson ?? null,
      parsed.moduleOrigin ?? null,
    ],
  );

  const rows = db.query<PlaceRow>(
    `SELECT * FROM hub_places WHERE id = ?`,
    [id],
  );
  if (rows.length === 0) throw new Error(`Failed to create place ${id}`);
  return rowToPlace(rows[0]!);
}

/** Get a place by ID. Returns null if not found. */
export function getPlace(db: DatabaseAdapter, id: string): Place | null {
  const rows = db.query<PlaceRow>(
    `SELECT * FROM hub_places WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToPlace(rows[0]!) : null;
}

/**
 * Find places whose geohash starts with the first `prefixLength` characters
 * of the supplied geohash. Uses the hub_places_geo_idx index.
 *
 * Defaults: prefixLength = 5 (~4.9 km cell), limit = 50.
 */
export function findNearbyPlaces(
  db: DatabaseAdapter,
  params: { geohash: string; prefixLength?: number; limit?: number },
): Place[] {
  const prefixLength = params.prefixLength ?? 5;
  const limit = params.limit ?? 50;

  if (prefixLength < 1 || prefixLength > params.geohash.length) {
    throw new Error(
      `findNearbyPlaces: prefixLength ${prefixLength} out of bounds for geohash of length ${params.geohash.length}`,
    );
  }

  // Escape LIKE wildcards in the caller-supplied prefix. A real geohash is
  // always base32 (no % or _), but the parameter type is plain string so a
  // caller could in theory pass arbitrary input — match the searchTags guard.
  const prefix = params.geohash
    .slice(0, prefixLength)
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');

  const rows = db.query<PlaceRow>(
    `SELECT * FROM hub_places
     WHERE geohash LIKE ? || '%' ESCAPE '\\'
     ORDER BY geohash ASC
     LIMIT ?`,
    [prefix, limit],
  );

  return rows.map(rowToPlace);
}

/**
 * Update a place. Any of name, kind, lat, lng, addressJson may be patched.
 * If lat or lng is patched, the geohash is re-computed at precision 9.
 */
export function updatePlace(
  db: DatabaseAdapter,
  id: string,
  patch: Partial<Pick<Place, 'name' | 'kind' | 'lat' | 'lng' | 'addressJson'>>,
): Place {
  const existing = getPlace(db, id);
  if (existing === null) throw new Error(`updatePlace: place not found: ${id}`);

  const next: Place = {
    ...existing,
    ...patch,
  };

  const latChanged = patch.lat !== undefined && patch.lat !== existing.lat;
  const lngChanged = patch.lng !== undefined && patch.lng !== existing.lng;
  const nextGeohash =
    latChanged || lngChanged
      ? encodeGeohash(next.lat, next.lng, 9)
      : existing.geohash;

  db.execute(
    `UPDATE hub_places
     SET name = ?, kind = ?, lat = ?, lng = ?, geohash = ?, address_json = ?
     WHERE id = ?`,
    [
      next.name,
      next.kind,
      next.lat,
      next.lng,
      nextGeohash,
      next.addressJson ?? null,
      id,
    ],
  );

  const rows = db.query<PlaceRow>(
    `SELECT * FROM hub_places WHERE id = ?`,
    [id],
  );
  if (rows.length === 0) throw new Error(`updatePlace: failed to read back ${id}`);
  return rowToPlace(rows[0]!);
}

/** Delete a place by ID. No-op if it does not exist. */
export function deletePlace(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM hub_places WHERE id = ?`, [id]);
}

// ---------------------------------------------------------------------------
// GpsTrack CRUD
// ---------------------------------------------------------------------------

/** Create a new GPS track entry. */
export function createGpsTrack(
  db: DatabaseAdapter,
  input: CreateGpsTrackInput,
): GpsTrack {
  const parsed = CreateGpsTrackInputSchema.parse(input);
  const id = generateId();

  db.execute(
    `INSERT INTO hub_gps_tracks (
       id, module_id, entity_ref, started_at, ended_at, distance_m, polyline
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      parsed.moduleId,
      parsed.entityRef ?? null,
      parsed.startedAt,
      parsed.endedAt ?? null,
      parsed.distanceM ?? null,
      parsed.polyline ?? null,
    ],
  );

  const rows = db.query<GpsTrackRow>(
    `SELECT * FROM hub_gps_tracks WHERE id = ?`,
    [id],
  );
  if (rows.length === 0) throw new Error(`Failed to create gps track ${id}`);
  return rowToGpsTrack(rows[0]!);
}

/** Get a GPS track by ID. Returns null if not found. */
export function getGpsTrack(db: DatabaseAdapter, id: string): GpsTrack | null {
  const rows = db.query<GpsTrackRow>(
    `SELECT * FROM hub_gps_tracks WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToGpsTrack(rows[0]!) : null;
}

/**
 * List GPS tracks for a module, optionally filtered by entityRef.
 * Ordered by started_at DESC (most recent first).
 */
export function getGpsTracksFor(
  db: DatabaseAdapter,
  query: { moduleId: string; entityRef?: string },
): GpsTrack[] {
  if (query.entityRef !== undefined) {
    const rows = db.query<GpsTrackRow>(
      `SELECT * FROM hub_gps_tracks
       WHERE module_id = ? AND entity_ref = ?
       ORDER BY started_at DESC`,
      [query.moduleId, query.entityRef],
    );
    return rows.map(rowToGpsTrack);
  }

  const rows = db.query<GpsTrackRow>(
    `SELECT * FROM hub_gps_tracks
     WHERE module_id = ?
     ORDER BY started_at DESC`,
    [query.moduleId],
  );
  return rows.map(rowToGpsTrack);
}
