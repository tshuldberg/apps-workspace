// Founder operations must register the native Google OAuth client and exact redirect URI.

import type { AccessTokenOperation, AccessTokenProvider } from '@mylife/sync';

export const GOOGLE_DRIVE_NATIVE_SCOPES = ['https://www.googleapis.com/auth/drive.file'] as const;
export const GOOGLE_DRIVE_REFRESH_TOKEN_KEY_PREFIX = 'meerkat.oauth.google.';
export const GOOGLE_DRIVE_NATIVE_CREDENTIAL_PREFIX = 'securestore://meerkat/oauth/google/';

const GOOGLE_DISCOVERY: ExpoAuthDiscovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};
const TOKEN_SAFETY_WINDOW_SECONDS = 30;
const SAFE_DESTINATION_ID = /^[A-Za-z0-9._:-]{1,120}$/u;

export interface GoogleDriveNativeOAuthOptions {
  clientId: string;
  redirectUri: string;
  destinationId: string;
  loadAuthSession?: ExpoAuthSessionLoader;
  refreshTokenStore?: NativeRefreshTokenStore;
  loadRefreshTokenStore?: () => Promise<NativeRefreshTokenStore | null>;
  now?: () => number;
}

export interface GoogleDriveNativeConnectResult {
  credentialRef: string;
  accountHint: null;
}

export interface GoogleDriveNativeTokenSource extends AccessTokenProvider {
  readonly credentialRef: string;
  connect(): Promise<GoogleDriveNativeConnectResult | null>;
  revoke(): Promise<void>;
}

export interface NativeRefreshTokenStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

export interface ExpoAuthDiscovery {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  revocationEndpoint?: string;
}

export interface ExpoAuthPromptResult {
  type: string;
  params?: Readonly<Record<string, string>>;
}

export interface ExpoAuthRequest {
  readonly codeVerifier?: string;
  promptAsync(discovery: ExpoAuthDiscovery): Promise<ExpoAuthPromptResult>;
}

export interface ExpoTokenResponse {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  issuedAt?: number;
  scope?: string;
}

export interface ExpoAuthSessionModule {
  readonly ResponseType?: { readonly Code?: string };
  readonly AuthRequest: new (config: {
    clientId: string;
    redirectUri: string;
    scopes: string[];
    responseType: string;
    usePKCE: true;
    extraParams: Readonly<Record<string, string>>;
  }) => ExpoAuthRequest;
  exchangeCodeAsync(
    config: {
      clientId: string;
      code: string;
      redirectUri: string;
      extraParams: Readonly<Record<string, string>>;
    },
    discovery: ExpoAuthDiscovery,
  ): Promise<ExpoTokenResponse>;
  refreshAsync(
    config: { clientId: string; refreshToken: string; scopes: string[] },
    discovery: ExpoAuthDiscovery,
  ): Promise<ExpoTokenResponse>;
  revokeAsync?(
    config: { clientId: string; token: string },
    discovery: ExpoAuthDiscovery,
  ): Promise<boolean | void>;
}

export type ExpoAuthSessionLoader = () => Promise<ExpoAuthSessionModule | null>;

interface MemoryAccessToken {
  value: string;
  expiresAtMs: number;
}

class NativeGoogleDriveTokenSource implements GoogleDriveNativeTokenSource {
  readonly credentialRef: string;
  private readonly refreshTokenKey: string;
  private accessToken: MemoryAccessToken | null = null;

  constructor(
    private readonly oauth: ExpoAuthSessionModule,
    private readonly refreshTokens: NativeRefreshTokenStore,
    private readonly clientId: string,
    private readonly redirectUri: string,
    destinationId: string,
    private readonly now: () => number,
  ) {
    this.refreshTokenKey = `${GOOGLE_DRIVE_REFRESH_TOKEN_KEY_PREFIX}${destinationId}`;
    this.credentialRef = `${GOOGLE_DRIVE_NATIVE_CREDENTIAL_PREFIX}${destinationId}`;
  }

  async connect(): Promise<GoogleDriveNativeConnectResult | null> {
    const request = new this.oauth.AuthRequest({
      clientId: this.clientId,
      redirectUri: this.redirectUri,
      scopes: [...GOOGLE_DRIVE_NATIVE_SCOPES],
      responseType: this.oauth.ResponseType?.Code ?? 'code',
      usePKCE: true,
      extraParams: { access_type: 'offline', prompt: 'consent' },
    });
    const result = await request.promptAsync(GOOGLE_DISCOVERY);
    const code = result.type === 'success' ? safeToken(result.params?.code) : null;
    const verifier = safePkceVerifier(request.codeVerifier);
    if (!code || !verifier) return null;
    let token: ExpoTokenResponse;
    try {
      token = await this.oauth.exchangeCodeAsync({
        clientId: this.clientId,
        code,
        redirectUri: this.redirectUri,
        extraParams: { code_verifier: verifier },
      }, GOOGLE_DISCOVERY);
    } catch {
      return null;
    }
    const refreshToken = safeToken(token.refreshToken);
    if (!refreshToken) return null;
    await this.refreshTokens.setItem(this.refreshTokenKey, refreshToken);
    this.rememberAccessToken(token);
    return { credentialRef: this.credentialRef, accountHint: null };
  }

