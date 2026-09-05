import { extractSigningPrivateKeyHex, generateDeviceIdentity } from '@mylife/sync';
import { describe, expect, it } from 'vitest';
import { computeDiff, hashText } from '../engines/diff';
import type { SignableRevision } from '../signing/canonical';
import { verifyRejectSignature, verifyRevisionSignature } from '../signing/sign';
import { InMemoryCloudAdapter, type ArticleView, type SuggestionView } from './cloud';
import {
  acceptBatch,
  acceptSuggestion,
  headlineDoc,
  rejectSuggestion,
  splitHeadlineDoc,
} from './review';

const NOW = '2026-07-03T12:00:00.000Z';
const BODY = 'Alpha block.\n\nBeta block.\n\nGamma block.';
const EDITOR_PUBKEY = 'ed-pubkey-hex';

function identity() {
  const id = generateDeviceIdentity('test');
  return { pubkeyHex: id.publicKey, privateKeyHex: extractSigningPrivateKeyHex(id.privateKeyRef) };
}

function article(over: Partial<ArticleView> = {}): ArticleView {
  return {
    articleId: 'a1',
    slug: 'owens-valley',
    headline: 'Owens Valley water dispute deepens',
    dek: 'Filings show a 34% drop.',
    kind: 'news',
    rev: 3,
    publishedAt: NOW,
    authorHandle: 'rosamarin',
    authorDisplayName: 'Rosa Marín',
    authorPubkey: 'author-pub',
    authorTier: 'open',
    status: 'published',
    bodyMd: BODY,
    signature: 'sig',
    signerPubkey: 'author-pub',
    createdAt: NOW,
    revisionSummaries: [],
    ...over,
  };
}

function suggestion(over: Partial<SuggestionView> = {}): SuggestionView {
  return {
    id: 's1',
    articleId: 'a1',
    articleSlug: 'owens-valley',
    articleHeadline: 'Owens Valley water dispute deepens',
    baseRev: 3,
    editorId: 'ed1',
    editorHandle: 'sam',
    editorDisplayName: 'Sam Lee',
    editorPubkey: EDITOR_PUBKEY,
    type: 'correction',
    diff: computeDiff(BODY, BODY.replace('Beta block.', 'Beta block, corrected.')),
    citations: ['https://example.com/source'],
    rationale: 'The figure is wrong.',
    status: 'open',
    createdAt: NOW,
    endorsements: 0,
    ...over,
  };
}

interface Captured {
  name: string;
  body: {
    suggestionId?: string;
    suggestionIds?: string[];
    decision: string;
    revision?: SignableRevision;
    signatureHex?: string;
    note?: string;
  };
}

function capturingPort(result: { ok: true; data: unknown } | { ok: false; error: string; detail?: string }) {
  const calls: Captured[] = [];
  const port = new InMemoryCloudAdapter();
  port.functionHandler = (name, body) => {
    calls.push({ name, body: body as Captured['body'] });
    return result as never;
  };
  return { port, calls };
}

describe('headlineDoc / splitHeadlineDoc', () => {
  it('round-trips headline with and without a dek', () => {
    expect(headlineDoc('H', 'D')).toBe('H\n\nD');
    expect(headlineDoc('H', null)).toBe('H');
    expect(headlineDoc('H', undefined)).toBe('H');
    expect(splitHeadlineDoc('H\n\nD')).toEqual({ headline: 'H', dek: 'D' });
    expect(splitHeadlineDoc('H')).toEqual({ headline: 'H', dek: null });
  });

  it('preserves a dek containing blank lines through a round-trip', () => {
    expect(splitHeadlineDoc(headlineDoc('H', 'para one\n\npara two'))).toEqual({
      headline: 'H',
      dek: 'para one\n\npara two',
    });
  });
});

