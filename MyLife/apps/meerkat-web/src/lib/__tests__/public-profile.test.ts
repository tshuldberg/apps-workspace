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
import { loadPersonaProfile, publicPostCountLabel } from '../public-profile';

type CommonsFeedConfig = Parameters<typeof loadPersonaProfile>[1];

const NODE_KP = publicPostNodeKeypairFromSeed('55'.repeat(32));
const FEED: CommonsFeedConfig = {
  nodeUrl: 'https://commons.example',
  topics: [
    { channelId: 'commons', publicationId: 'pub-commons', nodeKeyHex: NODE_KP.publicKeyHex },
    { channelId: 'gaming', publicationId: 'pub-gaming', nodeKeyHex: NODE_KP.publicKeyHex },
  ],
};

function fakeDb(): DatabaseAdapter {
  return { execute() {}, query<T = Record<string, unknown>>(): T[] { return [] as unknown as T[]; }, transaction(fn: () => void) { fn(); }, flush() {} } as unknown as DatabaseAdapter;
}

function accepted(persona: { publicKeyHex: string; privateKeyHex: string }, channelId: string, publicationId: string, body: string, parentPostId: string | null, wall: string, counter: number): AcceptedPublicPost {
  const post = createPublicPost(persona, { publicationId, channelId, body, parentPostId, now: wall });
  const receipt = signPublicPostAcceptance(NODE_KP, { post, hlc: { wall, counter }, acceptedAt: wall });
  return { post, receipt };
}

function topicFetch(byPub: Record<string, AcceptedPublicPost[]>, failPubs: Set<string> = new Set()): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    const pub = Object.keys(byPub).find((p) => url.includes(p));
    if (url.includes('/page') && pub) {
      if (failPubs.has(pub)) return { status: 503, ok: false, json: async () => ({}) };
      return { status: 200, ok: true, json: async () => ({ events: [], publicPosts: byPub[pub], hasMore: false }) };
    }
    return { status: 404, ok: false, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

let a: { publicKeyHex: string; privateKeyHex: string };
let b: { publicKeyHex: string; privateKeyHex: string };
beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  const pa = generatePublicPersona('alice');
  const pb = generatePublicPersona('bob');
  a = { publicKeyHex: pa.personaPubkey, privateKeyHex: extractPersonaPrivateKeyHex(pa.privateKeyRef, pa.personaPubkey) };
  b = { publicKeyHex: pb.personaPubkey, privateKeyHex: extractPersonaPrivateKeyHex(pb.privateKeyRef, pb.personaPubkey) };
});

describe('publicPostCountLabel (web)', () => {
  it('singular/plural', () => {
    expect(publicPostCountLabel(1)).toBe('1 public post');
    expect(publicPostCountLabel(2)).toBe('2 public posts');
  });
});

describe('loadPersonaProfile (web)', () => {
  it('unions the persona top-level posts across topics, newest first, excluding replies + other authors', async () => {
    const aCommons = accepted(a, 'commons', 'pub-commons', 'alice in commons', null, '2026-07-07T00:01:00.000Z', 0);
    const aReply = accepted(a, 'commons', 'pub-commons', 'alice reply', aCommons.post.postId, '2026-07-07T00:02:00.000Z', 1);
    const bCommons = accepted(b, 'commons', 'pub-commons', 'bob in commons', null, '2026-07-07T00:03:00.000Z', 2);
    const aGaming = accepted(a, 'gaming', 'pub-gaming', 'alice in gaming', null, '2026-07-07T00:05:00.000Z', 0);
    const r = await loadPersonaProfile(fakeDb(), FEED, a.publicKeyHex, topicFetch({ 'pub-commons': [aCommons, aReply, bCommons], 'pub-gaming': [aGaming] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.profile.posts.map((p) => p.post.body)).toEqual(['alice in gaming', 'alice in commons']);
  });

  it('best-effort skip + all-failing unreachable', async () => {
    const aCommons = accepted(a, 'commons', 'pub-commons', 'alice in commons', null, '2026-07-07T00:01:00.000Z', 0);
    const partial = await loadPersonaProfile(fakeDb(), FEED, a.publicKeyHex, topicFetch({ 'pub-commons': [aCommons], 'pub-gaming': [] }, new Set(['pub-gaming'])));
    expect(partial.ok).toBe(true);
    const allFail = await loadPersonaProfile(fakeDb(), FEED, a.publicKeyHex, topicFetch({ 'pub-commons': [], 'pub-gaming': [] }, new Set(['pub-commons', 'pub-gaming'])));
    expect(allFail.ok).toBe(false);
    if (!allFail.ok) expect(allFail.reason).toBe('unreachable');
  });
});
