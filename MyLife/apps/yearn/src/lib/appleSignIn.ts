import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import type { Session, User } from '@supabase/supabase-js';
import type { YearnSessionSnapshot } from './authSession';

interface YearnAppleAuthClient {
  auth: {
    signInWithIdToken: (credentials: {
      provider: 'apple';
      token: string;
      nonce: string;
    }) => Promise<{
      data: { session: Session | null; user: User | null };
      error: { message: string } | null;
    }>;
    updateUser: (attributes: {
      data: Record<string, unknown>;
    }) => Promise<{
      data: { user: User | null };
      error: { message: string } | null;
    }>;
  };
}

export class YearnAppleSignInCanceledError extends Error {
  constructor() {
    super('Apple sign-in was canceled.');
    this.name = 'YearnAppleSignInCanceledError';
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const first = bytes[i] ?? 0;
    const second = bytes[i + 1] ?? 0;
    const third = bytes[i + 2] ?? 0;
    const value = (first << 16) | (second << 8) | third;

    output += alphabet[(value >> 18) & 63];
    output += alphabet[(value >> 12) & 63];
    output += i + 1 < bytes.length ? alphabet[(value >> 6) & 63] : '=';
    output += i + 2 < bytes.length ? alphabet[value & 63] : '=';
  }

  return output.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function createYearnAppleNonce(byteCount = 32): string {
  return base64UrlEncode(Crypto.getRandomBytes(byteCount));
}

export async function hashYearnAppleNonce(rawNonce: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
}

export function formatYearnAppleFullName(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null,
): string | null {
  if (!fullName) return null;

  const parts = [
    fullName.givenName,
    fullName.middleName,
    fullName.familyName,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  if (parts.length > 0) return parts.join(' ');
  return fullName.nickname?.trim() || null;
}

export function buildYearnAppleUserMetadata(
  credential: Pick<
    AppleAuthentication.AppleAuthenticationCredential,
    'email' | 'fullName' | 'user'
  >,
): Record<string, unknown> {
  const displayName = formatYearnAppleFullName(credential.fullName);
  return {
    ...(displayName ? { full_name: displayName, name: displayName } : {}),
    ...(credential.email ? { email: credential.email } : {}),
    apple_user: credential.user,
  };
}

export function isYearnAppleSignInCanceled(err: unknown): boolean {
  if (err instanceof YearnAppleSignInCanceledError) return true;
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? (err as { code?: unknown }).code : null;
  return code === 'ERR_REQUEST_CANCELED';
}

export async function isYearnAppleSignInAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync();
}

export async function signInWithYearnApple(
  client: YearnAppleAuthClient,
): Promise<YearnSessionSnapshot> {
  const rawNonce = createYearnAppleNonce();
  const hashedNonce = await hashYearnAppleNonce(rawNonce);
  let credential: AppleAuthentication.AppleAuthenticationCredential;

  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (err) {
    if (isYearnAppleSignInCanceled(err)) {
      throw new YearnAppleSignInCanceledError();
    }
    throw err;
  }

  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity token.');
  }

  const { data, error } = await client.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw new Error(error.message);

  const metadata = buildYearnAppleUserMetadata(credential);
  const updateResult = await client.auth.updateUser({ data: metadata });
  if (updateResult.error) throw new Error(updateResult.error.message);

  return {
    session: data.session,
    user: updateResult.data.user ?? data.user,
  };
}
