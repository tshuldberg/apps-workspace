import { describe, expect, it } from 'vitest';
import { mergeIngredients } from '../merge';
import type { StructuredIngredient } from '../../types';

function makeIngredient(
  overrides: Partial<StructuredIngredient & { recipe_id: string }>,
): StructuredIngredient & { recipe_id: string } {
  return {
    id: 'ingredient-1',
    recipe_id: 'recipe-1',
    section: null,
    quantity_value: 1,
    quantity: '1',
    unit: 'cup',
    item: 'flour',
    name: 'flour',
    prep_note: null,
    is_optional: 0,
    sort_order: 0,
    ...overrides,
  };
}

describe('mergeIngredients', () => {
  it('merges same item and unit by summing quantities', () => {
    const merged = mergeIngredients([
      makeIngredient({ quantity_value: 2, unit: 'cup', item: 'flour', recipe_id: 'recipe-1' }),
      makeIngredient({ quantity_value: 1, unit: 'cup', item: 'flour', recipe_id: 'recipe-2' }),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(3);
    expect(merged[0].recipeIds).toEqual(['recipe-1', 'recipe-2']);
  });

  it('converts compatible units before merging', () => {
    const merged = mergeIngredients([
      makeIngredient({ quantity_value: 4, unit: 'tbsp', item: 'butter', recipe_id: 'recipe-1' }),
      makeIngredient({ quantity_value: 0.5, unit: 'cup', item: 'butter', recipe_id: 'recipe-2' }),
    ]);

    expect(merged[0].quantity).toBeCloseTo(0.75, 1);
  });

  it('keeps items without quantities as a single line', () => {
    const merged = mergeIngredients([
      makeIngredient({ quantity_value: null, quantity: null, unit: null, item: 'salt' }),
      makeIngredient({ id: 'ingredient-2', quantity_value: null, quantity: null, unit: null, item: 'salt' }),
    ]);

    expect(merged[0].quantity).toBeNull();
  });
});
