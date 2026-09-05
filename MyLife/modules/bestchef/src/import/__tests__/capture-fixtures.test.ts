import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RECIPES_MODULE } from '../../definition';
import { createPantryItem, getPantryItems } from '../../db/pantry';
import { createReceiptImportDraft, createStaticReceiptOcrProvider } from '../receipt-import';
import { enrichFoodRecognitionCandidates, parseFoodRecognitionResult } from '../../pantry/food-recognition';
import { createStaticExpirationOcrProvider, recognizeExpirationDates } from '../../pantry/expiration';
import type { NutritionProviderAdapter } from '../../types';

const RECEIPT_FIXTURES = [
  {
    id: 'clear',
    rawText: `LOCAL MARKET
04/25/2026
ORGANIC MILK $5.99
BANANAS $2.49
TOTAL $8.48`,
    expectedMinLines: 2,
  },
  {
    id: 'noisy',
    rawText: `LOCAL MARKET
*** CUSTOMER COPY ***
REGISTER 04 CASHIER 12
ORGANIC MILK $5.99
LOYALTY SAVINGS -$1.00
BANANAS $2.49
SUBTOTAL $7.48
TAX $0.61
TOTAL $8.09`,
    expectedMinLines: 2,
  },
  {
    id: 'partial',
    rawText: `LOCAL MARKET
THANK YOU
TOTAL $8.48`,
    expectedMinLines: 0,
  },
  {
    id: 'ambiguous',
    rawText: `LOCAL MARKET
04/25/2026
MILK $5.99
TOTAL $5.99`,
    expectedMinLines: 1,
  },
  {
    id: 'sensitive-payment',
    rawText: `LOCAL MARKET
04/25/2026
ORGANIC MILK $5.99
VISA **** 4242 $5.99
TOTAL $5.99`,
    expectedMinLines: 1,
  },
] as const;

const GROCERY_PHOTO_FIXTURES = {
  clearMultiItem: JSON.stringify({
    candidates: [
      {
        name: 'Organic Milk',
        category: 'dairy',
        storage_location: 'fridge',
        confidence: 0.91,
        labels: ['organic milk', 'whole milk', '049000042566'],
        quantity: 1,
        unit: 'gallon',
        bounding_box: { x: 0.08, y: 0.15, width: 0.4, height: 0.56 },
        crop_uri: 'file://fixture-milk-crop.jpg',
      },
      {
        name: 'Bananas',
        category: 'produce',
        storage_location: 'counter',
        confidence: 0.84,
        labels: ['banana bunch', '0000000004011'],
        quantity: 6,
        unit: 'count',
      },
    ],
  }),
  noisyProviderMarkdown: `\`\`\`json
{
  "labels": ["milk", "banana", "crumpled receipt corner"],
  "candidates": [
    { "name": "Bananas", "category": "produce", "confidence": 0.82, "labels": ["banana bunch"], "quantity": "6", "unit": "count" },
    { "category": "other", "confidence": 0.2, "labels": ["blur"] }
  ]
}
\`\`\``,
  nonFood: JSON.stringify({
    labels: ['paper towels', 'dish soap', 'checkout bag'],
    candidates: [],
  }),
} as const;

const EXPIRATION_FIXTURES = {
  clear: 'BEST BY 05/03/2026\nLOT L-47',
  ambiguous: 'USE BY 03/04/26\nPACKED 2026-03-01\nLOT 030426',
  partialNoDate: 'LOT L-47\nBEST BEFORE SEE LID',
} as const;

