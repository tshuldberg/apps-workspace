import { describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { extractSigningPrivateKeyHex, generateDeviceIdentity } from '@mylife/sync';
import {
  InMemoryCloudAdapter,
  type Draft,
  type NewsroomDraftView,
  type ProfileView,
} from '@mylife/mynews';
import {
  INVITE_REVIEWER_LABEL,
  NEWSROOM_EXPLAINER,
  REVIEWER_ROLE_COPY,
  ROLE_CHIP,
  buildNewsroomDetailModel,
  createNewsroomFlow,
  draftEmbargoLabel,
  inviteMemberFlow,
  loadNewsroomDetail,
  loadNewsroomList,
  loadSaveTargets,
  parseEmbargoInput,
  removeMemberFlow,
  roleNote,
  saveToNewsroomErrorMessage,
  saveToNewsroomFlow,
  setEmbargoFlow,
  validateNewsroomName,
} from '../(root)/lib/newsrooms';

const NOW = '2026-07-04T12:00:00.000Z';

function identity() {
  const id = generateDeviceIdentity('test');
  return { pubkeyHex: id.publicKey, privateKeyHex: extractSigningPrivateKeyHex(id.privateKeyRef) };
}

function profile(overrides: Partial<ProfileView> = {}): ProfileView {
  return {
    id: 'p1',
    userId: 'u1',
    handle: 'rosamarin',
    displayName: 'Rosa Marín',
    pubkeyEd25519: 'pub-rosa',
    kind: 'journalist',
    ...overrides,
  };
}

function seededPort(): InMemoryCloudAdapter {
  const port = new InMemoryCloudAdapter();
  port.profiles = [
    profile(),
    profile({ id: 'p2', userId: 'u2', handle: 'sam', displayName: 'Sam Lee', kind: 'editor' }),
  ];
  port.newsrooms = [
    { id: 'n1', ownerId: 'p1', name: 'Valley Desk', createdAt: '2026-07-01T00:00:00.000Z' },
  ];
  port.newsroomMembers = [
    { newsroomId: 'n1', profileId: 'p1', handle: 'rosamarin', displayName: 'Rosa Marín', role: 'owner' },
  ];
  port.sessionUserId = 'u1';
  return port;
}

function localDraft(overrides: Partial<Draft> = {}): Draft {
  return {
    id: 'd1',
    headline: 'Owens Valley water dispute deepens',
    dek: 'Filings show a 34% drop.',
    bodyMd: 'The valley faces a hard season.',
    kind: 'news',
    updatedAt: NOW,
    ...overrides,
  };
}

/** Records nw_drafts deletes so flows can assert local-draft lifecycle. */
function draftDb(): { db: DatabaseAdapter; deleted: string[] } {
  const deleted: string[] = [];
  const db: DatabaseAdapter = {
    execute(sql: string, params?: unknown[]) {
      if (sql.startsWith('DELETE FROM nw_drafts')) {
        deleted.push(String(params?.[0]));
        return;
      }
      throw new Error(`unexpected execute: ${sql}`);
    },
    query<T>(sql: string): T[] {
      throw new Error(`unexpected query: ${sql}`);
    },
    transaction(fn: () => void) {
      fn();
    },
  };
  return { db, deleted };
}

describe('newsroom name validation', () => {
  it('requires 1-80 characters after trimming', () => {
    expect(validateNewsroomName('')).toEqual({ ok: false, message: 'Give the newsroom a name.' });
    expect(validateNewsroomName('   ')).toEqual({
      ok: false,
      message: 'Give the newsroom a name.',
    });
    expect(validateNewsroomName('  Valley Desk  ')).toEqual({ ok: true, name: 'Valley Desk' });
    expect(validateNewsroomName('x'.repeat(80))).toEqual({ ok: true, name: 'x'.repeat(80) });
    expect(validateNewsroomName('x'.repeat(81))).toEqual({
      ok: false,
      message: 'Newsroom names are at most 80 characters.',
    });
  });
});

describe('reviewer copy rule', () => {
  it('only reviewer rows carry the pre-publication review note', () => {
    expect(roleNote('reviewer')).toBe(REVIEWER_ROLE_COPY);
    expect(roleNote('owner')).toBeNull();
    expect(roleNote('coauthor')).toBeNull();
    expect(REVIEWER_ROLE_COPY).toBe(
      'Invited for pre-publication review · can read + suggest, never publish',
    );
    expect(ROLE_CHIP).toEqual({ owner: 'Owner', coauthor: 'Coauthor', reviewer: 'Reviewer' });
    expect(INVITE_REVIEWER_LABEL).toBe('Invite a Trusted Editor');
    expect(NEWSROOM_EXPLAINER).toContain('never silently escalate to public');
  });
});

describe('list + create', () => {
  it('loadNewsroomList reports no-profile honestly and lists memberships', async () => {
    const port = seededPort();
    port.sessionUserId = null;
    expect(await loadNewsroomList({ port })).toEqual({ status: 'no-profile' });
    port.sessionUserId = 'u1';
    const loaded = await loadNewsroomList({ port });
    expect(loaded.status).toBe('loaded');
    if (loaded.status === 'loaded') {
      expect(loaded.profile.id).toBe('p1');
      expect(loaded.rooms.map((r) => r.name)).toEqual(['Valley Desk']);
    }
  });

  it('createNewsroomFlow validates the name and leaves the creator as owner member', async () => {
    const port = seededPort();
    expect(await createNewsroomFlow({ port, ownerId: 'p1', name: '  ' })).toEqual({
      ok: false,
      message: 'Give the newsroom a name.',
    });
    const res = await createNewsroomFlow({ port, ownerId: 'p1', name: ' Night Desk ' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.newsroom.name).toBe('Night Desk');
      // The create inserts the owner membership row in the same transaction (C6).
      expect(
        port.newsroomMembers.filter((m) => m.newsroomId === res.newsroom.id),
      ).toEqual([
        {
          newsroomId: res.newsroom.id,
          profileId: 'p1',
          handle: 'rosamarin',
          displayName: 'Rosa Marín',
          role: 'owner',
        },
      ]);
      expect(await port.listMyNewsrooms('p1')).toHaveLength(2);
    }
  });

  it('createNewsroomFlow maps signed-out failures to plain copy', async () => {
    const port = seededPort();
    port.sessionUserId = null;
    const res = await createNewsroomFlow({ port, ownerId: 'p1', name: 'Night Desk' });
    expect(res).toEqual({
      ok: false,
      message: 'You are signed out. Create an account from the Me tab first.',
    });
  });
});

describe('detail view model', () => {
  const drafts: NewsroomDraftView[] = [
    {
      articleId: 'a1',
      slug: 'older-piece',
      headline: 'Older piece',
      rev: 1,
      updatedAt: '2026-07-01T00:00:00.000Z',
      embargoUntil: null,
      authorHandle: 'rosamarin',
    },
    {
      articleId: 'a2',
      slug: 'embargoed piece',
      headline: 'Embargoed piece',
      rev: 2,
      updatedAt: '2026-07-03T00:00:00.000Z',
      embargoUntil: '2026-08-01T00:00:00.000Z',
      authorHandle: 'sam',
    },
  ];

  it('builds member rows with role chips, reviewer notes, and owner-only removal', () => {
    const model = buildNewsroomDetailModel({
      newsroom: { id: 'n1', ownerId: 'p1', name: 'Valley Desk', createdAt: NOW },
      members: [
        { newsroomId: 'n1', profileId: 'p3', handle: 'zed', displayName: 'Zed', role: 'reviewer' },
        { newsroomId: 'n1', profileId: 'p1', handle: 'rosamarin', displayName: 'Rosa Marín', role: 'owner' },
        { newsroomId: 'n1', profileId: 'p2', handle: 'sam', displayName: 'Sam Lee', role: 'coauthor' },
      ],
      drafts: [],
      myProfile: { id: 'p1', handle: 'rosamarin' },
    });
    expect(model.isOwner).toBe(true);
    expect(model.canLeave).toBe(false);
    expect(model.members.map((m) => m.chip)).toEqual(['Owner', 'Coauthor', 'Reviewer']);
    expect(model.members.map((m) => m.note)).toEqual([null, null, REVIEWER_ROLE_COPY]);
    // The owner can remove others, never their own membership row.
    expect(model.members.map((m) => m.canRemove)).toEqual([false, true, true]);
  });

  it('non-owner members can leave and cannot remove anyone', () => {
    const model = buildNewsroomDetailModel({
      newsroom: { id: 'n1', ownerId: 'p1', name: 'Valley Desk', createdAt: NOW },
      members: [
        { newsroomId: 'n1', profileId: 'p1', handle: 'rosamarin', displayName: 'Rosa Marín', role: 'owner' },
        { newsroomId: 'n1', profileId: 'p2', handle: 'sam', displayName: 'Sam Lee', role: 'coauthor' },
      ],
      drafts: [],
      myProfile: { id: 'p2', handle: 'sam' },
    });
    expect(model.isOwner).toBe(false);
    expect(model.canLeave).toBe(true);
    expect(model.members.every((m) => !m.canRemove)).toBe(true);
  });

  it('builds draft rows newest first with embargo labels, open paths, and author-only embargo', () => {
    const model = buildNewsroomDetailModel({
      newsroom: { id: 'n1', ownerId: 'p1', name: 'Valley Desk', createdAt: NOW },
      members: [],
      drafts,
      myProfile: { id: 'p1', handle: 'rosamarin' },
    });
    expect(model.drafts.map((d) => d.draft.articleId)).toEqual(['a2', 'a1']);
    expect(model.drafts[0]?.embargoLabel).toBe('[embargo 2026-08-01]');
    expect(model.drafts[1]?.embargoLabel).toBeNull();
    expect(model.drafts[0]?.openPath).toBe('/(root)/article/embargoed%20piece?articleId=a2');
    // Only the draft's author sees "Set embargo".
    expect(model.drafts.map((d) => d.canSetEmbargo)).toEqual([false, true]);
    expect(draftEmbargoLabel('2026-12-24T00:00:00.000Z')).toBe('[embargo 2026-12-24]');
    expect(draftEmbargoLabel(null)).toBeNull();
  });

  it('loadNewsroomDetail reports no-profile and not-found honestly', async () => {
    const port = seededPort();
    port.sessionUserId = null;
    expect(await loadNewsroomDetail({ port, id: 'n1' })).toEqual({ status: 'no-profile' });
    port.sessionUserId = 'u1';
    expect(await loadNewsroomDetail({ port, id: 'missing' })).toEqual({ status: 'not-found' });
    const loaded = await loadNewsroomDetail({ port, id: 'n1' });
    expect(loaded.status).toBe('loaded');
    if (loaded.status === 'loaded') {
      expect(loaded.model.newsroom.name).toBe('Valley Desk');
      expect(loaded.model.isOwner).toBe(true);
    }
  });
});

describe('membership flows', () => {
  it('inviteMemberFlow maps unknown handles inline and strips the sigil', async () => {
    const port = seededPort();
    expect(
      await inviteMemberFlow({ port, newsroomId: 'n1', handle: 'ghost', role: 'reviewer', invitedBy: 'p1' }),
    ).toEqual({ ok: false, message: 'No profile has the handle @ghost.' });
    expect(
      await inviteMemberFlow({ port, newsroomId: 'n1', handle: '  ', role: 'reviewer', invitedBy: 'p1' }),
    ).toEqual({ ok: false, message: 'Enter a handle to invite.' });
    expect(
      await inviteMemberFlow({ port, newsroomId: 'n1', handle: '@Sam', role: 'reviewer', invitedBy: 'p1' }),
    ).toEqual({ ok: true });
    expect(port.newsroomMembers).toContainEqual({
      newsroomId: 'n1',
      profileId: 'p2',
      handle: 'sam',
      displayName: 'Sam Lee',
      role: 'reviewer',
    });
  });

  it('removeMemberFlow removes a member and backs the leave action', async () => {
    const port = seededPort();
    port.newsroomMembers.push({
      newsroomId: 'n1',
      profileId: 'p2',
      handle: 'sam',
      displayName: 'Sam Lee',
      role: 'coauthor',
    });
    expect(await removeMemberFlow({ port, newsroomId: 'n1', profileId: 'p2' })).toEqual({
      ok: true,
    });
    expect(port.newsroomMembers.some((m) => m.profileId === 'p2')).toBe(false);
  });
});

describe('embargo dates', () => {
  it('parseEmbargoInput enforces YYYY-MM-DD, real dates, and empty-clears', () => {
    expect(parseEmbargoInput('')).toEqual({ ok: true, embargoUntil: null });
    expect(parseEmbargoInput('   ')).toEqual({ ok: true, embargoUntil: null });
    expect(parseEmbargoInput('2026-08-01')).toEqual({
      ok: true,
      embargoUntil: '2026-08-01T00:00:00.000Z',
    });
    expect(parseEmbargoInput('Aug 1')).toEqual({
      ok: false,
      message: 'Use YYYY-MM-DD, or leave empty to clear the embargo.',
    });
    expect(parseEmbargoInput('2026-8-1')).toEqual({
      ok: false,
      message: 'Use YYYY-MM-DD, or leave empty to clear the embargo.',
    });
    expect(parseEmbargoInput('2026-02-30')).toEqual({
      ok: false,
      message: 'That is not a real calendar date.',
    });
  });

  it('setEmbargoFlow signs and writes through the port, never calling it on invalid input', async () => {
    const port = seededPort();
    const id = identity();
    expect(await setEmbargoFlow({ port, identity: id, articleId: 'a1', raw: 'nope' })).toEqual({
      ok: false,
      message: 'Use YYYY-MM-DD, or leave empty to clear the embargo.',
    });
    expect(port.articleMeta).toEqual([]);

    expect(
      await setEmbargoFlow({ port, identity: id, articleId: 'a1', raw: '2026-08-01' }),
    ).toEqual({ ok: true, embargoUntil: '2026-08-01T00:00:00.000Z' });
    // A signed full-meta row is persisted (not a bare embargo field).
    expect(port.articleMeta).toHaveLength(1);
    expect(port.articleMeta[0]).toMatchObject({
      articleId: 'a1',
      embargoUntil: '2026-08-01T00:00:00.000Z',
      signerPubkey: id.pubkeyHex,
    });
    expect((port.articleMeta[0]?.signature ?? '').length).toBeGreaterThan(0);

    // Clearing reads-modifies-signs the existing meta, keeping the other fields.
    expect(await setEmbargoFlow({ port, identity: id, articleId: 'a1', raw: '' })).toEqual({
      ok: true,
      embargoUntil: null,
    });
    expect(port.articleMeta).toHaveLength(1);
    expect(port.articleMeta[0]?.embargoUntil).toBeNull();
  });

  it('setEmbargoFlow refuses to write without a loaded signing identity', async () => {
    const port = seededPort();
    expect(await setEmbargoFlow({ port, identity: null, articleId: 'a1', raw: '2026-08-01' })).toEqual(
      { ok: false, message: 'Your signing key is still loading. Try again in a moment.' },
    );
    expect(port.articleMeta).toEqual([]);
  });
});

describe('save to newsroom', () => {
  it('loadSaveTargets is empty without a profile and lists memberships with one', async () => {
    const port = seededPort();
    port.sessionUserId = null;
    expect(await loadSaveTargets({ port })).toEqual([]);
    port.sessionUserId = 'u2';
    expect(await loadSaveTargets({ port })).toEqual([]);
    port.sessionUserId = 'u1';
    expect((await loadSaveTargets({ port })).map((r) => r.id)).toEqual(['n1']);
  });

  it('ships the C4 draft form and deletes the local draft only on success', async () => {
    const port = seededPort();
    const author = identity();
    let captured: Record<string, unknown> | null = null;
    port.functionHandler = (name, body) => {
      expect(name).toBe('mynews-publish');
      captured = (body as { article: Record<string, unknown> }).article;
      return {
        ok: true,
        data: { articleId: 'a-new', rev: 1, slug: 'owens-valley-water-dispute-deepens' },
      };
    };
    const { db, deleted } = draftDb();
    const res = await saveToNewsroomFlow({
      db,
      port,
      identity: author,
      draft: localDraft(),
      articleId: 'a-new',
      newsroomId: 'n1',
      nowIso: NOW,
    });
    expect(res).toEqual({
      ok: true,
      articleId: 'a-new',
      slug: 'owens-valley-water-dispute-deepens',
    });
    expect(captured).toEqual({
      id: 'a-new',
      slug: 'owens-valley-water-dispute-deepens',
      kind: 'news',
      authorPubkey: author.pubkeyHex,
      newsroomId: 'n1',
      draft: true,
    });
    expect(deleted).toEqual(['d1']);
  });

  it('maps not-newsroom-member honestly and keeps the local draft', async () => {
    const port = seededPort();
    port.functionHandler = () => ({ ok: false, error: 'not-newsroom-member' });
    const { db, deleted } = draftDb();
    const res = await saveToNewsroomFlow({
      db,
      port,
      identity: identity(),
      draft: localDraft(),
      articleId: 'a-new',
      newsroomId: 'n1',
      nowIso: NOW,
    });
    expect(res).toEqual({
      ok: false,
      message: 'Saving a draft here needs an owner or coauthor role in this newsroom.',
    });
    expect(deleted).toEqual([]);
    expect(saveToNewsroomErrorMessage('network')).toBe(
      'Could not reach the MyNews server. Check your connection and try again.',
    );
  });
});
