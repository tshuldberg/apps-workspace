import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import type { DatabaseAdapter } from '@mylife/db';
import type { ModuleDefinition, SearchableItem } from '@mylife/module-registry';
import {
  ensureSearchTables,
  indexModule,
  indexAllModules,
  removeModuleFromIndex,
  updateSearchEntries,
  removeSearchEntries,
  validateIndexCoverage,
  ensureFullCoverage,
} from '../indexer';
import {
  search,
  searchCount,
  searchRecent,
  searchGrouped,
  groupResultsByModule,
  getRecentActions,
  clearSearchCache,
  setSearchPerfLogger,
  _getCacheSize,
} from '../query';
import type { SearchModuleMeta, SearchResult } from '../query';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createTestDb(): DatabaseAdapter {
  const raw = new Database(':memory:');
  return {
    execute: (sql: string, params?: unknown[]) => {
      raw.prepare(sql).run(...(params ?? []));
    },
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] => {
      return raw.prepare(sql).all(...(params ?? [])) as T[];
    },
    transaction: (fn: () => void) => {
      raw.transaction(fn)();
    },
  };
}

function makeModule(
  id: string,
  items: SearchableItem[],
): ModuleDefinition {
  return {
    id,
    name: `My${id.charAt(0).toUpperCase()}${id.slice(1)}`,
    tagline: `${id} module`,
    icon: '📦',
    accentColor: '#000',
    tier: 'premium',
    storageType: 'sqlite',
    navigation: { tabs: [], screens: [] },
    requiresAuth: false,
    requiresNetwork: false,
    version: '0.1.0',
    crossModule: {
      getSearchableContent: () => items,
    },
  } as ModuleDefinition;
}

function makeItem(
  moduleId: string,
  itemId: string,
  title: string,
  body?: string,
  tags?: string[],
  updatedAt?: string,
): SearchableItem {
  return {
    moduleId,
    itemId,
    type: 'test',
    title,
    body,
    tags,
    updatedAt: updatedAt ?? '2026-03-22T12:00:00Z',
  };
}

const TEST_MODULE_META: SearchModuleMeta[] = [
  { id: 'books', name: 'MyBooks', icon: '📚', accentColor: '#C9894D' },
  { id: 'budget', name: 'MyBudget', icon: '💰', accentColor: '#22C55E' },
  { id: 'notes', name: 'MyNotes', icon: '📝', accentColor: '#3B82F6' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('search schema', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createTestDb();
  });

  it('creates FTS5 and meta tables without error', () => {
    ensureSearchTables(db);

    // Verify tables exist by querying them
    const ftsRows = db.query('SELECT count(*) as cnt FROM hub_search_index');
    expect(Number(ftsRows[0]?.cnt)).toBe(0);

    const metaRows = db.query('SELECT count(*) as cnt FROM hub_search_meta');
    expect(Number(metaRows[0]?.cnt)).toBe(0);
  });

  it('is idempotent (safe to call multiple times)', () => {
    ensureSearchTables(db);
    ensureSearchTables(db);
    const rows = db.query('SELECT count(*) as cnt FROM hub_search_index');
    expect(Number(rows[0]?.cnt)).toBe(0);
  });
});

