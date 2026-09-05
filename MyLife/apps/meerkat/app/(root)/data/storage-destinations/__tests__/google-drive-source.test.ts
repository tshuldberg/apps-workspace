import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GOOGLE_DRIVE_NATIVE_CREDENTIAL_PREFIX,
  GOOGLE_DRIVE_NATIVE_SCOPES,
  GOOGLE_DRIVE_REFRESH_TOKEN_KEY_PREFIX,
  createGoogleDriveNativeTokenSource,
  loadOptionalExpoAuthSession,
  type ExpoAuthDiscovery,
  type ExpoAuthPromptResult,
  type ExpoAuthRequest,
  type ExpoAuthSessionModule,
  type ExpoTokenResponse,
  type NativeRefreshTokenStore,
} from '../google-drive-source';

const NOW_MS = Date.parse('2026-07-14T12:00:00.000Z');

describe('Google Drive native OAuth token source', () => {
  it('returns null when the native auth runtime cannot load in the Node test process', async () => {
    await expect(loadOptionalExpoAuthSession()).resolves.toBeNull();
  });

  it('returns honest null when expo-auth-session is unavailable', async () => {
    await expect(createGoogleDriveNativeTokenSource({
      clientId: 'founder-registered-client-id',
      redirectUri: 'com.mylife.meerkat:/oauth/google',
      destinationId: 'destination-1',
      loadAuthSession: async () => null,
      refreshTokenStore: new MemoryRefreshTokenStore(),
    })).resolves.toBeNull();
  });

  it('returns honest null before founder operations supplies a real client registration', async () => {
    let loaderCalls = 0;
    await expect(createGoogleDriveNativeTokenSource({
      clientId: '',
      redirectUri: 'com.mylife.meerkat:/oauth/google',
      destinationId: 'destination-1',
      loadAuthSession: async () => {
        loaderCalls += 1;
        return fakeAuthSession().module;
      },
      refreshTokenStore: new MemoryRefreshTokenStore(),
    })).resolves.toBeNull();
    expect(loaderCalls).toBe(0);
  });

  it('keeps refresh-token custody only in the injected SecureStore seam', async () => {
    const auth = fakeAuthSession({
      exchange: {
        accessToken: 'access-token-canary',
        refreshToken: 'refresh-token-canary',
        expiresIn: 3_600,
        issuedAt: NOW_MS / 1_000,
      },
    });
    const secureStore = new MemoryRefreshTokenStore();
    const source = await createGoogleDriveNativeTokenSource({
      clientId: 'founder-registered-client-id',
      redirectUri: 'com.mylife.meerkat:/oauth/google',
      destinationId: 'destination-1',
      loadAuthSession: async () => auth.module,
      refreshTokenStore: secureStore,
      now: () => NOW_MS,
    });
    expect(source).not.toBeNull();

    const connected = await source?.connect();
    expect(connected).toEqual({
      credentialRef: `${GOOGLE_DRIVE_NATIVE_CREDENTIAL_PREFIX}destination-1`,
      accountHint: null,
    });
    expect(JSON.stringify(connected)).not.toContain('access-token-canary');
    expect(JSON.stringify(connected)).not.toContain('refresh-token-canary');
    expect(secureStore.writes).toEqual([{
      key: `${GOOGLE_DRIVE_REFRESH_TOKEN_KEY_PREFIX}destination-1`,
      value: 'refresh-token-canary',
    }]);
    expect(await source?.getAccessToken('write')).toBe('access-token-canary');
    expect(auth.requestConfigs[0]).toMatchObject({
      usePKCE: true,
      scopes: [...GOOGLE_DRIVE_NATIVE_SCOPES],
      extraParams: { access_type: 'offline', prompt: 'consent' },
    });
    expect(auth.exchangeConfigs[0]).toMatchObject({
      extraParams: { code_verifier: 'v'.repeat(43) },
    });
  });

  it('has no SQLite, AsyncStorage, or browser-storage credential path', () => {
    const source = readFileSync(resolve(__dirname, '..', 'google-drive-source.ts'), 'utf8');
    expect(source).toContain("import('expo-secure-store')");
    expect(source).not.toContain('expo-sqlite');
    expect(source).not.toContain('AsyncStorage');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('sessionStorage');
  });

  it('refreshes expired access tokens and keeps a rotated refresh token in secure custody', async () => {
    const auth = fakeAuthSession({
      refresh: {
        accessToken: 'fresh-access-token',
        refreshToken: 'rotated-refresh-token',
        expiresIn: 600,
        issuedAt: NOW_MS / 1_000,
      },
    });
    const secureStore = new MemoryRefreshTokenStore();
    await secureStore.setItem(
      `${GOOGLE_DRIVE_REFRESH_TOKEN_KEY_PREFIX}destination-2`,
      'stored-refresh-token',
    );
    secureStore.writes.length = 0;
    const source = await createGoogleDriveNativeTokenSource({
      clientId: 'founder-registered-client-id',
      redirectUri: 'com.mylife.meerkat:/oauth/google',
      destinationId: 'destination-2',
      loadAuthSession: async () => auth.module,
      refreshTokenStore: secureStore,
      now: () => NOW_MS,
    });

    await expect(source?.getAccessToken('read')).resolves.toBe('fresh-access-token');
    expect(auth.refreshConfigs).toEqual([{
      clientId: 'founder-registered-client-id',
      refreshToken: 'stored-refresh-token',
      scopes: [...GOOGLE_DRIVE_NATIVE_SCOPES],
    }]);
    expect(secureStore.writes).toEqual([{
      key: `${GOOGLE_DRIVE_REFRESH_TOKEN_KEY_PREFIX}destination-2`,
      value: 'rotated-refresh-token',
    }]);
  });

  it('invalidates a rejected in-memory access token so the Drive retry refreshes once', async () => {
    const auth = fakeAuthSession({
      exchange: {
        accessToken: 'rejected-access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3_600,
        issuedAt: NOW_MS / 1_000,
      },
      refresh: {
        accessToken: 'replacement-access-token',
        expiresIn: 600,
        issuedAt: NOW_MS / 1_000,
      },
    });
    const source = await createGoogleDriveNativeTokenSource({
      clientId: 'founder-registered-client-id',
      redirectUri: 'com.mylife.meerkat:/oauth/google',
      destinationId: 'destination-retry',
      loadAuthSession: async () => auth.module,
      refreshTokenStore: new MemoryRefreshTokenStore(),
      now: () => NOW_MS,
    });
    await source?.connect();
    expect(await source?.getAccessToken('read')).toBe('rejected-access-token');

    await source?.invalidateAccessToken?.('rejected-access-token');
    await expect(source?.getAccessToken('read')).resolves.toBe('replacement-access-token');
    expect(auth.refreshConfigs).toHaveLength(1);
  });

  it('returns auth-required null when no refresh credential exists', async () => {
    const auth = fakeAuthSession();
    const source = await createGoogleDriveNativeTokenSource({
      clientId: 'founder-registered-client-id',
      redirectUri: 'com.mylife.meerkat:/oauth/google',
      destinationId: 'destination-3',
      loadAuthSession: async () => auth.module,
      refreshTokenStore: new MemoryRefreshTokenStore(),
      now: () => NOW_MS,
    });

    await expect(source?.getAccessToken('quota')).resolves.toBeNull();
    expect(auth.refreshConfigs).toHaveLength(0);
  });

  it('deletes local SecureStore custody even when provider revoke fails', async () => {
    const auth = fakeAuthSession({ revokeFailure: true });
    const secureStore = new MemoryRefreshTokenStore();
    const key = `${GOOGLE_DRIVE_REFRESH_TOKEN_KEY_PREFIX}destination-4`;
    await secureStore.setItem(key, 'refresh-to-revoke');
    const source = await createGoogleDriveNativeTokenSource({
      clientId: 'founder-registered-client-id',
      redirectUri: 'com.mylife.meerkat:/oauth/google',
      destinationId: 'destination-4',
      loadAuthSession: async () => auth.module,
      refreshTokenStore: secureStore,
      now: () => NOW_MS,
    });

    await expect(source?.revoke()).resolves.toBeUndefined();
    expect(await secureStore.getItem(key)).toBeNull();
    expect(secureStore.deletes).toEqual([key]);
  });
});

