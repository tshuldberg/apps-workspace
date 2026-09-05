import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aggregateTodayCards,
  dismissCardToday,
  getDismissedCardIds,
} from '../dashboard';
import type {
  CrossModuleInterface,
  TodayCard,
  TodayCardContext,
} from '../cross-module-types';
import type { ModuleDefinition, ModuleId } from '../types';

function makeModule(
  id: ModuleId,
  getTodayCards?: CrossModuleInterface['getTodayCards'],
): ModuleDefinition {
  const crossModule: CrossModuleInterface = {};
  if (getTodayCards) crossModule.getTodayCards = getTodayCards;

  return {
    id,
    name: `My${id}`,
    tagline: 'test',
    icon: 'test',
    accentColor: '#000000',
    tier: 'premium',
    storageType: 'sqlite',
    navigation: { tabs: [], screens: [] },
    requiresAuth: false,
    requiresNetwork: false,
    version: '0.1.0',
    crossModule,
  } as ModuleDefinition;
}

function makeCard(
  id: string,
  moduleId: ModuleId,
  priority: number,
  overrides?: Partial<TodayCard>,
): TodayCard {
  return {
    id,
    moduleId,
    kind: 'action',
    priority,
    title: `Card ${id}`,
    dismissible: true,
    ...overrides,
  };
}

interface DbLike {
  query<T>(sql: string, params?: unknown[]): T[];
  execute(sql: string, params?: unknown[]): void;
}

/**
 * Minimal in-memory fake for `hub_preferences` that supports just the three
 * shapes the dismissal helpers issue:
 *   - INSERT OR REPLACE INTO hub_preferences (key, value) VALUES (?, ?)
 *   - INSERT INTO hub_preferences (key, value) VALUES (?, ?)
 *   - SELECT ... FROM hub_preferences WHERE key LIKE ?
 *   - SELECT ... FROM hub_preferences WHERE key = ?
 *
 * Avoids a runtime dep on better-sqlite3 for this package while still
 * exercising the helpers end-to-end.
 */
function makeHubDb(): { db: DbLike; close: () => void } {
  const store = new Map<string, string>();

  function extractParam(params: unknown[] | undefined, index: number): string {
    const value = params?.[index];
    if (typeof value !== 'string') {
      throw new Error(`Expected string param at index ${index}`);
    }
    return value;
  }

  const db: DbLike = {
    execute(sql, params) {
      const normalized = sql.replace(/\s+/g, ' ').trim().toUpperCase();
      if (
        normalized.startsWith('INSERT OR REPLACE INTO HUB_PREFERENCES') ||
        normalized.startsWith('INSERT INTO HUB_PREFERENCES')
      ) {
        const key = extractParam(params, 0);
        const value = extractParam(params, 1);
        store.set(key, value);
        return;
      }
      throw new Error(`Unhandled execute: ${sql}`);
    },
    query<T>(sql: string, params?: unknown[]): T[] {
      const normalized = sql.replace(/\s+/g, ' ').trim().toUpperCase();
      if (normalized.includes('WHERE KEY LIKE')) {
        const pattern = extractParam(params, 0);
        if (!pattern.endsWith('%')) {
          throw new Error('Only prefix LIKE patterns supported');
        }
        const prefix = pattern.slice(0, -1);
        const rows: Array<{ key: string; value: string }> = [];
        for (const [key, value] of store.entries()) {
          if (key.startsWith(prefix)) rows.push({ key, value });
        }
        return rows as unknown as T[];
      }
      if (normalized.includes('WHERE KEY =')) {
        const key = extractParam(params, 0);
        const value = store.get(key);
        return (value === undefined ? [] : [{ key, value }]) as unknown as T[];
      }
      throw new Error(`Unhandled query: ${sql}`);
    },
  };

  return { db, close: () => store.clear() };
}

const NOW = new Date('2026-04-18T12:00:00.000Z');