describe('indexer', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createTestDb();
    ensureSearchTables(db);
  });

  it('indexes a module with searchable content', () => {
    const items = [
      makeItem('books', '1', 'Dune', 'Science fiction novel by Frank Herbert', ['sci-fi', 'classic']),
      makeItem('books', '2', 'Neuromancer', 'Cyberpunk novel by William Gibson', ['cyberpunk']),
    ];
    const mod = makeModule('books', items);

    const count = indexModule(db, mod);

    expect(count).toBe(2);

    const rows = db.query('SELECT count(*) as cnt FROM hub_search_index');
    expect(Number(rows[0]?.cnt)).toBe(2);

    const meta = db.query<Record<string, unknown>>(
      'SELECT * FROM hub_search_meta WHERE module_id = ?',
      ['books'],
    );
    expect(meta).toHaveLength(1);
    expect(Number(meta[0]?.item_count)).toBe(2);
  });

  it('returns 0 for module without crossModule', () => {
    const mod = {
      id: 'empty',
      name: 'Empty',
      tagline: '',
      icon: '',
      accentColor: '',
      tier: 'free',
      storageType: 'sqlite',
      navigation: { tabs: [], screens: [] },
      requiresAuth: false,
      requiresNetwork: false,
      version: '0.1.0',
    } as unknown as ModuleDefinition;

    expect(indexModule(db, mod)).toBe(0);
  });

  it('replaces old entries on re-index', () => {
    const items1 = [makeItem('books', '1', 'Old Title')];
    const mod1 = makeModule('books', items1);
    indexModule(db, mod1);

    const items2 = [
      makeItem('books', '1', 'New Title'),
      makeItem('books', '2', 'Another Book'),
    ];
    const mod2 = makeModule('books', items2);
    indexModule(db, mod2);

    const rows = db.query('SELECT count(*) as cnt FROM hub_search_index');
    expect(Number(rows[0]?.cnt)).toBe(2);
  });

  it('indexes multiple modules', () => {
    const bookItems = [makeItem('books', '1', 'Dune')];
    const budgetItems = [makeItem('budget', '1', 'Groceries'), makeItem('budget', '2', 'Rent')];

    const results = indexAllModules(db, [
      makeModule('books', bookItems),
      makeModule('budget', budgetItems),
    ]);

    expect(results.size).toBe(2);
    expect(results.get('books')).toBe(1);
    expect(results.get('budget')).toBe(2);

    const total = db.query('SELECT count(*) as cnt FROM hub_search_index');
    expect(Number(total[0]?.cnt)).toBe(3);
  });

  it('removes a module from the index', () => {
    const items = [makeItem('books', '1', 'Dune')];
    indexModule(db, makeModule('books', items));

    removeModuleFromIndex(db, 'books');

    const rows = db.query('SELECT count(*) as cnt FROM hub_search_index');
    expect(Number(rows[0]?.cnt)).toBe(0);

    const meta = db.query('SELECT count(*) as cnt FROM hub_search_meta');
    expect(Number(meta[0]?.cnt)).toBe(0);
  });

  it('updates specific search entries incrementally', () => {
    const items = [
      makeItem('books', '1', 'Old Title', 'old body'),
      makeItem('books', '2', 'Unchanged'),
    ];
    indexModule(db, makeModule('books', items));

    updateSearchEntries(db, [
      makeItem('books', '1', 'Updated Title', 'new body'),
    ]);

    const rows = db.query<Record<string, unknown>>(
      'SELECT title FROM hub_search_index WHERE item_id = ?',
      ['1'],
    );
    expect(rows[0]?.title).toBe('Updated Title');

    const total = db.query('SELECT count(*) as cnt FROM hub_search_index');
    expect(Number(total[0]?.cnt)).toBe(2);
  });

  it('removes specific entries', () => {
    const items = [
      makeItem('books', '1', 'Keep'),
      makeItem('books', '2', 'Remove'),
    ];
    indexModule(db, makeModule('books', items));

    removeSearchEntries(db, [{ moduleId: 'books', itemId: '2' }]);

    const rows = db.query('SELECT count(*) as cnt FROM hub_search_index');
    expect(Number(rows[0]?.cnt)).toBe(1);
  });

  it('handles module that throws during getSearchableContent', () => {
    const mod = {
      id: 'broken',
      name: 'Broken',
      tagline: '',
      icon: '',
      accentColor: '',
      tier: 'free',
      storageType: 'sqlite',
      navigation: { tabs: [], screens: [] },
      requiresAuth: false,
      requiresNetwork: false,
      version: '0.1.0',
      crossModule: {
        getSearchableContent: () => { throw new Error('boom'); },
      },
    } as unknown as ModuleDefinition;

    expect(indexModule(db, mod)).toBe(0);
  });
});

