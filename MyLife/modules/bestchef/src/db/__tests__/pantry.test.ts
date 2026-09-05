import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '../../definition';
import {
  V13_PANTRY_BATCH_INDEXES,
  V13_PANTRY_BATCH_MIGRATIONS,
  V13_PANTRY_BATCH_TABLES,
} from '../schema';
import {
  bulkUpdateQuantities,
  confirmReceiptImportLines,
  confirmExpirationDateForPantryBatch,
  confirmFoodRecognitionCandidatesToPantry,
  createPantryBatch,
  createPantryItem,
  deletePantryBatch,
  deletePantryItem,
  getExpiringItems,
  getPantryBatches,
  getPantryItemByBarcode,
  getPantryItemById,
  getPantryItems,
  getPantryItemsByName,
  getPantryItemsByProduct,
  ignoreReceiptImportLine,
  undoReceiptImportLine,
  useNextPantryBatch,
  updatePantryItem,
  confirmPantryItemIdentity,
} from '../pantry';
import { addIngredient, createRecipe } from '../crud';
import {
  createFoodProduct,
  createFoodProductAlias,
  createNutritionData,
  getFoodConfirmations,
  getNutritionById,
  getNutritionSourceDisplayData,
} from '../nutrition';
import { createReceiptImportDraft } from '../../import/receipt-import';
import { matchReceiptLineToPantry, suggestRecipesForUseNextBatches } from '../../pantry/matching';
import type { NutritionProviderAdapter, ReceiptLineProductCandidate } from '../../types';

