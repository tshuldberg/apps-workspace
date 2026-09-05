/**
 * Year-in-review analytics engine for MyDining.
 * Queries dining data for any date range and returns structured analytics.
 */

import type { DatabaseAdapter } from '@mylife/db';

export interface YearInReview {
  period: { start: string; end: string };
  totalVisits: number;
  totalRestaurants: number;
  totalDishes: number;
  totalWines: number;
  totalSpentCents: number;
  averageRating: number | null;

  topRestaurants: Array<{ id: string; name: string; visitCount: number; avgRating: number }>;
  topDishes: Array<{ id: string; name: string; restaurantName: string; rating: number }>;
  topWines: Array<{ id: string; name: string; producer: string; rating: number }>;

  cuisineBreakdown: Array<{ cuisine: string; count: number }>;
  monthlyVisits: Array<{ month: string; count: number }>;

  bestMeal: { visitId: string; restaurantName: string; date: string; rating: number } | null;
  mostVisitedRestaurant: { id: string; name: string; count: number } | null;
  dishOfTheYear: { id: string; name: string; restaurantName: string; rating: number } | null;
}

export function generateYearInReview(
  db: DatabaseAdapter,
  startDate: string,
  endDate: string,
): YearInReview {
  // Total visits in period
  const visitCountRows = db.query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM dn_visits WHERE visited_at BETWEEN ? AND ?`,
    [startDate, endDate],
  );
  const totalVisits = visitCountRows.length > 0 ? visitCountRows[0].cnt : 0;

  // Distinct restaurants visited
  const restCountRows = db.query<{ cnt: number }>(
    `SELECT COUNT(DISTINCT restaurant_id) as cnt FROM dn_visits WHERE visited_at BETWEEN ? AND ?`,
    [startDate, endDate],
  );
  const totalRestaurants = restCountRows.length > 0 ? restCountRows[0].cnt : 0;

  // Total dishes from visits in period
  const dishCountRows = db.query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM dn_dishes WHERE visit_id IN (
       SELECT id FROM dn_visits WHERE visited_at BETWEEN ? AND ?
     )`,
    [startDate, endDate],
  );
  const totalDishes = dishCountRows.length > 0 ? dishCountRows[0].cnt : 0;

  // Total wines from visits in period
  const wineCountRows = db.query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM dn_wines WHERE visit_id IN (
       SELECT id FROM dn_visits WHERE visited_at BETWEEN ? AND ?
     )`,
    [startDate, endDate],
  );
  const totalWines = wineCountRows.length > 0 ? wineCountRows[0].cnt : 0;

  // Total spending
  const spendRows = db.query<{ total: number | null }>(
    `SELECT SUM(total_cost_cents) as total FROM dn_visits WHERE visited_at BETWEEN ? AND ?`,
    [startDate, endDate],
  );
  const totalSpentCents = spendRows.length > 0 && spendRows[0].total != null ? spendRows[0].total : 0;

  // Average rating
  const avgRows = db.query<{ avg_rating: number | null }>(
    `SELECT AVG(CAST(overall_rating AS REAL)) as avg_rating FROM dn_visits WHERE visited_at BETWEEN ? AND ?`,
    [startDate, endDate],
  );
  const averageRating = avgRows.length > 0 ? avgRows[0].avg_rating : null;

  // Top restaurants by visit count (limit 10)
  const topRestaurants = db.query<{ id: string; name: string; visitCount: number; avgRating: number }>(
    `SELECT r.id, r.name, COUNT(v.id) as visitCount, AVG(CAST(v.overall_rating AS REAL)) as avgRating
     FROM dn_visits v
     JOIN dn_restaurants r ON r.id = v.restaurant_id
     WHERE v.visited_at BETWEEN ? AND ?
     GROUP BY r.id
     ORDER BY visitCount DESC, avgRating DESC
     LIMIT 10`,
    [startDate, endDate],
  );

  // Top dishes by rating (limit 10)
  const topDishes = db.query<{ id: string; name: string; restaurantName: string; rating: number }>(
    `SELECT d.id, d.name, r.name as restaurantName, d.rating
     FROM dn_dishes d
     JOIN dn_restaurants r ON r.id = d.restaurant_id
     WHERE d.visit_id IN (
       SELECT id FROM dn_visits WHERE visited_at BETWEEN ? AND ?
     ) AND d.rating IS NOT NULL
     ORDER BY d.rating DESC, d.name ASC
     LIMIT 10`,
    [startDate, endDate],
  );

  // Top wines by rating (limit 10)
  const topWines = db.query<{ id: string; name: string; producer: string; rating: number }>(
    `SELECT w.id, w.name, w.producer, w.rating
     FROM dn_wines w
     WHERE w.visit_id IN (
       SELECT id FROM dn_visits WHERE visited_at BETWEEN ? AND ?
     ) AND w.rating IS NOT NULL
     ORDER BY w.rating DESC, w.name ASC
     LIMIT 10`,
    [startDate, endDate],
  );

  // Cuisine breakdown from visited restaurants
  const cuisineRestaurants = db.query<{ cuisines: string | null }>(
    `SELECT DISTINCT r.cuisines
     FROM dn_restaurants r
     WHERE r.id IN (
       SELECT DISTINCT restaurant_id FROM dn_visits WHERE visited_at BETWEEN ? AND ?
     ) AND r.cuisines IS NOT NULL`,
    [startDate, endDate],
  );
  const cuisineCounts = new Map<string, number>();
  for (const row of cuisineRestaurants) {
    if (!row.cuisines) continue;
    try {
      const parsed = JSON.parse(row.cuisines) as string[];
      for (const c of parsed) {
        cuisineCounts.set(c, (cuisineCounts.get(c) ?? 0) + 1);
      }
    } catch {
      // Not JSON, treat as single cuisine
      cuisineCounts.set(row.cuisines, (cuisineCounts.get(row.cuisines) ?? 0) + 1);
    }
  }
  const cuisineBreakdown = Array.from(cuisineCounts.entries())
    .map(([cuisine, count]) => ({ cuisine, count }))
    .sort((a, b) => b.count - a.count);

  // Monthly visits
  const monthlyVisits = db.query<{ month: string; count: number }>(
    `SELECT strftime('%Y-%m', visited_at) as month, COUNT(*) as count
     FROM dn_visits
     WHERE visited_at BETWEEN ? AND ?
     GROUP BY month
     ORDER BY month`,
    [startDate, endDate],
  );

  // Best meal: highest-rated visit
  const bestMealRows = db.query<{ visitId: string; restaurantName: string; date: string; rating: number }>(
    `SELECT v.id as visitId, r.name as restaurantName, v.visited_at as date, v.overall_rating as rating
     FROM dn_visits v
     JOIN dn_restaurants r ON r.id = v.restaurant_id
     WHERE v.visited_at BETWEEN ? AND ?
     ORDER BY v.overall_rating DESC, v.visited_at DESC
     LIMIT 1`,
    [startDate, endDate],
  );
  const bestMeal = bestMealRows.length > 0 ? bestMealRows[0] : null;

  // Most visited restaurant
  const mostVisitedRows = db.query<{ id: string; name: string; count: number }>(
    `SELECT r.id, r.name, COUNT(v.id) as count
     FROM dn_visits v
     JOIN dn_restaurants r ON r.id = v.restaurant_id
     WHERE v.visited_at BETWEEN ? AND ?
     GROUP BY r.id
     ORDER BY count DESC
     LIMIT 1`,
    [startDate, endDate],
  );
  const mostVisitedRestaurant = mostVisitedRows.length > 0 ? mostVisitedRows[0] : null;

  // Dish of the year: highest-rated dish
  const dishOfYearRows = db.query<{ id: string; name: string; restaurantName: string; rating: number }>(
    `SELECT d.id, d.name, r.name as restaurantName, d.rating
     FROM dn_dishes d
     JOIN dn_restaurants r ON r.id = d.restaurant_id
     WHERE d.visit_id IN (
       SELECT id FROM dn_visits WHERE visited_at BETWEEN ? AND ?
     ) AND d.rating IS NOT NULL
     ORDER BY d.rating DESC, d.name ASC
     LIMIT 1`,
    [startDate, endDate],
  );
  const dishOfTheYear = dishOfYearRows.length > 0 ? dishOfYearRows[0] : null;

  return {
    period: { start: startDate, end: endDate },
    totalVisits,
    totalRestaurants,
    totalDishes,
    totalWines,
    totalSpentCents,
    averageRating,
    topRestaurants,
    topDishes,
    topWines,
    cuisineBreakdown,
    monthlyVisits,
    bestMeal,
    mostVisitedRestaurant,
    dishOfTheYear,
  };
}
