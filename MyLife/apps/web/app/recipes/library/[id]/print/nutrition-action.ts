'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import { calculateRecipeNutrition } from '@mylife/bestchef';

export async function fetchRecipeNutritionAction(recipeId: string) {
  try {
    const adapter = getAdapter();
    ensureModuleMigrations('recipes');
    return calculateRecipeNutrition(adapter, recipeId);
  } catch (err) {
    console.error('[recipes] fetchRecipeNutritionAction failed:', err);
    return null;
  }
}
