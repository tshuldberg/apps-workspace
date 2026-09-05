'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { canRun, requireModerator } from '@/lib/auth';
import {
  assignQueueItem,
  disposeModerationAppeal,
  enforceScreening,
  escalateQueueItem,
} from '@/lib/console-integrity';
import { type ConsoleResult, resultCode } from '@/lib/console-result';
import { createAdminClient } from '@/lib/supabase-admin';

/**
 * Appeal disposition (plan 48 WP9).
 *
 * ONE queue, TWO sources. An appeal against a moderation action lives in
 * nw_moderation_appeals; an appeal against a pre-publication screening hold lives
 * on the nw_screening_decisions row WP8 already wrote. This action dispatches to
 * the source's own RPC rather than copying screening appeal state into a second
 * table, so there is exactly one record of any appeal.
 *
 * Both paths refuse 'same-moderator': the person who took the action being
 * appealed cannot rule on the appeal. That is the dual control for appeals, and it
 * is enforced in SQL, not here.
 */

const REASON_MAX_CHARS = 2000;

function done(code: string): never {
  revalidatePath('/appeals');
  redirect(`/appeals?ok=${encodeURIComponent(code)}`);
}

function fail(code: string): never {
  redirect(`/appeals?error=${encodeURIComponent(code)}`);
}

function settle(result: ConsoleResult): never {
  if (result.ok) done(resultCode(result));
  fail(resultCode(result));
}

export async function disposeAppeal(formData: FormData): Promise<void> {
  const moderator = await requireModerator();
  const source = String(formData.get('source') ?? '').trim();
  const appealId = String(formData.get('appealId') ?? '').trim();
  const token = String(formData.get('token') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const version = Number(String(formData.get('version') ?? ''));
  const grant = String(formData.get('grant') ?? '') === 'grant';

  if (!appealId || token.length < 8) fail('invalid_input');
  if (!Number.isInteger(version) || version < 1) fail('invalid_input');
  if (reason === '' || reason.length > REASON_MAX_CHARS) fail('bad_reason');
  const auditAction = grant ? 'appeal_grant' : 'appeal_deny';
  if (!canRun(moderator, auditAction)) fail('insufficient_role');

  const admin = createAdminClient();
  if (source === 'screening') {
    settle(
      await enforceScreening(admin, {
        decisionId: appealId,
        expectedVersion: version,
        actorRef: moderator.email,
        action: grant ? 'appeal_grant' : 'appeal_deny',
        reason,
        actionToken: token,
      }),
    );
  }
  if (source !== 'moderation') fail('invalid_input');
  settle(
    await disposeModerationAppeal(admin, {
      appealId,
      expectedVersion: version,
      actorRef: moderator.email,
      grant,
      reason,
      actionToken: token,
    }),
  );
}

export async function claimAppeal(formData: FormData): Promise<void> {
  const moderator = await requireModerator();
  const appealId = String(formData.get('appealId') ?? '').trim();
  const token = String(formData.get('token') ?? '').trim();
  const release = String(formData.get('release') ?? '') === 'on';
  if (!appealId || token.length < 8) fail('invalid_input');

  const admin = createAdminClient();
  settle(
    await assignQueueItem(admin, {
      actorRef: moderator.email,
      queue: 'appeal',
      itemId: appealId,
      assigneeRef: release ? null : moderator.email,
      actionToken: token,
    }),
  );
}

export async function escalateAppeal(formData: FormData): Promise<void> {
  const moderator = await requireModerator();
  const appealId = String(formData.get('appealId') ?? '').trim();
  const token = String(formData.get('token') ?? '').trim();
  const level = String(formData.get('level') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  if (!appealId || token.length < 8) fail('invalid_input');
  if (level !== 'none' && level !== 'senior' && level !== 'admin') fail('bad_level');
  if (level !== 'none' && (reason === '' || reason.length > REASON_MAX_CHARS)) fail('bad_reason');
  if (level === 'none' && moderator.level < 2) fail('insufficient_role');

  const admin = createAdminClient();
  settle(
    await escalateQueueItem(admin, {
      actorRef: moderator.email,
      queue: 'appeal',
      itemId: appealId,
      level,
      reason,
      actionToken: token,
    }),
  );
}