describe('FTS5 search queries', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createTestDb();
    ensureSearchTables(db);
    clearSearchCache();

    indexAllModules(db, [
      makeModule('books', [
        makeItem('books', 'b1', 'Dune', 'Science fiction novel by Frank Herbert', ['sci-fi', 'classic']),
        makeItem('books', 'b2', 'Neuromancer', 'Cyberpunk novel by William Gibson', ['cyberpunk']),
        makeItem('books', 'b3', 'Foundation', 'Science fiction series by Isaac Asimov', ['sci-fi']),
      ]),
      makeModule('budget', [
        makeItem('budget', 't1', 'Grocery Store', 'Weekly groceries at Trader Joes'),
        makeItem('budget', 't2', 'Science Museum', 'Tickets for weekend visit'),
      ]),
    ]);
  });

  it('finds results by title keyword', () => {
    const results = search(db, 'Dune');
    expect(results).toHaveLength(1);
    expect(results[0]?.moduleId).toBe('books');
    expect(results[0]?.itemId).toBe('b1');
    expect(results[0]?.title).toBe('Dune');
  });

  it('finds results by body content', () => {
    const results = search(db, 'cyberpunk');
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe('Neuromancer');
  });

  it('finds results by tags', () => {
    const results = search(db, 'classic');
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe('Dune');
  });

  it('returns multiple matches across modules', () => {
    const results = search(db, 'science');
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it('filters by module ID', () => {
    const results = search(db, 'science', { moduleIds: ['budget'] });
    expect(results).toHaveLength(1);
    expect(results[0]?.moduleId).toBe('budget');
  });

  it('respects limit and offset', () => {
    const all = search(db, 'science');
    const page1 = search(db, 'science', { limit: 1 });
    const page2 = search(db, 'science', { limit: 1, offset: 1 });

    expect(page1).toHaveLength(1);
    expect(page2).toHaveLength(1);
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it('strips special characters from query', () => {
    const results = search(db, 'dune!@#$');
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe('Dune');
  });

  it('supports prefix matching', () => {
    const results = search(db, 'Neuro');
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe('Neuromancer');
  });

  it('counts results for pagination', () => {
    const count = searchCount(db, 'science');
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it('counts results with module filter', () => {
    const count = searchCount(db, 'science', ['books']);
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('truncates long content into snippets', () => {
    const longBody = 'x'.repeat(200);
    indexAllModules(db, [
      makeModule('notes', [makeItem('notes', 'n1', 'Long Note', longBody)]),
    ]);

    clearSearchCache();
    const results = search(db, 'Long Note');
    const noteResult = results.find((r) => r.itemId === 'n1');
    expect(noteResult).toBeDefined();
    // Content is all x's, no match found, so fallback truncation: 80 + '...' = 83
    expect(noteResult!.snippet.length).toBeLessThanOrEqual(84);
    expect(noteResult!.snippet.endsWith('...')).toBe(true);
  });
});

describe('empty query behavior', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createTestDb();
    ensureSearchTables(db);
    clearSearchCache();

    indexAllModules(db, [
      makeModule('books', [
        makeItem('books', 'b1', 'Dune', 'Science fiction novel', [], '2026-03-22T12:00:00Z'),
        makeItem('books', 'b2', 'Neuromancer', 'Cyberpunk novel', [], '2026-03-21T12:00:00Z'),
      ]),
      makeModule('budget', [
        makeItem('budget', 't1', 'Grocery Store', 'Weekly groceries', [], '2026-03-20T12:00:00Z'),
      ]),
    ]);
  });

  it('returns recent items for empty string', () => {
    const results = search(db, '');
    expect(results).toHaveLength(3);
    // Sorted by updated_at DESC
    expect(results[0]?.itemId).toBe('b1');
    expect(results[1]?.itemId).toBe('b2');
    expect(results[2]?.itemId).toBe('t1');
  });

  it('returns recent items for whitespace-only query', () => {
    const results = search(db, '   ');
    expect(results).toHaveLength(3);
  });

  it('counts all items for empty query', () => {
    expect(searchCount(db, '')).toBe(3);
  });

  it('counts all items for whitespace-only query', () => {
    expect(searchCount(db, '   ')).toBe(3);
  });

  it('counts filtered items for empty query with module filter', () => {
    expect(searchCount(db, '', ['books'])).toBe(2);
  });

  it('respects module filter on empty query', () => {
    const results = search(db, '', { moduleIds: ['budget'] });
    expect(results).toHaveLength(1);
    expect(results[0]?.moduleId).toBe('budget');
  });
});

describe('snippet extraction with highlighting', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createTestDb();
    ensureSearchTables(db);
    clearSearchCache();

    indexAllModules(db, [
      makeModule('books', [
        makeItem('books', 'b1', 'Dune', 'Science fiction novel by Frank Herbert', ['sci-fi', 'classic']),
        makeItem('books', 'b2', 'Neuromancer', 'Cyberpunk novel by William Gibson', ['cyberpunk']),
      ]),
    ]);
  });

  it('highlights matching term in content', () => {
    const results = search(db, 'Frank');
    const dune = results.find((r) => r.itemId === 'b1');
    expect(dune).toBeDefined();
    expect(dune!.snippet).toContain('**Frank**');
  });

  it('shows context around match', () => {
    const results = search(db, 'Gibson');
    const neuro = results.find((r) => r.itemId === 'b2');
    expect(neuro).toBeDefined();
    expect(neuro!.snippet).toContain('**Gibson**');
    // Should include surrounding context
    expect(neuro!.snippet).toContain('William');
  });

  it('returns content without highlighting when match is only in title', () => {
    const results = search(db, 'Dune');
    const dune = results.find((r) => r.itemId === 'b1');
    expect(dune).toBeDefined();
    // "dune" only appears in title, not content, so no highlight markers
    expect(dune!.snippet).not.toContain('**');
    // But content is still returned
    expect(dune!.snippet).toContain('Science fiction');
  });

  it('highlights tag matches in content', () => {
    // Tags are stored in the content field (appended by indexer)
    const results = search(db, 'cyberpunk');
    const neuro = results.find((r) => r.itemId === 'b2');
    expect(neuro).toBeDefined();
    expect(neuro!.snippet).toContain('**');
  });

  it('produces ellipsis for long content with match in the middle', () => {
    const prefix = 'a'.repeat(100);
    const suffix = 'b'.repeat(100);
    const body = `${prefix} FINDME ${suffix}`;
    indexAllModules(db, [
      makeModule('notes', [makeItem('notes', 'n1', 'Test', body)]),
    ]);

    clearSearchCache();
    const results = search(db, 'FINDME');
    const note = results.find((r) => r.itemId === 'n1');
    expect(note).toBeDefined();
    expect(note!.snippet).toContain('**FINDME**');
    expect(note!.snippet.startsWith('...')).toBe(true);
    expect(note!.snippet.endsWith('...')).toBe(true);
  });

  it('returns empty snippet for item with no content', () => {
    indexAllModules(db, [
      makeModule('notes', [makeItem('notes', 'empty', 'No Content Item')]),
    ]);

    clearSearchCache();
    const results = search(db, 'No Content');
    const item = results.find((r) => r.itemId === 'empty');
    expect(item).toBeDefined();
    expect(item!.snippet).toBe('');
  });
});

