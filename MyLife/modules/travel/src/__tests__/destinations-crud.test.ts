import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import {
  createDestination,
  getDestination,
  updateDestination,
  deleteDestination,
  listDestinations,
  searchDestinations,
  markVisited,
  getBucketList,
  getRegionProgress,
  getCountryStats,
  getDecadeView,
} from '../db/crud/destinations';
import type { DestinationInput } from '../models/schemas';

let adapter: DatabaseAdapter;
let closeDb: () => void;

function makeInput(overrides: Partial<DestinationInput> = {}): DestinationInput {
  return {
    name: 'Paris',
    bucket_list: false,
    ...overrides,
  };
}

beforeEach(() => {
  const testDb = createModuleTestDatabase('travel', TRAVEL_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

// ── Create + read round-trip ────────────────────────────────────────

describe('createDestination', () => {
  it('returns a destination with a generated id', () => {
    const d = createDestination(adapter, makeInput());
    expect(d.id).toBeTruthy();
    expect(d.name).toBe('Paris');
  });

  it('persists optional fields when provided', () => {
    const d = createDestination(
      adapter,
      makeInput({
        country: 'France',
        country_code: 'fr',
        region: 'Île-de-France',
        lat: 48.8566,
        lng: 2.3522,
        rating: 5,
        bucket_list: true,
        priority: 1,
        notes_md: 'City of lights',
        best_season: 'spring',
      }),
    );
    expect(d.country).toBe('France');
    expect(d.country_code).toBe('FR'); // uppercased
    expect(d.lat).toBe(48.8566);
    expect(d.bucket_list).toBe(true);
    expect(d.priority).toBe(1);
  });

  it('starts with visit_count 0 and null visit dates', () => {
    const d = createDestination(adapter, makeInput());
    expect(d.visit_count).toBe(0);
    expect(d.first_visited).toBeNull();
    expect(d.last_visited).toBeNull();
  });

  it('rejects invalid country_code length', () => {
    expect(() =>
      createDestination(adapter, makeInput({ country_code: 'USA' })),
    ).toThrow();
  });

  it('rejects empty name', () => {
    expect(() =>
      createDestination(adapter, makeInput({ name: '' })),
    ).toThrow();
  });
});

describe('getDestination', () => {
  it('round-trips a created destination', () => {
    const created = createDestination(
      adapter,
      makeInput({ country: 'Japan', country_code: 'JP' }),
    );
    const fetched = getDestination(adapter, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.country_code).toBe('JP');
    expect(fetched!.bucket_list).toBe(false);
  });

  it('returns null for a missing id', () => {
    expect(getDestination(adapter, 'does-not-exist')).toBeNull();
  });
});

// ── Update ──────────────────────────────────────────────────────────

describe('updateDestination', () => {
  it('updates allowed fields and bumps updated_at', async () => {
    const created = createDestination(adapter, makeInput());
    await new Promise((r) => setTimeout(r, 5));
    updateDestination(adapter, created.id, { rating: 4, notes_md: 'loved it' });
    const after = getDestination(adapter, created.id)!;
    expect(after.rating).toBe(4);
    expect(after.notes_md).toBe('loved it');
    expect(after.updated_at >= created.updated_at).toBe(true);
  });

  it('flips bucket_list boolean', () => {
    const created = createDestination(adapter, makeInput({ bucket_list: false }));
    updateDestination(adapter, created.id, { bucket_list: true });
    expect(getDestination(adapter, created.id)!.bucket_list).toBe(true);
  });

  it('uppercases country_code on update', () => {
    const created = createDestination(adapter, makeInput());
    updateDestination(adapter, created.id, { country_code: 'de' });
    expect(getDestination(adapter, created.id)!.country_code).toBe('DE');
  });

  it('is a no-op when patch is empty', () => {
    const created = createDestination(adapter, makeInput());
    expect(() => updateDestination(adapter, created.id, {})).not.toThrow();
  });
});

// ── Delete ──────────────────────────────────────────────────────────

describe('deleteDestination', () => {
  it('removes the row', () => {
    const created = createDestination(adapter, makeInput());
    deleteDestination(adapter, created.id);
    expect(getDestination(adapter, created.id)).toBeNull();
  });
});

// ── List with filters ──────────────────────────────────────────────

describe('listDestinations', () => {
  it('filters by country_code', () => {
    createDestination(adapter, makeInput({ name: 'Paris', country_code: 'FR' }));
    createDestination(adapter, makeInput({ name: 'Tokyo', country_code: 'JP' }));
    const fr = listDestinations(adapter, { country_code: 'FR' });
    expect(fr).toHaveLength(1);
    expect(fr[0].name).toBe('Paris');
  });

  it('filters by bucket_list', () => {
    createDestination(adapter, makeInput({ name: 'Paris', bucket_list: true }));
    createDestination(adapter, makeInput({ name: 'Tokyo', bucket_list: false }));
    expect(listDestinations(adapter, { bucketList: true })).toHaveLength(1);
    expect(listDestinations(adapter, { bucketList: false })).toHaveLength(1);
  });

  it('filters by visited', () => {
    const a = createDestination(adapter, makeInput({ name: 'Paris' }));
    createDestination(adapter, makeInput({ name: 'Tokyo' }));
    markVisited(adapter, a.id, '2020-06-01');
    const visited = listDestinations(adapter, { visited: true });
    const unvisited = listDestinations(adapter, { visited: false });
    expect(visited.map((d) => d.name)).toEqual(['Paris']);
    expect(unvisited.map((d) => d.name)).toEqual(['Tokyo']);
  });

  it('filters by country and region', () => {
    createDestination(adapter, makeInput({ name: 'Nice', country: 'France', region: 'PACA' }));
    createDestination(adapter, makeInput({ name: 'Lyon', country: 'France', region: 'AURA' }));
    expect(listDestinations(adapter, { country: 'France' })).toHaveLength(2);
    expect(listDestinations(adapter, { region: 'AURA' })).toHaveLength(1);
  });
});

// ── Search ──────────────────────────────────────────────────────────

describe('searchDestinations', () => {
  it('matches name case-insensitively', () => {
    createDestination(adapter, makeInput({ name: 'Paris' }));
    createDestination(adapter, makeInput({ name: 'Tokyo' }));
    const hits = searchDestinations(adapter, 'par');
    expect(hits).toHaveLength(1);
    expect(hits[0].name).toBe('Paris');
  });

  it('matches country case-insensitively', () => {
    createDestination(adapter, makeInput({ name: 'Kyoto', country: 'Japan' }));
    const hits = searchDestinations(adapter, 'japan');
    expect(hits).toHaveLength(1);
    expect(hits[0].name).toBe('Kyoto');
  });
});

// ── markVisited ─────────────────────────────────────────────────────

describe('markVisited', () => {
  it('first call sets first_visited and last_visited, increments count', () => {
    const d = createDestination(adapter, makeInput());
    markVisited(adapter, d.id, '2020-06-01');
    const after = getDestination(adapter, d.id)!;
    expect(after.first_visited).toBe('2020-06-01');
    expect(after.last_visited).toBe('2020-06-01');
    expect(after.visit_count).toBe(1);
  });

  it('subsequent calls preserve first_visited, update last_visited, increment count', () => {
    const d = createDestination(adapter, makeInput());
    markVisited(adapter, d.id, '2020-06-01');
    markVisited(adapter, d.id, '2023-09-15');
    markVisited(adapter, d.id, '2025-01-10');
    const after = getDestination(adapter, d.id)!;
    expect(after.first_visited).toBe('2020-06-01');
    expect(after.last_visited).toBe('2025-01-10');
    expect(after.visit_count).toBe(3);
  });

  it('is a no-op for a missing id', () => {
    expect(() => markVisited(adapter, 'missing', '2020-06-01')).not.toThrow();
  });
});

// ── Bucket list ordering ───────────────────────────────────────────

describe('getBucketList', () => {
  it('returns only bucket_list=true rows, sorted by priority ASC (NULLs last)', () => {
    createDestination(adapter, makeInput({ name: 'C', bucket_list: true, priority: 3 }));
    createDestination(adapter, makeInput({ name: 'A', bucket_list: true, priority: 1 }));
    createDestination(adapter, makeInput({ name: 'B', bucket_list: true, priority: 2 }));
    createDestination(adapter, makeInput({ name: 'NP', bucket_list: true })); // null priority
    createDestination(adapter, makeInput({ name: 'Not-bucket', bucket_list: false }));

    const list = getBucketList(adapter);
    expect(list.map((d) => d.name)).toEqual(['A', 'B', 'C', 'NP']);
  });
});

// ── Region progress ─────────────────────────────────────────────────

describe('getRegionProgress', () => {
  it('counts distinct visited country_codes in the EU region', () => {
    // Seed 5 of 27 EU countries as visited.
    const visited = ['FR', 'DE', 'IT', 'ES', 'NL'];
    for (const code of visited) {
      const d = createDestination(adapter, makeInput({ name: code, country_code: code }));
      markVisited(adapter, d.id, '2020-01-01');
    }
    // Add an unvisited EU country; should not count.
    createDestination(adapter, makeInput({ name: 'PT', country_code: 'PT' }));

    const progress = getRegionProgress(adapter, 'eu_countries');
    expect(progress.total).toBe(27);
    expect(progress.visited).toBe(5);
    expect(progress.percent).toBe(Math.round((5 / 27) * 100));
  });

  it('returns zeros for an unknown region', () => {
    expect(getRegionProgress(adapter, 'nope')).toEqual({
      visited: 0,
      total: 0,
      percent: 0,
    });
  });

  it('does not double-count multiple visits to the same country', () => {
    const a = createDestination(adapter, makeInput({ name: 'Paris', country_code: 'FR' }));
    const b = createDestination(adapter, makeInput({ name: 'Nice', country_code: 'FR' }));
    markVisited(adapter, a.id, '2020-01-01');
    markVisited(adapter, b.id, '2021-01-01');
    const progress = getRegionProgress(adapter, 'eu_countries');
    expect(progress.visited).toBe(1);
  });
});

// ── Country / city stats ───────────────────────────────────────────

describe('getCountryStats', () => {
  it('returns zero-valued stats on empty DB', () => {
    expect(getCountryStats(adapter)).toEqual({
      countriesVisited: 0,
      citiesVisited: 0,
    });
  });

  it('counts distinct countries and visited cities', () => {
    const a = createDestination(adapter, makeInput({ name: 'Paris', country_code: 'FR' }));
    const b = createDestination(adapter, makeInput({ name: 'Nice', country_code: 'FR' }));
    const c = createDestination(adapter, makeInput({ name: 'Tokyo', country_code: 'JP' }));
    createDestination(adapter, makeInput({ name: 'Unvisited', country_code: 'DE' }));
    markVisited(adapter, a.id, '2020-01-01');
    markVisited(adapter, b.id, '2021-01-01');
    markVisited(adapter, c.id, '2022-01-01');

    const stats = getCountryStats(adapter);
    expect(stats.countriesVisited).toBe(2);
    expect(stats.citiesVisited).toBe(3);
  });
});

// ── Decade view ─────────────────────────────────────────────────────

describe('getDecadeView', () => {
  it('groups destinations by decade of first_visited and sorts ascending', () => {
    const a = createDestination(adapter, makeInput({ name: 'A' }));
    const b = createDestination(adapter, makeInput({ name: 'B' }));
    const c = createDestination(adapter, makeInput({ name: 'C' }));
    const d = createDestination(adapter, makeInput({ name: 'D' }));
    markVisited(adapter, a.id, '2012-04-01'); // 2010s
    markVisited(adapter, b.id, '2019-11-01'); // 2010s
    markVisited(adapter, c.id, '2021-06-01'); // 2020s
    markVisited(adapter, d.id, '2005-01-01'); // 2000s

    const view = getDecadeView(adapter);
    expect(view.map((b) => b.decade)).toEqual([2000, 2010, 2020]);
    expect(view[1].destinations.map((x) => x.name).sort()).toEqual(['A', 'B']);
  });

  it('omits destinations without a first_visited date', () => {
    createDestination(adapter, makeInput({ name: 'UnVisited' }));
    expect(getDecadeView(adapter)).toEqual([]);
  });
});
