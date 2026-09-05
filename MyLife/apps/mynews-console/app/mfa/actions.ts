'use server';

import { redirect } from 'next/navigation';

import { enrollTotp, verifiedFactorId, verifyTotp } from '@/lib/mfa';
import { getModeratorSession } from '@/lib/auth';

/**
 * MFA enrolment and verification (plan 48 WP9).
 *
 * These are the only actions in the console that run for a session below aal2, so
 * they do NOT call requireModerator() (which would redirect here forever).
 * Instead they check the outer gate directly: the session must exist and its email
 * must be on the moderator allowlist. Nothing else is reachable, and neither
 * action touches moderation data.
 */

async function requireAllowlistedSession(): Promise<void> {
  const session = await getModeratorSession();
  if (session.status === 'signed-out') redirect('/login');
  // 'ok' and 'no-role' both mean the session already cleared MFA.
  if (session.status !== 'needs-mfa') redirect('/');
}

export async function startEnrollment(): Promise<void> {
  await requireAllowlistedSession();
  const result = await enrollTotp();
  if (!result.ok) redirect(`/mfa?error=${encodeURIComponent(result.code)}`);
  if (result.code !== 'enrolled') redirect('/mfa?error=enroll_failed');
  // The secret has to reach the moderator's authenticator app somehow. It travels
  // in the URL of a no-store, robots-noindex page over the console's own origin,
  // and is useless without the verify step that follows it.
  const params = new URLSearchParams({
    factorId: result.factorId,
    secret: result.secret,
    uri: result.uri,
  });
  redirect(`/mfa?${params.toString()}`);
}

export async function verifyEnrollment(formData: FormData): Promise<void> {
  await requireAllowlistedSession();
  const factorId = String(formData.get('factorId') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();
  if (!factorId || !code) redirect('/mfa?error=bad_code');

  const result = await verifyTotp({ factorId, code });
  if (!result.ok) redirect(`/mfa?error=${encodeURIComponent(result.code)}`);
  redirect('/');
}

/** Verify an existing factor for a session that has not used it yet. */
export async function verifyExistingFactor(formData: FormData): Promise<void> {
  await requireAllowlistedSession();
  const code = String(formData.get('code') ?? '').trim();
  const factorId = await verifiedFactorId();
  if (!factorId) redirect('/mfa?error=no_factor');
  if (!code) redirect('/mfa?error=bad_code');

  const result = await verifyTotp({ factorId, code });
  if (!result.ok) redirect(`/mfa?error=${encodeURIComponent(result.code)}`);
  redirect('/');
}
