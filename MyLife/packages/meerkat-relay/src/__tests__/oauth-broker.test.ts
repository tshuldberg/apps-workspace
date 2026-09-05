import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type http from 'node:http';
import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it } from 'vitest';
import type { HttpTransport, HttpTransportResponse } from '@mylife/sync';
import type { Kms, KmsContext, KmsDataKey } from '../oauth-kms';
import {
  OAUTH_BROKER_PATHS,
  OAuthProviderRegistry,
  handleOAuthBrokerRequest,
  loadOAuthProviderRegistryFromEnv,
  type OAuthBrokerOptions,
  type OAuthProviderConfig,
} from '../oauth-broker';
import { FileOAuthBrokerStore } from '../oauth-broker-store-file';
import { InMemoryOAuthBrokerStore } from '../oauth-broker-store';
import { redactForLog } from '../log-redaction';

const SUBJECT = 'subject-a';
const OTHER_SUBJECT = 'subject-b';
const REDIRECT = 'https://app.example.test/oauth/google';
const REFRESH_TOKEN = 'refresh-token-canary-never-persist-plaintext';
const ACCESS_TOKEN = 'access-token-canary-session-only';
const VERIFIER = 'v'.repeat(43);
const STATE = 'state-value-with-enough-entropy-0001';

function challenge(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

function response(status: number, body: unknown = {}, headers: Record<string, string> = {}): HttpTransportResponse {
  return {
    status,
    headers,
    body: new TextEncoder().encode(JSON.stringify(body)),
  };
}

class FakeProvider {
  readonly requests: { url: string; params: URLSearchParams }[] = [];
  revokeCalls = 0;
  refreshExpiresIn = 3_600;
  rejectRefresh = false;
  rotateRefreshTokens = false;
  private refreshCount = 0;

  readonly transport: HttpTransport = async (request) => {
    const params = new URLSearchParams(new TextDecoder().decode(request.body ?? new Uint8Array()));
    this.requests.push({ url: request.url, params });
    if (request.url.endsWith('/revoke')) {
      this.revokeCalls += 1;
      return response(200);
    }
    if (params.get('grant_type') === 'authorization_code') {
      return response(200, {
        access_token: 'connect-access-token-not-returned',
        refresh_token: REFRESH_TOKEN,
        expires_in: 3_600,
        scope: 'https://www.googleapis.com/auth/drive.file drive.metadata.readonly',
        email: 'alice@example.test',
      });
    }
    if (params.get('grant_type') === 'refresh_token') {
      if (this.rejectRefresh) return response(400, { error: 'invalid_grant' });
      this.refreshCount += 1;
      return response(200, {
        access_token: ACCESS_TOKEN,
        expires_in: this.refreshExpiresIn,
        scope: 'https://www.googleapis.com/auth/drive.file',
        ...(this.rotateRefreshTokens
          ? { refresh_token: `rotated-refresh-token-${this.refreshCount}` }
          : {}),
      });
    }
    return response(400, { error: 'unsupported_grant_type' });
  };
}

class RecordingKms implements Kms {
  lastPlaintextKey: Uint8Array | null = null;
  lastDecryptedKey: Uint8Array | null = null;
  private readonly keys = new Map<string, Uint8Array>();
  private next = 1;
  readonly contexts: KmsContext[] = [];

  async generateDataKey(context: KmsContext): Promise<KmsDataKey> {
    this.contexts.push({ ...context });
    const plaintextKey = new Uint8Array(32).fill(this.next);
    const wrappedKey = new Uint8Array(32).fill(100 + this.next);
    this.keys.set(Buffer.from(wrappedKey).toString('hex'), plaintextKey.slice());
    this.lastPlaintextKey = plaintextKey;
    this.next += 1;
    return { plaintextKey, wrappedKey };
  }

  async decryptDataKey(wrappedKey: Uint8Array, context: KmsContext): Promise<Uint8Array> {
    this.contexts.push({ ...context });
    const key = this.keys.get(Buffer.from(wrappedKey).toString('hex'));
    if (!key) throw new Error('unknown wrapped key');
    this.lastDecryptedKey = key.slice();
    return this.lastDecryptedKey;
  }
}

class CapturingResponse extends EventEmitter {
  statusCode = 200;
  headersSent = false;
  private readonly headers = new Map<string, string>();
  private readonly chunks: Buffer[] = [];

  setHeader(name: string, value: string | number | readonly string[]): this {
    this.headers.set(name.toLowerCase(), Array.isArray(value) ? value.join(', ') : String(value));
    return this;
  }

  writeHead(status: number, headers?: Record<string, string | number | readonly string[]>): this {
    this.statusCode = status;
    for (const [name, value] of Object.entries(headers ?? {})) this.setHeader(name, value);
    this.headersSent = true;
    return this;
  }

  write(chunk: string | Uint8Array): boolean {
    this.chunks.push(Buffer.from(chunk));
    this.headersSent = true;
    return true;
  }

  end(chunk?: string | Uint8Array): this {
    if (chunk !== undefined) this.write(chunk);
    this.headersSent = true;
    this.emit('finish');
    return this;
  }

  captured(): CapturedResponse {
    return {
      status: this.statusCode,
      headers: Object.fromEntries(this.headers),
      text: Buffer.concat(this.chunks).toString('utf8'),
    };
  }
}

interface CapturedResponse {
  status: number;
  headers: Record<string, string>;
  text: string;
}

interface CallInput {
  path: string;
  subject?: string;
  origin?: string;
  method?: string;
  body?: Record<string, unknown>;
}

interface Context {
  store: InMemoryOAuthBrokerStore;
  provider: FakeProvider;
  kms: RecordingKms;
  logs: Record<string, unknown>[];
  options: OAuthBrokerOptions;
  now: { value: number };
}

const googleConfig: OAuthProviderConfig = {
  id: 'google',
  authUrl: 'https://accounts.google.test/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth.google.test/token',
  revokeUrl: 'https://oauth.google.test/revoke',
  clientId: 'google-client-id',
  clientSecretFile: '/run/secrets/google-client-secret',
  clientSecret: 'client-secret-canary',
  redirectAllowlist: [REDIRECT],
  scopes: ['https://www.googleapis.com/auth/drive.file'],
};

function request(input: CallInput): http.IncomingMessage {
  const bytes = new TextEncoder().encode(JSON.stringify(input.body ?? {}));
  const headers: Record<string, string> = {
    authorization: `Bearer ${input.subject ?? SUBJECT}`,
    'content-type': 'application/json',
  };
  if (input.origin) headers.origin = input.origin;
  const stream = Readable.from([bytes]);
  Object.assign(stream, {
    method: input.method ?? 'POST',
    url: input.path,
    headers,
    socket: { remoteAddress: '127.0.0.1' },
  });
  return stream as http.IncomingMessage;
}

async function call(options: OAuthBrokerOptions, input: CallInput): Promise<CapturedResponse> {
  const output = new CapturingResponse();
  await handleOAuthBrokerRequest(
    request(input),
    output as unknown as http.ServerResponse,
    options,
  );
  return output.captured();
}

function json(responseValue: CapturedResponse): Record<string, unknown> {
  return JSON.parse(responseValue.text) as Record<string, unknown>;
}

function makeContext(): Context {
  const store = new InMemoryOAuthBrokerStore();
  const provider = new FakeProvider();
  const kms = new RecordingKms();
  const logs: Record<string, unknown>[] = [];
  const now = { value: Date.parse('2026-07-14T12:00:00.000Z') };
  let uuid = 0;
  const options: OAuthBrokerOptions = {
    store,
    providers: new OAuthProviderRegistry([googleConfig]),
    kms,
    providerTransport: provider.transport,
    authorize: (req) => {
      const value = req.headers.authorization;
      return typeof value === 'string' && value.startsWith('Bearer ')
        ? { subjectId: value.slice('Bearer '.length) }
        : null;
    },
    corsAllowedOrigins: ['https://app.example.test'],
    now: () => now.value,
    randomUuid: () => `oauth-id-${++uuid}`,
    randomBytes: (size) => Buffer.alloc(size, 7),
    log: (_event, detail) => logs.push(detail),
  };
  return { store, provider, kms, logs, options, now };
}

async function start(
  context: Context,
  state = STATE,
  redirectUri = REDIRECT,
  provider = 'google',
): Promise<CapturedResponse> {
  return call(context.options, {
    path: OAUTH_BROKER_PATHS.connectStart,
    body: {
      provider,
      destinationLabel: 'My Drive',
      redirectUri,
      codeChallenge: challenge(VERIFIER),
      state,
    },
  });
}

async function complete(
  context: Context,
  state = STATE,
  verifier = VERIFIER,
  subject = SUBJECT,
): Promise<CapturedResponse> {
  return call(context.options, {
    path: OAUTH_BROKER_PATHS.connectComplete,
    subject,
    body: { state, code: 'provider-code', codeVerifier: verifier },
  });
}

async function createVault(context: Context, state = STATE): Promise<string> {
  expect((await start(context, state)).status).toBe(200);
  const result = await complete(context, state);
  expect(result.status).toBe(200);
  return String(json(result).vaultId);
}

describe('OAuth credential broker', () => {
  let context: Context;

  beforeEach(() => { context = makeContext(); });

  it('KMS-envelopes storage credentials and returns them only in an operation session', async () => {
    const secret = JSON.stringify({ username: 'alice', password: 'storage-secret-canary' });
    const put = await call(context.options, {
      path: OAUTH_BROKER_PATHS.credentialPut,
      body: { kind: 'webdav', secret },
    });
    expect(put.status).toBe(200);
    const vaultId = String(json(put).vaultId);
    const stored = context.store.snapshotVaults()[0]!;
    expect(stored.provider).toBe('storage_webdav');
    expect(new TextDecoder().decode(stored.encryptedRefreshToken)).not.toContain('storage-secret-canary');
    expect(context.kms.contexts[0]?.purpose).toBe('storage_credential');

    const denied = await call(context.options, {
      path: OAUTH_BROKER_PATHS.credentialSession,
      subject: OTHER_SUBJECT,
      body: { vaultId, destinationId: 'dav-1', operation: 'write' },
    });
    expect(denied.status).toBe(404);

    const session = await call(context.options, {
      path: OAUTH_BROKER_PATHS.credentialSession,
      body: { vaultId, destinationId: 'dav-1', operation: 'write' },
    });
    expect(session.status).toBe(200);
    expect(json(session)).toMatchObject({ credential: secret, destinationId: 'dav-1' });
    expect(context.store.snapshotSessions()[0]?.operations).toEqual(['write']);

    const revoked = await call(context.options, {
      path: OAUTH_BROKER_PATHS.credentialRevoke,
      body: { vaultId },
    });
    expect(revoked.status).toBe(200);
    expect(context.store.snapshotVaults()).toHaveLength(0);
  });

  it('consumes state on the first successful completion and rejects replay', async () => {
    await start(context);
    expect((await complete(context)).status).toBe(200);
    expect(json(await complete(context))).toEqual({ error: 'invalid_state' });
  });

  it('rejects a forged state before calling the provider', async () => {
    const result = await complete(context, 'forged-state-with-enough-entropy');
    expect(result.status).toBe(400);
    expect(json(result)).toEqual({ error: 'invalid_state' });
    expect(context.provider.requests).toHaveLength(0);
  });

  it('consumes state when a different subject attempts completion', async () => {
    await start(context);
    expect(json(await complete(context, STATE, VERIFIER, OTHER_SUBJECT))).toEqual({ error: 'subject_mismatch' });
    expect(json(await complete(context))).toEqual({ error: 'invalid_state' });
  });

  it('consumes state when the code verifier is wrong', async () => {
    await start(context);
    expect(json(await complete(context, STATE, 'x'.repeat(43)))).toEqual({ error: 'invalid_code_verifier' });
    expect(json(await complete(context))).toEqual({ error: 'invalid_state' });
  });

  it('consumes state before rejecting a malformed first completion attempt', async () => {
    await start(context);
    const malformed = await call(context.options, {
      path: OAUTH_BROKER_PATHS.connectComplete,
      body: { state: STATE },
    });
    expect(json(malformed)).toEqual({ error: 'bad_request' });
    expect(json(await complete(context))).toEqual({ error: 'invalid_state' });
  });

  it('consumes and rejects an expired pending state before provider exchange', async () => {
    await start(context);
    context.now.value += 10 * 60_000 + 1;
    expect(json(await complete(context))).toEqual({ error: 'state_expired' });
    expect(json(await complete(context))).toEqual({ error: 'invalid_state' });
    expect(context.provider.requests).toHaveLength(0);
  });

  it.each([
    'https://app.example.test.evil.tld/oauth/google',
    'https://app.example.test/oauth/google/extra',
  ])('rejects redirect URI tricks by exact string match: %s', async (redirectUri) => {
    const result = await start(context, STATE, redirectUri);
    expect(result.status).toBe(400);
    expect(json(result)).toEqual({ error: 'redirect_not_allowed' });
  });

  it('answers provider_not_configured without fabricating an authorization URL', async () => {
    context.options.providers = new OAuthProviderRegistry();
    context.options.kms = undefined;
    const result = await start(context);
    expect(result.status).toBe(503);
    expect(json(result)).toEqual({ error: 'provider_not_configured' });
  });

  it('loads provider registration secrets from files and defaults Google to drive.file', async () => {
    const readPaths: string[] = [];
    const registry = await loadOAuthProviderRegistryFromEnv({
      env: {
        MEERKAT_OAUTH_PROVIDERS: 'google',
        MEERKAT_OAUTH_GOOGLE_AUTH_URL: googleConfig.authUrl,
        MEERKAT_OAUTH_GOOGLE_TOKEN_URL: googleConfig.tokenUrl,
        MEERKAT_OAUTH_GOOGLE_REVOKE_URL: googleConfig.revokeUrl ?? undefined,
        MEERKAT_OAUTH_GOOGLE_CLIENT_ID: googleConfig.clientId,
        MEERKAT_OAUTH_GOOGLE_CLIENT_SECRET_FILE: googleConfig.clientSecretFile,
        MEERKAT_OAUTH_GOOGLE_REDIRECT_ALLOWLIST: JSON.stringify(googleConfig.redirectAllowlist),
      },
      readTextFile: async (filePath) => {
        readPaths.push(filePath);
        return 'secret-loaded-from-mounted-file\n';
      },
    });
    expect(readPaths).toEqual([googleConfig.clientSecretFile]);
    expect(registry.get('google')).toMatchObject({
      clientSecret: 'secret-loaded-from-mounted-file',
      scopes: ['https://www.googleapis.com/auth/drive.file'],
      redirectAllowlist: [REDIRECT],
    });
  });

  it.each([
    {
      id: 'dropbox',
      authUrl: 'https://www.dropbox.com/oauth2/authorize',
      tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
      revokeUrl: 'https://api.dropboxapi.com/2/auth/token/revoke',
      scopes: ['files.content.read', 'files.content.write', 'files.metadata.read', 'account_info.read'],
      authorizationParams: { token_access_type: 'offline' },
    },
    {
      id: 'onedrive',
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      revokeUrl: null,
      scopes: ['Files.ReadWrite.AppFolder', 'offline_access'],
      authorizationParams: undefined,
    },
    {
      id: 'box',
      authUrl: 'https://account.box.com/api/oauth2/authorize',
      tokenUrl: 'https://api.box.com/oauth2/token',
      revokeUrl: 'https://api.box.com/oauth2/revoke',
      scopes: ['root_readwrite'],
      authorizationParams: undefined,
    },
  ])('loads $id registration secrets from files with narrow defaults', async (provider) => {
    const prefix = `MEERKAT_OAUTH_${provider.id.toUpperCase()}_`;
    const secretFile = `/run/secrets/${provider.id}-client-secret`;
    const redirect = `https://app.example.test/oauth/${provider.id}`;
    const env: Record<string, string> = {
      MEERKAT_OAUTH_PROVIDERS: provider.id,
      [`${prefix}AUTH_URL`]: provider.authUrl,
      [`${prefix}TOKEN_URL`]: provider.tokenUrl,
      [`${prefix}CLIENT_ID`]: `${provider.id}-client-id`,
      [`${prefix}CLIENT_SECRET_FILE`]: secretFile,
      [`${prefix}REDIRECT_ALLOWLIST`]: JSON.stringify([redirect]),
    };
    if (provider.revokeUrl) env[`${prefix}REVOKE_URL`] = provider.revokeUrl;
    const readPaths: string[] = [];
    const registry = await loadOAuthProviderRegistryFromEnv({
      env,
      readTextFile: async (filePath) => {
        readPaths.push(filePath);
        return `secret-for-${provider.id}\n`;
      },
    });

    expect(readPaths).toEqual([secretFile]);
    expect(registry.get(provider.id)).toMatchObject({
      id: provider.id,
      clientSecret: `secret-for-${provider.id}`,
      redirectAllowlist: [redirect],
      scopes: provider.scopes,
      ...(provider.authorizationParams === undefined
        ? {}
        : { authorizationParams: provider.authorizationParams }),
    });
  });

  it.each(['dropbox', 'onedrive', 'box'])('rejects partial %s registration', async (provider) => {
    const prefix = `MEERKAT_OAUTH_${provider.toUpperCase()}_`;
    await expect(loadOAuthProviderRegistryFromEnv({
      env: { [`${prefix}CLIENT_ID`]: 'partial-client' },
      readTextFile: async () => 'must-not-be-used',
    })).rejects.toThrow(`OAuth provider ${provider} registration is incomplete`);
  });

  it.each(['dropbox', 'onedrive', 'box'])('answers provider_not_configured for absent %s registration', async (provider) => {
    context.options.providers = new OAuthProviderRegistry();
    const result = await start(context, STATE, REDIRECT, provider);
    expect(result.status).toBe(503);
    expect(json(result)).toEqual({ error: 'provider_not_configured' });
  });

  it('rejects a partially configured provider registration instead of fabricating defaults', async () => {
    await expect(loadOAuthProviderRegistryFromEnv({
      env: { MEERKAT_OAUTH_GOOGLE_CLIENT_ID: 'partial-client' },
      readTextFile: async () => 'must-not-be-used',
    })).rejects.toThrow('registration is incomplete');
  });

  it('never returns a provider token outside the session route', async () => {
    const startResponse = await start(context);
    const completeResponse = await complete(context);
    const vaultId = String(json(completeResponse).vaultId);
    const revokeResponse = await call(context.options, {
      path: OAUTH_BROKER_PATHS.revoke,
      body: { vaultId },
    });
    for (const result of [startResponse, completeResponse, revokeResponse]) {
      expect(result.text).not.toContain(REFRESH_TOKEN);
      expect(result.text).not.toContain(ACCESS_TOKEN);
      expect(result.text).not.toContain('connect-access-token-not-returned');
    }
    expect(json(completeResponse).accountHint).toBe('a***@example.test');
  });

  it('binds a session to one destination and operation with a ten-minute maximum', async () => {
    const vaultId = await createVault(context);
    const result = await call(context.options, {
      path: OAUTH_BROKER_PATHS.session,
      body: { vaultId, operation: 'list', destinationId: 'destination-google-a' },
    });
    expect(result.status).toBe(200);
    expect(json(result)).toMatchObject({
      accessToken: ACCESS_TOKEN,
      destinationId: 'destination-google-a',
      operations: ['list'],
      expiresAt: '2026-07-14T12:10:00.000Z',
    });
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.headers.pragma).toBe('no-cache');
    expect(context.store.snapshotSessions()).toEqual([
      expect.objectContaining({
        vaultId,
        destinationId: 'destination-google-a',
        operations: ['list'],
        expiresAt: '2026-07-14T12:10:00.000Z',
      }),
    ]);
    expect(context.kms.lastDecryptedKey).not.toBeNull();
    expect([...context.kms.lastDecryptedKey!].every((byte) => byte === 0)).toBe(true);
  });

  it('caps the session expiry at the provider expiry', async () => {
    context.provider.refreshExpiresIn = 90;
    const vaultId = await createVault(context);
    const result = await call(context.options, {
      path: OAUTH_BROKER_PATHS.session,
      body: { vaultId, operation: 'read', destinationId: 'destination-google-a' },
    });
    expect(json(result).expiresAt).toBe('2026-07-14T12:01:30.000Z');
  });

  it('envelope-encrypts and persists a rotated refresh token before the next session', async () => {
    context.provider.rotateRefreshTokens = true;
    const vaultId = await createVault(context);
    for (const operation of ['read', 'write'] as const) {
      const result = await call(context.options, {
        path: OAUTH_BROKER_PATHS.session,
        body: { vaultId, operation, destinationId: 'destination-google-a' },
      });
      expect(result.status).toBe(200);
    }
    const refreshRequests = context.provider.requests
      .filter((entry) => entry.params.get('grant_type') === 'refresh_token');
    expect(refreshRequests.map((entry) => entry.params.get('refresh_token'))).toEqual([
      REFRESH_TOKEN,
      'rotated-refresh-token-1',
    ]);
    const stored = context.store.snapshotVaults()[0]!;
    expect(Buffer.from(stored.encryptedRefreshToken).includes(Buffer.from('rotated-refresh-token-2')))
      .toBe(false);
    expect(context.kms.lastPlaintextKey).not.toBeNull();
    expect([...context.kms.lastPlaintextKey!].every((byte) => byte === 0)).toBe(true);
  });

  it('maps a revoked provider refresh token to auth_required', async () => {
    const vaultId = await createVault(context);
    context.provider.rejectRefresh = true;
    const result = await call(context.options, {
      path: OAUTH_BROKER_PATHS.session,
      body: { vaultId, operation: 'read', destinationId: 'destination-google-a' },
    });
    expect(result.status).toBe(401);
    expect(json(result)).toEqual({ error: 'auth_required' });
  });

  it('persists only KMS-envelope ciphertext and zeroizes the generated data key', async () => {
    await createVault(context);
    const row = context.store.snapshotVaults()[0]!;
    const storedBytes = Buffer.concat([
      Buffer.from(row.encryptedRefreshToken),
      Buffer.from(row.wrappedDataKey),
      Buffer.from(row.nonce),
    ]);
    expect(storedBytes.includes(Buffer.from(REFRESH_TOKEN))).toBe(false);
    expect(context.kms.lastPlaintextKey).not.toBeNull();
    expect([...context.kms.lastPlaintextKey!].every((byte) => byte === 0)).toBe(true);
  });

  it('revokes at the provider once, deletes the vault, and remains idempotent', async () => {
    const vaultId = await createVault(context);
    const first = await call(context.options, {
      path: OAUTH_BROKER_PATHS.revoke,
      body: { vaultId },
    });
    const second = await call(context.options, {
      path: OAUTH_BROKER_PATHS.revoke,
      body: { vaultId },
    });
    expect(json(first)).toEqual({ revoked: true, providerRevoked: true });
    expect(json(second)).toEqual({ revoked: true, providerRevoked: false });
    expect(context.provider.revokeCalls).toBe(1);
    expect(context.store.snapshotVaults()).toHaveLength(0);
    expect(context.store.snapshotAudits().filter((event) => event.action === 'revoke'))
      .toEqual([
        expect.objectContaining({ detailCode: 'provider_revoke_confirmed' }),
        expect.objectContaining({ detailCode: 'provider_revoke_not_confirmed' }),
      ]);
  });

  it('account deletion removes every vault and its session bindings', async () => {
    const first = await createVault(context, 'state-value-with-enough-entropy-0002');
    await call(context.options, {
      path: OAUTH_BROKER_PATHS.session,
      body: { vaultId: first, operation: 'read', destinationId: 'destination-google-a' },
    });
    await createVault(context, 'state-value-with-enough-entropy-0003');
    const result = await call(context.options, {
      path: OAUTH_BROKER_PATHS.accountDelete,
      body: {},
    });
    expect(json(result)).toEqual({ deletedVaults: 2, providerRevoked: 2 });
    expect(context.store.snapshotVaults()).toHaveLength(0);
    expect(context.store.snapshotSessions()).toHaveLength(0);
    expect(context.store.snapshotAudits().at(-1)).toMatchObject({
      action: 'account_delete',
      detailCode: 'provider_revoke_confirmed',
    });
  });

  it('applies the hosted route limiter before touching provider state', async () => {
    context.options.requestLimiter = { check: () => ({ allowed: false, retryAfterSeconds: 42 }) };
    const result = await start(context);
    expect(result.status).toBe(429);
    expect(result.headers['retry-after']).toBe('42');
    expect(context.store.snapshotAudits()).toHaveLength(0);
  });

  it('enforces exact-allowlist CORS', async () => {
    const result = await call(context.options, {
      path: OAUTH_BROKER_PATHS.connectStart,
      origin: 'https://app.example.test.evil.tld',
      body: {},
    });
    expect(result.status).toBe(403);
    expect(json(result)).toEqual({ error: 'origin_not_allowed' });
  });

  it('audit logs contain no token canaries and remain safe through log redaction', async () => {
    const vaultId = await createVault(context);
    await call(context.options, {
      path: OAUTH_BROKER_PATHS.session,
      body: { vaultId, operation: 'quota', destinationId: 'destination-google-a' },
    });
    const text = JSON.stringify(redactForLog(context.logs));
    expect(text).not.toContain(REFRESH_TOKEN);
    expect(text).not.toContain(ACCESS_TOKEN);
    expect(text).not.toContain('client-secret-canary');
  });

  it('file mode answers broker_unavailable and writes no shadow vault', async () => {
    const options: OAuthBrokerOptions = {
      ...context.options,
      store: new FileOAuthBrokerStore(),
    };
    const result = await start({ ...context, options });
    expect(result.status).toBe(503);
    expect(json(result)).toEqual({ error: 'broker_unavailable' });
    expect(context.provider.requests).toHaveLength(0);
  });
});
