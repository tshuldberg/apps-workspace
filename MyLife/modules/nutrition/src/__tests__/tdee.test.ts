import { describe, expect, it } from 'vitest';
import {
  calculateBMR,
} from '../sync/energy-balance';
import {
  calculateTDEE,
  calculateDailyCalories,
  calculateMacroGrams,
  normalizeMacroSplit,
  lbsToKg,
  kgToLbs,
  ftInToCm,
  cmToFtIn,
} from '../engine/tdee';

describe('nutrition tdee helpers', () => {
  it('supports calculateBMR overloads', () => {
    const fromProfile = calculateBMR({
      weightKg: 81.6,
      heightCm: 182,
      age: 34,
      sex: 'male',
      activityLevel: 'moderate',
    });
    const fromArgs = calculateBMR(81.6, 182, 34, 'male');

    expect(fromProfile).toBe(fromArgs);
    expect(Math.round(fromArgs)).toBe(1789);
  });

  it('calculates tdee and goal calories', () => {
    const tdee = calculateTDEE(1778, 'moderate');
    expect(tdee).toBe(2756);
    expect(calculateDailyCalories(tdee, 'maintain', 0.5)).toBe(2756);
    expect(calculateDailyCalories(tdee, 'lose', 1)).toBe(2256);
    expect(calculateDailyCalories(tdee, 'gain', 0.5)).toBe(3006);
  });

  it('normalizes macro splits before converting to grams', () => {
    const split = normalizeMacroSplit({ protein: 32, carbs: 41, fat: 25 });
    expect(split.protein + split.carbs + split.fat).toBe(100);

    const grams = calculateMacroGrams(2400, split);
    expect(grams).toEqual({
      protein: 198,
      carbs: 246,
      fat: 69,
    });
  });

  it('converts units for weight and height', () => {
    expect(lbsToKg(180)).toBeCloseTo(81.65, 2);
    expect(kgToLbs(81.65)).toBeCloseTo(180, 1);
    expect(ftInToCm(5, 10)).toBeCloseTo(177.8, 1);
    expect(cmToFtIn(177.8)).toEqual({ feet: 5, inches: 10 });
  });
});
