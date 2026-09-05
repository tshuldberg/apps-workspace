import { sha512Hex } from '../../node/hkdf';
import type {
  EncryptedStorageObject,
  StorageByteRange,
  StorageHealth,
  StorageResumeToken,
  StorageWriteResult,
} from '../types';
import { StorageAdapterError } from '../types';
import type { AccessTokenOperation, AccessTokenProvider } from './google-drive';
import type { HttpTransport, HttpTransportResponse } from './http';
import {
  callHttpTransport,
  decodeBoundedText,
  requestWithSingleOriginRedirect,
  responseHeader,
} from './http';

const SHA512_HEX = /^[a-f0-9]{128}$/u;
const encoder = new TextEncoder();

export class ProviderStorageAdapterError extends StorageAdapterError {
  readonly retryAfterSeconds: number | null;

  constructor(
    code: StorageAdapterError['code'],
    message: string,
    retryable: boolean,
    retryAfterSeconds: number | null = null,
  ) {
    super(code, message, retryable);
    this.name = 'ProviderStorageAdapterError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class OAuthHttpClient {
  constructor(
    private readonly providerName: string,
    private readonly transport: HttpTransport,
    private readonly accessTokens: AccessTokenProvider,
    private readonly onAuthRequired: () => void,
  ) {}

  async readAccessToken(operation: AccessTokenOperation): Promise<string | null> {
    try {
      const token = await this.accessTokens.getAccessToken(operation);
      return typeof token === 'string' && token.length > 0 && token.length <= 65_536
        && token.trim() === token && !/[\r\n\0]/u.test(token)
        ? token
        : null;
    } catch (error) {
      const code = propertyString(error, 'code');
      if (code === 'auth_required' || code === 'vault_not_found') return null;
      throw new StorageAdapterError(
        'provider_error',
        `${this.providerName} access-token source is unavailable`,
        propertyBoolean(error, 'retryable') ?? true,
      );
    }
  }

  async request(
    operation: AccessTokenOperation,
    method: string,
    url: string,
    headers: Record<string, string> = {},
    body?: Uint8Array,
  ): Promise<HttpTransportResponse> {
    let token = await this.requireAccessToken(operation);
    let response = await this.sendAuthorized(method, url, token, headers, body);
    if (response.status !== 401) return response;
    await this.accessTokens.invalidateAccessToken?.(token);
    token = await this.requireAccessToken(operation);
    response = await this.sendAuthorized(method, url, token, headers, body);
    if (response.status === 401) {
      this.onAuthRequired();
      throw new StorageAdapterError(
        'auth_required',
        `${this.providerName} authorization is required`,
        false,
      );
    }
    return response;
  }

  async requestPreauthorized(
    method: string,
    url: string,
    headers: Record<string, string> = {},
    body?: Uint8Array,
  ): Promise<HttpTransportResponse> {
    const result = await requestWithSingleOriginRedirect(this.transport, url, (target) => ({
      method,
      url: target,
      headers: { Accept: 'application/json', ...headers },
      ...(body === undefined ? {} : { body }),
    }));
    return result.response;
  }

  async requestWithoutRedirect(
    operation: AccessTokenOperation,
    method: string,
    url: string,
    headers: Record<string, string> = {},
    body?: Uint8Array,
  ): Promise<HttpTransportResponse> {
    let token = await this.requireAccessToken(operation);
    let response = await this.sendAuthorizedWithoutRedirect(method, url, token, headers, body);
    if (response.status !== 401) return response;
    await this.accessTokens.invalidateAccessToken?.(token);
    token = await this.requireAccessToken(operation);
    response = await this.sendAuthorizedWithoutRedirect(method, url, token, headers, body);
    if (response.status === 401) {
      this.onAuthRequired();
      throw new StorageAdapterError(
        'auth_required',
        `${this.providerName} authorization is required`,
        false,
      );
    }
    return response;
  }

  private async requireAccessToken(operation: AccessTokenOperation): Promise<string> {
    const token = await this.readAccessToken(operation);
    if (!token) {
      this.onAuthRequired();
      throw new StorageAdapterError(
        'auth_required',
        `${this.providerName} authorization is required`,
        false,
      );
    }
    return token;
  }

  private async sendAuthorized(
    method: string,
    url: string,
    token: string,
    headers: Record<string, string>,
    body?: Uint8Array,
  ): Promise<HttpTransportResponse> {
    const result = await requestWithSingleOriginRedirect(this.transport, url, (target) => ({
      method,
      url: target,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...headers },
      ...(body === undefined ? {} : { body }),
    }));
    return result.response;
  }

