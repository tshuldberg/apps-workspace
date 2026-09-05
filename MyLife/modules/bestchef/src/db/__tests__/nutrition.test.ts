import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '../../definition';
import {
  confirmFoodRecord,
  createFoodProduct,
  createFoodProductAlias,
  createManualNutritionOverride,
  createNutritionData,
  getFoodConfirmations,
  getFoodProductAliases,
  getFoodProductByBarcode,
  getFoodProductById,
  getNutritionById,
  getNutritionCandidatesForProduct,
  getNutritionDetailForGroceryItem,
  getNutritionDetailForNutritionData,
  getNutritionDetailForPantryBatch,
  getNutritionDetailForPantryItem,
  getNutritionForItem,
  getNutritionSourceChoicesForPantryItem,
  getNutritionByBarcode,
  getNutritionMissingFields,
  getNutritionSourceDisplayData,
  nutritionFactsWithAddedSugar,
  resolveNutritionCandidates,
  selectNutritionSourceForPantryItem,
  updateNutritionData,
  deleteNutritionData,
} from '../nutrition';
import {
  createUnitConversionCorrection,
  getUnitConversionCorrections,
  upsertUnitConversionCorrection,
} from '../unit-conversions';
import { createPantryItem } from '../pantry';
import { addCustomItem, createShoppingList } from '../shopping-lists';
import {
  createGs1DataHubIdentityAdapter,
  createUsdaFoodDataCentralAdapter,
} from '../../pantry/open-food-facts';
import type { NutritionProviderAdapter } from '../../types';

