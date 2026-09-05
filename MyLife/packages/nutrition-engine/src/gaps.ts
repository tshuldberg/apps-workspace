import type {
  DailyNutritionSummary,
  RecommendedDailyAllowance,
  NutrientGap,
  NutrientName,
  FoodSuggestion,
} from './types';

const SEVERITY_THRESHOLDS = {
  mild: 0.8,     // 80-99% of RDA met
  moderate: 0.5, // 50-79% of RDA met
  severe: 0.0,   // below 50% of RDA met
} as const;

const NUTRIENT_KEYS: NutrientName[] = [
  'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sodium_mg', 'sugar_g',
];

function computeSeverity(deficit: number | null, recommended: number): NutrientGap['severity'] {
  if (deficit === null) return 'severe'; // no data = assume gap
  if (deficit <= 0) return 'none';
  const ratio = 1 - (deficit / recommended);
  if (ratio >= SEVERITY_THRESHOLDS.mild) return 'mild';
  if (ratio >= SEVERITY_THRESHOLDS.moderate) return 'moderate';
  return 'severe';
}

/**
 * Analyzes gaps between daily nutrition intake and recommended daily allowances.
 * Returns one NutrientGap per tracked nutrient, sorted by severity (worst first).
 */
export function analyzeNutrientGaps(
  daily: DailyNutritionSummary,
  rda: RecommendedDailyAllowance,
): NutrientGap[] {
  const gaps: NutrientGap[] = [];

  for (const nutrient of NUTRIENT_KEYS) {
    const recommended = rda[nutrient];
    if (recommended === undefined || recommended === 0) continue;

    const actual = daily.totals[nutrient];
    const deficit = actual !== null ? Math.max(0, recommended - actual) : null;
    const severity = computeSeverity(deficit, recommended);

    gaps.push({ nutrient, recommended, actual, deficit, severity });
  }

  const severityOrder: Record<NutrientGap['severity'], number> = {
    severe: 0,
    moderate: 1,
    mild: 2,
    none: 3,
  };
  gaps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return gaps;
}

// Static food suggestion database for common nutrient gaps.
// Kept simple and deterministic -- no external API calls.
const FOOD_DATABASE: Record<NutrientName, FoodSuggestion[]> = {
  calories: [
    { name: 'Peanut butter', nutrient: 'calories', amountPer100g: 588, suggestedServing: '2 tbsp (32g)' },
    { name: 'Avocado', nutrient: 'calories', amountPer100g: 160, suggestedServing: '1/2 avocado (100g)' },
    { name: 'Oats', nutrient: 'calories', amountPer100g: 389, suggestedServing: '1/2 cup dry (40g)' },
  ],
  protein_g: [
    { name: 'Chicken breast', nutrient: 'protein_g', amountPer100g: 31, suggestedServing: '1 breast (170g)' },
    { name: 'Greek yogurt', nutrient: 'protein_g', amountPer100g: 10, suggestedServing: '1 cup (245g)' },
    { name: 'Lentils (cooked)', nutrient: 'protein_g', amountPer100g: 9, suggestedServing: '1 cup (198g)' },
    { name: 'Eggs', nutrient: 'protein_g', amountPer100g: 13, suggestedServing: '2 large eggs (100g)' },
  ],
  carbs_g: [
    { name: 'Brown rice (cooked)', nutrient: 'carbs_g', amountPer100g: 26, suggestedServing: '1 cup (195g)' },
    { name: 'Sweet potato', nutrient: 'carbs_g', amountPer100g: 20, suggestedServing: '1 medium (130g)' },
    { name: 'Banana', nutrient: 'carbs_g', amountPer100g: 23, suggestedServing: '1 medium (118g)' },
  ],
  fat_g: [
    { name: 'Olive oil', nutrient: 'fat_g', amountPer100g: 100, suggestedServing: '1 tbsp (14g)' },
    { name: 'Almonds', nutrient: 'fat_g', amountPer100g: 49, suggestedServing: '1/4 cup (35g)' },
    { name: 'Salmon', nutrient: 'fat_g', amountPer100g: 13, suggestedServing: '1 fillet (170g)' },
  ],
  fiber_g: [
    { name: 'Chia seeds', nutrient: 'fiber_g', amountPer100g: 34, suggestedServing: '2 tbsp (28g)' },
    { name: 'Black beans (cooked)', nutrient: 'fiber_g', amountPer100g: 8.7, suggestedServing: '1 cup (172g)' },
    { name: 'Raspberries', nutrient: 'fiber_g', amountPer100g: 6.5, suggestedServing: '1 cup (123g)' },
  ],
  sodium_mg: [
    { name: 'Table salt', nutrient: 'sodium_mg', amountPer100g: 38758, suggestedServing: '1/4 tsp (1.5g)' },
    { name: 'Soy sauce', nutrient: 'sodium_mg', amountPer100g: 5493, suggestedServing: '1 tbsp (15g)' },
  ],
  sugar_g: [
    { name: 'Honey', nutrient: 'sugar_g', amountPer100g: 82, suggestedServing: '1 tbsp (21g)' },
    { name: 'Dates', nutrient: 'sugar_g', amountPer100g: 66, suggestedServing: '2 dates (48g)' },
  ],
};

/**
 * Returns food suggestions that are rich in a nutrient the user is lacking.
 * Uses a static database of common whole foods.
 */
export function suggestFoodsForGap(gap: NutrientGap): FoodSuggestion[] {
  if (gap.severity === 'none') return [];
  return FOOD_DATABASE[gap.nutrient] ?? [];
}
