import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { promises as fs } from 'node:fs';
import http from 'node:http';
import type { HttpTransport, HttpTransportRequest, HttpTransportResponse } from '@mylife/sync';
import type { MeerkatHostedSubject } from './hosted-api';
import { applyHttpCors } from './http-cors';
import type { HostedRequestLimiter } from './hosted-rate-limiter';
import type { Kms, KmsContext } from './oauth-kms';
import {
  OAuthBrokerStoreUnavailableError,
  type OAuthBrokerAuditAction,
  type OAuthBrokerAuditEvent,
  type OAuthBrokerStore,
  type OAuthPendingConnect,
  type OAuthVaultRecord,
} from './oauth-broker-store';

export const OAUTH_BROKER_V1_PREFIX = '/api/oauth/v1';
export const OAUTH_BROKER_PATHS = {
  connectStart: `${OAUTH_BROKER_V1_PREFIX}/connect/start`,
  connectComplete: `${OAUTH_BROKER_V1_PREFIX}/connect/complete`,
  session: `${OAUTH_BROKER_V1_PREFIX}/session`,
  revoke: `${OAUTH_BROKER_V1_PREFIX}/revoke`,
  accountDelete: `${OAUTH_BROKER_V1_PREFIX}/account/delete`,
  credentialPut: `${OAUTH_BROKER_V1_PREFIX}/storage-credential/put`,
  credentialSession: `${OAUTH_BROKER_V1_PREFIX}/storage-credential/session`,
  credentialRevoke: `${OAUTH_BROKER_V1_PREFIX}/storage-credential/revoke`,
} as const;

export type OAuthBrokerOperation = 'health' | 'quota' | 'read' | 'write' | 'list' | 'delete';

export type OAuthBrokerErrorCode =
  | 'auth_required'
  | 'origin_not_allowed'
  | 'rate_limited'
  | 'bad_request'
  | 'method_not_allowed'
  | 'not_found'
  | 'provider_not_configured'
  | 'redirect_not_allowed'
  | 'invalid_state'
  | 'state_expired'
  | 'subject_mismatch'
  | 'invalid_code_verifier'
  | 'provider_authorization_failed'
  | 'refresh_token_missing'
  | 'vault_not_found'
  | 'broker_unavailable'
  | 'provider_error'
  | 'internal_error';

export interface OAuthProviderConfig {
  id: string;
  authUrl: string;
  tokenUrl: string;
  revokeUrl: string | null;
  clientId: string;
  clientSecretFile: string;
  clientSecret: string;
  redirectAllowlist: readonly string[];
  scopes: readonly string[];
  authorizationParams?: Readonly<Record<string, string>>;
}

export class OAuthProviderRegistry {
  private readonly providers = new Map<string, OAuthProviderConfig>();

  constructor(configs: readonly OAuthProviderConfig[] = []) {
    for (const config of configs) this.register(config);
  }

  register(config: OAuthProviderConfig): void {
    validateProviderConfig(config);
    if (this.providers.has(config.id)) throw new Error(`OAuth provider ${config.id} is duplicated`);
    this.providers.set(config.id, {
      ...config,
      redirectAllowlist: [...config.redirectAllowlist],
      scopes: [...config.scopes],
      authorizationParams: config.authorizationParams
        ? { ...config.authorizationParams }
        : undefined,
    });
  }

  get(provider: string): OAuthProviderConfig | null {
    return this.providers.get(provider)?.id === provider
      ? this.providers.get(provider) ?? null
      : null;
  }

  ids(): string[] {
    return [...this.providers.keys()].sort();
  }
}

export interface LoadOAuthProviderRegistryOptions {
  env?: Readonly<Record<string, string | undefined>>;
  readTextFile?: (path: string) => Promise<string>;
}

