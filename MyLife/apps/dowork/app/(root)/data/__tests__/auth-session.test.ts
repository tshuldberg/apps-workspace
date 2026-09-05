import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isAnonymousSession, isAnonymousUser } from '../auth-session';

function makeSupabase(
  result: Awaited<ReturnType<SupabaseClient['auth']['getSession']>>,
): SupabaseClient {
  return {
    auth: {
      getSession: vi.fn(async () => result),
    },
  } as unknown as SupabaseClient;
}

describe('isAnonymousUser', () => {
  it('treats missing users as anonymous', () => {
    expect(isAnonymousUser(null)).toBe(true);
  });

  it('treats Supabase anonymous users as anonymous', () => {
    expect(isAnonymousUser({ email: null, is_anonymous: true })).toBe(true);
  });

  it('treats users without email as anonymous', () => {
    expect(isAnonymousUser({ email: undefined, is_anonymous: false })).toBe(true);
  });

  it('treats email-backed users as recoverable', () => {
    expect(isAnonymousUser({ email: 'coach@dowork.app', is_anonymous: false })).toBe(false);
  });
});

describe('isAnonymousSession', () => {
  it('returns false for an email-backed session', async () => {
    const supabase = makeSupabase({
      data: {
        session: {
          user: { email: 'coach@dowork.app', is_anonymous: false },
        } as Awaited<ReturnType<SupabaseClient['auth']['getSession']>>['data']['session'],
      },
      error: null,
    });

    await expect(isAnonymousSession(supabase)).resolves.toBe(false);
  });

  it('fails closed when the session is missing', async () => {
    const supabase = makeSupabase({ data: { session: null }, error: null });
    await expect(isAnonymousSession(supabase)).resolves.toBe(true);
  });

  it('fails closed when Supabase returns an auth error', async () => {
    const supabase = makeSupabase({
      data: { session: null },
      error: { message: 'network down' } as Awaited<
        ReturnType<SupabaseClient['auth']['getSession']>
      >['error'],
    });

    await expect(isAnonymousSession(supabase)).resolves.toBe(true);
  });

  it('fails closed when reading the session throws', async () => {
    const supabase = {
      auth: {
        getSession: vi.fn(async () => {
          throw new Error('storage unavailable');
        }),
      },
    } as unknown as SupabaseClient;

    await expect(isAnonymousSession(supabase)).resolves.toBe(true);
  });
});
