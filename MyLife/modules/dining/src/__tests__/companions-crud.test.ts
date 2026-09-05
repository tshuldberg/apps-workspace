import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { DINING_MODULE } from '../definition';
import { createRestaurant } from '../db/crud/restaurants';
import { createVisit } from '../db/crud/visits';
import {
  createCompanion,
  listCompanionsByVisit,
  deleteCompanion,
} from '../db/crud/companions';

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

describe('Companion CRUD', () => {
  it('creates a companion and lists by visit', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Companion Test' });
    const vId = genId();
    createVisit(db, vId, {
      restaurant_id: rId,
      visited_at: '2025-06-01T18:00:00Z',
      overall_rating: 4,
    });

    const cId = genId();
    const companion = createCompanion(db, cId, {
      visit_id: vId,
      display_name: 'Alice',
      notes: 'College friend',
    });

    expect(companion.id).toBe(cId);
    expect(companion.visit_id).toBe(vId);
    expect(companion.display_name).toBe('Alice');
    expect(companion.notes).toBe('College friend');

    const c2Id = genId();
    createCompanion(db, c2Id, {
      visit_id: vId,
      display_name: 'Bob',
    });

    const companions = listCompanionsByVisit(db, vId);
    expect(companions).toHaveLength(2);
    // Ordered by display_name
    expect(companions[0].display_name).toBe('Alice');
    expect(companions[1].display_name).toBe('Bob');
  });

  it('deletes a companion', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Delete Companion Test' });
    const vId = genId();
    createVisit(db, vId, {
      restaurant_id: rId,
      visited_at: '2025-06-01T18:00:00Z',
      overall_rating: 3,
    });

    const cId = genId();
    createCompanion(db, cId, {
      visit_id: vId,
      display_name: 'Charlie',
    });

    deleteCompanion(db, cId);
    expect(listCompanionsByVisit(db, vId)).toHaveLength(0);
  });

  it('returns empty array for visit with no companions', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'No Companions' });
    const vId = genId();
    createVisit(db, vId, {
      restaurant_id: rId,
      visited_at: '2025-06-01T18:00:00Z',
      overall_rating: 5,
    });

    expect(listCompanionsByVisit(db, vId)).toEqual([]);
  });
});
