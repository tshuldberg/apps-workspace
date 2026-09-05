import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import http from 'node:http';
import {
  MEERKAT_HOSTED_STORAGE_FEATURE,
  verifyHostedFeatureEntitlement,
} from '@mylife/entitlements/server';
import type { UploadHashFn } from '@mylife/sync';
import type { MeerkatHostedSubject } from './hosted-api';
import type {
  HostedStorageApiObject,
  HostedStorageApiObjectCursor,
  HostedStorageApiUpload,
  HostedStorageBackupCursor,
  HostedStorageBackupLocator,
  HostedStorageMetadataStore,
} from './hosted-storage-metadata';
import { applyHttpCors } from './http-cors';
import type { HostedRequestLimiter } from './hosted-rate-limiter';
import type { ObjectDeletionJobStore } from './object-deletion-jobs';
import {
  handleStorageCapabilityHttpRequest,
  isStorageCapabilityPath,
  type StorageDescriptorService,
} from './storage-capability-service';
import {
  handleStorageUpload,
  HostedStorageBlockDeleteError,
  type HostedStorageBlockStore,
  type StorageIngestOptions,
} from './storage-ingest';

export const HOSTED_STORAGE_API_V1_PREFIX = '/api/storage/v1';
export const HOSTED_STORAGE_LEGACY_UPLOAD_PATH = '/api/storage/upload';

export type HostedStorageApiErrorCode =
  | 'auth_required'
  | 'entitlement_required'
  | 'origin_not_allowed'
  | 'rate_limited'
  | 'bad_request'
  | 'invalid_cursor'
  | 'not_found'
  | 'method_not_allowed'
  | 'storage_not_provisioned'
  | 'storage_unavailable'
  | 'upload_not_found'
  | 'missing_blocks'
  | 'corrupt_blocks'
  | 'ciphertext_mismatch'
  | 'object_conflict'
  | 'range_not_satisfiable'
  | 'backup_conflict'
  | 'manifest_object_missing'
  | 'deletion_pending'
  | 'unsupported_storage_api_version'
  | 'internal_error';

/** Relay-owned wire types for the client adapter that follows this packet. */
export interface HostedStorageApiObjectMetadata {
  id: string;
  encryptedBytes: number;
  ciphertextHash: string;
  dataClass: string;
  version: string;
  createdAt: string;
}

export interface HostedStorageApiChecksumEvidence {
  algorithm: 'sha512';
  value: string;
}

export interface HostedStorageApiCompletionResponse {
  object: HostedStorageApiObjectMetadata;
  checksum: HostedStorageApiChecksumEvidence;
}

export interface HostedStorageApiObjectPageResponse {
  items: HostedStorageApiObjectMetadata[];
  nextCursor: string | null;
}

export interface HostedStorageApiBackupLocatorRecord {
  formatVersion: number;
  backupId: string;
  encryptedManifestHash: string;
  createdAt: string;
  manifestObjectId: string;
}

export interface HostedStorageApiBackupPageResponse {
  items: HostedStorageApiBackupLocatorRecord[];
  nextCursor: string | null;
}

export interface HostedStorageApiQuotaResponse {
  usedBytes: number;
  capBytes: number;
}

export interface HostedStorageApiHealthResponse {
  ok: boolean;
  provisioned: boolean;
}

export interface HostedStorageApiObjectDeleteResponse {
  deleted: boolean;
  objectId: string;
  freedBytes: number;
  deletedBlocks: number;
  deletedBackupRecords: number;
}

export interface HostedStorageApiAccountDeleteCounts {
  objects: number;
  blocks: number;
  backups: number;
  uploadBlockRows: number;
  storageObjectRows: number;
  reservationRows: number;
  seederManifestRows: number;
  tenantRows: number;
  policyRows: number;
  metadataRows: number;
  encryptedBytes: number;
  oauthVaults?: number;
}

export interface HostedStorageApiAccountDeleteResponse {
  deleted: HostedStorageApiAccountDeleteCounts;
}

