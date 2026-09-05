/**
 * Plan 25 WP-25I: the community-node room-token membership verifier.
 *
 * The room-token service (room-token-service.ts) takes an injected membership seam that
 * answers, for one (communityId, memberDeviceId), whether the device is a CURRENT member
 * and with what role. On the always-on community node the authoritative roster is the
 * owner-signed descriptor the node already holds in its private-state store and gates feed
 * pulls against (feed-auth.ts reads exactly this descriptor). This module binds that same
 * authority to the room-token seam so the node never invents membership.
 *
 * Honesty boundaries:
 *  - A removed member is absent from the current signed roster, so communityRole returns
 *    null and admission is refused (not_member). This inherits the node's documented P2
 *    tradeoff: the deploy authority is the roster the node currently holds.
 *  - The zero-knowledge node holds no group-keys epoch, so it cannot gate on epoch
 *    staleness. It gates on roster membership and descriptorRevision (both advance on any
 *    membership change, including removal). The returned epoch is 0, which accepts any
 *    client epoch >= 0 without ever falsely rejecting a current member; the service's
 *    descriptorRevision staleness check remains the meaningful freshness gate.
 *  - A store fault surfaces as an honest 'unavailable' verdict, never a fabricated member.
 */

import type { RoomMembershipVerification, RoomMembershipVerifier } from './room-token-service';
import type { CommunityPrivateStateStore } from './community-private-state';

type CommunityRoleFn = typeof import('@mylife/sync').communityRole;

export interface CommunityRoomMembershipVerifierDeps {
  /** The node's authoritative private-state store (holds the current signed descriptor). */
  privateStateStore: Pick<CommunityPrivateStateStore, 'getState'>;
  /** @mylife/sync communityRole: returns the member's role or null when absent/removed. */
  communityRole: CommunityRoleFn;
}

/**
 * Build a RoomMembershipVerifier bound to the community node's current signed roster.
 * Returns not_member when no descriptor exists yet, when the device is not on the current
 * roster, or when it has been removed; unavailable when the store read throws.
 */
export function createCommunityRoomMembershipVerifier(
  deps: CommunityRoomMembershipVerifierDeps,
): RoomMembershipVerifier {
  return async (communityId: string, memberDeviceId: string): Promise<RoomMembershipVerification> => {
    let stored;
    try {
      stored = await deps.privateStateStore.getState(communityId);
    } catch {
      return { ok: false, reason: 'unavailable' };
    }
    if (!stored) return { ok: false, reason: 'not_member' };
    const descriptor = stored.descriptor.descriptor;
    const role = deps.communityRole(descriptor, memberDeviceId);
    if (!role) return { ok: false, reason: 'not_member' };
    return { ok: true, role, epoch: 0, descriptorRevision: descriptor.revision };
  };
}