describe('aggregateTodayCards', () => {
  it('returns [] when no modules are enabled', () => {
    const result = aggregateTodayCards({}, [], { now: NOW });
    expect(result).toEqual([]);
  });

  it('returns [] when enabled modules have no getTodayCards', () => {
    const modules = [makeModule('books'), makeModule('budget')];
    const result = aggregateTodayCards({}, modules, { now: NOW });
    expect(result).toEqual([]);
  });

  it('returns top-N cards sorted by priority descending', () => {
    const anchors: ModuleId[] = [
      'books',
      'budget',
      'health',
      'homes',
      'journal',
      'rsvp',
      'trails',
    ];
    let nextPriority = 10;
    const modules = anchors.map((id) =>
      makeModule(id, () => [
        makeCard(`${id}-a`, id, nextPriority++),
        makeCard(`${id}-b`, id, nextPriority++),
        makeCard(`${id}-c`, id, nextPriority++),
      ]),
    );

    const result = aggregateTodayCards({}, modules, { now: NOW });
    expect(result).toHaveLength(7);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1]!.priority).toBeGreaterThanOrEqual(result[i]!.priority);
    }
    expect(result[0]!.id).toBe('trails-c');
  });

  it('filters cards whose expiresAt is at or before now', () => {
    const cards: TodayCard[] = [
      makeCard('kept', 'books', 70),
      makeCard('expired', 'budget', 99, {
        expiresAt: '2026-04-18T11:00:00.000Z',
      }),
      makeCard('exact-now', 'journal', 99, {
        expiresAt: NOW.toISOString(),
      }),
      makeCard('future', 'rsvp', 80, {
        expiresAt: '2026-04-19T00:00:00.000Z',
      }),
    ];
    const mod = makeModule('books', () => cards);
    const result = aggregateTodayCards({}, [mod], { now: NOW });
    const ids = result.map((c) => c.id);
    expect(ids).toContain('kept');
    expect(ids).toContain('future');
    expect(ids).not.toContain('expired');
    expect(ids).not.toContain('exact-now');
  });

  it('filters cards whose id is in dismissedIds', () => {
    const mod = makeModule('books', () => [
      makeCard('bk-keep', 'books', 70),
      makeCard('bk-dismiss', 'books', 99),
    ]);
    const result = aggregateTodayCards({}, [mod], {
      now: NOW,
      dismissedIds: new Set(['bk-dismiss']),
    });
    expect(result.map((c) => c.id)).toEqual(['bk-keep']);
  });

  it('boosts priority by +15 for modules in primaryClusters', () => {
    const journalMod = makeModule('journal', () => [
      makeCard('jr-today', 'journal', 50),
    ]);
    const budgetMod = makeModule('budget', () => [
      makeCard('bg-spend', 'budget', 60),
    ]);

    const unboosted = aggregateTodayCards({}, [journalMod, budgetMod], {
      now: NOW,
    });
    expect(unboosted.map((c) => c.id)).toEqual(['bg-spend', 'jr-today']);

    const boosted = aggregateTodayCards({}, [journalMod, budgetMod], {
      now: NOW,
      primaryClusters: ['mind'],
    });
    expect(boosted.map((c) => c.id)).toEqual(['jr-today', 'bg-spend']);
  });

  it('clamps adjusted priority at 100 (never overflows)', () => {
    const mod = makeModule('health', () => [
      makeCard('hi', 'health', 95),
    ]);
    const mod2 = makeModule('books', () => [
      makeCard('peer', 'books', 100),
    ]);
    const result = aggregateTodayCards({}, [mod2, mod], {
      now: NOW,
      primaryClusters: ['body'],
    });
    expect(result.map((c) => c.id)).toEqual(['peer', 'hi']);
  });

  it('respects a custom maxCards', () => {
    const mod = makeModule('books', () => [
      makeCard('a', 'books', 10),
      makeCard('b', 'books', 20),
      makeCard('c', 'books', 30),
    ]);
    const result = aggregateTodayCards({}, [mod], {
      now: NOW,
      maxCards: 2,
    });
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toEqual(['c', 'b']);
  });

  it('skips modules whose getTodayCards throws (broken module does not blank the surface)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const brokenMod = makeModule('books', () => {
      throw new Error('db is corrupt');
    });
    const goodMod = makeModule('budget', () => [
      makeCard('bg-spend', 'budget', 50),
    ]);

    const result = aggregateTodayCards({}, [brokenMod, goodMod], { now: NOW });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('bg-spend');
    expect(warn).toHaveBeenCalledOnce();
    const [firstArg] = warn.mock.calls[0]!;
    expect(String(firstArg)).toContain('books');

    warn.mockRestore();
  });

  it('ignores modules that return a non-array', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const badMod = makeModule('books', (() =>
      undefined as unknown as TodayCard[]) as CrossModuleInterface['getTodayCards']);
    const goodMod = makeModule('budget', () => [
      makeCard('ok', 'budget', 30),
    ]);
    const result = aggregateTodayCards({}, [badMod, goodMod], { now: NOW });
    expect(result.map((c) => c.id)).toEqual(['ok']);
    warn.mockRestore();
  });

  it('passes now + primaryClusters into the module context', () => {
    let observed: TodayCardContext | undefined;
    const mod = makeModule('journal', (_db, ctx) => {
      observed = ctx;
      return [];
    });
    aggregateTodayCards({}, [mod], {
      now: NOW,
      primaryClusters: ['mind', 'body'],
    });
    expect(observed?.now).toEqual(NOW);
    expect(observed?.primaryClusters).toEqual(['mind', 'body']);
  });

  it('ignores unknown cluster names in primaryClusters', () => {
    const mod = makeModule('books', () => [makeCard('x', 'books', 40)]);
    const result = aggregateTodayCards({}, [mod], {
      now: NOW,
      primaryClusters: ['bogus-cluster'],
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.priority).toBe(40);
  });
});

