/**
 * Community descriptor gossip, P1 (Plan 28): a newer verified revision applies;
 * older / replayed / forged / unknown-community records are dropped fail-closed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  applyGossipedDescriptors,
  collectDescriptorRecords,
  configureSyncSecretStore,
  createCommunity,
  createInMemorySyncSecretStore,
  createSyncTables,
  generateDeviceIdentity,
  getCommunity,
  removeMemberRevision,
  reviseCommunity,
  upsertCommunity,
  type SignedCommunityDescriptor,
} from '../index';
import {
  addWorkspaceMember,
  createWorkspace,
  getWorkspaceMembers,
} from '../db/queries';

const NOW = '2026-07-02T00:00:00.000Z';
type Identity = ReturnType<typeof generateDeviceIdentity>;
const asMember = (id: Identity) => ({ deviceId: id.publicKey, role: 'member' as const, dhPublicKey: id.dhPublicKey });

let db: InMemoryTestDatabase;
beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
});
afterEach(() => db.close());

function foundedWith(owner: Identity, members: Identity[]) {
  return createCommunity(owner, { name: 'Surf Club', channels: [], members: members.map(asMember) });
}

describe('applyGossipedDescriptors', () => {
  it('applies a strictly newer, verified revision to a known community', () => {
    const owner = generateDeviceIdentity('Owner');
    const a = generateDeviceIdentity('Ann');
    const c = generateDeviceIdentity('Cal');
    const community = foundedWith(owner, [a, c]);
    upsertCommunity(db.adapter, community, a.publicKey, NOW); // A holds rev 1

    const rev2 = removeMemberRevision(owner, community, c.publicKey, NOW);
    const applied = applyGossipedDescriptors(db.adapter, [rev2], a.publicKey, NOW);

    expect(applied).toBe(1);
    const stored = getCommunity(db.adapter, community.descriptor.communityId)!;
    expect(stored.descriptor.revision).toBe(2);
    expect(stored.descriptor.members.some((m) => m.deviceId === c.publicKey)).toBe(false);
  });

  it('rejects an older / replayed revision (monotonic)', () => {
    const owner = generateDeviceIdentity('Owner');
    const a = generateDeviceIdentity('Ann');
    const c = generateDeviceIdentity('Cal');
    const community = foundedWith(owner, [a, c]);
    const rev2 = removeMemberRevision(owner, community, c.publicKey, NOW);
    upsertCommunity(db.adapter, rev2, a.publicKey, NOW); // A already at rev 2

    // Replaying rev 1 must not reopen C's membership.
    const applied = applyGossipedDescriptors(db.adapter, [community], a.publicKey, NOW);
    expect(applied).toBe(0);
    expect(getCommunity(db.adapter, community.descriptor.communityId)!.descriptor.revision).toBe(2);
  });

  it('rejects a forged revision (owner signature no longer covers it)', () => {
    const owner = generateDeviceIdentity('Owner');
    const a = generateDeviceIdentity('Ann');
    const c = generateDeviceIdentity('Cal');
    const community = foundedWith(owner, [a, c]);
    upsertCommunity(db.adapter, community, a.publicKey, NOW);

    const rev2 = removeMemberRevision(owner, community, c.publicKey, NOW);
    // Tamper AFTER signing: re-add C to the members list.
    const forged: SignedCommunityDescriptor = {
      ...rev2,
      descriptor: { ...rev2.descriptor, members: [...rev2.descriptor.members, asMember(c)] },
    };
    const applied = applyGossipedDescriptors(db.adapter, [forged], a.publicKey, NOW);
    expect(applied).toBe(0);
    expect(getCommunity(db.adapter, community.descriptor.communityId)!.descriptor.revision).toBe(1);
  });

  it('ignores a record for a community this device does not hold', () => {
    const owner = generateDeviceIdentity('Owner');
    const other = foundedWith(owner, []);
    const applied = applyGossipedDescriptors(db.adapter, [other], generateDeviceIdentity('Me').publicKey, NOW);
    expect(applied).toBe(0);
    expect(getCommunity(db.adapter, other.descriptor.communityId)).toBeNull();
  });
});

/**
 * Item 7 / AM7: a gossiped descriptor revision must reconcile the workspace
 * roster (sync_workspace_members) exactly like the member-removal drain does,
 * so a removal that arrives via the gossip backfill flips the session-auth gate
 * (removed_at) on this device instead of leaving the removed row open.
 */
