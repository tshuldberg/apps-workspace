import { ACTIVITY_MULTIPLIERS, type ActivityLevel } from '../sync/types';

export type WeightGoalDirection = 'maintain' | 'lose' | 'gain';

export interface MacroSplitPercents {
  protein: number;
  carbs: number;
  fat: number;
}

export interface MacroGramTargets {
  protein: number;
  carbs: number;
  fat: number;
}

const POUNDS_PER_KILOGRAM = 2.2046226218;
const INCHES_PER_FOOT = 12;
const CENTIMETERS_PER_INCH = 2.54;
const KCAL_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
} as const;

export function lbsToKg(lbs: number): number {
  return lbs / POUNDS_PER_KILOGRAM;
}

export function kgToLbs(kg: number): number {
  return kg * POUNDS_PER_KILOGRAM;
}

export function ftInToCm(feet: number, inches = 0): number {
  return (feet * INCHES_PER_FOOT + inches) * CENTIMETERS_PER_INCH;
}

export function cmToFtIn(cm: number): { feet: number; inches: number } {
  const totalInches = Math.max(0, Math.round(cm / CENTIMETERS_PER_INCH));
  return {
    feet: Math.floor(totalInches / INCHES_PER_FOOT),
    inches: totalInches % INCHES_PER_FOOT,
  };
}

export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

export function calculateDailyCalories(
  tdee: number,
  goal: WeightGoalDirection,
  rateLbsPerWeek = 0.5,
): number {
  if (goal === 'maintain') {
    return Math.round(tdee);
  }

  const safeRate = Math.max(0, rateLbsPerWeek);
  const delta = (safeRate * 3500) / 7;
  const adjusted = goal === 'lose' ? tdee - delta : tdee + delta;
  return Math.max(1200, Math.round(adjusted));
}

export function normalizeMacroSplit(split: MacroSplitPercents): MacroSplitPercents {
  const protein = Math.max(0, split.protein);
  const carbs = Math.max(0, split.carbs);
  const fat = Math.max(0, split.fat);
  const total = protein + carbs + fat;

  if (total <= 0) {
    return { protein: 30, carbs: 40, fat: 30 };
  }

  const normalized = {
    protein: Math.round((protein / total) * 100),
    carbs: Math.round((carbs / total) * 100),
    fat: Math.round((fat / total) * 100),
  };

  const diff = 100 - (normalized.protein + normalized.carbs + normalized.fat);
  if (diff !== 0) {
    normalized.carbs += diff;
  }

  return normalized;
}

export function calculateMacroGrams(
  calories: number,
  splitPercents: MacroSplitPercents,
): MacroGramTargets {
  const normalized = normalizeMacroSplit(splitPercents);

  return {
    protein: Math.round((calories * (normalized.protein / 100)) / KCAL_PER_GRAM.protein),
    carbs: Math.round((calories * (normalized.carbs / 100)) / KCAL_PER_GRAM.carbs),
    fat: Math.round((calories * (normalized.fat / 100)) / KCAL_PER_GRAM.fat),
  };
}
