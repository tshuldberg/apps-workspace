import { beforeEach, describe, expect, it, vi } from 'vitest';

const appleAuth = vi.hoisted(() => ({
  isAvailableAsync: vi.fn(),
  signInAsync: vi.fn(),
  AppleAuthenticationScope: {
    FULL_NAME: 0,
    EMAIL: 1,
  },
}));

const crypto = vi.hoisted(() => ({
  getRandomBytes: vi.fn(),
  digestStringAsync: vi.fn(),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
}));

vi.mock('expo-apple-authentication', () => appleAuth);
vi.mock('expo-crypto', () => crypto);

import {
  buildYearnAppleUserMetadata,
  createYearnAppleNonce,
  formatYearnAppleFullName,
  isYearnAppleSignInAvailable,
  isYearnAppleSignInCanceled,
  signInWithYearnApple,
} from '../appleSignIn';

describe('appleSignIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    crypto.getRandomBytes.mockReturnValue(new Uint8Array([251, 255, 238]));
    crypto.digestStringAsync.mockResolvedValue('hashed-nonce');
  });

  it('creates base64url nonces from secure random bytes', () => {
    expect(createYearnAppleNonce(3)).toBe('-__u');
    expect(crypto.getRandomBytes).toHaveBeenCalledWith(3);
  });

  it('formats Apple name parts for profile metadata', () => {
    expect(formatYearnAppleFullName({
      namePrefix: null,
      givenName: 'Iris',
      middleName: 'M',
      familyName: 'Rivera',
      nameSuffix: null,
      nickname: null,
    })).toBe('Iris M Rivera');

    expect(formatYearnAppleFullName({
      namePrefix: null,
      givenName: null,
      middleName: null,
      familyName: null,
      nameSuffix: null,
      nickname: 'IR',
    })).toBe('IR');
  });

  it('builds Apple metadata only from returned credential fields', () => {
    expect(buildYearnAppleUserMetadata({
      user: 'apple-stable-user',
      email: 'iris@example.com',
      fullName: {
        namePrefix: null,
        givenName: 'Iris',
        middleName: null,
        familyName: 'Rivera',
        nameSuffix: null,
        nickname: null,
      },
    })).toEqual({
      full_name: 'Iris Rivera',
      name: 'Iris Rivera',
      email: 'iris@example.com',
      apple_user: 'apple-stable-user',
    });
  });

  it('checks native Apple sign-in availability', async () => {
    appleAuth.isAvailableAsync.mockResolvedValue(true);

    await expect(isYearnAppleSignInAvailable()).resolves.toBe(true);
  });

  it('signs into Supabase with the raw nonce and stores returned Apple profile data', async () => {
    appleAuth.signInAsync.mockResolvedValue({
      user: 'apple-stable-user',
      identityToken: 'identity-token',
      authorizationCode: 'auth-code',
      email: 'iris@example.com',
      fullName: {
        namePrefix: null,
        givenName: 'Iris',
        middleName: null,
        familyName: 'Rivera',
        nameSuffix: null,
        nickname: null,
      },
      realUserStatus: 2,
      state: null,
    });
    const session = { access_token: 'token', user: { id: 'user-1' } };
    const updatedUser = { id: 'user-1', user_metadata: { full_name: 'Iris Rivera' } };
    const signInWithIdToken = vi.fn().mockResolvedValue({
      data: { session, user: session.user },
      error: null,
    });
    const updateUser = vi.fn().mockResolvedValue({
      data: { user: updatedUser },
      error: null,
    });

    await expect(signInWithYearnApple({
      auth: { signInWithIdToken, updateUser },
    })).resolves.toEqual({
      session,
      user: updatedUser,
    });

    expect(appleAuth.signInAsync).toHaveBeenCalledWith({
      requestedScopes: [0, 1],
      nonce: 'hashed-nonce',
    });
    expect(signInWithIdToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'identity-token',
      nonce: '-__u',
    });
    expect(updateUser).toHaveBeenCalledWith({
      data: {
        full_name: 'Iris Rivera',
        name: 'Iris Rivera',
        email: 'iris@example.com',
        apple_user: 'apple-stable-user',
      },
    });
  });

  it('treats native Apple cancellation as a quiet cancel path', async () => {
    appleAuth.signInAsync.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });

    await expect(signInWithYearnApple({
      auth: {
        signInWithIdToken: vi.fn(),
        updateUser: vi.fn(),
      },
    })).rejects.toThrow('Apple sign-in was canceled.');
    await expect(signInWithYearnApple({
      auth: {
        signInWithIdToken: vi.fn(),
        updateUser: vi.fn(),
      },
    }).catch((err) => isYearnAppleSignInCanceled(err))).resolves.toBe(true);
  });
});
