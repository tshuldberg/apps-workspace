import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import { createTrip } from '../db/crud/trips';
import {
  estimateBudgetVsActual,
  getTripSpendingTotal,
} from '../integrations/budget-link';

function createBudgetTables(adapter: DatabaseAdapter): void {
  adapter.execute(`
    CREATE TABLE bg_envelopes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )
  `);
  adapter.execute(`
    CREATE TABLE bg_transactions (
      id TEXT PRIMARY KEY,
      envelope_id TEXT,
      amount INTEGER NOT NULL,
      direction TEXT NOT NULL,
      occurred_on TEXT NOT NULL
    )
  `);
}

function insertEnvelope(
  adapter: DatabaseAdapter,
  id: string,
  name: string,
): void {
  adapter.execute(
    `INSERT INTO bg_envelopes (id, name) VALUES (?, ?)`,
    [id, name],
  );
}

function insertTxn(
  adapter: DatabaseAdapter,
  params: {
    id: string;
    envelopeId?: string | null;
    amount: number;
    direction: 'outflow' | 'inflow' | 'transfer';
    occurredOn: string;
  },
): void {
  adapter.execute(
    `INSERT INTO bg_transactions (id, envelope_id, amount, direction, occurred_on)
     VALUES (?, ?, ?, ?, ?)`,
    [
      params.id,
      params.envelopeId ?? null,
      params.amount,
      params.direction,
      params.occurredOn,
    ],
  );
}

describe('@mylife/travel budget-link integration', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('travel', TRAVEL_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('returns zeroes when the trip does not exist', () => {
    createBudgetTables(adapter);
    const result = getTripSpendingTotal(adapter, 'trip_missing');
    expect(result).toEqual({ totalCents: 0, byCategory: {} });
  });

  it('returns zeroes when the trip has no window', () => {
    createBudgetTables(adapter);
    const trip = createTrip(adapter, { name: 'Undated' });
    const result = getTripSpendingTotal(adapter, trip.id);
    expect(result).toEqual({ totalCents: 0, byCategory: {} });
  });

  it('returns zeroes when bg_transactions is missing (budget not installed)', () => {
    const trip = createTrip(adapter, {
      name: 'Tokyo',
      start_date: '2026-06-01',
      end_date: '2026-06-10',
    });
    const result = getTripSpendingTotal(adapter, trip.id);
    expect(result).toEqual({ totalCents: 0, byCategory: {} });
  });

  it('sums outflows inside the window and groups by envelope name', () => {
    createBudgetTables(adapter);
    insertEnvelope(adapter, 'env_food', 'Food');
    insertEnvelope(adapter, 'env_travel', 'Travel');

    const trip = createTrip(adapter, {
      name: 'Tokyo',
      start_date: '2026-06-01',
      end_date: '2026-06-10',
    });

    insertTxn(adapter, {
      id: 't_before',
      envelopeId: 'env_food',
      amount: 2000,
      direction: 'outflow',
      occurredOn: '2026-05-30',
    });
    insertTxn(adapter, {
      id: 't_food_1',
      envelopeId: 'env_food',
      amount: 4500,
      direction: 'outflow',
      occurredOn: '2026-06-02',
    });
    insertTxn(adapter, {
      id: 't_food_2',
      envelopeId: 'env_food',
      amount: 1500,
      direction: 'outflow',
      occurredOn: '2026-06-05',
    });
    insertTxn(adapter, {
      id: 't_travel',
      envelopeId: 'env_travel',
      amount: 30000,
      direction: 'outflow',
      occurredOn: '2026-06-10',
    });
    insertTxn(adapter, {
      id: 't_inflow',
      envelopeId: 'env_food',
      amount: 10000,
      direction: 'inflow',
      occurredOn: '2026-06-03',
    });
    insertTxn(adapter, {
      id: 't_after',
      envelopeId: 'env_travel',
      amount: 9999,
      direction: 'outflow',
      occurredOn: '2026-06-11',
    });

    const result = getTripSpendingTotal(adapter, trip.id);
    expect(result.totalCents).toBe(4500 + 1500 + 30000);
    expect(result.byCategory).toEqual({
      Food: 6000,
      Travel: 30000,
    });
  });

  it('handles transactions without an envelope (uncategorized)', () => {
    createBudgetTables(adapter);
    const trip = createTrip(adapter, {
      name: 'Tokyo',
      start_date: '2026-06-01',
      end_date: '2026-06-10',
    });
    insertTxn(adapter, {
      id: 't_1',
      envelopeId: null,
      amount: 2500,
      direction: 'outflow',
      occurredOn: '2026-06-05',
    });

    const result = getTripSpendingTotal(adapter, trip.id);
    expect(result.totalCents).toBe(2500);
    expect(result.byCategory).toEqual({});
  });

  it('estimateBudgetVsActual computes delta when estimate is a positive number', () => {
    const result = estimateBudgetVsActual(100_000, 120_000);
    expect(result.deltaCents).toBe(20_000);
    expect(result.pctUsed).toBeCloseTo(1.2, 5);
  });

  it('estimateBudgetVsActual omits pctUsed when estimate is null/undefined/0', () => {
    const a = estimateBudgetVsActual(null, 5000);
    expect(a).toEqual({ deltaCents: 5000 });
    const b = estimateBudgetVsActual(undefined, 5000);
    expect(b).toEqual({ deltaCents: 5000 });
    const c = estimateBudgetVsActual(0, 5000);
    expect(c).toEqual({ deltaCents: 5000 });
  });

  it('estimateBudgetVsActual returns negative delta when under budget', () => {
    const result = estimateBudgetVsActual(100_000, 40_000);
    expect(result.deltaCents).toBe(-60_000);
    expect(result.pctUsed).toBeCloseTo(0.4, 5);
  });
});
