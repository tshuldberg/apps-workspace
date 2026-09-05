'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireModerator } from '@/lib/auth';
import {
  cancelPendingAction,
  decidePendingAction,
  expirePendingActions,
} from '@/lib/console-integrity';
import { type ConsoleResult, resultCode } from '@/lib/console-result';
import { createAdminClient } from '@/lib/supabase-admin';

/**
 * Dual-control decisions (plan 48 WP9).
 *
 * A pending action is a high-impact enforcement step that one moderator proposed
 * and a DIFFERENT moderator has to approve: suspensions over 7 days, account
 * terminations, content restorations, and payout block/unblock.
 *
 * Approval and execution happen in ONE transaction inside
 * nw_console_decide_pending_action. If the execution fails, the approval rolls
 * back with it and the proposal is marked failed, so there is no state where a
 * proposal reads as approved but nothing was applied.
 *
 * Self-approval is refused by a CHECK constraint on nw_pending_actions, so the
 * rule holds even for a caller that never went through this action.
 */

const REASON_MAX_CHARS = 2000;

function done(code: string): never {
  revalidatePath('/approvals');
  redirect(`/approvals?ok=${encodeURIComponent(code)}`);
}

function fail(code: string): never {
  redirect(`/approvals?error=${encodeURIComponent(code)}`);
}

function settle(result: ConsoleResult): never {
  if (result.ok) done(resultCode(result));
  fail(resultCode(result));
}

export async function approvePending(formData: FormData): Promise<void> {
  await decide(formData, true);
}

export async function rejectPending(formData: FormData): Promise<void> {
  await decide(formData, false);
}

async function decide(formData: FormData, approve: boolean): Promise<never> {
  const moderator = await requireModerator();
  const pendingId = String(formData.get('pendingId') ?? '').trim();
  const token = String(formData.get('token') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const confirm = String(formData.get('confirm') ?? '') === 'on';
  if (!pendingId || token.length < 8) fail('invalid_input');
  if (reason === '' || reason.length > REASON_MAX_CHARS) fail('bad_reason');
  // Approving executes real enforcement, so it takes an explicit confirmation.
  if (approve && !confirm) fail('confirm_required');

  const admin = createAdminClient();
  settle(
    await decidePendingAction(admin, {
      pendingId,
      actorRef: moderator.email,
      approve,
      reason,
      actionToken: token,
    }),
  );
}

/** Withdraw your own proposal. Only the proposer can, and the RPC checks that. */
export async function cancelPending(formData: FormData): Promise<void> {
  const moderator = await requireModerator();
  const pendingId = String(formData.get('pendingId') ?? '').trim();
  const token = String(formData.get('token') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  if (!pendingId || token.length < 8) fail('invalid_input');
  if (reason === '' || reason.length > REASON_MAX_CHARS) fail('bad_reason');

  const admin = createAdminClient();
  settle(
    await cancelPendingAction(admin, {
      pendingId,
      actorRef: moderator.email,
      reason,
      actionToken: token,
    }),
  );
}

/** Expire proposals nobody answered, instead of leaving them approvable. */
export async function expireStaleProposals(): Promise<void> {
  await requireModerator();
  const admin = createAdminClient();
  const count = await expirePendingActions(admin);
  done(count > 0 ? `expired_${count}` : 'expired_none');
}
