import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ODDS_CACHE_TTL_MS,
  ODDS_NEGATIVE_TTL_MS,
  clearOddsCache,
  fetchCurrentOdds,
  fetchFuturesOdds,
} from '../engine/odds-fetch';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function oddsFixture(eventId: string, bookKey: string) {
  return {
    id: eventId,
    sport_key: 'americanfootball_nfl',
    bookmakers: [
      {
        key: bookKey,
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: 'Dallas Cowboys', price: -120 },
              { name: 'Philadelphia Eagles', price: 105 },
            ],
          },
        ],
      },
    ],
  };
}

function outrightsFixture(bookKey: string) {
  return [
    {
      id: 'futures-nfl-championship',
      sport_key: 'americanfootball_nfl',
      bookmakers: [
        {
          key: bookKey,
          markets: [
            {
              key: 'outrights',
              outcomes: [
                { name: 'Kansas City Chiefs', price: 450 },
                { name: 'Philadelphia Eagles', price: 700 },
                { name: 'Buffalo Bills', price: 900 },
              ],
            },
          ],
        },
      ],
    },
  ];
}

describe('fetchCurrentOdds', () => {
  afterEach(() => {
    clearOddsCache();
  });

  it('normalizes the Odds API payload into OddsSnapshot[] on happy path', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toMatch(/americanfootball_nfl\/odds/);
      expect(url).toMatch(/markets=h2h/);
      expect(url).toMatch(/apiKey=secret/);
      return mockResponse(200, [oddsFixture('evt-1', 'draftkings')]);
    });
    const snapshots = await fetchCurrentOdds({
      league: 'nfl',
      market: 'h2h',
      apiKey: 'secret',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => 1_700_000_000_000,
    });
    expect(snapshots).not.toBeNull();
    expect(snapshots).toHaveLength(2);
    expect(snapshots![0]).toMatchObject({
      league: 'nfl',
      event_id: 'evt-1',
      market: 'h2h',
      sportsbook: 'draftkings',
      team: 'Dallas Cowboys',
      price_american: -120,
      fetched_at: 1_700_000_000_000,
    });
  });

  it('returns null (no throw) and negative-caches when apiKey is missing', async () => {
    const fetchImpl = vi.fn();
    const result = await fetchCurrentOdds({
      league: 'nba',
      market: 'h2h',
      apiKey: null,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => 1_700_000_000_000,
    });
    expect(result).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();

    // Subsequent call inside neg-TTL: cached null, still no network.
    const result2 = await fetchCurrentOdds({
      league: 'nba',
      market: 'h2h',
      apiKey: null,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => 1_700_000_000_000 + ODDS_NEGATIVE_TTL_MS - 1,
    });
    expect(result2).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns null on 401 and holds the negative cache for 1h', async () => {
    const fetchImpl = vi.fn(async () => mockResponse(401, { error: 'unauthorized' }));
    const t0 = 2_000_000_000_000;
    const result = await fetchCurrentOdds({
      league: 'nfl',
      market: 'spreads',
      apiKey: 'bad',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => t0,
    });
    expect(result).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // Inside 1h: still cached null, no new network.
    const result2 = await fetchCurrentOdds({
      league: 'nfl',
      market: 'spreads',
      apiKey: 'bad',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => t0 + ODDS_NEGATIVE_TTL_MS - 10,
    });
    expect(result2).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // After 1h + 1s: negative cache expires, fetch is retried.
    const result3 = await fetchCurrentOdds({
      league: 'nfl',
      market: 'spreads',
      apiKey: 'bad',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => t0 + ODDS_NEGATIVE_TTL_MS + 1_000,
    });
    expect(result3).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('returns null on 429 rate limit', async () => {
    const fetchImpl = vi.fn(async () => mockResponse(429, {}));
    const result = await fetchCurrentOdds({
      league: 'mlb',
      market: 'totals',
      apiKey: 'ok',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('serves from positive cache inside 24h TTL and re-fetches after expiry', async () => {
    const fetchImpl = vi.fn(async () =>
      mockResponse(200, [oddsFixture('evt-1', 'draftkings')]),
    );
    const t0 = 3_000_000_000_000;
    // First call: network hit.
    await fetchCurrentOdds({
      league: 'nhl',
      market: 'h2h',
      apiKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => t0,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // Second call inside TTL: cache hit.
    await fetchCurrentOdds({
      league: 'nhl',
      market: 'h2h',
      apiKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => t0 + ODDS_CACHE_TTL_MS - 10,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // Third call past TTL: network hit again.
    await fetchCurrentOdds({
      league: 'nhl',
      market: 'h2h',
      apiKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => t0 + ODDS_CACHE_TTL_MS + 100,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('propagates AbortSignal rejections from the fetch layer', async () => {
    const fetchImpl: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        const signal = (init as { signal?: AbortSignal }).signal;
        signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    const controller = new AbortController();
    const pending = fetchCurrentOdds({
      league: 'nfl',
      market: 'h2h',
      apiKey: 'k',
      fetchImpl,
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toThrow(/abort/i);
  });

  it('returns null when the Odds API returns a malformed (non-array) payload', async () => {
    const fetchImpl = vi.fn(async () =>
      mockResponse(200, { not: 'an array' }),
    );
    const result = await fetchCurrentOdds({
      league: 'mls',
      market: 'h2h',
      apiKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toBeNull();
  });

  it('filters by sportsbook when one is specified', async () => {
    const fetchImpl = vi.fn(async () =>
      mockResponse(200, [
        {
          id: 'evt-2',
          bookmakers: [
            {
              key: 'draftkings',
              markets: [
                { key: 'h2h', outcomes: [{ name: 'A', price: -110 }] },
              ],
            },
            {
              key: 'fanduel',
              markets: [
                { key: 'h2h', outcomes: [{ name: 'A', price: -105 }] },
              ],
            },
          ],
        },
      ]),
    );
    const result = await fetchCurrentOdds({
      league: 'nfl',
      market: 'h2h',
      sportsbook: 'fanduel',
      apiKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).not.toBeNull();
    expect(result!.length).toBe(1);
    expect(result![0].sportsbook).toBe('fanduel');
    expect(result![0].price_american).toBe(-105);
  });
});

describe('fetchFuturesOdds', () => {
  afterEach(() => {
    clearOddsCache();
  });

  it('returns outrights with null event_id on happy path', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toMatch(/markets=outrights/);
      return mockResponse(200, outrightsFixture('draftkings'));
    });
    const snapshots = await fetchFuturesOdds({
      league: 'nfl',
      apiKey: 'secret',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => 4_000_000_000_000,
    });
    expect(snapshots).not.toBeNull();
    expect(snapshots).toHaveLength(3);
    expect(snapshots![0]).toMatchObject({
      league: 'nfl',
      event_id: null,
      market: 'outrights',
      sportsbook: 'draftkings',
      team: 'Kansas City Chiefs',
      price_american: 450,
    });
  });

  it('shares LRU with fetchCurrentOdds (positive + negative entries both evict)', async () => {
    // Prime a negative entry via missing key.
    const noop = vi.fn();
    const r1 = await fetchFuturesOdds({
      league: 'nba',
      apiKey: null,
      fetchImpl: noop as unknown as typeof fetch,
      now: () => 5_000_000_000_000,
    });
    expect(r1).toBeNull();
    // clearOddsCache should purge both pos + neg entries (single cache).
    clearOddsCache();
    // Next call with a real fetch should miss and hit network.
    const fetchImpl = vi.fn(async () =>
      mockResponse(200, outrightsFixture('fanduel')),
    );
    const r2 = await fetchFuturesOdds({
      league: 'nba',
      apiKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => 5_000_000_000_000,
    });
    expect(r2).not.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
