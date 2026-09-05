import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { NUTRITION_MODULE } from '../definition';
import {
  createRestaurant,
  getRestaurants,
  getRestaurantById,
  getRestaurantVisitStats,
  getPopularChains,
  deleteRestaurant,
  createMenuItem,
  getMenuItems,
  getMenuItemById,
  updateMenuItem,
  logMenuItemAsMeal,
} from '../restaurant/crud';
import { searchRestaurants, searchMenuItems } from '../restaurant/search';
import { createFoodLogEntry } from '../db/food-log';

describe('restaurant menus', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('nutrition', NUTRITION_MODULE.migrations!);
    db = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  describe('createRestaurant', () => {
    it('stores name, category, chain flag, and source', () => {
      createRestaurant(db, 'r1', {
        name: 'Test Grill',
        category: 'casual',
        chain: false,
        logoEmoji: '🍖',
        logoUri: 'file:///test-logo.png',
      });
      const r = getRestaurantById(db, 'r1');
      expect(r).not.toBeNull();
      expect(r!.name).toBe('Test Grill');
      expect(r!.category).toBe('casual');
      expect(r!.chain).toBe(false);
      expect(r!.logoUri).toBe('file:///test-logo.png');
      expect(r!.source).toBe('user');
    });
  });

  describe('getRestaurants', () => {
    it('returns restaurants with menu item counts', () => {
      createRestaurant(db, 'r1', { name: 'A Grill', category: 'casual' });
      createMenuItem(db, 'm1', { restaurantId: 'r1', name: 'Burger', calories: 500 });

      const restaurants = getRestaurants(db);
      const match = restaurants.find((restaurant) => restaurant.id === 'r1');

      expect(match).toBeDefined();
      expect(match!.menuItemCount).toBe(1);
    });
  });

  describe('getRestaurantById', () => {
    it('retrieves with menu item count', () => {
      createRestaurant(db, 'r1', { name: 'Test Place' });
      createMenuItem(db, 'm1', {
        restaurantId: 'r1',
        name: 'Burger',
        calories: 500,
      });
      createMenuItem(db, 'm2', {
        restaurantId: 'r1',
        name: 'Fries',
        calories: 300,
      });
      const r = getRestaurantById(db, 'r1');
      expect(r!.menuItemCount).toBe(2);
    });
  });

  describe('searchRestaurants', () => {
    it('searches seed data by name', () => {
      const results = searchRestaurants(db, 'Chipotle');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].name).toBe('Chipotle');
    });

    it('empty query returns all restaurants', () => {
      const results = searchRestaurants(db, '');
      expect(results.length).toBeGreaterThanOrEqual(20);
    });
  });

  describe('createMenuItem', () => {
    it('stores all nutrition fields with FK', () => {
      createRestaurant(db, 'r1', { name: 'Test' });
      createMenuItem(db, 'm1', {
        restaurantId: 'r1',
        name: 'Salad',
        category: 'Salads',
        servingSize: '1 bowl',
        calories: 350,
        proteinG: 15,
        carbsG: 30,
        fatG: 18,
        fiberG: 6,
        sodiumMg: 400,
      });
      const item = getMenuItemById(db, 'm1');
      expect(item).not.toBeNull();
      expect(item!.calories).toBe(350);
      expect(item!.proteinG).toBe(15);
      expect(item!.fiberG).toBe(6);
    });
  });

  describe('updateMenuItem', () => {
    it('updates item nutrition fields and text', () => {
      createRestaurant(db, 'r1', { name: 'Test' });
      createMenuItem(db, 'm1', {
        restaurantId: 'r1',
        name: 'Salad',
        calories: 350,
      });

      updateMenuItem(db, 'm1', {
        name: 'Power Salad',
        description: 'Extra avocado',
        calories: 420,
        proteinG: 22,
      });

      const item = getMenuItemById(db, 'm1');
      expect(item?.name).toBe('Power Salad');
      expect(item?.description).toBe('Extra avocado');
      expect(item?.calories).toBe(420);
      expect(item?.proteinG).toBe(22);
    });
  });

  describe('getMenuItems', () => {
    it('returns items for a restaurant grouped by category', () => {
      createRestaurant(db, 'r1', { name: 'Test' });
      createMenuItem(db, 'm1', { restaurantId: 'r1', name: 'Burger', category: 'Burgers', calories: 500 });
      createMenuItem(db, 'm2', { restaurantId: 'r1', name: 'Fries', category: 'Sides', calories: 300 });
      createMenuItem(db, 'm3', { restaurantId: 'r1', name: 'Chicken Burger', category: 'Burgers', calories: 450 });

      const items = getMenuItems(db, 'r1');
      expect(items).toHaveLength(3);
      // Should be sorted by category then name
      expect(items[0].category).toBe('Burgers');
      expect(items[0].name).toBe('Burger');
    });
  });

  describe('searchMenuItems', () => {
    it('searches seed menu items across name and description', () => {
      const results = searchMenuItems(db, 'Big Mac');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].name).toBe('Big Mac');
    });
  });

  describe('logMenuItemAsMeal', () => {
    it('creates nu_foods entry + nu_food_log_item in transaction', () => {
      // Set up a food log entry for today
      createFoodLogEntry(db, 'log1', {
        date: '2026-03-22',
        mealType: 'lunch',
      });

      const menuItem = {
        id: 'seed-mi-mcd-1',
        restaurantId: 'seed-mcdonalds',
        name: 'Big Mac',
        description: null,
        category: 'Burgers',
        servingSize: '1 sandwich',
        calories: 550,
        proteinG: 25,
        carbsG: 45,
        fatG: 30,
        fiberG: 3,
        sodiumMg: 1010,
        source: 'seed' as const,
        verified: true,
        createdAt: '2026-03-22',
        updatedAt: '2026-03-22',
      };

      logMenuItemAsMeal(
        db,
        { foodId: 'food-bigmac', logItemId: 'li-bigmac' },
        {
          menuItem,
          restaurantName: "McDonald's",
          logId: 'log1',
          servingCount: 1,
        },
      );

      // Verify food was created
      const foods = db.query<{ name: string; brand: string }>(
        "SELECT name, brand FROM nu_foods WHERE id = 'food-bigmac'",
      );
      expect(foods).toHaveLength(1);
      expect(foods[0].name).toBe('Big Mac');
      expect(foods[0].brand).toBe("McDonald's");

      // Verify log item was created
      const items = db.query<{ calories: number }>(
        "SELECT calories FROM nu_food_log_items WHERE id = 'li-bigmac'",
      );
      expect(items).toHaveLength(1);
      expect(items[0].calories).toBe(550);
    });

    it('adjusts nutrition for serving count', () => {
      createFoodLogEntry(db, 'log1', { date: '2026-03-22', mealType: 'lunch' });

      const menuItem = {
        id: 'mi-test',
        restaurantId: 'r1',
        name: 'Test Item',
        description: null,
        category: null,
        servingSize: '1 serving',
        calories: 200,
        proteinG: 10,
        carbsG: 20,
        fatG: 8,
        fiberG: 2,
        sodiumMg: 300,
        source: 'user' as const,
        verified: false,
        createdAt: '',
        updatedAt: '',
      };

      logMenuItemAsMeal(
        db,
        { foodId: 'f-test', logItemId: 'li-test' },
        { menuItem, restaurantName: 'Test', logId: 'log1', servingCount: 2 },
      );

      const items = db.query<{ calories: number; protein_g: number }>(
        "SELECT calories, protein_g FROM nu_food_log_items WHERE id = 'li-test'",
      );
      expect(items[0].calories).toBe(400);
      expect(items[0].protein_g).toBe(20);
    });
  });

  describe('deleteRestaurant', () => {
    it('cascades to delete all menu items', () => {
      createRestaurant(db, 'r1', { name: 'Test' });
      createMenuItem(db, 'm1', { restaurantId: 'r1', name: 'Item 1', calories: 100 });
      createMenuItem(db, 'm2', { restaurantId: 'r1', name: 'Item 2', calories: 200 });

      deleteRestaurant(db, 'r1');
      expect(getMenuItems(db, 'r1')).toHaveLength(0);
      expect(getRestaurantById(db, 'r1')).toBeNull();
    });
  });

  describe('getPopularChains', () => {
    it('returns chain=1 restaurants sorted by name', () => {
      const chains = getPopularChains(db);
      expect(chains.length).toBeGreaterThanOrEqual(20);
      // Should be sorted by name
      for (let i = 1; i < chains.length; i++) {
        expect(chains[i].name.localeCompare(chains[i - 1].name)).toBeGreaterThanOrEqual(0);
      }
      // All should be chains
      for (const c of chains) {
        expect(c.chain).toBe(true);
      }
    });
  });

  describe('getRestaurantVisitStats', () => {
    it('computes average calories from logged menu visits', () => {
      createFoodLogEntry(db, 'log1', { date: '2026-03-22', mealType: 'lunch' });
      createFoodLogEntry(db, 'log2', { date: '2026-03-23', mealType: 'dinner' });

      const menuItem = {
        id: 'mi-visit',
        restaurantId: 'r1',
        name: 'Harvest Bowl',
        description: null,
        category: 'Mains',
        servingSize: '1 bowl',
        calories: 600,
        proteinG: 30,
        carbsG: 55,
        fatG: 20,
        fiberG: 6,
        sodiumMg: 700,
        source: 'user' as const,
        verified: false,
        createdAt: '',
        updatedAt: '',
      };

      logMenuItemAsMeal(
        db,
        { foodId: 'food-1', logItemId: 'log-item-1' },
        { menuItem, restaurantName: 'Sweetgreen', logId: 'log1', servingCount: 1 },
      );
      logMenuItemAsMeal(
        db,
        { foodId: 'food-2', logItemId: 'log-item-2' },
        { menuItem, restaurantName: 'Sweetgreen', logId: 'log2', servingCount: 2 },
      );

      const stats = getRestaurantVisitStats(db, 'Sweetgreen');
      expect(stats.visitCount).toBe(2);
      expect(stats.averageCalories).toBe(900);
      expect(stats.lastFiveAverageCalories).toBe(900);
    });
  });
});
