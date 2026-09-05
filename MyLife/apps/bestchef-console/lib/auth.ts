import 'server-only';

import { redirect } from 'next/navigation';

import { isModeratorEmail, parseModeratorAllowlist } from './allowlist';
import { moderatorEmailsRaw } from './env';
import { createSupabaseServerClient } from './supabase-server';

export function moderatorAllowlist(): string[] {
  return parseModeratorAllowlist(moderatorEmailsRaw());
}

/**
 * Returns the signed-in moderator's email, or null when there is no session
 * or the session's email is not on the allowlist. Uses getUser() (server-side
 * JWT verification), never getSession().
 */
export async function getModeratorEmail(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? null;
  return isModeratorEmail(email, moderatorAllowlist()) ? email : null;
}

/**
 * Page/action guard. Middleware already gates routes, but every page and
 * server action calls this too so a matcher gap can never become an
 * authorization gap.
 */
export async function requireModerator(): Promise<string> {
  const email = await getModeratorEmail();
  if (!email) redirect('/login');
  return email;
}
