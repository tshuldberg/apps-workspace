import { describe, expect, it } from 'vitest';
import {
  deleteDraft,
  draftToSignableRevision,
  getDraft,
  listDrafts,
  upsertDraft,
} from './drafts';
import { createTestDb } from './test-db';

const NOW = '2026-07-03T12:00:00.000Z';

describe('drafts CRUD', () => {
  it('round-trips create, update, list, delete', () => {
    const db = createTestDb();
    upsertDraft(db, { id: 'd1', headline: 'H1', dek: null, bodyMd: 'Body', kind: 'news' }, NOW);
    upsertDraft(
      db,
      { id: 'd2', headline: null, dek: null, bodyMd: '', kind: 'preprint' },
      '2026-07-03T13:00:00.000Z',
    );

    expect(listDrafts(db).map((d) => d.id)).toEqual(['d2', 'd1']);
    expect(getDraft(db, 'd1')?.headline).toBe('H1');

    upsertDraft(db, { id: 'd1', headline: 'H1b', dek: 'D', bodyMd: 'Body2', kind: 'news' }, NOW);
    expect(getDraft(db, 'd1')?.headline).toBe('H1b');
    expect(listDrafts(db)).toHaveLength(2);

    deleteDraft(db, 'd1');
    expect(getDraft(db, 'd1')).toBeNull();
  });
});

describe('draftToSignableRevision', () => {
  const draft = {
    id: 'd1',
    headline: '  Owens Valley update  ',
    dek: '',
    bodyMd: 'Body text.',
    kind: 'news' as const,
    updatedAt: NOW,
  };

  it('shapes and trims the signable revision', () => {
    const rev = draftToSignableRevision({
      draft,
      articleId: 'a1',
      rev: 1,
      changelog: [],
      createdAt: NOW,
      signerPubkey: 'pub1',
    });
    expect(rev.headline).toBe('Owens Valley update');
    expect(rev.dek).toBeUndefined();
    expect(rev.rev).toBe(1);
  });

  it('refuses to publish without a headline or body', () => {
    expect(() =>
      draftToSignableRevision({
        draft: { ...draft, headline: null },
        articleId: 'a1',
        rev: 1,
        changelog: [],
        createdAt: NOW,
        signerPubkey: 'pub1',
      }),
    ).toThrow(/headline/);
    expect(() =>
      draftToSignableRevision({
        draft: { ...draft, bodyMd: '   ' },
        articleId: 'a1',
        rev: 1,
        changelog: [],
        createdAt: NOW,
        signerPubkey: 'pub1',
      }),
    ).toThrow(/empty/);
  });
});
