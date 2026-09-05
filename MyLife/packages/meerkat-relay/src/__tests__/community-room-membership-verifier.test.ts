import { describe, expect, it } from 'vitest';
import {
  communityRole,
  createCommunity,
  generateDeviceIdentity,
  reviseCommunity,
  type SignedCommunityDescriptor,
} from '@mylife/sync';
import { createCommunityRoomMembershipVerifier } from '../community-room-membership-verifier';
// The community-node bin imports this from the package barrel; assert it resolves there too.
import { createCommunityRoomMembershipVerifier as barrelVerifier } from '../index';
import type { StoredPrivateCommunityState } from '../community-private-state';

function storedFrom(descriptor: SignedCommunityDescriptor): StoredPrivateCommunityState {
  return { descriptor, descriptorHash: 'h', publishDigest: 'd', snapshots: [], tail: [] };
}

/** A store stub that returns exactly one community's signed state (or null / throws). */
function stubStore(
  map: Map<string, StoredPrivateCommunityState | 'throw'>,
): { getState: (communityId: string) => Promise<StoredPrivateCommunityState | null> } {
  return {
    async getState(communityId: string) {
      const entry = map.get(communityId);
      if (entry === 'throw') throw new Error('store down');
      return entry ?? null;
    },
  };
}

describe('community room membership verifier', () => {
  const owner = generateDeviceIdentity('Owner');
  const member = generateDeviceIdentity('Member');
  const stranger = generateDeviceIdentity('Stranger');

  const genesis = createCommunity(owner, { name: 'Room Test' });
  const withMember = reviseCommunity(owner, genesis, {
    members: [...genesis.descriptor.members, { deviceId: member.publicKey, role: 'member', dhPublicKey: member.dhPublicKey }],
  });
  const communityId = genesis.descriptor.communityId;

  it('is exported from the package barrel the community-node bin imports', () => {
    expect(barrelVerifier).toBe(createCommunityRoomMembershipVerifier);
  });

  it('admits a current member with the roster role and current descriptor revision', async () => {
    const verify = createCommunityRoomMembershipVerifier({
      privateStateStore: stubStore(new Map([[communityId, storedFrom(withMember)]])),
      communityRole,
    });
    const verdict = await verify(communityId, member.publicKey);
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.role).toBe('member');
      expect(verdict.descriptorRevision).toBe(withMember.descriptor.revision);
      expect(verdict.epoch).toBe(0);
    }
  });

  it('admits the owner with the owner role', async () => {
    const verify = createCommunityRoomMembershipVerifier({
      privateStateStore: stubStore(new Map([[communityId, storedFrom(withMember)]])),
      communityRole,
    });
    const verdict = await verify(communityId, owner.publicKey);
    expect(verdict).toMatchObject({ ok: true, role: 'owner' });
  });

  it('refuses a device that is not on the roster', async () => {
    const verify = createCommunityRoomMembershipVerifier({
      privateStateStore: stubStore(new Map([[communityId, storedFrom(withMember)]])),
      communityRole,
    });
    expect(await verify(communityId, stranger.publicKey)).toEqual({ ok: false, reason: 'not_member' });
  });

  it('refuses a member removed by a newer signed revision', async () => {
    const removed = reviseCommunity(owner, withMember, {
      members: withMember.descriptor.members.filter((m) => m.deviceId !== member.publicKey),
    });
    // Sanity: the removing revision really drops the member from the roster.
    expect(communityRole(removed.descriptor, member.publicKey)).toBeNull();
    const verify = createCommunityRoomMembershipVerifier({
      privateStateStore: stubStore(new Map([[communityId, storedFrom(removed)]])),
      communityRole,
    });
    expect(await verify(communityId, member.publicKey)).toEqual({ ok: false, reason: 'not_member' });
  });

  it('refuses when the node holds no descriptor for the community yet', async () => {
    const verify = createCommunityRoomMembershipVerifier({
      privateStateStore: stubStore(new Map()),
      communityRole,
    });
    expect(await verify('cm_unknown', member.publicKey)).toEqual({ ok: false, reason: 'not_member' });
  });

  it('reports unavailable (never a member) when the store read throws', async () => {
    const verify = createCommunityRoomMembershipVerifier({
      privateStateStore: stubStore(new Map([[communityId, 'throw']])),
      communityRole,
    });
    expect(await verify(communityId, member.publicKey)).toEqual({ ok: false, reason: 'unavailable' });
  });
});