describe('getDismissedCardIds / dismissCardToday', () => {
  let handle: ReturnType<typeof makeHubDb>;
  beforeEach(() => {
    handle = makeHubDb();
  });
  afterEach(() => {
    handle.close();
  });

  it('returns an empty set when no dismissals exist', () => {
    const ids = getDismissedCardIds(handle.db, NOW);
    expect(ids.size).toBe(0);
  });

  it('round-trips a dismissal within the same UTC day', () => {
    dismissCardToday(handle.db, 'bk-123', NOW);
    const ids = getDismissedCardIds(handle.db, NOW);
    expect(ids.has('bk-123')).toBe(true);
    expect(ids.size).toBe(1);
  });

  it('auto-expires yesterday dismissals at UTC midnight', () => {
    const yesterday = new Date('2026-04-17T15:00:00.000Z');
    dismissCardToday(handle.db, 'bk-old', yesterday);

    const ids = getDismissedCardIds(handle.db, NOW);
    expect(ids.has('bk-old')).toBe(false);
  });

  it('separates dismissals across UTC day boundaries', () => {
    dismissCardToday(handle.db, 'bk-old', new Date('2026-04-17T23:59:59.000Z'));
    dismissCardToday(handle.db, 'bk-new', new Date('2026-04-18T00:00:00.000Z'));

    const ids = getDismissedCardIds(handle.db, NOW);
    expect(ids.has('bk-old')).toBe(false);
    expect(ids.has('bk-new')).toBe(true);
  });

  it('only returns keys that use the today.dismissed prefix', () => {
    handle.db.execute(
      `INSERT INTO hub_preferences (key, value) VALUES (?, ?)`,
      ['today.primary_clusters', 'body,mind'],
    );
    dismissCardToday(handle.db, 'bk-abc', NOW);

    const ids = getDismissedCardIds(handle.db, NOW);
    expect(ids.size).toBe(1);
    expect(ids.has('bk-abc')).toBe(true);
  });

  it('skips rows whose value is not a parseable timestamp', () => {
    handle.db.execute(
      `INSERT INTO hub_preferences (key, value) VALUES (?, ?)`,
      ['today.dismissed.garbage', 'not-a-date'],
    );
    const ids = getDismissedCardIds(handle.db, NOW);
    expect(ids.has('garbage')).toBe(false);
  });

  it('dismissCardToday is idempotent (INSERT OR REPLACE)', () => {
    const first = new Date('2026-04-18T10:00:00.000Z');
    const second = new Date('2026-04-18T11:00:00.000Z');
    dismissCardToday(handle.db, 'bk-dup', first);
    dismissCardToday(handle.db, 'bk-dup', second);

    const rows = handle.db.query<{ key: string; value: string }>(
      `SELECT key, value FROM hub_preferences WHERE key = ?`,
      ['today.dismissed.bk-dup'],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.value).toBe(second.toISOString());
  });

  it('dismissals plug into aggregateTodayCards via dismissedIds', () => {
    dismissCardToday(handle.db, 'bk-hide', NOW);

    const dismissed = getDismissedCardIds(handle.db, NOW);
    const mod = makeModule('books', () => [
      makeCard('bk-hide', 'books', 90),
      makeCard('bk-show', 'books', 10),
    ]);
    const result = aggregateTodayCards(handle.db, [mod], {
      now: NOW,
      dismissedIds: dismissed,
    });
    expect(result.map((c) => c.id)).toEqual(['bk-show']);
  });
});
