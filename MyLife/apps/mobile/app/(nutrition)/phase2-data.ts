import type { DatabaseAdapter } from '@mylife/db';
import {
  addFoodLogItem,
  createFoodLogEntry,
  getCachedBarcode,
  getFoodLogEntries,
  NU_ACCENT_LIGHT,
  NU_CALORIE,
  NU_SOURCE_BADGES,
  NU_WATER,
  type Food,
  type MealType,
} from '@mylife/nutrition';
import { uuid } from '../../lib/uuid';

export const NUTRITION_MEALS: Array<{
  key: MealType;
  label: string;
  icon: string;
}> = [
  { key: 'breakfast', label: 'Breakfast', icon: 'breakfast_dining' },
  { key: 'lunch', label: 'Lunch', icon: 'lunch_dining' },
  { key: 'dinner', label: 'Dinner', icon: 'dinner_dining' },
  { key: 'snack', label: 'Snack', icon: 'cookie' },
];

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function inferMealTypeFromTime(date = new Date()): MealType {
  const hour = date.getHours();
  if (hour >= 5 && hour <= 10) {
    return 'breakfast';
  }
  if (hour >= 11 && hour <= 14) {
    return 'lunch';
  }
  if (hour >= 15 && hour <= 17) {
    return 'snack';
  }
  return 'dinner';
}

export function resolveMealType(value?: string | string[] | null): MealType {
  const raw = Array.isArray(value) ? value[0] : value;
  if (
    raw === 'breakfast' ||
    raw === 'lunch' ||
    raw === 'dinner' ||
    raw === 'snack'
  ) {
    return raw;
  }

  return inferMealTypeFromTime();
}

export function getMealMeta(mealType: MealType) {
  return (
    NUTRITION_MEALS.find((meal) => meal.key === mealType) ?? NUTRITION_MEALS[1]
  );
}

export function formatFoodServing(food: Food): string {
  return `${food.servingSize} ${food.servingUnit}`;
}

export function scaleFoodByServing(food: Food, servingCount: number) {
  return {
    calories: Math.round(food.calories * servingCount),
    proteinG: Math.round(food.proteinG * servingCount * 10) / 10,
    carbsG: Math.round(food.carbsG * servingCount * 10) / 10,
    fatG: Math.round(food.fatG * servingCount * 10) / 10,
    fiberG: Math.round(food.fiberG * servingCount * 10) / 10,
    sugarG: Math.round(food.sugarG * servingCount * 10) / 10,
    sodiumMg: Math.round(food.sodiumMg * servingCount),
  };
}

export function ensureMealLogEntry(
  db: DatabaseAdapter,
  date: string,
  mealType: MealType,
): string {
  const existingEntry = getFoodLogEntries(db, date).find(
    (entry) => entry.mealType === mealType,
  );

  if (existingEntry) {
    return existingEntry.id;
  }

  const logId = uuid();
  createFoodLogEntry(db, logId, { date, mealType });
  return logId;
}

export function logFoodToMeal(
  db: DatabaseAdapter,
  food: Food,
  mealType: MealType,
  options?: {
    date?: string;
    servingCount?: number;
  },
) {
  const date = options?.date ?? todayKey();
  const servingCount = options?.servingCount ?? 1;
  const logId = ensureMealLogEntry(db, date, mealType);
  const scaled = scaleFoodByServing(food, servingCount);

  addFoodLogItem(db, uuid(), {
    logId,
    foodId: food.id,
    servingCount,
    calories: scaled.calories,
    proteinG: scaled.proteinG,
    carbsG: scaled.carbsG,
    fatG: scaled.fatG,
  });

  return { logId, date, servingCount, scaled };
}

export function resolveSourceMeta(source: Food['source'] | 'cache') {
  if (source === 'cache') {
    return {
      label: 'Cached',
      color: NU_WATER,
      icon: 'qr_code_scanner',
    };
  }

  return (
    NU_SOURCE_BADGES[source] ?? {
      label: source,
      color: NU_ACCENT_LIGHT,
      icon: 'science',
    }
  );
}

export function resolveSourceAccent(source: Food['source'] | 'cache') {
  if (source === 'open_food_facts' || source === 'cache') {
    return NU_WATER;
  }
  if (source === 'fatsecret') {
    return NU_CALORIE;
  }
  return NU_ACCENT_LIGHT;
}

export function parseFoodImage(rawJson?: string | null): string | null {
  if (!rawJson) {
    return null;
  }

  try {
    const data = JSON.parse(rawJson) as
      | { image_url?: string; image_front_url?: string; product?: { image_url?: string; image_front_url?: string } }
      | null;

    return (
      data?.image_url ??
      data?.image_front_url ??
      data?.product?.image_url ??
      data?.product?.image_front_url ??
      null
    );
  } catch {
    return null;
  }
}

export function getCachedFoodImage(
  db: DatabaseAdapter,
  food: Pick<Food, 'barcode'>,
): string | null {
  if (!food.barcode) {
    return null;
  }

  const cached = getCachedBarcode(db, food.barcode);
  return parseFoodImage(cached?.rawJson);
}

export function formatLiters(ml: number): string {
  return `${(ml / 1000).toFixed(1)}L`;
}

export function formatClockLabel(isoValue: string): string {
  try {
    const normalized = isoValue.includes('T')
      ? isoValue
      : isoValue.replace(' ', 'T');
    const date = new Date(normalized);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
