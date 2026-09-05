'use server';

import {
  buildCart,
  checkProviderAvailability,
  getPantryItems,
  getIngredients,
  type GroceryProvider,
  type DeliveryCart,
  type ProviderAvailability,
} from '@mylife/bestchef';
import { getAdapter, ensureModuleMigrations } from '@/lib/db';

export async function fetchProviderAvailability(
  zipCode: string,
): Promise<ProviderAvailability[]> {
  try {
    return await checkProviderAvailability(zipCode);
  } catch {
    return [];
  }
}

export async function buildDeliveryCart(
  recipeId: string,
  provider: GroceryProvider,
  options?: { subtractPantry?: boolean; zipCode?: string },
): Promise<DeliveryCart | null> {
  try {
    const db = getAdapter();
    ensureModuleMigrations('recipes');

    const ingredients = getIngredients(db, recipeId);
    const pantryItems = options?.subtractPantry
      ? getPantryItems(db)
      : [];

    const ingredientInputs = ingredients.map((ing) => ({
      name: ing.item ?? ing.name,
      quantity: ing.quantity_value ?? 1,
      unit: ing.unit ?? '',
    }));

    return await buildCart(provider, ingredientInputs, {
      subtractPantry: pantryItems,
      zipCode: options?.zipCode,
    });
  } catch {
    return null;
  }
}
