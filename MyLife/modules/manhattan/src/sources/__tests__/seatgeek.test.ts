import { describe, it, expect, afterEach } from 'vitest';
import {
  mapSeatGeekEvent,
  seatGeekAdapter,
  getSeatGeekClientId,
  getSeatGeekProxyUrl,
  SEATGEEK_ENDPOINT,
  SEATGEEK_PROXY_PATH,
} from '../seatgeek';
import type { FetchImpl, FetchResponse } from '../types';

const FIXTURE_EVENT = {
  id: 5821247,
  title: 'The Strokes',
  type: 'concert',
  datetime_local: '2026-07-01T20:00:00',
  url: 'https://seatgeek.com/the-strokes-tickets/5821247',
  venue: {
    name: 'Madison Square Garden',
    address: '4 Pennsylvania Plaza',
    location: { lat: 40.7505, lon: -73.9934 },
  },
  stats: { lowest_price: 89 },
};

function fakeResponse(body: unknown, ok = true, status = 200): FetchResponse {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) };
}

afterEach(() => {
  delete process.env.EXPO_PUBLIC_SEATGEEK_CLIENT_ID;
  delete process.env.EXPO_PUBLIC_MANHATTAN_ALLOW_DIRECT_SEATGEEK;
  delete process.env.EXPO_PUBLIC_MANHATTAN_SEATGEEK_PROXY_URL;
});

describe('mapSeatGeekEvent', () => {
  it('maps a fixture event to a NormalizedEvent', () => {
    const e = mapSeatGeekEvent(FIXTURE_EVENT);
    expect(e.sourceId).toBe('seatgeek');
    expect(e.externalId).toBe('5821247');
    expect(e.title).toBe('The Strokes');
    expect(e.startAt).toBe('2026-07-01T20:00:00');
    expect(e.venueName).toBe('Madison Square Garden');
    expect(e.address).toBe('4 Pennsylvania Plaza');
    expect(e.lat).toBe(40.7505);
    expect(e.lng).toBe(-73.9934);
    expect(e.category).toBe('Music');
    expect(e.priceMin).toBe(89);
    expect(e.purchaseUrl).toBe('https://seatgeek.com/the-strokes-tickets/5821247');
    expect(e.ticketProvider).toBe('SeatGeek');
  });

  it('handles missing optional fields', () => {
    const e = mapSeatGeekEvent({ id: 1, title: 'x' });
    expect(e.priceMin).toBeUndefined();
    expect(e.category).toBeUndefined();
    expect(e.venueName).toBeUndefined();
  });
});

describe('seatGeekAdapter availability', () => {
  it('is unavailable when no proxy or explicit dev client id is configured', () => {
    delete process.env.EXPO_PUBLIC_SEATGEEK_CLIENT_ID;
    expect(getSeatGeekClientId()).toBeNull();
    expect(seatGeekAdapter.isAvailable()).toBe(false);
  });

  it('does not expose a direct client id unless the dev flag is enabled', () => {
    process.env.EXPO_PUBLIC_SEATGEEK_CLIENT_ID = 'test_id';
    expect(getSeatGeekClientId()).toBeNull();
    expect(seatGeekAdapter.isAvailable()).toBe(false);
  });

  it('is available when a direct client id is explicitly enabled for development', () => {
    process.env.EXPO_PUBLIC_MANHATTAN_ALLOW_DIRECT_SEATGEEK = 'true';
    process.env.EXPO_PUBLIC_SEATGEEK_CLIENT_ID = 'test_id';
    expect(getSeatGeekClientId()).toBe('test_id');
    expect(seatGeekAdapter.isAvailable()).toBe(true);
  });

  it('is available when an HTTPS proxy is configured', () => {
    process.env.EXPO_PUBLIC_MANHATTAN_SEATGEEK_PROXY_URL = 'https://example.supabase.co/functions/v1';
    expect(getSeatGeekProxyUrl()).toBe('https://example.supabase.co/functions/v1');
    expect(seatGeekAdapter.isAvailable()).toBe(true);
  });

  it('rejects a non-HTTPS proxy URL', () => {
    process.env.EXPO_PUBLIC_MANHATTAN_SEATGEEK_PROXY_URL = 'http://localhost:54321';
    expect(getSeatGeekProxyUrl()).toBeNull();
    expect(seatGeekAdapter.isAvailable()).toBe(false);
  });

  it('returns empty without a proxy or explicit dev client id even if fetch is provided', async () => {
    delete process.env.EXPO_PUBLIC_SEATGEEK_CLIENT_ID;
    const fetchImpl: FetchImpl = async () => {
      throw new Error('should not fetch');
    };
    expect(await seatGeekAdapter.fetchEvents({}, fetchImpl)).toEqual([]);
  });

  it('fetches and maps events when a client id is set', async () => {
    process.env.EXPO_PUBLIC_MANHATTAN_ALLOW_DIRECT_SEATGEEK = 'true';
    process.env.EXPO_PUBLIC_SEATGEEK_CLIENT_ID = 'test_id';
    let calledUrl = '';
    const fetchImpl: FetchImpl = async (url) => {
      calledUrl = url;
      return fakeResponse({ events: [FIXTURE_EVENT] });
    };
    const events = await seatGeekAdapter.fetchEvents({ city: 'New York', limit: 10 }, fetchImpl);
    expect(calledUrl).toContain(SEATGEEK_ENDPOINT);
    expect(calledUrl).toContain('client_id=test_id');
    expect(calledUrl).toContain('per_page=10');
    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe('The Strokes');
  });

  it('fetches through the configured proxy without a client id', async () => {
    process.env.EXPO_PUBLIC_MANHATTAN_SEATGEEK_PROXY_URL = 'https://example.supabase.co/functions/v1/';
    let calledUrl = '';
    const fetchImpl: FetchImpl = async (url) => {
      calledUrl = url;
      return fakeResponse({ events: [FIXTURE_EVENT] });
    };
    const events = await seatGeekAdapter.fetchEvents({ city: 'New York', limit: 10 }, fetchImpl);
    expect(calledUrl).toBe(
      `https://example.supabase.co/functions/v1${SEATGEEK_PROXY_PATH}?city=New%20York&limit=10`,
    );
    expect(calledUrl).not.toContain('client_id=');
    expect(events).toHaveLength(1);
  });
});
