import { describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  InMemoryCloudAdapter,
  computeDiff,
  hashText,
  headlineDoc,
  type ArticleView,
  type LedgerRowView,
  type ProfileView,
  type SeededSuggestion,
  type SuggestionEventView,
  type SuggestionType,
  type SuggestionView,
} from '@mylife/mynews';
import {
  buildAcceptPreview,
  buildBatchModel,
  buildEditorRows,
  buildJournalistQueue,
  draftBannerText,
  draftPublishErrorMessage,
  editorSubtitle,
  eventRowText,
  filterBatchEligible,
  getDeskRole,
  loadEditorDesk,
  loadJournalistQueue,
  resolveCounterEdit,
  resolveDraftNewsroomName,
  setDeskRole,
  severityRank,
  suggestionPreviewLine,
} from '../(root)/lib/desk';

const BODY = 'Alpha paragraph.\n\nBeta paragraph.\n\nGamma paragraph.';

function article(overrides: Partial<ArticleView> = {}): ArticleView {
  return {
    articleId: 'a-1',
    slug: 'test-article',
    headline: 'Test headline',
    dek: 'Test dek',
    kind: 'news',
    rev: 2,
    publishedAt: '2026-07-01T00:00:00.000Z',
    authorHandle: 'jane',
    authorDisplayName: 'Jane Doe',
    authorPubkey: 'f'.repeat(64),
    authorTier: 'open',
    status: 'published',
    bodyMd: BODY,
    signature: 'sig',
    signerPubkey: 'f'.repeat(64),
    createdAt: '2026-07-01T00:00:00.000Z',
    revisionSummaries: [],
    ...overrides,
  };
}

let suggestionCounter = 0;

function suggestion(input: {
  type: SuggestionType;
  createdAt: string;
  articleId?: string;
  status?: SuggestionView['status'];
  baseRev?: number;
  diff?: SuggestionView['diff'];
  editorId?: string;
  editorHandle?: string;
  editorDisplayName?: string;
  rationale?: string;
  id?: string;
}): SuggestionView {
  suggestionCounter += 1;
  return {
    id: input.id ?? `s-${suggestionCounter}`,
    articleId: input.articleId ?? 'a-1',
    articleSlug: 'test-article',
    articleHeadline: 'Test headline',
    baseRev: input.baseRev ?? 2,
    editorId: input.editorId ?? 'e-1',
    editorHandle: input.editorHandle ?? 'ed',
    editorDisplayName: input.editorDisplayName ?? 'Ed Editor',
    editorPubkey: 'e'.repeat(64),
    type: input.type,
    diff: input.diff ?? computeDiff(BODY, BODY.replace('Beta', 'Beta!')),
    citations: [],
    rationale: input.rationale ?? 'because',
    status: input.status ?? 'open',
    createdAt: input.createdAt,
    endorsements: 0,
  };
}

function memoryDb(): DatabaseAdapter {
  const settings = new Map<string, string>();
  return {
    execute(sql: string, params?: unknown[]) {
      if (sql.includes('nw_settings')) {
        settings.set(String(params?.[0]), String(params?.[1]));
        return;
      }
      throw new Error(`unexpected execute: ${sql}`);
    },
    query<T>(sql: string, params?: unknown[]): T[] {
      if (sql.includes('nw_settings')) {
        const value = settings.get(String(params?.[0]));
        return (value === undefined ? [] : [{ value }]) as T[];
      }
      throw new Error(`unexpected query: ${sql}`);
    },
    transaction(fn: () => void) {
      fn();
    },
  };
}

describe('desk role persistence', () => {
  it('defaults to editor and persists the chosen role', () => {
    const db = memoryDb();
    expect(getDeskRole(db)).toBe('editor');
    setDeskRole(db, 'journalist');
    expect(getDeskRole(db)).toBe('journalist');
    setDeskRole(db, 'editor');
    expect(getDeskRole(db)).toBe('editor');
  });
});