const KNOWN_PROVIDERS = ['google', 'dropbox', 'onedrive', 'box'] as const;
const DEFAULT_PROVIDER_SCOPES: Readonly<Record<string, readonly string[]>> = {
  google: ['https://www.googleapis.com/auth/drive.file'],
  dropbox: [
    'files.content.read',
    'files.content.write',
    'files.metadata.read',
    'account_info.read',
  ],
  onedrive: ['Files.ReadWrite.AppFolder', 'offline_access'],
  // Box has no app-folder OAuth scope. The adapter enforces a dedicated folder boundary.
  box: ['root_readwrite'],
};
const DEFAULT_AUTHORIZATION_PARAMS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  dropbox: { token_access_type: 'offline' },
};
const PROVIDER_ID = /^[a-z][a-z0-9_-]{0,31}$/u;
const SAFE_STATE = /^[A-Za-z0-9._~-]{16,512}$/u;
const PKCE_CHALLENGE = /^[A-Za-z0-9_-]{43}$/u;
const PKCE_VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/u;
const SAFE_ID = /^[A-Za-z0-9._:-]{1,200}$/u;
const OPERATIONS = new Set<OAuthBrokerOperation>(['health', 'quota', 'read', 'write', 'list', 'delete']);
const DEFAULT_PENDING_TTL_MS = 10 * 60_000;
const DEFAULT_SESSION_TTL_MS = 10 * 60_000;
const MAX_JSON_BODY_BYTES = 64 * 1024;
const MAX_PROVIDER_BODY_BYTES = 128 * 1024;
const DATA_KEY_BYTES = 32;
const GCM_NONCE_BYTES = 12;
const GCM_TAG_BYTES = 16;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function loadOAuthProviderRegistryFromEnv(
  options: LoadOAuthProviderRegistryOptions = {},
): Promise<OAuthProviderRegistry> {
  const env = options.env ?? process.env;
  const readTextFile = options.readTextFile ?? ((path: string) => fs.readFile(path, 'utf8'));
  const requested = new Set(
    (env.MEERKAT_OAUTH_PROVIDERS ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  for (const provider of KNOWN_PROVIDERS) {
    const prefix = `MEERKAT_OAUTH_${provider.toUpperCase()}_`;
    if (Object.keys(env).some((key) => key.startsWith(prefix) && Boolean(env[key]?.trim()))) {
      requested.add(provider);
    }
  }
  const configs: OAuthProviderConfig[] = [];
  for (const provider of requested) {
    if (!PROVIDER_ID.test(provider)) throw new Error('OAuth provider id is invalid');
    const prefix = `MEERKAT_OAUTH_${provider.toUpperCase()}_`;
    const authUrl = env[`${prefix}AUTH_URL`]?.trim();
    const tokenUrl = env[`${prefix}TOKEN_URL`]?.trim();
    const revokeUrlValue = env[`${prefix}REVOKE_URL`]?.trim();
    const clientId = env[`${prefix}CLIENT_ID`]?.trim();
    const clientSecretFile = env[`${prefix}CLIENT_SECRET_FILE`]?.trim();
    const redirectAllowlist = splitConfiguredList(env[`${prefix}REDIRECT_ALLOWLIST`]);
    const configuredScopes = splitConfiguredList(env[`${prefix}SCOPES`]);
    const scopes = configuredScopes.length > 0
      ? configuredScopes
      : [...(DEFAULT_PROVIDER_SCOPES[provider] ?? [])];
    if (!authUrl || !tokenUrl || !clientId || !clientSecretFile
      || redirectAllowlist.length === 0 || scopes.length === 0) {
      throw new Error(`OAuth provider ${provider} registration is incomplete`);
    }
    let clientSecret: string;
    try {
      clientSecret = (await readTextFile(clientSecretFile)).trim();
    } catch {
      throw new Error(`OAuth provider ${provider} client secret file is unreadable`);
    }
    if (!clientSecret) throw new Error(`OAuth provider ${provider} client secret file is empty`);
    configs.push({
      id: provider,
      authUrl,
      tokenUrl,
      revokeUrl: revokeUrlValue || null,
      clientId,
      clientSecretFile,
      clientSecret,
      redirectAllowlist,
      scopes,
      ...(DEFAULT_AUTHORIZATION_PARAMS[provider]
        ? { authorizationParams: { ...DEFAULT_AUTHORIZATION_PARAMS[provider] } }
        : {}),
    });
  }
  return new OAuthProviderRegistry(configs);
}

export interface OAuthBrokerOptions {
  store: OAuthBrokerStore;
  providers: OAuthProviderRegistry;
  kms?: Kms;
  providerTransport: HttpTransport;
  authorize(req: http.IncomingMessage): MeerkatHostedSubject | null | Promise<MeerkatHostedSubject | null>;
  requestLimiter?: Pick<HostedRequestLimiter, 'check'>;
  corsAllowedOrigins?: readonly string[];
  pendingTtlMs?: number;
  sessionTtlMs?: number;
  now?: () => number;
  randomUuid?: () => string;
  randomBytes?: (size: number) => Buffer;
  log?: (event: string, detail: Record<string, unknown>) => void;
}

export interface OAuthBrokerConnectStartResult {
  authorizationUrl: string;
  expiresAt: string;
}

export interface OAuthBrokerConnectCompleteResult {
  vaultId: string;
  accountHint: string | null;
}

export interface OAuthBrokerSessionResult {
  accessToken: string;
  tokenType: 'Bearer';
  sessionId: string;
  destinationId: string;
  operations: OAuthBrokerOperation[];
  expiresAt: string;
}

export interface OAuthBrokerRevokeResult {
  revoked: true;
  providerRevoked: boolean;
}

export interface OAuthBrokerAccountDeleteResult {
  deletedVaults: number;
  providerRevoked: number;
}

export type OAuthBrokerHandler = (req: http.IncomingMessage, res: http.ServerResponse) => void;

class OAuthBrokerRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: OAuthBrokerErrorCode,
  ) {
    super(code);
    this.name = 'OAuthBrokerRequestError';
  }
}

interface ProviderTokenPayload {
  accessToken: string | null;
  refreshToken: string | null;
  expiresInSeconds: number | null;
  scopes: string[];
  email: string | null;
}

interface AuditContext {
  action: OAuthBrokerAuditAction;
  subjectId: string;
  provider?: string | null;
  vaultId?: string | null;
  destinationId?: string | null;
  operation?: string | null;
}

function splitConfiguredList(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string')) {
        return [...new Set(parsed.map((entry) => entry.trim()).filter(Boolean))];
      }
    } catch {
      return [];
    }
  }
  return [...new Set(trimmed.split(/[\s,]+/u).map((entry) => entry.trim()).filter(Boolean))];
}

