import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE, createNutritionData, type NutritionProviderAdapter } from '@mylife/bestchef';
import {
  addIngredientAvailabilityRowsToGroceryList,
  addGroceryFlaggedRecipesToList,
  addManualGroceryItem,
  addPantryEntry,
  addCookReviewIngredientToPantry,
  applySavedRecipeCookReview,
  copyCheckedGroceryItemsToPantry,
  confirmKitchenReceiptLines,
  confirmKitchenExpirationDate,
  confirmKitchenFoodPhotoCandidates,
  createKitchenExpirationReview,
  createKitchenFoodPhotoReview,
  createKitchenReceiptImport,
  createNamedShoppingList,
  duplicateShoppingListEntry,
  addSavedRecipeToList,
  createSavedRecipe,
  getGroceryListBundle,
  getKitchenStats,
  getKitchenUseNextRecipePrompts,
  getPantry,
  getPantryBatchSections,
  getIngredientListAvailability,
  getCommunityRecipeSaveState,
  getKitchenReceiptReview,
  getSavedRecipeIngredientAvailability,
  getSavedRecipeDetails,
  getSavedRecipeCookReview,
  getSavedRecipes,
  removeGroceryListItem,
  removeSavedRecipeFromList,
  setSavedRecipeGroceryFlag,
  selectPantryNutritionSource,
  toggleRecipeFavorite,
  toggleGroceryItem,
  archiveShoppingList,
  restoreShoppingList,
  updateGroceryListItemText,
  updateSavedRecipe,
  updateShoppingListDetails,
  useNextPantryBatchEntry,
  saveCommunityRecipeToKitchen,
  removeCommunityRecipeFromKitchen,
  SAMPLE_EXPIRATION_OCR_TEXT,
  SAMPLE_GROCERY_PHOTO_JSON,
} from '../kitchen';

