import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { handleSuggestRequest } from '../index.ts';
import { EDGE_CURRENT_TERMS_VERSION } from '../../_shared/mynews-terms.ts';
import { createInMemoryMyNewsStore, type MyNewsStore } from '../../_shared/mynews-store.ts';

/**
 * Suggest screening end to end (plan 48 WP8).
 *
 * The screened text is the diff's ADDED prose plus the rationale, never the base
 * blocks: those are already-published article text that was screened when it was
 * published, and screening them again would hold an editor responsible for
 * someone else's words. Two tests below pin exactly that.
 */

const vectors = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../modules/mynews/src/signing/__fixtures__/signing-vectors.json'),
    'utf8',
  ),
);

const EDITOR_USER_ID = 'auth-editor-1';
const EDITOR_PROFILE_ID = 'editor-1';
const NOW_MS = Date.parse('2026-07-30T12:00:00.000Z');

const HATE_TEXT = 'you are nothing but a kike and everyone knows it';
const CLEAN_TEXT = 'The council vote was seven to two, per the clerk record.';

function jwtFor(sub: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64url');
  return `${header}.${payload}.sig`;
}

function post(body: unknown): Request {
  return new Request('http://local/mynews-suggest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwtFor(EDITOR_USER_ID)}`,
    },
    body: JSON.stringify(body),
  });
}

const replaceOp = (baseIndex: number, baseText: string, newText: string) => ({
  kind: 'replace',
  baseIndex,
  anchorBefore: null,
  anchorAfter: null,
  baseBlocks: [baseText],
  newBlocks: [newText],
});

const diffWith = (ops: unknown[]) => JSON.stringify({ baseHash: 'deadbeef', ops });

function bodyWith(input: { diffJson: string; rationale?: string; citations?: string[]; id?: string }) {
  return {
    suggestion: {
      id: input.id ?? 'sug-new',
      articleId: vectors.suggestion.articleId,
      baseRev: 1,
      type: 'copyedit',
      diffJson: input.diffJson,
      citations: input.citations ?? [],
      rationale: input.rationale ?? 'tighten the wording',
      editorPubkey: vectors.publicKeyHex,
      createdAt: '2026-07-30T10:00:00.000Z',
    },
    signatureHex: 'unchecked-under-fake-verify',
  };
}

function seeded() {
  const built = createInMemoryMyNewsStore({
    profiles: [{ id: EDITOR_PROFILE_ID, userId: EDITOR_USER_ID, pubkey: vectors.publicKeyHex }],
    termsAcceptances: [{ userId: EDITOR_USER_ID, version: EDGE_CURRENT_TERMS_VERSION }],
  });
  built.state.articles.set(vectors.suggestion.articleId, {
    id: vectors.suggestion.articleId,
    slug: 'owens-valley',
    kind: 'news',
    status: 'published',
    authorProfileId: 'author-1',
    authorPubkey: 'author-pub',
    currentRev: 1,
  });
  return built;
}

// Signature verification has its own suite; these tests use the DI verify seam
// so they can submit arbitrary diff content.
const deps = (store: MyNewsStore) => ({
  store,
  verify: async () => true,
  now: () => NOW_MS,
  screeningProvider: null,
});

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

describe('suggest screening: clean content', () => {
  it('files a clean suggestion as open', async () => {
    const { store, state } = seeded();
    const res = await handleSuggestRequest(
      post(bodyWith({ diffJson: diffWith([replaceOp(0, 'Base block 0.', CLEAN_TEXT)]) })),
      deps(store),
    );
    expect(res.status).toBe(200);
    expect(state.suggestions.get('sug-new')?.status).toBe('open');
    expect(state.screeningDecisions).toHaveLength(0);
  });
});

