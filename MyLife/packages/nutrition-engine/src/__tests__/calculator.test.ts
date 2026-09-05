import { describe, it, expect } from 'vitest';
import {
  emptyBreakdown,
  addNutrient,
  divideBreakdown,
  sumBreakdowns,
  scaleBreakdown,
} from '../calculator';
import type { NutritionBreakdown } from '../types';

describe('emptyBreakdown', () => {
  it('returns all null fields', () => {
    const b = emptyBreakdown();
    expect(b.calories).toBeNull();
    expect(b.fat_g).toBeNull();
    expect(b.saturated_fat_g).toBeNull();
    expect(b.carbs_g).toBeNull();
    expect(b.fiber_g).toBeNull();
    expect(b.sugar_g).toBeNull();
    expect(b.protein_g).toBeNull();
    expect(b.sodium_mg).toBeNull();
  });
});

describe('addNutrient', () => {
  it('returns null when both are null', () => {
    expect(addNutrient(null, null)).toBeNull();
  });

  it('returns value when current is null', () => {
    expect(addNutrient(null, 10)).toBe(10);
  });

  it('returns current when value is null', () => {
    expect(addNutrient(5, null)).toBe(5);
  });

  it('sums both values', () => {
    expect(addNutrient(5, 10)).toBe(15);
  });
});

describe('divideBreakdown', () => {
  it('divides non-null values and rounds to 1 decimal', () => {
    const total: NutritionBreakdown = {
      calories: 450,
      fat_g: 21.2,
      saturated_fat_g: 4,
      carbs_g: 0,
      fiber_g: 0,
      sugar_g: null,
      protein_g: 62,
      sodium_mg: 148,
    };
    const result = divideBreakdown(total, 4);
    expect(result.calories).toBe(112.5);
    expect(result.protein_g).toBe(15.5);
    expect(result.sugar_g).toBeNull();
    expect(result.sodium_mg).toBe(37);
  });
});

describe('sumBreakdowns', () => {
  it('sums two breakdowns field by field', () => {
    const a: NutritionBreakdown = {
      calories: 200,
      fat_g: 10,
      saturated_fat_g: 3,
      carbs_g: 20,
      fiber_g: 5,
      sugar_g: null,
      protein_g: 15,
      sodium_mg: 100,
    };
    const b: NutritionBreakdown = {
      calories: 300,
      fat_g: 5,
      saturated_fat_g: 1,
      carbs_g: 30,
      fiber_g: null,
      sugar_g: 10,
      protein_g: 25,
      sodium_mg: 200,
    };
    const result = sumBreakdowns(a, b);
    expect(result.calories).toBe(500);
    expect(result.fat_g).toBe(15);
    expect(result.fiber_g).toBe(5); // null + 5 = 5
    expect(result.sugar_g).toBe(10); // null + 10 = 10
    expect(result.protein_g).toBe(40);
  });

  it('returns null when both fields are null', () => {
    const a = emptyBreakdown();
    const b = emptyBreakdown();
    const result = sumBreakdowns(a, b);
    expect(result.calories).toBeNull();
  });
});

describe('scaleBreakdown', () => {
  it('scales non-null values by multiplier', () => {
    const breakdown: NutritionBreakdown = {
      calories: 100,
      fat_g: 5,
      saturated_fat_g: 2,
      carbs_g: 20,
      fiber_g: 3,
      sugar_g: null,
      protein_g: 10,
      sodium_mg: 50,
    };
    const result = scaleBreakdown(breakdown, 2);
    expect(result.calories).toBe(200);
    expect(result.fat_g).toBe(10);
    expect(result.sugar_g).toBeNull();
    expect(result.sodium_mg).toBe(100);
  });

  it('handles scale of 0', () => {
    const breakdown: NutritionBreakdown = {
      calories: 100,
      fat_g: 5,
      saturated_fat_g: 2,
      carbs_g: 20,
      fiber_g: 3,
      sugar_g: 8,
      protein_g: 10,
      sodium_mg: 50,
    };
    const result = scaleBreakdown(breakdown, 0);
    expect(result.calories).toBe(0);
    expect(result.protein_g).toBe(0);
  });
});
