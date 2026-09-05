// Plan 38 Phase 2 (Track A) organization core.
//
// Covers: the W2 fix (creating a channel folds into a signed, verifiable
// descriptor revision), one-revision-per-save batching (many draft edits => a
// single reviseCommunity bump), archive hides-but-preserves, legacy descriptors
// render exactly as before, per-device prefs round trip, and the per-category /
// per-section unread math.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  createCommunity,
  createSyncTables,
  generateDeviceIdentity,
  getCommunity,
  listCommunities,
  communityCategories,
  reviseCommunity,
  upsertCommunity,
  verifyCommunityDescriptor,
  type DeviceIdentity,
  type SignedCommunityDescriptor,
} from '@mylife/sync';
import * as sync from '@mylife/sync';
import {
  ensureMeerkatTables,
  getCommunityPrefs,
  listCommunityPrefs,
  setCommunityPrefs,
} from '../(root)/data/db';
import {
  addCategoryToDraft,
  addChannelToDraft,
  buildCommunitySections,
  buildOrganizationChanges,
  deleteCategoryFromDraft,
  draftFromDescriptor,
  groupChannelsForDisplay,
  groupUnreadCount,
  setChannelArchivedInDraft,
  setChannelCategoryInDraft,
  setChannelTopicInDraft,
  slugifyChannelName,
  type CommunityPrefs,
  type OrganizationDraft,
} from '../(root)/data/community-org-core';
import { storeOwnedCommunity } from '../(root)/data/community-core';

let db: InMemoryTestDatabase;
let owner: DeviceIdentity;
let communityId: string;

beforeEach(() => {
  db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  ensureMeerkatTables(db.adapter);
  owner = generateDeviceIdentity('Owner');
  const signed = createCommunity(owner, {
    name: 'Trail Cooks',
    channels: [
      { id: 'general', name: 'general' },
      { id: 'announcements', name: 'announcements', postRoles: ['owner', 'admin'] },
    ],
    now: '2026-07-05T09:00:00.000Z',
  });
  storeOwnedCommunity(db.adapter, owner, signed);
  communityId = signed.descriptor.communityId;
});

afterEach(() => {
  vi.restoreAllMocks();
  db.close();
});

// The provider's saveCommunityOrganization logic, exercised directly so the test
// verifies the real revision path (getCommunity -> reviseCommunity -> upsert).
function save(draft: OrganizationDraft): SignedCommunityDescriptor {
  const stored = getCommunity(db.adapter, communityId);
  if (!stored) throw new Error('missing community');
  const revised = reviseCommunity(
    owner,
    { descriptor: stored.descriptor, signature: stored.signature },
    buildOrganizationChanges(draft),
  );
  upsertCommunity(db.adapter, revised, owner.publicKey);
  return revised;
}

describe('W2 fix: creating a channel produces a signed, verifiable revision', () => {
  it('adds a channel to the draft and saves it as a chained, owner-signed revision', () => {
    const before = getCommunity(db.adapter, communityId)!;
    expect(before.descriptor.channels.map((c) => c.id)).toEqual(['general', 'announcements']);

    const added = addChannelToDraft(draftFromDescriptor(before.descriptor), 'Camp Recipes');
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.channelId).toBe('camp-recipes');

    const revised = save(added.draft);

    // A real chained revision the owner signature verifies against the predecessor.
    expect(revised.descriptor.revision).toBe(2);
    expect(
      verifyCommunityDescriptor(revised, { descriptor: before.descriptor, signature: before.signature }),
    ).toBe(true);

    const after = getCommunity(db.adapter, communityId)!;
    const ids = after.descriptor.channels.map((c) => c.id);
    expect(ids).toContain('camp-recipes');
    // The pre-existing channels and their postRoles are preserved.
    expect(after.descriptor.channels.find((c) => c.id === 'announcements')?.postRoles).toEqual(['owner', 'admin']);
  });

  it('rejects an empty or duplicate channel name', () => {
    const draft = draftFromDescriptor(getCommunity(db.adapter, communityId)!.descriptor);
    expect(addChannelToDraft(draft, '   ')).toEqual({ ok: false, error: 'Enter a channel name.' });
    expect(addChannelToDraft(draft, 'General')).toEqual({ ok: false, error: 'A channel with that name already exists.' });
  });
});

