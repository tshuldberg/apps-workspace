import type { SupabaseClient, User } from '@supabase/supabase-js';

type SessionUser = Pick<User, 'email' | 'is_anonymous'>;

export function isAnonymousUser(user: SessionUser | null | undefined): boolean {
  if (!user) return true;
  return user.is_anonymous === true || !user.email;
}

export async function isAnonymousSession(
  supabase: Pick<SupabaseClient, 'auth'> | null | undefined,
): Promise<boolean> {
  if (!supabase) return true;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return true;
    return isAnonymousUser(data.session?.user);
  } catch {
    return true;
  }
}