function validateHttpsEndpoint(value: string, name: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} is invalid`);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new Error(`${name} must be a credential-free HTTPS URL`);
  }
}

function validateProviderConfig(config: OAuthProviderConfig): void {
  if (!PROVIDER_ID.test(config.id)) throw new Error('OAuth provider id is invalid');
  validateHttpsEndpoint(config.authUrl, 'OAuth authorization URL');
  validateHttpsEndpoint(config.tokenUrl, 'OAuth token URL');
  if (config.revokeUrl !== null) validateHttpsEndpoint(config.revokeUrl, 'OAuth revoke URL');
  if (!config.clientId.trim() || !config.clientSecretFile.trim() || !config.clientSecret) {
    throw new Error('OAuth provider client registration is incomplete');
  }
  if (config.redirectAllowlist.length === 0 || new Set(config.redirectAllowlist).size !== config.redirectAllowlist.length) {
    throw new Error('OAuth provider redirect allowlist is empty or duplicated');
  }
  for (const redirect of config.redirectAllowlist) {
    try {
      const parsed = new URL(redirect);
      if (parsed.username || parsed.password || parsed.hash) throw new Error('unsafe');
    } catch {
      throw new Error('OAuth provider redirect allowlist contains an invalid URI');
    }
  }
  if (config.scopes.length === 0 || config.scopes.some((scope) => !scope.trim())) {
    throw new Error('OAuth provider scopes are invalid');
  }
}

function stateHash(state: string): string {
  return createHash('sha256').update(state, 'utf8').digest('hex');
}

function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

function constantStringEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

function kmsContext(record: Pick<OAuthVaultRecord, 'vaultId' | 'provider' | 'subjectId'>): KmsContext {
  return {
    purpose: record.provider.startsWith('storage_') ? 'storage_credential' : 'oauth_refresh_token',
    vaultId: record.vaultId,
    provider: record.provider,
    subjectId: record.subjectId,
  };
}

function refreshTokenAad(record: Pick<OAuthVaultRecord, 'vaultId' | 'provider' | 'subjectId'>): Buffer {
  return Buffer.from(JSON.stringify([
    record.provider.startsWith('storage_')
      ? 'meerkat-storage-credential-v1'
      : 'meerkat-oauth-refresh-v1',
    record.vaultId,
    record.provider,
    record.subjectId,
  ]), 'utf8');
}

async function putStorageCredential(
  body: Record<string, unknown>,
  subject: MeerkatHostedSubject,
  options: OAuthBrokerOptions,
): Promise<{ vaultId: string }> {
  const kind = requiredString(body, 'kind');
  const secret = requiredString(body, 'secret');
  if ((kind !== 'webdav' && kind !== 's3' && kind !== 'connected_server')
    || !secret || secret.length > MAX_JSON_BODY_BYTES) {
    throw new OAuthBrokerRequestError(400, 'bad_request');
  }
  if (!options.kms) throw new OAuthBrokerRequestError(503, 'broker_unavailable');
  const vaultId = (options.randomUuid ?? randomUUID)();
  const identity = { vaultId, provider: `storage_${kind}`, subjectId: subject.subjectId };
  const sealed = await sealRefreshToken(secret, identity, options.kms, options.randomBytes ?? randomBytes);
  await options.store.putVault({
    ...identity,
    ...sealed,
    accountHint: null,
    scopes: ['credential_broker'],
    createdAt: new Date((options.now ?? Date.now)()).toISOString(),
  });
  return { vaultId };
}

async function issueStorageCredentialSession(
  body: Record<string, unknown>,
  subject: MeerkatHostedSubject,
  options: OAuthBrokerOptions,
): Promise<{
  credential: string;
  sessionId: string;
  destinationId: string;
  operations: readonly string[];
  expiresAt: string;
}> {
  const vaultId = requiredString(body, 'vaultId');
  const destinationId = requiredString(body, 'destinationId');
  const operation = requiredString(body, 'operation');
  if (!vaultId || !SAFE_ID.test(vaultId) || !destinationId || !SAFE_ID.test(destinationId)
    || !operation || !OPERATIONS.has(operation as OAuthBrokerOperation)) {
    throw new OAuthBrokerRequestError(400, 'bad_request');
  }
  const vault = await options.store.getVault(vaultId, subject.subjectId);
  if (!vault || !['storage_webdav', 'storage_s3', 'storage_connected_server'].includes(vault.provider)) {
    throw new OAuthBrokerRequestError(404, 'vault_not_found');
  }
  if (!options.kms) throw new OAuthBrokerRequestError(503, 'broker_unavailable');
  const credentialBytes = await openRefreshToken(vault, options.kms);
  const nowMs = (options.now ?? Date.now)();
  const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  if (!Number.isSafeInteger(sessionTtlMs) || sessionTtlMs <= 0 || sessionTtlMs > DEFAULT_SESSION_TTL_MS) {
    credentialBytes.fill(0);
    throw new OAuthBrokerRequestError(503, 'broker_unavailable');
  }
  const expiresAt = new Date(nowMs + sessionTtlMs).toISOString();
  const sessionId = (options.randomUuid ?? randomUUID)();
  try {
    const credential = decoder.decode(credentialBytes);
    await options.store.recordSession({
      sessionId,
      vaultId,
      provider: vault.provider,
      subjectId: subject.subjectId,
      destinationId,
      operations: [operation],
      createdAt: new Date(nowMs).toISOString(),
      expiresAt,
    });
    return { credential, sessionId, destinationId, operations: [operation], expiresAt };
  } finally {
    credentialBytes.fill(0);
  }
}

async function revokeStorageCredential(
  body: Record<string, unknown>,
  subject: MeerkatHostedSubject,
  options: OAuthBrokerOptions,
): Promise<{ revoked: true }> {
  const vaultId = requiredString(body, 'vaultId');
  if (!vaultId || !SAFE_ID.test(vaultId)) throw new OAuthBrokerRequestError(400, 'bad_request');
  const vault = await options.store.getVault(vaultId, subject.subjectId);
  if (vault && !['storage_webdav', 'storage_s3', 'storage_connected_server'].includes(vault.provider)) {
    throw new OAuthBrokerRequestError(404, 'vault_not_found');
  }
  await options.store.takeVault(vaultId, subject.subjectId);
  return { revoked: true };
}

async function sealRefreshToken(
  refreshToken: string,
  record: Pick<OAuthVaultRecord, 'vaultId' | 'provider' | 'subjectId'>,
  kms: Kms,
  random: (size: number) => Buffer,
): Promise<Pick<OAuthVaultRecord, 'encryptedRefreshToken' | 'wrappedDataKey' | 'nonce'>> {
  let generated: Awaited<ReturnType<Kms['generateDataKey']>>;
  try {
    generated = await kms.generateDataKey(kmsContext(record));
  } catch {
    throw new OAuthBrokerRequestError(503, 'broker_unavailable');
  }
  const dataKey = generated.plaintextKey;
  if (dataKey.byteLength !== DATA_KEY_BYTES) {
    dataKey.fill(0);
    throw new OAuthBrokerRequestError(503, 'broker_unavailable');
  }
  const nonce = random(GCM_NONCE_BYTES);
  if (nonce.byteLength !== GCM_NONCE_BYTES) {
    dataKey.fill(0);
    nonce.fill(0);
    throw new OAuthBrokerRequestError(503, 'broker_unavailable');
  }
  const plaintext = Buffer.from(refreshToken, 'utf8');
  try {
    const cipher = createCipheriv('aes-256-gcm', dataKey, nonce);
    cipher.setAAD(refreshTokenAad(record));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
    return {
      encryptedRefreshToken: ciphertext,
      wrappedDataKey: generated.wrappedKey.slice(),
      nonce: new Uint8Array(nonce),
    };
  } catch {
    throw new OAuthBrokerRequestError(503, 'broker_unavailable');
  } finally {
    plaintext.fill(0);
    dataKey.fill(0);
    nonce.fill(0);
  }
}

async function openRefreshToken(record: OAuthVaultRecord, kms: Kms): Promise<Buffer> {
  let dataKey: Uint8Array;
  try {
    dataKey = await kms.decryptDataKey(record.wrappedDataKey, kmsContext(record));
  } catch {
    throw new OAuthBrokerRequestError(503, 'broker_unavailable');
  }
  if (dataKey.byteLength !== DATA_KEY_BYTES
    || record.nonce.byteLength !== GCM_NONCE_BYTES
    || record.encryptedRefreshToken.byteLength < GCM_TAG_BYTES) {
    dataKey.fill(0);
    throw new OAuthBrokerRequestError(503, 'broker_unavailable');
  }
  const envelope = Buffer.from(record.encryptedRefreshToken);
  const ciphertext = envelope.subarray(0, envelope.byteLength - GCM_TAG_BYTES);
  const tag = envelope.subarray(envelope.byteLength - GCM_TAG_BYTES);
  try {
    const decipher = createDecipheriv('aes-256-gcm', dataKey, record.nonce);
    decipher.setAAD(refreshTokenAad(record));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new OAuthBrokerRequestError(503, 'broker_unavailable');
  } finally {
    dataKey.fill(0);
    envelope.fill(0);
  }
}

function maskedAccountHint(email: string | null): string | null {
  if (!email) return null;
  const match = /^([^@\s]+)@([^@\s]+)$/u.exec(email.trim());
  if (!match?.[1] || !match[2]) return null;
  return `${match[1][0]}***@${match[2].toLowerCase()}`;
}

function formBody(values: Readonly<Record<string, string>>): Uint8Array {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  return encoder.encode(body.toString());
}

async function providerRequest(
  transport: HttpTransport,
  request: HttpTransportRequest,
): Promise<HttpTransportResponse> {
  let response: HttpTransportResponse;
  try {
    response = await transport(request);
  } catch {
    throw new OAuthBrokerRequestError(502, 'provider_error');
  }
  if (!Number.isSafeInteger(response.status)
    || response.status < 100
    || response.status > 599
    || !(response.body instanceof Uint8Array)
    || response.body.byteLength > MAX_PROVIDER_BODY_BYTES) {
    throw new OAuthBrokerRequestError(502, 'provider_error');
  }
  return response;
}

function providerJson(response: HttpTransportResponse): Record<string, unknown> {
  try {
    const parsed = JSON.parse(decoder.decode(response.body)) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Typed below.
  }
  throw new OAuthBrokerRequestError(502, 'provider_error');
}

function parseProviderToken(response: HttpTransportResponse): ProviderTokenPayload {
  const body = providerJson(response);
  const expiresRaw = body.expires_in;
  const expiresInSeconds = typeof expiresRaw === 'number' && Number.isFinite(expiresRaw) && expiresRaw > 0
    ? expiresRaw
    : typeof expiresRaw === 'string' && /^\d+$/u.test(expiresRaw) && Number(expiresRaw) > 0
      ? Number(expiresRaw)
      : null;
  const scope = typeof body.scope === 'string'
    ? body.scope.split(/\s+/u).filter((value) => safeProviderValue(value, 512) !== null).slice(0, 64)
    : [];
  return {
    accessToken: safeProviderValue(body.access_token, 65_536),
    refreshToken: safeProviderValue(body.refresh_token, 65_536),
    expiresInSeconds,
    scopes: scope,
    email: typeof body.email === 'string'
      ? body.email
      : typeof body.account_email === 'string' ? body.account_email : null,
  };
}

function safeProviderValue(value: unknown, maximumLength: number): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= maximumLength
    && !/[\r\n\0]/u.test(value)
    ? value
    : null;
}

function providerErrorCode(response: HttpTransportResponse): string | null {
  try {
    const body = providerJson(response);
    return typeof body.error === 'string' ? body.error : null;
  } catch {
    return null;
  }
}

async function exchangeAuthorizationCode(
  provider: OAuthProviderConfig,
  code: string,
  codeVerifier: string,
  redirectUri: string,
  transport: HttpTransport,
): Promise<ProviderTokenPayload> {
  const response = await providerRequest(transport, {
    method: 'POST',
    url: provider.tokenUrl,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: formBody({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
    }),
  });
  if (response.status < 200 || response.status >= 300) {
    throw new OAuthBrokerRequestError(
      response.status === 400 ? 401 : 502,
      response.status === 400 ? 'provider_authorization_failed' : 'provider_error',
    );
  }
  return parseProviderToken(response);
}

async function refreshAccessToken(
  provider: OAuthProviderConfig,
  refreshToken: string,
  transport: HttpTransport,
): Promise<ProviderTokenPayload> {
  const response = await providerRequest(transport, {
    method: 'POST',
    url: provider.tokenUrl,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: formBody({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
    }),
  });
  if (response.status < 200 || response.status >= 300) {
    const invalidGrant = response.status === 400 && providerErrorCode(response) === 'invalid_grant';
    throw new OAuthBrokerRequestError(invalidGrant ? 401 : 502, invalidGrant ? 'auth_required' : 'provider_error');
  }
  return parseProviderToken(response);
}

async function bestEffortProviderRevoke(
  provider: OAuthProviderConfig | null,
  refreshToken: string,
  transport: HttpTransport,
): Promise<boolean> {
  if (!provider?.revokeUrl) return false;
  try {
    const response = await providerRequest(transport, {
      method: 'POST',
      url: provider.revokeUrl,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: formBody({ token: refreshToken, client_id: provider.clientId, client_secret: provider.clientSecret }),
    });
    return response.status >= 200 && response.status < 300;
  } catch {
    return false;
  }
}

function requiredString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function readJsonObject(req: http.IncomingMessage): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : chunk as Buffer;
    size += bytes.byteLength;
    if (size > MAX_JSON_BODY_BYTES) return null;
    chunks.push(bytes);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function requestPath(req: http.IncomingMessage): string {
  try {
    return new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`).pathname;
  } catch {
    return req.url ?? '/';
  }
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
  });
  res.end(payload);
}

