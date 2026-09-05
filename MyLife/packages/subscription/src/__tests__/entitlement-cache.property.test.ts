import { describe, expect, it, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { MODULE_IDS, FREE_MODULES } from '@mylife/module-registry';
import type { ModuleId } from '@mylife/module-registry';
import { isModuleUnlocked } from '@mylife/entitlements';
import type { StorageTier } from '@mylife/entitlements';
import { EntitlementCache, type EntitlementCacheDb } from '../entitlement-cache';

/** In-memory SQLite mock for EntitlementCacheDb. */
function createMockDb(): EntitlementCacheDb {
  const rows = new Map<string, Record<string, unknown>>();
  return {
    execute(sql: string, params?: unknown[]): void {
      if (sql.includes('DELETE FROM')) {
        rows.clear();
        return;
      }
      if (sql.includes('INSERT INTO') && params) {
        const [moduleId, entitled, source, cachedAt, expiresAt] = params as [
          string,
          number,
          string,
          string,
          string | null,
        ];
        rows.set(moduleId, {
          module_id: moduleId,
          entitled,
          source,
          cached_at: cachedAt,
          expires_at: expiresAt,
        });
      }
    },
    query<T>(sql: string, params?: unknown[]): T[] {
      // getCachedEntitlement: WHERE module_id = ?
      if (sql.includes('WHERE module_id') && params && params.length === 1) {
        const row = rows.get(params[0] as string);
        if (!row) return [];
        if (
          row.expires_at &&
          Date.now() > Date.parse(row.expires_at as string)
        ) {
          return [];
        }
        return [row as T];
      }
      // getAllCachedEntitlements: WHERE expires_at IS NULL OR expires_at > ?
      const result: T[] = [];
      for (const row of rows.values()) {
        if (
          row.expires_at &&
          Date.now() > Date.parse(row.expires_at as string)
        ) {
          continue;
        }
        result.push(row as T);
      }
      return result;
    },
    transaction(fn: () => void): void {
      fn();
    },
  };
}

/** Arbitrary for a subset of module IDs (for unlockedModules set). */
const moduleIdSubsetArb = fc
  .subarray([...MODULE_IDS], { minLength: 0 })
  .map((ids) => new Set(ids as ModuleId[]));

const storageTierArb = fc.constantFrom(
  'free',
  'starter',
  'power',
) as fc.Arbitrary<StorageTier>;

const entitlementStateArb = fc.record({
  hubUnlocked: fc.boolean(),
  unlockedModules: moduleIdSubsetArb,
  storageTier: storageTierArb,
  updateEntitled: fc.boolean(),
  purchaseDate: fc.constant(null) as fc.Arbitrary<Date | null>,
});

const sourceArb = fc.constantFrom(
  'revenuecat' as const,
  'stripe' as const,
);

describe('Property 7: Cached entitlements survive network failure', () => {
  beforeEach(() => {
    // Each test creates its own db+cache per property iteration
  });

  it('persist then buildStateFromCache never revokes previously unlocked modules', () => {
    fc.assert(
      fc.property(entitlementStateArb, sourceArb, (state, source) => {
        const localDb = createMockDb();
        const localCache = new EntitlementCache(localDb);

        localCache.persistState(MODULE_IDS, state, source);

        // Simulate network failure: rebuild from cache only
        const restored = localCache.buildStateFromCache();

        // Core guarantee: every module that was unlocked stays unlocked.
        // The cache may be MORE permissive (hub-unlock heuristic), never less.
        for (const moduleId of MODULE_IDS) {
          const originallyUnlocked = isModuleUnlocked(moduleId, state);
          if (originallyUnlocked) {
            const restoredUnlocked = isModuleUnlocked(moduleId, restored);
            expect(restoredUnlocked).toBe(true);
          }
        }
      }),
      { numRuns: 50 },
    );
  });

  it('cached free modules are always entitled', () => {
    fc.assert(
      fc.property(entitlementStateArb, sourceArb, (state, source) => {
        const localDb = createMockDb();
        const localCache = new EntitlementCache(localDb);

        localCache.persistState(MODULE_IDS, state, source);

        for (const freeId of FREE_MODULES) {
          const cached = localCache.getCachedEntitlement(freeId);
          expect(cached).not.toBeNull();
          expect(cached!.entitled).toBe(true);
          expect(cached!.source).toBe('free');
        }
      }),
      { numRuns: 20 },
    );
  });

  it('cache clear removes all entries, buildStateFromCache returns empty state', () => {
    fc.assert(
      fc.property(entitlementStateArb, sourceArb, (state, source) => {
        const localDb = createMockDb();
        const localCache = new EntitlementCache(localDb);

        localCache.persistState(MODULE_IDS, state, source);
        localCache.clear();

        const restored = localCache.buildStateFromCache();
        expect(restored.hubUnlocked).toBe(false);
        expect(restored.unlockedModules.size).toBe(0);
      }),
      { numRuns: 20 },
    );
  });

  it('getCachedEntitlement returns correct entitled flag for each module', () => {
    fc.assert(
      fc.property(
        entitlementStateArb,
        sourceArb,
        fc.constantFrom(...MODULE_IDS) as fc.Arbitrary<ModuleId>,
        (state, source, moduleId) => {
          const localDb = createMockDb();
          const localCache = new EntitlementCache(localDb);

          localCache.persistState(MODULE_IDS, state, source);

          const cached = localCache.getCachedEntitlement(moduleId);
          expect(cached).not.toBeNull();
          expect(cached!.entitled).toBe(isModuleUnlocked(moduleId, state));
        },
      ),
      { numRuns: 50 },
    );
  });
});
