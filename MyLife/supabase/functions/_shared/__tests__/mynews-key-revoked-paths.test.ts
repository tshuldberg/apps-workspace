// Verify-path routing through the key chain (plan 48 WP6).
//
// Every signature-verifying MyNews handler now resolves its signer through
// nw_profile_keys rather than the denormalized head column. This file proves the
// two behaviours that change for callers, across all four handlers at once:
//
//   * a signature by a ROTATED or REVOKED key is refused with the typed
//     'key-revoked' error, not the old, misleading 'no-profile',
//   * a co-active DEVICE key can author, which the head-only lookup could not
//     express at all.
//
// It lives beside the resolver rather than inside each handler's own suite so the
// four paths are asserted against ONE table of expectations; a handler that
// forgets to route through the resolver fails here.

import { extractSigningPrivateKeyHex, generateDeviceIdentity } from '@mylife/sync';
import { describe, expect, it } from 'vitest';
import {
  signArticleMeta,
  signReject,
  signRevision,
  signSuggestion,
} from '../../../../modules/mynews/src/signing/sign';
import { handlePublishRequest } from '../../mynews-publish/index.ts';
import { handleSuggestRequest } from '../../mynews-suggest/index.ts';
import { handleReviewRequest } from '../../mynews-review/index.ts';
import { handleSetMetaRequest } from '../../mynews-set-meta/index.ts';
import { KEY_REVOKED_ERROR, resolveSigningKey } from '../mynews-key-verify.ts';
import { EDGE_CURRENT_TERMS_VERSION } from '../mynews-terms.ts';
import { createInMemoryMyNewsStore } from '../mynews-store.ts';

const AUTHOR_USER = '00000000-0000-4000-8000-00000000000a';
const EDITOR_USER = '00000000-0000-4000-8000-00000000000b';
const AUTHOR_PROFILE = '11111111-1111-4111-8111-111111111111';
const EDITOR_PROFILE = '22222222-2222-4222-8222-222222222222';
const ARTICLE = '33333333-3333-4333-8333-333333333333';
const SUGGESTION = '44444444-4444-4444-8444-444444444444';
const NOW = 1_700_000_000_000;

function identity() {
  const device = generateDeviceIdentity('MyNews');
  return {
    pubkey: device.publicKey,
    privateKeyHex: extractSigningPrivateKeyHex(device.privateKeyRef),
  };
}

const AUTHOR = identity();
const AUTHOR_DEVICE = identity();
const AUTHOR_ROTATED = identity();
const EDITOR = identity();

function jwt(sub: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub, iat: Math.floor(NOW / 1000) })).toString(
    'base64url',
  );
  return `${header}.${payload}.sig`;
}

function post(url: string, body: unknown, sub: string): Request {
  return new Request(`http://local/${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt(sub)}` },
    body: JSON.stringify(body),
  });
}

/**
 * A store with a published article, an editor, terms accepted, and the author's
 * chain in one of three shapes.
 */
function seed(shape: 'active' | 'rotated' | 'device') {
  const headPubkey = shape === 'rotated' ? AUTHOR_ROTATED.pubkey : AUTHOR.pubkey;
  const built = createInMemoryMyNewsStore({
    now: () => NOW,
    profiles: [
      { id: AUTHOR_PROFILE, userId: AUTHOR_USER, pubkey: headPubkey, handle: 'reporter' },
      { id: EDITOR_PROFILE, userId: EDITOR_USER, pubkey: EDITOR.pubkey, handle: 'editor' },
    ],
    termsAcceptances: [
      { userId: AUTHOR_USER, version: EDGE_CURRENT_TERMS_VERSION },
      { userId: EDITOR_USER, version: EDGE_CURRENT_TERMS_VERSION },
    ],
    profileKeys:
      shape === 'rotated'
        ? [
            // The key that signed history, now retired.
            {
              id: '00000000-0000-4001-8000-000000000099',
              profileId: AUTHOR_PROFILE,
              pubkey: AUTHOR.pubkey,
              status: 'revoked',
              addedVia: 'initial',
            },
          ]
        : shape === 'device'
          ? [
              {
                id: '00000000-0000-4001-8000-000000000098',
                profileId: AUTHOR_PROFILE,
                pubkey: AUTHOR_DEVICE.pubkey,
                status: 'active',
                kind: 'device',
                addedVia: 'device_approval',
              },
            ]
          : undefined,
  });
  return { ...built, headPubkey };
}