describe('acceptSuggestion', () => {
  it('accepts: applies the diff, signs a verifiable revision, ships the single envelope form', async () => {
    const author = identity();
    const { port, calls } = capturingPort({ ok: true, data: { suggestionId: 's1', decision: 'accept', rev: 4 } });

    const res = await acceptSuggestion({
      suggestion: suggestion(),
      article: article(),
      identity: author,
      port,
      nowIso: NOW,
    });

    expect(res).toEqual({ ok: true, rev: 4 });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.name).toBe('mynews-review');
    const body = calls[0]!.body;
    expect(body.suggestionId).toBe('s1');
    expect(body.suggestionIds).toBeUndefined();
    expect(body.decision).toBe('accept');
    expect(body.revision).toMatchObject({
      articleId: 'a1',
      rev: 4,
      headline: 'Owens Valley water dispute deepens',
      dek: 'Filings show a 34% drop.',
      bodyMd: 'Alpha block.\n\nBeta block, corrected.\n\nGamma block.',
      changelog: [{ suggestionId: 's1', editorKey: EDITOR_PUBKEY, type: 'correction' }],
      createdAt: NOW,
      signerPubkey: author.pubkeyHex,
    });
    expect(verifyRevisionSignature(body.revision!, body.signatureHex!)).toBe(true);
  });

  it('headline type: diff applies to the headline pseudo-document, body stays the head body', async () => {
    const author = identity();
    const head = article();
    const doc = headlineDoc(head.headline, head.dek);
    const sug = suggestion({
      type: 'headline',
      diff: computeDiff(doc, headlineDoc('Owens Valley dispute reaches court', head.dek)),
      citations: [],
    });
    const { port, calls } = capturingPort({ ok: true, data: { rev: 4 } });

    const res = await acceptSuggestion({ suggestion: sug, article: head, identity: author, port, nowIso: NOW });

    expect(res.ok).toBe(true);
    const rev = calls[0]!.body.revision!;
    expect(rev.headline).toBe('Owens Valley dispute reaches court');
    expect(rev.dek).toBe(head.dek);
    expect(rev.bodyMd).toBe(BODY);
    expect(rev.changelog).toEqual([{ suggestionId: 's1', editorKey: EDITOR_PUBKEY, type: 'headline' }]);
    expect(verifyRevisionSignature(rev, calls[0]!.body.signatureHex!)).toBe(true);
  });

  it('headline type: a diff removing the dek yields no dek on the revision', async () => {
    const author = identity();
    const head = article();
    const doc = headlineDoc(head.headline, head.dek);
    const sug = suggestion({ type: 'headline', diff: computeDiff(doc, 'Tighter headline'), citations: [] });
    const { port, calls } = capturingPort({ ok: true, data: { rev: 4 } });

    const res = await acceptSuggestion({ suggestion: sug, article: head, identity: author, port, nowIso: NOW });

    expect(res.ok).toBe(true);
    const rev = calls[0]!.body.revision!;
    expect(rev.headline).toBe('Tighter headline');
    expect(rev.dek).toBeUndefined();
    expect(rev.bodyMd).toBe(BODY);
  });

  it('headline type: an article dek containing a blank line survives acceptance intact', async () => {
    const author = identity();
    const dek = 'Dek line one.\n\nDek line two.';
    const head = article({ dek });
    const doc = headlineDoc(head.headline, dek);
    const sug = suggestion({
      type: 'headline',
      diff: computeDiff(doc, headlineDoc('Sharper headline', dek)),
      citations: [],
    });
    const { port, calls } = capturingPort({ ok: true, data: { rev: 4 } });

    const res = await acceptSuggestion({ suggestion: sug, article: head, identity: author, port, nowIso: NOW });

    expect(res).toEqual({ ok: true, rev: 4 });
    const rev = calls[0]!.body.revision!;
    expect(rev.headline).toBe('Sharper headline');
    expect(rev.dek).toBe(dek);
    expect(rev.bodyMd).toBe(BODY);
    expect(verifyRevisionSignature(rev, calls[0]!.body.signatureHex!)).toBe(true);
  });

  it('counter-edit body: decision partial carries the author-approved text', async () => {
    const author = identity();
    const { port, calls } = capturingPort({ ok: true, data: { rev: 4 } });

    const res = await acceptSuggestion({
      suggestion: suggestion(),
      article: article(),
      identity: author,
      port,
      nowIso: NOW,
      editedBodyMd: 'Alpha block.\n\nBeta block, author-tightened.\n\nGamma block.',
    });

    expect(res).toEqual({ ok: true, rev: 4 });
    const body = calls[0]!.body;
    expect(body.decision).toBe('partial');
    expect(body.revision!.bodyMd).toBe('Alpha block.\n\nBeta block, author-tightened.\n\nGamma block.');
    expect(body.revision!.headline).toBe('Owens Valley water dispute deepens');
    expect(verifyRevisionSignature(body.revision!, body.signatureHex!)).toBe(true);
  });

  it('counter-edit headline: editedHeadline/editedDek drive a partial decision', async () => {
    const author = identity();
    const head = article();
    const doc = headlineDoc(head.headline, head.dek);
    const sug = suggestion({ type: 'headline', diff: computeDiff(doc, headlineDoc('Proposed', head.dek)), citations: [] });
    const { port, calls } = capturingPort({ ok: true, data: { rev: 4 } });

    const res = await acceptSuggestion({
      suggestion: sug,
      article: head,
      identity: author,
      port,
      nowIso: NOW,
      editedHeadline: 'Author-chosen headline',
      editedDek: null,
    });

    expect(res.ok).toBe(true);
    const body = calls[0]!.body;
    expect(body.decision).toBe('partial');
    expect(body.revision!.headline).toBe('Author-chosen headline');
    expect(body.revision!.dek).toBeUndefined();
    expect(body.revision!.bodyMd).toBe(BODY);
  });

  it('fails closed when editedBodyMd is supplied for a headline suggestion', async () => {
    const author = identity();
    const head = article();
    const doc = headlineDoc(head.headline, head.dek);
    const sug = suggestion({
      type: 'headline',
      diff: computeDiff(doc, headlineDoc('Proposed headline', head.dek)),
      citations: [],
    });
    const { port, calls } = capturingPort({ ok: true, data: { rev: 4 } });

    const res = await acceptSuggestion({
      suggestion: sug,
      article: head,
      identity: author,
      port,
      nowIso: NOW,
      editedBodyMd: 'Tampered body.',
    });

    expect(res).toEqual({
      ok: false,
      code: 'validation',
      detail: 'counter-edit fields do not match suggestion type',
    });
    expect(calls).toHaveLength(0);
  });

  it('fails closed when editedHeadline or editedDek is supplied for a body suggestion', async () => {
    const author = identity();
    const { port, calls } = capturingPort({ ok: true, data: { rev: 4 } });

    const viaHeadline = await acceptSuggestion({
      suggestion: suggestion(),
      article: article(),
      identity: author,
      port,
      nowIso: NOW,
      editedHeadline: 'Not allowed on a correction',
    });
    expect(viaHeadline).toEqual({
      ok: false,
      code: 'validation',
      detail: 'counter-edit fields do not match suggestion type',
    });

    const viaDek = await acceptSuggestion({
      suggestion: suggestion(),
      article: article(),
      identity: author,
      port,
      nowIso: NOW,
      editedDek: null,
    });
    expect(viaDek).toEqual({
      ok: false,
      code: 'validation',
      detail: 'counter-edit fields do not match suggestion type',
    });
    expect(calls).toHaveLength(0);
  });

  it('base-mismatch: rebases onto the moved head and proceeds', async () => {
    const author = identity();
    const oldBody = 'Alpha block.\n\nBeta block.\n\nGamma block.';
    const head = article({ bodyMd: `Intro block.\n\n${oldBody}`, rev: 5 });
    const sug = suggestion({
      baseRev: 3,
      diff: computeDiff(oldBody, 'Alpha block.\n\nBeta block, corrected.\n\nGamma block.'),
    });
    const { port, calls } = capturingPort({ ok: true, data: { rev: 6 } });

    const res = await acceptSuggestion({ suggestion: sug, article: head, identity: author, port, nowIso: NOW });

    expect(res).toEqual({ ok: true, rev: 6 });
    const rev = calls[0]!.body.revision!;
    expect(rev.rev).toBe(6);
    expect(rev.bodyMd).toBe('Intro block.\n\nAlpha block.\n\nBeta block, corrected.\n\nGamma block.');
    expect(verifyRevisionSignature(rev, calls[0]!.body.signatureHex!)).toBe(true);
  });

  it('base-mismatch with an unrelocatable diff reports stale and never calls the port', async () => {
    const author = identity();
    const head = article({ bodyMd: 'Alpha block.\n\nGamma block.', rev: 5 });
    const { port, calls } = capturingPort({ ok: true, data: { rev: 6 } });

    const res = await acceptSuggestion({
      suggestion: suggestion({ baseRev: 3 }),
      article: head,
      identity: author,
      port,
      nowIso: NOW,
    });

    expect(res).toEqual({ ok: false, code: 'stale' });
    expect(calls).toHaveLength(0);
  });

  it('headline type: rebases the pseudo-doc diff when the headline moved since baseRev', async () => {
    const author = identity();
    // The suggestion improved the dek against the old headline; the author has
    // since retitled. The dek run is unique in the new pseudo-doc, so rebase
    // relocates it deterministically and acceptance proceeds.
    const sug = suggestion({
      type: 'headline',
      baseRev: 3,
      diff: computeDiff(
        headlineDoc('Old headline', 'Shared dek.'),
        headlineDoc('Old headline', 'Better dek.'),
      ),
      citations: [],
    });
    const head = article({ headline: 'Updated headline', dek: 'Shared dek.', rev: 5 });
    const { port, calls } = capturingPort({ ok: true, data: { rev: 6 } });

    const res = await acceptSuggestion({ suggestion: sug, article: head, identity: author, port, nowIso: NOW });

    expect(res).toEqual({ ok: true, rev: 6 });
    const rev = calls[0]!.body.revision!;
    expect(rev.headline).toBe('Updated headline');
    expect(rev.dek).toBe('Better dek.');
    expect(rev.bodyMd).toBe(BODY);
    expect(verifyRevisionSignature(rev, calls[0]!.body.signatureHex!)).toBe(true);
  });

  it('maps a residual applyDiff failure (out-of-range op, correct baseHash) to validation', async () => {
    const author = identity();
    // Correct baseHash skips the rebase, then the tampered op's baseIndex is
    // beyond the block array: applyDiff reports anchor-missing -> validation.
    const tampered = {
      baseHash: hashText(BODY),
      ops: [
        {
          kind: 'replace' as const,
          baseIndex: 99,
          anchorBefore: null,
          anchorAfter: null,
          baseBlocks: ['Beta block.'],
          newBlocks: ['Tampered block.'],
        },
      ],
    };
    const { port, calls } = capturingPort({ ok: true, data: { rev: 4 } });

    const res = await acceptSuggestion({
      suggestion: suggestion({ diff: tampered }),
      article: article(),
      identity: author,
      port,
      nowIso: NOW,
    });

    expect(res).toEqual({ ok: false, code: 'validation', detail: 'anchor-missing' });
    expect(calls).toHaveLength(0);
  });

  it('maps every server error code, bad-payload to validation, and unknowns with detail', async () => {
    const author = identity();
    const passthrough = [
      'bad-signature',
      'not-author',
      'not-open',
      'rev-conflict',
      'changelog-mismatch',
      'batch-mixed-articles',
      'suspended',
      'terms-not-accepted',
    ] as const;
    for (const code of passthrough) {
      const { port } = capturingPort({ ok: false, error: code });
      const res = await acceptSuggestion({ suggestion: suggestion(), article: article(), identity: author, port, nowIso: NOW });
      expect(res).toEqual({ ok: false, code });
      expect('detail' in res).toBe(false);
    }

    const carried = capturingPort({ ok: false, error: 'not-open', detail: 'review window closed' });
    const carriedRes = await acceptSuggestion({ suggestion: suggestion(), article: article(), identity: author, port: carried.port, nowIso: NOW });
    expect(carriedRes).toEqual({ ok: false, code: 'not-open', detail: 'review window closed' });

    const badPayload = capturingPort({ ok: false, error: 'bad-payload', detail: 'revision article mismatch' });
    const invalid = await acceptSuggestion({ suggestion: suggestion(), article: article(), identity: author, port: badPayload.port, nowIso: NOW });
    expect(invalid).toEqual({ ok: false, code: 'validation', detail: 'revision article mismatch' });

    const weird = capturingPort({ ok: false, error: 'gremlins' });
    const unknown = await acceptSuggestion({ suggestion: suggestion(), article: article(), identity: author, port: weird.port, nowIso: NOW });
    expect(unknown).toEqual({ ok: false, code: 'unknown', detail: 'gremlins' });
  });

  it('maps a thrown port failure to network', async () => {
    const author = identity();
    const port = new InMemoryCloudAdapter();
    port.callFunction = async () => {
      throw new Error('offline');
    };
    const res = await acceptSuggestion({ suggestion: suggestion(), article: article(), identity: author, port, nowIso: NOW });
    expect(res).toEqual({ ok: false, code: 'network', detail: 'offline' });
  });
});

