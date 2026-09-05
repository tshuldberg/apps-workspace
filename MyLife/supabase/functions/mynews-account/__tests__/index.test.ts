import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DELETION_CONFIRMATION_PHRASE,
  MAX_EXPORT_BYTES,
  MYNEWS_DELETION_GRACE_DAYS,
  REAUTH_MAX_TOKEN_AGE_SECONDS,
  handleAccountRequest,
} from '../index.ts';
import {
  createInMemoryMyNewsStore,
  type MyNewsStore,
} from '../../_shared/mynews-store.ts';

const USER_ID = 'auth-user-1';
const PROFILE_ID = 'profile-1';
const OTHER_PROFILE_ID = 'profile-2';
const ARTICLE_ID = '11111111-1111-1111-1111-111111111111';
const DRAFT_ID = '11111111-1111-1111-1111-11111111000d';
const SUGGESTION_ID = '22222222-2222-2222-2222-222222222222';
const MEDIA_ID = '33333333-3333-3333-3333-333333333333';
const NEWSROOM_ID = '44444444-4444-4444-4444-444444444444';

const NOW_MS = Date.parse('2026-07-30T12:00:00.000Z');

const MIGRATION_PATH = join(
  import.meta.dirname,
  '../../../migrations/20260730000006_mynews_account_lifecycle.sql',
);

