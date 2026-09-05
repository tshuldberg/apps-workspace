import type { Session, User } from '@supabase/supabase-js';

export interface YearnSessionSnapshot {
  session: Session | null;
  user: User | null;
}

interface YearnSessionReader {
  auth: {
    getSession: () => Promise<{
      data: { session: Session | null };
      error: { message: string } | null;
    }>;
  };
}

interface YearnSessionSigner {
  auth: {
    signOut: () => Promise<{
      error: { message: string } | null;
    }>;
  };
}

export function getYearnAuthProviders(user: User | null): string[] {
  if (!user) return [];

  const providers = new Set<string>();
  if (user.is_anonymous) providers.add('anonymous');
  if (user.email) providers.add('email');
  if (user.phone) providers.add('phone');

  for (const identity of user.identities ?? []) {
    if (identity.provider) providers.add(identity.provider);
  }

  return [...providers];
}

export function isYearnAnonymousUser(user: User | null): boolean {
  if (!user) return false;
  const providers = getYearnAuthProviders(user);
  return user.is_anonymous === true
    || (providers.length > 0 && providers.every((provider) => provider === 'anonymous'));
}

export async function restoreYearnSession(
  client: YearnSessionReader,
): Promise<YearnSessionSnapshot> {
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error(error.message);
  const session = data.session ?? null;
  return {
    session,
    user: session?.user ?? null,
  };
}

export async function signOutYearnSession(
  client: YearnSessionSigner,
): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) throw new Error(error.message);
}
