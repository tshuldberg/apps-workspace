import { describe, expect, it } from 'vitest';
import {
  ArticleRevisionSchema,
  ArticleSchema,
  CredibilityEntrySchema,
  EditSuggestionSchema,
  PledgeSchema,
  SUGGESTION_TYPES,
} from './models';

describe('mynews models', () => {
  it('parses a minimal article + revision', () => {
    const article = ArticleSchema.parse({
      id: 'a1',
      authorKey: 'k1',
      kind: 'news',
      status: 'published',
      currentRev: 1,
      publishedAt: '2026-07-03T00:00:00Z',
    });
    expect(article.kind).toBe('news');
    const rev = ArticleRevisionSchema.parse({
      articleId: 'a1',
      rev: 1,
      headline: 'H',
      bodyMd: 'Body.',
      signature: 'sig',
      signerPubkey: 'k1',
      createdAt: '2026-07-03T00:00:00Z',
      changelog: [],
    });
    expect(rev.rev).toBe(1);
  });

  it('requires citations on corrections but not copyedits', () => {
    const base = {
      id: 's1',
      articleId: 'a1',
      baseRev: 1,
      editorKey: 'e1',
      diff: { baseHash: 'h', ops: [] },
      rationale: 'why',
      status: 'open',
      createdAt: '2026-07-03T00:00:00Z',
    };
    expect(
      EditSuggestionSchema.safeParse({ ...base, type: 'correction', citations: [] }).success,
    ).toBe(false);
    expect(
      EditSuggestionSchema.safeParse({
        ...base,
        type: 'correction',
        citations: ['https://inyowater.org/filings/2026-03'],
      }).success,
    ).toBe(true);
    expect(
      EditSuggestionSchema.safeParse({ ...base, type: 'copyedit', citations: [] }).success,
    ).toBe(true);
  });

  it('rejects non-https citations', () => {
    expect(
      EditSuggestionSchema.safeParse({
        id: 's2',
        articleId: 'a1',
        baseRev: 1,
        editorKey: 'e1',
        type: 'correction',
        diff: { baseHash: 'h', ops: [] },
        citations: ['http://insecure.example'],
        rationale: 'why',
        status: 'open',
        createdAt: '2026-07-03T00:00:00Z',
      }).success,
    ).toBe(false);
  });

  it('pledges are positive integer cents', () => {
    expect(PledgeSchema.safeParse({ journalistId: 'j1', amountCents: 500 }).success).toBe(true);
    expect(PledgeSchema.safeParse({ journalistId: 'j1', amountCents: 0 }).success).toBe(false);
    expect(PledgeSchema.safeParse({ journalistId: 'j1', amountCents: 1.5 }).success).toBe(false);
  });

  it('exposes the six suggestion types', () => {
    expect(SUGGESTION_TYPES).toEqual([
      'correction',
      'context',
      'translation',
      'clarity',
      'headline',
      'copyedit',
    ]);
    expect(
      CredibilityEntrySchema.safeParse({
        type: 'correction',
        acceptedAtMs: 1,
        authorKey: 'k1',
        authorStanding: 0.8,
      }).success,
    ).toBe(true);
  });
});
