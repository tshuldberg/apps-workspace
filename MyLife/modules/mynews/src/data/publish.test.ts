import { extractSigningPrivateKeyHex, generateDeviceIdentity } from '@mylife/sync';
import { describe, expect, it } from 'vitest';
import { verifyRevisionSignature, verifySuggestionSignature } from '../signing/sign';
import type { SignableRevision } from '../signing/canonical';
import { InMemoryCloudAdapter } from './cloud';
import type { Draft } from './drafts';
import { publishDraft, slugify, submitSuggestion } from './publish';

const NOW = '2026-07-03T12:00:00.000Z';

function identity() {
  const id = generateDeviceIdentity('test');
  return { pubkeyHex: id.publicKey, privateKeyHex: extractSigningPrivateKeyHex(id.privateKeyRef) };
}

const draft: Draft = {
  id: 'd1',
  headline: 'Owens Valley water dispute deepens',
  dek: 'Filings show a 34% drop.',
  bodyMd: 'The valley faces a hard season.',
  kind: 'news',
  updatedAt: NOW,
};

describe('slugify', () => {
  it('handles unicode, punctuation, and length bounds', () => {
    expect(slugify('Owens Valley: water dispute deepens!')).toBe(
      'owens-valley-water-dispute-deepens',
    );
    expect(slugify('Café résumé — naïve')).toBe('cafe-resume-naive');
    expect(slugify('a')).toBe('axx');
    expect(slugify('X'.repeat(300))).toHaveLength(120);
    expect(slugify('--hello--world--')).toBe('hello-world');
  });
});

