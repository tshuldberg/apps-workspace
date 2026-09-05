// Plan 38 C.7 (MOBILE): the pure pin-class / budget / eviction engine. Proves the
// eviction matrix (each class behavior, LRU order, impossible-fit honest error),
// the budget parse round trip, the class summary math, and that the canonical
// last-copy / budget / dedup strings are the exact locked copy. The web twin runs
// the identical assertions against apps/meerkat-web/src/lib/library-storage-core.ts.

import { describe, it, expect } from 'vitest';
import {
  evictToBudget,
  wouldExceedBudget,
  summarizePinClasses,
  parseStorageBudget,
  serializeStorageBudget,
  pinKey,
  STORAGE_BUDGET_PRESETS,
  KEEP_ON_DEVICE_LABEL,
  LAST_COPY_DELETE_CONFIRM,
  STORAGE_BUDGET_EXCEEDED_ERROR,
  MULTI_COMMUNITY_STORAGE_COPY,
  LIBRARY_STORAGE_BUDGET_SETTING_KEY,
  type StoredPin,
} from '../(root)/data/library-storage-core';

const CTX = 'ws-1';

function pin(contentId: string, pinClass: StoredPin['pinClass'], bytes: number, lastUsed: string): StoredPin {
  return { contentId, context: CTX, pinClass, bytes, lastUsed };
}

describe('evictToBudget', () => {
  it('never evicts under a null (unlimited) budget', () => {
    const pins = [pin('a', 'fetch_cache', 100, '2026-01-01T00:00:00.000Z')];
    const plan = evictToBudget({ pins, budgetBytes: null });
    expect(plan.evict).toEqual([]);
    expect(plan.impossible).toBe(false);
    expect(plan.storedBytesAfter).toBe(100);
  });

  it('evicts fetch_cache LRU-first until under budget, never touching protected classes', () => {
    const pins = [
      pin('authored', 'authored', 100, '2026-01-01T00:00:00.000Z'),
      pin('kept', 'explicit', 100, '2026-01-01T00:00:00.000Z'),
      pin('policy', 'policy', 100, '2026-01-01T00:00:00.000Z'),
      pin('oldCache', 'fetch_cache', 100, '2026-01-01T00:00:00.000Z'),
      pin('newCache', 'fetch_cache', 100, '2026-06-01T00:00:00.000Z'),
    ]; // total 500, budget 400 -> must drop exactly one fetch_cache (the LRU one)
    const plan = evictToBudget({ pins, budgetBytes: 400 });
    expect(plan.evict).toEqual([{ contentId: 'oldCache', context: CTX }]);
    expect(plan.impossible).toBe(false);
    expect(plan.freedBytes).toBe(100);
    expect(plan.storedBytesAfter).toBe(400);
  });

  it('evicts multiple caches LRU-first in order', () => {
    const pins = [
      pin('c3', 'fetch_cache', 100, '2026-03-01T00:00:00.000Z'),
      pin('c1', 'fetch_cache', 100, '2026-01-01T00:00:00.000Z'),
      pin('c2', 'fetch_cache', 100, '2026-02-01T00:00:00.000Z'),
    ]; // total 300, budget 100 -> drop the two oldest
    const plan = evictToBudget({ pins, budgetBytes: 100 });
    expect(plan.evict.map((e) => e.contentId)).toEqual(['c1', 'c2']);
    expect(plan.storedBytesAfter).toBe(100);
  });

  it('flags an impossible fit when protected classes alone exceed the budget, and evicts all cache', () => {
    const pins = [
      pin('authored', 'authored', 500, '2026-01-01T00:00:00.000Z'),
      pin('cache', 'fetch_cache', 100, '2026-01-01T00:00:00.000Z'),
    ]; // protected 500 > budget 300 -> impossible; cache still freed, nothing further
    const plan = evictToBudget({ pins, budgetBytes: 300 });
    expect(plan.impossible).toBe(true);
    expect(plan.evict).toEqual([{ contentId: 'cache', context: CTX }]);
    expect(plan.protectedBytes).toBe(500);
  });
});

describe('wouldExceedBudget', () => {
  it('is false under an unlimited budget', () => {
    const pins = [pin('a', 'fetch_cache', 1_000_000, '2026-01-01T00:00:00.000Z')];
    expect(wouldExceedBudget({ pins, budgetBytes: null, promote: new Set([pinKey('a', CTX)]) })).toBe(false);
  });

  it('is true when promoting a cache pin pushes the protected total over the budget', () => {
    const pins = [
      pin('authored', 'authored', 200, '2026-01-01T00:00:00.000Z'),
      pin('cache', 'fetch_cache', 200, '2026-01-01T00:00:00.000Z'),
    ];
    expect(wouldExceedBudget({ pins, budgetBytes: 300, promote: new Set([pinKey('cache', CTX)]) })).toBe(true);
    expect(wouldExceedBudget({ pins, budgetBytes: 300, promote: new Set() })).toBe(false);
  });
});

describe('summarizePinClasses', () => {
  it('counts and sums bytes per class', () => {
    const pins = [
      pin('a', 'authored', 10, 'x'),
      pin('b', 'authored', 20, 'x'),
      pin('c', 'fetch_cache', 5, 'x'),
    ];
    const s = summarizePinClasses(pins);
    expect(s.authored).toEqual({ count: 2, bytes: 30 });
    expect(s.fetch_cache).toEqual({ count: 1, bytes: 5 });
    expect(s.explicit).toEqual({ count: 0, bytes: 0 });
    expect(s.policy).toEqual({ count: 0, bytes: 0 });
  });
});

describe('budget parse/serialize', () => {
  it('treats blank / non-positive as unlimited (null) and round-trips a positive budget', () => {
    expect(parseStorageBudget(null)).toBeNull();
    expect(parseStorageBudget('')).toBeNull();
    expect(parseStorageBudget('0')).toBeNull();
    expect(parseStorageBudget('-5')).toBeNull();
    expect(parseStorageBudget('1073741824')).toBe(1073741824);
    expect(serializeStorageBudget(null)).toBe('');
    expect(parseStorageBudget(serializeStorageBudget(5_000_000))).toBe(5_000_000);
  });

  it('offers an Unlimited (null) preset', () => {
    expect(STORAGE_BUDGET_PRESETS[0]).toEqual({ label: 'Unlimited', bytes: null });
  });
});

describe('canonical copy (parity-locked)', () => {
  it('exposes the exact last-copy / budget / dedup / label strings', () => {
    expect(KEEP_ON_DEVICE_LABEL).toBe('Keep on this device');
    expect(LAST_COPY_DELETE_CONFIRM).toBe(
      'This device is deleting its copy. Meerkat cannot know if other members still hold it.',
    );
    expect(STORAGE_BUDGET_EXCEEDED_ERROR).toBe(
      'Your kept items exceed the storage budget. Raise the budget or remove kept items.',
    );
    expect(MULTI_COMMUNITY_STORAGE_COPY).toBe(
      'The same file saved in more than one community is stored once per community on this device.',
    );
    expect(LIBRARY_STORAGE_BUDGET_SETTING_KEY).toBe('library_storage_budget_bytes');
  });
});