describe('severityRank + buildJournalistQueue', () => {
  it('ranks correction > context > translation > clarity > headline > copyedit', () => {
    const ranks = (['correction', 'context', 'translation', 'clarity', 'headline', 'copyedit'] as const).map(
      severityRank,
    );
    expect(ranks).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('sorts singles by severity then oldest-first and groups copyedits per article', () => {
    const open = [
      suggestion({ id: 'clarity-new', type: 'clarity', createdAt: '2026-07-02T00:00:00Z' }),
      suggestion({ id: 'copy-1', type: 'copyedit', createdAt: '2026-07-01T05:00:00Z' }),
      suggestion({ id: 'correction-1', type: 'correction', createdAt: '2026-07-03T00:00:00Z' }),
      suggestion({ id: 'clarity-old', type: 'clarity', createdAt: '2026-07-01T00:00:00Z' }),
      suggestion({ id: 'copy-2', type: 'copyedit', createdAt: '2026-07-01T06:00:00Z' }),
      suggestion({
        id: 'copy-other',
        type: 'copyedit',
        articleId: 'a-2',
        createdAt: '2026-07-01T00:00:00Z',
      }),
    ];
    const queue = buildJournalistQueue(open);
    expect(queue.singles.map((s) => s.id)).toEqual(['correction-1', 'clarity-old', 'clarity-new']);
    expect(queue.batches.map((b) => [b.articleId, b.suggestions.length])).toEqual([
      ['a-2', 1],
      ['a-1', 2],
    ]);
    expect(queue.openCount).toBe(6);
    expect(queue.articleCount).toBe(2);
    expect(queue.subtitle).toBe('6 suggestions on 2 articles');
  });
});

describe('suggestionPreviewLine', () => {
  it('prefers the first added text, falls back to rationale, then removal copy', () => {
    const withAdd = suggestion({ type: 'copyedit', createdAt: '2026-07-01T00:00:00Z' });
    expect(suggestionPreviewLine(withAdd)).toBe('Beta! paragraph.');
    const deleteOnly = suggestion({
      type: 'copyedit',
      createdAt: '2026-07-01T00:00:00Z',
      diff: computeDiff(BODY, 'Alpha paragraph.\n\nGamma paragraph.'),
      rationale: 'trim it',
    });
    expect(suggestionPreviewLine(deleteOnly)).toBe('trim it');
    expect(suggestionPreviewLine({ ...deleteOnly, rationale: ' ' })).toBe('Removes text');
  });
});

describe('editorSubtitle', () => {
  it('shows no percent until a decided sample exists', () => {
    expect(editorSubtitle({ acceptanceRate: 0, decidedSampleSize: 0 })).toBe(
      'Your suggestions · no decided sample yet',
    );
    expect(editorSubtitle({ acceptanceRate: 0.666, decidedSampleSize: 3 })).toBe(
      'Your suggestions · 67% acceptance',
    );
  });
});

describe('buildEditorRows', () => {
  const ledgerRow: LedgerRowView = {
    id: 'l-1',
    editorId: 'e-1',
    suggestionId: 'mine-accepted',
    basePoints: 10,
    diversityMult: 0.3,
    standingMult: 0.5,
    awardedAt: '2026-07-02T00:00:00Z',
    type: 'correction',
    authorId: 'p-author',
  };

  it('renders the status chips with rev, points, and reject notes', () => {
    const accepted = suggestion({
      id: 'mine-accepted',
      type: 'correction',
      status: 'accepted',
      createdAt: '2026-07-01T00:00:00Z',
    });
    const rejected = suggestion({
      id: 'mine-rejected',
      type: 'clarity',
      status: 'rejected',
      createdAt: '2026-07-01T00:00:00Z',
    });
    const stale = suggestion({
      id: 'mine-stale',
      type: 'copyedit',
      status: 'stale',
      createdAt: '2026-07-01T00:00:00Z',
    });
    const open = suggestion({
      id: 'mine-open',
      type: 'copyedit',
      status: 'open',
      createdAt: '2026-07-01T00:00:00Z',
    });
    const events = new Map<string, SuggestionEventView[]>([
      [
        'mine-accepted',
        [
          {
            id: 'ev-1',
            suggestionId: 'mine-accepted',
            actorId: 'p-author',
            actorHandle: 'jane',
            action: 'accept',
            payload: { rev: 3 },
            createdAt: '2026-07-02T00:00:00Z',
          },
        ],
      ],
      [
        'mine-rejected',
        [
          {
            id: 'ev-2',
            suggestionId: 'mine-rejected',
            actorId: 'p-author',
            actorHandle: 'jane',
            action: 'reject',
            payload: { note: 'stylistic choice' },
            createdAt: '2026-07-02T00:00:00Z',
          },
        ],
      ],
    ]);
    const rows = buildEditorRows({
      suggestions: [open, accepted, rejected, stale],
      ledger: [ledgerRow],
      eventsBySuggestion: events,
    });
    expect(rows[0]).toMatchObject({ chip: '[open]', detail: null });
    expect(rows[1]).toMatchObject({
      chip: '[accepted -> rev 3]',
      detail: '+1.5 pts · credited in changelog',
    });
    expect(rows[2]).toMatchObject({
      chip: '[rejected with note]',
      detail: "'stylistic choice' No penalty.",
    });
    expect(rows[3]).toMatchObject({ chip: '[stale]', detail: null });
  });

  it('handles a rejection without a note as no-penalty copy', () => {
    const rejected = suggestion({
      id: 'r2',
      type: 'clarity',
      status: 'rejected',
      createdAt: '2026-07-01T00:00:00Z',
    });
    const rows = buildEditorRows({
      suggestions: [rejected],
      ledger: [],
      eventsBySuggestion: new Map(),
    });
    expect(rows[0]).toMatchObject({ chip: '[rejected]', detail: 'No penalty.' });
  });
});

describe('loadEditorDesk + loadJournalistQueue (in-memory port)', () => {
  const me: ProfileView = {
    id: 'p-me',
    userId: 'u-me',
    handle: 'me_editor',
    displayName: 'Me Editor',
    pubkeyEd25519: 'e'.repeat(64),
    kind: 'editor',
  };

  it('loads the editor view model against the port', async () => {
    const port = new InMemoryCloudAdapter();
    port.sessionUserId = 'u-me';
    port.profiles.push(me);
    const mine: SeededSuggestion = {
      ...suggestion({
        id: 's-mine',
        type: 'correction',
        status: 'accepted',
        editorId: 'p-me',
        editorHandle: 'me_editor',
        createdAt: '2026-07-01T00:00:00Z',
      }),
      articleAuthorId: 'p-author',
    };
    port.suggestions.push(mine);
    port.suggestionEvents.push({
      id: 'ev-1',
      suggestionId: 's-mine',
      actorId: 'p-author',
      actorHandle: 'jane',
      action: 'accept',
      payload: { rev: 3 },
      createdAt: '2026-07-02T00:00:00Z',
    });
    port.ledger.push({
      id: 'l-1',
      editorId: 'p-me',
      suggestionId: 's-mine',
      basePoints: 10,
      diversityMult: 0.3,
      standingMult: 0.5,
      awardedAt: '2026-07-02T00:00:00Z',
      type: 'correction',
      authorId: 'p-author',
    });
    const model = await loadEditorDesk({ port, profile: me, nowMs: Date.parse('2026-07-03T00:00:00Z') });
    expect(model.subtitle).toBe('Your suggestions · 100% acceptance');
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0]?.chip).toBe('[accepted -> rev 3]');
    expect(model.credibility?.levelName).toBe('Contributor');
  });

  it('loads the review queue with one editor-level lookup per distinct editor', async () => {
    const port = new InMemoryCloudAdapter();
    port.sessionUserId = 'u-me';
    port.profiles.push(me, {
      id: 'e-1',
      userId: 'u-ed',
      handle: 'ed',
      displayName: 'Ed Editor',
      pubkeyEd25519: 'a'.repeat(64),
      kind: 'editor',
    });
    const openOnMine = (id: string, type: SuggestionType, createdAt: string): SeededSuggestion => ({
      ...suggestion({ id, type, createdAt, editorId: 'e-1', editorHandle: 'ed' }),
      articleAuthorId: 'p-me',
    });
    port.suggestions.push(
      openOnMine('q-1', 'copyedit', '2026-07-01T00:00:00Z'),
      openOnMine('q-2', 'correction', '2026-07-02T00:00:00Z'),
      openOnMine('q-3', 'copyedit', '2026-07-02T01:00:00Z'),
    );
    let profileLookups = 0;
    const realGetEditorProfile = port.getEditorProfile.bind(port);
    port.getEditorProfile = async (handle) => {
      profileLookups += 1;
      return realGetEditorProfile(handle);
    };
    const model = await loadJournalistQueue({
      port,
      profileId: 'p-me',
      nowMs: Date.now(),
    });
    expect(model.queue.singles.map((s) => s.id)).toEqual(['q-2']);
    expect(model.queue.batches[0]?.suggestions.map((s) => s.id)).toEqual(['q-1', 'q-3']);
    expect(model.editorLevels.get('ed')).toBe('Reader');
    expect(profileLookups).toBe(1);
  });

  it('loadJournalistQueue hides a blocked editor from the review queue', async () => {
    const port = new InMemoryCloudAdapter();
    port.sessionUserId = 'u-me';
    port.profiles.push(
      { id: 'p-me', userId: 'u-me', handle: 'me', displayName: 'Me', pubkeyEd25519: 'm'.repeat(64), kind: 'journalist' },
      { id: 'e-1', userId: 'u-ed', handle: 'ed', displayName: 'Ed', pubkeyEd25519: 'a'.repeat(64), kind: 'editor' },
    );
    port.suggestions.push({
      ...suggestion({ id: 'q-1', type: 'copyedit', createdAt: '2026-07-01T00:00:00Z', editorId: 'e-1', editorHandle: 'ed' }),
      articleAuthorId: 'p-me',
    });

    const before = await loadJournalistQueue({ port, profileId: 'p-me', nowMs: Date.now() });
    expect(before.queue.batches.flatMap((b) => b.suggestions).concat(before.queue.singles).map((s) => s.id)).toContain('q-1');

    const after = await loadJournalistQueue({
      port,
      profileId: 'p-me',
      nowMs: Date.now(),
      blocks: [
        {
          id: 'b1',
          blockedProfileId: 'e-1',
          blockedPubkey: 'a'.repeat(64),
          blockedHandle: 'ed',
          blockedDisplayName: 'Ed',
          mode: 'block' as const,
          createdAt: '2026-07-05T00:00:00Z',
        },
      ],
    });
    const remaining = after.queue.batches.flatMap((b) => b.suggestions).concat(after.queue.singles);
    expect(remaining).toHaveLength(0);
  });
});