export interface HostedStorageApiOptions {
  entitlementSecret: string;
  hash: UploadHashFn;
  authorize(
    req: http.IncomingMessage,
  ): MeerkatHostedSubject | null | Promise<MeerkatHostedSubject | null>;
  resolveStore(
    subjectId: string,
  ): HostedStorageBlockStore | null | Promise<HostedStorageBlockStore | null>;
  /** Retained-byte resolver used only by authenticated account deletion after entitlement expiry. */
  resolveDeletionStore?: (
    subjectId: string,
  ) => HostedStorageBlockStore | null | Promise<HostedStorageBlockStore | null>;
  /** Creates the persistent metadata tenant only on a write that opts into storage. */
  provisionTenant(subjectId: string): boolean | Promise<boolean>;
  metadata: HostedStorageMetadataStore;
  entitlementHeader?: string;
  maxBlockBytes?: number;
  corsAllowedOrigins?: readonly string[];
  requestLimiter?: Pick<HostedRequestLimiter, 'check'>;
  deletionJobs?: Pick<ObjectDeletionJobStore, 'enqueue'>;
  /** Shared account deletion hook for the OAuth vault owned by WP-41D. */
  deleteOAuthAccount?: (subjectId: string) => Promise<{ deletedVaults: number }>;
  /** Public signed descriptor and operator challenge, mounted before tenant auth. */
  storageDescriptor?: StorageDescriptorService;
  legacyUploadAlias?: boolean;
  now?: () => number;
  log?: (event: string, detail: Record<string, unknown>) => void;
}

export type HostedStorageApiHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => void;

interface ObjectRoute {
  kind: 'object';
  objectId: string;
}

interface CompleteRoute {
  kind: 'complete';
  objectId: string;
}

interface BackupManifestRoute {
  kind: 'backup_manifest';
  backupId: string;
}

type StorageRoute =
  | { kind: 'create_or_list' }
  | ObjectRoute
  | CompleteRoute
  | { kind: 'quota' }
  | { kind: 'health' }
  | { kind: 'backups' }
  | BackupManifestRoute
  | { kind: 'account_delete' }
  | { kind: 'unknown_version'; requestedVersion: string }
  | { kind: 'unknown_v1' };

interface VerifiedUpload {
  missingIndices: number[];
  corruptIndices: number[];
  encryptedBytes: number;
  ciphertextHash: string;
}

interface ParsedRange {
  start: number;
  end: number;
}

const DEFAULT_ENTITLEMENT_HEADER = 'x-mk-entitlement';
const MAX_JSON_BODY_BYTES = 64 * 1024;
const DEFAULT_PAGE_LIMIT = 100;
const MAX_PAGE_LIMIT = 200;
const MAX_TOTAL_BLOCKS = 100_000;
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/u;
const SAFE_DATA_CLASS = /^[A-Za-z0-9_.:-]{1,128}$/u;
const SHA512_HEX = /^[a-f0-9]{128}$/u;

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendError(
  res: http.ServerResponse,
  status: number,
  error: HostedStorageApiErrorCode,
  detail: Record<string, unknown> = {},
): void {
  sendJson(res, status, { error, ...detail });
}

function requestUrl(req: http.IncomingMessage): URL {
  return new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
}

function routePath(req: http.IncomingMessage): string {
  try {
    return requestUrl(req).pathname;
  } catch {
    return req.url ?? '/';
  }
}

function firstHeader(req: http.IncomingMessage, name: string): string | null {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === 'string' ? value : null;
}

function parseRoute(pathname: string): StorageRoute | null {
  const version = /^\/api\/storage\/(v[^/]+)(?:\/|$)/u.exec(pathname)?.[1];
  if (version && version !== 'v1') {
    return { kind: 'unknown_version', requestedVersion: version };
  }
  if (pathname === `${HOSTED_STORAGE_API_V1_PREFIX}/objects`) return { kind: 'create_or_list' };
  if (pathname === `${HOSTED_STORAGE_API_V1_PREFIX}/quota`) return { kind: 'quota' };
  if (pathname === `${HOSTED_STORAGE_API_V1_PREFIX}/health`) return { kind: 'health' };
  if (pathname === `${HOSTED_STORAGE_API_V1_PREFIX}/backups`) return { kind: 'backups' };
  if (pathname === `${HOSTED_STORAGE_API_V1_PREFIX}/account/delete`) {
    return { kind: 'account_delete' };
  }
  const complete = new RegExp(`^${HOSTED_STORAGE_API_V1_PREFIX}/objects/([A-Za-z0-9_-]{1,128})/complete$`, 'u')
    .exec(pathname);
  if (complete?.[1]) return { kind: 'complete', objectId: complete[1] };
  const object = new RegExp(`^${HOSTED_STORAGE_API_V1_PREFIX}/objects/([A-Za-z0-9_-]{1,128})$`, 'u')
    .exec(pathname);
  if (object?.[1]) return { kind: 'object', objectId: object[1] };
  const backup = new RegExp(`^${HOSTED_STORAGE_API_V1_PREFIX}/backups/([A-Za-z0-9_-]{1,128})/manifest$`, 'u')
    .exec(pathname);
  if (backup?.[1]) return { kind: 'backup_manifest', backupId: backup[1] };
  return pathname === HOSTED_STORAGE_API_V1_PREFIX
    || pathname.startsWith(`${HOSTED_STORAGE_API_V1_PREFIX}/`)
    ? { kind: 'unknown_v1' }
    : null;
}

