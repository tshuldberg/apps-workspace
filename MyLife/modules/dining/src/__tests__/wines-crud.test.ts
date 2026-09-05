import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { DINING_MODULE } from '../definition';
import { createRestaurant } from '../db/crud/restaurants';
import { createVisit } from '../db/crud/visits';
import {
  createWine,
  getWine,
  updateWine,
  deleteWine,
  listWinesByVisit,
  listWinesByRestaurant,
} from '../db/crud/wines';

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

describe('createWine', () => {
  it('creates a wine linked to a restaurant', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Wine Bar' });

    const wId = genId();
    const wine = createWine(db, wId, {
      restaurant_id: rId,
      producer: 'Chateau Margaux',
      name: 'Grand Vin',
    });

    expect(wine.id).toBe(wId);
    expect(wine.restaurant_id).toBe(rId);
    expect(wine.producer).toBe('Chateau Margaux');
    expect(wine.name).toBe('Grand Vin');
    expect(wine.visit_id).toBeNull();
    expect(wine.by_glass).toBe(0);
  });

  it('creates a wine with all fields', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Full Wine Test' });
    const vId = genId();
    createVisit(db, vId, {
      restaurant_id: rId,
      visited_at: '2025-09-01T20:00:00Z',
      overall_rating: 5,
    });

    const wId = genId();
    const wine = createWine(db, wId, {
      restaurant_id: rId,
      producer: 'Domaine Leroy',
      name: 'Romanee-Saint-Vivant',
      visit_id: vId,
      vintage: 2018,
      region: 'Burgundy',
      varietal: 'Pinot Noir',
      color: 'red',
      rating: 5,
      price_cents: 85000,
      by_glass: 0,
      pairing_notes: 'Paired with wagyu beef',
    });

    expect(wine.visit_id).toBe(vId);
    expect(wine.vintage).toBe(2018);
    expect(wine.region).toBe('Burgundy');
    expect(wine.varietal).toBe('Pinot Noir');
    expect(wine.color).toBe('red');
    expect(wine.rating).toBe(5);
    expect(wine.price_cents).toBe(85000);
    expect(wine.by_glass).toBe(0);
    expect(wine.pairing_notes).toBe('Paired with wagyu beef');
  });
});

describe('getWine', () => {
  it('retrieves a wine by id', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Get Wine Test' });
    const wId = genId();
    createWine(db, wId, {
      restaurant_id: rId,
      producer: 'Silver Oak',
      name: 'Cabernet Sauvignon',
    });

    const wine = getWine(db, wId);
    expect(wine).not.toBeNull();
    expect(wine!.producer).toBe('Silver Oak');
    expect(wine!.name).toBe('Cabernet Sauvignon');
  });

  it('returns null for nonexistent id', () => {
    expect(getWine(db, 'does-not-exist')).toBeNull();
  });
});

describe('updateWine', () => {
  it('updates rating and pairing notes', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Update Wine Test' });
    const wId = genId();
    createWine(db, wId, {
      restaurant_id: rId,
      producer: 'Opus One',
      name: 'Opus One 2019',
    });

    updateWine(db, wId, {
      rating: 5,
      pairing_notes: 'Perfect with lamb chops',
    });

    const wine = getWine(db, wId)!;
    expect(wine.rating).toBe(5);
    expect(wine.pairing_notes).toBe('Perfect with lamb chops');
  });
});

describe('deleteWine', () => {
  it('removes a wine', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Delete Wine Test' });
    const wId = genId();
    createWine(db, wId, {
      restaurant_id: rId,
      producer: 'Two Buck Chuck',
      name: 'Chardonnay',
    });

    deleteWine(db, wId);
    expect(getWine(db, wId)).toBeNull();
  });
});

describe('listWinesByVisit', () => {
  it('returns wines for a visit', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Visit Wine Test' });
    const vId = genId();
    createVisit(db, vId, {
      restaurant_id: rId,
      visited_at: '2025-08-01T20:00:00Z',
      overall_rating: 4,
    });

    createWine(db, genId(), { restaurant_id: rId, producer: 'A', name: 'Wine A', visit_id: vId });
    createWine(db, genId(), { restaurant_id: rId, producer: 'B', name: 'Wine B', visit_id: vId });
    createWine(db, genId(), { restaurant_id: rId, producer: 'C', name: 'Wine C' }); // no visit

    const wines = listWinesByVisit(db, vId);
    expect(wines).toHaveLength(2);
  });
});

describe('listWinesByRestaurant', () => {
  it('returns all wines at a restaurant', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Restaurant Wine Test' });
    const r2 = genId();
    createRestaurant(db, r2, { name: 'Other Wine Place' });

    createWine(db, genId(), { restaurant_id: rId, producer: 'X', name: 'Wine 1' });
    createWine(db, genId(), { restaurant_id: rId, producer: 'Y', name: 'Wine 2' });
    createWine(db, genId(), { restaurant_id: r2, producer: 'Z', name: 'Wine 3' });

    const wines = listWinesByRestaurant(db, rId);
    expect(wines).toHaveLength(2);
  });
});
