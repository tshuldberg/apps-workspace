import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import http from 'node:http';
import {
  MAX_STORAGE_CHALLENGE_TTL_MS,
  MAX_STORAGE_DESCRIPTOR_TTL_MS,
  STORAGE_API_V1_PATH,
  STORAGE_AUTH_DOMAIN,
  STORAGE_CHALLENGE_PATH,
  STORAGE_DESCRIPTOR_PATH,
  STORAGE_V1_SUPPORTED_OPERATIONS,
  isStorageCapabilityEndpoint,
  isValidStorageChallengeNonce,
  signStorageCapabilityDescriptor,
  signStorageChallengeResponse,
  storageOperatorPublicKeyFromPrivateKey,
  type StorageCapabilityDescriptor,
  type StorageChallengeResponse,
  type StorageV1Operation,
} from '@mylife/sync';
import { applyHttpCors } from './http-cors';

export const DEFAULT_STORAGE_DESCRIPTOR_TTL_MS = 10 * 60 * 1_000;
export const DEFAULT_STORAGE_CHALLENGE_TTL_MS = 30 * 1_000;
export const DEFAULT_STORAGE_CHALLENGE_CAPACITY = 10_000;

export interface StorageDescriptorServiceOptions {
  endpoint: string;
  operatorPrivateKeyHex: string;
  supportedOperations?: readonly StorageV1Operation[];
  maximumObjectBytes: number;
  quotaBytes: number | null;
  retention: string;
  descriptorTtlMs?: number;
  challengeTtlMs?: number;
  challengeCapacity?: number;
  allowInsecureLocalNetwork?: boolean;
  now?: () => number;
}

export type StorageChallengeIssueResult =
  | { ok: true; response: StorageChallengeResponse }
  | { ok: false; reason: 'invalid_nonce' | 'replayed_nonce' | 'capacity_exceeded' };

export class StorageCapabilityConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageCapabilityConfigurationError';
  }
}

/** Issues bounded signed descriptors and one-time operator challenge responses. */
export class StorageDescriptorService {
  private readonly endpoint: string;
  private readonly operatorPrivateKeyHex: string;
  private readonly operatorKey: string;
  private readonly supportedOperations: StorageV1Operation[];
  private readonly maximumObjectBytes: number;
  private readonly quotaBytes: number | null;
  private readonly retention: string;
  private readonly descriptorTtlMs: number;
  private readonly challengeTtlMs: number;
  private readonly challengeCapacity: number;
  private readonly allowInsecureLocalNetwork: boolean;
  private readonly now: () => number;
  private readonly spentNonceHashes = new Map<string, number>();
  private cachedDescriptor: StorageCapabilityDescriptor | null = null;

  constructor(options: StorageDescriptorServiceOptions) {
    this.allowInsecureLocalNetwork = options.allowInsecureLocalNetwork === true;
    if (!isStorageCapabilityEndpoint(options.endpoint, this.allowInsecureLocalNetwork)) {
      throw new StorageCapabilityConfigurationError('Storage descriptor endpoint must be a secure URL');
    }
    if (!isHostedStorageV1Endpoint(options.endpoint)) {
      throw new StorageCapabilityConfigurationError(
        `Storage descriptor endpoint must end at ${STORAGE_API_V1_PATH}`,
      );
    }
    this.endpoint = options.endpoint;
    this.operatorPrivateKeyHex = options.operatorPrivateKeyHex;
    try {
      this.operatorKey = storageOperatorPublicKeyFromPrivateKey(options.operatorPrivateKeyHex);
    } catch {
      throw new StorageCapabilityConfigurationError('Storage operator key is invalid');
    }
    this.supportedOperations = validateOperations(
      options.supportedOperations ?? STORAGE_V1_SUPPORTED_OPERATIONS,
    );
    this.maximumObjectBytes = positiveInteger(options.maximumObjectBytes, 'maximumObjectBytes');
    this.quotaBytes = options.quotaBytes === null
      ? null
      : nonNegativeInteger(options.quotaBytes, 'quotaBytes');
    if (this.quotaBytes !== null && this.maximumObjectBytes > this.quotaBytes) {
      throw new StorageCapabilityConfigurationError('Storage maximumObjectBytes exceeds quotaBytes');
    }
    if (!options.retention
      || options.retention.length > 128
      || containsControlCharacter(options.retention)) {
      throw new StorageCapabilityConfigurationError('Storage retention label is invalid');
    }
    this.retention = options.retention;
    this.descriptorTtlMs = boundedTtl(
      options.descriptorTtlMs ?? DEFAULT_STORAGE_DESCRIPTOR_TTL_MS,
      MAX_STORAGE_DESCRIPTOR_TTL_MS,
      'descriptorTtlMs',
    );
    this.challengeTtlMs = boundedTtl(
      options.challengeTtlMs ?? DEFAULT_STORAGE_CHALLENGE_TTL_MS,
      Math.min(MAX_STORAGE_CHALLENGE_TTL_MS, this.descriptorTtlMs),
      'challengeTtlMs',
    );
    this.challengeCapacity = positiveInteger(
      options.challengeCapacity ?? DEFAULT_STORAGE_CHALLENGE_CAPACITY,
      'challengeCapacity',
    );
    this.now = options.now ?? (() => Date.now());
  }

