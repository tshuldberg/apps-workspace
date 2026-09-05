'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireLevel, requireModerator } from '@/lib/auth';
import { grantModeratorRole, revokeModeratorRole } from '@/lib/console-integrity';
import { type ConsoleResult, resultCode } from '@/lib/console-result';
import { isModeratorRole } from '@/lib/roles';
import { createAdminClient } from '@/lib/supabase-admin';

/**
 * Role administration (plan 48 WP9). Admin-only here and in SQL: the RPCs check
 * that the ACTOR holds an active admin role, so a service-role caller that skipped
 * this action still cannot grant itself anything.
 *
 * The last active admin cannot be demoted or revoked, because an empty admin set
 * would leave nobody able to grant roles again short of a database bootstrap.
 */

function done(code: string): never {
  revalidatePath('/roles');
  redirect(`/roles?ok=${encodeURIComponent(code)}`);
}

function fail(code: string): never {
  redirect(`/roles?error=${encodeURIComponent(code)}`);
}

function settle(result: ConsoleResult): never {
  if (result.ok) done(resultCode(result));
  fail(resultCode(result));
}

export async function grantRole(formData: FormData): Promise<void> {
  const moderator = await requireModerator();
  if (!requireLevel(moderator, 'admin')) fail('insufficient_role');
  const targetRef = String(formData.get('targetRef') ?? '')
    .trim()
    .toLowerCase();
  const role = String(formData.get('role') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();
  if (!targetRef || !targetRef.includes('@')) fail('bad_ref');
  if (!isModeratorRole(role)) fail('bad_role');
  if (note.length > 2000) fail('bad_reason');

  const admin = createAdminClient();
  settle(await grantModeratorRole(admin, { actorRef: moderator.email, targetRef, role, note }));
}

export async function revokeRole(formData: FormData): Promise<void> {
  const moderator = await requireModerator();
  if (!requireLevel(moderator, 'admin')) fail('insufficient_role');
  const targetRef = String(formData.get('targetRef') ?? '')
    .trim()
    .toLowerCase();
  const note = String(formData.get('note') ?? '').trim();
  const confirm = String(formData.get('confirm') ?? '') === 'on';
  if (!targetRef) fail('bad_ref');
  if (note === '' || note.length > 2000) fail('bad_reason');
  // Revoking removes someone's access mid-shift, so it is confirmed explicitly.
  if (!confirm) fail('confirm_required');

  const admin = createAdminClient();
  settle(await revokeModeratorRole(admin, { actorRef: moderator.email, targetRef, note }));
}
