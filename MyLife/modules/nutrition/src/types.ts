// -- Enums -------------------------------------------------------------------

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type FoodSource = 'usda' | 'open_food_facts' | 'fatsecret' | 'custom' | 'ai_photo';

export type NutrientCategory = 'vitamin' | 'mineral' | 'amino_acid' | 'fatty_acid' | 'other';

// -- Core types --------------------------------------------------------------

export interface Food {
  id: string;
  name: string;
  brand: string | null;
  servingSize: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  source: FoodSource;
  barcode: string | null;
  usdaNdbNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Nutrient {
  id: string;
  name: string;
  unit: string;
  rdaValue: number | null;
  rdaUnit: string | null;
  category: NutrientCategory;
  sortOrder: number;
}

export interface FoodNutrient {
  id: string;
  foodId: string;
  nutrientId: string;
  amount: number;
}

export interface FoodLogEntry {
  id: string;
  date: string;
  mealType: MealType;
  notes: string | null;
  createdAt: string;
}

export interface FoodLogItem {
  id: string;
  logId: string;
  foodId: string;
  servingCount: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface DailyGoals {
  id: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  effectiveDate: string;
}

export interface NutritionSetting {
  key: string;
  value: string;
  updatedAt: string;
}

export interface BarcodeCache {
  barcode: string;
  foodId: string | null;
  source: string;
  rawJson: string | null;
  expiresAt: string | null;
}
