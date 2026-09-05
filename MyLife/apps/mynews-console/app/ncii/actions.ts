'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { canRun, requireModerator } from '@/lib/auth';
import { assignQueueItem, enforceNcii, escalateQueueItem } from '@/lib/console-integrity';
import { type ConsoleResult, resultCode } from '@/lib/console-result';
import { createAdminClient } from '@/lib/supabase-admin';

/**
 * NCII and child-safety case enforcement (plan 48 WP9 rewrite).
 *
 * The case id is still the only target input: the enforcement target is derived
 * inside the RPC from the case row. What is new is the version check (a case
 * another moderator just moved cannot be actioned on stale information), the
 * replay token, the required reason, and the role floor: ensure_removed and
 * escalate are reviewer work, but CLEAR lifts a takedown, so it is senior-only
 * and still needs the explicit confirmation checkbox.
 *
 * Fail-closed default remains keep-removed. An unrecognised RPC envelope is a
 * failure, never a release.
 */

const REASON_MAX_CHARS = 2000;

function done(code: string): never {
  revalidatePath('/ncii');
  redirect(`/ncii?ok=${encodeURIComponent(code)}`);
}

function fail(code: string): never {
  redirect(`/ncii?error=${encodeURIComponent(code)}`);
}

function settle(result: ConsoleResult): never {
  if (result.ok) done(resultCode(result));
  fail(resultCode(result));
}

interface CommonInput {
  caseId: string;
  version: number;
  token: string;
  reason: string;
}

function readCommon(formData: FormData): CommonInput | null {
  const caseId = String(formData.get('caseId') ?? '').trim();
  const token = String(formData.get('token') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const version = Number(String(formData.get('version') ?? ''));
  if (!caseId || token.length < 8) return null;
  if (!Number.isInteger(version) || version < 1) return null;
  if (reason === '' || reason.length > REASON_MAX_CHARS) return null;
  return { caseId, version, token, reason };
}

async function run(
  formData: FormData,
  action: 'ensure_removed' | 'escalate' | 'clear',
): Promise<never> {
  const moderator = await requireModerator();
  const input = readCommon(formData);
  if (!input) fail('invalid_input');
  const auditAction = `ncii_${action}`;
  if (!canRun(moderator, auditAction)) fail('insufficient_role');
  const confirm = String(formData.get('confirm') ?? '') === 'on';
  if (action === 'clear' && !confirm) fail('confirm_required');

  const admin = createAdminClient();
  settle(
    await enforceNcii(admin, {
      caseId: input.caseId,
      expectedVersion: input.version,
      actorRef: moderator.email,
      action,
      reason: input.reason,
      actionToken: input.token,
      confirm,
    }),
  );
}

export async function ensureRemoved(formData: FormData): Promise<void> {
  await run(formData, 'ensure_removed');
}

export async function escalateCase(formData: FormData): Promise<void> {
  await run(formData, 'escalate');
}

/**
 * Clear a case: lifts the takedown or closes it as a verified false report.
 * Senior-only, confirmed, and reasoned, because a mis-click here restores NCII.
 */
export async function clearCase(formData: FormData): Promise<void> {
  await run(formData, 'clear');
}

/* --------------------------- assignment + escalation ---------------------- */

export async function claimCase(formData: FormData): Promise<void> {
  const moderator = await requireModerator();
  const caseId = String(formData.get('caseId') ?? '').trim();
  const token = String(formData.get('token') ?? '').trim();
  const release = String(formData.get('release') ?? '') === 'on';
  if (!caseId || token.length < 8) fail('invalid_input');

  const admin = createAdminClient();
  settle(
    await assignQueueItem(admin, {
      actorRef: moderator.email,
      queue: 'ncii',
      itemId: caseId,
      assigneeRef: release ? null : moderator.email,
      actionToken: token,
    }),
  );
}

export async function escalateCaseOwnership(formData: FormData): Promise<void> {
  const moderator = await requireModerator();
  const caseId = String(formData.get('caseId') ?? '').trim();
  const token = String(formData.get('token') ?? '').trim();
  const level = String(formData.get('level') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  if (!caseId || token.length < 8) fail('invalid_input');
  if (level !== 'none' && level !== 'senior' && level !== 'admin') fail('bad_level');
  if (level !== 'none' && (reason === '' || reason.length > REASON_MAX_CHARS)) fail('bad_reason');
  if (level === 'none' && moderator.level < 2) fail('insufficient_role');

  const admin = createAdminClient();
  settle(
    await escalateQueueItem(admin, {
      actorRef: moderator.email,
      queue: 'ncii',
      itemId: caseId,
      level,
      reason,
      actionToken: token,
    }),
  );
}
