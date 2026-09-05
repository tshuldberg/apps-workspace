import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  createPublicPost,
  extractPersonaPrivateKeyHex,
  generatePublicPersona,
  publicPostNodeKeypairFromSeed,
  signPublicPostAcceptance,
  type AcceptedPublicPost,
} from '@mylife/sync';
import { loadPublicThread, replyCountLabel } from '../public-thread';

type CommonsFeedConfig = Parameters<typeof loadPublicThread>[1];

const NODE_KP = publicPostNodeKeypairFromSeed('44'.repeat(32));
const FEED: CommonsFeedConfig = {
  nodeUrl: 'https://commons.example',
  topics: [{ channelId: 'commons', publicationId: 'pub-1', nodeKeyHex: NODE_KP.publicKeyHex }],
};

function fakeDb(): DatabaseAdapter {
  return {
    execute() {},
    query<T = Record<string, unknown>>(): T[] { return [] as unknown as T[]; },
    transaction(fn: () => void) { fn(); },
    flush() {},
  } as unknown as DatabaseAdapter;
}

function accepted(persona: { publicKeyHex: string; privateKeyHex: string }, body: string, parentPostId: string | null, wall: string, counter: number): AcceptedPublicPost {
  const post = createPublicPost(persona, { publicationId: 'pub-1', channelId: 'commons', body, parentPostId, now: wall });
  const receipt = signPublicPostAcceptance(NODE_KP, { post, hlc: { wall, counter }, acceptedAt: wall });
  return { post, receipt };
}

function pageFetch(posts: AcceptedPublicPost[], status = 200): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/page')) {
      if (status !== 200) return { status, ok: false, json: async () => ({}) };
      return { status: 200, ok: true, json: async () => ({ events: [], publicPosts: posts, hasMore: false }) };
    }
    return { status: 404, ok: false, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

let persona: { publicKeyHex: string; privateKeyHex: string };
beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  const p = generatePublicPersona('duskrunner');
  persona = { publicKeyHex: p.personaPubkey, privateKeyHex: extractPersonaPrivateKeyHex(p.privateKeyRef, p.personaPubkey) };
});

describe('replyCountLabel (web)', () => {
  it('singular/plural honestly', () => {
    expect(replyCountLabel(1)).toBe('1 reply');
    expect(replyCountLabel(2)).toBe('2 replies');
  });
});

describe('loadPublicThread (web)', () => {
  it('not_wired when the topic has no source', async () => {
    const nw = await loadPublicThread(fakeDb(), FEED, 'sports', 'x', pageFetch([]));
    expect(nw.ok).toBe(false);
    if (!nw.ok) expect(nw.reason).toBe('not_wired');
  });

  it('returns the root + replies newest-first (verified only)', async () => {
    const root = accepted(persona, 'root post', null, '2026-07-07T00:00:00.000Z', 0);
    const r1 = accepted(persona, 'older reply', root.post.postId, '2026-07-07T00:01:00.000Z', 1);
    const r2 = accepted(persona, 'newer reply', root.post.postId, '2026-07-07T00:05:00.000Z', 2);
    const r = await loadPublicThread(fakeDb(), FEED, 'commons', root.post.postId, pageFetch([root, r1, r2]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.thread.replies.map((x) => x.post.body)).toEqual(['newer reply', 'older reply']);
  });

  it('not_found when the root is absent; unreachable on network error', async () => {
    const nf = await loadPublicThread(fakeDb(), FEED, 'commons', 'missing', pageFetch([accepted(persona, 'x', null, '2026-07-07T00:00:00.000Z', 0)]));
    expect(nf.ok).toBe(false);
    if (!nf.ok) expect(nf.reason).toBe('not_found');
    const failing = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    const un = await loadPublicThread(fakeDb(), FEED, 'commons', 'x', failing);
    expect(un.ok).toBe(false);
    if (!un.ok) expect(un.reason).toBe('unreachable');
  });
});
