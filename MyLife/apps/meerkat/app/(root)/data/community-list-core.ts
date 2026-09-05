// community-list-core.ts: pure helpers for the Communities LIST + settings role
// gating (Plan 31 Phase 2). Kept native-free so the unread aggregation and the
// owner/admin gating are testable under Node and cannot drift from the screens.

import type { WorkspaceMemberRole } from '@mylife/sync';

/**
 * Sum a community's per-channel unread counts for the list card badge. Muted
 * CHANNELS are excluded (Discord grammar): a muted channel never contributes to
 * the community badge, matching the per-channel view that hides its own badge.
 * (A whole-community mute hides the badge entirely at the call site.)
 */
export function totalUnreadCount(
  counts: Record<string, number>,
  mutedChannelIds?: ReadonlySet<string>,
): number {
  let total = 0;
  for (const [channelId, n] of Object.entries(counts)) {
    if (n > 0 && !mutedChannelIds?.has(channelId)) total += n;
  }
  return total;
}

export interface CommunityAdminCaps {
  /** Owner-only rows (public reports, make public, owner review). */
  isOwner: boolean;
  /** Owner OR admin can invite + edit admin surfaces. */
  canInvite: boolean;
}

/** The admin capability gate for a community, from this device's role. */
export function communityAdminCaps(myRole: WorkspaceMemberRole | null): CommunityAdminCaps {
  return {
    isOwner: myRole === 'owner',
    canInvite: myRole === 'owner' || myRole === 'admin',
  };
}
