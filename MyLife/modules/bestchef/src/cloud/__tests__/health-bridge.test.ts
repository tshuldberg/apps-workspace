import { describe, it, expect } from 'vitest';
import type { NutritionBreakdown } from '@mylife/nutrition-engine';
import { calculateHealthScore } from '../health-bridge';
import { getCurrentSeason } from '../challenges';

// ── Helper ───────────────────────────────────────────────────────────

function makeNutrition(overrides: Partial<NutritionBreakdown> = {}): NutritionBreakdown {
  return {
    calories: overrides.calories ?? null,
    fat_g: overrides.fat_g ?? null,
    saturated_fat_g: overrides.saturated_fat_g ?? null,
    carbs_g: overrides.carbs_g ?? null,
    fiber_g: overrides.fiber_g ?? null,
    sugar_g: overrides.sugar_g ?? null,
    protein_g: overrides.protein_g ?? null,
    sodium_mg: overrides.sodium_mg ?? null,
  };
}

// ── calculateHealthScore ────────────────────────────────────────────

describe('calculateHealthScore', () => {
  it('returns 0 for zero-calorie nutrition', () => {
    const result = calculateHealthScore(makeNutrition({ calories: 0 }));
    expect(result.score).toBe(0);
    expect(result.breakdown.macroBalance).toBe(0);
    expect(result.breakdown.fiberScore).toBe(0);
    expect(result.breakdown.sodiumScore).toBe(0);
    expect(result.breakdown.satFatScore).toBe(0);
  });

  it('returns 0 for all-null nutrition', () => {
    const result = calculateHealthScore(makeNutrition());
    expect(result.score).toBe(0);
  });

  it('scores well for a balanced meal', () => {
    // 2000 cal, 20% protein (100g), 55% carbs (275g), 25% fat (56g)
    // 30g fiber, 1500mg sodium, 15g sat fat
    const result = calculateHealthScore(makeNutrition({
      calories: 2000,
      protein_g: 100,
      carbs_g: 275,
      fat_g: 56,
      fiber_g: 30,
      sodium_mg: 1500,
      saturated_fat_g: 15,
    }));
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it('penalizes high sodium', () => {
    const lowSodium = calculateHealthScore(makeNutrition({
      calories: 2000,
      protein_g: 100,
      carbs_g: 275,
      fat_g: 56,
      fiber_g: 25,
      sodium_mg: 1000,
      saturated_fat_g: 10,
    }));

    const highSodium = calculateHealthScore(makeNutrition({
      calories: 2000,
      protein_g: 100,
      carbs_g: 275,
      fat_g: 56,
      fiber_g: 25,
      sodium_mg: 5000,
      saturated_fat_g: 10,
    }));

    expect(lowSodium.score).toBeGreaterThan(highSodium.score);
    expect(lowSodium.breakdown.sodiumScore).toBeGreaterThan(highSodium.breakdown.sodiumScore);
  });

  it('penalizes high saturated fat', () => {
    const lowSatFat = calculateHealthScore(makeNutrition({
      calories: 2000,
      protein_g: 100,
      carbs_g: 275,
      fat_g: 56,
      fiber_g: 25,
      sodium_mg: 1500,
      saturated_fat_g: 10,
    }));

    const highSatFat = calculateHealthScore(makeNutrition({
      calories: 2000,
      protein_g: 100,
      carbs_g: 275,
      fat_g: 56,
      fiber_g: 25,
      sodium_mg: 1500,
      saturated_fat_g: 40,
    }));

    expect(lowSatFat.breakdown.satFatScore).toBeGreaterThan(highSatFat.breakdown.satFatScore);
  });

  it('rewards higher fiber', () => {
    const lowFiber = calculateHealthScore(makeNutrition({
      calories: 2000,
      protein_g: 100,
      carbs_g: 275,
      fat_g: 56,
      fiber_g: 5,
      sodium_mg: 1500,
      saturated_fat_g: 15,
    }));

    const highFiber = calculateHealthScore(makeNutrition({
      calories: 2000,
      protein_g: 100,
      carbs_g: 275,
      fat_g: 56,
      fiber_g: 30,
      sodium_mg: 1500,
      saturated_fat_g: 15,
    }));

    expect(highFiber.breakdown.fiberScore).toBeGreaterThan(lowFiber.breakdown.fiberScore);
  });

  it('penalizes unbalanced macros', () => {
    // All protein, no carbs, no fat
    const unbalanced = calculateHealthScore(makeNutrition({
      calories: 2000,
      protein_g: 500,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 25,
      sodium_mg: 1500,
      saturated_fat_g: 0,
    }));

    const balanced = calculateHealthScore(makeNutrition({
      calories: 2000,
      protein_g: 100,
      carbs_g: 275,
      fat_g: 56,
      fiber_g: 25,
      sodium_mg: 1500,
      saturated_fat_g: 15,
    }));

    expect(balanced.breakdown.macroBalance).toBeGreaterThan(unbalanced.breakdown.macroBalance);
  });

  it('score never exceeds 100', () => {
    const perfect = calculateHealthScore(makeNutrition({
      calories: 2000,
      protein_g: 100,
      carbs_g: 275,
      fat_g: 56,
      fiber_g: 50,
      sodium_mg: 500,
      saturated_fat_g: 5,
    }));
    expect(perfect.score).toBeLessThanOrEqual(100);
    expect(perfect.score).toBeGreaterThanOrEqual(0);
  });
});

// ── getCurrentSeason ────────────────────────────────────────────────

describe('getCurrentSeason', () => {
  it('returns a valid season string', () => {
    const season = getCurrentSeason();
    expect(['spring', 'summer', 'fall', 'winter']).toContain(season);
  });
});
