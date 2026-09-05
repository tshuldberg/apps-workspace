// DoWork account lifecycle helpers.
//
// Wraps Supabase auth flows for DoWork: anonymous sign-in, email magic
// link, password recovery, sign-out, and account deletion. Mirrors the
// BestChef account.ts shape but talks to DoWork's own Supabase project
// and `dw_*` tables.

import type { SupabaseClient, User } from '@supabase/supabase-js';

export interface DoWorkAccountResult {
  ok: boolean;
  error?: string;
}

export interface DoWorkSignupParams {
  email: string;
  redirectUrl: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function assertEmail(email: string): string {
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Enter a valid email address.');
  }
  return normalized;
}

export async function ensureAnonymousSession(
  supabase: SupabaseClient,
): Promise<User> {
  const sessionResult = await supabase.auth.getSession();
  const sessionUser = sessionResult.data.session?.user;
  if (sessionUser) return sessionUser;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Anonymous sign-in did not return a user.');
  return data.user;
}

export async function requestEmailMagicLink(
  supabase: SupabaseClient,
  params: DoWorkSignupParams,
): Promise<DoWorkAccountResult> {
  const email = assertEmail(params.email);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: params.redirectUrl },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface DoWorkPasswordParams {
  email: string;
  password: string;
}

export async function signInWithEmailPassword(
  supabase: SupabaseClient,
  params: DoWorkPasswordParams,
): Promise<DoWorkAccountResult> {
  const email = assertEmail(params.email);
  if (!params.password) {
    throw new Error('Enter your password.');
  }
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: params.password,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function requestPasswordReset(
  supabase: SupabaseClient,
  params: DoWorkSignupParams,
): Promise<DoWorkAccountResult> {
  const email = assertEmail(params.email);
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: params.redirectUrl,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Auth callback (magic link + password recovery deep links) ──────────────
//
// Supabase email links land on dowork://auth-callback carrying either a PKCE
// `?code=` (query) or implicit `#access_token=...&refresh_token=...` tokens
// (fragment). The client has `detectSessionInUrl: false` (React Native), so
// the callback screen must exchange these into a session explicitly.

export interface ParsedAuthCallback {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** Supabase link type: 'recovery', 'magiclink', 'signup', 'email_change'. */
  type: string | null;
  errorDescription: string | null;
}

function collectParams(url: string): URLSearchParams {
  const merged = new URLSearchParams();
  const fragmentSplit = url.split('#');
  const beforeFragment = fragmentSplit[0] ?? '';
  const querySplit = beforeFragment.split('?');
  const query = querySplit.slice(1).join('?');
  const fragment = fragmentSplit.slice(1).join('#');
  for (const part of [query, fragment]) {
    if (!part) continue;
    for (const [key, value] of new URLSearchParams(part)) {
      if (!merged.has(key)) merged.set(key, value);
    }
  }
  return merged;
}

export function parseAuthCallbackUrl(url: string): ParsedAuthCallback {
  const params = collectParams(url);
  const errorDescription = params.get('error_description') ?? params.get('error') ?? null;
  return {
    code: params.get('code'),
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    type: params.get('type'),
    errorDescription,
  };
}

export interface AuthCallbackResult extends DoWorkAccountResult {
  /** Link type carried through so the caller can route recovery flows. */
  type: string | null;
}

export async function completeAuthCallback(
  supabase: SupabaseClient,
  parsed: ParsedAuthCallback,
): Promise<AuthCallbackResult> {
  if (parsed.errorDescription) {
    return { ok: false, error: parsed.errorDescription, type: parsed.type };
  }

  if (parsed.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(parsed.code);
    if (error) return { ok: false, error: error.message, type: parsed.type };
  } else if (parsed.accessToken && parsed.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: parsed.accessToken,
      refresh_token: parsed.refreshToken,
    });
    if (error) return { ok: false, error: error.message, type: parsed.type };
  } else {
    return {
      ok: false,
      error: 'This sign-in link is missing its credentials. Request a new link and try again.',
      type: parsed.type,
    };
  }

  const sessionResult = await supabase.auth.getSession();
  if (!sessionResult.data.session?.user) {
    return {
      ok: false,
      error: 'Sign-in did not complete. Request a new link and try again.',
      type: parsed.type,
    };
  }
  return { ok: true, type: parsed.type };
}

export async function updatePassword(
  supabase: SupabaseClient,
  newPassword: string,
): Promise<DoWorkAccountResult> {
  if (newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signOut(
  supabase: SupabaseClient,
): Promise<DoWorkAccountResult> {
  const { error } = await supabase.auth.signOut();
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function requestAccountDeletion(
  supabase: SupabaseClient,
): Promise<DoWorkAccountResult> {
  // The actual data wipe runs server-side in the dowork-delete-account
  // edge function; this just invokes the function with the current user's
  // session token.
  const { error } = await supabase.functions.invoke('dowork-delete-account', {
    body: {},
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
