import { describe, it, expect } from 'vitest';
import {
  convertUnit,
  areUnitsCompatible,
  normalizeUnit,
  resolveIngredientNutritionScale,
} from '../units';

describe('areUnitsCompatible', () => {
  it('returns true for same unit', () => {
    expect(areUnitsCompatible('cup', 'cup')).toBe(true);
  });

  it('returns true for compatible volume units', () => {
    expect(areUnitsCompatible('tsp', 'tbsp')).toBe(true);
    expect(areUnitsCompatible('tbsp', 'cup')).toBe(true);
    expect(areUnitsCompatible('cup', 'quart')).toBe(true);
  });

  it('returns true for compatible weight units', () => {
    expect(areUnitsCompatible('oz', 'lb')).toBe(true);
    expect(areUnitsCompatible('g', 'kg')).toBe(true);
  });

  it('returns false for incompatible units', () => {
    expect(areUnitsCompatible('cup', 'lb')).toBe(false);
    expect(areUnitsCompatible('tsp', 'oz')).toBe(false);
  });

  it('returns false when either unit is null', () => {
    expect(areUnitsCompatible(null, 'cup')).toBe(false);
    expect(areUnitsCompatible('cup', null)).toBe(false);
  });

  it('returns true when both units are null', () => {
    expect(areUnitsCompatible(null, null)).toBe(true);
  });

  it('returns false for unknown units', () => {
    expect(areUnitsCompatible('clove', 'cup')).toBe(false);
  });

  it('supports count and package units', () => {
    expect(areUnitsCompatible('each', 'item')).toBe(true);
    expect(areUnitsCompatible('package', 'serving')).toBe(true);
    expect(areUnitsCompatible('bunch', 'g')).toBe(false);
  });
});

describe('convertUnit', () => {
  it('converts tsp to tbsp', () => {
    const result = convertUnit(3, 'tsp', 'tbsp');
    expect(result).toBeCloseTo(1, 2);
  });

  it('converts tbsp to cup', () => {
    const result = convertUnit(16, 'tbsp', 'cup');
    expect(result).toBeCloseTo(1, 2);
  });

  it('converts cup to quart', () => {
    const result = convertUnit(4, 'cup', 'quart');
    expect(result).toBeCloseTo(1, 2);
  });

  it('converts oz to lb', () => {
    const result = convertUnit(16, 'oz', 'lb');
    expect(result).toBeCloseTo(1, 2);
  });

  it('returns null for incompatible units', () => {
    expect(convertUnit(1, 'cup', 'lb')).toBeNull();
  });

  it('returns same quantity for same unit', () => {
    expect(convertUnit(2, 'cup', 'cup')).toBe(2);
  });

  it('converts 4 tbsp to 1/4 cup', () => {
    const result = convertUnit(4, 'tbsp', 'cup');
    expect(result).toBeCloseTo(0.25, 2);
  });

  it('normalizes common aliases before converting', () => {
    expect(normalizeUnit('grams')).toBe('g');
    expect(normalizeUnit('cups')).toBe('cup');
    expect(convertUnit(1, 'cups', 'ml')).toBeCloseTo(236.588, 3);
  });
});

describe('resolveIngredientNutritionScale', () => {
  it('scales grams against per-100g nutrition', () => {
    const result = resolveIngredientNutritionScale({
      ingredientName: 'rice',
      quantity: 200,
      unit: 'g',
      nutrition: {
        serving_basis: 'per_100g',
        serving_quantity: 100,
        serving_unit: 'g',
      },
    });

    expect(result.scale).toBe(2);
    expect(result.confidence).toBe(1);
  });

  it('uses density hints for volume to weight conversions', () => {
    const result = resolveIngredientNutritionScale({
      ingredientName: 'whole milk',
      quantity: 1,
      unit: 'cup',
      nutrition: {
        serving_basis: 'per_100g',
        serving_quantity: 100,
        serving_unit: 'g',
      },
    });

    expect(result.scale).toBeCloseTo(2.44, 2);
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.warnings[0]).toContain('milk density hint');
  });

  it('uses user corrections before density hints', () => {
    const result = resolveIngredientNutritionScale({
      ingredientName: 'chopped cilantro',
      quantity: 1,
      unit: 'cup',
      nutrition: {
        serving_basis: 'per_100g',
        serving_quantity: 100,
        serving_unit: 'g',
      },
      corrections: [
        {
          ingredientName: 'cilantro',
          fromUnit: 'cup',
          toUnit: 'g',
          factor: 16,
          confidence: 0.92,
          note: 'User-corrected chopped herb cup weight',
        },
      ],
    });

    expect(result.scale).toBeCloseTo(0.16, 2);
    expect(result.confidence).toBe(0.92);
    expect(result.warnings).toEqual(['User-corrected chopped herb cup weight']);
  });

  it('marks ambiguous bunch conversions as low confidence', () => {
    const result = resolveIngredientNutritionScale({
      ingredientName: 'cilantro',
      quantity: 1,
      unit: 'bunch',
      nutrition: {
        serving_basis: 'per_100g',
        serving_quantity: 100,
        serving_unit: 'g',
      },
    });

    expect(result.scale).toBe(1);
    expect(result.confidence).toBeLessThan(0.65);
    expect(result.warnings).toContain('Used quantity as approximate scalar');
  });
});
