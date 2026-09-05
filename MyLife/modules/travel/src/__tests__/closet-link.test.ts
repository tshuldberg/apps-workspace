import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import {
  inferSeasonFromDates,
  suggestPackingFromCloset,
} from '../integrations/closet-link';

function createClosetTable(adapter: DatabaseAdapter): void {
  adapter.execute(`
    CREATE TABLE cl_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      seasons_json TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      times_worn INTEGER NOT NULL DEFAULT 0
    )
  `);
}

function insertItem(
  adapter: DatabaseAdapter,
  params: {
    id: string;
    name: string;
    category?: string | null;
    seasons?: string[] | null;
    status?: string;
    timesWorn?: number;
  },
): void {
  adapter.execute(
    `INSERT INTO cl_items (id, name, category, seasons_json, status, times_worn)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      params.id,
      params.name,
      params.category ?? null,
      params.seasons === null
        ? null
        : JSON.stringify(params.seasons ?? []),
      params.status ?? 'active',
      params.timesWorn ?? 0,
    ],
  );
}

describe('@mylife/travel closet-link integration', () => {
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

  it('inferSeasonFromDates maps months to seasons (northern defaults)', () => {
    expect(inferSeasonFromDates('2026-01-05', '2026-01-10')).toBe('winter');
    expect(inferSeasonFromDates('2026-02-28', '2026-03-01')).toBe('winter');
    expect(inferSeasonFromDates('2026-04-01', '2026-04-10')).toBe('spring');
    expect(inferSeasonFromDates('2026-07-15', '2026-07-20')).toBe('summer');
    expect(inferSeasonFromDates('2026-10-10', '2026-10-20')).toBe('fall');
    expect(inferSeasonFromDates('2026-12-24', '2026-12-31')).toBe('winter');
  });

  it('inferSeasonFromDates returns summer for malformed dates', () => {
    expect(inferSeasonFromDates('not-a-date', 'also-bad')).toBe('summer');
  });

  it('returns [] when cl_items is missing (closet not installed)', () => {
    const result = suggestPackingFromCloset(adapter, {
      start_date: '2026-07-01',
      end_date: '2026-07-10',
    });
    expect(result).toEqual([]);
  });

  it('returns [] when start_date or end_date is missing', () => {
    createClosetTable(adapter);
    expect(
      suggestPackingFromCloset(adapter, {
        start_date: '',
        end_date: '2026-07-10',
      }),
    ).toEqual([]);
    expect(
      suggestPackingFromCloset(adapter, {
        start_date: '2026-07-01',
        end_date: '',
      }),
    ).toEqual([]);
  });

  it('prefers season-matched items, then versatile ones', () => {
    createClosetTable(adapter);
    insertItem(adapter, {
      id: 'tshirt',
      name: 'White T-Shirt',
      category: 'tops',
      seasons: ['summer', 'spring'],
      timesWorn: 10,
    });
    insertItem(adapter, {
      id: 'parka',
      name: 'Winter Parka',
      category: 'outerwear',
      seasons: ['winter'],
      timesWorn: 2,
    });
    insertItem(adapter, {
      id: 'jeans',
      name: 'Jeans',
      category: 'bottoms',
      seasons: [],
      timesWorn: 5,
    });
    insertItem(adapter, {
      id: 'shorts',
      name: 'Shorts',
      category: 'bottoms',
      seasons: ['summer'],
      timesWorn: 8,
    });

    const result = suggestPackingFromCloset(adapter, {
      start_date: '2026-07-01',
      end_date: '2026-07-10',
    });
    expect(result.map((r) => r.itemId)).toEqual(['tshirt', 'shorts', 'jeans']);
    expect(result[0]!.reason).toBe('season-match');
    expect(result[2]!.reason).toBe('versatile');
    expect(result[0]!.category).toBe('tops');
  });

  it('excludes inactive items', () => {
    createClosetTable(adapter);
    insertItem(adapter, {
      id: 'active',
      name: 'Active Shirt',
      seasons: ['summer'],
      status: 'active',
    });
    insertItem(adapter, {
      id: 'donated',
      name: 'Donated Shirt',
      seasons: ['summer'],
      status: 'donated',
    });

    const result = suggestPackingFromCloset(adapter, {
      start_date: '2026-07-01',
      end_date: '2026-07-10',
    });
    expect(result.map((r) => r.itemId)).toEqual(['active']);
  });

  it('caps output at 20 items', () => {
    createClosetTable(adapter);
    for (let i = 0; i < 25; i += 1) {
      insertItem(adapter, {
        id: `item_${i}`,
        name: `Item ${i}`,
        seasons: ['summer'],
        timesWorn: 25 - i,
      });
    }
    const result = suggestPackingFromCloset(adapter, {
      start_date: '2026-07-01',
      end_date: '2026-07-10',
    });
    expect(result).toHaveLength(20);
  });

  it('handles malformed seasons_json gracefully (treated as versatile)', () => {
    createClosetTable(adapter);
    insertItem(adapter, {
      id: 'bad',
      name: 'Bad JSON',
      seasons: null,
    });
    adapter.execute(
      `UPDATE cl_items SET seasons_json = ? WHERE id = ?`,
      ['{not json', 'bad'],
    );
    const result = suggestPackingFromCloset(adapter, {
      start_date: '2026-07-01',
      end_date: '2026-07-10',
    });
    expect(result.map((r) => r.itemId)).toEqual(['bad']);
    expect(result[0]!.reason).toBe('versatile');
  });
});
