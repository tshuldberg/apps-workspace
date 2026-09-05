'use server';

import { redirect } from 'next/navigation';

import { isModeratorEmail } from '@/lib/allowlist';
import { moderatorAllowlist } from '@/lib/auth';
import { consoleOrigin } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * Both login actions normalize response time to a floor so allowlist
 * membership is not observable from latency. shouldCreateUser is false: the
 * console never creates accounts; moderators must already have a Supabase auth
 * account on this project.
 */
const MIN_RESPONSE_MS = 1000;

async function floorDelay(startedAt: number): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_RESPONSE_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_RESPONSE_MS - elapsed));
  }
}

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
      console.error(`mynews-console: signInWithOtp failed: ${error.message}`);
      await floorDelay(startedAt);
      redirect('/login?error=send_failed');
    }
  }

  await floorDelay(startedAt);
  redirect(genericDestination);
}

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