function rateLimitPath(route: StorageRoute): string {
  switch (route.kind) {
    case 'create_or_list': return `${HOSTED_STORAGE_API_V1_PREFIX}/objects`;
    case 'object': return `${HOSTED_STORAGE_API_V1_PREFIX}/objects/:id`;
    case 'complete': return `${HOSTED_STORAGE_API_V1_PREFIX}/objects/:id/complete`;
    case 'quota': return `${HOSTED_STORAGE_API_V1_PREFIX}/quota`;
    case 'health': return `${HOSTED_STORAGE_API_V1_PREFIX}/health`;
    case 'backups': return `${HOSTED_STORAGE_API_V1_PREFIX}/backups`;
    case 'backup_manifest': return `${HOSTED_STORAGE_API_V1_PREFIX}/backups/:id/manifest`;
    case 'account_delete': return `${HOSTED_STORAGE_API_V1_PREFIX}/account/delete`;
    case 'unknown_version': return `${HOSTED_STORAGE_API_V1_PREFIX}/*`;
    case 'unknown_v1': return `${HOSTED_STORAGE_API_V1_PREFIX}/*`;
  }
}

async function readJsonObject(
  req: http.IncomingMessage,
): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : chunk as Buffer;
    size += bytes.length;
    if (size > MAX_JSON_BODY_BYTES) return null;
    chunks.push(bytes);
  }
  try {
    const raw = Buffer.concat(chunks).toString('utf8');
    const parsed = raw.length === 0 ? {} : JSON.parse(raw) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function pageLimit(url: URL): number | null {
  const raw = url.searchParams.get('limit');
  if (raw === null) return DEFAULT_PAGE_LIMIT;
  if (!/^\d+$/u.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 && value <= MAX_PAGE_LIMIT ? value : null;
}

function encodeCursor(kind: 'objects' | 'backups', cursor: object): string {
  return Buffer.from(JSON.stringify({ v: 1, kind, ...cursor }), 'utf8').toString('base64url');
}

function decodeObjectCursor(value: string | null): HostedStorageApiObjectCursor | null | false {
  if (value === null) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>;
    return parsed.v === 1
      && parsed.kind === 'objects'
      && typeof parsed.createdAt === 'string'
      && Number.isFinite(Date.parse(parsed.createdAt))
      && typeof parsed.objectId === 'string'
      && SAFE_ID.test(parsed.objectId)
      ? { createdAt: parsed.createdAt, objectId: parsed.objectId }
      : false;
  } catch {
    return false;
  }
}

function decodeBackupCursor(value: string | null): HostedStorageBackupCursor | null | false {
  if (value === null) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>;
    return parsed.v === 1
      && parsed.kind === 'backups'
      && typeof parsed.createdAt === 'string'
      && Number.isFinite(Date.parse(parsed.createdAt))
      && typeof parsed.backupId === 'string'
      && SAFE_ID.test(parsed.backupId)
      ? { createdAt: parsed.createdAt, backupId: parsed.backupId }
      : false;
  } catch {
    return false;
  }
}

async function requireSubjectAndEntitlement(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: HostedStorageApiOptions,
): Promise<MeerkatHostedSubject | null> {
  const subject = await options.authorize(req);
  if (!subject) {
    sendError(res, 401, 'auth_required');
    return null;
  }
  const verdict = await verifyHostedFeatureEntitlement(
    firstHeader(req, options.entitlementHeader ?? DEFAULT_ENTITLEMENT_HEADER),
    options.entitlementSecret,
    MEERKAT_HOSTED_STORAGE_FEATURE,
    { nowMs: options.now?.() ?? Date.now() },
  );
  if (!verdict.ok) {
    sendError(res, verdict.reason === 'missing' ? 402 : 403, 'entitlement_required', {
      reason: verdict.reason,
    });
    return null;
  }
  return subject;
}

async function provisionedStore(
  subjectId: string,
  res: http.ServerResponse,
  options: HostedStorageApiOptions,
): Promise<HostedStorageBlockStore | null> {
  if (!await options.metadata.getTenant(subjectId)) {
    sendError(res, 404, 'storage_not_provisioned');
    return null;
  }
  const store = await options.resolveStore(subjectId);
  if (!store) {
    sendError(res, 503, 'storage_unavailable');
    return null;
  }
  return store;
}

