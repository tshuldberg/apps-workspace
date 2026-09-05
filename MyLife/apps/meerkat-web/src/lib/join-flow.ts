// join-flow.ts (web twin of apps/meerkat/app/(root)/data/join-flow.ts). The ONE
// community-join pipeline behind every web door (paste, preview sheet,
// onboarding) -- Plan 31 Phase 5. previewInvite is pure (parse + verify -> a
// display model or a reason-coded failure) and NEVER mutates state; executeJoin
// wraps the same join semantics as the mobile flow.
//
// Twin discipline (composition Phase 0): everything from the JoinFailureReason
// anchor down is BYTE-IDENTICAL with the mobile source (CORE_TWINS lock). The
// platform section above the anchor carries the sanctioned differences: the web
// SPA has no dynamic-route collision to reserve, and JOIN_PLATFORM_COPY holds
// the three notices whose honest wording legitimately differs per surface
// (settings path, no local transport on web, retry trigger).

import {
  communityRole,
  joinCommunityFromLink,
  parseCommunityInviteLink,
  verifyCommunityInvite,
  type InviteVerdict,
  type WorkspaceMemberRole,
} from '@mylife/sync';
import type { QueueJoinRequestResult } from './MeerkatProvider';

/**
 * The invite deep-link wire prefix (fixed at community.ts; existing invites +
 * read-only packages/sync depend on it). The web SPA has no router, so there is
 * no dynamic-route collision to guard as on mobile, but the constant is shared so
 * paste/preview validation matches byte-for-byte.
 */
export const COMMUNITY_INVITE_URL_PREFIX = 'meerkat://community/join#';

/**
 * DoS guard: bound untrusted invite input before parse/JSON.parse (mirrors the
 * theme codec's MAX_INPUT_CHARS and the mobile join-flow). Generous vs a real
 * invite (which embeds the member list) but caps a malicious paste; oversized
 * fails closed to the existing malformed reason text.
 */
const MAX_INVITE_LINK_CHARS = 256 * 1024;

/** True when a pasted value is a community invite link (for the paste door). */
export function isCommunityInviteUrl(url: string): boolean {
  return url.startsWith(COMMUNITY_INVITE_URL_PREFIX);
}

/** The three notices whose honest wording legitimately differs per surface. */
interface JoinPlatformCopy {
  noRelay(name: string): string;
  needsLocal(name: string): string;
  parkFailed(name: string): string;
}

// Web wording: the settings path is Settings, the web app has no local
// transport (full access to a proximity-gated community needs the Meerkat
// app), and the retry trigger is reconnecting.
const JOIN_PLATFORM_COPY: JoinPlatformCopy = {
  noRelay: (name) =>
    `Added "${name}" locally. Owner approval is pending. Open Settings to set a connection server so the owner can approve full history access.`,
  needsLocal: (name) =>
    `Added "${name}" locally. Owner approval is pending. This community only updates in person or on a shared network, which the web app cannot do; open it in the Meerkat app while you are on the same Wi-Fi or nearby the owner.`,
  parkFailed: (name) =>
    `Added "${name}" locally. Owner approval is pending. Could not reach the owner yet; it will retry when you reconnect.`,
};

// --------------------------------------------------------------------------
// Shared logic below this line is byte-identical with the mobile source
// (CORE_TWINS lock, anchored at JoinFailureReason).
// --------------------------------------------------------------------------

/** A join can fail at parse (malformed) or at verify (the invite verdicts). */
export type JoinFailureReason = InviteVerdict | 'malformed_link' | 'killed';

/** Verbatim the reason texts the original join dialogs used (Plan 31 keeps them). */
const REASON_TEXT: Record<InviteVerdict | 'malformed_link', string> = {
  ok: '',
  malformed_link: 'That does not look like a Meerkat community invite link.',
  expired: 'That invite link has expired. Ask for a fresh one.',
  invalid: 'That invite failed verification. Do not trust it.',
  not_authorized: 'That invite was not created by a community owner or admin.',
};

/** Map a join/verify reason to its honest user-facing text (fallback preserved). */
export function joinReasonText(reason: JoinFailureReason): string {
  if (reason === 'killed') return 'That community has been blocked and refuses new joins.';
  return REASON_TEXT[reason as InviteVerdict | 'malformed_link'] ?? 'Could not join.';
}

export type InvitePreview =
  | {
      ok: true;
      /** Community display name from the invite's descriptor. */
      name: string;
      memberCount: number;
      channelCount: number;
      /** ISO expiry of the invite. */
      expiresAt: string;
      /** The inviter's role in the descriptor (owner/admin), or null. */
      inviterRole: WorkspaceMemberRole | null;
      /** The raw link, carried through so the sheet's Join button reuses it. */
      link: string;
    }
  | { ok: false; reason: Exclude<JoinFailureReason, 'killed'>; message: string };

/**
 * Preview an invite WITHOUT joining (TC-1: never mutates state). Parses the
 * self-contained link and verifies its signatures/expiry, then returns a display
 * model or a reason-coded failure using the existing reason texts.
 */
export function previewInvite(link: string, now: Date = new Date()): InvitePreview {
  if (link.length > MAX_INVITE_LINK_CHARS) {
    return { ok: false, reason: 'malformed_link', message: joinReasonText('malformed_link') };
  }
  const parsed = parseCommunityInviteLink(link);
  if (!parsed) {
    return { ok: false, reason: 'malformed_link', message: joinReasonText('malformed_link') };
  }
  const verdict = verifyCommunityInvite(parsed, now);
  if (verdict !== 'ok') {
    return { ok: false, reason: verdict, message: joinReasonText(verdict) };
  }
  const d = parsed.descriptor.descriptor;
  return {
    ok: true,
    name: d.name,
    memberCount: d.members.length,
    channelCount: d.channels.length,
    expiresAt: parsed.invite.invite.expiresAt,
    inviterRole: communityRole(d, parsed.invite.invite.invitedByDeviceId),
    link,
  };
}