function sendError(res: http.ServerResponse, status: number, error: OAuthBrokerErrorCode): void {
  sendJson(res, status, { error });
}

function brokerError(error: unknown): OAuthBrokerRequestError {
  if (error instanceof OAuthBrokerRequestError) return error;
  if (error instanceof OAuthBrokerStoreUnavailableError) {
    return new OAuthBrokerRequestError(503, 'broker_unavailable');
  }
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? error.code
    : null;
  if (code === 'postgres_store_unavailable' || code === 'oauth_kms_error') {
    return new OAuthBrokerRequestError(503, 'broker_unavailable');
  }
  return new OAuthBrokerRequestError(500, 'internal_error');
}

function auditEvent(
  context: AuditContext,
  outcome: OAuthBrokerAuditEvent['outcome'],
  detailCode: string | null,
  nowMs: number,
  uuid: () => string,
): OAuthBrokerAuditEvent {
  return {
    auditId: uuid(),
    subjectId: context.subjectId,
    action: context.action,
    outcome,
    provider: context.provider ?? null,
    vaultId: context.vaultId ?? null,
    destinationId: context.destinationId ?? null,
    operation: context.operation ?? null,
    detailCode,
    createdAt: new Date(nowMs).toISOString(),
  };
}

async function appendAudit(
  options: OAuthBrokerOptions,
  context: AuditContext,
  outcome: OAuthBrokerAuditEvent['outcome'],
  detailCode: string | null,
): Promise<void> {
  const nowMs = (options.now ?? Date.now)();
  const uuid = options.randomUuid ?? randomUUID;
  await options.store.appendAudit(auditEvent(context, outcome, detailCode, nowMs, uuid));
  options.log?.('oauth_broker_audit', {
    action: context.action,
    outcome,
    provider: context.provider ?? null,
    vaultId: context.vaultId ?? null,
    destinationId: context.destinationId ?? null,
    operation: context.operation ?? null,
    detailCode,
  });
}