function publicObject(object: HostedStorageApiObject): HostedStorageApiObjectMetadata {
  return {
    id: object.objectId,
    encryptedBytes: object.encryptedBytes,
    ciphertextHash: object.ciphertextHash,
    dataClass: object.dataClass,
    version: object.version,
    createdAt: object.createdAt,
  };
}

function publicLocator(locator: HostedStorageBackupLocator): HostedStorageApiBackupLocatorRecord {
  return {
    formatVersion: locator.formatVersion,
    backupId: locator.backupId,
    encryptedManifestHash: locator.encryptedManifestHash,
    createdAt: locator.createdAt,
    manifestObjectId: locator.manifestObjectId,
  };
}

async function verifyUpload(
  store: HostedStorageBlockStore,
  upload: HostedStorageApiUpload,
  hash: UploadHashFn,
): Promise<VerifiedUpload> {
  const advertised = new Map(upload.blocks.map((block) => [block.blockIndex, block]));
  const missingIndices: number[] = [];
  const corruptIndices: number[] = [];
  const ciphertext = createHash('sha512');
  let encryptedBytes = 0;
  for (let index = 0; index < upload.totalBlocks; index += 1) {
    const block = advertised.get(index);
    if (!block) {
      missingIndices.push(index);
      continue;
    }
    const bytes = await store.getBlock(upload.objectId, index);
    if (!bytes) {
      missingIndices.push(index);
      continue;
    }
    if (bytes.length !== block.sizeBytes || await hash(bytes) !== block.blockHash) {
      corruptIndices.push(index);
      continue;
    }
    ciphertext.update(bytes);
    encryptedBytes += bytes.length;
  }
  return {
    missingIndices,
    corruptIndices,
    encryptedBytes,
    ciphertextHash: ciphertext.digest('hex'),
  };
}

function withinStoreLock<T>(
  store: HostedStorageBlockStore,
  operation: () => Promise<T>,
): Promise<T> {
  return store.withWriteLock ? store.withWriteLock(operation) : operation();
}

