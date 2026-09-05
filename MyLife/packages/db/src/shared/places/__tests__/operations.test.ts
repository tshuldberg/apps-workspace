/**
 * Tests for shared/places CRUD operations.
 *
 * Uses createHubTestDatabase() which provisions the full hub schema
 * (including hub_places, hub_places_geo_idx, and hub_gps_tracks) with
 * PRAGMA foreign_keys = ON.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { InMemoryTestDatabase } from '../../../test-utils';
import { createHubTestDatabase } from '../../../test-utils';
import { encodeGeohash } from '../helpers';
import {
  createGpsTrack,
  createPlace,
  deletePlace,
  findNearbyPlaces,
  getGpsTrack,
  getGpsTracksFor,
  getPlace,
  updatePlace,
} from '../operations';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createHubTestDatabase();
});

afterEach(() => {
  testDb.close();
});

describe('createPlace', () => {
  it('auto-computes geohash from lat/lng when not provided', () => {
    const place = createPlace(testDb.adapter, {
      name: 'Ocean Beach',
      kind: 'surf',
      lat: 37.7594,
      lng: -122.5107,
    });

    expect(place.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(place.name).toBe('Ocean Beach');
    expect(place.kind).toBe('surf');
    expect(place.geohash).toBe(encodeGeohash(37.7594, -122.5107, 9));
    expect(place.geohash).toHaveLength(9);
    expect(place.createdAt).toMatch(/^\d{4}-\d{2}-\d{2} /);
  });

  it('preserves caller-supplied geohash instead of recomputing', () => {
    const place = createPlace(testDb.adapter, {
      name: 'Custom',
      kind: 'other',
      lat: 37.7594,
      lng: -122.5107,
      geohash: 'custom123',
    });

    expect(place.geohash).toBe('custom123');
  });

  it('persists optional fields (addressJson, moduleOrigin) as null when omitted', () => {
    const place = createPlace(testDb.adapter, {
      name: 'Minimal',
      kind: 'home',
      lat: 0,
      lng: 0,
    });

    expect(place.addressJson).toBeNull();
    expect(place.moduleOrigin).toBeNull();
  });

  it('persists optional fields when provided', () => {
    const place = createPlace(testDb.adapter, {
      name: 'Full',
      kind: 'garden_zone',
      lat: 48.8584,
      lng: 2.2945,
      addressJson: JSON.stringify({ city: 'Paris' }),
      moduleOrigin: 'garden',
    });

    expect(place.addressJson).toBe('{"city":"Paris"}');
    expect(place.moduleOrigin).toBe('garden');
  });
});

describe('getPlace', () => {
  it('round-trips a created place', () => {
    const created = createPlace(testDb.adapter, {
      name: 'Home',
      kind: 'home',
      lat: 40.7580,
      lng: -73.9855,
    });

    const fetched = getPlace(testDb.adapter, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched).toEqual(created);
  });

  it('returns null for unknown id', () => {
    expect(getPlace(testDb.adapter, 'nonexistent')).toBeNull();
  });
});

describe('findNearbyPlaces', () => {
  it('returns places whose geohash matches the given prefix', () => {
    // Three SF places — all share the 9q8yy prefix at precision 5
    const sf1 = createPlace(testDb.adapter, {
      name: 'SF Point A',
      kind: 'other',
      lat: 37.7749,
      lng: -122.4194,
    });
    const sf2 = createPlace(testDb.adapter, {
      name: 'SF Point B',
      kind: 'other',
      lat: 37.7755,
      lng: -122.4180,
    });
    // One NYC place — different prefix
    const nyc = createPlace(testDb.adapter, {
      name: 'NYC Point',
      kind: 'other',
      lat: 40.7580,
      lng: -73.9855,
    });

    const nearby = findNearbyPlaces(testDb.adapter, {
      geohash: sf1.geohash!,
      prefixLength: 5,
    });

    const ids = nearby.map((p) => p.id).sort();
    expect(ids).toContain(sf1.id);
    expect(ids).toContain(sf2.id);
    expect(ids).not.toContain(nyc.id);
  });

  it('respects prefixLength to widen or narrow the search radius', () => {
    const base = createPlace(testDb.adapter, {
      name: 'Base',
      kind: 'other',
      lat: 37.7749,
      lng: -122.4194,
    });
    // Another SF place at a slightly different spot — shares prefix 9q8y
    // but not 9q8yyk8yt
    const nearby = createPlace(testDb.adapter, {
      name: 'Nearby SF',
      kind: 'other',
      lat: 37.76,
      lng: -122.43,
    });

    const wide = findNearbyPlaces(testDb.adapter, {
      geohash: base.geohash!,
      prefixLength: 4,
    });
    expect(wide.map((p) => p.id).sort()).toEqual([base.id, nearby.id].sort());

    const narrow = findNearbyPlaces(testDb.adapter, {
      geohash: base.geohash!,
      prefixLength: 9,
    });
    expect(narrow.map((p) => p.id)).toEqual([base.id]);
  });

  it('respects the limit parameter', () => {
    for (let i = 0; i < 5; i++) {
      createPlace(testDb.adapter, {
        name: `SF-${i}`,
        kind: 'other',
        lat: 37.7749 + i * 0.0001,
        lng: -122.4194 + i * 0.0001,
      });
    }

    const limited = findNearbyPlaces(testDb.adapter, {
      geohash: '9q8yy',
      prefixLength: 4,
      limit: 2,
    });
    expect(limited.length).toBe(2);
  });

  it('defaults prefixLength=5 and limit=50 when omitted', () => {
    createPlace(testDb.adapter, {
      name: 'SF',
      kind: 'other',
      lat: 37.7749,
      lng: -122.4194,
    });

    const hits = findNearbyPlaces(testDb.adapter, {
      geohash: encodeGeohash(37.7749, -122.4194, 9),
    });
    expect(hits.length).toBe(1);
  });
});

describe('updatePlace', () => {
  it('recomputes geohash when lat/lng change', () => {
    const place = createPlace(testDb.adapter, {
      name: 'Moving',
      kind: 'other',
      lat: 37.7749,
      lng: -122.4194,
    });
    const originalGeohash = place.geohash;

    const updated = updatePlace(testDb.adapter, place.id, {
      lat: 40.7580,
      lng: -73.9855,
    });

    expect(updated.lat).toBe(40.7580);
    expect(updated.lng).toBe(-73.9855);
    expect(updated.geohash).toBe(encodeGeohash(40.7580, -73.9855, 9));
    expect(updated.geohash).not.toBe(originalGeohash);
  });

  it('does not recompute geohash when only name or kind changes', () => {
    const place = createPlace(testDb.adapter, {
      name: 'Old Name',
      kind: 'other',
      lat: 37.7749,
      lng: -122.4194,
    });

    const updated = updatePlace(testDb.adapter, place.id, {
      name: 'New Name',
      kind: 'surf',
    });

    expect(updated.name).toBe('New Name');
    expect(updated.kind).toBe('surf');
    expect(updated.geohash).toBe(place.geohash);
  });

  it('throws on unknown id', () => {
    expect(() =>
      updatePlace(testDb.adapter, 'nonexistent', { name: 'x' }),
    ).toThrow(/not found/);
  });
});

describe('deletePlace', () => {
  it('removes the row', () => {
    const place = createPlace(testDb.adapter, {
      name: 'Temp',
      kind: 'other',
      lat: 0,
      lng: 0,
    });

    deletePlace(testDb.adapter, place.id);
    expect(getPlace(testDb.adapter, place.id)).toBeNull();
  });

  it('is a no-op for unknown id', () => {
    expect(() => deletePlace(testDb.adapter, 'nonexistent')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// GpsTrack
// ---------------------------------------------------------------------------

describe('createGpsTrack + getGpsTrack', () => {
  it('round-trips a full track', () => {
    const track = createGpsTrack(testDb.adapter, {
      moduleId: 'trails',
      entityRef: 'hike-123',
      startedAt: '2026-04-18T10:00:00Z',
      endedAt: '2026-04-18T12:00:00Z',
      distanceM: 8400.5,
      polyline: '_p~iF~ps|U_ulLnnqC',
    });

    expect(track.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(track.moduleId).toBe('trails');
    expect(track.entityRef).toBe('hike-123');
    expect(track.distanceM).toBe(8400.5);

    const fetched = getGpsTrack(testDb.adapter, track.id);
    expect(fetched).toEqual(track);
  });

  it('persists missing optional fields as null', () => {
    const track = createGpsTrack(testDb.adapter, {
      moduleId: 'cycle',
      startedAt: '2026-04-18T10:00:00Z',
    });

    expect(track.entityRef).toBeNull();
    expect(track.endedAt).toBeNull();
    expect(track.distanceM).toBeNull();
    expect(track.polyline).toBeNull();
  });

  it('returns null for unknown id', () => {
    expect(getGpsTrack(testDb.adapter, 'nonexistent')).toBeNull();
  });
});

describe('getGpsTracksFor', () => {
  it('filters by moduleId', () => {
    createGpsTrack(testDb.adapter, {
      moduleId: 'trails',
      startedAt: '2026-04-18T10:00:00Z',
    });
    createGpsTrack(testDb.adapter, {
      moduleId: 'cycle',
      startedAt: '2026-04-18T11:00:00Z',
    });

    const trails = getGpsTracksFor(testDb.adapter, { moduleId: 'trails' });
    expect(trails.length).toBe(1);
    expect(trails[0]!.moduleId).toBe('trails');
  });

  it('filters by entityRef when provided', () => {
    createGpsTrack(testDb.adapter, {
      moduleId: 'trails',
      entityRef: 'hike-A',
      startedAt: '2026-04-18T10:00:00Z',
    });
    createGpsTrack(testDb.adapter, {
      moduleId: 'trails',
      entityRef: 'hike-B',
      startedAt: '2026-04-18T11:00:00Z',
    });

    const onlyA = getGpsTracksFor(testDb.adapter, {
      moduleId: 'trails',
      entityRef: 'hike-A',
    });
    expect(onlyA.length).toBe(1);
    expect(onlyA[0]!.entityRef).toBe('hike-A');
  });

  it('orders by started_at DESC (most recent first)', () => {
    createGpsTrack(testDb.adapter, {
      moduleId: 'trails',
      startedAt: '2026-04-01T10:00:00Z',
    });
    createGpsTrack(testDb.adapter, {
      moduleId: 'trails',
      startedAt: '2026-04-18T10:00:00Z',
    });
    createGpsTrack(testDb.adapter, {
      moduleId: 'trails',
      startedAt: '2026-04-10T10:00:00Z',
    });

    const ordered = getGpsTracksFor(testDb.adapter, { moduleId: 'trails' });
    expect(ordered.map((t) => t.startedAt)).toEqual([
      '2026-04-18T10:00:00Z',
      '2026-04-10T10:00:00Z',
      '2026-04-01T10:00:00Z',
    ]);
  });

  it('returns empty array for a module with no tracks', () => {
    const none = getGpsTracksFor(testDb.adapter, { moduleId: 'none' });
    expect(none).toEqual([]);
  });
});
