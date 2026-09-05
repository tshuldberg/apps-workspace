import { describe, expect, it, vi } from 'vitest';
import {
  normalizeYearnEmail,
  normalizeYearnPhone,
  requestYearnEmailMagicLink,
  requestYearnPhoneOtp,
  startYearnGoogleAuth,
  verifyYearnPhoneOtp,
} from '../secondaryAuth';

function client(session: unknown = null) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session },
        error: null,
      }),
      signInWithOAuth: vi.fn().mockResolvedValue({
        data: { url: 'https://accounts.google.com/auth' },
        error: null,
      }),
      linkIdentity: vi.fn().mockResolvedValue({
        data: { url: 'https://accounts.google.com/link' },
        error: null,
      }),
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
      verifyOtp: vi.fn().mockResolvedValue({
        data: {
          session: { access_token: 'token' },
          user: { id: 'user-1' },
        },
        error: null,
      }),
    },
  };
}

describe('secondary auth helpers', () => {
  it('normalizes and validates emails and phones', () => {
    expect(normalizeYearnEmail(' Iris@Example.COM ')).toBe('iris@example.com');
    expect(() => normalizeYearnEmail('not-email')).toThrow('valid email');
    expect(normalizeYearnPhone('+1 (415) 555-2671')).toBe('+14155552671');
    expect(() => normalizeYearnPhone('415-555-2671')).toThrow('E.164');
  });

  it('starts Google sign-in when no session exists', async () => {
    const supabase = client();
    const openUrl = vi.fn().mockResolvedValue(undefined);

    await expect(startYearnGoogleAuth(
      supabase,
      'yearn://auth-callback',
      openUrl,
    )).resolves.toEqual({
      mode: 'sign_in',
      url: 'https://accounts.google.com/auth',
    });
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'yearn://auth-callback',
        scopes: 'openid email profile',
        skipBrowserRedirect: true,
      },
    });
    expect(openUrl).toHaveBeenCalledWith('https://accounts.google.com/auth');
  });

  it('links Google identity when a session already exists', async () => {
    const supabase = client({ user: { id: 'user-1' } });

    await expect(startYearnGoogleAuth(
      supabase,
      'yearn://auth-callback',
      vi.fn().mockResolvedValue(undefined),
    )).resolves.toEqual({
      mode: 'link',
      url: 'https://accounts.google.com/link',
    });
    expect(supabase.auth.linkIdentity).toHaveBeenCalled();
    expect(supabase.auth.signInWithOAuth).not.toHaveBeenCalled();
  });

  it('sends email magic links for sign-in and updates email for linked sessions', async () => {
    const anonymous = client();
    await requestYearnEmailMagicLink(anonymous, 'IRIS@EXAMPLE.COM', 'yearn://auth-callback');
    expect(anonymous.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'iris@example.com',
      options: {
        emailRedirectTo: 'yearn://auth-callback',
        shouldCreateUser: true,
      },
    });

    const existing = client({ user: { id: 'user-1' } });
    await requestYearnEmailMagicLink(existing, 'iris@example.com', 'yearn://auth-callback');
    expect(existing.auth.updateUser).toHaveBeenCalledWith(
      { email: 'iris@example.com' },
      { emailRedirectTo: 'yearn://auth-callback' },
    );
  });

  it('sends phone OTPs and verifies SMS codes', async () => {
    const supabase = client();
    await requestYearnPhoneOtp(supabase, '+1 415 555 2671');
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      phone: '+14155552671',
      options: {
        shouldCreateUser: true,
        channel: 'sms',
      },
    });

    await expect(verifyYearnPhoneOtp(
      supabase,
      '+1 415 555 2671',
      '123456',
    )).resolves.toEqual({
      session: { access_token: 'token' },
      user: { id: 'user-1' },
    });
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      phone: '+14155552671',
      token: '123456',
      type: 'sms',
    });
  });
});
