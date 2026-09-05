import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { TRAILS_MODULE } from '../definition';
import {
  upsertDatabaseEntry,
  getDatabaseEntries,
  searchDatabaseTrails,
  getDatabaseEntry,
  saveDatabaseTrailToMyTrails,
  getTrail,
} from '../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('trails', TRAILS_MODULE.migrations!);
});
afterEach(() => { testDb.close(); });

const entry1 = {
  osmId: 'osm-123',
  name: 'Muir Woods Loop',
  description: 'Beautiful redwood trail',
  difficulty: 'moderate' as const,
  distanceMeters: 5000,
  elevationGainMeters: 200,
  lat: 37.89,
  lng: -122.57,
  region: 'Marin County',
  trailType: 'hiking' as const,
  surface: 'dirt',
  routeGeometry: null,
  source: 'osm',
  fetchedAt: '2026-03-20T10:00:00Z',
};

describe('Trail Database CRUD', () => {
  it('upserts a new entry', () => {
    const e = upsertDatabaseEntry(testDb.adapter, 'db1', entry1);
    expect(e.id).toBe('db1');
    expect(e.name).toBe('Muir Woods Loop');
    expect(e.osmId).toBe('osm-123');
  });

  it('upserts existing entry by osm_id (update)', () => {
    upsertDatabaseEntry(testDb.adapter, 'db1', entry1);
    upsertDatabaseEntry(testDb.adapter, 'db1', { ...entry1, name: 'Updated Name' });
    const all = getDatabaseEntries(testDb.adapter, {});
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Updated Name');
  });

  it('gets a single entry', () => {
    upsertDatabaseEntry(testDb.adapter, 'db1', entry1);
    const e = getDatabaseEntry(testDb.adapter, 'db1');
    expect(e).not.toBeNull();
    expect(e!.region).toBe('Marin County');
  });

  it('lists entries with difficulty filter', () => {
    upsertDatabaseEntry(testDb.adapter, 'db1', entry1);
    upsertDatabaseEntry(testDb.adapter, 'db2', { ...entry1, osmId: 'osm-456', name: 'Easy Trail', difficulty: 'easy' as const });
    const moderate = getDatabaseEntries(testDb.adapter, { difficulty: 'moderate' });
    expect(moderate).toHaveLength(1);
    expect(moderate[0].name).toBe('Muir Woods Loop');
  });

  it('lists entries with trail type filter', () => {
    upsertDatabaseEntry(testDb.adapter, 'db1', entry1);
    upsertDatabaseEntry(testDb.adapter, 'db2', { ...entry1, osmId: 'osm-456', name: 'Bike Path', trailType: 'cycling' as const });
    const hiking = getDatabaseEntries(testDb.adapter, { trailType: 'hiking' });
    expect(hiking).toHaveLength(1);
  });

  it('searches by name with LIKE', () => {
    upsertDatabaseEntry(testDb.adapter, 'db1', entry1);
    upsertDatabaseEntry(testDb.adapter, 'db2', { ...entry1, osmId: 'osm-456', name: 'Coastal Trail' });
    const results = searchDatabaseTrails(testDb.adapter, 'Muir');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Muir Woods Loop');
  });

  it('search is case-insensitive', () => {
    upsertDatabaseEntry(testDb.adapter, 'db1', entry1);
    const results = searchDatabaseTrails(testDb.adapter, 'muir');
    expect(results).toHaveLength(1);
  });

  it('saves database trail to My Trails', () => {
    const dbEntry = upsertDatabaseEntry(testDb.adapter, 'db1', entry1);
    const trail = saveDatabaseTrailToMyTrails(testDb.adapter, dbEntry, 't1');
    expect(trail.name).toBe('Muir Woods Loop');
    expect(trail.difficulty).toBe('moderate');
    expect(trail.lat).toBe(37.89);

    // Verify it's in the trails table
    const saved = getTrail(testDb.adapter, 't1');
    expect(saved).not.toBeNull();
  });
});
