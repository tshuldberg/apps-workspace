/**
 * Phase 2 Wave A reader tests for @mylife/trails/db/places.
 *
 * Exercises the cross-module read-side of the Phase 1c shadow-write that
 * mirrors tr_trails -> hub_places. Trails created in different geographic
 * regions should be reverse-resolvable from their hub_place id and should
 * surface (only the relevant ones) when queried by geohash prefix.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { TRAILS_MODULE } from '../definition';
import { createTrail } from '../db/crud';
import {
  getTrailByHubPlaceId,
  getTrailsNearGeohash,
} from '../db/places';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('trails', TRAILS_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

function getHubPlaceIdForTrail(trailId: string): string {
  const row = testDb.adapter.query<{ hub_place_id: string | null }>(
    `SELECT hub_place_id FROM tr_trails WHERE id = ?`,
    [trailId],
  )[0];
  if (!row?.hub_place_id) {
    throw new Error(`trail ${trailId} has no hub_place_id`);
  }
  return row.hub_place_id;
}

describe('getTrailByHubPlaceId', () => {
  it('reverse-resolves a hub_place id to its owning trail', () => {
    createTrail(testDb.adapter, 't-sf', {
      name: 'SF Trailhead',
      difficulty: 'moderate',
      distanceMeters: 1000,
      elevationGainMeters: 50,
      lat: 37.7749,
      lng: -122.4194,
    });
    const placeId = getHubPlaceIdForTrail('t-sf');

    const trail = getTrailByHubPlaceId(testDb.adapter, placeId);

    expect(trail).not.toBeNull();
    expect(trail!.id).toBe('t-sf');
    expect(trail!.name).toBe('SF Trailhead');
    expect(trail!.lat).toBe(37.7749);
  });

  it('returns null for an unknown hub_place id', () => {
    expect(
      getTrailByHubPlaceId(testDb.adapter, 'place-nope'),
    ).toBeNull();
  });
});

describe('getTrailsNearGeohash', () => {
  beforeEach(() => {
    // Two SF-region trails (geohash '9q8...') and one NYC trail
    // (geohash 'dr5...'). The exact prefixes are stable for these
    // coordinates with the precision-9 encoder used by hub_places.
    createTrail(testDb.adapter, 't-sf-1', {
      name: 'Lands End',
      difficulty: 'easy',
      distanceMeters: 4500,
      elevationGainMeters: 80,
      lat: 37.7749,
      lng: -122.4194,
    });
    createTrail(testDb.adapter, 't-sf-2', {
      name: 'Twin Peaks',
      difficulty: 'moderate',
      distanceMeters: 3200,
      elevationGainMeters: 220,
      lat: 37.7544,
      lng: -122.4477,
    });
    createTrail(testDb.adapter, 't-nyc', {
      name: 'Central Park Loop',
      difficulty: 'easy',
      distanceMeters: 9800,
      elevationGainMeters: 30,
      lat: 40.7812,
      lng: -73.9665,
    });
  });

  it('returns only trails in the matching geohash region', () => {
    const sfHits = getTrailsNearGeohash(testDb.adapter, '9q8');

    const ids = sfHits.map((t) => t.id).sort();
    expect(ids).toEqual(['t-sf-1', 't-sf-2']);
    expect(sfHits.find((t) => t.id === 't-nyc')).toBeUndefined();
  });

  it('returns the NYC trail when queried with the dr5 prefix', () => {
    const nycHits = getTrailsNearGeohash(testDb.adapter, 'dr5');

    expect(nycHits.map((t) => t.id)).toEqual(['t-nyc']);
  });

  it('returns an empty array for a region with no trails', () => {
    expect(getTrailsNearGeohash(testDb.adapter, 'gcp')).toEqual([]);
  });

  it('respects an explicit limit', () => {
    const limited = getTrailsNearGeohash(testDb.adapter, '9q8', 1);
    expect(limited).toHaveLength(1);
  });

  it('returns an empty array for an empty prefix', () => {
    expect(getTrailsNearGeohash(testDb.adapter, '')).toEqual([]);
  });
});
