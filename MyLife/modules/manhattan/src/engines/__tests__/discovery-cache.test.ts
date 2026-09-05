import { describe, it, expect } from 'vitest';
import { createModuleTestDatabase } from '@mylife/db';
import { MANHATTAN_MODULE } from '../../definition';
import { getEvents } from '../../db/crud/events';
import { getSourceCacheRows } from '../../db/crud/source-cache';
import { setSourceEnabled, upsertSource } from '../../db/crud/sources';
import { getCachedDiscoveryEvents, refreshDiscoveryCache } from '../discovery-cache';
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

describe('discovery cache', () => {
  it('stores live discovery results in mh_source_cache without creating events', async () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    upsertSource(adapter, { id: 'src_a' });

    const result = await refreshDiscoveryCache(
      adapter,
      [
        fakeAdapter('src_a', [
          {
            sourceId: 'src_a',
            externalId: 'a-1',
            title: 'Jazz Jam Session',
            venueName: 'Blue Note',
            startAt: '2026-07-01T20:00:00',
            isFree: true,
          },
        ]),
      ],
      {},
      noopFetch,
      '2026-07-01T09:00:00.000Z',
    );

    expect(result).toEqual({ fetched: 1, sources: ['src_a'], failed: 0 });
    expect(getEvents(adapter)).toHaveLength(0);
    expect(getSourceCacheRows(adapter)).toHaveLength(1);

    const cached = getCachedDiscoveryEvents(adapter, new Date('2026-07-01T09:01:00.000Z'));
    expect(cached).toHaveLength(1);
    expect(cached[0]?.title).toBe('Jazz Jam Session');
    expect(cached[0]?.facets.some((f) => f.axis === 'price' && f.value === 'Free')).toBe(true);
    close();
  });

  it('does not fetch disabled sources', async () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    upsertSource(adapter, { id: 'src_a' });
    setSourceEnabled(adapter, 'src_a', false);

    const result = await refreshDiscoveryCache(
      adapter,
      [fakeAdapter('src_a', [{ sourceId: 'src_a', externalId: 'a-1', title: 'Hidden Show' }])],
      {},
      noopFetch,
      '2026-07-01T09:00:00.000Z',
    );

    expect(result).toEqual({ fetched: 0, sources: [], failed: 0 });
    expect(getSourceCacheRows(adapter)).toHaveLength(0);
    close();
  });
});
