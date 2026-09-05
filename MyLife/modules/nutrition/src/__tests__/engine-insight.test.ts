import { describe, it, expect } from 'vitest';
import {
  detectRestaurantImpact,
  detectWaterSnacking,
  detectFastingBreakQuality,
  detectMealTimingEnergy,
  detectGymDayDelta,
  detectProteinWorkoutAdherence,
  generateNutritionInsights,
} from '../engine/insight';
import type { DayNutritionData, DayFastingData, DayWorkoutData, DayMoodData } from '../engine/types';

// ── Helpers ──────────────────────────────────────────────────────────

function makeDays(count: number, overrides?: Partial<DayNutritionData>): DayNutritionData[] {
  const base = new Date('2026-01-01T00:00:00Z');
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i);
    return {
      date: d.toISOString().slice(0, 10),
      totalCalories: 2000,
      proteinG: 100,
      carbsG: 200,
      fatG: 80,
      mealCount: 3,
      snackCount: 2,
      lastMealHour: 19,
      firstMealHour: 8,
      isRestaurantMeal: false,
      waterMl: 2500,
      ...overrides,
    };
  });
}

// ── Detector 1: Restaurant Impact ────────────────────────────────────

describe('detectRestaurantImpact', () => {
  it('returns empty when fewer than 7 days', () => {
    const days = makeDays(5);
    expect(detectRestaurantImpact(days)).toEqual([]);
  });

  it('returns empty when not enough restaurant days', () => {
    const days = makeDays(14);
    days[0].isRestaurantMeal = true; // only 1
    expect(detectRestaurantImpact(days)).toEqual([]);
  });

  it('detects calorie delta between restaurant and home days', () => {
    const days = makeDays(14);
    // First 4 are restaurant days with higher calories
    for (let i = 0; i < 4; i++) {
      days[i].isRestaurantMeal = true;
      days[i].totalCalories = 2800;
    }
    const insights = detectRestaurantImpact(days);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe('restaurant_impact');
    expect(insights[0].severity).toBe('actionable'); // >500 cal delta
    expect(insights[0].recommendation).toBeTruthy();
  });

  it('returns empty when delta is under 100 calories', () => {
    const days = makeDays(14);
    days[0].isRestaurantMeal = true;
    days[0].totalCalories = 2050;
    days[1].isRestaurantMeal = true;
    days[1].totalCalories = 2050;
    expect(detectRestaurantImpact(days)).toEqual([]);
  });
});

// ── Detector 2: Water-Snacking ───────────────────────────────────────

describe('detectWaterSnacking', () => {
  it('returns empty when fewer than 7 days with water data', () => {
    const days = makeDays(5);
    expect(detectWaterSnacking(days)).toEqual([]);
  });

  it('detects snacking difference between high and low water days', () => {
    const days = makeDays(14);
    // First 7: high water, low snacks
    for (let i = 0; i < 7; i++) {
      days[i].waterMl = 2500;
      days[i].snackCount = 1;
    }
    // Last 7: low water, high snacks
    for (let i = 7; i < 14; i++) {
      days[i].waterMl = 1000;
      days[i].snackCount = 4;
    }
    const insights = detectWaterSnacking(days);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe('water_snacking');
    expect(insights[0].severity).toBe('actionable');
  });

  it('returns empty when snack difference is under 0.5', () => {
    const days = makeDays(14);
    for (let i = 0; i < 7; i++) {
      days[i].waterMl = 2500;
      days[i].snackCount = 2;
    }
    for (let i = 7; i < 14; i++) {
      days[i].waterMl = 1000;
      days[i].snackCount = 2;
    }
    expect(detectWaterSnacking(days)).toEqual([]);
  });
});

// ── Detector 3: Fasting Break Quality ────────────────────────────────

describe('detectFastingBreakQuality', () => {
  it('returns empty with insufficient fasting data', () => {
    const nuDays = makeDays(14);
    const fastDays: DayFastingData[] = [];
    expect(detectFastingBreakQuality(nuDays, fastDays)).toEqual([]);
  });

  it('detects protein-rich fast breaks vs low-protein', () => {
    const nuDays = makeDays(30);
    const fastDays: DayFastingData[] = [];

    // 8 high-protein fast breaks (under calorie goal)
    for (let i = 0; i < 8; i++) {
      fastDays.push({
        date: nuDays[i].date,
        didFast: true,
        breakfastProteinG: 30, // >25% of 400 cal
        breakfastCalories: 400,
        wasUnderCalorieGoal: true,
      });
    }
    // 8 low-protein fast breaks (over calorie goal)
    for (let i = 8; i < 16; i++) {
      fastDays.push({
        date: nuDays[i].date,
        didFast: true,
        breakfastProteinG: 10, // <25% of 400 cal
        breakfastCalories: 400,
        wasUnderCalorieGoal: false,
      });
    }

    const insights = detectFastingBreakQuality(nuDays, fastDays);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe('fasting_break_quality');
    expect(insights[0].severity).toBe('actionable');
  });
});

// ── Detector 4: Meal Timing Energy ───────────────────────────────────

