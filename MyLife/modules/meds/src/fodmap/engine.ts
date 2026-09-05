import type { FODMAPFood } from '../models/fodmap';

export type FODMAPTypes = {
  fructose: boolean;
  lactose: boolean;
  fructan: boolean;
  galactan: boolean;
  polyol: boolean;
};

/**
 * Classify a meal's overall FODMAP rating based on its food items.
 * Uses the "highest item wins" rule.
 */
export function classifyMealFODMAP(
  foods: FODMAPFood[],
): 'low' | 'moderate' | 'high' | 'unknown' {
  if (foods.length === 0) return 'unknown';

  const ratings = foods.map((f) => f.fodmapRating);
  if (ratings.includes('high')) return 'high';
  if (ratings.includes('moderate')) return 'moderate';
  return 'low';
}

/**
 * Get which FODMAP types are present in a set of foods.
 */
export function getFODMAPTypes(foods: FODMAPFood[]): FODMAPTypes {
  const result: FODMAPTypes = { fructose: false, lactose: false, fructan: false, galactan: false, polyol: false };
  for (const food of foods) {
    if (food.fructose) result.fructose = true;
    if (food.lactose) result.lactose = true;
    if (food.fructan) result.fructan = true;
    if (food.galactan) result.galactan = true;
    if (food.polyol) result.polyol = true;
  }
  return result;
}

/**
 * Search the FODMAP food database by name (case-insensitive partial match).
 */
export function searchFODMAPFoods(
  allFoods: FODMAPFood[],
  query: string,
  limit: number = 10,
): FODMAPFood[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return allFoods
    .filter((f) => f.name.toLowerCase().includes(q))
    .slice(0, limit);
}

export interface TriggerCorrelation {
  foodName: string;
  fodmapRating: string;
  symptomCount: number;
  totalMeals: number;
  correlationRate: number;
}

/**
 * Calculate trigger correlations between meals and symptoms.
 * Looks for symptoms logged within 2-24 hours after a meal.
 */
export function calculateTriggerCorrelation(
  meals: Array<{ foodItems: string; fodmapRating: string; eatenAt: string }>,
  symptomLogs: Array<{ severity: number; loggedAt: string }>,
): TriggerCorrelation[] {
  if (meals.length < 10 || symptomLogs.length < 5) return [];

  const foodCounts = new Map<string, { total: number; withSymptom: number; rating: string }>();

  for (const meal of meals) {
    const foods = meal.foodItems.split(',').map((f) => f.trim().toLowerCase());
    for (const food of foods) {
      if (!food) continue;
      const existing = foodCounts.get(food) ?? { total: 0, withSymptom: 0, rating: meal.fodmapRating };
      existing.total++;

      const mealTime = new Date(meal.eatenAt).getTime();
      const hasSymptomAfter = symptomLogs.some((s) => {
        const diff = new Date(s.loggedAt).getTime() - mealTime;
        const hours = diff / (1000 * 60 * 60);
        return hours >= 2 && hours <= 24 && s.severity >= 3;
      });
      if (hasSymptomAfter) existing.withSymptom++;
      foodCounts.set(food, existing);
    }
  }

  return Array.from(foodCounts.entries())
    .filter(([, v]) => v.total >= 3)
    .map(([name, v]) => ({
      foodName: name,
      fodmapRating: v.rating,
      symptomCount: v.withSymptom,
      totalMeals: v.total,
      correlationRate: v.withSymptom / v.total,
    }))
    .sort((a, b) => b.correlationRate - a.correlationRate);
}

/**
 * Group trigger correlations by FODMAP type.
 */
export function groupByFODMAPType(
  correlations: TriggerCorrelation[],
): Record<string, { count: number; avgRate: number }> {
  const groups: Record<string, { count: number; totalRate: number }> = {};

  for (const c of correlations) {
    const rating = c.fodmapRating;
    if (!groups[rating]) groups[rating] = { count: 0, totalRate: 0 };
    groups[rating].count++;
    groups[rating].totalRate += c.correlationRate;
  }

  const result: Record<string, { count: number; avgRate: number }> = {};
  for (const [key, val] of Object.entries(groups)) {
    result[key] = { count: val.count, avgRate: val.count > 0 ? val.totalRate / val.count : 0 };
  }
  return result;
}
