import { sha512Hex } from '../../node/hkdf';
import type {
  EncryptedStorageObject,
  StorageAuthorizationInput,
  StorageAuthorizationResult,
  StorageByteRange,
  StorageCapabilities,
  StorageDeleteResult,
  StorageDestinationAdapter,
  StorageHealth,
  StorageObjectMetadata,
  StorageObjectPage,
  StorageObjectRef,
  StorageQuota,
  StorageResumeToken,
  StorageVerificationEvidence,
  StorageWriteResult,
} from '../types';
import { StorageAdapterError } from '../types';
import type { AccessTokenProvider } from './google-drive';
import type { HttpTransport, HttpTransportResponse } from './http';
import { assertSafeObjectId, equalBytes } from './http';
import {
  OAuthHttpClient,
  decodeOpaque,
  encodeOpaque,
  healthResult,
  incompleteWrite,
  jsonBytes,
  normalizeProviderError,
  optionalByteCount,
  parseHttpsBase,
  parseJsonObject,
  positiveInteger,
  rateLimitedError,
  recordValue,
  requiredString,
  validateCredentialRef,
  validateEncryptedObject,
  validateRange,
  validateResumeOffset,
} from './provider-common';
import { dropboxContentHash } from './provider-crypto';

export type { AccessTokenProvider } from './google-drive';

export { dropboxContentHash } from './provider-crypto';

export interface DropboxAdapterOptions {
  transport: HttpTransport;
  accessTokenProvider: AccessTokenProvider;
  credentialRef: string;
  apiBaseUrl?: string;
  contentBaseUrl?: string;
  maximumObjectBytes?: number;
  uploadChunkBytes?: number;
  pageSize?: number;
  maximumResponseBytes?: number;
  now?: () => string;
}

interface DropboxFile {
  id: string;
  name: string;
  rev: string | null;
  size: number;
  contentHash: string | null;
  serverModified: string | null;
}

interface DropboxPage {
  entries: DropboxFile[];
  cursor: string;
  hasMore: boolean;
}

const DEFAULT_API_BASE = 'https://api.dropboxapi.com/2/';
const DEFAULT_CONTENT_BASE = 'https://content.dropboxapi.com/2/';
const DEFAULT_MAXIMUM_OBJECT_BYTES = 512 * 1024 * 1024;
const DEFAULT_UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAXIMUM_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_PAGE_SIZE = 2_000;
const DROPBOX_ID = /^id:[A-Za-z0-9_-]{1,512}$/u;
const DROPBOX_SESSION_ID = /^[A-Za-z0-9_-]{1,1024}$/u;
const HASH_HEX = /^[a-f0-9]{64}$/u;

export class DropboxStorageAdapter implements StorageDestinationAdapter {
  private readonly accessTokenProvider: AccessTokenProvider;
  private readonly credentialRef: string;
  private readonly apiBase: URL;
  private readonly contentBase: URL;
  private readonly maximumObjectBytes: number;
  private readonly uploadChunkBytes: number;
  private readonly pageSize: number;
  private readonly maximumResponseBytes: number;
  private readonly now: () => string;
  private readonly http: OAuthHttpClient;
  private authorized = false;
  private revoked = false;
  private verifiedReadWrite = false;

  constructor(options: DropboxAdapterOptions) {
    this.accessTokenProvider = options.accessTokenProvider;
    this.credentialRef = validateCredentialRef(options.credentialRef, 'Dropbox');
    this.apiBase = parseHttpsBase(options.apiBaseUrl ?? DEFAULT_API_BASE, 'Dropbox API base URL');
    this.contentBase = parseHttpsBase(options.contentBaseUrl ?? DEFAULT_CONTENT_BASE, 'Dropbox content base URL');
    this.maximumObjectBytes = positiveInteger(
      options.maximumObjectBytes ?? DEFAULT_MAXIMUM_OBJECT_BYTES,
      'maximumObjectBytes',
    );
    this.uploadChunkBytes = positiveInteger(
      options.uploadChunkBytes ?? DEFAULT_UPLOAD_CHUNK_BYTES,
      'uploadChunkBytes',
    );
    this.pageSize = positiveInteger(options.pageSize ?? DEFAULT_PAGE_SIZE, 'pageSize');
    if (this.pageSize > MAX_PAGE_SIZE) {
      throw new StorageAdapterError('provider_error', 'Dropbox page size exceeds the provider limit', false);
    }
    this.maximumResponseBytes = positiveInteger(
      options.maximumResponseBytes ?? DEFAULT_MAXIMUM_RESPONSE_BYTES,
      'maximumResponseBytes',
    );
    this.now = options.now ?? (() => new Date().toISOString());
    this.http = new OAuthHttpClient(
      'Dropbox',
      options.transport,
      options.accessTokenProvider,
      () => { this.authorized = false; },
    );
  }