describe('BestChef deterministic capture fixtures', () => {
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

  it.each(RECEIPT_FIXTURES)('parses receipt OCR fixture $id without live providers', async (fixture) => {
    if (fixture.id === 'ambiguous') {
      createPantryItem(db, {
        name: 'Organic Milk',
        quantity: 1,
        unit: 'gallon',
        storage_location: 'fridge',
        grocery_section: 'dairy',
      });
    }

    const review = await createReceiptImportDraft(
      db,
      { photoUri: `file://${fixture.id}-receipt.jpg` },
      createStaticReceiptOcrProvider(`fixture-${fixture.id}`, {
        rawText: fixture.rawText,
        confidence: 0.88,
      }),
    );

    expect(review.receipt.ocr_provider).toBe(`fixture-${fixture.id}`);
    expect(review.receipt.provider_status).toBe(fixture.rawText.includes('TOTAL') ? 'parsed' : 'failed');
    expect(review.lines.length).toBeGreaterThanOrEqual(fixture.expectedMinLines);
    expect(getPantryItems(db)).toHaveLength(fixture.id === 'ambiguous' ? 1 : 0);

    if (fixture.id === 'sensitive-payment') {
      expect(review.receipt.raw_ocr_text).toContain('4242');
      expect(review.receipt.redacted_ocr_text).not.toContain('4242');
      expect(JSON.parse(review.receipt.redactions_json)).toEqual([
        expect.objectContaining({ reason: 'payment' }),
      ]);
    }
  });

  it('records receipt OCR provider outage without creating pantry rows', async () => {
    const review = await createReceiptImportDraft(
      db,
      { photoUri: 'file://receipt-provider-outage.jpg' },
      {
        id: 'fixture-receipt-outage',
        async recognize() {
          throw new Error('receipt OCR provider unavailable');
        },
      },
    );

    expect(review.receipt.provider_status).toBe('failed');
    expect(review.receipt.provider_error).toBe('receipt OCR provider unavailable');
    expect(review.lines).toEqual([]);
    expect(getPantryItems(db)).toEqual([]);
  });

  it('parses grocery photo fixtures for multi-item, noisy, and non-food cases', () => {
    const clear = parseFoodRecognitionResult(GROCERY_PHOTO_FIXTURES.clearMultiItem);
    const noisy = parseFoodRecognitionResult(GROCERY_PHOTO_FIXTURES.noisyProviderMarkdown);
    const nonFood = parseFoodRecognitionResult(GROCERY_PHOTO_FIXTURES.nonFood);

    expect(clear.candidates.map((candidate) => candidate.name)).toEqual(['Organic Milk', 'Bananas']);
    expect(clear.candidates[0]?.barcode).toBe('049000042566');
    expect(clear.candidates[0]?.bounding_box).toEqual({ x: 0.08, y: 0.15, width: 0.4, height: 0.56 });
    expect(clear.candidates[0]?.crop_uri).toBe('file://fixture-milk-crop.jpg');
    expect(noisy.candidates).toHaveLength(1);
    expect(noisy.candidates[0]).toMatchObject({
      name: 'Bananas',
      quantity: 6,
      unit: 'count',
    });
    expect(nonFood.labels).toEqual(['paper towels', 'dish soap', 'checkout bag']);
    expect(nonFood.candidates).toEqual([]);
  });

  it('keeps grocery photo nutrition provider outages and cancellations review-only', async () => {
    const provider: NutritionProviderAdapter = {
      source: 'usda_fdc',
      async search() {
        throw new Error('nutrition provider unavailable');
      },
    };
    const parsed = parseFoodRecognitionResult(GROCERY_PHOTO_FIXTURES.clearMultiItem);
    const enriched = await enrichFoodRecognitionCandidates(db, parsed.candidates, {
      providers: [provider],
      includeNetwork: true,
      fetchedAt: '2026-04-25T18:00:00.000Z',
    });

    expect(enriched).toHaveLength(2);
    expect(enriched[0]?.nutrition_provider_statuses).toEqual([
      {
        source: 'usda_fdc',
        status: 'error',
        message: 'nutrition provider unavailable',
      },
    ]);
    expect(enriched[0]?.nutrition_candidates.map((candidate) => candidate.source)).toEqual(['unknown']);
    expect(getPantryItems(db)).toEqual([]);
  });

  it('parses expiration OCR fixtures for clear, ambiguous, partial, and provider outage cases', async () => {
    const clear = await recognizeExpirationDates(
      { photoUri: 'file://clear-expiration.jpg' },
      createStaticExpirationOcrProvider(EXPIRATION_FIXTURES.clear, 0.9),
    );
    const ambiguous = await recognizeExpirationDates(
      { photoUri: 'file://ambiguous-expiration.jpg' },
      createStaticExpirationOcrProvider(EXPIRATION_FIXTURES.ambiguous, 0.76),
    );
    const partial = await recognizeExpirationDates(
      { photoUri: 'file://partial-expiration.jpg' },
      createStaticExpirationOcrProvider(EXPIRATION_FIXTURES.partialNoDate, 0.4),
    );
    const outage = await recognizeExpirationDates(
      { photoUri: 'file://outage-expiration.jpg' },
      {
        id: 'fixture-expiration-outage',
        async recognize() {
          throw new Error('expiration OCR provider unavailable');
        },
      },
    );

    expect(clear.candidates[0]?.normalizedDate).toBe('2026-05-03');
    expect(ambiguous.candidates.map((candidate) => candidate.normalizedDate)).toEqual(
      expect.arrayContaining(['2026-03-04', '2026-03-01']),
    );
    expect(partial.candidates).toEqual([]);
    expect(outage).toMatchObject({
      rawText: '',
      confidence: 0,
      candidates: [],
      providerRawJson: { error: 'expiration OCR provider unavailable' },
    });
    expect(getPantryItems(db)).toEqual([]);
  });
});
