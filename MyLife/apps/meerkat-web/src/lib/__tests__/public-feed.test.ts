import { describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { isCommonsFeedConfigured, loadCommonsTopic, PUBLIC_FEED_TOPICS, type CommonsFeedConfig } from '../public-feed';

function fakeSettingsDb(): DatabaseAdapter {
  const store = new Map<string, string>();
  return {
    execute(sql: string, params: unknown[] = []): void {
      if (sql.includes('INSERT OR REPLACE INTO mk_settings')) store.set(String(params[0]), String(params[1]));
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

const db = fakeSettingsDb();
const CONFIGURED: CommonsFeedConfig = {
  nodeUrl: 'https://commons.example',
  topics: [{ channelId: 'commons', publicationId: 'pub-1', nodeKeyHex: 'ab'.repeat(32) }],
};

describe('web public feed config + topic rail', () => {
  it('is configured only with an http node url AND a topic source', () => {
    expect(isCommonsFeedConfigured({ nodeUrl: '', topics: [] })).toBe(false);
    expect(isCommonsFeedConfigured({ nodeUrl: 'https://x', topics: [] })).toBe(false);
    expect(isCommonsFeedConfigured(CONFIGURED)).toBe(true);
  });

  it('declares the same topic rail as the native twin', () => {
    const ids = PUBLIC_FEED_TOPICS.map((t) => t.channelId);
    expect(ids).toContain('commons');
    expect(ids).toContain('technology');
    expect(PUBLIC_FEED_TOPICS.length).toBe(8);
  });

  it('loadCommonsTopic: honest states + an empty page yields zero posts', async () => {
    expect((await loadCommonsTopic(db, { nodeUrl: '', topics: [] }, 'commons')).ok).toBe(false);
    const wired = await loadCommonsTopic(db, CONFIGURED, 'sports');
    expect(wired.ok).toBe(false);
    if (!wired.ok) expect(wired.reason).toBe('not_wired');
    const fake = (async () => ({ status: 200, json: async () => ({ events: [], publicPosts: [], hasMore: false }) })) as unknown as typeof fetch;
    const r = await loadCommonsTopic(db, CONFIGURED, 'commons', fake);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.posts).toHaveLength(0);
  });
});
