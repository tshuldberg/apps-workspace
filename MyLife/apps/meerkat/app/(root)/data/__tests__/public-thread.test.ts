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
  const store = new Map<string, string>();
  return {
    execute() {},
    query<T = Record<string, unknown>>(sql: string): T[] { void store; return sql.includes('SELECT') ? ([] as unknown as T[]) : []; },
    transaction(fn: () => void) { fn(); },
  };
}

/** Build a real dual-signed accepted post (optionally a reply) at a given wall time. */
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

describe('replyCountLabel', () => {
  it('singular/plural honestly', () => {
    expect(replyCountLabel(0)).toBe('0 replies');
    expect(replyCountLabel(1)).toBe('1 reply');
    expect(replyCountLabel(3)).toBe('3 replies');
  });
});

describe('loadPublicThread (real dual-verified posts, honest failures)', () => {
  it('not_configured / not_wired', async () => {
    expect((await loadPublicThread(fakeDb(), { nodeUrl: '', topics: [] }, 'commons', 'x', pageFetch([]))).ok).toBe(false);
    const nw = await loadPublicThread(fakeDb(), FEED, 'sports', 'x', pageFetch([]));
    expect(nw.ok).toBe(false);
    if (!nw.ok) expect(nw.reason).toBe('not_wired');
  });

  it('not_found when the root post is not on the page', async () => {
    const other = accepted(persona, 'unrelated', null, '2026-07-07T00:00:00.000Z', 0);
    const r = await loadPublicThread(fakeDb(), FEED, 'commons', 'missing-id', pageFetch([other]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });

  it('returns the root + its replies, newest first (verified only)', async () => {
    const root = accepted(persona, 'root post', null, '2026-07-07T00:00:00.000Z', 0);
    const r1 = accepted(persona, 'older reply', root.post.postId, '2026-07-07T00:01:00.000Z', 1);
    const r2 = accepted(persona, 'newer reply', root.post.postId, '2026-07-07T00:05:00.000Z', 2);
    const unrelated = accepted(persona, 'not a reply', null, '2026-07-07T00:02:00.000Z', 3);
    const r = await loadPublicThread(fakeDb(), FEED, 'commons', root.post.postId, pageFetch([root, r1, r2, unrelated]));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.thread.root.post.postId).toBe(root.post.postId);
      expect(r.thread.replies.map((x) => x.post.body)).toEqual(['newer reply', 'older reply']); // newest first
    }
  });

  it('a network error is unreachable; a 404 page is not_found', async () => {
    const failing = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    const un = await loadPublicThread(fakeDb(), FEED, 'commons', 'x', failing);
    expect(un.ok).toBe(false);
    if (!un.ok) expect(un.reason).toBe('unreachable');
    const nf = await loadPublicThread(fakeDb(), FEED, 'commons', 'x', pageFetch([], 404));
    expect(nf.ok).toBe(false);
    if (!nf.ok) expect(nf.reason).toBe('not_found');
  });
});
