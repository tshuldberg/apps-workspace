import type { AccessTokenOperation } from './adapters/google-drive';
import type { HttpTransport, HttpTransportResponse } from './adapters/http';
import { callHttpTransport, decodeBoundedText } from './adapters/http';

export const OAUTH_BROKER_CLIENT_PATHS = {
  connectStart: '/api/oauth/v1/connect/start',
  connectComplete: '/api/oauth/v1/connect/complete',
  session: '/api/oauth/v1/session',
  revoke: '/api/oauth/v1/revoke',
  accountDelete: '/api/oauth/v1/account/delete',
} as const;

export type OAuthBrokerClientErrorCode =
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

export class OAuthBrokerClientError extends Error {
  constructor(
    readonly code: OAuthBrokerClientErrorCode,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = 'OAuthBrokerClientError';
  }
}

export interface OAuthBrokerConnectStartInput {
  provider: string;
  destinationLabel: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
}

export interface OAuthBrokerConnectStartResult {
  authorizationUrl: string;
  expiresAt: string;
}

export interface OAuthBrokerConnectCompleteInput {
  state: string;
  code: string;
  codeVerifier: string;
}

export interface OAuthBrokerConnectCompleteResult {
  vaultId: string;
  accountHint: string | null;
}

export interface OAuthBrokerSessionInput {
  vaultId: string;
  operation: AccessTokenOperation;
  destinationId: string;
}

export interface OAuthBrokerSessionResult {
  accessToken: string;
  tokenType: 'Bearer';
  sessionId: string;
  destinationId: string;
  operations: AccessTokenOperation[];
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

export interface OAuthBrokerClientOptions {
  baseUrl: string;
  transport: HttpTransport;
  getAuthorizationHeader: () => string | null | Promise<string | null>;
  maximumResponseBytes?: number;
  now?: () => number;
}

const DEFAULT_MAXIMUM_RESPONSE_BYTES = 128 * 1024;
const MAX_SESSION_TTL_MS = 10 * 60_000;
const SAFE_IDENTIFIER = /^[A-Za-z0-9._:-]{1,200}$/u;
const OPERATIONS = new Set<AccessTokenOperation>(['health', 'quota', 'read', 'write', 'list', 'delete']);
const encoder = new TextEncoder();

export class OAuthBrokerClient {
  private readonly baseUrl: URL;
  private readonly transport: HttpTransport;
  private readonly getAuthorizationHeader: OAuthBrokerClientOptions['getAuthorizationHeader'];
  private readonly maximumResponseBytes: number;
  private readonly now: () => number;

  constructor(options: OAuthBrokerClientOptions) {
    this.baseUrl = parseBrokerBaseUrl(options.baseUrl);
    this.transport = options.transport;
    this.getAuthorizationHeader = options.getAuthorizationHeader;
    this.maximumResponseBytes = positiveInteger(options.maximumResponseBytes ?? DEFAULT_MAXIMUM_RESPONSE_BYTES);
    this.now = options.now ?? Date.now;
  }

  async connectStart(input: OAuthBrokerConnectStartInput): Promise<OAuthBrokerConnectStartResult> {
    const body = await this.post(OAUTH_BROKER_CLIENT_PATHS.connectStart, input);
    const authorizationUrl = requiredString(body, 'authorizationUrl');
    const expiresAt = requiredFutureDate(body, 'expiresAt', this.now());
    if (!authorizationUrl || !expiresAt || !isSafeAuthorizationUrl(authorizationUrl)) {
      throw malformedResponse();
    }
    return { authorizationUrl, expiresAt };
  }

  async connectComplete(
    input: OAuthBrokerConnectCompleteInput,
  ): Promise<OAuthBrokerConnectCompleteResult> {
    const body = await this.post(OAUTH_BROKER_CLIENT_PATHS.connectComplete, input);
    const vaultId = requiredIdentifier(body, 'vaultId');
    const accountHint = nullableString(body, 'accountHint');
    if (!vaultId || accountHint === undefined) throw malformedResponse();
    return { vaultId, accountHint };
  }

  async session(input: OAuthBrokerSessionInput): Promise<OAuthBrokerSessionResult> {
    const body = await this.post(OAUTH_BROKER_CLIENT_PATHS.session, input);
    const accessToken = requiredToken(body, 'accessToken');
    const tokenType = body.tokenType;
    const sessionId = requiredIdentifier(body, 'sessionId');
    const destinationId = requiredIdentifier(body, 'destinationId');
    const expiresAt = requiredBoundedSessionDate(body, 'expiresAt', this.now());
    const operations = operationList(body.operations);
    if (!accessToken || tokenType !== 'Bearer' || !sessionId || !destinationId || !expiresAt
      || !operations || destinationId !== input.destinationId
      || operations.length !== 1 || operations[0] !== input.operation) {
      throw malformedResponse();
    }
    return { accessToken, tokenType, sessionId, destinationId, operations, expiresAt };
  }

  async revoke(vaultId: string): Promise<OAuthBrokerRevokeResult> {
    const body = await this.post(OAUTH_BROKER_CLIENT_PATHS.revoke, { vaultId });
    if (body.revoked !== true || typeof body.providerRevoked !== 'boolean') throw malformedResponse();
    return { revoked: true, providerRevoked: body.providerRevoked };
  }

