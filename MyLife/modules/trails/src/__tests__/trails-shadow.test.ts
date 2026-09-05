/**
 * Phase 1c Wave A shadow-write tests for tr_trails -> hub_places.
 *
 * Validates that every trail CRUD operation keeps the local tr_trails row
 * and the hub_places row in sync inside a single transaction. If the hub
 * write fails, the local insert must roll back (atomicity).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { TRAILS_MODULE } from '../definition';
import { createTrail, updateTrail, deleteTrail } from '../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('trails', TRAILS_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

interface TrailRow {
  id: string;
  hub_place_id: string | null;
  lat: number;
  lng: number;
  name: string;
}

interface PlaceRow {
  id: string;
  name: string;
  kind: string;
  lat: number;
  lng: number;
  geohash: string | null;
  module_origin: string | null;
}

function readTrailRow(db: InMemoryTestDatabase, id: string): TrailRow | null {
  const rows = db.adapter.query<TrailRow>(
    'SELECT id, hub_place_id, lat, lng, name FROM tr_trails WHERE id = ?',
    [id],
  );
  return rows[0] ?? null;
}

function readPlaceRow(db: InMemoryTestDatabase, id: string): PlaceRow | null {
  const rows = db.adapter.query<PlaceRow>(
    'SELECT id, name, kind, lat, lng, geohash, module_origin FROM hub_places WHERE id = ?',
    [id],
  );
  return rows[0] ?? null;
}

describe('trails shadow-write -> hub_places', () => {
  it('createTrail populates hub_place_id and writes a hub_places row with auto geohash', () => {
    createTrail(testDb.adapter, 't-sf', {
      name: 'SF Trailhead',
      difficulty: 'moderate',
      distanceMeters: 1000,
      elevationGainMeters: 50,
      lat: 37.7749,
      lng: -122.4194,
    });

    const trailRow = readTrailRow(testDb, 't-sf');
    expect(trailRow).not.toBeNull();
    expect(trailRow!.hub_place_id).toBeTruthy();

    const placeRow = readPlaceRow(testDb, trailRow!.hub_place_id!);
    expect(placeRow).not.toBeNull();
    expect(placeRow!.name).toBe('SF Trailhead');
    expect(placeRow!.kind).toBe('trailhead');
    expect(placeRow!.lat).toBe(37.7749);
    expect(placeRow!.lng).toBe(-122.4194);
    expect(placeRow!.module_origin).toBe('trails');

    // Geohash was auto-computed at precision 9 from the supplied coords.
    // SF (37.7749, -122.4194) falls in the 9q8... cell.
    expect(placeRow!.geohash).not.toBeNull();
    expect(placeRow!.geohash).toHaveLength(9);
    expect(placeRow!.geohash!.startsWith('9q8')).toBe(true);
  });

  it('updateTrail with new lat/lng propagates to hub_places and recomputes geohash', () => {
    createTrail(testDb.adapter, 't-move', {
      name: 'Moving Trail',
      difficulty: 'easy',
      distanceMeters: 500,
      elevationGainMeters: 10,
      lat: 37.7749,
      lng: -122.4194,
    });
    const originalHubPlaceId = readTrailRow(testDb, 't-move')!.hub_place_id!;
    const originalGeohash = readPlaceRow(testDb, originalHubPlaceId)!.geohash!;

    // Relocate to NYC (40.7128, -74.0060) and rename.
    updateTrail(testDb.adapter, 't-move', {
      name: 'NYC Trail',
      lat: 40.7128,
      lng: -74.006,
    });

    const placeRow = readPlaceRow(testDb, originalHubPlaceId);
    expect(placeRow).not.toBeNull();
    expect(placeRow!.name).toBe('NYC Trail');
    expect(placeRow!.lat).toBe(40.7128);
    expect(placeRow!.lng).toBe(-74.006);
    expect(placeRow!.geohash).not.toBe(originalGeohash);
    expect(placeRow!.geohash).toHaveLength(9);
  });

  it('updateTrail without name/lat/lng leaves hub_places untouched', () => {
    createTrail(testDb.adapter, 't-quiet', {
      name: 'Quiet Trail',
      difficulty: 'easy',
      distanceMeters: 500,
      elevationGainMeters: 10,
      lat: 37.7749,
      lng: -122.4194,
    });
    const hubPlaceId = readTrailRow(testDb, 't-quiet')!.hub_place_id!;
    const before = readPlaceRow(testDb, hubPlaceId)!;

    updateTrail(testDb.adapter, 't-quiet', { difficulty: 'hard', isSaved: true });

    const after = readPlaceRow(testDb, hubPlaceId)!;
    expect(after.name).toBe(before.name);
    expect(after.lat).toBe(before.lat);
    expect(after.lng).toBe(before.lng);
    expect(after.geohash).toBe(before.geohash);
  });

  it('deleteTrail removes both the tr_trails row and the hub_places row', () => {
    createTrail(testDb.adapter, 't-del', {
      name: 'Doomed Trail',
      difficulty: 'moderate',
      distanceMeters: 800,
      elevationGainMeters: 40,
      lat: 37.7749,
      lng: -122.4194,
    });
    const hubPlaceId = readTrailRow(testDb, 't-del')!.hub_place_id!;
    expect(readPlaceRow(testDb, hubPlaceId)).not.toBeNull();

    deleteTrail(testDb.adapter, 't-del');

    expect(readTrailRow(testDb, 't-del')).toBeNull();
    expect(readPlaceRow(testDb, hubPlaceId)).toBeNull();
  });

  it('rolls back the tr_trails insert when the hub_places shadow write fails', () => {
    // Force the hub write to fail by dropping the hub_places table before the
    // createTrail call. The surrounding db.transaction(...) must roll back
    // the tr_trails insert so neither row exists.
    testDb.adapter.execute('DROP TABLE hub_places');

    expect(() =>
      createTrail(testDb.adapter, 't-bad', {
        name: 'Failing Trail',
        difficulty: 'moderate',
        distanceMeters: 500,
        elevationGainMeters: 20,
        lat: 37.7749,
        lng: -122.4194,
      }),
    ).toThrow();

    // tr_trails insert must have rolled back — no orphaned trail row.
    expect(readTrailRow(testDb, 't-bad')).toBeNull();
  });
});
