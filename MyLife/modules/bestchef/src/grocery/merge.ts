import type { GrocerySection, MergedGroceryItem, StructuredIngredient } from '../types';
import { categorizeItem } from './categorize';
import { areUnitsCompatible, convertUnit, UNIT_CONVERSIONS, bestDisplayUnit } from './units';
import { normalizeItemName } from '../pantry/name-normalizer';

export function mergeIngredients(
  ingredients: Array<StructuredIngredient & { recipe_id: string }>,
): MergedGroceryItem[] {
  const groups = new Map<
    string,
    Array<{ quantity: number | null; unit: string | null; recipeId: string }>
  >();

  for (const ingredient of ingredients) {
    const key = normalizeItemName(ingredient.item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)?.push({
      quantity: ingredient.quantity_value,
      unit: ingredient.unit,
      recipeId: ingredient.recipe_id,
    });
  }

  const result: MergedGroceryItem[] = [];
  for (const [normalizedName, entries] of groups) {
    const originalItem =
      ingredients.find((ingredient) => normalizeItemName(ingredient.item) === normalizedName)?.item ??
      normalizedName;
    const recipeIds = [...new Set(entries.map((entry) => entry.recipeId))];
    const section = categorizeItem(originalItem);
    const withQuantity = entries.filter((entry) => entry.quantity !== null);

    if (withQuantity.length === 0) {
      result.push({
        item: originalItem,
        quantity: null,
        unit: null,
        section,
        recipeIds,
      });
      continue;
    }

    const unitGroups = new Map<string, Array<{ quantity: number; unit: string | null }>>();
    for (const entry of withQuantity) {
      let placed = false;
      for (const [, group] of unitGroups) {
        if (areUnitsCompatible(entry.unit, group[0].unit)) {
          group.push({ quantity: entry.quantity!, unit: entry.unit });
          placed = true;
          break;
        }
      }
      if (!placed) {
        unitGroups.set(entry.unit ?? '__none__', [{ quantity: entry.quantity!, unit: entry.unit }]);
      }
    }

    for (const [, group] of unitGroups) {
      const targetUnit = group[0].unit;
      if (!targetUnit || !UNIT_CONVERSIONS[targetUnit]) {
        const total = group.reduce((sum, entry) => sum + entry.quantity, 0);
        result.push({
          item: originalItem,
          quantity: Math.round(total * 1000) / 1000,
          unit: targetUnit,
          section,
          recipeIds,
        });
        continue;
      }

      const conversion = UNIT_CONVERSIONS[targetUnit];
      let baseTotal = 0;
      for (const entry of group) {
        const fromUnit = entry.unit ?? targetUnit;
        const converted = convertUnit(entry.quantity, fromUnit, targetUnit);
        if (converted !== null) {
          baseTotal += converted * conversion.toBase;
        } else {
          baseTotal += entry.quantity * conversion.toBase;
        }
      }

      const display = bestDisplayUnit(baseTotal, conversion.category);
      result.push({
        item: originalItem,
        quantity: Math.round(display.quantity * 1000) / 1000,
        unit: display.unit,
        section,
        recipeIds,
      });
    }
  }

  const sectionOrder: GrocerySection[] = [
    'produce',
    'dairy',
    'meat',
    'bakery',
    'pantry',
    'frozen',
    'beverages',
    'snacks',
    'condiments',
    'other',
  ];

  result.sort((left, right) => {
    const leftIndex = sectionOrder.indexOf(left.section);
    const rightIndex = sectionOrder.indexOf(right.section);
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    return left.item.localeCompare(right.item);
  });

  return result;
}
