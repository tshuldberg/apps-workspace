/**
 * Community member removal, P0 protocol (Plan 28): the owner-signed removal
 * revision + the per-survivor removal mailbox fan-out.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  configureSyncSecretStore,
  createCommunity,
  createInMemorySyncSecretStore,
  createSignedIdentityBundle,
  deriveCommunityJoinToken,
  deriveCommunityRemovalToken,
  generateDeviceIdentity,
  openMemberRemovalMailbox,
  removeMemberRevision,
  sealMemberRemovalFanOut,
  verifyCommunityDescriptor,
  type MemberRemovalRecipient,
  type SyncWorkspaceKeyWrap,
} from '../index';

const NOW = '2026-07-02T00:00:00.000Z';

beforeEach(() => configureSyncSecretStore(createInMemorySyncSecretStore()));

type Identity = ReturnType<typeof generateDeviceIdentity>;
const asMember = (id: Identity) => ({ deviceId: id.publicKey, role: 'member' as const, dhPublicKey: id.dhPublicKey });

function foundedWith(owner: Identity, members: Identity[]) {
  return createCommunity(owner, { name: 'Surf Club', channels: [], members: members.map(asMember) });
}

const wrapFor = (communityId: string, deviceId: string, epoch = 2): SyncWorkspaceKeyWrap => ({
  workspaceId: communityId, keyVersion: epoch, wrappedForDeviceId: deviceId,
  wrappedKeyBlob: new Uint8Array(80).fill(7), validFrom: NOW, validUntil: null,
});

describe('removeMemberRevision (owner-signed, drops the member)', () => {
  it('drops the removed member and produces a valid next revision', () => {
    const owner = generateDeviceIdentity('Owner');
    const b = generateDeviceIdentity('Bea');
    const c = generateDeviceIdentity('Cal');
    const community = foundedWith(owner, [b, c]);
    expect(community.descriptor.members.map((m) => m.deviceId).sort())
      .toEqual([owner.publicKey, b.publicKey, c.publicKey].sort());

    const revised = removeMemberRevision(owner, community, b.publicKey, NOW);
    expect(revised.descriptor.revision).toBe(community.descriptor.revision + 1);
    expect(revised.descriptor.members.some((m) => m.deviceId === b.publicKey)).toBe(false);
    expect(revised.descriptor.members.map((m) => m.deviceId).sort())
      .toEqual([owner.publicKey, c.publicKey].sort());
    // The new revision verifies against its predecessor (chain + owner signature).
    expect(verifyCommunityDescriptor(revised, community)).toBe(true);
  });

  it('a non-owner cannot sign a removal revision (throws)', () => {
    const owner = generateDeviceIdentity('Owner');
    const b = generateDeviceIdentity('Bea');
    const community = foundedWith(owner, [b]);
    expect(() => removeMemberRevision(b, community, owner.publicKey, NOW)).toThrow();
  });
});

describe('deriveCommunityRemovalToken', () => {
  it('is distinct from the join token for the same inputs (separate HKDF domain)', () => {
    const owner = generateDeviceIdentity('Owner');
    const community = foundedWith(owner, []);
    const { genesisNonce, communityId } = community.descriptor;
    expect(deriveCommunityRemovalToken(genesisNonce, communityId, owner.publicKey))
      .not.toBe(deriveCommunityJoinToken(genesisNonce, communityId, owner.publicKey));
  });
});

describe('sealMemberRemovalFanOut / openMemberRemovalMailbox', () => {
  it('builds one envelope per survivor, each carrying only its own wraps, and round-trips', () => {
    const owner = generateDeviceIdentity('Owner');
    const b = generateDeviceIdentity('Bea');
    const c = generateDeviceIdentity('Cal');
    const community = foundedWith(owner, [b, c]);
    const revised = removeMemberRevision(owner, community, b.publicKey, NOW);
    const { communityId, genesisNonce } = community.descriptor;

    const recipients: MemberRemovalRecipient[] = [
      { deviceId: owner.publicKey, dhPublicKey: owner.dhPublicKey, keyWraps: [wrapFor(communityId, owner.publicKey)] },
      { deviceId: c.publicKey, dhPublicKey: c.dhPublicKey, keyWraps: [wrapFor(communityId, c.publicKey)] },
    ];
    const sealed = sealMemberRemovalFanOut({
      owner, communityId, communitySecret: genesisNonce, descriptor: revised,
      removedDeviceId: b.publicKey, ownerBundle: createSignedIdentityBundle(owner), recipients,
    });
    expect(sealed).toHaveLength(2);
    // Tokens match the recipient-scoped removal token.
    const cSealed = sealed.find((s) => s.recipientDeviceId === c.publicKey)!;
    expect(cSealed.token).toBe(deriveCommunityRemovalToken(genesisNonce, communityId, c.publicKey));
    // Each envelope carries ONLY that recipient's wrap.
    expect(cSealed.payload.keyWraps).toHaveLength(1);
    expect(cSealed.payload.keyWraps[0]!.wrapped_for_device_id).toBe(c.publicKey);

    // C opens its own envelope.
    const opened = openMemberRemovalMailbox(c, cSealed.envelope);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.senderDeviceId).toBe(owner.publicKey);
    expect(opened.payload.removedDeviceId).toBe(b.publicKey);
    expect(opened.payload.descriptor.descriptor.revision).toBe(revised.descriptor.revision);

    // The removed device is never a recipient and cannot open C's envelope.
    expect(sealed.some((s) => s.recipientDeviceId === b.publicKey)).toBe(false);
    expect(openMemberRemovalMailbox(b, cSealed.envelope).ok).toBe(false);
  });
});
