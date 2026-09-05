'use server';

import { detectEndorsementRings } from '@mylife/mynews/engines';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { canRun, requireModerator } from '@/lib/auth';
import { enforceVerification } from '@/lib/console-integrity';
import { type ConsoleResult, resultCode } from '@/lib/console-result';
import { createAdminClient } from '@/lib/supabase-admin';
import {
  expireDueVerifications,
  fetchEndorsementEdges,
  upsertRingFlag,
} from '@/lib/verification';

/**
 * Verification center actions (WP8 behaviour, WP9 integrity).
 *
 * The journalist tier is still never set here: nw_verification_decide and
 * nw_verification_revoke move the tier inside the same transaction as the
 * verification row, so a badge cannot drift from the record behind it. WP9 wraps
 * both in nw_console_enforce_verification, which adds the version check, the
 * replay token, the role floor (approve and deny are reviewer work; revoking a
 * live public badge is senior), and the hash-chained audit row.
 *
 * An approval still requires an explicit expiry: a verification with no end date
 * is a claim nobody ever revisits.
 */

const REASON_MAX_CHARS = 2000;
const RING_DETECTOR_VERSION = 'rings-2026-07-30.1';

function done(code: string): never {
  revalidatePath('/verification');
  redirect(`/verification?ok=${encodeURIComponent(code)}`);
}

function fail(code: string): never {
  redirect(`/verification?error=${encodeURIComponent(code)}`);
}

function settle(result: ConsoleResult): never {
  if (result.ok) done(resultCode(result));
  fail(resultCode(result));
}

interface CommonInput {
  verificationId: string;
  version: number;
  token: string;
  reason: string;
}

function readCommon(formData: FormData): CommonInput | null {
  const verificationId = String(formData.get('verificationId') ?? '').trim();
  const token = String(formData.get('token') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const version = Number(String(formData.get('version') ?? ''));
  if (!verificationId || token.length < 8) return null;
  if (!Number.isInteger(version) || version < 1) return null;
  if (reason === '' || reason.length > REASON_MAX_CHARS) return null;
  return { verificationId, version, token, reason };
}

/** Parse the operator's expiry input into an ISO timestamp in the future. */
function readExpiry(formData: FormData): string | null {
  const months = Number(String(formData.get('expiryMonths') ?? ''));
  if (!Number.isFinite(months) || months <= 0 || months > 60) return null;
  const at = new Date();
  at.setMonth(at.getMonth() + Math.floor(months));
  return at.toISOString();
}

export async function approveVerification(formData: FormData): Promise<void> {
  const moderator = await requireModerator();
  const input = readCommon(formData);
  if (!input) fail('invalid_input');
  if (!canRun(moderator, 'verification_approve')) fail('insufficient_role');
  const expiresAt = readExpiry(formData);
  if (!expiresAt) fail('expiry_required');

  const admin = createAdminClient();
  settle(
    await enforceVerification(admin, {
      verificationId: input.verificationId,
      expectedVersion: input.version,
      actorRef: moderator.email,
      action: 'approve',
      reason: input.reason,
      actionToken: input.token,
      expiresAt,
    }),
  );
}

export async function denyVerification(formData: FormData): Promise<void> {
  const moderator = await requireModerator();
  const input = readCommon(formData);
  if (!input) fail('invalid_input');
  if (!canRun(moderator, 'verification_deny')) fail('insufficient_role');

  const admin = createAdminClient();
  settle(
    await enforceVerification(admin, {
      verificationId: input.verificationId,
      expectedVersion: input.version,
      actorRef: moderator.email,
      action: 'deny',
      reason: input.reason,
      actionToken: input.token,
    }),
  );
}

export async function revokeApprovedVerification(formData: FormData): Promise<void> {
  const moderator = await requireModerator();
  const input = readCommon(formData);
  if (!input) fail('invalid_input');
  if (!canRun(moderator, 'verification_revoke')) fail('insufficient_role');
  // Revocation removes a public badge, so it takes an explicit confirmation.
  const confirm = String(formData.get('confirm') ?? '').trim() === 'on';
  if (!confirm) fail('confirm_required');

  const admin = createAdminClient();
  settle(
    await enforceVerification(admin, {
      verificationId: input.verificationId,
      expectedVersion: input.version,
      actorRef: moderator.email,
      action: 'revoke',
      reason: input.reason,
      actionToken: input.token,
      confirm,
    }),
  );
}

/** Run the expiry pass now instead of waiting for the scheduled one. */
export async function expireVerifications(): Promise<void> {
  await requireModerator();
  const admin = createAdminClient();
  const count = await expireDueVerifications(admin);
  done(count > 0 ? `expired_${count}` : 'expired_none');
}

/**
 * Recompute coordinated-endorsement-ring suspicion and persist it.
 *
 * The detector is pure TypeScript over the endorsement graph
 * (modules/mynews/src/engines/rings.ts), so it runs here and its verdict is
 * stored in nw_ring_flags for the edge cap check to read. Nothing is enforced
 * automatically: a stored flag withholds elevated trust and surfaces the profile
 * for a person to look at, because a tight group of genuine collaborators looks
 * structurally similar to a ring.
 */
export async function recomputeRingFlags(): Promise<void> {
  const moderator = await requireModerator();
  const admin = createAdminClient();
  const edges = await fetchEndorsementEdges(admin);
  const analysis = detectEndorsementRings(edges);

  const findingsByProfile = new Map<string, unknown[]>();
  for (const finding of analysis.findings) {
    for (const member of finding.memberIds) {
      const list = findingsByProfile.get(member) ?? [];
      list.push({ code: finding.code, score: finding.score, explain: finding.explain });
      findingsByProfile.set(member, list);
    }
  }

  // Clear the suspicion of everyone in the analysed graph who no longer has a
  // finding, so a resolved ring stops withholding trust. Profiles outside the
  // bounded edge window are left alone rather than silently cleared.
  const analysed = new Set<string>();
  for (const edge of edges) {
    analysed.add(edge.endorserId);
    analysed.add(edge.beneficiaryId);
  }

  for (const profileId of [...analysed].sort()) {
    const suspicion = analysis.suspicion[profileId] ?? 0;
    await upsertRingFlag(admin, {
      profileId,
      suspicion,
      findings: findingsByProfile.get(profileId) ?? [],
      detectorVersion: RING_DETECTOR_VERSION,
      computedBy: moderator.email,
    });
  }

  done(`rings_${analysis.flagged.length}`);
}
