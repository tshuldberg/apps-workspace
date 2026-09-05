import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '../../definition';
import { enrichFoodRecognitionCandidates, parseFoodRecognitionResult } from '../food-recognition';
import type { NutritionProviderAdapter } from '../../types';

describe('food recognition', () => {
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

  it('parses multiple grocery candidates from provider JSON', () => {
    const result = parseFoodRecognitionResult(JSON.stringify({
      candidates: [
        {
          name: 'Organic Milk',
          category: 'dairy',
          storage_location: 'fridge',
          confidence: 0.91,
          labels: ['milk', 'organic'],
          quantity: 1,
          unit: 'gallon',
          barcode: '049000042566',
          bounding_box: { x: 0.1, y: 0.2, width: 0.4, height: 0.5 },
          crop_uri: 'file://milk-crop.jpg',
        },
        {
          name: 'Bananas',
          category: 'produce',
          confidence: 0.82,
          labels: ['banana bunch'],
        },
      ],
    }));

    expect(result.suggestedName).toBe('Organic Milk');
    expect(result.suggestedCategory).toBe('dairy');
    expect(result.candidates).toMatchObject([
      {
        name: 'Organic Milk',
        grocery_section: 'dairy',
        storage_location: 'fridge',
        confidence: 0.91,
        quantity: 1,
        unit: 'gallon',
        barcode: '049000042566',
        bounding_box: { x: 0.1, y: 0.2, width: 0.4, height: 0.5 },
        crop_uri: 'file://milk-crop.jpg',
      },
      {
        name: 'Bananas',
        grocery_section: 'produce',
        storage_location: 'fridge',
        confidence: 0.82,
        bounding_box: null,
        crop_uri: null,
      },
    ]);
  });

  it('enriches each grocery photo candidate with ranked nutrition source choices and unknown fallback', async () => {
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
          status: {
            source: 'usda_fdc',
            status: 'ok',
            message: 'stubbed',
          },
        };
      },
    };

    const result = parseFoodRecognitionResult(JSON.stringify({
      candidates: [
        {
          name: 'Bananas',
          category: 'produce',
          confidence: 0.84,
          labels: ['banana bunch', '0000000004011'],
        },
      ],
    }));
    const enriched = await enrichFoodRecognitionCandidates(adapter, result.candidates, {
      providers: [provider],
      includeNetwork: true,
      fetchedAt: '2026-04-25T15:05:00.000Z',
    });

    expect(enriched[0]?.barcode).toBe('0000000004011');
    expect(enriched[0]?.nutrition_candidates.map((candidate) => candidate.source)).toEqual([
      'usda_fdc',
      'unknown',
    ]);
    expect(enriched[0]?.nutrition_candidates[0]?.nutrients.calories).toBe(89);
    expect(enriched[0]?.nutrition_candidates[1]?.nutrients.calories).toBeNull();
    expect(enriched[0]?.nutrition_provider_statuses[0]?.status).toBe('ok');
  });

  it('keeps grocery photo candidates review-only when nutrition providers fail', async () => {
    const provider: NutritionProviderAdapter = {
      source: 'usda_fdc',
      async search() {
        throw new Error('USDA provider unavailable');
      },
    };
    const result = parseFoodRecognitionResult(JSON.stringify({
      candidates: [
        {
          name: 'Spinach',
          category: 'produce',
          confidence: 0.82,
          labels: ['spinach bag'],
          quantity: 1,
          unit: 'bag',
        },
      ],
    }));

    const enriched = await enrichFoodRecognitionCandidates(adapter, result.candidates, {
      providers: [provider],
      includeNetwork: true,
      fetchedAt: '2026-04-25T16:00:00.000Z',
    });

    expect(enriched[0]?.nutrition_provider_statuses).toEqual([
      {
        source: 'usda_fdc',
        status: 'error',
        message: 'USDA provider unavailable',
      },
    ]);
    expect(enriched[0]?.nutrition_candidates.map((candidate) => candidate.source)).toEqual(['unknown']);
    expect(adapter.query('SELECT * FROM rc_pantry_items')).toEqual([]);
  });
});
