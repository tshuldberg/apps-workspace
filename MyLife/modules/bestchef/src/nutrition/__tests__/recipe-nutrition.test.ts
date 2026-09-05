import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '../../definition';
import { createRecipe, addIngredient } from '../../db/crud';
import { createPantryItem } from '../../db/pantry';
import { createNutritionData } from '../../db/nutrition';
import { createUnitConversionCorrection } from '../../db/unit-conversions';
import { calculateDishNutrition, calculateRecipeNutrition, recipeNutritionToDetail } from '../recipe-nutrition';

describe('calculateRecipeNutrition', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('recipes', RECIPES_MODULE.migrations!);
    db = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  function setupRecipeWithNutrition() {
    createRecipe(db, 'r1', { title: 'Pasta', servings: 4 });

    addIngredient(db, 'i1', {
      recipe_id: 'r1',
      name: 'chicken breast',
      item: 'chicken breast',
      quantity_value: 2,
    });
    addIngredient(db, 'i2', {
      recipe_id: 'r1',
      name: 'olive oil',
      item: 'olive oil',
      quantity_value: 1,
    });
    addIngredient(db, 'i3', {
      recipe_id: 'r1',
      name: 'garlic',
      item: 'garlic',
      quantity_value: 3,
    });

    const p1 = createPantryItem(db, {
      name: 'chicken breast',
      storage_location: 'fridge',
    });
    const p2 = createPantryItem(db, {
      name: 'olive oil',
      storage_location: 'pantry',
    });

    createNutritionData(db, 'n1', {
      pantry_item_id: p1.id,
      source: 'manual',
      calories: 165,
      fat_g: 3.6,
      protein_g: 31,
      carbs_g: 0,
      saturated_fat_g: 1,
      fiber_g: 0,
      sugar_g: 0,
      sodium_mg: 74,
    });
    createNutritionData(db, 'n2', {
      pantry_item_id: p2.id,
      source: 'manual',
      calories: 120,
      fat_g: 14,
      protein_g: 0,
      carbs_g: 0,
      saturated_fat_g: 2,
      fiber_g: 0,
      sugar_g: 0,
      sodium_mg: 0,
    });
  }

  it('returns correct totals for a 3-ingredient recipe with partial data', () => {
    setupRecipeWithNutrition();
    const result = calculateRecipeNutrition(db, 'r1');

    // chicken: 165*2=330 cal, olive oil: 120*1=120 cal => total 450
    expect(result.total.calories).toBe(450);
    // chicken: 3.6*2=7.2, olive oil: 14*1=14 => total 21.2
    expect(result.total.fat_g).toBe(21.2);
    // chicken: 31*2=62, olive oil: 0 => total 62
    expect(result.total.protein_g).toBe(62);

    expect(result.coverage).toBeCloseTo(2 / 3);
    expect(result.coveragePercent).toBe(67);
    expect(result.missingIngredients).toEqual(['garlic']);
    expect(result.missingIngredientDetails[0]).toMatchObject({
      ingredientId: 'i3',
      ingredientName: 'garlic',
      reason: 'no_pantry_match',
    });
    expect(result.sourceBreakdown).toEqual([
      expect.objectContaining({ source: 'manual', count: 2, confirmedCount: 2 }),
    ]);
  });

  it('returns correct per-serving when servings = 4', () => {
    setupRecipeWithNutrition();
    const result = calculateRecipeNutrition(db, 'r1');

    expect(result.servings).toBe(4);
    expect(result.perServing.calories).toBe(112.5);
    expect(result.perServing.protein_g).toBe(15.5);
  });

  it('handles recipe with 0 ingredients (coverage 0)', () => {
    createRecipe(db, 'r2', { title: 'Empty Recipe' });
    const result = calculateRecipeNutrition(db, 'r2');

    expect(result.coverage).toBe(0);
    expect(result.total.calories).toBeNull();
    expect(result.missingIngredients).toEqual([]);
  });

  it('handles all-unmatched ingredients (coverage 0)', () => {
    createRecipe(db, 'r3', { title: 'Unknown', servings: 2 });
    addIngredient(db, 'ix', {
      recipe_id: 'r3',
      name: 'unicorn tears',
      item: 'unicorn tears',
      quantity_value: 1,
    });

    const result = calculateRecipeNutrition(db, 'r3');
    expect(result.coverage).toBe(0);
    expect(result.coveragePercent).toBe(0);
    expect(result.total.calories).toBeNull();
    expect(result.missingIngredients).toEqual(['unicorn tears']);

    const detail = recipeNutritionToDetail(result, {
      surface: 'saved_recipe',
      subjectId: 'r3',
      title: 'Unknown',
    });
    expect(detail.status).toBe('missing');
    expect(detail.coveragePercent).toBe(0);
    expect(detail.missingIngredients).toEqual(['unicorn tears']);
    expect(detail.nutrients.calories).toBeNull();
  });

  it('handles mixed matched/unmatched (partial coverage)', () => {
    setupRecipeWithNutrition();
    const result = calculateRecipeNutrition(db, 'r1');
    expect(result.coverage).toBeGreaterThan(0);
    expect(result.coverage).toBeLessThan(1);
    expect(result.missingIngredients.length).toBe(1);
  });

  it('defaults to servings=1 when recipe.servings is null', () => {
    createRecipe(db, 'r4', { title: 'No Servings' });
    addIngredient(db, 'i10', {
      recipe_id: 'r4',
      name: 'chicken breast',
      item: 'chicken breast',
      quantity_value: 1,
    });
    const p = createPantryItem(db, { name: 'chicken breast', storage_location: 'fridge' });
    createNutritionData(db, 'n10', {
      pantry_item_id: p.id,
      source: 'manual',
      calories: 200,
    });

    const result = calculateRecipeNutrition(db, 'r4');
    expect(result.servings).toBe(1);
    expect(result.perServing.calories).toBe(result.total.calories);
    expect(result.missingFields.map((field) => field.key)).toEqual(expect.arrayContaining([
      'fat_g',
      'carbs_g',
      'added_sugar_g',
    ]));
    expect(result.total.fat_g).toBeNull();
  });

  it('handles null quantity_value gracefully', () => {
    createRecipe(db, 'r5', { title: 'Pinch Recipe', servings: 1 });
    addIngredient(db, 'i20', {
      recipe_id: 'r5',
      name: 'olive oil',
      item: 'olive oil',
    });
    const p = createPantryItem(db, { name: 'olive oil', storage_location: 'pantry' });
    createNutritionData(db, 'n20', {
      pantry_item_id: p.id,
      source: 'manual',
      calories: 120,
      fat_g: 14,
    });

    const result = calculateRecipeNutrition(db, 'r5');
    // null quantity_value defaults to scale=1
    expect(result.total.calories).toBe(120);
    expect(result.total.fat_g).toBe(14);
  });

  it('NutritionBreakdown sums correctly across multiple records', () => {
    setupRecipeWithNutrition();
    const result = calculateRecipeNutrition(db, 'r1');

    // sodium: chicken 74*2=148, olive oil 0*1=0 => 148
    expect(result.total.sodium_mg).toBe(148);
    // saturated: chicken 1*2=2, olive oil 2*1=2 => 4
    expect(result.total.saturated_fat_g).toBe(4);
  });

  it('scales weight ingredients against per-100g nutrition', () => {
    createRecipe(db, 'r6', { title: 'Rice Bowl', servings: 2 });
    addIngredient(db, 'i30', {
      recipe_id: 'r6',
      name: 'rice',
      item: 'rice',
      quantity_value: 200,
      quantity: '200',
      unit: 'g',
    });
    const p = createPantryItem(db, { name: 'rice', storage_location: 'pantry' });
    createNutritionData(db, 'n30', {
      pantry_item_id: p.id,
      source: 'usda_fdc',
      calories: 130,
      protein_g: 2.7,
      carbs_g: 28,
      fat_g: 0.3,
      serving_basis: 'per_100g',
      serving_quantity: 100,
      serving_unit: 'g',
      confidence: 0.9,
    });

    const result = calculateRecipeNutrition(db, 'r6');
    expect(result.total.calories).toBe(260);
    expect(result.perServing.calories).toBe(130);
    expect(result.conversionConfidence).toBe(1);
    expect(result.ingredientConversions[0]).toMatchObject({
      scale: 2,
      nutritionDataId: 'n30',
      nutritionSource: 'usda_fdc',
      sourceId: null,
      sourceLabel: 'USDA FoodData Central',
      confidenceLabel: 'High',
    });
  });

  it('uses density hints for volume ingredients against per-100g nutrition', () => {
    createRecipe(db, 'r7', { title: 'Milk Sauce', servings: 1 });
    addIngredient(db, 'i40', {
      recipe_id: 'r7',
      name: 'whole milk',
      item: 'whole milk',
      quantity_value: 1,
      quantity: '1',
      unit: 'cup',
    });
    const p = createPantryItem(db, { name: 'whole milk', storage_location: 'fridge' });
    createNutritionData(db, 'n40', {
      pantry_item_id: p.id,
      source: 'open_food_facts',
      calories: 60,
      protein_g: 3.2,
      carbs_g: 4.8,
      fat_g: 3.3,
      serving_basis: 'per_100g',
      serving_quantity: 100,
      serving_unit: 'g',
      confidence: 0.8,
    });

    const result = calculateRecipeNutrition(db, 'r7');
    expect(result.total.calories).toBeCloseTo(146.2, 1);
    expect(result.conversionConfidence).toBeGreaterThanOrEqual(0.8);
    expect(result.ingredientConversions[0]?.warnings[0]).toContain('milk density hint');
  });

  it('marks ambiguous recipe nutrition conversions as low confidence', () => {
    createRecipe(db, 'r8', { title: 'Herb Sauce', servings: 1 });
    addIngredient(db, 'i50', {
      recipe_id: 'r8',
      name: 'cilantro',
      item: 'cilantro',
      quantity_value: 1,
      quantity: '1',
      unit: 'bunch',
    });
    const p = createPantryItem(db, { name: 'cilantro', storage_location: 'fridge' });
    createNutritionData(db, 'n50', {
      pantry_item_id: p.id,
      source: 'usda_fdc',
      calories: 23,
      protein_g: 2.1,
      carbs_g: 3.7,
      fat_g: 0.5,
      serving_basis: 'per_100g',
      serving_quantity: 100,
      serving_unit: 'g',
      confidence: 0.9,
    });

    const result = calculateRecipeNutrition(db, 'r8');
    expect(result.coverage).toBe(1);
    expect(result.conversionConfidence).toBeLessThan(0.65);
    expect(result.lowConfidenceIngredients).toEqual(['cilantro']);
    expect(result.lowConfidenceWarnings[0]).toContain('cilantro');
    expect(result.ambiguousConversions[0]).toMatchObject({
      ingredientId: 'i50',
      ingredientName: 'cilantro',
    });
    expect(result.ingredientConversions[0]?.warnings).toContain('Used quantity as approximate scalar');
  });

  it('reuses persisted unit conversion corrections in recipe nutrition', () => {
    createUnitConversionCorrection(db, 'corr-cilantro-cup', {
      ingredientName: 'cilantro',
      fromUnit: 'cup',
      toUnit: 'g',
      factor: 16,
      confidence: 0.92,
      note: 'User-corrected chopped herb cup weight',
      source: 'recipe_review',
    });
    createRecipe(db, 'r8b', { title: 'Corrected Herb Sauce', servings: 1 });
    addIngredient(db, 'i55', {
      recipe_id: 'r8b',
      name: 'chopped cilantro',
      item: 'chopped cilantro',
      quantity_value: 1,
      quantity: '1',
      unit: 'cup',
    });
    const pantry = createPantryItem(db, { name: 'chopped cilantro', storage_location: 'fridge' });
    createNutritionData(db, 'n55', {
      pantry_item_id: pantry.id,
      source: 'usda_fdc',
      calories: 23,
      protein_g: 2.1,
      carbs_g: 3.7,
      fat_g: 0.5,
      serving_basis: 'per_100g',
      serving_quantity: 100,
      serving_unit: 'g',
      confidence: 0.9,
    });

    const result = calculateRecipeNutrition(db, 'r8b');

    expect(result.total.calories).toBeCloseTo(3.68, 2);
    expect(result.conversionConfidence).toBe(0.92);
    expect(result.lowConfidenceIngredients).toEqual([]);
    expect(result.ingredientConversions[0]).toMatchObject({
      scale: 0.16,
      confidence: 0.92,
      warnings: ['User-corrected chopped herb cup weight'],
    });
  });

  it('prefers confirmed manual nutrition when source records conflict', () => {
    createRecipe(db, 'r9', { title: 'Oat Bowl', servings: 1 });
    addIngredient(db, 'i60', {
      recipe_id: 'r9',
      name: 'oats',
      item: 'oats',
      quantity_value: 1,
    });
    const pantry = createPantryItem(db, { name: 'oats', storage_location: 'pantry' });
    createNutritionData(db, 'n-off-oats', {
      pantry_item_id: pantry.id,
      source: 'open_food_facts',
      source_id: 'off-oats',
      calories: 420,
      protein_g: 12,
      carbs_g: 70,
      fat_g: 7,
      confidence: 0.95,
      is_user_confirmed: 0,
    });
    createNutritionData(db, 'n-manual-oats', {
      pantry_item_id: pantry.id,
      source: 'manual',
      source_id: 'user-oats',
      calories: 389,
      protein_g: 16.9,
      carbs_g: 66,
      fat_g: 6.9,
      confidence: 0.8,
      confirmed_at: '2026-04-25T12:00:00.000Z',
    });

    const result = calculateRecipeNutrition(db, 'r9');

    expect(result.total.calories).toBe(389);
    expect(result.ingredientConversions[0]).toMatchObject({
      nutritionDataId: 'n-manual-oats',
      nutritionSource: 'manual',
      sourceId: 'user-oats',
      isUserConfirmed: true,
      confirmedAt: '2026-04-25T12:00:00.000Z',
    });
    expect(result.sourceBreakdown[0]).toMatchObject({
      source: 'manual',
      confirmedCount: 1,
    });
  });

  it('aggregates dish nutrition across ranked submissions', () => {
    const rice = createPantryItem(db, { name: 'rice', storage_location: 'pantry' });
    const tofu = createPantryItem(db, { name: 'tofu', storage_location: 'fridge' });
    createNutritionData(db, 'n-rice', {
      pantry_item_id: rice.id,
      source: 'usda_fdc',
      source_id: 'fdc-rice',
      calories: 130,
      protein_g: 2.7,
      carbs_g: 28,
      fat_g: 0.3,
      serving_basis: 'per_100g',
      serving_quantity: 100,
      serving_unit: 'g',
      confidence: 0.9,
    });
    createNutritionData(db, 'n-tofu', {
      pantry_item_id: tofu.id,
      source: 'open_food_facts',
      source_id: 'off-tofu',
      calories: 76,
      protein_g: 8,
      carbs_g: 1.9,
      fat_g: 4.8,
      serving_basis: 'per_100g',
      serving_quantity: 100,
      serving_unit: 'g',
      confidence: 0.82,
    });
    db.execute(
      `INSERT INTO rc_bestchef_submissions (
        id,
        dish_id,
        dish_name,
        title,
        description,
        ingredients_json,
        instructions_json,
        chef_id,
        chef_name,
        chef_handle,
        vote_score,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'sub-rice-tofu',
        'dish-bowl',
        'Rice Bowl',
        'Tofu Rice Bowl',
        '',
        JSON.stringify(['200 g rice', '100 g tofu', 'sesame seeds']),
        '[]',
        'chef-1',
        'Chef One',
        'chefone',
        10,
        '2026-04-25T12:00:00.000Z',
        '2026-04-25T12:00:00.000Z',
      ],
    );

    const result = calculateDishNutrition(db, 'dish-bowl');
    const detail = recipeNutritionToDetail(result, {
      surface: 'dish',
      subjectId: 'dish-bowl',
      title: 'Rice Bowl',
    });

    expect(result.coveragePercent).toBe(67);
    expect(result.total.calories).toBe(336);
    expect(result.missingIngredients).toEqual(['sesame seeds']);
    expect(result.sourceBreakdown.map((source) => source.source).sort()).toEqual([
      'open_food_facts',
      'usda_fdc',
    ]);
    expect(detail.coveragePercent).toBe(67);
    expect(detail.sourceBreakdown).toHaveLength(2);
  });
});
