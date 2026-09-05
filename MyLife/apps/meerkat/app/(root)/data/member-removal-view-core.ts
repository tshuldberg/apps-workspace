// Plan 28 P4: pure copy + count-to-phrase logic for the owner-only "Remove
// member" control (mobile now; the web twin lands in the coordinated web wave).
// Kept native-free so the honest phrasing is testable under Node and cannot drift
// from the settings screen.
//
// HONESTY (Critical): every phrase here is derived ONLY from the real
// RemoveCommunityMemberResult counts the engine returns. Removal is
// EPOCH-BOUNDARY honest -- convergence is per device as survivors drain, never a
// claim of instant network-wide removal (NC-1). We never claim a park or a node
// republish that returned false: envelopesParked / nodesRepublished report what
// actually happened.

import type { RemoveCommunityMemberResult } from '@mylife/sync';

/**
 * The confirm-dialog body (founder-approved epoch-boundary shape). NEVER promise
 * instant network-wide removal: content shared before the removal stays on the
 * removed device; forward secrecy begins at the rotation point and converges per
 * device as each survivor receives the update.
 */
export const MEMBER_REMOVAL_CONFIRM_BODY =
  "Takes effect on each member's device as they receive the update; content shared before removal stays on their device.";

/** The confirm-dialog title for removing a specific person. */
export function memberRemovalConfirmTitle(label: string): string {
  return `Remove ${label}?`;
}

function plural(n: number, singular: string, pluralForm: string): string {
  return n === 1 ? singular : pluralForm;
}

/**
 * Build the honest success notice from the real result counts.
 *   - notified-now = envelopesParked (envelopes that REALLY parked on the relay;
 *     those survivors receive the update on their next drain);
 *   - the remaining survivors (survivorsToNotify - envelopesParked) converge when
 *     their devices reconnect (the wraps also ride a direct engine session);
 *   - the hosted line appears ONLY when a node republish really succeeded.
 */
export function describeMemberRemovalSuccess(
  result: Extract<RemoveCommunityMemberResult, { ok: true }>,
  label: string,
): string {
  const { survivorsToNotify, envelopesParked, nodesAttempted, nodesRepublished } = result;

  // Defensive clamp: the engine guarantees non-negative integers with
  // parked <= survivors and republished <= attempted, but never let a future
  // engine change produce nonsense copy ("queued for 3 of 2 ... the other -1").
  // Any off count falls back to a safe, honest, count-free phrasing.
  const countsSane =
    [survivorsToNotify, envelopesParked, nodesAttempted, nodesRepublished].every(Number.isInteger) &&
    survivorsToNotify >= 0 &&
    envelopesParked >= 0 &&
    envelopesParked <= survivorsToNotify &&
    nodesAttempted >= 0 &&
    nodesRepublished >= 0 &&
    nodesRepublished <= nodesAttempted;
  if (!countsSane) {
    return `Removed ${label}. The update reaches the other members as their devices connect.`;
  }

  const parts: string[] = [`Removed ${label}.`];

  if (survivorsToNotify === 0) {
    parts.push('No other members needed the update.');
  } else if (envelopesParked === survivorsToNotify) {
    parts.push(
      `Update queued for ${survivorsToNotify} remaining ${plural(survivorsToNotify, 'member', 'members')}; each applies it as their device connects.`,
    );
  } else if (envelopesParked === 0) {
    parts.push(
      `Could not queue the update for the ${survivorsToNotify} remaining ${plural(survivorsToNotify, 'member', 'members')} yet; they converge as their devices reconnect.`,
    );
  } else {
    const later = survivorsToNotify - envelopesParked;
    parts.push(
      `Update queued for ${envelopesParked} of ${survivorsToNotify} remaining members; the other ${later} ${plural(later, 'converges', 'converge')} as their devices reconnect.`,
    );
  }

  // Hosted enforcement line: claim success ONLY on a real republish; never claim
  // a republish that returned false. When nothing was attempted, say nothing.
  if (nodesAttempted > 0) {
    if (nodesRepublished > 0) {
      parts.push(
        `${nodesRepublished} hosted community ${plural(nodesRepublished, 'server', 'servers')} updated.`,
      );
    } else {
      parts.push(
        `Could not reach the hosted community ${plural(nodesAttempted, 'server', 'servers')}; it converges on its next update.`,
      );
    }
  }

  return parts.join(' ');
}

/** Build the honest error notice from a reason-coded failure. Never a success. */
export function describeMemberRemovalFailure(
  result: Extract<RemoveCommunityMemberResult, { ok: false }>,
  label: string,
): string {
  switch (result.reason) {
    case 'not_owner':
      return 'Only the community owner can remove members.';
    case 'cannot_remove_owner':
      return 'The owner cannot be removed.';
    case 'not_a_member':
      return `${label} is no longer a member of this community.`;
    case 'unknown_community':
      return 'This community is not on this device.';
    default:
      // An out-of-union reason still surfaces honestly instead of a silent
      // no-op (setNotice(undefined) would render nothing).
      return 'Could not remove this member.';
  }
}
