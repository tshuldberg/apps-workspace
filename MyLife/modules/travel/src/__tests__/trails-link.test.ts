import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import { suggestTrailsForDestination } from '../integrations/trails-link';

function createTrailsTable(adapter: DatabaseAdapter): void {
  adapter.execute(`
    CREATE TABLE tr_trails (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      difficulty TEXT,
      distance_meters REAL,
      region TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function insertTrail(
  adapter: DatabaseAdapter,
  params: {
    id: string;
    name: string;
    difficulty?: string;
    distanceMeters?: number;
    region?: string;
    createdAt?: string;
  },
): void {
  adapter.execute(
    `INSERT INTO tr_trails (id, name, difficulty, distance_meters, region, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      params.id,
      params.name,
      params.difficulty ?? null,
      params.distanceMeters ?? 0,
      params.region ?? null,
      params.createdAt ?? new Date().toISOString(),
    ],
  );
}

describe('@mylife/travel trails-link integration', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('travel', TRAVEL_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('returns [] when tr_trails is missing (Trails not installed)', () => {
    expect(suggestTrailsForDestination(adapter, 'Tokyo')).toEqual([]);
  });

  it('matches trails by region LIKE and maps distance to lengthKm', () => {
    createTrailsTable(adapter);
    insertTrail(adapter, {
      id: 't1',
      name: 'Mount Fuji Loop',
      difficulty: 'hard',
      distanceMeters: 12500,
      region: 'Japan - Fuji',
    });
    insertTrail(adapter, {
      id: 't2',
      name: 'Appalachian Section',
      region: 'USA - NC',
      distanceMeters: 8000,
    });

    const result = suggestTrailsForDestination(adapter, 'Japan');
    expect(result).toHaveLength(1);
    expect(result[0]!.trailId).toBe('t1');
    expect(result[0]!.lengthKm).toBe(12.5);
    expect(result[0]!.difficulty).toBe('hard');
  });

  it('falls back to recent trails when region does not match', () => {
    createTrailsTable(adapter);
    insertTrail(adapter, {
      id: 't1',
      name: 'Older',
      region: 'USA',
      createdAt: '2020-01-01T00:00:00Z',
    });
    insertTrail(adapter, {
      id: 't2',
      name: 'Newer',
      region: 'USA',
      createdAt: '2026-01-01T00:00:00Z',
    });

    const result = suggestTrailsForDestination(adapter, 'Antarctica', 5);
    expect(result).toHaveLength(2);
    expect(result[0]!.trailId).toBe('t2');
  });

  it('respects the limit parameter', () => {
    createTrailsTable(adapter);
    for (let i = 0; i < 12; i++) {
      insertTrail(adapter, {
        id: 't' + i,
        name: 'Trail ' + i,
        region: 'Nowhere',
        createdAt: '2026-01-' + String(i + 1).padStart(2, '0') + 'T00:00:00Z',
      });
    }
    const result = suggestTrailsForDestination(adapter, 'Mars', 3);
    expect(result).toHaveLength(3);
  });
});