  async deleteAccount(): Promise<OAuthBrokerAccountDeleteResult> {
    const body = await this.post(OAUTH_BROKER_CLIENT_PATHS.accountDelete, {});
    const deletedVaults = nonnegativeInteger(body.deletedVaults);
    const providerRevoked = nonnegativeInteger(body.providerRevoked);
    if (deletedVaults === null || providerRevoked === null || providerRevoked > deletedVaults) {
      throw malformedResponse();
    }
    return { deletedVaults, providerRevoked };
  }

  private async post(path: string, body: unknown): Promise<Record<string, unknown>> {
    const authorization = await this.readAuthorizationHeader();
    let response: HttpTransportResponse;
    try {
      response = await callHttpTransport(this.transport, {
        method: 'POST',
        url: new URL(path, this.baseUrl).href,
        headers: {
          Authorization: authorization,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: encoder.encode(JSON.stringify(body)),
      });
    } catch {
      throw new OAuthBrokerClientError('broker_unavailable', 503, true);
    }
    const parsed = parseObject(response, this.maximumResponseBytes);
    if (response.status < 200 || response.status >= 300) {
      const code = brokerErrorCode(parsed.error);
      throw new OAuthBrokerClientError(code, response.status, retryableError(code, response.status));
    }
    return parsed;
  }

  private async readAuthorizationHeader(): Promise<string> {
    let value: string | null;
    try {
      value = await this.getAuthorizationHeader();
    } catch {
      throw new OAuthBrokerClientError('auth_required', 401, false);
    }
    if (typeof value !== 'string' || !value.trim() || value.length > 8_192 || /[\r\n\0]/u.test(value)) {
      throw new OAuthBrokerClientError('auth_required', 401, false);
    }
    return value;
  }
}

function parseBrokerBaseUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new OAuthBrokerClientError('broker_unavailable', 503, false);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new OAuthBrokerClientError('broker_unavailable', 503, false);
  }
  url.pathname = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  return url;
}

function positiveInteger(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new OAuthBrokerClientError('broker_unavailable', 503, false);
  }
  return value;
}

function parseObject(response: HttpTransportResponse, maximumBytes: number): Record<string, unknown> {
  try {
    const parsed = JSON.parse(decodeBoundedText(response.body, maximumBytes)) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Typed below.
  }
  throw malformedResponse();
}

function requiredString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 && value.length <= 8_192 && !/[\r\n\0]/u.test(value)
    ? value
    : null;
}

function requiredIdentifier(record: Record<string, unknown>, key: string): string | null {
  const value = requiredString(record, key);
  return value && SAFE_IDENTIFIER.test(value) ? value : null;
}

function requiredToken(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 && value.length <= 65_536 && !/[\r\n\0]/u.test(value)
    ? value
    : null;
}

function nullableString(record: Record<string, unknown>, key: string): string | null | undefined {
  const value = record[key];
  if (value === null) return null;
  return typeof value === 'string' && value.length <= 512 && !/[\r\n\0]/u.test(value)
    ? value
    : undefined;
}

function requiredFutureDate(record: Record<string, unknown>, key: string, nowMs: number): string | null {
  const value = requiredString(record, key);
  return value && Number.isFinite(Date.parse(value)) && Date.parse(value) > nowMs ? value : null;
}

function requiredBoundedSessionDate(
  record: Record<string, unknown>,
  key: string,
  nowMs: number,
): string | null {
  const value = requiredFutureDate(record, key, nowMs);
  return value && Date.parse(value) <= nowMs + MAX_SESSION_TTL_MS ? value : null;
}

function operationList(value: unknown): AccessTokenOperation[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > OPERATIONS.size) return null;
  const operations: AccessTokenOperation[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !OPERATIONS.has(item as AccessTokenOperation)) return null;
    const operation = item as AccessTokenOperation;
    if (operations.includes(operation)) return null;
    operations.push(operation);
  }
  return operations;
}

function nonnegativeInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && typeof value === 'number' && value >= 0 ? value : null;
}

function brokerErrorCode(value: unknown): OAuthBrokerClientErrorCode {
  const known = new Set<OAuthBrokerClientErrorCode>([
    'auth_required', 'origin_not_allowed', 'rate_limited', 'bad_request', 'method_not_allowed',
    'not_found', 'provider_not_configured', 'redirect_not_allowed', 'invalid_state', 'state_expired',
    'subject_mismatch', 'invalid_code_verifier', 'provider_authorization_failed',
    'refresh_token_missing', 'vault_not_found', 'broker_unavailable', 'provider_error', 'internal_error',
  ]);
  return typeof value === 'string' && known.has(value as OAuthBrokerClientErrorCode)
    ? value as OAuthBrokerClientErrorCode
    : 'internal_error';
}

function retryableError(code: OAuthBrokerClientErrorCode, status: number): boolean {
  return code === 'rate_limited'
    || code === 'broker_unavailable'
    || ((code === 'provider_error' || code === 'internal_error') && status >= 500);
}

function isSafeAuthorizationUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash;
  } catch {
    return false;
  }
}

function malformedResponse(): OAuthBrokerClientError {
  return new OAuthBrokerClientError('internal_error', 502, false);
}
