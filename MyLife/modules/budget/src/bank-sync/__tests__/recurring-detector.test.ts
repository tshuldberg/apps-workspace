/**
 * Tests for the bank-sync recurring charge detector.
 *
 * Verifies payee normalization, frequency detection, catalog matching,
 * confidence scoring, and the full detectRecurringCharges pipeline.
 *
 * Ported from standalone MyBudget, adapted for hub's CatalogEntryLike
 * interface and BankTransactionRecord shape.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizePayeeName,
  detectRecurringCharges,
  type CatalogEntryLike,
} from '../recurring-detector';
import type { BankTransactionRecord } from '../types';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function makeTxn(
  overrides: Partial<BankTransactionRecord>,
): BankTransactionRecord {
  return {
    id: 'txn-1',
    connectionId: 'conn-1',
    bankAccountId: 'ba-1',
    providerTransactionId: 'ptxn-1',
    pendingTransactionId: null,
    datePosted: '2026-01-15',
    dateAuthorized: null,
    payee: 'NETFLIX',
    memo: null,
    amount: 1599,
    currency: 'USD',
    category: null,
    isPending: false,
    rawJson: null,
    ...overrides,
  };
}

/** Generate a series of monthly transactions for a given payee. */
function monthlyTxns(
  payee: string,
  amount: number,
  startMonth: number,
  count: number,
): BankTransactionRecord[] {
  return Array.from({ length: count }, (_, i) => {
    const month = startMonth + i;
    const year = 2025 + Math.floor((month - 1) / 12);
    const m = ((month - 1) % 12) + 1;
    const datePosted = `${year}-${String(m).padStart(2, '0')}-15`;
    return makeTxn({
      id: `txn-${payee}-${i}`,
      providerTransactionId: `ptxn-${payee}-${i}`,
      payee,
      amount,
      datePosted,
    });
  });
}

const CATALOG: CatalogEntryLike[] = [
  { id: 'cat-netflix', name: 'Netflix' },
  { id: 'cat-spotify', name: 'Spotify' },
  { id: 'cat-hulu', name: 'Hulu' },
];

// ---------------------------------------------------------------------------
// normalizePayeeName
// ---------------------------------------------------------------------------