function providerAuthorizationUrl(
  provider: OAuthProviderConfig,
  redirectUri: string,
  codeChallenge: string,
  state: string,
): string {
  const url = new URL(provider.authUrl);
  for (const [key, value] of Object.entries(provider.authorizationParams ?? {})) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', provider.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', provider.scopes.join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.href;
}

async function startConnect(
  body: Record<string, unknown>,
  subject: MeerkatHostedSubject,
  options: OAuthBrokerOptions,
): Promise<OAuthBrokerConnectStartResult> {
  const providerId = requiredString(body, 'provider');
  const destinationLabel = requiredString(body, 'destinationLabel');
  const redirectUri = requiredString(body, 'redirectUri');
  const codeChallenge = requiredString(body, 'codeChallenge');
  const state = requiredString(body, 'state');
  if (!providerId || !PROVIDER_ID.test(providerId) || !destinationLabel
    || destinationLabel.length > 120 || !redirectUri || !codeChallenge || !state
    || !PKCE_CHALLENGE.test(codeChallenge) || !SAFE_STATE.test(state)) {
    throw new OAuthBrokerRequestError(400, 'bad_request');
  }
  const provider = options.providers.get(providerId);
  if (!provider) throw new OAuthBrokerRequestError(503, 'provider_not_configured');
  if (!options.kms) throw new OAuthBrokerRequestError(503, 'broker_unavailable');
  if (!provider.redirectAllowlist.includes(redirectUri)) {
    throw new OAuthBrokerRequestError(400, 'redirect_not_allowed');
  }
  const nowMs = (options.now ?? Date.now)();
  const ttl = options.pendingTtlMs ?? DEFAULT_PENDING_TTL_MS;
  if (!Number.isSafeInteger(ttl) || ttl <= 0 || ttl > 60 * 60_000) {
    throw new OAuthBrokerRequestError(503, 'broker_unavailable');
  }
  const expiresAt = new Date(nowMs + ttl).toISOString();
  const pending: OAuthPendingConnect = {
    stateHash: stateHash(state),
    codeChallenge,
    subjectId: subject.subjectId,
    provider: providerId,
    destinationLabel,
    redirectUri,
    createdAt: new Date(nowMs).toISOString(),
    expiresAt,
  };
  await options.store.putPendingConnect(pending);
  return { authorizationUrl: providerAuthorizationUrl(provider, redirectUri, codeChallenge, state), expiresAt };
}

