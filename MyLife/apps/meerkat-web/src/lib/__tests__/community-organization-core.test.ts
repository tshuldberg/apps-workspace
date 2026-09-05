// Plan 38 Phase 2 (web): pure organization core.
//
// Pins the four behavioral guarantees the brief requires against the REAL
// shipped @mylife/sync descriptor helpers: a whole channel-manager edit commits
// as exactly ONE descriptor revision (batching), archiving hides a channel but
// preserves it, a legacy descriptor renders as the pre-Plan-38 flat list, and
// per-category unread rollups sum the adjusted per-channel counts.

import { beforeEach, describe, expect, it } from 'vitest';
import {
  channelArchived,
  configureSyncSecretStore,
  createCommunity,
  createInMemorySyncSecretStore,
  generateDeviceIdentity,
  orderedChannels,
  reviseCommunity,
  verifyCommunityDescriptor,
  type DeviceIdentity,
} from '@mylife/sync';
import {
  buildOrgDraft,
  buildSidebarModel,
  draftAddCategory,
  draftAddChannel,
  draftAssignCategory,
  draftDeleteCategory,
  draftMoveChannel,
  draftSetArchived,
  finalizeOrg,
  orderCommunitiesForRail,
} from '../community-organization-core';

let owner: DeviceIdentity;

beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  owner = generateDeviceIdentity('Owner');
});

describe('batching: one reviseCommunity per save', () => {
  it('commits many draft edits as exactly one revision that verifies', () => {
    const signed = createCommunity(owner, { name: 'Space', channels: [{ id: 'general', name: 'general' }] });
    expect(signed.descriptor.revision).toBe(1);

    let draft = buildOrgDraft(signed.descriptor);
    const add1 = draftAddChannel(draft, 'random');
    expect(add1.ok).toBe(true);
    if (add1.ok) draft = add1.draft;
    const add2 = draftAddChannel(draft, 'photos');
    if (add2.ok) draft = add2.draft;
    const cat = draftAddCategory(draft, 'Fun', 'cat-fun');
    if (cat.ok) draft = cat.draft;
    draft = draftAssignCategory(draft, 'random', 'cat-fun');
    draft = draftAssignCategory(draft, 'photos', 'cat-fun');
    draft = draftMoveChannel(draft, 'photos', 'up');

    const finalized = finalizeOrg(draft);
    const revised = reviseCommunity(
      owner,
      signed,
      { channels: finalized.channels, categories: finalized.categories },
    );

    // ONE revision for the whole batch, and it chains + verifies against genesis.
    expect(revised.descriptor.revision).toBe(2);
    expect(verifyCommunityDescriptor(revised, signed)).toBe(true);
    expect(revised.descriptor.channels.map((c) => c.id).sort()).toEqual(['general', 'photos', 'random']);
    expect(revised.descriptor.categories).toEqual([{ id: 'cat-fun', name: 'Fun', order: 0 }]);
  });
});

describe('archive hides but preserves', () => {
  it('keeps the archived channel in the descriptor but out of the active list', () => {
    const signed = createCommunity(owner, {
      name: 'Space',
      channels: [{ id: 'general', name: 'general' }, { id: 'old', name: 'old' }],
    });
    let draft = buildOrgDraft(signed.descriptor);
    draft = draftSetArchived(draft, 'old', true);
    const finalized = finalizeOrg(draft);
    const revised = reviseCommunity(owner, signed, finalized);

    // Still present in the signed descriptor (never deleted)...
    expect(revised.descriptor.channels.map((c) => c.id).sort()).toEqual(['general', 'old']);
    expect(channelArchived(revised.descriptor.channels.find((c) => c.id === 'old')!)).toBe(true);
    // ...but excluded from the active (non-archived) presentation list.
    expect(orderedChannels(revised.descriptor).map((c) => c.id)).toEqual(['general']);

    const model = buildSidebarModel(revised.descriptor, {});
    expect(model.groups[0].channels.map((c) => c.id)).toEqual(['general']);
    expect(model.archived.map((c) => c.id)).toEqual(['old']);
  });

  it('deleting a category unassigns its channels, never deletes them', () => {
    const signed = createCommunity(owner, {
      name: 'Space',
      channels: [{ id: 'general', name: 'general' }],
      categories: [{ id: 'cat-x', name: 'X', order: 0 }],
    });
    let draft = buildOrgDraft(signed.descriptor);
    draft = draftAssignCategory(draft, 'general', 'cat-x');
    draft = draftDeleteCategory(draft, 'cat-x');
    const finalized = finalizeOrg(draft);
    expect(finalized.categories).toEqual([]);
    expect(finalized.channels.map((c) => c.id)).toEqual(['general']);
    expect(finalized.channels[0].categoryId).toBeUndefined();
  });
});

describe('legacy render unchanged', () => {
  it('a legacy descriptor yields one flat uncategorized group and no archived', () => {
    const signed = createCommunity(owner, {
      name: 'Old',
      channels: [
        { id: 'a', name: 'a' },
        { id: 'b', name: 'b' },
        { id: 'c', name: 'c' },
      ],
    });
    const model = buildSidebarModel(signed.descriptor, {});
    expect(model.groups).toHaveLength(1);
    expect(model.groups[0].category).toBeNull();
    expect(model.groups[0].channels.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(model.archived).toEqual([]);
  });

  it('the rail with no prefs is a single ungrouped group in default order', () => {
    const groups = orderCommunitiesForRail(['x', 'y', 'z'], {});
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('ungrouped');
    expect(groups[0].communityIds).toEqual(['x', 'y', 'z']);
  });
});

describe('unread rollups', () => {
  it('sums the adjusted per-channel counts per category group', () => {
    const signed = createCommunity(owner, {
      name: 'Space',
      channels: [
        { id: 'ch1', name: 'ch1' },
        { id: 'ch2', name: 'ch2', categoryId: 'cat1', order: 0 },
        { id: 'ch3', name: 'ch3', categoryId: 'cat1', order: 1 },
      ],
      categories: [{ id: 'cat1', name: 'Group', order: 0 }],
    });
    const model = buildSidebarModel(signed.descriptor, { ch1: 1, ch2: 2, ch3: 4 });
    const uncategorized = model.groups.find((g) => g.category === null)!;
    const category = model.groups.find((g) => g.category?.id === 'cat1')!;
    expect(uncategorized.unread).toBe(1);
    expect(category.unread).toBe(6);
  });
});

describe('rail ordering from prefs', () => {
  it('pins float to the top and folders group', () => {
    const groups = orderCommunitiesForRail(['a', 'b', 'c', 'd'], {
      a: { communityId: 'a', pinned: true, sortIndex: null, folder: null },
      c: { communityId: 'c', pinned: false, sortIndex: null, folder: 'Family' },
      d: { communityId: 'd', pinned: false, sortIndex: null, folder: 'Family' },
    });
    expect(groups[0]).toEqual({ kind: 'pinned', folder: null, communityIds: ['a'] });
    const folder = groups.find((g) => g.kind === 'folder');
    expect(folder?.folder).toBe('Family');
    expect(folder?.communityIds).toEqual(['c', 'd']);
    const ungrouped = groups.find((g) => g.kind === 'ungrouped');
    expect(ungrouped?.communityIds).toEqual(['b']);
  });
});
