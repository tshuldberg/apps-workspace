import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractSigningPrivateKeyHex, generateDeviceIdentity } from '@mylife/sync';
import { describe, expect, it, vi } from 'vitest';
import {
  BASE_POINTS as ENGINE_BASE_POINTS,
  diversityMultiplier as engineDiversity,
  standingMultiplier as engineStanding,
} from '../../../../modules/mynews/src/engines/credibility';
import type { ChangelogEntry, SuggestionType } from '../../../../modules/mynews/src/models';
import type {
  SignableReject,
  SignableRevision,
} from '../../../../modules/mynews/src/signing/canonical';
import { signReject, signRevision } from '../../../../modules/mynews/src/signing/sign';
import { handleReviewRequest } from '../index.ts';
import {
  BASE_POINTS,
  authorStandingForTier,
  diversityMultiplier,
  standingMultiplier,
} from '../../_shared/mynews-cred.ts';
import { EDGE_MYNEWS_BOUNDS } from '../../_shared/mynews-bounds.ts';
import { jsonOk, serveEnvelope } from '../../_shared/mynews-http.ts';
import { EDGE_CURRENT_TERMS_VERSION } from '../../_shared/mynews-terms.ts';
import {
  createInMemoryMyNewsStore,
  type EditorAggregates,
  type StoredSuggestion,
} from '../../_shared/mynews-store.ts';

const vectors = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../modules/mynews/src/signing/__fixtures__/signing-vectors.json'),
    'utf8',
  ),
);

function jwtFor(sub: string): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub }));
  return `${header}.${payload}.sig`;
}