  descriptor(): StorageCapabilityDescriptor {
    const now = this.validNow();
    const cachedIssuedAt = this.cachedDescriptor === null
      ? Number.POSITIVE_INFINITY
      : Date.parse(this.cachedDescriptor.issuedAt);
    const cachedExpiresAt = this.cachedDescriptor === null
      ? 0
      : Date.parse(this.cachedDescriptor.expiresAt);
    const refreshWindowMs = Math.min(30_000, Math.max(1_000, Math.floor(this.descriptorTtlMs / 4)));
    if (this.cachedDescriptor !== null
      && cachedIssuedAt <= now
      && cachedExpiresAt - now > refreshWindowMs) {
      return cloneDescriptor(this.cachedDescriptor);
    }
    const issuedAt = new Date(now).toISOString();
    const expiresAt = new Date(now + this.descriptorTtlMs).toISOString();
    this.cachedDescriptor = signStorageCapabilityDescriptor({
      version: 1,
      endpoint: this.endpoint,
      operatorKey: this.operatorKey,
      supportedOperations: [...this.supportedOperations],
      maximumObjectBytes: this.maximumObjectBytes,
      quotaBytes: this.quotaBytes,
      retention: this.retention,
      authDomain: STORAGE_AUTH_DOMAIN,
      issuedAt,
      expiresAt,
    }, this.operatorPrivateKeyHex, {
      allowInsecureLocalNetwork: this.allowInsecureLocalNetwork,
    });
    return cloneDescriptor(this.cachedDescriptor);
  }

  issueChallenge(nonce: unknown): StorageChallengeIssueResult {
    if (!isValidStorageChallengeNonce(nonce)) return { ok: false, reason: 'invalid_nonce' };
    const descriptor = this.descriptor();
    const now = this.validNow();
    this.pruneSpentNonces(now);
    const nonceHash = createHash('sha256').update(nonce, 'utf8').digest('hex');
    if (this.spentNonceHashes.has(nonceHash)) return { ok: false, reason: 'replayed_nonce' };
    if (this.spentNonceHashes.size >= this.challengeCapacity) {
      return { ok: false, reason: 'capacity_exceeded' };
    }
    const descriptorIssuedAt = Date.parse(descriptor.issuedAt);
    const descriptorExpiresAt = Date.parse(descriptor.expiresAt);
    if (now < descriptorIssuedAt) {
      throw new StorageCapabilityConfigurationError('Storage descriptor clock moved backwards');
    }
    const challengeExpiresAt = Math.min(now + this.challengeTtlMs, descriptorExpiresAt);
    if (challengeExpiresAt <= now) return { ok: false, reason: 'capacity_exceeded' };

    // Spend before signing so an internal failure cannot leave the nonce reusable.
    this.spentNonceHashes.set(nonceHash, challengeExpiresAt);
    const response = signStorageChallengeResponse({
      version: 1,
      authDomain: STORAGE_AUTH_DOMAIN,
      endpoint: descriptor.endpoint,
      operatorKey: descriptor.operatorKey,
      nonce,
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(challengeExpiresAt).toISOString(),
    }, this.operatorPrivateKeyHex, {
      allowInsecureLocalNetwork: this.allowInsecureLocalNetwork,
    });
    return { ok: true, response };
  }

