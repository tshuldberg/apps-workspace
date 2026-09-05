import type { NutritionServingBasis } from '../types';

export type UnitCategory = 'volume' | 'weight' | 'count';

export interface UnitConversion {
  category: UnitCategory;
  toBase: number;
  canonical: string;
  display: string;
  confidence: number;
}

interface UnitDefinition {
  canonical: string;
  display: string;
  category: UnitCategory;
  toBase: number;
  aliases: string[];
  confidence?: number;
}

const UNIT_DEFINITIONS: UnitDefinition[] = [
  { canonical: 'tsp', display: 'tsp', category: 'volume', toBase: 4.92892, aliases: ['tsp', 'teaspoon', 'teaspoons'] },
  { canonical: 'tbsp', display: 'tbsp', category: 'volume', toBase: 14.7868, aliases: ['tbsp', 'tablespoon', 'tablespoons', 'tbs'] },
  { canonical: 'cup', display: 'cup', category: 'volume', toBase: 236.588, aliases: ['cup', 'cups', 'c'] },
  { canonical: 'pint', display: 'pint', category: 'volume', toBase: 473.176, aliases: ['pint', 'pints', 'pt'] },
  { canonical: 'quart', display: 'quart', category: 'volume', toBase: 946.353, aliases: ['quart', 'quarts', 'qt'] },
  { canonical: 'gallon', display: 'gallon', category: 'volume', toBase: 3785.41, aliases: ['gallon', 'gallons', 'gal'] },
  { canonical: 'ml', display: 'ml', category: 'volume', toBase: 1, aliases: ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'] },
  { canonical: 'l', display: 'L', category: 'volume', toBase: 1000, aliases: ['l', 'L', 'liter', 'liters', 'litre', 'litres'] },
  { canonical: 'oz', display: 'oz', category: 'weight', toBase: 28.3495, aliases: ['oz', 'ounce', 'ounces'] },
  { canonical: 'lb', display: 'lb', category: 'weight', toBase: 453.592, aliases: ['lb', 'lbs', 'pound', 'pounds'] },
  { canonical: 'g', display: 'g', category: 'weight', toBase: 1, aliases: ['g', 'gram', 'grams'] },
  { canonical: 'kg', display: 'kg', category: 'weight', toBase: 1000, aliases: ['kg', 'kilogram', 'kilograms'] },
  { canonical: 'item', display: 'item', category: 'count', toBase: 1, aliases: ['item', 'items', 'each', 'ea', 'piece', 'pieces', 'count'], confidence: 0.85 },
  { canonical: 'serving', display: 'serving', category: 'count', toBase: 1, aliases: ['serving', 'servings'], confidence: 0.75 },
  { canonical: 'package', display: 'package', category: 'count', toBase: 1, aliases: ['package', 'packages', 'pkg', 'pack', 'packs'], confidence: 0.55 },
  { canonical: 'can', display: 'can', category: 'count', toBase: 1, aliases: ['can', 'cans'], confidence: 0.5 },
  { canonical: 'bunch', display: 'bunch', category: 'count', toBase: 1, aliases: ['bunch', 'bunches'], confidence: 0.35 },
  { canonical: 'clove', display: 'clove', category: 'count', toBase: 1, aliases: ['clove', 'cloves'], confidence: 0.5 },
  { canonical: 'slice', display: 'slice', category: 'count', toBase: 1, aliases: ['slice', 'slices'], confidence: 0.55 },
];

function buildConversions(): Record<string, UnitConversion> {
  const conversions: Record<string, UnitConversion> = {};
  for (const definition of UNIT_DEFINITIONS) {
    const conversion: UnitConversion = {
      category: definition.category,
      toBase: definition.toBase,
      canonical: definition.canonical,
      display: definition.display,
      confidence: definition.confidence ?? 1,
    };
    conversions[definition.canonical] = conversion;
    for (const alias of definition.aliases) {
      conversions[alias] = conversion;
      conversions[alias.toLowerCase()] = conversion;
    }
  }
  return conversions;
}

export const UNIT_CONVERSIONS: Record<string, UnitConversion> = buildConversions();

export type UnitSystem = 'imperial' | 'metric';

export interface UnitConversionCorrection {
  ingredientName: string;
  fromUnit: string;
  toUnit: string;
  factor: number;
  confidence?: number;
  note?: string;
}

export interface IngredientAmountConversion {
  quantity: number | null;
  unit: string | null;
  confidence: number;
  method: 'direct' | 'density_hint' | 'correction' | 'assumed_count' | 'unknown';
  warnings: string[];
  correction?: UnitConversionCorrection;
}

export interface IngredientNutritionScaleInput {
  ingredientName: string;
  quantity: number | null;
  unit: string | null;
  nutrition: {
    serving_basis: NutritionServingBasis;
    serving_quantity: number | null;
    serving_unit: string | null;
  };
  corrections?: UnitConversionCorrection[];
}

export interface IngredientNutritionScale {
  scale: number;
  confidence: number;
  basis: NutritionServingBasis;
  ingredientQuantity: number | null;
  ingredientUnit: string | null;
  referenceQuantity: number;
  referenceUnit: string;
  warnings: string[];
}

const DENSITY_HINTS: ReadonlyArray<{ match: RegExp; gramsPerMl: number; label: string; confidence: number }> = [
  { match: /\b(whole |skim |almond |oat |soy )?milk\b/i, gramsPerMl: 1.03, label: 'milk density hint', confidence: 0.8 },
  { match: /\b(water|broth|stock)\b/i, gramsPerMl: 1, label: 'water density hint', confidence: 0.85 },
  { match: /\b(olive oil|vegetable oil|canola oil|oil)\b/i, gramsPerMl: 0.91, label: 'oil density hint', confidence: 0.75 },
  { match: /\b(all-purpose flour|flour)\b/i, gramsPerMl: 0.53, label: 'flour density hint', confidence: 0.7 },
  { match: /\b(granulated sugar|sugar)\b/i, gramsPerMl: 0.85, label: 'sugar density hint', confidence: 0.7 },
  { match: /\b(honey|maple syrup|syrup)\b/i, gramsPerMl: 1.38, label: 'syrup density hint', confidence: 0.7 },
  { match: /\b(butter)\b/i, gramsPerMl: 0.96, label: 'butter density hint', confidence: 0.7 },
];

export function normalizeUnit(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const normalized = unit.trim();
  if (normalized.length === 0) return null;
  return UNIT_CONVERSIONS[normalized]?.canonical ?? UNIT_CONVERSIONS[normalized.toLowerCase()]?.canonical ?? null;
}

function getConversion(unit: string | null | undefined): UnitConversion | null {
  const normalized = normalizeUnit(unit);
  return normalized ? UNIT_CONVERSIONS[normalized] ?? null : null;
}

export function areUnitsCompatible(unitA: string | null, unitB: string | null): boolean {
  if (unitA === unitB) return true;
  if (!unitA || !unitB) return false;

  const a = getConversion(unitA);
  const b = getConversion(unitB);
  if (!a || !b) return false;
  return a.category === b.category;
}

export function getUnitConversionConfidence(unitA: string | null, unitB: string | null): number | null {
  if (!unitA || !unitB) return null;
  const a = getConversion(unitA);
  const b = getConversion(unitB);
  if (!a || !b || a.category !== b.category) return null;
  return Math.min(a.confidence, b.confidence);
}

export function getUnitCategory(unit: string | null | undefined): UnitCategory | null {
  return getConversion(unit)?.category ?? null;
}

export function convertUnit(quantity: number, fromUnit: string, toUnit: string): number | null {
  const fromCanonical = normalizeUnit(fromUnit);
  const toCanonical = normalizeUnit(toUnit);
  if (!fromCanonical || !toCanonical) return null;
  if (fromCanonical === toCanonical) return quantity;

  const from = UNIT_CONVERSIONS[fromCanonical];
  const to = UNIT_CONVERSIONS[toCanonical];
  if (!from || !to || from.category !== to.category) return null;

  const baseValue = quantity * from.toBase;
  return baseValue / to.toBase;
}

function findCorrection(
  ingredientName: string,
  fromUnit: string,
  toUnit: string,
  corrections: UnitConversionCorrection[] | undefined,
): UnitConversionCorrection | null {
  if (!corrections) return null;
  const lowerName = ingredientName.toLowerCase();
  const fromCanonical = normalizeUnit(fromUnit);
  const toCanonical = normalizeUnit(toUnit);
  if (!fromCanonical || !toCanonical) return null;

  for (const correction of corrections) {
    const correctionFrom = normalizeUnit(correction.fromUnit);
    const correctionTo = normalizeUnit(correction.toUnit);
    if (
      correctionFrom === fromCanonical &&
      correctionTo === toCanonical &&
      lowerName.includes(correction.ingredientName.toLowerCase())
    ) {
      return correction;
    }
  }
  return null;
}

function getDensityHint(ingredientName: string): (typeof DENSITY_HINTS)[number] | null {
  return DENSITY_HINTS.find((hint) => hint.match.test(ingredientName)) ?? null;
}

export function convertIngredientAmount(
  quantity: number,
  fromUnit: string | null,
  toUnit: string,
  ingredientName: string,
  corrections?: UnitConversionCorrection[],
): IngredientAmountConversion {
  const toCanonical = normalizeUnit(toUnit);
  if (!toCanonical) {
    return {
      quantity: null,
      unit: null,
      confidence: 0,
      method: 'unknown',
      warnings: [`Unknown target unit "${toUnit}"`],
    };
  }

  if (!fromUnit) {
    const target = UNIT_CONVERSIONS[toCanonical];
    const confidence = target?.category === 'count' ? 0.6 : 0.35;
    return {
      quantity,
      unit: toCanonical,
      confidence,
      method: target?.category === 'count' ? 'assumed_count' : 'unknown',
      warnings: [`Assumed ${ingredientName} quantity is already in ${target?.display ?? toCanonical}`],
    };
  }

  const fromCanonical = normalizeUnit(fromUnit);
  if (!fromCanonical) {
    return {
      quantity: null,
      unit: toCanonical,
      confidence: 0,
      method: 'unknown',
      warnings: [`Unknown ingredient unit "${fromUnit}"`],
    };
  }

  const direct = convertUnit(quantity, fromCanonical, toCanonical);
  if (direct !== null) {
    const conversion = UNIT_CONVERSIONS[fromCanonical];
    const confidence = Math.min(conversion?.confidence ?? 1, UNIT_CONVERSIONS[toCanonical]?.confidence ?? 1);
    return {
      quantity: direct,
      unit: toCanonical,
      confidence,
      method: 'direct',
      warnings: confidence < 0.75 ? [`${fromUnit} to ${toUnit} is approximate`] : [],
    };
  }

  const correction = findCorrection(ingredientName, fromCanonical, toCanonical, corrections);
  if (correction) {
    return {
      quantity: quantity * correction.factor,
      unit: toCanonical,
      confidence: correction.confidence ?? 0.9,
      method: 'correction',
      warnings: correction.note ? [correction.note] : [],
      correction,
    };
  }

  const from = UNIT_CONVERSIONS[fromCanonical];
  const to = UNIT_CONVERSIONS[toCanonical];
  const density = getDensityHint(ingredientName);
  if (from && to && density) {
    if (from.category === 'volume' && to.category === 'weight') {
      const ml = quantity * from.toBase;
      return {
        quantity: (ml * density.gramsPerMl) / to.toBase,
        unit: toCanonical,
        confidence: density.confidence,
        method: 'density_hint',
        warnings: [`Used ${density.label}`],
      };
    }
    if (from.category === 'weight' && to.category === 'volume') {
      const grams = quantity * from.toBase;
      return {
        quantity: (grams / density.gramsPerMl) / to.toBase,
        unit: toCanonical,
        confidence: density.confidence,
        method: 'density_hint',
        warnings: [`Used ${density.label}`],
      };
    }
  }

  return {
    quantity: null,
    unit: toCanonical,
    confidence: 0.2,
    method: 'unknown',
    warnings: [`Cannot convert ${fromUnit} to ${toUnit} for ${ingredientName}`],
  };
}

function nutritionReference(
  nutrition: IngredientNutritionScaleInput['nutrition'],
): { quantity: number; unit: string; warnings: string[] } {
  const servingQuantity = nutrition.serving_quantity && nutrition.serving_quantity > 0
    ? nutrition.serving_quantity
    : null;

  if (nutrition.serving_basis === 'per_100g') {
    return { quantity: 100, unit: 'g', warnings: [] };
  }
  if (nutrition.serving_basis === 'per_100ml') {
    return { quantity: 100, unit: 'ml', warnings: [] };
  }
  if (nutrition.serving_basis === 'per_package') {
    return {
      quantity: servingQuantity ?? 1,
      unit: nutrition.serving_unit ?? 'package',
      warnings: servingQuantity ? [] : ['Package serving size was missing, assumed 1 package'],
    };
  }
  if (nutrition.serving_basis === 'per_item') {
    return {
      quantity: servingQuantity ?? 1,
      unit: nutrition.serving_unit ?? 'item',
      warnings: servingQuantity ? [] : ['Item serving size was missing, assumed 1 item'],
    };
  }

  return {
    quantity: servingQuantity ?? 1,
    unit: nutrition.serving_unit ?? 'serving',
    warnings: servingQuantity ? [] : ['Serving size was missing, assumed 1 serving'],
  };
}

export function resolveIngredientNutritionScale(
  input: IngredientNutritionScaleInput,
): IngredientNutritionScale {
  const quantity = input.quantity ?? 1;
  const reference = nutritionReference(input.nutrition);
  const converted = convertIngredientAmount(
    quantity,
    input.unit,
    reference.unit,
    input.ingredientName,
    input.corrections,
  );

  if (converted.quantity === null || reference.quantity <= 0) {
    return {
      scale: quantity,
      confidence: 0.2,
      basis: input.nutrition.serving_basis,
      ingredientQuantity: input.quantity,
      ingredientUnit: normalizeUnit(input.unit),
      referenceQuantity: reference.quantity,
      referenceUnit: reference.unit,
      warnings: [...reference.warnings, ...converted.warnings, 'Used quantity as approximate scalar'],
    };
  }

  return {
    scale: converted.quantity / reference.quantity,
    confidence: converted.confidence,
    basis: input.nutrition.serving_basis,
    ingredientQuantity: input.quantity,
    ingredientUnit: normalizeUnit(input.unit),
    referenceQuantity: reference.quantity,
    referenceUnit: reference.unit,
    warnings: [...reference.warnings, ...converted.warnings],
  };
}

const DISPLAY_RANGES: Record<string, { min: number; max: number }> = {
  tsp: { min: 0.25, max: 4 },
  tbsp: { min: 0.5, max: 4 },
  cup: { min: 0.25, max: 8 },
  quart: { min: 1, max: 8 },
  oz: { min: 0.5, max: 16 },
  lb: { min: 0.5, max: 10 },
  ml: { min: 1, max: 999 },
  l: { min: 1, max: 50 },
  g: { min: 1, max: 999 },
  kg: { min: 1, max: 50 },
  item: { min: 1, max: 99 },
};

const SYSTEM_UNITS: Record<UnitSystem, Record<UnitCategory, string[]>> = {
  imperial: {
    volume: ['tsp', 'tbsp', 'cup', 'quart'],
    weight: ['oz', 'lb'],
    count: ['item'],
  },
  metric: {
    volume: ['ml', 'l'],
    weight: ['g', 'kg'],
    count: ['item'],
  },
};

export function bestDisplayUnit(
  baseValue: number,
  category: UnitCategory,
  system: UnitSystem = 'imperial',
): { quantity: number; unit: string } {
  const units = SYSTEM_UNITS[system][category];
  const fallbackUnit = units[0]!;
  let best = { quantity: baseValue / UNIT_CONVERSIONS[fallbackUnit]!.toBase, unit: UNIT_CONVERSIONS[fallbackUnit]!.display };

  for (const unit of units) {
    const conversion = UNIT_CONVERSIONS[unit];
    const range = DISPLAY_RANGES[unit];
    if (!conversion || !range) continue;

    const quantity = baseValue / conversion.toBase;
    if (quantity >= range.min && quantity <= range.max) {
      best = { quantity, unit: conversion.display };
    }
  }

  return best;
}

const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM']);

export function unitSystemForRegion(regionCode: string | null | undefined): UnitSystem {
  if (!regionCode) return 'metric';
  return IMPERIAL_REGIONS.has(regionCode.toUpperCase()) ? 'imperial' : 'metric';
}
