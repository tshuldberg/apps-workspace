import { describe, it, expect } from 'vitest';
import { mapNycRow, nycOpenDataAdapter, NYC_OPEN_DATA_ENDPOINT } from '../nyc-open-data';
import type { FetchImpl, FetchResponse } from '../types';

// Real row shape captured live from resource fudw-fgrp.
const FIXTURE_ROW = {
  event_id: '173635',
  title: 'Central Park Tour: Iconic Views of Central Park',
  date: '2018-10-21T00:00:00.000',
  start_time: '11:00',
  end_time: '12:30',
  location_description: 'Mid-park between 64th and 65th Streets.',
  description: '<p>Take our signature tour...</p>',
  snippet: "Some of New York's most iconic sights are found in Central Park.",
  cost_free: '0',
  cost_description: 'Tickets: $15 per person.',
  url: 'central-park-tour-iconic-views-of-central-park',
};

function fakeResponse(body: unknown, ok = true, status = 200): FetchResponse {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe('mapNycRow', () => {
  it('maps a real fixture row to a NormalizedEvent', () => {
    const e = mapNycRow(FIXTURE_ROW);
    expect(e.sourceId).toBe('nyc_open_data');
    expect(e.externalId).toBe('173635');
    expect(e.title).toBe('Central Park Tour: Iconic Views of Central Park');
    expect(e.startAt).toBe('2018-10-21T11:00:00');
    expect(e.endAt).toBe('2018-10-21T12:30:00');
    expect(e.venueName).toBe('Mid-park between 64th and 65th Streets.');
    expect(e.isFree).toBe(false);
  });

  it('treats cost_free 1 as free', () => {
    expect(mapNycRow({ ...FIXTURE_ROW, cost_free: '1' }).isFree).toBe(true);
  });

  it('falls back to snippet when description is missing and uses defaults', () => {
    const e = mapNycRow({ event_id: '1', snippet: 'short' });
    expect(e.title).toBe('Untitled Event');
    expect(e.description).toBe('short');
    expect(e.startAt).toBeUndefined();
  });

  it('reads coordinates when present', () => {
    const e = mapNycRow({ event_id: '2', title: 'x', coordinates: [-73.9, 40.7] });
    expect(e.lng).toBe(-73.9);
    expect(e.lat).toBe(40.7);
  });
});

describe('nycOpenDataAdapter', () => {
  it('is an available tier1 source', () => {
    expect(nycOpenDataAdapter.tier).toBe('tier1');
    expect(nycOpenDataAdapter.isAvailable()).toBe(true);
  });

  it('fetches rows through the injected fetchImpl and maps them', async () => {
    let calledUrl = '';
    const fetchImpl: FetchImpl = async (url) => {
      calledUrl = url;
      return fakeResponse([FIXTURE_ROW]);
    };
    const events = await nycOpenDataAdapter.fetchEvents({ limit: 5 }, fetchImpl);
    expect(calledUrl).toBe(`${NYC_OPEN_DATA_ENDPOINT}?$limit=5`);
    expect(events).toHaveLength(1);
    expect(events[0]?.externalId).toBe('173635');
  });

  it('returns empty list on a non-ok response', async () => {
    const fetchImpl: FetchImpl = async () => fakeResponse(null, false, 500);
    expect(await nycOpenDataAdapter.fetchEvents({}, fetchImpl)).toEqual([]);
  });
});