describe('recipes pantry db', () => {
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

  it('creates and fetches pantry items', () => {
    const created = createPantryItem(adapter, {
      name: 'Whole Milk',
      quantity: 1,
      unit: 'gallon',
      storage_location: 'fridge',
      grocery_section: 'dairy',
      barcode: '123',
      batch_source: 'barcode_scan',
      receipt_link: 'receipt://milk',
      photos: ['file://milk.jpg'],
    });

    expect(getPantryItemById(adapter, created.id)?.name).toBe('Whole Milk');
    expect(getPantryItemByBarcode(adapter, '123')?.id).toBe(created.id);
    expect(getPantryItemById(adapter, created.id)?.product_id).toBeNull();
    expect(getPantryItemById(adapter, created.id)?.confirmation_status).toBe('unconfirmed');
    expect(getPantryBatches(adapter, created.id)).toMatchObject([
      {
        pantry_item_id: created.id,
        quantity: 1,
        unit: 'gallon',
        source: 'barcode_scan',
        receipt_link: 'receipt://milk',
        photos: ['file://milk.jpg'],
      },
    ]);
  });

  it('creates the pantry batch table in schema v13 and syncs batches as personal data', () => {
    const rows = adapter.query<{ name: string }>(
      `SELECT name FROM sqlite_master
       WHERE type = 'table'
       AND name = 'rc_pantry_batches'`,
    );
    expect(rows.map((row) => row.name)).toEqual(['rc_pantry_batches']);
    expect(RECIPES_MODULE.schemaVersion).toBe(34);
    expect(
      RECIPES_MODULE.syncPolicy?.entityRules.find((rule) => rule.tableName === 'pantry_batches')?.defaultScope,
    ).toBe('personal_replica');
    expect(
      RECIPES_MODULE.syncPolicy?.entityRules.find((rule) => rule.tableName === 'pantry_batches')?.maxScope,
    ).toBe('personal_replica');
  });

  it('creates receipt import tables in schema v15 and scopes raw receipt review data personally', () => {
    const tables = adapter.query<{ name: string }>(
      `SELECT name FROM sqlite_master
       WHERE type = 'table'
       AND name IN ('rc_receipt_imports', 'rc_receipt_import_lines')
       ORDER BY name`,
    );
    expect(tables.map((row) => row.name)).toEqual(['rc_receipt_import_lines', 'rc_receipt_imports']);
    expect(
      RECIPES_MODULE.syncPolicy?.entityRules.find((rule) => rule.tableName === 'receipt_imports')?.defaultScope,
    ).toBe('personal_replica');
    expect(
      RECIPES_MODULE.syncPolicy?.entityRules.find((rule) => rule.tableName === 'receipt_imports')?.maxScope,
    ).toBe('personal_replica');
    expect(
      RECIPES_MODULE.syncPolicy?.entityRules.find((rule) => rule.tableName === 'receipt_import_lines')?.maxScope,
    ).toBe('personal_replica');
  });

  it('caps local product and nutrition caches at personal replica scope', () => {
    for (const tableName of [
      'food_products',
      'food_product_aliases',
      'food_confirmations',
      'nutrition_data',
      'pantry_items',
    ]) {
      const rule = RECIPES_MODULE.syncPolicy?.entityRules.find((entry) => entry.tableName === tableName);
      expect(rule?.defaultScope, tableName).toBe('personal_replica');
      expect(rule?.maxScope, tableName).toBe('personal_replica');
    }
  });

  it('links private pantry inventory to canonical product and nutrition records', () => {
    const product = createFoodProduct(adapter, 'prod-milk', {
      canonical_name: 'Whole Milk',
      brand: 'Organic Valley',
      grocery_section: 'dairy',
      default_storage_location: 'fridge',
    });
    createFoodProductAlias(adapter, 'alias-milk', {
      product_id: product.id,
      alias_type: 'barcode',
      alias_value: '049000042566',
    });
    const nutrition = createNutritionData(adapter, 'nut-milk', {
      product_id: product.id,
      source: 'open_food_facts',
      source_id: '049000042566',
      calories: 150,
      confidence: 0.9,
    });

    const inventory = createPantryItem(adapter, {
      name: 'Milk',
      quantity: 1,
      unit: 'gallon',
      storage_location: 'fridge',
      grocery_section: 'dairy',
      product_id: product.id,
      nutrition_data_id: nutrition.id,
      confirmation_status: 'needs_review',
    });

    expect(getPantryItemsByProduct(adapter, product.id).map((item) => item.id)).toEqual([
      inventory.id,
    ]);
    expect(getPantryItemByBarcode(adapter, '049000042566')?.id).toBe(inventory.id);

    confirmPantryItemIdentity(adapter, inventory.id, {
      product_id: product.id,
      nutrition_data_id: nutrition.id,
      confirmed_at: '2026-04-25T12:30:00.000Z',
    });

    const confirmed = getPantryItemById(adapter, inventory.id);
    expect(confirmed?.product_id).toBe(product.id);
    expect(confirmed?.nutrition_data_id).toBe(nutrition.id);
    expect(confirmed?.confirmation_status).toBe('confirmed');
    expect(confirmed?.confirmed_at).toBe('2026-04-25T12:30:00.000Z');
  });

  it('matches receipt lines to product cache, barcode aliases, and nutrition candidates before confirmation', async () => {
    const product = createFoodProduct(adapter, 'prod-milk-cache', {
      canonical_name: 'Whole Milk',
      brand: 'Organic Valley',
      grocery_section: 'dairy',
      default_storage_location: 'fridge',
      is_user_confirmed: 1,
      confirmed_at: '2026-04-25T12:00:00.000Z',
    });
    createFoodProductAlias(adapter, 'alias-milk-barcode', {
      product_id: product.id,
      alias_type: 'barcode',
      alias_value: '049000042566',
      confidence: 0.97,
      is_user_confirmed: 1,
      confirmed_at: '2026-04-25T12:00:00.000Z',
    });
    const nutrition = createNutritionData(adapter, 'nut-milk-cache', {
      product_id: product.id,
      barcode: '049000042566',
      product_name: 'Whole Milk',
      brand: 'Organic Valley',
      source: 'open_food_facts',
      source_id: '049000042566',
      calories: 150,
      protein_g: 8,
      carbs_g: 12,
      fat_g: 8,
      confidence: 0.9,
      is_user_confirmed: 1,
      confirmed_at: '2026-04-25T12:00:00.000Z',
    });

    const cacheMatch = await matchReceiptLineToPantry(adapter, {
      description: 'Organic Milk $5.99',
    });
    expect(cacheMatch.candidates.some((candidate) => candidate.source === 'product_cache')).toBe(true);

    const barcodeMatch = await matchReceiptLineToPantry(adapter, {
      description: '049000042566 ORGANIC MILK $5.99',
    });
    expect(barcodeMatch.status).toBe('matched');
    expect(barcodeMatch.candidates[0]).toMatchObject({
      source: 'barcode_alias',
      product_id: product.id,
      nutrition_data_id: nutrition.id,
    });
  });

  it('stores raw OCR, redacts payment review text, and confirms selected lines into pantry batches', async () => {
    const product = createFoodProduct(adapter, 'prod-receipt-milk', {
      canonical_name: 'Whole Milk',
      brand: 'Organic Valley',
      grocery_section: 'dairy',
      default_storage_location: 'fridge',
      is_user_confirmed: 1,
      confirmed_at: '2026-04-25T12:00:00.000Z',
    });
    createFoodProductAlias(adapter, 'alias-receipt-milk', {
      product_id: product.id,
      alias_type: 'barcode',
      alias_value: '049000042566',
      confidence: 0.97,
      is_user_confirmed: 1,
      confirmed_at: '2026-04-25T12:00:00.000Z',
    });
    const nutrition = createNutritionData(adapter, 'nut-receipt-milk', {
      product_id: product.id,
      barcode: '049000042566',
      product_name: 'Whole Milk',
      brand: 'Organic Valley',
      source: 'open_food_facts',
      source_id: '049000042566',
      calories: 150,
      protein_g: 8,
      carbs_g: 12,
      fat_g: 8,
      confidence: 0.9,
      is_user_confirmed: 1,
      confirmed_at: '2026-04-25T12:00:00.000Z',
    });

    const review = await createReceiptImportDraft(adapter, {
      photoUri: 'file://receipt.jpg',
      rawOcrText: `LOCAL MARKET
04/25/2026
049000042566 ORGANIC MILK $5.99
VISA **** 4242 $5.99
TOTAL $5.99`,
    });

    expect(review.receipt.raw_ocr_text).toContain('4242');
    expect(review.receipt.redacted_ocr_text).not.toContain('4242');
    expect(review.lines).toHaveLength(1);
    expect(getPantryItems(adapter)).toHaveLength(0);

    const result = confirmReceiptImportLines(adapter, review.receipt.id, [
      { lineId: review.lines[0]!.id },
    ]);
    expect(result.ambiguousLineIds).toEqual([]);

    const item = getPantryItems(adapter)[0];
    expect(item).toMatchObject({
      product_id: product.id,
      nutrition_data_id: nutrition.id,
      confirmation_status: 'confirmed',
      storage_location: 'fridge',
      grocery_section: 'dairy',
    });
    expect(item?.batches?.[0]).toMatchObject({
      source: 'receipt_ocr',
      receipt_link: `receipt_import:${review.receipt.id}`,
      photos: ['file://receipt.jpg'],
    });
    const receipt = adapter.query<{ review_status: string }>(
      `SELECT review_status FROM rc_receipt_imports WHERE id = ?`,
      [review.receipt.id],
    )[0];
    expect(receipt?.review_status).toBe('confirmed');
  });

  it('lets receipt review corrections reject an ambiguous pantry match before mutation', async () => {
    const existing = createPantryItem(adapter, {
      name: 'Organic Milk',
      quantity: 1,
      unit: 'gallon',
      storage_location: 'fridge',
      grocery_section: 'dairy',
    });
    const review = await createReceiptImportDraft(adapter, {
      photoUri: 'file://receipt-correction.jpg',
      rawOcrText: `LOCAL MARKET
04/25/2026
ORGANIC MILK $5.99
TOTAL $5.99`,
    });

    const result = confirmReceiptImportLines(adapter, review.receipt.id, [
      {
        lineId: review.lines[0]!.id,
        selectedCandidateId: null,
        itemName: 'Oat Milk',
        quantity: 1,
        unit: 'carton',
      },
    ]);

    const items = getPantryItems(adapter);
    expect(result.confirmedLineIds).toEqual([review.lines[0]!.id]);
    expect(items.map((item) => item.name).sort()).toEqual(['Oat Milk', 'Organic Milk']);
    expect(getPantryBatches(adapter, existing.id)).toHaveLength(1);
    expect(items.find((item) => item.name === 'Oat Milk')?.batches?.[0]).toMatchObject({
      quantity: 1,
      unit: 'carton',
      source: 'receipt_ocr',
    });
  });

  it('lets receipt review corrections merge a selected match into an existing pantry item', async () => {
    const existing = createPantryItem(adapter, {
      name: 'Organic Milk',
      quantity: 1,
      unit: 'gallon',
      storage_location: 'fridge',
      grocery_section: 'dairy',
    });
    const review = await createReceiptImportDraft(adapter, {
      photoUri: 'file://receipt-merge.jpg',
      rawOcrText: `LOCAL MARKET
04/25/2026
ORGANIC MILK $5.99
TOTAL $5.99`,
    });
    const candidateId = `pantry_item:${existing.id}`;

    confirmReceiptImportLines(adapter, review.receipt.id, [
      {
        lineId: review.lines[0]!.id,
        selectedCandidateId: candidateId,
        quantity: 2,
        unit: 'carton',
      },
    ]);

    const batches = getPantryBatches(adapter, existing.id);
    expect(getPantryItems(adapter).map((item) => item.name)).toEqual(['Organic Milk']);
    expect(batches).toHaveLength(2);
    expect(batches[1]).toMatchObject({
      quantity: 2,
      unit: 'carton',
      source: 'receipt_ocr',
    });
  });

  it('enriches receipt review candidates with network nutrition providers when enabled', async () => {
    const provider: NutritionProviderAdapter = {
      source: 'usda_fdc',
      async search(input) {
        expect(input.includeNetwork).toBe(true);
        expect(input.query).toContain('banana');
        return {
          status: {
            source: 'usda_fdc',
            status: 'ok',
            message: 'Fixture USDA candidate returned',
          },
          candidates: [{
            source: 'usda_fdc',
            source_id: 'fdc-banana-raw',
            source_url: 'https://fdc.example/banana',
            barcode: null,
            product_name: 'Bananas raw',
            brand: null,
            serving_size_text: '100 g',
            serving_basis: 'per_100g',
            serving_quantity: 100,
            serving_unit: 'g',
            nutrients: {
              calories: 89,
              fat_g: 0.3,
              saturated_fat_g: 0.1,
              carbs_g: 22.8,
              fiber_g: 2.6,
              sugar_g: 12.2,
              protein_g: 1.1,
              sodium_mg: 1,
            },
            confidence: 0.88,
            fetched_at: '2026-04-25T12:00:00.000Z',
          }],
        };
      },
    };

    const review = await createReceiptImportDraft(
      adapter,
      {
        photoUri: 'file://receipt-network.jpg',
        rawOcrText: `LOCAL MARKET
04/25/2026
BANANA $2.49
TOTAL $2.49`,
      },
      undefined,
      {
        includeNetworkNutrition: true,
        nutritionProviders: [provider],
      },
    );
    const candidates = JSON.parse(review.lines[0]!.candidate_json) as ReceiptLineProductCandidate[];
    const networkCandidate = candidates.find((candidate) => candidate.nutritionCandidate?.source === 'usda_fdc');

    expect(networkCandidate?.source).toBe('nutrition_candidate');
    expect(networkCandidate?.label).toBe('Bananas raw');

    confirmReceiptImportLines(adapter, review.receipt.id, [{
      lineId: review.lines[0]!.id,
      selectedCandidateId: networkCandidate!.id,
      quantity: 1,
      unit: 'bunch',
    }]);

    const item = getPantryItems(adapter)[0];
    expect(item?.name).toBe('banana');
    expect(item?.nutrition_data_id).toMatch(/^nutrition-/);
    expect(getNutritionById(adapter, item!.nutrition_data_id!)?.source).toBe('usda_fdc');
  });

  it('confirms grocery photo candidates into pantry batches and product aliases', () => {
    const results = confirmFoodRecognitionCandidatesToPantry(adapter, [
      {
        candidateId: 'food-photo-milk-1',
        name: 'Organic Milk',
        grocerySection: 'dairy',
        storageLocation: 'fridge',
        quantity: 1,
        unit: 'gallon',
        expirationDate: '2026-05-03',
        photoUri: 'file://grocery.jpg',
        cropUri: 'file://grocery-milk-crop.jpg',
        labels: ['organic milk', 'whole milk'],
        confidence: 0.91,
      },
      {
        candidateId: 'food-photo-bananas-2',
        name: 'Bananas',
        grocerySection: 'produce',
        quantity: 6,
        unit: 'count',
        photoUri: 'file://grocery.jpg',
        labels: ['banana bunch'],
        confidence: 0.82,
      },
    ]);

    expect(results).toHaveLength(2);
    const items = getPantryItems(adapter);
    expect(items.map((item) => item.name).sort()).toEqual(['Bananas', 'Organic Milk']);
    const milk = items.find((item) => item.name === 'Organic Milk');
    expect(milk).toMatchObject({
      grocery_section: 'dairy',
      storage_location: 'fridge',
      confirmation_status: 'confirmed',
    });
    expect(milk?.batches?.[0]).toMatchObject({
      source: 'food_recognition',
      expiration_date: '2026-05-03',
    });
    expect(milk?.batches?.[0]?.photos).toEqual([
      'file://grocery-milk-crop.jpg',
      'file://grocery.jpg',
    ]);
    const aliases = adapter.query<{ alias_value: string }>(
      `SELECT alias_value FROM rc_food_product_aliases
       WHERE product_id = ?
       ORDER BY alias_value`,
      [milk?.product_id],
    );
    expect(aliases.map((row) => row.alias_value)).toContain('whole milk');
  });

  it('stores the selected grocery photo nutrition source before pantry mutation', () => {
    const result = confirmFoodRecognitionCandidatesToPantry(adapter, [
      {
        candidateId: 'food-photo-bananas-1',
        name: 'Bananas',
        barcode: '0000000004011',
        grocerySection: 'produce',
        storageLocation: 'counter',
        quantity: 6,
        unit: 'count',
        photoUri: 'file://grocery.jpg',
        labels: ['banana bunch', '0000000004011'],
        confidence: 0.84,
        selectedNutritionCandidateId: 'provider:usda-banana',
        nutritionCandidate: {
          id: 'provider:usda-banana',
          origin: 'provider',
          source: 'usda_fdc',
          source_id: '173944',
          source_url: 'https://fdc.nal.usda.gov/food-details/173944/nutrients',
          product_id: null,
          nutrition_data_id: null,
          barcode: '0000000004011',
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
          completeness: 'partial',
          auto_selectable: true,
          is_user_confirmed: false,
          fetched_at: '2026-04-25T15:00:00.000Z',
          display: getNutritionSourceDisplayData('usda_fdc', 0.86, 'partial'),
          quality_flags: ['Missing fat_g'],
          rank: 1,
        },
      },
    ])[0]!;

    expect(result.nutritionDataId).not.toBeNull();
    const nutrition = getNutritionById(adapter, result.nutritionDataId!);
    expect(nutrition).toMatchObject({
      source: 'usda_fdc',
      source_id: '173944',
      barcode: '0000000004011',
      product_name: 'Bananas, raw',
      calories: 89,
      fat_g: null,
      serving_basis: 'per_100g',
      serving_quantity: 100,
      serving_unit: 'g',
      is_user_confirmed: 1,
      fetched_at: '2026-04-25T15:00:00.000Z',
    });
    expect(getPantryItemById(adapter, result.pantryItemId)?.nutrition_data_id).toBe(result.nutritionDataId);
    expect(getFoodConfirmations(adapter, 'nutrition_data', result.nutritionDataId!)[0]?.notes).toContain(
      'selected grocery photo nutrition source',
    );
  });

  it('allows pantry-only grocery photo confirmation without nutrition facts', () => {
    const result = confirmFoodRecognitionCandidatesToPantry(adapter, [
      {
        candidateId: 'food-photo-mystery-1',
        name: 'Mystery Sauce',
        grocerySection: 'condiments',
        storageLocation: 'fridge',
        quantity: 1,
        unit: 'bottle',
        photoUri: 'file://grocery.jpg',
        labels: ['mystery sauce'],
        confidence: 0.57,
        selectedNutritionCandidateId: null,
        nutritionCandidate: null,
      },
    ])[0]!;

    const item = getPantryItemById(adapter, result.pantryItemId);
    expect(result.nutritionDataId).toBeNull();
    expect(item?.nutrition_data_id).toBeNull();
    expect(item?.confirmation_status).toBe('confirmed');
  });

  it('confirms expiration photo OCR into a batch without changing pantry identity', () => {
    const item = createPantryItem(adapter, {
      name: 'Eggs',
      quantity: 12,
      unit: 'count',
      storage_location: 'fridge',
      grocery_section: 'dairy',
    });

    const result = confirmExpirationDateForPantryBatch(adapter, {
      pantryItemId: item.id,
      expirationDate: '2026-05-03',
      photoUri: 'file://eggs-expiration.jpg',
      rawText: 'EXP 05/03/2026 LOT L-47',
      lotCode: 'L-47',
      quantity: 12,
      unit: 'count',
      confidence: 0.88,
    });

    expect(result).toMatchObject({
      pantryItemId: item.id,
      expirationDate: '2026-05-03',
      createdItem: false,
    });
    expect(getPantryBatches(adapter, item.id).map((batch) => batch.source)).toContain('expiration_ocr');
    expect(getPantryItemById(adapter, item.id)?.expiration_date).toBe('2026-05-03');
  });

  it('updates only the selected expiration batch and keeps original plus crop evidence', () => {
    const item = createPantryItem(adapter, {
      name: 'Yogurt',
      quantity: 2,
      unit: 'cup',
      storage_location: 'fridge',
      grocery_section: 'dairy',
      expiration_date: '2026-04-20',
    });
    const laterBatch = createPantryBatch(adapter, {
      pantry_item_id: item.id,
      lot_code: 'FRESH',
      quantity: 4,
      unit: 'cup',
      expiration_date: '2026-05-20',
      source: 'manual',
      photos: ['file://existing-yogurt.jpg'],
    });

    const result = confirmExpirationDateForPantryBatch(adapter, {
      pantryBatchId: laterBatch.id,
      expirationDate: '2026-05-18',
      photoUri: 'file://yogurt-expiration.jpg',
      cropUri: 'file://yogurt-expiration-crop.jpg',
      rawText: 'EXP 05/18/2026 LOT FRESH',
      confidence: 0.91,
    });
    const batches = getPantryBatches(adapter, item.id);

    expect(result.batchId).toBe(laterBatch.id);
    expect(batches.find((batch) => batch.id === laterBatch.id)).toMatchObject({
      expiration_date: '2026-05-18',
      source: 'expiration_ocr',
    });
    expect(batches.find((batch) => batch.id === laterBatch.id)?.photos).toEqual([
      'file://existing-yogurt.jpg',
      'file://yogurt-expiration-crop.jpg',
      'file://yogurt-expiration.jpg',
    ]);
    expect(batches.find((batch) => batch.id !== laterBatch.id)?.expiration_date).toBe('2026-04-20');
  });

  it('rejects invalid expiration photo dates before mutating existing batch data', () => {
    const item = createPantryItem(adapter, {
      name: 'Cheese',
      quantity: 1,
      unit: 'block',
      storage_location: 'fridge',
      grocery_section: 'dairy',
      expiration_date: '2026-02-28',
    });
    const batch = getPantryBatches(adapter, item.id)[0]!;

    expect(() => confirmExpirationDateForPantryBatch(adapter, {
      pantryBatchId: batch.id,
      expirationDate: '2026-02-31',
      photoUri: 'file://bad-date.jpg',
    })).toThrow('Expiration date must be a real calendar date.');
    expect(getPantryBatches(adapter, item.id)[0]).toMatchObject({
      expiration_date: '2026-02-28',
      photos: [],
    });
  });

  it('deleting one pantry batch keeps the product-backed pantry item when other batches exist', () => {
    const product = createFoodProduct(adapter, 'prod-batch-delete', {
      canonical_name: 'Greek Yogurt',
      brand: 'Local Dairy',
      grocery_section: 'dairy',
      default_storage_location: 'fridge',
    });
    const item = createPantryItem(adapter, {
      name: 'Greek Yogurt',
      product_id: product.id,
      quantity: 1,
      unit: 'tub',
      storage_location: 'fridge',
      grocery_section: 'dairy',
      expiration_date: '2026-04-26',
    });
    const secondBatch = createPantryBatch(adapter, {
      pantry_item_id: item.id,
      quantity: 1,
      unit: 'tub',
      expiration_date: '2026-05-03',
      source: 'receipt_ocr',
    });
    const firstBatch = getPantryBatches(adapter, item.id).find((batch) => batch.id !== secondBatch.id)!;

    deletePantryBatch(adapter, firstBatch.id);

    expect(getPantryItemById(adapter, item.id)).toMatchObject({
      id: item.id,
      product_id: product.id,
    });
    expect(getPantryBatches(adapter, item.id).map((batch) => batch.id)).toEqual([secondBatch.id]);
  });

  it('filters and updates pantry items', () => {
    const created = createPantryItem(adapter, {
      name: 'Bread',
      storage_location: 'pantry',
      grocery_section: 'bakery',
    });

    updatePantryItem(adapter, created.id, {
      name: 'Sourdough Bread',
      quantity: 2,
      expiration_date: '2026-03-05',
    });

    expect(getPantryItems(adapter, { grocerySection: 'bakery' })).toHaveLength(1);
    expect(getPantryItemsByName(adapter, 'Sourdough')).toHaveLength(1);
    expect(getPantryBatches(adapter, created.id)[0]?.expiration_date).toBe('2026-03-05');
  });

  it('returns expiring items and supports bulk quantity updates', () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 2);
    const soonString = soon.toISOString().split('T')[0];

    const created = createPantryItem(adapter, {
      name: 'Spinach',
      quantity: 1,
      unit: 'bag',
      storage_location: 'fridge',
      expiration_date: soonString,
      grocery_section: 'produce',
    });

    bulkUpdateQuantities(adapter, [{ id: created.id, quantity: 3 }]);
    expect(getPantryItemById(adapter, created.id)?.quantity).toBe(3);
    expect(getPantryBatches(adapter, created.id)[0]?.quantity).toBe(3);
    expect(getExpiringItems(adapter, 3)).toHaveLength(1);
  });

  it('tracks multiple batches and uses the most urgent dated batch first', () => {
    const item = createPantryItem(adapter, {
      name: 'Yogurt',
      quantity: 2,
      unit: 'cup',
      storage_location: 'fridge',
      grocery_section: 'dairy',
      expiration_date: '2026-05-10',
      lot_code: 'FRESH',
    });
    createPantryBatch(adapter, {
      pantry_item_id: item.id,
      lot_code: 'SOON',
      quantity: 3,
      unit: 'cup',
      expiration_date: '2026-04-26',
      purchase_date: '2026-04-20',
      source: 'receipt_ocr',
      receipt_link: 'receipt://trip-1',
      photos: ['file://yogurt-lot.jpg'],
    });

    const hydrated = getPantryItemById(adapter, item.id);
    expect(hydrated?.quantity).toBe(5);
    expect(hydrated?.expiration_date).toBe('2026-04-26');
    expect(hydrated?.batches?.map((batch) => batch.lot_code)).toEqual(['SOON', 'FRESH']);

    const used = useNextPantryBatch(adapter, item.id, 1);
    expect(used?.lot_code).toBe('SOON');
    expect(used?.quantity).toBe(2);
    expect(getPantryItemById(adapter, item.id)?.quantity).toBe(4);
  });

  it('suggests recipes that use the next expiring pantry batches', () => {
    createRecipe(adapter, 'recipe-smoothie', {
      title: 'Banana Milk Smoothie',
      servings: 1,
    });
    addIngredient(adapter, 'ingredient-banana', {
      recipe_id: 'recipe-smoothie',
      name: '1 banana',
      quantity: '1',
      quantity_value: 1,
      unit: null,
      item: 'banana',
      sort_order: 0,
    });
    addIngredient(adapter, 'ingredient-milk', {
      recipe_id: 'recipe-smoothie',
      name: '1 cup milk',
      quantity: '1',
      quantity_value: 1,
      unit: 'cup',
      item: 'milk',
      sort_order: 1,
    });
    createPantryItem(adapter, {
      name: 'Bananas',
      quantity: 6,
      unit: 'count',
      storage_location: 'counter',
      grocery_section: 'produce',
      expiration_date: new Date(Date.now() + 86_400_000).toISOString().split('T')[0],
    });
    createPantryItem(adapter, {
      name: 'Milk',
      quantity: 2,
      unit: 'cup',
      storage_location: 'fridge',
      grocery_section: 'dairy',
      expiration_date: new Date(Date.now() + 2 * 86_400_000).toISOString().split('T')[0],
    });

    const prompts = suggestRecipesForUseNextBatches(adapter, 3);

    expect(prompts[0]?.recipe.title).toBe('Banana Milk Smoothie');
    expect(prompts[0]?.useNextBatches.map((batch) => batch.pantryItemName).sort()).toEqual(['Bananas', 'Milk']);
  });

  it('marks use-next prompts as needs-more when expiring batch quantity is insufficient after unit conversion', () => {
    createRecipe(adapter, 'recipe-milk-pancakes', {
      title: 'Milk Pancakes',
      servings: 1,
    });
    addIngredient(adapter, 'ingredient-pancake-milk', {
      recipe_id: 'recipe-milk-pancakes',
      name: '2 cup milk',
      quantity: '2',
      quantity_value: 2,
      unit: 'cup',
      item: 'milk',
      sort_order: 0,
    });
    createPantryItem(adapter, {
      name: 'Milk',
      quantity: 250,
      unit: 'ml',
      storage_location: 'fridge',
      grocery_section: 'dairy',
      expiration_date: new Date(Date.now() + 86_400_000).toISOString().split('T')[0],
    });

    const prompt = suggestRecipesForUseNextBatches(adapter, 3)[0];

    expect(prompt?.recipe.title).toBe('Milk Pancakes');
    expect(prompt?.readyToCook).toBe(false);
    expect(prompt?.promptStatus).toBe('needs_more');
    expect(prompt?.recipe.canMake).toBe(false);
    expect(prompt?.useNextBatches[0]).toMatchObject({
      pantryItemName: 'Milk',
      quantityNeeded: 2,
      neededUnit: 'cup',
      quantityAvailable: 1.057,
      availableUnit: 'cup',
      quantitySufficient: false,
      sufficiencyStatus: 'insufficient',
    });
  });

  it('marks use-next prompts as ready when compatible expiring units are sufficient', () => {
    createRecipe(adapter, 'recipe-milk-latte', {
      title: 'Milk Latte',
      servings: 1,
    });
    addIngredient(adapter, 'ingredient-latte-milk', {
      recipe_id: 'recipe-milk-latte',
      name: '1 cup milk',
      quantity: '1',
      quantity_value: 1,
      unit: 'cup',
      item: 'milk',
      sort_order: 0,
    });
    createPantryItem(adapter, {
      name: 'Milk',
      quantity: 250,
      unit: 'ml',
      storage_location: 'fridge',
      grocery_section: 'dairy',
      expiration_date: new Date(Date.now() + 86_400_000).toISOString().split('T')[0],
    });

    const prompt = suggestRecipesForUseNextBatches(adapter, 3)[0];

    expect(prompt?.readyToCook).toBe(true);
    expect(prompt?.promptStatus).toBe('ready_to_cook');
    expect(prompt?.useNextBatches[0]?.quantitySufficient).toBe(true);
  });

  it('marks use-next prompts as check-units for ambiguous count units', () => {
    createRecipe(adapter, 'recipe-cilantro-salsa', {
      title: 'Cilantro Salsa',
      servings: 1,
    });
    addIngredient(adapter, 'ingredient-cilantro', {
      recipe_id: 'recipe-cilantro-salsa',
      name: '1 cilantro',
      quantity: '1',
      quantity_value: 1,
      unit: null,
      item: 'cilantro',
      sort_order: 0,
    });
    createPantryItem(adapter, {
      name: 'Cilantro',
      quantity: 1,
      unit: 'bunch',
      storage_location: 'fridge',
      grocery_section: 'produce',
      expiration_date: new Date(Date.now() + 86_400_000).toISOString().split('T')[0],
    });

    const prompt = suggestRecipesForUseNextBatches(adapter, 3)[0];

    expect(prompt?.readyToCook).toBe(false);
    expect(prompt?.promptStatus).toBe('check_units');
    expect(prompt?.useNextBatches[0]).toMatchObject({
      pantryItemName: 'Cilantro',
      quantityNeeded: 1,
      quantityAvailable: 1,
      availableUnit: 'bunch',
      quantitySufficient: null,
      sufficiencyStatus: 'unknown',
    });
  });

  it('records receipt OCR provider outages without pantry mutation', async () => {
    const review = await createReceiptImportDraft(
      adapter,
      { photoUri: 'file://receipt-outage.jpg' },
      {
        id: 'fixture-outage',
        async recognize() {
          throw new Error('OCR provider unavailable');
        },
      },
    );

    expect(review.receipt.provider_status).toBe('failed');
    expect(review.receipt.provider_error).toBe('OCR provider unavailable');
    expect(review.lines).toEqual([]);
    expect(getPantryItems(adapter)).toHaveLength(0);
  });

  it('migrates existing single-date pantry rows into one batch without dropping item data', () => {
    const olderDb = createModuleTestDatabase('recipes', RECIPES_MODULE.migrations!.slice(0, -1));
    try {
      olderDb.adapter.execute(
        `INSERT INTO rc_pantry_items (
          id,
          name,
          quantity,
          unit,
          storage_location,
          expiration_date,
          purchase_date,
          photo_path,
          grocery_section
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'pantry-old',
          'Spinach',
          1,
          'bag',
          'fridge',
          '2026-04-26',
          '2026-04-24',
          'file://spinach.jpg',
          'produce',
        ],
      );

      for (const statement of [
        ...V13_PANTRY_BATCH_TABLES,
        ...V13_PANTRY_BATCH_MIGRATIONS,
        ...V13_PANTRY_BATCH_INDEXES,
      ]) {
        olderDb.adapter.execute(statement);
      }

      const item = olderDb.adapter.query<{ name: string; expiration_date: string | null }>(
        `SELECT name, expiration_date FROM rc_pantry_items WHERE id = ?`,
        ['pantry-old'],
      )[0];
      const batches = olderDb.adapter.query<{
        pantry_item_id: string;
        quantity: number;
        expiration_date: string;
        purchase_date: string;
        source: string;
        photos_json: string;
      }>(`SELECT * FROM rc_pantry_batches WHERE pantry_item_id = ?`, ['pantry-old']);

      expect(item).toEqual({ name: 'Spinach', expiration_date: '2026-04-26' });
      expect(batches).toHaveLength(1);
      expect(batches[0]).toMatchObject({
        pantry_item_id: 'pantry-old',
        quantity: 1,
        expiration_date: '2026-04-26',
        purchase_date: '2026-04-24',
        source: 'migration',
      });
      expect(JSON.parse(batches[0]!.photos_json)).toEqual(['file://spinach.jpg']);
    } finally {
      olderDb.close();
    }
  });

  it('deletes pantry items', () => {
    const created = createPantryItem(adapter, {
      name: 'Butter',
      storage_location: 'fridge',
      grocery_section: 'dairy',
    });

    deletePantryItem(adapter, created.id);
    expect(getPantryItemById(adapter, created.id)).toBeNull();
  });

  it('undoes a confirmed receipt line by deleting the created pantry batch and item', async () => {
    const review = await createReceiptImportDraft(adapter, {
      photoUri: 'file://undo-receipt.jpg',
      rawOcrText: `LOCAL MARKET
04/25/2026
ORGANIC OATS $4.99
TOTAL $4.99`,
    });
    const lineId = review.lines[0]!.id;

    confirmReceiptImportLines(adapter, review.receipt.id, [
      { lineId, itemName: 'Organic Oats', quantity: 1, unit: 'box' },
    ]);
    expect(getPantryItems(adapter)).toHaveLength(1);

    undoReceiptImportLine(adapter, lineId);
    expect(getPantryItems(adapter)).toHaveLength(0);

    const lineAfter = adapter.query<{ match_status: string; pantry_item_id: string | null }>(
      `SELECT match_status, pantry_item_id FROM rc_receipt_import_lines WHERE id = ?`,
      [lineId],
    )[0];
    expect(lineAfter?.match_status === 'matched' || lineAfter?.match_status === 'unmatched').toBe(true);
    expect(lineAfter?.pantry_item_id).toBeNull();
  });

  it('undoes an ignored receipt line back to a reviewable state', async () => {
    const review = await createReceiptImportDraft(adapter, {
      photoUri: 'file://undo-ignore.jpg',
      rawOcrText: `LOCAL MARKET
04/25/2026
WHOLE WHEAT BREAD $3.49
TOTAL $3.49`,
    });
    const lineId = review.lines[0]!.id;

    ignoreReceiptImportLine(adapter, lineId);
    const ignoredRow = adapter.query<{ match_status: string }>(
      `SELECT match_status FROM rc_receipt_import_lines WHERE id = ?`,
      [lineId],
    )[0];
    expect(ignoredRow?.match_status).toBe('ignored');

    undoReceiptImportLine(adapter, lineId);
    const restoredRow = adapter.query<{ match_status: string }>(
      `SELECT match_status FROM rc_receipt_import_lines WHERE id = ?`,
      [lineId],
    )[0];
    expect(restoredRow?.match_status === 'matched' || restoredRow?.match_status === 'unmatched').toBe(true);
  });
});
