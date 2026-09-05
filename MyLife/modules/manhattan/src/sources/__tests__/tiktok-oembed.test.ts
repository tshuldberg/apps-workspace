import { describe, it, expect, vi } from 'vitest';
import type { FetchImpl, FetchResponse } from '../types';

// The on-device share parser is built in parallel (parser/url-parser.ts). Mock
// it here so this slice is deterministic and self-contained: the stub lifts a
// startAt + venueName only when the caption text contains the fixture markers,
// matching the real parser's contract of extracting date/venue from post text.
vi.mock('../parser/url-parser', () => ({
  parseEventFromShared: ({ text }: { text?: string }) => {
    if (text && text.includes('July 1') && text.includes('Blue Note')) {
      return { title: text, startAt: '2026-07-01T20:00:00', venueName: 'Blue Note', rawText: text };
    }
    return null;
  },
}));

import {
  mapTikTokOembed,
  fetchTikTokEvent,
  tiktokOembedAdapter,
  TIKTOK_OEMBED_ENDPOINT,
} from '../tiktok-oembed';

const SOURCE_URL = 'https://www.tiktok.com/@nycjazz/video/7300000000000000000';

const FIXTURE: {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
  author_url?: string;
  html?: string;
} = {
  title: 'Live jazz July 1 at Blue Note, come through',
  author_name: 'nycjazz',
  thumbnail_url: 'https://p16.tiktokcdn.com/thumb.jpg',
  author_url: 'https://www.tiktok.com/@nycjazz',
  html: '<blockquote class="tiktok-embed"></blockquote>',
};

function fakeResponse(body: unknown, ok = true, status = 200): FetchResponse {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) };
}

describe('mapTikTokOembed', () => {
  it('maps an oEmbed fixture and lifts startAt/venueName from the caption', () => {
    const e = mapTikTokOembed(FIXTURE, SOURCE_URL);
    expect(e.sourceId).toBe('tiktok_oembed');
    expect(e.externalId).toBe(SOURCE_URL);
    expect(e.title).toBe('Live jazz July 1 at Blue Note, come through');
    expect(e.startAt).toBe('2026-07-01T20:00:00');
    expect(e.venueName).toBe('Blue Note');
    expect(e.imageUrl).toBe('https://p16.tiktokcdn.com/thumb.jpg');
    expect(e.purchaseUrl).toBe(SOURCE_URL);
    expect(e.ticketProvider).toBeUndefined();
  });

  it('falls back to author_name when title is missing and lifts nothing', () => {
    const e = mapTikTokOembed({ author_name: 'someuser', thumbnail_url: 'x.jpg' }, SOURCE_URL);
    expect(e.title).toBe('someuser');
    expect(e.startAt).toBeUndefined();
    expect(e.venueName).toBeUndefined();
    expect(e.imageUrl).toBe('x.jpg');
  });
});

describe('fetchTikTokEvent', () => {
  it('fetches the oEmbed endpoint and maps the result on success', async () => {
    let calledUrl = '';
    const fetchImpl: FetchImpl = async (url) => {
      calledUrl = url;
      return fakeResponse(FIXTURE);
    };
    const e = await fetchTikTokEvent(SOURCE_URL, fetchImpl);
    expect(calledUrl).toContain(TIKTOK_OEMBED_ENDPOINT);
    expect(calledUrl).toContain(encodeURIComponent(SOURCE_URL));
    expect(e).not.toBeNull();
    expect(e?.title).toBe('Live jazz July 1 at Blue Note, come through');
    expect(e?.startAt).toBe('2026-07-01T20:00:00');
  });

  it('returns null on a non-ok response', async () => {
    const fetchImpl: FetchImpl = async () => fakeResponse({}, false, 404);
    expect(await fetchTikTokEvent(SOURCE_URL, fetchImpl)).toBeNull();
  });

  it('returns null when the body is not JSON', async () => {
    const fetchImpl: FetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('not json');
      },
      text: async () => 'not json',
    });
    expect(await fetchTikTokEvent(SOURCE_URL, fetchImpl)).toBeNull();
  });
});

describe('tiktokOembedAdapter', () => {
  it('is an available tier1 source that does not query during pull ingest', async () => {
    expect(tiktokOembedAdapter.id).toBe('tiktok_oembed');
    expect(tiktokOembedAdapter.displayName).toBe('TikTok');
    expect(tiktokOembedAdapter.tier).toBe('tier1');
    expect(tiktokOembedAdapter.coverage.ingestKinds).toEqual(['oembed']);
    expect(tiktokOembedAdapter.coverage.realtime).toBe(false);
    expect(tiktokOembedAdapter.gapFlag).toBeUndefined();
    expect(tiktokOembedAdapter.isAvailable()).toBe(true);
    expect(
      await tiktokOembedAdapter.fetchEvents({}, async () => {
        throw new Error('should not fetch');
      }),
    ).toEqual([]);
  });
});
