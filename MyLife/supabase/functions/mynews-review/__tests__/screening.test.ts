import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { SignableRevision } from '../../../../modules/mynews/src/signing/canonical';
import { signRevision } from '../../../../modules/mynews/src/signing/sign';
import { handleReviewRequest } from '../index.ts';
import { EDGE_CURRENT_TERMS_VERSION } from '../../_shared/mynews-terms.ts';
import { createInMemoryMyNewsStore, type MyNewsStore } from '../../_shared/mynews-store.ts';
import {
  canonicalScreeningPayload,
  sha256Hex,
} from '../../_shared/mynews-screening-gate.ts';

/**
 * Review-accept screening (plan 48 WP8).
 *
 * An accept writes a NEW revision whose headline, dek, and body are
 * client-supplied bytes, so it is a publication path in its own right: the
 * screening the accepted suggestions passed says nothing about the text the
 * author actually submitted here.
 *
 * This path HOLDS rather than quarantines. Review's standing invariant is that
 * the server never composes article text, and the credibility awards ride on
 * live aggregates, so storing a pending revision and replaying it later would
 * make the server the author of whatever it replayed. Instead nothing is written,
 * the decision row carries the exact refused envelope for the reviewer, the
 * suggestions stay open, and an approval issues a content allowance so the
 * author's identical resubmission goes straight through. The tests below pin all
 * four of those properties.
 */

const vectors = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../modules/mynews/src/signing/__fixtures__/signing-vectors.json'),
    'utf8',
  ),
);

const AUTHOR_USER_ID = 'user-author';
const AUTHOR_PROFILE_ID = 'author-1';
const ARTICLE_ID = 'art-review-1';
const SUGGESTION_ID = 'sug-review-1';
const NOW_MS = Date.parse('2026-07-30T12:00:00.000Z');

const CLEAN_BODY = 'The clean combined body, with the correction applied.';
const HATE_BODY = 'you are nothing but a kike and everyone knows it, so there';

function jwtFor(sub: string): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub }));
  return `${header}.${payload}.sig`;
}

