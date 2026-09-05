import { describe, expect, it } from 'vitest';
import {
  classifyExpiration,
  daysUntilExpiration,
  getPantryUseNextBatch,
  parseExpirationDateCandidates,
  recognizeExpirationDates,
  createStaticExpirationOcrProvider,
  getExpirationColor,
  getExpirationLabel,
  groupPantryBatchesByExpiration,
} from '../expiration';
import type { PantryBatch } from '../../types';

const makeLocalDate = (year: number, month: number, day: number) => new Date(year, month - 1, day);

describe('expiration helpers', () => {
  const now = makeLocalDate(2026, 3, 1);

  it('classifies fresh, expiring soon, and expired dates', () => {
    expect(classifyExpiration('2026-03-11', now)).toBe('fresh');
    expect(classifyExpiration('2026-03-03', now)).toBe('expiring_soon');
    expect(classifyExpiration('2026-02-28', now)).toBe('expired');
  });

  it('computes days until expiration', () => {
    expect(daysUntilExpiration('2026-03-06', now)).toBe(5);
    expect(daysUntilExpiration('2026-03-01', now)).toBe(0);
  });

  it('maps display colors and labels', () => {
    expect(getExpirationColor('fresh')).toBe('#4ECDC4');
    expect(getExpirationLabel('expiring_soon', 2)).toBe('Expiring soon (2 days left)');
  });

  it('groups pantry batches into urgency sections and selects the use-next batch', () => {
    const makeBatch = (id: string, expirationDate: string | null, quantity = 1): PantryBatch => ({
      id,
      pantry_item_id: 'pantry-1',
      lot_code: null,
      quantity,
      unit: 'bag',
      expiration_date: expirationDate,
      purchase_date: null,
      source: 'manual',
      receipt_link: null,
      photos: [],
      created_at: '2026-03-01T00:00:00.000Z',
      updated_at: '2026-03-01T00:00:00.000Z',
    });
    const batches = [
      makeBatch('fresh', '2026-03-20'),
      makeBatch('expired', '2026-02-28'),
      makeBatch('soon', '2026-03-03'),
      makeBatch('no-date', null),
    ];

    expect(getPantryUseNextBatch(batches, now)?.id).toBe('expired');
    expect(groupPantryBatchesByExpiration(batches, now).map((section) => [
      section.status,
      section.batches.map((batch) => batch.id),
    ])).toEqual([
      ['expired', ['expired']],
      ['expiring_soon', ['soon']],
      ['fresh', ['fresh']],
      ['no_date', ['no-date']],
    ]);
  });

  it('extracts normalized expiration dates from OCR text', () => {
    const candidates = parseExpirationDateCandidates('BEST BY APR 05 2026 LOT A17\nPacked 2026-03-30');

    expect(candidates[0]).toMatchObject({
      normalizedDate: '2026-04-05',
      reason: 'Detected written month date.',
      context: expect.stringContaining('BEST BY APR 05 2026'),
      requiresManualSelection: false,
    });
    expect(candidates.map((candidate) => candidate.normalizedDate)).toContain('2026-03-30');
  });

  it('returns both interpretations for ambiguous slash dates', () => {
    const candidates = parseExpirationDateCandidates('USE BY 03/04/26 LOT A17');

    expect(candidates.map((candidate) => candidate.normalizedDate)).toEqual(
      expect.arrayContaining(['2026-03-04', '2026-04-03']),
    );
    expect(candidates.every((candidate) => candidate.requiresManualSelection)).toBe(true);
    expect(candidates[0]?.reason).toContain('Ambiguous slash date');
  });

  it('runs expiration OCR providers and parses date candidates', async () => {
    const result = await recognizeExpirationDates(
      {
        photoUri: 'file://eggs.jpg',
        cropUri: 'file://eggs-expiration-crop.jpg',
        boundingBox: { x: 0.2, y: 0.3, width: 0.4, height: 0.15 },
      },
      createStaticExpirationOcrProvider('EXP 05/03/2026\nLOT L-47'),
    );

    expect(result.rawText).toContain('EXP');
    expect(result.providerStatus).toBe('manual');
    expect(result.candidates[0]).toMatchObject({
      normalizedDate: '2026-05-03',
      crop_uri: 'file://eggs-expiration-crop.jpg',
      bounding_box: { x: 0.2, y: 0.3, width: 0.4, height: 0.15 },
    });
  });

  it('returns an empty review when the expiration OCR provider is unavailable', async () => {
    const result = await recognizeExpirationDates(
      { photoUri: 'file://eggs.jpg' },
      {
        id: 'fixture-outage',
        async recognize() {
          throw new Error('Vision provider unavailable');
        },
      },
    );

    expect(result.rawText).toBe('');
    expect(result.confidence).toBe(0);
    expect(result.candidates).toEqual([]);
    expect(result.providerStatus).toBe('failed');
    expect(result.providerError).toBe('Vision provider unavailable');
    expect(result.providerRawJson).toEqual({ error: 'Vision provider unavailable' });
  });
});
