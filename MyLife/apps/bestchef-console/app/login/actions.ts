'use server';

import { redirect } from 'next/navigation';

import { isModeratorEmail } from '@/lib/allowlist';
import { moderatorAllowlist } from '@/lib/auth';
import { consoleOrigin } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * Both login actions normalize response time to a floor so allowlist
 * membership is not observable from latency (review finding: the
 * non-member path used to return instantly while the member path made a
 * Supabase round trip). Best-effort: sends slower than the floor still
 * differ, but the common case is indistinguishable.
 */
const MIN_RESPONSE_MS = 1000;

async function floorDelay(startedAt: number): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_RESPONSE_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_RESPONSE_MS - elapsed));
  }
}

/**
 * Sends a magic link / OTP email. The allowlist is checked BEFORE any email
 * is sent, and the response is identical either way so the login form is not
 * an allowlist oracle. shouldCreateUser is false (founder decision
 * 2026-07-03): the console never creates accounts; moderators must already
 * have a Supabase auth account on this project.
 */
export async function sendMagicLink(formData: FormData): Promise<void> {
  const startedAt = Date.now();
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const genericDestination = '/login?sent=1';

  if (isModeratorEmail(email, moderatorAllowlist())) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${consoleOrigin()}/auth/callback`,
        shouldCreateUser: false,
      },
    });
    if (error) {
      console.error(`bestchef-console: signInWithOtp failed: ${error.message}`);
      await floorDelay(startedAt);
      redirect('/login?error=send_failed');
    }
  }

  await floorDelay(startedAt);
  redirect(genericDestination);
}

/**
 * Fallback path: the 6-digit code from the same email ({{ .Token }} in the
 * Supabase magic-link template). Works even when the deployment's redirect
 * URL is not yet allowlisted in the Supabase dashboard.
 */
export async function verifyLoginCode(formData: FormData): Promise<void> {
  const startedAt = Date.now();
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const token = String(formData.get('token') ?? '').trim();

  if (token && isModeratorEmail(email, moderatorAllowlist())) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (!error) {
      redirect('/');
    }
  }

  await floorDelay(startedAt);
  redirect('/login?error=invalid_code');
}