/** Publish rev 1 so the other three handlers have an article to work on. */
async function publishHead(
  store: ReturnType<typeof seed>['store'],
  signer: { pubkey: string; privateKeyHex: string },
) {
  const revision = {
    articleId: ARTICLE,
    rev: 1,
    headline: 'Council votes on the plan',
    bodyMd: 'The council voted 7 to 2.',
    changelog: [],
    createdAt: new Date(NOW).toISOString(),
    signerPubkey: signer.pubkey,
  };
  const res = await handlePublishRequest(
    post(
      'mynews-publish',
      {
        article: { id: ARTICLE, slug: 'council-votes', kind: 'news', authorPubkey: signer.pubkey },
        revision,
        signatureHex: signRevision(revision, signer.privateKeyHex),
      },
      AUTHOR_USER,
    ),
    { store, now: () => NOW },
  );
  return res;
}

/**
 * A minimally valid structured diff (the WP4 bounded shape). The diff contents
 * are irrelevant here: these tests are about key resolution, not diffing.
 */
const STRUCTURED_DIFF = JSON.stringify({
  baseHash: 'deadbeef',
  ops: [
    {
      kind: 'replace',
      baseIndex: 0,
      anchorBefore: null,
      anchorAfter: null,
      baseBlocks: ['The council voted 7 to 2.'],
      newBlocks: ['The council voted 7 to 2, corrected.'],
    },
  ],
});

async function json(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

describe('resolveSigningKey', () => {
  it('distinguishes active, revoked, and unknown', async () => {
    const { store } = seed('rotated');
    expect(await resolveSigningKey(store, AUTHOR_ROTATED.pubkey)).toMatchObject({ ok: true });

    const revoked = await resolveSigningKey(store, AUTHOR.pubkey);
    expect(revoked.ok).toBe(false);
    if (revoked.ok) return;
    expect(revoked.response.status).toBe(403);
    expect((await json(revoked.response)).error).toBe(KEY_REVOKED_ERROR);

    const unknown = await resolveSigningKey(store, 'f'.repeat(64), 'register first');
    expect(unknown.ok).toBe(false);
    if (unknown.ok) return;
    expect(unknown.response.status).toBe(403);
    expect(await json(unknown.response)).toMatchObject({
      error: 'no-profile',
      detail: 'register first',
    });
  });

  it('fails CLOSED with a retryable error when the resolver throws', async () => {
    // A resolver that cannot answer cannot prove the key is live, and accepting
    // a write on an unproven key is the hole WP6 closes.
    const { store } = seed('active');
    const broken = {
      ...store,
      resolveActiveKey: async () => {
        throw new Error('resolver boom');
      },
    };
    const result = await resolveSigningKey(broken, AUTHOR.pubkey);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(503);
    expect((await json(result.response)).error).toBe('key-unavailable');
  });
});

describe('mynews-publish', () => {
  it('accepts the active head key', async () => {
    const { store } = seed('active');
    expect((await publishHead(store, AUTHOR)).status).toBe(200);
  });

  it('refuses a ROTATED key with key-revoked, not no-profile', async () => {
    const { store, state } = seed('rotated');
    const res = await publishHead(store, AUTHOR);
    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.error).toBe(KEY_REVOKED_ERROR);
    expect(String(body.detail)).toContain('can no longer author new writes');
    expect(state.articles.size).toBe(0);
  });

  it('still refuses an entirely unknown key with no-profile', async () => {
    const { store } = seed('active');
    const stranger = identity();
    const res = await publishHead(store, stranger);
    expect(res.status).toBe(403);
    expect((await json(res)).error).toBe('no-profile');
  });

  it('accepts a co-active DEVICE key, which the head-only lookup could not', async () => {
    const { store, state } = seed('device');
    const res = await publishHead(store, AUTHOR_DEVICE);
    expect(res.status).toBe(200);
    // Attributed to the OWNING profile, not to a second identity.
    expect(state.articles.get(ARTICLE)?.authorProfileId).toBe(AUTHOR_PROFILE);
  });
});