describe('detectMealTimingEnergy', () => {
  it('returns empty with insufficient data', () => {
    const nuDays = makeDays(10);
    const moodDays: DayMoodData[] = [];
    expect(detectMealTimingEnergy(nuDays, moodDays)).toEqual([]);
  });

  it('detects late eating and lower next-day energy', () => {
    const nuDays = makeDays(60);
    const moodDays: DayMoodData[] = [];

    // First 30 days: early eating, high energy next day
    for (let i = 0; i < 30; i++) {
      nuDays[i].lastMealHour = 18;
      moodDays.push({ date: nuDays[i].date, energyScore: 8 });
    }
    // Last 30 days: late eating, low energy next day
    for (let i = 30; i < 60; i++) {
      nuDays[i].lastMealHour = 22;
      moodDays.push({ date: nuDays[i].date, energyScore: 4 });
    }

    const insights = detectMealTimingEnergy(nuDays, moodDays);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe('meal_timing');
    expect(insights[0].severity).toBe('actionable');
  });
});

// ── Detector 5: Gym Day Delta ────────────────────────────────────────

describe('detectGymDayDelta', () => {
  it('returns empty with insufficient workout data', () => {
    const nuDays = makeDays(14);
    expect(detectGymDayDelta(nuDays, [])).toEqual([]);
  });

  it('detects rest day overeating', () => {
    const nuDays = makeDays(30);
    const workoutDays: DayWorkoutData[] = [];

    for (let i = 0; i < 30; i++) {
      const isGymDay = i % 2 === 0;
      workoutDays.push({ date: nuDays[i].date, didWorkout: isGymDay });
      nuDays[i].totalCalories = isGymDay ? 2000 : 2500;
    }

    const insights = detectGymDayDelta(nuDays, workoutDays);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe('gym_day_delta');
    expect(insights[0].title).toBe('Rest Day Overeating');
  });

  it('detects post-workout compensation', () => {
    const nuDays = makeDays(30);
    const workoutDays: DayWorkoutData[] = [];

    for (let i = 0; i < 30; i++) {
      const isGymDay = i % 2 === 0;
      workoutDays.push({ date: nuDays[i].date, didWorkout: isGymDay });
      nuDays[i].totalCalories = isGymDay ? 2800 : 2000;
    }

    const insights = detectGymDayDelta(nuDays, workoutDays);
    expect(insights).toHaveLength(1);
    expect(insights[0].title).toBe('Post-Workout Compensation');
  });
});

// ── Detector 6: Protein-Workout Adherence ────────────────────────────

describe('detectProteinWorkoutAdherence', () => {
  it('returns empty without protein goal', () => {
    const nuDays = makeDays(30);
    const workoutDays: DayWorkoutData[] = nuDays.map((d) => ({ date: d.date, didWorkout: true }));
    expect(detectProteinWorkoutAdherence(nuDays, workoutDays, null)).toEqual([]);
  });

  it('detects protein drop on rest days', () => {
    const nuDays = makeDays(30);
    const workoutDays: DayWorkoutData[] = [];
    const proteinGoal = 120;

    for (let i = 0; i < 30; i++) {
      const isGymDay = i % 2 === 0;
      workoutDays.push({ date: nuDays[i].date, didWorkout: isGymDay });
      nuDays[i].proteinG = isGymDay ? 140 : 80; // Hit goal on gym days, miss on rest
    }

    const insights = detectProteinWorkoutAdherence(nuDays, workoutDays, proteinGoal);
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe('protein_workout');
  });
});

// ── Orchestrator ──────────────────────────────────────────────────────

describe('generateNutritionInsights', () => {
  it('returns empty array with minimal data', () => {
    const result = generateNutritionInsights({
      nutritionDays: makeDays(3),
      fastingDays: [],
      workoutDays: [],
      moodDays: [],
      calorieGoal: null,
    });
    expect(result).toEqual([]);
  });

  it('runs all detectors and deduplicates', () => {
    const nuDays = makeDays(14);
    // Create restaurant + water data that triggers insights
    for (let i = 0; i < 4; i++) {
      nuDays[i].isRestaurantMeal = true;
      nuDays[i].totalCalories = 2800;
    }
    for (let i = 0; i < 7; i++) {
      nuDays[i].waterMl = 2500;
      nuDays[i].snackCount = 1;
    }
    for (let i = 7; i < 14; i++) {
      nuDays[i].waterMl = 1000;
      nuDays[i].snackCount = 4;
    }

    const result = generateNutritionInsights({
      nutritionDays: nuDays,
      fastingDays: [],
      workoutDays: [],
      moodDays: [],
      calorieGoal: 2200,
    });

    expect(result.length).toBeGreaterThanOrEqual(1);
    // All insights should have required fields
    for (const insight of result) {
      expect(insight.id).toBeTruthy();
      expect(insight.type).toBeTruthy();
      expect(insight.title).toBeTruthy();
      expect(insight.body).toBeTruthy();
      expect(insight.recommendation).toBeTruthy();
      expect(insight.generatedAt).toBeTruthy();
    }
    // No duplicate IDs
    const ids = result.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
