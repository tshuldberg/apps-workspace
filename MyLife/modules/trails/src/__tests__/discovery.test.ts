import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { TRAILS_MODULE } from '../definition';
import { upsertDatabaseEntry, saveDatabaseTrailToMyTrails } from '../db/crud';
import {
  getCollections,
  getFeaturedRegions,
  getRecommendedTrails,
  getTrendingTrails,
} from '../discovery';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('trails', TRAILS_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

function seedEntries() {
  const now = Date.now();

  const entries = [
    {
      id: 'rockies-alpine',
      osmId: 'osm-1',
      name: 'Alpine Lake Trail',
      description: 'A high-country lake trail with summit views.',
      difficulty: 'hard' as const,
      distanceMeters: 14_200,
      elevationGainMeters: 980,
      lat: 39.64,
      lng: -105.82,
      region: 'Rockies',
      trailType: 'hiking' as const,
      surface: 'singletrack',
      routeGeometry: '{"type":"LineString"}',
      source: 'osm',
      fetchedAt: new Date(now - 24 * 86_400_000).toISOString(),
    },
    {
      id: 'rockies-bloom',
      osmId: 'osm-2',
      name: 'Wildflower Meadow Loop',
      description: 'Meadow bloom route with lake loop and family pullouts.',
      difficulty: 'easy' as const,
      distanceMeters: 5_400,
      elevationGainMeters: 150,
      lat: 39.68,
      lng: -105.76,
      region: 'Rockies',
      trailType: 'hiking' as const,
      surface: 'dirt',
      routeGeometry: null,
      source: 'osm',
      fetchedAt: new Date(now - 5 * 86_400_000).toISOString(),
    },
    {
      id: 'cascades-falls',
      osmId: 'osm-3',
      name: 'Cedar Falls Trail',
      description: 'Waterfall and creek route with dense cedar cover.',
      difficulty: 'moderate' as const,
      distanceMeters: 8_800,
      elevationGainMeters: 430,
      lat: 47.49,
      lng: -121.76,
      region: 'Cascades',
      trailType: 'running' as const,
      surface: 'forest',
      routeGeometry: '{"type":"LineString"}',
      source: 'osm',
      fetchedAt: new Date(now - 4 * 3_600_000).toISOString(),
    },
    {
      id: 'cascades-family',
      osmId: 'osm-4',
      name: 'Pine Lake Loop',
      description: 'Accessible lake loop with picnic stops.',
      difficulty: 'easy' as const,
      distanceMeters: 4_200,
      elevationGainMeters: 110,
      lat: 47.44,
      lng: -121.82,
      region: 'Cascades',
      trailType: 'hiking' as const,
      surface: 'packed dirt',
      routeGeometry: null,
      source: 'osm',
      fetchedAt: new Date(now - 3 * 86_400_000).toISOString(),
    },
    {
      id: 'andes-ridge',
      osmId: 'osm-5',
      name: 'Condor Ridge Pass',
      description: 'Expert ridge traverse with long views.',
      difficulty: 'expert' as const,
      distanceMeters: 18_000,
      elevationGainMeters: 1_300,
      lat: -13.52,
      lng: -71.98,
      region: 'Andes',
      trailType: 'hiking' as const,
      surface: 'rock',
      routeGeometry: '{"type":"LineString"}',
      source: 'osm',
      fetchedAt: new Date(now - 7 * 86_400_000).toISOString(),
    },
  ];

  return entries.map((entry) =>
    upsertDatabaseEntry(testDb.adapter, entry.id, entry),
  );
}

describe('trails discovery selectors', () => {
  it('groups trail database entries into featured regions', () => {
    seedEntries();

    const featured = getFeaturedRegions(testDb.adapter, { limit: 3 });

    expect(featured).toHaveLength(3);
    expect(featured[0]).toMatchObject({
      name: 'Rockies',
      trailCount: 2,
      dominantDifficulty: 'easy',
    });
    expect(featured[0].trailTypes).toContain('hiking');
  });

  it('builds curated discovery collections from keywords and fallbacks', () => {
    seedEntries();

    const collections = getCollections(testDb.adapter);
    const waterfall = collections.find((collection) => collection.id === 'epic-waterfalls');
    const family = collections.find((collection) => collection.id === 'family-friendly');

    expect(waterfall?.entries.map((entry) => entry.name)).toContain('Cedar Falls Trail');
    expect(family?.entries.map((entry) => entry.name)).toContain('Pine Lake Loop');
  });

  it('ranks the newest, richest routes as trending trails', () => {
    const entries = seedEntries();

    const trending = getTrendingTrails(testDb.adapter, { limit: 2 });

    expect(trending[0].id).toBe(entries[2].id);
    expect(trending[0].name).toBe('Cedar Falls Trail');
  });

  it('recommends trails using recent trail history and region overlap', () => {
    const entries = seedEntries();
    saveDatabaseTrailToMyTrails(testDb.adapter, entries[2], 'saved-trail-1');

    const recommendations = getRecommendedTrails(testDb.adapter, { limit: 3 });

    expect(recommendations[0].trail.name).not.toBe('Cedar Falls Trail');
    expect(recommendations[0].reason).toMatch(/Because you/);
    expect(recommendations[0].matchedTrailName).toBe('Cedar Falls Trail');
  });
});
