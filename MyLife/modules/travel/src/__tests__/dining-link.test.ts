import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import { createTrip } from '../db/crud/trips';
import {
  getDiningVisitsForTrip,
  summarizeDining,
  type DiningVisitLink,
} from '../integrations/dining-link';

function createDiningTables(adapter: DatabaseAdapter): void {
  adapter.execute(`
    CREATE TABLE dn_restaurants (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL
    )
  `);
  adapter.execute(`
    CREATE TABLE dn_visits (
      id TEXT PRIMARY KEY NOT NULL,
      restaurant_id TEXT NOT NULL,
      visited_at TEXT NOT NULL,
      overall_rating INTEGER
    )
  `);
}

function insertRestaurant(
  adapter: DatabaseAdapter,
  id: string,
  name: string,
): void {
  adapter.execute(
    `INSERT INTO dn_restaurants (id, name) VALUES (?, ?)`,
    [id, name],
  );
}

function insertVisit(
  adapter: DatabaseAdapter,
  params: {
    id: string;
    restaurantId: string;
    visitedAt: string;
    rating?: number | null;
  },
): void {
  adapter.execute(
    `INSERT INTO dn_visits (id, restaurant_id, visited_at, overall_rating)
     VALUES (?, ?, ?, ?)`,
    [
      params.id,
      params.restaurantId,
      params.visitedAt,
      params.rating ?? null,
    ],
  );
}

describe('@mylife/travel dining-link integration', () => {
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

  it('returns [] when the trip does not exist', () => {
    createDiningTables(adapter);
    const result = getDiningVisitsForTrip(adapter, 'trip_missing');
    expect(result).toEqual([]);
  });

  it('returns [] when the trip has no date window', () => {
    createDiningTables(adapter);
    const trip = createTrip(adapter, { name: 'Undated' });
    const result = getDiningVisitsForTrip(adapter, trip.id);
    expect(result).toEqual([]);
  });

  it('returns [] when dn_visits is missing (dining not installed)', () => {
    const trip = createTrip(adapter, {
      name: 'Tokyo',
      start_date: '2026-06-01',
      end_date: '2026-06-10',
    });
    const result = getDiningVisitsForTrip(adapter, trip.id);
    expect(result).toEqual([]);
  });

  it('includes visits inside the trip window and excludes those outside', () => {
    createDiningTables(adapter);
    insertRestaurant(adapter, 'rest_1', 'Sushi Place');
    insertRestaurant(adapter, 'rest_2', 'Ramen Spot');

    const trip = createTrip(adapter, {
      name: 'Tokyo',
      start_date: '2026-06-01',
      end_date: '2026-06-10',
    });

    insertVisit(adapter, {
      id: 'v_before',
      restaurantId: 'rest_1',
      visitedAt: '2026-05-30T18:00:00Z',
      rating: 5,
    });
    insertVisit(adapter, {
      id: 'v_start',
      restaurantId: 'rest_1',
      visitedAt: '2026-06-01T20:00:00Z',
      rating: 4,
    });
    insertVisit(adapter, {
      id: 'v_mid',
      restaurantId: 'rest_2',
      visitedAt: '2026-06-05T12:30:00Z',
      rating: 5,
    });
    insertVisit(adapter, {
      id: 'v_end',
      restaurantId: 'rest_2',
      visitedAt: '2026-06-10T23:00:00Z',
      rating: 3,
    });
    insertVisit(adapter, {
      id: 'v_after',
      restaurantId: 'rest_1',
      visitedAt: '2026-06-11T10:00:00Z',
      rating: 5,
    });

    const result = getDiningVisitsForTrip(adapter, trip.id);
    const ids = result.map((r) => r.visitId);
    expect(ids).toEqual(['v_start', 'v_mid', 'v_end']);
  });

  it('populates restaurantName and rating when present', () => {
    createDiningTables(adapter);
    insertRestaurant(adapter, 'rest_1', 'Sushi Place');
    const trip = createTrip(adapter, {
      name: 'Tokyo',
      start_date: '2026-06-01',
      end_date: '2026-06-10',
    });
    insertVisit(adapter, {
      id: 'v_1',
      restaurantId: 'rest_1',
      visitedAt: '2026-06-05T12:30:00Z',
      rating: 4,
    });

    const result = getDiningVisitsForTrip(adapter, trip.id);
    expect(result).toHaveLength(1);
    expect(result[0]!.restaurantName).toBe('Sushi Place');
    expect(result[0]!.rating).toBe(4);
    expect(result[0]!.visitedAtIso).toBe('2026-06-05T12:30:00Z');
  });

  it('omits rating when overall_rating is NULL', () => {
    createDiningTables(adapter);
    insertRestaurant(adapter, 'rest_1', 'Sushi Place');
    const trip = createTrip(adapter, {
      name: 'Tokyo',
      start_date: '2026-06-01',
      end_date: '2026-06-10',
    });
    insertVisit(adapter, {
      id: 'v_1',
      restaurantId: 'rest_1',
      visitedAt: '2026-06-05T12:30:00Z',
      rating: null,
    });

    const result = getDiningVisitsForTrip(adapter, trip.id);
    expect(result).toHaveLength(1);
    expect(result[0]!.rating).toBeUndefined();
  });

  it('summarizeDining returns zero count and no average for empty input', () => {
    const result = summarizeDining([]);
    expect(result).toEqual({ count: 0 });
  });

  it('summarizeDining averages only rated visits', () => {
    const links: DiningVisitLink[] = [
      { visitId: 'a', visitedAtIso: '2026-06-01', rating: 4 },
      { visitId: 'b', visitedAtIso: '2026-06-02', rating: 5 },
      { visitId: 'c', visitedAtIso: '2026-06-03' },
    ];
    const result = summarizeDining(links);
    expect(result.count).toBe(3);
    expect(result.averageRating).toBeCloseTo(4.5, 5);
  });
});