class MemoryRefreshTokenStore implements NativeRefreshTokenStore {
  readonly values = new Map<string, string>();
  readonly writes: Array<{ key: string; value: string }> = [];
  readonly deletes: string[] = [];

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.writes.push({ key, value });
    this.values.set(key, value);
  }

  async deleteItem(key: string): Promise<void> {
    this.deletes.push(key);
    this.values.delete(key);
  }
}

interface FakeAuthOptions {
  exchange?: ExpoTokenResponse;
  refresh?: ExpoTokenResponse;
  revokeFailure?: boolean;
}

function fakeAuthSession(options: FakeAuthOptions = {}): {
  module: ExpoAuthSessionModule;
  requestConfigs: Array<Record<string, unknown>>;
  exchangeConfigs: Array<Record<string, unknown>>;
  refreshConfigs: Array<Record<string, unknown>>;
} {
  const requestConfigs: Array<Record<string, unknown>> = [];
  const exchangeConfigs: Array<Record<string, unknown>> = [];
  const refreshConfigs: Array<Record<string, unknown>> = [];
  class FakeAuthRequest implements ExpoAuthRequest {
    readonly codeVerifier = 'v'.repeat(43);

    constructor(config: Record<string, unknown>) {
      requestConfigs.push(config);
    }

    async promptAsync(discovery: ExpoAuthDiscovery): Promise<ExpoAuthPromptResult> {
      expect(discovery.tokenEndpoint).toBe('https://oauth2.googleapis.com/token');
      return { type: 'success', params: { code: 'fake-authorization-code' } };
    }
  }
  const module: ExpoAuthSessionModule = {
    ResponseType: { Code: 'code' },
    AuthRequest: FakeAuthRequest,
    async exchangeCodeAsync(config) {
      exchangeConfigs.push(config);
      return options.exchange ?? {
        accessToken: 'initial-access-token',
        refreshToken: 'initial-refresh-token',
        expiresIn: 3_600,
        issuedAt: NOW_MS / 1_000,
      };
    },
    async refreshAsync(config) {
      refreshConfigs.push(config);
      return options.refresh ?? {
        accessToken: 'refreshed-access-token',
        expiresIn: 600,
        issuedAt: NOW_MS / 1_000,
      };
    },
    async revokeAsync() {
      if (options.revokeFailure) throw new Error('provider unavailable');
      return true;
    },
  };
  return { module, requestConfigs, exchangeConfigs, refreshConfigs };
}
