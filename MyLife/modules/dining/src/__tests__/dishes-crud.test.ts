import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { DINING_MODULE } from '../definition';
import { createRestaurant } from '../db/crud/restaurants';
import { createVisit } from '../db/crud/visits';
import {
  createDish,
  getDish,
  updateDish,
  deleteDish,
  listDishesByVisit,
  listDishesByRestaurant,
  listTopDishes,
  checkAllergens,
} from '../db/crud/dishes';

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

describe('createDish', () => {
  it('creates a dish linked to a restaurant', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Test Bistro' });

    const dId = genId();
    const dish = createDish(db, dId, {
      restaurant_id: rId,
      name: 'Truffle Pasta',
      course: 'main',
      rating: 5,
      price_cents: 2800,
    });

    expect(dish.id).toBe(dId);
    expect(dish.restaurant_id).toBe(rId);
    expect(dish.name).toBe('Truffle Pasta');
    expect(dish.course).toBe('main');
    expect(dish.rating).toBe(5);
    expect(dish.price_cents).toBe(2800);
    expect(dish.visit_id).toBeNull();
    expect(dish.would_order_again).toBe(0);
  });

  it('creates a dish with visit_id', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Visit Spot' });
    const vId = genId();
    createVisit(db, vId, {
      restaurant_id: rId,
      visited_at: '2025-06-15T19:00:00Z',
      overall_rating: 4,
    });

    const dId = genId();
    const dish = createDish(db, dId, {
      restaurant_id: rId,
      name: 'Caesar Salad',
      visit_id: vId,
    });

    expect(dish.visit_id).toBe(vId);
    expect(dish.restaurant_id).toBe(rId);
  });
});

describe('getDish', () => {
  it('retrieves a dish by id', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Get Test' });
    const dId = genId();
    createDish(db, dId, { restaurant_id: rId, name: 'Steak Frites' });

    const dish = getDish(db, dId);
    expect(dish).not.toBeNull();
    expect(dish!.name).toBe('Steak Frites');
  });

  it('returns null for nonexistent id', () => {
    expect(getDish(db, 'does-not-exist')).toBeNull();
  });
});

describe('updateDish', () => {
  it('updates name, rating, and allergens', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Update Test' });
    const dId = genId();
    createDish(db, dId, { restaurant_id: rId, name: 'Old Name' });

    updateDish(db, dId, {
      name: 'New Name',
      rating: 4,
      allergens: JSON.stringify(['Dairy', 'Gluten']),
    });

    const dish = getDish(db, dId)!;
    expect(dish.name).toBe('New Name');
    expect(dish.rating).toBe(4);
    expect(JSON.parse(dish.allergens!)).toEqual(['Dairy', 'Gluten']);
  });
});

describe('deleteDish', () => {
  it('removes a dish', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Delete Test' });
    const dId = genId();
    createDish(db, dId, { restaurant_id: rId, name: 'Bye Bye Burger' });

    deleteDish(db, dId);
    expect(getDish(db, dId)).toBeNull();
  });
});

describe('listDishesByVisit', () => {
  it('returns dishes for a visit', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Visit List Test' });
    const vId = genId();
    createVisit(db, vId, {
      restaurant_id: rId,
      visited_at: '2025-07-01T12:00:00Z',
      overall_rating: 4,
    });

    createDish(db, genId(), { restaurant_id: rId, name: 'Dish A', visit_id: vId });
    createDish(db, genId(), { restaurant_id: rId, name: 'Dish B', visit_id: vId });
    createDish(db, genId(), { restaurant_id: rId, name: 'Other Dish' }); // no visit

    const dishes = listDishesByVisit(db, vId);
    expect(dishes).toHaveLength(2);
  });
});

describe('listDishesByRestaurant', () => {
  it('returns all dishes at a restaurant', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Restaurant List Test' });
    const r2 = genId();
    createRestaurant(db, r2, { name: 'Other Place' });

    createDish(db, genId(), { restaurant_id: rId, name: 'Dish 1' });
    createDish(db, genId(), { restaurant_id: rId, name: 'Dish 2' });
    createDish(db, genId(), { restaurant_id: r2, name: 'Dish 3' });

    const dishes = listDishesByRestaurant(db, rId);
    expect(dishes).toHaveLength(2);
  });
});

describe('listTopDishes', () => {
  it('returns only highly rated dishes', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Top Dishes Test' });

    createDish(db, genId(), { restaurant_id: rId, name: 'Mediocre', rating: 3 });
    createDish(db, genId(), { restaurant_id: rId, name: 'Great', rating: 4 });
    createDish(db, genId(), { restaurant_id: rId, name: 'Amazing', rating: 5 });
    createDish(db, genId(), { restaurant_id: rId, name: 'No Rating' });

    const top = listTopDishes(db);
    expect(top).toHaveLength(2);
    // Sorted by rating DESC then name ASC
    expect(top[0].name).toBe('Amazing');
    expect(top[1].name).toBe('Great');
  });
});

describe('checkAllergens', () => {
  it('finds dishes matching user allergens', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Allergen Test' });

    createDish(db, genId(), {
      restaurant_id: rId,
      name: 'Cheese Plate',
      allergens: JSON.stringify(['Dairy', 'Gluten']),
    });
    createDish(db, genId(), {
      restaurant_id: rId,
      name: 'Peanut Noodles',
      allergens: JSON.stringify(['Peanuts', 'Soy']),
    });
    createDish(db, genId(), {
      restaurant_id: rId,
      name: 'Fruit Salad',
      allergens: JSON.stringify([]),
    });

    const results = checkAllergens(db, rId, ['Dairy', 'Soy']);
    expect(results).toHaveLength(2);

    const names = results.map((r) => r.dish.name).sort();
    expect(names).toEqual(['Cheese Plate', 'Peanut Noodles']);

    const cheeseResult = results.find((r) => r.dish.name === 'Cheese Plate')!;
    expect(cheeseResult.matchedAllergens).toEqual(['Dairy']);

    const noodleResult = results.find((r) => r.dish.name === 'Peanut Noodles')!;
    expect(noodleResult.matchedAllergens).toEqual(['Soy']);
  });

  it('returns empty when no matches', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'No Match Test' });

    createDish(db, genId(), {
      restaurant_id: rId,
      name: 'Safe Dish',
      allergens: JSON.stringify(['Fish']),
    });

    const results = checkAllergens(db, rId, ['Dairy', 'Peanuts']);
    expect(results).toHaveLength(0);
  });
});
