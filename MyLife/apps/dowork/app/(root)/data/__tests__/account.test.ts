// DoWork account helper contract tests (password sign-in + auth callback).

import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  completeAuthCallback,
  parseAuthCallbackUrl,
  signInWithEmailPassword,
  updatePassword,
} from '../account';

function makeSupabase(result: { error: { message: string } | null }) {
  const signInWithPassword = vi.fn(async () => result);
  return {
    supabase: { auth: { signInWithPassword } } as unknown as SupabaseClient,
    signInWithPassword,
  };
}

describe('signInWithEmailPassword', () => {
  it('throws on an invalid email without calling supabase', async () => {
    const { supabase, signInWithPassword } = makeSupabase({ error: null });
    await expect(
      signInWithEmailPassword(supabase, { email: 'not-an-email', password: 'x' }),
    ).rejects.toThrow('valid email');
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('throws on an empty password without calling supabase', async () => {
    const { supabase, signInWithPassword } = makeSupabase({ error: null });
    await expect(
      signInWithEmailPassword(supabase, { email: 'a@b.co', password: '' }),
    ).rejects.toThrow('password');
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('normalizes the email and passes the password through', async () => {
    const { supabase, signInWithPassword } = makeSupabase({ error: null });
    const result = await signInWithEmailPassword(supabase, {
      email: '  Coach@DoWork.App ',
      password: 'hunter22',
    });
    expect(result).toEqual({ ok: true });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'coach@dowork.app',
      password: 'hunter22',
    });
  });

  it('maps a supabase auth error to an honest failure result', async () => {
    const { supabase } = makeSupabase({ error: { message: 'Invalid login credentials' } });
    const result = await signInWithEmailPassword(supabase, {
      email: 'a@b.co',
      password: 'wrong',
    });
    expect(result).toEqual({ ok: false, error: 'Invalid login credentials' });
  });
});

describe('parseAuthCallbackUrl', () => {
  it('reads a PKCE code and type from the query string', () => {
    const parsed = parseAuthCallbackUrl('dowork://auth-callback?code=abc123&type=magiclink');
    expect(parsed.code).toBe('abc123');
    expect(parsed.type).toBe('magiclink');
    expect(parsed.accessToken).toBeNull();
    expect(parsed.errorDescription).toBeNull();
  });

  it('reads implicit tokens and recovery type from the fragment', () => {
    const parsed = parseAuthCallbackUrl(
      'dowork://auth-callback#access_token=at&refresh_token=rt&type=recovery',
    );
    expect(parsed.accessToken).toBe('at');
    expect(parsed.refreshToken).toBe('rt');
    expect(parsed.type).toBe('recovery');
    expect(parsed.code).toBeNull();
  });

  it('merges query and fragment, query winning on conflicts', () => {
    const parsed = parseAuthCallbackUrl(
      'dowork://auth-callback?type=recovery#access_token=at&refresh_token=rt&type=magiclink',
    );
    expect(parsed.type).toBe('recovery');
    expect(parsed.accessToken).toBe('at');
  });

  it('surfaces error_description from either part', () => {
    const parsed = parseAuthCallbackUrl(
      'dowork://auth-callback#error=access_denied&error_description=Email+link+is+invalid+or+has+expired',
    );
    expect(parsed.errorDescription).toBe('Email link is invalid or has expired');
  });
});

interface AuthCallbackMocks {
  supabase: SupabaseClient;
  exchangeCodeForSession: ReturnType<typeof vi.fn>;
  setSession: ReturnType<typeof vi.fn>;
}

function makeCallbackSupabase(opts: {
  exchangeError?: { message: string } | null;
  setSessionError?: { message: string } | null;
  sessionUser?: { id: string } | null;
}): AuthCallbackMocks {
  const exchangeCodeForSession = vi.fn(async () => ({ error: opts.exchangeError ?? null }));
  const setSession = vi.fn(async () => ({ error: opts.setSessionError ?? null }));
  const getSession = vi.fn(async () => ({
    data: {
      session:
        opts.sessionUser === null ? null : { user: opts.sessionUser ?? { id: 'user-1' } },
    },
  }));
  return {
    supabase: {
      auth: { exchangeCodeForSession, setSession, getSession },
    } as unknown as SupabaseClient,
    exchangeCodeForSession,
    setSession,
  };
}

describe('completeAuthCallback', () => {
  it('exchanges a PKCE code and confirms the session', async () => {
    const { supabase, exchangeCodeForSession } = makeCallbackSupabase({});
    const result = await completeAuthCallback(supabase, {
      code: 'abc',
      accessToken: null,
      refreshToken: null,
      type: 'magiclink',
      errorDescription: null,
    });
    expect(result).toEqual({ ok: true, type: 'magiclink' });
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc');
  });

  it('sets implicit tokens as the session and keeps the recovery type', async () => {
    const { supabase, setSession } = makeCallbackSupabase({});
    const result = await completeAuthCallback(supabase, {
      code: null,
      accessToken: 'at',
      refreshToken: 'rt',
      type: 'recovery',
      errorDescription: null,
    });
    expect(result).toEqual({ ok: true, type: 'recovery' });
    expect(setSession).toHaveBeenCalledWith({ access_token: 'at', refresh_token: 'rt' });
  });

  it('fails honestly when the link carried no credentials', async () => {
    const { supabase, exchangeCodeForSession, setSession } = makeCallbackSupabase({});
    const result = await completeAuthCallback(supabase, {
      code: null,
      accessToken: null,
      refreshToken: null,
      type: null,
      errorDescription: null,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Request a new link');
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(setSession).not.toHaveBeenCalled();
  });

  it('propagates the provider error without calling supabase', async () => {
    const { supabase, exchangeCodeForSession } = makeCallbackSupabase({});
    const result = await completeAuthCallback(supabase, {
      code: 'abc',
      accessToken: null,
      refreshToken: null,
      type: null,
      errorDescription: 'Email link is invalid or has expired',
    });
    expect(result).toEqual({
      ok: false,
      error: 'Email link is invalid or has expired',
      type: null,
    });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('maps an exchange failure to an honest error', async () => {
    const { supabase } = makeCallbackSupabase({ exchangeError: { message: 'flow state expired' } });
    const result = await completeAuthCallback(supabase, {
      code: 'abc',
      accessToken: null,
      refreshToken: null,
      type: null,
      errorDescription: null,
    });
    expect(result).toEqual({ ok: false, error: 'flow state expired', type: null });
  });

  it('fails when no session materializes after the exchange', async () => {
    const { supabase } = makeCallbackSupabase({ sessionUser: null });
    const result = await completeAuthCallback(supabase, {
      code: 'abc',
      accessToken: null,
      refreshToken: null,
      type: null,
      errorDescription: null,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('did not complete');
  });
});

describe('updatePassword', () => {
  it('rejects short passwords without calling supabase', async () => {
    const updateUser = vi.fn(async () => ({ error: null }));
    const supabase = { auth: { updateUser } } as unknown as SupabaseClient;
    await expect(updatePassword(supabase, 'short')).rejects.toThrow('at least 8');
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('updates the password and maps errors honestly', async () => {
    const updateUser = vi.fn(async () => ({ error: null }));
    const supabase = { auth: { updateUser } } as unknown as SupabaseClient;
    expect(await updatePassword(supabase, 'long-enough-pass')).toEqual({ ok: true });
    expect(updateUser).toHaveBeenCalledWith({ password: 'long-enough-pass' });

    const failing = {
      auth: { updateUser: vi.fn(async () => ({ error: { message: 'weak password' } })) },
    } as unknown as SupabaseClient;
    expect(await updatePassword(failing, 'long-enough-pass')).toEqual({
      ok: false,
      error: 'weak password',
    });
  });
});
