import { describe, expect, it } from 'vitest';
import { displayIngredient } from '../display-ingredient';

describe('displayIngredient', () => {
  it('falls back to raw name when no structured fields', () => {
    expect(displayIngredient({ name: '2 cups flour' })).toBe('2 cups flour');
  });

  it('renders structured form when fields are present', () => {
    expect(
      displayIngredient({
        name: '2 cups all-purpose flour',
        quantity_value: 2,
        unit: 'cup',
        item: 'all-purpose flour',
      }),
    ).toBe('2 cup all-purpose flour');
  });

  it('appends prep_note as ", prep"', () => {
    expect(
      displayIngredient({
        name: 'rice noodles, soaked',
        quantity_value: 200,
        unit: 'g',
        item: 'rice noodles',
        prep_note: 'soaked',
      }),
    ).toBe('200 g rice noodles, soaked');
  });

  it('handles quantity-less ingredients (to taste)', () => {
    expect(
      displayIngredient({
        name: 'salt and pepper',
        item: 'salt and pepper',
        prep_note: 'to taste',
      }),
    ).toBe('salt and pepper, to taste');
  });

  it('returns empty string when nothing is available', () => {
    expect(displayIngredient({})).toBe('');
  });

  it('rounds floats to 2 decimals', () => {
    expect(
      displayIngredient({
        name: '0.333 cup honey',
        quantity_value: 1 / 3,
        unit: 'cup',
        item: 'honey',
      }),
    ).toBe('0.33 cup honey');
  });
});