function post(body: unknown): Request {
  return new Request('http://local/mynews-review', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwtFor(AUTHOR_USER_ID)}`,
    },
    body: JSON.stringify(body),
  });
}

function seeded() {
  const built = createInMemoryMyNewsStore({
    // Pin the store clock to NOW_MS so allowance expiry never reads the real
    // clock (2026-08-01 CI failure: fixture allowances expired in real time).
    now: () => NOW_MS,
    profiles: [
      { id: AUTHOR_PROFILE_ID, userId: AUTHOR_USER_ID, pubkey: vectors.publicKeyHex },
      { id: 'editor-1', userId: 'user-editor', pubkey: 'editor-key-1' },
    ],
    termsAcceptances: [{ userId: AUTHOR_USER_ID, version: EDGE_CURRENT_TERMS_VERSION }],
  });
  built.state.articles.set(ARTICLE_ID, {
    id: ARTICLE_ID,
    slug: 'owens-valley',
    kind: 'news',
    status: 'published',
    authorProfileId: AUTHOR_PROFILE_ID,
    authorPubkey: vectors.publicKeyHex,
    currentRev: 1,
  });
  built.state.suggestions.set(SUGGESTION_ID, {
    id: SUGGESTION_ID,
    articleId: ARTICLE_ID,
    baseRev: 1,
    editorProfileId: 'editor-1',
    type: 'correction',
    diffJson: '{"baseHash":"x","ops":[]}',
    citations: ['https://example.org/evidence'],
    rationale: 'why',
    signature: 'sig',
    createdAt: '2026-07-30T11:00:00.000Z',
    status: 'open',
  });
  return built;
}

function acceptBody(bodyMd: string) {
  const revision: SignableRevision = {
    articleId: ARTICLE_ID,
    rev: 2,
    headline: 'Corrected headline',
    dek: 'Corrected dek.',
    bodyMd,
    changelog: [{ suggestionId: SUGGESTION_ID, editorKey: 'editor-key-1', type: 'correction' }],
    createdAt: '2026-07-30T11:30:00.000Z',
    signerPubkey: vectors.publicKeyHex,
  };
  return {
    suggestionId: SUGGESTION_ID,
    decision: 'accept' as const,
    revision,
    signatureHex: signRevision(revision, vectors.privateKeyHex),
  };
}

const deps = (store: MyNewsStore) => ({ store, now: () => NOW_MS, screeningProvider: null });

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

describe('review screening: clean accept', () => {
  it('accepts and bumps the head exactly as before', async () => {
    const { store, state } = seeded();
    const res = await handleReviewRequest(post(acceptBody(CLEAN_BODY)), deps(store));
    expect(res.status).toBe(200);
    expect(state.articles.get(ARTICLE_ID)?.currentRev).toBe(2);
    expect(state.suggestions.get(SUGGESTION_ID)?.status).toBe('accepted');
    expect(state.screeningDecisions).toHaveLength(0);
  });
});

describe('review screening: held accept', () => {
  it('writes no content at all', async () => {
    const { store, state } = seeded();
    const res = await handleReviewRequest(post(acceptBody(HATE_BODY)), deps(store));
    expect(res.status).toBe(202);
    expect((await readJson(res)).error).toBe('screening-quarantined');
    expect(state.articles.get(ARTICLE_ID)?.currentRev).toBe(1);
    expect(state.revisions).toHaveLength(0);
  });

  it('leaves the suggestion open so the author can resubmit', async () => {
    const { store, state } = seeded();
    await handleReviewRequest(post(acceptBody(HATE_BODY)), deps(store));
    expect(state.suggestions.get(SUGGESTION_ID)?.status).toBe('open');
  });

  it('awards no credibility for a refused accept', async () => {
    const { store, state } = seeded();
    await handleReviewRequest(post(acceptBody(HATE_BODY)), deps(store));
    expect(state.credibilityRows).toHaveLength(0);
  });

  it('holds the exact refused envelope for the reviewer', async () => {
    const { store, state } = seeded();
    await handleReviewRequest(post(acceptBody(HATE_BODY)), deps(store));
    expect(state.screeningDecisions).toHaveLength(1);
    const decision = state.screeningDecisions[0]!;
    expect(decision.contentKind).toBe('revision-proposal');
    expect(decision.autoAction).toBe('held');
    expect(decision.contentId).toBe(ARTICLE_ID);
    expect(decision.contentRev).toBe(2);
    expect(decision.authorProfileId).toBe(AUTHOR_PROFILE_ID);
    const payload = decision.heldPayload as {
      revision: { bodyMd: string; headline: string };
      signatureHex: string;
      suggestionIds: string[];
    };
    expect(payload.revision.bodyMd).toBe(HATE_BODY);
    expect(payload.revision.headline).toBe('Corrected headline');
    expect(payload.signatureHex.length).toBeGreaterThan(0);
    expect(payload.suggestionIds).toEqual([SUGGESTION_ID]);
  });

  it('tells the author the suggestions stay open', async () => {
    const { store } = seeded();
    const res = await handleReviewRequest(post(acceptBody(HATE_BODY)), deps(store));
    const detail = String((await readJson(res)).detail);
    expect(detail).toContain('suggestions stay open');
    expect(detail).toContain('not published');
    expect(detail).not.toContain('—');
  });

  it('does not hold a reject, which composes no article text', async () => {
    const { store, state } = seeded();
    const rejectRes = await handleReviewRequest(
      post({ suggestionId: SUGGESTION_ID, decision: 'reject' }),
      deps(store),
    );
    // A reject without a signature is refused for that reason, not screened.
    expect(rejectRes.status).toBe(400);
    expect(state.screeningDecisions).toHaveLength(0);
  });
});

describe('review screening: fail closed', () => {
  it('accepts nothing when screening cannot run', async () => {
    const { store, state } = seeded();
    const broken: MyNewsStore = {
      ...store,
      screeningAllowanceExists: () => Promise.reject(new Error('db down')),
    };
    const res = await handleReviewRequest(post(acceptBody(CLEAN_BODY)), deps(broken));
    expect(res.status).toBe(503);
    expect(state.articles.get(ARTICLE_ID)?.currentRev).toBe(1);
    expect(state.suggestions.get(SUGGESTION_ID)?.status).toBe('open');
  });

  it('accepts nothing when the hold write fails', async () => {
    const { store, state } = seeded();
    const broken: MyNewsStore = {
      ...store,
      holdRevisionProposal: async () => ({ ok: false, code: 'unavailable' }),
    };
    const res = await handleReviewRequest(post(acceptBody(HATE_BODY)), deps(broken));
    expect(res.status).toBe(503);
    expect(state.articles.get(ARTICLE_ID)?.currentRev).toBe(1);
  });
});

describe('review screening: approval terminates the loop', () => {
  it('lets the author resubmit the same revision once an allowance exists', async () => {
    const { store, state } = seeded();
    const first = await handleReviewRequest(post(acceptBody(HATE_BODY)), deps(store));
    expect(first.status).toBe(202);

    // What nw_screening_approve does: mark the decision approved and issue an
    // allowance for exactly the screened bytes.
    const decision = state.screeningDecisions[0]!;
    decision.decision = 'approved';
    const payload = canonicalScreeningPayload({
      kind: 'revision-proposal',
      text: HATE_BODY,
      title: 'Corrected headline Corrected dek.',
    });
    state.screeningAllowances.push({
      authorProfileId: AUTHOR_PROFILE_ID,
      contentSha256: await sha256Hex(payload),
      expiresAt: new Date(NOW_MS + 86_400_000).toISOString(),
    });

    const second = await handleReviewRequest(post(acceptBody(HATE_BODY)), deps(store));
    expect(second.status).toBe(200);
    expect(state.articles.get(ARTICLE_ID)?.currentRev).toBe(2);
    expect(state.suggestions.get(SUGGESTION_ID)?.status).toBe('accepted');
    // No second hold: the allowance short-circuited screening.
    expect(state.screeningDecisions).toHaveLength(1);
  });
});
