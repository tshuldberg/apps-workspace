import { describe, it, expect } from 'vitest';
import { createModuleTestDatabase } from '@mylife/db';
import { MANHATTAN_MODULE } from '../../definition';
import { createEvent } from '../crud/events';
import { addFacet, getFacets, getEventIdsByFacet, removeFacet } from '../crud/facets';
import { upsertSource, getSources, setSourceEnabled, setSourceLastSynced } from '../crud/sources';

describe('manhattan facets CRUD', () => {
  it('adds, lists, queries by axis/value, and removes', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    const eventId = createEvent(adapter, { title: 'Jazz Night', startAt: '2026-07-04T20:00:00' });
    const facetId = addFacet(adapter, { eventId, axis: 'category', value: 'Music' });
    const facets = getFacets(adapter, eventId);
    expect(facets).toHaveLength(1);
    expect(facets[0]?.value).toBe('Music');
    const ids = getEventIdsByFacet(adapter, 'category', 'Music');
    expect(ids.map((r) => r.event_id)).toContain(eventId);
    removeFacet(adapter, facetId);
    expect(getFacets(adapter, eventId)).toHaveLength(0);
    close();
  });
});

describe('manhattan sources CRUD', () => {
  it('upserts, lists, enables/disables, and updates last_synced_at', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    upsertSource(adapter, { id: 'resident-advisor', enabled: true });
    const sources = getSources(adapter);
    expect(sources).toHaveLength(1);
    expect(sources[0]?.id).toBe('resident-advisor');
    expect(sources[0]?.enabled).toBe(1);
    setSourceEnabled(adapter, 'resident-advisor', false);
    expect(getSources(adapter)[0]?.enabled).toBe(0);
    setSourceLastSynced(adapter, 'resident-advisor', '2026-07-04T00:00:00');
    expect(getSources(adapter)[0]?.last_synced_at).toBe('2026-07-04T00:00:00');
    close();
  });

  it('upserts are idempotent (ON CONFLICT DO UPDATE)', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    upsertSource(adapter, { id: 'ra', enabled: true });
    upsertSource(adapter, { id: 'ra', enabled: false });
    expect(getSources(adapter)).toHaveLength(1);
    expect(getSources(adapter)[0]?.enabled).toBe(0);
    close();
  });
});