  async authorize(input: StorageAuthorizationInput): Promise<StorageAuthorizationResult> {
    if (this.revoked && input.kind !== 'interactive') {
      return {
        kind: 'revoked',
        credentialRef: input.credentialRef,
        ...(input.accountHint ? { accountHint: input.accountHint } : {}),
      };
    }
    const token = await this.http.readAccessToken('health');
    if (!token) {
      return {
        kind: 'authorization_required',
        credentialRef: input.credentialRef ?? this.credentialRef,
        ...(input.accountHint ? { accountHint: input.accountHint } : {}),
      };
    }
    this.authorized = true;
    this.revoked = false;
    return {
      kind: 'authorized',
      credentialRef: input.credentialRef ?? this.credentialRef,
      ...(input.accountHint ? { accountHint: input.accountHint } : {}),
    };
  }

  async revoke(options: { deleteRemoteData: boolean }): Promise<void> {
    if (options.deleteRemoteData && this.authorized) {
      let cursor: string | undefined;
      do {
        const page = await this.listObjects(cursor);
        for (const item of page.items) {
          await this.deleteObject({ objectId: item.objectId, remoteRef: item.remoteRef });
        }
        cursor = page.nextCursor ?? undefined;
      } while (cursor !== undefined);
    }
    try {
      await this.accessTokenProvider.revoke?.();
    } finally {
      this.authorized = false;
      this.revoked = true;
      this.verifiedReadWrite = false;
    }
  }

  async capabilities(): Promise<StorageCapabilities> {
    return {
      backgroundWrite: true,
      resumableUpload: true,
      list: true,
      delete: true,
      quota: true,
      serverChecksum: true,
      maximumObjectBytes: this.maximumObjectBytes,
    };
  }

  async health(): Promise<StorageHealth> {
    if (this.revoked) return healthResult(this.now, 'revoked', false, 'revoked');
    if (!this.authorized) return healthResult(this.now, 'auth_required', false, 'auth_required');
    try {
      const response = await this.rpc('health', 'users/get_space_usage', {});
      if (response.status !== 200) throwDropboxResponse(response, this.maximumResponseBytes);
      parseJsonObject(response.body, this.maximumResponseBytes, 'Dropbox');
      return healthResult(this.now, 'ok', this.verifiedReadWrite);
    } catch (error) {
      const normalized = normalizeProviderError(error, 'Dropbox');
      if (normalized.code === 'auth_required') {
        this.authorized = false;
        return healthResult(this.now, 'auth_required', false, normalized.code);
      }
      if (normalized.code === 'unreachable') {
        return healthResult(this.now, 'unreachable', false, normalized.code);
      }
      return healthResult(this.now, 'degraded', false, normalized.code);
    }
  }

  async quota(): Promise<StorageQuota> {
    this.requireAuthorized();
    const response = await this.rpc('quota', 'users/get_space_usage', {});
    if (response.status !== 200) throwDropboxResponse(response, this.maximumResponseBytes);
    const root = parseJsonObject(response.body, this.maximumResponseBytes, 'Dropbox');
    const allocation = recordValue(root.allocation);
    return {
      usedBytes: optionalByteCount(root.used),
      capBytes: optionalByteCount(allocation?.allocated),
      estimated: false,
    };
  }

