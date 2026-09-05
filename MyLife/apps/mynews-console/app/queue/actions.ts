'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { canRun, requireModerator } from '@/lib/auth';
import {
  assignQueueItem,
  enforceReport,
  escalateQueueItem,
  type ReportEnforcementAction,
} from '@/lib/console-integrity';
import { type ConsoleResult, resultCode } from '@/lib/console-result';
import { isSuspensionPreset, suspensionUntil } from '@/lib/moderation';
import { createAdminClient } from '@/lib/supabase-admin';

/**
 * Report queue enforcement (rewritten for plan 48 WP9).
 *
 * What changed and why:
 *   - One RPC per action. An action used to call hide-then-resolve as two
 *     separate PostgREST calls, so a failure between them left content hidden
 *     with its report still open. nw_console_enforce_report runs every step in
 *     ONE transaction and rolls the whole thing back if a step fails.
 *   - Version token. The page renders the report's console_version and the RPC
 *     refuses a version that moved, which turns "two moderators clicked at once"
 *     into a typed stale-action conflict instead of a double punishment.
 *   - Replay token. Generated when the form is rendered, so a resubmitted form is
 *     recognised as the same submission and refused.
 *   - Reason required everywhere. The reason is the DSA statement of reasons the
 *     author reads, so it is never optional.
 *   - Role gate. Checked here so the UI is honest, and again in SQL, which is
 *     where the gate actually lives.
 *
 * The enforcement TARGET is still derived server-side from the nw_reports row
 * inside the RPC: form fields carry the report id, never the target.
 */

const REASON_MAX_CHARS = 2000;

function done(code: string): never {
  revalidatePath('/queue');
  redirect(`/queue?ok=${encodeURIComponent(code)}`);
}

function fail(code: string): never {
  redirect(`/queue?error=${encodeURIComponent(code)}`);
}

function settle(result: ConsoleResult): never {
  if (result.ok) done(resultCode(result));
  fail(resultCode(result));
}

interface CommonInput {
  reportId: string;
  version: number;
  token: string;
  reason: string;
}

/**
 * The fields every enforcement form carries. Returns null when anything is
 * missing so the action fails closed with one code instead of guessing.
 */
function readCommon(formData: FormData): CommonInput | null {
  const reportId = String(formData.get('reportId') ?? '').trim();
  const token = String(formData.get('token') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const version = Number(String(formData.get('version') ?? ''));
  if (!reportId || token.length < 8) return null;
  if (!Number.isInteger(version) || version < 1) return null;
  if (reason === '' || reason.length > REASON_MAX_CHARS) return null;
  return { reportId, version, token, reason };
}

function confirmed(formData: FormData): boolean {
  return String(formData.get('confirm') ?? '') === 'on';
}

async function run(
  formData: FormData,
  action: ReportEnforcementAction,
  options: { requireConfirm?: boolean; params?: Record<string, unknown> } = {},
): Promise<never> {
  const moderator = await requireModerator();
  const input = readCommon(formData);
  if (!input) fail('invalid_input');
  if (!canRun(moderator, action)) fail('insufficient_role');
  if (options.requireConfirm && !confirmed(formData)) fail('confirm_required');

  const admin = createAdminClient();
  settle(
    await enforceReport(admin, {
      reportId: input.reportId,
      expectedVersion: input.version,
      actorRef: moderator.email,
      action,
      reason: input.reason,
      actionToken: input.token,
      params: options.params ?? {},
    }),
  );
}

export async function hideArticle(formData: FormData): Promise<void> {
  await run(formData, 'hide_article');
}

export async function hideSuggestion(formData: FormData): Promise<void> {
  await run(formData, 'hide_suggestion');
}

/**
 * Suspend the reported profile. Over 7 days, and always for permanent, this
 * suspends nobody: the RPC records a pending action for a second moderator and
 * the redirect says so. The suspension LENGTH is a form field; the target is not.
 */
export async function suspendProfile(formData: FormData): Promise<void> {
  const preset = String(formData.get('preset') ?? '').trim();
  if (!isSuspensionPreset(preset)) fail('invalid_input');
  const permanent = preset === 'permanent';
  await run(formData, 'suspend_profile', {
    requireConfirm: true,
    params: {
      permanent,
      until: permanent ? null : suspensionUntil(preset, Date.now()),
      preset,
    },
  });
}

/**
 * Copyright strike: retract the article and strike its author, escalating to a
 * suspension at the threshold. All of it is one transaction now, so an author can
 * no longer end up struck for an article that failed to retract.
 */
export async function strikeAuthor(formData: FormData): Promise<void> {
  await run(formData, 'strike_author', { requireConfirm: true });
}

/** Dismiss: no content change, the report closes as no_action with a reason. */
export async function dismissReport(formData: FormData): Promise<void> {
  await run(formData, 'dismiss');
}

/* --------------------------- assignment + escalation ---------------------- */

export async function claimReport(formData: FormData): Promise<void> {
  const moderator = await requireModerator();
  const reportId = String(formData.get('reportId') ?? '').trim();
  const token = String(formData.get('token') ?? '').trim();
  const release = String(formData.get('release') ?? '') === 'on';
  if (!reportId || token.length < 8) fail('invalid_input');

  const admin = createAdminClient();
  settle(
    await assignQueueItem(admin, {
      actorRef: moderator.email,
      queue: 'report',
      itemId: reportId,
      assigneeRef: release ? null : moderator.email,
      actionToken: token,
    }),
  );
}

export async function escalateReport(formData: FormData): Promise<void> {
  const moderator = await requireModerator();
  const reportId = String(formData.get('reportId') ?? '').trim();
  const token = String(formData.get('token') ?? '').trim();
  const level = String(formData.get('level') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  if (!reportId || token.length < 8) fail('invalid_input');
  if (level !== 'none' && level !== 'senior' && level !== 'admin') fail('bad_level');
  if (level !== 'none' && (reason === '' || reason.length > REASON_MAX_CHARS)) fail('bad_reason');
  // Clearing an escalation is a senior call; the RPC enforces the same rule.
  if (level === 'none' && moderator.level < 2) fail('insufficient_role');

  const admin = createAdminClient();
  settle(
    await escalateQueueItem(admin, {
      actorRef: moderator.email,
      queue: 'report',
      itemId: reportId,
      level,
      reason,
      actionToken: token,
    }),
  );
}