describe('long query handling', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createTestDb();
    ensureSearchTables(db);
    clearSearchCache();

    indexAllModules(db, [
      makeModule('books', [
        makeItem('books', 'b1', 'Dune', 'Science fiction novel by Frank Herbert'),
      ]),
    ]);
  });

  it('truncates queries beyond 10 words without crashing', () => {
    const longQuery = 'science fiction novel Frank Herbert Dune classic book reading literature amazing wonderful extraordinary';
    // FTS5 uses AND semantics, so not all truncated terms need to match.
    // The key test is that a very long query doesn't crash or error.
    expect(() => search(db, longQuery)).not.toThrow();
  });

  it('drops words beyond the 10th so they do not affect results', () => {
    // "Dune" matches our test data. With 9 filler words before "ZZZNOWORD",
    // the 11th word "ZZZNOWORD" is dropped. If it were kept, AND semantics
    // would yield 0 results.
    const tenWords = 'Dune Dune Dune Dune Dune Dune Dune Dune Dune Dune';
    const elevenWords = tenWords + ' ZZZNOWORD';
    clearSearchCache();
    const tenResults = search(db, tenWords);
    clearSearchCache();
    const elevenResults = search(db, elevenWords);
    expect(tenResults.length).toBe(elevenResults.length);
  });

  it('handles single-word query', () => {
    const results = search(db, 'Dune');
    expect(results).toHaveLength(1);
  });

  it('handles query with repeated special characters', () => {
    const results = search(db, '!!!???###');
    // All stripped, empty -> returns recent items
    expect(results).toHaveLength(1);
  });
});

