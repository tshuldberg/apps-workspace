/**
 * Nutrition Correlation Engine -- 6 insight detectors, all pure functions.
 * No database access inside detectors. The orchestrator prepares data and passes it in.
 * No network calls. No external AI/ML. Pure TypeScript algorithmic detection.
 *
 * Pattern: follows mood/engine/insight.ts (8 detectors, pure functions, orchestrator).
 */

import type {
  NutritionInsight,
  NutritionInsightType,
  NutritionInsightSeverity,
  DayNutritionData,
  DayFastingData,
  DayWorkoutData,
  DayMoodData,
  InsightInput,
} from './types';
import { MIN_DAYS_INTERNAL, MIN_DAYS_CROSS_MODULE, MIN_DAYS_COMPLEX } from './types';

// ── Math Utilities ────────────────────────────────────────────────────

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round0(n: number): number {
  return Math.round(n);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function pct(n: number): number {
  return Math.round(n * 100);
}

function insightId(type: NutritionInsightType, key: string): string {
  return `nutrition:${type}:${key}`;
}

function makeInsight(
  type: NutritionInsightType,
  severity: NutritionInsightSeverity,
  title: string,
  body: string,
  metric: string,
  recommendation: string,
  key: string,
  data?: Record<string, unknown>,
): NutritionInsight {
  return {
    id: insightId(type, key),
    type,
    severity,
    title,
    body,
    metric,
    recommendation,
    data,
    generatedAt: new Date().toISOString(),
  };
}

// ── Detector 1: Restaurant Impact (internal, 7 days) ─────────────────

export function detectRestaurantImpact(days: DayNutritionData[]): NutritionInsight[] {
  if (days.length < MIN_DAYS_INTERNAL) return [];

  const restaurantDays = days.filter((d) => d.isRestaurantMeal);
  const homeDays = days.filter((d) => !d.isRestaurantMeal);

  if (restaurantDays.length < 2 || homeDays.length < 3) return [];

  const restaurantAvg = average(restaurantDays.map((d) => d.totalCalories));
  const homeAvg = average(homeDays.map((d) => d.totalCalories));
  const delta = round0(restaurantAvg - homeAvg);

  if (delta < 100) return [];

  return [makeInsight(
    'restaurant_impact',
    delta > 500 ? 'actionable' : 'notable',
    'Restaurant Day Effect',
    `Restaurant meals average ${round0(restaurantAvg)} calories vs ${round0(homeAvg)} when eating at home. That's +${delta} calories on restaurant days.`,
    `+${delta} cal`,
    delta > 500
      ? 'Consider checking restaurant menus before going out to find options closer to your goals.'
      : 'Your restaurant choices are reasonably close to home cooking. Keep it up.',
    'restaurant',
    { restaurantAvg: round0(restaurantAvg), homeAvg: round0(homeAvg), restaurantDayCount: restaurantDays.length },
  )];
}

// ── Detector 2: Water-Snacking Correlation (internal, 7 days) ────────

export function detectWaterSnacking(days: DayNutritionData[]): NutritionInsight[] {
  if (days.length < MIN_DAYS_INTERNAL) return [];

  const daysWithWater = days.filter((d) => d.waterMl > 0);
  if (daysWithWater.length < MIN_DAYS_INTERNAL) return [];

  // Split into high/low water days (threshold: 2000ml / ~8 glasses)
  const highWater = daysWithWater.filter((d) => d.waterMl >= 2000);
  const lowWater = daysWithWater.filter((d) => d.waterMl < 2000);

  if (highWater.length < 3 || lowWater.length < 3) return [];

  const highSnacks = round1(average(highWater.map((d) => d.snackCount)));
  const lowSnacks = round1(average(lowWater.map((d) => d.snackCount)));

  if (lowSnacks - highSnacks < 0.5) return [];

  return [makeInsight(
    'water_snacking',
    'actionable',
    'Water and Snacking',
    `Days with 8+ glasses of water: ${highSnacks} snacks on average. Under 8 glasses: ${lowSnacks} snacks. Staying hydrated may help curb snacking.`,
    `${highSnacks} vs ${lowSnacks} snacks`,
    'Try drinking a glass of water before reaching for a snack. Thirst is often mistaken for hunger.',
    'water',
    { highWaterSnacks: highSnacks, lowWaterSnacks: lowSnacks, highWaterDays: highWater.length, lowWaterDays: lowWater.length },
  )];
}

// ── Detector 3: Fasting Break Quality (cross-module, 14 days) ────────

export function detectFastingBreakQuality(
  nutritionDays: DayNutritionData[],
  fastingDays: DayFastingData[],
): NutritionInsight[] {
  if (fastingDays.length < MIN_DAYS_CROSS_MODULE) return [];

  // Match days where user fasted
  const fastDaysWithNutrition = fastingDays
    .filter((f) => f.didFast && f.breakfastProteinG !== null && f.breakfastCalories !== null)
    .map((f) => {
      const nuDay = nutritionDays.find((n) => n.date === f.date);
      return nuDay ? { ...f, nuDay } : null;
    })
    .filter((d): d is DayFastingData & { nuDay: DayNutritionData } => d !== null);

  if (fastDaysWithNutrition.length < 5) return [];

  // Split by high-protein vs low-protein first meal (guard against zero-calorie entries)
  const validFastDays = fastDaysWithNutrition.filter(
    (d) => d.breakfastProteinG !== null && d.breakfastCalories !== null && d.breakfastCalories > 0,
  );
  const highProtein = validFastDays.filter(
    (d) => (d.breakfastProteinG! * 4 / d.breakfastCalories!) > 0.25, // >25% of calories from protein
  );
  const lowProtein = validFastDays.filter(
    (d) => (d.breakfastProteinG! * 4 / d.breakfastCalories!) <= 0.25,
  );

  if (highProtein.length < 3 || lowProtein.length < 3) return [];

  const highProteinUnderGoal = pct(highProtein.filter((d) => d.wasUnderCalorieGoal).length / highProtein.length);
  const lowProteinUnderGoal = pct(lowProtein.filter((d) => d.wasUnderCalorieGoal).length / lowProtein.length);
  const delta = highProteinUnderGoal - lowProteinUnderGoal;

  if (delta < 10) return [];

  return [makeInsight(
    'fasting_break_quality',
    'actionable',
    'How You Break Your Fast Matters',
    `Breaking your fast with a high-protein meal keeps you under calorie goals ${highProteinUnderGoal}% of the time vs ${lowProteinUnderGoal}% with lower protein.`,
    `${highProteinUnderGoal}% vs ${lowProteinUnderGoal}%`,
    'Prioritize protein when breaking your fast. Eggs, Greek yogurt, or a protein shake can set the tone for the whole day.',
    'fasting',
    { highProteinRate: highProteinUnderGoal, lowProteinRate: lowProteinUnderGoal },
  )];
}

// ── Detector 4: Meal Timing and Energy (cross-module, 30 days) ───────

export function detectMealTimingEnergy(
  nutritionDays: DayNutritionData[],
  moodDays: DayMoodData[],
): NutritionInsight[] {
  if (nutritionDays.length < MIN_DAYS_COMPLEX || moodDays.length < MIN_DAYS_COMPLEX) return [];

  // Match days with both late meals and next-day energy
  const pairs: Array<{ lateEating: boolean; nextDayEnergy: number }> = [];

  for (let i = 0; i < nutritionDays.length - 1; i++) {
    const today = nutritionDays[i];
    const tomorrow = nutritionDays[i + 1];

    // Check if tomorrow's date is actually the next day
    const todayDate = new Date(today.date + 'T00:00:00Z');
    const tomorrowDate = new Date(tomorrow.date + 'T00:00:00Z');
    const dayDiff = (tomorrowDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24);
    if (dayDiff !== 1) continue;

    const tomorrowMood = moodDays.find((m) => m.date === tomorrow.date);
    if (!tomorrowMood?.energyScore) continue;
    if (today.lastMealHour === null) continue;

    pairs.push({
      lateEating: today.lastMealHour >= 21, // after 9pm
      nextDayEnergy: tomorrowMood.energyScore,
    });
  }

  if (pairs.length < 14) return [];

  const lateEaters = pairs.filter((p) => p.lateEating);
  const earlyEaters = pairs.filter((p) => !p.lateEating);

  if (lateEaters.length < 5 || earlyEaters.length < 5) return [];

  const lateAvg = round1(average(lateEaters.map((p) => p.nextDayEnergy)));
  const earlyAvg = round1(average(earlyEaters.map((p) => p.nextDayEnergy)));
  const delta = round1(earlyAvg - lateAvg);

  if (delta < 0.5) return [];

  return [makeInsight(
    'meal_timing',
    'actionable',
    'Late Eating and Next-Day Energy',
    `Eating after 9pm correlates with lower next-day energy. Early finish: ${earlyAvg}/10 energy. Late eating: ${lateAvg}/10 energy.`,
    `${delta > 0 ? '-' : '+'}${Math.abs(delta)} pts`,
    'Try finishing your last meal before 9pm. Even shifting dinner 30 minutes earlier can help.',
    'timing',
    { earlyAvg, lateAvg, lateDays: lateEaters.length, earlyDays: earlyEaters.length },
  )];
}

// ── Detector 5: Gym Day Calorie Delta (cross-module, 14 days) ────────

export function detectGymDayDelta(
  nutritionDays: DayNutritionData[],
  workoutDays: DayWorkoutData[],
): NutritionInsight[] {
  if (workoutDays.length < MIN_DAYS_CROSS_MODULE) return [];

  const gymDates = new Set(workoutDays.filter((w) => w.didWorkout).map((w) => w.date));
  const restDates = new Set(workoutDays.filter((w) => !w.didWorkout).map((w) => w.date));

  const gymCalories = nutritionDays
    .filter((d) => gymDates.has(d.date))
    .map((d) => d.totalCalories);
  const restCalories = nutritionDays
    .filter((d) => restDates.has(d.date))
    .map((d) => d.totalCalories);

  if (gymCalories.length < 5 || restCalories.length < 5) return [];

  const gymAvg = round0(average(gymCalories));
  const restAvg = round0(average(restCalories));
  const delta = round0(restAvg - gymAvg);

  // Show insight if there's a meaningful difference either direction
  if (Math.abs(delta) < 100) return [];

  if (delta > 0) {
    // Eat more on rest days (common pattern)
    return [makeInsight(
      'gym_day_delta',
      'actionable',
      'Rest Day Overeating',
      `You eat ${delta} more calories on rest days (${restAvg}) compared to gym days (${gymAvg}). That's a common pattern worth watching.`,
      `+${delta} cal on rest days`,
      'Rest days often feel like free days. Plan your meals the same way you plan your workouts.',
      'rest-over',
      { gymAvg, restAvg, gymDays: gymCalories.length, restDays: restCalories.length },
    )];
  } else {
    // Eat more on gym days (compensation eating)
    const absDelta = Math.abs(delta);
    return [makeInsight(
      'gym_day_delta',
      'notable',
      'Post-Workout Compensation',
      `You eat ${absDelta} more calories on gym days (${gymAvg}) compared to rest days (${restAvg}). You might be over-compensating after workouts.`,
      `+${absDelta} cal on gym days`,
      'A post-workout meal is important, but aim for protein over volume. Your workout probably burned less than you think.',
      'gym-over',
      { gymAvg, restAvg, gymDays: gymCalories.length, restDays: restCalories.length },
    )];
  }
}

// ── Detector 6: Protein-Workout Adherence (cross-module, 14 days) ────

export function detectProteinWorkoutAdherence(
  nutritionDays: DayNutritionData[],
  workoutDays: DayWorkoutData[],
  proteinGoalG: number | null,
): NutritionInsight[] {
  if (workoutDays.length < MIN_DAYS_CROSS_MODULE) return [];
  if (!proteinGoalG || proteinGoalG <= 0) return [];

  const gymDates = new Set(workoutDays.filter((w) => w.didWorkout).map((w) => w.date));
  const restDates = new Set(workoutDays.filter((w) => !w.didWorkout).map((w) => w.date));

  const gymDaysNutrition = nutritionDays.filter((d) => gymDates.has(d.date));
  const restDaysNutrition = nutritionDays.filter((d) => restDates.has(d.date));

  if (gymDaysNutrition.length < 5 || restDaysNutrition.length < 5) return [];

  const gymHitRate = pct(gymDaysNutrition.filter((d) => d.proteinG >= proteinGoalG).length / gymDaysNutrition.length);
  const restHitRate = pct(restDaysNutrition.filter((d) => d.proteinG >= proteinGoalG).length / restDaysNutrition.length);
  const delta = gymHitRate - restHitRate;

  if (Math.abs(delta) < 10) return [];

  if (delta > 0) {
    return [makeInsight(
      'protein_workout',
      'notable',
      'Protein Drops on Rest Days',
      `You hit your protein goal ${gymHitRate}% of gym days but only ${restHitRate}% of rest days. Muscles need protein on recovery days too.`,
      `${gymHitRate}% vs ${restHitRate}%`,
      'Protein needs don\'t stop when you leave the gym. Your muscles are rebuilding on rest days. Keep protein consistent.',
      'rest-protein',
      { gymHitRate, restHitRate },
    )];
  } else {
    return [makeInsight(
      'protein_workout',
      'actionable',
      'Under-Fueling Gym Days',
      `You hit your protein goal only ${gymHitRate}% of gym days vs ${restHitRate}% on rest days. You may be under-fueling your workouts.`,
      `${gymHitRate}% vs ${restHitRate}%`,
      'Add a protein source to your pre or post-workout meal. Your muscles need fuel on training days.',
      'gym-protein',
      { gymHitRate, restHitRate },
    )];
  }
}

// ── Orchestrator ──────────────────────────────────────────────────────

export function generateNutritionInsights(input: InsightInput): NutritionInsight[] {
  const all: NutritionInsight[] = [
    // Internal insights (7-day minimum, always available)
    ...detectRestaurantImpact(input.nutritionDays),
    ...detectWaterSnacking(input.nutritionDays),
    // Cross-module insights (14-day minimum, gracefully skipped if data unavailable)
    ...detectFastingBreakQuality(input.nutritionDays, input.fastingDays),
    ...detectGymDayDelta(input.nutritionDays, input.workoutDays),
    ...detectProteinWorkoutAdherence(input.nutritionDays, input.workoutDays, input.calorieGoal ? input.calorieGoal * 0.3 / 4 : null), // ~30% of calories from protein
    // Complex insights (30-day minimum)
    ...detectMealTimingEnergy(input.nutritionDays, input.moodDays),
  ];

  // Deduplicate by id
  const seen = new Set<string>();
  return all.filter((insight) => {
    if (seen.has(insight.id)) return false;
    seen.add(insight.id);
    return true;
  });
}
