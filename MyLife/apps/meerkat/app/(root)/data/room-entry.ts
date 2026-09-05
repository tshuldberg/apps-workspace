// Plan 25 WP-25I: assemble a room-launch plan from local community state + config.
//
// Pure over its inputs so it is unit-tested: given the member's current descriptor
// revision, group epoch, the community node base URL, and the configured LiveKit URL, it
// returns either a ready plan (the exact inputs requestRoomToken + connectLiveKitRoom need)
// or an honest 'unavailable' reason. It never invents a node URL, an epoch, or an SFU URL,
// so the screen can render a truthful "rooms are not available here" state.

import type { DeviceIdentity, RoomPermission } from '@mylife/sync';

export type RoomUnavailableReason =
  | 'no_identity'
  | 'not_a_member'
  | 'no_community_node'
  | 'no_livekit'
  | 'no_epoch'
  | 'archived';

export interface RoomLaunchPlan {
  member: DeviceIdentity;
  communityId: string;
  roomId: string;
  descriptorRevision: number;
  epoch: number;
  requestedPermissions: RoomPermission[];
  communityNodeBaseUrl: string;
  livekitWsUrl: string;
}

export type RoomLaunchResult =
  | { ok: true; plan: RoomLaunchPlan }
  | { ok: false; reason: RoomUnavailableReason };

export interface ResolveRoomLaunchInput {
  identity: DeviceIdentity | null;
  communityId: string;
  roomId: string;
  /** The member's current signed descriptor revision, or null when no descriptor is held. */
  descriptorRevision: number | null;
  /** The member's current group epoch, or null when they hold no current epoch key. */
  epoch: number | null;
  /** The community's first https host, or null when none is configured. */
  communityNodeBaseUrl: string | null;
  /** The configured LiveKit signaling URL (app.config extra.livekitUrl), possibly ''. */
  livekitUrl: string;
  /** The permission set to request; defaults to a full member set. */
  requestedPermissions?: RoomPermission[];
  /**
   * True when the room's descriptor channel is archived. Archived channels are
   * read-only everywhere (Plan 38 Phase 2), so their rooms cannot be joined.
   */
  archived?: boolean;
}

const DEFAULT_PERMISSIONS: RoomPermission[] = ['subscribe', 'publish_audio', 'publish_video', 'publish_data'];

export function resolveRoomLaunch(input: ResolveRoomLaunchInput): RoomLaunchResult {
  if (!input.identity) return { ok: false, reason: 'no_identity' };
  // A held descriptor revision is proof the client has adopted the community; absence
  // means it is not (yet) a member here.
  if (input.descriptorRevision === null || input.descriptorRevision < 1) {
    return { ok: false, reason: 'not_a_member' };
  }
  // An archived channel is read-only everywhere; its room must not be joined.
  if (input.archived) return { ok: false, reason: 'archived' };
  // No current epoch key means the member cannot decrypt current traffic (e.g. removed or
  // never keyed); it must not request a room token.
  if (input.epoch === null || input.epoch < 1) return { ok: false, reason: 'no_epoch' };
  if (!input.communityNodeBaseUrl) return { ok: false, reason: 'no_community_node' };
  const livekitWsUrl = input.livekitUrl.trim();
  if (!livekitWsUrl) return { ok: false, reason: 'no_livekit' };

  return {
    ok: true,
    plan: {
      member: input.identity,
      communityId: input.communityId,
      roomId: input.roomId,
      descriptorRevision: input.descriptorRevision,
      epoch: input.epoch,
      requestedPermissions: input.requestedPermissions ?? DEFAULT_PERMISSIONS,
      communityNodeBaseUrl: input.communityNodeBaseUrl,
      livekitWsUrl,
    },
  };
}

/** Honest one-line copy for each unavailable reason, for the room entry point. */
export function roomUnavailableCopy(reason: RoomUnavailableReason): string {
  switch (reason) {
    case 'no_identity':
      return 'Set up your device before joining a room.';
    case 'not_a_member':
      return 'Join this community to use its rooms.';
    case 'no_epoch':
      return 'You do not hold a current key for this community yet.';
    case 'no_community_node':
      return 'This community has no connected server for rooms.';
    case 'no_livekit':
      return 'Voice and video rooms are not available in this build.';
    case 'archived':
      return 'Archived channel. Content is preserved and read-only here.';
    default:
      return 'Rooms are not available here.';
  }
}