describe('buildAcceptPreview', () => {
  it('applies a current-rev body diff directly', () => {
    const s = suggestion({ type: 'copyedit', createdAt: '2026-07-01T00:00:00Z' });
    const preview = buildAcceptPreview({ suggestion: s, article: article() });
    expect(preview.status).toBe('current');
    if (preview.status !== 'stale' && preview.applied.kind === 'body') {
      expect(preview.applied.bodyMd).toContain('Beta! paragraph.');
    }
  });

  it('rebases a diff written against an older revision when the paragraph survives', () => {
    const oldBody = 'Intro paragraph.\n\nBeta paragraph.\n\nGamma paragraph.';
    const s = suggestion({
      type: 'copyedit',
      createdAt: '2026-07-01T00:00:00Z',
      baseRev: 1,
      diff: computeDiff(oldBody, oldBody.replace('Beta', 'Beta!')),
    });
    const preview = buildAcceptPreview({ suggestion: s, article: article() });
    expect(preview.status).toBe('rebased');
    if (preview.status !== 'stale' && preview.applied.kind === 'body') {
      expect(preview.applied.bodyMd).toBe(
        'Alpha paragraph.\n\nBeta! paragraph.\n\nGamma paragraph.',
      );
    }
  });

  it('reports stale when the edited paragraph no longer exists', () => {
    const oldBody = 'Removed paragraph.\n\nAnother one.';
    const s = suggestion({
      type: 'copyedit',
      createdAt: '2026-07-01T00:00:00Z',
      baseRev: 1,
      diff: computeDiff(oldBody, oldBody.replace('Removed', 'Kept')),
    });
    expect(buildAcceptPreview({ suggestion: s, article: article() })).toEqual({ status: 'stale' });
  });

  it('previews headline suggestions against the headline pseudo-document', () => {
    const base = headlineDoc('Test headline', 'Test dek');
    const s = suggestion({
      type: 'headline',
      createdAt: '2026-07-01T00:00:00Z',
      diff: computeDiff(base, headlineDoc('Sharper headline', 'Test dek')),
    });
    const preview = buildAcceptPreview({ suggestion: s, article: article() });
    expect(preview.status).toBe('current');
    if (preview.status !== 'stale' && preview.applied.kind === 'headline') {
      expect(preview.applied.headline).toBe('Sharper headline');
      expect(preview.applied.dek).toBe('Test dek');
    }
  });
});

