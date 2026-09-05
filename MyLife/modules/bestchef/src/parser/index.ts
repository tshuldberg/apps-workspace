export { parseIngredientText } from './ingredient-parser';
export { parseRecipeFromText } from './text-parser';
export { displayIngredient, displayIngredientRow } from './display-ingredient';
export type { DisplayableIngredient } from './display-ingredient';
export {
  RECIPE_TEMPLATES,
  getRecipeTemplate,
} from './recipe-templates';
export type {
  RecipeTemplateId,
  RecipeTemplateSeed,
} from './recipe-templates';
export type { UrlParsedRecipe } from './url-parser';
export type { ParsedIngredient, ParsedRecipe } from '../types';

/**
 * Parse ISO 8601 duration string to minutes.
 * Extracted here to avoid pulling in cheerio on mobile.
 * For parseRecipeFromHtml, import directly from './url-parser' on web/server.
 */
export function parseIsoDuration(iso: string): number | null {
  if (!iso) return null;
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return null;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 60 + minutes + Math.round(seconds / 60);
}
