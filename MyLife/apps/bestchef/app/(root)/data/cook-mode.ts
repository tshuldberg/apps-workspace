/**
 * Cook-mode recipe loading (audit M11).
 *
 * Cook mode originally only stepped through community submissions (cloud or
 * local). Saved (private) recipes live in local SQLite via
 * `getSavedRecipeDetails` and had no cook-mode entry point. This loader
 * resolves a saved recipe's title + ordered step instructions so the same
 * cook-mode screen can drive a saved recipe with a `source=saved` param.
 */

import type { DatabaseAdapter } from '@mylife/db';
import { getSavedRecipeDetails } from './kitchen';

export interface CookModeRecipeData {
  title: string;
  steps: string[];
}

/**
 * Load a saved recipe's ordered step instructions for cook mode. Returns
 * null when the recipe id is missing or has no rows; the screen falls back
 * to its default copy.
 */
export function getSavedRecipeCookMode(
  db: DatabaseAdapter,
  recipeId: string | null | undefined,
): CookModeRecipeData | null {
  if (!recipeId) return null;
  const details = getSavedRecipeDetails(db, recipeId);
  if (!details) return null;
  const steps = [...details.steps]
    .sort((a, b) => a.step_number - b.step_number)
    .map((step) => step.instruction.trim())
    .filter((instruction) => instruction.length > 0);
  return { title: details.recipe.title, steps };
}