describe('resolveCounterEdit', () => {
  it('downgrades an unchanged counter-edit to a plain accept', () => {
    const s = suggestion({ type: 'copyedit', createdAt: '2026-07-01T00:00:00Z' });
    const preview = buildAcceptPreview({ suggestion: s, article: article() });
    if (preview.status === 'stale') throw new Error('unexpected stale');
    const applied = preview.applied.kind === 'body' ? preview.applied.bodyMd : '';
    expect(resolveCounterEdit({ preview, edited: { bodyMd: applied } })).toEqual({});
    expect(resolveCounterEdit({ preview, edited: { bodyMd: `${applied} more` } })).toEqual({
      editedBodyMd: `${applied} more`,
    });
  });

  it('compares headline and dek for headline suggestions', () => {
    const base = headlineDoc('Test headline', 'Test dek');
    const s = suggestion({
      type: 'headline',
      createdAt: '2026-07-01T00:00:00Z',
      diff: computeDiff(base, headlineDoc('Sharper headline', 'Test dek')),
    });
    const preview = buildAcceptPreview({ suggestion: s, article: article() });
    if (preview.status === 'stale') throw new Error('unexpected stale');
    expect(
      resolveCounterEdit({ preview, edited: { headline: 'Sharper headline', dek: 'Test dek' } }),
    ).toEqual({});
    expect(
      resolveCounterEdit({ preview, edited: { headline: 'Author headline', dek: 'Test dek' } }),
    ).toEqual({ editedHeadline: 'Author headline', editedDek: 'Test dek' });
  });
});