describe('publishDraft', () => {
  it('signs a verifiable revision and returns the server result', async () => {
    const port = new InMemoryCloudAdapter();
    const author = identity();
    let received: { revision: SignableRevision; signatureHex: string } | null = null;
    port.functionHandler = (name, body) => {
      expect(name).toBe('mynews-publish');
      received = body as never;
      return { ok: true, data: { articleId: 'a1', rev: 1, slug: 'owens-valley-water-dispute-deepens' } };
    };

    const res = await publishDraft({
      draft,
      articleId: 'a1',
      rev: 1,
      identity: author,
      port,
      nowIso: NOW,
    });
    expect(res).toEqual({
      ok: true,
      articleId: 'a1',
      rev: 1,
      slug: 'owens-valley-water-dispute-deepens',
    });
    expect(received).not.toBeNull();
    expect(verifyRevisionSignature(received!.revision, received!.signatureHex)).toBe(true);
    expect(received!.revision.signerPubkey).toBe(author.pubkeyHex);
  });

  it('maps validation, server-code, and network failures honestly', async () => {
    const port = new InMemoryCloudAdapter();
    const author = identity();

    const invalid = await publishDraft({
      draft: { ...draft, headline: null },
      articleId: 'a1',
      rev: 1,
      identity: author,
      port,
      nowIso: NOW,
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.code).toBe('validation');

    port.functionHandler = () => ({ ok: false, error: 'rev-conflict' });
    const conflict = await publishDraft({
      draft,
      articleId: 'a1',
      rev: 1,
      identity: author,
      port,
      nowIso: NOW,
    });
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) expect(conflict.code).toBe('rev-conflict');

    port.callFunction = async () => {
      throw new Error('offline');
    };
    const offline = await publishDraft({
      draft,
      articleId: 'a1',
      rev: 1,
      identity: author,
      port,
      nowIso: NOW,
    });
    expect(offline.ok).toBe(false);
    if (!offline.ok) expect(offline.code).toBe('network');
  });

  it('omits the C4 draft and newsroom fields by default (P1 envelope unchanged)', async () => {
    const port = new InMemoryCloudAdapter();
    let article: Record<string, unknown> | null = null;
    port.functionHandler = (_name, body) => {
      article = (body as { article: Record<string, unknown> }).article;
      return { ok: true, data: { articleId: 'a1', rev: 1, slug: 's' } };
    };
    await publishDraft({ draft, articleId: 'a1', rev: 1, identity: identity(), port, nowIso: NOW });
    expect(Object.keys(article!)).toEqual(['id', 'slug', 'kind', 'authorPubkey']);
  });

  it('carries newsroomId and draft into the C4 article object when saving a newsroom draft', async () => {
    const port = new InMemoryCloudAdapter();
    const author = identity();
    let article: Record<string, unknown> | null = null;
    port.functionHandler = (_name, body) => {
      article = (body as { article: Record<string, unknown> }).article;
      return { ok: true, data: { articleId: 'a1', rev: 1, slug: 'owens-valley-water-dispute-deepens' } };
    };
    const res = await publishDraft({
      draft,
      articleId: 'a1',
      rev: 1,
      identity: author,
      port,
      nowIso: NOW,
      newsroomId: 'n1',
      asDraft: true,
    });
    expect(res.ok).toBe(true);
    expect(article).toEqual({
      id: 'a1',
      slug: 'owens-valley-water-dispute-deepens',
      kind: 'news',
      authorPubkey: author.pubkeyHex,
      newsroomId: 'n1',
      draft: true,
    });
  });

  it('surfaces the server no-profile rejection as its own typed code', async () => {
    const port = new InMemoryCloudAdapter();
    port.functionHandler = () => ({
      ok: false,
      error: 'no-profile',
      detail: 'register a profile before publishing',
    });
    const rejected = await publishDraft({
      draft,
      articleId: 'a1',
      rev: 1,
      identity: identity(),
      port,
      nowIso: NOW,
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.code).toBe('no-profile');
      expect(rejected.detail).toBe('register a profile before publishing');
    }
  });

  it('maps not-newsroom-member as its own code and bad-payload to validation', async () => {
    const port = new InMemoryCloudAdapter();
    const author = identity();
    port.functionHandler = () => ({ ok: false, error: 'not-newsroom-member' });
    const denied = await publishDraft({
      draft,
      articleId: 'a1',
      rev: 1,
      identity: author,
      port,
      nowIso: NOW,
      newsroomId: 'n1',
      asDraft: true,
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe('not-newsroom-member');

    port.functionHandler = () => ({ ok: false, error: 'bad-payload', detail: 'invalid slug' });
    const malformed = await publishDraft({
      draft,
      articleId: 'a1',
      rev: 1,
      identity: author,
      port,
      nowIso: NOW,
    });
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) {
      expect(malformed.code).toBe('validation');
      expect(malformed.detail).toBe('invalid slug');
    }
  });
});

describe('submitSuggestion', () => {
  const signable = {
    articleId: 'a1',
    baseRev: 1,
    type: 'correction' as const,
    diffJson: '{"baseHash":"deadbeef","ops":[]}',
    citations: ['https://inyowater.org/filings/2026-03'],
    rationale: 'Filing year is 2026.',
    editorPubkey: '',
  };

  it('signs a verifiable suggestion envelope', async () => {
    const port = new InMemoryCloudAdapter();
    const editor = identity();
    let received: { suggestion: Record<string, unknown>; signatureHex: string } | null = null;
    port.functionHandler = (_name, body) => {
      received = body as never;
      return { ok: true, data: { suggestionId: 's1' } };
    };
    const res = await submitSuggestion({
      suggestionId: 's1',
      signable: { ...signable, editorPubkey: editor.pubkeyHex },
      identity: editor,
      port,
      nowIso: NOW,
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.collapsed).toBeUndefined();
    expect(
      verifySuggestionSignature(
        { ...signable, editorPubkey: editor.pubkeyHex },
        received!.signatureHex,
      ),
    ).toBe(true);
  });

  it('passes the C4 collapsed flag through with the original suggestion id', async () => {
    const port = new InMemoryCloudAdapter();
    const editor = identity();
    port.functionHandler = () => ({
      ok: true,
      data: { suggestionId: 's-original', collapsed: true },
    });
    const res = await submitSuggestion({
      suggestionId: 's-mine',
      signable: { ...signable, editorPubkey: editor.pubkeyHex },
      identity: editor,
      port,
      nowIso: NOW,
    });
    expect(res).toEqual({ ok: true, suggestionId: 's-original', collapsed: true });
  });

  it('rejects citation-free corrections client-side', async () => {
    const port = new InMemoryCloudAdapter();
    const editor = identity();
    const res = await submitSuggestion({
      suggestionId: 's2',
      signable: { ...signable, citations: [], editorPubkey: editor.pubkeyHex },
      identity: editor,
      port,
      nowIso: NOW,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('validation');
  });
});
