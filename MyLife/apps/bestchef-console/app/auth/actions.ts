'use server';

import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  // scope 'local': the Supabase project is shared with the consumer app, so
  // a console sign-out must never revoke the moderator's consumer sessions.
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/login');
}
