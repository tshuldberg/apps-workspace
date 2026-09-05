import { RestaurantDinerProfile } from './types';

export const COMMON_ALLERGENS: string[] = [
  'Gluten',
  'Dairy',
  'Nuts',
  'Shellfish',
  'Eggs',
  'Soy',
  'Fish',
  'Sesame',
  'Peanuts',
];

/**
 * Check if a guest profile has any allergens recorded.
 */
export function hasAllergens(profile: RestaurantDinerProfile): boolean {
  return profile.allergens.length > 0;
}

/**
 * Format allergens for kitchen display (bold, comma-separated).
 */
export function formatAllergenAlert(allergens: string[]): string {
  if (allergens.length === 0) return '';
  return `ALLERGEN ALERT: ${allergens.join(', ')}`;
}
