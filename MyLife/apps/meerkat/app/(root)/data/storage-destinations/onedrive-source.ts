// Founder operations must register a Microsoft native OAuth client and exact redirect URI.

import type { AccessTokenOperation, AccessTokenProvider } from '@mylife/sync';
import type {
  ExpoAuthDiscovery,
  ExpoAuthSessionModule,
  ExpoTokenResponse,
  NativeRefreshTokenStore,
} from './google-drive-source';

export type {
  ExpoAuthDiscovery,
  ExpoAuthPromptResult,
  ExpoAuthRequest,
  ExpoAuthSessionModule,
  ExpoTokenResponse,
  NativeRefreshTokenStore,
} from './google-drive-source';

export const ONEDRIVE_NATIVE_SCOPES = ['Files.ReadWrite.AppFolder', 'offline_access'] as const;
export const ONEDRIVE_REFRESH_TOKEN_KEY_PREFIX = 'meerkat.oauth.onedrive.';
export const ONEDRIVE_NATIVE_CREDENTIAL_PREFIX = 'securestore://meerkat/oauth/onedrive/';
export const ONEDRIVE_DISCOVERY: ExpoAuthDiscovery = {
  authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
};

const TOKEN_SAFETY_WINDOW_MS = 30_000;
const SAFE_DESTINATION_ID = /^[A-Za-z0-9._:-]{1,120}$/u;

export interface OneDriveNativeOAuthOptions {
  clientId: string;
  redirectUri: string;
  destinationId: string;
  loadAuthSession?: () => Promise<ExpoAuthSessionModule | null>;
  refreshTokenStore?: NativeRefreshTokenStore;
  loadRefreshTokenStore?: () => Promise<NativeRefreshTokenStore | null>;
  now?: () => number;
}

export interface OneDriveNativeTokenSource extends AccessTokenProvider {
  readonly credentialRef: string;
  connect(): Promise<{ credentialRef: string; accountHint: null } | null>;
  revoke(): Promise<void>;
}

class NativeOneDriveTokenSource implements OneDriveNativeTokenSource {
  readonly credentialRef: string;
  private readonly refreshTokenKey: string;
  private accessToken: { value: string; expiresAtMs: number } | null = null;

  constructor(
    private readonly oauth: ExpoAuthSessionModule,
    private readonly refreshTokens: NativeRefreshTokenStore,
    private readonly clientId: string,
    private readonly redirectUri: string,
    destinationId: string,
    private readonly now: () => number,
  ) {
    this.refreshTokenKey = `${ONEDRIVE_REFRESH_TOKEN_KEY_PREFIX}${destinationId}`;
    this.credentialRef = `${ONEDRIVE_NATIVE_CREDENTIAL_PREFIX}${destinationId}`;
  }

  async connect(): Promise<{ credentialRef: string; accountHint: null } | null> {
    const request = new this.oauth.AuthRequest({
      clientId: this.clientId,
      redirectUri: this.redirectUri,
      scopes: [...ONEDRIVE_NATIVE_SCOPES],
      responseType: this.oauth.ResponseType?.Code ?? 'code',
      usePKCE: true,
      extraParams: {},
    });
    try {
      const result = await request.promptAsync(ONEDRIVE_DISCOVERY);
      const code = result.type === 'success' ? safeToken(result.params?.code) : null;
      const verifier = safePkceVerifier(request.codeVerifier);
      if (!code || !verifier) return null;
      const token = await this.oauth.exchangeCodeAsync({
        clientId: this.clientId,
        code,
        redirectUri: this.redirectUri,
        extraParams: { code_verifier: verifier },
      }, ONEDRIVE_DISCOVERY);
      const refreshToken = safeToken(token.refreshToken);
      if (!refreshToken) return null;
      await this.refreshTokens.setItem(this.refreshTokenKey, refreshToken);
      this.rememberAccessToken(token);
      return { credentialRef: this.credentialRef, accountHint: null };
    } catch {
      return null;
    }
  }

