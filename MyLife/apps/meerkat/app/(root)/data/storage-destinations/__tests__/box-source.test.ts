import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BOX_DISCOVERY,
  BOX_NATIVE_CREDENTIAL_PREFIX,
  BOX_NATIVE_SCOPES,
  BOX_REFRESH_TOKEN_KEY_PREFIX,
  createBoxNativeTokenSource,
  type ExpoAuthDiscovery,
  type ExpoAuthPromptResult,
  type ExpoAuthRequest,
  type ExpoAuthSessionModule,
  type NativeRefreshTokenStore,
} from '../box-source';

const NOW_MS = Date.parse('2026-07-14T12:00:00.000Z');

describe('Box native OAuth token source', () => {
  it('returns honest null when native OAuth or founder registration is unavailable', async () => {
    await expect(createBoxNativeTokenSource({
      clientId: 'registered-client',
      redirectUri: 'com.mylife.meerkat:/oauth/box',
      destinationId: 'destination-1',
      loadAuthSession: async () => null,
      refreshTokenStore: new MemoryStore(),
    })).resolves.toBeNull();
    let calls = 0;
    await expect(createBoxNativeTokenSource({
      clientId: '',
      redirectUri: 'com.mylife.meerkat:/oauth/box',
      destinationId: 'destination-1',
      loadAuthSession: async () => { calls += 1; return fakeAuth().module; },
      refreshTokenStore: new MemoryStore(),
    })).resolves.toBeNull();
    expect(calls).toBe(0);
  });

  it('uses Box PKCE endpoints and keeps refresh tokens in SecureStore custody', async () => {
    const auth = fakeAuth();
    const store = new MemoryStore();
    const source = await createBoxNativeTokenSource({
      clientId: 'registered-client',
      redirectUri: 'com.mylife.meerkat:/oauth/box',
      destinationId: 'destination-1',
      loadAuthSession: async () => auth.module,
      refreshTokenStore: store,
      now: () => NOW_MS,
    });
    const result = await source?.connect();
    expect(result).toEqual({
      credentialRef: `${BOX_NATIVE_CREDENTIAL_PREFIX}destination-1`,
      accountHint: null,
    });
    expect(JSON.stringify(result)).not.toContain('refresh-token-canary');
    expect(auth.discovery).toEqual([BOX_DISCOVERY]);
    expect(auth.requestConfigs[0]).toMatchObject({ scopes: [...BOX_NATIVE_SCOPES], usePKCE: true });
    expect(store.values.get(`${BOX_REFRESH_TOKEN_KEY_PREFIX}destination-1`)).toBe('refresh-token-canary');
    await expect(source?.getAccessToken('write')).resolves.toBe('access-token-canary');
  });

  it('deletes local custody even when Box revocation fails', async () => {
    const auth = fakeAuth(true);
    const store = new MemoryStore();
    const key = `${BOX_REFRESH_TOKEN_KEY_PREFIX}destination-2`;
    await store.setItem(key, 'refresh-token');
    const source = await createBoxNativeTokenSource({
      clientId: 'registered-client',
      redirectUri: 'com.mylife.meerkat:/oauth/box',
      destinationId: 'destination-2',
      loadAuthSession: async () => auth.module,
      refreshTokenStore: store,
      now: () => NOW_MS,
    });
    await expect(source?.revoke()).resolves.toBeUndefined();
    expect(await store.getItem(key)).toBeNull();
  });

  it('contains no SQLite, AsyncStorage, or browser token storage path', () => {
    const source = readFileSync(resolve(__dirname, '..', 'box-source.ts'), 'utf8');
    expect(source).toContain("import('expo-secure-store')");
    expect(source).not.toContain('expo-sqlite');
    expect(source).not.toContain('AsyncStorage');
    expect(source).not.toContain('localStorage');
  });
});

class MemoryStore implements NativeRefreshTokenStore {
  readonly values = new Map<string, string>();
  async getItem(key: string): Promise<string | null> { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string): Promise<void> { this.values.set(key, value); }
  async deleteItem(key: string): Promise<void> { this.values.delete(key); }
}

function fakeAuth(revokeFailure = false): {
  module: ExpoAuthSessionModule;
  discovery: ExpoAuthDiscovery[];
  requestConfigs: Array<Record<string, unknown>>;
} {
  const discovery: ExpoAuthDiscovery[] = [];
  const requestConfigs: Array<Record<string, unknown>> = [];
  class Request implements ExpoAuthRequest {
    readonly codeVerifier = 'v'.repeat(43);
    constructor(config: Record<string, unknown>) { requestConfigs.push(config); }
    async promptAsync(value: ExpoAuthDiscovery): Promise<ExpoAuthPromptResult> {
      discovery.push(value);
      return { type: 'success', params: { code: 'authorization-code' } };
    }
  }
  return {
    discovery,
    requestConfigs,
    module: {
      ResponseType: { Code: 'code' },
      AuthRequest: Request,
      async exchangeCodeAsync() {
        return {
          accessToken: 'access-token-canary',
          refreshToken: 'refresh-token-canary',
          expiresIn: 3_600,
          issuedAt: NOW_MS / 1_000,
        };
      },
      async refreshAsync() {
        return { accessToken: 'refreshed-token', expiresIn: 600, issuedAt: NOW_MS / 1_000 };
      },
      async revokeAsync() {
        if (revokeFailure) throw new Error('provider unavailable');
        return true;
      },
    },
  };
}
