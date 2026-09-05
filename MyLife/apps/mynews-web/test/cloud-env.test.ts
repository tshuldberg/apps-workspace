import { describe, expect, it } from 'vitest';
// `fetchLatest` lives in its own module rather than `lib/cloud.ts` precisely so a
// test can import it: the loader layer is marked `server-only`, which throws
// outside a server bundle by design (plan 48 WP10).
import { fetchLatest } from '../lib/latest-fetch';
import { parseCloudEnv } from '../lib/env';
import { resolveOrigin, FALLBACK_ORIGIN } from '../lib/origin';
import {
  buildLatestJournalistsUrl,
  buildLatestProfilesUrl,
  buildLatestUrl,
  LATEST_JOURNALIST_SELECT,
  LATEST_PROFILE_SELECT,
  LATEST_SELECT,
} from '../lib/queries';

function pathRecordedFetch(responses: Record<string, unknown>) {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const response = responses[new URL(url).pathname] ?? [];
    const wrapped = response as { status?: unknown; body?: unknown };
    const status = typeof wrapped?.status === 'number' ? wrapped.status : 200;
    const body = typeof wrapped?.status === 'number' ? wrapped.body ?? null : response;
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  return { impl, calls };
}

describe('parseCloudEnv', () => {
  it('returns null when either value is missing', () => {
    expect(parseCloudEnv(undefined, undefined)).toBeNull();
    expect(parseCloudEnv('https://x.supabase.co', undefined)).toBeNull();
    expect(parseCloudEnv(undefined, 'anon')).toBeNull();
    expect(parseCloudEnv('', '')).toBeNull();
    expect(parseCloudEnv('   ', '   ')).toBeNull();
  });

  it('rejects non-https urls', () => {
    expect(parseCloudEnv('http://x.supabase.co', 'anon')).toBeNull();
    expect(parseCloudEnv('ftp://x', 'anon')).toBeNull();
    expect(parseCloudEnv('x.supabase.co', 'anon')).toBeNull();
  });

  it('trims and strips trailing slashes', () => {
    expect(parseCloudEnv('  https://x.supabase.co/  ', '  anon-key  ')).toEqual({
      baseUrl: 'https://x.supabase.co',
      anonKey: 'anon-key',
    });
    expect(parseCloudEnv('https://x.supabase.co///', 'k')).toEqual({
      baseUrl: 'https://x.supabase.co',
      anonKey: 'k',
    });
  });

  it('accepts a valid https url + key', () => {
    expect(parseCloudEnv('https://abc.supabase.co', 'anon')).toEqual({
      baseUrl: 'https://abc.supabase.co',
      anonKey: 'anon',
    });
  });
});

describe('resolveOrigin', () => {
  it('falls back to the placeholder domain when unset', () => {
    expect(resolveOrigin(undefined)).toBe(FALLBACK_ORIGIN);
    expect(resolveOrigin('')).toBe(FALLBACK_ORIGIN);
    expect(resolveOrigin('   ')).toBe(FALLBACK_ORIGIN);
  });

  it('trims and strips trailing slashes from a configured origin', () => {
    expect(resolveOrigin('  https://news.example.com/  ')).toBe('https://news.example.com');
    expect(resolveOrigin('https://news.example.com//')).toBe('https://news.example.com');
  });
});

describe('buildLatestUrl', () => {
  it('builds a site-wide published-articles query', () => {
    const url = new URL(buildLatestUrl('https://abc.supabase.co', 10));
    expect(url.origin + url.pathname).toBe('https://abc.supabase.co/rest/v1/nw_articles');
    expect(url.searchParams.get('select')).toBe(LATEST_SELECT);
    expect(url.searchParams.get('status')).toBe('eq.published');
    expect(url.searchParams.get('order')).toBe('published_at.desc');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.get('nw_article_revisions.order')).toBe('rev.desc');
    expect(url.searchParams.get('nw_article_revisions.limit')).toBe('1');
    expect(LATEST_SELECT).toContain('author_id');
    expect(LATEST_SELECT).not.toContain('nw_public_profiles');
  });

  it('defaults the limit to 50', () => {
    const url = new URL(buildLatestUrl('https://abc.supabase.co'));
    expect(url.searchParams.get('limit')).toBe('50');
  });

  it('builds deduplicated standalone profile and journalist reads', () => {
    const profiles = new URL(
      buildLatestProfilesUrl('https://abc.supabase.co', ['p1', 'p1', 'p2']),
    );
    expect(profiles.pathname).toBe('/rest/v1/nw_public_profiles');
    expect(profiles.searchParams.get('select')).toBe(LATEST_PROFILE_SELECT);
    expect(profiles.searchParams.get('id')).toBe('in.("p1","p2")');
    expect(profiles.searchParams.get('limit')).toBe('2');

    const journalists = new URL(
      buildLatestJournalistsUrl('https://abc.supabase.co', ['p1', 'p1', 'p2']),
    );
    expect(journalists.pathname).toBe('/rest/v1/nw_public_journalists');
    expect(journalists.searchParams.get('select')).toBe(LATEST_JOURNALIST_SELECT);
    expect(journalists.searchParams.get('profile_id')).toBe('in.("p1","p2")');
    expect(journalists.searchParams.get('limit')).toBe('2');
  });
});

describe('fetchLatest', () => {
  const article = {
    id: 'a1',
    author_id: 'p1',
    slug: 'water',
    kind: 'news',
    current_rev: 1,
    published_at: '2026-07-03T10:00:00Z',
    nw_article_revisions: [{ rev: 1, headline: 'Water', dek: 'A reported story.' }],
  };
  const profile = {
    id: 'p1',
    handle: 'rosa',
    display_name: 'Rosa Marín',
    pubkey_ed25519: 'pub-rosa',
  };
  const journalist = { profile_id: 'p1', tier: 'verified' };

  it('stitches three path-keyed reads into complete feed rows', async () => {
    const { impl, calls } = pathRecordedFetch({
      '/rest/v1/nw_articles': [article],
      '/rest/v1/nw_public_profiles': [profile],
      '/rest/v1/nw_public_journalists': [journalist],
    });
    const rows = await fetchLatest('https://abc.supabase.co', 'anon', impl, 10);
    expect(rows).toEqual([
      expect.objectContaining({
        articleId: 'a1',
        authorHandle: 'rosa',
        authorTier: 'verified',
      }),
    ]);
    expect(calls.map((url) => new URL(url).pathname).sort()).toEqual([
      '/rest/v1/nw_articles',
      '/rest/v1/nw_public_journalists',
      '/rest/v1/nw_public_profiles',
    ]);
  });

  it('rejects the whole result when a stitched read fails', async () => {
    const { impl } = pathRecordedFetch({
      '/rest/v1/nw_articles': [article],
      '/rest/v1/nw_public_profiles': { status: 503, body: { message: 'unavailable' } },
      '/rest/v1/nw_public_journalists': [journalist],
    });
    await expect(fetchLatest('https://abc.supabase.co', 'anon', impl)).rejects.toThrow(
      'mynews latest profile read failed: 503',
    );
  });
});
