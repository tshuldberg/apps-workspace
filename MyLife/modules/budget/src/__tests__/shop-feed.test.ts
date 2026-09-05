import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { BUDGET_MODULE } from '../definition';
import {
  acceptShopTransactionSuggestion,
  extractShopSourceId,
  getShopPendingSuggestions,
  type BudgetTransactionSuggestion,
} from '../integrations/shop-feed';
import { getEnvelopes, getTransactions } from '../db/crud';
import type { BudgetTransaction } from '../types';

function suggestion(
  overrides: Partial<BudgetTransactionSuggestion> = {},
): BudgetTransactionSuggestion {
  return {
    categoryName: 'Electronics',
    amountCents: 1500,
    descriptor: 'Headphones',
    occurredAt: '2026-04-15',
    sourceModule: 'shop',
    sourcePurchaseId: 'p_test',
    ...overrides,
  };
}

describe('extractShopSourceId', () => {
  it('returns the purchase id from a shop-tagged note', () => {
    expect(extractShopSourceId('[shop:p1] Headphones')).toBe('p1');
  });

  it('returns null for null/empty/non-shop notes', () => {
    expect(extractShopSourceId(null)).toBeNull();
    expect(extractShopSourceId('')).toBeNull();
    expect(extractShopSourceId('Just a manual note')).toBeNull();
    expect(extractShopSourceId('[shop:]')).toBeNull();
  });
});

describe('getShopPendingSuggestions', () => {
  it('returns [] for empty inputs', () => {
    expect(getShopPendingSuggestions([], [])).toEqual([]);
  });

  it('returns all suggestions when no transactions exist yet', () => {
    const sugs = [suggestion({ sourcePurchaseId: 'a' }), suggestion({ sourcePurchaseId: 'b' })];
    expect(getShopPendingSuggestions(sugs, [])).toEqual(sugs);
  });

  it('filters out suggestions whose sourcePurchaseId is already in budget transactions', () => {
    const sugs = [
      suggestion({ sourcePurchaseId: 'a' }),
      suggestion({ sourcePurchaseId: 'b' }),
      suggestion({ sourcePurchaseId: 'c' }),
    ];

    const tx = (id: string, note: string | null): BudgetTransaction => ({
      id,
      envelope_id: 'env_1',
      account_id: null,
      amount: 100,
      direction: 'outflow',
      merchant: null,
      note,
      occurred_on: '2026-04-15',
      created_at: '2026-04-15T00:00:00Z',
      updated_at: '2026-04-15T00:00:00Z',
    });

    const existing: BudgetTransaction[] = [
      tx('t1', '[shop:a] Headphones'),
      tx('t2', null), // manual entry, should not match anything
      tx('t3', '[shop:c] Mug'),
    ];

    expect(getShopPendingSuggestions(sugs, existing)).toEqual([
      suggestion({ sourcePurchaseId: 'b' }),
    ]);
  });
});

describe('acceptShopTransactionSuggestion', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('budget', BUDGET_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('returns null when called with a falsy suggestion', () => {
    expect(
      acceptShopTransactionSuggestion(adapter, null as unknown as BudgetTransactionSuggestion),
    ).toBeNull();
  });

  it('creates a new envelope by name when none exists, then inserts a transaction with shop provenance in the note', () => {
    const before = getEnvelopes(adapter, true);
    expect(before.find((e) => e.name === 'Electronics')).toBeUndefined();

    const tx = acceptShopTransactionSuggestion(
      adapter,
      suggestion({ sourcePurchaseId: 'p1', amountCents: 12999, descriptor: 'Headphones' }),
    );

    expect(tx).not.toBeNull();
    expect(tx!.amount).toBe(12999);
    expect(tx!.direction).toBe('outflow');
    expect(tx!.note).toBe('[shop:p1] Headphones');
    expect(tx!.occurred_on).toBe('2026-04-15');
    expect(extractShopSourceId(tx!.note)).toBe('p1');

    const after = getEnvelopes(adapter, true);
    const env = after.find((e) => e.name === 'Electronics');
    expect(env).toBeDefined();
    expect(tx!.envelope_id).toBe(env!.id);
  });

  it('reuses an existing envelope (case-insensitive match) instead of creating a duplicate', () => {
    const first = acceptShopTransactionSuggestion(
      adapter,
      suggestion({ sourcePurchaseId: 'p1', categoryName: 'Electronics' }),
    );
    const second = acceptShopTransactionSuggestion(
      adapter,
      suggestion({ sourcePurchaseId: 'p2', categoryName: 'electronics' }),
    );

    expect(first!.envelope_id).toBe(second!.envelope_id);

    const envelopes = getEnvelopes(adapter, true).filter(
      (e) => e.name.toLowerCase() === 'electronics',
    );
    expect(envelopes).toHaveLength(1);
  });

  it('after acceptance, the suggestion no longer appears in pending', () => {
    const sug = suggestion({ sourcePurchaseId: 'p1' });
    acceptShopTransactionSuggestion(adapter, sug);

    const existing = getTransactions(adapter, {});
    expect(getShopPendingSuggestions([sug], existing)).toEqual([]);
  });
});