describe('acceptBatch', () => {
  const d1 = () => computeDiff(BODY, BODY.replace('Alpha block.', 'Alpha block, polished.'));
  const d2 = () => computeDiff(BODY, BODY.replace('Gamma block.', 'Gamma block, polished.'));

  it('combines disjoint diffs into one signed revision whose changelog covers every id', async () => {
    const author = identity();
    const suggestions = [
      suggestion({ id: 's1', type: 'copyedit', diff: d1(), citations: [] }),
      suggestion({ id: 's2', type: 'copyedit', diff: d2(), citations: [], editorPubkey: 'other-editor' }),
    ];
    const { port, calls } = capturingPort({ ok: true, data: { rev: 4 } });

    const res = await acceptBatch({ suggestions, article: article(), identity: author, port, nowIso: NOW });

    expect(res).toEqual({ ok: true, rev: 4 });
    const body = calls[0]!.body;
    expect(body.suggestionIds).toEqual(['s1', 's2']);
    expect(body.suggestionId).toBeUndefined();
    expect(body.decision).toBe('accept');
    expect(body.revision!.bodyMd).toBe(
      'Alpha block, polished.\n\nBeta block.\n\nGamma block, polished.',
    );
    expect(body.revision!.changelog).toEqual([
      { suggestionId: 's1', editorKey: EDITOR_PUBKEY, type: 'copyedit' },
      { suggestionId: 's2', editorKey: 'other-editor', type: 'copyedit' },
    ]);
    expect(verifyRevisionSignature(body.revision!, body.signatureHex!)).toBe(true);
  });

  it('bubbles combineDiffs conflicts without calling the port', async () => {
    const author = identity();
    const clash = computeDiff(BODY, BODY.replace('Alpha block.', 'Alpha block, differently.'));
    const suggestions = [
      suggestion({ id: 's1', diff: d1() }),
      suggestion({ id: 's2', diff: clash }),
    ];
    const { port, calls } = capturingPort({ ok: true, data: { rev: 4 } });

    const res = await acceptBatch({ suggestions, article: article(), identity: author, port, nowIso: NOW });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('validation');
      expect(res.conflicts).toEqual([{ baseIndex: 0, diffIndexes: [0, 1] }]);
    }
    expect(calls).toHaveLength(0);
  });

  it('never auto-rebases: any diff off the head hash fails base-mismatch before the port', async () => {
    const author = identity();
    const staleDiff = computeDiff('Old body.', 'Old body, edited.');
    const suggestions = [suggestion({ id: 's1', diff: d1() }), suggestion({ id: 's2', diff: staleDiff })];
    const { port, calls } = capturingPort({ ok: true, data: { rev: 4 } });

    const res = await acceptBatch({ suggestions, article: article(), identity: author, port, nowIso: NOW });

    expect(res).toEqual({ ok: false, code: 'base-mismatch' });
    expect(calls).toHaveLength(0);
    expect(hashText(BODY)).not.toBe(staleDiff.baseHash);
  });

  it('rejects headline suggestions upfront instead of a misleading base-mismatch', async () => {
    const author = identity();
    const head = article();
    const headlineSug = suggestion({
      id: 's2',
      type: 'headline',
      diff: computeDiff(
        headlineDoc(head.headline, head.dek),
        headlineDoc('New headline', head.dek),
      ),
      citations: [],
    });
    const { port, calls } = capturingPort({ ok: true, data: { rev: 4 } });

    const res = await acceptBatch({
      suggestions: [suggestion({ id: 's1', diff: d1() }), headlineSug],
      article: head,
      identity: author,
      port,
      nowIso: NOW,
    });

    expect(res).toEqual({
      ok: false,
      code: 'validation',
      detail: 'batch accept supports body suggestions only',
    });
    expect(calls).toHaveLength(0);
  });

  it('rejects a suggestion for a different article before signing, in single and batch accept', async () => {
    const author = identity();
    const { port, calls } = capturingPort({ ok: true, data: { rev: 4 } });
    const mismatch = {
      ok: false,
      code: 'validation',
      detail: 'suggestion belongs to a different article',
    };

    const single = await acceptSuggestion({
      suggestion: suggestion({ articleId: 'a2' }),
      article: article(),
      identity: author,
      port,
      nowIso: NOW,
    });
    expect(single).toEqual(mismatch);

    const batch = await acceptBatch({
      suggestions: [
        suggestion({ id: 's1', diff: d1() }),
        suggestion({ id: 's2', articleId: 'a2', diff: d2() }),
      ],
      article: article(),
      identity: author,
      port,
      nowIso: NOW,
    });
    expect(batch).toEqual(mismatch);
    expect(calls).toHaveLength(0);
  });

  it('rejects an empty batch as validation and maps server errors and port failures', async () => {
    const author = identity();
    const { port: emptyPort, calls } = capturingPort({ ok: true, data: { rev: 4 } });
    const empty = await acceptBatch({ suggestions: [], article: article(), identity: author, port: emptyPort, nowIso: NOW });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.code).toBe('validation');
    expect(calls).toHaveLength(0);

    const mixed = capturingPort({ ok: false, error: 'batch-mixed-articles' });
    const mixedRes = await acceptBatch({
      suggestions: [suggestion({ id: 's1', diff: d1() })],
      article: article(),
      identity: author,
      port: mixed.port,
      nowIso: NOW,
    });
    expect(mixedRes).toEqual({ ok: false, code: 'batch-mixed-articles' });

    const offline = new InMemoryCloudAdapter();
    offline.callFunction = async () => {
      throw new Error('offline');
    };
    const net = await acceptBatch({
      suggestions: [suggestion({ id: 's1', diff: d1() })],
      article: article(),
      identity: author,
      port: offline,
      nowIso: NOW,
    });
    expect(net).toEqual({ ok: false, code: 'network', detail: 'offline' });
  });
});

