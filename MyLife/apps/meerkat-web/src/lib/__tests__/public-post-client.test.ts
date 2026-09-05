import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { configureSyncSecretStore, createInMemorySyncSecretStore, createPublicPost, extractPersonaPrivateKeyHex, generatePublicPersona, publicPostNodeKeypairFromSeed, signPublicPostAcceptance, type AcceptedPublicPost } from '@mylife/sync';
import { setStoredPersona, setStoredSession, type PersonaServiceConfig } from '../persona-core';
import { getStoredHumanityTokens, setStoredHumanityTokens } from '../humanity-core';
import { setCachedAppUnlock } from '../hosted-access';
import { classifySubmitReason, isAppUnlocked, submitPublicPost, type SubmitPublicPostInput } from '../public-post-client';
import { acceptPublicTerms } from '../public-safety';

type CommonsFeedConfig = NonNullable<SubmitPublicPostInput['feedConfig']>;

function fakeSettingsDb(): DatabaseAdapter {
  const store = new Map<string, string>();
  return {
    execute(sql: string, params: unknown[] = []): void {
      if (sql.includes('INSERT OR REPLACE INTO mk_settings')) store.set(String(params[0]), String(params[1]));
      else if (sql.includes('DELETE FROM mk_settings')) store.delete(String(params[0]));
    },
    query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
      if (sql.includes('SELECT value FROM mk_settings')) {
        let key = params.length ? String(params[0]) : '';
        if (!key) { const m = sql.match(/key = '([^']+)'/); if (m) key = m[1]; }
        return store.has(key) ? ([{ value: store.get(key) }] as unknown as T[]) : [];
      }
      return [];
    },
    transaction(fn: () => void): void { fn(); },
    flush() {},
  } as unknown as DatabaseAdapter;
}

const PERSONA_CONFIG: PersonaServiceConfig = { url: 'https://accounts.example.test' };
const NODE_KP = publicPostNodeKeypairFromSeed('33'.repeat(32));
const FEED: CommonsFeedConfig = {
  nodeUrl: 'https://commons.example',
  topics: [{ channelId: 'commons', publicationId: 'pub-1', nodeKeyHex: NODE_KP.publicKeyHex }],
};
const HOSTED = 'https://api.example';

interface Seeded { db: DatabaseAdapter; personaPubkey: string; privateKeyHex: string }

function seededPoster(): Seeded {
  const db = fakeSettingsDb();
  const persona = generatePublicPersona('duskrunner');
  setStoredPersona(db, { personaPubkey: persona.personaPubkey, privateKeyRef: persona.privateKeyRef, alias: 'duskrunner', displayName: 'Dusk', createdAt: persona.createdAt });
  setStoredSession(db, 'sess-token', Date.now() + 600_000);
  setCachedAppUnlock({ unlocked: true, purchaseDate: new Date().toISOString() });
  acceptPublicTerms(db);
  setStoredHumanityTokens(db, ['tokA', 'tokB']);
  return { db, personaPubkey: persona.personaPubkey, privateKeyHex: extractPersonaPrivateKeyHex(persona.privateKeyRef, persona.personaPubkey) };
}

/** A REAL dual-signed acceptance (persona-signed post + node countersignature). */
function realAccepted(s: Seeded): AcceptedPublicPost {
  const post = createPublicPost({ publicKeyHex: s.personaPubkey, privateKeyHex: s.privateKeyHex }, { publicationId: 'pub-1', channelId: 'commons', body: 'first commons post', now: new Date().toISOString() });
  const receipt = signPublicPostAcceptance(NODE_KP, { post, hlc: { wall: new Date().toISOString(), counter: 0 }, acceptedAt: new Date().toISOString() });
  return { post, receipt };
}

function router(submit: { status: number; body: Record<string, unknown> }, mintStatus = 200): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/entitlements/meerkat-app-token')) {
      if (mintStatus !== 200) return { status: mintStatus, ok: false, json: async () => ({}) };
      return { status: 200, ok: true, json: async () => ({ token: 'proof-1', expiresAt: new Date(Date.now() + 3_600_000).toISOString() }) };
    }
    if (url.includes('/submit')) return { status: submit.status, ok: submit.status === 200, json: async () => submit.body };
    return { status: 404, ok: false, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

function baseInput(db: DatabaseAdapter, fetchImpl: typeof fetch, over: Partial<SubmitPublicPostInput> = {}): SubmitPublicPostInput {
  return { db, personaConfig: PERSONA_CONFIG, feedConfig: FEED, hostedApiUrl: HOSTED, channelId: 'commons', body: 'first commons post', fetchImpl, ...over };
}

beforeEach(() => {
  const ls = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => ls.get(k) ?? null,
      setItem: (k: string, v: string) => { ls.set(k, String(v)); },
      removeItem: (k: string) => { ls.delete(k); },
    },
  };
  configureSyncSecretStore(createInMemorySyncSecretStore());
});

