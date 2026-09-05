import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { DINING_MODULE } from '../definition';
import {
  createRestaurant,
  getRestaurant,
  updateRestaurant,
  deleteRestaurant,
  listRestaurants,
  markVisited,
  incrementVisitCount,
} from '../db/crud/restaurants';
import { createTag, addTagToRestaurant } from '../db/crud/tags';

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

describe('Restaurant CRUD round-trip', () => {
  it('creates, reads, updates, and deletes a restaurant', () => {
    const id = genId();
    const created = createRestaurant(db, id, {
      name: 'Test Restaurant',
      city: 'San Francisco',
      neighborhood: 'Mission',
      price_tier: 2,
    });

    expect(created.id).toBe(id);
    expect(created.name).toBe('Test Restaurant');
    expect(created.city).toBe('San Francisco');
    expect(created.neighborhood).toBe('Mission');
    expect(created.price_tier).toBe(2);
    expect(created.is_wishlist).toBe(0);
    expect(created.is_visited).toBe(0);
    expect(created.visit_count).toBe(0);

    const fetched = getRestaurant(db, id);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe('Test Restaurant');
    expect(fetched!.tags).toEqual([]);

    updateRestaurant(db, id, { name: 'Updated Name', price_tier: 3 });
    const updated = getRestaurant(db, id);
    expect(updated!.name).toBe('Updated Name');
    expect(updated!.price_tier).toBe(3);

    deleteRestaurant(db, id);
    const deleted = getRestaurant(db, id);
    expect(deleted).toBeNull();
  });

  it('returns null for non-existent restaurant', () => {
    expect(getRestaurant(db, 'does-not-exist')).toBeNull();
  });
});

describe('listRestaurants with search filter', () => {
  it('filters by name, city, and neighborhood', () => {
    createRestaurant(db, genId(), { name: 'Sushi Place', city: 'Oakland' });
    createRestaurant(db, genId(), { name: 'Burger Joint', city: 'San Francisco', neighborhood: 'SOMA' });
    createRestaurant(db, genId(), { name: 'Taco Stand', city: 'San Francisco', neighborhood: 'Mission' });

    const byName = listRestaurants(db, { search: 'Sushi' });
    expect(byName).toHaveLength(1);
    expect(byName[0].name).toBe('Sushi Place');

    const byCity = listRestaurants(db, { search: 'Oakland' });
    expect(byCity).toHaveLength(1);

    const byNeighborhood = listRestaurants(db, { search: 'Mission' });
    expect(byNeighborhood).toHaveLength(1);
    expect(byNeighborhood[0].name).toBe('Taco Stand');
  });
});

describe('listRestaurants with cuisine tag filter', () => {
  it('filters by tag IDs', () => {
    const r1 = genId();
    const r2 = genId();
    const tagA = genId();
    const tagB = genId();

    createRestaurant(db, r1, { name: 'Italian Place' });
    createRestaurant(db, r2, { name: 'Japanese Place' });
    createTag(db, tagA, { name: 'Italian', kind: 'cuisine' });
    createTag(db, tagB, { name: 'Japanese', kind: 'cuisine' });
    addTagToRestaurant(db, r1, tagA);
    addTagToRestaurant(db, r2, tagB);

    const italian = listRestaurants(db, { cuisine_tag_ids: [tagA] });
    expect(italian).toHaveLength(1);
    expect(italian[0].name).toBe('Italian Place');

    const japanese = listRestaurants(db, { cuisine_tag_ids: [tagB] });
    expect(japanese).toHaveLength(1);
    expect(japanese[0].name).toBe('Japanese Place');
  });
});

describe('listRestaurants with sort', () => {
  it('sorts by name ASC', () => {
    createRestaurant(db, genId(), { name: 'Zebra' });
    createRestaurant(db, genId(), { name: 'Alpha' });
    createRestaurant(db, genId(), { name: 'Middle' });

    const sorted = listRestaurants(db, { sort_by: 'name', sort_dir: 'ASC' });
    expect(sorted.map((r) => r.name)).toEqual(['Alpha', 'Middle', 'Zebra']);
  });

  it('sorts by visit_count DESC', () => {
    const r1 = genId();
    const r2 = genId();
    const r3 = genId();
    createRestaurant(db, r1, { name: 'A' });
    createRestaurant(db, r2, { name: 'B' });
    createRestaurant(db, r3, { name: 'C' });

    incrementVisitCount(db, r2);
    incrementVisitCount(db, r2);
    incrementVisitCount(db, r3);

    const sorted = listRestaurants(db, { sort_by: 'visit_count', sort_dir: 'DESC' });
    expect(sorted[0].name).toBe('B');
    expect(sorted[1].name).toBe('C');
    expect(sorted[2].name).toBe('A');
  });
});

describe('listRestaurants with pagination', () => {
  it('supports limit and offset', () => {
    for (let i = 0; i < 10; i++) {
      createRestaurant(db, genId(), { name: `Restaurant ${i.toString().padStart(2, '0')}` });
    }

    const page1 = listRestaurants(db, { sort_by: 'name', sort_dir: 'ASC', limit: 3, offset: 0 });
    expect(page1).toHaveLength(3);
    expect(page1[0].name).toBe('Restaurant 00');

    const page2 = listRestaurants(db, { sort_by: 'name', sort_dir: 'ASC', limit: 3, offset: 3 });
    expect(page2).toHaveLength(3);
    expect(page2[0].name).toBe('Restaurant 03');

    const page4 = listRestaurants(db, { sort_by: 'name', sort_dir: 'ASC', limit: 3, offset: 9 });
    expect(page4).toHaveLength(1);
  });
});

describe('markVisited', () => {
  it('sets is_visited and first_visited_at', () => {
    const id = genId();
    createRestaurant(db, id, { name: 'New Spot' });

    const before = getRestaurant(db, id)!;
    expect(before.is_visited).toBe(0);
    expect(before.first_visited_at).toBeNull();

    markVisited(db, id);

    const after = getRestaurant(db, id)!;
    expect(after.is_visited).toBe(1);
    expect(after.first_visited_at).not.toBeNull();

    // Calling again should NOT overwrite first_visited_at
    const firstVisit = after.first_visited_at;
    markVisited(db, id);
    const again = getRestaurant(db, id)!;
    expect(again.first_visited_at).toBe(firstVisit);
  });
});

describe('incrementVisitCount', () => {
  it('bumps visit_count and updates last_visited_at', () => {
    const id = genId();
    createRestaurant(db, id, { name: 'Frequented' });

    incrementVisitCount(db, id);
    const once = getRestaurant(db, id)!;
    expect(once.visit_count).toBe(1);
    expect(once.is_visited).toBe(1);
    expect(once.last_visited_at).not.toBeNull();
    expect(once.first_visited_at).not.toBeNull();

    incrementVisitCount(db, id);
    const twice = getRestaurant(db, id)!;
    expect(twice.visit_count).toBe(2);
  });
});