function localDateString(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('BestChef kitchen data helpers', () => {
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

  it('creates saved recipes with structured ingredients, steps, and grocery flags', () => {
    const recipeId = createSavedRecipe(db, {
      title: 'Weeknight Pasta',
      description: 'Fast pantry dinner',
      servings: 2,
      prepTimeMins: 5,
      cookTimeMins: 15,
      difficulty: 'easy',
      ingredientsText: '200 g spaghetti\n2 tbsp olive oil',
      stepsText: 'Boil water\nCook pasta for 10 minutes',
      groceryFlagged: true,
    });

    const details = getSavedRecipeDetails(db, recipeId);
    expect(details?.recipe.title).toBe('Weeknight Pasta');
    expect(details?.ingredients.map((item) => item.item)).toEqual(['spaghetti', 'olive oil']);
    expect(details?.steps[1].timer_minutes).toBe(10);
    expect(details?.groceryFlagged).toBe(true);
    expect(getSavedRecipes(db)).toHaveLength(1);
    expect(getKitchenStats(db).groceryFlaggedCount).toBe(1);
  });

  it('updates saved recipes in place without resyncing grocery list items', () => {
    const recipeId = createSavedRecipe(db, {
      title: 'Pad Thai',
      description: 'First draft',
      servings: 4,
      prepTimeMins: 15,
      cookTimeMins: 10,
      difficulty: 'medium',
      ingredientsText: '3 tbsp fish sauce\n200 g rice noodles',
      stepsText: 'Soak noodles\nToss sauce',
      groceryFlagged: true,
    });
    const initial = getSavedRecipeDetails(db, recipeId);
    if (!initial) throw new Error('Expected saved recipe details.');
    const list = createNamedShoppingList(db, 'Sunday shop');
    addSavedRecipeToList(db, recipeId, list.id);
    toggleRecipeFavorite(db, recipeId);

    expect(updateSavedRecipe(db, recipeId, {
      title: 'Pad Thai Night',
      description: 'Less salty',
      servings: 2,
      prepTimeMins: 20,
      cookTimeMins: 8,
      difficulty: 'easy',
      ingredientsText: '2 tbsp fish sauce\n200 g rice noodles\n1 lime',
      stepsText: 'Soak noodles\nToss sauce for 8 minutes\nServe hot',
      groceryFlagged: true,
    })).toBe(true);

    const updated = getSavedRecipeDetails(db, recipeId);
    if (!updated) throw new Error('Expected updated saved recipe details.');
    expect(updated.recipe.id).toBe(recipeId);
    expect(updated.recipe.created_at).toBe(initial.recipe.created_at);
    expect(updated.recipe.updated_at).not.toBe(initial.recipe.updated_at);
    expect(updated.recipe.is_favorite).toBe(1);
    expect(updated.groceryFlagged).toBe(true);
    expect(updated.recipe).toMatchObject({
      title: 'Pad Thai Night',
      description: 'Less salty',
      servings: 2,
      prep_time_mins: 20,
      cook_time_mins: 8,
      total_time_mins: 28,
      difficulty: 'easy',
    });
    expect(updated.ingredients.map((ingredient) => ingredient.name)).toEqual([
      '2 tbsp fish sauce',
      '200 g rice noodles',
      '1 lime',
    ]);
    expect(updated.steps.map((step) => step.instruction)).toEqual([
      'Soak noodles',
      'Toss sauce for 8 minutes',
      'Serve hot',
    ]);

    const listItems = getGroceryListBundle(db, list.id).items;
    expect(listItems).toHaveLength(2);
    expect(listItems.map((item) => item.item).sort()).toEqual(['fish sauce', 'rice noodles']);
    expect(listItems.every((item) => item.recipe_id === recipeId)).toBe(true);
  });

  it('adds saved recipe nutrition aggregation and ingredient detail models', () => {
    const pantryItem = addPantryEntry(db, {
      name: 'olive oil',
      storage_location: 'pantry',
      grocery_section: 'pantry',
    });
    createNutritionData(db, 'nut-oil-app', {
      pantry_item_id: pantryItem.id,
      source: 'manual',
      calories: 119,
      fat_g: 13.5,
      saturated_fat_g: 1.9,
      protein_g: 0,
      carbs_g: 0,
      confidence: 1,
    });
    const recipeId = createSavedRecipe(db, {
      title: 'Simple Dressing',
      servings: 2,
      ingredientsText: '1 tbsp olive oil\n1 tsp mystery vinegar',
      stepsText: 'Whisk for 1 minute',
    });

    const details = getSavedRecipeDetails(db, recipeId);

    expect(details?.nutritionDetail.surface).toBe('saved_recipe');
    expect(details?.nutritionDetail.coveragePercent).toBe(50);
    expect(details?.nutritionDetail.missingIngredients).toEqual(['mystery vinegar']);
    expect(details?.ingredientNutritionDetails).toHaveLength(2);
    expect(details?.ingredientNutritionDetails[0]?.surface).toBe('recipe_ingredient');
    expect(details?.ingredientNutritionDetails[0]?.source).toBe('manual');
    expect(details?.ingredientNutritionDetails[1]?.status).toBe('missing');
    expect(details?.nutritionSummary.sourceBreakdown[0]?.source).toBe('manual');
  });

  it('saves community recipes with source attribution and removes the local copy', () => {
    const saved = saveCommunityRecipeToKitchen(db, {
      submissionId: 'submission-pad-thai',
      title: 'Grandma Pad Thai',
      description: 'Street cart style',
      ingredients: ['200 g rice noodles', '2 tbsp fish sauce'],
      steps: ['Soak noodles for 30 minutes', 'Toss sauce in wok'],
      photoUrl: 'https://cdn.bestchef.app/pad-thai.jpg',
      chefId: 'chef-somchai',
      chefName: 'Somchai K.',
      chefHandle: '@somchai_bkk',
    });

    expect(saved.isSaved).toBe(true);
    expect(saved.recipeId).toBeTruthy();
    expect(saved.sourceSubmissionId).toBe('submission-pad-thai');
    const details = getSavedRecipeDetails(db, saved.recipeId ?? '');
    expect(details?.recipe).toMatchObject({
      title: 'Grandma Pad Thai',
      description: 'Street cart style',
      image_uri: 'https://cdn.bestchef.app/pad-thai.jpg',
      source_url: 'https://bestchef.app/recipe/submission-pad-thai',
      source_submission_id: 'submission-pad-thai',
      source_chef_id: 'chef-somchai',
      source_chef_name: 'Somchai K.',
      source_chef_handle: 'somchai_bkk',
    });
    expect(details?.ingredients.map((ingredient) => ingredient.item)).toEqual(['rice noodles', 'fish sauce']);
    expect(details?.steps.map((step) => step.instruction)).toEqual(['Soak noodles for 30 minutes', 'Toss sauce in wok']);

    const duplicate = saveCommunityRecipeToKitchen(db, {
      submissionId: 'submission-pad-thai',
      title: 'Duplicate ignored',
      ingredients: ['salt'],
      steps: ['Do nothing'],
      chefId: 'chef-somchai',
      chefName: 'Somchai K.',
      chefHandle: 'somchai_bkk',
    });
    expect(duplicate.recipeId).toBe(saved.recipeId);
    expect(getSavedRecipes(db).filter((recipe) => recipe.source_submission_id === 'submission-pad-thai')).toHaveLength(1);

    expect(removeCommunityRecipeFromKitchen(db, 'submission-pad-thai')).toBe(true);
    expect(getCommunityRecipeSaveState(db, 'submission-pad-thai').isSaved).toBe(false);
  });

  it('adds grocery-flagged recipes and checked items into pantry', () => {
    const recipeId = createSavedRecipe(db, {
      title: 'Soup',
      ingredientsText: '3 carrots\n1 onion',
      stepsText: 'Simmer for 20 minutes',
      groceryFlagged: false,
    });
    setSavedRecipeGroceryFlag(db, recipeId, true);
    const list = createNamedShoppingList(db, 'Market');

    expect(addGroceryFlaggedRecipesToList(db, list.id)).toBe(1);
    let bundle = getGroceryListBundle(db, list.id);
    expect(bundle.items.map((item) => item.item).sort()).toEqual(['carrots', 'onion']);

    addManualGroceryItem(db, list.id, '1 loaf bread');
    bundle = getGroceryListBundle(db, list.id);
    for (const item of bundle.items) {
      toggleGroceryItem(db, item.id);
    }

    expect(copyCheckedGroceryItemsToPantry(db, list.id)).toBe(3);
    expect(getPantry(db).map((item) => item.name).sort()).toEqual(['carrots', 'loaf bread', 'onion']);
  });

  it('adds saved recipes to grocery lists as grouped, replaceable recipe items', () => {
    const recipeId = createSavedRecipe(db, {
      title: 'Pad Thai',
      ingredientsText: '200 g rice noodles\nsalt and pepper, to taste',
      stepsText: 'Soak noodles\nToss sauce',
    });
    const list = createNamedShoppingList(db, 'Sunday shop');

    addSavedRecipeToList(db, recipeId, list.id);
    let bundle = getGroceryListBundle(db, list.id);

    expect(bundle.items).toHaveLength(2);
    expect(bundle.items.every((item) => item.recipe_id === recipeId)).toBe(true);
    expect(bundle.items.every((item) => item.recipe_title === 'Pad Thai')).toBe(true);
    expect(bundle.items.map((item) => item.item).sort()).toEqual(['rice noodles', 'salt and pepper, to taste']);
    expect(bundle.items.find((item) => item.item === 'rice noodles')).toMatchObject({
      quantity: 200,
      unit: 'g',
    });
    expect(bundle.items.find((item) => item.item === 'salt and pepper, to taste')).toMatchObject({
      quantity: null,
      unit: null,
    });

    const noodles = bundle.items.find((item) => item.item === 'rice noodles');
    expect(noodles).toBeDefined();
    if (!noodles) throw new Error('Expected noodles in grocery list.');
    updateGroceryListItemText(db, noodles.id, '250 g rice noodles');
    expect(getGroceryListBundle(db, list.id).items.find((item) => item.id === noodles.id)).toMatchObject({
      item: 'rice noodles',
      quantity: 250,
      unit: 'g',
    });

    addSavedRecipeToList(db, recipeId, list.id);
    bundle = getGroceryListBundle(db, list.id);
    expect(bundle.items).toHaveLength(2);

    removeSavedRecipeFromList(db, recipeId, list.id);
    expect(getGroceryListBundle(db, list.id).items).toHaveLength(0);
  });

  it('summarizes saved recipe pantry availability and shops only needed ingredients', () => {
    const expiredDate = localDateString(-1);
    const recipeId = createSavedRecipe(db, {
      title: 'Pantry Pad Thai',
      ingredientsText: '200 g rice noodles\n2 tbsp fish sauce\n1 lime\n3 tbsp tamarind paste',
      stepsText: 'Soak noodles\nToss with sauce',
    });
    addPantryEntry(db, {
      name: 'rice noodles',
      quantity: 400,
      unit: 'g',
      storage_location: 'pantry',
      grocery_section: 'pantry',
    });
    addPantryEntry(db, {
      name: 'fish sauce',
      quantity: 1,
      unit: 'tbsp',
      storage_location: 'pantry',
      grocery_section: 'pantry',
    });
    addPantryEntry(db, {
      name: 'lime',
      quantity: 3,
      unit: 'count',
      storage_location: 'fridge',
      grocery_section: 'produce',
      expiration_date: expiredDate,
    });

    const availability = getSavedRecipeIngredientAvailability(db, recipeId);

    expect(availability.onHandCount).toBe(1);
    expect(availability.totalCount).toBe(4);
    expect(Object.fromEntries(availability.rows.map((row) => [row.ingredientItem, row.status]))).toEqual({
      'rice noodles': 'in-pantry',
      'fish sauce': 'low',
      lime: 'expired',
      'tamarind paste': 'missing',
    });

    const list = createNamedShoppingList(db, 'Missing ingredients');
    expect(addIngredientAvailabilityRowsToGroceryList(db, list.id, availability.rows, recipeId)).toBe(3);
    const bundle = getGroceryListBundle(db, list.id);
    expect(bundle.items.map((item) => item.item)).toEqual(['fish sauce', 'lime', 'tamarind paste']);
    expect(bundle.items.every((item) => item.recipe_id === recipeId)).toBe(true);
    expect(bundle.items.find((item) => item.item === 'fish sauce')).toMatchObject({
      quantity: 2,
      unit: 'tbsp',
    });
  });

  it('falls back gracefully when ingredient availability has no pantry rows', () => {
    const availability = getIngredientListAvailability(db, {
      submissionId: 'community-recipe',
      title: 'Tomato Toast',
      ingredients: ['2 tomatoes', '1 loaf sourdough'],
    });

    expect(availability.onHandCount).toBe(0);
    expect(availability.shoppingNeededCount).toBe(2);
    expect(availability.rows.map((row) => row.status)).toEqual(['missing', 'missing']);
  });

  it('attaches nutrition detail models to grocery list items', () => {
    const list = createNamedShoppingList(db, 'Market');
    addManualGroceryItem(db, list.id, '2 apples');
    createNutritionData(db, 'nut-apples-app', {
      product_name: 'apples',
      source: 'usda_fdc',
      source_id: 'fdc-apples',
      calories: 52,
      fiber_g: 2.4,
      confidence: 0.86,
      serving_basis: 'per_100g',
      serving_quantity: 100,
      serving_unit: 'g',
    });

    const bundle = getGroceryListBundle(db, list.id);

    expect(bundle.items[0]?.nutritionDetail.surface).toBe('grocery_item');
    expect(bundle.items[0]?.nutritionDetail.source).toBe('usda_fdc');
    expect(bundle.items[0]?.nutritionDetail.sourceId).toBe('fdc-apples');
    expect(bundle.items[0]?.nutritionDetail.healthSummary.fiber_g).toBe(2.4);
  });

  it('removes grocery items through the list item action helper', () => {
    const list = createNamedShoppingList(db, 'Market');
    addManualGroceryItem(db, list.id, '2 apples');
    addManualGroceryItem(db, list.id, '1 loaf bread');

    const initialBundle = getGroceryListBundle(db, list.id);
    const itemToRemove = initialBundle.items.find((item) => item.item === 'apples');
    expect(initialBundle.summary?.totalItems).toBe(2);
    expect(itemToRemove).toBeDefined();

    if (!itemToRemove) throw new Error('Expected grocery item to remove.');
    removeGroceryListItem(db, itemToRemove.id);

    const bundle = getGroceryListBundle(db, list.id);
    expect(bundle.items.map((item) => item.item)).toEqual(['loaf bread']);
    expect(bundle.summary?.totalItems).toBe(1);
  });

  it('manages grocery list metadata, filters, duplicate, archive, and restore', () => {
    const weekly = createNamedShoppingList(db, 'Weekly', {
      store_name: 'Costco',
      event_name: 'Meal Prep',
      event_date: '2026-05-05',
    });
    addManualGroceryItem(db, weekly.id, '2 lb apples');

    updateShoppingListDetails(db, weekly.id, {
      name: 'Bulk Run',
      store_name: 'Costco',
      event_name: 'Team Dinner',
      event_date: '2026-05-08',
    });

    const copied = duplicateShoppingListEntry(db, weekly.id);
    expect(copied?.name).toBe('Bulk Run Copy');
    expect(copied?.store_name).toBe('Costco');
    expect(getGroceryListBundle(db, copied?.id, 'active').items).toHaveLength(1);

    archiveShoppingList(db, weekly.id);
    expect(getGroceryListBundle(db, undefined, 'active').lists.map((list) => list.id)).not.toContain(weekly.id);
    expect(getGroceryListBundle(db, weekly.id, 'archived').selectedList?.id).toBe(weekly.id);

    restoreShoppingList(db, weekly.id);
    const restoredBundle = getGroceryListBundle(db, weekly.id, 'active');
    expect(restoredBundle.selectedList).toMatchObject({
      id: weekly.id,
      name: 'Bulk Run',
      event_name: 'Team Dinner',
    });
  });

  it('tracks pantry additions in kitchen stats', () => {
    addPantryEntry(db, {
      name: 'Milk',
      quantity: 1,
      unit: 'gallon',
      storage_location: 'fridge',
      grocery_section: 'dairy',
    });

    expect(getKitchenStats(db).pantryCount).toBe(1);
  });

  it('previews cooked recipe pantry decrements, adds untracked ingredients, and records history', () => {
    const recipeId = createSavedRecipe(db, {
      title: 'Pancakes',
      servings: 2,
      ingredientsText: '1 cup milk\n1 egg',
      stepsText: 'Mix batter\nCook for 4 minutes',
    });
    const milk = addPantryEntry(db, {
      name: 'milk',
      quantity: 1000,
      unit: 'ml',
      storage_location: 'fridge',
      grocery_section: 'dairy',
    });

    let review = getSavedRecipeCookReview(db, recipeId);
    const milkReview = review?.items.find((item) => item.ingredientItem === 'milk');
    expect(milkReview).toMatchObject({
      pantryItemId: milk.id,
      suggestedDecrementUnit: 'ml',
      status: 'matched',
    });
    expect(review?.items.find((item) => item.ingredientItem === 'egg')?.status).toBe('not_tracked');

    addCookReviewIngredientToPantry(db, recipeId, review?.items.find((item) => item.ingredientItem === 'egg')?.ingredientId ?? '');
    review = getSavedRecipeCookReview(db, recipeId);
    expect(review?.items.find((item) => item.ingredientItem === 'egg')?.status).toBe('matched');

    const result = applySavedRecipeCookReview(db, {
      recipeId,
      cookedAt: '2026-04-27T19:00:00.000Z',
      servings: review?.servings,
      decrements: [{
        ingredientId: milkReview?.ingredientId ?? '',
        pantryItemId: milk.id,
        quantity: milkReview?.suggestedDecrementQuantity ?? 0,
        unit: milkReview?.suggestedDecrementUnit,
      }],
    });

    expect(result.historyEntry.cooked_at).toBe('2026-04-27T19:00:00.000Z');
    expect(getPantry(db).find((item) => item.id === milk.id)?.quantity).toBeCloseTo(763.412, 3);
    expect(getSavedRecipeDetails(db, recipeId)?.cookHistory).toHaveLength(1);
  });

  it('groups pantry batches by expiration status and uses the next lot first', () => {
    const soonDate = localDateString(1);
    const freshDate = localDateString(10);
    const item = addPantryEntry(db, {
      name: 'Yogurt',
      quantity: 2,
      unit: 'cup',
      storage_location: 'fridge',
      grocery_section: 'dairy',
      expiration_date: freshDate,
      lot_code: 'fresh',
    });
    createNutritionData(db, 'nut-yogurt-app', {
      pantry_item_id: item.id,
      source: 'manual',
      calories: 120,
      protein_g: 14,
      fat_g: 0,
      carbs_g: 10,
    });
    db.execute(
      `INSERT INTO rc_pantry_batches (
        id,
        pantry_item_id,
        lot_code,
        quantity,
        unit,
        expiration_date,
        source,
        photos_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['batch-soon', item.id, 'soon', 1, 'cup', soonDate, 'receipt_ocr', '["file://yogurt.jpg"]'],
    );

    const sections = getPantryBatchSections(db);
    expect(sections.map((section) => [section.status, section.rows.length])).toEqual([
      ['expired', 0],
      ['expiring_soon', 1],
      ['fresh', 1],
      ['no_date', 0],
    ]);
    expect(sections[1].rows[0]?.batch.lot_code).toBe('soon');
    expect(sections[1].rows[0]?.useNext).toBe(true);
    expect(sections[1].rows[0]?.nutritionDetail.surface).toBe('pantry_batch');
    expect(sections[1].rows[0]?.nutritionDetail.source).toBe('manual');
    expect(sections[1].rows[0]?.nutritionDetail.healthSummary.protein_g).toBe(14);

    useNextPantryBatchEntry(db, item.id, 1);
    expect(getPantry(db).find((entry) => entry.id === item.id)?.quantity).toBe(2);
  });

  it('exposes pantry nutrition source choices and switches the selected source', () => {
    const item = addPantryEntry(db, {
      name: 'Apple',
      quantity: 2,
      unit: 'count',
      storage_location: 'fridge',
      grocery_section: 'produce',
    });
    const off = createNutritionData(db, 'nut-apple-off-app', {
      pantry_item_id: item.id,
      source: 'open_food_facts',
      source_id: 'off-apple',
      calories: 80,
      protein_g: 0.2,
      confidence: 0.72,
    });
    const usda = createNutritionData(db, 'nut-apple-usda-app', {
      pantry_item_id: item.id,
      source: 'usda_fdc',
      source_id: 'fdc-apple',
      calories: 52,
      fat_g: 0.2,
      carbs_g: 14,
      protein_g: 0.3,
      sodium_mg: 1,
      confidence: 0.94,
    });
    db.execute(
      `UPDATE rc_pantry_items SET nutrition_data_id = ? WHERE id = ?`,
      [off.id, item.id],
    );

    let row = getPantryBatchSections(db).flatMap((section) => section.rows)[0];
    expect(row?.nutritionDetail.source).toBe('open_food_facts');
    expect(row?.nutritionSourceChoices.map((choice) => [choice.nutritionDataId, choice.isSelected])).toEqual([
      [off.id, true],
      [usda.id, false],
    ]);

    selectPantryNutritionSource(db, item.id, usda.id);
    row = getPantryBatchSections(db).flatMap((section) => section.rows)[0];
    expect(row?.nutritionDetail.source).toBe('usda_fdc');
    expect(row?.nutritionDetail.sourceId).toBe('fdc-apple');
    expect(row?.nutritionSourceChoices.map((choice) => [choice.nutritionDataId, choice.isSelected])).toEqual([
      [usda.id, true],
      [off.id, false],
    ]);
  });

  it('imports receipt OCR into review and only mutates pantry after confirmation', async () => {
    const review = await createKitchenReceiptImport(db, {
      photoUri: 'file://receipt.jpg',
      rawOcrText: `LOCAL MARKET
04/25/2026
ORGANIC MILK $5.99
VISA **** 4242 $5.99
TOTAL $5.99`,
    });

    expect(review.receipt.raw_ocr_text).toContain('4242');
    expect(review.receipt.redacted_ocr_text).not.toContain('4242');
    expect(review.lines).toHaveLength(1);
    expect(getPantry(db)).toHaveLength(0);

    const result = confirmKitchenReceiptLines(db, review.receipt.id, [
      { lineId: review.lines[0]!.id },
    ]);
    expect(result.confirmedLineIds).toEqual([review.lines[0]!.id]);
    expect(getPantry(db).map((item) => item.name)).toEqual(['organic milk']);

    const confirmedReview = getKitchenReceiptReview(db, review.receipt.id);
    expect(confirmedReview?.receipt.review_status).toBe('confirmed');
    expect(confirmedReview?.lines[0]?.match_status).toBe('confirmed');
  });

  it('keeps unconfirmed ambiguous receipt lines in review', async () => {
    const review = await createKitchenReceiptImport(db, {
      photoUri: 'file://receipt-2.jpg',
      rawOcrText: `LOCAL MARKET
04/25/2026
ORGANIC MILK $5.99
BANANAS $2.49
TOTAL $8.48`,
    });

    confirmKitchenReceiptLines(db, review.receipt.id, [
      { lineId: review.lines[0]!.id },
    ]);
    const nextReview = getKitchenReceiptReview(db, review.receipt.id);
    expect(nextReview?.receipt.review_status).toBe('needs_review');
    expect(nextReview?.lines[1]?.match_status).toBe('unmatched');
  });

  it('records OCR provider failures without pantry mutation', async () => {
    const review = await createKitchenReceiptImport(db, {
      photoUri: 'file://provider-failure.jpg',
      rawOcrText: '',
    });

    expect(review.receipt.provider_status).toBe('failed');
    expect(review.receipt.provider_error).toContain('No OCR provider configured');
    expect(review.lines).toEqual([]);
    expect(getPantry(db)).toHaveLength(0);
  });

  it('keeps receipt, grocery photo, and expiration reviews cancellation-safe before confirmation', async () => {
    const receiptReview = await createKitchenReceiptImport(db, {
      photoUri: 'file://cancelled-receipt.jpg',
      rawOcrText: `LOCAL MARKET
04/25/2026
ORGANIC MILK $5.99
TOTAL $5.99`,
    });
    const photoReview = await createKitchenFoodPhotoReview(db, {
      photoUri: 'file://cancelled-grocery.jpg',
      rawCandidateJson: SAMPLE_GROCERY_PHOTO_JSON,
    });
    const expirationReview = await createKitchenExpirationReview({
      photoUri: 'file://cancelled-expiration.jpg',
      rawOcrText: SAMPLE_EXPIRATION_OCR_TEXT,
    });

    expect(receiptReview.lines).toHaveLength(1);
    expect(photoReview.candidates).toHaveLength(2);
    expect(expirationReview.candidates[0]?.normalizedDate).toBe('2026-05-03');
    expect(getPantry(db)).toHaveLength(0);
  });

  it('keeps grocery photo provider outages review-only without pantry mutation', async () => {
    const provider: NutritionProviderAdapter = {
      source: 'usda_fdc',
      async search() {
        throw new Error('USDA provider unavailable');
      },
    };

    const review = await createKitchenFoodPhotoReview(db, {
      photoUri: 'file://provider-outage-grocery.jpg',
      rawCandidateJson: JSON.stringify({
        candidates: [{
          name: 'Spinach',
          category: 'produce',
          confidence: 0.82,
          quantity: 1,
          unit: 'bag',
        }],
      }),
      nutritionProviders: [provider],
      includeNetworkNutrition: true,
    });

    expect(review.candidates[0]?.nutrition_provider_statuses).toEqual([
      {
        source: 'usda_fdc',
        status: 'error',
        message: 'USDA provider unavailable',
      },
    ]);
    expect(getPantry(db)).toHaveLength(0);
  });

  it('reviews grocery photo candidates and confirms selected foods into pantry batches', async () => {
    const review = await createKitchenFoodPhotoReview(db, {
      photoUri: 'file://grocery.jpg',
      rawCandidateJson: SAMPLE_GROCERY_PHOTO_JSON,
    });

    expect(review.candidates.map((candidate) => candidate.name)).toEqual(['Organic Milk', 'Bananas']);
    expect(review.candidates[0]?.bounding_box).toEqual({ x: 0.06, y: 0.16, width: 0.42, height: 0.58 });
    expect(review.candidates[0]?.crop_uri).toBe('file://grocery-milk-crop.jpg');
    expect(review.candidates[0]?.nutrition_candidates.at(-1)?.source).toBe('unknown');
    const result = confirmKitchenFoodPhotoCandidates(db, review.candidates.map((candidate) => ({
      candidateId: candidate.id,
      name: candidate.name,
      grocerySection: candidate.grocery_section,
      storageLocation: candidate.storage_location,
      quantity: candidate.quantity,
      unit: candidate.unit,
      photoUri: review.photoUri,
      cropUri: candidate.crop_uri,
      labels: candidate.labels,
      confidence: candidate.confidence,
    })));

    expect(result).toHaveLength(2);
    expect(getPantry(db).map((item) => item.name).sort()).toEqual(['Bananas', 'Organic Milk']);
    expect(getPantry(db).find((item) => item.name === 'Organic Milk')?.batches?.[0]?.source).toBe('food_recognition');
    expect(getPantry(db).find((item) => item.name === 'Organic Milk')?.batches?.[0]?.photos).toEqual([
      'file://grocery-milk-crop.jpg',
      'file://grocery.jpg',
    ]);
  });

  it('reviews grocery photo nutrition choices and stores only the selected source', async () => {
    const provider: NutritionProviderAdapter = {
      source: 'usda_fdc',
      async search(input) {
        return {
          candidates: [
            {
              source: 'usda_fdc',
              source_id: '173944',
              source_url: 'https://fdc.nal.usda.gov/food-details/173944/nutrients',
              barcode: input.barcode,
              product_name: 'Bananas, raw',
              brand: null,
              serving_size_text: '100 g',
              serving_basis: 'per_100g',
              serving_quantity: 100,
              serving_unit: 'g',
              nutrients: {
                calories: 89,
                fat_g: null,
                saturated_fat_g: null,
                carbs_g: 22.8,
                fiber_g: null,
                sugar_g: null,
                protein_g: 1.1,
                sodium_mg: null,
              },
              confidence: 0.86,
              fetched_at: '2026-04-25T15:00:00.000Z',
            },
          ],
          status: { source: 'usda_fdc', status: 'ok', message: 'stubbed' },
        };
      },
    };
    const review = await createKitchenFoodPhotoReview(db, {
      photoUri: 'file://banana.jpg',
      rawCandidateJson: JSON.stringify({
        candidates: [{
          name: 'Bananas',
          category: 'produce',
          confidence: 0.84,
          labels: ['banana bunch', '0000000004011'],
          quantity: 6,
          unit: 'count',
        }],
      }),
      nutritionProviders: [provider],
      includeNetworkNutrition: true,
    });
    const source = review.candidates[0]?.nutrition_candidates[0];

    expect(source?.source).toBe('usda_fdc');
    const result = confirmKitchenFoodPhotoCandidates(db, [{
      candidateId: review.candidates[0]!.id,
      name: review.candidates[0]!.name,
      barcode: review.candidates[0]!.barcode,
      grocerySection: review.candidates[0]!.grocery_section,
      storageLocation: review.candidates[0]!.storage_location,
      quantity: review.candidates[0]!.quantity,
      unit: review.candidates[0]!.unit,
      photoUri: review.photoUri,
      labels: review.candidates[0]!.labels,
      confidence: review.candidates[0]!.confidence,
      selectedNutritionCandidateId: source!.id,
      nutritionCandidate: source,
    }])[0]!;
    const stored = db.query<{ source: string; source_id: string; calories: number; fat_g: number | null }>(
      `SELECT source, source_id, calories, fat_g FROM rc_nutrition_data WHERE id = ?`,
      [result.nutritionDataId],
    )[0];

    expect(stored).toEqual({
      source: 'usda_fdc',
      source_id: '173944',
      calories: 89,
      fat_g: null,
    });
  });

  it('reviews expiration photo OCR and confirms a dated pantry batch', async () => {
    const item = addPantryEntry(db, {
      name: 'Eggs',
      quantity: 12,
      unit: 'count',
      storage_location: 'fridge',
      grocery_section: 'dairy',
    });
    const review = await createKitchenExpirationReview({
      photoUri: 'file://eggs-exp.jpg',
      rawOcrText: SAMPLE_EXPIRATION_OCR_TEXT,
      cropUri: 'file://eggs-exp-crop.jpg',
      boundingBox: { x: 0.1, y: 0.2, width: 0.5, height: 0.18 },
    });

    expect(review.candidates[0]?.normalizedDate).toBe('2026-05-03');
    expect(review.providerStatus).toBe('manual');
    expect(review.requiresManualSelection).toBe(true);
    expect(review.candidates[0]).toMatchObject({
      crop_uri: 'file://eggs-exp-crop.jpg',
      bounding_box: { x: 0.1, y: 0.2, width: 0.5, height: 0.18 },
    });
    const confirmed = confirmKitchenExpirationDate(db, {
      pantryItemId: item.id,
      expirationDate: review.candidates[0]!.normalizedDate,
      photoUri: review.photoUri,
      cropUri: review.candidates[0]!.crop_uri,
      rawText: review.rawText,
      confidence: review.candidates[0]!.confidence,
      lotCode: 'L-47',
    });

    expect(confirmed.createdItem).toBe(false);
    expect(getPantry(db).find((entry) => entry.id === item.id)?.expiration_date).toBe('2026-05-03');
    expect(getPantry(db).find((entry) => entry.id === item.id)?.batches?.[0]?.photos).toEqual([
      'file://eggs-exp-crop.jpg',
      'file://eggs-exp.jpg',
    ]);
  });

  it('keeps unsupported expiration OCR providers non-mutating', async () => {
    const review = await createKitchenExpirationReview({
      photoUri: 'file://cloud-expiration.jpg',
      rawOcrText: 'EXP 05/03/2026',
      ocrProvider: 'managed_cloud',
    });

    expect(review).toMatchObject({
      ocrProvider: 'managed_cloud',
      providerStatus: 'unavailable',
      candidates: [],
      requiresManualSelection: true,
    });
    expect(review.providerMessage).toContain('No pantry data changed');
    expect(getPantry(db)).toEqual([]);
  });

  it('requires manual date selection for ambiguous expiration OCR candidates', async () => {
    const review = await createKitchenExpirationReview({
      photoUri: 'file://ambiguous-expiration.jpg',
      rawOcrText: 'USE BY 03/04/26',
    });

    expect(review.requiresManualSelection).toBe(true);
    expect(review.candidates.map((candidate) => candidate.normalizedDate)).toEqual(
      expect.arrayContaining(['2026-03-04', '2026-04-03']),
    );
    expect(review.candidates.every((candidate) => candidate.reason.includes('Ambiguous'))).toBe(true);
  });

  it('surfaces use-next recipe prompts from expiring pantry batches', () => {
    createSavedRecipe(db, {
      title: 'Banana Milk Smoothie',
      ingredientsText: '1 banana\n1 cup milk',
      stepsText: 'Blend for 1 minute',
    });
    addPantryEntry(db, {
      name: 'Bananas',
      quantity: 6,
      unit: 'count',
      storage_location: 'counter',
      grocery_section: 'produce',
      expiration_date: localDateString(1),
    });

    const prompts = getKitchenUseNextRecipePrompts(db, 3);

    expect(prompts[0]?.recipe.title).toBe('Banana Milk Smoothie');
    expect(prompts[0]?.promptStatus).toBe('needs_more');
    expect(prompts[0]?.readyToCook).toBe(false);
    expect(prompts[0]?.useNextBatches[0]?.pantryItemName).toBe('Bananas');
    expect(prompts[0]?.useNextBatches[0]?.quantitySufficient).toBe(true);
  });
});
