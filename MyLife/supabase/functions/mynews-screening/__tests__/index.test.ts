import { describe, expect, it } from 'vitest';

import { APPEAL_REASON_MAX_CHARS, handleScreeningRequest } from '../index.ts';
import { createInMemoryMyNewsStore, type MyNewsStore } from '../../_shared/mynews-store.ts';

/**
 * Author-facing screening reads and appeals (plan 48 WP8).
 *
 * Two properties matter most and are pinned here: the response never carries the
 * detector's internals, and a decision that is not the caller's answers exactly
 * like one that does not exist, so this endpoint cannot be used to probe which
 * decision ids are real.
 */

const AUTHOR_USER_ID = 'auth-author-1';
const AUTHOR_PROFILE_ID = 'profile-author-1';
const OTHER_USER_ID = 'auth-other-1';
const OTHER_PROFILE_ID = 'profile-other-1';

function jwtFor(sub: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64url');
  return `${header}.${payload}.sig`;
}

function post(body: unknown, sub: string | null = AUTHOR_USER_ID): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sub) headers.Authorization = `Bearer ${jwtFor(sub)}`;
  return new Request('http://local/mynews-screening', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function seeded() {
  const built = createInMemoryMyNewsStore({
    profiles: [
      { id: AUTHOR_PROFILE_ID, userId: AUTHOR_USER_ID, pubkey: 'ab'.repeat(32) },
      { id: OTHER_PROFILE_ID, userId: OTHER_USER_ID, pubkey: 'cd'.repeat(32) },
    ],
  });
  built.state.screeningDecisions.push({
    id: 'decision-held-1',
    contentKind: 'comment',
    contentId: 'event-1',
    contentRev: null,
    authorProfileId: AUTHOR_PROFILE_ID,
    contentSha256: 'a'.repeat(64),
    autoAction: 'quarantined',
    decision: 'pending',
    topClass: 'hate',
    thresholdHit: 'hate>=0.55',
    requiresHumanReview: false,
    riskScore: 0.75,
    heldPayload: null,
    createdAt: '2026-07-30T10:00:00.000Z',
  });
  built.state.screeningDecisions.push({
    id: 'decision-allowed-1',
    contentKind: 'article',
    contentId: 'article-1',
    contentRev: 1,
    authorProfileId: AUTHOR_PROFILE_ID,
    contentSha256: 'b'.repeat(64),
    autoAction: 'allowed',
    decision: 'auto-allowed',
    topClass: 'spam',
    thresholdHit: null,
    requiresHumanReview: false,
    riskScore: 0.4,
    heldPayload: null,
    createdAt: '2026-07-30T09:00:00.000Z',
  });
  built.state.screeningDecisions.push({
    id: 'decision-other-1',
    contentKind: 'comment',
    contentId: 'event-2',
    contentRev: null,
    authorProfileId: OTHER_PROFILE_ID,
    contentSha256: 'c'.repeat(64),
    autoAction: 'quarantined',
    decision: 'pending',
    topClass: 'spam',
    thresholdHit: 'spam>=0.75',
    requiresHumanReview: false,
    riskScore: 0.8,
    heldPayload: null,
    createdAt: '2026-07-30T08:00:00.000Z',
  });
  return built;
}

const deps = (store: MyNewsStore) => ({ store });

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

describe('handleScreeningRequest: list', () => {
  it('rejects non-POST', async () => {
    const { store } = seeded();
    const res = await handleScreeningRequest(
      new Request('http://local/mynews-screening', { method: 'GET' }),
      deps(store),
    );
    expect(res.status).toBe(405);
  });

  it('requires a session', async () => {
    const { store } = seeded();
    const res = await handleScreeningRequest(post({ action: 'list' }, null), deps(store));
    expect(res.status).toBe(401);
  });

  it('returns only the caller held submissions', async () => {
    const { store } = seeded();
    const res = await handleScreeningRequest(post({ action: 'list' }), deps(store));
    expect(res.status).toBe(200);
    const decisions = ((await readJson(res)).data as { decisions: Array<Record<string, unknown>> })
      .decisions;
    expect(decisions).toHaveLength(1);
    expect(decisions[0]!.id).toBe('decision-held-1');
  });

  it('never returns the detector internals', async () => {
    const { store } = seeded();
    const res = await handleScreeningRequest(post({ action: 'list' }), deps(store));
    const decisions = ((await readJson(res)).data as { decisions: Array<Record<string, unknown>> })
      .decisions;
    const keys = Object.keys(decisions[0]!);
    for (const forbidden of ['classScores', 'signals', 'thresholdHit', 'riskScore', 'explanations']) {
      expect(keys).not.toContain(forbidden);
    }
    // What the author IS owed.
    expect(keys).toContain('topClass');
    expect(keys).toContain('appealState');
    expect(keys).toContain('decision');
  });

  it('omits recorded allows, which were published', async () => {
    const { store } = seeded();
    const res = await handleScreeningRequest(post({ action: 'list' }), deps(store));
    const decisions = ((await readJson(res)).data as { decisions: Array<Record<string, unknown>> })
      .decisions;
    expect(decisions.map((d) => d.id)).not.toContain('decision-allowed-1');
  });

  it('fails closed with a retryable error when the read fails', async () => {
    const { store } = seeded();
    const broken: MyNewsStore = {
      ...store,
      getMyScreeningDecisions: () => Promise.reject(new Error('db down')),
    };
    const res = await handleScreeningRequest(post({ action: 'list' }), deps(broken));
    expect(res.status).toBe(503);
    expect((await readJson(res)).error).toBe('screening-unavailable');
  });
});

describe('handleScreeningRequest: appeal', () => {
  const appeal = (over: Record<string, unknown> = {}) => ({
    action: 'appeal',
    decisionId: 'decision-held-1',
    reason: 'this is a direct quote from the indictment',
    ...over,
  });

  it('records an appeal once', async () => {
    const { store, state } = seeded();
    const first = await handleScreeningRequest(post(appeal()), deps(store));
    expect(first.status).toBe(200);
    expect(state.screeningDecisions[0]!.appealState).toBe('requested');
    const second = await handleScreeningRequest(post(appeal()), deps(store));
    expect(second.status).toBe(409);
    expect((await readJson(second)).error).toBe('already-appealed');
  });

  it('requires a reason', async () => {
    const { store } = seeded();
    const empty = await handleScreeningRequest(post(appeal({ reason: '   ' })), deps(store));
    expect(empty.status).toBe(400);
    const tooLong = await handleScreeningRequest(
      post(appeal({ reason: 'x'.repeat(APPEAL_REASON_MAX_CHARS + 1) })),
      deps(store),
    );
    expect(tooLong.status).toBe(400);
  });

  it('answers identically for a missing decision and for someone else decision', async () => {
    const { store } = seeded();
    const missing = await handleScreeningRequest(
      post(appeal({ decisionId: 'decision-nope' })),
      deps(store),
    );
    const notMine = await handleScreeningRequest(
      post(appeal({ decisionId: 'decision-other-1' })),
      deps(store),
    );
    expect(missing.status).toBe(notMine.status);
    expect(await readJson(missing)).toEqual(await readJson(notMine));
  });

  it('refuses to appeal something that was published', async () => {
    const { store } = seeded();
    const res = await handleScreeningRequest(
      post(appeal({ decisionId: 'decision-allowed-1' })),
      deps(store),
    );
    expect(res.status).toBe(409);
    expect((await readJson(res)).error).toBe('not-appealable');
  });

  it('does not modify another author decision', async () => {
    const { store, state } = seeded();
    await handleScreeningRequest(post(appeal({ decisionId: 'decision-other-1' })), deps(store));
    const other = state.screeningDecisions.find((row) => row.id === 'decision-other-1')!;
    expect(other.appealState ?? 'none').toBe('none');
  });

  it('requires a profile before appealing', async () => {
    const { store } = seeded();
    const res = await handleScreeningRequest(post(appeal(), 'auth-nobody'), deps(store));
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe('no-profile');
  });

  it('fails closed with a retryable error when the appeal write fails', async () => {
    const { store } = seeded();
    const broken: MyNewsStore = {
      ...store,
      appealScreeningDecision: () => Promise.reject(new Error('db down')),
    };
    const res = await handleScreeningRequest(post(appeal()), deps(broken));
    expect(res.status).toBe(503);
  });
});
