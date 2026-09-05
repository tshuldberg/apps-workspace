import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { DINING_MODULE } from '../definition';
import { createRestaurant } from '../db/crud/restaurants';
import { createVisit } from '../db/crud/visits';
import { createDish } from '../db/crud/dishes';
import { generateYearInReview } from '../engine/year-review';

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

const START = '2025-01-01T00:00:00Z';
const END = '2025-12-31T23:59:59Z';

describe('generateYearInReview', () => {
  it('returns zero counts for an empty period', () => {
    const review = generateYearInReview(db, START, END);

    expect(review.totalVisits).toBe(0);
    expect(review.totalRestaurants).toBe(0);
    expect(review.totalDishes).toBe(0);
    expect(review.totalWines).toBe(0);
    expect(review.totalSpentCents).toBe(0);
    expect(review.averageRating).toBeNull();
    expect(review.topRestaurants).toHaveLength(0);
    expect(review.topDishes).toHaveLength(0);
    expect(review.topWines).toHaveLength(0);
    expect(review.cuisineBreakdown).toHaveLength(0);
    expect(review.monthlyVisits).toHaveLength(0);
    expect(review.bestMeal).toBeNull();
    expect(review.mostVisitedRestaurant).toBeNull();
    expect(review.dishOfTheYear).toBeNull();
    expect(review.period.start).toBe(START);
    expect(review.period.end).toBe(END);
  });

  it('counts a single visit correctly', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Solo Spot' });
    const vId = genId();
    createVisit(db, vId, {
      restaurant_id: rId,
      visited_at: '2025-06-15T19:00:00Z',
      overall_rating: 4,
      total_cost_cents: 5000,
    });

    const review = generateYearInReview(db, START, END);

    expect(review.totalVisits).toBe(1);
    expect(review.totalRestaurants).toBe(1);
    expect(review.totalSpentCents).toBe(5000);
    expect(review.averageRating).toBe(4);
    expect(review.bestMeal).not.toBeNull();
    expect(review.bestMeal!.visitId).toBe(vId);
    expect(review.bestMeal!.rating).toBe(4);
    expect(review.mostVisitedRestaurant).not.toBeNull();
    expect(review.mostVisitedRestaurant!.id).toBe(rId);
  });

  it('handles multiple visits across restaurants', () => {
    const r1 = genId();
    createRestaurant(db, r1, { name: 'Place A', cuisines: JSON.stringify(['Italian']) });
    const r2 = genId();
    createRestaurant(db, r2, { name: 'Place B', cuisines: JSON.stringify(['Japanese']) });

    createVisit(db, genId(), {
      restaurant_id: r1,
      visited_at: '2025-03-10T12:00:00Z',
      overall_rating: 3,
    });
    createVisit(db, genId(), {
      restaurant_id: r1,
      visited_at: '2025-06-20T18:00:00Z',
      overall_rating: 5,
    });
    createVisit(db, genId(), {
      restaurant_id: r2,
      visited_at: '2025-09-05T20:00:00Z',
      overall_rating: 4,
    });

    const review = generateYearInReview(db, START, END);

    expect(review.totalVisits).toBe(3);
    expect(review.totalRestaurants).toBe(2);
    expect(review.topRestaurants).toHaveLength(2);
    // Place A has 2 visits, should be first
    expect(review.topRestaurants[0].name).toBe('Place A');
    expect(review.topRestaurants[0].visitCount).toBe(2);
    expect(review.topRestaurants[1].name).toBe('Place B');
    expect(review.topRestaurants[1].visitCount).toBe(1);
  });

  it('sorts top restaurants by visit count descending', () => {
    const r1 = genId();
    createRestaurant(db, r1, { name: 'Frequent' });
    const r2 = genId();
    createRestaurant(db, r2, { name: 'Rare' });
    const r3 = genId();
    createRestaurant(db, r3, { name: 'Medium' });

    // Frequent: 3 visits
    for (let i = 0; i < 3; i++) {
      createVisit(db, genId(), {
        restaurant_id: r1,
        visited_at: `2025-0${i + 1}-15T12:00:00Z`,
        overall_rating: 4,
      });
    }
    // Rare: 1 visit
    createVisit(db, genId(), {
      restaurant_id: r2,
      visited_at: '2025-04-10T12:00:00Z',
      overall_rating: 5,
    });
    // Medium: 2 visits
    for (let i = 0; i < 2; i++) {
      createVisit(db, genId(), {
        restaurant_id: r3,
        visited_at: `2025-0${i + 5}-15T12:00:00Z`,
        overall_rating: 3,
      });
    }

    const review = generateYearInReview(db, START, END);

    expect(review.topRestaurants[0].name).toBe('Frequent');
    expect(review.topRestaurants[0].visitCount).toBe(3);
    expect(review.topRestaurants[1].name).toBe('Medium');
    expect(review.topRestaurants[1].visitCount).toBe(2);
    expect(review.topRestaurants[2].name).toBe('Rare');
    expect(review.topRestaurants[2].visitCount).toBe(1);
  });

  it('sorts top dishes by rating descending', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Dish Place' });
    const vId = genId();
    createVisit(db, vId, {
      restaurant_id: rId,
      visited_at: '2025-05-01T12:00:00Z',
      overall_rating: 4,
    });

    createDish(db, genId(), {
      restaurant_id: rId,
      visit_id: vId,
      name: 'Okay Pasta',
      rating: 3,
    });
    createDish(db, genId(), {
      restaurant_id: rId,
      visit_id: vId,
      name: 'Amazing Steak',
      rating: 5,
    });
    createDish(db, genId(), {
      restaurant_id: rId,
      visit_id: vId,
      name: 'Great Salad',
      rating: 4,
    });

    const review = generateYearInReview(db, START, END);

    expect(review.topDishes).toHaveLength(3);
    expect(review.topDishes[0].name).toBe('Amazing Steak');
    expect(review.topDishes[0].rating).toBe(5);
    expect(review.topDishes[1].name).toBe('Great Salad');
    expect(review.topDishes[2].name).toBe('Okay Pasta');
  });

  it('computes cuisine breakdown from restaurant cuisines JSON', () => {
    const r1 = genId();
    createRestaurant(db, r1, { name: 'Italian Spot', cuisines: JSON.stringify(['Italian', 'Mediterranean']) });
    const r2 = genId();
    createRestaurant(db, r2, { name: 'Mediterranean Cafe', cuisines: JSON.stringify(['Mediterranean', 'Greek']) });

    createVisit(db, genId(), {
      restaurant_id: r1,
      visited_at: '2025-02-10T12:00:00Z',
      overall_rating: 4,
    });
    createVisit(db, genId(), {
      restaurant_id: r2,
      visited_at: '2025-03-10T12:00:00Z',
      overall_rating: 4,
    });

    const review = generateYearInReview(db, START, END);

    expect(review.cuisineBreakdown.length).toBeGreaterThanOrEqual(3);
    const med = review.cuisineBreakdown.find((c) => c.cuisine === 'Mediterranean');
    expect(med).toBeDefined();
    expect(med!.count).toBe(2);
    const ital = review.cuisineBreakdown.find((c) => c.cuisine === 'Italian');
    expect(ital).toBeDefined();
    expect(ital!.count).toBe(1);
  });

  it('groups monthly visits correctly', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Monthly Test' });

    // 2 visits in January, 1 in March
    createVisit(db, genId(), {
      restaurant_id: rId,
      visited_at: '2025-01-10T12:00:00Z',
      overall_rating: 4,
    });
    createVisit(db, genId(), {
      restaurant_id: rId,
      visited_at: '2025-01-25T18:00:00Z',
      overall_rating: 3,
    });
    createVisit(db, genId(), {
      restaurant_id: rId,
      visited_at: '2025-03-05T20:00:00Z',
      overall_rating: 5,
    });

    const review = generateYearInReview(db, START, END);

    expect(review.monthlyVisits).toHaveLength(2);
    const jan = review.monthlyVisits.find((m) => m.month === '2025-01');
    expect(jan).toBeDefined();
    expect(jan!.count).toBe(2);
    const mar = review.monthlyVisits.find((m) => m.month === '2025-03');
    expect(mar).toBeDefined();
    expect(mar!.count).toBe(1);
  });

  it('identifies the best meal as the highest-rated visit', () => {
    const r1 = genId();
    createRestaurant(db, r1, { name: 'Good Place' });
    const r2 = genId();
    createRestaurant(db, r2, { name: 'Best Place' });

    createVisit(db, genId(), {
      restaurant_id: r1,
      visited_at: '2025-04-01T12:00:00Z',
      overall_rating: 3,
    });
    const bestVId = genId();
    createVisit(db, bestVId, {
      restaurant_id: r2,
      visited_at: '2025-07-15T19:00:00Z',
      overall_rating: 5,
    });
    createVisit(db, genId(), {
      restaurant_id: r1,
      visited_at: '2025-10-20T20:00:00Z',
      overall_rating: 4,
    });

    const review = generateYearInReview(db, START, END);

    expect(review.bestMeal).not.toBeNull();
    expect(review.bestMeal!.visitId).toBe(bestVId);
    expect(review.bestMeal!.restaurantName).toBe('Best Place');
    expect(review.bestMeal!.rating).toBe(5);
  });

  it('sums total spending correctly', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Pricey Spot' });

    createVisit(db, genId(), {
      restaurant_id: rId,
      visited_at: '2025-02-14T19:00:00Z',
      overall_rating: 5,
      total_cost_cents: 15000,
    });
    createVisit(db, genId(), {
      restaurant_id: rId,
      visited_at: '2025-08-20T20:00:00Z',
      overall_rating: 4,
      total_cost_cents: 8500,
    });
    // Visit with no cost
    createVisit(db, genId(), {
      restaurant_id: rId,
      visited_at: '2025-11-01T12:00:00Z',
      overall_rating: 3,
    });

    const review = generateYearInReview(db, START, END);

    expect(review.totalSpentCents).toBe(23500);
  });

  it('identifies dish of the year as highest-rated dish', () => {
    const rId = genId();
    createRestaurant(db, rId, { name: 'Dish Awards' });
    const vId = genId();
    createVisit(db, vId, {
      restaurant_id: rId,
      visited_at: '2025-06-01T12:00:00Z',
      overall_rating: 4,
    });

    createDish(db, genId(), {
      restaurant_id: rId,
      visit_id: vId,
      name: 'Good Soup',
      rating: 3,
    });
    const topDishId = genId();
    createDish(db, topDishId, {
      restaurant_id: rId,
      visit_id: vId,
      name: 'Legendary Risotto',
      rating: 5,
    });
    createDish(db, genId(), {
      restaurant_id: rId,
      visit_id: vId,
      name: 'Nice Salad',
      rating: 4,
    });

    const review = generateYearInReview(db, START, END);

    expect(review.dishOfTheYear).not.toBeNull();
    expect(review.dishOfTheYear!.id).toBe(topDishId);
    expect(review.dishOfTheYear!.name).toBe('Legendary Risotto');
    expect(review.dishOfTheYear!.rating).toBe(5);
  });
});
