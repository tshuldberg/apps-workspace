import type { Session, User } from '@supabase/supabase-js';
import type { YearnSessionSnapshot } from './authSession';

export type YearnOAuthMode = 'sign_in' | 'link';

export interface YearnOAuthStartResult {
  mode: YearnOAuthMode;
  url: string;
}

interface YearnSecondaryAuthClient {
  auth: {
    getSession: () => Promise<{
      data: { session: Session | null };
      error: { message: string } | null;
    }>;
    signInWithOAuth: (credentials: {
      provider: 'google';
      options: {
        redirectTo: string;
        scopes: string;
        skipBrowserRedirect: true;
      };
    }) => Promise<{
      data: { url: string | null };
      error: { message: string } | null;
    }>;
    linkIdentity: (credentials: {
      provider: 'google';
      options: {
        redirectTo: string;
        scopes: string;
        skipBrowserRedirect: true;
      };
    }) => Promise<{
      data: { url: string | null };
      error: { message: string } | null;
    }>;
    signInWithOtp: (credentials:
      | {
          email: string;
          options: {
            emailRedirectTo: string;
            shouldCreateUser: true;
          };
        }
      | {
          phone: string;
          options: {
            shouldCreateUser: true;
            channel: 'sms';
          };
        }) => Promise<{
      error: { message: string } | null;
    }>;
    updateUser: (
      attributes: {
        email?: string;
        phone?: string;
      },
      options?: {
        emailRedirectTo?: string;
      },
    ) => Promise<{
      data: { user: User | null };
      error: { message: string } | null;
    }>;
    verifyOtp: (params: {
      phone: string;
      token: string;
      type: 'sms';
    }) => Promise<{
      data: { session: Session | null; user: User | null };
      error: { message: string } | null;
    }>;
  };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

function assertSupabaseError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export function normalizeYearnEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new Error('Enter a valid email address.');
  }
  return normalized;
}

export function normalizeYearnPhone(phone: string): string {
  const normalized = phone.replace(/[\s().-]/g, '').trim();
  if (!PHONE_PATTERN.test(normalized)) {
    throw new Error('Enter a phone number in E.164 format, such as +14155552671.');
  }
  return normalized;
}

async function hasRestoredSession(client: YearnSecondaryAuthClient): Promise<boolean> {
  const { data, error } = await client.auth.getSession();
  assertSupabaseError(error);
  return Boolean(data.session?.user);
}

export async function startYearnGoogleAuth(
  client: YearnSecondaryAuthClient,
  redirectTo: string,
  openUrl: (url: string) => Promise<void>,
): Promise<YearnOAuthStartResult> {
  const options = {
    redirectTo,
    scopes: 'openid email profile',
    skipBrowserRedirect: true as const,
  };
  const linked = await hasRestoredSession(client);
  const result = linked
    ? await client.auth.linkIdentity({ provider: 'google', options })
    : await client.auth.signInWithOAuth({ provider: 'google', options });

  assertSupabaseError(result.error);

  if (!result.data.url) {
    throw new Error('Google did not return an OAuth URL.');
  }

  await openUrl(result.data.url);
  return {
    mode: linked ? 'link' : 'sign_in',
    url: result.data.url,
  };
}

export async function requestYearnEmailMagicLink(
  client: YearnSecondaryAuthClient,
  email: string,
  redirectTo: string,
): Promise<string> {
  const normalizedEmail = normalizeYearnEmail(email);
  const linked = await hasRestoredSession(client);

  if (linked) {
    const { error } = await client.auth.updateUser(
      { email: normalizedEmail },
      { emailRedirectTo: redirectTo },
    );
    assertSupabaseError(error);
    return normalizedEmail;
  }

  const { error } = await client.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
    },
  });
  assertSupabaseError(error);
  return normalizedEmail;
}

export async function requestYearnPhoneOtp(
  client: YearnSecondaryAuthClient,
  phone: string,
): Promise<string> {
  const normalizedPhone = normalizeYearnPhone(phone);
  const linked = await hasRestoredSession(client);

  if (linked) {
    const { error } = await client.auth.updateUser({ phone: normalizedPhone });
    assertSupabaseError(error);
    return normalizedPhone;
  }

  const { error } = await client.auth.signInWithOtp({
    phone: normalizedPhone,
    options: {
      shouldCreateUser: true,
      channel: 'sms',
    },
  });
  assertSupabaseError(error);
  return normalizedPhone;
}

export async function verifyYearnPhoneOtp(
  client: YearnSecondaryAuthClient,
  phone: string,
  token: string,
): Promise<YearnSessionSnapshot> {
  const normalizedPhone = normalizeYearnPhone(phone);
  const normalizedToken = token.trim();

  if (!/^\d{6}$/.test(normalizedToken)) {
    throw new Error('Enter the 6-digit SMS code.');
  }

  const { data, error } = await client.auth.verifyOtp({
    phone: normalizedPhone,
    token: normalizedToken,
    type: 'sms',
  });
  assertSupabaseError(error);

  return {
    session: data.session,
    user: data.user,
  };
}
