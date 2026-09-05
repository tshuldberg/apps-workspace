import { describe, expect, it } from 'vitest';

import { handleVerificationRequest } from '../index.ts';
import { EDGE_CURRENT_TERMS_VERSION } from '../../_shared/mynews-terms.ts';
import { createInMemoryMyNewsStore, type MyNewsStore } from '../../_shared/mynews-store.ts';

/**
 * Journalist verification requests (plan 48 WP8). The workflow's operator half
 * lives in the console and in SQL; this covers the request side and the guards
 * that keep the queue reviewable: attribution, a journalist row, evidence,
 * one pending request, and honest copy that never claims a decision.
 */

const USER_ID = 'auth-journalist-1';
const PROFILE_ID = 'profile-journalist-1';
const READER_USER_ID = 'auth-reader-1';
const READER_PROFILE_ID = 'profile-reader-1';
const NOW_MS = Date.parse('2026-07-30T12:00:00.000Z');

function jwtFor(sub: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64url');
  return `${header}.${payload}.sig`;
}

function post(body: unknown, sub: string | null = USER_ID): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sub) headers.Authorization = `Bearer ${jwtFor(sub)}`;
  return new Request('http://local/mynews-verification', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function seeded(overrides?: { suspendedUntil?: string | null; acceptTerms?: boolean }) {
  return createInMemoryMyNewsStore({
    profiles: [
      {
        id: PROFILE_ID,
        userId: USER_ID,
        pubkey: 'ab'.repeat(32),
        suspendedUntil: overrides?.suspendedUntil ?? null,
      },
      { id: READER_PROFILE_ID, userId: READER_USER_ID, pubkey: 'cd'.repeat(32) },
    ],
    journalists: [{ profileId: PROFILE_ID, tier: 'open' }],
    termsAcceptances:
      overrides?.acceptTerms === false
        ? []
        : [
            { userId: USER_ID, version: EDGE_CURRENT_TERMS_VERSION },
            { userId: READER_USER_ID, version: EDGE_CURRENT_TERMS_VERSION },
          ],
    now: () => NOW_MS,
  });
}

const deps = (store: MyNewsStore) => ({ store, now: () => NOW_MS });

const requestBody = (over: Record<string, unknown> = {}) => ({
  action: 'request',
  method: 'domain_email',
  evidenceRef: 'https://dailyexample.com/staff/jane-doe',
  evidence: ['jane.doe@dailyexample.com'],
  ...over,
});

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

describe('handleVerificationRequest: guards', () => {
  it('rejects non-POST', async () => {
    const { store } = seeded();
    const res = await handleVerificationRequest(
      new Request('http://local/mynews-verification', { method: 'GET' }),
      deps(store),
    );
    expect(res.status).toBe(405);
  });

  it('requires a session, because verification is an identity claim', async () => {
    const { store } = seeded();
    const res = await handleVerificationRequest(post(requestBody(), null), deps(store));
    expect(res.status).toBe(401);
    expect((await readJson(res)).error).toBe('not-signed-in');
  });

  it('requires a profile', async () => {
    const { store } = seeded();
    const res = await handleVerificationRequest(post(requestBody(), 'auth-nobody'), deps(store));
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe('no-profile');
  });

  it('requires a journalist row rather than creating one', async () => {
    const { store, state } = seeded();
    const res = await handleVerificationRequest(post(requestBody(), READER_USER_ID), deps(store));
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe('no-journalist');
    expect(state.verifications).toHaveLength(0);
  });

  it('blocks a suspended account from claiming trust', async () => {
    const { store } = seeded({ suspendedUntil: '2099-01-01T00:00:00.000Z' });
    const res = await handleVerificationRequest(post(requestBody()), deps(store));
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe('suspended');
  });

  it('requires the current terms', async () => {
    const { store } = seeded({ acceptTerms: false });
    const res = await handleVerificationRequest(post(requestBody()), deps(store));
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe('terms-not-accepted');
  });

  it('rejects an unknown method', async () => {
    const { store } = seeded();
    const res = await handleVerificationRequest(
      post(requestBody({ method: 'vibes' })),
      deps(store),
    );
    expect(res.status).toBe(400);
  });

  it('rejects a request with no evidence at all', async () => {
    const { store, state } = seeded();
    const res = await handleVerificationRequest(
      post(requestBody({ evidenceRef: '', evidence: [] })),
      deps(store),
    );
    expect(res.status).toBe(400);
    expect(state.verifications).toHaveLength(0);
  });

  it('bounds the evidence list and each item', async () => {
    const { store } = seeded();
    const tooMany = await handleVerificationRequest(
      post(requestBody({ evidence: Array.from({ length: 11 }, (_, i) => `e${i}`) })),
      deps(store),
    );
    expect(tooMany.status).toBe(400);
    const tooLong = await handleVerificationRequest(
      post(requestBody({ evidence: ['x'.repeat(501)] })),
      deps(store),
    );
    expect(tooLong.status).toBe(400);
  });
});

describe('handleVerificationRequest: request', () => {
  it('queues a request and says only that it is queued', async () => {
    const { store, state } = seeded();
    const res = await handleVerificationRequest(post(requestBody()), deps(store));
    expect(res.status).toBe(200);
    const payload = (await readJson(res)).data as Record<string, unknown>;
    expect(payload.status).toBe('pending');
    expect(String(payload.message)).toContain('review queue');
    // No promised timeline: staffing is a founder-ops matter.
    expect(String(payload.message)).not.toMatch(/\d+\s*(hours?|days?|weeks?)/);
    expect(state.verifications).toHaveLength(1);
    expect(state.verifications[0]!.status).toBe('pending');
    expect(state.verifications[0]!.journalistId).toBe(PROFILE_ID);
  });

  it('does not touch the journalist tier', async () => {
    const { store, state } = seeded();
    await handleVerificationRequest(post(requestBody()), deps(store));
    expect(state.journalists.get(PROFILE_ID)).toBe('open');
    expect(await store.getVerificationState(PROFILE_ID)).toBe('pending');
  });

  it('refuses a second pending request', async () => {
    const { store, state } = seeded();
    await handleVerificationRequest(post(requestBody()), deps(store));
    const res = await handleVerificationRequest(post(requestBody()), deps(store));
    expect(res.status).toBe(409);
    expect((await readJson(res)).error).toBe('already-pending');
    expect(state.verifications).toHaveLength(1);
  });

  it('refuses a request from an already verified journalist', async () => {
    const { store, state } = seeded();
    state.verifications.push({
      id: 'v-existing',
      journalistId: PROFILE_ID,
      method: 'manual',
      evidenceRef: '',
      status: 'approved',
      createdAt: '2026-07-01T00:00:00.000Z',
      expiresAt: '2027-07-01T00:00:00.000Z',
    });
    const res = await handleVerificationRequest(post(requestBody()), deps(store));
    expect(res.status).toBe(409);
    expect((await readJson(res)).error).toBe('already-verified');
  });

  it('allows a fresh request after a denial', async () => {
    const { store, state } = seeded();
    state.verifications.push({
      id: 'v-denied',
      journalistId: PROFILE_ID,
      method: 'byline',
      evidenceRef: '',
      status: 'rejected',
      createdAt: '2026-07-01T00:00:00.000Z',
      decidedAt: '2026-07-02T00:00:00.000Z',
      decisionReason: 'byline could not be confirmed',
    });
    const res = await handleVerificationRequest(post(requestBody()), deps(store));
    expect(res.status).toBe(200);
    expect(state.verifications).toHaveLength(2);
  });

  it('allows a re-verify after an expiry', async () => {
    const { store, state } = seeded();
    state.verifications.push({
      id: 'v-expired',
      journalistId: PROFILE_ID,
      method: 'domain_email',
      evidenceRef: '',
      status: 'expired',
      createdAt: '2025-07-01T00:00:00.000Z',
      decidedAt: '2025-07-02T00:00:00.000Z',
      expiresAt: '2026-07-01T00:00:00.000Z',
    });
    expect(await store.getVerificationState(PROFILE_ID)).toBe('expired');
    const res = await handleVerificationRequest(post(requestBody()), deps(store));
    expect(res.status).toBe(200);
  });

  it('throttles a burst of requests', async () => {
    const { store, state } = seeded();
    for (let i = 0; i < 5; i++) {
      state.verifications.push({
        id: `v-${i}`,
        journalistId: PROFILE_ID,
        method: 'byline',
        evidenceRef: '',
        status: 'rejected',
        createdAt: new Date(NOW_MS - 1000 * (i + 1)).toISOString(),
        decidedAt: new Date(NOW_MS - 500).toISOString(),
      });
    }
    const res = await handleVerificationRequest(post(requestBody()), deps(store));
    expect(res.status).toBe(429);
  });
});

describe('handleVerificationRequest: status', () => {
  it('returns the state and the caller history', async () => {
    const { store } = seeded();
    await handleVerificationRequest(post(requestBody()), deps(store));
    const res = await handleVerificationRequest(post({ action: 'status' }), deps(store));
    expect(res.status).toBe(200);
    const payload = (await readJson(res)).data as {
      state: string;
      history: Array<Record<string, unknown>>;
    };
    expect(payload.state).toBe('pending');
    expect(payload.history).toHaveLength(1);
    expect(payload.history[0]!.method).toBe('domain_email');
  });

  it('never returns another journalist history', async () => {
    const { store } = seeded();
    await handleVerificationRequest(post(requestBody()), deps(store));
    const res = await handleVerificationRequest(post({ action: 'status' }, READER_USER_ID), deps(store));
    const payload = (await readJson(res)).data as { history: unknown[] };
    expect(payload.history).toHaveLength(0);
  });

  it('fails closed with a retryable error when the read fails', async () => {
    const { store } = seeded();
    const broken: MyNewsStore = {
      ...store,
      getMyVerifications: () => Promise.reject(new Error('db down')),
    };
    const res = await handleVerificationRequest(post({ action: 'status' }), deps(broken));
    expect(res.status).toBe(503);
    expect((await readJson(res)).error).toBe('verification-unavailable');
  });
});