describe('eventRowText', () => {
  const base = {
    id: 'ev',
    suggestionId: 's',
    actorId: 'p',
    actorHandle: 'jane',
    createdAt: '2026-07-02T00:00:00Z',
  };

  it('renders decision events as system rows and comments as null', () => {
    expect(eventRowText({ ...base, action: 'comment', payload: { body: 'hi' } })).toBeNull();
    expect(eventRowText({ ...base, action: 'accept', payload: { rev: 4 } })).toBe(
      'Accepted · published rev 4',
    );
    expect(eventRowText({ ...base, action: 'partial', payload: { rev: 5 } })).toBe(
      'Accepted with author edits · published rev 5',
    );
    expect(eventRowText({ ...base, action: 'reject', payload: { note: 'nope' } })).toBe(
      "Rejected: 'nope'",
    );
    expect(eventRowText({ ...base, action: 'reject', payload: {} })).toBe('Rejected');
    expect(eventRowText({ ...base, action: 'rebase', payload: {} })).toBe(
      'Rebased onto a newer revision',
    );
  });
});

describe('batch copyedit model', () => {
  const head = article();

  it('filters to open copyedits on the current rev and hash only', () => {
    const eligible = suggestion({ id: 'ok', type: 'copyedit', createdAt: '2026-07-01T00:00:00Z' });
    const wrongRev = suggestion({
      id: 'wrong-rev',
      type: 'copyedit',
      baseRev: 1,
      createdAt: '2026-07-01T00:00:00Z',
    });
    const wrongHash = suggestion({
      id: 'wrong-hash',
      type: 'copyedit',
      createdAt: '2026-07-01T00:00:00Z',
      diff: { baseHash: 'deadbeef', ops: [] },
    });
    const notCopyedit = suggestion({
      id: 'not-copyedit',
      type: 'clarity',
      createdAt: '2026-07-01T00:00:00Z',
    });
    const closed = suggestion({
      id: 'closed',
      type: 'copyedit',
      status: 'rejected',
      createdAt: '2026-07-01T00:00:00Z',
    });
    expect(
      filterBatchEligible(head, [eligible, wrongRev, wrongHash, notCopyedit, closed]).map(
        (s) => s.id,
      ),
    ).toEqual(['ok']);
  });

  it('combines included diffs and lists per-editor credits', () => {
    const s1 = suggestion({
      id: 'b-1',
      type: 'copyedit',
      createdAt: '2026-07-01T00:00:00Z',
      editorDisplayName: 'Ed One',
      diff: computeDiff(BODY, BODY.replace('Alpha', 'Alpha!')),
    });
    const s2 = suggestion({
      id: 'b-2',
      type: 'copyedit',
      createdAt: '2026-07-01T01:00:00Z',
      editorDisplayName: 'Ed Two',
      diff: computeDiff(BODY, BODY.replace('Gamma', 'Gamma!')),
    });
    const model = buildBatchModel({
      article: head,
      eligible: [s1, s2],
      includedIds: new Set(['b-1', 'b-2']),
    });
    expect(model.canAccept).toBe(true);
    expect(model.conflicts).toEqual([]);
    expect(model.previewBody).toBe('Alpha! paragraph.\n\nBeta paragraph.\n\nGamma! paragraph.');
    expect(model.creditNames).toEqual(['Ed One', 'Ed Two']);
    expect(model.acceptLabel).toBe('Accept 2 · publish rev 3');
    expect(model.creditsLine).toBe(
      'Accepting creates revision 3. Signed by you. Ed One, Ed Two credited in the public changelog.',
    );
  });

  it('surfaces conflicts as suggestion pairs and blocks accept until one is excluded', () => {
    const s1 = suggestion({
      id: 'c-1',
      type: 'copyedit',
      createdAt: '2026-07-01T00:00:00Z',
      diff: computeDiff(BODY, BODY.replace('Beta paragraph.', 'Beta paragraph, first fix.')),
    });
    const s2 = suggestion({
      id: 'c-2',
      type: 'copyedit',
      createdAt: '2026-07-01T01:00:00Z',
      diff: computeDiff(BODY, BODY.replace('Beta paragraph.', 'Beta paragraph, second fix.')),
    });
    const conflicted = buildBatchModel({
      article: head,
      eligible: [s1, s2],
      includedIds: new Set(['c-1', 'c-2']),
    });
    expect(conflicted.canAccept).toBe(false);
    expect(conflicted.previewBody).toBeNull();
    expect(conflicted.conflicts).toEqual([{ baseIndex: 1, suggestionIds: ['c-1', 'c-2'] }]);
    const resolved = buildBatchModel({
      article: head,
      eligible: [s1, s2],
      includedIds: new Set(['c-1']),
    });
    expect(resolved.canAccept).toBe(true);
    expect(resolved.conflicts).toEqual([]);
    expect(resolved.acceptLabel).toBe('Accept 1 · publish rev 3');
  });

  it('cannot accept an empty batch', () => {
    const model = buildBatchModel({ article: head, eligible: [], includedIds: new Set() });
    expect(model.canAccept).toBe(false);
    expect(model.acceptLabel).toBe('Accept 0 · publish rev 3');
  });
});

