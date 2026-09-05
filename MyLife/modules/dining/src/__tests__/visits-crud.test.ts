import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { DINING_MODULE } from '../definition';
import {
  createRestaurant,
  getRestaurant,
} from '../db/crud/restaurants';
import {
  createVisit,
  getVisit,
  updateVisit,
  deleteVisit,
  listVisitsByRestaurant,
  listVisitsChronological,
  getVisitStats,
} from '../db/crud/visits';

let db: DatabaseAdapter;
let closeDb: () => void;
let nextId = 0;

function genId(): string {
  nextId += 1;
  return `test-${nextId.toString().padStart(4, '0')}`;
}

beforeEach(() => {
  nextId = 0;
  const testDb = createModuleTestDatabase('dining', DINING_MODULE.migrations!);
  db = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

describe('createVisit round-trip', () => {
  it('creates a visit and updates restaurant counters', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Test Spot' });

    const vId = genId();
    const visit = createVisit(db, vId, {
      restaurant_id: rId,
      visited_at: '2025-06-15T19:00:00Z',
      overall_rating: 4,
      party_size: 2,
      occasion: 'Date Night',
    });

    expect(visit.id).toBe(vId);
    expect(visit.restaurant_id).toBe(rId);
    expect(visit.overall_rating).toBe(4);
    expect(visit.party_size).toBe(2);
    expect(visit.occasion).toBe('Date Night');

    // Restaurant should be updated
    const restaurant = getRestaurant(db, rId)!;
    expect(restaurant.visit_count).toBe(1);
    expect(restaurant.is_visited).toBe(1);
    expect(restaurant.first_visited_at).not.toBeNull();
    expect(restaurant.last_visited_at).not.toBeNull();
    expect(restaurant.average_rating).toBe(4);
  });
});

describe('getVisit with photos and companions', () => {
  it('returns visit with empty photos and companions arrays', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Sushi Bar' });
    const vId = genId();
    createVisit(db, vId, {
      restaurant_id: rId,
      visited_at: '2025-07-01T12:00:00Z',
      overall_rating: 5,
    });

    const visit = getVisit(db, vId);
    expect(visit).not.toBeNull();
    expect(visit!.photos).toEqual([]);
    expect(visit!.companions).toEqual([]);
  });

  it('returns null for non-existent visit', () => {
    expect(getVisit(db, 'does-not-exist')).toBeNull();
  });
});

describe('updateVisit', () => {
  it('updates rating and recalculates restaurant average', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Pizza Place' });

    const v1 = genId();
    createVisit(db, v1, {
      restaurant_id: rId,
      visited_at: '2025-01-01T18:00:00Z',
      overall_rating: 3,
    });

    const v2 = genId();
    createVisit(db, v2, {
      restaurant_id: rId,
      visited_at: '2025-02-01T18:00:00Z',
      overall_rating: 5,
    });

    // Average should be (3+5)/2 = 4
    let restaurant = getRestaurant(db, rId)!;
    expect(restaurant.average_rating).toBe(4);

    // Update v1 to rating 5
    updateVisit(db, v1, { overall_rating: 5 });

    // Average should now be (5+5)/2 = 5
    restaurant = getRestaurant(db, rId)!;
    expect(restaurant.average_rating).toBe(5);
  });

  it('updates optional fields', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Burger Joint' });
    const vId = genId();
    createVisit(db, vId, {
      restaurant_id: rId,
      visited_at: '2025-03-01T18:00:00Z',
      overall_rating: 3,
    });

    updateVisit(db, vId, { notes_md: 'Great burgers', total_cost_cents: 4500 });

    const visit = getVisit(db, vId)!;
    expect(visit.notes_md).toBe('Great burgers');
    expect(visit.total_cost_cents).toBe(4500);
  });
});

describe('deleteVisit', () => {
  it('deletes visit and decrements restaurant counters', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Taco Stand' });

    const v1 = genId();
    createVisit(db, v1, {
      restaurant_id: rId,
      visited_at: '2025-01-01T18:00:00Z',
      overall_rating: 4,
    });

    const v2 = genId();
    createVisit(db, v2, {
      restaurant_id: rId,
      visited_at: '2025-02-01T18:00:00Z',
      overall_rating: 2,
    });

    let restaurant = getRestaurant(db, rId)!;
    expect(restaurant.visit_count).toBe(2);

    deleteVisit(db, v2);

    restaurant = getRestaurant(db, rId)!;
    expect(restaurant.visit_count).toBe(1);
    expect(restaurant.average_rating).toBe(4);
    expect(getVisit(db, v2)).toBeNull();
  });

  it('clears restaurant visited state when last visit deleted', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Solo Visit' });

    const vId = genId();
    createVisit(db, vId, {
      restaurant_id: rId,
      visited_at: '2025-05-01T18:00:00Z',
      overall_rating: 3,
    });

    deleteVisit(db, vId);

    const restaurant = getRestaurant(db, rId)!;
    expect(restaurant.visit_count).toBe(0);
    expect(restaurant.is_visited).toBe(0);
    expect(restaurant.first_visited_at).toBeNull();
    expect(restaurant.last_visited_at).toBeNull();
    expect(restaurant.average_rating).toBeNull();
  });

  it('no-ops for non-existent visit', () => {
    deleteVisit(db, 'does-not-exist');
  });
});