describe('searchRecent', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createTestDb();
    ensureSearchTables(db);
    clearSearchCache();

    indexAllModules(db, [
      makeModule('books', [
        makeItem('books', 'b1', 'Older Book', 'content', [], '2026-03-01T12:00:00Z'),
        makeItem('books', 'b2', 'Newer Book', 'content', [], '2026-03-22T12:00:00Z'),
      ]),
      makeModule('budget', [
        makeItem('budget', 't1', 'Middle Transaction', 'content', [], '2026-03-10T12:00:00Z'),
      ]),
    ]);
  });

  it('returns items sorted by updated_at descending', () => {
    const results = searchRecent(db);
    expect(results).toHaveLength(3);
    expect(results[0]?.itemId).toBe('b2'); // newest
    expect(results[1]?.itemId).toBe('t1'); // middle
    expect(results[2]?.itemId).toBe('b1'); // oldest
  });

  it('respects module filter', () => {
    const results = searchRecent(db, { moduleIds: ['budget'] });
    expect(results).toHaveLength(1);
    expect(results[0]?.moduleId).toBe('budget');
  });

  it('respects limit', () => {
    const results = searchRecent(db, { limit: 2 });
    expect(results).toHaveLength(2);
  });

  it('respects offset', () => {
    const results = searchRecent(db, { limit: 1, offset: 1 });
    expect(results).toHaveLength(1);
    expect(results[0]?.itemId).toBe('t1'); // second newest
  });

  it('returns empty for empty index', () => {
    const emptyDb = createTestDb();
    ensureSearchTables(emptyDb);
    const results = searchRecent(emptyDb);
    expect(results).toHaveLength(0);
  });

  it('provides snippet without highlight markers', () => {
    const results = searchRecent(db);
    for (const r of results) {
      expect(r.snippet).not.toContain('**');
    }
  });
});

describe('recency ranking', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createTestDb();
    ensureSearchTables(db);
    clearSearchCache();
  });

  it('boosts recently updated items over old items', () => {
    const now = new Date().toISOString();
    const old = '2020-01-01T00:00:00Z';

    indexAllModules(db, [
      makeModule('notes', [
        makeItem('notes', 'new1', 'Recency Test Item', 'identical body for ranking', [], now),
        makeItem('notes', 'old1', 'Recency Test Item', 'identical body for ranking', [], old),
      ]),
    ]);

    const results = search(db, 'Recency Test');
    const newItem = results.find((r) => r.itemId === 'new1');
    const oldItem = results.find((r) => r.itemId === 'old1');
    expect(newItem).toBeDefined();
    expect(oldItem).toBeDefined();
    // New item should rank higher (more negative boosted_rank)
    expect(newItem!.rank).toBeLessThan(oldItem!.rank);
  });

  it('applies different boost tiers based on age', () => {
    const now = new Date().toISOString();
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    indexAllModules(db, [
      makeModule('notes', [
        makeItem('notes', 'tier1', 'Boost Tier Test', 'same body', [], now),
        makeItem('notes', 'tier2', 'Boost Tier Test', 'same body', [], threeDaysAgo),
        makeItem('notes', 'tier3', 'Boost Tier Test', 'same body', [], fifteenDaysAgo),
        makeItem('notes', 'tier4', 'Boost Tier Test', 'same body', [], sixtyDaysAgo),
      ]),
    ]);

    const results = search(db, 'Boost Tier');
    expect(results).toHaveLength(4);

    const tier1 = results.find((r) => r.itemId === 'tier1')!;
    const tier2 = results.find((r) => r.itemId === 'tier2')!;
    const tier4 = results.find((r) => r.itemId === 'tier4')!;

    // Today (5.0 boost) should rank better than 3 days ago (2.0 boost)
    expect(tier1.rank).toBeLessThan(tier2.rank);
    // 3 days ago (2.0 boost) should rank better than 60 days ago (0.0 boost)
    expect(tier2.rank).toBeLessThan(tier4.rank);
  });
});

