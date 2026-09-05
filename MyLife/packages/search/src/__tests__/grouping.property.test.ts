/**
 * Property test for search result grouping (Property 24).
 *
 * Property 24: Search result grouping by module
 *   Results spanning multiple modules are grouped by moduleId with
 *   correct accent color and icon.
 *   Validates: Requirements 23.2
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { groupResultsByModule } from '../query';
import type { SearchResult, SearchModuleMeta } from '../query';

// ── Arbitraries ──────────────────────────────────────────────────────────

const MODULE_IDS = [
  'books', 'budget', 'car', 'closet', 'cycle', 'fast', 'flash',
  'forums', 'garden', 'habits', 'health', 'homes', 'journal', 'mail',
  'market', 'meds', 'mood', 'notes', 'nutrition', 'pets', 'recipes',
  'rsvp', 'sleep', 'stars', 'subs', 'surf', 'trails', 'voice', 'words', 'workouts',
] as const;

const moduleIdArb = fc.constantFrom(...MODULE_IDS);

const hexCharArb = fc.constantFrom(
  '0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f',
);
const hexColorArb = fc.tuple(hexCharArb, hexCharArb, hexCharArb, hexCharArb, hexCharArb, hexCharArb)
  .map((chars) => `#${chars.join('')}`);

const UPDATED_AT_MIN_MS = Date.UTC(2020, 0, 1);
const UPDATED_AT_MAX_MS = Date.UTC(2026, 11, 31, 23, 59, 59, 999);

const moduleMetaArb = fc.uniqueArray(moduleIdArb, { minLength: 1, maxLength: 10 }).chain(
  (ids) => fc.tuple(
    fc.constant(ids),
    fc.array(fc.tuple(fc.string({ minLength: 1, maxLength: 2 }), hexColorArb), { minLength: ids.length, maxLength: ids.length }),
  ).map(([moduleIds, attrs]): SearchModuleMeta[] =>
    moduleIds.map((id, i) => ({
      id,
      name: `My${id.charAt(0).toUpperCase()}${id.slice(1)}`,
      icon: attrs[i]![0],
      accentColor: attrs[i]![1],
    })),
  ),
);

const searchResultArb = (availableModuleIds: string[]): fc.Arbitrary<SearchResult> =>
  fc.record({
    moduleId: fc.constantFrom(...availableModuleIds),
    itemId: fc.uuid(),
    itemType: fc.constantFrom('book', 'transaction', 'recipe', 'workout', 'note'),
    title: fc.string({ minLength: 1, maxLength: 50 }),
    snippet: fc.string({ maxLength: 100 }),
    updatedAt: fc
      .integer({ min: UPDATED_AT_MIN_MS, max: UPDATED_AT_MAX_MS })
      .map((timestamp) => new Date(timestamp).toISOString()),
    rank: fc.double({ min: -20, max: 0, noNaN: true }),
  });

// ── Property tests ───────────────────────────────────────────────────────

describe('Property 24: Search result grouping by module', () => {
  it('every result appears in exactly one group (no lost, no duplicated)', () => {
    fc.assert(
      fc.property(
        moduleMetaArb.chain((meta) =>
          fc.tuple(
            fc.constant(meta),
            fc.array(searchResultArb(meta.map((m) => m.id)), { minLength: 0, maxLength: 30 }),
          ),
        ),
        ([meta, results]) => {
          const groups = groupResultsByModule(results, meta);

          // Flatten grouped results
          const grouped = groups.flatMap((g) => g.results);

          // Same count: nothing lost
          expect(grouped).toHaveLength(results.length);

          // Same item IDs: nothing duplicated
          const originalIds = results.map((r) => `${r.moduleId}:${r.itemId}`);
          const groupedIds = grouped.map((r) => `${r.moduleId}:${r.itemId}`);
          expect(groupedIds.sort()).toEqual(originalIds.sort());
        },
      ),
      { numRuns: 10 },
    );
  });

  it('each group has the correct accent color from module metadata', () => {
    fc.assert(
      fc.property(
        moduleMetaArb.chain((meta) =>
          fc.tuple(
            fc.constant(meta),
            fc.array(searchResultArb(meta.map((m) => m.id)), { minLength: 1, maxLength: 30 }),
          ),
        ),
        ([meta, results]) => {
          const metaMap = new Map(meta.map((m) => [m.id, m]));
          const groups = groupResultsByModule(results, meta);

          for (const group of groups) {
            const expected = metaMap.get(group.moduleId);
            expect(expected).toBeDefined();
            expect(group.accentColor).toBe(expected!.accentColor);
          }
        },
      ),
      { numRuns: 10 },
    );
  });

  it('each group has the correct icon from module metadata', () => {
    fc.assert(
      fc.property(
        moduleMetaArb.chain((meta) =>
          fc.tuple(
            fc.constant(meta),
            fc.array(searchResultArb(meta.map((m) => m.id)), { minLength: 1, maxLength: 30 }),
          ),
        ),
        ([meta, results]) => {
          const metaMap = new Map(meta.map((m) => [m.id, m]));
          const groups = groupResultsByModule(results, meta);

          for (const group of groups) {
            const expected = metaMap.get(group.moduleId);
            expect(expected).toBeDefined();
            expect(group.icon).toBe(expected!.icon);
          }
        },
      ),
      { numRuns: 10 },
    );
  });

  it('each group has the correct module name', () => {
    fc.assert(
      fc.property(
        moduleMetaArb.chain((meta) =>
          fc.tuple(
            fc.constant(meta),
            fc.array(searchResultArb(meta.map((m) => m.id)), { minLength: 1, maxLength: 30 }),
          ),
        ),
        ([meta, results]) => {
          const metaMap = new Map(meta.map((m) => [m.id, m]));
          const groups = groupResultsByModule(results, meta);

          for (const group of groups) {
            const expected = metaMap.get(group.moduleId);
            expect(expected).toBeDefined();
            expect(group.moduleName).toBe(expected!.name);
          }
        },
      ),
      { numRuns: 10 },
    );
  });

  it('all results within a group share the same moduleId', () => {
    fc.assert(
      fc.property(
        moduleMetaArb.chain((meta) =>
          fc.tuple(
            fc.constant(meta),
            fc.array(searchResultArb(meta.map((m) => m.id)), { minLength: 1, maxLength: 30 }),
          ),
        ),
        ([meta, results]) => {
          const groups = groupResultsByModule(results, meta);

          for (const group of groups) {
            for (const result of group.results) {
              expect(result.moduleId).toBe(group.moduleId);
            }
          }
        },
      ),
      { numRuns: 10 },
    );
  });

  it('number of groups equals number of distinct moduleIds in results', () => {
    fc.assert(
      fc.property(
        moduleMetaArb.chain((meta) =>
          fc.tuple(
            fc.constant(meta),
            fc.array(searchResultArb(meta.map((m) => m.id)), { minLength: 0, maxLength: 30 }),
          ),
        ),
        ([meta, results]) => {
          const groups = groupResultsByModule(results, meta);
          const distinctModules = new Set(results.map((r) => r.moduleId));
          expect(groups).toHaveLength(distinctModules.size);
        },
      ),
      { numRuns: 10 },
    );
  });

  it('group moduleIds are unique (no duplicate groups)', () => {
    fc.assert(
      fc.property(
        moduleMetaArb.chain((meta) =>
          fc.tuple(
            fc.constant(meta),
            fc.array(searchResultArb(meta.map((m) => m.id)), { minLength: 1, maxLength: 30 }),
          ),
        ),
        ([meta, results]) => {
          const groups = groupResultsByModule(results, meta);
          const ids = groups.map((g) => g.moduleId);
          expect(new Set(ids).size).toBe(ids.length);
        },
      ),
      { numRuns: 10 },
    );
  });

  it('empty results produce zero groups', () => {
    fc.assert(
      fc.property(
        moduleMetaArb,
        (meta) => {
          const groups = groupResultsByModule([], meta);
          expect(groups).toHaveLength(0);
        },
      ),
      { numRuns: 10 },
    );
  });

  it('unknown modules get fallback metadata', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            moduleId: fc.constant('unknown_module'),
            itemId: fc.uuid(),
            itemType: fc.constant('test'),
            title: fc.string({ minLength: 1, maxLength: 20 }),
            snippet: fc.constant(''),
            updatedAt: fc.constant('2026-01-01T00:00:00Z'),
            rank: fc.constant(0),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        (results) => {
          // Pass empty meta so the module is unknown
          const groups = groupResultsByModule(results, []);

          expect(groups).toHaveLength(1);
          expect(groups[0]!.moduleId).toBe('unknown_module');
          expect(groups[0]!.moduleName).toBe('unknown_module');
          expect(groups[0]!.icon).toBe('');
          expect(groups[0]!.accentColor).toBe('#888888');
        },
      ),
      { numRuns: 10 },
    );
  });

  it('result ordering within groups is preserved from input', () => {
    fc.assert(
      fc.property(
        moduleMetaArb.chain((meta) =>
          fc.tuple(
            fc.constant(meta),
            fc.array(searchResultArb(meta.map((m) => m.id)), { minLength: 2, maxLength: 30 }),
          ),
        ),
        ([meta, results]) => {
          const groups = groupResultsByModule(results, meta);

          for (const group of groups) {
            // Get the original order of results for this module
            const originalOrder = results
              .filter((r) => r.moduleId === group.moduleId)
              .map((r) => r.itemId);

            const groupOrder = group.results.map((r) => r.itemId);
            expect(groupOrder).toEqual(originalOrder);
          }
        },
      ),
      { numRuns: 10 },
    );
  });
});