  private sendAuthorizedWithoutRedirect(
    method: string,
    url: string,
    token: string,
    headers: Record<string, string>,
    body?: Uint8Array,
  ): Promise<HttpTransportResponse> {
    return callHttpTransport(this.transport, {
      method,
      url,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...headers },
      ...(body === undefined ? {} : { body }),
    });
  }
}

export function parseHttpsBase(value: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new StorageAdapterError('provider_error', `${label} is invalid`, false);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new StorageAdapterError('provider_error', `${label} must be a credential-free HTTPS URL`, false);
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}

export function validateCredentialRef(value: string, providerName: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 512 || /[\r\n\0]/u.test(normalized)) {
    throw new StorageAdapterError('auth_required', `${providerName} credential reference is invalid`, false);
  }
  return normalized;
}

export function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new StorageAdapterError('provider_error', `${label} must be a positive safe integer`, false);
  }
  return value;
}

export function validateEncryptedObject(
  input: EncryptedStorageObject,
  maximumBytes: number,
  providerName: string,
): void {
  if (!(input.ciphertext instanceof Uint8Array)
    || !Number.isSafeInteger(input.encryptedBytes)
    || input.encryptedBytes <= 0
    || input.encryptedBytes !== input.ciphertext.byteLength
    || input.encryptedBytes > maximumBytes
    || !SHA512_HEX.test(input.ciphertextHash)
    || sha512Hex(input.ciphertext) !== input.ciphertextHash
    || !input.dataClass.trim()
    || input.dataClass.length > 128) {
    throw new StorageAdapterError(
      input.encryptedBytes > maximumBytes ? 'quota_exceeded' : 'provider_error',
      `${providerName} object is malformed or exceeds the configured limit`,
      false,
    );
  }
}

export function validateRange(range: StorageByteRange, providerName: string): void {
  if (!Number.isSafeInteger(range.offset) || range.offset < 0
    || !Number.isSafeInteger(range.length) || range.length < 0
    || range.offset + range.length > Number.MAX_SAFE_INTEGER) {
    throw new StorageAdapterError('provider_error', `${providerName} byte range is invalid`, false);
  }
}

export function jsonBytes(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

export function recordValue(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function parseJsonObject(
  bytes: Uint8Array,
  maximumBytes: number,
  providerName: string,
): Record<string, unknown> {
  try {
    const record = recordValue(JSON.parse(decodeBoundedText(bytes, maximumBytes)) as unknown);
    if (record) return record;
  } catch (error) {
    if (error instanceof StorageAdapterError) throw error;
  }
  throw new StorageAdapterError('provider_error', `${providerName} returned malformed JSON`, false);
}

export function optionalByteCount(value: unknown): number | null {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/u.test(value) ? Number(value) : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function requiredString(value: unknown, maximumLength = 4_096): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= maximumLength
    && !/[\r\n\0]/u.test(value)
    ? value
    : null;
}

export function stringArray(value: unknown, maximumItems = 1_000): string[] | null {
  return Array.isArray(value) && value.length <= maximumItems
    && value.every((item) => typeof item === 'string')
    ? [...value]
    : null;
}

export function healthResult(
  now: () => string,
  state: StorageHealth['state'],
  verifiedReadWrite: boolean,
  errorCode?: string,
): StorageHealth {
  return { state, verifiedReadWrite, checkedAt: now(), ...(errorCode ? { errorCode } : {}) };
}

export function incompleteWrite(
  input: EncryptedStorageObject,
  providerSession: string,
  offset: number,
): StorageWriteResult {
  return {
    complete: false,
    verified: false,
    verification: { kind: 'none' },
    remoteRef: providerSession,
    remoteVersion: null,
    encryptedBytes: offset,
    ciphertextHash: input.ciphertextHash,
    resumeToken: { providerSession, offset },
  };
}

export function validateResumeOffset(
  resume: StorageResumeToken,
  total: number,
  providerName: string,
  allowComplete = false,
): number {
  const upperBoundValid = allowComplete ? resume.offset <= total : resume.offset < total;
  if (!Number.isSafeInteger(resume.offset) || resume.offset < 0 || !upperBoundValid) {
    throw new StorageAdapterError('conflict', `${providerName} resume offset is invalid`, false);
  }
  return resume.offset;
}

export function encodeOpaque(prefix: string, value: unknown): string {
  return `${prefix}:${bytesToBase64Url(encoder.encode(JSON.stringify(value)))}`;
}

export function decodeOpaque(
  encoded: string,
  prefix: string,
  maximumLength: number,
  providerName: string,
): Record<string, unknown> {
  if (!encoded.startsWith(`${prefix}:`) || encoded.length > maximumLength) {
    throw new StorageAdapterError('provider_error', `${providerName} opaque value is invalid`, false);
  }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encoded.slice(prefix.length + 1)))) as unknown;
    const record = recordValue(parsed);
    if (record) return record;
  } catch {
    // Typed below.
  }
  throw new StorageAdapterError('provider_error', `${providerName} opaque value is invalid`, false);
}