function post(body: unknown, sub?: string): Request {
  return new Request('http://local/mynews-review', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sub ? { Authorization: `Bearer ${jwtFor(sub)}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function seeded() {
  const { store, state } = createInMemoryMyNewsStore({
    profiles: [
      { id: 'author-1', userId: 'user-author', pubkey: vectors.publicKeyHex },
      // v2 changelog validation update: the editor's registered pubkey must
      // match the fixture changelog's editorKey ('editor-key-1').
      { id: 'editor-1', userId: 'user-editor', pubkey: 'editor-key-1' },
    ],
    termsAcceptances: [{ userId: 'user-author', version: EDGE_CURRENT_TERMS_VERSION }],
  });
  state.articles.set(vectors.revision.articleId, {
    id: vectors.revision.articleId,
    slug: 'owens-valley',
    kind: 'news',
    status: 'published',
    authorProfileId: 'author-1',
    authorPubkey: vectors.publicKeyHex,
    currentRev: 1,
  });
  // v2 changelog validation update: the suggestion id and type must match the
  // fixture changelog entry ('s-fixture-1', 'correction'); was 'sug-1'.
  state.suggestions.set('s-fixture-1', {
    id: 's-fixture-1',
    articleId: vectors.revision.articleId,
    baseRev: 1,
    editorProfileId: 'editor-1',
    type: 'correction',
    diffJson: '{"baseHash":"x","ops":[]}',
    citations: ['https://example.org/evidence'],
    rationale: 'why',
    signature: 'sig',
    createdAt: '2026-07-03T11:00:00.000Z',
    status: 'open',
  });
  return { store, state };
}

/** Batch fixture: one author (the fixture key) with two registered editors. */
function desk(seed?: { journalists?: Array<{ profileId: string; tier: 'open' | 'verified' }> }) {
  const { store, state } = createInMemoryMyNewsStore({
    profiles: [
      { id: 'author-1', userId: 'user-author', pubkey: vectors.publicKeyHex },
      { id: 'editor-1', userId: 'user-editor', pubkey: 'editor-key-1' },
      { id: 'editor-2', userId: 'user-editor-2', pubkey: 'editor-key-2' },
    ],
    journalists: seed?.journalists,
    termsAcceptances: [{ userId: 'user-author', version: EDGE_CURRENT_TERMS_VERSION }],
  });
  for (const id of ['art-batch', 'art-other']) {
    state.articles.set(id, {
      id,
      slug: id,
      kind: 'news',
      status: 'published',
      authorProfileId: 'author-1',
      authorPubkey: vectors.publicKeyHex,
      currentRev: 1,
    });
  }
  const suggest = (id: string, over: Partial<StoredSuggestion> = {}) => {
    state.suggestions.set(id, {
      id,
      articleId: 'art-batch',
      baseRev: 1,
      editorProfileId: 'editor-1',
      type: 'copyedit',
      diffJson: '{"baseHash":"x","ops":[]}',
      citations: [],
      rationale: 'why',
      signature: 'sig',
      createdAt: '2026-07-03T11:00:00.000Z',
      status: 'open',
      ...over,
    });
  };
  return { store, state, suggest };
}

const entry = (
  suggestionId: string,
  editorKey: string,
  type: SuggestionType = 'copyedit',
): ChangelogEntry => ({ suggestionId, editorKey, type });

/** Fresh multi-entry vectors via the module helpers; the fixture is untouched. */
function signedRevision(over: Partial<SignableRevision> = {}): {
  revision: SignableRevision;
  signatureHex: string;
} {
  const revision: SignableRevision = {
    articleId: 'art-batch',
    rev: 2,
    headline: 'Copyedited headline',
    dek: 'Copyedited dek.',
    bodyMd: 'The clean combined body.',
    changelog: [entry('sug-a', 'editor-key-1'), entry('sug-b', 'editor-key-2')],
    createdAt: '2026-07-03T12:30:00.000Z',
    signerPubkey: vectors.publicKeyHex,
    ...over,
  };
  return { revision, signatureHex: signRevision(revision, vectors.privateKeyHex) };
}

/** Author-signed reject envelope for the seeded s-fixture-1 (baseRev 1). */
function signedReject(over: Partial<SignableReject> = {}): { signatureHex: string } {
  const signable: SignableReject = {
    suggestionId: 's-fixture-1',
    articleId: vectors.revision.articleId,
    baseRev: 1,
    signerPubkey: vectors.publicKeyHex,
    ...over,
  };
  return { signatureHex: signReject(signable, vectors.privateKeyHex) };
}

const aggFor = (distinctAuthors: number): EditorAggregates => ({
  openCount: 1,
  decidedSampleSize: 10,
  acceptanceRate: 0.8,
  acceptedTotal: 8,
  acceptedCopyedits: 2,
  distinctAuthors,
  endorsementsReceived: 0,
  maxPairShare: 0.5,
  sanctionsInLast90d: 0,
  authorStanding: 0.5,
});

function snapshot(state: ReturnType<typeof desk>['state']) {
  return JSON.stringify({
    articles: [...state.articles.entries()],
    suggestions: [...state.suggestions.entries()],
    revisions: state.revisions,
    events: state.events,
    ledger: state.ledger,
  });
}

describe('credibility twin parity (the cross-boundary guard)', () => {
  it('matches the module engine constants and curves', () => {
    expect(BASE_POINTS).toEqual(ENGINE_BASE_POINTS);
    for (const d of [0, 1, 2, 5, 10, 11, 20]) {
      expect(diversityMultiplier(d)).toBe(engineDiversity(d));
    }
    for (const s of [0, 0.25, 0.5, 0.75, 1]) {
      expect(standingMultiplier(s)).toBe(engineStanding(s));
    }
  });
});

describe('handleReviewRequest', () => {
  it('requires authentication and authorship', async () => {
    const { store } = seeded();
    const { signatureHex } = signedReject();
    const anon = await handleReviewRequest(
      post({ suggestionId: 's-fixture-1', decision: 'reject', signatureHex }),
      { store },
    );
    expect(anon.status).toBe(401);

    const wrongUser = await handleReviewRequest(
      post({ suggestionId: 's-fixture-1', decision: 'reject', signatureHex }, 'user-editor'),
      { store },
    );
    expect(wrongUser.status).toBe(403);
    expect((await wrongUser.json()).error).toBe('not-author');
  });

  it('rejects a suggestion (status change only, no revision)', async () => {
    const { store, state } = seeded();
    const { signatureHex } = signedReject();
    const res = await handleReviewRequest(
      post({ suggestionId: 's-fixture-1', decision: 'reject', signatureHex }, 'user-author'),
      { store },
    );
    expect(res.status).toBe(200);
    expect(state.suggestions.get('s-fixture-1')?.status).toBe('rejected');
    expect(state.credibilityRows).toHaveLength(0);
  });

  it.each(['reject', 'accept'] as const)(
    'blocks a suspended author from the %s review path',
    async (decision) => {
      const { store, state } = seeded();
      state.profiles.get('author-1')!.suspendedUntil = '2999-01-01T00:00:00.000Z';
      const body =
        decision === 'reject'
          ? { suggestionId: 's-fixture-1', decision, ...signedReject() }
          : {
              suggestionId: 's-fixture-1',
              decision,
              revision: vectors.revision,
              signatureHex: vectors.revisionSignatureHex,
            };

      const res = await handleReviewRequest(post(body, 'user-author'), { store });

      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe('suspended');
      expect(state.suggestions.get('s-fixture-1')?.status).toBe('open');
      expect(state.revisions).toHaveLength(0);
    },
  );

  it.each(['reject', 'accept'] as const)(
    'requires current Terms acceptance on the %s review path',
    async (decision) => {
      const { store, state } = seeded();
      state.termsAcceptances.clear();
      const body =
        decision === 'reject'
          ? { suggestionId: 's-fixture-1', decision, ...signedReject() }
          : {
              suggestionId: 's-fixture-1',
              decision,
              revision: vectors.revision,
              signatureHex: vectors.revisionSignatureHex,
            };

      const res = await handleReviewRequest(post(body, 'user-author'), { store });
      const payload = await res.json();

      expect(res.status).toBe(403);
      expect(payload.error).toBe('terms-not-accepted');
      expect(payload.detail).toBe(EDGE_CURRENT_TERMS_VERSION);
      expect(state.suggestions.get('s-fixture-1')?.status).toBe('open');
      expect(state.revisions).toHaveLength(0);
    },
  );

  it('requires an author signature to reject (F3)', async () => {
    const { store, state } = seeded();
    const res = await handleReviewRequest(
      post({ suggestionId: 's-fixture-1', decision: 'reject' }, 'user-author'),
      { store },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('bad-payload');
    expect(state.suggestions.get('s-fixture-1')?.status).toBe('open');
  });

  it('refuses a reject signed with a non-author key (F3)', async () => {
    const { store, state } = seeded();
    // A signature under a valid envelope but the wrong signer key: verification
    // is against the head author key, so this fails closed.
    const other = generateDeviceIdentity('reject-forger');
    const otherPriv = extractSigningPrivateKeyHex(other.privateKeyRef);
    const forged = signReject(
      {
        suggestionId: 's-fixture-1',
        articleId: vectors.revision.articleId,
        baseRev: 1,
        signerPubkey: other.publicKey,
      },
      otherPriv,
    );
    const res = await handleReviewRequest(
      post(
        { suggestionId: 's-fixture-1', decision: 'reject', signatureHex: forged },
        'user-author',
      ),
      { store },
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('bad-signature');
    expect(state.suggestions.get('s-fixture-1')?.status).toBe('open');
  });

  it('refuses a reject whose note differs from the signed bytes (F3 tamper)', async () => {
    const { store, state } = seeded();
    // Signed with no note; the request carries a note the signature never covered.
    const { signatureHex } = signedReject();
    const res = await handleReviewRequest(
      post(
        {
          suggestionId: 's-fixture-1',
          decision: 'reject',
          note: 'injected note not in the signature',
          signatureHex,
        },
        'user-author',
      ),
      { store },
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('bad-signature');
    expect(state.suggestions.get('s-fixture-1')?.status).toBe('open');
  });

  it('refuses a reject retargeted at a different suggestion (F3)', async () => {
    const { store, state } = seeded();
    // Signature is bound to a different suggestion id than the request targets.
    const { signatureHex } = signedReject({ suggestionId: 's-other' });
    const res = await handleReviewRequest(
      post(
        { suggestionId: 's-fixture-1', decision: 'reject', signatureHex },
        'user-author',
      ),
      { store },
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('bad-signature');
    expect(state.suggestions.get('s-fixture-1')?.status).toBe('open');
  });

  it('accepts with the fixture author-signed revision and awards credibility', async () => {
    const { store, state } = seeded();
    state.aggregates.set('editor-1', {
      openCount: 1,
      decidedSampleSize: 10,
      acceptanceRate: 0.8,
      acceptedTotal: 8,
      acceptedCopyedits: 0,
      distinctAuthors: 4,
      endorsementsReceived: 0,
      maxPairShare: 0.5,
      sanctionsInLast90d: 0,
      authorStanding: 0.9,
    });
    const res = await handleReviewRequest(
      post(
        {
          suggestionId: 's-fixture-1',
          decision: 'accept',
          revision: vectors.revision,
          signatureHex: vectors.revisionSignatureHex,
        },
        'user-author',
      ),
      { store },
    );
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.data).toEqual({ suggestionId: 's-fixture-1', decision: 'accept', rev: 2 });
    expect(state.articles.get(vectors.revision.articleId)?.currentRev).toBe(2);
    expect(state.suggestions.get('s-fixture-1')?.status).toBe('accepted');
    expect(state.credibilityRows).toEqual([
      {
        editorProfileId: 'editor-1',
        basePoints: 10,
        diversityMult: diversityMultiplier(4),
        // v2 award update (C7): standing now comes from the accepting
        // author's tier ('open' here), not the aggregates authorStanding.
        standingMult: standingMultiplier(authorStandingForTier('open')),
      },
    ]);
  });

  it('bounds a client-supplied revision createdAt (validation only)', async () => {
    // Real author-signed revisions whose createdAt is once too-future and once
    // implausibly old; both reject as bad-payload before any write, and the
    // signature (which covers those bytes) is never the reason.
    const nowMs = Date.parse('2026-07-03T12:00:00.000Z');
    for (const createdAt of ['2026-07-03T12:10:00.000Z', '2019-06-01T00:00:00.000Z']) {
      const { store, state, suggest } = desk();
      suggest('sug-a');
      const { revision, signatureHex } = signedRevision({
        changelog: [entry('sug-a', 'editor-key-1')],
        createdAt,
      });
      const res = await handleReviewRequest(
        post(
          { suggestionIds: ['sug-a'], decision: 'accept', revision, signatureHex },
          'user-author',
        ),
        { store, now: () => nowMs },
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('bad-payload');
      expect(state.revisions).toHaveLength(0);
      expect(state.suggestions.get('sug-a')?.status).toBe('open');
    }
  });

  it('refuses acceptance without an author-signed revision', async () => {
    const { store } = seeded();
    const res = await handleReviewRequest(
      post({ suggestionId: 's-fixture-1', decision: 'accept' }, 'user-author'),
      { store },
    );
    expect((await res.json()).error).toBe('bad-payload');
  });

  it('rejects a revision signed by someone other than the author', async () => {
    const { store, state } = seeded();
    state.articles.get(vectors.revision.articleId)!.authorPubkey = 'different-author-pub';
    const res = await handleReviewRequest(
      post(
        {
          suggestionId: 's-fixture-1',
          decision: 'accept',
          revision: vectors.revision,
          signatureHex: vectors.revisionSignatureHex,
        },
        'user-author',
      ),
      { store },
    );
    expect((await res.json()).error).toBe('not-author');
  });

  it('rejects tampered revisions and stale revs', async () => {
    const { store, state } = seeded();
    const tampered = await handleReviewRequest(
      post(
        {
          suggestionId: 's-fixture-1',
          decision: 'accept',
          revision: { ...vectors.revision, headline: 'changed' },
          signatureHex: vectors.revisionSignatureHex,
        },
        'user-author',
      ),
      { store },
    );
    expect((await tampered.json()).error).toBe('bad-signature');

    state.articles.get(vectors.revision.articleId)!.currentRev = 7;
    const stale = await handleReviewRequest(
      post(
        {
          suggestionId: 's-fixture-1',
          decision: 'accept',
          revision: vectors.revision,
          signatureHex: vectors.revisionSignatureHex,
        },
        'user-author',
      ),
      { store },
    );
    expect((await stale.json()).error).toBe('rev-conflict');
  });

  it('will not decide a suggestion twice', async () => {
    const { store, state } = seeded();
    state.suggestions.get('s-fixture-1')!.status = 'rejected';
    const { signatureHex } = signedReject();
    const res = await handleReviewRequest(
      post({ suggestionId: 's-fixture-1', decision: 'reject', signatureHex }, 'user-author'),
      { store },
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('not-open');
  });
});

describe('review payload validation (C4 forms)', () => {
  it('requires exactly one of suggestionId and suggestionIds', async () => {
    const { store, suggest } = desk();
    suggest('sug-a');
    // A well-formed signed revision rides along so only the id-form check can
    // fail; a missing-revision 400 would mask a broken parse rule.
    const { revision, signatureHex } = signedRevision({
      changelog: [entry('sug-a', 'editor-key-1')],
    });
    const cases: unknown[] = [
      { decision: 'accept', revision, signatureHex },
      { suggestionId: 'sug-a', suggestionIds: ['sug-a'], decision: 'accept', revision, signatureHex },
      { suggestionIds: [], decision: 'accept', revision, signatureHex },
      { suggestionIds: ['sug-a', 7], decision: 'accept', revision, signatureHex },
      { suggestionIds: ['sug-a', 'sug-a'], decision: 'accept', revision, signatureHex },
    ];
    for (const body of cases) {
      const res = await handleReviewRequest(post(body, 'user-author'), { store });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('bad-payload');
    }
  });

  it('restricts the batch form to accept decisions', async () => {
    const { store, suggest } = desk();
    suggest('sug-a');
    for (const decision of ['reject', 'partial']) {
      const res = await handleReviewRequest(
        post({ suggestionIds: ['sug-a'], decision }, 'user-author'),
        { store },
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('bad-payload');
    }
  });

  it('restricts notes to reject decisions and caps them at 2000 chars', async () => {
    const { store } = seeded();
    const onAccept = await handleReviewRequest(
      post(
        {
          suggestionId: 's-fixture-1',
          decision: 'accept',
          revision: vectors.revision,
          signatureHex: vectors.revisionSignatureHex,
          note: 'notes ride rejects only',
        },
        'user-author',
      ),
      { store },
    );
    expect(onAccept.status).toBe(400);
    expect((await onAccept.json()).error).toBe('bad-payload');

    const tooLong = await handleReviewRequest(
      post(
        { suggestionId: 's-fixture-1', decision: 'reject', note: 'x'.repeat(2001) },
        'user-author',
      ),
      { store },
    );
    expect(tooLong.status).toBe(400);
    expect((await tooLong.json()).error).toBe('bad-payload');
  });
});

describe('reject notes (C4)', () => {
  it('threads the note into the reject event payload', async () => {
    const { store, state } = seeded();
    const note = 'Thanks, but the filing says 34%.';
    // The signature must cover the same note the request carries (F3).
    const { signatureHex } = signedReject({ note });
    const res = await handleReviewRequest(
      post({ suggestionId: 's-fixture-1', decision: 'reject', note, signatureHex }, 'user-author'),
      { store },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ suggestionId: 's-fixture-1', decision: 'reject' });
    expect(state.events).toEqual([
      {
        suggestionId: 's-fixture-1',
        actorProfileId: 'author-1',
        action: 'reject',
        payload: { note },
      },
    ]);
  });

  it('keeps the note-less reject payload empty', async () => {
    const { store, state } = seeded();
    const { signatureHex } = signedReject();
    await handleReviewRequest(
      post({ suggestionId: 's-fixture-1', decision: 'reject', signatureHex }, 'user-author'),
      { store },
    );
    expect(state.events).toEqual([
      { suggestionId: 's-fixture-1', actorProfileId: 'author-1', action: 'reject', payload: {} },
    ]);
  });
});

describe('changelog credit validation (single form)', () => {
  it('rejects a changelog whose editorKey is not the registered pubkey', async () => {
    const { store, state } = seeded();
    // The fixture changelog says 'editor-key-1'; rotate the registered key.
    state.profiles.set('editor-1', { id: 'editor-1', userId: 'user-editor', pubkey: 'rotated-key' });
    const res = await handleReviewRequest(
      post(
        {
          suggestionId: 's-fixture-1',
          decision: 'accept',
          revision: vectors.revision,
          signatureHex: vectors.revisionSignatureHex,
        },
        'user-author',
      ),
      { store },
    );
    expect(res.status).toBe(409);
    const payload = await res.json();
    expect(payload.error).toBe('changelog-mismatch');
    expect(payload.detail).toContain('editor key');
  });

  it('rejects a changelog whose type differs from the suggestion', async () => {
    const { store, state } = seeded();
    state.suggestions.get('s-fixture-1')!.type = 'clarity';
    const res = await handleReviewRequest(
      post(
        {
          suggestionId: 's-fixture-1',
          decision: 'accept',
          revision: vectors.revision,
          signatureHex: vectors.revisionSignatureHex,
        },
        'user-author',
      ),
      { store },
    );
    expect(res.status).toBe(409);
    const payload = await res.json();
    expect(payload.error).toBe('changelog-mismatch');
    expect(payload.detail).toContain('type');
  });

  it('rejects extra changelog entries before touching the signature', async () => {
    const { store } = seeded();
    const res = await handleReviewRequest(
      post(
        {
          suggestionId: 's-fixture-1',
          decision: 'accept',
          revision: {
            ...vectors.revision,
            changelog: [
              ...vectors.revision.changelog,
              entry('sug-uncredited', 'editor-key-1', 'correction'),
            ],
          },
          // Junk signature: coverage fails before verification ever runs.
          signatureHex: 'ff',
        },
        'user-author',
      ),
      { store },
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('changelog-mismatch');
  });
});

describe('batch accept (C4)', () => {
  it('bumps the rev once with N events and per-editor v2 awards', async () => {
    const { store, state, suggest } = desk();
    suggest('sug-a');
    suggest('sug-b', { editorProfileId: 'editor-2' });
    state.aggregates.set('editor-1', aggFor(4));
    state.aggregates.set('editor-2', aggFor(1));
    const { revision, signatureHex } = signedRevision();
    const res = await handleReviewRequest(
      post(
        { suggestionIds: ['sug-a', 'sug-b'], decision: 'accept', revision, signatureHex },
        'user-author',
      ),
      { store },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({
      suggestionIds: ['sug-a', 'sug-b'],
      decision: 'accept',
      rev: 2,
    });
    expect(state.articles.get('art-batch')?.currentRev).toBe(2);
    expect(state.revisions).toHaveLength(1);
    expect(state.suggestions.get('sug-a')?.status).toBe('accepted');
    expect(state.suggestions.get('sug-b')?.status).toBe('accepted');
    expect(state.events.map((e) => [e.suggestionId, e.action, e.payload])).toEqual([
      ['sug-a', 'accept', { rev: 2 }],
      ['sug-b', 'accept', { rev: 2 }],
    ]);
    expect(state.credibilityRows).toEqual([
      {
        editorProfileId: 'editor-1',
        basePoints: BASE_POINTS.copyedit,
        diversityMult: diversityMultiplier(4),
        standingMult: standingMultiplier(authorStandingForTier('open')),
      },
      {
        editorProfileId: 'editor-2',
        basePoints: BASE_POINTS.copyedit,
        diversityMult: diversityMultiplier(1),
        standingMult: standingMultiplier(authorStandingForTier('open')),
      },
    ]);
  });

  it('verifies the batch revision for real under the v1 domain', async () => {
    const { store, suggest } = desk();
    suggest('sug-a');
    suggest('sug-b', { editorProfileId: 'editor-2' });
    const { revision, signatureHex } = signedRevision();
    const res = await handleReviewRequest(
      post(
        {
          suggestionIds: ['sug-a', 'sug-b'],
          decision: 'accept',
          revision: { ...revision, bodyMd: `${revision.bodyMd} (tampered)` },
          signatureHex,
        },
        'user-author',
      ),
      { store },
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('bad-signature');
  });

  it('applies the verified-author standing override to every award', async () => {
    const { store, state, suggest } = desk({
      journalists: [{ profileId: 'author-1', tier: 'verified' }],
    });
    suggest('sug-a');
    const { revision, signatureHex } = signedRevision({
      changelog: [entry('sug-a', 'editor-key-1')],
    });
    const res = await handleReviewRequest(
      post({ suggestionIds: ['sug-a'], decision: 'accept', revision, signatureHex }, 'user-author'),
      { store },
    );
    expect(res.status).toBe(200);
    expect(state.credibilityRows[0]?.standingMult).toBe(
      standingMultiplier(authorStandingForTier('verified')),
    );
  });

  it('awards zero base points on self-edits but still writes the ledger row', async () => {
    const { store, state, suggest } = desk();
    // Plan section 5.3: suggestions on your own articles earn zero points.
    suggest('sug-self', { editorProfileId: 'author-1' });
    const { revision, signatureHex } = signedRevision({
      changelog: [entry('sug-self', vectors.publicKeyHex)],
    });
    const res = await handleReviewRequest(
      post(
        { suggestionIds: ['sug-self'], decision: 'accept', revision, signatureHex },
        'user-author',
      ),
      { store },
    );
    expect(res.status).toBe(200);
    expect(state.ledger).toHaveLength(1);
    expect(state.ledger[0]).toMatchObject({ editorProfileId: 'author-1', basePoints: 0 });
  });

  it('mixes self-edit and normal awards correctly in one batch', async () => {
    const { store, state, suggest } = desk();
    suggest('sug-b', { editorProfileId: 'editor-2' });
    suggest('sug-self', { editorProfileId: 'author-1' });
    const { revision, signatureHex } = signedRevision({
      changelog: [entry('sug-b', 'editor-key-2'), entry('sug-self', vectors.publicKeyHex)],
    });
    const res = await handleReviewRequest(
      post(
        { suggestionIds: ['sug-b', 'sug-self'], decision: 'accept', revision, signatureHex },
        'user-author',
      ),
      { store },
    );
    expect(res.status).toBe(200);
    expect(state.articles.get('art-batch')?.currentRev).toBe(2);
    expect(state.revisions).toHaveLength(1);
    const byId = new Map(state.ledger.map((row) => [row.suggestionId, row]));
    expect(byId.get('sug-self')?.basePoints).toBe(0);
    expect(byId.get('sug-b')?.basePoints).toBe(BASE_POINTS.copyedit);
    expect(byId.get('sug-b')?.basePoints).toBeGreaterThan(0);
  });

  it('fails closed when a changelog entry has no editorKey at all', async () => {
    const { store, suggest } = desk();
    // A suggestion whose editor has no registered profile: without the
    // typeof guard, a missing editorKey would pass via undefined === undefined.
    suggest('sug-ghost', { editorProfileId: 'editor-ghost' });
    const { revision } = signedRevision({
      changelog: [{ suggestionId: 'sug-ghost', type: 'copyedit' } as unknown as ChangelogEntry],
    });
    const res = await handleReviewRequest(
      post(
        { suggestionIds: ['sug-ghost'], decision: 'accept', revision, signatureHex: 'ff' },
        'user-author',
      ),
      { store },
    );
    expect(res.status).toBe(409);
    const payload = await res.json();
    expect(payload.error).toBe('changelog-mismatch');
    expect(payload.detail).toContain('editor key');
  });

  it('returns changelog-mismatch on missing coverage before signature checks', async () => {
    const { store, suggest } = desk();
    suggest('sug-a');
    suggest('sug-b', { editorProfileId: 'editor-2' });
    const { revision } = signedRevision({ changelog: [entry('sug-a', 'editor-key-1')] });
    const res = await handleReviewRequest(
      post(
        // Junk signature: the coverage check fires before verification.
        { suggestionIds: ['sug-a', 'sug-b'], decision: 'accept', revision, signatureHex: 'ff' },
        'user-author',
      ),
      { store },
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('changelog-mismatch');
  });

  it('distinguishes wrong-type and wrong-key changelog entries', async () => {
    const { store, suggest } = desk();
    suggest('sug-a');
    const wrongType = await handleReviewRequest(
      post(
        {
          suggestionIds: ['sug-a'],
          decision: 'accept',
          revision: signedRevision({ changelog: [entry('sug-a', 'editor-key-1', 'clarity')] })
            .revision,
          signatureHex: 'ff',
        },
        'user-author',
      ),
      { store },
    );
    const wrongTypePayload = await wrongType.json();
    expect(wrongTypePayload.error).toBe('changelog-mismatch');
    expect(wrongTypePayload.detail).toContain('type');

    const wrongKey = await handleReviewRequest(
      post(
        {
          suggestionIds: ['sug-a'],
          decision: 'accept',
          revision: signedRevision({ changelog: [entry('sug-a', 'not-the-editor-key')] }).revision,
          signatureHex: 'ff',
        },
        'user-author',
      ),
      { store },
    );
    const wrongKeyPayload = await wrongKey.json();
    expect(wrongKeyPayload.error).toBe('changelog-mismatch');
    expect(wrongKeyPayload.detail).toContain('editor key');
    expect(wrongKeyPayload.detail).not.toBe(wrongTypePayload.detail);
  });

  it('returns batch-mixed-articles for suggestions across articles', async () => {
    const { store, suggest } = desk();
    suggest('sug-a');
    suggest('sug-c', { articleId: 'art-other' });
    const { revision } = signedRevision({
      changelog: [entry('sug-a', 'editor-key-1'), entry('sug-c', 'editor-key-1')],
    });
    const res = await handleReviewRequest(
      post(
        { suggestionIds: ['sug-a', 'sug-c'], decision: 'accept', revision, signatureHex: 'ff' },
        'user-author',
      ),
      { store },
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('batch-mixed-articles');
  });

  it('refuses a batch with one non-open suggestion and commits nothing', async () => {
    const { store, state, suggest } = desk();
    suggest('sug-a');
    suggest('sug-b', { editorProfileId: 'editor-2', status: 'rejected' });
    const before = snapshot(state);
    const { revision, signatureHex } = signedRevision();
    const res = await handleReviewRequest(
      post(
        { suggestionIds: ['sug-a', 'sug-b'], decision: 'accept', revision, signatureHex },
        'user-author',
      ),
      { store },
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('not-open');
    expect(snapshot(state)).toBe(before);
  });

  it('reports rev conflicts after the changelog check, before the signature', async () => {
    const { store, suggest } = desk();
    suggest('sug-a');
    suggest('sug-b', { editorProfileId: 'editor-2' });
    const { revision } = signedRevision({ rev: 9 });
    const res = await handleReviewRequest(
      post(
        { suggestionIds: ['sug-a', 'sug-b'], decision: 'accept', revision, signatureHex: 'ff' },
        'user-author',
      ),
      { store },
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('rev-conflict');
  });
});

describe('serveEnvelope (carried improvement E)', () => {
  it('maps any thrown error to the internal envelope without leaking it', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapped = serveEnvelope(
      async () => {
        throw new Error('postgres://secret-connection-string');
      },
      { fn: 'mynews-review', action: 'review' },
    );
    const res = await wrapped(new Request('http://local/mynews-review', { method: 'POST' }));
    expect(res.status).toBe(500);
    const payload = await res.json();
    expect(payload).toEqual({ ok: false, error: 'internal' });
    expect(JSON.stringify(payload)).not.toContain('secret');
    // Two error-channel lines since WP11: the handler error itself plus the
    // structured request log (error level for a 500). The secret may appear in
    // the server-side handler line but NEVER in the structured log line, which
    // is what ships to log aggregation.
    expect(consoleError).toHaveBeenCalledTimes(2);
    const structuredLines = consoleError.mock.calls
      .map((call) => call[0])
      .filter((arg): arg is string => typeof arg === 'string' && arg.startsWith('{'));
    expect(structuredLines).toHaveLength(1);
    expect(structuredLines[0]).not.toContain('secret');
    consoleError.mockRestore();
  });

  it('passes handler responses through untouched', async () => {
    const wrapped = serveEnvelope(async () => jsonOk({ fine: true }), {
      fn: 'mynews-review',
      action: 'review',
    });
    const res = await wrapped(new Request('http://local/mynews-review', { method: 'POST' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { fine: true } });
  });
});

// Plan 48 WP4. Accept writes a NEW revision, so the publish bounds apply here
// too: without them an author could route an oversized revision through an
// accept and bypass the publish ceilings entirely. The revisions below are
// properly signed, so the only thing that can reject them is the bound.
describe('handleReviewRequest canonical bounds', () => {
  const cases: Array<[string, Partial<SignableRevision>, string]> = [
    [
      'headline',
      { headline: 'h'.repeat(EDGE_MYNEWS_BOUNDS.HEADLINE_MAX_CHARS + 1) },
      String(EDGE_MYNEWS_BOUNDS.HEADLINE_MAX_CHARS),
    ],
    [
      'dek',
      { dek: 'd'.repeat(EDGE_MYNEWS_BOUNDS.DEK_MAX_CHARS + 1) },
      String(EDGE_MYNEWS_BOUNDS.DEK_MAX_CHARS),
    ],
    [
      'bodyMd',
      { bodyMd: 'b'.repeat(EDGE_MYNEWS_BOUNDS.BODY_MAX_BYTES + 1) },
      String(EDGE_MYNEWS_BOUNDS.BODY_MAX_BYTES),
    ],
  ];

  it.each(cases)('rejects an over-long %s on accept', async (field, over, expected) => {
    const { store, state, suggest } = desk();
    suggest('sug-a');
    suggest('sug-b', { editorProfileId: 'editor-2' });
    const { revision, signatureHex } = signedRevision(over);
    const res = await handleReviewRequest(
      post(
        { suggestionIds: ['sug-a', 'sug-b'], decision: 'accept', revision, signatureHex },
        'user-author',
      ),
      { store },
    );
    expect(res.status, field).toBe(400);
    const payload = await res.json();
    expect(payload.error, field).toBe('bounds');
    expect(String(payload.detail), field).toContain(expected);
    expect(state.revisions, field).toHaveLength(0);
    expect(state.suggestions.get('sug-a')?.status, field).toBe('open');
  });

  it('rejects a changelog that credits more suggestions than the ceiling', async () => {
    const { store, state, suggest } = desk();
    suggest('sug-a');
    const changelog = Array.from(
      { length: EDGE_MYNEWS_BOUNDS.CHANGELOG_MAX_ENTRIES + 1 },
      (_, i) => entry(`sug-${i}`, 'editor-key-1'),
    );
    const { revision, signatureHex } = signedRevision({ changelog });
    const res = await handleReviewRequest(
      post({ suggestionIds: ['sug-a'], decision: 'accept', revision, signatureHex }, 'user-author'),
      { store },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('bounds');
    expect(state.revisions).toHaveLength(0);
  });

  it('still accepts a revision exactly at the ceilings', async () => {
    const { store, state, suggest } = desk();
    suggest('sug-a');
    suggest('sug-b', { editorProfileId: 'editor-2' });
    const { revision, signatureHex } = signedRevision({
      headline: 'h'.repeat(EDGE_MYNEWS_BOUNDS.HEADLINE_MAX_CHARS),
      dek: 'd'.repeat(EDGE_MYNEWS_BOUNDS.DEK_MAX_CHARS),
    });
    const res = await handleReviewRequest(
      post(
        { suggestionIds: ['sug-a', 'sug-b'], decision: 'accept', revision, signatureHex },
        'user-author',
      ),
      { store },
    );
    expect(res.status).toBe(200);
    expect(state.revisions).toHaveLength(1);
  });

  it('keeps the reject note ceiling pinned to the canonical constant', async () => {
    const { store } = seeded();
    const res = await handleReviewRequest(
      post(
        {
          suggestionId: 's-fixture-1',
          decision: 'reject',
          note: 'n'.repeat(EDGE_MYNEWS_BOUNDS.CHANGELOG_NOTE_MAX_CHARS + 1),
          ...signedReject(),
        },
        'user-author',
      ),
      { store },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('bad-payload');
  });
});
