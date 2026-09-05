import { describe, expect, it } from 'vitest';
import { scaleIngredients } from '../scaler';
import type { StructuredIngredient } from '../../types';

function makeIngredient(overrides: Partial<StructuredIngredient> = {}): StructuredIngredient {
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

describe('scaleIngredients', () => {
  it('scales quantities proportionally when doubling', () => {
    const scaled = scaleIngredients(
      [
        makeIngredient({ quantity_value: 2, unit: 'cup', item: 'flour' }),
        makeIngredient({ quantity_value: 1, unit: 'tsp', item: 'salt' }),
      ],
      4,
      8,
    );

    expect(scaled[0].scaled_quantity).toBe(4);
    expect(scaled[1].scaled_quantity).toBe(2);
  });

  it('rounds to friendly fractions', () => {
    const scaled = scaleIngredients([makeIngredient({ quantity_value: 1 })], 4, 6);
    expect(scaled[0].scaled_quantity).toBe(1.5);
  });

  it('preserves null quantities', () => {
    const scaled = scaleIngredients([makeIngredient({ quantity_value: null, quantity: null })], 4, 8);
    expect(scaled[0].scaled_quantity).toBeNull();
  });
});