describe('suggest screening: held content', () => {
  it('stores a held suggestion as quarantined with a decision row', async () => {
    const { store, state } = seeded();
    const res = await handleSuggestRequest(
      post(bodyWith({ diffJson: diffWith([replaceOp(0, 'Base block 0.', HATE_TEXT)]) })),
      deps(store),
    );
    expect(res.status).toBe(202);
    expect((await readJson(res)).error).toBe('screening-quarantined');
    // 'quarantined' keeps it out of the public policy, the open-suggestion
    // queue, the near-dupe scan, and every credibility aggregate at once.
    expect(state.suggestions.get('sug-new')?.status).toBe('quarantined');
    expect(state.screeningDecisions).toHaveLength(1);
    expect(state.screeningDecisions[0]!.contentKind).toBe('suggestion');
    expect(state.screeningDecisions[0]!.authorProfileId).toBe(EDITOR_PROFILE_ID);
  });

  it('holds on the rationale as well as the diff', async () => {
    const { store, state } = seeded();
    const res = await handleSuggestRequest(
      post(
        bodyWith({
          diffJson: diffWith([replaceOp(0, 'Base block 0.', CLEAN_TEXT)]),
          rationale: HATE_TEXT,
        }),
      ),
      deps(store),
    );
    expect(res.status).toBe(202);
    expect(state.suggestions.get('sug-new')?.status).toBe('quarantined');
  });

  it('holds on a scam citation link even when the prose is clean', async () => {
    const { store, state } = seeded();
    const res = await handleSuggestRequest(
      post(
        bodyWith({
          diffJson: diffWith([
            replaceOp(
              0,
              'Base block 0.',
              'Send your seed phrase to the official support team to claim your prize now.',
            ),
          ]),
          citations: ['https://coinbase-secure-login.tk/claim'],
        }),
      ),
      deps(store),
    );
    expect(res.status).toBe(202);
    expect(state.screeningDecisions[0]!.topClass).toBe('fraud-scam');
  });

  it('does not hold an editor for base text they did not write', async () => {
    // The base block carries the abusive words; the editor is REMOVING them.
    const { store, state } = seeded();
    const res = await handleSuggestRequest(
      post(
        bodyWith({
          diffJson: diffWith([replaceOp(0, HATE_TEXT, 'a neutral paraphrase of the quote')]),
        }),
      ),
      deps(store),
    );
    expect(res.status).toBe(200);
    expect(state.suggestions.get('sug-new')?.status).toBe('open');
  });

  it('excludes a held suggestion from the open-suggestion scan', async () => {
    const { store, state } = seeded();
    await handleSuggestRequest(
      post(bodyWith({ diffJson: diffWith([replaceOp(0, 'Base block 0.', HATE_TEXT)]) })),
      deps(store),
    );
    expect(state.suggestions.get('sug-new')?.status).toBe('quarantined');
    const open = await store.getOpenSuggestionsForArticle(vectors.suggestion.articleId, 1);
    expect(open).toHaveLength(0);
  });
});

describe('suggest screening: fail closed', () => {
  it('files nothing when screening cannot run', async () => {
    const { store, state } = seeded();
    const broken: MyNewsStore = {
      ...store,
      screeningAllowanceExists: () => Promise.reject(new Error('db down')),
    };
    const res = await handleSuggestRequest(
      post(bodyWith({ diffJson: diffWith([replaceOp(0, 'Base block 0.', CLEAN_TEXT)]) })),
      deps(broken),
    );
    expect(res.status).toBe(503);
    expect(state.suggestions.size).toBe(0);
  });

  it('files nothing when the hold write fails', async () => {
    const { store, state } = seeded();
    const broken: MyNewsStore = {
      ...store,
      quarantineSuggestion: async () => ({ ok: false, code: 'unavailable' }),
    };
    const res = await handleSuggestRequest(
      post(bodyWith({ diffJson: diffWith([replaceOp(0, 'Base block 0.', HATE_TEXT)]) })),
      deps(broken),
    );
    expect(res.status).toBe(503);
    expect(state.suggestions.size).toBe(0);
  });

  it('never calls the normal insert path for held content', async () => {
    const { store } = seeded();
    let inserts = 0;
    const watched: MyNewsStore = {
      ...store,
      insertSuggestion: async (record) => {
        inserts += 1;
        return store.insertSuggestion(record);
      },
    };
    await handleSuggestRequest(
      post(bodyWith({ diffJson: diffWith([replaceOp(0, 'Base block 0.', HATE_TEXT)]) })),
      deps(watched),
    );
    expect(inserts).toBe(0);
  });
});
