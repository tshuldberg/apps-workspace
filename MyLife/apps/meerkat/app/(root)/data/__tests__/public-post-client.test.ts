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
import { setSetting } from '../db';
import { setStoredPersona, setStoredSession, type PersonaServiceConfig } from '../persona-core';
import {
  getStoredHumanityTokens,
  setStoredHumanityTokens,
  getStoredHumanityToken,
  popStoredHumanityToken,
  unshiftStoredHumanityToken,
  getStoredHumanityTokenCount,
} from '../humanity-core';
import { APP_UNLOCK_RECEIPT_KEY } from '../app-unlock-keys';
import { acceptPublicTerms } from '../public-safety';
import {
  classifySubmitReason,
  isAppUnlocked,
  submitPublicPost,
  type SubmitPublicPostInput,
} from '../public-post-client';

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
  };
}

const PERSONA_CONFIG: PersonaServiceConfig = { url: 'https://accounts.example.test' };
const NODE_KP = publicPostNodeKeypairFromSeed('33'.repeat(32));
const FEED: CommonsFeedConfig = {
  nodeUrl: 'https://commons.example',
  topics: [{ channelId: 'commons', publicationId: 'pub-1', nodeKeyHex: NODE_KP.publicKeyHex }],
};
const HOSTED = 'https://api.example';

interface Seeded { db: DatabaseAdapter; personaPubkey: string; privateKeyHex: string }

/** A db seeded as a fully-verified, purchased, wallet-holding poster. */
function seededPoster(): Seeded {
  const db = fakeSettingsDb();
  const persona = generatePublicPersona('duskrunner');
  setStoredPersona(db, {
    personaPubkey: persona.personaPubkey,
    privateKeyRef: persona.privateKeyRef,
    alias: 'duskrunner',
    displayName: 'Dusk',
    createdAt: persona.createdAt,
  });
  setStoredSession(db, 'sess-token', Date.now() + 600_000); // fresh cached session, no network
  setSetting(db, APP_UNLOCK_RECEIPT_KEY, 'unlocked');
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

/** A fetch that answers the mint route with a proof and the submit route via `submit`. */
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
  configureSyncSecretStore(createInMemorySyncSecretStore());
});

describe('classifySubmitReason (honest buckets)', () => {
  it('maps every node reason family to its client bucket', () => {
    expect(classifySubmitReason('session_invalid')).toBe('session');
    expect(classifySubmitReason('session_required')).toBe('session');
    expect(classifySubmitReason('humanity_invalid')).toBe('humanity');
    expect(classifySubmitReason('app_unlock_invalid')).toBe('unlock');
    expect(classifySubmitReason('posting_disabled')).toBe('policy');
    expect(classifySubmitReason('not_member')).toBe('policy');
    expect(classifySubmitReason('rate_limited')).toBe('caps');
    expect(classifySubmitReason('publication_full')).toBe('caps');
    expect(classifySubmitReason('scope_mismatch')).toBe('rejected');
    expect(classifySubmitReason(undefined)).toBe('rejected');
  });
});

describe('submitPublicPost gate short-circuits (no network, honest)', () => {
  it('not_configured when the feed has no node / topics', async () => {
    const { db } = seededPoster();
    const r = await submitPublicPost(baseInput(db, router({ status: 200, body: {} }), { feedConfig: { nodeUrl: '', topics: [] } }));
    expect(r).toEqual({ ok: false, reason: 'not_configured' });
  });

  it('not_wired when the topic has no publication source', async () => {
    const { db } = seededPoster();
    const r = await submitPublicPost(baseInput(db, router({ status: 200, body: {} }), { channelId: 'sports' }));
    expect(r).toEqual({ ok: false, reason: 'not_wired' });
  });

  it('needs_verification when there is no persona', async () => {
    const db = fakeSettingsDb();
    setSetting(db, APP_UNLOCK_RECEIPT_KEY, 'unlocked');
    const r = await submitPublicPost(baseInput(db, router({ status: 200, body: {} })));
    expect(r).toEqual({ ok: false, reason: 'needs_verification' });
  });

  it('needs_unlock when the device is verified but not app-unlocked', async () => {
    const { db } = seededPoster();
    setSetting(db, APP_UNLOCK_RECEIPT_KEY, ''); // locked
    expect(isAppUnlocked(db)).toBe(false);
    const r = await submitPublicPost(baseInput(db, router({ status: 200, body: {} })));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('needs_unlock');
  });

  it('unlock_unavailable when the hosted API cannot mint a proof (402 no active purchase)', async () => {
    const { db } = seededPoster();
    const r = await submitPublicPost(baseInput(db, router({ status: 200, body: {} }, 402)));
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.reason).toBe('unlock_unavailable'); expect(r.detail).toBe('no_active_purchase'); }
    // The humanity wallet was NOT touched: the proof gate failed before the token pop.
    expect(getStoredHumanityTokens(db)).toEqual(['tokA', 'tokB']);
  });
});