describe('one-revision-per-save batching', () => {
  it('folds many draft edits into exactly ONE reviseCommunity call and one revision bump', () => {
    const spy = vi.spyOn(sync, 'reviseCommunity');
    const before = getCommunity(db.adapter, communityId)!;

    // A pile of edits on the local draft: add channel, add category, assign,
    // rename topic, archive another -- none of them touch the descriptor yet.
    let draft = draftFromDescriptor(before.descriptor);
    const cat = addCategoryToDraft(draft, 'Kitchen');
    expect(cat.ok).toBe(true);
    if (!cat.ok) return;
    draft = cat.draft;
    const added = addChannelToDraft(draft, 'Sauces');
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    draft = added.draft;
    draft = setChannelCategoryInDraft(draft, 'sauces', cat.categoryId);
    draft = setChannelCategoryInDraft(draft, 'general', cat.categoryId);
    draft = setChannelTopicInDraft(draft, 'general', 'Say hi here');
    draft = setChannelArchivedInDraft(draft, 'announcements', true);

    expect(spy).not.toHaveBeenCalled(); // editing the draft never signs

    save(draft);

    expect(spy).toHaveBeenCalledTimes(1); // ONE signed revision for the whole save
    const after = getCommunity(db.adapter, communityId)!;
    expect(after.descriptor.revision).toBe(before.descriptor.revision + 1); // one bump

    // Every batched edit landed in that single revision.
    expect(communityCategories(after.descriptor).map((c) => c.name)).toEqual(['Kitchen']);
    expect(after.descriptor.channels.find((c) => c.id === 'general')?.topic).toBe('Say hi here');
    expect(after.descriptor.channels.find((c) => c.id === 'sauces')?.categoryId).toBe(cat.categoryId);
    expect(after.descriptor.channels.find((c) => c.id === 'announcements')?.archived).toBe(true);
  });
});

describe('archive hides but preserves', () => {
  it('an archived channel drops out of the default list but stays in the descriptor', () => {
    let draft = draftFromDescriptor(getCommunity(db.adapter, communityId)!.descriptor);
    draft = setChannelArchivedInDraft(draft, 'announcements', true);
    save(draft);

    const d = getCommunity(db.adapter, communityId)!.descriptor;
    // Still present (never deleted).
    expect(d.channels.map((c) => c.id)).toContain('announcements');

    const display = groupChannelsForDisplay(d);
    const visibleIds = display.groups.flatMap((g) => g.channels.map((c) => c.id));
    expect(visibleIds).not.toContain('announcements'); // hidden from default list
    expect(display.archived.map((c) => c.id)).toEqual(['announcements']); // shown in the archived group
  });

  it('unarchiving restores it to the default list', () => {
    let draft = draftFromDescriptor(getCommunity(db.adapter, communityId)!.descriptor);
    draft = setChannelArchivedInDraft(draft, 'announcements', true);
    save(draft);
    draft = setChannelArchivedInDraft(draftFromDescriptor(getCommunity(db.adapter, communityId)!.descriptor), 'announcements', false);
    save(draft);

    const display = groupChannelsForDisplay(getCommunity(db.adapter, communityId)!.descriptor);
    expect(display.archived).toEqual([]);
    expect(display.groups.flatMap((g) => g.channels.map((c) => c.id))).toContain('announcements');
  });
});

describe('legacy descriptors render exactly as before', () => {
  it('a descriptor with no categories/order collapses to one header-less group in descriptor order', () => {
    // The seeded community is legacy-shaped (no categories, no order fields).
    const d = getCommunity(db.adapter, communityId)!.descriptor;
    const display = groupChannelsForDisplay(d);
    expect(display.hasCategories).toBe(false);
    expect(display.groups).toHaveLength(1);
    expect(display.groups[0].category).toBeNull();
    expect(display.groups[0].channels.map((c) => c.id)).toEqual(['general', 'announcements']);
    expect(display.archived).toEqual([]);
  });
});

describe('deleteCategory unassigns its channels but never deletes them', () => {
  it('removes the category and moves its channels to uncategorized', () => {
    let draft = draftFromDescriptor(getCommunity(db.adapter, communityId)!.descriptor);
    const cat = addCategoryToDraft(draft, 'Kitchen');
    if (!cat.ok) throw new Error('add category failed');
    draft = setChannelCategoryInDraft(cat.draft, 'general', cat.categoryId);
    draft = deleteCategoryFromDraft(draft, cat.categoryId);

    expect(draft.categories).toEqual([]);
    const general = draft.channels.find((c) => c.id === 'general');
    expect(general).toBeDefined();
    expect(general?.categoryId).toBeUndefined();

    // And a save keeps all channels.
    save(draft);
    const d = getCommunity(db.adapter, communityId)!.descriptor;
    expect(d.channels.map((c) => c.id).sort()).toEqual(['announcements', 'general']);
    expect(communityCategories(d)).toEqual([]);
  });
});

