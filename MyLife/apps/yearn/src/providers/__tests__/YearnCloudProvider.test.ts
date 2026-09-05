import { describe, expect, it, vi } from 'vitest';
import type { Session, User } from '@supabase/supabase-js';
import {
  getYearnAuthProviders,
  isYearnAnonymousUser,
  restoreYearnSession,
  signOutYearnSession,
} from '../../lib/authSession';

function user(overrides: Partial<User>): User {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-05-31T00:00:00Z',
    user_metadata: {},
    ...overrides,
  } as User;
}

function session(sessionUser: User): Session {
  return {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: sessionUser,
  } as Session;
}

describe('YearnCloudProvider helpers', () => {
  it('collects unique auth providers from restored Supabase users', () => {
    const restoredUser = user({
      email: 'iris@example.com',
      identities: [
        { provider: 'apple' },
        { provider: 'email' },
        { provider: 'apple' },
      ],
    } as Partial<User>);

    expect(getYearnAuthProviders(restoredUser)).toEqual(['email', 'apple']);
  });

  it('detects anonymous users without treating empty provider metadata as anonymous', () => {
    expect(isYearnAnonymousUser(user({ is_anonymous: true }))).toBe(true);
    expect(isYearnAnonymousUser(user({ identities: [{ provider: 'anonymous' }] } as Partial<User>))).toBe(true);
    expect(isYearnAnonymousUser(user({ identities: [] } as Partial<User>))).toBe(false);
    expect(isYearnAnonymousUser(null)).toBe(false);
  });

  it('restores a persisted Supabase session', async () => {
    const restoredUser = user({ email: 'iris@example.com' });
    const restoredSession = session(restoredUser);
    const getSession = vi.fn().mockResolvedValue({
      data: { session: restoredSession },
      error: null,
    });

    await expect(restoreYearnSession({ auth: { getSession } })).resolves.toEqual({
      session: restoredSession,
      user: restoredUser,
    });
  });

  it('surfaces Supabase restore errors', async () => {
    const getSession = vi.fn().mockResolvedValue({
      data: { session: null },
      error: { message: 'refresh token expired' },
    });

    await expect(restoreYearnSession({ auth: { getSession } })).rejects.toThrow(
      'refresh token expired',
    );
  });

  it('signs out through Supabase and surfaces failures', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    await expect(signOutYearnSession({ auth: { signOut } })).resolves.toBeUndefined();

    const failingSignOut = vi.fn().mockResolvedValue({
      error: { message: 'network unavailable' },
    });
    await expect(signOutYearnSession({ auth: { signOut: failingSignOut } })).rejects.toThrow(
      'network unavailable',
    );
  });
});