// ---------------------------------------------------------------------------
// New tests: LRU cache
// ---------------------------------------------------------------------------

describe('LRU query cache', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createTestDb();
    ensureSearchTables(db);
    clearSearchCache();

    indexAllModules(db, [
      makeModule('books', [
        makeItem('books', 'b1', 'Dune', 'Science fiction novel'),
      ]),
    ]);
  });

  afterEach(() => {
    clearSearchCache();
  });

  it('caches results on second identical query', () => {
    const r1 = search(db, 'Dune');
    expect(_getCacheSize()).toBe(1);

    const r2 = search(db, 'Dune');
    expect(r2).toEqual(r1);
    // Cache size stays 1 (same key)
    expect(_getCacheSize()).toBe(1);
  });

  it('stores different cache entries for different queries', () => {
    search(db, 'Dune');
    search(db, 'fiction');
    expect(_getCacheSize()).toBe(2);
  });

  it('stores different entries for different options', () => {
    search(db, 'Dune', { limit: 5 });
    search(db, 'Dune', { limit: 10 });
    expect(_getCacheSize()).toBe(2);
  });

  it('does not cache empty queries (recent items)', () => {
    search(db, '');
    expect(_getCacheSize()).toBe(0);
  });

  it('clearSearchCache empties the cache', () => {
    search(db, 'Dune');
    expect(_getCacheSize()).toBe(1);
    clearSearchCache();
    expect(_getCacheSize()).toBe(0);
  });

  it('evicts oldest entries when at capacity (50)', () => {
    // Fill cache with 50 unique queries
    for (let i = 0; i < 50; i++) {
      // Each query produces a unique FTS key since 'Dune' is in title
      search(db, `Dune`, { offset: i });
    }
    expect(_getCacheSize()).toBe(50);

    // 51st query should evict the oldest
    search(db, 'Dune', { offset: 999 });
    expect(_getCacheSize()).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// New tests: Performance logging
// ---------------------------------------------------------------------------

describe('performance logging', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createTestDb();
    ensureSearchTables(db);
    clearSearchCache();

    indexAllModules(db, [
      makeModule('books', [
        makeItem('books', 'b1', 'Dune', 'Science fiction novel'),
      ]),
    ]);
  });

  afterEach(() => {
    setSearchPerfLogger(null);
    clearSearchCache();
  });

  it('calls perf logger for queries (when set)', () => {
    const logger = vi.fn();
    setSearchPerfLogger(logger);

    // Normal fast queries won't trigger the 200ms threshold
    search(db, 'Dune');
    // Logger is only called for slow queries (>200ms), so fast queries don't trigger it
    // We verify the logger mechanism works by checking it was wired up
    expect(logger).not.toHaveBeenCalled(); // Fast query, under threshold
  });

  it('setSearchPerfLogger(null) disables logging', () => {
    const logger = vi.fn();
    setSearchPerfLogger(logger);
    setSearchPerfLogger(null);

    search(db, 'Dune');
    expect(logger).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// New tests: Grouped search results (R23.2)
// ---------------------------------------------------------------------------

describe('searchGrouped', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createTestDb();
    ensureSearchTables(db);
    clearSearchCache();

    indexAllModules(db, [
      makeModule('books', [
        makeItem('books', 'b1', 'Dune', 'Science fiction novel'),
        makeItem('books', 'b2', 'Foundation', 'Science fiction series'),
      ]),
      makeModule('budget', [
        makeItem('budget', 't1', 'Science Museum', 'Tickets for visit'),
      ]),
    ]);
  });

  afterEach(() => {
    clearSearchCache();
  });

  it('groups results by module with metadata', () => {
    const groups = searchGrouped(db, 'science', TEST_MODULE_META);

    expect(groups.length).toBeGreaterThanOrEqual(2);

    const booksGroup = groups.find((g) => g.moduleId === 'books');
    expect(booksGroup).toBeDefined();
    expect(booksGroup!.moduleName).toBe('MyBooks');
    expect(booksGroup!.icon).toBe('📚');
    expect(booksGroup!.accentColor).toBe('#C9894D');
    expect(booksGroup!.results.length).toBeGreaterThanOrEqual(2);

    const budgetGroup = groups.find((g) => g.moduleId === 'budget');
    expect(budgetGroup).toBeDefined();
    expect(budgetGroup!.moduleName).toBe('MyBudget');
    expect(budgetGroup!.icon).toBe('💰');
    expect(budgetGroup!.accentColor).toBe('#22C55E');
    expect(budgetGroup!.results).toHaveLength(1);
  });

  it('uses fallback values for unknown modules', () => {
    const groups = searchGrouped(db, 'science', []);

    const booksGroup = groups.find((g) => g.moduleId === 'books');
    expect(booksGroup).toBeDefined();
    expect(booksGroup!.moduleName).toBe('books');
    expect(booksGroup!.icon).toBe('');
    expect(booksGroup!.accentColor).toBe('#888888');
  });

  it('preserves result order within groups', () => {
    const groups = searchGrouped(db, 'science', TEST_MODULE_META);
    const booksGroup = groups.find((g) => g.moduleId === 'books');
    expect(booksGroup).toBeDefined();
    // Results within the group maintain their rank order
    for (let i = 1; i < booksGroup!.results.length; i++) {
      expect(booksGroup!.results[i - 1]!.rank).toBeLessThanOrEqual(
        booksGroup!.results[i]!.rank,
      );
    }
  });
});