describe('mynews-suggest', () => {
  async function suggestWith(
    store: ReturnType<typeof seed>['store'],
    signer: { pubkey: string; privateKeyHex: string },
  ) {
    const suggestion = {
      id: SUGGESTION,
      articleId: ARTICLE,
      baseRev: 1,
      type: 'correction' as const,
      diffJson: STRUCTURED_DIFF,
      citations: ['https://example.org/minutes'],
      rationale: 'The vote was 7 to 2.',
      editorPubkey: signer.pubkey,
      createdAt: new Date(NOW).toISOString(),
    };
    return handleSuggestRequest(
      post(
        'mynews-suggest',
        { suggestion, signatureHex: signSuggestion(suggestion, signer.privateKeyHex) },
        EDITOR_USER,
      ),
      { store, now: () => NOW },
    );
  }

  it('accepts an active editor key and records WHICH key signed', async () => {
    const { store, state } = seed('active');
    expect((await publishHead(store, AUTHOR)).status).toBe(200);
    const res = await suggestWith(store, EDITOR);
    expect(res.status).toBe(200);
    // signer_pubkey is what keeps the suggestion verifiable after a rotation.
    expect(state.suggestions.get(SUGGESTION)?.signerPubkey).toBe(EDITOR.pubkey);
  });

  it('refuses a revoked editor key with key-revoked', async () => {
    const { store, state } = seed('active');
    expect((await publishHead(store, AUTHOR)).status).toBe(200);
    // Retire the editor's key the way a rotation would.
    for (const row of state.profileKeys) {
      if (row.profileId === EDITOR_PROFILE) {
        row.status = 'revoked';
        row.revokedAt = new Date(NOW).toISOString();
      }
    }
    const res = await suggestWith(store, EDITOR);
    expect(res.status).toBe(403);
    expect((await json(res)).error).toBe(KEY_REVOKED_ERROR);
    expect(state.suggestions.size).toBe(0);
  });
});

describe('mynews-review', () => {
  async function setupOpenSuggestion() {
    const built = seed('active');
    expect((await publishHead(built.store, AUTHOR)).status).toBe(200);
    const suggestion = {
      id: SUGGESTION,
      articleId: ARTICLE,
      baseRev: 1,
      type: 'correction' as const,
      diffJson: STRUCTURED_DIFF,
      citations: ['https://example.org/minutes'],
      rationale: 'The vote was 7 to 2.',
      editorPubkey: EDITOR.pubkey,
      createdAt: new Date(NOW).toISOString(),
    };
    expect(
      (
        await handleSuggestRequest(
          post(
            'mynews-suggest',
            { suggestion, signatureHex: signSuggestion(suggestion, EDITOR.privateKeyHex) },
            EDITOR_USER,
          ),
          { store: built.store, now: () => NOW },
        )
      ).status,
    ).toBe(200);
    return built;
  }

  function retireAuthorKey(state: ReturnType<typeof seed>['state']) {
    for (const row of state.profileKeys) {
      if (row.profileId === AUTHOR_PROFILE) {
        row.status = 'revoked';
        row.revokedAt = new Date(NOW).toISOString();
      }
    }
  }

  it('refuses a REJECT signed by a revoked author key', async () => {
    const { store, state } = await setupOpenSuggestion();
    retireAuthorKey(state);
    const res = await handleReviewRequest(
      post(
        'mynews-review',
        {
          suggestionId: SUGGESTION,
          decision: 'reject',
          note: 'not now',
          signatureHex: signReject(
            {
              suggestionId: SUGGESTION,
              articleId: ARTICLE,
              baseRev: 1,
              note: 'not now',
              signerPubkey: AUTHOR.pubkey,
            },
            AUTHOR.privateKeyHex,
          ),
        },
        AUTHOR_USER,
      ),
      { store, now: () => NOW },
    );
    expect(res.status).toBe(403);
    expect((await json(res)).error).toBe(KEY_REVOKED_ERROR);
    expect(state.suggestions.get(SUGGESTION)?.status).toBe('open');
  });

  it('refuses an ACCEPT signed by a revoked author key', async () => {
    const { store, state } = await setupOpenSuggestion();
    retireAuthorKey(state);
    const revision = {
      articleId: ARTICLE,
      rev: 2,
      headline: 'Council votes on the plan',
      bodyMd: 'The council voted 7 to 2, corrected.',
      changelog: [{ suggestionId: SUGGESTION, editorKey: EDITOR.pubkey, type: 'correction' as const }],
      createdAt: new Date(NOW).toISOString(),
      signerPubkey: AUTHOR.pubkey,
    };
    const res = await handleReviewRequest(
      post(
        'mynews-review',
        {
          suggestionId: SUGGESTION,
          decision: 'accept',
          revision,
          signatureHex: signRevision(revision, AUTHOR.privateKeyHex),
        },
        AUTHOR_USER,
      ),
      { store, now: () => NOW },
    );
    expect(res.status).toBe(403);
    expect((await json(res)).error).toBe(KEY_REVOKED_ERROR);
    expect(state.articles.get(ARTICLE)?.currentRev).toBe(1);
  });

  it('accepts with an active author key', async () => {
    const { store, state } = await setupOpenSuggestion();
    const revision = {
      articleId: ARTICLE,
      rev: 2,
      headline: 'Council votes on the plan',
      bodyMd: 'The council voted 7 to 2, corrected.',
      changelog: [{ suggestionId: SUGGESTION, editorKey: EDITOR.pubkey, type: 'correction' as const }],
      createdAt: new Date(NOW).toISOString(),
      signerPubkey: AUTHOR.pubkey,
    };
    const res = await handleReviewRequest(
      post(
        'mynews-review',
        {
          suggestionId: SUGGESTION,
          decision: 'accept',
          revision,
          signatureHex: signRevision(revision, AUTHOR.privateKeyHex),
        },
        AUTHOR_USER,
      ),
      { store, now: () => NOW },
    );
    expect(res.status).toBe(200);
    expect(state.articles.get(ARTICLE)?.currentRev).toBe(2);
  });
});