describe('classifySubmitReason (honest buckets)', () => {
  it('maps node reasons to client buckets', () => {
    expect(classifySubmitReason('session_invalid')).toBe('session');
    expect(classifySubmitReason('humanity_invalid')).toBe('humanity');
    expect(classifySubmitReason('app_unlock_invalid')).toBe('unlock');
    expect(classifySubmitReason('posting_disabled')).toBe('policy');
    expect(classifySubmitReason('rate_limited')).toBe('caps');
    expect(classifySubmitReason('scope_mismatch')).toBe('rejected');
  });
});

describe('submitPublicPost (web) honest chain', () => {
  it('not_configured / not_wired short-circuit before any spend', async () => {
    const { db } = seededPoster();
    expect((await submitPublicPost(baseInput(db, router({ status: 200, body: {} }), { feedConfig: { nodeUrl: '', topics: [] } }))).ok).toBe(false);
    const nw = await submitPublicPost(baseInput(db, router({ status: 200, body: {} }), { channelId: 'sports' }));
    expect(nw.ok).toBe(false);
    if (!nw.ok) expect(nw.reason).toBe('not_wired');
  });

  it('needs_unlock when the account is not app-unlocked', async () => {
    const { db } = seededPoster();
    setCachedAppUnlock({ unlocked: false, purchaseDate: null });
    expect(isAppUnlocked()).toBe(false);
    const r = await submitPublicPost(baseInput(db, router({ status: 200, body: {} })));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('needs_unlock');
  });

  it('unlock_unavailable when the hosted API cannot mint a proof (402)', async () => {
    const { db } = seededPoster();
    const r = await submitPublicPost(baseInput(db, router({ status: 200, body: {} }, 402)));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('unlock_unavailable');
    expect(getStoredHumanityTokens(db)).toEqual(['tokA', 'tokB']);
  });

  it('ok ONLY off a REAL dual-signed acceptance receipt; one humanity token spent', async () => {
    const s = seededPoster();
    const accepted = realAccepted(s);
    const r = await submitPublicPost(baseInput(s.db, router({ status: 200, body: { ok: true, accepted, deduplicated: false } })));
    expect(r.ok).toBe(true);
    expect(getStoredHumanityTokens(s.db)).toEqual(['tokB']);
  });

  it('a node that fabricates an acceptance is NOT reported as posted (NC-3)', async () => {
    const s = seededPoster();
    const fake = { post: { postId: 'p1' }, receipt: { postId: 'p1' } };
    const r = await submitPublicPost(baseInput(s.db, router({ status: 200, body: { ok: true, accepted: fake, deduplicated: false } })));
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.reason).toBe('rejected'); expect(r.detail?.startsWith('unverified_receipt')).toBe(true); }
  });

  it('a session rejection pushes the humanity token back', async () => {
    const { db } = seededPoster();
    const r = await submitPublicPost(baseInput(db, router({ status: 401, body: { reason: 'session_invalid' } })));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('session');
    expect(getStoredHumanityTokens(db)).toEqual(['tokA', 'tokB']);
  });

  it('a humanity rejection spends the token', async () => {
    const { db } = seededPoster();
    const r = await submitPublicPost(baseInput(db, router({ status: 401, body: { reason: 'humanity_invalid' } })));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('humanity');
    expect(getStoredHumanityTokens(db)).toEqual(['tokB']);
  });

  it('a post-humanity caps rejection spends the token', async () => {
    const { db } = seededPoster();
    const r = await submitPublicPost(baseInput(db, router({ status: 429, body: { reason: 'rate_limited' } })));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('caps');
    expect(getStoredHumanityTokens(db)).toEqual(['tokB']);
  });

  it('a pre-humanity rate limit restores the token the node confirms it did not consume', async () => {
    const { db } = seededPoster();
    const r = await submitPublicPost(baseInput(db, router({
      status: 429,
      body: { reason: 'rate_limited', humanityTokenConsumed: false },
    })));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('caps');
    expect(getStoredHumanityTokens(db)).toEqual(['tokA', 'tokB']);
  });
});
