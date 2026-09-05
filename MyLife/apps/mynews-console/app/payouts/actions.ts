'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireLevel, requireModerator } from '@/lib/auth';
import { proposePayoutAction } from '@/lib/console-integrity';
import { type ConsoleResult, resultCode } from '@/lib/console-result';
import { createAdminClient } from '@/lib/supabase-admin';

/**
 * Payment-adjacent enforcement (plan 48 WP9).
 *
 * Blocking a journalist's payout account stops money moving to them. There is no
 * single-moderator path to it: this action PROPOSES, and an admin who is not the
 * proposer has to approve it on /approvals before the account state changes. The
 * same applies to unblocking, because quietly turning payouts back on is the
 * mirror-image risk.
 *
 * The support ledger stays append-only and untouched. This changes who can be
 * paid, never what was recorded.
 */

const REASON_MAX_CHARS = 2000;

function done(code: string): never {
  revalidatePath('/payouts');
  redirect(`/payouts?ok=${encodeURIComponent(code)}`);
}

function fail(code: string): never {
  redirect(`/payouts?error=${encodeURIComponent(code)}`);
}

function settle(result: ConsoleResult): never {
  if (result.ok) done(resultCode(result));
  fail(resultCode(result));
}

async function propose(formData: FormData, block: boolean): Promise<never> {
  const moderator = await requireModerator();
  if (!requireLevel(moderator, 'admin')) fail('insufficient_role');
  const journalistProfileId = String(formData.get('profileId') ?? '').trim();
  const token = String(formData.get('token') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const version = Number(String(formData.get('version') ?? ''));
  const confirm = String(formData.get('confirm') ?? '') === 'on';
  if (!journalistProfileId || token.length < 8) fail('invalid_input');
  if (!Number.isInteger(version) || version < 1) fail('invalid_input');
  if (reason === '' || reason.length > REASON_MAX_CHARS) fail('bad_reason');
  if (!confirm) fail('confirm_required');

  const admin = createAdminClient();
  settle(
    await proposePayoutAction(admin, {
      journalistProfileId,
      expectedVersion: version,
      actorRef: moderator.email,
      block,
      reason,
      actionToken: token,
    }),
  );
}

export async function proposeBlock(formData: FormData): Promise<void> {
  await propose(formData, true);
}

export async function proposeUnblock(formData: FormData): Promise<void> {
  await propose(formData, false);
}