  async putObject(input: EncryptedStorageObject, resume?: StorageResumeToken): Promise<StorageWriteResult> {
    this.requireAuthorized();
    assertSafeObjectId(input.objectId);
    validateEncryptedObject(input, this.maximumObjectBytes, 'Dropbox');
    const existing = await this.getMetadata(dropboxPath(input.objectId));
    if (existing) return this.resolveExisting(input, existing);

    let sessionId: string;
    let offset: number;
    if (resume) {
      offset = validateResumeOffset(resume, input.encryptedBytes, 'Dropbox', true);
      sessionId = decodeSession(resume.providerSession);
    } else {
      const started = await this.content('write', 'files/upload_session/start', {
        close: false,
      }, new Uint8Array(0));
      if (started.status !== 200) throwDropboxResponse(started, this.maximumResponseBytes);
      const body = parseJsonObject(started.body, this.maximumResponseBytes, 'Dropbox');
      sessionId = requiredString(body.session_id, 1_024) ?? '';
      if (!DROPBOX_SESSION_ID.test(sessionId)) {
        throw new StorageAdapterError('provider_error', 'Dropbox omitted a valid upload session id', true);
      }
      offset = 0;
    }

    const end = Math.min(input.encryptedBytes, offset + this.uploadChunkBytes);
    const chunk = input.ciphertext.slice(offset, end);
    const sessionToken = encodeSession(sessionId);
    if (end < input.encryptedBytes) {
      let appended: HttpTransportResponse;
      try {
        appended = await this.content('write', 'files/upload_session/append_v2', {
          cursor: { session_id: sessionId, offset },
          close: false,
          content_hash: dropboxContentHash(chunk),
        }, chunk);
      } catch (error) {
        const normalized = normalizeProviderError(error, 'Dropbox');
        if (normalized.retryable) return incompleteWrite(input, sessionToken, offset);
        throw normalized;
      }
      if (appended.status === 200) return incompleteWrite(input, sessionToken, end);
      const corrected = dropboxCorrectOffset(appended, this.maximumResponseBytes);
      if (corrected !== null && corrected > offset && corrected <= input.encryptedBytes) {
        return incompleteWrite(input, sessionToken, corrected);
      }
      throwDropboxResponse(appended, this.maximumResponseBytes);
    }

    let finished: HttpTransportResponse;
    try {
      finished = await this.content('write', 'files/upload_session/finish', {
        cursor: { session_id: sessionId, offset },
        commit: {
          path: dropboxPath(input.objectId),
          mode: 'add',
          autorename: false,
          mute: true,
          strict_conflict: true,
        },
        content_hash: dropboxContentHash(chunk),
      }, chunk);
    } catch (error) {
      const normalized = normalizeProviderError(error, 'Dropbox');
      if (normalized.retryable) return incompleteWrite(input, sessionToken, offset);
      throw normalized;
    }
    if (finished.status === 200) {
      return this.completedWrite(input, parseDropboxFile(finished.body, this.maximumResponseBytes));
    }
    if (finished.status === 409) {
      const corrected = dropboxCorrectOffset(finished, this.maximumResponseBytes);
      if (corrected !== null && corrected > offset && corrected <= input.encryptedBytes) {
        return incompleteWrite(input, sessionToken, corrected);
      }
      const raced = await this.getMetadata(dropboxPath(input.objectId));
      if (raced) return this.resolveExisting(input, raced);
    }
    throwDropboxResponse(finished, this.maximumResponseBytes);
  }

  async headObject(ref: StorageObjectRef): Promise<StorageObjectMetadata | null> {
    this.requireAuthorized();
    assertSafeObjectId(ref.objectId);
    const file = await this.resolveFile(ref);
    return file ? metadata(file, ref.objectId) : null;
  }

  async getObject(ref: StorageObjectRef, range?: StorageByteRange): Promise<Uint8Array | null> {
    this.requireAuthorized();
    assertSafeObjectId(ref.objectId);
    if (range) validateRange(range, 'Dropbox');
    const file = await this.resolveFile(ref);
    if (!file) return null;
    return this.downloadFile(file.id, range);
  }

  async listObjects(cursor?: string): Promise<StorageObjectPage> {
    this.requireAuthorized();
    let response: HttpTransportResponse;
    if (cursor === undefined) {
      response = await this.rpc('list', 'files/list_folder', {
        path: '',
        recursive: false,
        include_deleted: false,
        limit: this.pageSize,
      });
    } else {
      const decoded = decodeOpaque(cursor, 'dropbox-cursor', 8_192, 'Dropbox');
      if (decoded.v !== 1 || !requiredString(decoded.cursor, 4_096)) {
        throw new StorageAdapterError('provider_error', 'Dropbox cursor is invalid', false);
      }
      response = await this.rpc('list', 'files/list_folder/continue', { cursor: decoded.cursor });
    }
    if (response.status !== 200) throwDropboxResponse(response, this.maximumResponseBytes);
    const page = parseDropboxPage(response.body, this.maximumResponseBytes);
    return {
      items: page.entries
        .filter((file) => isSafeObjectId(file.name))
        .map((file) => metadata(file, file.name))
        .sort((left, right) => left.objectId.localeCompare(right.objectId)),
      nextCursor: page.hasMore ? encodeOpaque('dropbox-cursor', { v: 1, cursor: page.cursor }) : null,
    };
  }