describe('mynews-set-meta', () => {
  const meta = (signerPubkey: string) => ({
    articleId: ARTICLE,
    doi: '10.1234/abcd',
    orcidAuthors: ['0000-0002-1825-0097'],
    license: 'CC-BY-4.0',
    rightsRoute: 'cc_by',
    embargoUntil: null,
    datasetHashes: [],
    canonicalUrl: 'https://example.org/article',
    signerPubkey,
  });

  it('accepts an active author key', async () => {
    const { store } = seed('active');
    expect((await publishHead(store, AUTHOR)).status).toBe(200);
    const res = await handleSetMetaRequest(
      post(
        'mynews-set-meta',
        {
          meta: meta(AUTHOR.pubkey),
          signatureHex: signArticleMeta(meta(AUTHOR.pubkey), AUTHOR.privateKeyHex),
        },
        AUTHOR_USER,
      ),
      { store },
    );
    expect(res.status).toBe(200);
  });

  it('refuses a revoked author key with key-revoked, not bad-signature', async () => {
    // The signature is cryptographically fine, so reporting 'bad-signature'
    // would send the author chasing a problem that does not exist.
    const { store, state } = seed('active');
    expect((await publishHead(store, AUTHOR)).status).toBe(200);
    for (const row of state.profileKeys) {
      if (row.profileId === AUTHOR_PROFILE) {
        row.status = 'revoked';
        row.revokedAt = new Date(NOW).toISOString();
      }
    }
    const res = await handleSetMetaRequest(
      post(
        'mynews-set-meta',
        {
          meta: meta(AUTHOR.pubkey),
          signatureHex: signArticleMeta(meta(AUTHOR.pubkey), AUTHOR.privateKeyHex),
        },
        AUTHOR_USER,
      ),
      { store },
    );
    expect(res.status).toBe(403);
    expect((await json(res)).error).toBe(KEY_REVOKED_ERROR);
    expect(state.articleMeta.size).toBe(0);
  });
});

describe('historical writes survive revocation', () => {
  it('keeps a published revision and its recorded signer after the key is retired', async () => {
    const { store, state } = seed('active');
    expect((await publishHead(store, AUTHOR)).status).toBe(200);
    for (const row of state.profileKeys) {
      if (row.profileId === AUTHOR_PROFILE) {
        row.status = 'revoked';
        row.revokedAt = new Date(NOW).toISOString();
      }
    }
    // The revision, its signature, and its signer are untouched: revocation
    // stops NEW writes, it never rewrites the record.
    const stored = state.revisions.find((r) => r.articleId === ARTICLE);
    expect(stored?.signerPubkey).toBe(AUTHOR.pubkey);
    expect(stored?.signature).toBeTruthy();
    expect(await store.resolveActiveKey(AUTHOR.pubkey)).toMatchObject({
      verdict: 'revoked',
      profileId: AUTHOR_PROFILE,
    });
  });
});
