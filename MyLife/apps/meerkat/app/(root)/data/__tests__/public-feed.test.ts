import { describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { isCommonsFeedConfigured, loadCommonsTopic, PUBLIC_FEED_TOPICS, type CommonsFeedConfig } from '../public-feed';

function fakeSettingsDb(): DatabaseAdapter {
  const store = new Map<string, string>();
  return {
    execute(sql: string, params: unknown[] = []): void {
      if (sql.includes('INSERT OR REPLACE INTO mk_settings')) store.set(String(params[0]), String(params[1]));
      else if (sql.includes('DELETE FROM mk_settings')) store.delete(String(params[0]));
    },
    query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
      if (sql.includes('SELECT value FROM mk_settings')) {
        const key = params.length ? String(params[0]) : '';
        return store.has(key) ? ([{ value: store.get(key) }] as unknown as T[]) : [];
      }
      return [];
    },
    transaction(fn: () => void): void { fn(); },
  };
}
const noDb = fakeSettingsDb();
const UNCONFIGURED: CommonsFeedConfig = { nodeUrl: '', topics: [] };
const CONFIGURED: CommonsFeedConfig = {
  nodeUrl: 'https://commons.example',
  topics: [{ channelId: 'commons', publicationId: 'pub-1', nodeKeyHex: 'ab'.repeat(32) }],
};

describe('public feed config + topic rail', () => {
  it('is configured only with an http node url AND at least one topic source', () => {
    expect(isCommonsFeedConfigured(UNCONFIGURED)).toBe(false);
    expect(isCommonsFeedConfigured({ nodeUrl: 'https://x', topics: [] })).toBe(false);
    expect(isCommonsFeedConfigured(CONFIGURED)).toBe(true);
  });

  it('declares the Commons topic chip rail (8 distinct topics incl. commons + technology)', () => {
    const ids = PUBLIC_FEED_TOPICS.map((t) => t.channelId);
    expect(ids).toContain('commons');
    expect(ids).toContain('technology');
    expect(new Set(ids).size).toBe(ids.length);
    expect(PUBLIC_FEED_TOPICS.length).toBe(8);
  });
});

describe('loadCommonsTopic (real reads, honest failures)', () => {
  it('honest states: not_configured / not_wired', async () => {
    expect((await loadCommonsTopic(noDb, UNCONFIGURED, 'commons')).ok).toBe(false);
    const r = await loadCommonsTopic(noDb, CONFIGURED, 'sports'); // topic has no source
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_wired');
  });

  it('an empty page returns zero posts (never a fabricated card)', async () => {
    // fetchPublicPage GETs {node}/public/{pub}/{channel}/page; a well-formed empty page verifies.
    const fake = (async () => ({ status: 200, json: async () => ({ events: [], publicPosts: [], hasMore: false }) })) as unknown as typeof fetch;
    const r = await loadCommonsTopic(noDb, CONFIGURED, 'commons', fake);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.posts).toHaveLength(0);
  });

  it('a 404 is an honest not_found, a network error is unreachable', async () => {
    const notFound = (async () => ({ status: 404, json: async () => ({}) })) as unknown as typeof fetch;
    const nf = await loadCommonsTopic(noDb, CONFIGURED, 'commons', notFound);
    expect(nf.ok).toBe(false);
    if (!nf.ok) expect(nf.reason).toBe('not_found');
    const failing = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    const un = await loadCommonsTopic(noDb, CONFIGURED, 'commons', failing);
    expect(un.ok).toBe(false);
    if (!un.ok) expect(un.reason).toBe('unreachable');
  });
});