  async deleteObject(ref: StorageObjectRef): Promise<StorageDeleteResult> {
    this.requireAuthorized();
    assertSafeObjectId(ref.objectId);
    const file = await this.resolveFile(ref);
    if (!file) return { deleted: false, remoteRef: null };
    const response = await this.rpc('delete', 'files/delete_v2', { path: file.id });
    if (response.status === 409 && dropboxNotFound(response, this.maximumResponseBytes)) {
      return { deleted: false, remoteRef: remoteRef(file.id) };
    }
    if (response.status !== 200) throwDropboxResponse(response, this.maximumResponseBytes);
    return { deleted: true, remoteRef: remoteRef(file.id) };
  }

  private async completedWrite(input: EncryptedStorageObject, file: DropboxFile): Promise<StorageWriteResult> {
    const evidence = await this.verifyFile(input, file);
    this.verifiedReadWrite = evidence.kind !== 'none';
    const result = {
      complete: true as const,
      remoteRef: remoteRef(file.id),
      remoteVersion: file.rev,
      encryptedBytes: input.encryptedBytes,
      ciphertextHash: input.ciphertextHash,
    };
    return evidence.kind === 'none'
      ? { ...result, verified: false, verification: evidence }
      : { ...result, verified: true, verification: evidence };
  }

  private async resolveExisting(input: EncryptedStorageObject, file: DropboxFile): Promise<StorageWriteResult> {
    const expected = dropboxContentHash(input.ciphertext);
    if (file.size !== input.encryptedBytes || (file.contentHash && file.contentHash !== expected)) {
      throw new StorageAdapterError(
        'corrupt_ciphertext',
        'the same Dropbox path contains different ciphertext',
        false,
      );
    }
    const bytes = await this.downloadFile(file.id);
    if (!bytes || !equalBytes(bytes, input.ciphertext) || sha512Hex(bytes) !== input.ciphertextHash) {
      throw new StorageAdapterError('corrupt_ciphertext', 'Dropbox conflict read-back did not match ciphertext', false);
    }
    this.verifiedReadWrite = true;
    return {
      complete: true,
      verified: true,
      verification: { kind: 'read_back', ciphertextHash: input.ciphertextHash },
      remoteRef: remoteRef(file.id),
      remoteVersion: file.rev,
      encryptedBytes: input.encryptedBytes,
      ciphertextHash: input.ciphertextHash,
    };
  }

  private async verifyFile(
    input: EncryptedStorageObject,
    file: DropboxFile,
  ): Promise<StorageVerificationEvidence> {
    if (file.name !== input.objectId || file.size !== input.encryptedBytes) {
      throw new StorageAdapterError('corrupt_ciphertext', 'Dropbox upload metadata did not match ciphertext', false);
    }
    const expected = dropboxContentHash(input.ciphertext);
    if (file.contentHash) {
      if (!HASH_HEX.test(file.contentHash) || file.contentHash !== expected) {
        throw new StorageAdapterError('corrupt_ciphertext', 'Dropbox content_hash did not match ciphertext', false);
      }
      return { kind: 'provider_checksum', algorithm: 'dropbox-content-hash', value: file.contentHash };
    }
    const bytes = await this.downloadFile(file.id);
    if (!bytes) return { kind: 'none' };
    if (!equalBytes(bytes, input.ciphertext)) {
      throw new StorageAdapterError('corrupt_ciphertext', 'Dropbox read-back did not match ciphertext', false);
    }
    return { kind: 'read_back', ciphertextHash: input.ciphertextHash };
  }

  private async resolveFile(ref: StorageObjectRef): Promise<DropboxFile | null> {
    const file = await this.getMetadata(ref.remoteRef ? fileIdFromRemoteRef(ref.remoteRef) : dropboxPath(ref.objectId));
    if (!file) return null;
    if (file.name !== ref.objectId) {
      throw new StorageAdapterError(
        'corrupt_ciphertext',
        'Dropbox reference is not bound to the expected Meerkat object',
        false,
      );
    }
    return file;
  }