function parseRange(value: string | null, size: number): ParsedRange | null | false {
  if (value === null) return null;
  const match = /^bytes=(\d*)-(\d*)$/u.exec(value.trim());
  if (!match || (match[1] === '' && match[2] === '') || size === 0) return false;
  if (match[1] === '') {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return false;
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(match[1]);
  const requestedEnd = match[2] === '' ? size - 1 : Number(match[2]);
  if (!Number.isSafeInteger(start)
    || !Number.isSafeInteger(requestedEnd)
    || start < 0
    || requestedEnd < start
    || start >= size) return false;
  return { start, end: Math.min(requestedEnd, size - 1) };
}

async function writeRange(
  res: http.ServerResponse,
  store: HostedStorageBlockStore,
  upload: HostedStorageApiUpload,
  range: ParsedRange,
): Promise<void> {
  let blockStart = 0;
  for (const advertised of upload.blocks) {
    const blockEnd = blockStart + advertised.sizeBytes - 1;
    if (blockEnd >= range.start && blockStart <= range.end) {
      const bytes = await store.getBlock(upload.objectId, advertised.blockIndex);
      if (!bytes) throw new Error('stored object changed while it was being read');
      const from = Math.max(0, range.start - blockStart);
      const to = Math.min(bytes.length, range.end - blockStart + 1);
      if (to > from) {
        const writable = res.write(Buffer.from(bytes.buffer, bytes.byteOffset + from, to - from));
        if (!writable) await once(res, 'drain');
      }
    }
    blockStart += advertised.sizeBytes;
    if (blockStart > range.end) break;
  }
  res.end();
}

async function handleComplete(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  subjectId: string,
  objectId: string,
  options: HostedStorageApiOptions,
): Promise<void> {
  const body = await readJsonObject(req);
  const encryptedBytes = body?.encryptedBytes;
  const ciphertextHash = body?.ciphertextHash;
  const dataClass = body?.dataClass;
  if (!Number.isSafeInteger(encryptedBytes)
    || (encryptedBytes as number) < 0
    || typeof ciphertextHash !== 'string'
    || !SHA512_HEX.test(ciphertextHash)
    || typeof dataClass !== 'string'
    || !SAFE_DATA_CLASS.test(dataClass)) {
    sendError(res, 400, 'bad_request');
    return;
  }
  const store = await provisionedStore(subjectId, res, options);
  if (!store) return;
  await withinStoreLock(store, async () => {
    const upload = await options.metadata.getApiUpload(subjectId, objectId);
    if (!upload) {
      sendError(res, 404, 'upload_not_found');
      return;
    }
    if (upload.totalBlocks < 1 || upload.totalBlocks > MAX_TOTAL_BLOCKS) {
      sendError(res, 409, 'object_conflict');
      return;
    }
    const verified = await verifyUpload(store, upload, options.hash);
    if (verified.missingIndices.length > 0) {
      sendError(res, 409, 'missing_blocks', { missingIndices: verified.missingIndices });
      return;
    }
    if (verified.corruptIndices.length > 0) {
      sendError(res, 409, 'corrupt_blocks', { corruptIndices: verified.corruptIndices });
      return;
    }
    if (verified.encryptedBytes !== encryptedBytes || verified.ciphertextHash !== ciphertextHash) {
      sendError(res, 409, 'ciphertext_mismatch');
      return;
    }
    const completed = await options.metadata.completeApiObject({
      subjectId,
      objectId,
      encryptedBytes: encryptedBytes as number,
      ciphertextHash,
      dataClass,
      totalBlocks: upload.totalBlocks,
      version: randomUUID(),
    });
    if (completed.status === 'conflict') {
      sendError(res, 409, 'object_conflict');
      return;
    }
    if (completed.status !== 'completed' && completed.status !== 'replayed') {
      if (completed.status === 'tenant_missing') {
        sendError(res, 404, 'storage_not_provisioned');
        return;
      }
      if (completed.status === 'upload_missing') {
        sendError(res, 404, 'upload_not_found');
        return;
      }
      sendError(res, 409, 'object_conflict');
      return;
    }
    sendJson(res, completed.status === 'completed' ? 201 : 200, {
      object: publicObject(completed.object),
      checksum: { algorithm: 'sha512', value: verified.ciphertextHash },
    });
  });
}

async function handleHead(
  res: http.ServerResponse,
  subjectId: string,
  objectId: string,
  options: HostedStorageApiOptions,
): Promise<void> {
  if (!await provisionedStore(subjectId, res, options)) return;
  const object = await options.metadata.getApiObject(subjectId, objectId);
  if (!object) {
    sendError(res, 404, 'not_found');
    return;
  }
  res.writeHead(200, {
    'Accept-Ranges': 'bytes',
    'Content-Length': object.encryptedBytes,
    'X-Mk-Exists': 'true',
    'X-Mk-Encrypted-Bytes': String(object.encryptedBytes),
    'X-Mk-Ciphertext-Hash': object.ciphertextHash,
    'X-Mk-Object-Version': object.version,
    'X-Mk-Data-Class': object.dataClass,
  });
  res.end();
}

async function handleGet(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  subjectId: string,
  objectId: string,
  options: HostedStorageApiOptions,
): Promise<void> {
  const store = await provisionedStore(subjectId, res, options);
  if (!store) return;
  await withinStoreLock(store, async () => {
    const object = await options.metadata.getApiObject(subjectId, objectId);
    if (!object) {
      sendError(res, 404, 'not_found');
      return;
    }
    const upload = await options.metadata.getApiUpload(subjectId, objectId);
    if (!upload) {
      sendError(res, 409, 'object_conflict');
      return;
    }
    const verified = await verifyUpload(store, upload, options.hash);
    if (verified.missingIndices.length > 0
      || verified.corruptIndices.length > 0
      || verified.encryptedBytes !== object.encryptedBytes
      || verified.ciphertextHash !== object.ciphertextHash) {
      sendError(res, 409, 'object_conflict');
      return;
    }
    const parsedRange = parseRange(firstHeader(req, 'range'), object.encryptedBytes);
    if (parsedRange === false) {
      res.setHeader('Content-Range', `bytes */${object.encryptedBytes}`);
      sendError(res, 416, 'range_not_satisfiable');
      return;
    }
    const range = parsedRange ?? { start: 0, end: Math.max(0, object.encryptedBytes - 1) };
    const contentLength = object.encryptedBytes === 0 ? 0 : range.end - range.start + 1;
    const headers: Record<string, string | number> = {
      'Content-Type': 'application/octet-stream',
      'Content-Length': contentLength,
      'Accept-Ranges': 'bytes',
      'X-Mk-Ciphertext-Hash': object.ciphertextHash,
      'X-Mk-Object-Version': object.version,
    };
    if (parsedRange) {
      headers['Content-Range'] = `bytes ${range.start}-${range.end}/${object.encryptedBytes}`;
    }
    res.writeHead(parsedRange ? 206 : 200, headers);
    if (object.encryptedBytes === 0) {
      res.end();
      return;
    }
    await writeRange(res, store, upload, range);
  });
}

async function handleObjectList(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  subjectId: string,
  options: HostedStorageApiOptions,
): Promise<void> {
  if (!await provisionedStore(subjectId, res, options)) return;
  const url = requestUrl(req);
  const limit = pageLimit(url);
  if (limit === null) {
    sendError(res, 400, 'bad_request');
    return;
  }
  const after = decodeObjectCursor(url.searchParams.get('cursor'));
  if (after === false) {
    sendError(res, 400, 'invalid_cursor');
    return;
  }
  const page = await options.metadata.listApiObjects({
    subjectId,
    ...(after ? { after } : {}),
    limit,
  });
  sendJson(res, 200, {
    items: page.items.map(publicObject),
    nextCursor: page.nextCursor ? encodeCursor('objects', page.nextCursor) : null,
  });
}

async function enqueueFailedDeletion(
  error: HostedStorageBlockDeleteError,
  options: HostedStorageApiOptions,
): Promise<void> {
  await options.deletionJobs?.enqueue(error.objectKey, options.now?.() ?? Date.now());
}

async function handleObjectDelete(
  res: http.ServerResponse,
  subjectId: string,
  objectId: string,
  options: HostedStorageApiOptions,
): Promise<void> {
  const store = await provisionedStore(subjectId, res, options);
  if (!store) return;
  try {
    const bytes = await store.deleteContent(objectId);
    const metadata = await options.metadata.deleteApiObject(subjectId, objectId);
    const deleted = bytes.deletedBlocks > 0
      || metadata.objectRows > 0
      || metadata.uploadBlockRows > 0
      || metadata.backupRows > 0;
    sendJson(res, 200, {
      deleted,
      objectId,
      freedBytes: bytes.deletedBytes,
      deletedBlocks: bytes.deletedBlocks,
      deletedBackupRecords: metadata.backupRows,
    });
  } catch (error) {
    if (error instanceof HostedStorageBlockDeleteError) {
      await enqueueFailedDeletion(error, options);
      sendError(res, 503, 'deletion_pending');
      return;
    }
    throw error;
  }
}

async function handleQuota(
  res: http.ServerResponse,
  subjectId: string,
  options: HostedStorageApiOptions,
): Promise<void> {
  const store = await provisionedStore(subjectId, res, options);
  if (!store) return;
  sendJson(res, 200, { usedBytes: await store.usedBytes(), capBytes: store.capBytes() });
}

async function handleHealth(
  res: http.ServerResponse,
  subjectId: string,
  options: HostedStorageApiOptions,
): Promise<void> {
  const tenant = await options.metadata.getTenant(subjectId);
  if (!tenant) {
    sendJson(res, 200, { ok: true, provisioned: false });
    return;
  }
  const store = await options.resolveStore(subjectId);
  if (!store) {
    sendJson(res, 503, { ok: false, provisioned: true });
    return;
  }
  await store.usedBytes();
  sendJson(res, 200, { ok: true, provisioned: true });
}

async function handleBackupList(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  subjectId: string,
  options: HostedStorageApiOptions,
): Promise<void> {
  if (!await provisionedStore(subjectId, res, options)) return;
  const url = requestUrl(req);
  const limit = pageLimit(url);
  if (limit === null) {
    sendError(res, 400, 'bad_request');
    return;
  }
  const after = decodeBackupCursor(url.searchParams.get('cursor'));
  if (after === false) {
    sendError(res, 400, 'invalid_cursor');
    return;
  }
  const page = await options.metadata.listBackupLocators({
    subjectId,
    ...(after ? { after } : {}),
    limit,
  });
  sendJson(res, 200, {
    items: page.items.map(publicLocator),
    nextCursor: page.nextCursor ? encodeCursor('backups', page.nextCursor) : null,
  });
}

async function handleBackupPut(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  subjectId: string,
  backupId: string,
  options: HostedStorageApiOptions,
): Promise<void> {
  if (!await provisionedStore(subjectId, res, options)) return;
  const body = await readJsonObject(req);
  const keys = body ? Object.keys(body).sort() : [];
  const allowedKeys = [
    'backupId', 'createdAt', 'encryptedManifestHash', 'formatVersion', 'manifestObjectId',
  ];
  if (!body
    || JSON.stringify(keys) !== JSON.stringify(allowedKeys)
    || !Number.isSafeInteger(body.formatVersion)
    || (body.formatVersion as number) < 1
    || (body.formatVersion as number) > 2_147_483_647
    || body.backupId !== backupId
    || typeof body.encryptedManifestHash !== 'string'
    || !SHA512_HEX.test(body.encryptedManifestHash)
    || typeof body.createdAt !== 'string'
    || !Number.isFinite(Date.parse(body.createdAt))
    || typeof body.manifestObjectId !== 'string'
    || !SAFE_ID.test(body.manifestObjectId)) {
    sendError(res, 400, 'bad_request');
    return;
  }
  const result = await options.metadata.putBackupLocator({
    subjectId,
    formatVersion: body.formatVersion as number,
    backupId,
    encryptedManifestHash: body.encryptedManifestHash,
    createdAt: new Date(body.createdAt).toISOString(),
    manifestObjectId: body.manifestObjectId,
  });
  if (result.status === 'manifest_object_missing') {
    sendError(res, 404, 'manifest_object_missing');
    return;
  }
  if (result.status === 'conflict') {
    sendError(res, 409, 'backup_conflict');
    return;
  }
  if (result.status === 'tenant_missing') {
    sendError(res, 404, 'storage_not_provisioned');
    return;
  }
  if (!('locator' in result)) {
    sendError(res, 500, 'internal_error');
    return;
  }
  sendJson(res, result.status === 'inserted' ? 201 : 200, publicLocator(result.locator));
}

async function handleAccountDelete(
  res: http.ServerResponse,
  subjectId: string,
  options: HostedStorageApiOptions,
): Promise<void> {
  const tenant = await options.metadata.getTenant(subjectId);
  const store = await (options.resolveDeletionStore ?? options.resolveStore)(subjectId);
  if (tenant && !store) {
    sendError(res, 503, 'storage_unavailable');
    return;
  }
  const oauth = options.deleteOAuthAccount
    ? await options.deleteOAuthAccount(subjectId)
    : null;
  try {
    const bytes = store
      ? await store.deleteAll()
      : { deletedBlocks: 0, deletedBytes: 0 };
    const rows = await options.metadata.deleteApiTenant(subjectId);
    const metadataRows = Object.values(rows).reduce((total, count) => total + count, 0);
    sendJson(res, 200, {
      deleted: {
        objects: rows.objectRows,
        blocks: bytes.deletedBlocks,
        backups: rows.backupRows,
        uploadBlockRows: rows.uploadBlockRows,
        storageObjectRows: rows.storageObjectRows,
        reservationRows: rows.reservationRows,
        seederManifestRows: rows.seederManifestRows,
        tenantRows: rows.tenantRows,
        policyRows: rows.policyRows,
        metadataRows,
        encryptedBytes: bytes.deletedBytes,
        ...(oauth ? { oauthVaults: oauth.deletedVaults } : {}),
      },
    });
  } catch (error) {
    if (error instanceof HostedStorageBlockDeleteError) {
      await enqueueFailedDeletion(error, options);
      sendError(res, 503, 'deletion_pending');
      return;
    }
    throw error;
  }
}

function storageIngestOptions(
  options: HostedStorageApiOptions,
  path: string,
): StorageIngestOptions {
  return {
    entitlementSecret: options.entitlementSecret,
    hash: options.hash,
    authorize: options.authorize,
    resolveStore: options.resolveStore,
    prepareStore: options.provisionTenant,
    recordBlockMetadata: async (input) => {
      const result = await options.metadata.recordApiUploadBlock({
        subjectId: input.subjectId,
        objectId: input.contentId,
        blockIndex: input.blockIndex,
        totalBlocks: input.totalBlocks,
        blockHash: input.blockHash,
        sizeBytes: input.sizeBytes,
      });
      if (result.status === 'conflict') return 'conflict';
      if (result.status === 'tenant_missing') return 'not_provisioned';
      return 'accepted';
    },
    entitlementHeader: options.entitlementHeader,
    maxBlockBytes: options.maxBlockBytes,
    path,
    corsAllowedOrigins: options.corsAllowedOrigins,
    requestLimiter: options.requestLimiter,
    now: options.now,
    log: options.log,
  };
}

export function isHostedStorageApiPath(pathname: string): boolean {
  return pathname === HOSTED_STORAGE_LEGACY_UPLOAD_PATH
    || pathname.startsWith('/api/storage/v');
}

/** Testable dispatcher for the versioned hosted storage API. */
export async function handleHostedStorageApiRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: HostedStorageApiOptions,
): Promise<void> {
  const method = req.method ?? 'GET';
  const pathname = routePath(req);
  if (isStorageCapabilityPath(pathname)) {
    if (!options.storageDescriptor) {
      sendError(res, 503, 'storage_unavailable');
      return;
    }
    await handleStorageCapabilityHttpRequest(req, res, {
      service: options.storageDescriptor,
      corsAllowedOrigins: options.corsAllowedOrigins,
      requestLimiter: options.requestLimiter,
      log: options.log,
    });
    return;
  }
  const isLegacy = pathname === HOSTED_STORAGE_LEGACY_UPLOAD_PATH
    && options.legacyUploadAlias !== false;
  if (isLegacy || (pathname === `${HOSTED_STORAGE_API_V1_PREFIX}/objects`
    && (method === 'POST' || method === 'OPTIONS'))) {
    await handleStorageUpload(req, res, storageIngestOptions(options, pathname));
    return;
  }

  const route = parseRoute(pathname);
  if (!route) {
    sendError(res, 404, 'not_found');
    return;
  }
  if (!applyHttpCors(req, res, {
    allowedOrigins: options.corsAllowedOrigins,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers: ['Authorization', 'Content-Type', 'Range', 'X-Mk-Entitlement'],
  })) {
    sendError(res, 403, 'origin_not_allowed');
    return;
  }
  if (method === 'OPTIONS') {
    res.writeHead(204, { 'Content-Length': '0' });
    res.end();
    return;
  }
  const rate = options.requestLimiter?.check(req, rateLimitPath(route));
  if (rate && !rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    sendError(res, 429, 'rate_limited');
    return;
  }
  if (route.kind === 'unknown_version') {
    sendError(res, 404, 'unsupported_storage_api_version', {
      requestedVersion: route.requestedVersion,
      supportedVersions: ['v1'],
    });
    return;
  }
  if (route.kind === 'unknown_v1') {
    sendError(res, 404, 'not_found');
    return;
  }
  // Account deletion remains available after cancellation or expiry. Authenticate the device
  // subject, but never require the paid feature entitlement to erase retained tenant data.
  if (route.kind === 'account_delete') {
    const subject = await options.authorize(req);
    if (!subject) {
      sendError(res, 401, 'auth_required');
      return;
    }
    if (method !== 'POST') {
      sendError(res, 405, 'method_not_allowed');
      return;
    }
    await handleAccountDelete(res, subject.subjectId, options);
    return;
  }

  const subject = await requireSubjectAndEntitlement(req, res, options);
  if (!subject) return;
  if (route.kind === 'create_or_list') {
    if (method !== 'GET') {
      sendError(res, 405, 'method_not_allowed');
      return;
    }
    await handleObjectList(req, res, subject.subjectId, options);
    return;
  }
  if (route.kind === 'complete') {
    if (method !== 'POST') {
      sendError(res, 405, 'method_not_allowed');
      return;
    }
    await handleComplete(req, res, subject.subjectId, route.objectId, options);
    return;
  }
  if (route.kind === 'object') {
    if (method === 'HEAD') {
      await handleHead(res, subject.subjectId, route.objectId, options);
      return;
    }
    if (method === 'GET') {
      await handleGet(req, res, subject.subjectId, route.objectId, options);
      return;
    }
    if (method === 'DELETE') {
      await handleObjectDelete(res, subject.subjectId, route.objectId, options);
      return;
    }
    sendError(res, 405, 'method_not_allowed');
    return;
  }
  if (route.kind === 'quota') {
    if (method !== 'GET') {
      sendError(res, 405, 'method_not_allowed');
      return;
    }
    await handleQuota(res, subject.subjectId, options);
    return;
  }
  if (route.kind === 'health') {
    if (method !== 'GET') {
      sendError(res, 405, 'method_not_allowed');
      return;
    }
    await handleHealth(res, subject.subjectId, options);
    return;
  }
  if (route.kind === 'backups') {
    if (method !== 'GET') {
      sendError(res, 405, 'method_not_allowed');
      return;
    }
    await handleBackupList(req, res, subject.subjectId, options);
    return;
  }
  if (route.kind === 'backup_manifest') {
    if (method !== 'PUT') {
      sendError(res, 405, 'method_not_allowed');
      return;
    }
    await handleBackupPut(req, res, subject.subjectId, route.backupId, options);
    return;
  }
}

/** Create a hosted-node HTTP handler. This module is never imported by the slim relay server. */
export function createHostedStorageApiHandler(
  options: HostedStorageApiOptions,
): HostedStorageApiHandler {
  return (req, res) => {
    void handleHostedStorageApiRequest(req, res, options).catch((error) => {
      if (!res.headersSent) {
        const errorId = randomUUID();
        options.log?.('hosted_storage_request_error', {
          errorId,
          method: req.method ?? 'GET',
          path: routePath(req),
          errorType: error instanceof Error ? error.name : 'unknown',
        });
        sendError(res, 500, 'internal_error', { errorId });
      } else {
        res.end();
      }
    });
  };
}