async function completeConnect(
  body: Record<string, unknown>,
  subject: MeerkatHostedSubject,
  options: OAuthBrokerOptions,
): Promise<OAuthBrokerConnectCompleteResult> {
  const state = requiredString(body, 'state');
  if (!state || !SAFE_STATE.test(state)) {
    throw new OAuthBrokerRequestError(400, 'bad_request');
  }
  const pending = await options.store.consumePendingConnect(stateHash(state));
  if (!pending) throw new OAuthBrokerRequestError(400, 'invalid_state');
  const code = requiredString(body, 'code');
  const codeVerifier = requiredString(body, 'codeVerifier');
  if (!code || code.length > 4096 || !codeVerifier) {
    throw new OAuthBrokerRequestError(400, 'bad_request');
  }
  if (Date.parse(pending.expiresAt) <= (options.now ?? Date.now)()) {
    throw new OAuthBrokerRequestError(400, 'state_expired');
  }
  if (pending.subjectId !== subject.subjectId) {
    throw new OAuthBrokerRequestError(403, 'subject_mismatch');
  }
  if (!PKCE_VERIFIER.test(codeVerifier)
    || !constantStringEqual(pkceChallenge(codeVerifier), pending.codeChallenge)) {
    throw new OAuthBrokerRequestError(400, 'invalid_code_verifier');
  }
  const provider = options.providers.get(pending.provider);
  if (!provider) throw new OAuthBrokerRequestError(503, 'provider_not_configured');
  if (!options.kms) throw new OAuthBrokerRequestError(503, 'broker_unavailable');
  const token = await exchangeAuthorizationCode(
    provider,
    code,
    codeVerifier,
    pending.redirectUri,
    options.providerTransport,
  );
  if (!token.refreshToken) throw new OAuthBrokerRequestError(502, 'refresh_token_missing');
  const grantedScopes = token.scopes.length > 0 ? token.scopes : [...provider.scopes];
  if (!provider.scopes.every((scope) => grantedScopes.includes(scope))) {
    throw new OAuthBrokerRequestError(401, 'provider_authorization_failed');
  }
  const uuid = options.randomUuid ?? randomUUID;
  const vaultId = uuid();
  const identity = { vaultId, provider: provider.id, subjectId: subject.subjectId };
  const sealed = await sealRefreshToken(
    token.refreshToken,
    identity,
    options.kms,
    options.randomBytes ?? randomBytes,
  );
  const accountHint = maskedAccountHint(token.email);
  await options.store.putVault({
    ...identity,
    ...sealed,
    accountHint,
    scopes: grantedScopes,
    createdAt: new Date((options.now ?? Date.now)()).toISOString(),
  });
  return { vaultId, accountHint };
}

