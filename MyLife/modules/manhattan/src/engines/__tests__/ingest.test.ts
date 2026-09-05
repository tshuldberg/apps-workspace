import { describe, it, expect } from 'vitest';
import { createModuleTestDatabase } from '@mylife/db';
import { MANHATTAN_MODULE } from '../../definition';
import { ingestFromSources } from '../ingest';
import { getEvents } from '../../db/crud/events';
import { getFacets } from '../../db/crud/facets';
import { setSourceEnabled, upsertSource } from '../../db/crud/sources';
import type { EventSourceAdapter, NormalizedEvent } from '../../sources/types';

function fakeAdapter(id: string, events: NormalizedEvent[]): EventSourceAdapter {
  return {
    id,
    displayName: id,
    tier: 'tier1',
    coverage: { categories: [], ingestKinds: ['api'], realtime: false },
    isAvailable: () => true,
    async fetchEvents() {
      return events;
    },
  };
}

const noopFetch = async () => {
  throw new Error('fetchImpl should not be used by fake adapters');
};

describe('ingestFromSources', () => {
  it('dedupes across sources, persists rows, and writes facets', async () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    upsertSource(adapter, { id: 'src_a' });
    upsertSource(adapter, { id: 'src_b' });

    const adapterA = fakeAdapter('src_a', [
      {
        sourceId: 'src_a',
        externalId: 'a-1',
        title: 'Jazz Jam Session',
        venueName: 'Blue Note',
        startAt: '2026-07-01T20:00:00',
        isFree: true,
      },
      {
        sourceId: 'src_a',
        externalId: 'a-2',
        title: 'Comedy Cellar Late Show',
        venueName: 'Comedy Cellar',
        startAt: '2026-07-02T22:00:00',
        priceMin: 25,
      },
    ]);
    // src_b returns a duplicate of the Blue Note event (same title/venue/day).
    const adapterB = fakeAdapter('src_b', [
      {
        sourceId: 'src_b',
        externalId: 'b-9',
        title: 'jazz JAM session!',
        venueName: 'Blue Note',
        startAt: '2026-07-01T21:30:00',
      },
    ]);

    const result = await ingestFromSources(
      adapter,
      [adapterA, adapterB],
      { city: 'New York', limit: 50 },
      noopFetch,
      '2026-07-01T09:00:00',
    );

    expect(result.inserted).toBe(2);
    expect(result.sources).toEqual(['src_a', 'src_b']);

    const rows = getEvents(adapter);
    expect(rows).toHaveLength(2);

    const jazz = rows.find((r) => r.venue_name === 'Blue Note')!;
    const facets = getFacets(adapter, jazz.id);
    const facetMap = Object.fromEntries(facets.map((f) => [f.axis, f.value]));
    expect(facetMap.category).toBe('Music');
    expect(facetMap.format).toBe('Jam Session');
    expect(facetMap.price).toBe('Free');
    expect(facetMap.time).toBe('Tonight');

    // last_synced_at recorded for both sources
    const sources = adapter.query<{ id: string; last_synced_at: string | null }>(
      `SELECT id, last_synced_at FROM mh_sources ORDER BY id`,
    );
    expect(sources.every((s) => s.last_synced_at != null)).toBe(true);

    close();
  });

  it('skips a failing adapter and still ingests the rest', async () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    const failing: EventSourceAdapter = {
      ...fakeAdapter('boom', []),
      async fetchEvents() {
        throw new Error('source down');
      },
    };
    const ok = fakeAdapter('ok', [
      { sourceId: 'ok', externalId: 'ok-1', title: 'Rooftop Party', startAt: '2026-07-03T22:00:00' },
    ]);

    const result = await ingestFromSources(adapter, [failing, ok], {}, noopFetch, '2026-07-01T09:00:00');
    expect(result.inserted).toBe(1);
    expect(getEvents(adapter)).toHaveLength(1);
    close();
  });

  it('ignores non-tier1 and unavailable adapters', async () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    const gapLike: EventSourceAdapter = {
      ...fakeAdapter('gap', [{ sourceId: 'gap', title: 'x' }]),
      tier: 'gap',
    };
    const unavailable: EventSourceAdapter = {
      ...fakeAdapter('off', [{ sourceId: 'off', title: 'y' }]),
      isAvailable: () => false,
    };
    const result = await ingestFromSources(adapter, [gapLike, unavailable], {}, noopFetch);
    expect(result.inserted).toBe(0);
    expect(result.sources).toEqual([]);
    close();
  });

  it('skips disabled persisted sources', async () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    upsertSource(adapter, { id: 'src_a' });
    setSourceEnabled(adapter, 'src_a', false);

    const result = await ingestFromSources(
      adapter,
      [fakeAdapter('src_a', [{ sourceId: 'src_a', externalId: 'a-1', title: 'Hidden Show' }])],
      {},
      noopFetch,
    );

    expect(result.inserted).toBe(0);
    expect(result.sources).toEqual([]);
    expect(getEvents(adapter)).toHaveLength(0);
    close();
  });

  it('updates an existing row on repeat ingest instead of duplicating', async () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    const first = fakeAdapter('src', [
      { sourceId: 'src', externalId: 'e-1', title: 'Show', startAt: '2026-07-01T20:00:00' },
    ]);
    await ingestFromSources(adapter, [first], {}, noopFetch, '2026-07-01T09:00:00');
    const second = fakeAdapter('src', [
      { sourceId: 'src', externalId: 'e-1', title: 'Show (updated)', startAt: '2026-07-01T20:00:00' },
    ]);
    await ingestFromSources(adapter, [second], {}, noopFetch, '2026-07-01T09:00:00');
    const rows = getEvents(adapter);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe('Show (updated)');
    close();
  });
});