describe('listVisitsByRestaurant', () => {
  it('returns visits in chronological order (newest first)', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Frequent Spot' });

    createVisit(db, genId(), {
      restaurant_id: rId,
      visited_at: '2025-01-01T18:00:00Z',
      overall_rating: 3,
    });
    createVisit(db, genId(), {
      restaurant_id: rId,
      visited_at: '2025-03-01T18:00:00Z',
      overall_rating: 4,
    });
    createVisit(db, genId(), {
      restaurant_id: rId,
      visited_at: '2025-02-01T18:00:00Z',
      overall_rating: 5,
    });

    const visits = listVisitsByRestaurant(db, rId);
    expect(visits).toHaveLength(3);
    // Newest first (DESC by default)
    expect(visits[0].visited_at).toBe('2025-03-01T18:00:00Z');
    expect(visits[1].visited_at).toBe('2025-02-01T18:00:00Z');
    expect(visits[2].visited_at).toBe('2025-01-01T18:00:00Z');
  });
});

describe('listVisitsChronological', () => {
  it('returns all visits across restaurants, newest first', () => {
    const r1 = genId();
    const r2 = genId();
    createRestaurant(db, r1, { name: 'Place A' });
    createRestaurant(db, r2, { name: 'Place B' });

    createVisit(db, genId(), {
      restaurant_id: r1,
      visited_at: '2025-01-15T18:00:00Z',
      overall_rating: 3,
    });
    createVisit(db, genId(), {
      restaurant_id: r2,
      visited_at: '2025-02-20T18:00:00Z',
      overall_rating: 4,
    });
    createVisit(db, genId(), {
      restaurant_id: r1,
      visited_at: '2025-03-10T18:00:00Z',
      overall_rating: 5,
    });

    const visits = listVisitsChronological(db);
    expect(visits).toHaveLength(3);
    expect(visits[0].visited_at).toBe('2025-03-10T18:00:00Z');
    expect(visits[2].visited_at).toBe('2025-01-15T18:00:00Z');
  });

  it('filters by date range', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Date Range Test' });

    createVisit(db, genId(), {
      restaurant_id: rId,
      visited_at: '2025-01-01T18:00:00Z',
      overall_rating: 3,
    });
    createVisit(db, genId(), {
      restaurant_id: rId,
      visited_at: '2025-06-15T18:00:00Z',
      overall_rating: 4,
    });
    createVisit(db, genId(), {
      restaurant_id: rId,
      visited_at: '2025-12-01T18:00:00Z',
      overall_rating: 5,
    });

    const filtered = listVisitsChronological(db, {
      date_from: '2025-03-01T00:00:00Z',
      date_to: '2025-09-01T00:00:00Z',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].overall_rating).toBe(4);
  });
});

describe('getVisitStats', () => {
  it('returns accurate stats', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Stats Test' });

    createVisit(db, genId(), {
      restaurant_id: rId,
      visited_at: '2025-01-15T18:00:00Z',
      overall_rating: 3,
    });
    createVisit(db, genId(), {
      restaurant_id: rId,
      visited_at: '2025-01-20T18:00:00Z',
      overall_rating: 5,
    });
    createVisit(db, genId(), {
      restaurant_id: rId,
      visited_at: '2025-03-10T18:00:00Z',
      overall_rating: 4,
    });

    const stats = getVisitStats(db, rId);
    expect(stats.totalVisits).toBe(3);
    expect(stats.avgRating).toBe(4);
    expect(stats.visitsByMonth).toHaveLength(2);
    expect(stats.visitsByMonth[0]).toEqual({ month: '2025-01', count: 2 });
    expect(stats.visitsByMonth[1]).toEqual({ month: '2025-03', count: 1 });
  });

  it('returns empty stats for no visits', () => {
    const stats = getVisitStats(db);
    expect(stats.totalVisits).toBe(0);
    expect(stats.avgRating).toBeNull();
    expect(stats.visitsByMonth).toEqual([]);
  });

  it('returns stats across all restaurants when no restaurantId', () => {
    const r1 = genId();
    const r2 = genId();
    createRestaurant(db, r1, { name: 'A' });
    createRestaurant(db, r2, { name: 'B' });

    createVisit(db, genId(), {
      restaurant_id: r1,
      visited_at: '2025-04-01T18:00:00Z',
      overall_rating: 2,
    });
    createVisit(db, genId(), {
      restaurant_id: r2,
      visited_at: '2025-04-15T18:00:00Z',
      overall_rating: 4,
    });

    const stats = getVisitStats(db);
    expect(stats.totalVisits).toBe(2);
    expect(stats.avgRating).toBe(3);
  });
});