async function issueSession(
  body: Record<string, unknown>,
  subject: MeerkatHostedSubject,
  options: OAuthBrokerOptions,
): Promise<OAuthBrokerSessionResult> {
  const vaultId = requiredString(body, 'vaultId');
  const operationRaw = requiredString(body, 'operation');
  const destinationId = requiredString(body, 'destinationId');
  if (!vaultId || !SAFE_ID.test(vaultId) || !operationRaw
    || !OPERATIONS.has(operationRaw as OAuthBrokerOperation)
    || !destinationId || !SAFE_ID.test(destinationId)) {
    throw new OAuthBrokerRequestError(400, 'bad_request');
  }
  const operation = operationRaw as OAuthBrokerOperation;
  const vault = await options.store.getVault(vaultId, subject.subjectId);
  if (!vault) throw new OAuthBrokerRequestError(404, 'vault_not_found');
  const provider = options.providers.get(vault.provider);
  if (!provider) throw new OAuthBrokerRequestError(503, 'provider_not_configured');
  if (!options.kms) throw new OAuthBrokerRequestError(503, 'broker_unavailable');
  const refreshTokenBytes = await openRefreshToken(vault, options.kms);
  let token: ProviderTokenPayload;
  let refreshToken: string;
  try {
    refreshToken = decoder.decode(refreshTokenBytes);
    token = await refreshAccessToken(provider, refreshToken, options.providerTransport);
  } finally {
    refreshTokenBytes.fill(0);
  }
  if (!token.accessToken || token.expiresInSeconds === null) {
    throw new OAuthBrokerRequestError(502, 'provider_error');
  }
  const grantedScopes = token.scopes.length > 0 ? token.scopes : [...vault.scopes];
  if (!provider.scopes.every((scope) => grantedScopes.includes(scope))) {
    throw new OAuthBrokerRequestError(401, 'auth_required');
  }
  if (token.refreshToken && token.refreshToken !== refreshToken) {
    const sealed = await sealRefreshToken(
      token.refreshToken,
      vault,
      options.kms,
      options.randomBytes ?? randomBytes,
    );
    const replaced = await options.store.replaceVault({
      ...vault,
      ...sealed,
      accountHint: maskedAccountHint(token.email) ?? vault.accountHint,
      scopes: grantedScopes,
    });
    if (!replaced) throw new OAuthBrokerRequestError(404, 'vault_not_found');
  }
  const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  if (!Number.isSafeInteger(sessionTtlMs) || sessionTtlMs <= 0 || sessionTtlMs > DEFAULT_SESSION_TTL_MS) {
    throw new OAuthBrokerRequestError(503, 'broker_unavailable');
  }
  const nowMs = (options.now ?? Date.now)();
  const providerTtlMs = Math.max(1, Math.floor(token.expiresInSeconds * 1000));
  const expiresAt = new Date(nowMs + Math.min(sessionTtlMs, providerTtlMs)).toISOString();
  const sessionId = (options.randomUuid ?? randomUUID)();
  await options.store.recordSession({
    sessionId,
    vaultId,
    provider: provider.id,
    subjectId: subject.subjectId,
    destinationId,
    operations: [operation],
    createdAt: new Date(nowMs).toISOString(),
    expiresAt,
  });
  return {
    accessToken: token.accessToken,
    tokenType: 'Bearer',
    sessionId,
    destinationId,
    operations: [operation],
    expiresAt,
  };
}

async function revokeVault(
  body: Record<string, unknown>,
  subject: MeerkatHostedSubject,
  options: OAuthBrokerOptions,
): Promise<OAuthBrokerRevokeResult> {
  const vaultId = requiredString(body, 'vaultId');
  if (!vaultId || !SAFE_ID.test(vaultId)) throw new OAuthBrokerRequestError(400, 'bad_request');
  const vault = await options.store.takeVault(vaultId, subject.subjectId);
  if (!vault) return { revoked: true, providerRevoked: false };
  if (!options.kms) return { revoked: true, providerRevoked: false };
  let refreshTokenBytes: Buffer;
  try {
    refreshTokenBytes = await openRefreshToken(vault, options.kms);
  } catch {
    return { revoked: true, providerRevoked: false };
  }
  try {
    const providerRevoked = await bestEffortProviderRevoke(
      options.providers.get(vault.provider),
      decoder.decode(refreshTokenBytes),
      options.providerTransport,
    );
    return { revoked: true, providerRevoked };
  } finally {
    refreshTokenBytes.fill(0);
  }
}

export async function deleteOAuthBrokerAccount(
  subjectId: string,
  options: Pick<OAuthBrokerOptions, 'store' | 'providers' | 'kms' | 'providerTransport'>,
): Promise<OAuthBrokerAccountDeleteResult> {
  const vaults = await options.store.takeVaultsForSubject(subjectId);
  let providerRevoked = 0;
  for (const vault of vaults) {
    if (!options.kms) continue;
    let refreshTokenBytes: Buffer;
    try {
      refreshTokenBytes = await openRefreshToken(vault, options.kms);
    } catch {
      continue;
    }
    try {
      if (await bestEffortProviderRevoke(
        options.providers.get(vault.provider),
        decoder.decode(refreshTokenBytes),
        options.providerTransport,
      )) providerRevoked += 1;
    } finally {
      refreshTokenBytes.fill(0);
    }
  }
  return { deletedVaults: vaults.length, providerRevoked };
}

export async function deleteOAuthBrokerAccountAudited(
  subjectId: string,
  options: OAuthBrokerOptions,
): Promise<OAuthBrokerAccountDeleteResult> {
  return executeAudited(
    { action: 'account_delete', subjectId },
    options,
    () => deleteOAuthBrokerAccount(subjectId, options),
    (result) => result.providerRevoked === result.deletedVaults
      ? 'provider_revoke_confirmed'
      : 'provider_revoke_partial',
  );
}

async function executeAudited<T>(
  context: AuditContext,
  options: OAuthBrokerOptions,
  operation: () => Promise<T>,
  successDetail: (result: T) => string | null = () => null,
): Promise<T> {
  try {
    const result = await operation();
    await appendAudit(options, context, 'success', successDetail(result));
    return result;
  } catch (error) {
    const normalized = brokerError(error);
    try {
      await appendAudit(options, context, 'failure', normalized.code);
    } catch (auditError) {
      throw brokerError(auditError);
    }
    throw normalized;
  }
}

