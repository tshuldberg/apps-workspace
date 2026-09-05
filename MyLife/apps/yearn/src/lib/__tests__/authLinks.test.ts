import { describe, expect, it, vi } from 'vitest';
import { completeYearnAuthLink, parseYearnAuthLink } from '../authLinks';

function client() {
  return {
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
      verifyOtp: vi.fn().mockResolvedValue({ error: null }),
    },
  };
}

describe('Yearn auth links', () => {
  it('ignores URLs without auth params', () => {
    expect(parseYearnAuthLink('yearn://discover?tab=likes')).toBeNull();
  });

  it('parses query and hash auth signals', () => {
    expect(parseYearnAuthLink('yearn://auth-callback?code=abc&type=magiclink'))
      .toEqual(expect.objectContaining({
        code: 'abc',
        type: 'magiclink',
      }));

    expect(parseYearnAuthLink('yearn://auth-callback#access_token=at&refresh_token=rt'))
      .toEqual(expect.objectContaining({
        accessToken: 'at',
        refreshToken: 'rt',
      }));
  });

  it('exchanges OAuth codes through Supabase', async () => {
    const supabase = client();

    await expect(completeYearnAuthLink(
      supabase,
      'yearn://auth-callback?code=abc&type=magiclink',
    )).resolves.toEqual({
      handled: true,
      action: 'code_exchange',
      isRecovery: false,
    });
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
  });

  it('rejects raw session tokens in links to prevent session fixation', async () => {
    const supabase = client();

    await expect(completeYearnAuthLink(
      supabase,
      'yearn://auth-callback#access_token=at&refresh_token=rt&type=recovery',
    )).rejects.toThrow('This sign-in link format is not supported.');
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('rejects partial raw-token links instead of ignoring them', async () => {
    await expect(completeYearnAuthLink(
      client(),
      'yearn://auth-callback#access_token=at',
    )).rejects.toThrow('This sign-in link format is not supported.');
  });

  it('verifies token hash links with supported OTP types', async () => {
    const supabase = client();

    await completeYearnAuthLink(
      supabase,
      'yearn://auth-callback?token_hash=hash&type=email',
    );

    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'hash',
      type: 'email',
    });
  });

  it('surfaces provider errors from callback links', async () => {
    await expect(completeYearnAuthLink(
      client(),
      'yearn://auth-callback?error=access_denied&error_description=Denied+by+provider',
    )).rejects.toThrow('Denied by provider');
  });
});