describe('mk_community_prefs round trip (device-local)', () => {
  it('defaults to null, then persists pin/sortIndex/folder independently', () => {
    expect(getCommunityPrefs(db.adapter, communityId)).toBeNull();

    setCommunityPrefs(db.adapter, communityId, { pinned: true });
    expect(getCommunityPrefs(db.adapter, communityId)).toEqual({
      communityId,
      pinned: true,
      sortIndex: null,
      folder: null,
    });

    // A partial update keeps the untouched fields.
    setCommunityPrefs(db.adapter, communityId, { folder: '  Family  ', sortIndex: 3 });
    expect(getCommunityPrefs(db.adapter, communityId)).toEqual({
      communityId,
      pinned: true,
      sortIndex: 3,
      folder: 'Family', // trimmed
    });

    // Clearing the folder writes null.
    setCommunityPrefs(db.adapter, communityId, { folder: null });
    expect(getCommunityPrefs(db.adapter, communityId)?.folder).toBeNull();

    const all = listCommunityPrefs(db.adapter);
    expect(all[communityId]?.pinned).toBe(true);
  });
});

describe('buildCommunitySections (per-device ordering)', () => {
  function makeThree(): void {
    // The beforeEach community is #1; add two more.
    for (const name of ['Book Club', 'Family']) {
      const signed = createCommunity(owner, { name, channels: [{ id: 'general', name: 'general' }], now: '2026-07-05T09:00:00.000Z' });
      storeOwnedCommunity(db.adapter, owner, signed);
    }
  }

  it('floats pinned to the top, groups folders alphabetically, then ungrouped', () => {
    makeThree();
    const communities = listCommunities(db.adapter);
    const [c1, c2, c3] = communities;

    const prefs: Record<string, CommunityPrefs> = {
      [c1.communityId]: { communityId: c1.communityId, pinned: true, sortIndex: null, folder: null },
      [c2.communityId]: { communityId: c2.communityId, pinned: false, sortIndex: 0, folder: 'Zeta' },
      [c3.communityId]: { communityId: c3.communityId, pinned: false, sortIndex: 0, folder: 'Alpha' },
    };

    const sections = buildCommunitySections(communities, prefs);
    expect(sections.map((s) => s.kind)).toEqual(['pinned', 'folder', 'folder']);
    expect(sections[0].communities.map((c) => c.communityId)).toEqual([c1.communityId]);
    expect(sections[1].folder).toBe('Alpha');
    expect(sections[1].communities.map((c) => c.communityId)).toEqual([c3.communityId]);
    expect(sections[2].folder).toBe('Zeta');
  });

  it('orders within a section by sortIndex, unset sorts last', () => {
    makeThree();
    const communities = listCommunities(db.adapter);
    const [c1, c2, c3] = communities;
    const prefs: Record<string, CommunityPrefs> = {
      [c1.communityId]: { communityId: c1.communityId, pinned: false, sortIndex: 5, folder: null },
      [c2.communityId]: { communityId: c2.communityId, pinned: false, sortIndex: 1, folder: null },
      // c3 has no prefs -> sortIndex null -> sorts last
    };
    const sections = buildCommunitySections(communities, prefs);
    expect(sections).toHaveLength(1);
    expect(sections[0].kind).toBe('ungrouped');
    expect(sections[0].communities.map((c) => c.communityId)).toEqual([c2.communityId, c1.communityId, c3.communityId]);
  });
});

describe('unread rollup math', () => {
  it('sums a group\'s channels and excludes muted ones', () => {
    const channels = [{ id: 'general', name: 'general' }, { id: 'sauces', name: 'sauces' }, { id: 'off', name: 'off' }];
    const unread = { general: 3, sauces: 4, off: 9 };
    expect(groupUnreadCount(channels, unread)).toBe(16);
    expect(groupUnreadCount(channels, unread, new Set(['off']))).toBe(7);
    expect(groupUnreadCount(channels, {})).toBe(0);
  });
});

describe('slugifyChannelName mirrors the web slug', () => {
  it('lowercases, collapses non-alphanumerics to hyphens, and trims', () => {
    expect(slugifyChannelName('  Camp  Recipes!! ')).toBe('camp-recipes');
    expect(slugifyChannelName('###')).toBe('');
    expect(slugifyChannelName('general')).toBe('general');
  });
});

describe('buildOrganizationChanges canonical shape', () => {
  it('stamps positional order and renumbers categories 0..n', () => {
    let draft = draftFromDescriptor(getCommunity(db.adapter, communityId)!.descriptor);
    const cat = addCategoryToDraft(draft, 'Kitchen');
    if (!cat.ok) throw new Error('add failed');
    draft = cat.draft;
    const changes = buildOrganizationChanges(draft);
    expect(changes.channels?.map((c) => c.order)).toEqual([0, 1]);
    expect(changes.categories?.[0].order).toBe(0);
  });

  it('drops a channel categoryId that references no surviving category', () => {
    let draft = draftFromDescriptor(getCommunity(db.adapter, communityId)!.descriptor);
    // Force a dangling categoryId (defense in depth).
    draft = { ...draft, channels: draft.channels.map((c) => (c.id === 'general' ? { ...c, categoryId: 'ghost' } : c)) };
    const changes = buildOrganizationChanges(draft);
    expect(changes.channels?.find((c) => c.id === 'general')?.categoryId).toBeUndefined();
  });
});