function jwt(sub: string, iatSeconds: number | null): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const claims: Record<string, unknown> = { sub };
  if (iatSeconds !== null) claims.iat = iatSeconds;
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${header}.${payload}.sig`;
}

interface PostOptions {
  sub?: string | null;
  iat?: number | null;
  method?: string;
  raw?: string;
}

function post(body: unknown, options: PostOptions = {}): Request {
  const sub = options.sub === undefined ? USER_ID : options.sub;
  const iat = options.iat === undefined ? Math.floor(NOW_MS / 1000) : options.iat;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sub) headers.Authorization = `Bearer ${jwt(sub, iat)}`;
  const method = options.method ?? 'POST';
  return new Request('http://local/mynews-account', {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : (options.raw ?? JSON.stringify(body)),
  });
}

/** A store seeded with one row of every kind the account owns. */
function seededStore() {
  const built = createInMemoryMyNewsStore({
    profiles: [
      { id: PROFILE_ID, userId: USER_ID, pubkey: 'ab'.repeat(32), handle: 'reporter_one', displayName: 'Reporter One' },
      { id: OTHER_PROFILE_ID, userId: 'auth-user-2', pubkey: 'cd'.repeat(32), handle: 'other_one' },
    ],
    journalists: [{ profileId: PROFILE_ID, tier: 'open' }],
    journalistDetails: [
      {
        profileId: PROFILE_ID,
        bio: 'Covers water policy',
        beats: ['water'],
        region: 'Owens Valley',
        stripeAccountId: 'acct_live_1',
      },
    ],
    verifications: [
      {
        id: 'ver-1',
        journalistId: PROFILE_ID,
        method: 'domain_email',
        evidenceRef: 'reporter@paper.example',
        status: 'approved',
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    ],
    follows: [
      { followerId: PROFILE_ID, journalistId: OTHER_PROFILE_ID, createdAt: '2026-07-02T00:00:00.000Z' },
      // Someone else following the deleted account: another user's row, retained.
      { followerId: OTHER_PROFILE_ID, journalistId: PROFILE_ID, createdAt: '2026-07-02T00:00:00.000Z' },
    ],
    blocks: [
      { blockerId: PROFILE_ID, blockedProfileId: OTHER_PROFILE_ID, mode: 'block', createdAt: '2026-07-03T00:00:00.000Z' },
      // Another user's block OF this account: their safety setting, retained.
      { blockerId: OTHER_PROFILE_ID, blockedProfileId: PROFILE_ID, mode: 'mute', createdAt: '2026-07-03T00:00:00.000Z' },
    ],
    newsrooms: [
      { id: NEWSROOM_ID, ownerId: PROFILE_ID, name: 'Valley Desk', createdAt: '2026-07-01T00:00:00.000Z' },
    ],
    newsroomMembers: [{ newsroomId: NEWSROOM_ID, profileId: PROFILE_ID, role: 'owner' }],
    supports: [
      {
        id: 'support-1',
        supporterId: PROFILE_ID,
        journalistId: OTHER_PROFILE_ID,
        amountCents: 500,
        cadence: 'monthly',
        status: 'active',
        startedAt: '2026-07-01T00:00:00.000Z',
      },
    ],
    payoutAccounts: [
      {
        journalistProfileId: PROFILE_ID,
        onboardingState: 'verified',
        provider: 'stripe',
        providerAccountRef: 'acct_live_1',
        statusReason: null,
      },
    ],
    supportCharges: [{ id: 'charge-1', supporterProfileId: PROFILE_ID, grossCents: 500 }],
    supportLedger: [{ id: 'ledger-1', supporterProfileId: PROFILE_ID, kind: 'charge' }],
    supportReceipts: [{ id: 'receipt-1', supporterProfileId: PROFILE_ID, grossCents: 500 }],
    transferLedger: [{ id: 'transfer-1', journalistProfileId: PROFILE_ID, netCents: 480 }],
    termsAcceptances: [{ userId: USER_ID, version: '2026-07-01' }],
  });

  built.state.articles.set(ARTICLE_ID, {
    id: ARTICLE_ID,
    slug: 'owens-valley',
    kind: 'news',
    status: 'published',
    authorProfileId: PROFILE_ID,
    authorPubkey: 'ab'.repeat(32),
    currentRev: 1,
    newsroomId: null,
    publishedAt: '2026-07-01T00:00:00.000Z',
  });
  built.state.articles.set(DRAFT_ID, {
    id: DRAFT_ID,
    slug: 'unfinished',
    kind: 'news',
    status: 'draft',
    authorProfileId: PROFILE_ID,
    authorPubkey: 'ab'.repeat(32),
    currentRev: 1,
    newsroomId: NEWSROOM_ID,
    publishedAt: null,
  });
  built.state.revisions.push({
    articleId: ARTICLE_ID,
    rev: 1,
    headline: 'Water rights ruling',
    bodyMd: 'body',
    changelogJson: '[]',
    createdAt: '2026-07-01T00:00:00.000Z',
    signature: 'sig',
    signerPubkey: 'ab'.repeat(32),
  });
  built.state.revisions.push({
    articleId: DRAFT_ID,
    rev: 1,
    headline: 'Draft headline',
    bodyMd: 'draft body',
    changelogJson: '[]',
    createdAt: '2026-07-02T00:00:00.000Z',
    signature: 'sig',
    signerPubkey: 'ab'.repeat(32),
  });
  built.state.articleMeta.set(ARTICLE_ID, {
    articleId: ARTICLE_ID,
    doi: null,
    orcidAuthors: [],
    license: 'cc-by',
    rightsRoute: 'cc_by',
    embargoUntil: null,
    datasetHashes: [],
    canonicalUrl: null,
    signature: 'sig',
    signerPubkey: 'ab'.repeat(32),
  });
  // An accepted suggestion (retained public record) and an open one (deleted).
  built.state.suggestions.set(SUGGESTION_ID, {
    id: SUGGESTION_ID,
    articleId: ARTICLE_ID,
    baseRev: 1,
    editorProfileId: PROFILE_ID,
    type: 'correction',
    diffJson: '{}',
    citations: ['https://example.com/source'],
    rationale: 'accepted fix',
    signature: 'sig',
    createdAt: '2026-07-03T00:00:00.000Z',
    status: 'accepted',
  });
  built.state.suggestions.set('open-suggestion', {
    id: 'open-suggestion',
    articleId: ARTICLE_ID,
    baseRev: 1,
    editorProfileId: PROFILE_ID,
    type: 'copyedit',
    diffJson: '{}',
    citations: [],
    rationale: 'pending typo fix',
    signature: 'sig',
    createdAt: '2026-07-04T00:00:00.000Z',
    status: 'open',
  });
  built.state.events.push({
    suggestionId: SUGGESTION_ID,
    actorProfileId: PROFILE_ID,
    action: 'comment',
    payload: { body: 'my own words' },
    createdAt: '2026-07-04T00:00:00.000Z',
  });
  built.state.events.push({
    suggestionId: SUGGESTION_ID,
    actorProfileId: PROFILE_ID,
    action: 'accept',
    payload: {},
    createdAt: '2026-07-05T00:00:00.000Z',
  });
  built.state.dupes.push({ originalId: SUGGESTION_ID, endorserId: PROFILE_ID, similarity: 0.9 });
  built.state.ledger.push({
    editorProfileId: PROFILE_ID,
    suggestionId: SUGGESTION_ID,
    basePoints: 5,
    diversityMult: 1,
    standingMult: 1,
    awardedAt: '2026-07-05T00:00:00.000Z',
  });
  built.state.mediaAssets.set(MEDIA_ID, {
    id: MEDIA_ID,
    ownerProfileId: PROFILE_ID,
    storagePath: 'mynews/media/1.jpg',
    sha256: 'ab'.repeat(32),
    status: 'approved',
    createdAt: '2026-07-01T00:00:00.000Z',
  });
  built.state.reports.push({
    id: 'report-1',
    reporterProfileId: PROFILE_ID,
    targetKind: 'article',
    targetId: ARTICLE_ID,
    reason: 'harassment',
    detail: 'filed by me',
    status: 'open',
    createdAt: '2026-07-06T00:00:00.000Z',
  });
  built.state.moderationActions.push({
    reportId: 'report-1',
    moderatorRef: 'mod-1',
    action: 'hide_article',
    targetKind: 'article',
    targetId: ARTICLE_ID,
    note: 'statement of reasons',
    createdAt: '2026-07-07T00:00:00.000Z',
  });

  return built;
}

function deps(store: MyNewsStore, nowMs = NOW_MS) {
  return { store, now: () => nowMs };
}

async function envelope(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

const confirm = { action: 'initiate_deletion', confirmation: DELETION_CONFIRMATION_PHRASE };

describe('mynews-account transport and auth', () => {
  it('rejects non-POST', async () => {
    const { store } = seededStore();
    const res = await handleAccountRequest(
      post(confirm, { method: 'GET' }),
      deps(store),
    );
    expect(res.status).toBe(405);
  });

  it('requires a session', async () => {
    const { store } = seededStore();
    const res = await handleAccountRequest(post(confirm, { sub: null }), deps(store));
    expect(res.status).toBe(401);
    expect(await envelope(res)).toMatchObject({ ok: false, error: 'not-signed-in' });
  });

  it('rejects an unknown action and a non-JSON body', async () => {
    const { store } = seededStore();
    const unknown = await handleAccountRequest(post({ action: 'wipe_everything' }), deps(store));
    expect(unknown.status).toBe(400);
    expect(await envelope(unknown)).toMatchObject({ error: 'bad-payload' });

    const garbage = await handleAccountRequest(post(null, { raw: 'not json' }), deps(store));
    expect(garbage.status).toBe(400);
  });
});

describe('mynews-account initiate_deletion guards', () => {
  it('requires the typed confirmation phrase, matched exactly', async () => {
    const { store, state } = seededStore();
    for (const wrong of [
      '',
      'delete my account',
      ' DELETE MY ACCOUNT ',
      'DELETE MY ACCOUNT!',
      'DELETE  MY ACCOUNT',
    ]) {
      const res = await handleAccountRequest(
        post({ action: 'initiate_deletion', confirmation: wrong }),
        deps(store),
      );
      expect(res.status, wrong).toBe(400);
      expect(await envelope(res)).toMatchObject({ error: 'confirmation-mismatch' });
    }
    // No durable state was created by any failed attempt.
    expect(state.deletionRequests).toHaveLength(0);
  });

  it('requires a fresh access token and fails closed without an iat claim', async () => {
    const { store, state } = seededStore();
    const staleIat = Math.floor(NOW_MS / 1000) - (REAUTH_MAX_TOKEN_AGE_SECONDS + 1);
    const stale = await handleAccountRequest(post(confirm, { iat: staleIat }), deps(store));
    expect(stale.status).toBe(401);
    expect(await envelope(stale)).toMatchObject({ error: 'reauth-required' });

    const noIat = await handleAccountRequest(post(confirm, { iat: null }), deps(store));
    expect(noIat.status).toBe(401);
    expect(await envelope(noIat)).toMatchObject({ error: 'reauth-required' });

    // A token minted far in the future is not "fresh" either.
    const future = await handleAccountRequest(
      post(confirm, { iat: Math.floor(NOW_MS / 1000) + 600 }),
      deps(store),
    );
    expect(future.status).toBe(401);

    expect(state.deletionRequests).toHaveLength(0);
  });

  it('accepts a token inside the freshness window', async () => {
    const { store } = seededStore();
    const res = await handleAccountRequest(
      post(confirm, { iat: Math.floor(NOW_MS / 1000) - (REAUTH_MAX_TOKEN_AGE_SECONDS - 5) }),
      deps(store),
    );
    expect(res.status).toBe(200);
  });
});

describe('mynews-account deletion lifecycle', () => {
  it('opens a cancellable request whose grace window is exactly the disclosed length', async () => {
    const { store } = seededStore();
    const res = await handleAccountRequest(post(confirm), deps(store));
    expect(res.status).toBe(200);
    const body = (await envelope(res)) as {
      ok: boolean;
      data: { created: boolean; request: Record<string, unknown> };
    };
    expect(body.ok).toBe(true);
    expect(body.data.created).toBe(true);
    const request = body.data.request;
    expect(request.status).toBe('grace');
    expect(request.cancellable).toBe(true);
    expect(request.graceDays).toBe(MYNEWS_DELETION_GRACE_DAYS);
    const graceMs = Date.parse(request.graceEndsAt as string) - Date.parse(request.requestedAt as string);
    expect(graceMs).toBe(MYNEWS_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
    // Side-effect states are visible from the first read, never hidden.
    expect(request.authUserDeletionState).toBe('pending');
    expect(request.processorCleanupState).toBe('pending');
  });

  it('is idempotent: a second initiate returns the same request', async () => {
    const { store, state } = seededStore();
    const first = (await envelope(await handleAccountRequest(post(confirm), deps(store)))) as {
      data: { request: { requestId: string } };
    };
    const second = (await envelope(await handleAccountRequest(post(confirm), deps(store)))) as {
      data: { created: boolean; request: { requestId: string } };
    };
    expect(second.data.created).toBe(false);
    expect(second.data.request.requestId).toBe(first.data.request.requestId);
    expect(state.deletionRequests).toHaveLength(1);
  });

  it('cancels only from grace, and a started deletion is not cancellable', async () => {
    const { store, state } = seededStore();
    await handleAccountRequest(post(confirm), deps(store));

    const cancelled = await handleAccountRequest(
      post({ action: 'cancel_deletion' }),
      deps(store),
    );
    expect(cancelled.status).toBe(200);
    expect(state.deletionRequests[0]!.status).toBe('cancelled');

    // Nothing in flight now.
    const again = await handleAccountRequest(post({ action: 'cancel_deletion' }), deps(store));
    expect(again.status).toBe(404);
    expect(await envelope(again)).toMatchObject({ error: 'no-deletion-request' });

    // A new request is allowed after a cancellation, and once it is claimed for
    // processing it can no longer be cancelled.
    await handleAccountRequest(post(confirm), deps(store));
    await store.claimDueAccountDeletions(
      new Date(Date.now() + MYNEWS_DELETION_GRACE_DAYS * 86_400_000 + 60_000).toISOString(),
      10,
    );
    const tooLate = await handleAccountRequest(post({ action: 'cancel_deletion' }), deps(store));
    expect(tooLate.status).toBe(409);
    expect(await envelope(tooLate)).toMatchObject({ error: 'not-cancellable' });
  });

  it('reports a durable status including unconfigured side-effect states', async () => {
    const { store } = seededStore();
    const empty = (await envelope(
      await handleAccountRequest(post({ action: 'deletion_status' }), deps(store)),
    )) as { data: { request: unknown } };
    expect(empty.data.request).toBeNull();

    await handleAccountRequest(post(confirm), deps(store));
    const [claim] = await store.claimDueAccountDeletions(
      new Date(Date.now() + MYNEWS_DELETION_GRACE_DAYS * 86_400_000 + 60_000).toISOString(),
      10,
    );
    await store.disposeAccountDeletion(claim!.id);
    await store.recordAccountDeletionState({
      requestId: claim!.id,
      field: 'auth_user_deletion_state',
      state: 'skipped-unconfigured',
    });

    const status = (await envelope(
      await handleAccountRequest(post({ action: 'deletion_status' }), deps(store)),
    )) as { data: { request: Record<string, unknown> } };
    expect(status.data.request.authUserDeletionState).toBe('skipped-unconfigured');
    expect(status.data.request.cancellable).toBe(false);
  });

  it('lets a suspended account delete and export (rights, not privileges)', async () => {
    const { store, state } = seededStore();
    state.profiles.get(PROFILE_ID)!.suspendedUntil = new Date(NOW_MS + 86_400_000).toISOString();

    const deletion = await handleAccountRequest(post(confirm), deps(store));
    expect(deletion.status).toBe(200);
    const exported = await handleAccountRequest(post({ action: 'export_data' }), deps(store));
    expect(exported.status).toBe(200);
  });

  it('works for an account with no public profile', async () => {
    const built = createInMemoryMyNewsStore({
      termsAcceptances: [{ userId: USER_ID, version: '2026-07-01' }],
    });
    const res = await handleAccountRequest(post(confirm), deps(built.store));
    expect(res.status).toBe(200);
    expect(built.state.deletionRequests[0]!.profileId).toBeNull();
  });
});

describe('mynews-account content disposition', () => {
  async function disposed() {
    const built = seededStore();
    await handleAccountRequest(post(confirm), deps(built.store));
    const [claim] = await built.store.claimDueAccountDeletions(
      new Date(Date.now() + MYNEWS_DELETION_GRACE_DAYS * 86_400_000 + 60_000).toISOString(),
      10,
    );
    expect(await built.store.disposeAccountDeletion(claim!.id)).toBe('ok');
    return built;
  }

  it('retains and anonymizes the signed public record', async () => {
    const { state } = await disposed();
    const profile = state.profiles.get(PROFILE_ID)!;
    expect(profile.displayName).toBe('Deleted account');
    expect(profile.handle).toMatch(/^deleted_[a-z0-9]{10}$/);
    expect(profile.pubkey).toBe('');
    expect(profile.pubkeyRevokedAt).not.toBeNull();
    expect(profile.deletedAt).not.toBeNull();
    // Detached from the auth user so deleting it cannot cascade the record away.
    expect(profile.userId).toBeUndefined();

    // The published article, its revision, the accepted suggestion, the
    // endorsement and the credibility ledger all survive.
    expect(state.articles.has(ARTICLE_ID)).toBe(true);
    expect(state.revisions.some((r) => r.articleId === ARTICLE_ID)).toBe(true);
    expect(state.suggestions.get(SUGGESTION_ID)?.status).toBe('accepted');
    expect(state.dupes).toHaveLength(1);
    expect(state.ledger).toHaveLength(1);
    // Decision events stay; only the free-text comment goes.
    expect(state.events.map((e) => e.action)).toEqual(['accept']);

    const journalist = state.journalistDetails.get(PROFILE_ID)!;
    expect(journalist.bio).toBe('');
    expect(journalist.beats).toEqual([]);
    expect(journalist.region).toBe('');
    expect(journalist.stripeAccountId).toBeNull();
  });

  it('hard-deletes the purely personal rows', async () => {
    const { state } = await disposed();
    // Their own follows and blocks go; other users' rows about them stay.
    expect(state.follows.map((f) => f.followerId)).toEqual([OTHER_PROFILE_ID]);
    expect(state.blocks.map((b) => b.blockerId)).toEqual([OTHER_PROFILE_ID]);
    expect(state.newsroomMembers).toHaveLength(0);
    expect(state.verifications).toHaveLength(0);
    expect([...state.termsAcceptances]).toHaveLength(0);
    expect(state.suggestions.has('open-suggestion')).toBe(false);
    expect(state.articles.has(DRAFT_ID)).toBe(false);
    expect(state.revisions.some((r) => r.articleId === DRAFT_ID)).toBe(false);
  });

  it('hard-deletes the WP6 custody personal data (finding #4)', async () => {
    const built = seededStore();
    // The user's encrypted private key, its access log, recovery history, a
    // nonce, and a notify channel. Plus another user's escrow row, which stays.
    built.state.keyEscrow.push(
      { profileId: PROFILE_ID, version: 1, envelope: {}, pubkey: 'ab'.repeat(32), createdAt: '2026-07-01T00:00:00.000Z' },
      { profileId: OTHER_PROFILE_ID, version: 1, envelope: {}, pubkey: 'cd'.repeat(32), createdAt: '2026-07-01T00:00:00.000Z' },
    );
    built.state.keyEscrowAccess.push({
      seq: 1,
      profileId: PROFILE_ID,
      userId: USER_ID,
      action: 'get',
      version: 1,
      detail: '',
      createdAtMs: Date.parse('2026-07-02T00:00:00.000Z'),
    });
    built.state.recoveryRequests.push({
      id: 'rec-1',
      profileId: PROFILE_ID,
      userId: USER_ID,
      newPubkey: 'ef'.repeat(32),
      cancelTokenHash: 'ab'.repeat(32),
      status: 'pending',
      requestedAtMs: Date.parse('2026-07-02T00:00:00.000Z'),
      unlocksAtMs: Date.parse('2026-08-01T00:00:00.000Z'),
      standing: 'open',
      cancelledAt: null,
      completedAt: null,
      frozenAt: null,
    });
    built.state.notifyChannels.push({ profileId: PROFILE_ID, confirmedAt: null });

    await handleAccountRequest(post(confirm), deps(built.store));
    const [claim] = await built.store.claimDueAccountDeletions(
      new Date(Date.now() + MYNEWS_DELETION_GRACE_DAYS * 86_400_000 + 60_000).toISOString(),
      10,
    );
    expect(await built.store.disposeAccountDeletion(claim!.id)).toBe('ok');

    expect(built.state.keyEscrow.map((e) => e.profileId)).toEqual([OTHER_PROFILE_ID]);
    expect(built.state.keyEscrowAccess).toHaveLength(0);
    expect(built.state.recoveryRequests).toHaveLength(0);
    expect(built.state.notifyChannels.some((c) => c.profileId === PROFILE_ID)).toBe(false);
  });

  it('retains an open-reported suggestion instead of letting deletion evade it (finding #3)', async () => {
    const built = seededStore();
    // The user's own open suggestion that is the target of an open report.
    built.state.suggestions.set('reported-suggestion', {
      id: 'reported-suggestion',
      articleId: ARTICLE_ID,
      baseRev: 1,
      editorProfileId: PROFILE_ID,
      type: 'copyedit',
      diffJson: '{}',
      citations: [],
      rationale: 'contested edit',
      signature: 'sig',
      createdAt: '2026-07-04T00:00:00.000Z',
      status: 'open',
    });
    built.state.reports.push({
      id: 'report-sugg',
      reporterProfileId: OTHER_PROFILE_ID,
      targetKind: 'suggestion',
      targetId: 'reported-suggestion',
      reason: 'harassment',
      detail: 'abusive edit rationale',
      status: 'open',
      createdAt: '2026-07-06T00:00:00.000Z',
    });

    await handleAccountRequest(post(confirm), deps(built.store));
    const [claim] = await built.store.claimDueAccountDeletions(
      new Date(Date.now() + MYNEWS_DELETION_GRACE_DAYS * 86_400_000 + 60_000).toISOString(),
      10,
    );
    expect(await built.store.disposeAccountDeletion(claim!.id)).toBe('ok');

    // The reported suggestion survives as moderation evidence; the unreported
    // open suggestion is still deleted.
    expect(built.state.suggestions.has('reported-suggestion')).toBe(true);
    expect(built.state.suggestions.has('open-suggestion')).toBe(false);
  });

  it('still anonymizes when deletedAt was set without the anonymization marker (finding #1b)', async () => {
    const built = seededStore();
    // Simulate exploit B state: deletedAt present, but the identity is intact
    // (displayName not the 'Deleted account' marker). Dispose must still scrub.
    const profile = built.state.profiles.get(PROFILE_ID)!;
    profile.deletedAt = '2026-07-10T00:00:00.000Z';

    await handleAccountRequest(post(confirm), deps(built.store));
    const [claim] = await built.store.claimDueAccountDeletions(
      new Date(Date.now() + MYNEWS_DELETION_GRACE_DAYS * 86_400_000 + 60_000).toISOString(),
      10,
    );
    expect(await built.store.disposeAccountDeletion(claim!.id)).toBe('ok');

    const after = built.state.profiles.get(PROFILE_ID)!;
    expect(after.displayName).toBe('Deleted account');
    expect(after.pubkey).toBe('');
    expect(after.handle).toMatch(/^deleted_[a-z0-9]{10}$/);
  });

  it('leaves the legal, safety and financial record untouched', async () => {
    const { state } = await disposed();
    expect(state.reports).toHaveLength(1);
    expect(state.moderationActions).toHaveLength(1);
    expect(state.mediaAssets.size).toBe(1);
    expect(state.supportCharges).toHaveLength(1);
    expect(state.supportLedger).toHaveLength(1);
    expect(state.supportReceipts).toHaveLength(1);
    expect(state.transferLedger).toHaveLength(1);
    // Future billing stops, the payout identity is removed from our database.
    expect(state.supports[0]!.status).toBe('canceled');
    const payout = state.payoutAccounts.get(PROFILE_ID)!;
    expect(payout.onboardingState).toBe('none');
    expect(payout.providerAccountRef).toBeNull();
  });

  it('keeps a collaborative draft alive but scrubs the deleted author words', async () => {
    const built = seededStore();
    // Another editor earned credibility on the draft, so the row must survive.
    built.state.suggestions.set('draft-suggestion', {
      id: 'draft-suggestion',
      articleId: DRAFT_ID,
      baseRev: 1,
      editorProfileId: OTHER_PROFILE_ID,
      type: 'copyedit',
      diffJson: '{}',
      citations: [],
      rationale: 'typo',
      signature: 'sig',
      createdAt: '2026-07-04T00:00:00.000Z',
      status: 'accepted',
    });
    built.state.ledger.push({
      editorProfileId: OTHER_PROFILE_ID,
      suggestionId: 'draft-suggestion',
      basePoints: 1,
      diversityMult: 1,
      standingMult: 1,
      awardedAt: '2026-07-05T00:00:00.000Z',
    });

    await handleAccountRequest(post(confirm), deps(built.store));
    const [claim] = await built.store.claimDueAccountDeletions(
      new Date(Date.now() + MYNEWS_DELETION_GRACE_DAYS * 86_400_000 + 60_000).toISOString(),
      10,
    );
    await built.store.disposeAccountDeletion(claim!.id);

    expect(built.state.articles.has(DRAFT_ID)).toBe(true);
    expect(built.state.ledger.some((l) => l.editorProfileId === OTHER_PROFILE_ID)).toBe(true);
    const revision = built.state.revisions.find((r) => r.articleId === DRAFT_ID)!;
    expect(revision.bodyMd).toBe('');
    expect(revision.headline).toBe('[removed at author request]');
    // Nothing may claim to be a valid signature over scrubbed bytes.
    expect(revision.signature).toBe('');
    expect(revision.signerPubkey).toBe('');
  });

  it('is idempotent: a repeated disposition keeps the first anonymized handle', async () => {
    const built = seededStore();
    await handleAccountRequest(post(confirm), deps(built.store));
    const [claim] = await built.store.claimDueAccountDeletions(
      new Date(Date.now() + MYNEWS_DELETION_GRACE_DAYS * 86_400_000 + 60_000).toISOString(),
      10,
    );
    await built.store.disposeAccountDeletion(claim!.id);
    const handle = built.state.profiles.get(PROFILE_ID)!.handle;
    expect(await built.store.disposeAccountDeletion(claim!.id)).toBe('ok');
    expect(built.state.profiles.get(PROFILE_ID)!.handle).toBe(handle);
  });
});

describe('mynews-account export_data', () => {
  it('returns every kind of row the account owns and writes an audit row', async () => {
    const { store, state } = seededStore();
    const res = await handleAccountRequest(post({ action: 'export_data' }), deps(store));
    expect(res.status).toBe(200);
    const body = (await envelope(res)) as {
      data: { byteCount: number; bundle: Record<string, unknown> };
    };
    const bundle = body.data.bundle;

    expect(bundle.schemaVersion).toBe(1);
    expect(bundle.userId).toBe(USER_ID);
    expect(bundle.profileId).toBe(PROFILE_ID);
    expect(bundle.profile).toMatchObject({ id: PROFILE_ID });
    expect(bundle.journalist).toMatchObject({ bio: 'Covers water policy' });

    // Every seeded row kind must be present. A missing section here means the
    // export is not complete.
    const nonEmptySections = [
      'journalistVerifications',
      'articles',
      'articleRevisions',
      'articleMeta',
      'suggestionsAuthored',
      'suggestionEventsAuthored',
      'dupeEndorsements',
      'credibilityLedger',
      'follows',
      'blocks',
      'newsroomsOwned',
      'newsroomMemberships',
      'mediaAssets',
      'termsAcceptances',
      'reportsFiled',
      'moderationNotices',
      'supports',
      'supportCharges',
      'supportLedger',
      'supportReceipts',
      'transferLedger',
    ];
    for (const section of nonEmptySections) {
      expect(Array.isArray(bundle[section]), section).toBe(true);
      expect((bundle[section] as unknown[]).length, section).toBeGreaterThan(0);
    }
    expect(bundle.payoutAccount).toMatchObject({ providerAccountRef: 'acct_live_1' });
    // Sections with no rows are present as empty arrays, never missing keys.
    expect(bundle.dmcaNoticesSubmitted).toEqual([]);
    expect(bundle.deletionRequests).toEqual([]);

    expect(body.data.byteCount).toBeGreaterThan(0);
    expect(state.exportJobs).toHaveLength(1);
    expect(state.exportJobs[0]).toMatchObject({
      userId: USER_ID,
      profileId: PROFILE_ID,
      status: 'completed',
    });
    expect(state.exportJobs[0]!.byteCount).toBe(body.data.byteCount);
  });

  it('refuses an export past the response bound instead of truncating it', async () => {
    const { store, state } = seededStore();
    const oversized: MyNewsStore = {
      ...store,
      exportAccountBundle: async () => ({ padding: 'x'.repeat(MAX_EXPORT_BYTES + 64) }),
    };
    const res = await handleAccountRequest(
      post({ action: 'export_data' }),
      deps(oversized),
    );
    expect(res.status).toBe(413);
    expect(await envelope(res)).toMatchObject({ error: 'export-too-large' });
    expect(state.exportJobs).toHaveLength(1);
    expect(state.exportJobs[0]!.status).toBe('failed');
  });

  it('fails closed and records a failed audit row when the bundle read throws', async () => {
    const { store, state } = seededStore();
    const broken: MyNewsStore = {
      ...store,
      exportAccountBundle: async () => {
        throw new Error('postgrest down');
      },
    };
    const res = await handleAccountRequest(post({ action: 'export_data' }), deps(broken));
    expect(res.status).toBe(503);
    expect(await envelope(res)).toMatchObject({ error: 'export-unavailable' });
    expect(state.exportJobs[0]!.status).toBe('failed');
  });
});

describe('mynews-account SQL drift pins', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');

  it('the disclosed grace window matches the SQL interval', () => {
    expect(sql).toContain(`interval '${MYNEWS_DELETION_GRACE_DAYS} days'`);
  });

  it('the export bundle sections match nw_account_export_bundle exactly', async () => {
    const bundleFn = sql.slice(sql.indexOf('function public.nw_account_export_bundle'));
    const sqlKeys = new Set(
      [...bundleFn.matchAll(/^\s{4}'([A-Za-z]+)',/gm)].map((match) => match[1]!),
    );
    expect(sqlKeys.size).toBeGreaterThan(20);

    const { store } = seededStore();
    const twinKeys = new Set(Object.keys(await store.exportAccountBundle(USER_ID, PROFILE_ID)));
    expect([...twinKeys].sort()).toEqual([...sqlKeys].sort());
  });

  it('the anonymized handle marker and retained tables are the ones the twin uses', () => {
    expect(sql).toContain("'Deleted account'");
    expect(sql).toContain("'deleted_' || left(md5(random()::text), 10)");
    // Legal-retention tables must never appear in a delete statement.
    for (const table of [
      'nw_reports',
      'nw_dmca_notices',
      'nw_dmca_counter_notices',
      'nw_ncii_cases',
      'nw_moderation_actions',
      'nw_support_charges',
      'nw_support_receipts',
      'nw_transfer_ledger',
    ]) {
      expect(sql, table).not.toMatch(new RegExp(`delete\\s+from\\s+public\\.${table}\\b`));
    }
  });
});