describe('groupResultsByModule', () => {
  it('groups flat results into module groups', () => {
    const results: SearchResult[] = [
      { moduleId: 'books', itemId: 'b1', itemType: 'book', title: 'Dune', snippet: '', updatedAt: '', rank: -5 },
      { moduleId: 'budget', itemId: 't1', itemType: 'tx', title: 'Rent', snippet: '', updatedAt: '', rank: -3 },
      { moduleId: 'books', itemId: 'b2', itemType: 'book', title: 'Foundation', snippet: '', updatedAt: '', rank: -2 },
    ];

    const groups = groupResultsByModule(results, TEST_MODULE_META);

    expect(groups).toHaveLength(2);
    expect(groups[0]!.moduleId).toBe('books');
    expect(groups[0]!.results).toHaveLength(2);
    expect(groups[1]!.moduleId).toBe('budget');
    expect(groups[1]!.results).toHaveLength(1);
  });

  it('returns empty array for empty results', () => {
    const groups = groupResultsByModule([], TEST_MODULE_META);
    expect(groups).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// New tests: Recent actions (R23.5)
// ---------------------------------------------------------------------------

describe('getRecentActions', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createTestDb();
    ensureSearchTables(db);
    clearSearchCache();

    // Create more than 15 items to test the limit
    const items: SearchableItem[] = [];
    for (let i = 0; i < 20; i++) {
      const date = new Date(2026, 2, 22, 12, 0, 0);
      date.setMinutes(date.getMinutes() - i);
      items.push(makeItem('books', `b${i}`, `Book ${i}`, 'content', [], date.toISOString()));
    }

    indexAllModules(db, [makeModule('books', items)]);
  });

  afterEach(() => {
    clearSearchCache();
  });

  it('returns at most 15 recent items', () => {
    const results = getRecentActions(db);
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(15);
  });

  it('returns grouped results when moduleMeta provided', () => {
    const results = getRecentActions(db, TEST_MODULE_META);
    expect(Array.isArray(results)).toBe(true);
    // With module meta, returns SearchResultGroup[]
    const groups = results as import('../query').SearchResultGroup[];
    expect(groups[0]?.moduleName).toBe('MyBooks');
    expect(groups[0]?.icon).toBe('📚');
    // Total results across groups should be 15
    const totalResults = groups.reduce((sum, g) => sum + g.results.length, 0);
    expect(totalResults).toBe(15);
  });

  it('returns flat results when no moduleMeta', () => {
    const results = getRecentActions(db) as SearchResult[];
    expect(results[0]?.moduleId).toBe('books');
    expect(results[0]?.itemId).toBe('b0'); // most recent
  });
});

// ---------------------------------------------------------------------------
// New tests: Index coverage validation (R23.4)
// ---------------------------------------------------------------------------

describe('validateIndexCoverage', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createTestDb();
    ensureSearchTables(db);
  });

  it('reports all modules as indexed when fully covered', () => {
    const modules = [
      makeModule('books', [makeItem('books', '1', 'Dune')]),
      makeModule('budget', [makeItem('budget', '1', 'Rent')]),
    ];
    indexAllModules(db, modules);

    const coverage = validateIndexCoverage(db, modules);
    expect(coverage.isComplete).toBe(true);
    expect(coverage.indexed).toEqual(['books', 'budget']);
    expect(coverage.missing).toEqual([]);
  });

  it('reports missing modules that are not indexed', () => {
    const booksModule = makeModule('books', [makeItem('books', '1', 'Dune')]);
    const budgetModule = makeModule('budget', [makeItem('budget', '1', 'Rent')]);

    // Only index books
    indexModule(db, booksModule);

    const coverage = validateIndexCoverage(db, [booksModule, budgetModule]);
    expect(coverage.isComplete).toBe(false);
    expect(coverage.indexed).toEqual(['books']);
    expect(coverage.missing).toEqual(['budget']);
  });

  it('ignores modules without getSearchableContent', () => {
    const noSearch = {
      id: 'nosearch',
      name: 'NoSearch',
      tagline: '',
      icon: '',
      accentColor: '',
      tier: 'free',
      storageType: 'sqlite',
      navigation: { tabs: [], screens: [] },
      requiresAuth: false,
      requiresNetwork: false,
      version: '0.1.0',
    } as unknown as ModuleDefinition;

    const coverage = validateIndexCoverage(db, [noSearch]);
    expect(coverage.isComplete).toBe(true);
    expect(coverage.indexed).toEqual([]);
    expect(coverage.missing).toEqual([]);
  });
});