export function parseRetryAfterSeconds(
  response: HttpTransportResponse,
  nowMs: number = Date.now(),
): number | null {
  const value = responseHeader(response.headers, 'retry-after')?.trim();
  if (!value) return null;
  if (/^\d+$/u.test(value)) {
    const seconds = Number(value);
    return Number.isSafeInteger(seconds) && seconds >= 0 ? seconds : null;
  }
  const at = Date.parse(value);
  return Number.isFinite(at) ? Math.max(0, Math.ceil((at - nowMs) / 1_000)) : null;
}

export function rateLimitedError(
  providerName: string,
  response: HttpTransportResponse,
): ProviderStorageAdapterError {
  return new ProviderStorageAdapterError(
    'rate_limited',
    `${providerName} rate limit was reached`,
    true,
    parseRetryAfterSeconds(response),
  );
}

export function normalizeProviderError(error: unknown, providerName: string): StorageAdapterError {
  return error instanceof StorageAdapterError
    ? error
    : new StorageAdapterError('provider_error', `${providerName} operation failed`, false);
}

export function validatePreauthorizedUrl(
  value: string,
  allowedOrigins: readonly string[],
  providerName: string,
): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new StorageAdapterError('provider_error', `${providerName} upload-session URL is invalid`, false);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash
    || !allowedOrigins.includes(url.origin)) {
    throw new StorageAdapterError('unsafe_redirect', `${providerName} upload-session URL escaped its allowlist`, false);
  }
  return url.href;
}

export async function rawTransportRequest(
  transport: HttpTransport,
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: Uint8Array,
): Promise<HttpTransportResponse> {
  return callHttpTransport(transport, {
    method,
    url,
    headers,
    ...(body === undefined ? {} : { body }),
  });
}

function propertyString(value: unknown, key: string): string | null {
  const record = recordValue(value);
  return typeof record?.[key] === 'string' ? record[key] : null;
}

function propertyBoolean(value: unknown, key: string): boolean | null {
  const record = recordValue(value);
  return typeof record?.[key] === 'boolean' ? record[key] : null;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let output = '';
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const combined = ((bytes[offset] ?? 0) << 16) | ((bytes[offset + 1] ?? 0) << 8) | (bytes[offset + 2] ?? 0);
    output += alphabet[(combined >>> 18) & 63];
    output += alphabet[(combined >>> 12) & 63];
    if (offset + 1 < bytes.length) output += alphabet[(combined >>> 6) & 63];
    if (offset + 2 < bytes.length) output += alphabet[combined & 63];
  }
  return output;
}

function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error('invalid base64url');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const output: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of value) {
    buffer = (buffer << 6) | alphabet.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >>> bits) & 0xff);
    }
  }
  return new Uint8Array(output);
}