  private async getMetadata(path: string): Promise<DropboxFile | null> {
    const response = await this.rpc('read', 'files/get_metadata', {
      path,
      include_deleted: false,
    });
    if (response.status === 409 && dropboxNotFound(response, this.maximumResponseBytes)) return null;
    if (response.status !== 200) throwDropboxResponse(response, this.maximumResponseBytes);
    return parseDropboxFile(response.body, this.maximumResponseBytes);
  }

  private async downloadFile(fileId: string, range?: StorageByteRange): Promise<Uint8Array | null> {
    const headers: Record<string, string> = {
      'Dropbox-API-Arg': JSON.stringify({ path: fileId }),
    };
    if (range) {
      if (range.length === 0) return new Uint8Array();
      headers.Range = `bytes=${range.offset}-${range.offset + range.length - 1}`;
    }
    const response = await this.http.request(
      'read',
      'POST',
      new URL('files/download', this.contentBase).href,
      headers,
      new Uint8Array(0),
    );
    if (response.status === 409 && dropboxNotFound(response, this.maximumResponseBytes)) return null;
    if (response.status !== 200 && !(range && response.status === 206)) {
      throwDropboxResponse(response, this.maximumResponseBytes);
    }
    if (response.body.byteLength > this.maximumObjectBytes) {
      throw new StorageAdapterError('provider_error', 'Dropbox object exceeded the configured limit', false);
    }
    if (range && response.status === 200) return response.body.slice(range.offset, range.offset + range.length);
    if (range && response.body.byteLength > range.length) {
      throw new StorageAdapterError('provider_error', 'Dropbox returned too many ranged bytes', false);
    }
    return response.body.slice();
  }

  private rpc(
    operation: 'health' | 'quota' | 'read' | 'list' | 'delete',
    path: string,
    body: unknown,
  ): Promise<HttpTransportResponse> {
    return this.http.request(operation, 'POST', new URL(path, this.apiBase).href, {
      'Content-Type': 'application/json',
    }, jsonBytes(body));
  }

  private content(
    operation: 'write',
    path: string,
    apiArgument: unknown,
    body: Uint8Array,
  ): Promise<HttpTransportResponse> {
    return this.http.request(operation, 'POST', new URL(path, this.contentBase).href, {
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify(apiArgument),
    }, body);
  }

  private requireAuthorized(): void {
    if (!this.authorized) {
      throw new StorageAdapterError('auth_required', 'Dropbox authorization is required', false);
    }
  }
}

function dropboxPath(objectId: string): string {
  assertSafeObjectId(objectId);
  return `/${objectId}`;
}

function parseDropboxFile(bytes: Uint8Array, maximumBytes: number): DropboxFile {
  const record = parseJsonObject(bytes, maximumBytes, 'Dropbox');
  if (record['.tag'] !== 'file') {
    throw new StorageAdapterError('provider_error', 'Dropbox file metadata is malformed', false);
  }
  const id = requiredString(record.id, 520) ?? '';
  const name = requiredString(record.name, 255) ?? '';
  const size = optionalByteCount(record.size);
  if (!DROPBOX_ID.test(id) || !name || size === null) {
    throw new StorageAdapterError('provider_error', 'Dropbox file metadata is malformed', false);
  }
  const contentHash = typeof record.content_hash === 'string' ? record.content_hash.toLowerCase() : null;
  return {
    id,
    name,
    rev: requiredString(record.rev, 512),
    size,
    contentHash,
    serverModified: requiredString(record.server_modified, 128),
  };
}

function parseDropboxPage(bytes: Uint8Array, maximumBytes: number): DropboxPage {
  const record = parseJsonObject(bytes, maximumBytes, 'Dropbox');
  if (!Array.isArray(record.entries) || record.entries.length > MAX_PAGE_SIZE
    || typeof record.has_more !== 'boolean') {
    throw new StorageAdapterError('provider_error', 'Dropbox list page is malformed', false);
  }
  const entries: DropboxFile[] = [];
  for (const value of record.entries) {
    const item = recordValue(value);
    if (!item || item['.tag'] !== 'file') continue;
    entries.push(parseDropboxFile(jsonBytes(item), maximumBytes));
  }
  const cursor = requiredString(record.cursor, 4_096) ?? '';
  if (record.has_more && !cursor) {
    throw new StorageAdapterError('provider_error', 'Dropbox list page omitted its cursor', false);
  }
  return { entries, cursor, hasMore: record.has_more };
}

