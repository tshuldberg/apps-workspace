import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';

import { isModeratorEmail } from '@/lib/allowlist';
import { moderatorAllowlist } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest): Promise<void> {
  const code = new URL(request.url).searchParams.get('code');
  if (!code) {
    redirect('/login?error=auth_failed');
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    redirect('/login?error=auth_failed');
  }

  // A non-allowlisted account can complete Supabase auth (the consumer app
  // shares the project); never leave it with a console session cookie.
  // scope 'local' so rejection never revokes their consumer-app sessions.
  if (!isModeratorEmail(data.user?.email, moderatorAllowlist())) {
    await supabase.auth.signOut({ scope: 'local' });
    redirect('/login?error=not_authorized');
  }

  redirect('/');
}
