import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  completeBestChefAuthLink,
  parseBestChefAuthLink,
} from '../auth-links';

function mockSupabase() {
  return {
    auth: {
      exchangeCodeForSession: vi.fn(async () => ({ data: {}, error: null })),
      setSession: vi.fn(async () => ({ data: {}, error: null })),
      verifyOtp: vi.fn(async () => ({ data: {}, error: null })),
    },
  } as unknown as SupabaseClient;
}

describe('BestChef auth deep-link helpers', () => {
  it('ignores URLs without auth callback parameters', () => {
    expect(parseBestChefAuthLink('bestchef://dish/pad-thai')).toBeNull();
  });

  it('parses PKCE code callbacks from native URLs', () => {
    expect(parseBestChefAuthLink('bestchef://auth-callback?code=abc&type=email')).toMatchObject({
      code: 'abc',
      type: 'email',
    });
  });

  it('parses implicit session callbacks from URL fragments', () => {
    expect(
      parseBestChefAuthLink('bestchef://auth-callback#access_token=at&refresh_token=rt&type=recovery'),
    ).toMatchObject({
      accessToken: 'at',
      refreshToken: 'rt',
      type: 'recovery',
    });
  });

  it('exchanges PKCE codes for sessions', async () => {
    const supabase = mockSupabase();
    const result = await completeBestChefAuthLink(supabase, 'bestchef://auth-callback?code=abc');

    expect(result).toMatchObject({ handled: true, action: 'code_exchange' });
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
  });

  it('sets implicit sessions from access and refresh tokens', async () => {
    const supabase = mockSupabase();
    const result = await completeBestChefAuthLink(
      supabase,
      'bestchef://auth-callback#access_token=at&refresh_token=rt&type=recovery',
    );

    expect(result).toMatchObject({ handled: true, action: 'session_set', isRecovery: true });
    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'at',
      refresh_token: 'rt',
    });
  });

  it('verifies token-hash links when custom email templates use token_hash', async () => {
    const supabase = mockSupabase();
    const result = await completeBestChefAuthLink(
      supabase,
      'bestchef://auth-callback?token_hash=hash&type=magiclink',
    );

    expect(result).toMatchObject({ handled: true, action: 'token_verified' });
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'hash',
      type: 'magiclink',
    });
  });

  it('surfaces auth provider callback errors', async () => {
    const supabase = mockSupabase();
    await expect(
      completeBestChefAuthLink(
        supabase,
        'bestchef://auth-callback?error=access_denied&error_description=Denied',
      ),
    ).rejects.toThrow('Denied');
  });
});