function metadata(file: DropboxFile, objectId: string): StorageObjectMetadata {
  return {
    objectId,
    dataClass: '',
    remoteRef: remoteRef(file.id),
    remoteVersion: file.rev ?? file.serverModified,
    encryptedBytes: file.size,
    // Dropbox content_hash is not SHA-512, and rev is only a revision token.
    ciphertextHash: null,
  };
}

function remoteRef(fileId: string): string {
  return encodeOpaque('dropbox-ref', { v: 1, id: fileId });
}

function fileIdFromRemoteRef(value: string): string {
  const decoded = decodeOpaque(value, 'dropbox-ref', 2_048, 'Dropbox');
  const id = requiredString(decoded.id, 520) ?? '';
  if (decoded.v !== 1 || !DROPBOX_ID.test(id)) {
    throw new StorageAdapterError('provider_error', 'Dropbox remote reference is invalid', false);
  }
  return id;
}

function encodeSession(sessionId: string): string {
  return encodeOpaque('dropbox-session', { v: 1, sessionId });
}

function decodeSession(value: string): string {
  const decoded = decodeOpaque(value, 'dropbox-session', 4_096, 'Dropbox');
  const sessionId = requiredString(decoded.sessionId, 1_024) ?? '';
  if (decoded.v !== 1 || !DROPBOX_SESSION_ID.test(sessionId)) {
    throw new StorageAdapterError('provider_error', 'Dropbox upload session is invalid', false);
  }
  return sessionId;
}

function isSafeObjectId(value: string): boolean {
  try {
    assertSafeObjectId(value);
    return true;
  } catch {
    return false;
  }
}

function dropboxErrorText(response: HttpTransportResponse, maximumBytes: number): string {
  try {
    return JSON.stringify(parseJsonObject(response.body, maximumBytes, 'Dropbox')).toLowerCase();
  } catch {
    return '';
  }
}

function dropboxNotFound(response: HttpTransportResponse, maximumBytes: number): boolean {
  const text = dropboxErrorText(response, maximumBytes);
  return text.includes('not_found') || text.includes('not found');
}

function dropboxCorrectOffset(response: HttpTransportResponse, maximumBytes: number): number | null {
  if (response.status !== 409) return null;
  try {
    const root = parseJsonObject(response.body, maximumBytes, 'Dropbox');
    return findNestedOffset(root);
  } catch {
    return null;
  }
}

function findNestedOffset(value: unknown, depth = 0): number | null {
  if (depth > 8) return null;
  const record = recordValue(value);
  if (!record) return null;
  const direct = optionalByteCount(record.correct_offset);
  if (direct !== null) return direct;
  for (const child of Object.values(record)) {
    const found = findNestedOffset(child, depth + 1);
    if (found !== null) return found;
  }
  return null;
}

function throwDropboxResponse(response: HttpTransportResponse, maximumBytes: number): never {
  if (response.status === 401) {
    throw new StorageAdapterError('auth_required', 'Dropbox authorization is required', false);
  }
  const detail = dropboxErrorText(response, maximumBytes);
  if (response.status === 403) {
    if (detail.includes('insufficient_space') || detail.includes('space_limit')) {
      throw new StorageAdapterError('quota_exceeded', 'Dropbox storage quota was exceeded', false);
    }
    throw new StorageAdapterError('provider_error', 'Dropbox permission was refused', false);
  }
  if (response.status === 404 || (response.status === 409 && dropboxNotFound(response, maximumBytes))) {
    throw new StorageAdapterError('not_found', 'Dropbox object was not found', false);
  }
  if (response.status === 408 || response.status === 425) {
    throw new StorageAdapterError('unreachable', 'Dropbox request could not complete', true);
  }
  if (response.status === 409 || response.status === 412) {
    throw new StorageAdapterError('conflict', 'Dropbox path changed concurrently', false);
  }
  if (response.status === 413 || response.status === 507) {
    throw new StorageAdapterError('quota_exceeded', 'Dropbox storage quota was exceeded', false);
  }
  if (response.status === 429) throw rateLimitedError('Dropbox', response);
  if (response.status >= 500) {
    throw new StorageAdapterError('provider_error', 'Dropbox returned a server error', true);
  }
  throw new StorageAdapterError('provider_error', 'Dropbox returned an unexpected status', false);
}