describe('normalizePayeeName', () => {
  it('lowercases and trims', () => {
    expect(normalizePayeeName('  NETFLIX  ')).toBe('netflix');
  });

  it('strips billing suffixes', () => {
    expect(normalizePayeeName('NETFLIX *MONTHLY')).toBe('netflix');
  });

  it('strips recurring keyword from middle', () => {
    expect(normalizePayeeName('SPOTIFY SUBSCRIPTION PAYMENT')).toBe('spotify');
  });

  it('strips hash/asterisk prefixed suffixes', () => {
    expect(normalizePayeeName('HULU # RECURRING')).toBe('hulu');
  });

  it('handles multiple billing keywords', () => {
    // Word-boundary-based keyword stripping (second regex pass)
    expect(normalizePayeeName('APPLE SUBSCRIPTION PAYMENT')).toBe('apple');
    // Asterisk-anchored stripping (first regex pass)
    expect(normalizePayeeName('APPLE *RECURRING')).toBe('apple');
  });

  it('handles auto-pay variants', () => {
    expect(normalizePayeeName('GYM AUTOPAY')).toBe('gym');
    expect(normalizePayeeName('GYM AUTO PAY')).toBe('gym');
    expect(normalizePayeeName('GYM AUTO-PAY')).toBe('gym');
  });

  it('preserves meaningful payee name with numeric suffix', () => {
    // Numeric suffixes after # are preserved (only keyword suffixes stripped)
    expect(normalizePayeeName('TRADER JOES #123')).toBe('trader joes 123');
  });

  it('returns empty string for billing-only payee', () => {
    expect(normalizePayeeName('MONTHLY PAYMENT')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// detectRecurringCharges
// ---------------------------------------------------------------------------

describe('detectRecurringCharges', () => {
  it('detects monthly recurring charges', () => {
    const txns = monthlyTxns('NETFLIX', 1599, 1, 4);
    const results = detectRecurringCharges(txns, [], CATALOG);

    expect(results).toHaveLength(1);
    expect(results[0]!.normalizedPayee).toBe('netflix');
    expect(results[0]!.frequency).toBe('monthly');
    expect(results[0]!.amount).toBe(1599);
    expect(results[0]!.matchedCatalogId).toBe('cat-netflix');
    expect(results[0]!.confidence).toBeGreaterThan(0.5);
  });

  it('skips single-transaction payees', () => {
    const txns = [makeTxn({ payee: 'RANDOM STORE', amount: 4200 })];
    const results = detectRecurringCharges(txns, [], CATALOG);
    expect(results).toHaveLength(0);
  });

  it('skips pending transactions', () => {
    const txns = [
      makeTxn({ id: 't1', payee: 'NETFLIX', datePosted: '2026-01-15', isPending: true }),
      makeTxn({ id: 't2', payee: 'NETFLIX', datePosted: '2026-02-15', isPending: true }),
      makeTxn({ id: 't3', payee: 'NETFLIX', datePosted: '2026-03-15', isPending: true }),
    ];
    const results = detectRecurringCharges(txns, [], CATALOG);
    expect(results).toHaveLength(0);
  });

  it('skips negative amounts (refunds/credits)', () => {
    const txns = [
      makeTxn({ id: 't1', payee: 'NETFLIX', datePosted: '2026-01-15', amount: -1599 }),
      makeTxn({ id: 't2', payee: 'NETFLIX', datePosted: '2026-02-15', amount: -1599 }),
      makeTxn({ id: 't3', payee: 'NETFLIX', datePosted: '2026-03-15', amount: -1599 }),
    ];
    const results = detectRecurringCharges(txns, [], CATALOG);
    expect(results).toHaveLength(0);
  });

  it('marks already-tracked subscriptions', () => {
    const txns = monthlyTxns('NETFLIX', 1599, 1, 4);
    const existing = [{ name: 'Netflix', catalog_id: 'cat-netflix' }];
    const results = detectRecurringCharges(txns, existing, CATALOG);

    expect(results).toHaveLength(1);
    expect(results[0]!.isAlreadyTracked).toBe(true);
  });

  it('marks tracked by name match even without catalog', () => {
    const txns = monthlyTxns('GYM MEMBERSHIP', 5000, 1, 4);
    const existing = [{ name: 'GYM MEMBERSHIP', catalog_id: null }];
    const results = detectRecurringCharges(txns, existing, []);

    expect(results).toHaveLength(1);
    expect(results[0]!.isAlreadyTracked).toBe(true);
  });

  it('detects weekly recurring charges', () => {
    const txns = Array.from({ length: 6 }, (_, i) => {
      const day = 5 + i * 7; // Every 7 days starting Jan 5
      const datePosted = `2026-01-${String(day).padStart(2, '0')}`;
      return makeTxn({
        id: `t${i}`,
        providerTransactionId: `ptxn-weekly-${i}`,
        payee: 'WEEKLY SERVICE',
        amount: 500,
        datePosted,
      });
    });
    const results = detectRecurringCharges(txns, [], []);

    expect(results).toHaveLength(1);
    expect(results[0]!.frequency).toBe('weekly');
  });

  it('returns results sorted by confidence descending', () => {
    const txns = [
      // Netflix: 6 months of data + catalog match -> high confidence
      ...monthlyTxns('NETFLIX', 1599, 1, 6),
      // Unknown service: only 2 data points, no catalog -> lower confidence
      ...monthlyTxns('MYSTERY SVC', 999, 1, 2),
    ];
    const results = detectRecurringCharges(txns, [], CATALOG);

    expect(results.length).toBeGreaterThanOrEqual(1);
    // Netflix should be first (higher confidence)
    expect(results[0]!.normalizedPayee).toBe('netflix');
  });

  it('catalog match boosts confidence', () => {
    const txnsWithCatalog = monthlyTxns('NETFLIX', 1599, 1, 3);
    const txnsNoCatalog = monthlyTxns('UNKNOWN SVC', 1599, 1, 3);

    const withCatalog = detectRecurringCharges(txnsWithCatalog, [], CATALOG);
    const noCatalog = detectRecurringCharges(txnsNoCatalog, [], CATALOG);

    expect(withCatalog[0]!.confidence).toBeGreaterThan(noCatalog[0]!.confidence);
  });

  it('skips payees with null payee name', () => {
    const txns = [
      makeTxn({ id: 't1', payee: null, datePosted: '2026-01-15' }),
      makeTxn({ id: 't2', payee: null, datePosted: '2026-02-15' }),
    ];
    const results = detectRecurringCharges(txns, [], CATALOG);
    expect(results).toHaveLength(0);
  });

  it('groups by normalized payee name (ignoring billing suffixes)', () => {
    const txns = [
      makeTxn({ id: 't1', payee: 'SPOTIFY *MONTHLY', amount: 999, datePosted: '2026-01-15' }),
      makeTxn({ id: 't2', payee: 'SPOTIFY SUBSCRIPTION', amount: 999, datePosted: '2026-02-15' }),
      makeTxn({ id: 't3', payee: 'SPOTIFY PAYMENT', amount: 999, datePosted: '2026-03-15' }),
    ];
    const results = detectRecurringCharges(txns, [], CATALOG);

    expect(results).toHaveLength(1);
    expect(results[0]!.normalizedPayee).toBe('spotify');
    expect(results[0]!.matchedCatalogId).toBe('cat-spotify');
    expect(results[0]!.transactionDates).toHaveLength(3);
  });

  it('uses most recent transaction amount', () => {
    const txns = [
      makeTxn({ id: 't1', payee: 'HULU', amount: 799, datePosted: '2026-01-15' }),
      makeTxn({ id: 't2', payee: 'HULU', amount: 799, datePosted: '2026-02-15' }),
      makeTxn({ id: 't3', payee: 'HULU', amount: 899, datePosted: '2026-03-15' }),
    ];
    const results = detectRecurringCharges(txns, [], CATALOG);

    expect(results[0]!.amount).toBe(899);
  });

  it('detects irregular intervals as unknown and excludes them', () => {
    // Intervals need to be truly irregular -- far from any frequency band
    const txns2 = [
      makeTxn({ id: 't1', payee: 'ODDPAY', amount: 500, datePosted: '2026-01-05' }),
      makeTxn({ id: 't2', payee: 'ODDPAY', amount: 500, datePosted: '2026-01-22' }),
      makeTxn({ id: 't3', payee: 'ODDPAY', amount: 500, datePosted: '2026-03-22' }),
    ];
    const results2 = detectRecurringCharges(txns2, [], []);
    // Intervals: 17, 59 days. Median ~38 -- outside weekly (7±2), monthly (30±5), annual (365±15)
    expect(results2).toHaveLength(0);
  });
});