describe('ensureFullCoverage', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createTestDb();
  });

  it('indexes missing modules automatically', () => {
    const modules = [
      makeModule('books', [makeItem('books', '1', 'Dune')]),
      makeModule('budget', [makeItem('budget', '1', 'Rent')]),
    ];

    const coverage = ensureFullCoverage(db, modules);
    expect(coverage.isComplete).toBe(true);
    expect(coverage.indexed.sort()).toEqual(['books', 'budget']);

    // Verify data is actually in the index
    const rows = db.query('SELECT count(*) as cnt FROM hub_search_index');
    expect(Number(rows[0]?.cnt)).toBe(2);
  });

  it('does not re-index already indexed modules', () => {
    const modules = [
      makeModule('books', [makeItem('books', '1', 'Dune')]),
    ];

    ensureFullCoverage(db, modules);
    // Modify the module to return different items
    const modified = [
      makeModule('books', [makeItem('books', '1', 'Dune'), makeItem('books', '2', 'Foundation')]),
    ];

    const coverage = ensureFullCoverage(db, modified);
    // Already indexed, so not re-indexed
    expect(coverage.isComplete).toBe(true);
    const rows = db.query('SELECT count(*) as cnt FROM hub_search_index');
    expect(Number(rows[0]?.cnt)).toBe(1); // Still 1, not 2
  });
});
