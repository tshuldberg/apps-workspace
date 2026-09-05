'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { canRun, requireModerator } from '@/lib/auth';
import { assignQueueItem, enforceScreening, escalateQueueItem } from '@/lib/console-integrity';
import { type ConsoleResult, resultCode } from '@/lib/console-result';
import { createAdminClient } from '@/lib/supabase-admin';

/**
 * Screening review actions (WP8 behaviour, WP9 integrity).
 *
 * The decision id is still the only target input: the content target and
 * everything done to it are derived inside the RPC from the decision row, so no
 * hidden field can point an approval at different content. WP9 adds the version
 * check, the replay token, and a role floor, and routes appeal dispositions
 * through the same RPC as reviews so screening appeal state stays on the decision
 * row rather than being copied into a second table.
 *
 * Appeals are senior work and the appeal reviewer may not be the reviewer who
 * decided the hold: the RPC returns 'same-moderator' for that, so one person can
 * never both reject content and dismiss the appeal against the rejection.
 *
 * Fail-closed default is keep-held: an unrecognised envelope is a failure, never
 * a release.
 */

const REASON_MAX_CHARS = 2000;

function done(code: string, view: string): never {
  revalidatePath('/screening');
  redirect(`/screening?view=${encodeURIComponent(view)}&ok=${encodeURIComponent(code)}`);
}

function fail(code: string, view: string): never {
  redirect(`/screening?view=${encodeURIComponent(view)}&error=${encodeURIComponent(code)}`);
}

function settle(result: ConsoleResult, view: string): never {
  if (result.ok) done(resultCode(result), view);
  fail(resultCode(result), view);
}

interface CommonInput {
  decisionId: string;
  version: number;
  token: string;
  reason: string;
  view: string;
}

function readCommon(formData: FormData): CommonInput | null {
  const decisionId = String(formData.get('decisionId') ?? '').trim();
  const token = String(formData.get('token') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const version = Number(String(formData.get('version') ?? ''));
  const view = String(formData.get('view') ?? 'queue');
  if (!decisionId || token.length < 8) return null;
  if (!Number.isInteger(version) || version < 1) return null;
  if (reason === '' || reason.length > REASON_MAX_CHARS) return null;
  return { decisionId, version, token, reason, view };
}

async function run(
  formData: FormData,
  action: 'approve' | 'reject' | 'appeal_grant' | 'appeal_deny',
  auditAction: string,
): Promise<never> {
  const moderator = await requireModerator();
  const input = readCommon(formData);
  if (!input) fail('invalid_input', String(formData.get('view') ?? 'queue'));
  if (!canRun(moderator, auditAction)) fail('insufficient_role', input.view);

  const admin = createAdminClient();
  settle(
    await enforceScreening(admin, {
      decisionId: input.decisionId,
      expectedVersion: input.version,
      actorRef: moderator.email,
      action,
      reason: input.reason,
      actionToken: input.token,
    }),
    input.view,
  );
}

export async function approveHold(formData: FormData): Promise<void> {
  await run(formData, 'approve', 'screening_approve');
}

export async function rejectHold(formData: FormData): Promise<void> {
  await run(formData, 'reject', 'screening_reject');
}

/**
 * Grant or deny a screening appeal. Granting runs the same release path an
 * approval runs, so a granted appeal restores the content rather than only
 * relabelling it.
 */
export async function disposeAppeal(formData: FormData): Promise<void> {
  const grant = String(formData.get('grant') ?? '') === 'grant';
  await run(
    formData,
    grant ? 'appeal_grant' : 'appeal_deny',
    grant ? 'appeal_grant' : 'appeal_deny',
  );
}

/* --------------------------- assignment + escalation ---------------------- */

export async function claimDecision(formData: FormData): Promise<void> {
  const moderator = await requireModerator();
  const decisionId = String(formData.get('decisionId') ?? '').trim();
  const token = String(formData.get('token') ?? '').trim();
  const view = String(formData.get('view') ?? 'queue');
  const release = String(formData.get('release') ?? '') === 'on';
  if (!decisionId || token.length < 8) fail('invalid_input', view);

  const admin = createAdminClient();
  settle(
    await assignQueueItem(admin, {
      actorRef: moderator.email,
      queue: 'screening',
      itemId: decisionId,
      assigneeRef: release ? null : moderator.email,
      actionToken: token,
    }),
    view,
  );
}

export async function escalateDecision(formData: FormData): Promise<void> {
  const moderator = await requireModerator();
  const decisionId = String(formData.get('decisionId') ?? '').trim();
  const token = String(formData.get('token') ?? '').trim();
  const view = String(formData.get('view') ?? 'queue');
  const level = String(formData.get('level') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  if (!decisionId || token.length < 8) fail('invalid_input', view);
  if (level !== 'none' && level !== 'senior' && level !== 'admin') fail('bad_level', view);
  if (level !== 'none' && (reason === '' || reason.length > REASON_MAX_CHARS)) {
    fail('bad_reason', view);
  }
  if (level === 'none' && moderator.level < 2) fail('insufficient_role', view);

  const admin = createAdminClient();
  settle(
    await escalateQueueItem(admin, {
      actorRef: moderator.email,
      queue: 'screening',
      itemId: decisionId,
      level,
      reason,
      actionToken: token,
    }),
    view,
  );
}