describe('rejectSuggestion', () => {
  it('ships an author-signed reject envelope with and without a note (F3)', async () => {
    const author = identity();
    // The author key must be the head author key the server will verify against.
    const art = article({ authorPubkey: author.pubkeyHex, signerPubkey: author.pubkeyHex });
    const sug = suggestion({ articleId: art.articleId, baseRev: 1 });

    const withNote = capturingPort({ ok: true, data: { suggestionId: 's1', decision: 'reject' } });
    const res1 = await rejectSuggestion({
      suggestion: sug,
      article: art,
      identity: author,
      note: 'Cited source contradicts this.',
      port: withNote.port,
    });
    expect(res1).toEqual({ ok: true });
    expect(withNote.calls[0]!.name).toBe('mynews-review');
    const withNoteBody = withNote.calls[0]!.body;
    expect(withNoteBody.suggestionId).toBe('s1');
    expect(withNoteBody.decision).toBe('reject');
    expect(withNoteBody.note).toBe('Cited source contradicts this.');
    expect(typeof withNoteBody.signatureHex).toBe('string');
    // The shipped signature verifies against the head author key over the note.
    expect(
      verifyRejectSignature(
        {
          suggestionId: 's1',
          articleId: art.articleId,
          baseRev: 1,
          note: 'Cited source contradicts this.',
          signerPubkey: author.pubkeyHex,
        },
        withNoteBody.signatureHex!,
      ),
    ).toBe(true);

    const noNote = capturingPort({ ok: true, data: { suggestionId: 's1', decision: 'reject' } });
    const res2 = await rejectSuggestion({
      suggestion: sug,
      article: art,
      identity: author,
      port: noNote.port,
    });
    expect(res2).toEqual({ ok: true });
    const noNoteBody = noNote.calls[0]!.body;
    expect(noNoteBody.suggestionId).toBe('s1');
    expect(noNoteBody.decision).toBe('reject');
    expect('note' in noNoteBody).toBe(false);
    expect(typeof noNoteBody.signatureHex).toBe('string');
    expect(
      verifyRejectSignature(
        { suggestionId: 's1', articleId: art.articleId, baseRev: 1, signerPubkey: author.pubkeyHex },
        noNoteBody.signatureHex!,
      ),
    ).toBe(true);
  });

  it('validates note length and article match client-side, maps failures', async () => {
    const author = identity();
    const art = article({ authorPubkey: author.pubkeyHex, signerPubkey: author.pubkeyHex });
    const sug = suggestion({ articleId: art.articleId });

    const { port, calls } = capturingPort({ ok: true, data: {} });
    const tooLong = await rejectSuggestion({
      suggestion: sug,
      article: art,
      identity: author,
      note: 'x'.repeat(2001),
      port,
    });
    expect(tooLong).toEqual({ ok: false, code: 'validation' });
    expect(calls).toHaveLength(0);

    // A suggestion that belongs to a different article never leaves the client.
    const mismatch = capturingPort({ ok: true, data: {} });
    const wrongArticle = await rejectSuggestion({
      suggestion: suggestion({ articleId: 'a-other' }),
      article: art,
      identity: author,
      port: mismatch.port,
    });
    expect(wrongArticle).toEqual({ ok: false, code: 'validation' });
    expect(mismatch.calls).toHaveLength(0);

    const notOpen = capturingPort({ ok: false, error: 'not-open' });
    expect(
      await rejectSuggestion({ suggestion: sug, article: art, identity: author, port: notOpen.port }),
    ).toEqual({ ok: false, code: 'not-open' });

    // A missing signature on the server surfaces as bad-payload -> validation.
    const badPayload = capturingPort({ ok: false, error: 'bad-payload' });
    expect(
      await rejectSuggestion({
        suggestion: sug,
        article: art,
        identity: author,
        port: badPayload.port,
      }),
    ).toEqual({ ok: false, code: 'validation' });

    const offline = new InMemoryCloudAdapter();
    offline.callFunction = async () => {
      throw new Error('offline');
    };
    expect(
      await rejectSuggestion({ suggestion: sug, article: art, identity: author, port: offline }),
    ).toEqual({ ok: false, code: 'network' });
  });
});