  descriptorCacheSeconds(descriptor: StorageCapabilityDescriptor): number {
    const remainingMs = Date.parse(descriptor.expiresAt) - this.validNow();
    return Math.max(0, Math.floor(remainingMs / 1_000));
  }

  private validNow(): number {
    const value = this.now();
    if (!Number.isFinite(value)) {
      throw new StorageCapabilityConfigurationError('Storage descriptor clock is invalid');
    }
    return value;
  }

  private pruneSpentNonces(now: number): void {
    for (const [nonceHash, expiresAt] of this.spentNonceHashes) {
      if (expiresAt <= now) this.spentNonceHashes.delete(nonceHash);
    }
  }
}

export interface StorageCapabilityHttpOptions {
  service: StorageDescriptorService;
  corsAllowedOrigins?: readonly string[];
  requestLimiter?: {
    check(
      req: http.IncomingMessage,
      path: string,
    ): { allowed: boolean; retryAfterSeconds: number };
  };
  log?: (event: string, detail: Record<string, unknown>) => void;
}

export type StorageCapabilityHttpHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => void;

const MAX_CHALLENGE_BODY_BYTES = 2 * 1024;

export function isStorageCapabilityPath(pathname: string): boolean {
  return pathname === STORAGE_DESCRIPTOR_PATH || pathname === STORAGE_CHALLENGE_PATH;
}

export async function handleStorageCapabilityHttpRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: StorageCapabilityHttpOptions,
): Promise<void> {
  const pathname = requestPath(req);
  if (!isStorageCapabilityPath(pathname)) {
    sendJson(res, 404, { error: 'not_found' });
    return;
  }
  if (!applyHttpCors(req, res, {
    allowedOrigins: options.corsAllowedOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    headers: ['Content-Type'],
  })) {
    sendJson(res, 403, { error: 'origin_not_allowed' });
    return;
  }
  const method = req.method ?? 'GET';
  if (method === 'OPTIONS') {
    res.writeHead(204, { 'Content-Length': '0' });
    res.end();
    return;
  }
  const rate = options.requestLimiter?.check(req, pathname);
  if (rate && !rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    options.log?.('storage_capability_rate_limited', { path: pathname });
    sendJson(res, 429, { error: 'rate_limited' });
    return;
  }
  if (pathname === STORAGE_DESCRIPTOR_PATH) {
    if (method !== 'GET') {
      sendJson(res, 405, { error: 'method_not_allowed' });
      return;
    }
    const descriptor = options.service.descriptor();
    res.setHeader(
      'Cache-Control',
      `public, max-age=${options.service.descriptorCacheSeconds(descriptor)}`,
    );
    sendJson(res, 200, descriptor);
    options.log?.('storage_descriptor_served', { path: STORAGE_DESCRIPTOR_PATH });
    return;
  }
  if (method !== 'POST') {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }
  const body = await readJsonObject(req, MAX_CHALLENGE_BODY_BYTES);
  if (body === null || !hasExactKeys(body, ['nonce'])) {
    options.log?.('storage_challenge_rejected', { reason: 'invalid_request' });
    sendJson(res, 400, { error: 'invalid_challenge' });
    return;
  }
  const issued = options.service.issueChallenge(body.nonce);
  if (!issued.ok) {
    options.log?.('storage_challenge_rejected', { reason: issued.reason });
    const status = issued.reason === 'replayed_nonce'
      ? 409
      : issued.reason === 'capacity_exceeded'
        ? 429
        : 400;
    sendJson(res, status, { error: issued.reason });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  sendJson(res, 200, issued.response);
  options.log?.('storage_challenge_issued', { path: STORAGE_CHALLENGE_PATH });
}

export function createStorageCapabilityHttpHandler(
  options: StorageCapabilityHttpOptions,
): StorageCapabilityHttpHandler {
  return (req, res) => {
    void handleStorageCapabilityHttpRequest(req, res, options).catch((error) => {
      const errorId = randomUUID();
      options.log?.('storage_capability_request_error', {
        errorId,
        path: requestPath(req),
        errorType: error instanceof Error ? error.name : 'unknown',
      });
      if (!res.headersSent) sendJson(res, 500, { error: 'internal_error', errorId });
      else res.end();
    });
  };
}

export interface MountedStorageOperatorKey {
  operatorPrivateKeyHex: string;
  operatorKey: string;
}

/** Load a 32-byte seed or 64-byte Ed25519 secret key from a mounted file. */
export async function loadStorageOperatorKeyFromFile(
  filePath: string,
  readFile: (path: string) => Promise<Buffer> = (path) => fs.readFile(path),
): Promise<MountedStorageOperatorKey> {
  let raw: Buffer;
  try {
    raw = await readFile(filePath);
  } catch {
    throw new StorageCapabilityConfigurationError('Storage operator key file is unreadable');
  }
  let keyBytes: Buffer | null = null;
  try {
    keyBytes = parseMountedOperatorKey(raw);
    const operatorPrivateKeyHex = keyBytes.toString('hex');
    return {
      operatorPrivateKeyHex,
      operatorKey: storageOperatorPublicKeyFromPrivateKey(operatorPrivateKeyHex),
    };
  } catch (error) {
    if (error instanceof StorageCapabilityConfigurationError) throw error;
    throw new StorageCapabilityConfigurationError('Storage operator key file is invalid');
  } finally {
    raw.fill(0);
    keyBytes?.fill(0);
  }
}

function parseMountedOperatorKey(raw: Buffer): Buffer {
  const text = raw.toString('utf8').trim();
  if (/^(?:[a-fA-F0-9]{64}|[a-fA-F0-9]{128})$/u.test(text)) {
    return Buffer.from(text, 'hex');
  }
  if (raw.byteLength === 32 || raw.byteLength === 64) return Buffer.from(raw);
  const withoutLf = raw.length > 0 && raw[raw.length - 1] === 0x0a
    ? raw.subarray(0, raw.length - 1)
    : raw;
  if (withoutLf.byteLength === 32 || withoutLf.byteLength === 64) return Buffer.from(withoutLf);
  throw new StorageCapabilityConfigurationError(
    'Storage operator key file must contain a 32-byte seed or 64-byte secret key',
  );
}

async function readJsonObject(
  req: http.IncomingMessage,
  maximumBytes: number,
): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : chunk as Buffer;
    size += bytes.length;
    if (size > maximumBytes) return null;
    chunks.push(bytes);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function requestPath(req: http.IncomingMessage): string {
  try {
    return new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`).pathname;
  } catch {
    return '/invalid-request-path';
  }
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function cloneDescriptor(descriptor: StorageCapabilityDescriptor): StorageCapabilityDescriptor {
  return { ...descriptor, supportedOperations: [...descriptor.supportedOperations] };
}

function isHostedStorageV1Endpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return url.pathname.replace(/\/$/u, '') === STORAGE_API_V1_PATH
      && url.search === ''
      && url.hash === '';
  } catch {
    return false;
  }
}

function validateOperations(values: readonly StorageV1Operation[]): StorageV1Operation[] {
  const allowed = new Set<string>(STORAGE_V1_SUPPORTED_OPERATIONS);
  const seen = new Set<string>();
  const result: StorageV1Operation[] = [];
  for (const value of values) {
    if (!allowed.has(value) || seen.has(value)) {
      throw new StorageCapabilityConfigurationError('Storage supportedOperations are invalid');
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}

function boundedTtl(value: number, maximum: number, name: string): number {
  const normalized = positiveInteger(value, name);
  if (normalized > maximum) {
    throw new StorageCapabilityConfigurationError(`Storage ${name} exceeds its maximum`);
  }
  return normalized;
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new StorageCapabilityConfigurationError(`Storage ${name} is invalid`);
  }
  return value;
}

function nonNegativeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new StorageCapabilityConfigurationError(`Storage ${name} is invalid`);
  }
  return value;
}

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index]);
}