  async getAccessToken(operation: AccessTokenOperation): Promise<string | null> {
    void operation;
    if (this.accessToken && this.accessToken.expiresAtMs > this.now() + TOKEN_SAFETY_WINDOW_SECONDS * 1_000) {
      return this.accessToken.value;
    }
    const refreshToken = safeToken(await this.refreshTokens.getItem(this.refreshTokenKey));
    if (!refreshToken) return null;
    let token: ExpoTokenResponse;
    try {
      token = await this.oauth.refreshAsync({
        clientId: this.clientId,
        refreshToken,
        scopes: [...GOOGLE_DRIVE_NATIVE_SCOPES],
      }, GOOGLE_DISCOVERY);
    } catch {
      this.accessToken = null;
      return null;
    }
    const rotatedRefreshToken = safeToken(token.refreshToken);
    if (rotatedRefreshToken) await this.refreshTokens.setItem(this.refreshTokenKey, rotatedRefreshToken);
    return this.rememberAccessToken(token);
  }

  invalidateAccessToken(token: string): void {
    if (this.accessToken?.value === token) this.accessToken = null;
  }

  async revoke(): Promise<void> {
    const refreshToken = safeToken(await this.refreshTokens.getItem(this.refreshTokenKey));
    try {
      if (refreshToken && this.oauth.revokeAsync) {
        await this.oauth.revokeAsync({ clientId: this.clientId, token: refreshToken }, GOOGLE_DISCOVERY);
      }
    } catch {
      // Local custody is still removed when provider revocation is unavailable.
    } finally {
      await this.refreshTokens.deleteItem(this.refreshTokenKey);
      this.accessToken = null;
    }
  }

  private rememberAccessToken(token: ExpoTokenResponse): string | null {
    const accessToken = safeToken(token.accessToken);
    const expiresIn = token.expiresIn;
    if (!accessToken || typeof expiresIn !== 'number' || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      this.accessToken = null;
      return null;
    }
    const issuedAtMs = typeof token.issuedAt === 'number' && Number.isFinite(token.issuedAt)
      ? token.issuedAt * 1_000
      : this.now();
    this.accessToken = {
      value: accessToken,
      expiresAtMs: issuedAtMs + Math.floor(expiresIn * 1_000),
    };
    return accessToken;
  }
}

export async function createGoogleDriveNativeTokenSource(
  options: GoogleDriveNativeOAuthOptions,
): Promise<GoogleDriveNativeTokenSource | null> {
  const clientId = safeConfigValue(options.clientId, 512);
  const redirectUri = safeRedirectUri(options.redirectUri);
  if (!clientId || !redirectUri || !SAFE_DESTINATION_ID.test(options.destinationId)) return null;
  const oauth = await (options.loadAuthSession ?? loadOptionalExpoAuthSession)();
  if (!oauth) return null;
  const refreshTokens = options.refreshTokenStore
    ?? await (options.loadRefreshTokenStore ?? loadExpoSecureStore)();
  if (!refreshTokens) return null;
  return new NativeGoogleDriveTokenSource(
    oauth,
    refreshTokens,
    clientId,
    redirectUri,
    options.destinationId,
    options.now ?? Date.now,
  );
}

export async function loadOptionalExpoAuthSession(): Promise<ExpoAuthSessionModule | null> {
  try {
    const loaded = await import('expo-auth-session') as unknown;
    return asExpoAuthSessionModule(loaded);
  } catch {
    return null;
  }
}

async function loadExpoSecureStore(): Promise<NativeRefreshTokenStore | null> {
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

function asExpoAuthSessionModule(value: unknown): ExpoAuthSessionModule | null {
  if (typeof value !== 'object' || value === null) return null;
  const module = value as Partial<ExpoAuthSessionModule>;
  return typeof module.AuthRequest === 'function'
    && typeof module.exchangeCodeAsync === 'function'
    && typeof module.refreshAsync === 'function'
    ? module as ExpoAuthSessionModule
    : null;
}

function safeConfigValue(value: string, maximumLength: number): string | null {
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maximumLength && !/[\r\n\0]/u.test(trimmed) ? trimmed : null;
}

function safeRedirectUri(value: string): string | null {
  const normalized = safeConfigValue(value, 2_048);
  if (!normalized) return null;
  try {
    const uri = new URL(normalized);
    return !uri.username && !uri.password && !uri.hash ? normalized : null;
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