describe('nutrition', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('recipes', RECIPES_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('creates canonical food identity, confirmation, and conversion correction tables', () => {
    const rows = adapter.query<{ name: string }>(
      `SELECT name FROM sqlite_master
       WHERE type = 'table'
       AND name IN (
         'rc_food_products',
         'rc_food_product_aliases',
         'rc_food_confirmations',
         'rc_unit_conversion_corrections'
       )
       ORDER BY name`,
    );

    expect(rows.map((row) => row.name)).toEqual([
      'rc_food_confirmations',
      'rc_food_product_aliases',
      'rc_food_products',
      'rc_unit_conversion_corrections',
    ]);
    expect(RECIPES_MODULE.schemaVersion).toBe(34);
  });

  it('persists reusable unit conversion corrections with normalized units', () => {
    const created = createUnitConversionCorrection(adapter, 'corr-cilantro', {
      ingredientName: 'Chopped Cilantro',
      fromUnit: 'cups',
      toUnit: 'grams',
      factor: 16,
      confidence: 0.92,
      note: 'User-corrected chopped herb cup weight',
      source: 'recipe_review',
    });

    expect(created).toMatchObject({
      id: 'corr-cilantro',
      ingredientName: 'Chopped Cilantro',
      normalizedIngredientName: 'chopped cilantro',
      fromUnit: 'cup',
      toUnit: 'g',
      factor: 16,
      confidence: 0.92,
      note: 'User-corrected chopped herb cup weight',
      source: 'recipe_review',
      isUserConfirmed: true,
    });

    const updated = upsertUnitConversionCorrection(adapter, 'corr-new', {
      ingredientName: 'chopped cilantro',
      fromUnit: 'cup',
      toUnit: 'g',
      factor: 18,
      confidence: 0.88,
      note: 'Updated correction',
    });

    expect(updated.id).toBe('corr-cilantro');
    expect(updated.factor).toBe(18);
    expect(getUnitConversionCorrections(adapter, 'fresh chopped cilantro')).toHaveLength(1);
  });

  describe('food product identity', () => {
    it('creates canonical products with multiple barcode and name aliases', () => {
      const product = createFoodProduct(adapter, 'prod-milk', {
        canonical_name: 'Whole Milk',
        brand: 'Organic Valley',
        product_type: 'branded',
        grocery_section: 'dairy',
        default_storage_location: 'fridge',
        source: 'open_food_facts',
        source_id: '049000042566',
        confidence: 0.92,
      });

      createFoodProductAlias(adapter, 'alias-barcode', {
        product_id: product.id,
        alias_type: 'barcode',
        alias_value: '049000042566',
        source: 'open_food_facts',
        source_id: '049000042566',
        confidence: 0.95,
      });
      createFoodProductAlias(adapter, 'alias-name', {
        product_id: product.id,
        alias_type: 'name',
        alias_value: 'Organic Valley whole milk',
        confidence: 0.8,
      });

      expect(getFoodProductByBarcode(adapter, '049000042566')?.id).toBe(product.id);
      expect(getFoodProductAliases(adapter, product.id).map((alias) => alias.alias_type)).toEqual([
        'barcode',
        'name',
      ]);
    });

    it('records user confirmation separately from source confidence', () => {
      createFoodProduct(adapter, 'prod-rice', {
        canonical_name: 'Jasmine Rice',
        source: 'receipt_ocr',
        confidence: 0.66,
      });

      const confirmation = confirmFoodRecord(
        adapter,
        'confirm-prod-rice',
        'food_product',
        'prod-rice',
        'confirmed',
      );

      expect(confirmation.decision).toBe('confirmed');
      expect(getFoodProductById(adapter, 'prod-rice')?.is_user_confirmed).toBe(1);
      expect(getFoodConfirmations(adapter, 'food_product', 'prod-rice')).toHaveLength(1);
    });
  });

  describe('createNutritionData', () => {
    it('creates nutrition data with all fields', () => {
      const product = createFoodProduct(adapter, 'prod-milk', {
        canonical_name: 'Whole Milk',
        brand: 'Organic Valley',
        product_type: 'branded',
        grocery_section: 'dairy',
      });
      const item = createPantryItem(adapter, {
        name: 'Milk',
        storage_location: 'fridge',
        product_id: product.id,
      });

      const nutrition = createNutritionData(adapter, 'nut-1', {
        pantry_item_id: item.id,
        product_id: product.id,
        barcode: '049000042566',
        product_name: 'Whole Milk',
        brand: 'Organic Valley',
        serving_size_text: '1 cup (240ml)',
        calories: 150,
        fat_g: 8,
        saturated_fat_g: 5,
        carbs_g: 12,
        fiber_g: 0,
        sugar_g: 12,
        protein_g: 8,
        sodium_mg: 120,
        source: 'open_food_facts',
        source_id: '049000042566',
        source_url: 'https://world.openfoodfacts.org/product/049000042566',
        confidence: 0.9,
        serving_basis: 'per_100g',
        serving_quantity: 100,
        serving_unit: 'g',
        fetched_at: '2026-04-25T12:00:00.000Z',
      });

      expect(nutrition.id).toBe('nut-1');
      expect(nutrition.pantry_item_id).toBe(item.id);
      expect(nutrition.product_id).toBe(product.id);
      expect(nutrition.barcode).toBe('049000042566');
      expect(nutrition.product_name).toBe('Whole Milk');
      expect(nutrition.brand).toBe('Organic Valley');
      expect(nutrition.serving_size_text).toBe('1 cup (240ml)');
      expect(nutrition.calories).toBe(150);
      expect(nutrition.fat_g).toBe(8);
      expect(nutrition.saturated_fat_g).toBe(5);
      expect(nutrition.carbs_g).toBe(12);
      expect(nutrition.fiber_g).toBe(0);
      expect(nutrition.sugar_g).toBe(12);
      expect(nutrition.protein_g).toBe(8);
      expect(nutrition.sodium_mg).toBe(120);
      expect(nutrition.source).toBe('open_food_facts');
      expect(nutrition.source_id).toBe('049000042566');
      expect(nutrition.source_url).toContain('openfoodfacts');
      expect(nutrition.confidence).toBe(0.9);
      expect(nutrition.serving_basis).toBe('per_100g');
      expect(nutrition.serving_quantity).toBe(100);
      expect(nutrition.serving_unit).toBe('g');
      expect(nutrition.is_user_confirmed).toBe(0);
      expect(nutrition.fetched_at).toBe('2026-04-25T12:00:00.000Z');
    });

    it('defaults optional fields to null', () => {
      const nutrition = createNutritionData(adapter, 'nut-1', { source: 'manual' });

      expect(nutrition.pantry_item_id).toBeNull();
      expect(nutrition.product_id).toBeNull();
      expect(nutrition.barcode).toBeNull();
      expect(nutrition.product_name).toBeNull();
      expect(nutrition.brand).toBeNull();
      expect(nutrition.calories).toBeNull();
      expect(nutrition.protein_g).toBeNull();
      expect(nutrition.source_id).toBeNull();
      expect(nutrition.source_url).toBeNull();
      expect(nutrition.confidence).toBeNull();
      expect(nutrition.serving_basis).toBe('per_serving');
      expect(nutrition.is_user_confirmed).toBe(1);
    });
  });

  describe('getNutritionForItem', () => {
    it('returns nutrition for a pantry item', () => {
      const item = createPantryItem(adapter, { name: 'Eggs', storage_location: 'fridge' });
      createNutritionData(adapter, 'nut-1', {
        pantry_item_id: item.id,
        source: 'manual',
        calories: 70,
        protein_g: 6,
      });

      const result = getNutritionForItem(adapter, item.id);
      expect(result).not.toBeNull();
      expect(result!.calories).toBe(70);
      expect(result!.protein_g).toBe(6);
    });

    it('returns null when no nutrition data exists', () => {
      const item = createPantryItem(adapter, { name: 'Water', storage_location: 'fridge' });

      const result = getNutritionForItem(adapter, item.id);
      expect(result).toBeNull();
    });
  });

  describe('pantry nutrition source choices', () => {
    it('lists linked source choices and switches the selected pantry source', () => {
      const product = createFoodProduct(adapter, 'prod-apple', {
        canonical_name: 'Apple',
        grocery_section: 'produce',
      });
      const item = createPantryItem(adapter, {
        name: 'Apple',
        storage_location: 'fridge',
        product_id: product.id,
      });
      const off = createNutritionData(adapter, 'nut-apple-off', {
        product_id: product.id,
        source: 'open_food_facts',
        source_id: 'off-apple',
        product_name: 'Apple',
        calories: 80,
        protein_g: 0.2,
        confidence: 0.72,
        fetched_at: '2026-04-25T10:00:00.000Z',
      });
      const usda = createNutritionData(adapter, 'nut-apple-usda', {
        product_id: product.id,
        source: 'usda_fdc',
        source_id: 'fdc-apple',
        product_name: 'Apples, raw',
        serving_size_text: '100 g',
        calories: 52,
        fat_g: 0.2,
        carbs_g: 14,
        fiber_g: 2.4,
        sugar_g: 10.4,
        protein_g: 0.3,
        sodium_mg: 1,
        confidence: 0.94,
        serving_basis: 'per_100g',
        serving_quantity: 100,
        serving_unit: 'g',
        fetched_at: '2026-04-25T09:00:00.000Z',
      });
      adapter.execute(
        `UPDATE rc_pantry_items SET nutrition_data_id = ? WHERE id = ?`,
        [off.id, item.id],
      );

      const initialChoices = getNutritionSourceChoicesForPantryItem(adapter, item.id);
      expect(initialChoices.map((choice) => choice.nutritionDataId)).toEqual([
        off.id,
        usda.id,
      ]);
      expect(initialChoices[0]).toMatchObject({
        nutritionDataId: off.id,
        isSelected: true,
        source: 'open_food_facts',
      });

      const selected = selectNutritionSourceForPantryItem(
        adapter,
        item.id,
        usda.id,
        'confirm-apple-usda',
      );

      expect(selected).toMatchObject({
        nutritionDataId: usda.id,
        isSelected: true,
        source: 'usda_fdc',
        calories: 52,
      });
      expect(getNutritionDetailForPantryItem(adapter, item.id)).toMatchObject({
        source: 'usda_fdc',
        sourceId: 'fdc-apple',
      });
      expect(getNutritionById(adapter, off.id)?.calories).toBe(80);
      expect(getFoodConfirmations(adapter, 'nutrition_data', usda.id)[0]).toMatchObject({
        decision: 'confirmed',
        notes: `Selected nutrition source for pantry item ${item.id}.`,
      });
    });

    it('rejects source choices that are not linked to the pantry item', () => {
      const item = createPantryItem(adapter, { name: 'Rice', storage_location: 'pantry' });
      createNutritionData(adapter, 'nut-unrelated', {
        product_name: 'Orange juice',
        source: 'manual',
        calories: 110,
      });

      expect(() => selectNutritionSourceForPantryItem(
        adapter,
        item.id,
        'nut-unrelated',
        'confirm-unrelated',
      )).toThrow(/not linked to pantry item/);
      expect(getNutritionForItem(adapter, item.id)).toBeNull();
    });
  });

  describe('nutrition detail models', () => {
    it('preserves missing fields and source metadata for pantry item details', () => {
      const item = createPantryItem(adapter, {
        name: 'Milk',
        storage_location: 'fridge',
        grocery_section: 'dairy',
      });
      const nutrition = createNutritionData(adapter, 'nut-detail-milk', {
        pantry_item_id: item.id,
        product_name: 'Milk',
        serving_size_text: '100 g',
        calories: 60,
        protein_g: 3.2,
        sodium_mg: null,
        source: 'open_food_facts',
        source_id: '049000042566',
        source_url: 'https://world.openfoodfacts.org/product/049000042566',
        confidence: 0.78,
        serving_basis: 'per_100g',
        serving_quantity: 100,
        serving_unit: 'g',
        fetched_at: '2026-04-25T12:00:00.000Z',
      });

      const detail = getNutritionDetailForPantryItem(adapter, item.id);
      const byId = getNutritionDetailForNutritionData(adapter, nutrition.id, {
        surface: 'pantry_item',
        subjectId: item.id,
        title: item.name,
      });

      expect(detail).toMatchObject({
        surface: 'pantry_item',
        subjectId: item.id,
        title: 'Milk',
        status: 'partial',
        source: 'open_food_facts',
        sourceId: '049000042566',
        sourceUrl: 'https://world.openfoodfacts.org/product/049000042566',
        servingBasis: 'per_100g',
        servingQuantity: 100,
        servingUnit: 'g',
        fetchedAt: '2026-04-25T12:00:00.000Z',
        confirmedAt: null,
        isUserConfirmed: false,
      });
      expect(detail.nutrients.calories).toBe(60);
      expect(detail.nutrients.sodium_mg).toBeNull();
      expect(detail.healthSummary.sodium_mg).toBeNull();
      expect(detail.healthSummary.hasMedicalClaim).toBe(false);
      expect(detail.missingFields.map((field) => field.key)).toEqual(expect.arrayContaining([
        'fat_g',
        'added_sugar_g',
        'sodium_mg',
      ]));
      expect(byId?.sourceDisplay?.label).toBe('Open Food Facts');
    });

    it('returns pantry batch details with batch provenance', () => {
      const item = createPantryItem(adapter, {
        name: 'Yogurt',
        quantity: 2,
        unit: 'cup',
        storage_location: 'fridge',
        lot_code: 'Y-7',
        expiration_date: '2026-05-03',
      });
      createNutritionData(adapter, 'nut-yogurt-detail', {
        pantry_item_id: item.id,
        source: 'manual',
        calories: 110,
        protein_g: 12,
        fat_g: 0,
        carbs_g: 8,
      });
      const batchId = adapter.query<{ id: string }>(
        `SELECT id FROM rc_pantry_batches WHERE pantry_item_id = ? LIMIT 1`,
        [item.id],
      )[0]!.id;

      const detail = getNutritionDetailForPantryBatch(adapter, batchId);

      expect(detail.surface).toBe('pantry_batch');
      expect(detail.subjectId).toBe(batchId);
      expect(detail.subtitle).toContain('Lot Y-7');
      expect(detail.subtitle).toContain('Expires 2026-05-03');
      expect(detail.nutrients.calories).toBe(110);
    });

    it('builds grocery item details from best matching nutrition and keeps missing values null', () => {
      createShoppingList(adapter, 'list-nutrition', 'Market');
      addCustomItem(adapter, 'item-apples', 'list-nutrition', '2 apples');
      createNutritionData(adapter, 'nut-apples', {
        product_name: 'apples',
        source: 'usda_fdc',
        source_id: 'fdc-apples',
        calories: 52,
        fiber_g: 2.4,
        sugar_g: null,
        confidence: 0.86,
        serving_basis: 'per_100g',
        serving_quantity: 100,
        serving_unit: 'g',
      });

      const detail = getNutritionDetailForGroceryItem(adapter, 'item-apples');

      expect(detail).toMatchObject({
        surface: 'grocery_item',
        subjectId: 'item-apples',
        title: 'apples',
        source: 'usda_fdc',
        sourceId: 'fdc-apples',
      });
      expect(detail.nutrients.sugar_g).toBeNull();
      expect(detail.missingFields.map((field) => field.key)).toContain('sugar_g');
      expect(detail.healthSummary.fiber_g).toBe(2.4);
    });

    it('creates explicit missing detail objects without converting unknowns to zero', () => {
      const nutrients = nutritionFactsWithAddedSugar({ calories: 0, protein_g: null });
      const missingFields = getNutritionMissingFields(nutrients);

      expect(nutrients.calories).toBe(0);
      expect(nutrients.protein_g).toBeNull();
      expect(missingFields.map((field) => field.key)).toEqual(expect.arrayContaining([
        'protein_g',
        'added_sugar_g',
      ]));
      expect(missingFields.map((field) => field.key)).not.toContain('calories');
    });
  });

  describe('getNutritionByBarcode', () => {
    it('returns cached nutrition by direct barcode', () => {
      createNutritionData(adapter, 'nut-1', {
        barcode: '049000042566',
        product_name: 'Whole Milk',
        source: 'open_food_facts',
        calories: 150,
      });

      const result = getNutritionByBarcode(adapter, '049000042566');
      expect(result).not.toBeNull();
      expect(result!.product_name).toBe('Whole Milk');
      expect(result!.calories).toBe(150);
    });

    it('returns product-linked nutrition through a barcode alias', () => {
      const product = createFoodProduct(adapter, 'prod-yogurt', {
        canonical_name: 'Greek Yogurt',
        brand: 'Fage',
      });
      createFoodProductAlias(adapter, 'alias-yogurt', {
        product_id: product.id,
        alias_type: 'barcode',
        alias_value: '689544081276',
      });
      createNutritionData(adapter, 'nut-yogurt', {
        product_id: product.id,
        source: 'usda_fdc',
        source_id: 'fdc-123',
        product_name: 'Greek Yogurt',
        protein_g: 18,
        confidence: 0.85,
      });

      const result = getNutritionByBarcode(adapter, '689544081276');
      expect(result?.id).toBe('nut-yogurt');
      expect(result?.source_id).toBe('fdc-123');
    });

    it('returns null when barcode not found', () => {
      const result = getNutritionByBarcode(adapter, 'nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getNutritionCandidatesForProduct', () => {
    it('ranks confirmed and higher-confidence nutrition candidates first', () => {
      createFoodProduct(adapter, 'prod-cereal', {
        canonical_name: 'Cereal',
      });
      createNutritionData(adapter, 'nut-off', {
        product_id: 'prod-cereal',
        source: 'open_food_facts',
        source_id: 'off-1',
        calories: 110,
        confidence: 0.8,
        fetched_at: '2026-04-25T10:00:00.000Z',
      });
      createNutritionData(adapter, 'nut-usda', {
        product_id: 'prod-cereal',
        source: 'usda_fdc',
        source_id: 'fdc-1',
        calories: 115,
        confidence: 0.95,
        fetched_at: '2026-04-25T09:00:00.000Z',
      });
      createNutritionData(adapter, 'nut-manual', {
        product_id: 'prod-cereal',
        source: 'manual',
        calories: 120,
        confidence: 1,
      });

      expect(getNutritionCandidatesForProduct(adapter, 'prod-cereal').map((row) => row.id)).toEqual([
        'nut-manual',
        'nut-usda',
        'nut-off',
      ]);
    });
  });

  describe('resolveNutritionCandidates', () => {
    it('returns local cache candidates before provider candidates', async () => {
      createFoodProduct(adapter, 'prod-milk', {
        canonical_name: 'Whole Milk',
        brand: 'Local Dairy',
      });
      createNutritionData(adapter, 'nut-local', {
        product_id: 'prod-milk',
        barcode: '123456789012',
        source: 'manual',
        product_name: 'Whole Milk',
        brand: 'Local Dairy',
        calories: 150,
        protein_g: 8,
        carbs_g: 12,
        fat_g: 8,
        confidence: 1,
      });

      const provider: NutritionProviderAdapter = {
        source: 'open_food_facts',
        async search() {
          return {
            candidates: [
              {
                source: 'open_food_facts',
                source_id: '123456789012',
                barcode: '123456789012',
                product_name: 'Whole Milk',
                brand: 'Provider Dairy',
                serving_basis: 'per_100g',
                serving_quantity: 100,
                serving_unit: 'g',
                nutrients: {
                  calories: 62,
                  fat_g: 3.3,
                  saturated_fat_g: null,
                  carbs_g: 4.8,
                  fiber_g: null,
                  sugar_g: null,
                  protein_g: 3.2,
                  sodium_mg: null,
                },
                confidence: 0.95,
              },
            ],
            status: {
              source: 'open_food_facts',
              status: 'ok',
              message: 'stubbed',
            },
          };
        },
      };

      const result = await resolveNutritionCandidates(
        adapter,
        { barcode: '123456789012', includeNetwork: true },
        [provider],
      );

      expect(result.candidates).toHaveLength(2);
      expect(result.candidates[0]?.origin).toBe('local_cache');
      expect(result.candidates[0]?.nutrition_data_id).toBe('nut-local');
      expect(result.candidates[0]?.display.confidenceLabel).toBe('High');
      expect(result.candidates[1]?.origin).toBe('provider');
      expect(result.providerStatuses[0]?.status).toBe('ok');
    });

    it('normalizes low-confidence manual candidates without auto-selecting them', async () => {
      const result = await resolveNutritionCandidates(adapter, {
        query: 'mystery sauce',
        manualCandidates: [
          {
            source: 'manual',
            source_id: null,
            product_name: 'Mystery Sauce',
            serving_basis: 'per_serving',
            serving_quantity: 1,
            serving_unit: 'serving',
            nutrients: {
              calories: 80,
              fat_g: null,
              saturated_fat_g: null,
              carbs_g: null,
              fiber_g: null,
              sugar_g: null,
              protein_g: null,
              sodium_mg: null,
            },
            confidence: 0.42,
          },
        ],
      });

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0]?.completeness).toBe('partial');
      expect(result.candidates[0]?.auto_selectable).toBe(false);
      expect(result.candidates[0]?.display.confidenceLabel).toBe('Low');
      expect(result.candidates[0]?.quality_flags).toContain('Missing protein_g');
    });

    it('returns product-only local cache candidates without inventing nutrition facts', async () => {
      const product = createFoodProduct(adapter, 'prod-photo-milk', {
        canonical_name: 'Organic Milk',
        brand: 'Local Dairy',
        grocery_section: 'dairy',
        default_storage_location: 'fridge',
        confidence: 0.88,
        is_user_confirmed: 1,
        confirmed_at: '2026-04-25T12:00:00.000Z',
      });
      createFoodProductAlias(adapter, 'alias-photo-milk', {
        product_id: product.id,
        alias_type: 'ocr_label',
        alias_value: 'organic milk',
        confidence: 0.86,
        is_user_confirmed: 1,
        confirmed_at: '2026-04-25T12:00:00.000Z',
      });

      const result = await resolveNutritionCandidates(adapter, {
        query: 'organic milk',
        includeNetwork: false,
      });

      expect(result.candidates[0]).toMatchObject({
        origin: 'local_cache',
        source: 'local_cache',
        product_id: product.id,
        nutrition_data_id: null,
        completeness: 'incomplete',
        auto_selectable: false,
      });
      expect(result.candidates[0]?.nutrients.calories).toBeNull();
      expect(result.candidates[0]?.quality_flags).toContain('Product identity match has no stored nutrition facts');
    });

    it('keeps USDA, Open Food Facts, GS1, local, and manual nutrition conflicts deterministic', async () => {
      createFoodProduct(adapter, 'prod-yogurt-conflict', {
        canonical_name: 'Greek Yogurt',
        brand: 'Fixture Dairy',
        product_type: 'branded',
        grocery_section: 'dairy',
        source: 'open_food_facts',
        source_id: '000111222333',
        confidence: 0.88,
        is_user_confirmed: 1,
        confirmed_at: '2026-04-25T12:00:00.000Z',
      });
      createFoodProductAlias(adapter, 'alias-yogurt-conflict-barcode', {
        product_id: 'prod-yogurt-conflict',
        alias_type: 'barcode',
        alias_value: '000111222333',
        source: 'open_food_facts',
        source_id: '000111222333',
        confidence: 0.9,
        is_user_confirmed: 1,
        confirmed_at: '2026-04-25T12:00:00.000Z',
      });
      createNutritionData(adapter, 'nut-yogurt-local', {
        product_id: 'prod-yogurt-conflict',
        barcode: '000111222333',
        source: 'manual',
        source_id: 'local-confirmed',
        product_name: 'Greek Yogurt',
        brand: 'Fixture Dairy',
        serving_basis: 'per_serving',
        serving_quantity: 1,
        serving_unit: 'cup',
        calories: 120,
        protein_g: 17,
        carbs_g: 8,
        fat_g: 0,
        confidence: 0.96,
        is_user_confirmed: 1,
        confirmed_at: '2026-04-25T12:00:00.000Z',
      });

      const providers: NutritionProviderAdapter[] = [
        {
          source: 'usda_fdc',
          async search() {
            return {
              candidates: [
                {
                  source: 'usda_fdc',
                  source_id: 'fdc-100',
                  barcode: '000111222333',
                  product_name: 'Greek Yogurt, plain',
                  brand: 'Fixture Dairy',
                  serving_basis: 'per_100g',
                  serving_quantity: 100,
                  serving_unit: 'g',
                  nutrients: {
                    calories: 59,
                    fat_g: 0.4,
                    saturated_fat_g: 0.1,
                    carbs_g: 3.6,
                    fiber_g: 0,
                    sugar_g: 3.2,
                    protein_g: 10.3,
                    sodium_mg: 36,
                  },
                  confidence: 0.9,
                },
              ],
              status: { source: 'usda_fdc', status: 'ok', message: 'stubbed USDA fixture' },
            };
          },
        },
        {
          source: 'open_food_facts',
          async search() {
            return {
              candidates: [
                {
                  source: 'open_food_facts',
                  source_id: '000111222333',
                  barcode: '000111222333',
                  product_name: 'Greek Yogurt',
                  brand: 'Fixture Dairy',
                  serving_basis: 'per_100g',
                  serving_quantity: 100,
                  serving_unit: 'g',
                  nutrients: {
                    calories: 64,
                    fat_g: null,
                    saturated_fat_g: null,
                    carbs_g: 4,
                    fiber_g: null,
                    sugar_g: 3.8,
                    protein_g: null,
                    sodium_mg: 40,
                  },
                  confidence: 0.76,
                  quality_flags: ['OFF community entry missing label fields'],
                },
              ],
              status: { source: 'open_food_facts', status: 'ok', message: 'stubbed OFF fixture' },
            };
          },
        },
        {
          source: 'gs1',
          async search() {
            return {
              candidates: [
                {
                  source: 'gs1',
                  source_id: 'gs1-000111222333',
                  barcode: '000111222333',
                  product_name: 'Greek Yogurt Fixture Dairy',
                  brand: 'Fixture Dairy',
                  serving_basis: 'per_item',
                  serving_quantity: 1,
                  serving_unit: 'container',
                  nutrients: {
                    calories: null,
                    fat_g: null,
                    saturated_fat_g: null,
                    carbs_g: null,
                    fiber_g: null,
                    sugar_g: null,
                    protein_g: null,
                    sodium_mg: null,
                  },
                  confidence: 0.82,
                  quality_flags: ['GS1 identity metadata only'],
                },
              ],
              status: { source: 'gs1', status: 'ok', message: 'stubbed GS1 fixture' },
            };
          },
        },
      ];

      const result = await resolveNutritionCandidates(
        adapter,
        {
          barcode: '000111222333',
          query: 'Greek Yogurt',
          includeNetwork: true,
          manualCandidates: [
            {
              source: 'manual',
              source_id: 'manual-review',
              barcode: '000111222333',
              product_name: 'Greek Yogurt',
              brand: 'Fixture Dairy',
              serving_basis: 'per_serving',
              serving_quantity: 170,
              serving_unit: 'g',
              nutrients: {
                calories: 100,
                fat_g: 0,
                saturated_fat_g: null,
                carbs_g: null,
                fiber_g: null,
                sugar_g: null,
                protein_g: 16,
                sodium_mg: null,
              },
              confidence: 0.62,
              quality_flags: ['Manual review is missing carbohydrate and sodium fields'],
            },
          ],
        },
        providers,
      );

      expect(result.providerStatuses).toEqual([
        { source: 'usda_fdc', status: 'ok', message: 'stubbed USDA fixture' },
        { source: 'open_food_facts', status: 'ok', message: 'stubbed OFF fixture' },
        { source: 'gs1', status: 'ok', message: 'stubbed GS1 fixture' },
      ]);
      expect(result.candidates.map((candidate) => `${candidate.origin}:${candidate.source}`)).toEqual([
        'local_cache:manual',
        'local_cache:local_cache',
        'manual_input:manual',
        'provider:usda_fdc',
        'provider:gs1',
        'provider:open_food_facts',
      ]);

      const local = result.candidates.find((candidate) => candidate.nutrition_data_id === 'nut-yogurt-local');
      const productIdentity = result.candidates.find((candidate) => candidate.source === 'local_cache');
      const manual = result.candidates.find((candidate) => candidate.source_id === 'manual-review');
      const off = result.candidates.find((candidate) => candidate.source === 'open_food_facts');
      const gs1 = result.candidates.find((candidate) => candidate.source === 'gs1');

      expect(local).toMatchObject({
        origin: 'local_cache',
        completeness: 'complete',
        auto_selectable: true,
        rank: 1,
      });
      expect(productIdentity).toMatchObject({
        origin: 'local_cache',
        completeness: 'incomplete',
        auto_selectable: false,
        rank: 2,
      });
      expect(manual).toMatchObject({
        origin: 'manual_input',
        completeness: 'partial',
        auto_selectable: false,
      });
      expect(manual?.quality_flags).toContain('Missing carbs_g');
      expect(off).toMatchObject({
        origin: 'provider',
        completeness: 'partial',
        auto_selectable: false,
      });
      expect(off?.quality_flags).toEqual(expect.arrayContaining([
        'OFF community entry missing label fields',
        'Missing protein_g',
        'Missing fat_g',
      ]));
      expect(gs1).toMatchObject({
        origin: 'provider',
        completeness: 'incomplete',
        auto_selectable: false,
      });
      expect(gs1?.quality_flags).toEqual(expect.arrayContaining([
        'GS1 identity metadata only',
        'No usable nutrition facts returned',
      ]));
    });

    it('reports USDA and GS1 credential constraints without live credentials', async () => {
      const result = await resolveNutritionCandidates(
        adapter,
        { barcode: '000000000000', query: 'banana', includeNetwork: true },
        [
          createUsdaFoodDataCentralAdapter(),
          createGs1DataHubIdentityAdapter(),
        ],
      );

      expect(result.candidates).toEqual([]);
      expect(result.providerStatuses.map((status) => status.status)).toEqual([
        'not_configured',
        'not_configured',
      ]);
      expect(result.providerStatuses[0]?.message).toContain('data.gov API key');
      expect(result.providerStatuses[1]?.message).toContain('paid subscription');
    });

    it('exposes source display constraints for provider UI', () => {
      const off = getNutritionSourceDisplayData('open_food_facts', 0.72, 'partial');
      const usda = getNutritionSourceDisplayData('usda_fdc', 0.9, 'complete');
      const gs1 = getNutritionSourceDisplayData('gs1', 0.7, 'incomplete');

      expect(off.licenseLabel).toContain('ODbL');
      expect(off.rateLimitLabel).toContain('100 read product requests/min');
      expect(usda.apiKeyLabel).toContain('data.gov');
      expect(usda.licenseLabel).toContain('CC0');
      expect(gs1.access).toBe('paid_subscription');
      expect(gs1.confidenceLabel).toBe('Needs review');
      expect(getNutritionSourceDisplayData('unknown', 0.1, 'incomplete').licenseLabel).toContain('No nutrition facts');
    });
  });

  describe('updateNutritionData', () => {
    it('partial update of calories and protein', () => {
      const nutrition = createNutritionData(adapter, 'nut-1', {
        source: 'manual',
        calories: 100,
        protein_g: 5,
        fat_g: 3,
      });

      updateNutritionData(adapter, nutrition.id, {
        calories: 120,
        protein_g: 8,
      });

      const rows = adapter.query<{ calories: number; protein_g: number; fat_g: number }>(
        'SELECT calories, protein_g, fat_g FROM rc_nutrition_data WHERE id = ?',
        [nutrition.id],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].calories).toBe(120);
      expect(rows[0].protein_g).toBe(8);
      expect(rows[0].fat_g).toBe(3); // unchanged
    });
  });

  describe('deleteNutritionData', () => {
    it('removes the record', () => {
      const nutrition = createNutritionData(adapter, 'nut-1', {
        source: 'manual',
        calories: 200,
      });

      deleteNutritionData(adapter, nutrition.id);

      const rows = adapter.query(
        'SELECT * FROM rc_nutrition_data WHERE id = ?',
        [nutrition.id],
      );
      expect(rows).toHaveLength(0);
    });
  });

  describe('createManualNutritionOverride', () => {
    it('creates a confirmed manual record without overwriting the source record', () => {
      createFoodProduct(adapter, 'prod-oats', {
        canonical_name: 'Rolled Oats',
      });
      createNutritionData(adapter, 'nut-source', {
        product_id: 'prod-oats',
        source: 'open_food_facts',
        source_id: 'off-oats',
        calories: 360,
        protein_g: 13,
        confidence: 0.74,
      });

      const manual = createManualNutritionOverride(
        adapter,
        'nut-manual',
        'nut-source',
        {
          calories: 389,
          protein_g: 16.9,
        },
        'confirm-manual',
      );

      const source = getNutritionById(adapter, 'nut-source');
      expect(source?.calories).toBe(360);
      expect(source?.source).toBe('open_food_facts');
      expect(manual.source).toBe('manual');
      expect(manual.parent_nutrition_data_id).toBe('nut-source');
      expect(manual.calories).toBe(389);
      expect(manual.protein_g).toBe(16.9);
      expect(manual.is_user_confirmed).toBe(1);
      expect(getFoodConfirmations(adapter, 'nutrition_data', manual.id)[0]?.decision).toBe(
        'manual_override',
      );
    });
  });
});