  async getAccessToken(operation: AccessTokenOperation): Promise<string | null> {
    void operation;
    if (this.accessToken && this.accessToken.expiresAtMs > this.now() + TOKEN_SAFETY_WINDOW_MS) {
      return this.accessToken.value;
    }
    const refreshToken = safeToken(await this.refreshTokens.getItem(this.refreshTokenKey));
    if (!refreshToken) return null;
    try {
      const token = await this.oauth.refreshAsync({
        clientId: this.clientId,
        refreshToken,
        scopes: [...ONEDRIVE_NATIVE_SCOPES],
      }, ONEDRIVE_DISCOVERY);
      const rotated = safeToken(token.refreshToken);
      if (rotated) await this.refreshTokens.setItem(this.refreshTokenKey, rotated);
      return this.rememberAccessToken(token);
    } catch {
      this.accessToken = null;
      return null;
    }
  }

  invalidateAccessToken(token: string): void {
    if (this.accessToken?.value === token) this.accessToken = null;
  }

  async revoke(): Promise<void> {
    await this.refreshTokens.deleteItem(this.refreshTokenKey);
    this.accessToken = null;
  }

  private rememberAccessToken(token: ExpoTokenResponse): string | null {
    const accessToken = safeToken(token.accessToken);
    if (!accessToken || typeof token.expiresIn !== 'number'
      || !Number.isFinite(token.expiresIn) || token.expiresIn <= 0) {
      this.accessToken = null;
      return null;
    }
    const issuedAtMs = typeof token.issuedAt === 'number' && Number.isFinite(token.issuedAt)
      ? token.issuedAt * 1_000
      : this.now();
    this.accessToken = { value: accessToken, expiresAtMs: issuedAtMs + Math.floor(token.expiresIn * 1_000) };
    return accessToken;
  }
}

export async function createOneDriveNativeTokenSource(
  options: OneDriveNativeOAuthOptions,
): Promise<OneDriveNativeTokenSource | null> {
  const clientId = safeConfig(options.clientId, 512);
  const redirectUri = safeRedirect(options.redirectUri);
  if (!clientId || !redirectUri || !SAFE_DESTINATION_ID.test(options.destinationId)) return null;
  const oauth = await (options.loadAuthSession ?? loadOptionalOneDriveExpoAuthSession)();
  if (!oauth) return null;
  const store = options.refreshTokenStore
    ?? await (options.loadRefreshTokenStore ?? loadOneDriveSecureStore)();
  if (!store) return null;
  return new NativeOneDriveTokenSource(
    oauth,
    store,
    clientId,
    redirectUri,
    options.destinationId,
    options.now ?? Date.now,
  );
}

export async function loadOptionalOneDriveExpoAuthSession(): Promise<ExpoAuthSessionModule | null> {
  try {
    return asAuthSession(await import('expo-auth-session') as unknown);
  } catch {
    return null;
  }
}

async function loadOneDriveSecureStore(): Promise<NativeRefreshTokenStore | null> {
  try {
    const secureStore = await import('expo-secure-store');
    const options = {
      keychainAccessible: secureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      keychainService: 'com.mylife.meerkat.oauth',
    };
    return {
      getItem: (key) => secureStore.getItemAsync(key, options),
      setItem: (key, value) => secureStore.setItemAsync(key, value, options),
      deleteItem: (key) => secureStore.deleteItemAsync(key, options),
    };
  } catch {
    return null;
  }
}

function asAuthSession(value: unknown): ExpoAuthSessionModule | null {
  if (typeof value !== 'object' || value === null) return null;
  const module = value as Partial<ExpoAuthSessionModule>;
  return typeof module.AuthRequest === 'function'
    && typeof module.exchangeCodeAsync === 'function'
    && typeof module.refreshAsync === 'function'
    ? module as ExpoAuthSessionModule
    : null;
}

function safeConfig(value: string, maximumLength: number): string | null {
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maximumLength && !/[\r\n\0]/u.test(trimmed) ? trimmed : null;
}

function safeRedirect(value: string): string | null {
  const normalized = safeConfig(value, 2_048);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    return !parsed.username && !parsed.password && !parsed.hash ? normalized : null;
  } catch {
    return null;
  }
}

function safeToken(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 65_536 && !/[\r\n\0]/u.test(value)
    ? value
    : null;
}

function safePkceVerifier(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9._~-]{43,128}$/u.test(value) ? value : null;
}
