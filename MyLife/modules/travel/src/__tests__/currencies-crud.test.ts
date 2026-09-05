import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import { createTrip } from '../db/crud/trips';
import {
  deleteRate,
  getRate,
  listRates,
  upsertRate,
} from '../db/crud/currencies';
import type { CurrencyRateInput } from '../models/schemas';

let adapter: DatabaseAdapter;
let closeDb: () => void;
let tripId: string;

function makeInput(
  overrides: Partial<CurrencyRateInput> = {},
): CurrencyRateInput {
  return {
    base: 'USD',
    quote: 'EUR',
    rate: 0.92,
    fetched_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  const testDb = createModuleTestDatabase('travel', TRAVEL_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
  const trip = createTrip(adapter, { name: 'Test Trip' });
  tripId = trip.id;
});

afterEach(() => {
  closeDb();
});

describe('upsertRate', () => {
  it('inserts a fresh rate with fx_ prefixed id', () => {
    const r = upsertRate(adapter, makeInput());
    expect(r.id).toMatch(/^fx_/);
    expect(r.base).toBe('USD');
    expect(r.quote).toBe('EUR');
    expect(r.rate).toBe(0.92);
    expect(r.trip_id).toBeNull();
    expect(r.created_at).toBeTruthy();
  });

  it('normalizes currency codes to uppercase', () => {
    const r = upsertRate(
      adapter,
      makeInput({ base: 'usd', quote: 'eur' }),
    );
    expect(r.base).toBe('USD');
    expect(r.quote).toBe('EUR');
  });

  it('replaces existing rate for same global (base, quote)', () => {
    upsertRate(adapter, makeInput({ rate: 0.9 }));
    upsertRate(adapter, makeInput({ rate: 0.95 }));
    const rows = listRates(adapter);
    expect(rows).toHaveLength(1);
    expect(rows[0].rate).toBe(0.95);
  });

  it('stores trip-scoped rates independently from global', () => {
    upsertRate(adapter, makeInput({ rate: 0.9 }));
    upsertRate(adapter, makeInput({ trip_id: tripId, rate: 0.88 }));
    const rows = listRates(adapter);
    expect(rows).toHaveLength(2);
  });

  it('persists source metadata', () => {
    const r = upsertRate(adapter, makeInput({ source: 'openexchange' }));
    expect(r.source).toBe('openexchange');
  });

  it('rejects non-3-letter codes', () => {
    expect(() => upsertRate(adapter, makeInput({ base: 'US' }))).toThrow();
    expect(() => upsertRate(adapter, makeInput({ quote: 'EURO' }))).toThrow();
  });

  it('rejects non-positive rate', () => {
    expect(() => upsertRate(adapter, makeInput({ rate: 0 }))).toThrow();
    expect(() => upsertRate(adapter, makeInput({ rate: -1 }))).toThrow();
  });
});

describe('getRate', () => {
  it('returns null when no rate exists', () => {
    expect(getRate(adapter, 'USD', 'EUR')).toBeNull();
  });

  it('returns the global rate', () => {
    upsertRate(adapter, makeInput());
    const r = getRate(adapter, 'USD', 'EUR');
    expect(r?.rate).toBe(0.92);
  });

  it('returns the trip-scoped rate when tripId is given', () => {
    upsertRate(adapter, makeInput({ rate: 0.9 }));
    upsertRate(adapter, makeInput({ trip_id: tripId, rate: 0.88 }));
    expect(getRate(adapter, 'USD', 'EUR', tripId)?.rate).toBe(0.88);
    expect(getRate(adapter, 'USD', 'EUR')?.rate).toBe(0.9);
  });

  it('is case-insensitive for lookup', () => {
    upsertRate(adapter, makeInput());
    expect(getRate(adapter, 'usd', 'eur')?.rate).toBe(0.92);
  });
});

describe('listRates', () => {
  it('returns empty array when no rates', () => {
    expect(listRates(adapter)).toEqual([]);
  });

  it('filters by tripId', () => {
    upsertRate(adapter, makeInput({ rate: 0.9 }));
    upsertRate(adapter, makeInput({ trip_id: tripId, rate: 0.88 }));
    const items = listRates(adapter, tripId);
    expect(items).toHaveLength(1);
    expect(items[0].trip_id).toBe(tripId);
  });
});

describe('deleteRate', () => {
  it('removes a rate by id', () => {
    const r = upsertRate(adapter, makeInput());
    deleteRate(adapter, r.id);
    expect(listRates(adapter)).toEqual([]);
  });

  it('cascades from trip delete when trip-scoped', () => {
    const r = upsertRate(adapter, makeInput({ trip_id: tripId }));
    adapter.execute(`DELETE FROM tv_trips WHERE id = ?`, [tripId]);
    const rows = adapter.query(
      `SELECT * FROM tv_currencies WHERE id = ?`,
      [r.id],
    );
    expect(rows).toHaveLength(0);
  });
});