describe('applyGossipedDescriptors roster reconciliation (Item 7 / AM7)', () => {
  /** Mirror the app's stored community on one device: descriptor + workspace + roster. */
  function storeWithRoster(me: Identity, signed: SignedCommunityDescriptor): void {
    const d = signed.descriptor;
    upsertCommunity(db.adapter, signed, me.publicKey, NOW);
    createWorkspace(db.adapter, {
      id: d.communityId,
      displayName: d.name,
      workspaceType: 'community',
      createdByDeviceId: d.ownerDeviceId,
      createdAt: NOW,
      rotatedAt: null,
      currentKeyVersion: 0,
      archivedAt: null,
    });
    for (const member of d.members) {
      addWorkspaceMember(db.adapter, {
        workspaceId: d.communityId,
        deviceId: member.deviceId,
        role: member.role,
        invitedByDeviceId: d.ownerDeviceId,
        invitedAt: NOW,
        removedAt: null,
      });
    }
  }
  const activeIds = (communityId: string) =>
    getWorkspaceMembers(db.adapter, communityId).map((m) => m.deviceId);

  it('closes the removed PEER row when a gossiped revision drops it', () => {
    const owner = generateDeviceIdentity('Owner');
    const a = generateDeviceIdentity('Ann');
    const c = generateDeviceIdentity('Cal');
    const community = foundedWith(owner, [a, c]);
    storeWithRoster(a, community); // A holds rev 1, roster lists all three

    const rev2 = removeMemberRevision(owner, community, c.publicKey, NOW);
    expect(applyGossipedDescriptors(db.adapter, [rev2], a.publicKey, NOW)).toBe(1);

    const active = activeIds(community.descriptor.communityId);
    expect(active).not.toContain(c.publicKey); // session-auth gate now refuses C
    expect(active).toContain(a.publicKey);
    expect(active).toContain(owner.publicKey);
  });

  it('closes MY OWN roster row when a gossiped revision removes this device', () => {
    const owner = generateDeviceIdentity('Owner');
    const a = generateDeviceIdentity('Ann');
    const community = foundedWith(owner, [a]);
    storeWithRoster(a, community);

    // The owner removed A; A learns it via the gossip backfill.
    const rev2 = removeMemberRevision(owner, community, a.publicKey, NOW);
    expect(applyGossipedDescriptors(db.adapter, [rev2], a.publicKey, NOW)).toBe(1);
    expect(activeIds(community.descriptor.communityId)).not.toContain(a.publicKey);
  });

  it('syncs a member ROLE change through gossip', () => {
    const owner = generateDeviceIdentity('Owner');
    const a = generateDeviceIdentity('Ann');
    const community = foundedWith(owner, [a]);
    storeWithRoster(a, community);

    // Owner promotes A to admin.
    const promoted = community.descriptor.members.map((m) =>
      m.deviceId === a.publicKey ? { ...m, role: 'admin' as const } : m,
    );
    const rev2 = reviseCommunity(owner, community, { members: promoted }, NOW);
    expect(applyGossipedDescriptors(db.adapter, [rev2], a.publicKey, NOW)).toBe(1);

    const row = getWorkspaceMembers(db.adapter, community.descriptor.communityId)
      .find((m) => m.deviceId === a.publicKey);
    expect(row?.role).toBe('admin');
  });

  it('REOPENS a re-added member row when a later gossiped revision re-lists it', () => {
    const owner = generateDeviceIdentity('Owner');
    const a = generateDeviceIdentity('Ann');
    const c = generateDeviceIdentity('Cal');
    const community = foundedWith(owner, [a, c]);
    storeWithRoster(a, community);

    const rev2 = removeMemberRevision(owner, community, c.publicKey, NOW);
    expect(applyGossipedDescriptors(db.adapter, [rev2], a.publicKey, NOW)).toBe(1);
    expect(activeIds(community.descriptor.communityId)).not.toContain(c.publicKey);

    // Owner re-adds C in a still-newer revision.
    const rev3 = reviseCommunity(owner, rev2, {
      members: [...rev2.descriptor.members, asMember(c)],
    }, NOW);
    expect(applyGossipedDescriptors(db.adapter, [rev3], a.publicKey, NOW)).toBe(1);
    expect(activeIds(community.descriptor.communityId)).toContain(c.publicKey);
  });
});

describe('collectDescriptorRecords', () => {
  it('returns the current signed descriptor of every held community', () => {
    const owner = generateDeviceIdentity('Owner');
    const a = generateDeviceIdentity('Ann');
    const community = foundedWith(owner, [a]);
    upsertCommunity(db.adapter, community, a.publicKey, NOW);

    const records = collectDescriptorRecords(db.adapter);
    expect(records).toHaveLength(1);
    expect(records[0]!.descriptor.communityId).toBe(community.descriptor.communityId);
    expect(records[0]!.signature).toBe(community.signature);
  });
});

/**
 * Privacy filter (roster leak fix): gossiping a descriptor to a peer discloses
 * that community's full member roster, so the SEND is restricted to communities
 * the peer is a CURRENT member of. Non-members drop them on apply anyway, so the
 * filter loses no convergence; it only stops leaking membership metadata.
 */
describe('collectDescriptorRecords peer-membership filter', () => {
  it('includes a community when the peer is a member, excludes it when not', () => {
    const owner = generateDeviceIdentity('Owner');
    const a = generateDeviceIdentity('Ann');
    const stranger = generateDeviceIdentity('Stranger');
    const community = foundedWith(owner, [a]);
    upsertCommunity(db.adapter, community, owner.publicKey, NOW);

    // Peer A is a member -> the descriptor is offered.
    const forA = collectDescriptorRecords(db.adapter, undefined, a.publicKey);
    expect(forA.map((r) => r.descriptor.communityId)).toEqual([community.descriptor.communityId]);

    // A non-member peer is offered NOTHING about this community (no roster leak).
    expect(collectDescriptorRecords(db.adapter, undefined, stranger.publicKey)).toEqual([]);
  });

  it('stops offering a community to a device removed in the current revision', () => {
    const owner = generateDeviceIdentity('Owner');
    const a = generateDeviceIdentity('Ann');
    const c = generateDeviceIdentity('Cal');
    const community = foundedWith(owner, [a, c]);
    const rev2 = removeMemberRevision(owner, community, c.publicKey, NOW);
    upsertCommunity(db.adapter, rev2, owner.publicKey, NOW); // holder is at rev 2, C removed

    // A (still a member) is offered the community; C (removed) is not.
    expect(collectDescriptorRecords(db.adapter, undefined, a.publicKey)
      .map((r) => r.descriptor.communityId)).toEqual([community.descriptor.communityId]);
    expect(collectDescriptorRecords(db.adapter, undefined, c.publicKey)).toEqual([]);
  });
});