describe('submitPublicPost through the real chain', () => {
  it('returns ok ONLY off a REAL dual-signed acceptance receipt, and spends one humanity token', async () => {
    const s = seededPoster();
    const accepted = realAccepted(s);
    const r = await submitPublicPost(baseInput(s.db, router({ status: 200, body: { ok: true, accepted, deduplicated: false } })));
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.accepted).toEqual(accepted); expect(r.deduplicated).toBe(false); }
    // One token spent (the submit gate redeemed it server-side); the other remains.
    expect(getStoredHumanityTokens(s.db)).toEqual(['tokB']);
  });

  it('a node that fabricates an acceptance (unverifiable receipt) is NOT reported as posted (NC-3)', async () => {
    const s = seededPoster();
    // A structurally-shaped but un-signed acceptance the node made up.
    const fake = { post: { postId: 'p1', personaPubkey: 'x', body: 'x', createdAt: new Date().toISOString() }, receipt: { postId: 'p1' } };
    const r = await submitPublicPost(baseInput(s.db, router({ status: 200, body: { ok: true, accepted: fake, deduplicated: false } })));
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.reason).toBe('rejected'); expect(r.detail?.startsWith('unverified_receipt')).toBe(true); }
  });

  it('a session rejection pushes the humanity token back (never reached the redeem)', async () => {
    const { db } = seededPoster();
    const r = await submitPublicPost(baseInput(db, router({ status: 401, body: { reason: 'session_invalid' } })));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('session');
    // Fail-closed and lossless: the token popped for the attempt is returned to the wallet.
    expect(getStoredHumanityTokens(db)).toEqual(['tokA', 'tokB']);
  });

  it('a humanity rejection spends the token (the gate ran and consumed it)', async () => {
    const { db } = seededPoster();
    const r = await submitPublicPost(baseInput(db, router({ status: 401, body: { reason: 'humanity_invalid' } })));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('humanity');
    expect(getStoredHumanityTokens(db)).toEqual(['tokB']); // spent, not restored
  });

  it('a caps rejection is honest and spends the token (past the humanity gate)', async () => {
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

  it('a policy rejection (posting_disabled) is honest', async () => {
    const { db } = seededPoster();
    const r = await submitPublicPost(baseInput(db, router({ status: 403, body: { reason: 'posting_disabled' } })));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('policy');
  });

  it('a network error at submit pushes the token back and is unreachable', async () => {
    const { db } = seededPoster();
    const failing = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/entitlements/meerkat-app-token')) return { status: 200, ok: true, json: async () => ({ token: 'proof-1', expiresAt: new Date(Date.now() + 3_600_000).toISOString() }) };
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const r = await submitPublicPost(baseInput(db, failing));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('unreachable');
    expect(getStoredHumanityTokens(db)).toEqual(['tokA', 'tokB']);
  });
});

describe('batch humanity wallet', () => {
  it('stores + reads a batch, and getStoredHumanityToken returns the first', () => {
    const db = fakeSettingsDb();
    setStoredHumanityTokens(db, ['a', 'b', 'c']);
    expect(getStoredHumanityTokens(db)).toEqual(['a', 'b', 'c']);
    expect(getStoredHumanityToken(db)).toBe('a');
  });

  it('reads a legacy single bare token as a one-element batch', () => {
    const db = fakeSettingsDb();
    setSetting(db, 'humanity_token', 'legacybearer'); // pre-batch storage
    expect(getStoredHumanityTokens(db)).toEqual(['legacybearer']);
  });

  it('pop (no config) removes + returns the first token; unshift restores it', () => {
    const db = fakeSettingsDb();
    setStoredHumanityTokens(db, ['a', 'b']);
    expect(popStoredHumanityToken(db)).toBe('a');
    expect(getStoredHumanityTokens(db)).toEqual(['b']);
    unshiftStoredHumanityToken(db, 'a');
    expect(getStoredHumanityTokens(db)).toEqual(['a', 'b']);
  });

  it('pop of an empty wallet is null; count is 0 without a configured service', () => {
    const db = fakeSettingsDb();
    expect(popStoredHumanityToken(db)).toBeNull();
    setStoredHumanityTokens(db, ['a']);
    expect(getStoredHumanityTokenCount(db, { url: '', servicePublicKeyHex: '' })).toBe(0);
  });
});