export function isOAuthBrokerApiPath(pathname: string): boolean {
  return pathname === OAUTH_BROKER_V1_PREFIX || pathname.startsWith(`${OAUTH_BROKER_V1_PREFIX}/`);
}

export async function handleOAuthBrokerRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: OAuthBrokerOptions,
): Promise<void> {
  const path = requestPath(req);
  if (!applyHttpCors(req, res, {
    allowedOrigins: options.corsAllowedOrigins,
    methods: ['POST', 'OPTIONS'],
    headers: ['Authorization', 'Content-Type'],
  })) {
    sendError(res, 403, 'origin_not_allowed');
    return;
  }
  if ((req.method ?? 'GET') === 'OPTIONS') {
    res.writeHead(204, { 'Content-Length': '0' });
    res.end();
    return;
  }
  const rate = options.requestLimiter?.check(req, path);
  if (rate && !rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    sendError(res, 429, 'rate_limited');
    return;
  }
  if ((req.method ?? 'GET') !== 'POST') {
    sendError(res, 405, 'method_not_allowed');
    return;
  }
  const subject = await options.authorize(req);
  if (!subject) {
    sendError(res, 401, 'auth_required');
    return;
  }
  if (!options.store.available) {
    sendError(res, 503, 'broker_unavailable');
    return;
  }
  const body = await readJsonObject(req);
  if (!body) {
    sendError(res, 400, 'bad_request');
    return;
  }

  try {
    if (path === OAUTH_BROKER_PATHS.connectStart) {
      const provider = requiredString(body, 'provider');
      const result = await executeAudited(
        { action: 'connect_start', subjectId: subject.subjectId, provider },
        options,
        () => startConnect(body, subject, options),
      );
      sendJson(res, 200, result);
      return;
    }
    if (path === OAUTH_BROKER_PATHS.connectComplete) {
      const result = await executeAudited(
        { action: 'connect_complete', subjectId: subject.subjectId },
        options,
        () => completeConnect(body, subject, options),
      );
      sendJson(res, 200, result);
      return;
    }
    if (path === OAUTH_BROKER_PATHS.session) {
      const vaultId = requiredString(body, 'vaultId');
      const destinationId = requiredString(body, 'destinationId');
      const operation = requiredString(body, 'operation');
      const result = await executeAudited(
        { action: 'session_issue', subjectId: subject.subjectId, vaultId, destinationId, operation },
        options,
        () => issueSession(body, subject, options),
      );
      sendJson(res, 200, result);
      return;
    }
    if (path === OAUTH_BROKER_PATHS.revoke) {
      const vaultId = requiredString(body, 'vaultId');
      const result = await executeAudited(
        { action: 'revoke', subjectId: subject.subjectId, vaultId },
        options,
        () => revokeVault(body, subject, options),
        (revokeResult) => revokeResult.providerRevoked
          ? 'provider_revoke_confirmed'
          : 'provider_revoke_not_confirmed',
      );
      sendJson(res, 200, result);
      return;
    }
    if (path === OAUTH_BROKER_PATHS.accountDelete) {
      const result = await deleteOAuthBrokerAccountAudited(subject.subjectId, options);
      sendJson(res, 200, result);
      return;
    }
    if (path === OAUTH_BROKER_PATHS.credentialPut) {
      const provider = requiredString(body, 'kind');
      const result = await executeAudited(
        { action: 'credential_put', subjectId: subject.subjectId, provider },
        options,
        () => putStorageCredential(body, subject, options),
      );
      sendJson(res, 200, result);
      return;
    }
    if (path === OAUTH_BROKER_PATHS.credentialSession) {
      const vaultId = requiredString(body, 'vaultId');
      const destinationId = requiredString(body, 'destinationId');
      const operation = requiredString(body, 'operation');
      const result = await executeAudited(
        { action: 'credential_session', subjectId: subject.subjectId, vaultId, destinationId, operation },
        options,
        () => issueStorageCredentialSession(body, subject, options),
      );
      sendJson(res, 200, result);
      return;
    }
    if (path === OAUTH_BROKER_PATHS.credentialRevoke) {
      const vaultId = requiredString(body, 'vaultId');
      const result = await executeAudited(
        { action: 'credential_revoke', subjectId: subject.subjectId, vaultId },
        options,
        () => revokeStorageCredential(body, subject, options),
      );
      sendJson(res, 200, result);
      return;
    }
    sendError(res, 404, 'not_found');
  } catch (error) {
    const normalized = brokerError(error);
    sendError(res, normalized.status, normalized.code);
  }
}

export function createOAuthBrokerHandler(options: OAuthBrokerOptions): OAuthBrokerHandler {
  return (req, res) => {
    void handleOAuthBrokerRequest(req, res, options).catch((error) => {
      const normalized = brokerError(error);
      if (!res.headersSent) sendError(res, normalized.status, normalized.code);
      else res.end();
    });
  };
}

export function createFetchOAuthProviderTransport(
  fetchImpl: typeof fetch = fetch,
): HttpTransport {
  return async (request) => {
    const response = await fetchImpl(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body ? Buffer.from(request.body) : undefined,
      redirect: 'manual',
    });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, name) => { headers[name] = value; });
    return {
      status: response.status,
      headers,
      body: new Uint8Array(await response.arrayBuffer()),
    };
  };
}