describe('draft banner + draft publish errors', () => {
  it('resolves the newsroom name that holds the draft', async () => {
    const port = new InMemoryCloudAdapter();
    port.sessionUserId = 'u-me';
    port.profiles.push({
      id: 'p-me',
      userId: 'u-me',
      handle: 'me',
      displayName: 'Me',
      pubkeyEd25519: 'e'.repeat(64),
      kind: 'journalist',
    });
    const created = await port.createNewsroom({ ownerId: 'p-me', name: 'Metro Desk' });
    if (!created.ok) throw new Error('setup failed');
    port.newsroomDrafts.push({
      newsroomId: created.newsroom.id,
      articleId: 'a-draft',
      slug: 'draft-slug',
      headline: 'Draft headline',
      rev: 1,
      updatedAt: '2026-07-01T00:00:00Z',
      embargoUntil: null,
      authorHandle: 'me',
    });
    expect(
      await resolveDraftNewsroomName({ port, profileId: 'p-me', articleId: 'a-draft' }),
    ).toBe('Metro Desk');
    expect(
      await resolveDraftNewsroomName({ port, profileId: 'p-me', articleId: 'a-unknown' }),
    ).toBeNull();
    expect(draftBannerText('Metro Desk')).toBe('Draft · Metro Desk');
    expect(draftBannerText(null)).toBe('Draft');
  });

  it('maps not-newsroom-member and falls through to publish copy otherwise', () => {
    expect(draftPublishErrorMessage('unknown', 'not-newsroom-member')).toContain(
      'owner or coauthor role',
    );
    expect(draftPublishErrorMessage('not-newsroom-member')).toContain('owner or coauthor role');
    expect(draftPublishErrorMessage('rev-conflict')).toContain('newer revision');
    expect(draftPublishErrorMessage('no-profile')).toContain('Register a handle');
  });
});