/** A short human expiry countdown for the preview sheet ("Expires in 2 days"). */
export function formatInviteExpiry(expiresAt: string, now: Date = new Date()): string {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 'Expired';
  const hours = ms / (60 * 60 * 1000);
  if (hours < 1) return 'Expires in under an hour';
  if (hours < 24) {
    const h = Math.round(hours);
    return `Expires in ${h} hour${h === 1 ? '' : 's'}`;
  }
  const days = Math.round(hours / 24);
  return `Expires in ${days} day${days === 1 ? '' : 's'}`;
}

/** The one-line "Invited by ..." role attribution for the preview sheet. */
export function inviterRoleLine(role: WorkspaceMemberRole | null): string {
  if (role === 'owner') return 'Invited by an owner';
  if (role === 'admin') return 'Invited by an admin';
  return 'Invited by a member';
}

/** Which post-join approval path the queue actually took (honest, no fake done). */
export type JoinApproval =
  | 'requested'
  | 'already_member'
  | 'no_relay'
  | 'needs_local'
  | 'no_owner_dh'
  | 'park_failed';

export interface ExecuteJoinDeps {
  link: string;
  /**
   * The platform join entry: captures db, identity, and clock on the surface,
   * so the shared pipeline stays storage-agnostic and byte-identical.
   */
  joinFromLink: (link: string) => ReturnType<typeof joinCommunityFromLink>;
  queueJoinRequest: (link: string) => Promise<QueueJoinRequestResult>;
  /** Best-effort post-join drain; the result is unused and failures are swallowed. */
  runPostJoinDrain: () => Promise<unknown>;
  /**
   * Plan 52 P3: the name to present in THIS community, chosen at the join
   * door. Recorded as a presentation-profile override (so every linked device
   * adopts it) and written as a signed CommunityProfileEvent immediately, so
   * other members see it on the first sync rather than a device id. Empty or
   * equal to the global name = no override.
   */
  joinDisplayName?: string;
  /** Applies the join-time name. Injected so join-flow stays storage-agnostic. */
  applyJoinDisplayName?: (communityId: string, displayName: string) => void;
}

export type ExecuteJoinResult =
  | {
      ok: true;
      communityId: string;
      name: string;
      /** First channel id for post-join navigation, or null if none. */
      firstChannelId: string | null;
      approval: JoinApproval;
      notice: string;
    }
  | { ok: false; reason: JoinFailureReason; message: string };

/**
 * Execute a join. Mirrors the original onJoin verbatim: join from the link, then
 * park a join-request for the owner and drain immediately in case the owner is
 * online. The approval notice reports what really happened; nothing claims a
 * pending join is complete. The caller refreshes + navigates on ok.
 */
export async function executeJoin(deps: ExecuteJoinDeps): Promise<ExecuteJoinResult> {
  const { link, joinFromLink, queueJoinRequest, runPostJoinDrain } = deps;

  const result = joinFromLink(link);
  if (!result.ok) {
    return { ok: false, reason: result.reason, message: joinReasonText(result.reason) };
  }

  const community = result.community;
  const name = community.descriptor.name;
  const communityId = community.communityId;
  // Plan 52 P3: apply the join-time name BEFORE the owner request, so the
  // first thing other members can learn about this device is the chosen name.
  // A failure here never turns a completed join into a reported failure.
  const chosenName = (deps.joinDisplayName ?? '').trim();
  if (chosenName && deps.applyJoinDisplayName) {
    try {
      deps.applyJoinDisplayName(communityId, chosenName);
    } catch {
      // The join landed; naming is best-effort and retries from settings.
    }
  }
  const firstChannelId = community.descriptor.channels[0]?.id ?? null;
  const base = { ok: true as const, communityId, name, firstChannelId };

  const queued = await queueJoinRequest(link);
  if (queued.ok) {
    // Drain immediately in case the owner is already online and responds. This is
    // opportunistic: the join + owner request already succeeded, so a drain
    // rejection must NOT turn a completed join into a reported failure (M2).
    try {
      await runPostJoinDrain();
    } catch {
      // Swallow: the join landed and the request parked; the drain is best-effort.
    }
    return {
      ...base,
      approval: 'requested',
      notice: `Added "${name}" locally. Approval request queued. Full history becomes available after the owner approves and access arrives.`,
    };
  }
  if (queued.reason === 'already_member') {
    return { ...base, approval: 'already_member', notice: `Joined "${name}".` };
  }
  if (queued.reason === 'no_relay') {
    return { ...base, approval: 'no_relay', notice: JOIN_PLATFORM_COPY.noRelay(name) };
  }
  if (queued.reason === 'needs_local') {
    // Plan 27 P3: a proximity-gated community only updates in person or on a
    // shared network, so its join handoff never uses a connection server. The
    // honest wording of how the newcomer meets the owner is platform copy.
    return { ...base, approval: 'needs_local', notice: JOIN_PLATFORM_COPY.needsLocal(name) };
  }
  if (queued.reason === 'no_owner_dh') {
    // This invite carries no owner key to request approval against; re-parking
    // would fail identically, so there is NO honest "will retry" claim here.
    return {
      ...base,
      approval: 'no_owner_dh',
      notice: `Added "${name}" locally. This invite cannot request owner approval; ask the owner for a new invite to get full history access.`,
    };
  }
  return { ...base, approval: 'park_failed', notice: JOIN_PLATFORM_COPY.parkFailed(name) };
}
